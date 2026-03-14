import Dexie, { type Table } from 'dexie';
import type { Fund, Account, AssetSummary, WatchlistItem, EquityHolding } from '../types';
import {
  fetchFundCommonData,
  fetchEastMoneyLatestNav,
  fetchFundHoldings,
  fetchTencentStockQuotes,
  checkIsMarketTrading,
  fetchGeneralTencentQuotes,
  buildTencentQuoteCodes,
} from './api';

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
          const hasEstimate = candidate.shouldEstimate && estimatedChangePct !== undefined;

          const effectivePctDate = hasEstimate ? todayStr : navDate;

          let isGainActive = true;
          if (fund.buyDate) {
            const costDateStr = getCostDateStr(fund.buyDate, fund.buyTime || 'before15');
            if (effectivePctDate <= costDateStr) {
              isGainActive = false;
            }
          }

          let dayChangeVal = 0;
          if (isGainActive) {
            const mktVal = fund.holdingShares * nav;
            if (hasEstimate && estimatedChangePct !== undefined) {
              dayChangeVal = mktVal * (estimatedChangePct / 100);
            } else {
              dayChangeVal = (mktVal * (navChangePercent / 100)) / (1 + navChangePercent / 100);
            }
          }

          const nextDayChangePct = isGainActive
            ? hasEstimate && estimatedChangePct !== undefined
              ? estimatedChangePct
              : navChangePercent
            : 0;

          const shouldSkipUpdate =
            isNearlyEqual(fund.currentNav, nav) &&
            fund.lastUpdate === effectivePctDate &&
            isNearlyEqual(fund.dayChangePct, nextDayChangePct) &&
            isNearlyEqual(fund.dayChangeVal, dayChangeVal);

          if (shouldSkipUpdate) return;

          await db.funds.update(fund.id!, {
            currentNav: nav,
            lastUpdate: effectivePctDate,
            dayChangePct: nextDayChangePct,
            dayChangeVal: dayChangeVal,
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
            const hasEstimate = candidate.shouldEstimate && estimatedChangePct !== undefined;
            const effectivePctDate = hasEstimate ? todayStr : navDate;

            const nextDayChangePct =
              hasEstimate && estimatedChangePct !== undefined
                ? estimatedChangePct
                : navChangePercent;
            const nextLastUpdate = effectivePctDate || todayStr;

            const shouldSkipUpdate =
              isNearlyEqual(item.currentPrice, nav) &&
              isNearlyEqual(item.dayChangePct, nextDayChangePct) &&
              item.lastUpdate === nextLastUpdate;

            if (shouldSkipUpdate) return;

            await db.watchlists.update(item.id!, {
              currentPrice: nav,
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

interface ExportData {
  version: number;
  exportDate: string;
  funds: Fund[];
}

/**
 * Exports all tracked funds from IndexedDB to a JSON file.
 * Triggers a download of the backup file in the browser.
 * @returns A promise resolving when the export is complete.
 */
export const exportFunds = async (): Promise<void> => {
  const allFunds = await db.funds.toArray();
  const data: ExportData = {
    version: 1,
    exportDate: new Date().toISOString(),
    funds: allFunds.map((fund) => {
      const cleanFund = { ...fund } as Fund & { id?: number };
      delete cleanFund.id;
      return cleanFund as Fund;
    }), // 去掉自增 id
  };
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
  const data: ExportData = JSON.parse(text);

  if (!data.version || !Array.isArray(data.funds)) {
    throw new Error('无效的备份文件格式');
  }

  const existingFunds = await db.funds.toArray();
  const existingCodes = new Set(existingFunds.map((f) => `${f.code}_${f.platform}`));

  let added = 0;
  let skipped = 0;

  for (const fund of data.funds) {
    const key = `${fund.code}_${fund.platform}`;
    if (existingCodes.has(key)) {
      skipped++;
      continue;
    }
    // 去掉可能残留的 id 字段
    const cleanFund = { ...fund } as Fund & { id?: number };
    delete cleanFund.id;
    await db.funds.add(cleanFund as Fund);
    added++;
    existingCodes.add(key);
  }

  return { added, skipped };
};
