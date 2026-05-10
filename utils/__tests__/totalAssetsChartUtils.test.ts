/// <reference types="vitest/globals" />
import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockFetchEastMoneyPingzhongData, mockWithCache } = vi.hoisted(() => ({
  mockFetchEastMoneyPingzhongData: vi.fn(),
  mockWithCache: vi.fn(),
}));

vi.mock('../../services/api', () => ({
  fetchEastMoneyPingzhongData: mockFetchEastMoneyPingzhongData,
  withCache: mockWithCache,
}));

import {
  computeTimeRangeCutoff,
  filterDataByTimeRange,
  rebaseDataToFirstValue,
  aggregateTotalAssetsHistory,
  buildTotalAssetsChartOption,
  buildProfitChartOption,
  type TotalAssetsChartDataPoint,
} from '../totalAssetsChartUtils';

import type { Fund } from '../../types';

beforeEach(() => {
  vi.clearAllMocks();
  mockWithCache.mockImplementation(async <T>({ fetcher }: { fetcher: () => Promise<T> }) =>
    fetcher(),
  );
});

// ============================================================
// computeTimeRangeCutoff
// ============================================================
describe('computeTimeRangeCutoff', () => {
  it('1M 返回约 1 个月前的日期', () => {
    const now = new Date();
    const cutoff = computeTimeRangeCutoff('1M');
    const expected = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    expect(cutoff.getFullYear()).toBe(expected.getFullYear());
    expect(cutoff.getMonth()).toBe(expected.getMonth());
    expect(cutoff.getDate()).toBe(expected.getDate());
  });

  it('3M 返回约 3 个月前的日期', () => {
    const now = new Date();
    const cutoff = computeTimeRangeCutoff('3M');
    const expected = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    expect(cutoff.getFullYear()).toBe(expected.getFullYear());
    expect(cutoff.getMonth()).toBe(expected.getMonth());
  });

  it('6M 返回约 6 个月前的日期', () => {
    const now = new Date();
    const cutoff = computeTimeRangeCutoff('6M');
    const expected = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    expect(cutoff.getFullYear()).toBe(expected.getFullYear());
    expect(cutoff.getMonth()).toBe(expected.getMonth());
  });

  it('1Y 返回约 1 年前的日期', () => {
    const now = new Date();
    const cutoff = computeTimeRangeCutoff('1Y');
    const expected = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    expect(cutoff.getFullYear()).toBe(expected.getFullYear());
    expect(cutoff.getMonth()).toBe(expected.getMonth());
  });

  it('ALL 返回 epoch 日期', () => {
    const cutoff = computeTimeRangeCutoff('ALL');
    expect(cutoff.getTime()).toBe(0);
  });
});

// ============================================================
// filterDataByTimeRange
// ============================================================
describe('filterDataByTimeRange', () => {
  const data: TotalAssetsChartDataPoint[] = [
    { date: '2025-01-01', totalAssets: 10000, profit: 0 },
    { date: '2025-06-15', totalAssets: 12000, profit: 2000 },
    { date: '2025-12-01', totalAssets: 15000, profit: 5000 },
    { date: '2026-03-01', totalAssets: 18000, profit: 8000 },
  ];

  it('ALL 返回全部数据', () => {
    const filtered = filterDataByTimeRange(data, 'ALL');
    expect(filtered).toHaveLength(4);
  });

  it('1Y 过滤掉超过一年的数据', () => {
    const filtered = filterDataByTimeRange(data, '1Y');
    // 只有最近一年的数据（从今天算约往前一年）
    expect(filtered.length).toBeGreaterThanOrEqual(0);
    expect(filtered.length).toBeLessThanOrEqual(4);
    if (filtered.length > 0) {
      // 确保 filtered 中的所有日期都不早于一年前的今天
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      for (const d of filtered) {
        expect(new Date(d.date).getTime()).toBeGreaterThanOrEqual(
          new Date(oneYearAgo.getFullYear(), oneYearAgo.getMonth(), oneYearAgo.getDate()).getTime(),
        );
      }
    }
  });
});

