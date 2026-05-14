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

// Mock the api layer so resolveInstitutions works synchronously in test
const apiMock = vi.hoisted(() => ({
  fetchFundCommonData: vi.fn(),
}));

vi.mock('../../services/api', () => ({
  fetchFundCommonData: apiMock.fetchFundCommonData,
  fetchRecentHistoricalNavs: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../services/streakCalculator', () => ({
  getCachedFundStreaks: vi.fn().mockResolvedValue(new Map()),
}));

const STORAGE_KEY = 'dashboard.institutionGroupEnabled';
const COLLAPSE_STORAGE_KEY = 'dashboard.institutionCollapsedGroups';

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

  it('funds hidden by default and visible after expanding groups', async () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText('永赢基金')).toBeDefined();
    });

    // 默认折叠：基金名称不应出现
    await waitFor(() => {
      expect(screen.queryByText('永赢沪深300ETF联接A')).toBeNull();
    });
    expect(screen.queryByText('华夏成长混合')).toBeNull();

    // 点击永赢基金的分隔条展开
    fireEvent.click(screen.getByText('永赢基金').closest('.institution-group-divider')!);
    await waitFor(() => {
      expect(screen.getByText('永赢沪深300ETF联接A')).toBeDefined();
    });
    expect(screen.getByText('永赢消费主题混合C')).toBeDefined();

    // 华夏基金仍然折叠
    expect(screen.queryByText('华夏成长混合')).toBeNull();

    // 点击华夏基金分隔条展开
    fireEvent.click(screen.getByText('华夏基金').closest('.institution-group-divider')!);
    await waitFor(() => {
      expect(screen.getByText('华夏成长混合')).toBeDefined();
    });
  });

  it('persists collapsed state to localStorage on toggle', async () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText('永赢基金')).toBeDefined();
    });

    // 点击永赢基金分隔条展开
    fireEvent.click(screen.getByText('永赢基金').closest('.institution-group-divider')!);

    // 验证已持久化到 localStorage
    const saved = JSON.parse(localStorage.getItem(COLLAPSE_STORAGE_KEY)!);
    expect(saved).toBeInstanceOf(Array);
    // 永赢基金不在折叠集合中，华夏基金仍在
    expect(saved).not.toContain('永赢基金');
    expect(saved).toContain('华夏基金');
  });

  it('restores collapsed state from localStorage on remount', async () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    // 预先保存：只有华夏基金折叠
    localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(['华夏基金']));

    const { unmount } = render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText('永赢基金')).toBeDefined();
    });

    // 永赢基金展开（可见基金），华夏基金折叠（隐藏基金）
    expect(screen.getByText('永赢沪深300ETF联接A')).toBeDefined();
    expect(screen.getByText('永赢消费主题混合C')).toBeDefined();
    expect(screen.queryByText('华夏成长混合')).toBeNull();

    // 重挂载后状态保持一致
    unmount();
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText('永赢基金')).toBeDefined();
    });

    expect(screen.getByText('永赢沪深300ETF联接A')).toBeDefined();
    expect(screen.queryByText('华夏成长混合')).toBeNull();
  });

  it('collapses all groups by default when no saved state exists', async () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    // 不预先设置 COLLAPSE_STORAGE_KEY
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText('永赢基金')).toBeDefined();
    });

    // 分隔条存在
    const dividers = document.querySelectorAll('.institution-group-divider');
    expect(dividers.length).toBeGreaterThanOrEqual(2);

    // 所有基金名称都不可见
    await waitFor(() => {
      expect(screen.queryByText('永赢沪深300ETF联接A')).toBeNull();
    });
    expect(screen.queryByText('华夏成长混合')).toBeNull();
    expect(screen.queryByText('永赢消费主题混合C')).toBeNull();
  });

  it('collapsed state in active section is independent of cleared section', async () => {
    // 添加一支已清仓的基金
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
        holdingShares: 0,
        costPrice: 1,
        currentNav: 2,
        dayChangePct: 0.1,
        dayChangeVal: 0,
        lastUpdate: '2026-03-31',
      },
    ];

    // 华夏基金属于已清仓区，永赢基金属于活跃区
    apiMock.fetchFundCommonData.mockImplementation((code: string) => {
      const companyNames: Record<string, string> = {
        '000001': '永赢基金管理有限公司',
        '000002': '华夏基金管理有限公司',
      };
      if (companyNames[code]) {
        return Promise.resolve({ data: { companyName: companyNames[code] } });
      }
      return Promise.resolve({ data: {} });
    });

    localStorage.setItem(STORAGE_KEY, 'true');
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText('永赢基金')).toBeDefined();
    });

    // 活跃区的永赢基金默认折叠
    await waitFor(() => {
      expect(screen.queryByText('永赢沪深300ETF联接A')).toBeNull();
    });

    // 点击活跃区分隔条展开
    fireEvent.click(screen.getByText('永赢基金').closest('.institution-group-divider')!);
    await waitFor(() => {
      expect(screen.getByText('永赢沪深300ETF联接A')).toBeDefined();
    });

    // 展开已清仓区
    const clearedDivider = document.querySelector('.cleared-group-divider');
    expect(clearedDivider).not.toBeNull();
    fireEvent.click(clearedDivider!);

    await waitFor(() => {
      expect(screen.getByText('华夏基金')).toBeDefined();
    });

    // 已清仓区的华夏基金默认折叠
    await waitFor(() => {
      expect(screen.queryByText('华夏成长混合')).toBeNull();
    });
  });
});
