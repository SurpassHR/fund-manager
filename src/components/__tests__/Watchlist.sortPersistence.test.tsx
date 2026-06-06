/// <reference types="vitest/globals" />
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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

vi.mock('../AddWatchlistModal', () => ({
  AddWatchlistModal: () => null,
}));

vi.mock('../FundDetail', () => ({
  FundDetail: () => null,
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../AddHoldingModal', () => ({
  AddHoldingModal: () => null,
}));

const getWatchlistOrder = () =>
  screen.getAllByRole('heading', { level: 3 }).map((el) => el.textContent);

describe('Watchlist sort persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    mocked.state.watchlists = [
      {
        id: 1,
        code: '000001',
        name: '自选A',
        type: 'fund',
        anchorPrice: 1,
        anchorDate: '2026-03-20',
        currentPrice: 1.1,
        dayChangePct: 0.1,
        lastUpdate: '2026-03-20',
      },
      {
        id: 2,
        code: '000002',
        name: '自选B',
        type: 'fund',
        anchorPrice: 1,
        anchorDate: '2026-03-20',
        currentPrice: 1.4,
        dayChangePct: 0.4,
        lastUpdate: '2026-03-20',
      },
    ];
    mocked.state.funds = [];
  });

  it('persists selected sort across remount and resets by watchlist header', () => {
    const { unmount } = render(<Watchlist />);
    expect(getWatchlistOrder()).toEqual(['自选A', '自选B']);

    fireEvent.click(screen.getAllByRole('button', { name: '锚点收益' })[0]);
    expect(getWatchlistOrder()).toEqual(['自选B', '自选A']);
    expect(localStorage.getItem('watchlist.sortState.v1')).toContain('anchorGain');

    unmount();
    render(<Watchlist />);
    expect(getWatchlistOrder()).toEqual(['自选B', '自选A']);

    fireEvent.click(screen.getAllByRole('button', { name: '自选列表' })[0]);
    expect(getWatchlistOrder()).toEqual(['自选A', '自选B']);
    expect(localStorage.getItem('watchlist.sortState.v1')).toBeNull();
  });

  it('falls back to default sort when cached payload is invalid', () => {
    localStorage.setItem(
      'watchlist.sortState.v1',
      JSON.stringify({ key: 'invalid', direction: 'asc' }),
    );

    render(<Watchlist />);
    expect(getWatchlistOrder()).toEqual(['自选A', '自选B']);
    expect(localStorage.getItem('watchlist.sortState.v1')).toBeNull();
  });

  it('sorts by name and persists across remount', () => {
    mocked.state.watchlists = [
      {
        id: 1,
        code: '000003',
        name: '自选C',
        type: 'fund',
        anchorPrice: 1,
        anchorDate: '2026-03-20',
        currentPrice: 1.1,
        dayChangePct: 0.1,
        lastUpdate: '2026-03-20',
      },
      {
        id: 2,
        code: '000001',
        name: '自选A',
        type: 'fund',
        anchorPrice: 1,
        anchorDate: '2026-03-20',
        currentPrice: 1.2,
        dayChangePct: 0.2,
        lastUpdate: '2026-03-20',
      },
      {
        id: 3,
        code: '000002',
        name: '自选B',
        type: 'fund',
        anchorPrice: 1,
        anchorDate: '2026-03-20',
        currentPrice: 1.4,
        dayChangePct: 0.4,
        lastUpdate: '2026-03-20',
      },
    ];

    localStorage.setItem(
      'watchlist.sortState.v1',
      JSON.stringify({ key: 'name', direction: 'asc' }),
    );

    const { unmount } = render(<Watchlist />);
    expect(getWatchlistOrder()).toEqual(['自选A', '自选B', '自选C']);

    unmount();
    render(<Watchlist />);
    expect(getWatchlistOrder()).toEqual(['自选A', '自选B', '自选C']);
    expect(localStorage.getItem('watchlist.sortState.v1')).toContain('name');
  });
});
