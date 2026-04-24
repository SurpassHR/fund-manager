import Dexie, { type Table } from 'dexie';
import type { Fund, Account, AssetSummary, WatchlistItem, PendingTransaction } from '../types';
import {
  fetchHistoricalFundNavWithDate,
  checkIsMarketTrading,
  fetchParentETFInfo,
  fetchGeneralTencentQuotes,
} from './api';
import { getEffectiveOperationDate, roundMoney, roundShares } from './rebalanceUtils';
import {
  buildFundBackupKey,
  buildFundBackupPayload,
  parseAndNormalizeFundBackupPayload,
} from './fundBackup';
import {
  deriveFundGainActivationState,
  deriveFundHoldingDisplayMetrics,
  deriveFundIntradayDisplayMetrics,
} from './fundDayChange';
import { isEtfLinkFundName } from './constants';
import { sanitizeWatchlistName } from './watchlistName';
import { runFundQuotePipeline } from './fundQuotePipeline';
import type { RefreshExecutionResult, RefreshExecutionStatus } from './refreshPolicy';

export {
  deriveFundGainActivationState,
  deriveFundHoldingDisplayMetrics,
  deriveFundIntradayDisplayMetrics,
  getSettlementDate,
} from './fundDayChange';

class XiaoHuYangJiDB extends Dexie {
  funds!: Table<Fund>;
  accounts!: Table<Account>;
  watchlists!: Table<WatchlistItem>;

  constructor() {
    super('XiaoHuYangJiDB');
    // Version 1
    this.version(1).stores({
      funds: '++id, code, platform, name',
    });
    // Version 2: Add accounts table
    this.version(2).stores({
      funds: '++id, code, platform, name',
      accounts: '++id, name',
    });
    // Version 3: pendingTransactions + settlementDays stored inline in funds
    this.version(3).stores({
      funds: '++id, code, platform, name',
      accounts: '++id, name',
    });
    // Version 4: Add watchlists table
    this.version(4).stores({
      funds: '++id, code, platform, name',
      accounts: '++id, name',
      watchlists: '++id, code, type, name',
    });
  }
}

export const db = new XiaoHuYangJiDB();

// 防止 StrictMode 下重复初始化的竞态
let initPromise: Promise<void> | null = null;

/**
 * Initializes the IndexedDB database.
 * If the accounts table is empty, inserts a default account.
 * Uses a promise to prevent race conditions during StrictMode double invocation.
 * @returns A promise that resolves when initialization is complete.
 */
export const initDB = () => {
  if (!initPromise) {
    initPromise = (async () => {
      const accountsCount = await db.accounts.count();
      if (accountsCount === 0) {
        await db.accounts.bulkAdd([{ name: 'Default', isDefault: true }]);
      }

      await migrateWatchlistNamesInDb();
    })();
  }
  return initPromise;
};

export const migrateWatchlistNamesInDb = async () => {
  const allItems = await db.watchlists.toArray();

  for (const item of allItems) {
    if (!item.id) continue;
    const normalizedName = sanitizeWatchlistName(item.name, item.code);
    if (normalizedName === item.name) continue;
    await db.watchlists.update(item.id, { name: normalizedName });
  }
};

/**
 * 获取本地时间的 YYYY-MM-DD 格式字符串，避免因为 toISOString 的 UTC 时区差异导致日期错切
 */
const getLocalDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isNearlyEqual = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

export const deriveWatchlistFundEffectivePrice = (params: {
  nav: number;
  navDate: string;
  todayStr: string;
  shouldEstimate: boolean;
  estimatedChangePct?: number;
  anchorDate?: string;
}) => {
  const { nav, navDate, todayStr, shouldEstimate, estimatedChangePct, anchorDate } = params;
  const hasEstimate = shouldEstimate && estimatedChangePct !== undefined;
  const isOfficialTodayNav = navDate === todayStr;
  const isAnchorToday = anchorDate === todayStr;

  if (hasEstimate && !isOfficialTodayNav && !isAnchorToday) {
    return nav * (1 + (estimatedChangePct as number) / 100);
  }

  return nav;
};

const getUnsettledOutShares = (fund: Fund) => {
  const txs = fund.pendingTransactions || [];
  return txs.reduce((sum, tx) => {
    if (tx.settled) return sum;
    if (tx.type === 'sell') return sum + tx.amount;
    if (tx.type === 'transferOut') return sum + (tx.outShares ?? tx.amount ?? 0);
    return sum;
  }, 0);
};

