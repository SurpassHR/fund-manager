export interface Fund {
  id?: number;
  code: string;
  name: string;
  platform: string;
  holdingShares: number;
  costPrice: number;
  currentNav: number; // Net Asset Value
  lastUpdate: string;
  dayChangePct: number; // Percentage change (e.g., 1.5 for 1.5%)
  dayChangeVal: number; // Value change per share implied or pre-calculated
  officialDayChangePct?: number; // 上一个交易日收盘涨跌幅
  estimatedDayChangePct?: number; // 今日盘中估值涨跌幅（不可用时为 0）
  todayChangeIsEstimated?: boolean; // 今日涨幅是否为盘中估值
  todayChangeUnavailable?: boolean; // 盘中应估值但不可用（如持仓数据缺失）
  buyDate?: string; // YYYY-MM-DD
  buyTime?: 'before15' | 'after15';
  settlementDays?: number; // T+N 中的 N，默认 1
  pendingTransactions?: PendingTransaction[]; // 在途交易列表
}

export interface PendingTransaction {
  id: string; // uuid
  type: 'buy' | 'sell' | 'transferOut' | 'transferIn'; // 加仓/减仓/调仓转出/调仓转入
  date: string; // 操作日期 YYYY-MM-DD
  time: 'before15' | 'after15'; // 15:00 前后
  amount: number; // 加仓金额(元) / 减仓份额
  settlementDate: string; // 份额确认日 YYYY-MM-DD
  settled: boolean; // 是否已结算
  transferId?: string; // 调仓关联 ID（A/B 双边一致）
  counterpartyFundCode?: string; // 对手基金代码
  sellFeeRate?: number; // 卖出手续费率，0~1
  buyFeeRate?: number; // 买入手续费率，0~1
  outShares?: number; // 调仓转出份额
  inShares?: number; // 调仓转入份额（结算后写入）
  grossAmount?: number; // 卖出毛金额
  netOutAmount?: number; // 卖出净金额
  netInAmount?: number; // 买入前金额
  settledNavDateUsed?: string; // 结算实际使用净值日期
}

export interface WatchlistItem {
  id?: number;
  code: string;
  name: string;
  type: 'fund' | 'index'; // 基金或指数/板块
  platform?: string; // 仅针对基金可能需要渠道区分
  anchorPrice: number; // 锚点价格 / 点数
  anchorDate: string; // 锚定日期 YYYY-MM-DD
  currentPrice: number; // 当前最新价格 / 点数
  dayChangePct: number; // 最新日涨跌幅(%)
  lastUpdate: string; // 最后更新时间/日期
}

export interface Account {
  id?: number;
  name: string;
  isDefault?: boolean;
}

export interface AssetSummary {
  totalAssets: number;
  totalDayGain: number;
  totalDayGainPct: number;
  holdingGain: number;
  holdingGainPct: number;
}

export type TabType = 'holding' | 'watchlist' | 'market' | 'news' | 'settings';

export interface MarketIndex {
  name: string;
  value: number;
  change: number;
  changePct: number;
}

export interface MorningstarFund {
  fundClassId: string;
  fundName: string;
  symbol: string;
  fundType: string;
  fundNameArr: string;
}

export interface MorningstarResponse {
  _meta: {
    response_status: string;
    response_hint: string;
  };
  data: MorningstarFund[];
}

// Performance API Types
export interface ReturnDataPoint {
  k: string | number; // Date string or Year number
  v: number; // Value
}

export interface FundPerformanceResponse {
  data: {
    dayEnd: {
      endDate: string;
      nav: number;
      change: number;
      changeP: number;
      returns: {
        YTD: number;
        Y1: number;
        Y3: number;
        sinceInception: number;
        [key: string]: number;
      };
    };
    quarterly: {
      returns: ReturnDataPoint[];
    };
    annual: {
      returns: ReturnDataPoint[];
    };
  };
}

// New Common Data API Type
export interface FundCommonDataResponse {
  _meta: {
    response_status: string;
    response_hint: string;
  };
  data: {
    nav: number;
    navDate: string;
    navChangePercent: number;
    ihc: number; // Accumulated NAV
    fundType: string;
    riskLevel: string;
    morningstarCategory: string;
  };
}

// Growth Data API Type (Morningstar API for Charts)
export interface MorningstarGrowthDataResponse {
  _meta: {
    response_status: string;
    response_hint: string;
  };
  data: {
    startDate: string;
    endDate: string;
    tsData: {
      dates: string[];
      funds: number[][]; // e.g. [[0.0, 1.2, ...]]
      catAvg: number[]; // Category Average
      bmk1: number[]; // Benchmark
    };
    pr: {
      funds: { return: number; startValue: number; endValue: number }[];
    };
  };
}

// Growth Data API Type (Danjuan API for Charts)
export interface DanjuanGrowthDataResponse {
  data: {
    fund_nav_growth: Array<{
      date: string;
      nav: string;
      percentage: string;
      value: string;
      than_value: string;
      performance_value: string;
    }>;
  };
}

// Holdings API Types
export interface EquityHolding {
  ticker: string;
  name: string;
  weight: number;
  sector: string;
  styleBox: string;
}

export interface BondHolding {
  ticker: string;
  name: string;
  weight: number;
}

export interface FundHoldingsResponse {
  _meta: {
    response_status: string;
    response_hint: string;
  };
  data: {
    secId: string;
    portfolioDate: string;
    equityHoldings: EquityHolding[];
    bondHoldings: BondHolding[];
  };
}
