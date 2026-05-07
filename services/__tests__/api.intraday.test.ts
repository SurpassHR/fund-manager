import { describe, expect, it, vi } from 'vitest';

import { fetchTencentIntradayData } from '../api';
import type { IntradayPoint } from '../api';

const buildMinuteResponse = (code: string, points: Array<{ time: string; price: number }>) => ({
  code: 0,
  msg: '',
  data: {
    [code]: {
      data: {
        data: points.map((p) => `${p.time.replace(':', '')} ${p.price.toFixed(2)} 100 1000000.00`),
      },
    },
  },
});

describe('fetchTencentIntradayData', () => {
  it('returns empty object for empty codes array', async () => {
    const result = await fetchTencentIntradayData([], { force: true });
    expect(result).toEqual({});
  });

  it('parses valid minute response into IntradayPoint[]', async () => {
    const mockFetch = vi.fn(async (url: string) => {
      const code = url.match(/code=(\w+)/)?.[1] || '';
      return {
        ok: true,
        json: async () =>
          buildMinuteResponse(code, [
            { time: '09:30', price: 100.0 },
            { time: '09:31', price: 100.5 },
            { time: '09:32', price: 100.2 },
          ]),
      };
    });

    vi.stubGlobal('fetch', mockFetch as unknown as typeof fetch);

    const result = await fetchTencentIntradayData(['sh600519'], { force: true });

    // The code sh600519 normalizes to 600519
    const points: IntradayPoint[] = result['600519'];
    expect(points).toHaveLength(3);
    expect(points[0]).toEqual({ time: '09:30', price: 100.0 });
    expect(points[1]).toEqual({ time: '09:31', price: 100.5 });
    expect(points[2]).toEqual({ time: '09:32', price: 100.2 });

    vi.unstubAllGlobals();
  });

  it('normalizes ticker keys via normalizeTicker', async () => {
    const mockFetch = vi.fn(async (url: string) => {
      const code = url.match(/code=(\w+)/)?.[1] || '';
      return {
        ok: true,
        json: async () => buildMinuteResponse(code, [{ time: '09:30', price: 50.0 }]),
      };
    });

    vi.stubGlobal('fetch', mockFetch as unknown as typeof fetch);

    const result = await fetchTencentIntradayData(['sz000001'], { force: true });

    // sz000001 normalizes to 000001
    expect(result['000001']).toHaveLength(1);

    vi.unstubAllGlobals();
  });

  it('returns empty object on fetch error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('Network error');
      }) as unknown as typeof fetch,
    );

    const result = await fetchTencentIntradayData(['sh600519'], { force: true });
    expect(result).toEqual({});

    vi.unstubAllGlobals();
  });

  it('fetches multiple codes in parallel', async () => {
    const fetchCalls: string[] = [];

    const mockFetch = vi.fn(async (url: string) => {
      const code = url.match(/code=(\w+)/)?.[1] || '';
      fetchCalls.push(code);
      return {
        ok: true,
        json: async () => buildMinuteResponse(code, [{ time: '09:30', price: 100.0 }]),
      };
    });

    vi.stubGlobal('fetch', mockFetch as unknown as typeof fetch);

    const result = await fetchTencentIntradayData(['sh600519', 'sz000001', 'sh000300'], {
      force: true,
    });

    expect(fetchCalls).toHaveLength(3);
    expect(Object.keys(result)).toHaveLength(3);
    expect(result['600519']).toBeDefined();
    expect(result['000001']).toBeDefined();
    expect(result['000300']).toBeDefined();

    vi.unstubAllGlobals();
  });

  it('skips codes that return empty data arrays', async () => {
    const mockFetch = vi.fn(async (url: string) => {
      const code = url.match(/code=(\w+)/)?.[1] || '';
      return {
        ok: true,
        json: async () => ({
          code: 0,
          msg: '',
          data: {
            [code]: {
              data: {
                data: code === 'sz000001' ? [] : ['0930 100.00 100 1000000.00'],
              },
            },
          },
        }),
      };
    });

    vi.stubGlobal('fetch', mockFetch as unknown as typeof fetch);

    const result = await fetchTencentIntradayData(['sh600519', 'sz000001'], { force: true });

    // Only the code with data should appear
    expect(Object.keys(result)).toHaveLength(1);
    expect(result['600519']).toBeDefined();
    expect(result['000001']).toBeUndefined();

    vi.unstubAllGlobals();
  });

  it('handles malformed data entries gracefully', async () => {
    const mockFetch = vi.fn(async (url: string) => {
      const code = url.match(/code=(\w+)/)?.[1] || '';
      return {
        ok: true,
        json: async () => ({
          code: 0,
          msg: '',
          data: {
            [code]: {
              data: {
                data: [
                  '0930 100.00 100 1000000.00', // valid
                  'invalid_data', // malformed
                  '0932 101.00 200 2000000.00', // valid
                ],
              },
            },
          },
        }),
      };
    });

    vi.stubGlobal('fetch', mockFetch as unknown as typeof fetch);

    const result = await fetchTencentIntradayData(['sh600519'], { force: true });

    // Should only include valid entries
    expect(result['600519']).toHaveLength(2);
    expect(result['600519'][0]).toEqual({ time: '09:30', price: 100.0 });
    expect(result['600519'][1]).toEqual({ time: '09:32', price: 101.0 });

    vi.unstubAllGlobals();
  });

  it('caches results within TTL', async () => {
    const mockFetch = vi.fn(async (url: string) => {
      const code = url.match(/code=(\w+)/)?.[1] || '';
      return {
        ok: true,
        json: async () => buildMinuteResponse(code, [{ time: '09:30', price: 100.0 }]),
      };
    });

    vi.stubGlobal('fetch', mockFetch as unknown as typeof fetch);

    // First call (no force) — should fetch
    await fetchTencentIntradayData(['sh600519']);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Second call — should use cache, not fetch again
    await fetchTencentIntradayData(['sh600519']);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Force call — should bypass cache and fetch again
    await fetchTencentIntradayData(['sh600519'], { force: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);

    vi.unstubAllGlobals();
  });
});
