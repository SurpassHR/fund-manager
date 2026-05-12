import type { EquityHolding, FundCategory, FundIntradayPoint, UnderlyingMarket } from '../types';
import {
  buildTencentQuoteCodes,
  buildUSQuoteCodes,
  fetchEastMoneyLatestNav,
  fetchFundCommonData,
  fetchFundHoldings,
  fetchParentETFInfo,
  fetchParentETFPct,
  fetchTencentIntradayData,
  fetchTencentStockQuotes,
  fetchUSStockIntradayData,
  fetchUSStockQuotes,
} from './api';
import { isEtfLinkFundName } from './constants';
import { calcFundIntradayTrend } from './fundIntradayTrend';
import type { IntradayPoint } from './api';

type HoldingTicker = { ticker: string };
type HoldingWithWeight = HoldingTicker & { weight: number };

type FundQuotePipelineInput<T> = {
  item: T;
  code: string;
  fallbackNav: number;
  fallbackChangePct: number;
  dropOnMissingNav: boolean;
  underlyingMarket?: UnderlyingMarket;
  category?: FundCategory;
};

export type FundQuoteCandidate<T> = {
  item: T;
  code: string;
  nav: number;
  navDate: string;
  navChangePercent: number;
  previousNav?: number;
  shouldEstimate: boolean;
  underlyingMarket?: UnderlyingMarket;
  category?: FundCategory;
};

type FundQuotePipelineOptions = {
  force?: boolean;
  todayStr: string;
  shouldUseEstimatedValue: boolean;
};

type FundQuotePipelineResult<T> = {
  candidates: FundQuoteCandidate<T>[];
  estimateMap: Map<string, number>;
  failedBase: number;
  intradayTrends: Map<string, FundIntradayPoint[]>;
};

const normalizeTicker = (ticker?: string) => {
  if (!ticker) return '';
  const digits = ticker.replace(/\D/g, '');
  return digits || ticker;
};

const readNameFromItem = <T>(item: T): string | undefined => {
  if (!item || typeof item !== 'object') return undefined;
  const candidate = (item as Record<string, unknown>).name;
  return typeof candidate === 'string' ? candidate : undefined;
};

export const calcWeightedChangePct = (
  holdings: HoldingWithWeight[],
  quotePctMap: Record<string, number>,
) => {
  let weightedPctSum = 0;
  let totalWeight = 0;

  holdings.forEach((holding) => {
    const key = normalizeTicker(holding.ticker);
    if (!key) return;

    const pct = quotePctMap[key];
    if (pct !== undefined) {
      weightedPctSum += (holding.weight / 100) * pct;
      totalWeight += holding.weight;
    }
  });

  if (totalWeight > 0) {
    return weightedPctSum / (totalWeight / 100);
  }

  return null;
};

/**
 * 收集所有持仓 ticker 并按市场分组，分别调用 CN 和 US API 获取实时涨跌幅，
 * 合并为统一的 pctMap。
 */
const buildQuotePctMap = async (
  holdingsList: HoldingTicker[][],
  marketHints: Map<string, UnderlyingMarket>,
  force?: boolean,
) => {
  const cnCodeSet = new Set<string>();
  const usCodeSet = new Set<string>();

  holdingsList.forEach((holdings) => {
    const cnCodes = buildTencentQuoteCodes(holdings.map((h) => h.ticker));
    cnCodes.forEach((c) => cnCodeSet.add(c));

    // US tickers: 筛选出 market hint 为 US 的 ticker
    const usTickers = holdings.filter((h) => marketHints.get(h.ticker) === 'US');
    if (usTickers.length > 0) {
      const usCodes = buildUSQuoteCodes(usTickers.map((h) => h.ticker));
      usCodes.forEach((c) => usCodeSet.add(c));
    }
  });

  const pctMap: Record<string, number> = {};

  // CN 行情
  if (cnCodeSet.size > 0) {
    try {
      const cnQuoteMap = await fetchTencentStockQuotes(Array.from(cnCodeSet), { force });
      Object.entries(cnQuoteMap).forEach(([ticker, quote]) => {
        if (typeof quote.pct === 'number') {
          pctMap[ticker] = quote.pct;
        }
      });
    } catch (error) {
      console.error('批量获取A股实时行情失败', error);
    }
  }

  // US 行情
  if (usCodeSet.size > 0) {
    try {
      const usQuoteMap = await fetchUSStockQuotes(Array.from(usCodeSet), { force });
      Object.entries(usQuoteMap).forEach(([ticker, quote]) => {
        // US 返回 key 为 raw ticker（如 AAPL），需要 normalize 为 digits-only
        // 但 US ticker 是纯字母的，normalizeTicker 会清空
        // 使用原始 rawTicker 作为 key（与 calcWeightedChangePct 配合需一致）
        // calcWeightedChangePct 使用 normalizeTicker(holding.ticker) 查找
        // 对于 US 持仓，holding.ticker 是纯字母（如 "AAPL"），normalizeTicker("AAPL") = ""
        // 需要特殊处理：US ticker 直接使用原始值
        if (typeof quote.pct === 'number') {
          pctMap[ticker] = quote.pct;
        }
      });
    } catch (error) {
      console.error('批量获取美股实时行情失败', error);
    }
  }

  return pctMap;
};

