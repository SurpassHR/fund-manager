/// <reference types="vitest/globals" />
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Fund, PendingTransaction } from '../../types';
import { TransactionHistoryModal } from '../TransactionHistoryModal';

const mockedDeps = vi.hoisted(() => ({
  t: (key: string) => {
    const dict: Record<string, string> = {
      'common.transactionHistory': '交易记录',
      'common.noHistory': '暂无交易记录',
      'common.undo': '撤销',
      'common.delete': '删除',
      'common.cancelConfirm': '确定要撤销这笔在途交易吗？',
      'common.linkedDeleteConfirm': '删除该调仓记录将同时删除关联记录，是否继续？',
      'common.linkedDeleteOverLimit': '关联记录数量异常，已阻止删除，请稍后重试。',
      'common.before15': '15:00 前',
      'common.after15': '15:00 后',
      'common.addPosition': '加仓',
      'common.reducePosition': '减仓',
      'common.transferOutLabel': '调仓转出',
      'common.transferInLabel': '调仓转入',
      'common.linkedTransfer': '关联调仓',
      'common.inTransit': '在途',
      'common.settled': '已确认',
    };
    return dict[key] ?? key;
  },
  deletePendingTransaction: vi.fn(),
}));

vi.mock('../../services/i18n', () => ({
  useTranslation: () => ({ t: mockedDeps.t }),
}));

vi.mock('../../services/db', () => ({
  deletePendingTransaction: mockedDeps.deletePendingTransaction,
}));

vi.mock('../../services/useEdgeSwipe', () => ({
  resetDragState: vi.fn(),
  useEdgeSwipe: () => ({
    isDragging: false,
    activeOverlayId: null,
    setDragState: vi.fn(),
    snapBackX: null,
  }),
}));

vi.mock('../../services/overlayRegistration', () => ({
  useOverlayRegistration: vi.fn(),
}));

const buildTx = (overrides?: Partial<PendingTransaction>): PendingTransaction => ({
  id: 'tx-1',
  type: 'buy',
  date: '2026-03-20',
  time: 'before15',
  amount: 100,
  settlementDate: '2026-03-21',
  settled: false,
  ...overrides,
});

const buildFund = (txs: PendingTransaction[]): Fund => ({
  id: 1,
  code: '000001',
  name: '测试基金',
  platform: '天天基金',
  holdingShares: 100,
  costPrice: 1,
  currentNav: 1,
  lastUpdate: '2026-03-20',
  dayChangePct: 0,
  dayChangeVal: 0,
  pendingTransactions: txs,
});

describe('TransactionHistoryModal delete flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    mockedDeps.deletePendingTransaction.mockResolvedValue({
      deletedCount: 1,
      affectedFundIds: [1],
      linkedDelete: false,
    });
  });

  it('splits action copy by settled status (撤销/删除)', () => {
    const fund = buildFund([
      buildTx({ id: 'u1', settled: false }),
      buildTx({ id: 's1', settled: true, type: 'sell' }),
    ]);

    render(<TransactionHistoryModal isOpen onClose={vi.fn()} fund={fund} />);

    expect(screen.getByRole('button', { name: '撤销' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '删除' })).toBeTruthy();
  });

  it('calls deletePendingTransaction for delete action', async () => {
    const onTransactionsDeleted = vi.fn();
    const fund = buildFund([buildTx({ id: 'tx-delete', settled: true, type: 'sell' })]);

    render(
      <TransactionHistoryModal
        isOpen
        onClose={vi.fn()}
        fund={fund}
        onTransactionsDeleted={onTransactionsDeleted}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '删除' }));

    await waitFor(() => {
      expect(mockedDeps.deletePendingTransaction).toHaveBeenCalledWith({
        fundId: 1,
        txId: 'tx-delete',
        transferId: undefined,
        type: 'sell',
      });
    });
    expect(onTransactionsDeleted).toHaveBeenCalledWith([1]);
  });

  it('uses linked confirmation copy for transfer records', async () => {
    const fund = buildFund([
      buildTx({ id: 'tx-transfer', type: 'transferOut', transferId: 'tr-1', settled: true }),
    ]);

    render(<TransactionHistoryModal isOpen onClose={vi.fn()} fund={fund} />);

    fireEvent.click(screen.getByRole('button', { name: '删除' }));

    expect(globalThis.confirm).toHaveBeenCalledWith('删除该调仓记录将同时删除关联记录，是否继续？');
    await waitFor(() => {
      expect(mockedDeps.deletePendingTransaction).toHaveBeenCalledWith({
        fundId: 1,
        txId: 'tx-transfer',
        transferId: 'tr-1',
        type: 'transferOut',
      });
    });
  });

  it('shows user-visible feedback for LINKED_DELETE_OVER_LIMIT', async () => {
    mockedDeps.deletePendingTransaction.mockResolvedValue({
      code: 'LINKED_DELETE_OVER_LIMIT',
      userMessageKey: 'common.linkedDeleteOverLimit',
      logFields: { transferId: 'tr-over', matchedCount: 3, fundId: 1 },
      deletedCount: 0,
      affectedFundIds: [],
      linkedDelete: true,
    });
    const fund = buildFund([
      buildTx({ id: 'tx-over', type: 'transferOut', transferId: 'tr-over', settled: false }),
    ]);

    render(<TransactionHistoryModal isOpen onClose={vi.fn()} fund={fund} />);

    fireEvent.click(screen.getByRole('button', { name: '撤销' }));

    expect(await screen.findByText('关联记录数量异常，已阻止删除，请稍后重试。')).toBeTruthy();
  });
});
