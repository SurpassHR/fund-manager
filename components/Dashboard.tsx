import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, initDB, calculateSummary, refreshFundData } from '../services/db';
import {
  formatCurrency,
  formatSignedCurrency,
  getSignColor,
  formatPct,
} from '../services/financeUtils';
import { Icons } from './Icon';
import { useTranslation } from '../services/i18n';
import type { HoldingsSnapshot } from '../services/aiAnalysis';
import { AccountManagerModal } from './AccountManagerModal';
import { AddFundModal } from './AddFundModal';
import { AdjustPositionModal } from './AdjustPositionModal';
import { RebalanceModal } from './RebalanceModal';
import { TransactionHistoryModal } from './TransactionHistoryModal';
import { FundDetail } from './FundDetail';
import type { Fund } from '../types';
import { AnimatePresence } from 'framer-motion';
import { useSettings } from '../services/SettingsContext';
import { AiHoldingsAnalysisModal } from './AiHoldingsAnalysisModal';
import { hasTouchMovedBeyondThreshold } from '../services/longPressGesture';
import {
  AUTO_REFRESH_INTERVAL_MS,
  AUTO_REFRESH_STALE_MS,
  isRefreshStale,
  readRefreshLastSuccessAt,
  writeRefreshLastSuccessAt,
} from '../services/refreshPolicy';

const LONG_PRESS_DURATION_MS = 600;
const TOUCH_MOVE_CANCEL_THRESHOLD_PX = 12;
const DASHBOARD_SORT_STORAGE_KEY = 'dashboard.sortState.v1';
const REFRESH_DEBOUNCE_MS = 300;

type DashboardSortKey =
  | 'officialDayChangePct'
  | 'estimatedDayChangePct'
  | 'todayGain'
  | 'totalGain'
  | 'marketValue';

type DashboardSortState = {
  key: DashboardSortKey | null;
  direction: 'asc' | 'desc';
};

const DEFAULT_DASHBOARD_SORT_STATE: DashboardSortState = { key: null, direction: 'desc' };

const isValidDashboardSortKey = (key: unknown): key is DashboardSortKey => {
  return (
    key === 'officialDayChangePct' ||
    key === 'estimatedDayChangePct' ||
    key === 'todayGain' ||
    key === 'totalGain' ||
    key === 'marketValue'
  );
};

const loadDashboardSortState = (): DashboardSortState => {
  try {
    const raw = localStorage.getItem(DASHBOARD_SORT_STORAGE_KEY);
    if (!raw) return DEFAULT_DASHBOARD_SORT_STATE;
    const parsed = JSON.parse(raw) as { key?: unknown; direction?: unknown };
    let nextKey: DashboardSortKey | null = null;
    if (parsed.key !== undefined && parsed.key !== null) {
      if (!isValidDashboardSortKey(parsed.key)) {
        return DEFAULT_DASHBOARD_SORT_STATE;
      }
      nextKey = parsed.key;
    }
    if (parsed.direction !== 'asc' && parsed.direction !== 'desc') {
      return DEFAULT_DASHBOARD_SORT_STATE;
    }
    return {
      key: nextKey,
      direction: parsed.direction,
    };
  } catch {
    return DEFAULT_DASHBOARD_SORT_STATE;
  }
};

