import type { Fund, WatchlistItem } from '../types';

export interface FundBackupPayload {
  version: number;
  exportDate: string;
  funds: Fund[];
  watchlists?: WatchlistItem[];
}

const BACKUP_VERSION = 1;

const stripFundId = (fund: Fund): Fund => {
  const cleanFund = { ...fund } as Fund & { id?: number };
  delete cleanFund.id;
  return cleanFund as Fund;
};

const stripWatchlistId = (item: WatchlistItem): WatchlistItem => {
  const cleanItem = { ...item } as WatchlistItem & { id?: number };
  delete cleanItem.id;
  return cleanItem as WatchlistItem;
};

const isValidFund = (fund: Partial<Fund>): fund is Fund => {
  return (
    typeof fund.code === 'string' &&
    typeof fund.name === 'string' &&
    typeof fund.platform === 'string' &&
    typeof fund.holdingShares === 'number' &&
    typeof fund.costPrice === 'number' &&
    typeof fund.currentNav === 'number' &&
    typeof fund.lastUpdate === 'string' &&
    typeof fund.dayChangePct === 'number' &&
    typeof fund.dayChangeVal === 'number'
  );
};

const isValidWatchlistItem = (item: Partial<WatchlistItem>): item is WatchlistItem => {
  return (
    typeof item.code === 'string' &&
    typeof item.name === 'string' &&
    (item.type === 'fund' || item.type === 'index') &&
    typeof item.anchorPrice === 'number' &&
    typeof item.anchorDate === 'string' &&
    typeof item.currentPrice === 'number' &&
    typeof item.dayChangePct === 'number' &&
    typeof item.lastUpdate === 'string' &&
    (item.platform === undefined || typeof item.platform === 'string')
  );
};

export const buildFundBackupKey = (fund: Pick<Fund, 'code' | 'platform'>): string => {
  return `${fund.code}_${fund.platform}`;
};

export const findDuplicateFundBackupKeys = (funds: Array<Pick<Fund, 'code' | 'platform'>>) => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  funds.forEach((fund) => {
    const key = buildFundBackupKey(fund);
    if (seen.has(key)) {
      duplicates.add(key);
      return;
    }
    seen.add(key);
  });

  return Array.from(duplicates);
};

export const buildFundBackupPayload = (
  funds: Fund[],
  exportDate = new Date().toISOString(),
  watchlists: WatchlistItem[] = [],
): FundBackupPayload => {
  return {
    version: BACKUP_VERSION,
    exportDate,
    funds: funds.map(stripFundId),
    watchlists: watchlists.map(stripWatchlistId),
  };
};

export const parseAndNormalizeFundBackupPayload = (
  content: unknown,
): {
  funds: Fund[];
  watchlists: WatchlistItem[];
} => {
  const parsed =
    typeof content === 'string' ? (JSON.parse(content) as Partial<FundBackupPayload>) : content;

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('无效的备份文件格式');
  }

  const payload = parsed as Partial<FundBackupPayload>;
  if (payload.version !== BACKUP_VERSION || !Array.isArray(payload.funds)) {
    throw new Error('无效的备份文件格式');
  }

  const normalizedFunds = payload.funds.map((fund) => {
    if (!fund || typeof fund !== 'object' || !isValidFund(fund as Partial<Fund>)) {
      throw new Error('无效的备份文件格式');
    }
    return stripFundId(fund as Fund);
  });

  const rawWatchlists = payload.watchlists ?? [];
  if (!Array.isArray(rawWatchlists)) {
    throw new Error('无效的备份文件格式');
  }

  const normalizedWatchlists = rawWatchlists.map((item) => {
    if (
      !item ||
      typeof item !== 'object' ||
      !isValidWatchlistItem(item as Partial<WatchlistItem>)
    ) {
      throw new Error('无效的备份文件格式');
    }
    return stripWatchlistId(item as WatchlistItem);
  });

  return {
    funds: normalizedFunds,
    watchlists: normalizedWatchlists,
  };
};

export const parseAndNormalizeFundBackup = (content: unknown): Fund[] => {
  return parseAndNormalizeFundBackupPayload(content).funds;
};