export type DeletePendingTransactionParams = {
  fundId: number;
  txId: string;
  transferId?: string;
  type: PendingTransaction['type'];
};

export type DeletePendingTransactionSuccess = {
  deletedCount: number;
  affectedFundIds: number[];
  linkedDelete: boolean;
};

export type DeletePendingTransactionError = DeletePendingTransactionSuccess & {
  code: 'LINKED_DELETE_OVER_LIMIT';
  userMessageKey: 'common.linkedDeleteOverLimit';
  logFields: {
    transferId?: string;
    matchedCount: number;
    fundId: number;
  };
};

export type DeletePendingTransactionResult =
  | DeletePendingTransactionSuccess
  | DeletePendingTransactionError;

const TRANSFER_DELETE_TYPES: PendingTransaction['type'][] = ['transferOut', 'transferIn'];

export const deletePendingTransaction = async (
  params: DeletePendingTransactionParams,
): Promise<DeletePendingTransactionResult> => {
  const { fundId, txId, transferId, type } = params;
  const isLinkedDelete =
    Boolean(transferId) && (type === TRANSFER_DELETE_TYPES[0] || type === TRANSFER_DELETE_TYPES[1]);

  if (!isLinkedDelete) {
    let deletedCount = 0;
    const affectedFundIds = new Set<number>();

    await db.transaction('rw', db.funds, async () => {
      const fund = await db.funds.get(fundId);
      if (!fund) return;

      const originalTxs = fund.pendingTransactions || [];
      const nextTxs = originalTxs.filter((tx) => tx.id !== txId);
      if (nextTxs.length === originalTxs.length) return;

      deletedCount = originalTxs.length - nextTxs.length;
      affectedFundIds.add(fundId);
      await db.funds.update(fundId, { pendingTransactions: nextTxs });
    });

    return {
      deletedCount,
      affectedFundIds: Array.from(affectedFundIds).sort((a, b) => a - b),
      linkedDelete: false,
    };
  }

  const allFunds = await db.funds.toArray();
  const anchorFund = allFunds.find((fund) => fund.id === fundId);
  const anchorTx = (anchorFund?.pendingTransactions || []).find((tx) => tx.id === txId);
  const isValidAnchor =
    Boolean(anchorTx) && anchorTx?.transferId === transferId && anchorTx?.type === type;

  if (!isValidAnchor) {
    return {
      deletedCount: 0,
      affectedFundIds: [],
      linkedDelete: true,
    };
  }

  const matchedTxByFund = new Map<number, string[]>();

  allFunds.forEach((fund) => {
    if (!fund.id) return;

    (fund.pendingTransactions || []).forEach((tx) => {
      if (tx.transferId !== transferId) return;
      if (tx.type !== 'transferOut' && tx.type !== 'transferIn') return;

      const existing = matchedTxByFund.get(fund.id) || [];
      matchedTxByFund.set(fund.id, [...existing, tx.id]);
    });
  });

  const matchedCount = Array.from(matchedTxByFund.values()).reduce(
    (sum, txIds) => sum + txIds.length,
    0,
  );
  if (matchedCount > 2) {
    const logFields = {
      transferId,
      matchedCount,
      fundId,
    };
    console.warn('[deletePendingTransaction] linked delete matched over limit', logFields);

    return {
      code: 'LINKED_DELETE_OVER_LIMIT',
      userMessageKey: 'common.linkedDeleteOverLimit',
      logFields,
      deletedCount: 0,
      affectedFundIds: [],
      linkedDelete: true,
    };
  }

  let deletedCount = 0;
  const affectedFundIds = new Set<number>();

  await db.transaction('rw', db.funds, async () => {
    for (const [linkedFundId, txIds] of matchedTxByFund.entries()) {
      const fund = allFunds.find((item) => item.id === linkedFundId);
      if (!fund) continue;

      const originalTxs = fund.pendingTransactions || [];
      const nextTxs = originalTxs.filter((tx) => !txIds.includes(tx.id));
      if (nextTxs.length === originalTxs.length) continue;

      deletedCount += originalTxs.length - nextTxs.length;
      affectedFundIds.add(linkedFundId);
      await db.funds.update(linkedFundId, { pendingTransactions: nextTxs });
    }
  });

  return {
    deletedCount,
    affectedFundIds: Array.from(affectedFundIds).sort((a, b) => a - b),
    linkedDelete: true,
  };
};

