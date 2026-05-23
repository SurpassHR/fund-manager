import React, { useCallback, useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import {
  deriveFundGainActivationState,
  deriveFundIntradayDisplayMetrics,
} from '../services/fundDayChange';
import { useTranslation } from '../services/i18n';
import { Icons } from './Icon';
import { SelectDropdown } from './SelectDropdown';
import { FundSearchInput } from './FundSearchInput';
import type { MorningstarFund, Fund, WatchlistItem } from '../types';
import { fetchFundCommonData } from '../services/api';
import { isValidIsoDate } from '../services/dateInput';
import { ModalShell } from './ModalShell';
import { deductAvailableForBuy } from '../services/assetAllocation';

interface AddHoldingModalProps {
  isOpen: boolean;
  onClose: () => void;
  editFund?: Fund;
  prefillWatchlistItem?: WatchlistItem;
  onFundAdded?: () => void | Promise<void>;
}

export const AddHoldingModal: React.FC<AddHoldingModalProps> = ({
  isOpen,
  onClose,
  editFund,
  prefillWatchlistItem,
  onFundAdded,
}) => {
  const { t } = useTranslation();
  const accounts = useLiveQuery(() => db.accounts.toArray());
  const [isSaving, setIsSaving] = useState(false);
  const [navLoading, setNavLoading] = useState(false);

  const [selectedFund, setSelectedFund] = useState<MorningstarFund | Fund | null>(null);
  const [currentNav, setCurrentNav] = useState<number>(0);
  const [navChangePct, setNavChangePct] = useState<number>(0);
  const [navDate, setNavDate] = useState<string>('');

  // 表单状态
  const [amount, setAmount] = useState('');
  const [shares, setShares] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [gain, setGain] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('Default');
  const [buyDate, setBuyDate] = useState<string>('');
  const [buyTime, setBuyTime] = useState<'before15' | 'after15'>('before15');
  const [settlementDays, setSettlementDays] = useState<number>(1);

  // 重置搜索组件
  const [searchKey, setSearchKey] = useState(0);

  const getFallbackAccountName = useCallback(() => {
    if (!accounts || accounts.length === 0) return 'Default';
    return accounts.find((acc) => acc.isDefault)?.name || accounts[0].name;
  }, [accounts]);

  const showSearch = !editFund && !prefillWatchlistItem;

  // 初始化
  useEffect(() => {
    if (isOpen) {
      if (editFund) {
        setSelectedFund(editFund);
        setCurrentNav(editFund.currentNav);

        const initialShares = editFund.holdingShares;
        const initialAmount = initialShares * editFund.currentNav;
        const initialGain = initialAmount - initialShares * editFund.costPrice;

        setShares(initialShares.toFixed(2));
        setAmount(initialAmount.toFixed(2));
        setCostPrice(editFund.costPrice.toFixed(4));
        setGain(initialGain.toFixed(2));
        setNavChangePct(editFund.dayChangePct);
        setSelectedAccount(editFund.platform || getFallbackAccountName());
        setBuyDate(editFund.buyDate || new Date().toISOString().split('T')[0]);
        setBuyTime(editFund.buyTime || 'before15');
        setSettlementDays(editFund.settlementDays ?? 1);
      } else if (prefillWatchlistItem) {
        setSelectedFund({
          code: prefillWatchlistItem.code,
          name: prefillWatchlistItem.name,
          platform: getFallbackAccountName(),
          holdingShares: 0,
          costPrice: prefillWatchlistItem.currentPrice,
          currentNav: prefillWatchlistItem.currentPrice,
          lastUpdate: prefillWatchlistItem.lastUpdate,
          dayChangePct: prefillWatchlistItem.dayChangePct,
          dayChangeVal: 0,
        });
        setCurrentNav(prefillWatchlistItem.currentPrice);
        setAmount('');
        setShares('');
        setCostPrice(prefillWatchlistItem.currentPrice.toFixed(4));
        setGain('');
        setNavChangePct(prefillWatchlistItem.dayChangePct);
        setNavDate(prefillWatchlistItem.lastUpdate || new Date().toISOString().split('T')[0]);
        setSelectedAccount(getFallbackAccountName());
        setBuyDate(new Date().toISOString().split('T')[0]);
        setBuyTime(new Date().getHours() < 15 ? 'before15' : 'after15');
        setSettlementDays(1);
      } else {
        setSelectedFund(null);
        setCurrentNav(0);
        setAmount('');
        setShares('');
        setCostPrice('');
        setGain('');
        setSelectedAccount(getFallbackAccountName());
        setBuyDate(new Date().toISOString().split('T')[0]);
        setBuyTime(new Date().getHours() < 15 ? 'before15' : 'after15');
        setSettlementDays(1);
        setSearchKey((k) => k + 1);
      }
    }
  }, [isOpen, editFund, prefillWatchlistItem, getFallbackAccountName]);

  useEffect(() => {
    if (!isOpen || !accounts || accounts.length === 0) return;
    const exists = accounts.some((acc) => acc.name === selectedAccount);
    if (!exists) {
      setSelectedAccount(getFallbackAccountName());
    }
  }, [accounts, getFallbackAccountName, isOpen, selectedAccount]);

  // --- 联动计算 ---

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

  const handleCostPriceChange = (val: string) => {
    setCostPrice(val);
    const c = parseFloat(val);
    const s = parseFloat(shares);
    const a = parseFloat(amount);
    if (isNaN(c) || isNaN(s) || isNaN(a)) return;
    setGain((a - c * s).toFixed(2));
  };

  const handleGainChange = (val: string) => {
    setGain(val);
    const g = parseFloat(val);
    const s = parseFloat(shares);
    const a = parseFloat(amount);
    if (isNaN(g) || isNaN(s) || s <= 0 || isNaN(a)) return;
    setCostPrice(((a - g) / s).toFixed(4));
  };

  const handleBuyDateChange = (nextValue: string) => {
    if (isValidIsoDate(nextValue)) {
      setBuyDate(nextValue);
    }
  };

  // --- 选中基金 ---

  const handleSelectFund = async (fund: MorningstarFund) => {
    setSelectedFund(fund);
    setNavLoading(true);
    let nav = 0;
    let changePct = 0;
    let date = new Date().toISOString().split('T')[0];
    try {
      const json = await fetchFundCommonData(fund.symbol);
      if (json?.data?.nav) {
        nav = json.data.nav;
        changePct = json.data.navChangePercent ?? 0;
        date = json.data.navDate ?? date;
      }
    } catch (err) {
      console.error('获取净值失败', err);
    } finally {
      setNavLoading(false);
    }
    if (!nav) {
      nav = parseFloat((Math.random() * 2 + 1).toFixed(4));
    }
    setCurrentNav(nav);
    setNavChangePct(changePct);
    setNavDate(date);
    setCostPrice(nav.toFixed(4));
  };

  // --- 保存 ---

  const handleSave = async () => {
    if (isSaving) return;
    if (!selectedFund) return;
    if (currentNav <= 0) {
      alert('净值无效');
      return;
    }

    const valShares = parseFloat(shares);
    const valCostPrice = parseFloat(costPrice);
    const valAmount = parseFloat(amount);

    if (isNaN(valShares) || valShares <= 0) {
      alert('请输入有效的持有份额');
      return;
    }

    const effectiveCostPrice = isNaN(valCostPrice) ? currentNav : valCostPrice;

    setIsSaving(true);

    try {
      const isReAddingCleared = editFund ? editFund.holdingShares <= 0.01 : false;
      // 清仓重加时不使用旧记录的 lastUpdate（可能远过期），改用今天
      const effectiveNavDate = isReAddingCleared
        ? new Date().toISOString().split('T')[0]
        : editFund?.lastUpdate || navDate || buyDate || new Date().toISOString().split('T')[0];
      // 清仓重加时 navChangePct 来自旧记录（过期），应清零
      const effectiveNavChangePct = isReAddingCleared ? 0 : navChangePct;
      const { isGainActive, dayChangeBaseNav } = deriveFundGainActivationState({
        buyDate,
        buyTime,
        settlementDays,
        effectivePctDate: effectiveNavDate,
        costPrice: effectiveCostPrice,
      });
      const metrics = deriveFundIntradayDisplayMetrics({
        holdingShares: valShares,
        nav: currentNav,
        navDate: effectiveNavDate,
        todayStr: effectiveNavDate,
        navChangePercent: effectiveNavChangePct,
        shouldEstimate: false,
        isGainActive,
        dayChangeBaseNav,
      });

      if (editFund && editFund.id) {
        await db.funds.update(editFund.id, {
          holdingShares: valShares,
          costPrice: effectiveCostPrice,
          currentNav,
          lastUpdate: effectiveNavDate,
          platform: selectedAccount,
          dayChangeVal: metrics.dayChangeVal,
          dayChangePct: metrics.dayChangePct,
          buyDate,
          buyTime,
          settlementDays,
          ...(isReAddingCleared
            ? {
                realizedGain: null as unknown as number,
                realizedGainCost: null as unknown as number,
                pendingTransactions: null as unknown as typeof editFund.pendingTransactions,
                positionOpenAmount: isNaN(valAmount) ? undefined : valAmount,
                positionOpenDate: buyDate || undefined,
              }
            : {}),
        });

        onClose();
        return;
      }

      const code = 'symbol' in selectedFund ? selectedFund.symbol : selectedFund.code;
      const name =
        'fundNameArr' in selectedFund
          ? selectedFund.fundNameArr || selectedFund.fundName
          : selectedFund.name;

      await db.funds.add({
        code,
        name,
        platform: selectedAccount,
        holdingShares: valShares,
        costPrice: effectiveCostPrice,
        currentNav,
        lastUpdate: effectiveNavDate,
        dayChangePct: metrics.dayChangePct,
        dayChangeVal: metrics.dayChangeVal,
        buyDate,
        buyTime,
        settlementDays,
        positionOpenAmount: isNaN(valAmount) ? undefined : valAmount,
        positionOpenDate: buyDate || undefined,
      });

      // 从活期可用资产中扣除投入金额，保持总资产不变
      const deductAmount = !isNaN(valAmount) ? valAmount : valShares * effectiveCostPrice;
      deductAvailableForBuy(deductAmount);

      onClose();

      void Promise.resolve(onFundAdded?.()).catch((err) => {
        console.error('onFundAdded callback failed', err);
      });
    } catch (err) {
      console.error('保存基金失败', err);
      alert('保存失败，请稍后重试');
      setIsSaving(false);
    }
  };

  const getGainColor = (val: string) => {
    if (!val) return 'text-[var(--app-shell-ink)]';
    const num = parseFloat(val);
    if (isNaN(num)) return 'text-[var(--app-shell-ink)]';
    if (num > 0) return 'text-stock-red';
    if (num < 0) return 'text-stock-green';
    return 'text-[var(--app-shell-ink)]';
  };

  const noSpinnerClass =
    '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';

  const displayInfo = () => {
    if (!selectedFund) return { name: '', code: '' };
    if ('fundNameArr' in selectedFund) {
      return { name: selectedFund.fundNameArr || selectedFund.fundName, code: selectedFund.symbol };
    }
    return { name: selectedFund.name, code: selectedFund.code };
  };

  const info = displayInfo();

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} overlayId="add-holding-modal" edgeSwipe>
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] shrink-0">
        <h3 className="text-lg font-bold text-[var(--app-shell-ink)]">
          {editFund ? t('common.editDetails') : t('common.fillDetails')}
        </h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors text-[var(--app-shell-muted)]"
        >
          <Icons.Plus size={20} className="transform rotate-45" />
        </button>
      </div>

      {/* 内容区域 */}
      <div className="p-4 space-y-4 overflow-y-auto flex-1">
        {/* 搜索框（仅新增且无预填时显示） */}
        {showSearch && <FundSearchInput key={`search-${searchKey}`} onSelect={handleSelectFund} />}

        {/* 基金信息卡 */}
        {selectedFund ? (
          <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-xl border border-blue-100 dark:border-blue-800/50 flex justify-between items-center">
            <div className="min-w-0 flex-1">
              <div className="font-bold text-blue-900 dark:text-blue-100 text-sm truncate">
                {info.name}
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">{info.code}</div>
            </div>
            <div className="text-right shrink-0 ml-3">
              <div className="text-[10px] text-blue-400 dark:text-blue-500">{t('common.nav')}</div>
              <div className="font-sans font-bold text-blue-800 dark:text-blue-300">
                {navLoading ? '...' : currentNav.toFixed(4)}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[var(--app-shell-panel)] p-4 rounded-xl border border-dashed border-[var(--app-shell-line)] text-center">
            <p className="text-sm text-[var(--app-shell-muted)]">请在上方搜索并选择一只基金</p>
          </div>
        )}

        {/* 账户选择 */}
        <div>
          <label className="block text-xs font-bold text-[var(--app-shell-muted)] mb-1">
            {t('common.account')}
          </label>
          <SelectDropdown
            options={
              accounts?.map((acc) => ({
                value: acc.name,
                label:
                  t(`filters.${acc.name}`) === `filters.${acc.name}`
                    ? acc.name
                    : t(`filters.${acc.name}`),
              })) ?? []
            }
            value={selectedAccount}
            onChange={setSelectedAccount}
            className="w-full p-3 border border-[var(--app-shell-line)] rounded-xl bg-[var(--app-shell-panel)] focus:outline-none focus:border-blue-500 text-[var(--app-shell-ink)] text-sm"
          />
        </div>

        {/* 买入日期 / 买入时间 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[var(--app-shell-muted)] mb-1">
              {t('common.buyDate') || '买入日期'}
            </label>
            <input
              type="date"
              value={buyDate}
              onChange={(e) => handleBuyDateChange(e.target.value)}
              className="w-full p-2.5 border border-[var(--app-shell-line)] rounded-xl bg-[var(--app-shell-panel)] focus:outline-none focus:border-blue-500 text-[var(--app-shell-ink)] text-sm font-sans"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[var(--app-shell-muted)] mb-1">
              {t('common.buyTime') || '买入时间'}
            </label>
            <SelectDropdown
              options={[
                { value: 'before15', label: t('common.before15') || '15:00前' },
                { value: 'after15', label: t('common.after15') || '15:00后' },
              ]}
              value={buyTime}
              onChange={(v) => setBuyTime(v as 'before15' | 'after15')}
              className="w-full p-2.5 border border-[var(--app-shell-line)] rounded-xl bg-[var(--app-shell-panel)] focus:outline-none focus:border-blue-500 text-[var(--app-shell-ink)] text-sm font-sans"
            />
          </div>
        </div>

        {/* T+N */}
        <div>
          <label className="block text-xs font-bold text-[var(--app-shell-muted)] mb-1">
            {t('common.settlementDays') || '确认天数 (T+N)'}
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--app-shell-muted)] font-medium">T +</span>
            <input
              type="number"
              min="0"
              max="10"
              value={settlementDays}
              onChange={(e) => setSettlementDays(Math.max(0, parseInt(e.target.value) || 0))}
              className={`w-20 p-2.5 border border-[var(--app-shell-line)] rounded-xl bg-[var(--app-shell-panel)] focus:outline-none focus:border-blue-500 text-[var(--app-shell-ink)] text-sm font-sans font-bold text-center ${noSpinnerClass}`}
            />
            <span className="text-xs text-[var(--app-shell-muted)]">个交易日</span>
          </div>
        </div>

        {/* 联动表单 */}
        <div className="p-3 bg-[var(--app-shell-panel)] rounded-xl border border-[var(--app-shell-line)] space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[var(--app-shell-muted)] mb-1">
                {t('common.holdingAmount')} (¥)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0.00"
                className={`w-full p-2 border border-[var(--app-shell-line)] rounded-xl bg-[var(--app-shell-paper)] dark:bg-[var(--app-shell-paper-dark)] text-[var(--app-shell-ink)] font-bold font-sans focus:border-blue-500 outline-none ${noSpinnerClass}`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--app-shell-muted)] mb-1">
                {t('common.shares')}
              </label>
              <input
                type="number"
                value={shares}
                onChange={(e) => handleSharesChange(e.target.value)}
                placeholder="0.00"
                className={`w-full p-2 border border-[var(--app-shell-line)] rounded-xl bg-[var(--app-shell-paper)] dark:bg-[var(--app-shell-paper-dark)] text-[var(--app-shell-ink)] font-bold font-sans focus:border-blue-500 outline-none ${noSpinnerClass}`}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[var(--app-shell-muted)] mb-1">
                {t('common.cost')}
              </label>
              <input
                type="number"
                value={costPrice}
                onChange={(e) => handleCostPriceChange(e.target.value)}
                placeholder="0.0000"
                className={`w-full p-2 border border-[var(--app-shell-line)] rounded-xl bg-[var(--app-shell-paper)] dark:bg-[var(--app-shell-paper-dark)] text-[var(--app-shell-ink)] font-bold font-sans focus:border-blue-500 outline-none ${noSpinnerClass}`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--app-shell-muted)] mb-1">
                {t('common.totalGain')} (¥)
              </label>
              <input
                type="number"
                value={gain}
                onChange={(e) => handleGainChange(e.target.value)}
                placeholder="0.00"
                className={`w-full p-2 border border-[var(--app-shell-line)] rounded-xl bg-[var(--app-shell-paper)] dark:bg-[var(--app-shell-paper-dark)] font-bold font-sans focus:border-blue-500 outline-none ${noSpinnerClass} ${getGainColor(gain)}`}
              />
            </div>
          </div>
          <p className="text-[10px] text-[var(--app-shell-muted)] text-center">
            {t('common.autoCalcTip')}
          </p>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => {
              if (isSaving) return;
              onClose();
            }}
            disabled={isSaving}
            className="flex-1 py-3 text-sm font-bold text-[var(--app-shell-muted)] bg-[var(--app-shell-panel)] rounded-xl hover:bg-[var(--app-shell-line)] transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !selectedFund}
            className="flex-1 py-3 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t('common.confirm')}
          </button>
        </div>
      </div>
    </ModalShell>
  );
};
