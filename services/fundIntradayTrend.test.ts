import { describe, it, expect } from 'vitest';
import { calcFundIntradayTrend } from './fundIntradayTrend';
import type { IntradayPoint } from './api';
import type { EquityHolding } from '../types';

const makePoints = (timesAndPrices: [string, number][]): IntradayPoint[] =>
  timesAndPrices.map(([time, price]) => ({ time, price }));

const holding = (
  ticker: string,
  weight: number,
  overrides?: Partial<EquityHolding>,
): EquityHolding => ({
  ticker,
  name: overrides?.name ?? ticker,
  weight,
  sector: overrides?.sector ?? '',
  styleBox: overrides?.styleBox ?? '',
});

describe('calcFundIntradayTrend', () => {
  it('returns empty array when intraday data is empty', () => {
    expect(calcFundIntradayTrend({}, [holding('000001', 100)], 1.0)).toEqual([]);
  });

  it('returns empty array when no holding matches intraday data', () => {
    const intradayData = {
      '000001': makePoints([
        ['09:30', 10],
        ['09:31', 11],
      ]),
    };
    const holdings = [holding('000002', 100)];
    expect(calcFundIntradayTrend(intradayData, holdings, 1.0)).toEqual([]);
  });

  it('returns empty array when total effective weight is 0', () => {
    const intradayData = {
      '000001': makePoints([
        ['09:30', 10],
        ['09:31', 11],
      ]),
    };
    const holdings = [holding('000001', 0)];
    expect(calcFundIntradayTrend(intradayData, holdings, 1.0)).toEqual([]);
  });

  it('returns empty array when stock has fewer than 2 data points', () => {
    const intradayData = { '000001': makePoints([['09:30', 10]]) };
    const holdings = [holding('000001', 100)];
    expect(calcFundIntradayTrend(intradayData, holdings, 1.0)).toEqual([]);
  });

  it('computes correct estimated NAV for a single stock', () => {
    const intradayData = {
      '000001': makePoints([
        ['09:30', 10],
        ['09:31', 10.5],
        ['09:32', 11],
      ]),
    };
    const holdings = [holding('000001', 100)];
    const result = calcFundIntradayTrend(intradayData, holdings, 2.0);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ time: '09:30', estimatedNav: 2.0 });
    expect(result[1].time).toBe('09:31');
    expect(result[1].estimatedNav).toBeCloseTo(2.0 * (1 + 5 / 100));
    expect(result[2].time).toBe('09:32');
    expect(result[2].estimatedNav).toBeCloseTo(2.0 * (1 + 10 / 100));
  });

  it('weights multiple stocks correctly by their weight proportions', () => {
    // Stock A: 10→11 (+10%), weight 60
    // Stock B: 20→19 (−5%), weight 40
    // Weighted change = 0.6×10 + 0.4×(−5) = 4%
    const intradayData = {
      '000001': makePoints([
        ['09:30', 10],
        ['09:31', 11],
      ]),
      '000002': makePoints([
        ['09:30', 20],
        ['09:31', 19],
      ]),
    };
    const holdings = [holding('000001', 60), holding('000002', 40)];
    const result = calcFundIntradayTrend(intradayData, holdings, 1.5);

    expect(result).toHaveLength(2);
    expect(result[0].estimatedNav).toBeCloseTo(1.5);
    expect(result[1].estimatedNav).toBeCloseTo(1.5 * 1.04);
  });

  it('forward-fills missing intermediate time points', () => {
    // Stock A has 09:30, 09:31, 09:32
    // Stock B has only 09:30, 09:32 — 09:31 should forward-fill to 20
    const intradayData = {
      '000001': makePoints([
        ['09:30', 10],
        ['09:31', 10.5],
        ['09:32', 11],
      ]),
      '000002': makePoints([
        ['09:30', 20],
        ['09:32', 21],
      ]),
    };
    const holdings = [holding('000001', 50), holding('000002', 50)];

    const result = calcFundIntradayTrend(intradayData, holdings, 1.0);

    expect(result).toHaveLength(3);
    // 09:30: 0%
    expect(result[0].estimatedNav).toBeCloseTo(1.0);
    // 09:31: A=5%, B=0%(FF) → 2.5%
    expect(result[1].estimatedNav).toBeCloseTo(1.0 * 1.025);
    // 09:32: A=10%, B=5% → 7.5%
    expect(result[2].estimatedNav).toBeCloseTo(1.0 * 1.075);
  });

  it('normalizes weights when holdings sum is less than 100%', () => {
    // A weight=30, B weight=20 → total 50, normalized A=0.6, B=0.4
    const intradayData = {
      '000001': makePoints([
        ['09:30', 10],
        ['09:31', 11],
      ]),
      '000002': makePoints([
        ['09:30', 20],
        ['09:31', 19],
      ]),
    };
    const holdings = [holding('000001', 30), holding('000002', 20)];
    const result = calcFundIntradayTrend(intradayData, holdings, 2.0);

    // Weighted = 0.6×10 + 0.4×(−5) = 4%
    expect(result).toHaveLength(2);
    expect(result[0].estimatedNav).toBeCloseTo(2.0);
    expect(result[1].estimatedNav).toBeCloseTo(2.0 * 1.04);
  });

  it('merges differing time points across stocks into unified timeline', () => {
    const intradayData = {
      '000001': makePoints([
        ['09:30', 10],
        ['09:32', 10.5],
      ]),
      '000002': makePoints([
        ['09:31', 20],
        ['09:33', 19.5],
      ]),
    };
    const holdings = [holding('000001', 50), holding('000002', 50)];

    const result = calcFundIntradayTrend(intradayData, holdings, 1.0);

    expect(result).toHaveLength(4);
    expect(result.map((r) => r.time)).toEqual(['09:30', '09:31', '09:32', '09:33']);
  });

  it('skips stocks with fewer than 2 data points and renormalizes weights', () => {
    const intradayData = {
      '000001': makePoints([
        ['09:30', 10],
        ['09:31', 11],
      ]),
      '000002': makePoints([['09:30', 20]]), // only 1 point → skipped
    };
    const holdings = [holding('000001', 60), holding('000002', 40)];
    const result = calcFundIntradayTrend(intradayData, holdings, 1.0);

    // Only Stock A contributes, weight renormalized to 100%
    expect(result).toHaveLength(2);
    expect(result[1].estimatedNav).toBeCloseTo(1.0 * (1 + 10 / 100));
  });

  it('matches holdings by normalized ticker (ignoring suffixes)', () => {
    const intradayData = {
      '000001': makePoints([
        ['09:30', 10],
        ['09:31', 11],
      ]),
    };
    const holdings = [holding('000001.SZ', 100)];

    const result = calcFundIntradayTrend(intradayData, holdings, 1.0);

    expect(result).toHaveLength(2);
    expect(result[1].estimatedNav).toBeCloseTo(1.1);
  });

  it('handles a stock whose price drops throughout the session', () => {
    const intradayData = {
      '000001': makePoints([
        ['09:30', 20],
        ['09:31', 19],
        ['09:32', 18],
      ]),
    };
    const holdings = [holding('000001', 100)];

    const result = calcFundIntradayTrend(intradayData, holdings, 1.0);

    expect(result).toHaveLength(3);
    expect(result[0].estimatedNav).toBeCloseTo(1.0);
    expect(result[1].estimatedNav).toBeCloseTo(1.0 * (1 - 5 / 100));
    expect(result[2].estimatedNav).toBeCloseTo(1.0 * (1 - 10 / 100));
  });

  it('returns empty array when holdings array is empty', () => {
    const intradayData = {
      '000001': makePoints([
        ['09:30', 10],
        ['09:31', 11],
      ]),
    };
    expect(calcFundIntradayTrend(intradayData, [], 1.0)).toEqual([]);
  });
});
