import React, { useRef, useMemo } from 'react';
import type { TabType } from '../types';
import { Icons } from './Icon';
import { useTranslation } from '../services/i18n';
import { getBottomNavAnimation } from '../services/animations/presets';
import { useCanvasNavIndicator } from '../hooks/useCanvasNavIndicator';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

interface BottomNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  hiddenOnMobile?: boolean;
}

type IconComponent = React.ComponentType<{
  size?: number;
  strokeWidth?: number;
  className?: string;
}>;

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  hiddenOnMobile = false,
}) => {
  const { t } = useTranslation();
  const reduceMotion = usePrefersReducedMotion();
  const navAnimation = getBottomNavAnimation(reduceMotion);

  const tabs: { id: TabType; label: string; icon: IconComponent }[] = useMemo(
    () => [
      { id: 'holding', label: t('common.holdings'), icon: Icons.Holdings },
      { id: 'watchlist', label: t('common.watchlist'), icon: Icons.User },
      { id: 'services', label: t('common.services'), icon: Icons.Chart },
      { id: 'news', label: t('common.news'), icon: Icons.News },
      { id: 'settings', label: t('common.settings'), icon: Icons.Settings },
    ],
    [t],
  );

  const navContentRef = useRef<HTMLDivElement>(null);
  const activeIndex = tabs.findIndex((tab) => tab.id === activeTab);

  const canvasRef = useCanvasNavIndicator({
    containerRef: navContentRef,
    activeIndex,
    itemCount: tabs.length,
    lerp: navAnimation.lerp,
    fillColor: navAnimation.fillColor,
    borderColor: navAnimation.borderColor,
    insetX: navAnimation.insetX,
    insetY: navAnimation.insetY,
    borderRadius: navAnimation.borderRadius,
  });

  return (
    <nav
      className={`glass-nav fixed inset-x-0 bottom-0 z-50 border-t border-[var(--app-shell-line)] pb-auto transition-all duration-200 ${hiddenOnMobile
        ? 'max-md:pointer-events-none max-md:translate-y-[120%] max-md:opacity-0'
        : 'max-md:translate-y-0 max-md:opacity-100'
        }`}
    >
      <div className="mx-auto w-full max-w-5xl">
        <div
          ref={navContentRef}
          className="relative grid h-[4rem] grid-cols-5 gap-1 px-2 py-1 sm:h-[4.5rem] sm:px-8"
        >
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-[1]"
          />
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`group relative flex h-full w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl transition-colors ${isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-[var(--app-shell-muted)] hover:text-[var(--app-shell-ink)]'
                  }`}
              >
                <span className="absolute inset-[2px] rounded-[1rem] bg-black/5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 dark:bg-white/5" />
                {isActive && (
                  <span
                    data-testid="bottom-nav-active-indicator"
                    className="sr-only"
                    aria-hidden="true"
                  />
                )}
                <span className="relative z-10 flex flex-col items-center justify-center gap-1">
                  <Icon size={19} strokeWidth={isActive ? 2.4 : 2} />
                  <span className="text-[0.62rem] font-semibold uppercase tracking-[0.18em]">
                    {tab.label}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
