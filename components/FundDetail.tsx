import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Fund, FundPerformanceResponse, FundCommonDataResponse, FundHoldingsResponse, EquityHolding, FundGrowthDataResponse } from '../types';
import { Icons } from './Icon';
import { formatCurrency, formatPct, getSignColor } from '../services/financeUtils';
import { useTranslation } from '../services/i18n';
import { useTheme } from '../services/ThemeContext';
import * as echarts from 'echarts';

interface FundDetailProps {
    fund: Fund;
    onBack: () => void;
}

type TimeRange = '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y';

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

// Calculate Start Date based on Range and End Date
const getStartDate = (range: TimeRange, endDateStr: string): string => {
    // Parse as UTC (YYYY-MM-DD is UTC by default in Date constructor)
    const d = new Date(endDateStr);

    // Use UTC methods to ensure we stay on the correct calendar day regardless of local timezone
    switch (range) {
        case '1M': d.setUTCMonth(d.getUTCMonth() - 1); break;
        case '3M': d.setUTCMonth(d.getUTCMonth() - 3); break;
        case '6M': d.setUTCMonth(d.getUTCMonth() - 6); break;
        case '1Y': d.setUTCFullYear(d.getUTCFullYear() - 1); break;
        case '3Y': d.setUTCFullYear(d.getUTCFullYear() - 3); break;
        case '5Y': d.setUTCFullYear(d.getUTCFullYear() - 5); break;
    }

    // ISO string is always UTC, which matches our YYYY-MM-DD need
    return d.toISOString().split('T')[0];
};

