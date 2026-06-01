/// <reference types="vitest/globals" />
import React from 'react';
import { act, render, screen } from '@testing-library/react';
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
    totalAssets: 391008.09,
    totalDayGain: 0,
    totalDayGainPct: 0,
    holdingGain: 0,
    holdingGainPct: 0,
    cumulativeGain: 0,
    cumulativeGainPct: 0,
  }),
  saveTotalAssetsSnapshot: vi.fn(),
}));

vi.mock('../../services/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../services/SettingsContext', () => ({
  useSettings: () => ({
    autoRefresh: false,
    investmentProfile: {},
  }),
}));

vi.mock('../../services/api', () => ({
  fetchFundHoldings: vi.fn().mockResolvedValue(null),
  fetchRecentHistoricalNavs: vi.fn().mockResolvedValue([]),
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) => (
      <div {...props}>{children as React.ReactNode}</div>
    ),
  },
}));

vi.mock('../AccountManagerModal', () => ({
  AccountManagerModal: () => null,
}));

vi.mock('../AddHoldingModal', () => ({
  AddHoldingModal: () => null,
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

vi.mock('../InvestmentPlanModal', () => ({
  InvestmentPlanModal: () => null,
}));

describe('Dashboard asset allocation sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();

    localStorage.setItem('assetAllocation.configured', 'true');
    localStorage.setItem('assetAllocation.availableAssets', '50000');

    mocked.state.funds = [
      {
        id: 1,
        code: '000001',
        name: '测试基金',
        platform: '默认账户',
        holdingShares: 100,
        costPrice: 1,
        currentNav: 1,
        dayChangePct: 0,
        dayChangeVal: 0,
        lastUpdate: '2026-06-01',
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

  it('外部更新可用资产后应同步刷新比例展示', () => {
    render(<Dashboard />);

    expect(screen.getByText('50,000.00')).toBeInTheDocument();
    expect(screen.getByText('88.7%')).toBeInTheDocument();
    expect(screen.getByText('11.3%')).toBeInTheDocument();

    act(() => {
      localStorage.setItem('assetAllocation.availableAssets', '62309.08');
      window.dispatchEvent(new CustomEvent('asset-allocation:updated'));
    });

    expect(screen.getByText('62,309.08')).toBeInTheDocument();
    expect(screen.getByText('86.3%')).toBeInTheDocument();
    expect(screen.getByText('13.7%')).toBeInTheDocument();
  });
});
