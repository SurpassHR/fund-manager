import * as echarts from 'echarts';
import { fetchEastMoneyPingzhongData, withCache } from '../services/api';
import type { Fund } from '../types';

export type TimeRange = '1M' | '3M' | '6M' | '1Y' | 'ALL';

export type TotalAssetsChartDataPoint = {
  date: string;
  totalAssets: number;
  profit: number;
};

const timestampToDateStr = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const computeTimeRangeCutoff = (range: TimeRange): Date => {
  const now = new Date();
  switch (range) {
    case '1M':
      return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    case '3M':
      return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    case '6M':
      return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    case '1Y':
      return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    case 'ALL':
      return new Date(0);
  }
};

export const filterDataByTimeRange = (
  data: TotalAssetsChartDataPoint[],
  range: TimeRange,
): TotalAssetsChartDataPoint[] => {
  if (range === 'ALL') return data;
  const cutoffStr = timestampToDateStr(computeTimeRangeCutoff(range).getTime());
  return data.filter((d) => d.date >= cutoffStr);
};

export const aggregateTotalAssetsHistory = async (
  funds: Fund[],
): Promise<TotalAssetsChartDataPoint[]> => {
  const activeFunds = funds.filter((f) => f.holdingShares > 0);
  if (activeFunds.length === 0) return [];

  const totalCost = activeFunds.reduce((sum, f) => sum + f.holdingShares * f.costPrice, 0);

  const codesKey = activeFunds
    .map((f) => `${f.code}:${f.holdingShares.toFixed(2)}`)
    .sort()
    .join(',');

  return withCache({
    key: `total-assets:${codesKey}`,
    ttlMs: 30 * 60 * 1000,
    fetcher: async () => {
      const promises = activeFunds.map((f) =>
        fetchEastMoneyPingzhongData(f.code).then((result) => ({ fund: f, result })),
      );
      const results = await Promise.all(promises);

      // 为每只基金建立 date → nav 的排序 Map
      const fundNavMaps: Array<{ sortedDates: string[]; navByDate: Map<string, number> }> = [];
      const allDatesSet = new Set<string>();

      for (const { fund, result } of results) {
        const navByDate = new Map<string, number>();
        if (result?.netWorthTrend?.length) {
          for (const point of result.netWorthTrend) {
            const dateStr = timestampToDateStr(point.x);
            navByDate.set(dateStr, point.y);
            allDatesSet.add(dateStr);
          }
        } else {
          console.warn(`无法获取 ${fund.code} ${fund.name} 的历史净值数据`);
        }
        const sortedDates = Array.from(navByDate.keys()).sort();
        fundNavMaps.push({ sortedDates, navByDate });
      }

      if (allDatesSet.size === 0) return [];

      const allDates = Array.from(allDatesSet).sort();

      // 聚合：对每个日期，累加每只基金的持仓市值
      const dataPoints: TotalAssetsChartDataPoint[] = [];

      for (const date of allDates) {
        let totalAssets = 0;
        for (let fi = 0; fi < activeFunds.length; fi++) {
          const fund = activeFunds[fi];
          const { sortedDates, navByDate } = fundNavMaps[fi];

          // 在该基金的日期列表中查找 <= 当前日期的最近日期（前向填充）
          let nav: number | null = null;
          for (let di = sortedDates.length - 1; di >= 0; di--) {
            if (sortedDates[di] <= date) {
              nav = navByDate.get(sortedDates[di]) ?? null;
              break;
            }
          }

          if (nav !== null) {
            totalAssets += fund.holdingShares * nav;
          }
          // 基金尚未成立（当前日期前无 NAV）→ 贡献为 0
        }

        dataPoints.push({
          date,
          totalAssets: Math.round(totalAssets * 100) / 100,
          profit: Math.round((totalAssets - totalCost) * 100) / 100,
        });
      }

      return dataPoints;
    },
  });
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
