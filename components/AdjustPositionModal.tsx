import React, { useCallback, useEffect, useState } from 'react';
import { db, getSettlementDate } from '../services/db';
import { useTranslation } from '../services/i18n';
import { Icons } from './Icon';
import type { Fund, PendingTransaction } from '../types';
import { resetDragState, useEdgeSwipe } from '../services/useEdgeSwipe';
import { useOverlayRegistration } from '../services/overlayRegistration';
import { parseSellInputToShares } from './adjustPositionUtils';

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
  const { isDragging, activeOverlayId, setDragState, snapBackX } = useEdgeSwipe();
  const [closeTargetX, setCloseTargetX] = useState<number | null>(null);
  const translateX =
    isDragging && activeOverlayId === overlayId ? 'var(--edge-swipe-drag-x, 0px)' : '0px';
  const snapX = activeOverlayId === overlayId ? snapBackX : null;
  const transformX =
    closeTargetX !== null ? `${closeTargetX}px` : snapX !== null ? `${snapX}px` : translateX;
  const transition = closeTargetX !== null || snapX !== null ? 'transform 220ms ease' : 'none';

  const [type, setType] = useState<'buy' | 'sell'>('buy');
  const [opDate, setOpDate] = useState('');
  const [opTime, setOpTime] = useState<'before15' | 'after15'>('before15');
  const [amount, setAmount] = useState('');
  const [inputError, setInputError] = useState('');
  const [calculatedSettlementDate, setCalculatedSettlementDate] = useState('');

  const noSpinnerClass =
    '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';

  useEffect(() => {
    if (isOpen) {
      setType('buy');
      setOpDate(new Date().toISOString().split('T')[0]);
      setOpTime(new Date().getHours() < 15 ? 'before15' : 'after15');
      setAmount('');
      setInputError('');
      setCalculatedSettlementDate('');
    }
  }, [isOpen]);

  useEffect(() => {
    setAmount('');
    setInputError('');
  }, [type]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const requestClose = useCallback(
    (payload?: { source?: 'edge-swipe' | 'programmatic'; targetX?: number }) => {
      if (payload?.targetX !== undefined) {
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

  const parsedSell = type === 'sell' ? parseSellInputToShares(amount, fund.holdingShares) : null;

  const handleSave = async () => {
    let val = parseFloat(amount);
    if (type === 'sell') {
      if (!parsedSell || parsedSell.shares == null || parsedSell.error) {
        setInputError('请输入正确的减仓格式（如 50、50%、1/3）');
        return;
      }
      val = parsedSell.shares;
    }

    if (isNaN(val) || val <= 0) {
      alert(type === 'buy' ? '请输入有效的加仓金额' : '请输入有效的减仓份额');
      return;
    }

    if (type === 'sell' && val > fund.holdingShares) {
      alert(`减仓份额不能超过当前持有份额 (${fund.holdingShares.toFixed(2)})`);
      return;
    }

    setInputError('');

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
    <div
      className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => requestClose({ source: 'programmatic', targetX: window.innerWidth })}
    >
      <div
        className="bg-white dark:bg-card-dark rounded-xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        style={{ transform: `translateX(${transformX})`, transition }}
        onClick={(e) => e.stopPropagation()}
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
              type={type === 'buy' ? 'number' : 'text'}
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setInputError('');
              }}
              placeholder={
                type === 'buy' ? '0.00' : `如 50、50%、1/3（最大 ${fund.holdingShares.toFixed(2)}）`
              }
              className={`w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-white/5 text-gray-900 dark:text-white font-bold font-sans focus:border-blue-500 outline-none text-lg ${noSpinnerClass}`}
            />

            {type === 'sell' && (
              <>
                <div className="mt-2 flex items-center gap-2">
                  {[
                    { label: '1/4', value: '1/4' },
                    { label: '1/3', value: '1/3' },
                    { label: '1/2', value: '1/2' },
                    { label: '全部', value: '1/1' },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        setAmount(item.value);
                        setInputError('');
                      }}
                      className="px-2.5 py-1.5 text-xs font-bold rounded-md bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/15"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="mt-2 text-xs">
                  {inputError ? (
                    <span className="text-red-500">{inputError}</span>
                  ) : parsedSell?.shares != null ? (
                    <span className="text-gray-500 dark:text-gray-400">
                      将减仓 {parsedSell.shares.toFixed(2)} 份
                    </span>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500">
                      输入格式支持：份额、百分比（如 50%）、分数（如 1/3）
                    </span>
                  )}
                </div>
              </>
            )}
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
