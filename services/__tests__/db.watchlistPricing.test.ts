import { describe, expect, it } from 'vitest';
import {
  calculateSummary,
  deriveFundIntradayDisplayMetrics,
  deriveWatchlistFundEffectivePrice,
} from '../db';

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
  it('uses cost price as day-gain baseline on the first active trading day', () => {
    const metrics = deriveFundIntradayDisplayMetrics({
      holdingShares: 25515.09,
      nav: 1.5813,
      navDate: '2026-03-20',
      todayStr: '2026-03-20',
      navChangePercent: 0.87,
      shouldEstimate: false,
      estimatedChangePct: undefined,
      isGainActive: true,
      dayChangeBaseNav: 1.5677,
    });

    expect(metrics.dayChangePct).toBe(0.87);
    expect(metrics.dayChangeVal).toBeCloseTo(347.005224, 6);
    expect(metrics.todayChangeIsEstimated).toBe(false);
    expect(metrics.todayChangeUnavailable).toBe(false);
  });

  it('prefers explicit previous nav over rounded day pct for official day gain', () => {
    const metrics = deriveFundIntradayDisplayMetrics({
      holdingShares: 37232.3,
      nav: 3.071,
      navDate: '2026-03-20',
      todayStr: '2026-03-20',
      navChangePercent: 1.15,
      shouldEstimate: false,
      estimatedChangePct: undefined,
      isGainActive: true,
      officialPreviousNav: 3.036,
    });

    expect(metrics.dayChangePct).toBe(1.15);
    expect(metrics.dayChangeVal).toBeCloseTo(1303.1305, 6);
  });

  it('keeps estimated badge signal even when gain is not active yet', () => {
    const metrics = deriveFundIntradayDisplayMetrics({
      holdingShares: 100,
      nav: 1.2,
      navDate: '2026-03-19',
      todayStr: '2026-03-20',
      navChangePercent: 1.5,
      shouldEstimate: true,
      estimatedChangePct: 2,
      isGainActive: false,
    });

    expect(metrics.effectivePctDate).toBe('2026-03-20');
    expect(metrics.dayChangePct).toBe(0);
    expect(metrics.dayChangeVal).toBe(0);
    expect(metrics.estimatedDayChangePct).toBe(2);
    expect(metrics.todayChangeIsEstimated).toBe(true);
    expect(metrics.todayChangeUnavailable).toBe(false);
  });

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
    expect(metrics.estimatedDayChangePct).toBe(0);
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
    expect(metrics.estimatedDayChangePct).toBe(2);
    expect(metrics.todayChangeIsEstimated).toBe(true);
    expect(metrics.todayChangeUnavailable).toBe(false);
  });
});

describe('calculateSummary', () => {
  it('uses estimated pct to calculate day gain when estimated badge is active', () => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate(),
    ).padStart(2, '0')}`;

    const summary = calculateSummary([
      {
        id: 1,
        code: '000001',
        name: '估值基金',
        platform: '默认账户',
        holdingShares: 100,
        costPrice: 1,
        currentNav: 1.2,
        lastUpdate: todayStr,
        dayChangePct: 0,
        dayChangeVal: 0,
        officialDayChangePct: 0.5,
        estimatedDayChangePct: 2,
        todayChangeIsEstimated: true,
        todayChangeUnavailable: false,
      },
    ]);

    expect(summary.totalDayGain).toBeCloseTo(2.4, 6);
  });
});
