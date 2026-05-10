import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, initDB, calculateSummary, refreshFundData } from '../services/db';
import {
  formatCurrency,
  formatSignedCurrency,
  getSignColor,
  formatPct,
} from '../services/financeUtils';
import { isEtfLinkFundName } from '../services/constants';
import { groupFundsByInstitution, resolveInstitutions } from '../services/fundInstitution';
import { Icons } from './Icon';
import { useTranslation } from '../services/i18n';
import type { HoldingsSnapshot } from '../services/aiAnalysis';
import { AccountManagerModal } from './AccountManagerModal';
import { AddFundModal } from './AddFundModal';
import { AdjustPositionModal } from './AdjustPositionModal';
import { RebalanceModal } from './RebalanceModal';
import { TransactionHistoryModal } from './TransactionHistoryModal';
import { FundDetail } from './FundDetail';
import { SortDropdown } from './SortDropdown';
import type { SortDropdownOption } from './SortDropdown';
import type { Fund } from '../types';
import { AnimatePresence, motion } from 'framer-motion';
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
import { deriveFundHoldingDisplayMetrics } from '../services/fundDayChange';

const LONG_PRESS_DURATION_MS = 600;
const TOUCH_MOVE_CANCEL_THRESHOLD_PX = 12;
const DASHBOARD_SORT_STORAGE_KEY = 'dashboard.sortState.v1';
const CLEARED_GROUP_STORAGE_KEY = 'dashboard.clearedGroupExpanded';
const INSTITUTION_GROUP_STORAGE_KEY = 'dashboard.institutionGroupEnabled';
const REFRESH_DEBOUNCE_MS = 300;

type DashboardSortKey =
  | 'name'
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
    key === 'name' ||
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

const getLocalDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const copyTextToClipboard = async (text: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();

  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!copied) {
    throw new Error('copy-failed');
  }
};

