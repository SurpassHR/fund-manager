import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, refreshWatchlistData } from '../services/db';
import { getSignColor, formatPct } from '../services/financeUtils';
import { Icons } from './Icon';
import { useTranslation } from '../services/i18n';
import type { WatchlistItem, Fund } from '../types';
import { AddWatchlistModal } from './AddWatchlistModal';
import { AddFundModal } from './AddFundModal';
import { FundDetail } from './FundDetail';
import { AnimatePresence } from 'framer-motion';
import { useSettings } from '../services/SettingsContext';
import { useUnifiedAutoRefresh } from '../services/refreshPolicy';

export const Watchlist: React.FC = () => {
  const watchlists = useLiveQuery(() => db.watchlists.toArray());
  const funds = useLiveQuery(() => db.funds.toArray());
  const { t } = useTranslation();
  const { autoRefresh } = useSettings();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WatchlistItem | undefined>(undefined);
  const [isAddFundOpen, setIsAddFundOpen] = useState(false);
  const [prefillWatchlistItem, setPrefillWatchlistItem] = useState<WatchlistItem | undefined>(
    undefined,
  );
  const [selectedItemForDetail, setSelectedItemForDetail] = useState<{
    fund: Fund;
    anchorDate: string;
    anchorPrice: number;
  } | null>(null);
  const [sortState, setSortState] = useState<{
    key: 'dayChangePct' | 'anchorGain' | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'desc' });

  const handleRowClick = (item: WatchlistItem) => {
    // Mock a Fund object for the detail view
    const fundData: Fund = {
      code: item.code,
      name: item.name,
      platform: item.platform || '自选',
      holdingShares: 0,
      costPrice: item.anchorPrice,
      currentNav: item.currentPrice,
      dayChangePct: item.dayChangePct,
      dayChangeVal: 0,
      lastUpdate: item.lastUpdate,
    };
    setSelectedItemForDetail({
      fund: fundData,
      anchorDate: item.anchorDate,
      anchorPrice: item.anchorPrice,
    });
  };

  // Refresh state
  const [cooldown, setCooldown] = useState(0);
  const cooldownMaxTime = 5000;
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { refreshStatus, isStale, lastSuccessAt, triggerRefresh } = useUnifiedAutoRefresh({
    scope: 'watchlist',
    enabled: autoRefresh,
    refresh: refreshWatchlistData,
  });

  const isRefreshing = refreshStatus === 'running';

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; itemId: number } | null>(
    null,
  );
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close context menu on global click
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const handleContextMenu = (e: React.MouseEvent, itemId: number) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, itemId });
  };

  const handleTouchStart = (itemId: number, e: React.TouchEvent) => {
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;

    longPressTimerRef.current = setTimeout(() => {
      setContextMenu({ x, y, itemId });
      if (navigator.vibrate) navigator.vibrate(50);
    }, 600);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleEdit = (item: WatchlistItem) => {
    setEditingItem(item);
    setIsAddModalOpen(true);
    setContextMenu(null);
  };

  const handleDelete = async (itemId: number) => {
    if (confirm(t('common.delete') + '?')) {
      await db.watchlists.delete(itemId);
    }
    setContextMenu(null);
  };

  const handleAddHolding = (item: WatchlistItem) => {
    if (isAddFundOpen) return;

    if (!item.id || !item.code || !item.name || item.currentPrice <= 0) {
      alert(t('common.addHoldingFromWatchlistInvalid'));
      return;
    }

    setPrefillWatchlistItem(item);
    setIsAddFundOpen(true);
    setContextMenu(null);
  };

  const handleAddFundModalClose = () => {
    setIsAddFundOpen(false);
    setPrefillWatchlistItem(undefined);
  };

  const handleManualRefresh = async () => {
    if (cooldown > 0 || isRefreshing) return;

    const startTime = Date.now();

    try {
      await triggerRefresh(true);
    } finally {
      const elapsed = Date.now() - startTime;
      if (elapsed < 1000) {
        await new Promise((res) => setTimeout(res, 1000 - elapsed));
      }

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

  const refreshStatusText =
    refreshStatus === 'running'
      ? t('common.refreshStatusRunning') || '刷新中'
      : refreshStatus === 'partial_failed'
        ? t('common.refreshStatusPartialFailed') || '部分失败'
        : refreshStatus === 'failed'
          ? t('common.refreshStatusFailed') || '刷新失败'
          : t('common.refreshStatusSuccess') || '已同步';

  const refreshFreshnessText = isStale
    ? t('common.refreshStatusStale') || '陈旧'
    : t('common.refreshStatusFresh') || '新鲜';

  const refreshLastSuccessText = lastSuccessAt
    ? new Date(lastSuccessAt).toLocaleTimeString()
    : t('common.refreshStatusNever') || '--';

  const handleSort = (key: 'dayChangePct' | 'anchorGain') => {
    setSortState((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'desc' };
    });
  };

  const sortedWatchlists = useMemo(() => {
    const list = watchlists ?? [];
    if (!sortState.key) return list;

    const getSortValue = (item: WatchlistItem) => {
      if (sortState.key === 'dayChangePct') return item.dayChangePct;
      if (item.anchorPrice <= 0) return 0;
      return ((item.currentPrice - item.anchorPrice) / item.anchorPrice) * 100;
    };

    const direction = sortState.direction === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      const diff = getSortValue(a) - getSortValue(b);
      if (diff === 0) return 0;
      return diff * direction;
    });
  }, [sortState.direction, sortState.key, watchlists]);

  if (!watchlists)
    return <div className="p-8 text-center text-gray-500">{t('common.loading')}</div>;

  return (
    <div
      className="pb-36 md:pb-24 bg-app-bg dark:bg-app-bg-dark min-h-full"
      onContextMenu={(e) => e.preventDefault()}
    >
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
              const i = watchlists.find((i) => i.id === contextMenu.itemId);
              if (i) handleEdit(i);
            }}
            className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-700 dark:text-gray-200 text-sm flex items-center gap-2 border-b border-gray-50 dark:border-border-dark"
          >
            <Icons.Settings size={16} className="text-blue-500" /> {t('common.edit')}
          </button>
          {(() => {
            const item = watchlists.find((i) => i.id === contextMenu.itemId);
            const isFund = item?.type === 'fund';
            const isHeld =
              !!item && (funds ?? []).some((f) => f.code === item.code && f.holdingShares > 0);
            if (!item || !isFund || isHeld) return null;

            return (
              <button
                onClick={() => handleAddHolding(item)}
                className="w-full text-left px-4 py-3 hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 dark:text-green-400 text-sm flex items-center gap-2 border-b border-gray-50 dark:border-border-dark"
              >
                <Icons.Plus size={16} /> {t('common.addHoldingFromWatchlist')}
              </button>
            );
          })()}
          <button
            onClick={() => handleDelete(contextMenu.itemId)}
            className="w-full text-left px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 text-sm flex items-center gap-2"
          >
            <Icons.Plus size={16} className="transform rotate-45" /> {t('common.delete')}
          </button>
        </div>
      )}

      {/* Header controls (similar to summary card style but smaller) */}
      <div className="bg-white dark:bg-card-dark md:rounded-lg md:shadow-sm px-4 py-3 mb-2 md:mb-6 mt-2 md:mt-4 mx-0 md:mx-0 flex justify-between items-start">
        <div>
          <div className="text-gray-800 dark:text-gray-100 font-bold text-lg">{t('common.watchlist')}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-sans">
            <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-600 dark:bg-white/10 dark:text-gray-300">
              {refreshStatusText}
            </span>
            <span
              className={`rounded-full px-2 py-1 ${isStale ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'}`}
            >
              {refreshFreshnessText}
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              {(t('common.refreshLastSuccess') || '上次成功')}：{refreshLastSuccessText}
            </span>
          </div>
        </div>
        <button
          onClick={handleManualRefresh}
          disabled={cooldown > 0 || isRefreshing}
          className={`relative flex items-center justify-center p-2 rounded-full bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 overflow-hidden active:scale-95 transition-transform ${cooldown > 0 || isRefreshing ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <Icons.Refresh size={16} className={`${isRefreshing ? 'animate-spin' : ''}`} />

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
      </div>

      {/* List Headers - Responsive */}
      <div className="bg-white dark:bg-card-dark md:rounded-t-lg px-4 py-3 flex items-center text-xs text-gray-400 border-b border-gray-100 dark:border-border-dark sticky top-[calc(3.5rem+40px)] md:top-14 z-10 shadow-sm font-sans">
        <div className="hidden md:flex md:flex-[1.5] gap-4 pr-2 items-center text-left">
          {t('common.fund')}/{t('common.indexOrSector')}
        </div>
        <div className="hidden md:grid md:flex-[4] w-full grid-cols-4 gap-4 text-right font-medium">
          <div className="text-left">
            {t('common.anchorPrice')} / {t('common.currentPrice')}
          </div>
          <button
            onClick={() => handleSort('dayChangePct')}
            className="text-right cursor-pointer hover:text-gray-600 flex items-center justify-end gap-1"
            type="button"
          >
            {t('common.dayChgPct')}
            {sortState.key === 'dayChangePct' && (
              <Icons.ArrowUp
                size={12}
                className={sortState.direction === 'asc' ? '' : 'rotate-180'}
              />
            )}
          </button>
          <div className="text-right"></div>
          <button
            onClick={() => handleSort('anchorGain')}
            className="text-right cursor-pointer hover:text-gray-600 flex items-center justify-end gap-1"
            type="button"
          >
            {t('common.anchorGain')}
            {sortState.key === 'anchorGain' && (
              <Icons.ArrowUp
                size={12}
                className={sortState.direction === 'asc' ? '' : 'rotate-180'}
              />
            )}
          </button>
        </div>

        {/* Mobile Headers */}
        <div className="md:hidden w-full flex items-center justify-between">
          <div className="flex-1 text-left">
            {t('common.fund')}/{t('common.indexOrSector')}
          </div>
          <div className="flex gap-2 text-right">
            <button
              onClick={() => handleSort('dayChangePct')}
              className="w-[4.5rem] cursor-pointer flex items-center justify-end gap-0.5"
              type="button"
            >
              {t('common.dayChgPct')}
              {sortState.key === 'dayChangePct' && (
                <Icons.ArrowUp
                  size={12}
                  className={sortState.direction === 'asc' ? '' : 'rotate-180'}
                />
              )}
            </button>
            <button
              onClick={() => handleSort('anchorGain')}
              className="w-[4.5rem] cursor-pointer flex items-center justify-end gap-0.5"
              type="button"
            >
              {t('common.anchorGain')}
              {sortState.key === 'anchorGain' && (
                <Icons.ArrowUp
                  size={12}
                  className={sortState.direction === 'asc' ? '' : 'rotate-180'}
                />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="bg-white dark:bg-card-dark md:rounded-b-lg flex flex-col md:divide-y md:divide-gray-50 dark:md:divide-border-dark">
        {watchlists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-4">
            <Icons.User size={48} strokeWidth={1} className="opacity-50" />
            <p className="text-sm">{t('common.noWatchlistMsg')}</p>
          </div>
        ) : (
          sortedWatchlists.map((item) => {
            const anchorGainPct =
              item.anchorPrice > 0
                ? ((item.currentPrice - item.anchorPrice) / item.anchorPrice) * 100
                : 0;

            return (
              <div
                key={item.id}
                onContextMenu={(e) => item.id && handleContextMenu(e, item.id)}
                onTouchStart={(e) => item.id && handleTouchStart(item.id, e)}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                onClick={() => handleRowClick(item)}
                className={`group flex md:flex-row py-4 px-4 border-b border-gray-50 dark:border-border-dark md:border-none md:hover:bg-gray-50 dark:md:hover:bg-white/5 transition-colors items-start select-none cursor-pointer ${contextMenu?.itemId === item.id ? 'bg-gray-100 dark:bg-white/10' : ''}`}
              >
                {/* Common: Name Section */}
                <div className="flex-1 min-w-0 pr-2 md:flex-[1.5] md:self-center">
                  <div className="hidden md:flex items-center gap-2">
                    <span className="text-[10px] px-1 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-sans">
                      {item.code}
                    </span>
                    <span
                      className={`text-[10px] px-1 py-0.5 rounded font-sans whitespace-nowrap ${item.type === 'index' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400' : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400'}`}
                    >
                      {item.type === 'index' ? t('common.indexBadge') : t('common.fundBadge')}
                    </span>
                    <h3 className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate font-sans">
                      {item.name}
                    </h3>
                  </div>

                  {/* Mobile Name View */}
                  <div className="md:hidden flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate leading-tight font-sans">
                        {item.name}
                      </h3>
                      <span
                        className={`text-[9px] px-1 py-0.5 rounded font-bold whitespace-nowrap ${item.type === 'index' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400' : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400'}`}
                      >
                        {item.type === 'index'
                          ? t('common.indexBadgeShort')
                          : t('common.fundBadgeShort')}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pr-2">
                      <span className="text-xs text-gray-400 font-sans">{item.code}</span>
                    </div>
                  </div>
                </div>

                {/* Desktop Grid Layout */}
                <div className="hidden md:grid flex-[4] w-full grid-cols-4 gap-4 text-right items-start text-sm">
                  <div className="text-left text-gray-500 text-xs">
                    <div className="font-sans flex items-center gap-1">
                      {item.anchorPrice.toFixed(4)}
                      <span className="text-[10px] text-gray-400 bg-gray-50 dark:bg-white/5 px-1 rounded">
                        {item.anchorDate}
                      </span>
                    </div>
                    <div className="font-sans text-gray-400">{item.currentPrice.toFixed(4)}</div>
                  </div>
                  <div className={`font-medium font-sans ${getSignColor(item.dayChangePct)}`}>
                    {formatPct(item.dayChangePct)}
                  </div>
                  <div className="text-right"></div>
                  <div className={`font-bold font-sans ${getSignColor(anchorGainPct)}`}>
                    {formatPct(anchorGainPct)}
                  </div>
                </div>

                {/* Mobile Flex Layout */}
                <div className="md:hidden flex flex-none gap-2 text-right items-start">
                  <div className="w-[4.5rem] flex flex-col items-end">
                    <div
                      className={`text-base font-bold font-sans ${getSignColor(item.dayChangePct)}`}
                    >
                      {formatPct(item.dayChangePct)}
                    </div>
                    <div className="text-[10px] text-gray-400 font-sans">
                      {t('common.currentLabel')} {item.currentPrice.toFixed(4)}
                    </div>
                  </div>

                  <div className="w-[5rem] flex flex-col items-end">
                    <div className={`text-base font-bold font-sans ${getSignColor(anchorGainPct)}`}>
                      {formatPct(anchorGainPct)}
                    </div>
                    <div className="text-[10px] text-gray-400 font-sans flex flex-col items-end">
                      {t('common.anchorLabel')} {item.anchorPrice.toFixed(4)}
                      <span className="scale-90 origin-right opacity-70">({item.anchorDate})</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Add Action */}
      <div className="mt-2 flex bg-white dark:bg-card-dark md:bg-transparent md:dark:bg-transparent md:mt-4 py-3 px-4 md:px-0 text-gray-500 dark:text-gray-400 text-sm items-center justify-between md:justify-start md:gap-4 font-sans">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setEditingItem(undefined);
            setIsAddModalOpen(true);
          }}
          className="flex items-center gap-1 md:bg-white md:dark:bg-card-dark md:px-4 md:py-2 md:rounded-lg md:shadow-sm md:hover:bg-gray-50 md:dark:hover:bg-white/5 transition-colors"
        >
          <Icons.Plus size={16} /> {t('common.addWatchlist')}
        </button>
      </div>

      <AddWatchlistModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        editItem={editingItem}
      />
      <AddFundModal
        isOpen={isAddFundOpen}
        onClose={handleAddFundModalClose}
        prefillWatchlistItem={prefillWatchlistItem}
      />

      <AnimatePresence>
        {selectedItemForDetail && (
          <FundDetail
            key={`watchlist-detail-${selectedItemForDetail.fund.code}`}
            fund={selectedItemForDetail.fund}
            anchorDate={selectedItemForDetail.anchorDate}
            anchorPrice={selectedItemForDetail.anchorPrice}
            onBack={() => setSelectedItemForDetail(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
