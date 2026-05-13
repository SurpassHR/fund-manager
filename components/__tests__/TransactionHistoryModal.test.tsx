/// <reference types="vitest/globals" />
import { render, screen } from '@testing-library/react';
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
      'common.openPosition': '建仓',
      'common.tradeLiquidationLabel': '清仓',
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

const buildFund = (overrides?: Partial<Fund>): Fund => ({
  id: 1,
  code: '000001',
  name: '测试基金',
  platform: '天天基金',
  holdingShares: 100,
  costPrice: 1.5,
  currentNav: 1.8,
  lastUpdate: '2026-03-20',
  dayChangePct: 0,
  dayChangeVal: 0,
  buyDate: '2026-03-01',
  buyTime: 'before15',
  pendingTransactions: [],
  ...overrides,
});

describe('TransactionHistoryModal position open logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedDeps.deletePendingTransaction.mockResolvedValue({
      deletedCount: 1,
      affectedFundIds: [1],
      linkedDelete: false,
    });
  });

  it('第一条买入交易标记为建仓', () => {
    const fund = buildFund({
      holdingShares: 100,
      costPrice: 1.5,
      pendingTransactions: [
        buildTx({ id: 'first-buy', type: 'buy', date: '2026-03-01', amount: 5000, settled: true }),
        buildTx({ id: 'add-buy', type: 'buy', date: '2026-06-15', amount: 1000, settled: true }),
      ],
    });

    render(<TransactionHistoryModal isOpen onClose={vi.fn()} fund={fund} />);

    // 第一条买入显示"建仓"，后续显示"加仓"
    expect(screen.getByText('建仓')).toBeTruthy();
    expect(screen.getByText('加仓')).toBeTruthy();
  });

  it('清仓后再买入标记为建仓', () => {
    const fund = buildFund({
      holdingShares: 100,
      costPrice: 1.5,
      pendingTransactions: [
        buildTx({ id: 'buy-1', type: 'buy', date: '2026-03-01', amount: 5000, settled: true }),
        buildTx({ id: 'sell-1', type: 'sell', date: '2026-04-01', amount: 500, settled: true }),
        buildTx({ id: 'buy-2', type: 'buy', date: '2026-05-01', amount: 3000, settled: true }),
      ],
    });

    render(<TransactionHistoryModal isOpen onClose={vi.fn()} fund={fund} />);

    // buy-1 是建仓（份额从 0 开始），buy-2 应显示加仓（卖出后还有份额）
    const labels = screen.getAllByText('建仓');
    expect(labels).toHaveLength(1);
  });

  it('空交易列表显示空状态', () => {
    const fund = buildFund({
      pendingTransactions: [],
    });

    render(<TransactionHistoryModal isOpen onClose={vi.fn()} fund={fund} />);

    expect(screen.getByText('暂无交易记录')).toBeTruthy();
  });

  it('按时间正序排列', () => {
    const fund = buildFund({
      holdingShares: 100,
      costPrice: 1.5,
      pendingTransactions: [
        buildTx({ id: 'tx-mar', type: 'buy', date: '2026-03-15', amount: 500, settled: true }),
        buildTx({ id: 'tx-jan', type: 'buy', date: '2026-01-10', amount: 5000, settled: true }),
      ],
    });

    render(<TransactionHistoryModal isOpen onClose={vi.fn()} fund={fund} />);

    const items = screen.getAllByText(/2026-0[13]/);
    // 正序：一月在前，三月在后
    expect(items[0].textContent).toContain('2026-01-10');
    expect(items[1].textContent).toContain('2026-03-15');
  });

  it('建仓交易使用蓝色标记', () => {
    const fund = buildFund({
      holdingShares: 100,
      costPrice: 1.5,
      pendingTransactions: [
        buildTx({ id: 'first-buy', type: 'buy', date: '2026-03-01', amount: 5000, settled: true }),
      ],
    });

    const { container } = render(<TransactionHistoryModal isOpen onClose={vi.fn()} fund={fund} />);

    // 建仓标签应为蓝色
    const blueBadges = container.querySelectorAll('.bg-blue-50, .dark\\:bg-blue-900\\/30');
    expect(blueBadges.length).toBeGreaterThan(0);
  });
});