/**
 * Refreshes the latest NAV and change metrics for all held funds.
 * Fetches data from APIs and calculates projected gains if the market hasn't officially updated.
 * Also automatically settles any pending transactions that have reached their settlement date.
 * @returns A promise that resolves when the data refresh is complete.
 */
let refreshPromise: Promise<RefreshExecutionResult> | null = null;

export type RefreshOptions = {
  force?: boolean;
  includeSettlement?: boolean;
};

let settlementPromise: Promise<void> | null = null;

export const runSettlementPipeline = (options?: RefreshOptions) => {
  if (settlementPromise) return settlementPromise;

  void options;

  settlementPromise = (async () => {
    try {
      // === 自动结算在途交易 ===
      const todayForSettlement = getLocalDateString();
      const fundsToSettle = await db.funds.toArray();

      for (const fund of fundsToSettle) {
        const pending = fund.pendingTransactions;
        if (!pending || pending.length === 0) continue;

        let changed = false;
        let newShares = fund.holdingShares;
        let newCostPrice = fund.costPrice;

        const updatedPending = pending.map((tx) => {
          if (tx.settled) return tx;
          if (tx.settlementDate > todayForSettlement) return tx; // 还没到期

          if (tx.type === 'transferOut' || tx.type === 'transferIn') {
            return tx;
          }

          changed = true;

          if (tx.type === 'buy') {
            // 加仓：用确认日的 NAV 计算份额
            const buyNav = fund.currentNav; // 使用最新拉取的 NAV 作为确认日 NAV
            const newBuyShares = tx.amount / buyNav;
            const totalCost = newCostPrice * newShares + tx.amount;
            newShares += newBuyShares;
            newCostPrice = totalCost / newShares; // 加权平均成本
          } else {
            // 减仓：扣减份额，成本价不变
            newShares = Math.max(0, newShares - tx.amount);
          }

          return { ...tx, settled: true };
        });

        if (changed) {
          await db.funds.update(fund.id!, {
            holdingShares: newShares,
            costPrice: newCostPrice,
            pendingTransactions: updatedPending,
          });
        }
      }

      // === 自动结算调仓（A transferOut + B transferIn） ===
      const fundsAfterBasicSettlement = await db.funds.toArray();
      const transferMap = new Map<
        string,
        {
          out?: { fundId: number; txId: string };
          in?: { fundId: number; txId: string };
        }
      >();

      fundsAfterBasicSettlement.forEach((fund) => {
        (fund.pendingTransactions || []).forEach((tx) => {
          if (tx.settled || !tx.transferId) return;
          if (tx.type !== 'transferOut' && tx.type !== 'transferIn') return;
          if (!fund.id) return;
          const pair = transferMap.get(tx.transferId) || {};
          if (tx.type === 'transferOut') {
            pair.out = { fundId: fund.id, txId: tx.id };
          } else {
            pair.in = { fundId: fund.id, txId: tx.id };
          }
          transferMap.set(tx.transferId, pair);
        });
      });

      for (const pair of transferMap.values()) {
        if (!pair.out || !pair.in) continue;

        await db.transaction('rw', db.funds, async () => {
          const sourceFund = await db.funds.get(pair.out!.fundId);
          const targetFund = await db.funds.get(pair.in!.fundId);
          if (!sourceFund || !targetFund) return;

          const sourcePending = sourceFund.pendingTransactions || [];
          const targetPending = targetFund.pendingTransactions || [];
          const sourceTx = sourcePending.find((tx) => tx.id === pair.out!.txId);
          const targetTx = targetPending.find((tx) => tx.id === pair.in!.txId);

          if (!sourceTx || !targetTx || sourceTx.settled || targetTx.settled) return;

          const outShares = sourceTx.outShares ?? sourceTx.amount;
          if (outShares <= 0) return;

          const effectiveOpDate = getEffectiveOperationDate(sourceTx.date, sourceTx.time);
          const [sourceNavRes, targetNavRes] = await Promise.all([
            fetchHistoricalFundNavWithDate(sourceFund.code, effectiveOpDate),
            fetchHistoricalFundNavWithDate(targetFund.code, effectiveOpDate),
          ]);

          if (!sourceNavRes || !targetNavRes) return;
          if (
            sourceNavRes.navDate !== effectiveOpDate ||
            targetNavRes.navDate !== effectiveOpDate
          ) {
            return;
          }

          const unsettledTotal = getUnsettledOutShares(sourceFund);
          const availableForCurrent = Math.max(
            0,
            sourceFund.holdingShares - (unsettledTotal - outShares),
          );
          if (outShares > availableForCurrent) return;

          const sellFeeRate = sourceTx.sellFeeRate ?? 0;
          const buyFeeRate = sourceTx.buyFeeRate ?? 0;
          const grossAmount = roundMoney(outShares * sourceNavRes.nav);
          const netOutAmount = roundMoney(grossAmount * (1 - sellFeeRate));
          const netInAmount = roundMoney(netOutAmount * (1 - buyFeeRate));
          const inShares = roundShares(netInAmount / targetNavRes.nav);

          const nextSourceShares = roundShares(Math.max(0, sourceFund.holdingShares - outShares));
          const nextTargetShares = roundShares(targetFund.holdingShares + inShares);
          const oldTargetCostValue = targetFund.costPrice * targetFund.holdingShares;
          const nextTargetCostPrice =
            nextTargetShares > 0
              ? roundShares((oldTargetCostValue + netInAmount) / nextTargetShares)
              : 0;

          const nextSourcePending = sourcePending.map((tx) => {
            if (tx.id !== sourceTx.id) return tx;
            return {
              ...tx,
              settled: true,
              outShares,
              grossAmount,
              netOutAmount,
              netInAmount,
              settledNavDateUsed: effectiveOpDate,
            };
          });
          const nextTargetPending = targetPending.map((tx) => {
            if (tx.id !== targetTx.id) return tx;
            return {
              ...tx,
              settled: true,
              inShares,
              netInAmount,
              settledNavDateUsed: effectiveOpDate,
            };
          });

          await db.funds.update(sourceFund.id!, {
            holdingShares: nextSourceShares,
            pendingTransactions: nextSourcePending,
          });
          await db.funds.update(targetFund.id!, {
            holdingShares: nextTargetShares,
            costPrice: nextTargetCostPrice,
            pendingTransactions: nextTargetPending,
          });
        });
      }
    } catch (err) {
      console.error('执行结算流水线失败', err);
    } finally {
      settlementPromise = null;
    }
  })();

  return settlementPromise;
};

