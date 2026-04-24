import type { PendingTransaction } from '../types';
import * as echarts from 'echarts';

export type MarkPointDatum = {
  name: string;
  coord: [string, number | null];
  symbol?: string;
  symbolSize?: number;
  symbolRotate?: number;
  itemStyle?: { color: string };
  label?: {
    show: boolean;
    formatter?: string;
    color?: string;
    fontSize?: number;
    fontWeight?: 'normal' | 'bold' | 'bolder' | 'lighter' | number;
  };
};

type TradeMarkerInput = {
  dates: string[];
  fundData: Array<number | null | undefined>;
  isWatchlist: boolean;
  buyDate?: string;
  anchorDate?: string;
  pendingTransactions?: PendingTransaction[];
  holdingShares: number;
};

type FundSeriesInput = {
  name: string;
  data: Array<number | null>;
  markers: MarkPointDatum[];
  isLargeSeries: boolean;
  color: string | echarts.graphic.LinearGradient;
  anchorDate?: string;
  isDark: boolean;
};

type ChartOptionInput = {
  fundName: string;
  dates: string[];
  fundData: Array<number | null>;
  bmkData: Array<number | null>;
  markers: MarkPointDatum[];
  isLargeSeries: boolean;
  color: string | echarts.graphic.LinearGradient;
  anchorDate?: string;
  isDark: boolean;
  shouldAnimate: boolean;
  startStr: string;
  endStr: string;
  tooltipFormatter: (params: unknown) => string;
};

export const TRADE_MARKER_COLORS = {
  buy: '#f87171',
  sell: '#3b82f6',
  liquidation: '#fbbf24',
  anchor: '#3b82f6',
};

const MARKER_DEFAULTS = {
  symbol: 'circle',
  symbolSize: 8,
  label: { show: false },
} as const;

const compareTransactions = (a: PendingTransaction, b: PendingTransaction) => {
  if (a.date === b.date) {
    const aTime = a.time === 'after15' ? 1 : 0;
    const bTime = b.time === 'after15' ? 1 : 0;
    if (aTime === bTime) {
      return a.id.localeCompare(b.id);
    }
    return aTime - bTime;
  }
  return a.date.localeCompare(b.date);
};

type BuildTradeMarkersFromTransactionsInput = {
  dates: string[];
  fundData: Array<number | null | undefined>;
  transactions?: PendingTransaction[];
  holdingShares: number;
};

export const buildTradeMarkersFromTransactions = ({
  dates,
  fundData,
  transactions,
  holdingShares,
}: BuildTradeMarkersFromTransactionsInput): MarkPointDatum[] => {
  const points: MarkPointDatum[] = [];
  const sortedTransactions = [...(transactions || [])].sort(compareTransactions);
  const sellTransactions = sortedTransactions.filter(
    (tx) => tx.type === 'sell' || tx.type === 'transferOut',
  );

  let liquidationDate: string | null = null;
  if (holdingShares <= 0.01) {
    let runningShares = sellTransactions.reduce((sum, tx) => {
      if (tx.type === 'transferOut') {
        return sum + (tx.outShares ?? tx.amount);
      }
      return sum + tx.amount;
    }, 0);

    for (const tx of sellTransactions) {
      const outAmount = tx.type === 'transferOut' ? (tx.outShares ?? tx.amount) : tx.amount;
      runningShares -= outAmount;
      if (runningShares <= 0.01) {
        liquidationDate = tx.date;
        break;
      }
    }

    if (liquidationDate && !dates.includes(liquidationDate)) {
      liquidationDate = null;
    }
  }

  sortedTransactions.forEach((tx) => {
    const idx = dates.indexOf(tx.date);
    if (idx === -1) return;

    const isOutTransaction = tx.type === 'sell' || tx.type === 'transferOut';
    if (isOutTransaction && liquidationDate && liquidationDate === tx.date) {
      points.push({
        name: 'liquidation',
        coord: [tx.date, fundData[idx] ?? null],
        itemStyle: { color: TRADE_MARKER_COLORS.liquidation },
        ...MARKER_DEFAULTS,
      });
      return;
    }

    if (isOutTransaction) {
      points.push({
        name: 'sell',
        coord: [tx.date, fundData[idx] ?? null],
        itemStyle: { color: TRADE_MARKER_COLORS.sell },
        ...MARKER_DEFAULTS,
      });
      return;
    }

    points.push({
      name: 'buy',
      coord: [tx.date, fundData[idx] ?? null],
      itemStyle: { color: TRADE_MARKER_COLORS.buy },
      ...MARKER_DEFAULTS,
    });
  });

  return points;
};

export const buildTradeMarkers = ({
  dates,
  fundData,
  isWatchlist,
  buyDate,
  anchorDate,
  pendingTransactions,
  holdingShares,
}: TradeMarkerInput): MarkPointDatum[] => {
  const points: MarkPointDatum[] = [];

  if (isWatchlist) {
    if (anchorDate) {
      const idx = dates.indexOf(anchorDate);
      if (idx !== -1) {
        points.push({
          name: 'anchor',
          coord: [anchorDate, fundData[idx] ?? null],
          itemStyle: { color: TRADE_MARKER_COLORS.anchor },
          ...MARKER_DEFAULTS,
        });
      }
    }
    return points;
  }

  if (buyDate) {
    const idx = dates.indexOf(buyDate);
    if (idx !== -1) {
      points.push({
        name: 'buy',
        coord: [buyDate, fundData[idx] ?? null],
        itemStyle: { color: TRADE_MARKER_COLORS.buy },
        ...MARKER_DEFAULTS,
      });
    }
  }

  points.push(
    ...buildTradeMarkersFromTransactions({
      dates,
      fundData,
      transactions: pendingTransactions,
      holdingShares,
    }),
  );

  return points;
};

