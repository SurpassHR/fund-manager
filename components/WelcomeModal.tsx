import React, { useEffect, useState } from 'react';
import { useTranslation } from '../services/i18n';

// Read the latest commit details injected by Vite
const CURRENT_VERSION = import.meta.env.VITE_LATEST_COMMIT_HASH || 'v0.2.0';
const COMMIT_SUBJECT = import.meta.env.VITE_LATEST_COMMIT_SUBJECT || "最新功能";
const COMMIT_BODY = import.meta.env.VITE_LATEST_COMMIT_BODY || "";

export const WelcomeModal: React.FC = () => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const lastSeen = localStorage.getItem('lastSeenVersion');
        if (lastSeen !== CURRENT_VERSION) {
            setIsOpen(true);
        }
    }, []);

    const handleClose = () => {
        localStorage.setItem('lastSeenVersion', CURRENT_VERSION);
        setIsOpen(false);
    };

    if (!isOpen) return null;

    // Parse the commit body into a list of features
    // We assume the body might have lines starting with '-' or '*'
    const features = COMMIT_BODY.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    return (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-card-dark rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 fade-in duration-300">
                {/* 顶部插画/背景区 */}
                <div className="h-32 bg-gradient-to-br from-blue-500 to-blue-700 relative overflow-hidden flex items-center justify-center">
                    <div className="absolute inset-0 opacity-20 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9IiNmZmYiLz48L3N2Zz4=')] bg-[length:20px_20px]"></div>
                    <div className="text-white text-center z-10 px-4">
                        <h2 className="text-xl font-bold mb-1 truncate">{t('common.welcome') || '欢迎使用小胡养基'}</h2>
                        <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-xs font-mono font-bold backdrop-blur-md max-w-full truncate">
                            {CURRENT_VERSION}
                        </span>
                    </div>
                </div>

                {/* 内容区 */}
                <div className="p-6">
                    <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">
                        {COMMIT_SUBJECT}
                    </h3>

                    <ul className="space-y-4 max-h-64 overflow-y-auto pr-2">
                        {features.length > 0 ? (
                            features.map((feature, idx) => {
                                // Clean up markdown list characters if they exist
                                const cleanText = feature.replace(/^[-*+]\s*/, '');
                                // Use a set of icons cyclically
                                const colors = [
                                    'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
                                    'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
                                    'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400',
                                    'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400'
                                ];
                                const colorClass = colors[idx % colors.length];

                                return (
                                    <li key={idx} className="flex gap-3 items-start">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${colorClass}`}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
                                                {cleanText}
                                            </p>
                                        </div>
                                    </li>
                                );
                            })
                        ) : (
                            <li className="flex gap-3 items-start">
                                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-0.5">常规更新</h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                        带来了性能改进和问题修复。
                                    </p>
                                </div>
                            </li>
                        )}
                    </ul>

                    {/* 按钮 */}
                    <div className="mt-8">
                        <button
                            onClick={handleClose}
                            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl transition-colors shadow-lg shadow-blue-500/30"
                        >
                            {t('common.gotIt') || '我知道了'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
