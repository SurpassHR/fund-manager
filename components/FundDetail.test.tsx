import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { TradeMarkerLegend } from './TradeMarkerLegend';
import {
  buildTradeMarkersFromTransactions,
  buildChartOption,
  buildFundSeries,
  buildLegendViewModel,
  buildTradeMarkers,
  getTradeLegendLabels,
} from './fundDetailChartUtils';

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

  expect(beforeDelete.map((m) => m.name)).toEqual(['buy', 'sell']);
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

it('marks sell with blue dot', () => {
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

  expect(markers.some((m) => m.name === 'sell' && m.itemStyle?.color === '#3b82f6')).toBe(true);
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
    holdingShares: 0,
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
    fundData: [1],
    bmkData: [1],
    markers: [{ name: 'buy', coord: ['2026-03-01', 1] }],
    isLargeSeries: false,
    color: '#f87171',
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
  expect(screen.getByTestId('legend-dot-sell')).toHaveStyle({ backgroundColor: '#3b82f6' });
  expect(screen.getByTestId('legend-dot-liquidation')).toHaveStyle({ backgroundColor: '#fbbf24' });
});
