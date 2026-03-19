import React, { useCallback, useEffect, useState } from 'react';
import { db, getSettlementDate } from '../services/db';
import { useTranslation } from '../services/i18n';
import { Icons } from './Icon';
import type { Fund, PendingTransaction } from '../types';
import { resetDragState, useEdgeSwipe } from '../services/edgeSwipeState';
import { useOverlayRegistration } from '../services/overlayRegistration';

interface AdjustPositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  fund: Fund;
}

export const AdjustPositionModal: React.FC<AdjustPositionModalProps> = ({
  isOpen,
  onClose,
  fund,
}) => {
  const { t } = useTranslation();
  const overlayId = 'adjust-position-modal';
  const { isDragging, dragX, activeOverlayId, setDragState, snapBackX } = useEdgeSwipe();
  const [closeTargetX, setCloseTargetX] = useState<number | null>(null);
  const translateX = isDragging && activeOverlayId === overlayId ? dragX : 0;
  const snapX = activeOverlayId === overlayId ? snapBackX : null;
  const transformX = closeTargetX ?? snapX ?? translateX;
  const transition = closeTargetX !== null || snapX !== null ? 'transform 220ms ease' : 'none';

  const [type, setType] = useState<'buy' | 'sell'>('buy');
  const [opDate, setOpDate] = useState('');
  const [opTime, setOpTime] = useState<'before15' | 'after15'>('before15');
  const [amount, setAmount] = useState('');
  const [calculatedSettlementDate, setCalculatedSettlementDate] = useState('');

  const noSpinnerClass =
    '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';

  useEffect(() => {
    if (isOpen) {
      setType('buy');
      setOpDate(new Date().toISOString().split('T')[0]);
      setOpTime(new Date().getHours() < 15 ? 'before15' : 'after15');
      setAmount('');
      setCalculatedSettlementDate('');
    }
  }, [isOpen]);

  const handleClose = () => {
    onClose();
  };

  const requestClose = useCallback(
    (payload?: { source?: 'edge-swipe' | 'programmatic'; targetX?: number }) => {
      if (payload?.source === 'edge-swipe' && payload.targetX !== undefined) {
        setCloseTargetX(payload.targetX);
        return;
      }
      handleClose();
    },
    [handleClose],
  );

  useOverlayRegistration(overlayId, isOpen, requestClose);

  useEffect(() => {
    return () => {
      if (activeOverlayId === overlayId) {
        resetDragState(setDragState);
      }
    };
  }, [activeOverlayId, overlayId, setDragState]);

  // 实时计算确认日
  useEffect(() => {
    if (opDate) {
      const tPlusN = fund.settlementDays ?? 1;
      const sd = getSettlementDate(opDate, opTime, tPlusN);
      setCalculatedSettlementDate(sd);
    }
  }, [opDate, opTime, fund.settlementDays]);

  if (!isOpen) return null;

  const handleSave = async () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) {
      alert(type === 'buy' ? '请输入有效的加仓金额' : '请输入有效的减仓份额');
      return;
    }

    if (type === 'sell' && val > fund.holdingShares) {
      alert(`减仓份额不能超过当前持有份额 (${fund.holdingShares.toFixed(2)})`);
      return;
    }

    const newTx: PendingTransaction = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      date: opDate,
      time: opTime,
      amount: val,
      settlementDate: calculatedSettlementDate,
      settled: false,
    };

    const existingPending = fund.pendingTransactions || [];
    await db.funds.update(fund.id!, {
      pendingTransactions: [...existingPending, newTx],
    });

    onClose();
  };

  const pendingCount = (fund.pendingTransactions || []).filter((tx) => !tx.settled).length;

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="bg-white dark:bg-card-dark rounded-xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        style={{ transform: `translateX(${transformX}px)`, transition }}
        onTransitionEnd={() => {
          if (closeTargetX !== null) {
            setCloseTargetX(null);
            resetDragState(setDragState);
            handleClose();
            return;
          }
          if (snapX !== null) {
            resetDragState(setDragState);
          }
        }}
      >
        {/* 标题 */}
        <div className="p-4 border-b border-gray-100 dark:border-border-dark flex justify-between items-center bg-gray-50 dark:bg-white/5 shrink-0">
          <h3 className="font-bold text-gray-800 dark:text-gray-100">
            {t('common.adjustPosition') || '加减仓'}
          </h3>
          <button onClick={handleClose}>
            <Icons.Plus className="transform rotate-45 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          {/* 基金信息 */}
          <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg border border-blue-100 dark:border-blue-800/50">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-bold text-blue-900 dark:text-blue-100 text-sm">
                  {fund.name}
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">{fund.code}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-blue-400">
                  {t('common.shares')} · T+{fund.settlementDays ?? 1}
                </div>
                <div className="font-sans font-bold text-blue-800 dark:text-blue-300">
                  {fund.holdingShares.toFixed(2)}
                </div>
              </div>
            </div>
            {pendingCount > 0 && (
              <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                {pendingCount} {t('common.inTransit') || '笔在途'}
              </div>
            )}
          </div>

          {/* 操作类型 */}
          <div className="flex gap-2">
            <button
              onClick={() => setType('buy')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                type === 'buy'
                  ? 'bg-stock-red text-white shadow-md'
                  : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400'
              }`}
            >
              {t('common.addPosition') || '加仓'}
            </button>
            <button
              onClick={() => setType('sell')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                type === 'sell'
                  ? 'bg-stock-green text-white shadow-md'
                  : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400'
              }`}
            >
              {t('common.reducePosition') || '减仓'}
            </button>
          </div>

          {/* 日期 + 时间 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">
                {t('common.operationDate') || '操作日期'}
              </label>
              <input
                type="date"
                value={opDate}
                onChange={(e) => setOpDate(e.target.value)}
                className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-white/5 focus:outline-none focus:border-blue-500 text-gray-900 dark:text-gray-100 text-sm font-sans"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">
                {t('common.operationTime') || '操作时间'}
              </label>
              <select
                value={opTime}
                onChange={(e) => setOpTime(e.target.value as 'before15' | 'after15')}
                className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-white/5 focus:outline-none focus:border-blue-500 text-gray-900 dark:text-gray-100 text-sm"
              >
                <option value="before15">{t('common.before15') || '15:00前'}</option>
                <option value="after15">{t('common.after15') || '15:00后'}</option>
              </select>
            </div>
          </div>

          {/* 金额/份额 */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">
              {type === 'buy'
                ? t('common.buyAmount') || '加仓金额 (¥)'
                : t('common.sellShares') || '减仓份额'}
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={type === 'buy' ? '0.00' : `最大 ${fund.holdingShares.toFixed(2)}`}
              className={`w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-white/5 text-gray-900 dark:text-white font-bold font-sans focus:border-blue-500 outline-none text-lg ${noSpinnerClass}`}
            />
          </div>

          {/* 确认日展示 */}
          {calculatedSettlementDate && (
            <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800/50">
              <div className="flex justify-between items-center">
                <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                  {t('common.settlementDate') || '份额确认日'}
                </span>
                <span className="font-sans font-bold text-amber-800 dark:text-amber-200 text-sm">
                  {calculatedSettlementDate}
                </span>
              </div>
              <p className="text-[10px] text-amber-500 dark:text-amber-400 mt-1">
                {type === 'buy'
                  ? '届时将以确认日净值计算买入份额，自动更新持仓'
                  : '届时将自动扣减对应份额'}
              </p>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleClose}
              className="flex-1 py-3 text-sm font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-white/10 rounded-xl hover:bg-gray-200 dark:hover:bg-white/15"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSave}
              className={`flex-1 py-3 text-sm font-bold text-white rounded-xl ${
                type === 'buy'
                  ? 'bg-stock-red hover:bg-red-600'
                  : 'bg-stock-green hover:bg-green-600'
              }`}
            >
              {t('common.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
