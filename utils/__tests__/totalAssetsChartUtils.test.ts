/// <reference types="vitest/globals" />
import { describe, expect, it } from 'vitest';

import {
  computeTimeRangeCutoff,
  filterDataByTimeRange,
  rebaseDataToFirstValue,
  snapshotsToChartData,
  buildTotalAssetsChartOption,
  buildProfitChartOption,
  type TotalAssetsChartDataPoint,
} from '../totalAssetsChartUtils';

import type { TotalAssetsSnapshot } from '../../types';

// ============================================================
// computeTimeRangeCutoff（返回日期字符串）
// ============================================================
describe('computeTimeRangeCutoff', () => {
  it('1M 返回到 1 个月前的日期字符串', () => {
    const cutoff = computeTimeRangeCutoff('1M');
    expect(cutoff).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const now = new Date();
    const expected = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    const expectedStr = `${expected.getFullYear()}-${String(expected.getMonth() + 1).padStart(2, '0')}-${String(expected.getDate()).padStart(2, '0')}`;
    expect(cutoff).toBe(expectedStr);
  });

  it('ALL 返回极早日期', () => {
    const cutoff = computeTimeRangeCutoff('ALL');
    expect(cutoff).toBe('0000-01-01');
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
    // 只有最近一年的数据（从今天算）
    expect(filtered.length).toBeGreaterThanOrEqual(1);
    // 确保 filtered 中的所有日期都不早于约一年前
    if (filtered.length > 0) {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const cutoff = `${oneYearAgo.getFullYear()}-${String(oneYearAgo.getMonth() + 1).padStart(2, '0')}-${String(oneYearAgo.getDate()).padStart(2, '0')}`;
      for (const d of filtered) {
        expect(d.date >= cutoff).toBe(true);
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
// snapshotsToChartData
// ============================================================
describe('snapshotsToChartData', () => {
  it('将 DB 快照转换为图表数据点', () => {
    const snapshots: TotalAssetsSnapshot[] = [
      {
        date: '2026-05-10',
        totalAssets: 100000,
        holdingGain: 5000,
        holdingGainPct: 5.26,
        dayGain: 1200,
      },
      {
        date: '2026-05-11',
        totalAssets: 102000,
        holdingGain: 7000,
        holdingGainPct: 7.37,
        dayGain: 2000,
      },
    ];
    const result = snapshotsToChartData(snapshots);
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2026-05-10');
    expect(result[0].totalAssets).toBe(100000);
    expect(result[0].profit).toBe(5000);
    expect(result[1].profit).toBe(7000);
  });

  it('空快照返回空数组', () => {
    const result = snapshotsToChartData([]);
    expect(result).toEqual([]);
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
