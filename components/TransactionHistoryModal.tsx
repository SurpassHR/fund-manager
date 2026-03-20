import React, { useCallback, useEffect, useState } from 'react';
import type { Fund, PendingTransaction } from '../types';
import { useTranslation } from '../services/i18n';
import { Icons } from './Icon';
import { db } from '../services/db';
import { resetDragState, useEdgeSwipe } from '../services/useEdgeSwipe';
import { useOverlayRegistration } from '../services/overlayRegistration';

interface TransactionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  fund: Fund;
}

export const TransactionHistoryModal: React.FC<TransactionHistoryModalProps> = ({
  isOpen,
  onClose,
  fund,
}) => {
  const { t } = useTranslation();
  const overlayId = 'transaction-history-modal';
  const { isDragging, activeOverlayId, setDragState, snapBackX } = useEdgeSwipe();
  const [closeTargetX, setCloseTargetX] = useState<number | null>(null);
  const translateX =
    isDragging && activeOverlayId === overlayId ? 'var(--edge-swipe-drag-x, 0px)' : '0px';
  const snapX = activeOverlayId === overlayId ? snapBackX : null;
  const transformX =
    closeTargetX !== null ? `${closeTargetX}px` : snapX !== null ? `${snapX}px` : translateX;
  const transition = closeTargetX !== null || snapX !== null ? 'transform 220ms ease' : 'none';

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

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

  if (!isOpen) return null;

  // 按操作日期倒序排列
  const transactions = [...(fund.pendingTransactions || [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const getTypeLabel = (type: PendingTransaction['type']) => {
    if (type === 'buy') return t('common.addPosition');
    if (type === 'sell') return t('common.reducePosition');
    if (type === 'transferOut') return t('common.transferOutLabel');
    return t('common.transferInLabel');
  };

  const getAmountText = (tx: PendingTransaction) => {
    if (tx.type === 'buy') return `${tx.amount.toFixed(2)} 元`;
    if (tx.type === 'sell') return `${tx.amount.toFixed(2)} 份`;
    if (tx.type === 'transferOut') return `${(tx.outShares ?? tx.amount ?? 0).toFixed(2)} 份`;
    if (tx.inShares != null) return `${tx.inShares.toFixed(2)} 份`;
    if (tx.netInAmount != null) return `${tx.netInAmount.toFixed(2)} 元`;
    return '--';
  };

  const handleCancel = async (txId: string) => {
    if (!window.confirm(t('common.cancelConfirm') || '确定要撤销这笔在途交易吗？')) {
      return;
    }

    const newPending = (fund.pendingTransactions || []).filter((tx) => tx.id !== txId);

    try {
      await db.funds.update(fund.id!, {
        pendingTransactions: newPending,
      });
      // 不关闭弹窗，因为可能还要操作别的记录
    } catch (e) {
      console.error('Failed to cancel transaction', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm sm:p-4 opacity-100 transition-opacity">
      <div
        className="bg-white dark:bg-card-dark w-full sm:w-[480px] sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-transform translate-y-0 relative"
        style={{ transform: `translateX(${transformX})`, transition }}
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
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-border-dark shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className="p-1.5 -ml-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-gray-500"
            >
              <Icons.ArrowUp size={20} className="-rotate-90" />
            </button>
            <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">
              {t('common.transactionHistory') || '交易记录'}
            </h2>
          </div>
          <div className="text-xs text-gray-400 bg-gray-50 dark:bg-white/5 px-2 py-1 rounded font-medium">
            {fund.name}
          </div>
        </div>

        {/* 列表内容区 */}
        <div className="p-4 overflow-y-auto flex-grow bg-gray-50/50 dark:bg-transparent">
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Icons.Grid size={40} className="mb-3 opacity-20" />
              <p className="text-sm">{t('common.noHistory') || '暂无交易记录'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="bg-white dark:bg-white/5 border border-gray-100 dark:border-border-dark rounded-xl p-4 shadow-sm flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        tx.type === 'buy' || tx.type === 'transferIn'
                          ? 'bg-red-50 text-red-500 dark:bg-red-900/30'
                          : 'bg-green-50 text-green-500 dark:bg-green-900/30'
                      }`}
                    >
                      <Icons.TrendingUp
                        size={20}
                        className={
                          tx.type === 'sell' || tx.type === 'transferOut'
                            ? 'rotate-180 scale-x-[-1]'
                            : ''
                        }
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-sm font-bold ${tx.type === 'buy' || tx.type === 'transferIn' ? 'text-red-500' : 'text-green-500'}`}
                        >
                          {getTypeLabel(tx.type)}
                        </span>
                        <span className="text-sm font-mono font-bold text-gray-800 dark:text-gray-100">
                          {getAmountText(tx)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 flex items-center gap-2">
                        <span>
                          {tx.date} {t(`common.${tx.time}`)}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                        {tx.transferId && (
                          <>
                            <span>{t('common.linkedTransfer')}</span>
                            <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                          </>
                        )}
                        {tx.settled ? (
                          <span className="text-gray-400">{t('common.settled')}</span>
                        ) : (
                          <span className="text-amber-500">{t('common.inTransit')}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {!tx.settled && (
                    <button
                      onClick={() => handleCancel(tx.id)}
                      className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-100 hover:bg-red-50 hover:text-red-500 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-red-900/30 dark:hover:text-red-400 rounded-lg transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-900/50"
                    >
                      {t('common.undo') || '撤销'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
