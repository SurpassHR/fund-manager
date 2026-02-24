import Dexie, { Table } from 'dexie';
import { Fund, Account, AssetSummary, FundCommonDataResponse } from '../types';

class XiaoHuYangJiDB extends Dexie {
  funds!: Table<Fund>;
  accounts!: Table<Account>;

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
  }
}

export const db = new XiaoHuYangJiDB();

// 防止 StrictMode 下重复初始化的竞态
let initPromise: Promise<void> | null = null;

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
 * 刷新所有持仓基金的最新净值数据
 * 从晨星 API 拉取最新 NAV、涨跌幅，更新 IndexedDB
 */
let refreshPromise: Promise<void> | null = null;

export const refreshFundData = () => {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const allFunds = await db.funds.toArray();
      if (allFunds.length === 0) return;

      // 检查当前时间是否为交易日且在 9:20 之后
      const now = new Date();
      const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;
      const isAfter920 = now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() >= 20);
      const shouldUseEstimatedValue = isWeekday && isAfter920;

      const results = await Promise.allSettled(
        allFunds.map(async (fund) => {
          // 1. 获取基础 NAV 数据
          const res = await fetch(
            `https://www.morningstar.cn/cn-api/v2/funds/${fund.code}/common-data`
          );
          if (!res.ok) return;
          const json: FundCommonDataResponse = await res.json();
          if (!json?.data?.nav) return;

          let { nav, navDate, navChangePercent } = json.data;

          let estimatedChangePct = navChangePercent;

          // 如果条件满足，尝试通过持仓估算今日涨跌
          if (shouldUseEstimatedValue) {
            try {
              // 2. 获取基金持仓
              const holdingsRes = await fetch(`https://www.morningstar.cn/cn-api/v2/funds/${fund.code}/holdings`);
              if (holdingsRes.ok) {
                const holdingsJson = await holdingsRes.json();
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
                    const qtUrl = `https://qt.gtimg.cn/q=${codes.map((c: string) => `s_${c}`).join(',')}`;
                    const qRes = await fetch(qtUrl);
                    const qText = await qRes.text();

                    const quoteMap: Record<string, number> = {};
                    qText.split(';').forEach(line => {
                      if (line.includes('=')) {
                        const rightSide = line.split('=')[1].replace(/"/g, '');
                        const parts = rightSide.split('~');
                        if (parts.length > 5) {
                          const ticker = parts[2];
                          const pct = parseFloat(parts[5]);
                          // 在返回结果中找到以该 ticker 结尾的我们组装的代码，进行映射
                          const originalCodeObj = codes.find((c: string) => c.endsWith(ticker));
                          if (originalCodeObj) {
                            // 为了稳妥，我们可以直接用 ticker 作为 key (如果是 6 位或 5 位)
                            const matchedHolding = top10.find((h: any) => h.ticker.endsWith(ticker));
                            if (matchedHolding) {
                              quoteMap[matchedHolding.ticker] = pct;
                            }
                          }
                        }
                      }
                    });

                    // 4. 计算前十大持仓的加权平均涨跌幅
                    // (每个持仓的占比% / 100) * 该股票的涨跌幅% -> 然后加总
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
                      // 这里假设前十大持仓的波动可以代表整个基金的波动，按比例放缩
                      // 如果需要绝对加权，可以将 weightedPctSum 作为基数再适当加成
                      // 这里采用：十大持仓加权收益 / 十大持仓总占比
                      estimatedChangePct = (weightedPctSum / (totalWeight / 100));
                    }
                  }
                }
              }
            } catch (estimateErr) {
              console.error(`估算基金 ${fund.code} 净值失败`, estimateErr);
              // 失败则使用接口返回的值，保持 silent fallback
            }
          }

          // 日收益 = 市值 × 涨跌幅% / (1 + 涨跌幅%)
          // 如果是估算，这里的 nav 还是昨天的 nav，市值也是基于昨天 NAV 计算的市值
          // 由于 estimatedChangePct 是今日相比昨天的预期变化，用昨天的 nav 计算刚好可以直接使用: 
          // 预期收益 = 持仓份额 * 昨天NAV * (estimatedChangePct/100)

          let dayChangeVal = 0;
          if (shouldUseEstimatedValue && estimatedChangePct !== navChangePercent) {
            const mktVal = fund.holdingShares * nav;
            dayChangeVal = mktVal * (estimatedChangePct / 100);
          } else {
            const mktVal = fund.holdingShares * nav;
            dayChangeVal = mktVal * (navChangePercent / 100) / (1 + navChangePercent / 100);
          }

          await db.funds.update(fund.id!, {
            currentNav: nav,
            lastUpdate: navDate,
            dayChangePct: shouldUseEstimatedValue ? estimatedChangePct : navChangePercent,
            dayChangeVal: dayChangeVal,
          });
        })
      );

      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) console.warn(`刷新基金数据：${failed}/${allFunds.length} 个失败`);
    } catch (err) {
      console.error('刷新基金数据失败', err);
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

export const calculateSummary = (funds: Fund[]): AssetSummary => {
  let totalAssets = 0;
  let totalDayGain = 0;
  let totalCost = 0;

  funds.forEach(fund => {
    const assetValue = fund.holdingShares * fund.currentNav;
    const costValue = fund.holdingShares * fund.costPrice;
    const dayGain = fund.dayChangeVal;

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