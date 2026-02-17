import React from 'react';
import { Icons } from './Icon';
import { useTranslation } from '../services/i18n';
import { useTheme } from '../services/ThemeContext';

interface SettingsPageProps {
    onBack: () => void;
}

type ThemeOption = 'system' | 'light' | 'dark';

export const SettingsPage: React.FC<SettingsPageProps> = ({ onBack }) => {
    const { t } = useTranslation();
    const { mode, setMode } = useTheme();

    const themeOptions: { value: ThemeOption; label: string; icon: React.ReactNode }[] = [
        {
            value: 'system',
            label: t('common.themeSystem'),
            icon: <Icons.Settings size={18} />,
        },
        {
            value: 'light',
            label: t('common.themeLight'),
            icon: <span className="text-lg">☀️</span>,
        },
        {
            value: 'dark',
            label: t('common.themeDark'),
            icon: <span className="text-lg">🌙</span>,
        },
    ];

    return (
        <div className="min-h-[60vh]">
            {/* 标题栏 */}
            <div className="flex items-center gap-3 px-4 py-3">
                <button
                    onClick={onBack}
                    className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                >
                    <Icons.ArrowUp size={20} className="text-gray-600 dark:text-gray-300 -rotate-90" />
                </button>
                <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">{t('common.settings')}</h2>
            </div>

            {/* 主题设置 */}
            <div className="px-4 mt-2">
                <div className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2 px-1">
                    {t('common.theme')}
                </div>
                <div className="bg-white dark:bg-card-dark rounded-xl overflow-hidden shadow-sm">
                    {themeOptions.map((opt, idx) => (
                        <button
                            key={opt.value}
                            onClick={() => setMode(opt.value)}
                            className={`w-full flex items-center justify-between px-4 py-3.5 transition-colors
                hover:bg-gray-50 dark:hover:bg-white/5
                ${idx < themeOptions.length - 1 ? 'border-b border-gray-100 dark:border-border-dark' : ''}
              `}
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-gray-500 dark:text-gray-400">{opt.icon}</span>
                                <span className="text-sm text-gray-800 dark:text-gray-100">{opt.label}</span>
                            </div>
                            {mode === opt.value && (
                                <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                        <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
