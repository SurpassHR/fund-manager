import React, { useEffect, useState } from 'react';
import { useTranslation } from '../services/i18n';

// The current version of the application. 
// Bump this string when there is a new update to show the modal again.
export const CURRENT_VERSION = 'v0.2.0';

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

    return (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-card-dark rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 fade-in duration-300">
                {/* 顶部插画/背景区 */}
                <div className="h-32 bg-gradient-to-br from-blue-500 to-blue-700 relative overflow-hidden flex items-center justify-center">
                    <div className="absolute inset-0 opacity-20 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9IiNmZmYiLz48L3N2Zz4=')] bg-[length:20px_20px]"></div>
                    <div className="text-white text-center z-10">
                        <h2 className="text-2xl font-bold mb-1">{t('common.welcome') || '欢迎使用小胡养基'}</h2>
                        <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-xs font-mono font-bold backdrop-blur-md">
                            {CURRENT_VERSION}
                        </span>
                    </div>
                </div>

                {/* 内容区 */}
                <div className="p-6">
                    <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">
                        {t('common.newFeatures') || '最新功能'}
                    </h3>

                    <ul className="space-y-5">
                        <li className="flex gap-3 items-start">
                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-0.5">加减仓 & T+N 支持</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                    长按基金卡片可直接加减仓。内置 T+1 等基金确认日自动推算，在途资金自动结算。
                                </p>
                            </div>
                        </li>

                        <li className="flex gap-3 items-start">
                            <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-0.5">本地数据导入导出</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                    前往设置页备份你的所有持仓数据为 JSON 文件，跨设备无缝迁移，安全不丢失。
                                </p>
                            </div>
                        </li>

                        <li className="flex gap-3 items-start">
                            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center text-green-600 dark:text-green-400 shrink-0">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-0.5">更智能的收益校验</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                    接入双渠道净值接口保证数据准时刷新。修复了节假日无交易日导致的错误涨幅等问题。
                                </p>
                            </div>
                        </li>
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
