import React from 'react';
import { TabType } from '../types';
import { Icons } from './Icon';
import { useTranslation } from '../services/i18n';

interface BottomNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  const { t } = useTranslation();

  const tabs: { id: TabType; label: string; icon: React.FC<any> }[] = [
    { id: 'holding', label: t('common.holdings'), icon: Icons.Holdings },
    { id: 'watchlist', label: t('common.watchlist'), icon: Icons.User },
    { id: 'market', label: t('common.market'), icon: Icons.Chart },
    { id: 'news', label: t('common.news'), icon: Icons.News },
    { id: 'member', label: t('common.member'), icon: Icons.Member },
    { id: 'me', label: t('common.me'), icon: Icons.User },
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
              className={`flex flex-col items-center justify-center w-full h-full space-y-0.5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'
                }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};