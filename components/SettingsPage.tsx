import React, { useRef } from 'react';
import { Icons } from './Icon';
import { useTranslation } from '../services/i18n';
import { useTheme } from '../services/ThemeContext';
import { useSettings } from '../services/SettingsContext';
import { exportFunds, importFunds } from '../services/db';

interface SettingsPageProps {
    onBack: () => void;
}

type ThemeOption = 'system' | 'light' | 'dark';

export const SettingsPage: React.FC<SettingsPageProps> = ({ onBack }) => {
    const { t } = useTranslation();
    const { mode, setMode } = useTheme();
    const { autoRefresh, setAutoRefresh } = useSettings();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const themeOptions: { value: ThemeOption; label: string; icon: React.ReactNode }[] = [
        {
            value: 'system',
            label: t('common.themeSystem'),
            icon: <Icons.Settings size={18} />,
        },
        {
            value: 'light',
            label: t('common.themeLight'),
            icon: <Icons.Sun size={18} />,
        },
        {
            value: 'dark',
            label: t('common.themeDark'),
            icon: <Icons.Moon size={18} />,
        },
    ];

    const handleExport = async () => {
        try {
            await exportFunds();
        } catch (e) {
            console.error('Export failed', e);
        }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const result = await importFunds(file);
            const msg = (t('common.importSuccess') || '新增 {added} 条，跳过 {skipped} 条重复')
                .replace('{added}', String(result.added))
                .replace('{skipped}', String(result.skipped));
            alert(msg);
        } catch (err) {
            alert(t('common.importError') || '导入失败');
            console.error(err);
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

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
                                <div className="w-6 flex justify-center text-gray-500 dark:text-gray-400">
                                    {opt.icon}
                                </div>
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

            {/* 功能设置 */}
            <div className="px-4 mt-6">
                <div className="text-xs font-bold font-sans text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2 px-1">
                    {t('common.features') || '功能'}
                </div>
                <div className="bg-white dark:bg-card-dark rounded-xl overflow-hidden shadow-sm">
                    <div className="w-full flex items-center justify-between px-4 py-3.5">
                        <div className="flex items-center gap-3">
                            <div className="w-6 flex justify-center text-gray-500 dark:text-gray-400">
                                <Icons.Refresh size={18} />
                            </div>
                            <span className="text-sm font-sans text-gray-800 dark:text-gray-100">
                                {t('common.autoRefresh') || '自动刷新持仓行情'}
                            </span>
                        </div>
                        <button
                            onClick={() => setAutoRefresh(!autoRefresh)}
                            className={`w-10 h-6 rounded-full transition-colors relative ${autoRefresh ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                        >
                            <div
                                className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${autoRefresh ? 'translate-x-5' : 'translate-x-1'}`}
                            />
                        </button>
                    </div>
                </div>
            </div>

            {/* 数据管理 */}
            <div className="px-4 mt-6">
                <div className="text-xs font-bold font-sans text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2 px-1">
                    {t('common.data') || '数据'}
                </div>
                <div className="bg-white dark:bg-card-dark rounded-xl overflow-hidden shadow-sm">
                    <button
                        onClick={handleExport}
                        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border-b border-gray-100 dark:border-border-dark"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-6 flex justify-center text-gray-500 dark:text-gray-400">
                                <Icons.ArrowUp size={18} />
                            </div>
                            <span className="text-sm font-sans text-gray-800 dark:text-gray-100">
                                {t('common.exportData') || '导出数据'}
                            </span>
                        </div>
                        <Icons.ArrowDown size={16} className="text-gray-400 -rotate-90" />
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-6 flex justify-center text-gray-500 dark:text-gray-400">
                                <Icons.ArrowDown size={18} />
                            </div>
                            <span className="text-sm font-sans text-gray-800 dark:text-gray-100">
                                {t('common.importData') || '导入数据'}
                            </span>
                        </div>
                        <Icons.ArrowDown size={16} className="text-gray-400 -rotate-90" />
                    </button>
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleImport}
                />
            </div>
        </div>
    );
};
