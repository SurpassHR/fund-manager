import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildUSQuoteCodes,
  checkIsUSMarketTrading,
  fetchUSStockIntradayData,
  fetchUSStockQuotes,
} from '../api';

// --- buildUSQuoteCodes ---

describe('buildUSQuoteCodes', () => {
  it('converts plain ticker to NASDAQ code by default', () => {
    const result = buildUSQuoteCodes(['AAPL']);
    expect(result).toEqual(['usAAPL.OQ']);
  });

  it('converts multiple plain tickers all to NASDAQ by default', () => {
    const result = buildUSQuoteCodes(['AAPL', 'MSFT', 'GOOGL']);
    expect(result).toEqual(['usAAPL.OQ', 'usMSFT.OQ', 'usGOOGL.OQ']);
  });

  it('accepts exchange hint via object form — NASDAQ', () => {
    const result = buildUSQuoteCodes([{ ticker: 'AAPL', exchange: 'NASDAQ' }]);
    expect(result).toEqual(['usAAPL.OQ']);
  });

  it('accepts exchange hint via object form — NYSE', () => {
    const result = buildUSQuoteCodes([{ ticker: 'BAC', exchange: 'NYSE' }]);
    expect(result).toEqual(['usBAC.N']);
  });

  it('accepts exchange hint via object form — AMEX', () => {
    const result = buildUSQuoteCodes([{ ticker: 'MINT', exchange: 'AMEX' }]);
    expect(result).toEqual(['usMINT.A']);
  });

  it('accepts mixed string and object input', () => {
    const result = buildUSQuoteCodes(['AAPL', { ticker: 'BAC', exchange: 'NYSE' }, 'MSFT']);
    expect(result).toEqual(['usAAPL.OQ', 'usBAC.N', 'usMSFT.OQ']);
  });

  it('handles empty input', () => {
    const result = buildUSQuoteCodes([]);
    expect(result).toEqual([]);
  });

  it('filters out null/undefined entries', () => {
    const result = buildUSQuoteCodes(['AAPL', null as unknown as string, 'MSFT']);
    expect(result).toEqual(['usAAPL.OQ', 'usMSFT.OQ']);
  });

  it('preserves order of input', () => {
    const result = buildUSQuoteCodes(['MSFT', 'AAPL', 'GOOGL']);
    expect(result).toEqual(['usMSFT.OQ', 'usAAPL.OQ', 'usGOOGL.OQ']);
  });

  it('handles tickers with lowercase letters', () => {
    const result = buildUSQuoteCodes(['aapl']);
    expect(result).toEqual(['usaapl.OQ']);
  });

  it('unknown exchange defaults to NASDAQ', () => {
    const result = buildUSQuoteCodes([{ ticker: 'XYZ', exchange: 'LSE' }]);
    expect(result).toEqual(['usXYZ.OQ']);
  });
});

// --- checkIsUSMarketTrading ---

const buildUSMinuteResp = (points: string) =>
  `min_data_usAAPLOQ={"code":0,"msg":"","data":{"usAAPL.OQ":{"data":{"data":[${points}]}}}}`;

const usMinutePoint = (time: string, price = 290) => `"${time} ${price} 1000000"`;

// 2025-05-12 是周一，14:00 UTC = 10:00 EDT，在美股交易时段内
const US_TRADING_UTC = new Date('2025-05-12T14:00:00Z');

describe('checkIsUSMarketTrading', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    vi.setSystemTime(US_TRADING_UTC);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('returns true when API returns data with recent time within range', async () => {
    // 14:00 UTC = 10:00 ET，最新数据点 10:00 在容忍范围内
    const timeStr = '1000';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        buildUSMinuteResp(usMinutePoint('0930', 290) + ',' + usMinutePoint(timeStr, 292)),
    });

    const result = await checkIsUSMarketTrading({ force: true });
    expect(result).toBe(true);
  });

  it('returns false when API returns data with no recent points', async () => {
    // 最新数据点 16:00，距 10:00 远超 15 分钟容忍
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        buildUSMinuteResp(usMinutePoint('0930', 290) + ',' + usMinutePoint('1600', 292)),
    });

    const result = await checkIsUSMarketTrading({ force: true });
    expect(result).toBe(false);
  });

  it('falls back to time-based check when API fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await checkIsUSMarketTrading({ force: true });
    // 回退：当前设定 14:00 UTC = 10:00 EDT，在交易时段
    expect(result).toBe(true);
  });

  it('falls back to time-based check when API returns empty data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => 'min_data_usAAPLOQ={"code":0,"msg":"","data":{}}',
    });

    const result = await checkIsUSMarketTrading({ force: true });
    expect(result).toBe(true);
  });

  it('caches result within TTL', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () =>
        buildUSMinuteResp(usMinutePoint('0930', 290) + ',' + usMinutePoint('1000', 292)),
    });

    // 不用 force，第一次调用会缓存
    await checkIsUSMarketTrading();
    await checkIsUSMarketTrading();
    await checkIsUSMarketTrading();

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('bypasses cache when force=true', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () =>
        buildUSMinuteResp(usMinutePoint('0930', 290) + ',' + usMinutePoint('1000', 292)),
    });

    await checkIsUSMarketTrading({ force: true });
    await checkIsUSMarketTrading({ force: true });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

