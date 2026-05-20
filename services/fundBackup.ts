import type { Account, Fund, WatchlistItem, InvestmentPlan } from '../types';
import type { InvestmentProfileSnapshot } from './aiAnalysis';

export interface FundBackupPayload {
  version: number;
  exportDate: string;
  funds: Fund[];
  accounts?: Account[];
  watchlists?: WatchlistItem[];
  investmentPlans?: InvestmentPlan[];
  investmentProfile?: InvestmentProfileSnapshot;
  /** 可用资产（余额宝类随时可取用资产），undefined 表示未配置 */
  availableAssets?: number;
}

const BACKUP_VERSION = 1;

const FUND_BACKUP_FIELDS: (keyof Fund)[] = [
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
  'pendingTransactions',
  'realizedGain',
  'realizedGainCost',
  'positionOpenAmount',
  'positionOpenDate',
  'category',
  'trackingInfo',
  'parentEtfInfo',
  'underlyingMarket',
];

const stripFundId = (fund: Fund): Fund => {
  const cleanFund: Record<string, unknown> = {};
  for (const key of FUND_BACKUP_FIELDS) {
    if (key in fund) {
      cleanFund[key] = fund[key];
    }
  }
  return cleanFund as unknown as Fund;
};

const WATCHLIST_BACKUP_FIELDS: (keyof WatchlistItem)[] = [
  'code',
  'name',
  'type',
  'platform',
  'anchorPrice',
  'anchorDate',
  'currentPrice',
  'dayChangePct',
  'lastUpdate',
  'todayChangeIsEstimated',
  'todayChangeUnavailable',
  'todayChangePreOpen',
  'category',
  'trackingInfo',
  'parentEtfInfo',
  'underlyingMarket',
];

const stripWatchlistId = (item: WatchlistItem): WatchlistItem => {
  const cleanItem: Record<string, unknown> = {};
  for (const key of WATCHLIST_BACKUP_FIELDS) {
    if (key in item) {
      cleanItem[key] = item[key];
    }
  }
  return cleanItem as unknown as WatchlistItem;
};

const stripAccountId = (account: Account): Account => {
  const cleanAccount = { ...account } as Account & { id?: number };
  delete cleanAccount.id;
  return cleanAccount as Account;
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
    (item.platform === undefined || typeof item.platform === 'string') &&
    (item.todayChangeIsEstimated === undefined ||
      typeof item.todayChangeIsEstimated === 'boolean') &&
    (item.todayChangeUnavailable === undefined || typeof item.todayChangeUnavailable === 'boolean')
  );
};

const isValidAccount = (account: Partial<Account>): account is Account => {
  return (
    typeof account.name === 'string' &&
    account.name.trim().length > 0 &&
    (account.isDefault === undefined || typeof account.isDefault === 'boolean')
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

const stripInvestmentPlanId = (plan: InvestmentPlan): InvestmentPlan => {
  const cleanPlan = { ...plan } as InvestmentPlan & { id?: number };
  delete cleanPlan.id;
  return cleanPlan as InvestmentPlan;
};

export const buildFundBackupPayload = (
  funds: Fund[],
  exportDate = new Date().toISOString(),
  accounts: Account[] = [],
  watchlists: WatchlistItem[] = [],
  investmentPlans: InvestmentPlan[] = [],
  investmentProfile?: InvestmentProfileSnapshot,
  availableAssets?: number,
): FundBackupPayload => {
  return {
    version: BACKUP_VERSION,
    exportDate,
    funds: funds.map(stripFundId),
    accounts: accounts.map(stripAccountId),
    watchlists: watchlists.map(stripWatchlistId),
    investmentPlans: investmentPlans.map(stripInvestmentPlanId),
    investmentProfile,
    ...(availableAssets !== undefined ? { availableAssets } : {}),
  };
};

export const parseAndNormalizeFundBackupPayload = (
  content: unknown,
): {
  funds: Fund[];
  accounts: Account[];
  watchlists: WatchlistItem[];
  investmentPlans: InvestmentPlan[];
  investmentProfile?: InvestmentProfileSnapshot;
  availableAssets?: number;
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

  const rawAccounts = payload.accounts ?? [];
  if (!Array.isArray(rawAccounts)) {
    throw new Error('无效的备份文件格式');
  }

  const normalizedAccounts = rawAccounts.map((account) => {
    if (!account || typeof account !== 'object' || !isValidAccount(account as Partial<Account>)) {
      throw new Error('无效的备份文件格式');
    }
    return stripAccountId(account as Account);
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

  const rawInvestmentPlans = payload.investmentPlans ?? [];
  if (!Array.isArray(rawInvestmentPlans)) {
    throw new Error('无效的备份文件格式');
  }

  const isValidInvestmentPlan = (plan: Partial<InvestmentPlan>): plan is InvestmentPlan => {
    return (
      typeof plan.fundCode === 'string' &&
      typeof plan.amount === 'number' &&
      typeof plan.active === 'boolean' &&
      typeof plan.createdAt === 'string'
    );
  };

  const normalizedInvestmentPlans = rawInvestmentPlans.map((plan) => {
    if (
      !plan ||
      typeof plan !== 'object' ||
      !isValidInvestmentPlan(plan as Partial<InvestmentPlan>)
    ) {
      throw new Error('无效的备份文件格式');
    }
    return stripInvestmentPlanId(plan as InvestmentPlan);
  });

  const parsedAvailableAssets =
    typeof payload.availableAssets === 'number' && isFinite(payload.availableAssets)
      ? payload.availableAssets
      : undefined;

  return {
    funds: normalizedFunds,
    accounts: normalizedAccounts,
    watchlists: normalizedWatchlists,
    investmentPlans: normalizedInvestmentPlans,
    investmentProfile:
      payload.investmentProfile && typeof payload.investmentProfile === 'object'
        ? {
            riskTolerance:
              typeof payload.investmentProfile.riskTolerance === 'string'
                ? payload.investmentProfile.riskTolerance
                : '',
            investmentHorizon:
              typeof payload.investmentProfile.investmentHorizon === 'string'
                ? payload.investmentProfile.investmentHorizon
                : '',
            externalAssets:
              typeof payload.investmentProfile.externalAssets === 'string'
                ? payload.investmentProfile.externalAssets
                : '',
            notes:
              typeof payload.investmentProfile.notes === 'string'
                ? payload.investmentProfile.notes
                : '',
          }
        : undefined,
    availableAssets: parsedAvailableAssets,
  };
};

export const parseAndNormalizeFundBackup = (content: unknown): Fund[] => {
  return parseAndNormalizeFundBackupPayload(content).funds;
};
