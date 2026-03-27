import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, initDB, calculateSummary } from '../services/db';
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
import { refreshHoldingsWithStrategy } from '../services/refreshOrchestrator';

export const Dashboard: React.FC = () => {
  const funds = useLiveQuery(() => db.funds.toArray());
  const accounts = useLiveQuery(() => db.accounts.toArray());
  const [activeFilter, setActiveFilter] = useState('All');
  const [showValues, setShowValues] = useState(true);
  const [sortState, setSortState] = useState<{
    key:
      | 'officialDayChangePct'
      | 'estimatedDayChangePct'
      | 'todayGain'
      | 'totalGain'
      | 'marketValue'
      | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'desc' });
  const [isAiAnalysisOpen, setIsAiAnalysisOpen] = useState(false);
  const { autoRefresh, useUnifiedRefresh } = useSettings();

  // Refresh mechanism state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cooldown, setCooldown] = useState(0); // Cooldown percentage 0-100
  const cooldownMaxTime = 5000; // 5 seconds cooldown
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // State for Detail View
  const [selectedFund, setSelectedFund] = useState<Fund | null>(null);

  // Modals
  const [isAccountManagerOpen, setIsAccountManagerOpen] = useState(false);
  const [isAddFundOpen, setIsAddFundOpen] = useState(false);
  const [editingFund, setEditingFund] = useState<Fund | undefined>(undefined);
  const [adjustFund, setAdjustFund] = useState<Fund | null>(null);
  const [rebalanceFund, setRebalanceFund] = useState<Fund | null>(null);
  const [historyFund, setHistoryFund] = useState<Fund | null>(null);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; fundId: number } | null>(
    null,
  );
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    initDB();

    const doRefresh = (force?: boolean) =>
      refreshHoldingsWithStrategy({ force, useUnifiedRefresh }).then(() => {
        sessionStorage.setItem('lastAutoUpdate_timestamp', Date.now().toString());
      });

    const shouldAutoRefresh = () => {
      const lastAutoUpdateStr = sessionStorage.getItem('lastAutoUpdate_timestamp');
      const now = Date.now();
      const lastAutoUpdate = lastAutoUpdateStr ? parseInt(lastAutoUpdateStr) : 0;
      return !lastAutoUpdateStr || Number.isNaN(lastAutoUpdate) || now - lastAutoUpdate > 60000;
    };

    if (document.visibilityState === 'visible' && shouldAutoRefresh()) {
      doRefresh();
    }

    let autoUpdateTimer: ReturnType<typeof setInterval> | null = null;

    const startAutoRefresh = () => {
      if (!autoRefresh) return;
      if (autoUpdateTimer) clearInterval(autoUpdateTimer);
      autoUpdateTimer = setInterval(() => {
        if (document.visibilityState !== 'visible') return;
        doRefresh();
      }, 15000);
    };

    const stopAutoRefresh = () => {
      if (autoUpdateTimer) {
        clearInterval(autoUpdateTimer);
        autoUpdateTimer = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (shouldAutoRefresh()) {
          doRefresh();
        }
        startAutoRefresh();
      } else {
        stopAutoRefresh();
      }
    };

    startAutoRefresh();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopAutoRefresh();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [autoRefresh, useUnifiedRefresh]);

  // Close context menu on global click
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // 移除这里提前 return FundDetail 的逻辑，改为在下方主渲染中使用 AnimatePresence
  // if (selectedFund) {
  //     return <FundDetail fund={selectedFund} onBack={() => setSelectedFund(null)} />;
  // }

  const safeFunds = funds || [];
  const safeAccounts = accounts || [];

  const filteredFunds =
    activeFilter === 'All' ? safeFunds : safeFunds.filter((f) => f.platform === activeFilter);

  const summary = calculateSummary(filteredFunds);
  const filterList =
    safeAccounts.length > 1
      ? ['All', ...safeAccounts.map((a) => a.name)]
      : safeAccounts.map((a) => a.name);

  const latestDateStr = filteredFunds.reduce((max, f) => {
    if (!f.lastUpdate) return max;
    return f.lastUpdate > max ? f.lastUpdate : max;
  }, '');
  const displayDate = latestDateStr ? latestDateStr.substring(5) : 'Today';
  const todayStr = getLocalDateString();

  const handleSort = (
    key:
      | 'officialDayChangePct'
      | 'estimatedDayChangePct'
      | 'todayGain'
      | 'totalGain'
      | 'marketValue',
  ) => {
    setSortState((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'desc' };
    });
  };

  const sortedFunds = useMemo(() => {
    if (!sortState.key) return filteredFunds;

    const getSortValue = (fund: Fund) => {
      const holdingValue = fund.holdingShares * fund.currentNav;
      if (sortState.key === 'marketValue') return holdingValue;
      if (sortState.key === 'totalGain') {
        const estimateGainVal = (holdingValue * (fund.estimatedDayChangePct ?? 0)) / 100;
        return holdingValue - fund.holdingShares * fund.costPrice + estimateGainVal;
      }
      if (sortState.key === 'todayGain') return fund.dayChangeVal;
      if (sortState.key === 'estimatedDayChangePct') return fund.dayChangePct;
      return fund.officialDayChangePct ?? fund.dayChangePct;
    };

    const direction = sortState.direction === 'asc' ? 1 : -1;
    return [...filteredFunds].sort((a, b) => {
      const diff = getSortValue(a) - getSortValue(b);
      if (diff === 0) return 0;
      return diff * direction;
    });
  }, [filteredFunds, sortState.direction, sortState.key]);

  if (!funds || !accounts)
    return <div className="p-8 text-center text-gray-500">{t('common.loading')}</div>;

  // --- Handlers ---

  const handleContextMenu = (e: React.MouseEvent, fundId: number) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent triggering row click
    setContextMenu({ x: e.clientX, y: e.clientY, fundId });
  };

  const handleTouchStart = (fundId: number, e: React.TouchEvent) => {
    // e.persist(); // Not strictly needed in modern React but good for safety if accessing event in timer
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;

    longPressTimerRef.current = setTimeout(() => {
      setContextMenu({ x, y, fundId });
      // Vibrate if supported
      if (navigator.vibrate) navigator.vibrate(50);
    }, 600); // 600ms long press
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
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
    // If context menu is open, don't select fund
    if (contextMenu) return;
    setSelectedFund(fund);
  };

  const handleManualRefresh = async () => {
    if (cooldown > 0 || isRefreshing) return;

    setIsRefreshing(true);
    const startTime = Date.now();

    try {
      await refreshHoldingsWithStrategy({ force: true, useUnifiedRefresh });
    } finally {
      // Ensure minimum rotation visibly
      const elapsed = Date.now() - startTime;
      if (elapsed < 1000) {
        await new Promise((res) => setTimeout(res, 1000 - elapsed));
      }
      setIsRefreshing(false);

      // Start cooldown
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
      }, 16); // High frequency update for smoother animation
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
    <div
      className="pb-36 md:pb-24 bg-app-bg dark:bg-app-bg-dark min-h-full"
      onContextMenu={(e) => e.preventDefault()}
    >
      <AnimatePresence>
        {selectedFund && (
          <FundDetail key="fund-detail" fund={selectedFund} onBack={() => setSelectedFund(null)} />
        )}
      </AnimatePresence>

      {/* Context Menu Overlay */}
      {contextMenu && (
        <div
          className="fixed z-[100] bg-white dark:bg-card-dark rounded-lg shadow-xl border border-gray-100 dark:border-border-dark py-2 w-48 overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-left"
          style={{
            top: Math.min(contextMenu.y, window.innerHeight - 150),
            left: Math.min(contextMenu.x, window.innerWidth - 200),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-2 text-xs font-bold text-gray-400 bg-gray-50 dark:bg-white/5 border-b border-gray-100 dark:border-border-dark mb-1">
            {t('common.menu')}
          </div>
          <button
            onClick={() => {
              const f = funds.find((i) => i.id === contextMenu.fundId);
              if (f) handleEdit(f);
            }}
            className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-700 dark:text-gray-200 text-sm flex items-center gap-2 border-b border-gray-50 dark:border-border-dark"
          >
            <Icons.Settings size={16} className="text-blue-500" /> {t('common.edit')}
          </button>
          <button
            onClick={() => {
              const f = funds.find((i) => i.id === contextMenu.fundId);
              if (f) {
                setRebalanceFund(f);
                setContextMenu(null);
              }
            }}
            className="w-full text-left px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-gray-700 dark:text-gray-200 text-sm flex items-center gap-2 border-b border-gray-50 dark:border-border-dark"
          >
            <Icons.ArrowDown size={16} className="text-indigo-500" /> {t('common.rebalance')}
          </button>
          <button
            onClick={() => {
              const f = funds.find((i) => i.id === contextMenu.fundId);
              if (f) {
                setAdjustFund(f);
                setContextMenu(null);
              }
            }}
            className="w-full text-left px-4 py-3 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-gray-700 dark:text-gray-200 text-sm flex items-center gap-2 border-b border-gray-50 dark:border-border-dark"
          >
            <Icons.TrendingUp size={16} className="text-amber-500" /> {t('common.adjustPosition')}
          </button>
          <button
            onClick={() => {
              const f = funds.find((i) => i.id === contextMenu.fundId);
              if (f) {
                setHistoryFund(f);
                setContextMenu(null);
              }
            }}
            className="w-full text-left px-4 py-3 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-gray-700 dark:text-gray-200 text-sm flex items-center gap-2 border-b border-gray-50 dark:border-border-dark"
          >
            <Icons.Grid size={16} className="text-purple-500" />{' '}
            {t('common.transactionHistory') || '交易记录'}
          </button>
          <button
            onClick={() => handleDelete(contextMenu.fundId)}
            className="w-full text-left px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 text-sm flex items-center gap-2"
          >
            <Icons.Plus size={16} className="transform rotate-45" /> {t('common.delete')}
          </button>
        </div>
      )}

      {/* Top Filter Bar */}
      <div className="bg-white dark:bg-card-dark px-2 pt-1 pb-2 md:rounded-b-lg md:shadow-sm md:mb-4 flex items-center gap-4 overflow-x-auto no-scrollbar border-b border-gray-100 dark:border-border-dark md:border-none sticky top-14 z-20">
        <div className="flex-shrink-0 text-gray-500 dark:text-gray-400 font-medium text-sm px-2">
          {t('common.account')}
        </div>
        {filterList.map((filterKey) => {
          let label = filterKey;
          if (filterKey === 'All') label = t('common.all') || 'All';
          else if (t(`filters.${filterKey}`) !== `filters.${filterKey}`)
            label = t(`filters.${filterKey}`);

          return (
            <button
              key={filterKey}
              onClick={() => setActiveFilter(filterKey)}
              className={`flex-shrink-0 px-1 py-2 text-sm font-medium relative whitespace-nowrap transition-colors ${
                activeFilter === filterKey
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {label}
              {activeFilter === filterKey && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
              )}
            </button>
          );
        })}
        <div className="flex-grow" />
        <button
          onClick={() => setIsAccountManagerOpen(true)}
          className="p-2 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-700 dark:hover:text-gray-200 rounded-full transition-colors"
        >
          <Icons.Menu size={20} />
        </button>
      </div>

      {/* Asset Summary Card */}
      <div className="bg-white dark:bg-card-dark md:rounded-lg md:shadow-sm px-4 py-4 mb-2 md:mb-6 mx-0 md:mx-0">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2 text-gray-500 text-sm font-sans">
            <div className="flex items-center gap-2">
              <span>{t('common.totalAssets')}</span>
              <button
                onClick={() => setShowValues(!showValues)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                {showValues ? <Icons.Eye size={20} /> : <Icons.EyeOff size={20} />}
              </button>
            </div>
          </div>
          <div className="flex gap-2 relative">
            <button
              onClick={handleManualRefresh}
              disabled={cooldown > 0 || isRefreshing}
              className={`relative flex items-center justify-center p-1 rounded-full bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 overflow-hidden active:scale-95 transition-transform ${cooldown > 0 || isRefreshing ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              style={{ width: '28px', height: '28px' }}
            >
              <Icons.Refresh size={14} className={`${isRefreshing ? 'animate-spin' : ''}`} />

              {/* Cooldown overlay (Light mode) */}
              {cooldown > 0 && !isRefreshing && (
                <div
                  className="absolute inset-0 dark:hidden"
                  style={{
                    background: `conic-gradient(transparent ${100 - cooldown}%, rgba(0,0,0,0.2) ${100 - cooldown}%, rgba(0,0,0,0.2) 100%)`,
                  }}
                />
              )}
              {/* Cooldown overlay (Dark mode) */}
              {cooldown > 0 && !isRefreshing && (
                <div
                  className="absolute inset-0 hidden dark:block"
                  style={{
                    background: `conic-gradient(transparent ${100 - cooldown}%, rgba(0,0,0,0.7) ${100 - cooldown}%, rgba(0,0,0,0.7) 100%)`,
                  }}
                />
              )}
            </button>
            <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-xs bg-gray-50 dark:bg-white/10 px-2 py-1 rounded-full hover:bg-gray-100 dark:hover:bg-white/15 font-sans transition-colors">
              <span>{t('common.dayGain')}</span>
              <Icons.ArrowUp className="transform rotate-90" size={12} />
            </div>
          </div>
        </div>

        <div className="flex justify-between items-start gap-2">
          <div className="flex flex-col gap-1">
            <div className="text-3xl font-bold text-gray-800 dark:text-gray-100 tracking-tight font-sans">
              {showValues ? formatCurrency(summary.totalAssets) : '****'}
            </div>
            <div className={`text-sm font-medium font-sans ${getSignColor(summary.holdingGain)}`}>
              {t('common.totalGain')}:{' '}
              {showValues ? formatSignedCurrency(summary.holdingGain) : '****'}
              <span className="ml-1 text-xs">
                ({showValues ? formatPct(summary.holdingGainPct) : '****'})
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 mt-1">
            <div
              className={`text-xl font-bold font-sans ${getSignColor(summary.totalDayGain)} flex items-baseline gap-1`}
            >
              {showValues ? formatSignedCurrency(summary.totalDayGain) : '****'}
              <span className="text-sm font-normal text-gray-400 font-sans">{displayDate}</span>
            </div>
          </div>
        </div>
      </div>

      {/* List Headers - Responsive */}
      <div className="bg-white dark:bg-card-dark md:rounded-t-lg px-4 py-3 flex items-center text-xs text-gray-400 border-b border-gray-100 dark:border-border-dark sticky top-[calc(3.5rem+40px)] md:top-14 z-10 shadow-sm font-sans">
        <div className="hidden md:flex md:flex-[1.5] gap-4 pr-2 items-center">
          <button className="hover:text-gray-600">
            <Icons.Settings size={16} />
          </button>
          <button className="hover:text-gray-600">
            <Icons.Bell size={16} />
          </button>
          <button className="hover:text-gray-600">
            <Icons.Grid size={16} />
          </button>
          <button className="hover:text-gray-600">
            <Icons.Holdings size={16} />
          </button>
        </div>

        <div className="hidden md:grid md:flex-[5] w-full grid-cols-6 gap-4 text-right font-medium">
          <div className="text-left">
            {t('common.cost')} / {t('common.nav')}
          </div>
          <button
            onClick={() => handleSort('officialDayChangePct')}
            className="text-right cursor-pointer hover:text-gray-600 flex items-center justify-end gap-1"
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
            className="text-right cursor-pointer hover:text-gray-600 flex items-center justify-end gap-1"
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
            className="text-right cursor-pointer hover:text-gray-600 flex items-center justify-end gap-1"
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
            className="text-right cursor-pointer hover:text-gray-600 flex items-center justify-end gap-1"
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
            className="text-right cursor-pointer hover:text-gray-600 flex items-center justify-end gap-1"
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

        {/* Mobile Headers */}
        <div className="md:hidden w-full flex items-center justify-between">
          <div className="flex-1 text-left">{t('common.fund')}</div>
          <div className="flex gap-2 text-right">
            <button
              onClick={() => handleSort('officialDayChangePct')}
              className="w-[6.25rem] cursor-pointer flex items-center justify-end gap-0.5"
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
              className="w-[6.25rem] cursor-pointer flex items-center justify-end gap-0.5"
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

      {/* Fund List */}
      <div className="bg-white dark:bg-card-dark md:rounded-b-lg flex flex-col md:divide-y md:divide-gray-50 dark:md:divide-border-dark">
        {sortedFunds.map((fund) => {
          const holdingValue = fund.holdingShares * fund.currentNav;
          const totalCost = fund.holdingShares * fund.costPrice;
          const totalReturn = holdingValue - totalCost;
          const officialDayChangePct = fund.officialDayChangePct ?? fund.dayChangePct;
          const todayChangePct = fund.dayChangePct;
          const estimatedGainVal = (holdingValue * (fund.estimatedDayChangePct ?? 0)) / 100;
          const adjustedHoldingGain = totalReturn + estimatedGainVal;
          const adjustedHoldingGainPct =
            totalCost !== 0 ? (adjustedHoldingGain / totalCost) * 100 : 0;
          const todayChangeTag = fund.todayChangeIsEstimated
            ? t('common.estimated') || '估值'
            : fund.lastUpdate === todayStr
              ? t('common.updated') || '已更新'
              : '';
          const displayPlatform =
            t(`filters.${fund.platform}`) === `filters.${fund.platform}`
              ? fund.platform
              : t(`filters.${fund.platform}`);

          return (
            <div
              key={fund.id}
              onClick={() => handleRowClick(fund)}
              onContextMenu={(e) => fund.id && handleContextMenu(e, fund.id)}
              onTouchStart={(e) => fund.id && handleTouchStart(fund.id, e)}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
              className={`group flex md:flex-row py-4 px-4 border-b border-gray-50 dark:border-border-dark md:border-none active:bg-gray-50 dark:active:bg-white/5 md:hover:bg-gray-50 dark:md:hover:bg-white/5 transition-colors cursor-pointer items-start select-none ${
                contextMenu?.fundId === fund.id ? 'bg-gray-100 dark:bg-white/10' : ''
              }`}
            >
              {/* Common: Name Section */}
              <div className="flex-1 min-w-0 pr-2 md:flex-[1.5] md:self-center">
                <div className="hidden md:flex items-center gap-2">
                  <span className="text-[10px] px-1 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-sans">
                    {fund.code}
                  </span>
                  <span className="text-[10px] px-1 py-0.5 rounded bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 font-sans whitespace-nowrap min-w-[4.5em] max-w-[7.5em] truncate text-center">
                    {displayPlatform}
                  </span>
                  <h3 className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate font-sans">
                    {fund.name}
                  </h3>
                </div>

                {/* Mobile Name View */}
                <div className="md:hidden flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate leading-tight font-sans">
                      {fund.name}
                    </h3>
                    {(fund.pendingTransactions || []).filter((tx) => !tx.settled).length > 0 && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 font-bold whitespace-nowrap">
                        {(fund.pendingTransactions || []).filter((tx) => !tx.settled).length}{' '}
                        {t('common.inTransit')}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between items-center pr-2">
                    <span className="text-xs text-gray-400 font-sans">{fund.code}</span>
                    <span className="text-xs text-gray-400 font-sans">
                      ¥{formatCurrency(holdingValue)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Desktop Grid Layout */}
              <div className="hidden md:grid flex-[5] w-full grid-cols-6 gap-4 text-right items-start text-sm">
                <div className="text-left text-gray-500 text-xs">
                  <div className="font-sans">{formatCurrency(fund.costPrice, 4)}</div>
                  <div className="font-sans text-gray-400">{fund.currentNav.toFixed(4)}</div>
                </div>
                <div className={`font-medium font-sans ${getSignColor(officialDayChangePct)}`}>
                  {formatPct(officialDayChangePct)}
                </div>
                <div className={`font-medium font-sans ${getSignColor(todayChangePct)}`}>
                  {formatPct(todayChangePct)}
                  {todayChangeTag && (
                    <span className="ml-1 text-[10px] text-gray-500 dark:text-gray-400">
                      {todayChangeTag}
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className={`font-medium font-sans ${getSignColor(fund.dayChangeVal)}`}>
                    {formatSignedCurrency(fund.dayChangeVal)}
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <div className={`font-medium font-sans ${getSignColor(adjustedHoldingGain)}`}>
                    {formatSignedCurrency(adjustedHoldingGain)}
                  </div>
                  <div className={`text-[10px] font-sans ${getSignColor(adjustedHoldingGainPct)}`}>
                    {formatPct(adjustedHoldingGainPct)}
                  </div>
                </div>
                <div className="font-bold text-gray-800 dark:text-gray-100 font-sans">
                  {formatCurrency(holdingValue)}
                </div>
              </div>

              {/* Mobile Flex Layout */}
              <div className="md:hidden flex flex-none gap-3 text-right items-start">
                <div className="w-[6.25rem] flex flex-col items-end">
                  <div
                    className={`text-base font-bold font-sans leading-none ${getSignColor(officialDayChangePct)}`}
                  >
                    {formatPct(officialDayChangePct)}
                  </div>
                  <div className="text-[10px] text-gray-400 font-sans">
                    {t('common.yesterdayChangePct') || '昨日涨幅'}
                  </div>
                </div>

                <div className="w-[6.25rem] flex flex-col items-end">
                  <div
                    className={`text-base font-bold font-sans leading-none ${getSignColor(todayChangePct)}`}
                  >
                    {formatPct(todayChangePct)}
                  </div>
                  <div className="text-[10px] text-gray-400 font-sans">
                    {todayChangeTag || t('common.todayChangePct') || '今日涨幅'}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex bg-white dark:bg-card-dark md:bg-transparent md:dark:bg-transparent md:mt-4 py-3 px-4 md:px-0 text-gray-500 dark:text-gray-400 text-sm items-center justify-between md:justify-start md:gap-4 font-sans">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setEditingFund(undefined);
            setIsAddFundOpen(true);
          }}
          className="flex items-center gap-1 md:bg-white md:dark:bg-card-dark md:px-4 md:py-2 md:rounded-lg md:shadow-sm md:hover:bg-gray-50 md:dark:hover:bg-white/5 transition-colors"
        >
          <Icons.Plus size={16} /> {t('common.addFund')}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            const event = new CustomEvent('open-scanner');
            window.dispatchEvent(event);
          }}
          className="flex items-center gap-1 md:bg-white md:dark:bg-card-dark md:px-4 md:py-2 md:rounded-lg md:shadow-sm md:hover:bg-gray-50 md:dark:hover:bg-white/5 transition-colors"
        >
          <Icons.Refresh size={14} /> {t('common.sync')}
        </button>
        <button className="flex items-center gap-1 md:bg-white md:dark:bg-card-dark md:px-4 md:py-2 md:rounded-lg md:shadow-sm md:hover:bg-gray-50 md:dark:hover:bg-white/5 transition-colors">
          {t('common.batch')} <Icons.Copy size={14} />
        </button>
      </div>

      <div className="px-4 pt-4">
        <button
          onClick={() => setIsAiAnalysisOpen(true)}
          className="w-full flex items-center justify-between px-4 py-4 bg-white dark:bg-card-dark rounded-xl shadow-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
              <Icons.Chat size={18} className="text-blue-600 dark:text-blue-300" />
            </div>
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
                {t('common.aiHoldingAnalysis') || 'AI 持仓分析'}
              </span>
              <span className="text-xs text-gray-400">
                {t('common.aiHoldingAnalysisDesc') || '一键分析持仓表现与风险'}
              </span>
            </div>
          </div>
          <Icons.ArrowUp size={16} className="text-gray-400 rotate-90" />
        </button>
      </div>

      <AccountManagerModal
        isOpen={isAccountManagerOpen}
        onClose={() => setIsAccountManagerOpen(false)}
      />
      <AddFundModal
        isOpen={isAddFundOpen}
        onClose={() => setIsAddFundOpen(false)}
        editFund={editingFund}
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
