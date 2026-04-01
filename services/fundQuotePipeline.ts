import type { EquityHolding } from '../types';
import {
  buildTencentQuoteCodes,
  fetchEastMoneyLatestNav,
  fetchFundCommonData,
  fetchFundHoldings,
  fetchTencentStockQuotes,
} from './api';

type HoldingTicker = { ticker: string };
type HoldingWithWeight = HoldingTicker & { weight: number };

type FundQuotePipelineInput<T> = {
  item: T;
  code: string;
  fallbackNav: number;
  fallbackChangePct: number;
  dropOnMissingNav: boolean;
};

export type FundQuoteCandidate<T> = {
  item: T;
  code: string;
  nav: number;
  navDate: string;
  navChangePercent: number;
  shouldEstimate: boolean;
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
};

const normalizeTicker = (ticker?: string) => (ticker ? ticker.replace(/\D/g, '') : '');

const calcWeightedChangePct = (
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

const buildQuotePctMap = async (holdingsList: HoldingTicker[][], force?: boolean) => {
  const codeSet = new Set<string>();

  holdingsList.forEach((holdings) => {
    const codes = buildTencentQuoteCodes(holdings.map((holding) => holding.ticker));
    codes.forEach((code) => codeSet.add(code));
  });

  if (codeSet.size === 0) return {};

  try {
    const quoteMap = await fetchTencentStockQuotes(Array.from(codeSet), { force });
    const pctMap: Record<string, number> = {};

    Object.entries(quoteMap).forEach(([ticker, quote]) => {
      if (typeof quote.pct === 'number') {
        pctMap[ticker] = quote.pct;
      }
    });

    return pctMap;
  } catch (error) {
    console.error('批量获取实时行情失败', error);
    return {};
  }
};

export const runFundQuotePipeline = async <T>(
  inputs: FundQuotePipelineInput<T>[],
  options: FundQuotePipelineOptions,
): Promise<FundQuotePipelineResult<T>> => {
  const { force, todayStr } = options;

  const baseResults = await Promise.allSettled(
    inputs.map(async (input) => {
      let nav = input.fallbackNav;
      let navDate = '';
      let navChangePercent = input.fallbackChangePct;

      const emData = await fetchEastMoneyLatestNav(input.code, { force });
      if (emData) {
        nav = emData.nav;
        navDate = emData.navDate;
        navChangePercent = emData.navChangePercent;
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
        shouldEstimate: !isOfficialTodayNav,
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
  if (estimateCandidates.length === 0) {
    return { candidates, estimateMap, failedBase };
  }

  const holdingsResults = await Promise.allSettled(
    estimateCandidates.map(async (candidate) => {
      const holdingsJson = await fetchFundHoldings(candidate.code, { force });
      const equityHoldings = holdingsJson?.data?.equityHoldings as EquityHolding[] | undefined;
      if (!equityHoldings || equityHoldings.length === 0) return null;

      return {
        code: candidate.code,
        holdings: equityHoldings.slice(0, 10),
      };
    }),
  );

  const holdingsMap = new Map<string, EquityHolding[]>();
  holdingsResults.forEach((result) => {
    if (result.status === 'fulfilled' && result.value) {
      holdingsMap.set(result.value.code, result.value.holdings);
    }
  });

  const quotePctMap = await buildQuotePctMap(Array.from(holdingsMap.values()), force);
  holdingsMap.forEach((holdings, code) => {
    const estimated = calcWeightedChangePct(holdings, quotePctMap);
    if (estimated !== null) {
      estimateMap.set(code, estimated);
    }
  });

  return {
    candidates,
    estimateMap,
    failedBase,
  };
};