export const Dashboard: React.FC = () => {
  const funds = useLiveQuery(() => db.funds.toArray());
  const accounts = useLiveQuery(() => db.accounts.toArray());
  const [activeFilter, setActiveFilter] = useState('All');
  const [showValues, setShowValues] = useState(true);
  const [sortState, setSortState] = useState<DashboardSortState>(() => loadDashboardSortState());
  const [isAiAnalysisOpen, setIsAiAnalysisOpen] = useState(false);
  const { autoRefresh } = useSettings();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownMaxTime = 5000;
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshInFlightRef = useRef(false);
  const lastRefreshRequestAtRef = useRef(0);

  const [selectedFund, setSelectedFund] = useState<Fund | null>(null);

  const [isAccountManagerOpen, setIsAccountManagerOpen] = useState(false);
  const [isAddFundOpen, setIsAddFundOpen] = useState(false);
  const [editingFund, setEditingFund] = useState<Fund | undefined>(undefined);
  const [adjustFund, setAdjustFund] = useState<Fund | null>(null);
  const [rebalanceFund, setRebalanceFund] = useState<Fund | null>(null);
  const [historyFund, setHistoryFund] = useState<Fund | null>(null);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; fundId: number } | null>(
    null,
  );
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPointRef = useRef<{ x: number; y: number } | null>(null);
  const isScrollGestureRef = useRef(false);

  const { t } = useTranslation();

  const getLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const holdingsSnapshot = useMemo<HoldingsSnapshot | null>(() => {
    if (!funds) return null;
    const summary = calculateSummary(funds);
    const latestDateStr = funds.reduce((max, fund) => {
      if (!fund.lastUpdate) return max;
      return fund.lastUpdate > max ? fund.lastUpdate : max;
    }, '');
    const asOf = latestDateStr || getLocalDateString();
    const holdings = funds.map((fund) => {
      const marketValue = fund.holdingShares * fund.currentNav;
      const totalCost = fund.holdingShares * fund.costPrice;
      const totalGain = marketValue - totalCost;
      const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
      return {
        code: fund.code,
        name: fund.name,
        platform: fund.platform,
        holdingShares: fund.holdingShares,
        costPrice: fund.costPrice,
        currentNav: fund.currentNav,
        marketValue,
        totalCost,
        totalGain,
        totalGainPct,
        dayChangePct: fund.dayChangePct,
        dayChangeVal: fund.dayChangeVal,
        lastUpdate: fund.lastUpdate,
        buyDate: fund.buyDate,
        buyTime: fund.buyTime,
        settlementDays: fund.settlementDays,
      };
    });
    return {
      asOf,
      currency: 'CNY',
      totalAssets: summary.totalAssets,
      totalDayGain: summary.totalDayGain,
      totalDayGainPct: summary.totalDayGainPct,
      holdingGain: summary.holdingGain,
      holdingGainPct: summary.holdingGainPct,
      holdings,
    };
  }, [funds]);

  const requestFundRefresh = useCallback(async (force = false) => {
    if (refreshInFlightRef.current) return false;
    const now = Date.now();
    if (now - lastRefreshRequestAtRef.current < REFRESH_DEBOUNCE_MS) return false;

    lastRefreshRequestAtRef.current = now;
    refreshInFlightRef.current = true;
    try {
      await refreshFundData({ force });
      writeRefreshLastSuccessAt('fund', Date.now());
      return true;
    } finally {
      refreshInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    initDB();

    const shouldRefreshByStale = () =>
      isRefreshStale(readRefreshLastSuccessAt('fund'), AUTO_REFRESH_STALE_MS);

    if (document.visibilityState === 'visible' && shouldRefreshByStale()) {
      void requestFundRefresh(false);
    }

    let autoUpdateTimer: ReturnType<typeof setInterval> | null = null;

    const startAutoRefresh = () => {
      if (!autoRefresh) return;
      if (autoUpdateTimer) clearInterval(autoUpdateTimer);
      autoUpdateTimer = setInterval(() => {
        if (document.visibilityState !== 'visible') return;
        void requestFundRefresh(false);
      }, AUTO_REFRESH_INTERVAL_MS);
    };

    const stopAutoRefresh = () => {
      if (autoUpdateTimer) {
        clearInterval(autoUpdateTimer);
        autoUpdateTimer = null;
      }
    };

    const maybeRefreshWhenVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (shouldRefreshByStale()) {
        void requestFundRefresh(false);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        maybeRefreshWhenVisible();
        startAutoRefresh();
      } else {
        stopAutoRefresh();
      }
    };

    const handleWindowFocus = () => {
      maybeRefreshWhenVisible();
    };

    startAutoRefresh();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      stopAutoRefresh();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [autoRefresh, requestFundRefresh]);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    if (sortState.key === null) {
      localStorage.removeItem(DASHBOARD_SORT_STORAGE_KEY);
      return;
    }
    localStorage.setItem(DASHBOARD_SORT_STORAGE_KEY, JSON.stringify(sortState));
  }, [sortState]);

  const safeFunds = useMemo(() => funds ?? [], [funds]);
  const safeAccounts = useMemo(() => accounts ?? [], [accounts]);

  const filteredFunds =
    activeFilter === 'All' ? safeFunds : safeFunds.filter((fund) => fund.platform === activeFilter);

  const summary = calculateSummary(filteredFunds);
  const filterList =
    safeAccounts.length > 1
      ? ['All', ...safeAccounts.map((account) => account.name)]
      : safeAccounts.map((account) => account.name);

  useEffect(() => {
    if (safeAccounts.length === 1) {
      const onlyAccount = safeAccounts[0]?.name;
      if (onlyAccount && activeFilter !== onlyAccount) {
        setActiveFilter(onlyAccount);
      }
      return;
    }

    if (safeAccounts.length > 1 && activeFilter !== 'All') {
      const accountExists = safeAccounts.some((account) => account.name === activeFilter);
      if (!accountExists) {
        setActiveFilter('All');
      }
    }
  }, [activeFilter, safeAccounts]);

  const activeFilterLabel =
    activeFilter === 'All'
      ? t('common.all') || '全部'
      : t(`filters.${activeFilter}`) !== `filters.${activeFilter}`
        ? t(`filters.${activeFilter}`)
        : activeFilter;

  const handleSort = (key: DashboardSortKey) => {
    setSortState((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'desc' };
    });
  };

  const handleResetSort = () => {
    setSortState(DEFAULT_DASHBOARD_SORT_STATE);
  };

  const sortedFunds = useMemo(() => {
    if (!sortState.key) return filteredFunds;

    const getSortValue = (fund: Fund) => {
      const holdingValue = fund.holdingShares * fund.currentNav;
      const displayTodayGainVal = fund.todayChangeUnavailable
        ? 0
        : fund.todayChangeIsEstimated
          ? (holdingValue * (fund.estimatedDayChangePct ?? 0)) / 100
          : fund.dayChangeVal;
      if (sortState.key === 'marketValue') return holdingValue;
      if (sortState.key === 'totalGain') {
        return holdingValue - fund.holdingShares * fund.costPrice;
      }
      if (sortState.key === 'todayGain') return displayTodayGainVal;
      if (sortState.key === 'estimatedDayChangePct') {
        if (fund.todayChangeUnavailable) return 0;
        return fund.todayChangeIsEstimated
          ? (fund.estimatedDayChangePct ?? 0)
          : (fund.officialDayChangePct ?? fund.dayChangePct);
      }
      return fund.officialDayChangePct ?? fund.dayChangePct;
    };

    const direction = sortState.direction === 'asc' ? 1 : -1;
    return [...filteredFunds].sort((a, b) => {
      const diff = getSortValue(a) - getSortValue(b);
      if (diff === 0) return 0;
      return diff * direction;
    });
  }, [filteredFunds, sortState.direction, sortState.key]);

  if (!funds || !accounts) {
    return <div className="p-8 text-center text-gray-500">{t('common.loading')}</div>;
  }

  const handleContextMenu = (e: React.MouseEvent, fundId: number) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, fundId });
  };

  const handleTouchStart = (fundId: number, e: React.TouchEvent) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;
    touchStartPointRef.current = { x, y };
    isScrollGestureRef.current = false;

    longPressTimerRef.current = setTimeout(() => {
      if (isScrollGestureRef.current) return;
      setContextMenu({ x, y, fundId });
      if (navigator.vibrate) navigator.vibrate(50);
    }, LONG_PRESS_DURATION_MS);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPointRef.current || isScrollGestureRef.current) return;
    const touch = e.touches[0];
    const hasMoved = hasTouchMovedBeyondThreshold(
      touchStartPointRef.current,
      { x: touch.clientX, y: touch.clientY },
      TOUCH_MOVE_CANCEL_THRESHOLD_PX,
    );

    if (!hasMoved) return;

    isScrollGestureRef.current = true;
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartPointRef.current = null;
    isScrollGestureRef.current = false;
  };

  const handleEdit = (fund: Fund) => {
    setEditingFund(fund);
    setIsAddFundOpen(true);
    setContextMenu(null);
  };

  const handleDelete = async (fundId: number) => {
    if (confirm(t('common.delete') + '?')) {
      await db.funds.delete(fundId);
    }
    setContextMenu(null);
  };

  const handleRowClick = (fund: Fund) => {
    if (contextMenu) return;
    setSelectedFund(fund);
  };

  const handleManualRefresh = async () => {
    if (cooldown > 0 || isRefreshing || refreshInFlightRef.current) return;

    setIsRefreshing(true);
    const startTime = Date.now();

    try {
      await requestFundRefresh(true);
    } finally {
      const elapsed = Date.now() - startTime;
      if (elapsed < 1000) {
        await new Promise((res) => setTimeout(res, 1000 - elapsed));
      }
      setIsRefreshing(false);

      setCooldown(100);
      const cooldownStartTime = Date.now();

      if (cooldownRef.current) clearInterval(cooldownRef.current);

      cooldownRef.current = setInterval(() => {
        const cElapsed = Date.now() - cooldownStartTime;
        const remaining = Math.max(0, cooldownMaxTime - cElapsed);
        const percent = (remaining / cooldownMaxTime) * 100;

        if (percent <= 0) {
          setCooldown(0);
          if (cooldownRef.current) clearInterval(cooldownRef.current);
        } else {
          setCooldown(percent);
        }
      }, 16);
    }
  };

  const handleTransactionsDeleted = async (affectedFundIds: number[]) => {
    if (affectedFundIds.length === 0) return;

    const refreshedFunds = await db.funds.bulkGet(affectedFundIds);
    const refreshedFundMap = new Map<number, Fund>();
    refreshedFunds.forEach((item) => {
      if (item?.id != null) {
        refreshedFundMap.set(item.id, item);
      }
    });

    setSelectedFund((prev) => {
      if (!prev?.id || !affectedFundIds.includes(prev.id)) return prev;
      return refreshedFundMap.get(prev.id) ?? null;
    });

    setHistoryFund((prev) => {
      if (!prev?.id || !affectedFundIds.includes(prev.id)) return prev;
      return refreshedFundMap.get(prev.id) ?? null;
    });
  };

  return (
    <div className="min-h-full pb-36 md:pb-24" onContextMenu={(e) => e.preventDefault()}>
      <AnimatePresence>
        {selectedFund && (
          <FundDetail key="fund-detail" fund={selectedFund} onBack={() => setSelectedFund(null)} />
        )}
      </AnimatePresence>

      {contextMenu && (
        <div
          className="fixed z-[100] w-48 origin-top-left overflow-hidden rounded-xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)]/98 py-2 shadow-[var(--app-shell-shadow)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100"
          style={{
            top: Math.min(contextMenu.y, window.innerHeight - 150),
            left: Math.min(contextMenu.x, window.innerWidth - 200),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-1 border-b border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)]/88 px-4 py-2 text-xs font-bold text-[var(--app-shell-muted)]">
            {t('common.menu')}
          </div>
          <button
            onClick={() => {
              const fund = funds.find((item) => item.id === contextMenu.fundId);
              if (fund) handleEdit(fund);
            }}
            className="flex w-full items-center gap-2 border-b border-[var(--app-shell-line)] px-4 py-3 text-left text-sm text-slate-700 hover:bg-[var(--app-shell-panel-strong)] dark:border-border-dark dark:text-gray-200 dark:hover:bg-blue-900/20"
          >
            <Icons.Settings size={16} className="text-slate-500" /> {t('common.edit')}
          </button>
          <button
            onClick={() => {
              const fund = funds.find((item) => item.id === contextMenu.fundId);
              if (fund) {
                setRebalanceFund(fund);
                setContextMenu(null);
              }
            }}
            className="flex w-full items-center gap-2 border-b border-gray-50 px-4 py-3 text-left text-sm text-gray-700 hover:bg-indigo-50 dark:border-border-dark dark:text-gray-200 dark:hover:bg-indigo-900/20"
          >
            <Icons.ArrowDown size={16} className="text-indigo-500" /> {t('common.rebalance')}
          </button>
          <button
            onClick={() => {
              const fund = funds.find((item) => item.id === contextMenu.fundId);
              if (fund) {
                setAdjustFund(fund);
                setContextMenu(null);
              }
            }}
            className="flex w-full items-center gap-2 border-b border-gray-50 px-4 py-3 text-left text-sm text-gray-700 hover:bg-amber-50 dark:border-border-dark dark:text-gray-200 dark:hover:bg-amber-900/20"
          >
            <Icons.TrendingUp size={16} className="text-amber-500" /> {t('common.adjustPosition')}
          </button>
          <button
            onClick={() => {
              const fund = funds.find((item) => item.id === contextMenu.fundId);
              if (fund) {
                setHistoryFund(fund);
                setContextMenu(null);
              }
            }}
            className="flex w-full items-center gap-2 border-b border-[var(--app-shell-line)] px-4 py-3 text-left text-sm text-slate-700 hover:bg-[var(--app-shell-panel-strong)] dark:border-border-dark dark:text-gray-200 dark:hover:bg-purple-900/20"
          >
            <Icons.Grid size={16} className="text-slate-500" />{' '}
            {t('common.transactionHistory') || '交易记录'}
          </button>
          <button
            onClick={() => handleDelete(contextMenu.fundId)}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <Icons.Plus size={16} className="rotate-45 transform" /> {t('common.delete')}
          </button>
        </div>
      )}

      <div className="mx-auto w-full max-w-7xl px-0 pt-20 md:px-4 md:pt-24 lg:px-6">
        <div className="sticky top-[4.5rem] z-20 rounded-[1.75rem] border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)]/95 backdrop-blur-xl dark:border-border-dark dark:bg-card-dark/85 md:top-[5rem] md:mt-2 md:shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <div className="relative flex items-center gap-3 overflow-x-auto px-3 py-3 no-scrollbar md:flex-wrap md:gap-4 md:px-5 md:py-3.5">
            <div className="hidden shrink-0 md:block md:min-w-[4rem]">
              <div className="text-[10px] font-semibold tracking-[0.24em] text-slate-400 dark:text-gray-500">
                {t('common.account')}
              </div>
              <div className="mt-1 truncate text-sm font-semibold text-slate-700 dark:text-gray-200">
                {activeFilterLabel}
              </div>
            </div>

            <div className="flex items-center gap-2 md:flex-1 md:flex-wrap">
              {filterList.map((filterKey) => {
                let label = filterKey;
                if (filterKey === 'All') label = t('common.all') || '全部';
                else if (t(`filters.${filterKey}`) !== `filters.${filterKey}`) {
                  label = t(`filters.${filterKey}`);
                }

                const isActive = activeFilter === filterKey;

                return (
                  <button
                    key={filterKey}
                    onClick={() => setActiveFilter(filterKey)}
                    className={`relative flex-shrink-0 overflow-hidden rounded-full border px-3 py-2 text-sm font-medium transition-all md:px-4 ${
                      isActive
                        ? 'border-[var(--app-shell-line-strong)] bg-[var(--app-shell-panel-strong)] text-slate-800 shadow-[0_8px_24px_rgba(82,61,37,0.10)] dark:border-blue-400 dark:bg-blue-500/15 dark:text-blue-100 dark:shadow-none'
                        : 'border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] text-slate-600 hover:border-[var(--app-shell-line-strong)] hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-gray-400 dark:hover:border-white/20 dark:hover:text-gray-100'
                    }`}
                  >
                    <span className="relative z-10">{label}</span>
                    {isActive && (
                      <span className="absolute inset-x-3 bottom-1 h-px bg-white/60 dark:bg-blue-200/60" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <div className="hidden rounded-full border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] px-3 py-1.5 text-[11px] font-medium tracking-[0.18em] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400 md:flex">
                {sortedFunds.length} {t('common.fund')}
              </div>
              <button
                onClick={() => setIsAccountManagerOpen(true)}
                className="rounded-full border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] p-2.5 text-slate-500 transition-colors hover:border-[var(--app-shell-line-strong)] hover:text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-gray-400 dark:hover:border-white/20 dark:hover:text-gray-100"
              >
                <Icons.Menu size={20} />
              </button>
            </div>
          </div>
        </div>

        <section className="relative mt-3 overflow-hidden rounded-[1.75rem] border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)]/92 px-4 pb-3 pt-3 dark:border-border-dark dark:bg-card-dark md:mt-3 md:px-6 md:pb-4 md:pt-4 md:shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-y-0 left-0 w-full bg-[radial-gradient(circle_at_top_left,_rgba(148,163,184,0.12),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(226,232,240,0.8),_transparent_28%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(96,165,250,0.12),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.10),_transparent_28%)]" />
          </div>

          <div className="relative flex flex-col gap-5">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_24rem] xl:grid-cols-[minmax(0,1fr)_26rem]">
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-[11px] font-semibold tracking-[0.24em] text-slate-400 dark:text-gray-500">
                        资产概览
                      </div>

                      <div className="flex items-center gap-2 lg:hidden">
                        <button
                          onClick={handleManualRefresh}
                          disabled={cooldown > 0 || isRefreshing}
                          className={`relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border transition-transform active:scale-95 ${
                            cooldown > 0 || isRefreshing
                              ? 'cursor-not-allowed border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] text-slate-500 dark:border-white/10 dark:bg-white/10 dark:text-gray-400'
                              : 'cursor-pointer border-[var(--app-shell-line-strong)] bg-[var(--app-shell-panel-strong)] text-slate-800 dark:border-blue-400/30 dark:bg-blue-500/15 dark:text-blue-100'
                          }`}
                        >
                          <Icons.Refresh size={16} className={isRefreshing ? 'animate-spin' : ''} />
                          {cooldown > 0 && !isRefreshing && (
                            <div
                              className="absolute inset-0 dark:hidden"
                              style={{
                                background: `conic-gradient(transparent ${100 - cooldown}%, rgba(0,0,0,0.18) ${100 - cooldown}%, rgba(0,0,0,0.18) 100%)`,
                              }}
                            />
                          )}
                          {cooldown > 0 && !isRefreshing && (
                            <div
                              className="absolute inset-0 hidden dark:block"
                              style={{
                                background: `conic-gradient(transparent ${100 - cooldown}%, rgba(15,23,42,0.75) ${100 - cooldown}%, rgba(15,23,42,0.75) 100%)`,
                              }}
                            />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-sm text-slate-500 dark:text-gray-400">
                      <span>{t('common.totalAssets')}</span>
                      <button
                        onClick={() => setShowValues(!showValues)}
                        className="rounded-full border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)]/90 p-1.5 text-slate-500 transition-colors hover:text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-gray-400 dark:hover:text-gray-100"
                      >
                        {showValues ? <Icons.Eye size={18} /> : <Icons.EyeOff size={18} />}
                      </button>
                    </div>
                    <div className="text-4xl font-black tracking-[-0.04em] text-slate-900 dark:text-gray-50 md:text-5xl">
                      {showValues ? formatCurrency(summary.totalAssets) : '****'}
                    </div>
                    <div
                      className={`mt-2 text-sm font-semibold ${getSignColor(summary.holdingGain)}`}
                    >
                      {t('common.totalGain')} ·{' '}
                      {showValues ? formatSignedCurrency(summary.holdingGain) : '****'}
                      <span className="ml-1 text-xs font-medium">
                        ({showValues ? formatPct(summary.holdingGainPct) : '****'})
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-2 flex flex-col gap-2 lg:mt-0">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start">
                  <div className="hidden items-center justify-center gap-2 lg:flex lg:shrink-0 lg:self-center">
                    <button
                      onClick={handleManualRefresh}
                      disabled={cooldown > 0 || isRefreshing}
                      className={`relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border transition-transform active:scale-95 ${
                        cooldown > 0 || isRefreshing
                          ? 'cursor-not-allowed border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] text-slate-500 dark:border-white/10 dark:bg-white/10 dark:text-gray-400'
                          : 'cursor-pointer border-[var(--app-shell-line-strong)] bg-[var(--app-shell-panel-strong)] text-slate-800 dark:border-blue-400/30 dark:bg-blue-500/15 dark:text-blue-100'
                      }`}
                    >
                      <Icons.Refresh size={16} className={isRefreshing ? 'animate-spin' : ''} />
                      {cooldown > 0 && !isRefreshing && (
                        <div
                          className="absolute inset-0 dark:hidden"
                          style={{
                            background: `conic-gradient(transparent ${100 - cooldown}%, rgba(0,0,0,0.18) ${100 - cooldown}%, rgba(0,0,0,0.18) 100%)`,
                          }}
                        />
                      )}
                      {cooldown > 0 && !isRefreshing && (
                        <div
                          className="absolute inset-0 hidden dark:block"
                          style={{
                            background: `conic-gradient(transparent ${100 - cooldown}%, rgba(15,23,42,0.75) ${100 - cooldown}%, rgba(15,23,42,0.75) 100%)`,
                          }}
                        />
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 lg:flex lg:min-w-0 lg:flex-1 lg:gap-2">
                    <div className="min-w-0 flex-1 rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)]/90 px-3.5 py-2 dark:border-white/10 dark:bg-white/5">
                      <div className="text-[9px] font-semibold tracking-[0.12em] whitespace-nowrap text-slate-400 dark:text-gray-500">
                        当前账户
                      </div>
                      <div className="mt-1 truncate text-[13px] font-semibold text-slate-800 dark:text-gray-100">
                        {activeFilterLabel}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)]/90 px-3.5 py-2 dark:border-white/10 dark:bg-white/5">
                      <div className="text-[9px] font-semibold tracking-[0.12em] whitespace-nowrap text-slate-400 dark:text-gray-500">
                        持仓数量
                      </div>
                      <div className="mt-1 truncate text-[13px] font-semibold text-slate-800 dark:text-gray-100">
                        {sortedFunds.length}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)]/90 px-3.5 py-2 dark:border-white/10 dark:bg-white/5">
                      <div className="text-[9px] font-semibold tracking-[0.12em] whitespace-nowrap text-slate-400 dark:text-gray-500">
                        自动刷新
                      </div>
                      <div className="mt-1 truncate text-[13px] font-semibold text-slate-800 dark:text-gray-100">
                        {autoRefresh ? '已开启' : '已关闭'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)]/80 px-4 py-3 backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
                  <div className="text-[11px] font-semibold tracking-[0.16em] text-slate-400 dark:text-gray-500">
                    {t('common.dayGain')}
                  </div>
                  <div
                    className={`mt-2 flex items-end gap-2 text-[1.65rem] font-black tracking-[-0.03em] ${getSignColor(summary.totalDayGain)}`}
                  >
                    <span>{showValues ? formatSignedCurrency(summary.totalDayGain) : '****'}</span>
                    <span className="pb-0.5 text-[13px] font-semibold tracking-[0.12em] text-slate-400 dark:text-gray-500">
                      {showValues ? formatPct(summary.totalDayGainPct) : '****'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-3 overflow-hidden rounded-[1.75rem] border border-[var(--app-shell-line)] md:mt-5 md:shadow-[0_14px_32px_rgba(15,23,42,0.05)] dark:border-border-dark">
          <div className="z-10 border-b border-[var(--app-shell-line)] bg-[var(--app-shell-panel)]/95 px-4 py-3 backdrop-blur-xl dark:border-border-dark dark:bg-card-dark/90 md:px-5">
            <div className="hidden items-center gap-4 md:flex">
              <div className="flex min-w-[15rem] flex-[1.6] items-center gap-2 text-slate-400">
                <div className="rounded-full border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] p-1.5 dark:border-white/10 dark:bg-white/5">
                  <Icons.Holdings size={14} />
                </div>
                <button
                  type="button"
                  onClick={handleResetSort}
                  className="text-[11px] font-semibold tracking-[0.18em] transition-colors hover:text-slate-700 dark:hover:text-gray-200"
                >
                  持仓列表
                </button>
              </div>

              <div className="grid flex-[5] grid-cols-6 gap-4 text-right text-[11px] font-semibold tracking-[0.16em] text-slate-400 dark:text-gray-500">
                <div className="text-left normal-case tracking-normal text-slate-500 dark:text-gray-400">
                  {t('common.cost')} / {t('common.nav')}
                </div>
                <button
                  onClick={() => handleSort('officialDayChangePct')}
                  className="flex items-center justify-end gap-1 transition-colors hover:text-slate-700 dark:hover:text-gray-200"
                  type="button"
                >
                  {t('common.yesterdayChangePct') || '昨日涨幅'}
                  {sortState.key === 'officialDayChangePct' && (
                    <Icons.ArrowUp
                      size={12}
                      className={sortState.direction === 'asc' ? '' : 'rotate-180'}
                    />
                  )}
                </button>
                <button
                  onClick={() => handleSort('estimatedDayChangePct')}
                  className="flex items-center justify-end gap-1 transition-colors hover:text-slate-700 dark:hover:text-gray-200"
                  type="button"
                >
                  {t('common.todayChangePct') || '今日涨幅'}
                  {sortState.key === 'estimatedDayChangePct' && (
                    <Icons.ArrowUp
                      size={12}
                      className={sortState.direction === 'asc' ? '' : 'rotate-180'}
                    />
                  )}
                </button>
                <button
                  onClick={() => handleSort('todayGain')}
                  className="flex items-center justify-end gap-1 transition-colors hover:text-slate-700 dark:hover:text-gray-200"
                  type="button"
                >
                  {t('common.dayGain')}
                  {sortState.key === 'todayGain' && (
                    <Icons.ArrowUp
                      size={12}
                      className={sortState.direction === 'asc' ? '' : 'rotate-180'}
                    />
                  )}
                </button>
                <button
                  onClick={() => handleSort('totalGain')}
                  className="flex items-center justify-end gap-1 transition-colors hover:text-slate-700 dark:hover:text-gray-200"
                  type="button"
                >
                  {t('common.totalGain')}
                  {sortState.key === 'totalGain' && (
                    <Icons.ArrowUp
                      size={12}
                      className={sortState.direction === 'asc' ? '' : 'rotate-180'}
                    />
                  )}
                </button>
                <button
                  onClick={() => handleSort('marketValue')}
                  className="flex items-center justify-end gap-1 transition-colors hover:text-slate-700 dark:hover:text-gray-200"
                  type="button"
                >
                  {t('common.mktVal')}
                  {sortState.key === 'marketValue' && (
                    <Icons.ArrowUp
                      size={12}
                      className={sortState.direction === 'asc' ? '' : 'rotate-180'}
                    />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between md:hidden">
              <div>
                <button
                  type="button"
                  onClick={handleResetSort}
                  className="text-[10px] font-semibold tracking-[0.2em] text-slate-400 transition-colors hover:text-slate-700 dark:text-gray-500 dark:hover:text-gray-200"
                >
                  持仓列表
                </button>
                <div className="mt-1 text-sm font-semibold text-slate-700 dark:text-gray-200">
                  {t('common.fund')}
                </div>
              </div>
              <div className="flex gap-2 text-right text-[11px] font-semibold tracking-[0.14em] text-slate-400 dark:text-gray-500">
                <button
                  onClick={() => handleSort('officialDayChangePct')}
                  className="flex w-[6.5rem] items-center justify-end gap-0.5"
                  type="button"
                >
                  {t('common.yesterdayChangePct') || '昨日涨幅'}
                  {sortState.key === 'officialDayChangePct' && (
                    <Icons.ArrowUp
                      size={12}
                      className={sortState.direction === 'asc' ? '' : 'rotate-180'}
                    />
                  )}
                </button>
                <button
                  onClick={() => handleSort('estimatedDayChangePct')}
                  className="flex w-[6.5rem] items-center justify-end gap-0.5"
                  type="button"
                >
                  {t('common.todayChangePct') || '今日涨幅'}
                  {sortState.key === 'estimatedDayChangePct' && (
                    <Icons.ArrowUp
                      size={12}
                      className={sortState.direction === 'asc' ? '' : 'rotate-180'}
                    />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-hidden bg-[var(--app-shell-panel)]/92 dark:bg-card-dark">
            {sortedFunds.map((fund) => {
              const holdingValue = fund.holdingShares * fund.currentNav;
              const totalCost = fund.holdingShares * fund.costPrice;
              const totalReturn = holdingValue - totalCost;
              const officialDayChangePct = fund.officialDayChangePct ?? fund.dayChangePct;
              const todayChangePct = fund.todayChangeUnavailable
                ? 0
                : fund.todayChangePreOpen
                  ? 0
                  : fund.todayChangeIsEstimated
                    ? (fund.estimatedDayChangePct ?? 0)
                    : (fund.officialDayChangePct ?? fund.dayChangePct);
              const displayTodayGainVal = fund.todayChangeUnavailable
                ? 0
                : fund.todayChangePreOpen
                  ? 0
                  : fund.todayChangeIsEstimated
                    ? (holdingValue * (fund.estimatedDayChangePct ?? 0)) / 100
                    : fund.dayChangeVal;
              const holdingGainPct = totalCost !== 0 ? (totalReturn / totalCost) * 100 : 0;
              const todayChangeTag = fund.todayChangePreOpen
                ? t('common.preOpen') || '未开盘'
                : fund.todayChangeUnavailable
                  ? t('common.noEstimate') || '无估值'
                  : fund.todayChangeIsEstimated
                    ? t('common.estimated') || '估值'
                    : t('common.updated') || '已更新';
              const displayPlatform =
                t(`filters.${fund.platform}`) === `filters.${fund.platform}`
                  ? fund.platform
                  : t(`filters.${fund.platform}`);
              const pendingCount = (fund.pendingTransactions || []).filter(
                (tx) => !tx.settled,
              ).length;
              const displayMaskedValue = (value: string) => (showValues ? value : '****');
              const displayMetricColor = (value: number) => getSignColor(value);

              return (
                <div
                  key={fund.id}
                  onClick={() => handleRowClick(fund)}
                  onContextMenu={(e) => fund.id && handleContextMenu(e, fund.id)}
                  onTouchStart={(e) => fund.id && handleTouchStart(fund.id, e)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onTouchCancel={handleTouchEnd}
                  className={`group relative cursor-pointer select-none border-b border-[var(--app-shell-line)]/80 px-4 py-3 transition-colors last:border-b-0 active:bg-[var(--app-shell-panel-strong)] dark:border-border-dark dark:active:bg-white/5 md:px-5 md:py-3.5 md:hover:bg-[var(--app-shell-panel-strong)]/72 dark:md:hover:bg-white/5 ${
                    contextMenu?.fundId === fund.id
                      ? 'bg-[var(--app-shell-panel-strong)] dark:bg-white/10'
                      : ''
                  }`}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <div className="min-w-0 flex-1 md:flex-[1.6] md:pr-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)]/92 px-2 py-1 text-[10px] font-semibold tracking-[0.14em] text-slate-700 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-200">
                          {fund.code}
                        </span>
                        <span className="max-w-[10rem] truncate rounded-full border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] px-2 py-1 text-[10px] font-semibold tracking-[0.14em] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
                          {displayPlatform}
                        </span>
                        {pendingCount > 0 && (
                          <span className="rounded-full border border-amber-200 bg-amber-50/85 px-2 py-1 text-[10px] font-semibold tracking-[0.14em] text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-300">
                            {pendingCount} {t('common.inTransit')}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex items-start justify-between gap-3 md:block">
                        <div>
                          <h3 className="text-[15px] font-semibold tracking-tight text-slate-900 dark:text-gray-50 md:text-base">
                            {fund.name}
                          </h3>
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-gray-400 md:hidden">
                            <span>
                              {t('common.cost')}:{' '}
                              {displayMaskedValue(formatCurrency(fund.costPrice, 4))}
                            </span>
                            <span>
                              {t('common.nav')}: {displayMaskedValue(fund.currentNav.toFixed(4))}
                            </span>
                          </div>
                        </div>
                        <div className="text-right md:hidden">
                          <div className="text-lg font-black tracking-[-0.03em] text-slate-900 dark:text-gray-50">
                            {displayMaskedValue(formatCurrency(holdingValue))}
                          </div>
                          <div className="mt-1 text-[10px] font-semibold tracking-[0.14em] text-slate-400 dark:text-gray-500">
                            {t('common.mktVal')}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="hidden md:grid md:flex-[5] md:grid-cols-6 md:gap-4 md:text-right">
                      <div className="text-left text-xs text-slate-500 dark:text-gray-400">
                        <div className="font-semibold text-slate-700 dark:text-gray-200">
                          {displayMaskedValue(formatCurrency(fund.costPrice, 4))}
                        </div>
                        <div className="mt-1 text-slate-400 dark:text-gray-500">
                          {displayMaskedValue(fund.currentNav.toFixed(4))}
                        </div>
                      </div>
                      <div
                        className={`text-sm font-semibold ${displayMetricColor(officialDayChangePct)}`}
                      >
                        {displayMaskedValue(formatPct(officialDayChangePct))}
                      </div>
                      <div
                        className={`text-sm font-semibold ${displayMetricColor(todayChangePct)}`}
                      >
                        {displayMaskedValue(formatPct(todayChangePct))}
                        {todayChangeTag && (
                          <div className="mt-1 text-[10px] font-medium tracking-[0.14em] text-slate-400 dark:text-gray-500">
                            {todayChangeTag}
                          </div>
                        )}
                      </div>
                      <div
                        className={`text-sm font-semibold ${displayMetricColor(displayTodayGainVal)}`}
                      >
                        {displayMaskedValue(formatSignedCurrency(displayTodayGainVal))}
                      </div>
                      <div className="flex flex-col items-end">
                        <div className={`text-sm font-semibold ${displayMetricColor(totalReturn)}`}>
                          {displayMaskedValue(formatSignedCurrency(totalReturn))}
                        </div>
                        <div
                          className={`mt-1 text-[10px] font-medium ${displayMetricColor(holdingGainPct)}`}
                        >
                          {displayMaskedValue(formatPct(holdingGainPct))}
                        </div>
                      </div>
                      <div className="text-base font-black tracking-[-0.03em] text-slate-900 dark:text-gray-50">
                        {displayMaskedValue(formatCurrency(holdingValue))}
                      </div>
                    </div>

                    <div className="mt-2 flex items-stretch gap-1.5 md:hidden">
                      <div className="min-w-0 flex-1 rounded-xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)]/90 px-2 py-2 text-right dark:border-white/10 dark:bg-white/5">
                        <div
                          className={`truncate text-[13px] font-black leading-none tracking-[-0.02em] ${displayMetricColor(officialDayChangePct)}`}
                        >
                          {displayMaskedValue(formatPct(officialDayChangePct))}
                        </div>
                        <div className="mt-1 truncate text-[9px] font-semibold tracking-[0.1em] text-slate-400 dark:text-gray-500">
                          {t('common.yesterdayChangePct') || '昨日涨幅'}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1 rounded-xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)]/90 px-2 py-2 text-right dark:border-white/10 dark:bg-white/5">
                        <div
                          className={`truncate text-[13px] font-black leading-none tracking-[-0.02em] ${displayMetricColor(todayChangePct)}`}
                        >
                          {displayMaskedValue(formatPct(todayChangePct))}
                        </div>
                        <div className="mt-1 truncate text-[9px] font-semibold tracking-[0.1em] text-slate-400 dark:text-gray-500">
                          {todayChangeTag || t('common.todayChangePct') || '今日涨幅'}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1 rounded-xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)]/80 px-2 py-2 text-right dark:border-white/10 dark:bg-white/5">
                        <div
                          className={`truncate text-[12px] font-bold ${displayMetricColor(displayTodayGainVal)}`}
                        >
                          {displayMaskedValue(formatSignedCurrency(displayTodayGainVal))}
                        </div>
                        <div className="mt-1 truncate text-[9px] font-semibold tracking-[0.1em] text-slate-400 dark:text-gray-500">
                          {t('common.dayGain')}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1 rounded-xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)]/80 px-2 py-2 text-right dark:border-white/10 dark:bg-white/5">
                        <div
                          className={`truncate text-[12px] font-bold ${displayMetricColor(totalReturn)}`}
                        >
                          {displayMaskedValue(formatSignedCurrency(totalReturn))}
                        </div>
                        <div
                          className={`mt-0.5 truncate text-[9px] font-medium ${displayMetricColor(holdingGainPct)}`}
                        >
                          {displayMaskedValue(formatPct(holdingGainPct))}
                        </div>
                        <div className="mt-0.5 truncate text-[9px] font-semibold tracking-[0.1em] text-slate-400 dark:text-gray-500">
                          {t('common.totalGain')}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-3 px-4 pb-8 md:mt-5 md:px-0 md:pb-10">
          <div className="grid gap-3 md:grid-cols-[1.3fr_1fr]">
            <div className="rounded-[1.75rem] border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)]/92 p-3 shadow-[0_12px_28px_rgba(15,23,42,0.05)] dark:border-white/10 dark:bg-card-dark md:p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-semibold tracking-[0.2em] text-slate-400 dark:text-gray-500">
                    快捷操作
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-700 dark:text-gray-200">
                    {t('common.batch')} / {t('common.sync')}
                  </div>
                </div>
                <div className="rounded-full border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] px-3 py-1 text-[10px] font-semibold tracking-[0.16em] text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-gray-500">
                  常用
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingFund(undefined);
                    setIsAddFundOpen(true);
                  }}
                  className="flex min-h-[4.75rem] flex-col items-start justify-between rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)]/80 px-4 py-3 text-left text-slate-700 transition-colors hover:border-[var(--app-shell-line-strong)] hover:bg-[var(--app-shell-panel-strong)] dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:border-white/20 dark:hover:bg-white/10"
                >
                  <Icons.Plus size={18} />
                  <span className="text-sm font-semibold">{t('common.addFund')}</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const event = new CustomEvent('open-scanner');
                    window.dispatchEvent(event);
                  }}
                  className="flex min-h-[4.75rem] flex-col items-start justify-between rounded-2xl border border-[var(--app-shell-line-strong)] bg-[var(--app-shell-panel-strong)] px-4 py-3 text-left text-slate-800 transition-colors hover:border-[var(--app-shell-line-strong)] hover:bg-[var(--app-shell-panel-strong)]/88 dark:border-blue-400/20 dark:bg-blue-500/15 dark:text-blue-100 dark:hover:bg-blue-500/20"
                >
                  <Icons.Refresh size={18} />
                  <span className="text-sm font-semibold">{t('common.sync')}</span>
                </button>
                <button className="flex min-h-[4.75rem] flex-col items-start justify-between rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)]/80 px-4 py-3 text-left text-slate-700 transition-colors hover:border-[var(--app-shell-line-strong)] hover:bg-[var(--app-shell-panel-strong)] dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:border-white/20 dark:hover:bg-white/10">
                  <Icons.Copy size={18} />
                  <span className="text-sm font-semibold">{t('common.batch')}</span>
                </button>
              </div>
            </div>

            <button
              onClick={() => setIsAiAnalysisOpen(true)}
              className="group rounded-[1.75rem] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(248,250,252,0.98),rgba(255,255,255,0.92))] p-4 text-left shadow-[0_12px_28px_rgba(15,23,42,0.05)] transition-transform hover:-translate-y-0.5 dark:border-blue-400/20 dark:bg-[linear-gradient(135deg,rgba(30,41,59,1),rgba(15,23,42,1))]"
            >
              <div className="flex h-full items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--app-shell-panel-strong)] text-slate-700 shadow-none dark:bg-blue-500/20 dark:text-blue-200 dark:shadow-none">
                    <Icons.Chat size={22} />
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold tracking-[0.2em] text-slate-400 dark:text-blue-300/70">
                      智能分析
                    </div>
                    <div className="mt-1 text-base font-semibold text-slate-900 dark:text-gray-50">
                      {t('common.aiHoldingAnalysis') || 'AI 持仓分析'}
                    </div>
                    <div className="mt-1 text-sm text-slate-500 dark:text-gray-400">
                      {t('common.aiHoldingAnalysisDesc') || '一键分析持仓表现与风险'}
                    </div>
                  </div>
                </div>
                <Icons.ArrowUp
                  size={18}
                  className="rotate-90 text-slate-500 transition-transform group-hover:translate-x-1 dark:text-blue-300"
                />
              </div>
            </button>
          </div>
        </section>
      </div>

      <AccountManagerModal
        isOpen={isAccountManagerOpen}
        onClose={() => setIsAccountManagerOpen(false)}
      />
      <AddFundModal
        isOpen={isAddFundOpen}
        onClose={() => setIsAddFundOpen(false)}
        editFund={editingFund}
        onFundAdded={async () => {
          if (refreshInFlightRef.current) return;
          await requestFundRefresh(true);
        }}
      />
      {adjustFund && (
        <AdjustPositionModal
          isOpen={!!adjustFund}
          onClose={() => setAdjustFund(null)}
          fund={adjustFund}
        />
      )}
      {rebalanceFund && (
        <RebalanceModal
          isOpen={!!rebalanceFund}
          onClose={() => setRebalanceFund(null)}
          sourceFund={rebalanceFund}
          funds={safeFunds}
        />
      )}
      {historyFund && (
        <TransactionHistoryModal
          isOpen={!!historyFund}
          onClose={() => setHistoryFund(null)}
          fund={historyFund}
          onTransactionsDeleted={handleTransactionsDeleted}
        />
      )}
      <AiHoldingsAnalysisModal
        isOpen={isAiAnalysisOpen}
        onClose={() => setIsAiAnalysisOpen(false)}
        holdingsSnapshot={holdingsSnapshot}
      />
    </div>
  );
};
