import { describe, expect, it } from 'vitest';
import { pickWatchlistNameFromMorningstar, sanitizeWatchlistName } from '../watchlistName';

describe('watchlist name helpers', () => {
  it('优先使用 fundNameArr 作为自选名称', () => {
    const name = pickWatchlistNameFromMorningstar({
      fundClassId: 'cls-1',
      fundName: '110011 易方达中小盘',
      fundNameArr: '易方达中小盘',
      symbol: '110011',
      fundType: '混合型',
    });

    expect(name).toBe('易方达中小盘');
  });

  it('可去除名称前缀中的基金代码', () => {
    expect(sanitizeWatchlistName('110011 易方达中小盘', '110011')).toBe('易方达中小盘');
    expect(sanitizeWatchlistName('110011-易方达中小盘', '110011')).toBe('易方达中小盘');
    expect(sanitizeWatchlistName('110011（LOF）', '110011')).toBe('（LOF）');
  });

  it('名称不含前缀代码时保持不变', () => {
    expect(sanitizeWatchlistName('易方达中小盘', '110011')).toBe('易方达中小盘');
  });
});
