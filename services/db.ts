import Dexie, { type Table } from 'dexie';
import type {
  Fund,
  Account,
  AssetSummary,
  WatchlistItem,
  EquityHolding,
  PendingTransaction,
} from '../types';
import {
  fetchFundCommonData,
  fetchEastMoneyLatestNav,
  fetchHistoricalFundNavWithDate,
  fetchFundHoldings,
  fetchTencentStockQuotes,
  checkIsMarketTrading,
  fetchGeneralTencentQuotes,
  buildTencentQuoteCodes,
} from './api';
import { getEffectiveOperationDate, roundMoney, roundShares } from './rebalanceUtils';
import {
  buildFundBackupKey,
  buildFundBackupPayload,
  parseAndNormalizeFundBackupPayload,
} from './fundBackup';

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
    })();
  }
  return initPromise;
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

const normalizeTicker = (ticker?: string) => (ticker ? ticker.replace(/\D/g, '') : '');

const isNearlyEqual = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

export const deriveWatchlistFundEffectivePrice = (params: {
  nav: number;
  navDate: string;
  todayStr: string;
  shouldEstimate: boolean;
  estimatedChangePct?: number;
  fallbackChangePct?: number;
  anchorDate?: string;
}) => {
  const {
    nav,
    navDate,
    todayStr,
    shouldEstimate,
    estimatedChangePct,
    fallbackChangePct,
    anchorDate,
  } = params;
  const projectedPct = estimatedChangePct ?? fallbackChangePct;
  const hasEstimate = shouldEstimate && projectedPct !== undefined;
  const isOfficialTodayNav = navDate === todayStr;
  const isAnchorToday = anchorDate === todayStr;

  if (hasEstimate && !isOfficialTodayNav && !isAnchorToday) {
    return nav * (1 + (projectedPct as number) / 100);
  }

  return nav;
};

export const deriveFundIntradayDisplayMetrics = (params: {
  holdingShares: number;
  nav: number;
  navDate: string;
  todayStr: string;
  navChangePercent: number;
  shouldEstimate: boolean;
  estimatedChangePct?: number;
  isGainActive: boolean;
}) => {
  const {
    holdingShares,
    nav,
    navDate,
    todayStr,
    navChangePercent,
    shouldEstimate,
    estimatedChangePct,
    isGainActive,
  } = params;

  const hasEstimate = shouldEstimate && estimatedChangePct !== undefined;
  const estimateUnavailable = shouldEstimate && estimatedChangePct === undefined;
  const effectivePctDate = hasEstimate || estimateUnavailable ? todayStr : navDate;

  const marketValue = holdingShares * nav;

  let dayChangeVal = 0;
  if (isGainActive) {
    if (hasEstimate && estimatedChangePct !== undefined) {
      dayChangeVal = marketValue * (estimatedChangePct / 100);
    } else if (!estimateUnavailable) {
      dayChangeVal = (marketValue * (navChangePercent / 100)) / (1 + navChangePercent / 100);
    }
  }

  const dayChangePct = isGainActive
    ? hasEstimate && estimatedChangePct !== undefined
      ? estimatedChangePct
      : estimateUnavailable
        ? 0
        : navChangePercent
    : 0;

  return {
    effectivePctDate,
    dayChangePct,
    dayChangeVal,
    officialDayChangePct: navChangePercent,
    estimatedDayChangePct:
      isGainActive && hasEstimate && estimatedChangePct !== undefined ? estimatedChangePct : 0,
    todayChangeIsEstimated: isGainActive && hasEstimate && estimatedChangePct !== undefined,
    todayChangeUnavailable: isGainActive && estimateUnavailable,
  };
};

type HoldingTicker = { ticker: string };
type HoldingWithWeight = HoldingTicker & { weight: number };

const calcWeightedChangePct = (
  holdings: HoldingWithWeight[],
  quotePctMap: Record<string, number>,
) => {
  let weightedPctSum = 0;
  let totalWeight = 0;

  holdings.forEach((h) => {
    const key = normalizeTicker(h.ticker);
    if (!key) return;
    const pct = quotePctMap[key];
    if (pct !== undefined) {
      weightedPctSum += (h.weight / 100) * pct;
      totalWeight += h.weight;
    }
  });

  if (totalWeight > 0) {
    return weightedPctSum / (totalWeight / 100);
  }
  return null;
};

