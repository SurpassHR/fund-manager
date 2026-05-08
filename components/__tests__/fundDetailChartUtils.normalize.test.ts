import { describe, expect, it } from 'vitest';
import { normalizeGrowthSeriesToFirst } from '../fundDetailChartUtils';

describe('normalizeGrowthSeriesToFirst', () => {
  it('normalizes fund/avg/bmk series so all three start at 0', () => {
    const input = {
      dates: ['2026-03-01', '2026-03-02', '2026-03-03'],
      fund: [10, 15, 20],
      avg: [5, 7, 9],
      bmk: [2, 4, 6],
    };
    const result = normalizeGrowthSeriesToFirst(input);
    expect(result).not.toBeNull();
    expect(result!.fund[0]).toBe(0);
    expect(result!.avg[0]).toBe(0);
    expect(result!.bmk[0]).toBe(0);
  });

  it('preserves relative performance ordering between fund and bmk after normalization', () => {
    const input = {
      dates: ['2026-03-01', '2026-03-02', '2026-03-03'],
      fund: [10, 15, 20],
      avg: [5, 7, 9],
      bmk: [2, 4, 6],
    };
    const result = normalizeGrowthSeriesToFirst(input);
    expect(result).not.toBeNull();

    // 第 0 点均归一化为 0（差值为 0），故从第 1 点开始验证
    for (let i = 1; i < input.dates.length; i++) {
      const fundOverBmk = result!.fund[i] - result!.bmk[i];
      const originalOver = input.fund[i] - input.bmk[i];
      // fund 跑赢 benchmark 的关系应保持一致
      expect(Math.sign(fundOverBmk)).toBe(Math.sign(originalOver));
    }
  });

  it('normalizes data from different time ranges correctly', () => {
    // 模拟不同时间段的累计收益数据
    const input = {
      dates: ['2026-02-01', '2026-02-15', '2026-03-01'],
      fund: [-5, -2, 3], // 从 -5% 开始
      avg: [-3, -1, 2],
      bmk: [-8, -4, 1],
    };
    const result = normalizeGrowthSeriesToFirst(input);
    expect(result).not.toBeNull();

    // 起点均为 0
    expect(result!.fund[0]).toBe(0);
    expect(result!.avg[0]).toBe(0);
    expect(result!.bmk[0]).toBe(0);

    // fund[1] 应为 ((100+(-2))/(100+(-5))-1)*100 = (98/95-1)*100 ≈ 3.16
    expect(result!.fund[1]).toBeCloseTo((98 / 95 - 1) * 100, 1);
    // fund[2] 应为 ((100+3)/(100+(-5))-1)*100 = (103/95-1)*100 ≈ 8.42
    expect(result!.fund[2]).toBeCloseTo((103 / 95 - 1) * 100, 1);
  });

  it('returns 0 for all values when only one data point exists', () => {
    const input = {
      dates: ['2026-03-01'],
      fund: [10],
      avg: [5],
      bmk: [2],
    };
    const result = normalizeGrowthSeriesToFirst(input);
    expect(result).not.toBeNull();
    expect(result!.fund).toEqual([0]);
    expect(result!.avg).toEqual([0]);
    expect(result!.bmk).toEqual([0]);
  });

  it('returns null when dates array is empty', () => {
    const input = {
      dates: [] as string[],
      fund: [] as number[],
      avg: [] as number[],
      bmk: [] as number[],
    };
    const result = normalizeGrowthSeriesToFirst(input);
    expect(result).toBeNull();
  });

  it('handles null/undefined values gracefully by falling back to 0', () => {
    const input = {
      dates: ['2026-03-01', '2026-03-02'],
      fund: [10, null as unknown as number],
      avg: [5, undefined as unknown as number],
      bmk: [2, 4],
    };
    const result = normalizeGrowthSeriesToFirst(input);
    expect(result).not.toBeNull();
    // null/undefined 被 fallback 为 0（base 为 null 时也会被正确处理）
    expect(result!.fund[0]).toBe(0);
    expect(result!.avg[0]).toBe(0);
  });

  it('returns correct values when fund series is all zeros', () => {
    // 当 fund 全为 0 时（增长率为 0%），不应 crash
    const input = {
      dates: ['2026-03-01', '2026-03-02'],
      fund: [0, 0],
      avg: [0, 0],
      bmk: [0, 0],
    };
    const result = normalizeGrowthSeriesToFirst(input);
    expect(result).not.toBeNull();
    expect(result!.fund[0]).toBe(0);
    expect(result!.fund[1]).toBe(0);
    expect(result!.bmk[0]).toBe(0);
    expect(result!.bmk[1]).toBe(0);
  });

  it('does not mutate the input object', () => {
    const input = {
      dates: ['2026-03-01', '2026-03-02'],
      fund: [10, 15],
      avg: [5, 7],
      bmk: [2, 4],
    };
    const inputCopy = {
      dates: [...input.dates],
      fund: [...input.fund],
      avg: [...input.avg],
      bmk: [...input.bmk],
    };
    normalizeGrowthSeriesToFirst(input);
    // 验证原始对象未被修改
    expect(input.fund).toEqual(inputCopy.fund);
    expect(input.avg).toEqual(inputCopy.avg);
    expect(input.bmk).toEqual(inputCopy.bmk);
    expect(input.dates).toEqual(inputCopy.dates);
  });

  it('preserves dates array unchanged', () => {
    const input = {
      dates: ['2026-03-01', '2026-03-02', '2026-03-03'],
      fund: [10, 15, 20],
      avg: [5, 7, 9],
      bmk: [2, 4, 6],
    };
    const result = normalizeGrowthSeriesToFirst(input);
    expect(result).not.toBeNull();
    expect(result!.dates).toEqual(['2026-03-01', '2026-03-02', '2026-03-03']);
  });
});
