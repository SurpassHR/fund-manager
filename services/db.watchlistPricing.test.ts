import { describe, expect, it } from 'vitest';
import { deriveWatchlistFundEffectivePrice } from './db';

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

  it('falls back to nav change pct when holdings estimate is unavailable', () => {
    const price = deriveWatchlistFundEffectivePrice({
      nav: 1.25,
      navDate: '2026-03-19',
      todayStr: '2026-03-20',
      shouldEstimate: true,
      estimatedChangePct: undefined,
      fallbackChangePct: 1,
    });

    expect(price).toBeCloseTo(1.2625, 6);
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
