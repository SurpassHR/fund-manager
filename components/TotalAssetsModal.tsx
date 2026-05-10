import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { ModalShell } from './ModalShell';
import { Icons } from './Icon';
import { useTheme } from '../services/ThemeContext';
import type { Fund } from '../types';
import {
  aggregateTotalAssetsHistory,
  filterDataByTimeRange,
  rebaseDataToFirstValue,
  buildTotalAssetsChartOption,
  buildProfitChartOption,
  type TimeRange,
  type TotalAssetsChartDataPoint,
} from '../utils/totalAssetsChartUtils';
import { splitGrowthSeriesAtZero } from './fundDetailChartUtils';

interface TotalAssetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  funds: Fund[];
}

export const TotalAssetsModal: React.FC<TotalAssetsModalProps> = ({ isOpen, onClose, funds }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allData, setAllData] = useState<TotalAssetsChartDataPoint[] | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('1Y');
  const [chartReady, setChartReady] = useState(false);

  const assetsChartRef = useRef<HTMLDivElement>(null);
  const profitChartRef = useRef<HTMLDivElement>(null);
  const assetsChartInstance = useRef<echarts.ECharts | null>(null);
  const profitChartInstance = useRef<echarts.ECharts | null>(null);

  // 延迟初始化，确保 DOM ref 就位
  useEffect(() => {
    const timer = setTimeout(() => setChartReady(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // 数据获取
  useEffect(() => {
    if (!isOpen || funds.length === 0) return;
    setLoading(true);
    setError(null);
    aggregateTotalAssetsHistory(funds)
      .then((data) => {
        setAllData(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        console.error('Failed to aggregate total assets history', err);
        setError('加载失败，请稍后重试');
        setLoading(false);
      });
  }, [isOpen, funds]);

  // 图表渲染
  useEffect(() => {
    if (!chartReady || !allData) return;
    if (typeof window !== 'undefined' && /jsdom/i.test(window.navigator.userAgent)) return;
    if (!assetsChartRef.current || !profitChartRef.current) return;

    const filtered = filterDataByTimeRange(allData, timeRange);
    if (filtered.length === 0) return;

    const isLargeSeries = filtered.length > 260;
    const { dates, values } = rebaseDataToFirstValue(filtered);

    // 总资产图表
    const assetsDataPoints = filtered.map((d, i) => ({
      value: values[i],
      totalAssets: d.totalAssets,
      profit: d.profit,
    }));

    if (!assetsChartInstance.current) {
      assetsChartInstance.current = echarts.init(assetsChartRef.current);
    }
    assetsChartInstance.current.setOption(
      buildTotalAssetsChartOption({
        data: assetsDataPoints,
        dates,
        isDark,
        isLargeSeries,
      }),
      { notMerge: true },
    );

    // 收益图表
    const profitValues = filtered.map((d) => d.profit);
    const { positive: positiveArea, negative: negativeArea } =
      splitGrowthSeriesAtZero(profitValues);

    if (!profitChartInstance.current) {
      profitChartInstance.current = echarts.init(profitChartRef.current);
    }
    profitChartInstance.current.setOption(
      buildProfitChartOption({
        dates: filtered.map((d) => d.date),
        profitValues,
        positiveAreaData: positiveArea,
        negativeAreaData: negativeArea,
        isDark,
        isLargeSeries,
      }),
      { notMerge: true },
    );
  }, [chartReady, allData, timeRange, isDark]);

  // 窗口 resize
  useEffect(() => {
    if (!chartReady) return;
    const handler = () => {
      assetsChartInstance.current?.resize();
      profitChartInstance.current?.resize();
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [chartReady]);

  // 关闭时 dispose 图表并重置状态
  useEffect(() => {
    if (!isOpen) {
      assetsChartInstance.current?.dispose();
      assetsChartInstance.current = null;
      profitChartInstance.current?.dispose();
      profitChartInstance.current = null;
      setAllData(null);
      setError(null);
      setTimeRange('1Y');
    }
  }, [isOpen]);

  // unmount cleanup
  useEffect(() => {
    return () => {
      assetsChartInstance.current?.dispose();
      profitChartInstance.current?.dispose();
    };
  }, []);

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      overlayId="total-assets-modal"
      className="rounded-t-2xl sm:rounded-xl w-full h-[85vh] sm:h-auto sm:max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[90vh]"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-3 shrink-0">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-gray-50">总资产走势</h2>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">历史总资产与收益曲线</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          aria-label="关闭"
        >
          <Icons.X size={18} />
        </button>
      </div>

      {/* 时间范围选择器 */}
      <div className="flex gap-2 px-6 pb-3 shrink-0">
        {(['1M', '3M', '6M', '1Y', 'ALL'] as TimeRange[]).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              timeRange === range
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-white/20'
            }`}
          >
            {range}
          </button>
        ))}
      </div>

      {/* 图表区域 */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6">
        {loading && (
          <div className="flex items-center justify-center h-40 text-slate-400">
            <Icons.Refresh className="animate-spin" size={20} />
            <span className="ml-2 text-sm">加载中...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-40 text-red-500">
            <span className="text-sm">{error}</span>
          </div>
        )}

        {!loading && !error && allData && allData.length === 0 && (
          <div className="flex items-center justify-center h-40 text-slate-400">
            <span className="text-sm">暂无数据</span>
          </div>
        )}

        {!loading && !error && allData && allData.length > 0 && (
          <>
            <div>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-300 mb-2">
                总资产
              </h3>
              <div ref={assetsChartRef} className="w-full h-64" />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-300 mb-2">收益</h3>
              <div ref={profitChartRef} className="w-full h-64" />
            </div>
          </>
        )}
      </div>
    </ModalShell>
  );
};
