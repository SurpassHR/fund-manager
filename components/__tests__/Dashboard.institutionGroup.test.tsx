/// <reference types="vitest/globals" />
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    calculateSummary: vi.fn(() => ({
      totalAssets: 1000,
      totalDayGain: 10,
      totalDayGainPct: 1,
      holdingGain: 100,
      holdingGainPct: 10,
    })),
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
  calculateSummary: () => mocked.calculateSummary(),
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
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) => (
      <div {...props}>{children as React.ReactNode}</div>
    ),
  },
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

// Mock the api layer so resolveInstitutions works synchronously in test
const apiMock = vi.hoisted(() => ({
  fetchFundCommonData: vi.fn(),
}));

vi.mock('../../services/api', () => ({
  fetchFundCommonData: apiMock.fetchFundCommonData,
}));

const STORAGE_KEY = 'dashboard.institutionGroupEnabled';

describe('Dashboard institution group', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();

    apiMock.fetchFundCommonData.mockImplementation((code: string) => {
      const companyNames: Record<string, string> = {
        '000001': '永赢基金管理有限公司',
        '000002': '华夏基金管理有限公司',
        '000003': '永赢基金管理有限公司',
      };
      if (companyNames[code]) {
        return Promise.resolve({ data: { companyName: companyNames[code] } });
      }
      return Promise.resolve({ data: {} });
    });

    mocked.state.funds = [
      {
        id: 1,
        code: '000001',
        name: '永赢沪深300ETF联接A',
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
        name: '华夏成长混合',
        platform: '默认账户',
        holdingShares: 100,
        costPrice: 1,
        currentNav: 2,
        dayChangePct: 0.1,
        dayChangeVal: 20,
        lastUpdate: '2026-03-31',
      },
      {
        id: 3,
        code: '000003',
        name: '永赢消费主题混合C',
        platform: '默认账户',
        holdingShares: 100,
        costPrice: 1,
        currentNav: 3,
        dayChangePct: 0.1,
        dayChangeVal: 30,
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

  it('renders Layers toggle button', () => {
    render(<Dashboard />);
    const buttons = screen.getAllByLabelText('common.groupByInstitution');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('toggles institution group state on click', () => {
    render(<Dashboard />);
    const button = screen.getAllByLabelText('common.groupByInstitution')[0];

    fireEvent.click(button);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');

    fireEvent.click(button);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('false');
  });

  it('reads stored institution group state on mount', () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    render(<Dashboard />);
    const buttons = screen.getAllByLabelText('common.groupByInstitution');
    const desktopButton = buttons[0];
    expect(desktopButton.className).toContain('border-indigo-400');
  });

  it('shows institution group dividers when enabled', async () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    render(<Dashboard />);
    await waitFor(() => {
      const dividers = document.querySelectorAll('.institution-group-divider');
      expect(dividers.length).toBeGreaterThan(0);
    });
  });

  it('shows institution names in dividers', async () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText('永赢基金')).toBeDefined();
    });
    expect(screen.getByText('华夏基金')).toBeDefined();
  });

  it('does not show dividers when institution group is disabled', () => {
    localStorage.setItem(STORAGE_KEY, 'false');
    render(<Dashboard />);
    const dividers = document.querySelectorAll('.institution-group-divider');
    expect(dividers.length).toBe(0);
  });

  it('funds are still rendered when grouped', async () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText('永赢基金')).toBeDefined();
    });
    expect(screen.getByText('永赢沪深300ETF联接A')).toBeDefined();
    expect(screen.getByText('华夏成长混合')).toBeDefined();
    expect(screen.getByText('永赢消费主题混合C')).toBeDefined();
  });
});