export const FundDetail: React.FC<FundDetailProps> = ({ fund, onBack }) => {
    const { t } = useTranslation();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

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
    const [chartSeriesData, setChartSeriesData] = useState<{
        dates: string[];
        fund: number[];
        avg: number[];
        bmk: number[];
    } | null>(null);
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
                const response = await fetch(`https://www.morningstar.cn/cn-api/v2/funds/${fund.code}/common-data`);
                if (!response.ok) throw new Error('Failed to fetch common data');
                const json: FundCommonDataResponse = await response.json();
                if (json.data) {
                    setCommonData(json.data);
                    // Use the API's NAV date as the last trading day for charts
                    if (json.data.navDate) {
                        setLastTradingDay(json.data.navDate);
                    }
                }
            } catch (err) {
                console.error("Common Data Fetch Error", err);
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
                const response = await fetch(`https://www.morningstar.cn/cn-api/v2/funds/${fund.code}/performance`);
                if (!response.ok) throw new Error('Failed to fetch data');
                const json: FundPerformanceResponse = await response.json();
                setData(json.data);
            } catch (err) {
                console.error("Perf Fetch Error", err);
            }
        };
        fetchData();
    }, [fund.code]);

    // 4. Fetch Chart Data (Growth Data)
    useEffect(() => {
        if (!lastTradingDay) return;

        const fetchGrowthData = async () => {
            setChartLoading(true);
            try {
                const startDate = getStartDate(timeRange, lastTradingDay);
                const endDate = lastTradingDay;

                const body = {
                    growthDataPoint: "cumulativeReturn",
                    initValue: 10000,
                    freq: "1d",
                    calcBmkSecId: "F00001LXGJ",
                    currency: "CNY",
                    type: "return",
                    startDate: startDate,
                    endDate: endDate,
                    catAvgSecId: "CHCA000043",
                    bmk1SecId: "F00001LXGJ",
                    outputs: ["tsData", "pr", "dividend", "management"]
                };

                const response = await fetch(`https://www.morningstar.cn/cn-api/v2/funds/${fund.code}/growth-data`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });

                if (!response.ok) throw new Error('Failed to fetch growth data');

                const json: FundGrowthDataResponse = await response.json();
                if (json.data && json.data.tsData) {
                    setChartSeriesData({
                        dates: json.data.tsData.dates,
                        fund: json.data.tsData.funds[0] || [],
                        avg: json.data.tsData.catAvg || [],
                        bmk: json.data.tsData.bmk1 || []
                    });
                }
            } catch (err) {
                console.error("Chart Fetch Error", err);
            } finally {
                setChartLoading(false);
            }
        };

        fetchGrowthData();
    }, [fund.code, timeRange, lastTradingDay]);


    // 5. Fetch Holdings
    useEffect(() => {
        const fetchHoldings = async () => {
            try {
                const response = await fetch(`https://www.morningstar.cn/cn-api/v2/funds/${fund.code}/holdings`);
                if (!response.ok) throw new Error('Failed to fetch holdings');
                const json: FundHoldingsResponse = await response.json();

                if (json.data && json.data.equityHoldings) {
                    const equity = json.data.equityHoldings;
                    setHoldings(equity);

                    // Fetch quotes logic...
                    const codes = equity.map(h => {
                        const c = h.ticker;
                        if (!c) return null;
                        if (c.length === 5) return `hk${c}`;
                        if (c.length === 6) {
                            if (c.startsWith('6')) return `sh${c}`;
                            if (c.startsWith('0') || c.startsWith('3')) return `sz${c}`;
                            if (c.startsWith('83') || c.startsWith('87') || c.startsWith('43')) return `bj${c}`;
                        }
                        return null;
                    }).filter(Boolean);

                    if (codes.length > 0) {
                        const qtUrl = `https://qt.gtimg.cn/q=${codes.map(c => `s_${c}`).join(',')}`;
                        const qRes = await fetch(qtUrl);
                        const qText = await qRes.text();

                        const quoteMap: Record<string, { price: string; pct: number }> = {};
                        qText.split(';').forEach(line => {
                            if (line.includes('=')) {
                                const rightSide = line.split('=')[1].replace(/"/g, '');
                                const parts = rightSide.split('~');
                                if (parts.length > 5) {
                                    const ticker = parts[2];
                                    const price = parts[3];
                                    const pct = parseFloat(parts[5]);
                                    quoteMap[ticker] = { price, pct };
                                }
                            }
                        });
                        setQuotes(quoteMap);
                    }
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

        const { dates, fund: fundData, avg: avgData, bmk: bmkData } = chartSeriesData;
        const startStr = dates[0];
        const endStr = dates[dates.length - 1];

        const option: echarts.EChartsOption = {
            animation: false, // Disable animation for snappy switches
            backgroundColor: 'transparent',
            title: {
                text: `${startStr} 至 ${endStr}`,
                left: '0%',
                top: '0%',
                textStyle: { fontSize: 12, color: isDark ? '#9ca3af' : '#666', fontWeight: 'normal' }
            },
            tooltip: {
                trigger: 'axis',
                backgroundColor: isDark ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                borderColor: isDark ? '#374151' : '#eee',
                borderWidth: 1,
                textStyle: { color: isDark ? '#f3f4f6' : '#333', fontSize: 12 },
                axisPointer: { type: 'line', lineStyle: { color: '#999', type: 'dashed' } },
                formatter: (params: any) => {
                    let html = `<div style="font-weight:bold; margin-bottom:4px;">${params[0].axisValue}</div>`;
                    params.forEach((item: any) => {
                        const color = item.color;
                        const name = item.seriesName;
                        const value = item.value;
                        const sign = value >= 0 ? '+' : '';
                        const valColor = value >= 0 ? '#f63c3d' : '#1aaa0d';
                        html += `
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:2px;">
                        <div style="display:flex; align-items:center;">
                            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background-color:${color};margin-right:6px;"></span>
                            <span style="color:#666;">${name}</span>
                        </div>
                        <span style="color:${valColor}; font-family:monospace; font-weight:500;">${sign}${value}%</span>
                    </div>`;
                    });
                    return html;
                }
            },
            legend: {
                data: [fund.name.substring(0, 6) + '...', '同类平均', '业绩基准'],
                bottom: '0%',
                icon: 'circle',
                itemWidth: 8,
                itemHeight: 8,
                textStyle: { fontSize: 10, color: isDark ? '#9ca3af' : '#666' }
            },
            grid: { left: '2%', right: '4%', bottom: '12%', top: '10%', containLabel: true },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: dates,
                axisLine: { show: false },
                axisTick: { show: false },
                axisLabel: {
                    color: isDark ? '#9ca3af' : '#999',
                    fontSize: 10,
                    formatter: (value: string) => value.substring(5)
                }
            },
            yAxis: {
                type: 'value',
                axisLabel: { formatter: '{value}%', color: isDark ? '#9ca3af' : '#999', fontSize: 10 },
                splitLine: { lineStyle: { color: isDark ? '#374151' : '#f3f4f6' } }
            },
            series: [
                {
                    name: fund.name.substring(0, 6) + '...',
                    type: 'line',
                    data: fundData,
                    showSymbol: false,
                    lineStyle: { width: 2, color: '#2c68ff' },
                    itemStyle: { color: '#2c68ff' },
                    z: 3
                },
                {
                    name: '同类平均',
                    type: 'line',
                    data: avgData,
                    showSymbol: false,
                    lineStyle: { width: 1.5, color: '#c23531' },
                    itemStyle: { color: '#c23531' },
                    z: 2
                },
                {
                    name: '业绩基准',
                    type: 'line',
                    data: bmkData,
                    showSymbol: false,
                    lineStyle: { width: 1.5, color: '#fbc02d' },
                    itemStyle: { color: '#fbc02d' },
                    z: 1
                }
            ]
        };

        chartInstance.current.setOption(option);
        const handleResize = () => chartInstance.current?.resize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [chartReady, chartSeriesData, fund.name, isDark]);

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
                change: changePct
            });
        }
        return list;
    }, [chartSeriesData, currentNav]);

    const ranges: TimeRange[] = ['1M', '3M', '6M', '1Y', '3Y', '5Y'];

    // Apply toggle limit
    const displayedHistory = showAllHistory ? historyData : historyData.slice(0, 10);

    return (
        <div className="fixed inset-0 z-50 bg-gray-50 dark:bg-app-bg-dark flex flex-col animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="bg-white dark:bg-card-dark px-4 h-14 flex items-center justify-between shadow-sm dark:border-b dark:border-border-dark flex-shrink-0 z-10 transition-colors">
                <button onClick={onBack} className="p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors">
                    <Icons.ArrowUp className="transform -rotate-90" size={24} />
                </button>
                <div className="text-center max-w-[70%]">
                    <h2 className="font-bold text-gray-800 dark:text-gray-100 text-sm truncate">{fund.name}</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{fund.code}</p>
                </div>
                <div className="w-10"></div>
            </div>

            <div className="flex-1 overflow-y-auto pb-20 no-scrollbar">
                {/* Hero Card */}
                <div className="bg-white dark:bg-card-dark p-6 mb-2 transition-colors">
                    <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">{t('common.nav')} ({displayDate})</div>
                    <div className="flex items-baseline gap-3">
                        <span className="text-3xl font-bold font-mono text-gray-900 dark:text-gray-100">{currentNav.toFixed(4)}</span>
                        <span className={`text-lg font-medium font-mono ${getSignColor(dayChangePct)}`}>
                            {formatPct(dayChangePct)}
                        </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                        <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-lg transition-colors">
                            <div className="text-gray-400 text-xs mb-1">{t('common.cost')}</div>
                            <div className="font-mono dark:text-gray-200">{fund.costPrice.toFixed(4)}</div>
                        </div>
                        <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-lg transition-colors">
                            <div className="text-gray-400 text-xs mb-1">{t('common.shares')}</div>
                            <div className="font-mono dark:text-gray-200">{fund.holdingShares.toLocaleString()}</div>
                        </div>
                    </div>
                </div>

                {/* ECharts Section */}
                <div className="bg-white dark:bg-card-dark p-4 mb-2 transition-colors">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm border-l-4 border-blue-500 pl-2">累计收益走势</h3>
                        <div className="flex bg-gray-100 dark:bg-white/10 rounded-lg p-0.5 transition-colors">
                            {ranges.map(range => (
                                <button
                                    key={range}
                                    onClick={() => setTimeRange(range)}
                                    className={`px-2 py-1 text-[10px] rounded-md font-medium transition-all ${timeRange === range
                                        ? 'bg-white dark:bg-card-dark text-blue-600 shadow-sm'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                        }`}
                                >
                                    {range}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="relative w-full h-64">
                        {/* Ensure spinner shows if we don't have a verified date OR if chart data is loading */}
                        {chartReady && !chartLoading && lastTradingDay ? (
                            <div ref={chartRef} className="w-full h-full" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-white/5 rounded transition-colors">
                                <Icons.Refresh className="animate-spin text-gray-300" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Historical Data Grid (Performance Summary) */}
                {data ? (
                    <div className="bg-white dark:bg-card-dark p-4 mb-2 transition-colors">
                        <div className="grid grid-cols-4 gap-2 text-center">
                            {[
                                { label: '近6月', val: data.dayEnd?.returns?.YTD },
                                { label: '近1年', val: data.dayEnd?.returns?.Y1 },
                                { label: '近3年', val: data.dayEnd?.returns?.Y3 },
                                { label: '成立来', val: data.dayEnd?.returns?.sinceInception },
                            ].map((item, idx) => (
                                <div key={idx} className="flex flex-col gap-1 py-1 rounded">
                                    <span className="text-xs text-gray-400 mb-1">{item.label}</span>
                                    <span className={`font-mono font-bold text-sm ${getSignColor(item.val || 0)}`}>
                                        {item.val ? formatPct(item.val) : '--'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}

                {/* History NAV Table */}
                <div className="bg-white dark:bg-card-dark p-4 mb-2 transition-colors">
                    <div className="flex items-center justify-between mb-4 border-l-4 border-blue-500 pl-2">
                        <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm">{t('common.historyNav')}</h3>
                        <button
                            onClick={() => setShowAllHistory(!showAllHistory)}
                            className="text-xs text-gray-400 flex items-center hover:text-blue-500"
                        >
                            {showAllHistory ? '收起' : t('common.more')}
                            <Icons.ArrowUp className={`transform ml-0.5 transition-transform ${showAllHistory ? '' : 'rotate-180'}`} size={12} />
                        </button>
                    </div>

                    <div className="space-y-0">
                        <div className="grid grid-cols-4 gap-2 text-xs text-gray-400 pb-3">
                            <div className="text-left pl-2">{t('common.date')}</div>
                            <div className="text-center">{t('common.unitNav')}</div>
                            <div className="text-center">{t('common.accNav')}</div>
                            <div className="text-right pr-2">{t('common.dayChgPct')}</div>
                        </div>

                        {displayedHistory.length > 0 ? displayedHistory.map((item, idx) => (
                            <div key={idx} className="grid grid-cols-4 gap-2 py-3 border-t border-gray-50 dark:border-border-dark items-center text-sm transition-colors">
                                <div className="text-left pl-2 text-gray-600 dark:text-gray-400 font-medium font-mono">{item.date}</div>
                                <div className="text-center text-gray-800 dark:text-gray-200 font-mono">{item.nav.toFixed(4)}</div>
                                {/* Using derived nav for accumulated as well, since chart is adjusted returns */}
                                <div className="text-center text-gray-800 dark:text-gray-200 font-mono">{item.nav.toFixed(4)}</div>
                                <div className={`text-right pr-2 font-mono font-medium ${getSignColor(item.change)}`}>
                                    {formatPct(item.change)}
                                </div>
                            </div>
                        )) : (
                            <div className="py-4 text-center text-gray-300 text-xs">Loading history...</div>
                        )}
                    </div>
                </div>

                {/* Holdings Section */}
                {holdings.length > 0 && (
                    <div className="bg-white dark:bg-card-dark p-4 mb-2 transition-colors">
                        <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm mb-4 border-l-4 border-blue-500 pl-2">
                            持仓明细 <span className="text-xs text-gray-400 font-normal ml-1">(实时估算)</span>
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
                                    <div key={idx} className="grid grid-cols-10 gap-2 py-3 border-b border-gray-50 dark:border-border-dark items-center last:border-0 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                        <div className="col-span-4 pl-1">
                                            <div className="font-medium text-gray-800 dark:text-gray-200 text-sm truncate">{stock.name}</div>
                                            <div className="text-xs text-gray-400 font-mono">{stock.ticker}</div>
                                        </div>
                                        <div className="col-span-3 text-right">
                                            <div className="font-mono text-sm text-gray-800 dark:text-gray-200">{price}</div>
                                            {hasQuote && (
                                                <div className={`text-xs font-mono font-medium ${getSignColor(pct)}`}>
                                                    {formatPct(pct)}
                                                </div>
                                            )}
                                        </div>
                                        <div className="col-span-3 text-right pr-1">
                                            <div className="font-mono text-gray-800 dark:text-gray-200 font-medium">{stock.weight.toFixed(2)}%</div>
                                            {/* Simple visual bar for weight */}
                                            <div className="w-full bg-gray-100 dark:bg-white/10 h-1 mt-1 rounded-full overflow-hidden flex justify-end">
                                                <div className="bg-blue-200 dark:bg-blue-800 h-full" style={{ width: `${Math.min(stock.weight * 5, 100)}%` }} />
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
                    <div className="bg-white dark:bg-card-dark p-4 transition-colors">
                        <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm mb-4 border-l-4 border-blue-500 pl-2">年度回报</h3>
                        <div className="space-y-3">
                            {data.annual.returns?.slice().reverse().map((item) => (
                                <div key={item.k} className="flex justify-between items-center text-sm border-b border-gray-50 dark:border-border-dark pb-2 last:border-0">
                                    <span className="text-gray-600 dark:text-gray-400 font-mono">{item.k}年</span>
                                    <span className={`font-mono font-medium ${getSignColor(item.v)}`}>
                                        {formatPct(item.v)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};