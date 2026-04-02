/// <reference types="vitest/globals" />
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from '../Dashboard';
import type { Account, Fund } from '../../types';

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

vi.mock('../../services/db', () => ({
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

vi.mock('../../services/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../services/SettingsContext', () => ({
  useSettings: () => ({
    autoRefresh: false,
  }),
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../AccountManagerModal', () => ({
  AccountManagerModal: () => null,
}));

vi.mock('../AddFundModal', () => ({
  AddFundModal: () => null,
}));

vi.mock('../AdjustPositionModal', () => ({
  AdjustPositionModal: () => null,
}));

vi.mock('../RebalanceModal', () => ({
  RebalanceModal: () => null,
}));

vi.mock('../TransactionHistoryModal', () => ({
  TransactionHistoryModal: () => null,
}));

vi.mock('../FundDetail', () => ({
  FundDetail: () => null,
}));

vi.mock('../AiHoldingsAnalysisModal', () => ({
  AiHoldingsAnalysisModal: () => null,
}));

const getFundOrder = () => screen.getAllByRole('heading', { level: 3 }).map((el) => el.textContent);

describe('Dashboard sort persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();

    mocked.state.funds = [
      {
        id: 1,
        code: '000001',
        name: '基金A',
        platform: '默认账户',
        holdingShares: 100,
        costPrice: 1,
        currentNav: 1,
        dayChangePct: 0.1,
        dayChangeVal: 10,
        lastUpdate: '2026-03-31',
      },
      {
        id: 2,
        code: '000002',
        name: '基金B',
        platform: '默认账户',
        holdingShares: 100,
        costPrice: 1,
        currentNav: 2,
        dayChangePct: 0.1,
        dayChangeVal: 20,
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

  it('persists selected sort across remount and resets by holdings header', () => {
    const { unmount } = render(<Dashboard />);
    expect(getFundOrder()).toEqual(['基金A', '基金B']);

    fireEvent.click(screen.getAllByRole('button', { name: 'common.mktVal' })[0]);
    expect(getFundOrder()).toEqual(['基金B', '基金A']);
    expect(localStorage.getItem('dashboard.sortState.v1')).toContain('marketValue');

    unmount();
    render(<Dashboard />);
    expect(getFundOrder()).toEqual(['基金B', '基金A']);

    fireEvent.click(screen.getAllByRole('button', { name: '持仓列表' })[0]);
    expect(getFundOrder()).toEqual(['基金A', '基金B']);
    expect(localStorage.getItem('dashboard.sortState.v1')).toBeNull();
  });

  it('falls back to default sort when cached payload is invalid', () => {
    localStorage.setItem(
      'dashboard.sortState.v1',
      JSON.stringify({ key: 'invalid', direction: 'asc' }),
    );

    render(<Dashboard />);
    expect(getFundOrder()).toEqual(['基金A', '基金B']);
    expect(localStorage.getItem('dashboard.sortState.v1')).toBeNull();
  });

  it('uses market minus cost for total gain sort without double-counting stale estimated pct', () => {
    mocked.state.funds = [
      {
        id: 1,
        code: '000001',
        name: '基金A',
        platform: '默认账户',
        holdingShares: 100,
        costPrice: 1,
        currentNav: 1.1,
        dayChangePct: 0.1,
        dayChangeVal: 1,
        lastUpdate: '2026-03-31',
        todayChangeIsEstimated: false,
        todayChangeUnavailable: false,
        estimatedDayChangePct: 50,
      },
      {
        id: 2,
        code: '000002',
        name: '基金B',
        platform: '默认账户',
        holdingShares: 100,
        costPrice: 1,
        currentNav: 1.3,
        dayChangePct: 0.2,
        dayChangeVal: 2,
        lastUpdate: '2026-03-31',
        todayChangeIsEstimated: false,
        todayChangeUnavailable: false,
        estimatedDayChangePct: 0,
      },
    ];

    render(<Dashboard />);

    fireEvent.click(screen.getAllByRole('button', { name: 'common.totalGain' })[0]);

    expect(getFundOrder()).toEqual(['基金B', '基金A']);
  });
});
