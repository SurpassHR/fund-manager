/// <reference types="vitest/globals" />
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from './Dashboard';
import type { Account, Fund } from '../types';

const mocked = vi.hoisted(() => {
  const state: {
    funds: Fund[];
    accounts: Account[];
  } = {
    funds: [],
    accounts: [],
  };

  return {
    state,
    initDB: vi.fn(),
    refreshFundData: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (fn: () => unknown) => fn(),
}));

vi.mock('../services/db', () => ({
  db: {
    funds: {
      toArray: () => mocked.state.funds,
    },
    accounts: {
      toArray: () => mocked.state.accounts,
    },
  },
  initDB: mocked.initDB,
  refreshFundData: mocked.refreshFundData,
  calculateSummary: () => ({
    totalAssets: 1000,
    totalDayGain: 10,
    totalDayGainPct: 1,
    holdingGain: 100,
    holdingGainPct: 10,
  }),
}));

vi.mock('../services/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../services/SettingsContext', () => ({
  useSettings: () => ({
    autoRefresh: false,
  }),
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./AccountManagerModal', () => ({
  AccountManagerModal: () => null,
}));

vi.mock('./AddFundModal', () => ({
  AddFundModal: () => null,
}));

vi.mock('./AdjustPositionModal', () => ({
  AdjustPositionModal: () => null,
}));

vi.mock('./RebalanceModal', () => ({
  RebalanceModal: () => null,
}));

vi.mock('./TransactionHistoryModal', () => ({
  TransactionHistoryModal: () => null,
}));

vi.mock('./FundDetail', () => ({
  FundDetail: () => null,
}));

vi.mock('./AiHoldingsAnalysisModal', () => ({
  AiHoldingsAnalysisModal: () => null,
}));

describe('Dashboard mobile long press menu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();

    mocked.state.funds = [
      {
        id: 1,
        code: '000001',
        name: '测试基金A',
        platform: '默认账户',
        holdingShares: 100,
        costPrice: 1,
        currentNav: 1.1,
        dayChangePct: 0.2,
        dayChangeVal: 1,
        lastUpdate: '2026-03-31',
      },
    ];

    mocked.state.accounts = [
      {
        id: 1,
        name: '默认账户',
        isDefault: true,
      },
    ];
  });

  it('触摸滚动位移超过阈值时，长按不应弹出菜单', () => {
    vi.useFakeTimers();
    render(<Dashboard />);

    const target = screen.getAllByText('测试基金A')[0];
    fireEvent.touchStart(target, {
      touches: [{ clientX: 120, clientY: 120 }],
    });
    fireEvent.touchMove(target, {
      touches: [{ clientX: 120, clientY: 145 }],
    });

    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(screen.queryByText('common.menu')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('无滚动位移时，长按仍可弹出菜单', () => {
    vi.useFakeTimers();
    render(<Dashboard />);

    const target = screen.getAllByText('测试基金A')[0];
    fireEvent.touchStart(target, {
      touches: [{ clientX: 120, clientY: 120 }],
    });

    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(screen.getByText('common.menu')).toBeInTheDocument();
    vi.useRealTimers();
  });
});
