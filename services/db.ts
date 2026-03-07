import Dexie, { Table } from 'dexie';
import { Fund, Account, AssetSummary, PendingTransaction, WatchlistItem } from '../types';
import { fetchFundCommonData, fetchEastMoneyLatestNav, fetchFundHoldings, fetchRealTimeQuotes, checkIsMarketTrading, fetchGeneralTencentQuotes } from './api';

class XiaoHuYangJiDB extends Dexie {
  funds!: Table<Fund>;
  accounts!: Table<Account>;
  watchlists!: Table<WatchlistItem>;

  constructor() {
    super('XiaoHuYangJiDB');
    // Version 1
    (this as any).version(1).stores({
      funds: '++id, code, platform, name'
    });
    // Version 2: Add accounts table
    (this as any).version(2).stores({
      funds: '++id, code, platform, name',
      accounts: '++id, name'
    });
    // Version 3: pendingTransactions + settlementDays stored inline in funds
    (this as any).version(3).stores({
      funds: '++id, code, platform, name',
      accounts: '++id, name'
    });
    // Version 4: Add watchlists table
    (this as any).version(4).stores({
      funds: '++id, code, platform, name',
      accounts: '++id, name',
      watchlists: '++id, code, type, name'
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
        await db.accounts.bulkAdd([
          { name: 'Default', isDefault: true },
        ]);
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

/**
 * 根据买入日期和时间，估算基金的“成本生效日期”（即这天的净值作为买入成本）
 * 收益只有在这个日期【之后】的市场交易日才会产生
 */
const getCostDateStr = (buyDateStr: string, buyTime: 'before15' | 'after15'): string => {
  const d = new Date(buyDateStr);

  // 如果是周末买入，自动顺延到下周一，且相当于周一 15:00 前买入
  if (d.getDay() === 0) { // 周日
    d.setDate(d.getDate() + 1);
    buyTime = 'before15';
  } else if (d.getDay() === 6) { // 周六
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
  tPlusN: number
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

export const refreshFundData = () => {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const allFunds = await db.funds.toArray();
      if (allFunds.length === 0) return;

      // 检查当前大盘是否已更新(真正处于开盘且在 9:20 以后)
      const shouldUseEstimatedValue = await checkIsMarketTrading();

      const results = await Promise.allSettled(
        allFunds.map(async (fund) => {
          // 1. 优先从东方财富获取最新 NAV 数据（晚间更新更及时）
          let nav = 0, navDate = '', navChangePercent = 0;
          const emData = await fetchEastMoneyLatestNav(fund.code);

          if (emData) {
            nav = emData.nav;
            navDate = emData.navDate;
            navChangePercent = emData.navChangePercent;
          } else {
            // 降级使用晨星接口
            const json = await fetchFundCommonData(fund.code);
            if (!json?.data?.nav) return;
            ({ nav, navDate, navChangePercent } = json.data);
          }

          let estimatedChangePct = navChangePercent;
          let hasEstimate = false;

          const todayStr = getLocalDateString();
          const isOfficialTodayNavOut = (navDate === todayStr);

          // 如果处于交易日内（或已收盘但尚未跨天），且官方还未发布今天最新净值，则尝试通过持仓估算今日涨跌
          if (shouldUseEstimatedValue && !isOfficialTodayNavOut) {
            try {
              // 2. 获取基金持仓
              const holdingsJson = await fetchFundHoldings(fund.code);
              const equityHoldings = holdingsJson?.data?.equityHoldings;

              if (equityHoldings && equityHoldings.length > 0) {
                // 取前十大持仓
                const top10 = equityHoldings.slice(0, 10);

                // 构造成腾讯接口需要的代码格式 (如 sh600519)
                const codes = top10.map((h: any) => {
                  const c = h.ticker;
                  if (!c) return null;
                  if (c.length === 5) return `hk${c}`;
                  if (c.length === 6) {
                    if (c.startsWith('6')) return `sh${c}`;
                    if (c.startsWith('0') || c.startsWith('3')) return `sz${c}`;
                    if (c.startsWith('83') || c.startsWith('87') || c.startsWith('43')) return `bj${c}`;
                  }
                  return null;
                }).filter(Boolean);

                if (codes.length > 0) {
                  // 3. 批量获取最新股票报价
                  const quoteMap = await fetchRealTimeQuotes(codes, top10);

                  // 4. 计算前十大持仓的加权平均涨跌幅
                  let weightedPctSum = 0;
                  let totalWeight = 0;

                  top10.forEach((h: any) => {
                    const pct = quoteMap[h.ticker];
                    if (pct !== undefined) {
                      weightedPctSum += (h.weight / 100) * pct;
                      totalWeight += h.weight;
                    }
                  });

                  if (totalWeight > 0) {
                    estimatedChangePct = (weightedPctSum / (totalWeight / 100));
                    hasEstimate = true;
                  }
                }
              }
            } catch (estimateErr) {
              console.error(`估算基金 ${fund.code} 净值失败`, estimateErr);
              // 失败则使用接口返回的值，保持 silent fallback
            }
          }

          // 确定本次使用的收益率对应的真正日期
          const effectivePctDate = hasEstimate ? getLocalDateString() : navDate;

          // 判断今天是否应该计算“今日收益”
          // 如果有效日期 <= 基金的成本生效日期，说明该基金【还在处理中】，不应产生那天的波动收益
          let isGainActive = true;
          if (fund.buyDate) {
            const costDateStr = getCostDateStr(fund.buyDate, fund.buyTime || 'before15');
            if (effectivePctDate <= costDateStr) {
              isGainActive = false;
            }
          }

          let dayChangeVal = 0;
          if (isGainActive) {
            if (hasEstimate) {
              const mktVal = fund.holdingShares * nav;
              dayChangeVal = mktVal * (estimatedChangePct / 100);
            } else {
              const mktVal = fund.holdingShares * nav;
              dayChangeVal = mktVal * (navChangePercent / 100) / (1 + navChangePercent / 100);
            }
          }

          await db.funds.update(fund.id!, {
            currentNav: nav,
            lastUpdate: effectivePctDate,
            dayChangePct: isGainActive ? (hasEstimate ? estimatedChangePct : navChangePercent) : 0,
            dayChangeVal: dayChangeVal,
          });
        })
      );

      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) console.warn(`刷新基金数据：${failed}/${allFunds.length} 个失败`);

      // === 自动结算在途交易 ===
      const todayForSettlement = getLocalDateString();
      const fundsToSettle = await db.funds.toArray();

      for (const fund of fundsToSettle) {
        const pending = fund.pendingTransactions;
        if (!pending || pending.length === 0) continue;

        let changed = false;
        let newShares = fund.holdingShares;
        let newCostPrice = fund.costPrice;

        const updatedPending = pending.map(tx => {
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
export const refreshWatchlistData = () => {
  if (refreshWatchlistPromise) return refreshWatchlistPromise;

  refreshWatchlistPromise = (async () => {
    try {
      const allItems = await db.watchlists.toArray();
      if (allItems.length === 0) return;

      const fundItems = allItems.filter(i => i.type === 'fund');
      const indexItems = allItems.filter(i => i.type === 'index');
      const todayStr = getLocalDateString();

      // 1. Process Funds
      if (fundItems.length > 0) {
        const shouldUseEstimatedValue = await checkIsMarketTrading();
        await Promise.allSettled(
          fundItems.map(async (item) => {
            let nav = item.currentPrice;
            let navDate = '';
            let navChangePercent = item.dayChangePct;

            const emData = await fetchEastMoneyLatestNav(item.code);
            if (emData) {
              nav = emData.nav;
              navDate = emData.navDate;
              navChangePercent = emData.navChangePercent;
            } else {
              const json = await fetchFundCommonData(item.code);
              if (json?.data?.nav) {
                ({ nav, navDate, navChangePercent } = json.data);
              }
            }

            let effectivePctDate = navDate;
            let estimatedChangePct = navChangePercent;
            let hasEstimate = false;

            const isOfficialTodayNavOut = (navDate === todayStr);

            if (shouldUseEstimatedValue && !isOfficialTodayNavOut) {
              try {
                const holdingsJson = await fetchFundHoldings(item.code);
                const equityHoldings = holdingsJson?.data?.equityHoldings;
                if (equityHoldings && equityHoldings.length > 0) {
                  const top10 = equityHoldings.slice(0, 10);
                  const codes = top10.map((h: any) => {
                    const c = h.ticker;
                    if (!c) return null;
                    if (c.length === 5) return `hk${c}`;
                    if (c.length === 6) {
                      if (c.startsWith('6')) return `sh${c}`;
                      if (c.startsWith('0') || c.startsWith('3')) return `sz${c}`;
                      if (c.startsWith('83') || c.startsWith('87') || c.startsWith('43')) return `bj${c}`;
                    }
                    return null;
                  }).filter(Boolean);

                  if (codes.length > 0) {
                    const quoteMap = await fetchRealTimeQuotes(codes, top10);
                    let weightedPctSum = 0;
                    let totalWeight = 0;

                    top10.forEach((h: any) => {
                      const pct = quoteMap[h.ticker];
                      if (pct !== undefined) {
                        weightedPctSum += (h.weight / 100) * pct;
                        totalWeight += h.weight;
                      }
                    });

                    if (totalWeight > 0) {
                      estimatedChangePct = (weightedPctSum / (totalWeight / 100));
                      hasEstimate = true;
                      effectivePctDate = todayStr;
                    }
                  }
                }
              } catch (e) {
                console.warn(`Watchlist estimate failed for ${item.code}`);
              }
            }

            await db.watchlists.update(item.id!, {
              currentPrice: nav,
              dayChangePct: hasEstimate ? estimatedChangePct : navChangePercent,
              lastUpdate: effectivePctDate || todayStr,
            });
          })
        );
      }

      // 2. Process Indices / Stocks
      if (indexItems.length > 0) {
        const codes = indexItems.map(i => i.code);
        const quotes = await fetchGeneralTencentQuotes(codes);

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
          })
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

  funds.forEach(fund => {
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
  const totalDayGainPct = (totalAssets - totalDayGain) > 0
    ? (totalDayGain / (totalAssets - totalDayGain)) * 100
    : 0;

  return {
    totalAssets,
    totalDayGain,
    totalDayGainPct,
    holdingGain,
    holdingGainPct
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
    funds: allFunds.map(({ id, ...rest }) => rest as Fund), // 去掉自增 id
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
  const existingCodes = new Set(existingFunds.map(f => `${f.code}_${f.platform}`));

  let added = 0;
  let skipped = 0;

  for (const fund of data.funds) {
    const key = `${fund.code}_${fund.platform}`;
    if (existingCodes.has(key)) {
      skipped++;
      continue;
    }
    // 去掉可能残留的 id 字段
    const { id, ...cleanFund } = fund as Fund & { id?: number };
    await db.funds.add(cleanFund as Fund);
    added++;
    existingCodes.add(key);
  }

  return { added, skipped };
};