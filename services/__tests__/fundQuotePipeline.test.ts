import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildTencentQuoteCodes,
  fetchEastMoneyLatestNav,
  fetchFundCommonData,
  fetchFundHoldings,
  fetchTencentStockQuotes,
} from '../api';
import { runFundQuotePipeline } from '../fundQuotePipeline';

vi.mock('../api', () => ({
  fetchEastMoneyLatestNav: vi.fn(),
  fetchFundCommonData: vi.fn(),
  fetchFundHoldings: vi.fn(),
  fetchTencentStockQuotes: vi.fn(),
  buildTencentQuoteCodes: vi.fn(),
}));

describe('runFundQuotePipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(result.estimateMap.get('000001')).toBeCloseTo(1.6, 6);
    expect(fetchFundHoldings).toHaveBeenCalledWith('000001', { force: undefined });
    expect(fetchTencentStockQuotes).toHaveBeenCalledWith(['sh000001', 'sz000002'], {
      force: undefined,
    });
  });
});
