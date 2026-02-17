import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, initDB, calculateSummary, refreshFundData } from '../services/db';
import { formatCurrency, formatSignedCurrency, getSignColor, formatPct } from '../services/financeUtils';
import { Icons } from './Icon';
import { useTranslation } from '../services/i18n';
import { AccountManagerModal } from './AccountManagerModal';
import { AddFundModal } from './AddFundModal';
import { FundDetail } from './FundDetail';
import { Fund } from '../types';

export const Dashboard: React.FC = () => {
    const funds = useLiveQuery(() => db.funds.toArray());
    const accounts = useLiveQuery(() => db.accounts.toArray());
    const [activeFilter, setActiveFilter] = useState('All');
    const [showValues, setShowValues] = useState(true);

    // State for Detail View
    const [selectedFund, setSelectedFund] = useState<Fund | null>(null);

    // Modals
    const [isAccountManagerOpen, setIsAccountManagerOpen] = useState(false);
    const [isAddFundOpen, setIsAddFundOpen] = useState(false);
    const [editingFund, setEditingFund] = useState<Fund | undefined>(undefined);

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; fundId: number } | null>(null);
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const { t } = useTranslation();

    useEffect(() => {
        initDB();
        refreshFundData();
    }, []);

    // Close context menu on global click
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    if (!funds || !accounts) return <div className="p-8 text-center text-gray-500">{t('common.loading')}</div>;

    // If a fund is selected, show Detail View
    if (selectedFund) {
        return <FundDetail fund={selectedFund} onBack={() => setSelectedFund(null)} />;
    }

    const filteredFunds = activeFilter === 'All'
        ? funds
        : funds.filter(f => f.platform === activeFilter);

    const summary = calculateSummary(filteredFunds);
    const filterList = accounts.length > 1 ? ['All', ...accounts.map(a => a.name)] : accounts.map(a => a.name);

    // --- Handlers ---

    const handleContextMenu = (e: React.MouseEvent, fundId: number) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent triggering row click
        setContextMenu({ x: e.clientX, y: e.clientY, fundId });
    };

    const handleTouchStart = (fundId: number, e: React.TouchEvent) => {
        // e.persist(); // Not strictly needed in modern React but good for safety if accessing event in timer
        const touch = e.touches[0];
        const x = touch.clientX;
        const y = touch.clientY;

        longPressTimerRef.current = setTimeout(() => {
            setContextMenu({ x, y, fundId });
            // Vibrate if supported
            if (navigator.vibrate) navigator.vibrate(50);
        }, 600); // 600ms long press
    };

    const handleTouchEnd = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

    const handleEdit = (fund: Fund) => {
        setEditingFund(fund);
        setIsAddFundOpen(true);
        setContextMenu(null);
    };

    const handleDelete = async (fundId: number) => {
        if (confirm(t('common.delete') + '?')) {
            await db.funds.delete(fundId);
        }
        setContextMenu(null);
    };

    const handleRowClick = (fund: Fund) => {
        // If context menu is open, don't select fund
        if (contextMenu) return;
        setSelectedFund(fund);
    };

    return (
        <div className="pb-36 md:pb-24 bg-app-bg dark:bg-app-bg-dark min-h-full" onContextMenu={(e) => e.preventDefault()}>
            {/* Context Menu Overlay */}
            {contextMenu && (
                <div
                    className="fixed z-[100] bg-white dark:bg-card-dark rounded-lg shadow-xl border border-gray-100 dark:border-border-dark py-2 w-48 overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-left"
                    style={{ top: Math.min(contextMenu.y, window.innerHeight - 150), left: Math.min(contextMenu.x, window.innerWidth - 200) }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-4 py-2 text-xs font-bold text-gray-400 bg-gray-50 dark:bg-white/5 border-b border-gray-100 dark:border-border-dark mb-1">
                        {t('common.menu')}
                    </div>
                    <button
                        onClick={() => {
                            const f = funds.find(i => i.id === contextMenu.fundId);
                            if (f) handleEdit(f);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-700 dark:text-gray-200 text-sm flex items-center gap-2 border-b border-gray-50 dark:border-border-dark"
                    >
                        <Icons.Settings size={16} className="text-blue-500" /> {t('common.edit')}
                    </button>
                    <button
                        onClick={() => handleDelete(contextMenu.fundId)}
                        className="w-full text-left px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 text-sm flex items-center gap-2"
                    >
                        <Icons.Plus size={16} className="transform rotate-45" /> {t('common.delete')}
                    </button>
                </div>
            )}

            {/* Top Filter Bar */}
            <div className="bg-white dark:bg-card-dark px-2 pt-1 pb-2 md:rounded-b-lg md:shadow-sm md:mb-4 flex items-center gap-4 overflow-x-auto no-scrollbar border-b border-gray-100 dark:border-border-dark md:border-none sticky top-14 z-20">
                <div className="flex-shrink-0 text-gray-500 dark:text-gray-400 font-medium text-sm px-2">{t('common.account')}</div>
                {filterList.map(filterKey => {
                    const label = t(`filters.${filterKey}`) === `filters.${filterKey}` ? filterKey : t(`filters.${filterKey}`);
                    return (
                        <button
                            key={filterKey}
                            onClick={() => setActiveFilter(filterKey)}
                            className={`flex-shrink-0 px-1 py-2 text-sm font-medium relative whitespace-nowrap transition-colors ${activeFilter === filterKey ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                }`}
                        >
                            {label}
                            {activeFilter === filterKey && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                            )}
                        </button>
                    );
                })}
                <div className="flex-grow" />
                <button
                    onClick={() => setIsAccountManagerOpen(true)}
                    className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full"
                >
                    <Icons.Menu size={20} />
                </button>
            </div>

            {/* Asset Summary Card */}
            <div className="bg-white dark:bg-card-dark md:rounded-lg md:shadow-sm px-4 py-4 mb-2 md:mb-6 mx-0 md:mx-0">
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2 text-gray-500 text-sm font-sans">
                        <span>{t('common.totalAssets')}</span>
                        <button onClick={() => setShowValues(!showValues)} className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded">
                            {showValues ? <Icons.Eye size={16} /> : <Icons.EyeOff size={16} />}
                        </button>
                    </div>
                    <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-xs bg-gray-50 dark:bg-white/10 px-2 py-1 rounded-full cursor-pointer hover:bg-gray-100 dark:hover:bg-white/15 font-sans">
                        <Icons.Refresh size={12} />
                        <span>{t('common.dayGain')}</span>
                        <Icons.ArrowUp className="transform rotate-90" size={12} />
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-2">
                    <div className="text-3xl font-bold text-gray-800 dark:text-gray-100 tracking-tight font-mono">
                        {showValues ? formatCurrency(summary.totalAssets) : '****'}
                    </div>
                    <div className={`text-xl font-bold font-mono ${getSignColor(summary.totalDayGain)}`}>
                        {showValues ? formatSignedCurrency(summary.totalDayGain) : '****'}
                        <span className="text-sm font-normal text-gray-400 ml-1 font-sans">Today</span>
                    </div>
                </div>
            </div>

            {/* List Headers - Responsive */}
            <div className="bg-white dark:bg-card-dark md:rounded-t-lg px-4 py-3 flex items-center text-xs text-gray-400 border-b border-gray-100 dark:border-border-dark sticky top-[calc(3.5rem+40px)] md:top-14 z-10 shadow-sm font-sans">
                <div className="hidden md:flex md:flex-[1.5] gap-4 pr-2 items-center">
                    <button className="hover:text-gray-600"><Icons.Settings size={16} /></button>
                    <button className="hover:text-gray-600"><Icons.Bell size={16} /></button>
                    <button className="hover:text-gray-600"><Icons.Grid size={16} /></button>
                    <button className="hover:text-gray-600"><Icons.Holdings size={16} /></button>
                </div>

                <div className="hidden md:grid md:flex-[4] w-full grid-cols-5 gap-4 text-right font-medium">
                    <div className="text-left">{t('common.cost')} / {t('common.nav')}</div>
                    <div className="text-right cursor-pointer hover:text-gray-600">{t('common.dayChgPct')}</div>
                    <div className="text-right cursor-pointer hover:text-gray-600">{t('common.dayGain')}</div>
                    <div className="text-right cursor-pointer hover:text-gray-600">{t('common.totalGain')}</div>
                    <div className="text-right">{t('common.mktVal')}</div>
                </div>

                {/* Mobile Headers */}
                <div className="md:hidden w-full flex items-center justify-between">
                    <div className="flex-1 text-left">{t('common.fund')}</div>
                    <div className="flex gap-2 text-right">
                        <div className="w-14 cursor-pointer flex items-center justify-end gap-0.5">
                            {t('common.dayChgPct')}
                        </div>
                        <div className="w-[4.5rem] cursor-pointer flex items-center justify-end gap-0.5">
                            {t('common.dayGain')}
                        </div>
                        <div className="w-[4.5rem] cursor-pointer flex items-center justify-end gap-0.5">
                            {t('common.totalGain')}
                        </div>
                    </div>
                </div>
            </div>

            {/* Fund List */}
            <div className="bg-white dark:bg-card-dark md:rounded-b-lg flex flex-col md:divide-y md:divide-gray-50 dark:md:divide-border-dark">
                {filteredFunds.map((fund) => {
                    const holdingValue = fund.holdingShares * fund.currentNav;
                    const totalCost = fund.holdingShares * fund.costPrice;
                    const totalReturn = holdingValue - totalCost;
                    const totalReturnPct = totalCost !== 0 ? (totalReturn / totalCost) * 100 : 0;
                    const displayPlatform = t(`filters.${fund.platform}`) === `filters.${fund.platform}` ? fund.platform : t(`filters.${fund.platform}`);

                    return (
                        <div
                            key={fund.id}
                            onClick={() => handleRowClick(fund)}
                            onContextMenu={(e) => fund.id && handleContextMenu(e, fund.id)}
                            onTouchStart={(e) => fund.id && handleTouchStart(fund.id, e)}
                            onTouchEnd={handleTouchEnd}
                            onTouchCancel={handleTouchEnd}
                            className={`group flex md:flex-row py-4 px-4 border-b border-gray-50 dark:border-border-dark md:border-none active:bg-gray-50 dark:active:bg-white/5 md:hover:bg-gray-50 dark:md:hover:bg-white/5 transition-colors cursor-pointer items-start select-none ${contextMenu?.fundId === fund.id ? 'bg-gray-100 dark:bg-white/10' : ''
                                }`}
                        >

                            {/* Common: Name Section */}
                            <div className="flex-1 min-w-0 pr-2 md:flex-[1.5] md:self-center">
                                <div className="hidden md:flex items-center gap-2">
                                    <span className="text-[10px] px-1 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-mono">
                                        {fund.code}
                                    </span>
                                    <span className="text-[10px] px-1 py-0.5 rounded bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 font-sans">
                                        {displayPlatform}
                                    </span>
                                    <h3 className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate font-sans">{fund.name}</h3>
                                </div>

                                {/* Mobile Name View */}
                                <div className="md:hidden flex flex-col gap-1">
                                    <h3 className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate leading-tight font-sans">{fund.name}</h3>
                                    <div className="flex justify-between items-center pr-2">
                                        <span className="text-xs text-gray-400 font-mono">{fund.code}</span>
                                        <span className="text-xs text-gray-400 font-mono">¥{formatCurrency(holdingValue)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Desktop Grid Layout */}
                            <div className="hidden md:grid flex-[4] w-full grid-cols-5 gap-4 text-right items-start text-sm">
                                <div className="text-left text-gray-500 text-xs">
                                    <div className="font-mono">{formatCurrency(fund.costPrice, 4)}</div>
                                    <div className="font-mono text-gray-400">{fund.currentNav.toFixed(4)}</div>
                                </div>
                                <div className={`font-medium font-mono ${getSignColor(fund.dayChangePct)}`}>
                                    {formatPct(fund.dayChangePct)}
                                </div>
                                <div className={`font-medium font-mono ${getSignColor(fund.dayChangeVal)}`}>
                                    {formatSignedCurrency(fund.dayChangeVal)}
                                </div>
                                <div className="flex flex-col items-end">
                                    <div className={`font-medium font-mono ${getSignColor(totalReturn)}`}>
                                        {formatSignedCurrency(totalReturn)}
                                    </div>
                                    <div className={`text-[10px] font-mono ${getSignColor(totalReturnPct)}`}>
                                        {formatPct(totalReturnPct)}
                                    </div>
                                </div>
                                <div className="font-bold text-gray-800 dark:text-gray-100 font-mono">
                                    {formatCurrency(holdingValue)}
                                </div>
                            </div>

                            {/* Mobile Flex Layout */}
                            <div className="md:hidden flex flex-none gap-2 text-right items-start">
                                <div className="w-14 flex flex-col items-end">
                                    <div className={`text-sm font-medium font-mono ${getSignColor(fund.dayChangePct)}`}>
                                        {formatPct(fund.dayChangePct)}
                                    </div>
                                    <div className="text-[10px] text-gray-300 font-mono">{fund.currentNav.toFixed(4)}</div>
                                </div>

                                <div className="w-[4.5rem] flex items-start justify-end">
                                    <div className={`text-sm font-medium font-mono ${getSignColor(fund.dayChangeVal)}`}>
                                        {formatSignedCurrency(fund.dayChangeVal)}
                                    </div>
                                </div>

                                <div className="w-[4.5rem] flex flex-col items-end">
                                    <div className={`text-sm font-medium font-mono ${getSignColor(totalReturn)}`}>
                                        {formatSignedCurrency(totalReturn)}
                                    </div>
                                    <div className={`text-[10px] font-mono ${getSignColor(totalReturnPct)}`}>
                                        {formatPct(totalReturnPct)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-2 flex bg-white dark:bg-card-dark md:bg-transparent md:dark:bg-transparent md:mt-4 py-3 px-4 md:px-0 text-gray-500 dark:text-gray-400 text-sm items-center justify-between md:justify-start md:gap-4 font-sans">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setEditingFund(undefined);
                        setIsAddFundOpen(true);
                    }}
                    className="flex items-center gap-1 md:bg-white md:dark:bg-card-dark md:px-4 md:py-2 md:rounded-lg md:shadow-sm md:hover:bg-gray-50 md:dark:hover:bg-white/5 transition-colors"
                >
                    <Icons.Plus size={16} /> {t('common.addFund')}
                </button>
                <button className="flex items-center gap-1 md:bg-white md:dark:bg-card-dark md:px-4 md:py-2 md:rounded-lg md:shadow-sm md:hover:bg-gray-50 md:dark:hover:bg-white/5 transition-colors">
                    <Icons.Refresh size={14} /> {t('common.sync')}
                </button>
                <button className="flex items-center gap-1 md:bg-white md:dark:bg-card-dark md:px-4 md:py-2 md:rounded-lg md:shadow-sm md:hover:bg-gray-50 md:dark:hover:bg-white/5 transition-colors">
                    {t('common.batch')} <Icons.Copy size={14} />
                </button>
            </div>

            <AccountManagerModal
                isOpen={isAccountManagerOpen}
                onClose={() => setIsAccountManagerOpen(false)}
            />
            <AddFundModal
                isOpen={isAddFundOpen}
                onClose={() => setIsAddFundOpen(false)}
                editFund={editingFund}
            />
        </div>
    );
};