export const buildFundSeries = ({
  name,
  data,
  markers,
  isLargeSeries,
  color,
  anchorDate,
  isDark,
}: FundSeriesInput): echarts.SeriesOption => ({
  name,
  type: 'line',
  data,
  showSymbol: false,
  symbol: 'circle',
  symbolSize: 6,
  smooth: true,
  sampling: isLargeSeries ? 'lttb' : undefined,
  progressive: isLargeSeries ? 300 : undefined,
  progressiveThreshold: isLargeSeries ? 500 : undefined,
  lineStyle: { width: 2, color },
  itemStyle: { color, borderColor: '#fff', borderWidth: 1 },
  areaStyle: anchorDate
    ? undefined
    : {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: color as string },
          { offset: 1, color: isDark ? 'rgba(0,0,0,0)' : 'rgba(255,255,255,0)' },
        ]),
        opacity: 0.2,
      },
  markLine: anchorDate
    ? {
        silent: true,
        symbol: 'none',
        label: {
          show: true,
          position: 'insideEndTop',
          formatter: '持仓成本',
          color: isDark ? '#9ca3af' : '#6b7280',
          fontSize: 10,
          padding: [0, 4],
        },
        lineStyle: {
          color: isDark ? '#6b7280' : '#9ca3af',
          type: 'dashed',
          width: 1,
        },
        data: [{ yAxis: 0 }],
      }
    : undefined,
  markPoint: markers.length > 0 ? { data: markers, animation: true } : undefined,
  z: 3,
});

export const buildChartOption = ({
  fundName,
  dates,
  fundData,
  bmkData,
  markers,
  isLargeSeries,
  color,
  anchorDate,
  isDark,
  shouldAnimate,
  startStr,
  endStr,
  tooltipFormatter,
}: ChartOptionInput): echarts.EChartsOption => ({
  title: {
    text: `${startStr} 至 ${endStr}`,
    left: '0%',
    top: '0%',
    textStyle: { fontSize: 12, color: isDark ? '#9ca3af' : '#666', fontWeight: 'normal' },
  },
  animation: shouldAnimate,
  animationDuration: shouldAnimate ? 300 : 0,
  animationEasing: shouldAnimate ? 'cubicOut' : 'linear',
  backgroundColor: 'transparent',
  grid: { left: 20, right: 10, bottom: 30, top: 10, containLabel: true },
  tooltip: {
    trigger: 'axis',
    axisPointer: {
      type: 'cross',
      label: {
        backgroundColor: isDark ? '#374151' : '#6b7280',
        fontFamily: 'monospace',
      },
      crossStyle: {
        color: isDark ? '#9ca3af' : '#9ca3af',
        type: 'dashed',
      },
    },
    backgroundColor: isDark ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    borderColor: isDark ? '#374151' : '#eee',
    borderWidth: 1,
    padding: [8, 12],
    textStyle: { color: isDark ? '#f3f4f6' : '#333', fontSize: 12 },
    formatter: tooltipFormatter,
  },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: dates,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
      interval: 'auto',
      color: isDark ? '#9ca3af' : '#999',
      fontSize: 10,
      formatter: (value: string) => value.substring(2),
    },
  },
  yAxis: {
    type: 'value',
    position: 'right',
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: {
      show: true,
      lineStyle: {
        color: isDark ? '#374151' : '#f3f4f6',
        type: 'dashed',
        width: 1,
      },
    },
    axisLabel: {
      show: true,
      inside: false,
      color: isDark ? '#9ca3af' : '#9ca3af',
      fontSize: 10,
      formatter: (val: number) => `${val.toFixed(0)}%`,
    },
  },
  series: [
    buildFundSeries({
      name: fundName,
      data: fundData,
      markers,
      isLargeSeries,
      color,
      anchorDate,
      isDark,
    }),
    {
      name: '业绩基准',
      type: 'line',
      data: bmkData,
      showSymbol: false,
      smooth: true,
      sampling: isLargeSeries ? 'lttb' : undefined,
      progressive: isLargeSeries ? 300 : undefined,
      progressiveThreshold: isLargeSeries ? 500 : undefined,
      lineStyle: { width: 1, color: '#fbbf24', type: 'dashed', opacity: 0.5 },
      itemStyle: { color: '#fbbf24' },
      z: 2,
    },
  ],
});

export const getTradeLegendLabels = (t: (key: string) => string) => ({
  buy: t('common.tradeBuyLabel'),
  sell: t('common.tradeSellLabel'),
  liquidation: t('common.tradeLiquidationLabel'),
  anchor: t('common.tradeAnchorLabel'),
});

export const buildLegendViewModel = ({
  isWatchlist,
  t,
}: {
  isWatchlist: boolean;
  t: (key: string) => string;
}): { mode: 'holding' | 'watchlist'; labels: ReturnType<typeof getTradeLegendLabels> } => ({
  mode: isWatchlist ? 'watchlist' : 'holding',
  labels: getTradeLegendLabels(t),
});
