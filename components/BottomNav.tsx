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
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-card-dark border-t border-gray-200 dark:border-border-dark z-50 shadow-[0_-1px_3px_rgba(0,0,0,0.05)] pb-safe">
      <div className="w-full max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 h-14 flex items-center justify-around">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`group relative flex flex-col items-center justify-center w-full h-full space-y-0.5 transition-colors ${
                isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              <span className="absolute left-1.5 right-1.5 top-1 bottom-1 rounded-xl bg-gray-100 dark:bg-white/10 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
              {isActive && (
                <motion.span
                  layoutId="bottom-nav-active-indicator"
                  data-testid="bottom-nav-active-indicator"
                  className="absolute left-1.5 right-1.5 top-1 bottom-1 rounded-xl bg-blue-50 dark:bg-blue-900/25"
                  transition={navAnimation.indicatorTransition}
                />
              )}
              <motion.div
                animate={{
                  scale: isActive ? navAnimation.iconScaleActive : navAnimation.iconScaleInactive,
                }}
                transition={navAnimation.iconScaleTransition}
                className="relative z-10 flex flex-col items-center justify-center space-y-0.5"
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </motion.div>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