// ============================================================
// rebaseDataToFirstValue
// ============================================================
describe('rebaseDataToFirstValue', () => {
  it('空数组返回空结果', () => {
    const result = rebaseDataToFirstValue([]);
    expect(result.dates).toEqual([]);
    expect(result.values).toEqual([]);
  });

  it('以首个值为基准计算百分比', () => {
    const data: TotalAssetsChartDataPoint[] = [
      { date: '2025-01-01', totalAssets: 10000, profit: 0 },
      { date: '2025-01-02', totalAssets: 10200, profit: 200 },
      { date: '2025-01-03', totalAssets: 9800, profit: -200 },
    ];
    const result = rebaseDataToFirstValue(data);
    expect(result.dates).toEqual(['2025-01-01', '2025-01-02', '2025-01-03']);
    expect(result.values[0]).toBe(0);
    expect(result.values[1]).toBe(2);
    expect(result.values[2]).toBe(-2);
  });

  it('首个值为 0 时返回全 0', () => {
    const data: TotalAssetsChartDataPoint[] = [
      { date: '2025-01-01', totalAssets: 0, profit: 0 },
      { date: '2025-01-02', totalAssets: 100, profit: 100 },
    ];
    const result = rebaseDataToFirstValue(data);
    expect(result.values[1]).toBe(0);
  });
});

// ============================================================
// aggregateTotalAssetsHistory
// ============================================================
describe('aggregateTotalAssetsHistory', () => {
  const baseFund: Fund = {
    code: '000001',
    name: '测试基金A',
    platform: '支付宝',
    holdingShares: 100,
    costPrice: 1.0,
    currentNav: 1.2,
    lastUpdate: '2026-05-09',
    dayChangePct: 0.5,
    dayChangeVal: 0.05,
  };

  it('空 funds 返回空数组', async () => {
    const result = await aggregateTotalAssetsHistory([]);
    expect(result).toEqual([]);
  });

  it('所有基金 holdingShares 为 0 时返回空数组', async () => {
    const result = await aggregateTotalAssetsHistory([{ ...baseFund, holdingShares: 0 }]);
    expect(result).toEqual([]);
  });

  it('双基金重叠日期聚合正确', async () => {
    mockFetchEastMoneyPingzhongData
      .mockResolvedValueOnce({
        netWorthTrend: [
          { x: new Date('2025-01-01').getTime(), y: 1.0, equityReturn: 0, unitMoney: '' },
          { x: new Date('2025-01-02').getTime(), y: 1.1, equityReturn: 0, unitMoney: '' },
        ],
      })
      .mockResolvedValueOnce({
        netWorthTrend: [
          { x: new Date('2025-01-01').getTime(), y: 2.0, equityReturn: 0, unitMoney: '' },
          { x: new Date('2025-01-02').getTime(), y: 2.2, equityReturn: 0, unitMoney: '' },
        ],
      });

    const funds: Fund[] = [
      { ...baseFund, code: '000001', holdingShares: 100, costPrice: 1.0 },
      { ...baseFund, code: '000002', holdingShares: 50, costPrice: 2.0 },
    ];

    const result = await aggregateTotalAssetsHistory(funds);

    expect(result).toHaveLength(2);
    // 2025-01-01: 100*1.0 + 50*2.0 = 200
    expect(result[0].date).toBe('2025-01-01');
    expect(result[0].totalAssets).toBe(200);
    expect(result[0].profit).toBe(0); // 200 - (100*1 + 50*2) = 0
    // 2025-01-02: 100*1.1 + 50*2.2 = 220
    expect(result[1].date).toBe('2025-01-02');
    expect(result[1].totalAssets).toBe(220);
    expect(result[1].profit).toBe(20); // 220 - 200 = 20
  });

  it('基金返回 null 时跳过该基金，使用其他基金数据', async () => {
    mockFetchEastMoneyPingzhongData.mockResolvedValueOnce(null).mockResolvedValueOnce({
      netWorthTrend: [
        { x: new Date('2025-01-01').getTime(), y: 2.0, equityReturn: 0, unitMoney: '' },
      ],
    });

    const funds: Fund[] = [
      { ...baseFund, code: '000001', holdingShares: 100, costPrice: 1.0 },
      { ...baseFund, code: '000002', holdingShares: 50, costPrice: 2.0 },
    ];

    const result = await aggregateTotalAssetsHistory(funds);

    expect(result).toHaveLength(1);
    // 只有基金B的数据：50 * 2.0 = 100
    expect(result[0].totalAssets).toBe(100);
    // profit = 100 - (100*1 + 50*2) = 100 - 200 = -100
    expect(result[0].profit).toBe(-100);
  });

  it('不同日期范围前向填充', async () => {
    // 基金A 只有 1月1日 和 1月3日 的数据，基金B 有 1月1日 到 1月3日
    mockFetchEastMoneyPingzhongData
      .mockResolvedValueOnce({
        netWorthTrend: [
          { x: new Date('2025-01-01').getTime(), y: 1.0, equityReturn: 0, unitMoney: '' },
          { x: new Date('2025-01-03').getTime(), y: 1.5, equityReturn: 0, unitMoney: '' },
        ],
      })
      .mockResolvedValueOnce({
        netWorthTrend: [
          { x: new Date('2025-01-01').getTime(), y: 2.0, equityReturn: 0, unitMoney: '' },
          { x: new Date('2025-01-02').getTime(), y: 2.1, equityReturn: 0, unitMoney: '' },
          { x: new Date('2025-01-03').getTime(), y: 2.3, equityReturn: 0, unitMoney: '' },
        ],
      });

    const funds: Fund[] = [
      { ...baseFund, code: '000001', holdingShares: 100, costPrice: 1.0 },
      { ...baseFund, code: '000002', holdingShares: 50, costPrice: 2.0 },
    ];

    const result = await aggregateTotalAssetsHistory(funds);

    expect(result).toHaveLength(3);
    // 2025-01-01: 100*1.0 + 50*2.0 = 200
    expect(result[0].totalAssets).toBe(200);
    // 2025-01-02: 100*1.0(forward-fill) + 50*2.1 = 205
    expect(result[1].totalAssets).toBe(205);
    // 2025-01-03: 100*1.5 + 50*2.3 = 265
    expect(result[2].totalAssets).toBe(265);
  });

  it('使用 withCache 缓存结果', async () => {
    mockFetchEastMoneyPingzhongData.mockResolvedValue({
      netWorthTrend: [
        { x: new Date('2025-01-01').getTime(), y: 1.0, equityReturn: 0, unitMoney: '' },
      ],
    });

    const funds: Fund[] = [{ ...baseFund, code: '000001', holdingShares: 100, costPrice: 1.0 }];

    await aggregateTotalAssetsHistory(funds);

    expect(mockWithCache).toHaveBeenCalledWith(
      expect.objectContaining({
        key: expect.stringContaining('total-assets:'),
        ttlMs: 30 * 60 * 1000,
      }),
    );
  });
});

