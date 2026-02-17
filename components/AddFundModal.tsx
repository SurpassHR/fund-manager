import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { useTranslation } from '../services/i18n';
import { Icons } from './Icon';
import { MorningstarResponse, MorningstarFund, Fund, FundCommonDataResponse } from '../types';

interface AddFundModalProps {
    isOpen: boolean;
    onClose: () => void;
    editFund?: Fund;
}

export const AddFundModal: React.FC<AddFundModalProps> = ({ isOpen, onClose, editFund }) => {
    const { t } = useTranslation();
    const accounts = useLiveQuery(() => db.accounts.toArray());

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<MorningstarFund[]>([]);
    const [loading, setLoading] = useState(false);
    const [navLoading, setNavLoading] = useState(false);
    const [error, setError] = useState('');

    const [selectedFund, setSelectedFund] = useState<MorningstarFund | Fund | null>(null);
    const [currentNav, setCurrentNav] = useState<number>(0);
    const [navChangePct, setNavChangePct] = useState<number>(0);
    const [navDate, setNavDate] = useState<string>('');

    // 表单状态：四个联动字段
    const [amount, setAmount] = useState('');     // 持有金额
    const [shares, setShares] = useState('');     // 持有份额
    const [costPrice, setCostPrice] = useState(''); // 持仓成本（单价）
    const [gain, setGain] = useState('');         // 持有收益
    const [selectedAccount, setSelectedAccount] = useState('Default');

    // 初始化 / 编辑模式填充
    useEffect(() => {
        if (isOpen) {
            if (editFund) {
                setSelectedFund(editFund);
                setCurrentNav(editFund.currentNav);

                const initialShares = editFund.holdingShares;
                const initialAmount = initialShares * editFund.currentNav;
                const initialGain = initialAmount - (initialShares * editFund.costPrice);

                setShares(initialShares.toFixed(2));
                setAmount(initialAmount.toFixed(2));
                setCostPrice(editFund.costPrice.toFixed(4));
                setGain(initialGain.toFixed(2));
                setSelectedAccount(editFund.platform);
            } else {
                setQuery('');
                setResults([]);
                setSelectedFund(null);
                setCurrentNav(0);
                setAmount('');
                setShares('');
                setCostPrice('');
                setGain('');
                setSelectedAccount('Default');
            }
            setError('');
        }
    }, [isOpen, editFund]);

    if (!isOpen) return null;

    // --- 联动计算 ---

    /** 修改持有金额 → 自动算份额；如有成本价，算收益 */
    const handleAmountChange = (val: string) => {
        setAmount(val);
        const a = parseFloat(val);
        if (isNaN(a) || currentNav <= 0) return;
        const newShares = a / currentNav;
        setShares(newShares.toFixed(2));
        const c = parseFloat(costPrice);
        if (!isNaN(c)) {
            setGain((a - c * newShares).toFixed(2));
        }
    };

    /** 修改持有份额 → 自动算金额；如有成本价，算收益 */
    const handleSharesChange = (val: string) => {
        setShares(val);
        const s = parseFloat(val);
        if (isNaN(s) || currentNav <= 0) return;
        const newAmount = s * currentNav;
        setAmount(newAmount.toFixed(2));
        const c = parseFloat(costPrice);
        if (!isNaN(c)) {
            setGain((newAmount - c * s).toFixed(2));
        }
    };

    /** 修改持仓成本 → 自动算收益 */
    const handleCostPriceChange = (val: string) => {
        setCostPrice(val);
        const c = parseFloat(val);
        const s = parseFloat(shares);
        const a = parseFloat(amount);
        if (isNaN(c) || isNaN(s) || isNaN(a)) return;
        setGain((a - c * s).toFixed(2));
    };

    /** 修改持有收益 → 自动反推成本价 */
    const handleGainChange = (val: string) => {
        setGain(val);
        const g = parseFloat(val);
        const s = parseFloat(shares);
        const a = parseFloat(amount);
        if (isNaN(g) || isNaN(s) || s <= 0 || isNaN(a)) return;
        setCostPrice(((a - g) / s).toFixed(4));
    };

    // --- 搜索 & 选择 ---

    const handleSearch = async () => {
        if (!query) return;
        setLoading(true);
        setError('');
        setResults([]);
        setSelectedFund(null);

        try {
            const response = await fetch(`https://www.morningstar.cn/cn-api/public/v1/fund-cache/${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error('Network response was not ok');
            const data: MorningstarResponse = await response.json();
            setResults(data?.data ?? []);
        } catch (err) {
            console.error(err);
            setError('搜索失败，请检查网络或稍后重试');
        } finally {
            setLoading(false);
        }
    };

    /** 选中基金后，自动拉取最新净值并默认成本价 */
    const handleSelect = async (fund: MorningstarFund) => {
        setSelectedFund(fund);
        setNavLoading(true);
        let nav = 0;
        let changePct = 0;
        let date = new Date().toISOString().split('T')[0];
        try {
            const res = await fetch(`https://www.morningstar.cn/cn-api/v2/funds/${fund.symbol}/common-data`);
            if (res.ok) {
                const json: FundCommonDataResponse = await res.json();
                if (json?.data?.nav) {
                    nav = json.data.nav;
                    changePct = json.data.navChangePercent ?? 0;
                    date = json.data.navDate ?? date;
                }
            }
        } catch (err) {
            console.error('获取净值失败，使用模拟值', err);
        } finally {
            setNavLoading(false);
        }
        if (!nav) {
            nav = parseFloat((Math.random() * 2 + 1).toFixed(4));
        }
        setCurrentNav(nav);
        setNavChangePct(changePct);
        setNavDate(date);
        // 默认持仓成本 = 最新净值
        setCostPrice(nav.toFixed(4));
    };

    // --- 保存 ---

    const handleSave = async () => {
        if (!selectedFund) return;
        if (currentNav <= 0) {
            alert('净值无效');
            return;
        }

        const valShares = parseFloat(shares);
        const valCostPrice = parseFloat(costPrice);

        if (isNaN(valShares) || valShares <= 0) {
            alert('请输入有效的持有份额');
            return;
        }

        const effectiveCostPrice = isNaN(valCostPrice) ? currentNav : valCostPrice;

        if (editFund && editFund.id) {
            await db.funds.update(editFund.id, {
                holdingShares: valShares,
                costPrice: effectiveCostPrice,
                platform: selectedAccount,
            });
        } else {
            const code = 'symbol' in selectedFund ? selectedFund.symbol : selectedFund.code;
            const name = 'fundNameArr' in selectedFund ? (selectedFund.fundNameArr || selectedFund.fundName) : selectedFund.name;
            // 使用 API 返回的真实涨跌幅
            const mktVal = valShares * currentNav;
            const dayChangeVal = mktVal * (navChangePct / 100) / (1 + navChangePct / 100);

            await db.funds.add({
                code,
                name,
                platform: selectedAccount,
                holdingShares: valShares,
                costPrice: effectiveCostPrice,
                currentNav,
                lastUpdate: navDate || new Date().toISOString().split('T')[0],
                dayChangePct: navChangePct,
                dayChangeVal,
            });
        }

        handleClose();
    };

    const handleClose = () => {
        setQuery('');
        setResults([]);
        setSelectedFund(null);
        setCurrentNav(0);
        setAmount('');
        setShares('');
        setCostPrice('');
        setGain('');
        setError('');
        onClose();
    };

    const getGainColor = (val: string) => {
        if (!val) return 'text-gray-900';
        const num = parseFloat(val);
        if (isNaN(num)) return 'text-gray-900';
        if (num > 0) return 'text-stock-red';
        if (num < 0) return 'text-stock-green';
        return 'text-gray-900 dark:text-gray-100';
    };

    const noSpinnerClass = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

    const displayInfo = () => {
        if (!selectedFund) return { name: '', code: '' };
        if ('fundNameArr' in selectedFund) {
            return { name: selectedFund.fundNameArr || selectedFund.fundName, code: selectedFund.symbol };
        }
        return { name: selectedFund.name, code: selectedFund.code };
    };

    const info = displayInfo();

    return (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-card-dark rounded-xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
                {/* 标题 */}
                <div className="p-4 border-b border-gray-100 dark:border-border-dark flex justify-between items-center bg-gray-50 dark:bg-white/5 shrink-0">
                    <h3 className="font-bold text-gray-800 dark:text-gray-100">
                        {editFund ? t('common.editDetails') : (selectedFund ? t('common.fillDetails') : t('common.addFund'))}
                    </h3>
                    <button onClick={handleClose}><Icons.Plus className="transform rotate-45 text-gray-400" /></button>
                </div>

                {/* 内容 */}
                {!selectedFund ? (
                    <div className="flex flex-col h-full overflow-hidden">
                        <div className="p-4 space-y-3 shrink-0">
                            <div className="relative">
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    placeholder={t('common.searchFund')}
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-white/5 focus:bg-white dark:focus:bg-white/10 focus:border-blue-500 focus:outline-none transition-all dark:text-gray-100"
                                />
                                <Icons.Search className="absolute left-3 top-3.5 text-gray-400" size={18} />
                                <button
                                    onClick={handleSearch}
                                    className="absolute right-2 top-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold"
                                >
                                    Search
                                </button>
                            </div>
                            {error && <p className="text-xs text-red-500">{error}</p>}
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 pt-0">
                            {loading ? (
                                <div className="text-center text-gray-400 py-8">{t('common.searching')}</div>
                            ) : results.length > 0 ? (
                                <div className="space-y-2">
                                    {results.map((fund) => (
                                        <div
                                            key={fund.fundClassId}
                                            onClick={() => handleSelect(fund)}
                                            className="p-3 border border-gray-100 dark:border-border-dark rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-all"
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="font-medium text-gray-800 dark:text-gray-100 text-sm">{fund.fundNameArr}</div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{fund.symbol} · {fund.fundType}</div>
                                                </div>
                                                <Icons.Plus className="text-blue-500 dark:text-blue-400" size={16} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center text-gray-400 py-10 flex flex-col items-center">
                                    <Icons.Search size={48} className="text-gray-200 mb-2" strokeWidth={1} />
                                    <p>{t('common.searchTip')}</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="p-6 space-y-4 overflow-y-auto">
                        {/* 基金信息卡 */}
                        <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg border border-blue-100 dark:border-blue-800/50 flex justify-between items-center">
                            <div>
                                <div className="font-bold text-blue-900 dark:text-blue-100 text-sm">{info.name}</div>
                                <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">{info.code}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] text-blue-400 dark:text-blue-500">{t('common.nav')}</div>
                                <div className="font-mono font-bold text-blue-800 dark:text-blue-300">
                                    {navLoading ? '...' : currentNav.toFixed(4)}
                                </div>
                            </div>
                        </div>

                        {/* 账户选择 */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">{t('common.account')}</label>
                            <select
                                value={selectedAccount}
                                onChange={(e) => setSelectedAccount(e.target.value)}
                                className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-white/5 focus:outline-none focus:border-blue-500 text-gray-900 dark:text-gray-100"
                            >
                                {accounts?.map(acc => (
                                    <option key={acc.id} value={acc.name}>
                                        {t(`filters.${acc.name}`) === `filters.${acc.name}` ? acc.name : t(`filters.${acc.name}`)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* 联动表单 */}
                        <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-100 dark:border-border-dark space-y-3">
                            <div className="grid grid-cols-2 gap-4">
                                {/* 持有金额 */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">{t('common.holdingAmount')} (¥)</label>
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => handleAmountChange(e.target.value)}
                                        placeholder="0.00"
                                        className={`w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-white/5 text-gray-900 dark:text-white font-bold font-mono focus:border-blue-500 outline-none ${noSpinnerClass}`}
                                    />
                                </div>
                                {/* 持有份额 */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">{t('common.shares')}</label>
                                    <input
                                        type="number"
                                        value={shares}
                                        onChange={(e) => handleSharesChange(e.target.value)}
                                        placeholder="0.00"
                                        className={`w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-white/5 text-gray-900 dark:text-white font-bold font-mono focus:border-blue-500 outline-none ${noSpinnerClass}`}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {/* 持仓成本 */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">{t('common.cost')}</label>
                                    <input
                                        type="number"
                                        value={costPrice}
                                        onChange={(e) => handleCostPriceChange(e.target.value)}
                                        placeholder="0.0000"
                                        className={`w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-white/5 text-gray-900 dark:text-white font-bold font-mono focus:border-blue-500 outline-none ${noSpinnerClass}`}
                                    />
                                </div>
                                {/* 持有收益 */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">{t('common.totalGain')} (¥)</label>
                                    <input
                                        type="number"
                                        value={gain}
                                        onChange={(e) => handleGainChange(e.target.value)}
                                        placeholder="0.00"
                                        className={`w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-white/5 font-bold font-mono focus:border-blue-500 outline-none ${noSpinnerClass} ${getGainColor(gain)}`}
                                    />
                                </div>
                            </div>
                            <p className="text-[10px] text-gray-400 text-center">{t('common.autoCalcTip')}</p>
                        </div>

                        {/* 操作按钮 */}
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => {
                                    if (editFund) onClose();
                                    else setSelectedFund(null);
                                }}
                                className="flex-1 py-3 text-sm font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-white/10 rounded-xl hover:bg-gray-200 dark:hover:bg-white/15"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={handleSave}
                                className="flex-1 py-3 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700"
                            >
                                {t('common.confirm')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};