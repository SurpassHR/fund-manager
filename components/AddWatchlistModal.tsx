import React, { useCallback, useEffect, useState } from 'react';
import { db } from '../services/db';
import { Icons } from './Icon';
import { useTranslation } from '../services/i18n';
import { FundSearchInput } from './FundSearchInput';
import type { WatchlistItem, MorningstarFund } from '../types';
import { fetchHistoricalFundNav, fetchHistoricalIndexPrice } from '../services/api';
import { isValidIsoDate } from '../services/dateInput';
import { pickWatchlistNameFromMorningstar } from '../services/watchlistName';
import { ModalShell } from './ModalShell';

interface AddWatchlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  editItem?: WatchlistItem;
}

export const AddWatchlistModal: React.FC<AddWatchlistModalProps> = ({
  isOpen,
  onClose,
  editItem,
}) => {
  const { t } = useTranslation();
  const [type, setType] = useState<'fund' | 'index'>('fund');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [anchorPrice, setAnchorPrice] = useState('');
  const [anchorDate, setAnchorDate] = useState(new Date().toISOString().split('T')[0]);

  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchKey, setSearchKey] = useState(0);

  // 自动获取锚点价格
  useEffect(() => {
    if (!code || !anchorDate || isOpen === false) {
      setAnchorPrice('');
      return;
    }

    if (editItem && editItem.code === code && editItem.anchorDate === anchorDate) {
      setAnchorPrice(editItem.anchorPrice.toString());
      return;
    }

    const fetchPrice = async () => {
      setIsFetchingPrice(true);
      try {
        let price: number | null = null;
        if (type === 'fund') {
          price = await fetchHistoricalFundNav(code, anchorDate);
        } else {
          price = await fetchHistoricalIndexPrice(code, anchorDate);
        }

        if (price !== null) {
          setAnchorPrice(price.toString());
        } else {
          setAnchorPrice('');
        }
      } catch (error) {
        console.error('Failed to fetch historical price:', error);
        setAnchorPrice('');
      } finally {
        setIsFetchingPrice(false);
      }
    };

    fetchPrice();
  }, [code, type, anchorDate, isOpen, editItem]);

  useEffect(() => {
    if (isOpen) {
      if (editItem) {
        setType(editItem.type);
        setCode(editItem.code);
        setName(editItem.name);
        setAnchorPrice(editItem.anchorPrice.toString());
        setAnchorDate(editItem.anchorDate);
      } else {
        setType('fund');
        setCode('');
        setName('');
        setAnchorPrice('');
        setAnchorDate(new Date().toISOString().split('T')[0]);
        setSearchKey((k) => k + 1);
      }
    }
  }, [isOpen, editItem]);

  const handleClose = useCallback(() => {
    setIsSaving(false);
    onClose();
  }, [onClose]);

  const handleAnchorDateChange = (nextValue: string) => {
    if (isValidIsoDate(nextValue)) {
      setAnchorDate(nextValue);
    }
  };

  const handleSelectFund = (fund: MorningstarFund) => {
    setCode(fund.symbol);
    setName(pickWatchlistNameFromMorningstar(fund));
  };

  const handleSave = async () => {
    if (isSaving) return;
    if (!code || !name || !anchorPrice || !anchorDate) {
      alert(t('common.fillDetails') || 'Please fill all details');
      return;
    }

    const price = parseFloat(anchorPrice);
    if (isNaN(price)) {
      alert(t('common.anchorPrice') + ' Error');
      return;
    }

    setIsSaving(true);

    try {
      if (editItem && editItem.id) {
        await db.watchlists.update(editItem.id, {
          code,
          name,
          type,
          anchorPrice: price,
          anchorDate,
        });
      } else {
        await db.watchlists.add({
          code,
          name,
          type,
          anchorPrice: price,
          anchorDate,
          currentPrice: price,
          dayChangePct: 0,
          lastUpdate: anchorDate,
        });
      }
      handleClose();
    } catch (e) {
      console.error(e);
      alert('Error saving watchlist item');
      setIsSaving(false);
    }
  };

  return (
    <ModalShell isOpen={isOpen} onClose={handleClose} overlayId="add-watchlist-modal" edgeSwipe>
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] shrink-0">
        <h2 className="text-lg font-bold text-[var(--app-shell-ink)]">
          {editItem ? t('common.edit') : t('common.addWatchlist')}
        </h2>
        <button
          onClick={handleClose}
          className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors text-[var(--app-shell-muted)]"
        >
          <Icons.Plus size={20} className="transform rotate-45" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-1">
        {/* 类型选择器（仅新增时） */}
        {!editItem && (
          <div className="flex bg-[var(--app-shell-panel)] rounded-xl p-1 border border-[var(--app-shell-line)]">
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${type === 'fund' ? 'bg-white dark:bg-card-dark text-blue-600 shadow-sm' : 'text-[var(--app-shell-muted)] hover:text-[var(--app-shell-ink)]'}`}
              onClick={() => setType('fund')}
            >
              {t('common.fund')}
            </button>
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${type === 'index' ? 'bg-white dark:bg-card-dark text-blue-600 shadow-sm' : 'text-[var(--app-shell-muted)] hover:text-[var(--app-shell-ink)]'}`}
              onClick={() => setType('index')}
            >
              {t('common.indexOrSector')}
            </button>
          </div>
        )}

        {/* 基金搜索（仅基金类型新增时） */}
        {type === 'fund' && !editItem && (
          <FundSearchInput key={`ws-${searchKey}`} onSelect={handleSelectFund} />
        )}

        {/* 代码 & 名称 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[var(--app-shell-muted)] mb-1">
              {t('common.code')}
            </label>
            <input
              type="text"
              className="w-full px-3 py-2.5 bg-[var(--app-shell-panel)] border border-[var(--app-shell-line)] rounded-xl text-sm focus:outline-none focus:border-blue-500 text-[var(--app-shell-ink)]"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={
                type === 'index'
                  ? t('common.indexCodePlaceholder')
                  : t('common.fundCodePlaceholder')
              }
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[var(--app-shell-muted)] mb-1">
              {t('common.fund')}
            </label>
            <input
              type="text"
              className="w-full px-3 py-2.5 bg-[var(--app-shell-panel)] border border-[var(--app-shell-line)] rounded-xl text-sm focus:outline-none focus:border-blue-500 text-[var(--app-shell-ink)]"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                type === 'index'
                  ? t('common.indexNamePlaceholder')
                  : t('common.fundNamePlaceholder')
              }
            />
          </div>
        </div>

        {/* 锚点详情 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[var(--app-shell-muted)] mb-1">
              {t('common.anchorPrice')}
            </label>
            <div className="relative">
              <input
                type="text"
                className="w-full px-3 py-2.5 bg-[var(--app-shell-panel)] border border-[var(--app-shell-line)] rounded-xl text-sm text-[var(--app-shell-muted)] cursor-not-allowed"
                value={anchorPrice}
                readOnly
                placeholder={isFetchingPrice ? t('common.fetching') : t('common.autoFillDate')}
              />
              {isFetchingPrice && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Icons.Settings size={16} className="text-blue-500 animate-spin" />
                </div>
              )}
            </div>
            {!anchorPrice && !isFetchingPrice && code && (
              <span className="text-[10px] text-red-500 mt-1 block">{t('common.noDataDate')}</span>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-[var(--app-shell-muted)] mb-1">
              {t('common.anchorDate')}
            </label>
            <input
              type="date"
              className="w-full px-3 py-2.5 bg-[var(--app-shell-panel)] border border-[var(--app-shell-line)] rounded-xl text-sm focus:outline-none focus:border-blue-500 text-[var(--app-shell-ink)]"
              value={anchorDate}
              onChange={(e) => handleAnchorDateChange(e.target.value)}
            />
          </div>
        </div>

        {/* 提示 */}
        <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-800/50">
          {type === 'index' ? t('common.indexTip') : t('common.fundTip')}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] flex justify-end gap-3 shrink-0">
        <button
          onClick={handleClose}
          disabled={isSaving}
          className="px-5 py-2.5 text-sm font-bold text-[var(--app-shell-muted)] hover:bg-[var(--app-shell-line)] rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t('common.save')}
        </button>
      </div>
    </ModalShell>
  );
};
