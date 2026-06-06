import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildTencentQuoteCodes,
  fetchEastMoneyLatestNav,
  fetchFundCommonData,
  fetchFundHoldings,
  fetchSinaFundAssetAllocation,
  fetchParentETFInfo,
  fetchParentETFPct,
  fetchTencentIntradayData,
  fetchTencentStockQuotes,
  fetchUSStockIntradayData,
  fetchUSStockQuotes,
} from '../api';
import { runFundQuotePipeline } from '../fundQuotePipeline';

vi.mock('../api', () => ({
  fetchEastMoneyLatestNav: vi.fn(),
  fetchFundCommonData: vi.fn(),
  fetchFundHoldings: vi.fn(),
  fetchSinaFundAssetAllocation: vi.fn(),
  fetchParentETFInfo: vi.fn(),
  fetchParentETFPct: vi.fn(),
  fetchTencentIntradayData: vi.fn(),
  fetchTencentStockQuotes: vi.fn(),
  fetchUSStockIntradayData: vi.fn(),
  fetchUSStockQuotes: vi.fn(),
  buildTencentQuoteCodes: vi.fn(),
  buildUSQuoteCodes: vi.fn(),
}));

describe('runFundQuotePipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchSinaFundAssetAllocation).mockResolvedValue(null);
    vi.mocked(fetchTencentIntradayData).mockResolvedValue({});
    vi.mocked(fetchUSStockIntradayData).mockResolvedValue({});
    vi.mocked(fetchUSStockQuotes).mockResolvedValue({});
  });

  it('keeps fallback quote when source is missing but dropOnMissingNav is false', async () => {
    vi.mocked(fetchEastMoneyLatestNav).mockResolvedValue(null);
    vi.mocked(fetchFundCommonData).mockResolvedValue(null);

    const result = await runFundQuotePipeline(
      [
        {
          item: { id: 1, code: 'A' },
          code: 'A',
          fallbackNav: 1.23,
          fallbackChangePct: 0.8,
          dropOnMissingNav: false,
        },
        {
          item: { id: 2, code: 'B' },
          code: 'B',
          fallbackNav: 0,
          fallbackChangePct: 0,
          dropOnMissingNav: true,
        },
      ],
      {
        force: true,
        todayStr: '2026-03-27',
        shouldUseEstimatedValue: true,
      },
    );

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      code: 'A',
      nav: 1.23,
      navDate: '',
      navChangePercent: 0.8,
      shouldEstimate: true,
    });
    expect(result.failedBase).toBe(0);
  });

  it('builds estimated pct map from top holdings and realtime quotes', async () => {
    vi.mocked(fetchEastMoneyLatestNav).mockResolvedValue({
      nav: 1.5,
      navDate: '2026-03-26',
      navChangePercent: 0.5,
      previousNav: 1.4925,
    });
    vi.mocked(fetchFundCommonData).mockResolvedValue(null);
    vi.mocked(fetchFundHoldings).mockResolvedValue({
      data: {
        equityHoldings: [
          { ticker: 'sh000001', weight: 60 },
          { ticker: 'sz000002', weight: 40 },
        ],
      },
    } as never);
    vi.mocked(buildTencentQuoteCodes).mockReturnValue(['sh000001', 'sz000002']);
    vi.mocked(fetchTencentStockQuotes).mockResolvedValue({
      '000001': { pct: 2, price: '1.000' },
      '000002': { pct: 1, price: '1.000' },
    });

    const result = await runFundQuotePipeline(
      [
        {
          item: { id: 1, code: '000001' },
          code: '000001',
          fallbackNav: 0,
          fallbackChangePct: 0,
          dropOnMissingNav: true,
        },
      ],
      {
        todayStr: '2026-03-27',
        shouldUseEstimatedValue: true,
      },
    );

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      previousNav: 1.4925,
    });
    expect(result.estimateMap.get('000001')).toBeCloseTo(1.6, 6);
    expect(fetchFundHoldings).toHaveBeenCalledWith('000001', { force: undefined });
    expect(fetchTencentStockQuotes).toHaveBeenCalledWith(['sh000001', 'sz000002'], {
      force: undefined,
    });
  });

  it('scales estimated pct map by Sina equity allocation when available', async () => {
    vi.mocked(fetchEastMoneyLatestNav).mockResolvedValue({
      nav: 1.5,
      navDate: '2026-03-26',
      navChangePercent: 0.5,
    });
    vi.mocked(fetchFundCommonData).mockResolvedValue(null);
    vi.mocked(fetchFundHoldings).mockResolvedValue({
      data: {
        equityHoldings: [
          { ticker: 'sh000001', weight: 60 },
          { ticker: 'sz000002', weight: 40 },
        ],
      },
    } as never);
    vi.mocked(fetchSinaFundAssetAllocation).mockResolvedValue({
      equityPct: 67.44,
      cashPct: 36.52,
      otherPct: 1.68,
      asOfDate: '2026-03-31',
    });
    vi.mocked(buildTencentQuoteCodes).mockReturnValue(['sh000001', 'sz000002']);
    vi.mocked(fetchTencentStockQuotes).mockResolvedValue({
      '000001': { pct: 2, price: '1.000' },
      '000002': { pct: 1, price: '1.000' },
    });

    const result = await runFundQuotePipeline(
      [
        {
          item: { id: 1, code: '025208' },
          code: '025208',
          fallbackNav: 0,
          fallbackChangePct: 0,
          dropOnMissingNav: true,
        },
      ],
      {
        todayStr: '2026-04-01',
        shouldUseEstimatedValue: true,
      },
    );

    expect(result.estimateMap.get('025208')).toBeCloseTo(1.6 * 0.6744, 6);
    expect(fetchSinaFundAssetAllocation).toHaveBeenCalledWith('025208', { force: undefined });
  });

  it('does not mark stale nav as estimate candidate when market is not trading', async () => {
    vi.mocked(fetchEastMoneyLatestNav).mockResolvedValue({
      nav: 1.5,
      navDate: '2026-03-26',
      navChangePercent: 0.5,
    });
    vi.mocked(fetchFundCommonData).mockResolvedValue(null);
    vi.mocked(fetchFundHoldings).mockResolvedValue({
      data: {
        equityHoldings: [{ ticker: 'sh000001', weight: 100 }],
      },
    } as never);
    vi.mocked(buildTencentQuoteCodes).mockReturnValue(['sh000001']);
    vi.mocked(fetchTencentStockQuotes).mockResolvedValue({
      '000001': { pct: 2, price: '1.000' },
    });

    const result = await runFundQuotePipeline(
      [
        {
          item: { id: 1, code: '000001' },
          code: '000001',
          fallbackNav: 0,
          fallbackChangePct: 0,
          dropOnMissingNav: true,
        },
      ],
      {
        todayStr: '2026-03-27',
        shouldUseEstimatedValue: false,
      },
    );

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.shouldEstimate).toBe(false);
    expect(result.estimateMap.size).toBe(0);
  });

  it('estimates ETF联接基金 from parent ETF pct', async () => {
    vi.mocked(fetchEastMoneyLatestNav).mockResolvedValue({
      nav: 1.1,
      navDate: '2026-03-26',
      navChangePercent: 0.2,
    });
    vi.mocked(fetchFundCommonData).mockResolvedValue(null);
    vi.mocked(fetchParentETFInfo).mockResolvedValue({
      parentCode: '516150.SH',
      parentName: '嘉实中证稀土产业ETF',
    });
    vi.mocked(fetchParentETFPct).mockResolvedValue(1.0);
    vi.mocked(fetchFundHoldings).mockResolvedValue(null);

    const result = await runFundQuotePipeline(
      [
        {
          item: { id: 1, code: '011036', name: '嘉实中证稀土产业ETF联接C' },
          code: '011036',
          fallbackNav: 0,
          fallbackChangePct: 0,
          dropOnMissingNav: true,
        },
      ],
      {
        todayStr: '2026-03-27',
        shouldUseEstimatedValue: true,
      },
    );

    expect(result.candidates).toHaveLength(1);
    expect(result.estimateMap.get('011036')).toBeCloseTo(0.95, 6);
    expect(fetchParentETFInfo).toHaveBeenCalledWith('011036', '嘉实中证稀土产业ETF联接C');
    expect(fetchParentETFPct).toHaveBeenCalled();
    expect(fetchFundHoldings).not.toHaveBeenCalled();
  });
});
