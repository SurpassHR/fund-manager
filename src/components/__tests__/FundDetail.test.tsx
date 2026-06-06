import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { TradeMarkerLegend } from '../TradeMarkerLegend';
import {
  buildTradeMarkersFromTransactions,
  buildChartOption,
  buildFundSeries,
  buildLegendViewModel,
  buildTradeMarkers,
  getTradeLegendLabels,
  splitGrowthSeriesAtZero,
  insertZeroCrossings,
} from '../fundDetailChartUtils';

it('uses unified transaction marker builder to reflect deletion changes', () => {
  const dates = ['2026-03-20', '2026-03-21'];
  const fundData = [1, 2];
  const transactions = [
    {
      id: 'tx-buy',
      type: 'buy' as const,
      date: '2026-03-20',
      time: 'before15' as const,
      amount: 100,
      settlementDate: '2026-03-21',
      settled: true,
    },
    {
      id: 'tx-sell',
      type: 'sell' as const,
      date: '2026-03-21',
      time: 'before15' as const,
      amount: 100,
      settlementDate: '2026-03-22',
      settled: false,
    },
  ];

  const beforeDelete = buildTradeMarkersFromTransactions({
    dates,
    fundData,
    transactions,
    holdingShares: 0,
  });
  const afterDelete = buildTradeMarkersFromTransactions({
    dates,
    fundData,
    transactions: transactions.filter((tx) => tx.id !== 'tx-sell'),
    holdingShares: 100,
  });

  expect(beforeDelete.map((m) => m.name)).toEqual(['buy', 'liquidation']);
  expect(afterDelete.map((m) => m.name)).toEqual(['buy']);
});

it('marks buy with red dot', () => {
  const markers = buildTradeMarkers({
    dates: ['2026-03-01'],
    fundData: [1],
    isWatchlist: false,
    buyDate: '2026-03-01',
    anchorDate: undefined,
    pendingTransactions: [],
    holdingShares: 10,
  });

  expect(markers.some((m) => m.name === 'buy' && m.itemStyle?.color === '#f87171')).toBe(true);
});

it('marks sell with green dot', () => {
  const markers = buildTradeMarkers({
    dates: ['2026-03-02'],
    fundData: [1],
    isWatchlist: false,
    buyDate: undefined,
    anchorDate: undefined,
    pendingTransactions: [
      {
        id: '1',
        type: 'sell',
        date: '2026-03-02',
        time: 'before15',
        amount: 10,
        settlementDate: '2026-03-03',
        settled: false,
      },
    ],
    holdingShares: 10,
  });

  expect(markers.some((m) => m.name === 'sell' && m.itemStyle?.color === '#22c55e')).toBe(true);
});

it('marks watchlist anchor with blue dot', () => {
  const markers = buildTradeMarkers({
    dates: ['2026-03-05'],
    fundData: [1],
    isWatchlist: true,
    buyDate: undefined,
    anchorDate: '2026-03-05',
    pendingTransactions: [],
    holdingShares: 0,
  });

  expect(markers.some((m) => m.name === 'anchor' && m.itemStyle?.color === '#3b82f6')).toBe(true);
});

it('does not include buy/sell/liquidation markers on watchlist', () => {
  const markers = buildTradeMarkers({
    dates: ['2026-03-05'],
    fundData: [1],
    isWatchlist: true,
    buyDate: '2026-03-05',
    anchorDate: '2026-03-05',
    pendingTransactions: [
      {
        id: '1',
        type: 'sell',
        date: '2026-03-05',
        time: 'before15',
        amount: 1,
        settlementDate: '2026-03-06',
        settled: false,
      },
    ],
    holdingShares: 0,
  });

  expect(markers.some((m) => m.name === 'buy')).toBe(false);
  expect(markers.some((m) => m.name === 'sell')).toBe(false);
  expect(markers.some((m) => m.name === 'liquidation')).toBe(false);
  expect(markers.some((m) => m.name === 'anchor')).toBe(true);
});

