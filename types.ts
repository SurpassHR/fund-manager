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
  estimatedDayChangePct?: number; // 今日盘中估值涨跌幅(不可用时为 0)
  todayChangeIsEstimated?: boolean; // 今日涨幅是否为盘中估值
  todayChangeUnavailable?: boolean; // 盘中应估值但不可用(如持仓数据缺失)
  todayChangePreOpen?: boolean; // 今日未开盘(含非交易时段)
  buyDate?: string; // YYYY-MM-DD
  buyTime?: 'before15' | 'after15';
  settlementDays?: number; // T+N 中的 N,默认 1
  pendingTransactions?: PendingTransaction[]; // 在途交易列表
  // 基金分类与跟踪标的信息(用于 QDII/港股/ETF 估值)
  category?: FundCategory; // 基金类别:境内/QDII/港股/ETF
  trackingInfo?: TrackingInfo; // 跟踪指数/标的信息
  parentEtfInfo?: ParentEtfInfo; // ETF 联接基金对应的母 ETF 信息
  underlyingMarket?: UnderlyingMarket; // 标的市场:中国/美国/香港/全球
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
  todayChangeIsEstimated?: boolean; // 今日涨幅是否为盘中估值(仅基金)
  todayChangeUnavailable?: boolean; // 盘中应估值但不可用(仅基金)
  todayChangePreOpen?: boolean; // 今日未开盘(仅基金)
  // 基金分类与跟踪标的信息(用于 QDII/港股/ETF 估值)
  category?: FundCategory; // 基金类别:境内/QDII/港股/ETF
  trackingInfo?: TrackingInfo; // 跟踪指数/标的信息
  parentEtfInfo?: ParentEtfInfo; // ETF 联接基金对应的母 ETF 信息
  underlyingMarket?: UnderlyingMarket; // 标的市场:中国/美国/香港/全球
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

export type TabType = 'holding' | 'watchlist' | 'services' | 'news' | 'settings';

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

// ========== 基金分类与跟踪标的类型定义 ==========

/**
 * 基金类别枚举
 * - DOMESTIC: 境内基金(A股市场)
 * - QDII: QDII基金(投资境外市场)
 * - HK: 港股基金(投资香港市场)
 * - ETF: ETF基金(场内交易型开放式指数基金)
 * - ETF_LINK: ETF联接基金(场外,主要持有母ETF份额)
 * - UNKNOWN: 未识别类别
 */
export type FundCategory = 'DOMESTIC' | 'QDII' | 'HK' | 'ETF' | 'ETF_LINK' | 'UNKNOWN';

/**
 * ETF 联接基金的母 ETF 信息
 */
export interface ParentEtfInfo {
  /** 母 ETF 代码（例如: 516150.SH） */
  parentCode: string;
  /** 母 ETF 名称 */
  parentName: string;
}

/**
 * 标的市场枚举
 * - CN: 中国市场(A股/境内)
 * - US: 美国市场(纳斯达克/纽交所)
 * - HK: 香港市场(港交所)
 * - GLOBAL: 全球市场(多市场混合)
 */
export type UnderlyingMarket = 'CN' | 'US' | 'HK' | 'GLOBAL';

/**
 * 跟踪信息来源
 * - MORNINGSTAR: 晨星API(morningstarCategory字段)
 * - EASTMONEY: 东方财富F10(基金档案页)
 * - MANUAL: 手动配置(用户或系统维护)
 * - INFERRED: 推断(基于名称关键词)
 */
export type TrackingSource = 'MORNINGSTAR' | 'EASTMONEY' | 'MANUAL' | 'INFERRED';

/**
 * 跟踪信息置信度
 * - HIGH: 高置信度(来自官方API或明确标注)
 * - MEDIUM: 中等置信度(基于分类推断)
 * - LOW: 低置信度(基于名称关键词)
 */
export type TrackingConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * 跟踪指数/标的信息
 * 用于存储基金跟踪的指数或主要标的,支持 QDII/港股/ETF 估值
 */
export interface TrackingInfo {
  /**
   * 跟踪指数/标的名称
   * 示例: "标普500指数", "纳斯达克100", "恒生指数"
   */
  indexName: string;

  /**
   * 跟踪指数/标的代码
   * 示例: "SPX", "NDX", "HSI", "000300.SH"
   * 用于查询实时行情
   */
  indexCode: string;

  /**
   * 信息来源
   * 标识跟踪信息的获取渠道
   */
  source: TrackingSource;

  /**
   * 置信度
   * 标识跟踪信息的可靠程度
   */
  confidence: TrackingConfidence;

  /**
   * 最后更新时间
   * ISO 8601 格式: "2026-04-18T10:00:00Z"
   */
  lastUpdate?: string;

  /**
   * ETF 联接基金的母 ETF 信息（可选）
   */
  parentEtfInfo?: ParentEtfInfo;
}

/**
 * 扩展的基金元数据
 * 包含晨星API返回的完整分类信息,用于基金识别和分类
 */
export interface FundMetadata {
  /**
   * 基金代码
   */
  code: string;

  /**
   * 基金名称
   */
  name: string;

  /**
   * 基金类型(晨星API返回)
   * 示例: "股票型", "指数型", "QDII", "债券型"
   */
  fundType?: string;

  /**
   * 晨星分类(晨星API返回)
   * 示例: "QDII股票", "沪港深股票", "香港大盘A"
   */
  morningstarCategory?: string;

  /**
   * 识别后的基金类别
   */
  category: FundCategory;

  /**
   * 跟踪指数/标的信息
   */
  trackingInfo?: TrackingInfo;

  /**
   * 标的市场
   */
  underlyingMarket?: UnderlyingMarket;
}
