import { describe, it, expect } from 'vitest';
import { calcFundIntradayTrend } from './fundIntradayTrend';
import { calcWeightedChangePct } from './fundQuotePipeline';
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

  // --- stockPrevCloseMap tests ---

  it('uses prev close as base when stockPrevCloseMap is provided (gap up scenario)', () => {
    // Stock opens at 10.5, prev close was 10.0 (overnight gap +5%)
    // Intraday: 09:30=10.5, 09:31=11.0 (intraday +4.76%)
    // With prevClose=10.0: 09:30 change=5%, 09:31 change=10%
    const intradayData = {
      '000001': makePoints([
        ['09:30', 10.5],
        ['09:31', 11.0],
      ]),
    };
    const holdings = [holding('000001', 100)];
    const stockPrevCloseMap = { '000001': 10.0 };

    const result = calcFundIntradayTrend(intradayData, holdings, 2.0, stockPrevCloseMap);

    expect(result).toHaveLength(2);
    // 09:30: change=(10.5/10.0-1)*100=5%, estimatedNav=2.0*1.05=2.1
    expect(result[0].estimatedNav).toBeCloseTo(2.1);
    // 09:31: change=(11.0/10.0-1)*100=10%, estimatedNav=2.0*1.10=2.2
    expect(result[1].estimatedNav).toBeCloseTo(2.2);
  });

  it('uses prev close as base when stockPrevCloseMap is provided (gap down scenario)', () => {
    // Stock opens at 9.5, prev close was 10.0 (overnight gap -5%)
    // Intraday: 09:30=9.5, 09:31=9.0 (intraday -5.26%)
    const intradayData = {
      '000001': makePoints([
        ['09:30', 9.5],
        ['09:31', 9.0],
      ]),
    };
    const holdings = [holding('000001', 100)];
    const stockPrevCloseMap = { '000001': 10.0 };

    const result = calcFundIntradayTrend(intradayData, holdings, 1.0, stockPrevCloseMap);

    expect(result).toHaveLength(2);
    // 09:30: change=(9.5/10.0-1)*100=-5%, estimatedNav=1.0*0.95
    expect(result[0].estimatedNav).toBeCloseTo(0.95);
    // 09:31: change=(9.0/10.0-1)*100=-10%, estimatedNav=1.0*0.90
    expect(result[1].estimatedNav).toBeCloseTo(0.9);
  });

  it('falls back to first intraday point when stockPrevCloseMap does not contain a stock', () => {
    const intradayData = {
      '000001': makePoints([
        ['09:30', 10.5],
        ['09:31', 11.0],
      ]),
      '000002': makePoints([
        ['09:30', 20.0],
        ['09:31', 21.0],
      ]),
    };
    const holdings = [holding('000001', 50), holding('000002', 50)];
    // Only provide prevClose for stock A; stock B falls back to first intraday point
    const stockPrevCloseMap = { '000001': 10.0 };

    const result = calcFundIntradayTrend(intradayData, holdings, 1.0, stockPrevCloseMap);

    expect(result).toHaveLength(2);
    // Stock A: base=10.0 (prevClose), 09:31 change=(11/10-1)*100=10%
    // Stock B: base=20.0 (first point), 09:31 change=(21/20-1)*100=5%
    // Weighted: 0.5*10 + 0.5*5 = 7.5%
    expect(result[1].estimatedNav).toBeCloseTo(1.0 * 1.075);
  });

  it('with prevClose matching open price, result equals no-map behavior', () => {
    // No gap: prevClose = open = 10.0
    const intradayData = {
      '000001': makePoints([
        ['09:30', 10.0],
        ['09:31', 11.0],
      ]),
    };
    const holdings = [holding('000001', 100)];
    const stockPrevCloseMap = { '000001': 10.0 };

    const withMap = calcFundIntradayTrend(intradayData, holdings, 2.0, stockPrevCloseMap);
    const withoutMap = calcFundIntradayTrend(intradayData, holdings, 2.0);

    expect(withMap).toHaveLength(withoutMap.length);
    withMap.forEach((point, i) => {
      expect(point.time).toBe(withoutMap[i].time);
      expect(point.estimatedNav).toBeCloseTo(withoutMap[i].estimatedNav);
    });
  });

  it('consistency: last point implied change matches calcWeightedChangePct', () => {
    // 模拟场景：2 只持仓个股，各有不同的前收盘价和日内走势
    // Stock A: prevClose=10.0, 09:30=10.5(gap+5%), 09:31=11.0 → pct=+10%
    // Stock B: prevClose=20.0, 09:30=19.6(gap-2%), 09:31=19.0 → pct=-5%
    const intradayData = {
      '000001': makePoints([
        ['09:30', 10.5],
        ['09:31', 11.0],
      ]),
      '000002': makePoints([
        ['09:30', 19.6],
        ['09:31', 19.0],
      ]),
    };
    const holdings = [holding('000001', 60), holding('000002', 40)];

    // 构建 quote pct map（与 calcWeightedChangePct 配合使用）
    const quotePctMap = { '000001': 10.0, '000002': -5.0 };

    // 从 pct + 最新价 反推 prevClose（与 FundDetail 中 quotes 的计算方式一致）
    const stockPrevCloseMap: Record<string, number> = {};
    for (const [ticker, points] of Object.entries(intradayData)) {
      const nk = ticker.replace(/\D/g, '');
      const pct = quotePctMap[nk];
      if (pct !== undefined && points.length > 0) {
        const latestPrice = points[points.length - 1].price;
        stockPrevCloseMap[nk] = latestPrice / (1 + pct / 100);
      }
    }

    const lastNav = 2.0;
    const trendResult = calcFundIntradayTrend(intradayData, holdings, lastNav, stockPrevCloseMap);
    const pipelineResult = calcWeightedChangePct(holdings, quotePctMap);

    expect(trendResult.length).toBeGreaterThan(0);
    expect(pipelineResult).not.toBeNull();

    // 图表最后一点的隐含涨跌幅应 = calcWeightedChangePct 的结果
    const lastPoint = trendResult[trendResult.length - 1];
    const impliedChangePct = ((lastPoint.estimatedNav - lastNav) / lastNav) * 100;
    expect(impliedChangePct).toBeCloseTo(pipelineResult!);

    // 验证具体数值：weighted = 0.6×10 + 0.4×(-5) = 6 - 2 = 4%
    expect(pipelineResult).toBeCloseTo(4.0);
    expect(lastPoint.estimatedNav).toBeCloseTo(lastNav * 1.04);
  });

  it('handles prevClose=0 in map by falling back to first intraday point', () => {
    const intradayData = {
      '000001': makePoints([
        ['09:30', 10.0],
        ['09:31', 11.0],
      ]),
    };
    const holdings = [holding('000001', 100)];
    // prevClose=0 is invalid, should fall back
    const stockPrevCloseMap = { '000001': 0 };

    const result = calcFundIntradayTrend(intradayData, holdings, 2.0, stockPrevCloseMap);

    // Falls back to using first intraday point (10.0) as base
    expect(result[0].estimatedNav).toBeCloseTo(2.0);
    expect(result[1].estimatedNav).toBeCloseTo(2.0 * 1.1);
  });
});
