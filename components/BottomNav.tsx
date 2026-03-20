import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { TabType } from '../types';
import { Icons } from './Icon';
import { useTranslation } from '../services/i18n';
import { getBottomNavAnimation } from '../services/animations/presets';

interface BottomNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

type IconComponent = React.ComponentType<{
  size?: number;
  strokeWidth?: number;
  className?: string;
}>;

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const navAnimation = getBottomNavAnimation(reduceMotion);

  const tabs: { id: TabType; label: string; icon: IconComponent }[] = [
    { id: 'holding', label: t('common.holdings'), icon: Icons.Holdings },
    { id: 'watchlist', label: t('common.watchlist'), icon: Icons.User },
    { id: 'market', label: t('common.market'), icon: Icons.Chart },
    { id: 'news', label: t('common.news'), icon: Icons.News },
    { id: 'settings', label: t('common.settings'), icon: Icons.Settings },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] sm:px-4">
      <div className="mx-auto w-full max-w-5xl rounded-[1.75rem] border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)]/96 shadow-[0_24px_70px_rgba(15,23,42,0.16)] backdrop-blur-2xl">
        <div className="grid h-[4.5rem] grid-cols-5 gap-1 px-2 py-2 sm:px-3">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`group relative flex h-full w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl transition-colors ${
                  isActive
                    ? 'text-[var(--app-shell-ink)]'
                    : 'text-[var(--app-shell-muted)] hover:text-[var(--app-shell-ink)]'
                }`}
              >
                <span className="absolute inset-[2px] rounded-[1rem] bg-[var(--app-shell-panel-strong)]/78 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                {isActive && (
                  <motion.span
                    layoutId="bottom-nav-active-indicator"
                    data-testid="bottom-nav-active-indicator"
                    className="absolute inset-[2px] rounded-[1rem] border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)]"
                    transition={navAnimation.indicatorTransition}
                  />
                )}
                <motion.div
                  animate={{
                    scale: isActive ? navAnimation.iconScaleActive : navAnimation.iconScaleInactive,
                  }}
                  transition={navAnimation.iconScaleTransition}
                  className="relative z-10 flex flex-col items-center justify-center gap-1"
                >
                  <Icon size={19} strokeWidth={isActive ? 2.4 : 2} />
                  <span className="text-[0.62rem] font-semibold uppercase tracking-[0.18em]">
                    {tab.label}
                  </span>
                </motion.div>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
