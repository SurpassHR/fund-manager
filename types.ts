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

export type TabType = 'holding' | 'watchlist' | 'market' | 'news' | 'member' | 'me';

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

// New Growth Data API Type (for Charts)
export interface FundGrowthDataResponse {
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