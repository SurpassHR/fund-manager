import * as echarts from 'echarts';
import type { TotalAssetsSnapshot } from '../types';

export type TimeRange = '1M' | '3M' | '6M' | '1Y' | 'ALL';

export type TotalAssetsChartDataPoint = {
  date: string;
  totalAssets: number;
  profit: number;
};

export const computeTimeRangeCutoff = (range: TimeRange): string => {
  const now = new Date();
  let cutoff: Date;
  switch (range) {
    case '1M':
      cutoff = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      break;
    case '3M':
      cutoff = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      break;
    case '6M':
      cutoff = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      break;
    case '1Y':
      cutoff = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      break;
    case 'ALL':
      return '0000-01-01';
  }
  return `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
};

export const filterDataByTimeRange = (
  data: TotalAssetsChartDataPoint[],
  range: TimeRange,
): TotalAssetsChartDataPoint[] => {
  if (range === 'ALL') return data;
  const cutoffStr = computeTimeRangeCutoff(range);
  return data.filter((d) => d.date >= cutoffStr);
};

/** 将 DB 快照转换为图表数据点（profit = holdingGain） */
export const snapshotsToChartData = (
  snapshots: TotalAssetsSnapshot[],
): TotalAssetsChartDataPoint[] => {
  return snapshots.map((s) => ({
    date: s.date,
    totalAssets: s.totalAssets,
    profit: s.holdingGain,
  }));
};

export const rebaseDataToFirstValue = (
  data: TotalAssetsChartDataPoint[],
): {
  dates: string[];
  values: number[];
} => {
  if (data.length === 0) return { dates: [], values: [] };
  const base = data[0].totalAssets;
  const dates = data.map((d) => d.date);
  const values = data.map((d) =>
    base > 0 ? Math.round((d.totalAssets / base - 1) * 100 * 100) / 100 : 0,
  );
  return { dates, values };
};

// === 图表 Option 构建器 ===

export type AssetsChartDataPoint = {
  value: number;
  totalAssets: number;
  profit: number;
};

type BuildTotalAssetsChartOptionParams = {
  data: AssetsChartDataPoint[];
  dates: string[];
  isDark: boolean;
  isLargeSeries: boolean;
};

export const buildTotalAssetsChartOption = ({
  data,
  dates,
  isDark,
  isLargeSeries,
}: BuildTotalAssetsChartOptionParams): echarts.EChartsOption => {
  const startStr = dates[0] ?? '';
  const endStr = dates[dates.length - 1] ?? '';

  return {
    title: {
      text: dates.length > 0 ? `${startStr} 至 ${endStr}` : '',
      left: '0%',
      top: '0%',
      textStyle: { fontSize: 12, color: isDark ? '#9ca3af' : '#666', fontWeight: 'normal' },
    },
    animation: !isLargeSeries,
    animationDuration: !isLargeSeries ? 300 : 0,
    animationEasing: 'cubicOut',
    backgroundColor: 'transparent',
    grid: { left: 20, right: 10, bottom: 30, top: 30, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        label: { backgroundColor: isDark ? '#374151' : '#6b7280', fontFamily: 'monospace' },
        crossStyle: { color: '#9ca3af', type: 'dashed' },
      },
      backgroundColor: isDark ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      borderColor: isDark ? '#374151' : '#eee',
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: isDark ? '#f3f4f6' : '#333', fontSize: 12 },
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
        lineStyle: { color: isDark ? '#374151' : '#f3f4f6', type: 'dashed', width: 1 },
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
      {
        name: '总资产',
        type: 'line',
        data,
        showSymbol: false,
        symbol: 'circle',
        symbolSize: 6,
        smooth: true,
        sampling: isLargeSeries ? 'lttb' : undefined,
        progressive: isLargeSeries ? 300 : undefined,
        progressiveThreshold: isLargeSeries ? 500 : undefined,
        lineStyle: { width: 2, color: '#f87171' },
        itemStyle: { color: '#f87171', borderColor: '#fff', borderWidth: 1 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: isDark ? 'rgba(0,0,0,0)' : 'rgba(255,255,255,0)' },
            { offset: 1, color: '#f87171' },
          ]),
          opacity: 0.15,
        },
        z: 3,
      },
    ],
  };
};

export type ProfitChartDataPoint = {
  value: number;
  label: string;
};

type BuildProfitChartOptionParams = {
  dates: string[];
  profitValues: number[];
  positiveAreaData: Array<number | null>;
  negativeAreaData: Array<number | null>;
  isDark: boolean;
  isLargeSeries: boolean;
};

export const buildProfitChartOption = ({
  dates,
  profitValues,
  positiveAreaData,
  negativeAreaData,
  isDark,
  isLargeSeries,
}: BuildProfitChartOptionParams): echarts.EChartsOption => {
  const startStr = dates[0] ?? '';
  const endStr = dates[dates.length - 1] ?? '';

  return {
    title: {
      text: dates.length > 0 ? `${startStr} 至 ${endStr}` : '',
      left: '0%',
      top: '0%',
      textStyle: { fontSize: 12, color: isDark ? '#9ca3af' : '#666', fontWeight: 'normal' },
    },
    animation: !isLargeSeries,
    animationDuration: !isLargeSeries ? 300 : 0,
    animationEasing: 'cubicOut',
    backgroundColor: 'transparent',
    grid: { left: 20, right: 10, bottom: 30, top: 30, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        label: { backgroundColor: isDark ? '#374151' : '#6b7280', fontFamily: 'monospace' },
        crossStyle: { color: '#9ca3af', type: 'dashed' },
      },
      backgroundColor: isDark ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      borderColor: isDark ? '#374151' : '#eee',
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: isDark ? '#f3f4f6' : '#333', fontSize: 12 },
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
        lineStyle: { color: isDark ? '#374151' : '#f3f4f6', type: 'dashed', width: 1 },
      },
      axisLabel: {
        show: true,
        inside: false,
        color: isDark ? '#9ca3af' : '#9ca3af',
        fontSize: 10,
        formatter: (val: number) => {
          const abs = Math.abs(val);
          if (abs >= 1e6) return `${(val / 1e6).toFixed(1)}M`;
          if (abs >= 1e4) return `${(val / 1e4).toFixed(1)}万`;
          return `${val.toFixed(0)}`;
        },
      },
    },
    series: [
      {
        name: '收益',
        type: 'line',
        data: profitValues,
        showSymbol: false,
        symbol: 'circle',
        symbolSize: 6,
        smooth: true,
        sampling: isLargeSeries ? 'lttb' : undefined,
        progressive: isLargeSeries ? 300 : undefined,
        progressiveThreshold: isLargeSeries ? 500 : undefined,
        lineStyle: { width: 2, color: '#f87171' },
        itemStyle: { color: '#f87171', borderColor: '#fff', borderWidth: 1 },
        z: 3,
        markLine: {
          silent: true,
          symbol: 'none',
          label: {
            show: true,
            position: 'insideEndTop',
            formatter: '零轴',
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
        },
      },
      {
        name: '',
        type: 'line',
        data: positiveAreaData,
        showSymbol: false,
        smooth: true,
        sampling: isLargeSeries ? 'lttb' : undefined,
        progressive: isLargeSeries ? 300 : undefined,
        progressiveThreshold: isLargeSeries ? 500 : undefined,
        lineStyle: { width: 0, opacity: 0 },
        areaStyle: { color: '#f87171', opacity: 0.2 },
        tooltip: { show: false },
        z: 2,
      },
      {
        name: '',
        type: 'line',
        data: negativeAreaData,
        showSymbol: false,
        smooth: true,
        sampling: isLargeSeries ? 'lttb' : undefined,
        progressive: isLargeSeries ? 300 : undefined,
        progressiveThreshold: isLargeSeries ? 500 : undefined,
        lineStyle: { width: 0, opacity: 0 },
        areaStyle: { color: '#34d399', opacity: 0.2 },
        tooltip: { show: false },
        z: 2,
      },
    ],
  };
};
