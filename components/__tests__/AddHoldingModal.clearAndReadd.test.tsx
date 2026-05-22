/// <reference types="vitest/globals" />
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddHoldingModal } from '../AddHoldingModal';
import type { Fund } from '../../types';

const mocked = vi.hoisted(() => {
  const fundsAdd = vi.fn();
  const fundsUpdate = vi.fn();
  const accounts = [{ id: 1, name: 'Default', isDefault: true }];

  return {
    accounts,
    fundsAdd,
    fundsUpdate,
  };
});

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (fn: () => unknown) => fn(),
}));

vi.mock('../../services/db', () => ({
  db: {
    accounts: {
      toArray: () => mocked.accounts,
    },
    funds: {
      add: mocked.fundsAdd,
      update: mocked.fundsUpdate,
    },
  },
}));

vi.mock('../../services/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../services/api', () => ({
  searchFunds: vi.fn(),
  fetchFundCommonData: vi.fn(),
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

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({
      initial: _i,
      animate: _a,
      exit: _e,
      transition: _t,
      ...rest
    }: Record<string, unknown>) => <div {...rest} />,
  },
}));

vi.mock('../hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => false,
}));

vi.mock('../Icon', () => ({
  Icons: {
    Plus: () => <span>plus</span>,
    Search: () => <span>search</span>,
    ChevronDown: () => <span>chevron-down</span>,
    Check: () => <span>check</span>,
  },
}));

vi.mock('../../services/assetAllocation', () => ({
  deductAvailableForBuy: vi.fn(),
}));

const setSharesValue = (value: string) => {
  const sharesLabel = screen.getByText('common.shares');
  const sharesInput = sharesLabel.parentElement?.querySelector('input');
  if (!sharesInput) {
    throw new Error('未找到份额输入框');
  }
  fireEvent.change(sharesInput, { target: { value } });
};

/** 已清仓基金的样本数据：holdingShares=0，带有上个持有周期残留的 realizedGain */
const clearedFund: Fund = {
  id: 5,
  code: '320007',
  name: '诺安成长混合',
  platform: 'Default',
  holdingShares: 0,
  costPrice: 1.2,
  currentNav: 1.5,
  lastUpdate: '2026-05-20',
  dayChangePct: 0.3,
  dayChangeVal: 0.03,
  buyDate: '2026-01-15',
  buyTime: 'before15',
  settlementDays: 1,
  realizedGain: 500,
  realizedGainCost: 1200,
  pendingTransactions: [],
  positionOpenAmount: 1200,
  positionOpenDate: '2026-01-15',
};

/** 正常持有的基金样本数据（非清仓状态） */
const activeFund: Fund = {
  id: 8,
  code: '000001',
  name: '测试基金',
  platform: 'Default',
  holdingShares: 100,
  costPrice: 1.3,
  currentNav: 1.5,
  lastUpdate: '2026-05-20',
  dayChangePct: 0.3,
  dayChangeVal: 0.03,
  buyDate: '2026-03-10',
  buyTime: 'before15',
  settlementDays: 1,
  realizedGain: 200,
  realizedGainCost: 500,
  pendingTransactions: [],
};

describe('AddHoldingModal 清仓后重新添加', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.fundsUpdate.mockResolvedValue(1);
  });

  it('重新添加已清仓基金时，应清除 realizedGain / realizedGainCost / pendingTransactions', async () => {
    render(<AddHoldingModal isOpen onClose={vi.fn()} editFund={clearedFund} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'common.confirm' })).toBeTruthy();
    });

    setSharesValue('1000');

    fireEvent.click(screen.getByRole('button', { name: 'common.confirm' }));

    await waitFor(() => {
      expect(mocked.fundsUpdate).toHaveBeenCalledTimes(1);
    });

    const updateArg = mocked.fundsUpdate.mock.calls[0][1];
    // 应清除历史已实现盈亏
    expect(updateArg.realizedGain).toBeNull();
    expect(updateArg.realizedGainCost).toBeNull();
    // 应清除在途交易
    expect(updateArg.pendingTransactions).toBeNull();
    // 应重置建仓信息
    expect(updateArg.positionOpenAmount).toBeTypeOf('number');
    expect(updateArg.positionOpenDate).toBeTypeOf('string');
  });

  it('重新添加已清仓基金时，市值应基于当前净值计算且收益为零', async () => {
    mocked.fundsUpdate.mockResolvedValue(1);

    render(
      <AddHoldingModal
        isOpen
        onClose={vi.fn()}
        editFund={{
          ...clearedFund,
          currentNav: 1.6,
          realizedGain: 800,
          realizedGainCost: 2000,
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'common.confirm' })).toBeTruthy();
    });

    setSharesValue('500');

    fireEvent.click(screen.getByRole('button', { name: 'common.confirm' }));

    await waitFor(() => {
      expect(mocked.fundsUpdate).toHaveBeenCalledTimes(1);
    });

    const updateArg = mocked.fundsUpdate.mock.calls[0][1];

    // currentNav 应被写入更新
    expect(updateArg.currentNav).toBe(1.6);
    // 已实现盈亏应被清除
    expect(updateArg.realizedGain).toBeNull();
    expect(updateArg.realizedGainCost).toBeNull();
  });

  it('编辑未清仓的活跃基金时，应保留 realizedGain', async () => {
    render(<AddHoldingModal isOpen onClose={vi.fn()} editFund={activeFund} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'common.confirm' })).toBeTruthy();
    });

    setSharesValue('50');

    fireEvent.click(screen.getByRole('button', { name: 'common.confirm' }));

    await waitFor(() => {
      expect(mocked.fundsUpdate).toHaveBeenCalledTimes(1);
    });

    const updateArg = mocked.fundsUpdate.mock.calls[0][1];
    // 活跃基金（非清仓）的 update 中不应携带 realizedGain 键
    expect(updateArg).not.toHaveProperty('realizedGain');
    expect(updateArg).not.toHaveProperty('realizedGainCost');
  });

  it('编辑已清仓基金时 currentNav 应随更新持久化', async () => {
    render(<AddHoldingModal isOpen onClose={vi.fn()} editFund={clearedFund} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'common.confirm' })).toBeTruthy();
    });

    setSharesValue('200');

    fireEvent.click(screen.getByRole('button', { name: 'common.confirm' }));

    await waitFor(() => {
      expect(mocked.fundsUpdate).toHaveBeenCalledTimes(1);
    });

    const updateArg = mocked.fundsUpdate.mock.calls[0][1];
    expect(updateArg.currentNav).toBe(clearedFund.currentNav);
  });
});
