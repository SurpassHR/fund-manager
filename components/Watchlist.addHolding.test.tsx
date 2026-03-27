/// <reference types="vitest/globals" />
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Watchlist } from './Watchlist';
import type { Fund, WatchlistItem } from '../types';

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
    refreshWatchlistData: vi.fn(),
    watchlistsDelete: vi.fn(),
    watchlistsUpdate: vi.fn(),
  };
});

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (fn: () => unknown) => fn(),
}));

vi.mock('../services/db', () => ({
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
}));

vi.mock('../services/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('./AddWatchlistModal', () => ({
  AddWatchlistModal: () => null,
}));

vi.mock('./FundDetail', () => ({
  FundDetail: () => null,
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./AddFundModal', () => ({
  AddFundModal: (props: {
    isOpen: boolean;
    onClose: () => void;
    prefillWatchlistItem?: WatchlistItem;
  }) =>
    props.isOpen ? (
      <div data-testid="add-fund-modal">
        <div>
          prefill:{props.prefillWatchlistItem?.code}|{props.prefillWatchlistItem?.name}|
          {props.prefillWatchlistItem?.currentPrice}
        </div>
        <button onClick={props.onClose}>save-holding</button>
      </div>
    ) : null,
}));

describe('Watchlist add holding from context menu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.state.watchlists = [
      {
        id: 1,
        code: '000001',
        name: '未持有基金',
        type: 'fund',
        anchorPrice: 1.2,
        anchorDate: '2026-03-20',
        currentPrice: 1.2345,
        dayChangePct: 0.5,
        lastUpdate: '2026-03-20',
      },
      {
        id: 2,
        code: '000002',
        name: '已持有基金',
        type: 'fund',
        anchorPrice: 2,
        anchorDate: '2026-03-20',
        currentPrice: 2.1,
        dayChangePct: 0.2,
        lastUpdate: '2026-03-20',
      },
      {
        id: 3,
        code: 'sh000001',
        name: '上证指数',
        type: 'index',
        anchorPrice: 3000,
        anchorDate: '2026-03-20',
        currentPrice: 3010,
        dayChangePct: 0.3,
        lastUpdate: '2026-03-20',
      },
    ];
    mocked.state.funds = [
      {
        id: 11,
        code: '000001',
        name: '未持有基金',
        platform: 'Default',
        holdingShares: 0,
        costPrice: 1,
        currentNav: 1.2345,
        lastUpdate: '2026-03-20',
        dayChangePct: 0,
        dayChangeVal: 0,
      },
      {
        id: 12,
        code: '000002',
        name: '已持有基金',
        platform: 'Default',
        holdingShares: 10,
        costPrice: 2,
        currentNav: 2.1,
        lastUpdate: '2026-03-20',
        dayChangePct: 0,
        dayChangeVal: 0,
      },
    ];
  });

  it('仅在未持有的 fund 条目展示添加持仓入口', () => {
    render(<Watchlist />);

    fireEvent.contextMenu(screen.getAllByText('未持有基金')[0]);
    expect(
      screen.getByRole('button', { name: 'common.addHoldingFromWatchlist' }),
    ).toBeInTheDocument();

    fireEvent.contextMenu(screen.getAllByText('已持有基金')[0]);
    expect(
      screen.queryByRole('button', { name: 'common.addHoldingFromWatchlist' }),
    ).not.toBeInTheDocument();

    fireEvent.contextMenu(screen.getAllByText('上证指数')[0]);
    expect(
      screen.queryByRole('button', { name: 'common.addHoldingFromWatchlist' }),
    ).not.toBeInTheDocument();
  });

  it('点击后打开 AddFundModal 并预填 watchlist 信息', () => {
    render(<Watchlist />);

    fireEvent.contextMenu(screen.getAllByText('未持有基金')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'common.addHoldingFromWatchlist' }));

    expect(screen.getByTestId('add-fund-modal')).toBeInTheDocument();
    expect(screen.getByText('prefill:000001|未持有基金|1.2345')).toBeInTheDocument();
  });

  it('保存后不删除自选项（watchlists.delete/update 不应被调用）', () => {
    render(<Watchlist />);

    fireEvent.contextMenu(screen.getAllByText('未持有基金')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'common.addHoldingFromWatchlist' }));
    fireEvent.click(screen.getByRole('button', { name: 'save-holding' }));

    expect(mocked.watchlistsDelete).not.toHaveBeenCalled();
    expect(mocked.watchlistsUpdate).not.toHaveBeenCalled();
  });

  it('为列表页内容保留 fixed 头部顶部安全间距', () => {
    const { container } = render(<Watchlist />);

    const pageRoot = container.querySelector('div.mx-auto.w-full.max-w-7xl');
    expect(pageRoot?.className).toContain('pt-20');
    expect(pageRoot?.className).toContain('md:pt-24');
  });

  it('基金标签在桌面布局不换行且不截断', () => {
    const { container } = render(<Watchlist />);

    const desktopFundBadges = Array.from(container.querySelectorAll('span')).filter((el) => {
      const classes = el.className;
      return (
        el.textContent === '基金' &&
        typeof classes === 'string' &&
        classes.includes('tracking-[0.14em]')
      );
    });

    expect(desktopFundBadges.length).toBeGreaterThan(0);
    desktopFundBadges.forEach((badge) => {
      expect(badge).toHaveClass('whitespace-nowrap');
      expect(badge).toHaveClass('shrink-0');
      expect(badge.className).not.toContain('truncate');
    });
  });
});
