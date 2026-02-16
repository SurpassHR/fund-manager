import Dexie, { Table } from 'dexie';
import { Fund, Account, AssetSummary } from '../types';

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

// Initialize DB with mock data if empty
export const initDB = async () => {
  // Funds are no longer pre-populated. Users must add them manually.

  const accountsCount = await db.accounts.count();
  if (accountsCount === 0) {
    await db.accounts.bulkAdd([
      { name: 'Default', isDefault: true },
      { name: 'Alipay', isDefault: true },
      { name: 'Tencent', isDefault: true },
      { name: 'Bank', isDefault: true },
      { name: 'Others', isDefault: true }
    ]);
  }
};

export const calculateSummary = (funds: Fund[]): AssetSummary => {
  let totalAssets = 0;
  let totalDayGain = 0;
  let totalCost = 0;

  funds.forEach(fund => {
    const assetValue = fund.holdingShares * fund.currentNav;
    const costValue = fund.holdingShares * fund.costPrice;
    
    // In a real app, dayChangeVal would be calculated from yesterday's NAV
    // Here we take the mock value or approximate it: 
    // dayGain = assetValue * (dayChangePct / 100) / (1 + dayChangePct/100) -- approximating for display
    // But we have explicit dayChangeVal in types for simplicity in this demo
    const dayGain = fund.dayChangeVal; // Using the provided/mocked absolute value

    totalAssets += assetValue;
    totalDayGain += dayGain;
    totalCost += costValue;
  });

  const holdingGain = totalAssets - totalCost;
  const holdingGainPct = totalCost > 0 ? (holdingGain / totalCost) * 100 : 0;
  const totalDayGainPct = (totalAssets - totalDayGain) > 0 ? (totalDayGain / (totalAssets - totalDayGain)) * 100 : 0;

  return {
    totalAssets,
    totalDayGain,
    totalDayGainPct,
    holdingGain,
    holdingGainPct
  };
};