export const Dashboard: React.FC = () => {
  const funds = useLiveQuery(() => db.funds.toArray());
  const accounts = useLiveQuery(() => db.accounts.toArray());
  const [activeFilter, setActiveFilter] = useState('All');
  const [showValues, setShowValues] = useState(true);
  const [sortState, setSortState] = useState<DashboardSortState>(() => loadDashboardSortState());
  const [isClearedGroupExpanded, setIsClearedGroupExpanded] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(CLEARED_GROUP_STORAGE_KEY);
      return stored ? JSON.parse(stored) : false;
    } catch (error) {
      console.warn('Failed to load cleared group state from localStorage:', error);
      return false;
    }
  });
  const [isInstitutionGroupEnabled, setIsInstitutionGroupEnabled] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(INSTITUTION_GROUP_STORAGE_KEY);
      return stored ? JSON.parse(stored) : false;
    } catch {
      return false;
    }
  });
  const [collapsedInstitutionGroups, setCollapsedInstitutionGroups] = useState<Set<string>>(
    new Set(),
  );
  const [institutionMap, setInstitutionMap] = useState<Map<string, string> | null>(null);
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

  const getHoldingDisplayMetrics = useCallback(
    (
      fund: Fund,
      currentNav = fund.currentNav,
      effectiveDate = fund.lastUpdate || getLocalDateString(),
    ) =>
      deriveFundHoldingDisplayMetrics({
        holdingShares: fund.holdingShares,
        currentNav,
        costPrice: fund.costPrice,
        buyDate: fund.buyDate,
        buyTime: fund.buyTime,
        settlementDays: fund.settlementDays,
        effectiveDate,
      }),
    [],
  );

  const holdingsSnapshot = useMemo<HoldingsSnapshot | null>(() => {
    if (!funds) return null;
    const summary = calculateSummary(funds);
    const latestDateStr = funds.reduce((max, fund) => {
      if (!fund.lastUpdate) return max;
      return fund.lastUpdate > max ? fund.lastUpdate : max;
    }, '');
    const asOf = latestDateStr || getLocalDateString();
    const holdings = funds.map((fund) => {
      const { marketValue, totalCost, totalGain, totalGainPct } = getHoldingDisplayMetrics(fund);
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
  }, [funds, getHoldingDisplayMetrics]);

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
    const handler = () => {
      setEditingFund(undefined);
      setIsAddFundOpen(true);
    };
    window.addEventListener('open-add-fund', handler);
    return () => window.removeEventListener('open-add-fund', handler);
  }, []);

  useEffect(() => {
    if (sortState.key === null) {
      localStorage.removeItem(DASHBOARD_SORT_STORAGE_KEY);
      return;
    }
    localStorage.setItem(DASHBOARD_SORT_STORAGE_KEY, JSON.stringify(sortState));
  }, [sortState]);

  useEffect(() => {
    localStorage.setItem(INSTITUTION_GROUP_STORAGE_KEY, JSON.stringify(isInstitutionGroupEnabled));
  }, [isInstitutionGroupEnabled]);

  useEffect(() => {
    if (!isInstitutionGroupEnabled || institutionMap) return;
    const codes = (funds ?? []).map((f) => f.code);
    if (codes.length === 0) return;
    resolveInstitutions(codes).then(setInstitutionMap);
  }, [isInstitutionGroupEnabled, funds, institutionMap]);

  useEffect(() => {
    if (!isInstitutionGroupEnabled) {
      setInstitutionMap(null);
    }
  }, [isInstitutionGroupEnabled]);

  const safeFunds = useMemo(() => funds ?? [], [funds]);
  const safeAccounts = useMemo(() => accounts ?? [], [accounts]);

  const filteredFunds = useMemo(
    () =>
      activeFilter === 'All'
        ? safeFunds
        : safeFunds.filter((fund) => fund.platform === activeFilter),
    [activeFilter, safeFunds],
  );

  const summary = useMemo(() => calculateSummary(filteredFunds), [filteredFunds]);
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

  const dashboardSortOptions: SortDropdownOption[] = useMemo(
    () => [
      { key: 'name', label: t('common.name') || '名称' },
      { key: 'marketValue', label: t('common.mktVal') || '市值' },
      { key: 'todayGain', label: t('common.dayGain') || '日收益' },
      { key: 'totalGain', label: t('common.totalGain') || '持有收益' },
      { key: 'officialDayChangePct', label: t('common.yesterdayChangePct') || '昨日涨幅' },
      { key: 'estimatedDayChangePct', label: t('common.todayChangePct') || '今日涨幅' },
    ],
    [t],
  );

  const handleToggleClearedGroup = useCallback(() => {
    const nextExpanded = !isClearedGroupExpanded;
    setIsClearedGroupExpanded(nextExpanded);
    try {
      localStorage.setItem(CLEARED_GROUP_STORAGE_KEY, JSON.stringify(nextExpanded));
    } catch (error) {
      console.warn('Failed to save cleared group state to localStorage:', error);
    }
  }, [isClearedGroupExpanded]);

  const sortedFunds = useMemo(() => {
    if (!sortState.key) return filteredFunds;

    const getSortValue = (fund: Fund) => {
      const { marketValue, totalGain, isInTransit, dayChangeBaseNav } =
        getHoldingDisplayMetrics(fund);
      const displayTodayGainVal =
        isInTransit || fund.todayChangeUnavailable
          ? 0
          : dayChangeBaseNav !== undefined
            ? fund.todayChangeIsEstimated
              ? (fund.holdingShares * dayChangeBaseNav * (fund.estimatedDayChangePct ?? 0)) / 100
              : marketValue - fund.holdingShares * dayChangeBaseNav
            : fund.todayChangeIsEstimated
              ? (marketValue * (fund.estimatedDayChangePct ?? 0)) / 100
              : fund.dayChangeVal;
      if (sortState.key === 'marketValue') return marketValue;
      if (sortState.key === 'totalGain') return totalGain;
      if (sortState.key === 'todayGain') return displayTodayGainVal;
      if (sortState.key === 'estimatedDayChangePct') {
        if (isInTransit || fund.todayChangeUnavailable) return 0;
        return fund.todayChangeIsEstimated
          ? (fund.estimatedDayChangePct ?? 0)
          : (fund.officialDayChangePct ?? fund.dayChangePct);
      }
      return fund.officialDayChangePct ?? fund.dayChangePct;
    };

    const direction = sortState.direction === 'asc' ? 1 : -1;
    return [...filteredFunds].sort((a, b) => {
      if (sortState.key === 'name') {
        return a.name.localeCompare(b.name, 'zh-Hans-CN') * direction;
      }
      const diff = getSortValue(a) - getSortValue(b);
      if (diff === 0) return 0;
      return diff * direction;
    });
  }, [filteredFunds, getHoldingDisplayMetrics, sortState.direction, sortState.key]);

  const activeFunds = useMemo(
    () => sortedFunds.filter((fund) => fund.holdingShares > 0.01),
    [sortedFunds],
  );

  const clearedFunds = useMemo(
    () => sortedFunds.filter((fund) => fund.holdingShares <= 0.01),
    [sortedFunds],
  );

  const groupedActiveFunds = useMemo(() => {
    if (!isInstitutionGroupEnabled || !institutionMap) return null;
    return groupFundsByInstitution(activeFunds, institutionMap, (f) => f.code);
  }, [activeFunds, isInstitutionGroupEnabled, institutionMap]);

  const groupedClearedFunds = useMemo(() => {
    if (!isInstitutionGroupEnabled || !institutionMap) return null;
    return groupFundsByInstitution(clearedFunds, institutionMap, (f) => f.code);
  }, [clearedFunds, isInstitutionGroupEnabled, institutionMap]);

  const toggleInstitutionGroupCollapse = useCallback((institution: string) => {
    setCollapsedInstitutionGroups((prev) => {
      const next = new Set(prev);
      if (next.has(institution)) {
        next.delete(institution);
      } else {
        next.add(institution);
      }
      return next;
    });
  }, []);

  type RenderItem =
    | { type: 'fund'; fund: Fund }
    | { type: 'divider'; institution: string; count: number };

  const activeRenderItems = useMemo<RenderItem[]>(() => {
    if (!isInstitutionGroupEnabled || !groupedActiveFunds) {
      return activeFunds.map((fund) => ({ type: 'fund' as const, fund }));
    }
    const items: RenderItem[] = [];
    for (const [institution, funds] of groupedActiveFunds.entries()) {
      items.push({ type: 'divider' as const, institution, count: funds.length });
      if (!collapsedInstitutionGroups.has(institution)) {
        for (const fund of funds) {
          items.push({ type: 'fund' as const, fund });
        }
      }
    }
    return items;
  }, [isInstitutionGroupEnabled, groupedActiveFunds, activeFunds, collapsedInstitutionGroups]);

  const clearedRenderItems = useMemo<RenderItem[]>(() => {
    if (!isInstitutionGroupEnabled || !groupedClearedFunds) {
      return clearedFunds.map((fund) => ({ type: 'fund' as const, fund }));
    }
    const items: RenderItem[] = [];
    for (const [institution, funds] of groupedClearedFunds.entries()) {
      items.push({ type: 'divider' as const, institution, count: funds.length });
      if (!collapsedInstitutionGroups.has(institution)) {
        for (const fund of funds) {
          items.push({ type: 'fund' as const, fund });
        }
      }
    }
    return items;
  }, [isInstitutionGroupEnabled, groupedClearedFunds, clearedFunds, collapsedInstitutionGroups]);

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

  const handleCopyFundJson = async (fundId: number) => {
    const fund = funds.find((item) => item.id === fundId);
    if (!fund) {
      setContextMenu(null);
      return;
    }

    try {
      await copyTextToClipboard(JSON.stringify(fund, null, 2));
    } catch (error) {
      console.error('复制基金详情失败', error);
      alert(t('common.copyFailed') || '复制失败，请稍后重试');
    } finally {
      setContextMenu(null);
    }
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
    <div className="min-h-full pb-22 md:pb-16" onContextMenu={(e) => e.preventDefault()}>
      {selectedFund && (
        <FundDetail key="fund-detail" fund={selectedFund} onBack={() => setSelectedFund(null)} />
      )}

      {contextMenu && (
        <div
          className="fixed z-[100] w-48 origin-top-left overflow-hidden rounded-xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)]/98 py-2 shadow-[var(--app-shell-shadow)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100"
          style={{
            top: Math.min(contextMenu.y, window.innerHeight - 220),
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
            onClick={() => void handleCopyFundJson(contextMenu.fundId)}
            className="flex w-full items-center gap-2 border-b border-[var(--app-shell-line)] px-4 py-3 text-left text-sm text-slate-700 hover:bg-[var(--app-shell-panel-strong)] dark:border-border-dark dark:text-gray-200 dark:hover:bg-blue-900/20"
          >
            <Icons.Copy size={16} className="text-slate-500" />{' '}
            {t('common.copyFundJson') || '复制基金详情(JSON)'}
          </button>
          <button
            onClick={() => handleDelete(contextMenu.fundId)}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <Icons.Plus size={16} className="rotate-45 transform" /> {t('common.delete')}
          </button>
        </div>
      )}

      <div className="mx-auto w-full max-w-7xl px-0 pt-[max(2rem,calc(6rem-env(safe-area-inset-top,0px)))] md:px-4 md:pt-[max(4.75rem,calc(5rem-env(safe-area-inset-top,0px)))] lg:px-6">
        <div className="rounded-[1.75rem] border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)]/95 backdrop-blur-xl dark:border-border-dark dark:bg-card-dark/85 md:mt-2 md:shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
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

        <section className="relative mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_24rem] xl:grid-cols-[minmax(0,1fr)_26rem] md:mt-3">
          {/* 左侧大卡片：资产概览 */}
          <div className="glass-card relative flex flex-col justify-center overflow-hidden rounded-[2rem] px-5 py-6 md:px-8 md:py-8 min-h-[200px]">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-y-0 left-0 w-full bg-[radial-gradient(circle_at_top_left,_rgba(148,163,184,0.12),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(226,232,240,0.4),_transparent_28%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(96,165,250,0.12),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.10),_transparent_28%)]" />
            </div>

            <div className="relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[13px] font-medium tracking-wide text-slate-500 dark:text-gray-400">
                  <span>资产概览</span>
                  <button
                    onClick={() => setShowValues(!showValues)}
                    className="rounded-full bg-[var(--app-shell-panel-strong)]/50 p-1 text-slate-500 transition-colors hover:text-slate-800 dark:bg-white/5 dark:text-gray-400 dark:hover:text-gray-100"
                  >
                    {showValues ? <Icons.Eye size={16} /> : <Icons.EyeOff size={16} />}
                  </button>
                </div>

                {/* Refresh button aligned right */}
                <button
                  onClick={handleManualRefresh}
                  disabled={cooldown > 0 || isRefreshing}
                  className={`relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border transition-transform active:scale-95 ${
                    cooldown > 0 || isRefreshing
                      ? 'cursor-not-allowed border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] text-slate-500 dark:border-white/10 dark:bg-white/10 dark:text-gray-400'
                      : 'cursor-pointer border-[var(--app-shell-line-strong)] bg-[var(--app-shell-panel-strong)] text-slate-800 dark:border-blue-400/30 dark:bg-blue-500/15 dark:text-blue-100'
                  }`}
                >
                  <Icons.Refresh size={14} className={isRefreshing ? 'animate-spin' : ''} />
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

              <div className="mt-4 text-[11px] font-semibold tracking-wide text-slate-400 dark:text-gray-500">
                总资产 (CNY)
              </div>
              <div className="mt-1 text-4xl font-black tracking-[-0.04em] text-slate-900 dark:text-gray-50 md:text-[3.25rem] md:leading-tight">
                {showValues ? formatCurrency(summary.totalAssets) : '****'}
              </div>

              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)]/80 px-3.5 py-1.5 transition-colors dark:border-white/5 dark:bg-white/5">
                <span className="text-[12px] font-medium text-amber-600 dark:text-amber-500">
                  持有收益
                </span>
                <span className={`text-[13px] font-bold ${getSignColor(summary.holdingGain)}`}>
                  {showValues ? formatSignedCurrency(summary.holdingGain) : '****'}
                  <span className="ml-1 text-xs font-medium">
                    ({showValues ? formatPct(summary.holdingGainPct) : '****'})
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* 右侧卡片组 */}
          <div className="flex flex-col gap-3">
            {/* 顶部两个小卡片 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-card flex min-w-0 flex-1 flex-col justify-center rounded-[1.25rem] px-4 py-4 md:py-5">
                <div className="text-[10px] font-semibold tracking-[0.1em] text-slate-400 dark:text-gray-500">
                  当前账户
                </div>
                <div className="mt-1.5 truncate text-[15px] font-bold text-slate-800 dark:text-gray-100">
                  {activeFilterLabel}
                </div>
              </div>
              <div className="glass-card flex min-w-0 flex-1 flex-col justify-center rounded-[1.25rem] px-4 py-4 md:py-5">
                <div className="text-[10px] font-semibold tracking-[0.1em] text-slate-400 dark:text-gray-500">
                  持仓数量
                </div>
                <div className="mt-1.5 truncate text-[15px] font-bold text-slate-800 dark:text-gray-100">
                  {sortedFunds.length}
                </div>
              </div>
            </div>

            {/* 底部收益卡片 */}
            <div className="glass-card relative flex min-w-0 flex-1 flex-col justify-center overflow-hidden rounded-[1.5rem] border-l-[3px] border-l-blue-500 px-5 py-5 dark:border-l-blue-500">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold tracking-[0.1em] text-slate-400 dark:text-gray-500">
                  今日收益
                </div>
                <div className="rounded-lg bg-blue-500/10 p-1.5 text-blue-500 dark:bg-blue-500/20 dark:text-blue-400">
                  <Icons.TrendingUp size={16} />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span
                  className={`text-[2rem] font-black tracking-[-0.03em] ${getSignColor(summary.totalDayGain)}`}
                >
                  {showValues ? formatSignedCurrency(summary.totalDayGain) : '****'}
                </span>
                <span className="text-sm font-semibold tracking-wide text-slate-400 dark:text-gray-500">
                  {showValues ? formatPct(summary.totalDayGainPct) : '****'}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="glass-card mt-3 overflow-hidden rounded-3xl md:mt-5">
          <div className="z-10 border-b border-[var(--app-shell-line)] px-4 py-3 dark:border-border-dark md:px-5">
            <div className="hidden items-center gap-4 md:flex">
              <div className="flex min-w-[15rem] flex-[1.6] items-center gap-2 text-slate-400">
                <button
                  type="button"
                  onClick={() => setIsInstitutionGroupEnabled((prev) => !prev)}
                  className={`rounded-full border p-1.5 transition-colors ${
                    isInstitutionGroupEnabled
                      ? 'border-indigo-400 bg-indigo-50 text-indigo-600 dark:border-indigo-400/30 dark:bg-indigo-500/15 dark:text-indigo-200'
                      : 'border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] text-slate-400 hover:text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-500 dark:hover:text-gray-200'
                  }`}
                  aria-label={t('common.groupByInstitution')}
                >
                  <Icons.Layers size={14} />
                </button>
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
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsInstitutionGroupEnabled((prev) => !prev)}
                  className={`rounded-full border p-1.5 transition-colors ${
                    isInstitutionGroupEnabled
                      ? 'border-indigo-400 bg-indigo-50 text-indigo-600 dark:border-indigo-400/30 dark:bg-indigo-500/15 dark:text-indigo-200'
                      : 'border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-gray-500'
                  }`}
                  aria-label={t('common.groupByInstitution')}
                >
                  <Icons.Layers size={14} />
                </button>
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
              </div>
              <SortDropdown
                options={dashboardSortOptions}
                activeKey={sortState.key}
                direction={sortState.direction}
                onSelect={(key) => handleSort(key as DashboardSortKey)}
                onReset={handleResetSort}
              />
            </div>
          </div>

          <div className="overflow-hidden">
            {activeRenderItems.map((item) => {
              if (item.type === 'divider') {
                const isCollapsed = collapsedInstitutionGroups.has(item.institution);
                return (
                  <div
                    key={item.institution}
                    className="institution-group-divider group relative cursor-pointer select-none px-4 py-3 transition-all md:px-5 md:py-3.5"
                    onClick={() => toggleInstitutionGroupCollapse(item.institution)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={!isCollapsed}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleInstitutionGroupCollapse(item.institution);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icons.Layers className="h-5 w-5 text-indigo-600/80 dark:text-indigo-300/80" />
                        <span className="text-sm font-semibold text-indigo-700/90 dark:text-indigo-200/90">
                          {item.institution}
                        </span>
                        <span className="text-xs text-indigo-500/60 dark:text-indigo-400/60">
                          ({item.count})
                        </span>
                      </div>
                      <div className="text-indigo-600/80 dark:text-indigo-300/80">
                        {isCollapsed ? (
                          <Icons.ChevronDown className="h-5 w-5" />
                        ) : (
                          <Icons.ChevronUp className="h-5 w-5" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              }
              const fund = item.fund;
              const {
                marketValue: holdingValue,
                totalGain: totalReturn,
                totalGainPct: holdingGainPct,
                isInTransit,
                dayChangeBaseNav,
              } = getHoldingDisplayMetrics(fund);
              const officialDayChangePct = fund.officialDayChangePct ?? fund.dayChangePct;
              const todayChangePct =
                isInTransit || fund.todayChangeUnavailable
                  ? 0
                  : fund.todayChangePreOpen
                    ? 0
                    : fund.todayChangeIsEstimated
                      ? (fund.estimatedDayChangePct ?? 0)
                      : (fund.officialDayChangePct ?? fund.dayChangePct);
              const displayTodayGainVal =
                isInTransit || fund.todayChangeUnavailable
                  ? 0
                  : dayChangeBaseNav !== undefined
                    ? fund.todayChangeIsEstimated
                      ? (fund.holdingShares *
                          dayChangeBaseNav *
                          (fund.estimatedDayChangePct ?? 0)) /
                        100
                      : holdingValue - fund.holdingShares * dayChangeBaseNav
                    : fund.todayChangePreOpen
                      ? 0
                      : fund.todayChangeIsEstimated
                        ? (holdingValue * (fund.estimatedDayChangePct ?? 0)) / 100
                        : fund.dayChangeVal;
              const todayChangeTag = isInTransit
                ? t('common.inTransit') || '在途'
                : fund.todayChangePreOpen
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
              const isEtfLinkFund =
                fund.category === 'ETF_LINK' ||
                Boolean(fund.parentEtfInfo?.parentCode) ||
                isEtfLinkFundName(fund.name);

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
                        {(pendingCount > 0 || isInTransit) && (
                          <span className="rounded-full border border-amber-200 bg-amber-50/85 px-2 py-1 text-[10px] font-semibold tracking-[0.14em] text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-300">
                            {pendingCount > 0
                              ? `${pendingCount} ${t('common.inTransit')}`
                              : t('common.inTransit')}
                          </span>
                        )}
                        {isEtfLinkFund && (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50/85 px-2 py-1 text-[10px] font-semibold tracking-[0.14em] text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                            ETF联接
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

            {clearedFunds.length > 0 && (
              <div
                className="cleared-group-divider group relative cursor-pointer select-none px-4 py-3 transition-all md:px-5 md:py-3.5"
                onClick={handleToggleClearedGroup}
                role="button"
                tabIndex={0}
                aria-expanded={isClearedGroupExpanded}
                aria-label={t(
                  isClearedGroupExpanded
                    ? 'common.collapseClearedFunds'
                    : 'common.expandClearedFunds',
                )}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleToggleClearedGroup();
                  }
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icons.Archive className="h-5 w-5 text-emerald-700/80 dark:text-emerald-300/80" />
                    <span className="text-sm font-semibold text-emerald-800/90 dark:text-emerald-200/90">
                      {t('common.clearedFundsCount', { count: String(clearedFunds.length) })}
                    </span>
                  </div>
                  <div className="text-emerald-700/80 dark:text-emerald-300/80">
                    {isClearedGroupExpanded ? (
                      <Icons.ChevronUp className="h-5 w-5" />
                    ) : (
                      <Icons.ChevronDown className="h-5 w-5" />
                    )}
                  </div>
                </div>
              </div>
            )}

            <AnimatePresence>
              {isClearedGroupExpanded && clearedFunds.length > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  style={{ overflow: 'hidden' }}
                >
                  {clearedRenderItems.map((item) => {
                    if (item.type === 'divider') {
                      const isCollapsed = collapsedInstitutionGroups.has(item.institution);
                      return (
                        <div
                          key={item.institution}
                          className="institution-group-divider group relative cursor-pointer select-none px-4 py-3 transition-all md:px-5 md:py-3.5"
                          onClick={() => toggleInstitutionGroupCollapse(item.institution)}
                          role="button"
                          tabIndex={0}
                          aria-expanded={!isCollapsed}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              toggleInstitutionGroupCollapse(item.institution);
                            }
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Icons.Layers className="h-5 w-5 text-indigo-600/80 dark:text-indigo-300/80" />
                              <span className="text-sm font-semibold text-indigo-700/90 dark:text-indigo-200/90">
                                {item.institution}
                              </span>
                              <span className="text-xs text-indigo-500/60 dark:text-indigo-400/60">
                                ({item.count})
                              </span>
                            </div>
                            <div className="text-indigo-600/80 dark:text-indigo-300/80">
                              {isCollapsed ? (
                                <Icons.ChevronDown className="h-5 w-5" />
                              ) : (
                                <Icons.ChevronUp className="h-5 w-5" />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    const fund = item.fund;
                    const {
                      marketValue: holdingValue,
                      totalGain: totalReturn,
                      totalGainPct: holdingGainPct,
                      isInTransit,
                      dayChangeBaseNav,
                    } = getHoldingDisplayMetrics(fund);
                    const officialDayChangePct = fund.officialDayChangePct ?? fund.dayChangePct;
                    const todayChangePct =
                      isInTransit || fund.todayChangeUnavailable
                        ? 0
                        : fund.todayChangePreOpen
                          ? 0
                          : fund.todayChangeIsEstimated
                            ? (fund.estimatedDayChangePct ?? 0)
                            : (fund.officialDayChangePct ?? fund.dayChangePct);
                    const displayTodayGainVal =
                      isInTransit || fund.todayChangeUnavailable
                        ? 0
                        : dayChangeBaseNav !== undefined
                          ? fund.todayChangeIsEstimated
                            ? (fund.holdingShares *
                                dayChangeBaseNav *
                                (fund.estimatedDayChangePct ?? 0)) /
                              100
                            : holdingValue - fund.holdingShares * dayChangeBaseNav
                          : fund.todayChangePreOpen
                            ? 0
                            : fund.todayChangeIsEstimated
                              ? (holdingValue * (fund.estimatedDayChangePct ?? 0)) / 100
                              : fund.dayChangeVal;
                    const todayChangeTag = isInTransit
                      ? t('common.inTransit') || '在途'
                      : fund.todayChangePreOpen
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
                    const isEtfLinkFund =
                      fund.category === 'ETF_LINK' ||
                      Boolean(fund.parentEtfInfo?.parentCode) ||
                      isEtfLinkFundName(fund.name);

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
                              {(pendingCount > 0 || isInTransit) && (
                                <span className="rounded-full border border-amber-200 bg-amber-50/85 px-2 py-1 text-[10px] font-semibold tracking-[0.14em] text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-300">
                                  {pendingCount > 0
                                    ? `${pendingCount} ${t('common.inTransit')}`
                                    : t('common.inTransit')}
                                </span>
                              )}
                              {isEtfLinkFund && (
                                <span className="rounded-full border border-emerald-200 bg-emerald-50/85 px-2 py-1 text-[10px] font-semibold tracking-[0.14em] text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                                  ETF联接
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
                                    {t('common.nav')}:{' '}
                                    {displayMaskedValue(fund.currentNav.toFixed(4))}
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
                              <div
                                className={`text-sm font-semibold ${displayMetricColor(totalReturn)}`}
                              >
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
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        <section className="mt-3 px-4 pb-2 md:mt-5 md:px-0 md:pb-2">
          <div className="grid gap-3 md:grid-cols-[1.3fr_1fr]">
            <div className="glass-card flex flex-col justify-between rounded-[1.75rem] px-5 py-5 md:px-6 md:py-6">
              <div className="mb-4 flex items-center justify-between">
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

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const event = new CustomEvent('open-scanner');
                    window.dispatchEvent(event);
                  }}
                  className="flex min-h-[4.75rem] flex-col items-start justify-between rounded-2xl border border-[var(--app-shell-line-strong)] bg-blue-50 px-4 py-3 text-left text-slate-800 transition-colors hover:border-[var(--app-shell-line-strong)] dark:border-blue-400/20 dark:bg-blue-500/15 dark:text-blue-100 dark:hover:bg-blue-500/20"
                >
                  <Icons.Refresh size={18} />
                  <span className="text-sm font-semibold">{t('common.sync')}</span>
                </button>
                <button className="flex min-h-[4.75rem] flex-col items-start justify-between rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] px-4 py-3 text-left text-slate-700 transition-colors hover:border-[var(--app-shell-line-strong)] hover:bg-[var(--app-shell-panel-strong)] dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:border-white/20 dark:hover:bg-white/10">
                  <Icons.Copy size={18} />
                  <span className="text-sm font-semibold">{t('common.batch')}</span>
                </button>
              </div>
            </div>

            <button
              onClick={() => setIsAiAnalysisOpen(true)}
              className="glass-card group flex flex-col justify-center rounded-[1.75rem] px-5 py-5 text-left transition-transform hover:-translate-y-0.5 md:px-6 md:py-6"
            >
              <div className="flex w-full items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-600 shadow-none dark:border-transparent dark:bg-blue-500/15 dark:text-blue-200">
                    <Icons.Chat size={22} />
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold tracking-[0.2em] text-slate-400 dark:text-gray-500">
                      智能分析
                    </div>
                    <div className="mt-1 text-base font-semibold text-slate-900 dark:text-gray-50">
                      {t('common.aiHoldingAnalysis') || 'AI 持仓分析'}
                    </div>
                    <div className="mt-1 text-[13px] text-slate-500 dark:text-gray-400">
                      {t('common.aiHoldingAnalysisDesc') || '一键分析持仓表现与风险'}
                    </div>
                  </div>
                </div>
                <Icons.ArrowUp
                  size={18}
                  className="rotate-90 text-slate-400 transition-transform group-hover:translate-x-1 dark:text-gray-500"
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
      <AdjustPositionModal
        isOpen={!!adjustFund}
        onClose={() => setAdjustFund(null)}
        fund={adjustFund}
      />
      <RebalanceModal
        isOpen={!!rebalanceFund}
        onClose={() => setRebalanceFund(null)}
        sourceFund={rebalanceFund}
        funds={safeFunds}
      />
      <TransactionHistoryModal
        isOpen={!!historyFund}
        onClose={() => setHistoryFund(null)}
        fund={historyFund}
        onTransactionsDeleted={handleTransactionsDeleted}
      />
      <AiHoldingsAnalysisModal
        isOpen={isAiAnalysisOpen}
        onClose={() => setIsAiAnalysisOpen(false)}
        holdingsSnapshot={holdingsSnapshot}
      />
    </div>
  );
};
