import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Icons } from './Icon';
import { useTranslation } from '../services/i18n';
import { WatchlistItem, MorningstarFund } from '../types';
import { searchFunds } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';

interface AddWatchlistModalProps {
    isOpen: boolean;
    onClose: () => void;
    editItem?: WatchlistItem;
}

export const AddWatchlistModal: React.FC<AddWatchlistModalProps> = ({ isOpen, onClose, editItem }) => {
    const { t } = useTranslation();
    const [type, setType] = useState<'fund' | 'index'>('fund');
    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    const [anchorPrice, setAnchorPrice] = useState('');
    const [anchorDate, setAnchorDate] = useState(new Date().toISOString().split('T')[0]);

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<MorningstarFund[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (editItem) {
                setType(editItem.type);
                setCode(editItem.code);
                setName(editItem.name);
                setAnchorPrice(editItem.anchorPrice.toString());
                setAnchorDate(editItem.anchorDate);
                setSearchQuery('');
                setSearchResults([]);
            } else {
                setType('fund');
                setCode('');
                setName('');
                setAnchorPrice('');
                setAnchorDate(new Date().toISOString().split('T')[0]);
                setSearchQuery('');
                setSearchResults([]);
            }
        }
    }, [isOpen, editItem]);

    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchQuery.trim().length >= 2 && type === 'fund') {
                setIsSearching(true);
                const res = await searchFunds(searchQuery);
                if (res && res.data) {
                    setSearchResults(res.data);
                } else {
                    setSearchResults([]);
                }
                setIsSearching(false);
            } else {
                setSearchResults([]);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery, type]);

    const handleSelectFund = (fund: MorningstarFund) => {
        setCode(fund.symbol);
        setName(fund.fundName);
        setSearchQuery(''); // Close dropdown
    };

    const handleSave = async () => {
        if (!code || !name || !anchorPrice || !anchorDate) {
            alert(t('common.fillDetails') || 'Please fill all details');
            return;
        }

        const price = parseFloat(anchorPrice);
        if (isNaN(price)) {
            alert(t('common.anchorPrice') + ' Error');
            return;
        }

        try {
            if (editItem && editItem.id) {
                await db.watchlists.update(editItem.id, {
                    code,
                    name,
                    type,
                    anchorPrice: price,
                    anchorDate,
                    // Don't modify currentPrice or dayChangePct if editing
                });
            } else {
                await db.watchlists.add({
                    code,
                    name,
                    type,
                    anchorPrice: price,
                    anchorDate,
                    currentPrice: price, // Start with anchor price
                    dayChangePct: 0,
                    lastUpdate: anchorDate,
                });
            }
            onClose();
        } catch (e) {
            console.error(e);
            alert('Error saving watchlist item');
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-white dark:bg-card-dark rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-border-dark bg-gray-50/50 dark:bg-white/5">
                        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                            {editItem ? t('common.edit') : t('common.addWatchlist')}
                        </h2>
                        <button onClick={onClose} className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors text-gray-500">
                            <Icons.Plus size={20} className="transform rotate-45" />
                        </button>
                    </div>

                    {/* Type Selector (Only when adding) */}
                    <div className="p-4 flex flex-col gap-4 overflow-y-auto">
                        {!editItem && (
                            <div className="flex bg-gray-100 dark:bg-white/10 p-1 rounded-lg">
                                <button
                                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${type === 'fund' ? 'bg-white dark:bg-card-dark text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                                    onClick={() => setType('fund')}
                                >
                                    {t('common.fund')}
                                </button>
                                <button
                                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${type === 'index' ? 'bg-white dark:bg-card-dark text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                                    onClick={() => setType('index')}
                                >
                                    {t('common.indexOrSector')}
                                </button>
                            </div>
                        )}

                        {/* Fund Search */}
                        {type === 'fund' && !editItem && (
                            <div className="relative z-20">
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">
                                    {t('common.searchFund')}
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Icons.Settings size={16} className={`text-gray-400 ${isSearching ? 'animate-spin' : ''}`} />
                                    </div>
                                    <input
                                        type="text"
                                        className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-border-dark rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                                        placeholder="e.g. 110011 or 易方达"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>

                                {/* Dropdown */}
                                {searchResults.length > 0 && searchQuery && (
                                    <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-lg shadow-xl max-h-60 overflow-y-auto z-50">
                                        {searchResults.map((fund) => (
                                            <div
                                                key={fund.fundClassId}
                                                className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer border-b border-gray-50 dark:border-border-dark last:border-0"
                                                onClick={() => handleSelectFund(fund)}
                                            >
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate pr-2">{fund.fundName}</span>
                                                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400">{fund.symbol}</span>
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 flex gap-2">
                                                    <span>{fund.fundType}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Code & Name (Manual Entry / Selected) */}
                        <div className="grid grid-cols-2 gap-4 relative z-10">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">{t('common.code')}</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-border-dark rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    placeholder={type === 'index' ? 'sh000001' : '110011'}
                                />
                            </div>
                            <div className="col-span-1">
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">{t('common.fund')}</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-border-dark rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder={type === 'index' ? '上证指数' : '易方达蓝筹'}
                                />
                            </div>
                        </div>

                        {/* Anchor Details */}
                        <div className="grid grid-cols-2 gap-4 relative z-10">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">{t('common.anchorPrice')}</label>
                                <input
                                    type="number"
                                    step="0.0001"
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-border-dark rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                                    value={anchorPrice}
                                    onChange={(e) => setAnchorPrice(e.target.value)}
                                    placeholder="e.g. 1.0500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">{t('common.anchorDate')}</label>
                                <input
                                    type="date"
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-border-dark rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                                    value={anchorDate}
                                    onChange={(e) => setAnchorDate(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="text-xs text-gray-400 mt-2 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg text-blue-600 dark:text-blue-400">
                            {type === 'index' ?
                                '提示：指数使用腾讯接口，代码如 sh000001, sz399001。' :
                                '提示：基金数据将通过 API 自动刷新。'
                            }
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-gray-100 dark:border-border-dark bg-gray-50/50 dark:bg-white/5 flex justify-end gap-3 z-10">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg transition-colors"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
                        >
                            {t('common.save')}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