/**
 * 镜像 buildQuotePctMap，但获取分钟 K 线数据。
 * 返回 { [tickerKey]: IntradayPoint[] }，CN ticker 用 digits-only key，US ticker 用原始字母 key。
 */
const buildIntradayDataMap = async (
  holdingsList: HoldingTicker[][],
  marketHints: Map<string, UnderlyingMarket>,
  force?: boolean,
): Promise<Record<string, IntradayPoint[]>> => {
  const cnCodeSet = new Set<string>();
  const usCodeSet = new Set<string>();

  holdingsList.forEach((holdings) => {
    const cnCodes = buildTencentQuoteCodes(holdings.map((h) => h.ticker));
    cnCodes.forEach((c) => cnCodeSet.add(c));

    const usTickers = holdings.filter((h) => marketHints.get(h.ticker) === 'US');
    if (usTickers.length > 0) {
      const usCodes = buildUSQuoteCodes(usTickers.map((h) => h.ticker));
      usCodes.forEach((c) => usCodeSet.add(c));
    }
  });

  const merged: Record<string, IntradayPoint[]> = {};

  if (cnCodeSet.size > 0) {
    try {
      const cnData = await fetchTencentIntradayData(Array.from(cnCodeSet), { force });
      Object.assign(merged, cnData);
    } catch (error) {
      console.error('批量获取A股分时数据失败', error);
    }
  }

  if (usCodeSet.size > 0) {
    try {
      const usData = await fetchUSStockIntradayData(Array.from(usCodeSet), { force });
      Object.assign(merged, usData);
    } catch (error) {
      console.error('批量获取美股分时数据失败', error);
    }
  }

  return merged;
};

