import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RebalanceModal } from '../RebalanceModal';
import type { Fund } from '../../types';
import { searchFunds } from '../../services/api';
import { db } from '../../services/db';

vi.mock('../../services/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../services/api', () => ({
  fetchFundCommonData: vi.fn(),
  fetchHistoricalFundNavWithDate: vi.fn(),
  searchFunds: vi.fn(),
}));

vi.mock('../../services/db', () => ({
  db: {
    funds: {
      where: vi.fn(() => ({ equals: vi.fn(() => ({ first: vi.fn() })) })),
      add: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
    },
    watchlists: {
      toArray: vi.fn(),
    },
    transaction: vi.fn(),
  },
  getSettlementDate: vi.fn(() => '2026-04-21'),
}));

const mockSearchFunds = vi.mocked(searchFunds);

const sourceFund: Fund = {
  id: 1,
  code: '000001',
  name: '测试基金',
  platform: '默认账户',
  holdingShares: 100,
  costPrice: 1,
  currentNav: 1,
  lastUpdate: '2026-04-20',
  dayChangePct: 0,
  dayChangeVal: 0,
  settlementDays: 1,
};

const targetHoldingFund: Fund = {
  id: 2,
  code: '000002',
  name: '持仓成长基金',
  platform: '默认账户',
  holdingShares: 50,
  costPrice: 1,
  currentNav: 1,
  lastUpdate: '2026-04-20',
  dayChangePct: 0,
  dayChangeVal: 0,
  settlementDays: 1,
};

describe('RebalanceModal', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    vi.mocked(db.watchlists.toArray).mockResolvedValue([]);
  });

  it('locks page scroll while the modal is open', () => {
    const { rerender, unmount } = render(
      <RebalanceModal
        isOpen={false}
        onClose={vi.fn()}
        sourceFund={sourceFund}
        funds={[sourceFund]}
      />,
    );

    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.style.overflow).toBe('');

    rerender(
      <RebalanceModal isOpen onClose={vi.fn()} sourceFund={sourceFund} funds={[sourceFund]} />,
    );

    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');

    unmount();

    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('调仓表单的中性信息区域应使用当前主题背景', () => {
    render(
      <RebalanceModal isOpen onClose={vi.fn()} sourceFund={sourceFund} funds={[sourceFund]} />,
    );

    const sourceSummary = screen.getByText('测试基金').closest('.rounded-lg');
    expect(sourceSummary?.className).toContain('bg-[var(--app-shell-panel-strong)]');
    expect(sourceSummary?.className).not.toContain('bg-gray-50');

    const transferOutSharesInput = screen
      .getByText('common.transferOutShares')
      .parentElement?.querySelector('input');
    expect(transferOutSharesInput?.className).toContain('bg-[var(--app-shell-panel-strong)]');
    expect(transferOutSharesInput?.className).not.toContain('bg-white');
    expect(transferOutSharesInput?.className).not.toContain('dark:bg-white/5');
  });

  it('转入基金输入框聚焦且未输入时优先显示持仓和自选候选', async () => {
    vi.mocked(db.watchlists.toArray).mockResolvedValue([
      {
        id: 11,
        code: '110011',
        name: '自选蓝筹基金',
        type: 'fund',
        anchorPrice: 1,
        anchorDate: '2026-04-20',
        currentPrice: 1,
        dayChangePct: 0,
        lastUpdate: '2026-04-20',
      },
    ]);

    render(
      <RebalanceModal
        isOpen
        onClose={vi.fn()}
        sourceFund={sourceFund}
        funds={[sourceFund, targetHoldingFund]}
      />,
    );

    await waitFor(() => expect(db.watchlists.toArray).toHaveBeenCalled());
    fireEvent.focus(screen.getByPlaceholderText('common.searchFund'));

    const panel = await screen.findByTestId('rebalance-target-dropdown');
    expect(panel.className).toContain('backdrop-blur');
    expect(panel.className).toContain('dark:bg-card-dark/95');
    expect(panel.className).toContain('overflow-hidden');

    const holdingOption = screen.getByText('持仓成长基金 (000002)');
    expect(holdingOption.className).toContain('px-4');
    expect(holdingOption.className).toContain('py-3');
    expect(holdingOption.className).toContain('cursor-pointer');
    expect(holdingOption.className).toContain('transition-colors');
    expect(holdingOption.className).toContain('border-b');

    expect(screen.getByText('持仓成长基金 (000002)')).toBeInTheDocument();
    expect(screen.getByText('自选蓝筹基金 (110011)')).toBeInTheDocument();
    expect(mockSearchFunds).not.toHaveBeenCalled();
  });

  it('转入基金输入后先显示匹配的持仓和自选，再显示 API 结果', async () => {
    vi.mocked(db.watchlists.toArray).mockResolvedValue([
      {
        id: 11,
        code: '110011',
        name: '自选成长基金',
        type: 'fund',
        anchorPrice: 1,
        anchorDate: '2026-04-20',
        currentPrice: 1,
        dayChangePct: 0,
        lastUpdate: '2026-04-20',
      },
    ]);
    mockSearchFunds.mockResolvedValue({
      _meta: { response_status: 'OK', response_hint: '' },
      data: [
        {
          fundClassId: 'api-1',
          fundName: 'API成长基金',
          fundNameArr: 'API成长基金',
          symbol: '220022',
          fundType: '混合型',
        },
      ],
    });

    render(
      <RebalanceModal
        isOpen
        onClose={vi.fn()}
        sourceFund={sourceFund}
        funds={[sourceFund, targetHoldingFund]}
      />,
    );

    const input = screen.getByPlaceholderText('common.searchFund');
    fireEvent.change(input, { target: { value: '成长' } });

    await waitFor(() => expect(screen.getByText('API成长基金 (220022)')).toBeInTheDocument());

    const optionTexts = screen
      .getAllByTestId('rebalance-target-option')
      .map((option) => option.textContent);
    expect(optionTexts).toEqual([
      '持仓成长基金 (000002)',
      '自选成长基金 (110011)',
      'API成长基金 (220022)',
    ]);
  });
});
