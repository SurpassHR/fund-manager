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
  gradientDirection?: 'normal' | 'reversed';
  showArea?: boolean;
};

type ChartOptionInput = {
  fundName: string;
  dates: string[];
  fundData: Array<{ value: number; itemStyle: { color: string } } | null>;
  positiveAreaData: Array<number | null>;
  negativeAreaData: Array<number | null>;
  bmkData: Array<number | null>;
  markers: MarkPointDatum[];
  isLargeSeries: boolean;
  anchorDate?: string;
  isDark: boolean;
  shouldAnimate: boolean;
  startStr: string;
  endStr: string;
  tooltipFormatter: (params: unknown) => string;
};

export const TRADE_MARKER_COLORS = {
  buy: '#f87171', // red-400 — 买入/加仓
  sell: '#22c55e', // green-500 — 卖出/减仓
  liquidation: '#fbbf24', // amber-400 — 清仓
  anchor: '#3b82f6', // blue-500 — 锚点(自选)
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
  gradientDirection,
  showArea = true,
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
  areaStyle:
    !showArea || anchorDate
      ? undefined
      : (() => {
        const transparent = isDark ? 'rgba(0,0,0,0)' : 'rgba(255,255,255,0)';
        const isReversed = gradientDirection === 'reversed';
        return {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: isReversed ? transparent : (color as string) },
            { offset: 1, color: isReversed ? (color as string) : transparent },
          ]),
          opacity: 0.2,
        };
      })(),
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

const buildAreaSeries = ({
  data,
  color,
  isLargeSeries,
}: {
  data: Array<number | null>;
  color: string;
  isLargeSeries: boolean;
}): echarts.SeriesOption => ({
  name: '',
  type: 'line',
  data,
  showSymbol: false,
  smooth: true,
  sampling: isLargeSeries ? 'lttb' : undefined,
  progressive: isLargeSeries ? 300 : undefined,
  progressiveThreshold: isLargeSeries ? 500 : undefined,
  lineStyle: { width: 0, opacity: 0 },
  areaStyle: { color, opacity: 0.2 },
  tooltip: { show: false },
  z: 3,
});

export const buildChartOption = ({
  fundName,
  dates,
  fundData,
  positiveAreaData,
  negativeAreaData,
  bmkData,
  markers,
  isLargeSeries,
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
      color: '#f87171',
      anchorDate,
      isDark,
      showArea: false,
    }),
    ...(anchorDate
      ? []
      : [
        buildAreaSeries({ data: positiveAreaData, color: '#f87171', isLargeSeries }),
        buildAreaSeries({ data: negativeAreaData, color: '#34d399', isLargeSeries }),
      ]),
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

export const splitGrowthSeriesAtZero = (
  data: Array<number | null>,
): {
  positive: Array<number | null>;
  negative: Array<number | null>;
} => {
  const n = data.length;
  const positive: Array<number | null> = new Array(n).fill(null);
  const negative: Array<number | null> = new Array(n).fill(null);

  for (let i = 0; i < n; i++) {
    const v = data[i];
    if (v === null || isNaN(v)) continue;
    if (v >= 0) positive[i] = v;
    else negative[i] = v;
  }

  // 在零轴交叉处，选择离 0 更近的索引，将正负两线在该索引的值同时设为 0
  for (let i = 1; i < n; i++) {
    const a = data[i - 1];
    const b = data[i];
    if (a === null || isNaN(a) || b === null || isNaN(b)) continue;
    if ((a >= 0 && b < 0) || (a < 0 && b >= 0)) {
      if (Math.abs(a) <= Math.abs(b)) {
        positive[i - 1] = 0;
        negative[i - 1] = 0;
      } else {
        positive[i] = 0;
        negative[i] = 0;
      }
    }
  }

  return { positive, negative };
};

export const insertZeroCrossings = (
  data: Array<number | null>,
  dates: string[],
): {
  data: Array<number | null>;
  dates: string[];
  insertIndices: number[];
} => {
  if (data.length === 0) return { data: [], dates: [], insertIndices: [] };

  const newData: Array<number | null> = [];
  const newDates: string[] = [];
  const insertIndices: number[] = [];

  for (let i = 0; i < data.length; i++) {
    newData.push(data[i]);
    newDates.push(dates[i]);

    if (i < data.length - 1) {
      const a = data[i];
      const b = data[i + 1];
      if (
        a !== null &&
        b !== null &&
        !isNaN(a) &&
        !isNaN(b) &&
        ((a >= 0 && b < 0) || (a < 0 && b >= 0))
      ) {
        newData.push(0);
        newDates.push('');
        insertIndices.push(newData.length - 1);
      }
    }
  }

  return { data: newData, dates: newDates, insertIndices };
};

export const normalizeGrowthSeriesToFirst = (data: {
  dates: string[];
  fund: number[];
  avg: number[];
  bmk: number[];
}): {
  dates: string[];
  fund: number[];
  avg: number[];
  bmk: number[];
} | null => {
  if (!data.dates.length) return null;

  const rebase = (v: number | undefined | null, base: number): number | null => {
    if (v == null || isNaN(v)) return null;
    if (base === -100) return null;
    return ((100 + v) / (100 + base) - 1) * 100;
  };

  const baseFund = data.fund[0];
  const baseAvg = data.avg[0];
  const baseBmk = data.bmk[0];

  return {
    dates: data.dates,
    fund: data.fund.map((v) => rebase(v, baseFund) ?? 0),
    avg: data.avg.map((v) => rebase(v, baseAvg) ?? 0),
    bmk: data.bmk.map((v) => rebase(v, baseBmk) ?? 0),
  };
};
