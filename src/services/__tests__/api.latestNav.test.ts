import { describe, expect, it, vi } from 'vitest';

import { fetchEastMoneyLatestNav } from '../api';

describe('fetchEastMoneyLatestNav', () => {
  it('parses previous nav from the second row when latest nav is available', async () => {
    // fetchEastMoneyLatestNav 内部调用 fetchEastMoneyPingzhongData，
    // 后者通过 fetch 获取 pingzhongdata JS 并解析 netWorthTrend
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () =>
        'var fS_name = "测试基金";' +
        'var Data_netWorthTrend = [' +
        '{"x":1742342400000,"y":3.036,"equityReturn":-0.12,"unitMoney":""},' + // 2025-03-19
        '{"x":1742428800000,"y":3.071,"equityReturn":1.15,"unitMoney":""}' +
        '];',
    }));

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const result = await fetchEastMoneyLatestNav('000001', { force: true });

    expect(result).toEqual({
      navDate: '2025-03-20',
      nav: 3.071,
      navChangePercent: 1.15,
      previousNav: 3.036,
    });

    vi.unstubAllGlobals();
  });
});