const buildRefreshExecutionStatus = (attempted: number, failed: number): RefreshExecutionStatus => {
  if (attempted <= 0) return 'skipped';
  if (failed <= 0) return 'success';
  if (failed >= attempted) return 'failed';
  return 'partial_failed';
};

export const refreshFundData = (options?: RefreshOptions) => {
  if (refreshPromise) return refreshPromise;
  const forceRefresh = options?.force ?? false;
  const includeSettlement = options?.includeSettlement ?? true;

  refreshPromise = (async () => {
    let attempted = 0;
    try {
      const allFunds = await db.funds.toArray();
      attempted = allFunds.length;
      if (allFunds.length === 0) {
        return {
          status: 'skipped',
          attempted,
          failed: 0,
          completedAt: Date.now(),
        };
      }

      // 检查当前大盘是否已更新(真正处于开盘且在 9:20 以后)
      const shouldUseEstimatedValue = await checkIsMarketTrading({ force: forceRefresh });
      const todayStr = getLocalDateString();

      const { candidates, estimateMap, failedBase } = await runFundQuotePipeline(
        allFunds.map((fund) => ({
          item: fund,
          code: fund.code,
          fallbackNav: 0,
          fallbackChangePct: 0,
          dropOnMissingNav: true,
        })),
        {
          force: forceRefresh,
          todayStr,
          shouldUseEstimatedValue,
        },
      );

      if (failedBase > 0) console.warn(`刷新基金数据：${failedBase}/${allFunds.length} 个失败`);

      const updateResults = await Promise.allSettled(
        candidates.map(async (candidate) => {
          const { item: fund, nav, navDate, navChangePercent, previousNav } = candidate;
          const estimatedChangePct = estimateMap.get(candidate.code);
          const parentEtfInfo = await fetchParentETFInfo(fund.code, fund.name);
          const isEtfLink = isEtfLinkFundName(fund.name) || Boolean(parentEtfInfo?.parentCode);

          const gainActivationDate =
            candidate.shouldEstimate && navDate !== todayStr ? todayStr : navDate;
          const { isGainActive, dayChangeBaseNav } = deriveFundGainActivationState({
            buyDate: fund.buyDate,
            buyTime: fund.buyTime || 'before15',
            settlementDays: fund.settlementDays ?? 1,
            effectivePctDate: gainActivationDate,
            costPrice: fund.costPrice,
          });

          const metrics = deriveFundIntradayDisplayMetrics({
            holdingShares: fund.holdingShares,
            nav,
            navDate,
            todayStr,
            navChangePercent,
            officialPreviousNav: previousNav,
            shouldEstimate: candidate.shouldEstimate,
            estimatedChangePct,
            isGainActive,
            dayChangeBaseNav,
          });
          const todayChangePreOpen = !shouldUseEstimatedValue && navDate !== todayStr;

          const {
            effectivePctDate,
            dayChangePct: nextDayChangePct,
            dayChangeVal,
            officialDayChangePct,
            estimatedDayChangePct,
            todayChangeIsEstimated,
            todayChangeUnavailable,
          } = metrics;

          const shouldSkipUpdate =
            isNearlyEqual(fund.currentNav, nav) &&
            fund.lastUpdate === effectivePctDate &&
            isNearlyEqual(fund.dayChangePct, nextDayChangePct) &&
            isNearlyEqual(fund.dayChangeVal, dayChangeVal) &&
            isNearlyEqual(fund.officialDayChangePct ?? 0, officialDayChangePct) &&
            isNearlyEqual(fund.estimatedDayChangePct ?? 0, estimatedDayChangePct) &&
            Boolean(fund.todayChangeIsEstimated) === todayChangeIsEstimated &&
            Boolean(fund.todayChangeUnavailable) === todayChangeUnavailable &&
            Boolean(fund.todayChangePreOpen) === todayChangePreOpen &&
            (fund.category ?? 'UNKNOWN') ===
              (isEtfLink ? 'ETF_LINK' : (fund.category ?? 'UNKNOWN')) &&
            (fund.parentEtfInfo?.parentCode ?? '') === (parentEtfInfo?.parentCode ?? '') &&
            (fund.parentEtfInfo?.parentName ?? '') === (parentEtfInfo?.parentName ?? '');

          if (shouldSkipUpdate) return;

          await db.funds.update(fund.id!, {
            currentNav: nav,
            lastUpdate: effectivePctDate,
            dayChangePct: nextDayChangePct,
            dayChangeVal: dayChangeVal,
            officialDayChangePct,
            estimatedDayChangePct,
            todayChangeIsEstimated,
            todayChangeUnavailable,
            todayChangePreOpen,
            category: isEtfLink ? 'ETF_LINK' : fund.category,
            parentEtfInfo: parentEtfInfo || undefined,
          });
        }),
      );

      const failedUpdates = updateResults.filter((r) => r.status === 'rejected').length;
      if (failedUpdates > 0)
        console.warn(`刷新基金数据：${failedUpdates}/${allFunds.length} 个更新失败`);

      if (includeSettlement) {
        await runSettlementPipeline({ force: forceRefresh });
      }

      const failed = failedBase + failedUpdates;
      return {
        status: buildRefreshExecutionStatus(attempted, failed),
        attempted,
        failed,
        completedAt: Date.now(),
      };
    } catch (err) {
      console.error('刷新基金数据失败', err);
      return {
        status: buildRefreshExecutionStatus(attempted, attempted || 1),
        attempted,
        failed: attempted || 1,
        completedAt: Date.now(),
      };
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

let refreshWatchlistPromise: Promise<RefreshExecutionResult> | null = null;

/**
 * Refreshes the latest price and change metrics for all items in the watchlist.
 * Updates both funds and indices/sectors using their respective APIs.
 * @returns A promise that resolves when the watchlist refresh is complete.
 */
export const refreshWatchlistData = (options?: RefreshOptions) => {
  if (refreshWatchlistPromise) return refreshWatchlistPromise;
  const forceRefresh = options?.force ?? false;

  refreshWatchlistPromise = (async () => {
    let attempted = 0;
    let failed = 0;
    try {
      const allItems = await db.watchlists.toArray();
      attempted = allItems.length;
      if (allItems.length === 0) {
        return {
          status: 'skipped',
          attempted,
          failed,
          completedAt: Date.now(),
        };
      }

      const fundItems = allItems.filter((i) => i.type === 'fund');
      const indexItems = allItems.filter((i) => i.type === 'index');
      const todayStr = getLocalDateString();

      // 1. Process Funds
      if (fundItems.length > 0) {
        const shouldUseEstimatedValue = await checkIsMarketTrading({ force: forceRefresh });
        const { candidates, estimateMap } = await runFundQuotePipeline(
          fundItems.map((item) => ({
            item,
            code: item.code,
            fallbackNav: item.currentPrice,
            fallbackChangePct: item.dayChangePct,
            dropOnMissingNav: false,
          })),
          {
            force: forceRefresh,
            todayStr,
            shouldUseEstimatedValue,
          },
        );

        const fundUpdateResults = await Promise.allSettled(
          candidates.map(async (candidate) => {
            const { item, nav, navDate, navChangePercent } = candidate;
            const estimatedChangePct = estimateMap.get(candidate.code);
            const parentEtfInfo = await fetchParentETFInfo(item.code, item.name);
            const isEtfLink = isEtfLinkFundName(item.name) || Boolean(parentEtfInfo?.parentCode);
            const hasOfficialTodayNav = navDate === todayStr;
            const shouldTryEstimate = candidate.shouldEstimate && !hasOfficialTodayNav;
            const hasEstimate = shouldTryEstimate && estimatedChangePct !== undefined;
            const todayChangeUnavailable = shouldTryEstimate && !hasEstimate;
            const todayChangePreOpen = !shouldUseEstimatedValue && navDate !== todayStr;
            const effectivePctDate = shouldTryEstimate ? todayStr : navDate;
            const effectiveCurrentPrice = deriveWatchlistFundEffectivePrice({
              nav,
              navDate,
              todayStr,
              shouldEstimate: candidate.shouldEstimate,
              estimatedChangePct,
              anchorDate: item.anchorDate,
            });

            const nextDayChangePct = hasEstimate
              ? (estimatedChangePct as number)
              : todayChangeUnavailable
                ? 0
                : navChangePercent;
            const nextLastUpdate = effectivePctDate || todayStr;

            const shouldSkipUpdate =
              isNearlyEqual(item.currentPrice, effectiveCurrentPrice) &&
              isNearlyEqual(item.dayChangePct, nextDayChangePct) &&
              item.lastUpdate === nextLastUpdate &&
              Boolean(item.todayChangeIsEstimated) === hasEstimate &&
              Boolean(item.todayChangeUnavailable) === todayChangeUnavailable &&
              Boolean(item.todayChangePreOpen) === todayChangePreOpen &&
              (item.category ?? 'UNKNOWN') ===
                (isEtfLink ? 'ETF_LINK' : (item.category ?? 'UNKNOWN')) &&
              (item.parentEtfInfo?.parentCode ?? '') === (parentEtfInfo?.parentCode ?? '') &&
              (item.parentEtfInfo?.parentName ?? '') === (parentEtfInfo?.parentName ?? '');

            if (shouldSkipUpdate) return;

            await db.watchlists.update(item.id!, {
              currentPrice: effectiveCurrentPrice,
              dayChangePct: nextDayChangePct,
              lastUpdate: nextLastUpdate,
              todayChangeIsEstimated: hasEstimate,
              todayChangeUnavailable,
              todayChangePreOpen,
              category: isEtfLink ? 'ETF_LINK' : item.category,
              parentEtfInfo: parentEtfInfo || undefined,
            });
          }),
        );
        failed += fundUpdateResults.filter((result) => result.status === 'rejected').length;
      }

      // 2. Process Indices / Stocks
      if (indexItems.length > 0) {
        const codes = indexItems.map((i) => i.code);
        const quotes = await fetchGeneralTencentQuotes(codes, { force: forceRefresh });

        const indexResults = await Promise.allSettled(
          indexItems.map(async (item) => {
            const data = quotes[item.code];
            if (data) {
              await db.watchlists.update(item.id!, {
                currentPrice: data.currentPrice,
                dayChangePct: data.changePct,
                lastUpdate: todayStr,
              });
            } else {
              throw new Error(`Missing quote for index item: ${item.code}`);
            }
          }),
        );
        failed += indexResults.filter((result) => result.status === 'rejected').length;
      }

      return {
        status: buildRefreshExecutionStatus(attempted, failed),
        attempted,
        failed,
        completedAt: Date.now(),
      };
    } catch (err) {
      console.error('Failed to refresh watchlist data', err);
      return {
        status: buildRefreshExecutionStatus(attempted, attempted || 1),
        attempted,
        failed: attempted || 1,
        completedAt: Date.now(),
      };
    } finally {
      refreshWatchlistPromise = null;
    }
  })();

  return refreshWatchlistPromise;
};

/**
 * Calculates the aggregate asset summary for a given list of funds.
 * @param funds - Array of fund objects to aggregate.
 * @returns The calculated AssetSummary including total assets, daily gain, and holding gain.
 */
export const calculateSummary = (funds: Fund[]): AssetSummary => {
  let totalAssets = 0;
  let totalDayGain = 0;
  let totalCost = 0;
  let holdingGain = 0;

  const todayStr = getLocalDateString();

  funds.forEach((fund) => {
    const {
      marketValue,
      totalCost: costValue,
      totalGain,
      isInTransit,
      dayChangeBaseNav,
    } = deriveFundHoldingDisplayMetrics({
      holdingShares: fund.holdingShares,
      currentNav: fund.currentNav,
      costPrice: fund.costPrice,
      buyDate: fund.buyDate,
      buyTime: fund.buyTime,
      settlementDays: fund.settlementDays,
      effectiveDate: fund.lastUpdate || todayStr,
    });

    // 如果该基金的最后更新日期不是“今天”，说明它的涨跌幅停留在之前的交易日
    // 此时它对“今日总收益”的贡献应当为 0
    const dayGain =
      !isInTransit && fund.lastUpdate === todayStr
        ? fund.todayChangeUnavailable
          ? 0
          : dayChangeBaseNav !== undefined
            ? fund.todayChangeIsEstimated
              ? (fund.holdingShares * dayChangeBaseNav * (fund.estimatedDayChangePct ?? 0)) / 100
              : marketValue - fund.holdingShares * dayChangeBaseNav
            : fund.todayChangeIsEstimated
              ? (marketValue * (fund.estimatedDayChangePct ?? 0)) / 100
              : fund.dayChangeVal
        : 0;

    totalAssets += marketValue;
    totalDayGain += dayGain;
    totalCost += costValue;
    holdingGain += totalGain;
  });

  const holdingGainPct = totalCost > 0 ? (holdingGain / totalCost) * 100 : 0;
  const totalDayGainPct =
    totalAssets - totalDayGain > 0 ? (totalDayGain / (totalAssets - totalDayGain)) * 100 : 0;

  return {
    totalAssets,
    totalDayGain,
    totalDayGainPct,
    holdingGain,
    holdingGainPct,
  };
};

// === 导入导出 ===

/**
 * Exports all tracked funds from IndexedDB to a JSON file.
 * Triggers a download of the backup file in the browser.
 * @returns A promise resolving when the export is complete.
 */
export const exportFunds = async (): Promise<void> => {
  const allFunds = await db.funds.toArray();
  const allAccounts = await db.accounts.toArray();
  const allWatchlists = await db.watchlists.toArray();
  const data = buildFundBackupPayload(allFunds, undefined, allAccounts, allWatchlists);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fund-manager-backup-${getLocalDateString()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Imports funds from a valid JSON backup file into IndexedDB.
 * Skips duplicate funds based on code and platform.
 * @param file - The JSON File object to import.
 * @returns A promise that resolves to an object containing the count of added and skipped items.
 */
export const importFunds = async (file: File): Promise<{ added: number; skipped: number }> => {
  const text = await file.text();
  return importFundsFromBackupContent(text);
};

export const exportFundsToJsonString = async (): Promise<string> => {
  const allFunds = await db.funds.toArray();
  const allAccounts = await db.accounts.toArray();
  const allWatchlists = await db.watchlists.toArray();
  return JSON.stringify(
    buildFundBackupPayload(allFunds, undefined, allAccounts, allWatchlists),
    null,
    2,
  );
};

export const importFundsFromBackupContent = async (
  content: string | unknown,
  options?: {
    duplicateFundStrategy?: 'skip' | 'overwriteIfDifferent';
    importMode?: 'merge' | 'replaceAll';
  },
): Promise<{ added: number; skipped: number }> => {
  const {
    funds: importedFunds,
    accounts: importedAccounts,
    watchlists: importedWatchlists,
  } = parseAndNormalizeFundBackupPayload(content);

  const importMode = options?.importMode ?? 'merge';

  const normalizeImportedFund = (fund: Fund): Fund => {
    const normalized: Fund = { ...fund };

    // todayChangeIsEstimated=false 时，estimatedDayChangePct 不应参与任何展示/计算
    // 导入时做防御性清理，避免跨设备同步残留临时估值字段导致口径不一致。
    if (normalized.todayChangeIsEstimated !== true) {
      normalized.estimatedDayChangePct = 0;
    }

    if (normalized.todayChangeUnavailable === true) {
      normalized.todayChangeIsEstimated = false;
      normalized.estimatedDayChangePct = 0;
      normalized.dayChangeVal = 0;
      normalized.dayChangePct = 0;
      normalized.todayChangePreOpen = false;
    }

    return normalized;
  };

  const normalizedImportedFunds = importedFunds.map(normalizeImportedFund);

  if (importMode === 'replaceAll') {
    const isCompletelyEmpty =
      importedFunds.length === 0 &&
      importedAccounts.length === 0 &&
      importedWatchlists.length === 0;

    if (isCompletelyEmpty) {
      return { added: 0, skipped: 0 };
    }

    await db.transaction('rw', db.funds, db.accounts, db.watchlists, async () => {
      await db.funds.clear();
      await db.accounts.clear();
      await db.watchlists.clear();

      if (normalizedImportedFunds.length > 0) {
        await db.funds.bulkAdd(normalizedImportedFunds);
      }
      if (importedAccounts.length > 0) {
        await db.accounts.bulkAdd(importedAccounts);
      }
      if (importedWatchlists.length > 0) {
        await db.watchlists.bulkAdd(importedWatchlists);
      }
    });

    return {
      added: normalizedImportedFunds.length + importedAccounts.length + importedWatchlists.length,
      skipped: 0,
    };
  }

  let added = 0;
  let skipped = 0;

  const existingAccounts = await db.accounts.toArray();
  const existingAccountNames = new Set(existingAccounts.map((account) => account.name));

  const accountCandidates = new Map<string, { name: string }>();
  importedAccounts.forEach((account) => {
    accountCandidates.set(account.name, { name: account.name });
  });
  importedFunds.forEach((fund) => {
    if (!accountCandidates.has(fund.platform)) {
      accountCandidates.set(fund.platform, { name: fund.platform });
    }
  });

  for (const account of accountCandidates.values()) {
    if (existingAccountNames.has(account.name)) {
      continue;
    }

    await db.accounts.add({ name: account.name, isDefault: false });
    added++;
    existingAccountNames.add(account.name);
  }

  const existingFunds = await db.funds.toArray();
  const existingFundMap = new Map(existingFunds.map((f) => [buildFundBackupKey(f), f]));
  const duplicateFundStrategy = options?.duplicateFundStrategy ?? 'skip';

  const hasFundChanged = (current: Fund, incoming: Fund) => {
    const fields: Array<keyof Fund> = [
      'code',
      'name',
      'platform',
      'holdingShares',
      'costPrice',
      'currentNav',
      'lastUpdate',
      'dayChangePct',
      'dayChangeVal',
      'officialDayChangePct',
      'estimatedDayChangePct',
      'todayChangeIsEstimated',
      'todayChangeUnavailable',
      'todayChangePreOpen',
      'buyDate',
      'buyTime',
      'settlementDays',
    ];

    return fields.some((field) => current[field] !== incoming[field]);
  };

  for (const fund of normalizedImportedFunds) {
    const key = buildFundBackupKey(fund);
    const existing = existingFundMap.get(key);

    if (existing) {
      if (
        duplicateFundStrategy === 'overwriteIfDifferent' &&
        existing.id != null &&
        hasFundChanged(existing, fund)
      ) {
        await db.funds.update(existing.id, fund as Partial<Fund>);
      } else {
        skipped++;
      }
      continue;
    }

    await db.funds.add(fund);
    added++;
    existingFundMap.set(key, fund);
  }

  const existingWatchlists = await db.watchlists.toArray();
  const existingWatchlistKeys = new Set(
    existingWatchlists.map((item) => `${item.type}:${item.code}:${item.platform || ''}`),
  );

  for (const watchlist of importedWatchlists) {
    const key = `${watchlist.type}:${watchlist.code}:${watchlist.platform || ''}`;
    if (existingWatchlistKeys.has(key)) {
      skipped++;
      continue;
    }

    await db.watchlists.add(watchlist);
    added++;
    existingWatchlistKeys.add(key);
  }

  return { added, skipped };
};