it('uses circle markers for all marker types', () => {
  const markers = buildTradeMarkers({
    dates: ['2026-03-01'],
    fundData: [1],
    isWatchlist: false,
    buyDate: '2026-03-01',
    anchorDate: undefined,
    pendingTransactions: [
      {
        id: '1',
        type: 'sell',
        date: '2026-03-01',
        time: 'before15',
        amount: 1,
        settlementDate: '2026-03-02',
        settled: false,
      },
    ],
    holdingShares: 0,
  });

  expect(markers.every((m) => m.symbol === 'circle')).toBe(true);
  expect(markers.every((m) => m.label?.show === false)).toBe(true);
  expect(markers.every((m) => m.symbolSize === 8)).toBe(true);
});

it('marks liquidation when shares drop to zero', () => {
  const markers = buildTradeMarkers({
    dates: ['2026-03-03', '2026-03-04'],
    fundData: [1, 1],
    isWatchlist: false,
    buyDate: undefined,
    anchorDate: undefined,
    pendingTransactions: [
      {
        id: '1',
        type: 'sell',
        date: '2026-03-03',
        time: 'before15',
        amount: 5,
        settlementDate: '2026-03-04',
        settled: false,
      },
      {
        id: '2',
        type: 'sell',
        date: '2026-03-04',
        time: 'before15',
        amount: 5,
        settlementDate: '2026-03-05',
        settled: false,
      },
    ],
    holdingShares: 0,
  });

  expect(markers.some((m) => m.name === 'liquidation' && m.coord?.[0] === '2026-03-04')).toBe(true);
});

it('does not mark liquidation when holdingShares is not zero', () => {
  const markers = buildTradeMarkers({
    dates: ['2026-03-03'],
    fundData: [1],
    isWatchlist: false,
    buyDate: undefined,
    anchorDate: undefined,
    pendingTransactions: [
      {
        id: '1',
        type: 'sell',
        date: '2026-03-03',
        time: 'before15',
        amount: 5,
        settlementDate: '2026-03-04',
        settled: false,
      },
    ],
    holdingShares: 5,
  });

  expect(markers.some((m) => m.name === 'liquidation')).toBe(false);
});

it('does not mark liquidation when date not in chart', () => {
  const markers = buildTradeMarkers({
    dates: ['2026-03-03'],
    fundData: [1],
    isWatchlist: false,
    buyDate: undefined,
    anchorDate: undefined,
    pendingTransactions: [
      {
        id: '1',
        type: 'sell',
        date: '2026-03-04',
        time: 'before15',
        amount: 5,
        settlementDate: '2026-03-05',
        settled: false,
      },
    ],
    holdingShares: 0,
  });

  expect(markers.some((m) => m.name === 'liquidation')).toBe(false);
});

it('does not mark liquidation when buy transactions exist', () => {
  const markers = buildTradeMarkers({
    dates: ['2026-03-03'],
    fundData: [1],
    isWatchlist: false,
    buyDate: undefined,
    anchorDate: undefined,
    pendingTransactions: [
      {
        id: '1',
        type: 'buy',
        date: '2026-03-02',
        time: 'before15',
        amount: 100,
        settlementDate: '2026-03-03',
        settled: false,
      },
      {
        id: '2',
        type: 'sell',
        date: '2026-03-03',
        time: 'before15',
        amount: 10,
        settlementDate: '2026-03-04',
        settled: false,
      },
    ],
    holdingShares: 1,
  });

  expect(markers.some((m) => m.name === 'liquidation')).toBe(false);
});

it('wires markers into markPoint', () => {
  const series = buildFundSeries({
    name: 'Test Fund',
    data: [1],
    markers: [{ name: 'buy', coord: ['2026-03-01', 1] }],
    isLargeSeries: false,
    color: '#f87171',
    anchorDate: undefined,
    isDark: false,
  });

  const seriesObj = series as { markPoint?: { data?: unknown[] } };
  expect(seriesObj.markPoint?.data).toHaveLength(1);
});

