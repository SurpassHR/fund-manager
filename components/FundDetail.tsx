import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import type {
  Fund,
  FundPerformanceResponse,
  FundCommonDataResponse,
  EquityHolding,
  MorningstarGrowthDataResponse,
  DanjuanGrowthDataResponse,
} from '../types';
import { Icons } from './Icon';
import { TradeMarkerLegend } from './TradeMarkerLegend';
import {
  TRADE_MARKER_COLORS,
  buildChartOption,
  buildLegendViewModel,
  buildTradeMarkersFromTransactions,
} from './fundDetailChartUtils';
import type { MarkPointDatum } from './fundDetailChartUtils';
import { formatPct, getSignColor, formatSignedCurrency } from '../services/financeUtils';
import { useTranslation } from '../services/i18n';
import { useTheme } from '../services/ThemeContext';
import { resetDragState, useEdgeSwipe } from '../services/useEdgeSwipe';
import { useOverlayRegistration } from '../services/overlayRegistration';
import {
  buildTencentQuoteCodes,
  fetchFundCommonData,
  fetchFundHoldings,
  fetchFundPerformance,
  fetchTencentStockQuotes,
} from '../services/api';
import * as echarts from 'echarts';
import { motion } from 'framer-motion';

interface FundDetailProps {
  fund: Fund;
  anchorDate?: string;
  anchorPrice?: number;
  onBack: () => void;
}

type TimeRange = '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y';

type GrowthSeriesData = {
  dates: string[];
  fund: number[];
  avg: number[];
  bmk: number[];
};

type TooltipSeriesParam = {
  axisValue: string;
  seriesName: string;
  value: number | null;
  color?: string;
};

interface GrowthDataCacheRecord {
  data: GrowthSeriesData;
  cacheDate: string;
  updatedAt: number;
}

const GROWTH_DATA_CACHE_PREFIX = 'growth_data_cache_v1';

// 回退计算上一个交易日（仅跳过周末，不调用外部假日 API）
const getLastWeekday = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() - 1);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
};

const getLocalDateString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeTicker = (ticker?: string) => (ticker ? ticker.replace(/\D/g, '') : '');

// Calculate Start Date based on Range and End Date
const getStartDate = (range: TimeRange, endDateStr: string): string => {
  // Parse as UTC (YYYY-MM-DD is UTC by default in Date constructor)
  const d = new Date(endDateStr);

  // Use UTC methods to ensure we stay on the correct calendar day regardless of local timezone
  switch (range) {
    case '1M':
      d.setUTCMonth(d.getUTCMonth() - 1);
      break;
    case '3M':
      d.setUTCMonth(d.getUTCMonth() - 3);
      break;
    case '6M':
      d.setUTCMonth(d.getUTCMonth() - 6);
      break;
    case '1Y':
      d.setUTCFullYear(d.getUTCFullYear() - 1);
      break;
    case '3Y':
      d.setUTCFullYear(d.getUTCFullYear() - 3);
      break;
    case '5Y':
      d.setUTCFullYear(d.getUTCFullYear() - 5);
      break;
  }

  // ISO string is always UTC, which matches our YYYY-MM-DD need
  return d.toISOString().split('T')[0];
};

const buildGrowthCacheKey = (fundCode: string, range: TimeRange, endDate: string) => {
  const params = {
    growthDataPoint: 'cumulativeReturn',
    freq: '1d',
    type: 'return',
    range,
    endDate,
  };
  return `${GROWTH_DATA_CACHE_PREFIX}:${fundCode}:${JSON.stringify(params)}`;
};