export const runFundQuotePipeline = async <T>(
  inputs: FundQuotePipelineInput<T>[],
  options: FundQuotePipelineOptions,
): Promise<FundQuotePipelineResult<T>> => {
  const { force, todayStr, shouldUseEstimatedValue } = options;

  const baseResults = await Promise.allSettled(
    inputs.map(async (input) => {
      let nav = input.fallbackNav;
      let navDate = '';
      let navChangePercent = input.fallbackChangePct;
      let previousNav: number | undefined;

      const emData = await fetchEastMoneyLatestNav(input.code, { force });
      if (emData) {
        nav = emData.nav;
        navDate = emData.navDate;
        navChangePercent = emData.navChangePercent;
        previousNav = emData.previousNav;
      } else {
        const json = await fetchFundCommonData(input.code, { force });
        if (json?.data?.nav) {
          nav = json.data.nav;
          navDate = json.data.navDate;
          navChangePercent = json.data.navChangePercent;
        } else if (input.dropOnMissingNav) {
          return null;
        }
      }

      const isOfficialTodayNav = navDate === todayStr;

      return {
        item: input.item,
        code: input.code,
        nav,
        navDate,
        navChangePercent,
        previousNav,
        shouldEstimate: shouldUseEstimatedValue && !isOfficialTodayNav,
        underlyingMarket: input.underlyingMarket,
        category: input.category,
      } satisfies FundQuoteCandidate<T>;
    }),
  );

  const candidates: FundQuoteCandidate<T>[] = [];
  const estimateCandidates: FundQuoteCandidate<T>[] = [];
  let failedBase = 0;

  baseResults.forEach((result) => {
    if (result.status === 'fulfilled' && result.value) {
      candidates.push(result.value);
      if (result.value.shouldEstimate) {
        estimateCandidates.push(result.value);
      }
      return;
    }

    if (result.status === 'rejected') {
      failedBase += 1;
    }
  });

  const estimateMap = new Map<string, number>();
  const intradayTrends = new Map<string, FundIntradayPoint[]>();

  if (estimateCandidates.length === 0) {
    return { candidates, estimateMap, failedBase, intradayTrends };
  }

  // 0) 先处理 ETF 联接基金：直接使用母 ETF 的实时涨跌幅
  if (estimateCandidates.length > 0) {
    const etfLinkResults = await Promise.allSettled(
      estimateCandidates.map(async (candidate) => {
        const fundName = readNameFromItem(candidate.item);
        const parentInfo = await fetchParentETFInfo(candidate.code, fundName);
        const isEtfLink = isEtfLinkFundName(fundName) || Boolean(parentInfo?.parentCode);
        if (!isEtfLink || !parentInfo) return null;
        const parentPct = await fetchParentETFPct(parentInfo, { force });
        if (typeof parentPct !== 'number') return null;

        // 联接基金通常主要持有母 ETF，默认按 95% 估算
        return {
          code: candidate.code,
          pct: parentPct * 0.95,
        };
      }),
    );

    etfLinkResults.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        estimateMap.set(result.value.code, result.value.pct);
      }
    });
  }

  // ETF 联接已算出的不再走持仓估算
  const remainingEstimateCandidates = estimateCandidates.filter(
    (candidate) => !estimateMap.has(candidate.code),
  );

  if (remainingEstimateCandidates.length === 0) {
    return { candidates, estimateMap, failedBase, intradayTrends };
  }

  const holdingsResults = await Promise.allSettled(
    remainingEstimateCandidates.map(async (candidate) => {
      const holdingsJson = await fetchFundHoldings(candidate.code, { force });
      const equityHoldings = holdingsJson?.data?.equityHoldings as EquityHolding[] | undefined;
      if (!equityHoldings || equityHoldings.length === 0) return null;

      return {
        code: candidate.code,
        holdings: equityHoldings.slice(0, 10),
        underlyingMarket: candidate.underlyingMarket,
        nav: candidate.nav,
      };
    }),
  );

  const holdingsMap = new Map<string, EquityHolding[]>();
  const fundMarketMap = new Map<string, UnderlyingMarket>();
  const fundNavMap = new Map<string, number>();

  holdingsResults.forEach((result) => {
    if (result.status === 'fulfilled' && result.value) {
      holdingsMap.set(result.value.code, result.value.holdings);
      fundMarketMap.set(result.value.code, result.value.underlyingMarket ?? 'CN');
      fundNavMap.set(result.value.code, result.value.nav);
    }
  });

  // 为每个持仓 ticker 构建市场提示映射
  const tickerMarketHints = new Map<string, UnderlyingMarket>();
  holdingsMap.forEach((holdings, fundCode) => {
    const market = fundMarketMap.get(fundCode) ?? 'CN';
    holdings.forEach((h) => {
      if (market !== 'CN') {
        tickerMarketHints.set(h.ticker, market);
      }
    });
  });

  const quotePctMap = await buildQuotePctMap(
    Array.from(holdingsMap.values()),
    tickerMarketHints,
    force,
  );
  holdingsMap.forEach((holdings, code) => {
    const estimated = calcWeightedChangePct(holdings, quotePctMap);
    if (estimated !== null) {
      estimateMap.set(code, estimated);
    }
  });

  // 构建日内走势数据（仅对有持仓的基金）
  const intradayDataMap = await buildIntradayDataMap(
    Array.from(holdingsMap.values()),
    tickerMarketHints,
    force,
  );

  holdingsMap.forEach((holdings, code) => {
    const lastNav = fundNavMap.get(code);
    if (!lastNav || lastNav <= 0) return;
    const trend = calcFundIntradayTrend(intradayDataMap, holdings, lastNav);
    if (trend.length > 0) {
      intradayTrends.set(code, trend);
    }
  });

  return {
    candidates,
    estimateMap,
    failedBase,
    intradayTrends,
  };
};