it('uses markers in chart option series', () => {
  const option = buildChartOption({
    fundName: 'Test Fund',
    dates: ['2026-03-01'],
    positiveLineData: [1],
    negativeLineData: [null],
    positiveAreaData: [1],
    negativeAreaData: [0],
    bmkData: [1],
    markers: [{ name: 'buy', coord: ['2026-03-01', 1] }],
    isLargeSeries: false,
    anchorDate: undefined,
    isDark: false,
    shouldAnimate: false,
    startStr: '2026-03-01',
    endStr: '2026-03-01',
    tooltipFormatter: () => '',
  });

  const fundSeries = option.series?.[0] as { markPoint?: { data?: unknown[] } } | undefined;
  expect(fundSeries?.markPoint?.data).toHaveLength(1);
  expect(option.tooltip).toBeDefined();
});

it('requests legend i18n keys', () => {
  const calls: string[] = [];
  const t = (key: string) => {
    calls.push(key);
    return key;
  };

  getTradeLegendLabels(t);
  expect(calls).toEqual([
    'common.tradeBuyLabel',
    'common.tradeSellLabel',
    'common.tradeLiquidationLabel',
    'common.tradeAnchorLabel',
  ]);
});

it('builds legend model for watchlist with anchor only', () => {
  const t = (key: string) => key;
  const vm = buildLegendViewModel({ isWatchlist: true, t });

  expect(vm.mode).toBe('watchlist');
  expect(vm.labels.anchor).toBe('common.tradeAnchorLabel');
});

it('shows holdings legend labels and dots', () => {
  render(
    <TradeMarkerLegend
      mode="holding"
      labels={{ buy: '买入', sell: '卖出', liquidation: '清仓', anchor: '锚点' }}
    />,
  );

  expect(screen.getByText('买入')).toBeInTheDocument();
  expect(screen.getByText('卖出')).toBeInTheDocument();
  expect(screen.getByText('清仓')).toBeInTheDocument();
  expect(screen.getByTestId('legend-dot-buy')).toBeInTheDocument();
  expect(screen.getByTestId('legend-dot-sell')).toBeInTheDocument();
  expect(screen.getByTestId('legend-dot-liquidation')).toBeInTheDocument();
});

it('shows watchlist anchor only', () => {
  render(
    <TradeMarkerLegend
      mode="watchlist"
      labels={{ buy: '买入', sell: '卖出', liquidation: '清仓', anchor: '锚点' }}
    />,
  );

  expect(screen.getByText('锚点')).toBeInTheDocument();
  expect(screen.getByTestId('legend-dot-anchor')).toBeInTheDocument();
  expect(screen.queryByTestId('legend-dot-buy')).toBeNull();
  expect(screen.queryByTestId('legend-dot-sell')).toBeNull();
  expect(screen.queryByTestId('legend-dot-liquidation')).toBeNull();
});

it('uses correct dot colors', () => {
  render(
    <TradeMarkerLegend
      mode="holding"
      labels={{ buy: '买入', sell: '卖出', liquidation: '清仓', anchor: '锚点' }}
    />,
  );

  expect(screen.getByTestId('legend-dot-buy')).toHaveStyle({ backgroundColor: '#f87171' });
  expect(screen.getByTestId('legend-dot-sell')).toHaveStyle({ backgroundColor: '#22c55e' });
  expect(screen.getByTestId('legend-dot-liquidation')).toHaveStyle({ backgroundColor: '#fbbf24' });
});

