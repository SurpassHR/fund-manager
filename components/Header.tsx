import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icons } from './Icon';
import { useTranslation } from '../services/i18n';
import { useTheme } from '../services/ThemeContext';
import type { TabType } from '../types';
import {
  startPresence,
  subscribePresence,
  isPresenceEnabled,
  type PresenceStats,
} from '../services/presence';

interface HeaderProps {
  title: string;
  hiddenOnMobile?: boolean;
  activeTab?: TabType;
}

const PresenceIndicator = ({
  stats,
  t,
}: {
  stats: PresenceStats;
  t: (path: string, params?: Record<string, string>) => string;
}) => {
  const [showPopover, setShowPopover] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleOutsideClick = useCallback((e: MouseEvent | TouchEvent) => {
    if (
      popoverRef.current &&
      !popoverRef.current.contains(e.target as Node) &&
      btnRef.current &&
      !btnRef.current.contains(e.target as Node)
    ) {
      setShowPopover(false);
    }
  }, []);

  useEffect(() => {
    if (showPopover) {
      if (btnRef.current) {
        setRect(btnRef.current.getBoundingClientRect());
      }

      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);

      const handleScrollOrResize = () => {
        setShowPopover(false);
      };

      window.addEventListener('scroll', handleScrollOrResize, { passive: true });
      window.addEventListener('resize', handleScrollOrResize, { passive: true });

      return () => {
        document.removeEventListener('mousedown', handleOutsideClick);
        document.removeEventListener('touchstart', handleOutsideClick);
        window.removeEventListener('scroll', handleScrollOrResize);
        window.removeEventListener('resize', handleScrollOrResize);
      };
    }
  }, [showPopover, handleOutsideClick]);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setShowPopover((prev) => !prev)}
        aria-label={t('common.onlineUsers') || 'Online users'}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] transition hover:border-[var(--app-shell-line-strong)] hover:text-[var(--app-shell-accent)]"
      >
        <Icons.Users size={18} />
        {stats.current > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--app-shell-accent)] px-1 text-[10px] font-bold leading-none text-white">
            {stats.current}
          </span>
        )}
      </button>

      {showPopover &&
        rect &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            className="fixed z-[100] w-52 rounded-2xl glass-card p-4 animate-in fade-in zoom-in-95 duration-100 shadow-[var(--app-shell-shadow)]"
            style={{
              top: rect.bottom + 8,
              right: window.innerWidth < 640 ? 'auto' : window.innerWidth - rect.right,
              left: window.innerWidth < 640 ? 16 : 'auto',
            }}
          >
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--app-shell-muted)]">
              {t('common.userStats') || '用户统计'}
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--app-shell-muted)]">
                  {t('common.currentOnline') || '当前在线'}
                </span>
                <span className="text-sm font-semibold tabular-nums text-[var(--app-shell-ink)]">
                  {stats.current}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--app-shell-muted)]">
                  {t('common.peakOnline') || '峰值人数'}
                </span>
                <span className="text-sm font-semibold tabular-nums text-[var(--app-shell-ink)]">
                  {stats.peak}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--app-shell-muted)]">
                  {t('common.uniqueVisitors') || '累计访客'}
                </span>
                <span className="text-sm font-semibold tabular-nums text-[var(--app-shell-ink)]">
                  {stats.unique}
                </span>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export const Header: React.FC<HeaderProps> = ({
  title: _title,
  hiddenOnMobile = false,
  activeTab,
}) => {
  const { language, setLanguage, t } = useTranslation();
  const { theme } = useTheme();
  const [stats, setStats] = useState<PresenceStats>({ current: 0, peak: 0, unique: 0 });
  const presenceActive = isPresenceEnabled();

  // Start presence heartbeat once
  useEffect(() => {
    startPresence();
  }, []);

  // Subscribe to stats updates
  useEffect(() => {
    return subscribePresence(setStats);
  }, []);

  const toggleLanguage = () => {
    setLanguage(language === 'zh' ? 'en' : 'zh');
  };

  const openChangelog = () => {
    window.dispatchEvent(new CustomEvent('open-changelog'));
  };

  return (
    <header
      className={`glass-nav sticky top-0 z-50 flex flex-col border-b border-[var(--app-shell-line)] transition-all duration-200 ${hiddenOnMobile
        ? 'max-md:pointer-events-none max-md:-translate-y-full max-md:opacity-0'
        : 'max-md:translate-y-0 max-md:opacity-100'
        }`}
      style={{
        // 使用负的 margin-top 把整个 header 往上提，盖住空白
        // 然后用 padding-top 把内容顶回来
        marginTop: '-80px',
        paddingTop: 'calc(env(safe-area-inset-top, 0px))',
      }}
    >
      {/* 核心容器：pt 适配灵动岛，min-h 保持内容高度一致 */}
      <div className="pt-0">
        <div className="relative mx-auto flex min-h-14 items-center justify-between gap-3 px-4 sm:min-h-16 sm:px-6 max-w-7xl">

          {/* 左侧区域：GitHub Logo & 在线状态 */}
          <div className="z-10 flex min-w-0 items-center gap-2 sm:gap-2.5">
            <a
              href="https://github.com/SurpassHR/fund-manager"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center transition-opacity hover:opacity-70 active:scale-95"
              aria-label="GitHub Repository"
            >
              <img
                src={theme === 'dark' ? 'https://github.githubassets.com/favicons/favicon-dark.svg' : 'https://github.githubassets.com/favicons/favicon.svg'}
                alt="GitHub"
                className="h-6 w-6"
              />
            </a>
            {presenceActive && (
              <div className="sm:hidden">
                <PresenceIndicator stats={stats} t={t} />
              </div>
            )}
          </div>

          {/* 中间区域：绝对居中的添加按钮 */}
          {(activeTab === 'holding' || activeTab === 'watchlist') && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <button
                onClick={() => {
                  const eventType = activeTab === 'holding' ? 'open-add-fund' : 'open-add-watchlist';
                  window.dispatchEvent(new CustomEvent(eventType));
                }}
                aria-label={t(activeTab === 'holding' ? 'common.addHolding' : 'common.addWatchlist')}
                className="group inline-flex items-center gap-1.5 rounded-full border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)]/80 backdrop-blur-sm px-3.5 py-1.5 text-[11px] font-bold tracking-wider text-[var(--app-shell-accent)] transition-all hover:border-[var(--app-shell-line-strong)] hover:bg-[var(--app-shell-panel-strong)] active:scale-95"
              >
                <Icons.Plus size={14} className="transition-transform group-hover:rotate-90" />
                <span className="truncate">
                  {activeTab === 'holding' ? t('common.addHolding') : t('common.addWatchlist')}
                </span>
              </button>
            </div>
          )}

          {/* 右侧区域：功能按钮 */}
          <div className="z-10 flex items-center gap-2 text-[var(--app-shell-muted)] sm:gap-2.5">
            {presenceActive && (
              <div className="hidden sm:block">
                <PresenceIndicator stats={stats} t={t} />
              </div>
            )}

            {/* 更新日志 */}
            <button
              onClick={openChangelog}
              aria-label={t('common.changelog')}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] transition-all hover:border-[var(--app-shell-line-strong)] hover:text-[var(--app-shell-accent)] active:scale-90"
            >
              <Icons.Changelog size={18} />
            </button>

            {/* 语言切换 */}
            <button
              onClick={toggleLanguage}
              className="inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] px-2.5 text-[10px] font-bold uppercase tracking-widest text-[var(--app-shell-ink)] transition-all hover:border-[var(--app-shell-line-strong)] hover:text-[var(--app-shell-accent)] active:scale-90"
            >
              {language === 'zh' ? 'EN' : '中'}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