// ============================================================
// buildTotalAssetsChartOption
// ============================================================
describe('buildTotalAssetsChartOption', () => {
  it('返回正确的 chart option 结构', () => {
    const option = buildTotalAssetsChartOption({
      data: [
        { value: 0, totalAssets: 10000, profit: 0 },
        { value: 5, totalAssets: 10500, profit: 500 },
      ],
      dates: ['2025-01-01', '2025-01-02'],
      isDark: false,
      isLargeSeries: false,
    });

    expect(option.backgroundColor).toBe('transparent');
    expect(option.grid).toBeDefined();
    expect(option.xAxis).toBeDefined();
    expect(option.yAxis).toBeDefined();
    expect(option.series).toBeDefined();
    expect(Array.isArray(option.series)).toBe(true);
    expect(option.series).toHaveLength(1);
  });

  it('大数据集启用采样', () => {
    const option = buildTotalAssetsChartOption({
      data: [{ value: 0, totalAssets: 10000, profit: 0 }],
      dates: ['2025-01-01'],
      isDark: false,
      isLargeSeries: true,
    });

    const series = option.series as Array<Record<string, unknown>>;
    expect(series[0].sampling).toBe('lttb');
  });
});

// ============================================================
// buildProfitChartOption
// ============================================================
describe('buildProfitChartOption', () => {
  it('返回正确的 chart option 结构（含三条 series）', () => {
    const option = buildProfitChartOption({
      dates: ['2025-01-01', '2025-01-02'],
      profitValues: [0, 500],
      positiveAreaData: [0, 500],
      negativeAreaData: [null, null],
      isDark: false,
      isLargeSeries: false,
    });

    expect(option.backgroundColor).toBe('transparent');
    expect(Array.isArray(option.series)).toBe(true);
    // 三条 series：主线 + 正面积 + 负面积
    expect(option.series).toHaveLength(3);
  });

  it('收益主线包含零轴 markLine', () => {
    const option = buildProfitChartOption({
      dates: ['2025-01-01'],
      profitValues: [0],
      positiveAreaData: [0],
      negativeAreaData: [null],
      isDark: false,
      isLargeSeries: false,
    });

    const series = option.series as Array<Record<string, unknown>>;
    expect(series[0].markLine).toBeDefined();
    const markLine = series[0].markLine as Record<string, unknown>;
    const data = markLine.data as Array<Record<string, unknown>>;
    expect(data[0].yAxis).toBe(0);
  });
});