describe('splitGrowthSeriesAtZero', () => {
  it('puts all values in positive array when data is all positive', () => {
    const data = [1, 2, 3, 5];
    const { positive, negative } = splitGrowthSeriesAtZero(data);

    expect(positive).toEqual([1, 2, 3, 5]);
    expect(negative).toEqual([null, null, null, null]);
    expect(positive).toHaveLength(4);
    expect(negative).toHaveLength(4);
  });

  it('puts all values in negative array when data is all negative', () => {
    const data = [-1, -2, -3, -0.5];
    const { positive, negative } = splitGrowthSeriesAtZero(data);

    expect(positive).toEqual([null, null, null, null]);
    expect(negative).toEqual([-1, -2, -3, -0.5]);
  });

  it('splits mixed data with shared zero at crossings for line continuity', () => {
    const data = [2, 1, -1, -2, 3, -3];
    const { positive, negative } = splitGrowthSeriesAtZero(data);

    // 在交叉点离 0 更近的索引上，两线共享 y=0 以保证交汇
    expect(positive).toEqual([2, 0, null, 0, 0, null]);
    expect(negative).toEqual([null, 0, -1, 0, 0, -3]);
  });

  it('bridges zero crossings and handles native zeros correctly', () => {
    const data = [0, 0, -1, 2, 0, -3];
    const { positive, negative } = splitGrowthSeriesAtZero(data);

    expect(positive).toEqual([0, 0, 0, 2, 0, null]);
    expect(negative).toEqual([null, 0, 0, null, 0, -3]);
  });

  it('returns null in both arrays for null/NaN values', () => {
    const data = [1, null, -2, NaN, 3] as Array<number | null>;
    const { positive, negative } = splitGrowthSeriesAtZero(data);

    expect(positive).toEqual([1, null, null, null, 3]);
    expect(negative).toEqual([null, null, -2, null, null]);
  });

  it('returns empty arrays for empty input', () => {
    const { positive, negative } = splitGrowthSeriesAtZero([]);

    expect(positive).toEqual([]);
    expect(negative).toEqual([]);
  });

  it('preserves output array length matching input', () => {
    const data = [1, -2, 3, -4, 5, -6, 7, -8, 9, -10];
    const { positive, negative } = splitGrowthSeriesAtZero(data);

    expect(positive).toHaveLength(10);
    expect(negative).toHaveLength(10);
  });
});

describe('insertZeroCrossings', () => {
  it('inserts interpolated zero points at each zero-crossing', () => {
    const data = [2, 1, -1, -2];
    const dates = ['03-01', '03-02', '03-03', '03-04'];
    const { data: result, dates: resultDates, insertIndices } = insertZeroCrossings(data, dates);

    expect(result).toEqual([2, 1, 0, -1, -2]);
    expect(resultDates).toEqual(['03-01', '03-02', '', '03-03', '03-04']);
    expect(insertIndices).toEqual([2]);
  });

  it('returns same arrays when data is all positive', () => {
    const data = [2, 3, 5];
    const dates = ['d1', 'd2', 'd3'];
    const { data: result, dates: resultDates, insertIndices } = insertZeroCrossings(data, dates);

    expect(result).toEqual([2, 3, 5]);
    expect(resultDates).toEqual(['d1', 'd2', 'd3']);
    expect(insertIndices).toEqual([]);
  });

  it('returns same arrays when data is all negative', () => {
    const data = [-1, -2, -3];
    const dates = ['d1', 'd2', 'd3'];
    const { data: result, dates: resultDates, insertIndices } = insertZeroCrossings(data, dates);

    expect(result).toEqual([-1, -2, -3]);
    expect(resultDates).toEqual(['d1', 'd2', 'd3']);
    expect(insertIndices).toEqual([]);
  });

  it('handles empty input', () => {
    const { data: result, dates: resultDates, insertIndices } = insertZeroCrossings([], []);

    expect(result).toEqual([]);
    expect(resultDates).toEqual([]);
    expect(insertIndices).toEqual([]);
  });

  it('skips null/NaN values in crossing detection', () => {
    const data = [1, null, -2, NaN, 3] as Array<number | null>;
    const dates = ['d1', 'd2', 'd3', 'd4', 'd5'];
    const { data: result, dates: resultDates } = insertZeroCrossings(data, dates);

    expect(result).toEqual([1, null, -2, NaN, 3]);
    expect(resultDates).toEqual(['d1', 'd2', 'd3', 'd4', 'd5']);
  });

  it('returns equal-length data and dates arrays', () => {
    const data = [5, -3, 2, -1, 4, -2, 1, -5, 3, -4];
    const dates = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
    const { data: result, dates: resultDates } = insertZeroCrossings(data, dates);

    expect(result.length).toBe(resultDates.length);
    expect(result.length).toBeGreaterThan(data.length);
  });

  it('handles multiple consecutive crossings', () => {
    const data = [1, -1, 2, -2];
    const dates = ['d1', 'd2', 'd3', 'd4'];
    const { data: result, dates: resultDates, insertIndices } = insertZeroCrossings(data, dates);

    expect(result).toEqual([1, 0, -1, 0, 2, 0, -2]);
    expect(resultDates).toEqual(['d1', '', 'd2', '', 'd3', '', 'd4']);
    expect(insertIndices).toEqual([1, 3, 5]);
  });

  it('insertIndices are in ascending order', () => {
    const data = [3, -1, 2, -2, 1];
    const dates = ['a', 'b', 'c', 'd', 'e'];
    const { insertIndices } = insertZeroCrossings(data, dates);

    for (let i = 1; i < insertIndices.length; i++) {
      expect(insertIndices[i]).toBeGreaterThan(insertIndices[i - 1]);
    }
  });
});

