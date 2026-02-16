import Dexie, { Table } from 'dexie';
import { Fund, Account, AssetSummary, FundCommonDataResponse } from '../types';

class YangJiBaoDB extends Dexie {
  funds!: Table<Fund>;
  accounts!: Table<Account>;

  constructor() {
    super('YangJiBaoDB');
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

export const db = new YangJiBaoDB();

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

      const results = await Promise.allSettled(
        allFunds.map(async (fund) => {
          const res = await fetch(
            `https://www.morningstar.cn/cn-api/v2/funds/${fund.code}/common-data`
          );
          if (!res.ok) return;
          const json: FundCommonDataResponse = await res.json();
          if (!json?.data?.nav) return;

          const { nav, navDate, navChangePercent } = json.data;
          // 日收益 = 市值 × 涨跌幅% / (1 + 涨跌幅%)
          const mktVal = fund.holdingShares * nav;
          const dayChangeVal = mktVal * (navChangePercent / 100) / (1 + navChangePercent / 100);

          await db.funds.update(fund.id!, {
            currentNav: nav,
            lastUpdate: navDate,
            dayChangePct: navChangePercent,
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