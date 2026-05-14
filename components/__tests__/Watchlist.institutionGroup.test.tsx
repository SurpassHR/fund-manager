/// <reference types="vitest/globals" />
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Watchlist } from '../Watchlist';
import type { Fund, WatchlistItem } from '../../types';

const mocked = vi.hoisted(() => {
  const state: {
    watchlists: WatchlistItem[];
    funds: Fund[];
  } = {
    watchlists: [],
    funds: [],
  };

  return {
    state,
    refreshWatchlistData: vi.fn().mockResolvedValue(undefined),
    watchlistsDelete: vi.fn(),
    watchlistsUpdate: vi.fn(),
  };
});

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (fn: () => unknown) => fn(),
}));

vi.mock('../../services/db', () => ({
  db: {
    watchlists: {
      toArray: () => mocked.state.watchlists,
      delete: mocked.watchlistsDelete,
      update: mocked.watchlistsUpdate,
    },
    funds: {
      toArray: () => mocked.state.funds,
    },
  },
  refreshWatchlistData: mocked.refreshWatchlistData,
  refreshFundData: vi.fn().mockResolvedValue(undefined),
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

vi.mock('../AddWatchlistModal', () => ({
  AddWatchlistModal: () => null,
}));

vi.mock('../FundDetail', () => ({
  FundDetail: () => null,
}));

vi.mock('../AddHoldingModal', () => ({
  AddHoldingModal: () => null,
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

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

const STORAGE_KEY = 'watchlist.institutionGroupEnabled';
const COLLAPSE_STORAGE_KEY = 'watchlist.institutionCollapsedGroups';

describe('Watchlist institution group', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();

    apiMock.fetchFundCommonData.mockImplementation((code: string) => {
      const companyNames: Record<string, string> = {
        '000001': '博时基金管理有限公司',
        '000002': '南方基金管理股份有限公司',
      };
      if (companyNames[code]) {
        return Promise.resolve({ data: { companyName: companyNames[code] } });
      }
      return Promise.resolve({ data: {} });
    });

    mocked.state.watchlists = [
      {
        id: 1,
        code: '000001',
        name: '博时标普500ETF联接(QDII)A',
        type: 'fund',
        platform: '',
        currentPrice: 1.5,
        dayChangePct: 0.5,
        anchorPrice: 1.2,
        anchorDate: '2026-03-01',
        lastUpdate: '2026-03-31',
      },
      {
        id: 2,
        code: '000002',
        name: '南方中证500ETF联接A',
        type: 'fund',
        platform: '',
        currentPrice: 2.0,
        dayChangePct: -0.3,
        anchorPrice: 1.8,
        anchorDate: '2026-02-01',
        lastUpdate: '2026-03-31',
      },
      {
        id: 3,
        code: '000003',
        name: '沪深300',
        type: 'index',
        platform: '',
        currentPrice: 4000,
        dayChangePct: 0.1,
        anchorPrice: 3800,
        anchorDate: '2026-01-01',
        lastUpdate: '2026-03-31',
      },
    ];

    mocked.state.funds = [];
  });

  it('renders Layers toggle button', () => {
    render(<Watchlist />);
    const buttons = screen.getAllByLabelText('common.groupByInstitution');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('toggles institution group state on click', () => {
    render(<Watchlist />);
    const button = screen.getAllByLabelText('common.groupByInstitution')[0];

    fireEvent.click(button);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');

    fireEvent.click(button);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('false');
  });

  it('reads stored institution group state on mount', () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    render(<Watchlist />);
    const buttons = screen.getAllByLabelText('common.groupByInstitution');
    const desktopButton = buttons[0];
    expect(desktopButton.className).toContain('border-indigo-400');
  });

  it('shows institution group dividers when enabled', async () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    render(<Watchlist />);
    await waitFor(() => {
      const dividers = document.querySelectorAll('.institution-group-divider');
      expect(dividers.length).toBeGreaterThan(0);
    });
  });

  it('shows institution names in dividers for fund type items', async () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    render(<Watchlist />);
    await waitFor(() => {
      expect(screen.getByText('博时基金')).toBeDefined();
    });
    expect(screen.getByText('南方基金')).toBeDefined();
  });

  it('index type items fall into 其他 group', async () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    render(<Watchlist />);
    await waitFor(() => {
      expect(screen.getByText('博时基金')).toBeDefined();
    });
    expect(screen.getByText('其他')).toBeDefined();
  });

  it('does not show dividers when institution group is disabled', () => {
    localStorage.setItem(STORAGE_KEY, 'false');
    render(<Watchlist />);
    const dividers = document.querySelectorAll('.institution-group-divider');
    expect(dividers.length).toBe(0);
  });

  it('watchlist items hidden by default and visible after expanding groups', async () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    render(<Watchlist />);
    await waitFor(() => {
      expect(screen.getByText('博时基金')).toBeDefined();
    });

    // 默认折叠：基金名称不应出现
    await waitFor(() => {
      expect(screen.queryByText('博时标普500ETF联接(QDII)A')).toBeNull();
    });
    expect(screen.queryByText('南方中证500ETF联接A')).toBeNull();
    expect(screen.queryByText('沪深300')).toBeNull();

    // 点击博时基金分隔条展开
    fireEvent.click(screen.getByText('博时基金').closest('.institution-group-divider')!);
    await waitFor(() => {
      expect(screen.getByText('博时标普500ETF联接(QDII)A')).toBeDefined();
    });

    // 南方基金和"其他"仍折叠
    expect(screen.queryByText('南方中证500ETF联接A')).toBeNull();
    expect(screen.queryByText('沪深300')).toBeNull();
  });

  it('persists collapsed state to localStorage on toggle', async () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    render(<Watchlist />);
    await waitFor(() => {
      expect(screen.getByText('博时基金')).toBeDefined();
    });

    fireEvent.click(screen.getByText('博时基金').closest('.institution-group-divider')!);

    const saved = JSON.parse(localStorage.getItem(COLLAPSE_STORAGE_KEY)!);
    expect(saved).toBeInstanceOf(Array);
    expect(saved).not.toContain('博时基金');
    expect(saved).toContain('南方基金');
    expect(saved).toContain('其他');
  });

  it('restores collapsed state from localStorage on remount', async () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(['南方基金', '其他']));

    const { unmount } = render(<Watchlist />);
    await waitFor(() => {
      expect(screen.getByText('博时基金')).toBeDefined();
    });

    // 博时基金展开（可见），南方和"其他"折叠
    expect(screen.getByText('博时标普500ETF联接(QDII)A')).toBeDefined();
    expect(screen.queryByText('南方中证500ETF联接A')).toBeNull();
    expect(screen.queryByText('沪深300')).toBeNull();

    unmount();
    render(<Watchlist />);
    await waitFor(() => {
      expect(screen.getByText('博时基金')).toBeDefined();
    });

    expect(screen.getByText('博时标普500ETF联接(QDII)A')).toBeDefined();
    expect(screen.queryByText('南方中证500ETF联接A')).toBeNull();
    expect(screen.queryByText('沪深300')).toBeNull();
  });

  it('collapses all groups by default when no saved state exists', async () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    render(<Watchlist />);
    await waitFor(() => {
      expect(screen.getByText('博时基金')).toBeDefined();
    });

    const dividers = document.querySelectorAll('.institution-group-divider');
    expect(dividers.length).toBeGreaterThanOrEqual(3);

    await waitFor(() => {
      expect(screen.queryByText('博时标普500ETF联接(QDII)A')).toBeNull();
    });
    expect(screen.queryByText('南方中证500ETF联接A')).toBeNull();
    expect(screen.queryByText('沪深300')).toBeNull();
  });
});