describe('buildFundSeries areaStyle gradient direction', () => {
  it('uses normal gradient by default: line color at top, transparent at bottom', () => {
    const series = buildFundSeries({
      name: 'Test Fund',
      data: [2, 3, 1],
      markers: [],
      isLargeSeries: false,
      color: '#f87171',
      isDark: false,
    }) as { areaStyle?: { color?: { colorStops?: Array<{ offset: number; color: string }> } } };

    const stops = series.areaStyle?.color?.colorStops;
    expect(stops).toBeDefined();
    expect(stops![0]).toEqual({ offset: 0, color: '#f87171' });
    expect(stops![1]).toEqual({ offset: 1, color: 'rgba(255,255,255,0)' });
  });

  it('uses reversed gradient when gradientDirection is "reversed": transparent at top, line color at bottom', () => {
    const series = buildFundSeries({
      name: 'Test Fund',
      data: [-2, -3, -1],
      markers: [],
      isLargeSeries: false,
      color: '#34d399',
      gradientDirection: 'reversed',
      isDark: false,
    }) as { areaStyle?: { color?: { colorStops?: Array<{ offset: number; color: string }> } } };

    const stops = series.areaStyle?.color?.colorStops;
    expect(stops).toBeDefined();
    expect(stops![0]).toEqual({ offset: 0, color: 'rgba(255,255,255,0)' });
    expect(stops![1]).toEqual({ offset: 1, color: '#34d399' });
  });

  it('suppresses areaStyle when showArea is false', () => {
    const series = buildFundSeries({
      name: 'Test Fund',
      data: [2, 3],
      markers: [],
      isLargeSeries: false,
      color: '#f87171',
      showArea: false,
      isDark: false,
    }) as { areaStyle?: unknown };

    expect(series.areaStyle).toBeUndefined();
  });

  it('disables areaStyle in anchor mode regardless of gradientDirection', () => {
    const normal = buildFundSeries({
      name: 'Test Fund',
      data: [2, 3],
      markers: [],
      isLargeSeries: false,
      color: '#f87171',
      anchorDate: '2026-03-01',
      gradientDirection: 'normal',
      isDark: false,
    }) as { areaStyle?: unknown };

    const reversed = buildFundSeries({
      name: 'Test Fund',
      data: [-2, -3],
      markers: [],
      isLargeSeries: false,
      color: '#34d399',
      anchorDate: '2026-03-01',
      gradientDirection: 'reversed',
      isDark: false,
    }) as { areaStyle?: unknown };

    expect(normal.areaStyle).toBeUndefined();
    expect(reversed.areaStyle).toBeUndefined();
  });

  it('uses dark transparent color in dark mode for normal gradient', () => {
    const series = buildFundSeries({
      name: 'Test Fund',
      data: [2, 3],
      markers: [],
      isLargeSeries: false,
      color: '#f87171',
      isDark: true,
    }) as { areaStyle?: { color?: { colorStops?: Array<{ offset: number; color: string }> } } };

    const stops = series.areaStyle?.color?.colorStops;
    expect(stops![1]).toEqual({ offset: 1, color: 'rgba(0,0,0,0)' });
  });
});

