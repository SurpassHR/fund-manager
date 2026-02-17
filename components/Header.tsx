import React from 'react';
import { Icons } from './Icon';
import { useTranslation } from '../services/i18n';

interface HeaderProps {
  title: string;
}

export const Header: React.FC<HeaderProps> = ({ title }) => {
  const { language, setLanguage, t } = useTranslation();

  const toggleLanguage = () => {
    setLanguage(language === 'zh' ? 'en' : 'zh');
  };

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-card-dark border-b border-gray-100 dark:border-border-dark h-14 shadow-sm">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center overflow-hidden border border-yellow-300 dark:border-yellow-700 flex-shrink-0">
            <img src="https://picsum.photos/32/32" alt="Avatar" className="w-full h-full object-cover" />
          </div>
          <div className="hidden sm:flex w-8 h-8 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex-col items-center justify-center text-[8px] text-blue-500 dark:text-blue-400 leading-tight p-0.5 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">
            <span className="font-bold">{t('common.list')}</span>
            <span>{t('common.rank')}</span>
          </div>
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100 ml-1 sm:ml-0">{title}</h1>
        </div>

        <div className="flex items-center gap-4 text-gray-600 dark:text-gray-300">
          <button
            onClick={toggleLanguage}
            className="text-xs font-medium border border-gray-200 dark:border-gray-600 rounded px-2 py-1 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
          >
            {language === 'zh' ? 'EN' : '中'}
          </button>
          <Icons.Search size={22} className="cursor-pointer hover:text-blue-600 transition-colors" />
          <Icons.Chat size={22} className="cursor-pointer hover:text-blue-600 transition-colors" />
        </div>
      </div>
    </header>
  );
};
