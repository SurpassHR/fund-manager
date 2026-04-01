import { describe, expect, it } from 'vitest';
import { deriveFundIntradayDisplayMetrics, deriveWatchlistFundEffectivePrice } from '../db';

describe('deriveWatchlistFundEffectivePrice', () => {
  it('uses estimated day pct to project today fund price', () => {
    const price = deriveWatchlistFundEffectivePrice({
      nav: 1.25,
      navDate: '2026-03-19',
      todayStr: '2026-03-20',
      shouldEstimate: true,
      estimatedChangePct: 2,
    });

    expect(price).toBeCloseTo(1.275, 6);
  });

  it('keeps nav unchanged when official today nav is available', () => {
    const price = deriveWatchlistFundEffectivePrice({
      nav: 1.25,
      navDate: '2026-03-20',
      todayStr: '2026-03-20',
      shouldEstimate: false,
      estimatedChangePct: undefined,
    });

    expect(price).toBeCloseTo(1.25, 6);
  });

  it('keeps nav unchanged when holdings estimate is unavailable', () => {
    const price = deriveWatchlistFundEffectivePrice({
      nav: 1.25,
      navDate: '2026-03-19',
      todayStr: '2026-03-20',
      shouldEstimate: true,
      estimatedChangePct: undefined,
    });

    expect(price).toBeCloseTo(1.25, 6);
  });

  it('does not project today change when anchor date is today', () => {
    const price = deriveWatchlistFundEffectivePrice({
      nav: 1.25,
      navDate: '2026-03-19',
      todayStr: '2026-03-20',
      shouldEstimate: true,
      estimatedChangePct: 2,
      anchorDate: '2026-03-20',
    });

    expect(price).toBeCloseTo(1.25, 6);
  });
});

describe('deriveFundIntradayDisplayMetrics', () => {
  it('returns zero gray metrics with unavailable estimate when shouldEstimate but no holdings estimate', () => {
    const metrics = deriveFundIntradayDisplayMetrics({
      holdingShares: 100,
      nav: 1.2,
      navDate: '2026-03-19',
      todayStr: '2026-03-20',
      navChangePercent: 1.5,
      shouldEstimate: true,
      estimatedChangePct: undefined,
      isGainActive: true,
    });

    expect(metrics.effectivePctDate).toBe('2026-03-20');
    expect(metrics.dayChangePct).toBe(0);
    expect(metrics.dayChangeVal).toBe(0);
    expect(metrics.todayChangeIsEstimated).toBe(false);
    expect(metrics.todayChangeUnavailable).toBe(true);
  });

  it('uses estimated metrics when intraday estimate is available', () => {
    const metrics = deriveFundIntradayDisplayMetrics({
      holdingShares: 100,
      nav: 1.2,
      navDate: '2026-03-19',
      todayStr: '2026-03-20',
      navChangePercent: 1.5,
      shouldEstimate: true,
      estimatedChangePct: 2,
      isGainActive: true,
    });

    expect(metrics.effectivePctDate).toBe('2026-03-20');
    expect(metrics.dayChangePct).toBe(2);
    expect(metrics.dayChangeVal).toBeCloseTo(2.4, 6);
    expect(metrics.todayChangeIsEstimated).toBe(true);
    expect(metrics.todayChangeUnavailable).toBe(false);
  });
});
