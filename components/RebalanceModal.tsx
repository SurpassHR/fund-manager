import React, { useEffect, useMemo, useState } from 'react';
import { db, getSettlementDate } from '../services/db';
import { fetchFundCommonData, fetchHistoricalFundNavWithDate, searchFunds } from '../services/api';
import { useTranslation } from '../services/i18n';
import { roundMoney, roundShares, getEffectiveOperationDate } from '../services/rebalanceUtils';
import type { Fund, MorningstarFund, PendingTransaction } from '../types';
import { Icons } from './Icon';

interface RebalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceFund: Fund;
  funds: Fund[];
}

const FEE_OPTIONS = [0.015, 0.005, 0.001, 0];

const getLocalDateString = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatRate = (v: number) => `${(v * 100).toFixed(v === 0 ? 0 : v < 0.01 ? 1 : 1)}%`;

const getUnsettledOutShares = (fund: Fund) => {
  const txs = fund.pendingTransactions || [];
  return txs.reduce((sum, tx) => {
    if (tx.settled) return sum;
    if (tx.type === 'sell') return sum + tx.amount;
    if (tx.type === 'transferOut') return sum + (tx.outShares ?? tx.amount ?? 0);
    return sum;
  }, 0);
};

type TargetCandidate = {
  id?: number;
  code: string;
  name: string;
  settlementDays?: number;
};

