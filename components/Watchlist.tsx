import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, refreshFundData, refreshWatchlistData } from '../services/db';
import { getSignColor, formatPct } from '../services/financeUtils';
import { Icons } from './Icon';
import { useTranslation } from '../services/i18n';
import type { WatchlistItem, Fund } from '../types';
import { AddWatchlistModal } from './AddWatchlistModal';
import { AddFundModal } from './AddFundModal';
import { FundDetail } from './FundDetail';
import { AnimatePresence } from 'framer-motion';
import { hasTouchMovedBeyondThreshold } from '../services/longPressGesture';

const LONG_PRESS_DURATION_MS = 600;
const TOUCH_MOVE_CANCEL_THRESHOLD_PX = 12;

export const Watchlist: React.FC = () => {
  const watchlists = useLiveQuery(() => db.watchlists.toArray());
  const funds = useLiveQuery(() => db.funds.toArray());
  const { t } = useTranslation();

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

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownMaxTime = 5000;
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; itemId: number } | null>(
    null,
  );
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPointRef = useRef<{ x: number; y: number } | null>(null);
  const isScrollGestureRef = useRef(false);

  useEffect(() => {
    refreshWatchlistData();
  }, []);

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
      setContextMenu({ x, y, itemId });
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

    setIsRefreshing(true);
    const startTime = Date.now();

    try {
      await refreshWatchlistData({ force: true });
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

  if (!watchlists) {
    return <div className="p-8 text-center text-gray-500">{t('common.loading')}</div>;
  }

  return (
    <div className="min-h-full pb-36 md:pb-24" onContextMenu={(e) => e.preventDefault()}>
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
              const item = watchlists.find((entry) => entry.id === contextMenu.itemId);
              if (item) handleEdit(item);
            }}
            className="flex w-full items-center gap-2 border-b border-[var(--app-shell-line)] px-4 py-3 text-left text-sm text-slate-700 hover:bg-[var(--app-shell-panel-strong)] dark:border-border-dark dark:text-gray-200 dark:hover:bg-blue-900/20"
          >
            <Icons.Settings size={16} className="text-slate-500" /> {t('common.edit')}
          </button>
          {(() => {
            const item = watchlists.find((entry) => entry.id === contextMenu.itemId);
            const isFund = item?.type === 'fund';
            const isHeld =
              !!item &&
              (funds ?? []).some((fund) => fund.code === item.code && fund.holdingShares > 0);
            if (!item || !isFund || isHeld) return null;

            return (
              <button
                onClick={() => handleAddHolding(item)}
                className="flex w-full items-center gap-2 border-b border-gray-50 px-4 py-3 text-left text-sm text-green-600 hover:bg-green-50 dark:border-border-dark dark:text-green-400 dark:hover:bg-green-900/20"
              >
                <Icons.Plus size={16} /> {t('common.addHoldingFromWatchlist')}
              </button>
            );
          })()}
          <button
            onClick={() => handleDelete(contextMenu.itemId)}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <Icons.Plus size={16} className="rotate-45 transform" /> {t('common.delete')}
          </button>
        </div>
      )}

      <div className="mx-auto w-full max-w-7xl px-0 pt-20 pb-8 md:px-4 md:pt-24 md:pb-10 lg:px-6">
        <section className="relative mt-3 overflow-hidden rounded-[1.75rem] border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)]/92 px-4 pb-3 pt-3 dark:border-border-dark dark:bg-card-dark md:px-6 md:pb-4 md:pt-4 md:shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-y-0 left-0 w-full bg-[radial-gradient(circle_at_top_left,_rgba(148,163,184,0.12),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(226,232,240,0.8),_transparent_28%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(96,165,250,0.12),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.10),_transparent_28%)]" />
          </div>

          <div className="relative flex items-start justify-between gap-3 md:items-end">
            <div>
              <div className="text-[11px] font-semibold tracking-[0.24em] text-slate-400 dark:text-gray-500">
                自选概览
              </div>
              <div className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-900 dark:text-gray-50 md:text-4xl">
                {watchlists.length}
              </div>
              <div className="mt-2 text-sm text-slate-500 dark:text-gray-400">
                {t('common.watchlist')}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
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
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingItem(undefined);
                  setIsAddModalOpen(true);
                }}
                className="flex min-h-10 items-center gap-2 rounded-full border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)]/90 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-[var(--app-shell-line-strong)] hover:bg-[var(--app-shell-panel-strong)] dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:border-white/20 dark:hover:bg-white/10"
              >
                <Icons.Plus size={16} />
                {t('common.addWatchlist')}
              </button>
            </div>
          </div>
        </section>

        <section className="mt-3 overflow-hidden rounded-[1.75rem] border border-[var(--app-shell-line)] md:mt-5 md:shadow-[0_14px_32px_rgba(15,23,42,0.05)] dark:border-border-dark">
          <div className="z-10 border-b border-[var(--app-shell-line)] bg-[var(--app-shell-panel)]/95 px-4 py-3 backdrop-blur-xl dark:border-border-dark dark:bg-card-dark/90 md:px-5">
            <div className="hidden items-center gap-4 md:flex">
              <div className="flex min-w-[15rem] flex-[1.5] items-center gap-2 text-slate-400">
                <div className="rounded-full border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] p-1.5 dark:border-white/10 dark:bg-white/5">
                  <Icons.Holdings size={14} />
                </div>
                <span className="text-[11px] font-semibold tracking-[0.18em]">自选列表</span>
              </div>
              <div className="grid w-full flex-[4] grid-cols-4 gap-4 text-right text-[11px] font-semibold tracking-[0.16em] text-slate-400 dark:text-gray-500">
                <div className="text-left normal-case tracking-normal text-slate-500 dark:text-gray-400">
                  锚点 / 现价
                </div>
                <button
                  onClick={() => handleSort('dayChangePct')}
                  className="flex items-center justify-end gap-1 transition-colors hover:text-slate-700 dark:hover:text-gray-200"
                  type="button"
                >
                  当日涨跌幅
                  {sortState.key === 'dayChangePct' && (
                    <Icons.ArrowUp
                      size={12}
                      className={sortState.direction === 'asc' ? '' : 'rotate-180'}
                    />
                  )}
                </button>
                <div />
                <button
                  onClick={() => handleSort('anchorGain')}
                  className="flex items-center justify-end gap-1 transition-colors hover:text-slate-700 dark:hover:text-gray-200"
                  type="button"
                >
                  锚点收益
                  {sortState.key === 'anchorGain' && (
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
                <div className="text-[10px] font-semibold tracking-[0.2em] text-slate-400 dark:text-gray-500">
                  自选列表
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-700 dark:text-gray-200">
                  {t('common.watchlist')}
                </div>
              </div>
              <div className="flex gap-2 text-right text-[11px] font-semibold tracking-[0.14em] text-slate-400 dark:text-gray-500">
                <button
                  onClick={() => handleSort('dayChangePct')}
                  className="flex w-[5.25rem] items-center justify-end gap-0.5"
                  type="button"
                >
                  当日涨跌幅
                  {sortState.key === 'dayChangePct' && (
                    <Icons.ArrowUp
                      size={12}
                      className={sortState.direction === 'asc' ? '' : 'rotate-180'}
                    />
                  )}
                </button>
                <button
                  onClick={() => handleSort('anchorGain')}
                  className="flex w-[5.25rem] items-center justify-end gap-0.5"
                  type="button"
                >
                  锚点收益
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

          <div className="overflow-hidden bg-[var(--app-shell-panel)]/92 dark:bg-card-dark">
            {watchlists.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 py-20 text-slate-400">
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
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onTouchCancel={handleTouchEnd}
                    onClick={() => handleRowClick(item)}
                    className={`group flex items-start justify-between gap-2 cursor-pointer select-none border-b border-[var(--app-shell-line)]/80 px-4 py-4 transition-colors dark:border-border-dark md:flex-row md:border-none md:hover:bg-[var(--app-shell-panel-strong)]/72 dark:md:hover:bg-white/5 ${contextMenu?.itemId === item.id ? 'bg-[var(--app-shell-panel-strong)] dark:bg-white/10' : ''}`}
                  >
                    <div className="min-w-0 flex-1 md:flex-[1.5] md:self-center">
                      <div className="hidden items-center gap-2 md:flex">
                        <span className="rounded-full border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)]/92 px-2 py-1 text-[10px] font-semibold tracking-[0.14em] whitespace-nowrap shrink-0 text-slate-700 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-200">
                          {item.code}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-1 text-[10px] font-semibold tracking-[0.14em] whitespace-nowrap shrink-0 ${
                            item.type === 'index'
                              ? 'border-[var(--app-shell-line-strong)] bg-[var(--app-shell-panel-strong)] text-slate-700 dark:border-purple-400/20 dark:bg-purple-500/10 dark:text-purple-300'
                              : 'border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400'
                          }`}
                        >
                          {item.type === 'index' ? '指数' : '基金'}
                        </span>
                        <h3 className="truncate text-sm font-medium text-slate-800 dark:text-gray-100">
                          {item.name}
                        </h3>
                      </div>

                      <div className="flex flex-col gap-1 md:hidden">
                        <div className="flex items-center gap-1.5">
                          <h3 className="truncate text-sm font-medium leading-tight text-slate-800 dark:text-gray-100">
                            {item.name}
                          </h3>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-bold whitespace-nowrap ${
                              item.type === 'index'
                                ? 'bg-[var(--app-shell-panel-strong)] text-slate-700 dark:bg-purple-900/40 dark:text-purple-400'
                                : 'bg-[var(--app-shell-panel-strong)] text-slate-500 dark:bg-white/10 dark:text-gray-400'
                            }`}
                          >
                            {item.type === 'index' ? '指数' : '基金'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pr-2">
                          <span className="text-xs text-slate-400">{item.code}</span>
                        </div>
                      </div>
                    </div>

                    <div className="hidden w-full flex-[4] grid-cols-4 items-start gap-4 text-right text-sm md:grid">
                      <div className="text-left text-xs text-slate-500 dark:text-gray-400">
                        <div className="flex items-center gap-1 text-slate-700 dark:text-gray-200">
                          {item.anchorPrice.toFixed(4)}
                          <span className="rounded bg-[var(--app-shell-panel-strong)] px-1 text-[10px] text-slate-400 dark:bg-white/5 dark:text-gray-500">
                            {item.anchorDate}
                          </span>
                        </div>
                        <div className="mt-1 text-slate-400 dark:text-gray-500">
                          {item.currentPrice.toFixed(4)}
                        </div>
                      </div>
                      <div className={`font-medium ${getSignColor(item.dayChangePct)}`}>
                        {formatPct(item.dayChangePct)}
                      </div>
                      <div />
                      <div className={`font-bold ${getSignColor(anchorGainPct)}`}>
                        {formatPct(anchorGainPct)}
                      </div>
                    </div>

                    <div className="flex flex-none gap-2 text-right md:hidden">
                      <div className="w-[4.9rem] rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)]/90 px-3 py-3 dark:border-white/10 dark:bg-white/5">
                        <div className={`text-base font-bold ${getSignColor(item.dayChangePct)}`}>
                          {formatPct(item.dayChangePct)}
                        </div>
                        <div className="mt-2 text-[10px] text-slate-400 dark:text-gray-500">
                          现价 {item.currentPrice.toFixed(4)}
                        </div>
                      </div>

                      <div className="w-[5.2rem] rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)]/80 px-3 py-3 dark:border-white/10 dark:bg-white/5">
                        <div className={`text-base font-bold ${getSignColor(anchorGainPct)}`}>
                          {formatPct(anchorGainPct)}
                        </div>
                        <div className="mt-2 flex flex-col items-end text-[10px] text-slate-400 dark:text-gray-500">
                          <span>锚点 {item.anchorPrice.toFixed(4)}</span>
                          <span className="origin-right scale-90 opacity-70">
                            ({item.anchorDate})
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
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
        onFundAdded={async () => {
          await Promise.all([
            refreshFundData({ force: true }),
            refreshWatchlistData({ force: true }),
          ]);
        }}
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
