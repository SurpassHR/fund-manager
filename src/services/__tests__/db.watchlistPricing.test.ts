import { afterEach, describe, expect, it, vi } from 'vitest';
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
  afterEach(() => {
    vi.useRealTimers();
  });

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

  it('keeps holding and day gain at zero before settlement date for T+2 positions', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-23T10:00:00'));

    const summary = calculateSummary([
      {
        id: 1,
        code: '000001',
        name: 'T+2基金',
        platform: '默认账户',
        holdingShares: 100,
        costPrice: 1,
        currentNav: 1.2345,
        lastUpdate: '2026-04-23',
        dayChangePct: 0.5,
        dayChangeVal: 7.89,
        buyDate: '2026-04-22',
        buyTime: 'before15',
        settlementDays: 2,
      },
    ]);

    expect(summary.totalAssets).toBeCloseTo(123.45, 6);
    expect(summary.totalDayGain).toBe(0);
    expect(summary.holdingGain).toBe(0);
    expect(summary.holdingGainPct).toBe(0);
  });

  it('starts calculating gain on the second trading day for T+2 positions', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-23T10:00:00'));

    const summary = calculateSummary([
      {
        id: 1,
        code: '000001',
        name: 'T+2基金',
        platform: '默认账户',
        holdingShares: 100,
        costPrice: 1,
        currentNav: 1.2345,
        lastUpdate: '2026-04-23',
        dayChangePct: 0.5,
        dayChangeVal: 7.89,
        buyDate: '2026-04-21',
        buyTime: 'before15',
        settlementDays: 2,
      },
    ]);

    expect(summary.totalDayGain).toBeCloseTo(23.45, 6);
    expect(summary.holdingGain).toBeCloseTo(23.45, 6);
    // holdingGainPct = holdingGain / enhancedTotal * 100 = 23.45 / 123.45 * 100
    expect(summary.holdingGainPct).toBeCloseTo(18.9955, 4);
  });

  it('清仓后重新添加的基金不应将旧 realizedGain 计入新持有期', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-22T10:00:00'));

    // 场景：基金曾持有并已清仓（holdingShares=0, realizedGain=500），
    // 用户通过编辑重新添加持仓，realizedGain 已在上层清除为 null。
    // calculateSummary 应正确计算市值和持有收益，不应将旧 realizedGain 累入新持仓。
    const summary = calculateSummary([
      {
        id: 1,
        code: '320007',
        name: '诺安成长混合',
        platform: 'Default',
        holdingShares: 1000,
        costPrice: 1.5,
        currentNav: 1.5,
        lastUpdate: '2026-05-22',
        dayChangePct: 0,
        dayChangeVal: 0,
        buyDate: '2026-05-22',
        buyTime: 'before15',
        settlementDays: 1,
        realizedGain: null as unknown as undefined,
        realizedGainCost: null as unknown as undefined,
      },
    ]);

    // 市值 = 1000 * 1.5 = 1500
    expect(summary.totalAssets).toBeCloseTo(1500, 6);
    // 持仓收益：成本=1000*1.5=1500，市值=1500，差额=0
    expect(summary.holdingGain).toBe(0);
    // 累计收益 = holdingGain + clearedRealizedGain = 0 + 0 = 0
    expect(summary.cumulativeGain).toBe(0);
    expect(summary.cumulativeGainPct).toBe(0);
  });

  it('已清仓基金的旧 realizedGain 仍应计入总累计收益', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-22T10:00:00'));

    // 场景：用户新建了一条持仓记录（db.funds.add），旧的已清仓记录仍存在。
    // 两者独立计算：旧记录贡献 realizedGain，新记录贡献市值和持有收益。
    const summary = calculateSummary([
      // 旧记录：已清仓
      {
        id: 1,
        code: '320007',
        name: '诺安成长混合',
        platform: 'Default',
        holdingShares: 0,
        costPrice: 1.0,
        currentNav: 1.5,
        lastUpdate: '2026-04-01',
        dayChangePct: 0,
        dayChangeVal: 0,
        buyDate: '2026-01-15',
        buyTime: 'before15',
        settlementDays: 1,
        realizedGain: 500,
        realizedGainCost: 1000,
      },
      // 新记录：重新添加
      {
        id: 2,
        code: '320007',
        name: '诺安成长混合',
        platform: 'Default',
        holdingShares: 1000,
        costPrice: 1.5,
        currentNav: 1.5,
        lastUpdate: '2026-05-22',
        dayChangePct: 0,
        dayChangeVal: 0,
        buyDate: '2026-05-22',
        buyTime: 'before15',
        settlementDays: 1,
      },
    ]);

    // 市值：0(旧) + 1000*1.5(新) = 1500
    expect(summary.totalAssets).toBeCloseTo(1500, 6);
    // 持有收益：0(旧, 持股为0) + 0(新, 成本=市值) = 0
    expect(summary.holdingGain).toBe(0);
    // 累计收益 = holdingGain + realizedGain(旧) = 0 + 500 = 500
    expect(summary.cumulativeGain).toBeCloseTo(500, 6);
    // cumulativeGainPct = 500 / 1500 * 100 ≈ 33.33
    expect(summary.cumulativeGainPct).toBeCloseTo(33.3333, 4);
  });

  it('清仓重加后日收益应基于当前净值计算，不受旧 navChangePct 影响', () => {
    vi.useFakeTimers();
    // 2026-05-22 是周五，设置为 05-26（周二），确保买入日期已过结算日
    vi.setSystemTime(new Date('2026-05-26T15:30:00'));

    // 场景：清仓重加后（买入日 05-22），已过结算日，lastUpdate = 今天。
    // 刷新后 dayChangePct 和 dayChangeVal 为正确的当日数据，不依赖旧记录的 navChangePct。
    const holdingShares = 2000;
    const costPrice = 1.5;
    const currentNav = 1.52085; // 市值 ≈ 3041.7，日涨幅 +1.39%
    const dayChangePct = 1.39;
    const marketValue = holdingShares * currentNav;

    const summary = calculateSummary([
      {
        id: 1,
        code: '320007',
        name: '诺安成长混合',
        platform: 'Default',
        holdingShares,
        costPrice,
        currentNav,
        lastUpdate: '2026-05-26',
        dayChangePct,
        // dayChangeVal 由刷新计算：dayChangeBaseNav 取上一个交易日的净值
        // 此处模拟 exact 公式反推值
        dayChangeVal: (marketValue * (dayChangePct / 100)) / (1 + dayChangePct / 100),
        buyDate: '2026-05-22',
        buyTime: 'before15',
        settlementDays: 1,
        realizedGain: null as unknown as undefined,
        realizedGainCost: null as unknown as undefined,
      },
    ]);

    // 市值 = 2000 * 1.52085 = 3041.7
    expect(summary.totalAssets).toBeCloseTo(3041.7, 2);
    // 持有收益 = 2000 * (1.52085 - 1.5) = 41.7
    expect(summary.holdingGain).toBeCloseTo(41.7, 2);
    // 累计收益 = holdingGain + 0 = 41.7
    expect(summary.cumulativeGain).toBeCloseTo(41.7, 2);
    // 日收益基于 fund.dayChangeVal 计算，应与 holdingGain 量级一致（约 41.7）
    expect(summary.totalDayGain).toBeCloseTo(41.7, 1);
  });

  it('清仓重加后旧记录的 dayChangeVal 不污染汇总日收益', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-26T15:30:00'));

    // 场景：清仓后通过新建（非编辑）重新添加同一基金。
    // 旧清仓记录 lastUpdate 为旧日期（不匹配今天），日收益贡献应为 0。
    // 新记录 lastUpdate = 今天，settlement 已完成，应正常贡献日收益。
    const holdingShares = 2000;
    const currentNav = 1.52085;
    const dayChangePct = 1.39;
    const marketValue = holdingShares * currentNav;

    const summary = calculateSummary([
      // 旧记录：已清仓，lastUpdate 是旧日期，带有残留的负 dayChangeVal
      {
        id: 1,
        code: '320007',
        name: '诺安成长混合',
        platform: 'Default',
        holdingShares: 0,
        costPrice: 1.0,
        currentNav: 1.5,
        lastUpdate: '2026-03-10',
        dayChangePct: -2.5,
        dayChangeVal: -707,
        buyDate: '2026-01-15',
        buyTime: 'before15',
        settlementDays: 1,
        realizedGain: -750,
        realizedGainCost: 1000,
      },
      // 新记录：重新添加，正确的当日数据
      {
        id: 2,
        code: '320007',
        name: '诺安成长混合',
        platform: 'Default',
        holdingShares,
        costPrice: 1.5,
        currentNav,
        lastUpdate: '2026-05-26',
        dayChangePct,
        dayChangeVal: (marketValue * (dayChangePct / 100)) / (1 + dayChangePct / 100),
        buyDate: '2026-05-22',
        buyTime: 'before15',
        settlementDays: 1,
        realizedGain: null as unknown as undefined,
        realizedGainCost: null as unknown as undefined,
      },
    ]);

    // 总市值 = 0(旧) + 3041.7(新) = 3041.7
    expect(summary.totalAssets).toBeCloseTo(3041.7, 2);
    // 累计收益 = 41.7(holdingGain) + (-750)(旧 realizedGain) ≈ -708.3
    expect(summary.cumulativeGain).toBeCloseTo(-708.3, 2);
    // 日收益：旧记录 lastUpdate !== today → 0；新记录 dayChangeVal 应正常贡献
    expect(summary.totalDayGain).toBeGreaterThan(0);
    // 日收益不应被旧记录的 -707 污染（那样会是 ≈ -665）
    expect(summary.totalDayGain).not.toBeCloseTo(-665, 0);
  });
});