// --- fetchUSStockIntradayData ---

const buildUSIntradayJson = (code: string, points: string[]) => ({
  code: 0,
  msg: '',
  data: {
    [code]: {
      data: {
        data: points,
      },
    },
  },
});

const buildUSIntradayResp = (code: string, points: string[]) =>
  `min_data_${code.replace(/\./g, '')}=${JSON.stringify(buildUSIntradayJson(code, points))}`;

describe('fetchUSStockIntradayData', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns empty object for empty codes', async () => {
    const result = await fetchUSStockIntradayData([]);
    expect(result).toEqual({});
  });

  it('parses valid US minute response and returns IntradayPoint map', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        buildUSIntradayResp('usAAPL.OQ', [
          '0930 290.50 500000',
          '0931 290.75 600000',
          '0932 291.00 450000',
        ]),
    });

    const result = await fetchUSStockIntradayData(['usAAPL.OQ'], { force: true });
    expect(result).toHaveProperty('AAPL');
    expect(result['AAPL']).toHaveLength(3);
    expect(result['AAPL'][0]).toEqual({ time: '09:30', price: 290.5 });
    expect(result['AAPL'][2]).toEqual({ time: '09:32', price: 291 });
  });

  it('handles multiple codes in parallel', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        buildUSIntradayResp('usAAPL.OQ', ['0930 290.50 500000', '0931 290.75 600000']),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        buildUSIntradayResp('usMSFT.OQ', ['0930 450.00 300000', '0931 451.20 400000']),
    });

    const result = await fetchUSStockIntradayData(['usAAPL.OQ', 'usMSFT.OQ'], { force: true });
    expect(result).toHaveProperty('AAPL');
    expect(result).toHaveProperty('MSFT');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('skips codes that return empty data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => buildUSIntradayResp('usAAPL.OQ', ['0930 290.50 500000']),
    });
    // Second code returns no data
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => 'min_data_usBADONE={"code":0,"msg":"","data":{}}',
    });

    const result = await fetchUSStockIntradayData(['usAAPL.OQ', 'usBAD.OQ'], { force: true });
    expect(Object.keys(result)).toEqual(['AAPL']);
  });

  it('handles network errors gracefully per-code', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => buildUSIntradayResp('usAAPL.OQ', ['0930 290.50 500000']),
    });
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await fetchUSStockIntradayData(['usAAPL.OQ', 'usFAIL.OQ'], { force: true });
    expect(Object.keys(result)).toEqual(['AAPL']);
  });

  it('caches result within TTL', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () =>
        buildUSIntradayResp('usAAPL.OQ', ['0930 290.50 500000', '0931 290.75 600000']),
    });

    await fetchUSStockIntradayData(['usAAPL.OQ']);
    await fetchUSStockIntradayData(['usAAPL.OQ']);
    await fetchUSStockIntradayData(['usAAPL.OQ']);

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

// --- fetchUSStockQuotes ---

describe('fetchUSStockQuotes', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns empty object for empty codes', async () => {
    const result = await fetchUSStockQuotes([]);
    expect(result).toEqual({});
  });

  it('derives quotes from minute data: latest price and pct from open', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        buildUSIntradayResp('usAAPL.OQ', [
          '0930 290.00 500000',
          '0931 290.50 600000',
          '0932 291.20 450000',
        ]),
    });

    const result = await fetchUSStockQuotes(['usAAPL.OQ'], { force: true });
    expect(result).toHaveProperty('AAPL');
    // price = last point price = 291.20
    expect(result['AAPL'].price).toBe('291.20');
    // pct = (291.20 / 290.00 - 1) * 100 ≈ 0.4138...
    expect(result['AAPL'].pct).toBeCloseTo(0.4138, 2);
  });

  it('handles single data point gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => buildUSIntradayResp('usAAPL.OQ', ['0930 290.00 500000']),
    });

    const result = await fetchUSStockQuotes(['usAAPL.OQ'], { force: true });
    expect(result['AAPL'].price).toBe('290.00');
    expect(result['AAPL'].pct).toBe(0);
  });

  it('skips codes with no minute data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => 'min_data_usNOEXIST={"code":0,"msg":"","data":{}}',
    });

    const result = await fetchUSStockQuotes(['usNOEXIST.OQ'], { force: true });
    expect(result).toEqual({});
  });

  it('handles multiple codes', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        buildUSIntradayResp('usAAPL.OQ', ['0930 290.00 500000', '0931 291.45 600000']),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        buildUSIntradayResp('usMSFT.OQ', ['0930 450.00 300000', '0931 448.20 400000']),
    });

    const result = await fetchUSStockQuotes(['usAAPL.OQ', 'usMSFT.OQ'], { force: true });
    expect(Object.keys(result)).toHaveLength(2);
    expect(result['AAPL'].pct).toBeCloseTo(0.5, 1); // (291.45/290 - 1)*100 = 0.5
    expect(result['MSFT'].pct).toBeCloseTo(-0.4, 1); // (448.2/450 - 1)*100 = -0.4
  });
});