const readGrowthCache = (cacheKey: string): GrowthDataCacheRecord | null => {
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GrowthDataCacheRecord;
    if (!parsed?.data?.dates || !parsed?.data?.fund || !parsed?.cacheDate) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeGrowthCache = (cacheKey: string, data: GrowthSeriesData, cacheDate: string) => {
  try {
    const record: GrowthDataCacheRecord = {
      data,
      cacheDate,
      updatedAt: Date.now(),
    };
    localStorage.setItem(cacheKey, JSON.stringify(record));
  } catch {
    // localStorage 不可用或写满时静默降级
  }
};

const cloneSeriesData = (data: GrowthSeriesData): GrowthSeriesData => ({
  dates: [...data.dates],
  fund: [...data.fund],
  avg: [...data.avg],
  bmk: [...data.bmk],
});

// 历史序列可按天缓存；当天段每次根据实时 dayChangePct 重新覆盖，避免“冻结”
const withTodayEstimate = (
  series: GrowthSeriesData,
  dayChangePct: number | undefined,
): GrowthSeriesData => {
  const next = cloneSeriesData(series);
  if (dayChangePct == null || next.dates.length === 0) return next;

  const now = new Date();
  const dow = now.getDay();
  const isWeekday = dow >= 1 && dow <= 5;
  if (!isWeekday) return next;

  const todayStr = getLocalDateString();
  const lastDate = next.dates[next.dates.length - 1];

  if (lastDate === todayStr) {
    const prevCumReturn = next.fund.length >= 2 ? (next.fund[next.fund.length - 2] ?? 0) : 0;
    next.fund[next.fund.length - 1] = prevCumReturn + dayChangePct;
  } else if (lastDate && todayStr > lastDate) {
    const prevCumReturn = next.fund[next.fund.length - 1] ?? 0;
    next.dates.push(todayStr);
    next.fund.push(prevCumReturn + dayChangePct);
    next.avg.push(next.avg[next.avg.length - 1] ?? 0);
    next.bmk.push(next.bmk[next.bmk.length - 1] ?? 0);
  }

  return next;
};

export const FundDetail: React.FC<FundDetailProps> = ({
  fund,
  anchorDate,
  anchorPrice,
  onBack,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const fundId = fund.id ?? fund.code;
  const overlayId = `fund-detail:${fundId}`;
  const { isDragging, activeOverlayId, setDragState, snapBackX } = useEdgeSwipe();
  const [closeTargetX, setCloseTargetX] = useState<number | null>(null);
  const [isEdgeClosing, setIsEdgeClosing] = useState(false);
  const translateX =
    isDragging && activeOverlayId === overlayId ? 'var(--edge-swipe-drag-x, 0px)' : '0px';
  const snapX = activeOverlayId === overlayId ? snapBackX : null;
  const transformX =
    closeTargetX !== null ? `${closeTargetX}px` : snapX !== null ? `${snapX}px` : translateX;
  const transition = closeTargetX !== null || snapX !== null ? 'transform 220ms ease' : 'none';

  // snap-back animation is driven by App.tsx via snapBackX

  const requestClose = useCallback(
    (payload?: { source?: 'edge-swipe' | 'programmatic'; targetX?: number }) => {
      if (payload?.targetX !== undefined) {
        setCloseTargetX(payload.targetX);
        setIsEdgeClosing(true);
        return;
      }
      onBack();
    },
    [onBack],
  );

  useOverlayRegistration(overlayId, true, requestClose);

  useEffect(() => {
    return () => {
      if (activeOverlayId === overlayId) {
        resetDragState(setDragState);
      }
    };
  }, [activeOverlayId, overlayId, setDragState]);

  // snap-back animation is driven by App.tsx via snapBackX

  // Data States
  const [data, setData] = useState<FundPerformanceResponse['data'] | null>(null);
  const [commonData, setCommonData] = useState<FundCommonDataResponse['data'] | null>(null);
  const [holdings, setHoldings] = useState<EquityHolding[]>([]);
  const [quotes, setQuotes] = useState<Record<string, { price: string; pct: number }>>({});

  // State for the verified last trading day (for header and API queries)
  const [lastTradingDay, setLastTradingDay] = useState<string>('');

  // Chart State
  const [timeRange, setTimeRange] = useState<TimeRange>('1M');
  const [chartReady, setChartReady] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // History Expansion State
  const [showAllHistory, setShowAllHistory] = useState(false);

  // Real Chart Data from API
  const [chartSeriesData, setChartSeriesData] = useState<GrowthSeriesData | null>(null);
  const [chartLoading, setChartLoading] = useState(false);

  useEffect(() => {
    // Reduced timeout to optimize perceived speed while allowing transition
    const timer = setTimeout(() => {
      setChartReady(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // 1. Fetch Common Data (NAV, Date, etc.) - The Authoritative Source
  useEffect(() => {
    const fetchCommon = async () => {
      try {
        const json = await fetchFundCommonData(fund.code);
        if (json?.data) {
          setCommonData(json.data);
          if (json.data.navDate) {
            setLastTradingDay(json.data.navDate);
          }
        }
      } catch (err) {
        console.error('Common Data Fetch Error', err);
      }
    };
    fetchCommon();
  }, [fund.code]);

  // 2. Resolve Verified Last Trading Day (Fallback Logic)
  // Only runs if commonData fetch failed or didn't provide a date
  useEffect(() => {
    if (lastTradingDay) return;

    if (data?.dayEnd?.endDate) {
      setLastTradingDay(data.dayEnd.endDate);
      return;
    }

    // 回退：跳过周末取最近工作日
    const timer = setTimeout(() => {
      if (!lastTradingDay) {
        setLastTradingDay(getLastWeekday());
      }
    }, 1000); // 给 common-data API 1s 的响应时间
    return () => clearTimeout(timer);
  }, [data, lastTradingDay]);

  // 3. Fetch Basic Performance (Stats)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const json = await fetchFundPerformance(fund.code);
        if (json?.data) {
          setData(json.data);
        }
      } catch (err) {
        console.error('Perf Fetch Error', err);
      }
    };
    fetchData();
  }, [fund.code]);

  // 4. Fetch Chart Data (Growth Data)
  useEffect(() => {
    if (!lastTradingDay) return;

    let cancelled = false;

    const fetchMorningstarSeries = async (
      startDate: string,
      endDate: string,
    ): Promise<GrowthSeriesData | null> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      try {
        const body = {
          growthDataPoint: 'cumulativeReturn',
          initValue: 10000,
          freq: '1d',
          calcBmkSecId: 'F00001LXGJ',
          currency: 'CNY',
          type: 'return',
          startDate,
          endDate,
          catAvgSecId: 'CHCA000043',
          bmk1SecId: 'F00001LXGJ',
          outputs: ['tsData', 'pr', 'dividend', 'management'],
        };

        const response = await fetch(
          `https://www.morningstar.cn/cn-api/v2/funds/${fund.code}/growth-data`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal,
          },
        );

        if (!response.ok) return null;
        const json: MorningstarGrowthDataResponse = await response.json();
        if (!json.data?.tsData) return null;

        return {
          dates: [...(json.data.tsData.dates || [])],
          fund: [...(json.data.tsData.funds?.[0] || [])],
          avg: [...(json.data.tsData.catAvg || [])],
          bmk: [...(json.data.tsData.bmk1 || [])],
        };
      } finally {
        clearTimeout(timeoutId);
      }
    };

    const fetchDanjuanSeries = async (): Promise<GrowthSeriesData | null> => {
      const danjuanPeriod = timeRange.toLowerCase();
      const isDev = import.meta.env.DEV;
      const baseUrl = isDev
        ? '/djapi/fund/growth/'
        : 'https://api.codetabs.com/v1/proxy/?quest=https://danjuanfunds.com/djapi/fund/growth/';

      const response = await fetch(`${baseUrl}${fund.code}?day=${danjuanPeriod}`);
      if (!response.ok) return null;

      const json: DanjuanGrowthDataResponse = await response.json();
      if (!json.data?.fund_nav_growth) return null;

      const dates: string[] = [];
      const fundArr: number[] = [];
      const avgArr: number[] = [];
      const bmkArr: number[] = [];

      json.data.fund_nav_growth.forEach((r) => {
        dates.push(r.date);
        fundArr.push(parseFloat(r.value || '0') * 100);
        bmkArr.push(parseFloat(r.than_value || '0') * 100);
        avgArr.push(0);
      });

      return { dates, fund: fundArr, avg: avgArr, bmk: bmkArr };
    };

    const fetchGrowthData = async () => {
      const todayStr = getLocalDateString();
      const startDate = getStartDate(timeRange, lastTradingDay);
      const cacheKey = buildGrowthCacheKey(fund.code, timeRange, lastTradingDay);
      const cached = readGrowthCache(cacheKey);
      const isTodayCache = cached?.cacheDate === todayStr;

      if (isTodayCache && cached) {
        setChartSeriesData(withTodayEstimate(cached.data, fund.dayChangePct));
        return;
      }

      setChartLoading(true);
      try {
        let fetched = await fetchMorningstarSeries(startDate, lastTradingDay);
        if (!fetched) {
          fetched = await fetchDanjuanSeries();
        }

        if (fetched) {
          writeGrowthCache(cacheKey, fetched, todayStr);
          if (!cancelled) {
            setChartSeriesData(withTodayEstimate(fetched, fund.dayChangePct));
          }
          return;
        }

        // 网络失败时，回退到旧缓存（即使不是今天）
        if (cached && !cancelled) {
          setChartSeriesData(withTodayEstimate(cached.data, fund.dayChangePct));
        }
      } catch (err) {
        console.error('Chart Fetch Error', err);
        if (cached && !cancelled) {
          setChartSeriesData(withTodayEstimate(cached.data, fund.dayChangePct));
        }
      } finally {
        if (!cancelled) {
          setChartLoading(false);
        }
      }
    };

    fetchGrowthData();

    return () => {
      cancelled = true;
    };
  }, [fund.code, fund.dayChangePct, timeRange, lastTradingDay]);

  // 5. Fetch Holdings
  useEffect(() => {
    const fetchHoldings = async () => {
      try {
        const json = await fetchFundHoldings(fund.code);
        if (json?.data?.equityHoldings) {
          const equity = json.data.equityHoldings;
          setHoldings(equity);

          const codes = buildTencentQuoteCodes(equity.map((h) => h.ticker));
          if (codes.length > 0) {
            const quoteMap = await fetchTencentStockQuotes(codes);
            const nextQuotes: Record<string, { price: string; pct: number }> = {};
            equity.forEach((holding) => {
              const key = normalizeTicker(holding.ticker);
              if (!key) return;
              const quote = quoteMap[key];
              if (quote) {
                nextQuotes[holding.ticker] = quote;
              }
            });
            setQuotes(nextQuotes);
          } else {
            setQuotes({});
          }
        } else {
          setHoldings([]);
          setQuotes({});
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchHoldings();
  }, [fund.code]);

  // Resolve Display Data
  // Priority: CommonData API -> Performance API -> Local DB
  const currentNav = commonData?.nav ?? data?.dayEnd?.nav ?? fund.currentNav;
  const dayChangePct = commonData?.navChangePercent ?? data?.dayEnd?.changeP ?? fund.dayChangePct;
  const displayDate = commonData?.navDate ?? lastTradingDay ?? fund.lastUpdate;

  // Initialize and Update ECharts
  useEffect(() => {
    if (!chartReady || !chartRef.current || !chartSeriesData) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const {
      dates,
      fund: initialFundData,
      avg: initialAvgData,
      bmk: initialBmkData,
    } = chartSeriesData;
    let fundData = initialFundData;
    let avgData = initialAvgData;
    let bmkData = initialBmkData;

    // Rebase to Anchor Date (0-line shifting) if provided
    if (anchorDate) {
      const anchorIdx = dates.indexOf(anchorDate);
      if (anchorIdx !== -1) {
        const baseFund = fundData[anchorIdx] || 0;
        const baseAvg = avgData[anchorIdx] || 0;
        const baseBmk = bmkData[anchorIdx] || 0;

        const rebase = (v: number | undefined | null, base: number) => {
          if (v == null || isNaN(v)) return null;
          return ((100 + v) / (100 + base) - 1) * 100;
        };

        fundData = fundData.map((v) => rebase(v, baseFund) as number);
        avgData = avgData.map((v) => rebase(v, baseAvg) as number);
        bmkData = bmkData.map((v) => rebase(v, baseBmk) as number);
      }
    }

    const startStr = dates[0];
    const endStr = dates[dates.length - 1];
    const isLargeSeries = dates.length > 260;
    const shouldAnimate = !isLargeSeries;

    const validFundData = fundData.filter((v) => v != null) as number[];
    const fundMin = validFundData.length > 0 ? Math.min(...validFundData) : 0;
    const fundMax = validFundData.length > 0 ? Math.max(...validFundData) : 0;
    const crossesZero = anchorDate ? fundMin < 0 && fundMax > 0 : false;

    // Build line color: if anchor mode + crosses zero, use a gradient that transitions at the zero-point
    // zeroRatio = fraction from top of chart where y=0 falls (gradient goes top→bottom)
    let color: string | echarts.graphic.LinearGradient;
    if (anchorDate && crossesZero) {
      const zeroRatio = fundMax / (fundMax - fundMin); // 0→1 from top
      color = new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: '#f87171' },
        { offset: Math.max(0, zeroRatio - 0.001), color: '#f87171' },
        { offset: Math.min(1, zeroRatio + 0.001), color: '#34d399' },
        { offset: 1, color: '#34d399' },
      ]);
    } else if (anchorDate) {
      color = fundMax <= 0 ? '#34d399' : '#f87171';
    } else {
      const firstVal = fundData[0] || 0;
      const lastVal = fundData[fundData.length - 1] || 0;
      color = lastVal >= firstVal ? '#f87171' : '#34d399';
    }

    const tooltipFormatter = (params: unknown) => {
      if (!Array.isArray(params) || params.length === 0) return '';

      const list = params as TooltipSeriesParam[];
      const date = list[0]?.axisValue;
      if (!date) return '';
      let html = `<div style="font-weight:bold; margin-bottom:4px; font-family:monospace;">${date}</div>`;

      list.forEach((item) => {
        const val = item.value;
        if (val == null) return;
        const sign = val >= 0 ? '+' : '';
        const valColor = val >= 0 ? '#f87171' : '#34d399';

        html += `
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:2px;">
                            <span style="color:${isDark ? '#d1d5db' : '#4b5563'}">${item.seriesName}</span>
                            <span style="color:${valColor}; font-family:monospace; font-weight:600;">${sign}${val.toFixed(2)}%</span>
                        </div>`;
      });
      return html;
    };

    const markers = (() => {
      if (anchorDate) {
        const anchorIdx = dates.indexOf(anchorDate);
        if (anchorIdx === -1) return [];
        return [
          {
            name: 'anchor',
            coord: [anchorDate, fundData[anchorIdx] ?? null] as [string, number | null],
            symbol: 'circle',
            symbolSize: 8,
            label: { show: false },
            itemStyle: { color: TRADE_MARKER_COLORS.anchor },
          },
        ];
      }

      const points: MarkPointDatum[] = [];

      if (fund.buyDate) {
        const buyIdx = dates.indexOf(fund.buyDate);
        if (buyIdx !== -1) {
          points.push({
            name: 'buy',
            coord: [fund.buyDate, fundData[buyIdx] ?? null],
            symbol: 'circle',
            symbolSize: 8,
            label: { show: false },
            itemStyle: { color: TRADE_MARKER_COLORS.buy },
          });
        }
      }

      points.push(
        ...buildTradeMarkersFromTransactions({
          dates,
          fundData,
          transactions: fund.pendingTransactions,
          holdingShares: fund.holdingShares,
        }),
      );
      return points;
    })();

    const option = buildChartOption({
      fundName: fund.name,
      dates,
      fundData: fundData.map((val) => (val == null || isNaN(val) ? null : val)),
      bmkData: bmkData.map((val) => (val == null || isNaN(val) ? null : val)),
      markers,
      isLargeSeries,
      color,
      anchorDate,
      isDark,
      shouldAnimate,
      startStr,
      endStr,
      tooltipFormatter,
    });

    if (chartInstance.current) {
      chartInstance.current.clear(); // Explicitly clear the chart to force a fresh animation
      chartInstance.current.setOption(option);
    }

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [
    anchorDate,
    chartReady,
    chartSeriesData,
    fund.buyDate,
    fund.holdingShares,
    fund.name,
    fund.pendingTransactions,
    isDark,
  ]);

  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []);

  // Derived History Table Data based on Chart Data + Current NAV
  const historyData = useMemo(() => {
    if (!chartSeriesData || !chartSeriesData.dates || chartSeriesData.dates.length === 0) return [];

    const list = [];
    const len = chartSeriesData.dates.length;

    const finalReturn = chartSeriesData.fund[len - 1];

    // Iterate backwards from the end
    for (let i = len - 1; i >= 0; i--) {
      const r = chartSeriesData.fund[i];
      const rPrev = i > 0 ? chartSeriesData.fund[i - 1] : 0;

      // Implied NAV
      const val = currentNav * ((1 + r / 100) / (1 + finalReturn / 100));

      // Daily Change
      let changePct = 0;
      if (i > 0) {
        const vCurrent = 1 + r / 100;
        const vPrev = 1 + rPrev / 100;
        changePct = ((vCurrent - vPrev) / vPrev) * 100;
      }

      list.push({
        date: chartSeriesData.dates[i].substring(5), // YYYY-MM-DD -> MM-DD
        nav: val,
        change: changePct,
      });
    }
    return list;
  }, [chartSeriesData, currentNav]);

  // Add ESC key listener to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack]);

  const ranges: TimeRange[] = ['1M', '3M', '6M', '1Y', '3Y', '5Y'];
  const legendViewModel = useMemo(
    () => buildLegendViewModel({ isWatchlist: Boolean(anchorDate), t }),
    [anchorDate, t],
  );

  // Apply toggle limit
  const displayedHistory = showAllHistory ? historyData : historyData.slice(0, 10);

  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;

  return (
    <motion.div
      className="fixed inset-0 z-[90] overflow-hidden bg-[var(--app-shell-paper)]/96 md:bg-black/35 md:p-4 md:backdrop-blur-sm lg:p-8 dark:bg-[var(--app-shell-paper)]/96 dark:md:bg-black/45"
      onClick={onBack}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={isEdgeClosing ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/*
        关键布局保护：此容器必须保持 `w-full md:flex md:justify-center`。
        原因：外层是 fixed + 桌面端居中弹层，若误删该 class，详情页在桌面端会回退为左贴且视觉变窄。
        请勿随意移除此样式，除非同步验证桌面端详情页宽度与居中行为。
      */}
      <div
        className="flex h-full w-full md:items-start md:justify-center"
        style={{ transform: `translateX(${transformX})`, transition }}
        onTransitionEnd={(event) => {
          if (event.propertyName !== 'transform') return;
          if (closeTargetX !== null) {
            resetDragState(setDragState);
            onBack();
            return;
          }
          if (snapX !== null) {
            resetDragState(setDragState);
          }
        }}
      >
        <motion.div
          className="relative flex h-[100dvh] min-h-0 w-full flex-col overflow-hidden bg-gray-50 dark:bg-app-bg-dark md:h-[calc(100dvh-2rem)] md:w-[min(72rem,calc(100vw-2rem))] md:max-w-[calc(100vw-2rem)] md:rounded-[1.75rem] md:border md:border-[var(--app-shell-line)] md:bg-[var(--app-shell-panel)] md:shadow-[var(--app-shell-shadow)] lg:h-[calc(100dvh-4rem)] lg:w-[min(76rem,calc(100vw-4rem))]"
          onClick={(e) => e.stopPropagation()}
          initial={isDesktop ? { opacity: 0, scale: 0.95, y: 20 } : { opacity: 1, x: '100%' }}
          animate={isDesktop ? { opacity: 1, scale: 1, y: 0 } : { opacity: 1, x: 0 }}
          exit={
            isDesktop
              ? { opacity: 0, scale: 0.95, y: 20 }
              : isEdgeClosing
                ? { opacity: 1, x: 0 }
                : { opacity: 1, x: '100%' }
          }
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        >
          {/* Header */}
          <div className="z-10 flex h-14 shrink-0 items-center justify-between border-b border-[var(--app-shell-line)] bg-[var(--app-shell-panel)]/95 px-4 shadow-[0_8px_20px_rgba(15,23,42,0.06)] backdrop-blur-xl transition-colors">
            <button
              onClick={onBack}
              className="-ml-2 rounded-full p-2 text-[var(--app-shell-muted)] transition-colors hover:bg-[var(--app-shell-panel-strong)] hover:text-[var(--app-shell-ink)]"
            >
              <Icons.ArrowUp className="transform -rotate-90" size={24} />
            </button>
            <div className="text-center max-w-[70%]">
              <h2 className="font-bold text-gray-800 dark:text-gray-100 text-sm truncate">
                {fund.name}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">{fund.code}</p>
            </div>
            <div className="w-10"></div>
          </div>

          <div className="bg-[var(--app-shell-paper)] no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain touch-pan-y">
            {/* Hero Card */}
            <div className="mb-2 rounded-[1.5rem] border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)]/92 p-6 shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition-colors">
              <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">
                {t('common.nav')} ({displayDate})
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold font-sans text-gray-900 dark:text-gray-100">
                  {currentNav.toFixed(4)}
                </span>
                <span className={`text-lg font-medium font-sans ${getSignColor(dayChangePct)}`}>
                  {formatPct(dayChangePct)}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2 text-sm">
                <div className="flex flex-col justify-between rounded-lg border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)]/78 p-2 transition-colors">
                  <div className="mb-1 text-xs text-[var(--app-shell-muted)]">
                    {anchorPrice ? t('common.anchorPrice') : t('common.cost')}
                  </div>
                  <div className="overflow-hidden text-ellipsis text-xs font-sans text-[var(--app-shell-ink)]">
                    {anchorPrice ? anchorPrice.toFixed(4) : fund.costPrice.toFixed(4)}
                  </div>
                </div>
                <div className="flex flex-col justify-between rounded-lg border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)]/78 p-2 transition-colors">
                  <div className="mb-1 text-xs text-[var(--app-shell-muted)]">
                    {anchorDate ? '锚定日' : t('common.shares')}
                  </div>
                  <div className="overflow-hidden text-ellipsis text-xs font-sans text-[var(--app-shell-ink)]">
                    {anchorDate ? anchorDate : fund.holdingShares.toLocaleString()}
                  </div>
                </div>

                {(() => {
                  const totalCost = fund.costPrice * fund.holdingShares;
                  const holdingValue = currentNav * fund.holdingShares;
                  const totalGain = holdingValue - totalCost;
                  const dayGainVal = fund.dayChangeVal;

                  return (
                    <>
                      <div className="flex flex-col justify-between rounded-lg border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)]/78 p-2 transition-colors">
                        <div className="mb-1 text-xs text-[var(--app-shell-muted)]">
                          {anchorPrice ? t('common.anchorGain') : t('common.totalGain')}
                        </div>
                        {anchorPrice ? (
                          <div
                            className={`font-sans font-bold text-xs ${getSignColor(currentNav - anchorPrice)}`}
                          >
                            {formatPct(((currentNav - anchorPrice) / anchorPrice) * 100)}
                          </div>
                        ) : (
                          <div className={`font-sans font-bold text-xs ${getSignColor(totalGain)}`}>
                            {formatSignedCurrency(totalGain)}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col justify-between rounded-lg border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)]/78 p-2 transition-colors">
                        <div className="mb-1 text-xs text-[var(--app-shell-muted)]">
                          {t('common.dayGain')}
                        </div>
                        {anchorPrice ? (
                          <div
                            className={`font-sans font-bold text-xs ${getSignColor(dayChangePct)}`}
                          >
                            {formatPct(dayChangePct)}
                          </div>
                        ) : (
                          <div
                            className={`font-sans font-bold text-xs ${getSignColor(dayGainVal)}`}
                          >
                            {formatSignedCurrency(dayGainVal)}
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* ECharts Section */}
            <div className="mb-2 rounded-[1.5rem] border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)]/92 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm border-l-4 border-blue-500 pl-2">
                  累计收益走势
                </h3>
                <div className="flex rounded-lg bg-[var(--app-shell-panel-strong)] p-0.5 transition-colors">
                  {ranges.map((range) => (
                    <button
                      key={range}
                      onClick={() => setTimeRange(range)}
                      className={`px-2 py-1 text-[10px] rounded-md font-medium transition-all ${
                        timeRange === range
                          ? 'bg-white dark:bg-card-dark text-blue-600 shadow-sm'
                          : 'text-[var(--app-shell-muted)] hover:text-[var(--app-shell-ink)]'
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-3">
                <TradeMarkerLegend mode={legendViewModel.mode} labels={legendViewModel.labels} />
              </div>

              <div className="relative w-full h-64">
                {/* ECharts Container (Always mounted to preserve ECharts instance) */}
                <div
                  ref={chartRef}
                  className={`w-full h-full transition-opacity duration-300 ${chartReady && !chartLoading && lastTradingDay ? 'opacity-100' : 'opacity-0'}`}
                />

                {/* Loading / Placeholder Overlay */}
                {(!chartReady || chartLoading || !lastTradingDay) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-white/5 rounded transition-colors z-10">
                    <Icons.Refresh className="animate-spin text-gray-300" size={24} />
                  </div>
                )}
              </div>
            </div>

            {/* Historical Data Grid (Performance Summary) */}
            {data ? (
              <div className="mb-2 rounded-[1.5rem] border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)]/92 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition-colors">
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: '近6月', val: data.dayEnd?.returns?.YTD },
                    { label: '近1年', val: data.dayEnd?.returns?.Y1 },
                    { label: '近3年', val: data.dayEnd?.returns?.Y3 },
                    { label: '成立来', val: data.dayEnd?.returns?.sinceInception },
                  ].map((item, idx) => (
                    <div key={idx} className="flex flex-col gap-1 py-1 rounded">
                      <span className="text-xs text-gray-400 mb-1">{item.label}</span>
                      <span
                        className={`font-sans font-bold text-sm ${getSignColor(item.val || 0)}`}
                      >
                        {item.val ? formatPct(item.val) : '--'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* History NAV Table */}
            <div className="mb-2 rounded-[1.5rem] border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)]/92 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition-colors">
              <div className="flex items-center justify-between mb-4 border-l-4 border-blue-500 pl-2">
                <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm">
                  {t('common.historyNav')}
                </h3>
                <button
                  onClick={() => setShowAllHistory(!showAllHistory)}
                  className="flex items-center text-xs text-[var(--app-shell-muted)] transition-colors hover:text-[var(--app-shell-accent)]"
                >
                  {showAllHistory ? '收起' : t('common.more')}
                  <Icons.ArrowUp
                    className={`transform ml-0.5 transition-transform ${showAllHistory ? '' : 'rotate-180'}`}
                    size={12}
                  />
                </button>
              </div>

              <div className="space-y-0">
                <div className="grid grid-cols-4 gap-2 text-xs text-gray-400 pb-3">
                  <div className="text-left pl-2">{t('common.date')}</div>
                  <div className="text-center">{t('common.unitNav')}</div>
                  <div className="text-center">{t('common.accNav')}</div>
                  <div className="text-right pr-2">{t('common.dayChgPct')}</div>
                </div>

                {displayedHistory.length > 0 ? (
                  displayedHistory.map((item, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-4 gap-2 py-3 border-t border-gray-50 dark:border-border-dark items-center text-sm transition-colors"
                    >
                      <div className="text-left pl-2 text-gray-600 dark:text-gray-400 font-medium font-sans">
                        {item.date}
                      </div>
                      <div className="text-center text-gray-800 dark:text-gray-200 font-sans">
                        {item.nav.toFixed(4)}
                      </div>
                      {/* Using derived nav for accumulated as well, since chart is adjusted returns */}
                      <div className="text-center text-gray-800 dark:text-gray-200 font-sans">
                        {item.nav.toFixed(4)}
                      </div>
                      <div
                        className={`text-right pr-2 font-sans font-medium ${getSignColor(item.change)}`}
                      >
                        {formatPct(item.change)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-4 text-center text-gray-300 text-xs">Loading history...</div>
                )}
              </div>
            </div>

            {/* Holdings Section */}
            {holdings.length > 0 && (
              <div className="mb-2 rounded-[1.5rem] border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)]/92 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition-colors">
                <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm mb-4 border-l-4 border-blue-500 pl-2">
                  持仓明细{' '}
                  <span className="text-xs text-gray-400 font-normal ml-1">(实时估算)</span>
                </h3>

                <div className="space-y-0">
                  {/* Table Header */}
                  <div className="grid grid-cols-10 gap-2 text-xs text-gray-400 pb-2 border-b border-gray-50 dark:border-border-dark">
                    <div className="col-span-4 pl-1">股票名称</div>
                    <div className="col-span-3 text-right">最新价/涨跌</div>
                    <div className="col-span-3 text-right pr-1">持仓占比</div>
                  </div>

                  {/* List */}
                  {holdings.map((stock, idx) => {
                    const quote = quotes[stock.ticker];
                    const price = quote ? quote.price : '--';
                    const pct = quote ? quote.pct : 0;
                    const hasQuote = !!quote;

                    return (
                      <div
                        key={idx}
                        className="grid grid-cols-10 items-center gap-2 border-b border-gray-50 py-3 transition-colors last:border-0 hover:bg-[var(--app-shell-panel-strong)]/70 dark:border-border-dark"
                      >
                        <div className="col-span-4 pl-1">
                          <div className="font-medium text-gray-800 dark:text-gray-200 text-sm truncate">
                            {stock.name}
                          </div>
                          <div className="text-xs text-gray-400 font-sans">{stock.ticker}</div>
                        </div>
                        <div className="col-span-3 text-right">
                          <div className="font-sans text-sm text-gray-800 dark:text-gray-200">
                            {price}
                          </div>
                          {hasQuote && (
                            <div className={`text-xs font-sans font-medium ${getSignColor(pct)}`}>
                              {formatPct(pct)}
                            </div>
                          )}
                        </div>
                        <div className="col-span-3 text-right pr-1">
                          <div className="font-sans text-gray-800 dark:text-gray-200 font-medium">
                            {stock.weight.toFixed(2)}%
                          </div>
                          {/* Simple visual bar for weight */}
                          <div className="w-full bg-gray-100 dark:bg-white/10 h-1 mt-1 rounded-full overflow-hidden flex justify-end">
                            <div
                              className="bg-blue-200 dark:bg-blue-800 h-full"
                              style={{ width: `${Math.min(stock.weight * 5, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Annual Returns Table */}
            {data && data.annual && (
              <div className="rounded-[1.5rem] border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)]/92 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition-colors">
                <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm mb-4 border-l-4 border-blue-500 pl-2">
                  年度回报
                </h3>
                <div className="space-y-3">
                  {data.annual.returns
                    ?.slice()
                    .reverse()
                    .map((item) => (
                      <div
                        key={item.k}
                        className="flex justify-between items-center text-sm border-b border-gray-50 dark:border-border-dark pb-2 last:border-0"
                      >
                        <span className="text-gray-600 dark:text-gray-400 font-sans">
                          {item.k}年
                        </span>
                        <span className={`font-sans font-medium ${getSignColor(item.v)}`}>
                          {formatPct(item.v)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Scrollable Area End Marker */}
            <div className="pt-4 pb-6 w-full flex items-center justify-center text-xs text-gray-400 dark:text-gray-500 font-sans">
              - 到底啦 -
            </div>
          </div>

          {/* Fixed Footer Bar */}
          <div className="z-10 flex h-14 shrink-0 items-center justify-center border-t border-[var(--app-shell-line)] bg-[var(--app-shell-panel)]/95 px-4 shadow-[0_-1px_8px_rgba(15,23,42,0.06)] backdrop-blur-xl transition-colors">
            <span className="text-xs text-gray-400 dark:text-gray-500 font-sans">
              数据仅供参考，不构成投资建议
            </span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};
