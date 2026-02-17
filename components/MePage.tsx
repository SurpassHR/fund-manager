import React, { useState } from 'react';
import { Icons } from './Icon';
import { useTranslation } from '../services/i18n';
import { SettingsPage } from './SettingsPage';

export const MePage: React.FC = () => {
    const { t } = useTranslation();
    const [showSettings, setShowSettings] = useState(false);

    if (showSettings) {
        return <SettingsPage onBack={() => setShowSettings(false)} />;
    }

    return (
        <div className="min-h-[60vh] pt-4 px-4">
            {/* 设置入口 */}
            <div className="bg-white dark:bg-card-dark rounded-xl overflow-hidden shadow-sm">
                <button
                    onClick={() => setShowSettings(true)}
                    className="w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/10 flex items-center justify-center">
                            <Icons.Settings size={18} className="text-gray-600 dark:text-gray-300" />
                        </div>
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{t('common.settings')}</span>
                    </div>
                    <Icons.ArrowUp size={16} className="text-gray-400 rotate-90" />
                </button>
            </div>
        </div>
    );
};
