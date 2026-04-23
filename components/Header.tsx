import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icons } from './Icon';
import { useTranslation } from '../services/i18n';
import { useTheme } from '../services/ThemeContext';
import {
  startPresence,
  subscribePresence,
  isPresenceEnabled,
  type PresenceStats,
} from '../services/presence';

interface HeaderProps {
  title: string;
  hiddenOnMobile?: boolean;
}

const PresenceIndicator = ({
  stats,
  t,
}: {
  stats: PresenceStats;
  t: (path: string, params?: Record<string, string>) => string;
}) => {
  const [showPopover, setShowPopover] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleOutsideClick = useCallback((e: MouseEvent) => {
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
      document.addEventListener('mousedown', handleOutsideClick);
      return () => document.removeEventListener('mousedown', handleOutsideClick);
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

      {showPopover && (
        <div
          ref={popoverRef}
          className="absolute right-0 top-12 z-50 w-52 rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] p-4 shadow-[var(--app-shell-shadow)] backdrop-blur-xl max-sm:left-0 max-sm:right-auto"
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
        </div>
      )}
    </div>
  );
};

export const Header: React.FC<HeaderProps> = ({ title: _title, hiddenOnMobile = false }) => {
  const { language, setLanguage, t } = useTranslation();
  const { theme } = useTheme();
  const [now, setNow] = useState(() => Date.now());
  const [stats, setStats] = useState<PresenceStats>({ current: 0, peak: 0, unique: 0 });
  const presenceActive = isPresenceEnabled();

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Start presence heartbeat once
  useEffect(() => {
    startPresence();
  }, []);

  // Subscribe to stats updates
  useEffect(() => {
    return subscribePresence(setStats);
  }, []);

  const displayNow = useMemo(() => {
    const d = new Date(now);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${month}-${day} ${hours}:${minutes}:${seconds}`;
  }, [now]);

  const toggleLanguage = () => {
    setLanguage(language === 'zh' ? 'en' : 'zh');
  };

  const openChangelog = () => {
    window.dispatchEvent(new CustomEvent('open-changelog'));
  };

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 px-3 pt-2 transition-all duration-200 sm:px-4 sm:pt-2.5 lg:px-6 ${
        hiddenOnMobile
          ? 'max-md:pointer-events-none max-md:-translate-y-full max-md:opacity-0'
          : 'max-md:translate-y-0 max-md:opacity-100'
      }`}
    >
      <div className="mx-auto w-full max-w-7xl rounded-[1.75rem] border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)]/95 shadow-[var(--app-shell-shadow)] backdrop-blur-xl">
        <div className="relative flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5 sm:py-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
            <a
              href="https://github.com/SurpassHR/fund-manager"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center transition hover:opacity-80"
              aria-label="GitHub Repository"
            >
              <img
                src={
                  theme === 'dark'
                    ? 'https://github.githubassets.com/favicons/favicon-dark.svg'
                    : 'https://github.githubassets.com/favicons/favicon.svg'
                }
                alt="GitHub"
                className="h-6 w-6"
              />
            </a>
            {/* Presence / Online Users (Mobile only) */}
            {presenceActive && (
              <div className="sm:hidden">
                <PresenceIndicator stats={stats} t={t} />
              </div>
            )}
          </div>

          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="rounded-full border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)]/90 px-3 py-1.5 text-[11px] font-semibold tracking-[0.18em] text-[var(--app-shell-muted)]">
              {displayNow}
            </div>
          </div>

          <div className="flex items-center gap-2 text-[var(--app-shell-muted)] sm:gap-2.5">
            {/* Presence / Online Users (Desktop only) */}
            {presenceActive && (
              <div className="hidden sm:block">
                <PresenceIndicator stats={stats} t={t} />
              </div>
            )}
            <button
              onClick={openChangelog}
              aria-label={t('common.changelog')}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] transition hover:border-[var(--app-shell-line-strong)] hover:text-[var(--app-shell-accent)]"
            >
              <Icons.Changelog size={18} />
            </button>
            <button
              onClick={toggleLanguage}
              className="inline-flex h-10 min-w-10 items-center justify-center rounded-full border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] px-3 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[var(--app-shell-ink)] transition hover:border-[var(--app-shell-line-strong)] hover:text-[var(--app-shell-accent)]"
            >
              {language === 'zh' ? 'EN' : '中'}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