export const RebalanceModal: React.FC<RebalanceModalProps> = ({
  isOpen,
  onClose,
  sourceFund,
  funds,
}) => {
  const { t } = useTranslation();
  const [targetQuery, setTargetQuery] = useState('');
  const [targetResults, setTargetResults] = useState<MorningstarFund[]>([]);
  const [targetSearching, setTargetSearching] = useState(false);
  const [targetFund, setTargetFund] = useState<TargetCandidate | null>(null);
  const [opDate, setOpDate] = useState('');
  const [opTime, setOpTime] = useState<'before15' | 'after15'>('before15');
  const [outSharesInput, setOutSharesInput] = useState('');
  const [sellFeeRate, setSellFeeRate] = useState(0.005);
  const [buyFeeRate, setBuyFeeRate] = useState(0);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{
    grossOut: number;
    netOut: number;
    netIn: number;
    inShares: number;
  } | null>(null);

  const localTargetMatches = useMemo(() => {
    const keyword = targetQuery.trim();
    if (!keyword) return [];
    return funds.filter(
      (f) =>
        f.id !== sourceFund.id &&
        (f.code.includes(keyword) || f.name.toLowerCase().includes(keyword.toLowerCase())),
    );
  }, [funds, sourceFund.id, targetQuery]);

  const availableShares = Math.max(0, sourceFund.holdingShares - getUnsettledOutShares(sourceFund));
  const parsedOutShares = parseFloat(outSharesInput);
  const effectiveOpDate = opDate ? getEffectiveOperationDate(opDate, opTime) : '';
  const shouldShowTargetDropdown =
    !targetFund && (targetSearching || localTargetMatches.length > 0 || targetResults.length > 0);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setOutSharesInput('');
    setSellFeeRate(0.005);
    setBuyFeeRate(0);
    setOpDate(getLocalDateString());
    setOpTime(new Date().getHours() < 15 ? 'before15' : 'after15');
    setTargetQuery('');
    setTargetResults([]);
    setTargetSearching(false);
    setTargetFund(null);
  }, [isOpen]);

  useEffect(() => {
    const q = targetQuery.trim();
    if (!q) {
      setTargetResults([]);
      setTargetSearching(false);
      return;
    }

    let cancelled = false;
    setTargetSearching(true);

    const timer = setTimeout(async () => {
      try {
        const res = await searchFunds(q);
        if (cancelled) return;
        setTargetResults(res?.data || []);
      } catch {
        if (cancelled) return;
        setTargetResults([]);
      } finally {
        if (!cancelled) setTargetSearching(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [targetQuery]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (
        !effectiveOpDate ||
        !targetFund ||
        Number.isNaN(parsedOutShares) ||
        parsedOutShares <= 0
      ) {
        setPreview(null);
        return;
      }

      const [outNavRes, inNavRes] = await Promise.all([
        fetchHistoricalFundNavWithDate(sourceFund.code, effectiveOpDate),
        fetchHistoricalFundNavWithDate(targetFund.code, effectiveOpDate),
      ]);

      if (cancelled) return;

      if (
        !outNavRes ||
        !inNavRes ||
        outNavRes.navDate !== effectiveOpDate ||
        inNavRes.navDate !== effectiveOpDate
      ) {
        setPreview(null);
        return;
      }

      const grossOut = roundMoney(parsedOutShares * outNavRes.nav);
      const netOut = roundMoney(grossOut * (1 - sellFeeRate));
      const netIn = roundMoney(netOut * (1 - buyFeeRate));
      const inShares = roundShares(netIn / inNavRes.nav);

      setPreview({ grossOut, netOut, netIn, inShares });
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [buyFeeRate, effectiveOpDate, parsedOutShares, sellFeeRate, sourceFund.code, targetFund]);

  if (!isOpen) return null;

  const handleSave = async () => {
    let selectedTarget = targetFund;
    if (!selectedTarget && targetQuery.trim()) {
      const local = funds.find((f) => f.code === targetQuery.trim());
      if (local) {
        selectedTarget = {
          id: local.id,
          code: local.code,
          name: local.name,
          settlementDays: local.settlementDays,
        };
      }
    }
    if (!selectedTarget) {
      setError(t('common.rebalanceTargetRequired'));
      return;
    }
    if (selectedTarget.code === sourceFund.code) {
      setError(t('common.rebalanceSameFundInvalid'));
      return;
    }
    if (Number.isNaN(parsedOutShares) || parsedOutShares <= 0) {
      setError(t('common.rebalanceSharesInvalid'));
      return;
    }
    if (parsedOutShares > availableShares) {
      setError(t('common.rebalanceInsufficientShares'));
      return;
    }

    const sourceId = sourceFund.id;
    const transferId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    if (!sourceId) return;

    let createdTargetSeed: Omit<Fund, 'id'> | null = null;
    if (!selectedTarget.id) {
      const existingByCode = await db.funds.where('code').equals(selectedTarget.code).first();
      if (existingByCode) {
        selectedTarget = {
          id: existingByCode.id,
          code: existingByCode.code,
          name: existingByCode.name,
          settlementDays: existingByCode.settlementDays,
        };
      } else {
        const commonData = await fetchFundCommonData(selectedTarget.code);
        const nav = commonData?.data?.nav ?? 0;
        const navDate = commonData?.data?.navDate ?? opDate;
        const navChangePercent = commonData?.data?.navChangePercent ?? 0;
        const dayChangeVal = nav > 0 ? roundMoney((nav * navChangePercent) / 100 / (1 + navChangePercent / 100)) : 0;
        createdTargetSeed = {
          code: selectedTarget.code,
          name: selectedTarget.name,
          platform: sourceFund.platform,
          holdingShares: 0,
          costPrice: nav,
          currentNav: nav,
          lastUpdate: navDate,
          dayChangePct: navChangePercent,
          dayChangeVal,
          buyDate: opDate,
          buyTime: opTime,
          settlementDays: sourceFund.settlementDays ?? 1,
        };
      }
    }

    const baseSettlementDate = getSettlementDate(
      opDate,
      opTime,
      Math.max(sourceFund.settlementDays ?? 1, selectedTarget.settlementDays ?? 1),
    );

    await db.transaction('rw', db.funds, async () => {
      const freshSource = await db.funds.get(sourceId);
      let freshTarget = selectedTarget.id ? await db.funds.get(selectedTarget.id) : null;
      if (!freshTarget && createdTargetSeed) {
        const targetId = await db.funds.add(createdTargetSeed);
        freshTarget = await db.funds.get(targetId);
      }
      if (!freshSource || !freshTarget) {
        throw new Error('调仓基金不存在');
      }

      const freshAvailable = Math.max(
        0,
        freshSource.holdingShares - getUnsettledOutShares(freshSource),
      );
      if (parsedOutShares > freshAvailable) {
        throw new Error(t('common.rebalanceInsufficientShares'));
      }

      const sourceTx: PendingTransaction = {
        id: `${transferId}_out`,
        type: 'transferOut',
        date: opDate,
        time: opTime,
        amount: parsedOutShares,
        outShares: parsedOutShares,
        settlementDate: baseSettlementDate,
        settled: false,
        transferId,
        counterpartyFundCode: freshTarget.code,
        sellFeeRate,
        buyFeeRate,
      };

      const targetTx: PendingTransaction = {
        id: `${transferId}_in`,
        type: 'transferIn',
        date: opDate,
        time: opTime,
        amount: 0,
        settlementDate: baseSettlementDate,
        settled: false,
        transferId,
        counterpartyFundCode: freshSource.code,
        sellFeeRate,
        buyFeeRate,
      };

      await db.funds.update(freshSource.id!, {
        pendingTransactions: [...(freshSource.pendingTransactions || []), sourceTx],
      });
      await db.funds.update(freshTarget.id!, {
        pendingTransactions: [...(freshTarget.pendingTransactions || []), targetTx],
      });
    });

    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-card-dark rounded-xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-100 dark:border-border-dark flex justify-between items-center bg-gray-50 dark:bg-white/5">
          <h3 className="font-bold text-gray-800 dark:text-gray-100">
            {t('common.rebalanceTitle')}
          </h3>
          <button onClick={onClose}>
            <Icons.Plus className="transform rotate-45 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">
                {t('common.transferOutFund')}
              </label>
              <div className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-white/5 text-sm text-gray-700 dark:text-gray-200">
                {sourceFund.name}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">
                {t('common.transferInFund')}
              </label>
              <div className="space-y-2">
                <div className="relative">
                  <input
                    value={targetQuery}
                    onChange={(e) => {
                      setTargetQuery(e.target.value);
                      setTargetFund(null);
                      setError('');
                    }}
                    placeholder={t('common.searchFund')}
                    className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-white/5 text-sm"
                  />

                  {shouldShowTargetDropdown && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-30 max-h-40 overflow-auto border border-gray-100 dark:border-border-dark rounded-lg bg-white dark:bg-card-dark shadow-xl">
                      {targetSearching && (
                        <div className="px-2 py-1.5 text-xs text-gray-400">{t('common.searching')}</div>
                      )}

                      {localTargetMatches.map((f) => (
                        <button
                          type="button"
                          key={`local-${f.id}`}
                          onClick={() =>
                            {
                              setTargetFund({
                                id: f.id,
                                code: f.code,
                                name: f.name,
                                settlementDays: f.settlementDays,
                              });
                              setTargetQuery(`${f.name} (${f.code})`);
                              setTargetResults([]);
                            }
                          }
                          className="w-full text-left px-2 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-white/10"
                        >
                          {f.name} ({f.code})
                        </button>
                      ))}

                      {targetResults.slice(0, 8).map((f) => (
                        <button
                          type="button"
                          key={f.symbol}
                          onClick={() =>
                            {
                              const name = f.fundNameArr || f.fundName;
                              setTargetFund({
                                code: f.symbol,
                                name,
                              });
                              setTargetQuery(`${name} (${f.symbol})`);
                              setTargetResults([]);
                            }
                          }
                          className="w-full text-left px-2 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-white/10"
                        >
                          {f.fundNameArr || f.fundName} ({f.symbol})
                        </button>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">
                {t('common.operationDate')}
              </label>
              <input
                type="date"
                value={opDate}
                onChange={(e) => setOpDate(e.target.value)}
                className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-white/5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">
                {t('common.operationTime')}
              </label>
              <select
                value={opTime}
                onChange={(e) => setOpTime(e.target.value as 'before15' | 'after15')}
                className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-white/5 text-sm"
              >
                <option value="before15">{t('common.before15')}</option>
                <option value="after15">{t('common.after15')}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">
              {t('common.transferOutShares')}
            </label>
            <input
              type="number"
              value={outSharesInput}
              onChange={(e) => {
                setOutSharesInput(e.target.value);
                setError('');
              }}
              placeholder={`0.00（可用 ${availableShares.toFixed(2)}）`}
              className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-white/5 text-gray-900 dark:text-white font-bold font-sans"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">
                {t('common.sellFeeRate')}
              </label>
              <select
                value={sellFeeRate}
                onChange={(e) => setSellFeeRate(parseFloat(e.target.value))}
                className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-white/5 text-sm"
              >
                {FEE_OPTIONS.map((rate) => (
                  <option key={`sell-${rate}`} value={rate}>
                    {formatRate(rate)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">
                {t('common.buyFeeRate')}
              </label>
              <select
                value={buyFeeRate}
                onChange={(e) => setBuyFeeRate(parseFloat(e.target.value))}
                className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-white/5 text-sm"
              >
                {FEE_OPTIONS.map((rate) => (
                  <option key={`buy-${rate}`} value={rate}>
                    {formatRate(rate)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800/50">
            <div className="text-xs font-bold text-amber-700 dark:text-amber-200 mb-2">
              {t('common.estimatedTransfer')} · {effectiveOpDate || '--'}
            </div>
            {preview ? (
              <div className="grid grid-cols-2 gap-2 text-xs text-amber-700 dark:text-amber-200">
                <div>
                  {t('common.estimatedOutGross')}: ¥{preview.grossOut.toFixed(2)}
                </div>
                <div>
                  {t('common.estimatedOutNet')}: ¥{preview.netOut.toFixed(2)}
                </div>
                <div>
                  {t('common.estimatedInNet')}: ¥{preview.netIn.toFixed(2)}
                </div>
                <div>
                  {t('common.estimatedInShares')}: {preview.inShares.toFixed(4)}
                </div>
              </div>
            ) : (
              <div className="text-xs text-amber-600 dark:text-amber-300">
                {t('common.navNotReadyTip')}
              </div>
            )}
          </div>

          {error && <div className="text-sm text-red-500">{error}</div>}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 text-sm font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-white/10 rounded-xl"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-3 text-sm font-bold text-white rounded-xl bg-blue-600 hover:bg-blue-700"
            >
              {t('common.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
