import { describe, it, expect } from 'vitest';
import { computeStreak } from './streakCalculator';
import type { FundStreak } from '../types';

describe('computeStreak', () => {
  it('空数组返回 null', () => {
    expect(computeStreak([])).toBeNull();
  });

  it('单日上涨返回 null（不足 2 天）', () => {
    expect(computeStreak([1.5])).toBeNull();
  });

  it('单日下跌返回 null（不足 2 天）', () => {
    expect(computeStreak([-0.8])).toBeNull();
  });

  it('单日平盘（0%）返回 null', () => {
    expect(computeStreak([0])).toBeNull();
  });

  it('连续 2 日上涨返回 up 方向', () => {
    const result = computeStreak([1.2, 0.5]);
    expect(result).toEqual<FundStreak>({ days: 2, direction: 'up' });
  });

  it('连续 2 日下跌返回 down 方向', () => {
    const result = computeStreak([-0.3, -1.5]);
    expect(result).toEqual<FundStreak>({ days: 2, direction: 'down' });
  });

  it('连续 5 日上涨正确计数', () => {
    const result = computeStreak([2.0, 1.5, 1.0, 0.8, 0.3]);
    expect(result).toEqual<FundStreak>({ days: 5, direction: 'up' });
  });

  it('连续 7 日下跌正确计数', () => {
    const result = computeStreak([-0.1, -0.2, -0.5, -1.0, -1.5, -2.0, -0.3]);
    expect(result).toEqual<FundStreak>({ days: 7, direction: 'down' });
  });

  it('上涨被平盘中断', () => {
    const result = computeStreak([0, 1.0, 0.5]);
    expect(result).toBeNull();
  });

  it('下跌被平盘中断', () => {
    const result = computeStreak([0, -1.0, -0.5]);
    expect(result).toBeNull();
  });

  it('上涨被下跌中断后只计算最近的连续', () => {
    const result = computeStreak([1.2, 0.8, -0.5, 1.0, 0.5]);
    // 最近两天上涨，第3天是下跌
    expect(result).toEqual<FundStreak>({ days: 2, direction: 'up' });
  });

  it('下跌被上涨中断后只计算最近的连续', () => {
    const result = computeStreak([-0.3, -0.8, -0.2, 1.2, -0.5, -1.0]);
    // 最近三天下跌（-0.3, -0.8, -0.2），第4天上涨中断
    expect(result).toEqual<FundStreak>({ days: 3, direction: 'down' });
  });

  it('中间有平盘但最近有连续上涨', () => {
    const result = computeStreak([1.5, 0.3, 0, 0.8, 0.2]);
    // 0 中断了前面的 streak，最近两天上涨
    expect(result).toEqual<FundStreak>({ days: 2, direction: 'up' });
  });

  it('所有值均为 0 时返回 null', () => {
    expect(computeStreak([0, 0, 0])).toBeNull();
  });

  it('-0 视为平盘（等于 0）', () => {
    expect(computeStreak([-0, 1.0])).toBeNull();
  });

  it('极小正值视为上涨', () => {
    const result = computeStreak([0.001, 0.002]);
    expect(result).toEqual<FundStreak>({ days: 2, direction: 'up' });
  });

  it('极小负值视为下跌', () => {
    const result = computeStreak([-0.001, -0.002]);
    expect(result).toEqual<FundStreak>({ days: 2, direction: 'down' });
  });

  it('索引 0 为最近一日，方向由最近一日决定', () => {
    // 确保 direction 由 changes[0] 决定，而非末尾
    const result = computeStreak([-1.0, -0.5]);
    expect(result!.direction).toBe('down');
  });
});
