/// <reference types="vitest/globals" />
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AddWatchlistModal } from '../AddWatchlistModal';

vi.mock('../../services/db', () => ({
  db: {
    watchlists: {
      add: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../../services/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../services/api', () => ({
  fetchHistoricalFundNav: vi.fn(),
  fetchHistoricalIndexPrice: vi.fn(),
}));

vi.mock('../FundSearchInput', () => ({
  FundSearchInput: () => <div>fund-search</div>,
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

vi.mock('../Icon', () => ({
  Icons: {
    Plus: () => <span>plus</span>,
    Settings: () => <span>settings</span>,
  },
}));

describe('AddWatchlistModal theme', () => {
  it('类型切换按钮应使用当前主题背景而不是纯白底色', () => {
    render(<AddWatchlistModal isOpen onClose={vi.fn()} />);

    const fundTypeButton = screen.getByRole('button', { name: 'common.fund' });
    expect(fundTypeButton.className).toContain('bg-[var(--app-shell-panel-strong)]');
    expect(fundTypeButton.className).not.toContain('bg-white');
    expect(fundTypeButton.className).not.toContain('dark:bg-card-dark');
  });
});