const buildQuotePctMap = async (holdingsList: HoldingTicker[][], force?: boolean) => {
  const codeSet = new Set<string>();
  holdingsList.forEach((holdings) => {
    const codes = buildTencentQuoteCodes(holdings.map((h) => h.ticker));
    codes.forEach((code) => codeSet.add(code));
  });

  if (codeSet.size === 0) return {};

  try {
    const quoteMap = await fetchTencentStockQuotes(Array.from(codeSet), { force });
    const pctMap: Record<string, number> = {};
    Object.entries(quoteMap).forEach(([ticker, quote]) => {
      if (typeof quote.pct === 'number') {
        pctMap[ticker] = quote.pct;
      }
    });
    return pctMap;
  } catch (err) {
    console.error('批量获取实时行情失败', err);
    return {};
  }
};

/**
 * 根据买入日期和时间，估算基金的“成本生效日期”（即这天的净值作为买入成本）
 * 收益只有在这个日期【之后】的市场交易日才会产生
 */
const getCostDateStr = (buyDateStr: string, buyTime: 'before15' | 'after15'): string => {
  const d = new Date(buyDateStr);

  // 如果是周末买入，自动顺延到下周一，且相当于周一 15:00 前买入
  if (d.getDay() === 0) {
    // 周日
    d.setDate(d.getDate() + 1);
    buyTime = 'before15';
  } else if (d.getDay() === 6) {
    // 周六
    d.setDate(d.getDate() + 2);
    buyTime = 'before15';
  }

  // 如果是 15:00 后买入，成本按下一个交易日算
  if (buyTime === 'after15') {
    d.setDate(d.getDate() + 1);
    // 如果顺延后碰到了周末（比如周五15点后，按周一算）
    if (d.getDay() === 6) d.setDate(d.getDate() + 2);
    else if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Calculates the settlement date for a transaction (T+N days).
 * Skips weekends and treats after 15:00 as the next trading day.
 * @param opDateStr - The operation date (YYYY-MM-DD).
 * @param opTime - Whether the operation was before or after 15:00.
 * @param tPlusN - The number of trading days until settlement.
 * @returns The calculated settlement date (YYYY-MM-DD).
 */
export const getSettlementDate = (
  opDateStr: string,
  opTime: 'before15' | 'after15',
  tPlusN: number,
): string => {
  const d = new Date(opDateStr);

  // 如果是周末操作，顺延到周一
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  else if (d.getDay() === 6) d.setDate(d.getDate() + 2);

  // 15:00 后操作，等效于下一个交易日操作
  if (opTime === 'after15') {
    d.setDate(d.getDate() + 1);
    if (d.getDay() === 6) d.setDate(d.getDate() + 2);
    else if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  }

  // 往前走 N 个交易日
  let remaining = tPlusN;
  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      remaining--;
    }
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
let refreshPromise: Promise<void> | null = null;

type RefreshOptions = { force?: boolean };

export const refreshFundData = (options?: RefreshOptions) => {
  if (refreshPromise) return refreshPromise;
  const forceRefresh = options?.force ?? false;

  refreshPromise = (async () => {
    try {
      const allFunds = await db.funds.toArray();
      if (allFunds.length === 0) return;

      // 检查当前大盘是否已更新(真正处于开盘且在 9:20 以后)
      const shouldUseEstimatedValue = await checkIsMarketTrading({ force: forceRefresh });
      const todayStr = getLocalDateString();

      const baseResults = await Promise.allSettled(
        allFunds.map(async (fund) => {
          let nav = 0;
          let navDate = '';
          let navChangePercent = 0;

          const emData = await fetchEastMoneyLatestNav(fund.code, { force: forceRefresh });
          if (emData) {
            nav = emData.nav;
            navDate = emData.navDate;
            navChangePercent = emData.navChangePercent;
          } else {
            const json = await fetchFundCommonData(fund.code, { force: forceRefresh });
            if (!json?.data?.nav) return null;
            ({ nav, navDate, navChangePercent } = json.data);
          }

          const isOfficialTodayNavOut = navDate === todayStr;
          const shouldEstimate = shouldUseEstimatedValue && !isOfficialTodayNavOut;

          return {
            fund,
            nav,
            navDate,
            navChangePercent,
            shouldEstimate,
          };
        }),
      );

      const candidates: Array<{
        fund: Fund;
        nav: number;
        navDate: string;
        navChangePercent: number;
        shouldEstimate: boolean;
      }> = [];
      const estimateCandidates: Array<{
        fund: Fund;
        nav: number;
        navDate: string;
        navChangePercent: number;
        shouldEstimate: boolean;
      }> = [];
      let failedBase = 0;

      baseResults.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          candidates.push(result.value);
          if (result.value.shouldEstimate) {
            estimateCandidates.push(result.value);
          }
        } else if (result.status === 'rejected') {
          failedBase += 1;
        }
      });

      if (failedBase > 0) console.warn(`刷新基金数据：${failedBase}/${allFunds.length} 个失败`);

      const estimateMap = new Map<string, number>();

      if (estimateCandidates.length > 0) {
        const holdingsResults = await Promise.allSettled(
          estimateCandidates.map(async (candidate) => {
            const holdingsJson = await fetchFundHoldings(candidate.fund.code);
            const equityHoldings = holdingsJson?.data?.equityHoldings as
              | EquityHolding[]
              | undefined;
            if (!equityHoldings || equityHoldings.length === 0) return null;
            return { code: candidate.fund.code, holdings: equityHoldings.slice(0, 10) };
          }),
        );

        const holdingsMap = new Map<string, EquityHolding[]>();
        holdingsResults.forEach((result) => {
          if (result.status === 'fulfilled' && result.value) {
            holdingsMap.set(result.value.code, result.value.holdings);
          }
        });

        const quotePctMap = await buildQuotePctMap(Array.from(holdingsMap.values()), forceRefresh);
        holdingsMap.forEach((holdings, code) => {
          const estimated = calcWeightedChangePct(holdings, quotePctMap);
          if (estimated !== null) {
            estimateMap.set(code, estimated);
          }
        });
      }

      const updateResults = await Promise.allSettled(
        candidates.map(async (candidate) => {
          const { fund, nav, navDate, navChangePercent } = candidate;
          const estimatedChangePct = estimateMap.get(fund.code);

          let isGainActive = true;
          if (fund.buyDate) {
            const costDateStr = getCostDateStr(fund.buyDate, fund.buyTime || 'before15');
            const estimatedEffectiveDate =
              candidate.shouldEstimate && navDate !== todayStr ? todayStr : navDate;
            if (estimatedEffectiveDate <= costDateStr) {
              isGainActive = false;
            }
          }

          const nextMetrics = deriveFundIntradayDisplayMetrics({
            holdingShares: fund.holdingShares,
            nav,
            navDate,
            todayStr,
            navChangePercent,
            shouldEstimate: candidate.shouldEstimate,
            estimatedChangePct,
            isGainActive,
          });

          const shouldSkipUpdate =
            isNearlyEqual(fund.currentNav, nav) &&
            fund.lastUpdate === nextMetrics.effectivePctDate &&
            isNearlyEqual(fund.dayChangePct, nextMetrics.dayChangePct) &&
            isNearlyEqual(fund.dayChangeVal, nextMetrics.dayChangeVal) &&
            isNearlyEqual(fund.officialDayChangePct ?? 0, nextMetrics.officialDayChangePct) &&
            isNearlyEqual(fund.estimatedDayChangePct ?? 0, nextMetrics.estimatedDayChangePct) &&
            Boolean(fund.todayChangeIsEstimated) === nextMetrics.todayChangeIsEstimated &&
            Boolean(fund.todayChangeUnavailable) === nextMetrics.todayChangeUnavailable;

          if (shouldSkipUpdate) return;

          await db.funds.update(fund.id!, {
            currentNav: nav,
            lastUpdate: nextMetrics.effectivePctDate,
            dayChangePct: nextMetrics.dayChangePct,
            dayChangeVal: nextMetrics.dayChangeVal,
            officialDayChangePct: nextMetrics.officialDayChangePct,
            estimatedDayChangePct: nextMetrics.estimatedDayChangePct,
            todayChangeIsEstimated: nextMetrics.todayChangeIsEstimated,
            todayChangeUnavailable: nextMetrics.todayChangeUnavailable,
          });
        }),
      );

      const failedUpdates = updateResults.filter((r) => r.status === 'rejected').length;
      if (failedUpdates > 0)
        console.warn(`刷新基金数据：${failedUpdates}/${allFunds.length} 个更新失败`);

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
      console.error('刷新基金数据失败', err);
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

let refreshWatchlistPromise: Promise<void> | null = null;

/**
 * Refreshes the latest price and change metrics for all items in the watchlist.
 * Updates both funds and indices/sectors using their respective APIs.
 * @returns A promise that resolves when the watchlist refresh is complete.
 */
export const refreshWatchlistData = (options?: RefreshOptions) => {
  if (refreshWatchlistPromise) return refreshWatchlistPromise;
  const forceRefresh = options?.force ?? false;

  refreshWatchlistPromise = (async () => {
    try {
      const allItems = await db.watchlists.toArray();
      if (allItems.length === 0) return;

      const fundItems = allItems.filter((i) => i.type === 'fund');
      const indexItems = allItems.filter((i) => i.type === 'index');
      const todayStr = getLocalDateString();

      // 1. Process Funds
      if (fundItems.length > 0) {
        const shouldUseEstimatedValue = await checkIsMarketTrading({ force: forceRefresh });
        const baseResults = await Promise.allSettled(
          fundItems.map(async (item) => {
            let nav = item.currentPrice;
            let navDate = '';
            let navChangePercent = item.dayChangePct;

            const emData = await fetchEastMoneyLatestNav(item.code, { force: forceRefresh });
            if (emData) {
              nav = emData.nav;
              navDate = emData.navDate;
              navChangePercent = emData.navChangePercent;
            } else {
              const json = await fetchFundCommonData(item.code, { force: forceRefresh });
              if (json?.data?.nav) {
                ({ nav, navDate, navChangePercent } = json.data);
              }
            }

            const isOfficialTodayNavOut = navDate === todayStr;
            const shouldEstimate = shouldUseEstimatedValue && !isOfficialTodayNavOut;

            return {
              item,
              nav,
              navDate,
              navChangePercent,
              shouldEstimate,
            };
          }),
        );

        const candidates: Array<{
          item: WatchlistItem;
          nav: number;
          navDate: string;
          navChangePercent: number;
          shouldEstimate: boolean;
        }> = [];
        const estimateCandidates: Array<{
          item: WatchlistItem;
          nav: number;
          navDate: string;
          navChangePercent: number;
          shouldEstimate: boolean;
        }> = [];

        baseResults.forEach((result) => {
          if (result.status === 'fulfilled' && result.value) {
            candidates.push(result.value);
            if (result.value.shouldEstimate) {
              estimateCandidates.push(result.value);
            }
          }
        });

        const estimateMap = new Map<string, number>();
        if (estimateCandidates.length > 0) {
          const holdingsResults = await Promise.allSettled(
            estimateCandidates.map(async (candidate) => {
              const holdingsJson = await fetchFundHoldings(candidate.item.code);
              const equityHoldings = holdingsJson?.data?.equityHoldings as
                | EquityHolding[]
                | undefined;
              if (!equityHoldings || equityHoldings.length === 0) return null;
              return { code: candidate.item.code, holdings: equityHoldings.slice(0, 10) };
            }),
          );

          const holdingsMap = new Map<string, EquityHolding[]>();
          holdingsResults.forEach((result) => {
            if (result.status === 'fulfilled' && result.value) {
              holdingsMap.set(result.value.code, result.value.holdings);
            }
          });

          const quotePctMap = await buildQuotePctMap(
            Array.from(holdingsMap.values()),
            forceRefresh,
          );
          holdingsMap.forEach((holdings, code) => {
            const estimated = calcWeightedChangePct(holdings, quotePctMap);
            if (estimated !== null) {
              estimateMap.set(code, estimated);
            }
          });
        }

        await Promise.allSettled(
          candidates.map(async (candidate) => {
            const { item, nav, navDate, navChangePercent } = candidate;
            const estimatedChangePct = estimateMap.get(item.code);
            const projectedPct = estimatedChangePct ?? navChangePercent;
            const shouldProjectToday =
              candidate.shouldEstimate && navDate !== todayStr && projectedPct !== undefined;
            const effectivePctDate = shouldProjectToday ? todayStr : navDate;
            const effectiveCurrentPrice = deriveWatchlistFundEffectivePrice({
              nav,
              navDate,
              todayStr,
              shouldEstimate: candidate.shouldEstimate,
              estimatedChangePct,
              fallbackChangePct: navChangePercent,
              anchorDate: item.anchorDate,
            });

            const nextDayChangePct = shouldProjectToday ? projectedPct : navChangePercent;
            const nextLastUpdate = effectivePctDate || todayStr;

            const shouldSkipUpdate =
              isNearlyEqual(item.currentPrice, effectiveCurrentPrice) &&
              isNearlyEqual(item.dayChangePct, nextDayChangePct) &&
              item.lastUpdate === nextLastUpdate;

            if (shouldSkipUpdate) return;

            await db.watchlists.update(item.id!, {
              currentPrice: effectiveCurrentPrice,
              dayChangePct: nextDayChangePct,
              lastUpdate: nextLastUpdate,
            });
          }),
        );
      }

      // 2. Process Indices / Stocks
      if (indexItems.length > 0) {
        const codes = indexItems.map((i) => i.code);
        const quotes = await fetchGeneralTencentQuotes(codes, { force: forceRefresh });

        await Promise.allSettled(
          indexItems.map(async (item) => {
            const data = quotes[item.code];
            if (data) {
              await db.watchlists.update(item.id!, {
                currentPrice: data.currentPrice,
                dayChangePct: data.changePct,
                lastUpdate: todayStr,
              });
            }
          }),
        );
      }
    } catch (err) {
      console.error('Failed to refresh watchlist data', err);
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

  const todayStr = getLocalDateString();

  funds.forEach((fund) => {
    const assetValue = fund.holdingShares * fund.currentNav;
    const costValue = fund.holdingShares * fund.costPrice;

    // 如果该基金的最后更新日期不是“今天”，说明它的涨跌幅停留在之前的交易日
    // 此时它对“今日总收益”的贡献应当为 0
    const dayGain = fund.lastUpdate === todayStr ? fund.dayChangeVal : 0;

    totalAssets += assetValue;
    totalDayGain += dayGain;
    totalCost += costValue;
  });

  const holdingGain = totalAssets - totalCost;
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
  },
): Promise<{ added: number; skipped: number }> => {
  const {
    funds: importedFunds,
    accounts: importedAccounts,
    watchlists: importedWatchlists,
  } = parseAndNormalizeFundBackupPayload(content);

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
  const existingFundsByKey = new Map(existingFunds.map((fund) => [buildFundBackupKey(fund), fund]));

  const normalizeValue = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(normalizeValue);
    }

    if (value && typeof value === 'object') {
      return Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .reduce<Record<string, unknown>>((acc, [key, nested]) => {
          if (nested !== undefined) {
            acc[key] = normalizeValue(nested);
          }
          return acc;
        }, {});
    }

    return value;
  };

  const toComparableFund = (fund: Fund): unknown => {
    const withId = fund as Fund & { id?: number };
    const { id, ...rest } = withId;
    void id;
    return normalizeValue(rest);
  };

  const isFundFullySame = (left: Fund, right: Fund) => {
    return JSON.stringify(toComparableFund(left)) === JSON.stringify(toComparableFund(right));
  };

  for (const fund of importedFunds) {
    const key = buildFundBackupKey(fund);
    const existing = existingFundsByKey.get(key);

    if (!existing) {
      await db.funds.add(fund);
      added++;
      continue;
    }

    if (
      options?.duplicateFundStrategy === 'overwriteIfDifferent' &&
      !isFundFullySame(existing, fund) &&
      existing.id !== undefined
    ) {
      await db.funds.update(existing.id, { ...fund });
      continue;
    }

    if (existing) {
      skipped++;
      continue;
    }
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
