import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Fund, PendingTransaction } from '../types';
import { useTranslation } from '../services/i18n';
import { Icons } from './Icon';
import { deletePendingTransaction } from '../services/db';
import { ModalShell } from './ModalShell';

interface TransactionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  fund: Fund | null;
  onTransactionsDeleted?: (affectedFundIds: number[]) => void;
}

export const TransactionHistoryModal: React.FC<TransactionHistoryModalProps> = ({
  isOpen,
  onClose,
  fund: fundProp,
  onTransactionsDeleted,
}) => {
  const [cachedFund, setCachedFund] = useState<Fund | null>(fundProp);
  useEffect(() => {
    if (fundProp) setCachedFund(fundProp);
  }, [fundProp]);
  const fund = fundProp || cachedFund;
  const { t } = useTranslation();
  const [transactions, setTransactions] = useState<PendingTransaction[]>(
    fund?.pendingTransactions || [],
  );
  const [deleteFeedback, setDeleteFeedback] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    setTransactions(fund?.pendingTransactions || []);
    setDeleteFeedback(null);
  }, [fund?.id, fund?.pendingTransactions]);

  // 按操作日期正序排列
  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return (a.time === 'after15' ? 1 : 0) - (b.time === 'after15' ? 1 : 0);
    });
  }, [transactions]);

  // 计算建仓交易集合：份额归零后的第一笔买入/转入即为建仓
  const positionOpenTxIds = useMemo(() => {
    if (!fund) return new Set<string>();
    const openIds = new Set<string>();
    let runningShares = 0;

    for (const tx of sortedTransactions) {
      const isBuyOrTransferIn = tx.type === 'buy' || tx.type === 'transferIn';
      if (isBuyOrTransferIn && runningShares <= 0.01) {
        openIds.add(tx.id);
      }

      if (tx.type === 'buy') {
        runningShares += tx.amount / (fund.costPrice || 1);
      } else if (tx.type === 'sell') {
        runningShares -= tx.amount;
      } else if (tx.type === 'transferOut') {
        runningShares -= tx.outShares ?? tx.amount;
      } else if (tx.type === 'transferIn') {
        runningShares += tx.inShares ?? (tx.netInAmount ?? tx.amount) / (fund.costPrice || 1);
      }
    }
    return openIds;
  }, [fund, sortedTransactions]);

  // 定位清仓交易：当持仓已清零时，找到将份额清至 0 的那笔卖出/转出
  const liquidationTxId = (() => {
    if (!fund || fund.holdingShares > 0.01) return null;
    const sellTxs = (fund.pendingTransactions || [])
      .filter((tx) => tx.type === 'sell' || tx.type === 'transferOut')
      .sort((a, b) => {
        const dateCmp = a.date.localeCompare(b.date);
        if (dateCmp !== 0) return dateCmp;
        return (a.time === 'after15' ? 1 : 0) - (b.time === 'after15' ? 1 : 0);
      });
    const totalOut = sellTxs.reduce(
      (sum, tx) => sum + (tx.type === 'transferOut' ? (tx.outShares ?? tx.amount) : tx.amount),
      0,
    );
    let running = totalOut;
    for (const tx of sellTxs) {
      const outAmount = tx.type === 'transferOut' ? (tx.outShares ?? tx.amount) : tx.amount;
      running -= outAmount;
      if (running <= 0.01) return tx.id;
    }
    return null;
  })();

  const getTypeLabel = (type: PendingTransaction['type'], txId: string) => {
    if (txId === liquidationTxId) return t('common.tradeLiquidationLabel') || '清仓';
    if (positionOpenTxIds.has(txId)) return t('common.openPosition') || '建仓';
    if (type === 'buy') return t('common.addPosition');
    if (type === 'sell') return t('common.reducePosition');
    if (type === 'transferOut') return t('common.transferOutLabel');
    return t('common.transferInLabel');
  };

  const getTxColors = (tx: PendingTransaction) => {
    if (tx.id === liquidationTxId) {
      return {
        badge: 'bg-amber-50 text-amber-500 dark:bg-amber-900/30',
        label: 'text-amber-500',
      };
    }
    if (positionOpenTxIds.has(tx.id)) {
      return {
        badge: 'bg-blue-50 text-blue-500 dark:bg-blue-900/30',
        label: 'text-blue-500',
      };
    }
    if (tx.type === 'buy' || tx.type === 'transferIn') {
      return {
        badge: 'bg-red-50 text-red-500 dark:bg-red-900/30',
        label: 'text-red-500',
      };
    }
    return {
      badge: 'bg-green-50 text-green-500 dark:bg-green-900/30',
      label: 'text-green-500',
    };
  };

  const getAmountText = (tx: PendingTransaction) => {
    if (tx.type === 'buy') return `${tx.amount.toFixed(2)} 元`;
    if (tx.type === 'sell') return `${tx.amount.toFixed(2)} 份`;
    if (tx.type === 'transferOut') return `${(tx.outShares ?? tx.amount ?? 0).toFixed(2)} 份`;
    if (tx.inShares != null) return `${tx.inShares.toFixed(2)} 份`;
    if (tx.netInAmount != null) return `${tx.netInAmount.toFixed(2)} 元`;
    return '--';
  };

  const isTransferType = (type: PendingTransaction['type']) => {
    return type === 'transferOut' || type === 'transferIn';
  };

  const handleDelete = async (tx: PendingTransaction) => {
    if (!fund?.id) {
      return;
    }

    const confirmMessage =
      tx.transferId && isTransferType(tx.type)
        ? t('common.linkedDeleteConfirm') || '删除该调仓记录将同时删除关联记录，是否继续？'
        : tx.settled
          ? t('common.deleteConfirm') || '确定要删除这条已确认交易记录吗？'
          : t('common.cancelConfirm') || '确定要撤销这笔在途交易吗？';

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setDeleteFeedback(null);

    try {
      const result = await deletePendingTransaction({
        fundId: fund.id,
        txId: tx.id,
        transferId: tx.transferId,
        type: tx.type,
      });

      if ('code' in result && result.code === 'LINKED_DELETE_OVER_LIMIT') {
        setDeleteFeedback(t(result.userMessageKey) || '关联记录数量异常，已阻止删除，请稍后重试。');
        return;
      }

      if (result.deletedCount <= 0) {
        return;
      }

      const isCurrentFundAffected = result.affectedFundIds.includes(fund.id);
      if (isCurrentFundAffected) {
        setTransactions((prev) => {
          if (tx.transferId && isTransferType(tx.type)) {
            return prev.filter(
              (item) => !(item.transferId === tx.transferId && isTransferType(item.type)),
            );
          }
          return prev.filter((item) => item.id !== tx.id);
        });
      }

      if (result.affectedFundIds.length > 0) {
        onTransactionsDeleted?.(result.affectedFundIds);
      }
    } catch (e) {
      console.error('Failed to delete transaction', e);
      setDeleteFeedback(t('common.deleteFailed') || '删除失败，请稍后重试');
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={handleClose}
      overlayId="transaction-history-modal"
      edgeSwipe
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
          {fund?.name}
        </div>
      </div>

      {/* 列表内容区 */}
      <div className="p-4 overflow-y-auto flex-grow bg-gray-50/50 dark:bg-transparent">
        {deleteFeedback && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
            {deleteFeedback}
          </div>
        )}
        {sortedTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Icons.Grid size={40} className="mb-3 opacity-20" />
            <p className="text-sm">{t('common.noHistory') || '暂无交易记录'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedTransactions.map((tx) => {
              const colors = getTxColors(tx);
              const isOut = tx.type === 'sell' || tx.type === 'transferOut';
              return (
                <div
                  key={tx.id}
                  className="bg-white dark:bg-white/5 border border-gray-100 dark:border-border-dark rounded-xl p-4 shadow-sm flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${colors.badge}`}
                    >
                      <Icons.TrendingUp
                        size={20}
                        className={isOut ? 'rotate-180 scale-x-[-1]' : ''}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-sm font-bold ${colors.label}`}>
                          {getTypeLabel(tx.type, tx.id)}
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

                  <button
                    onClick={() => handleDelete(tx)}
                    className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-100 hover:bg-red-50 hover:text-red-500 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-red-900/30 dark:hover:text-red-400 rounded-lg transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-900/50"
                  >
                    {tx.settled ? t('common.delete') || '删除' : t('common.undo') || '撤销'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ModalShell>
  );
};