describe('buildChartOption with single line + area series', () => {
  const dates = ['2026-03-01', '2026-03-02', '2026-03-03'];
  const fundData = [
    { value: 2, itemStyle: { color: '#f87171' } },
    { value: -1, itemStyle: { color: '#34d399' } },
    { value: 1, itemStyle: { color: '#f87171' } },
  ];
  const positiveAreaData = [2, 0, 1];
  const negativeAreaData = [0, -1, 0];
  const bmkData = [0.5, 0.8, 1.2];
  const markers = [{ name: 'buy', coord: ['2026-03-01', 2] as [string, number] }];

  const option = buildChartOption({
    fundName: 'Test Fund',
    dates,
    fundData,
    positiveAreaData,
    negativeAreaData,
    bmkData,
    markers,
    isLargeSeries: false,
    isDark: false,
    shouldAnimate: false,
    startStr: '2026-03-01',
    endStr: '2026-03-03',
    tooltipFormatter: () => '',
  });

  const seriesList = option.series as Array<Record<string, unknown>> | undefined;

  it('creates four series: fund line, pos area, neg area, benchmark', () => {
    expect(seriesList).toHaveLength(4);
  });

  it('fund line series has markers and no area fill', () => {
    const line = seriesList?.[0] as {
      data?: Array<{ value: number; itemStyle?: { color?: string } }>;
      lineStyle?: { color?: string };
      markPoint?: { data?: unknown[] };
      areaStyle?: unknown;
    };
    expect(line?.markPoint?.data).toHaveLength(1);
    expect(line?.areaStyle).toBeUndefined();
    // 验证逐点颜色：正值为红，负值为绿
    expect(line?.data).toHaveLength(3);
    expect(line?.data?.[0].itemStyle?.color).toBe('#f87171');
    expect(line?.data?.[1].itemStyle?.color).toBe('#34d399');
    expect(line?.data?.[2].itemStyle?.color).toBe('#f87171');
  });

  it('positive area series has transparent line and red solid fill', () => {
    const posArea = seriesList?.[1] as {
      lineStyle?: { width?: number };
      areaStyle?: { color?: string };
      tooltip?: { show?: boolean };
    };
    expect(posArea?.lineStyle?.width).toBe(0);
    expect(posArea?.tooltip?.show).toBe(false);
    expect(posArea?.areaStyle?.color).toBe('#f87171');
  });

  it('negative area series has transparent line and green solid fill', () => {
    const negArea = seriesList?.[2] as {
      lineStyle?: { width?: number };
      areaStyle?: { color?: string };
      tooltip?: { show?: boolean };
    };
    expect(negArea?.lineStyle?.width).toBe(0);
    expect(negArea?.tooltip?.show).toBe(false);
    expect(negArea?.areaStyle?.color).toBe('#34d399');
  });

  it('benchmark series is at index 3', () => {
    const bmkSeries = seriesList?.[3] as {
      name?: string;
      lineStyle?: { color?: string; type?: string };
      z?: number;
    };
    expect(bmkSeries?.name).toBe('业绩基准');
    expect(bmkSeries?.lineStyle?.color).toBe('#fbbf24');
    expect(bmkSeries?.lineStyle?.type).toBe('dashed');
    expect(bmkSeries?.z).toBe(2);
  });

  it('anchor mode has only fund line and benchmark (no area series)', () => {
    const anchorOption = buildChartOption({
      fundName: 'Test Fund',
      dates,
      fundData,
      positiveAreaData,
      negativeAreaData,
      bmkData,
      markers,
      isLargeSeries: false,
      anchorDate: '2026-03-01',
      isDark: false,
      shouldAnimate: false,
      startStr: '2026-03-01',
      endStr: '2026-03-03',
      tooltipFormatter: () => '',
    });
    const anchorSeries = anchorOption.series as Array<unknown>;
    expect(anchorSeries).toHaveLength(2);
  });
});
