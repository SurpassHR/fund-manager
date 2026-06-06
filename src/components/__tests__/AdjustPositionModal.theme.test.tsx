/// <reference types="vitest/globals" />
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdjustPositionModal } from '../AdjustPositionModal';
import type { Fund } from '../../types';

vi.mock('../../services/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../services/db', () => ({
  db: {
    funds: {
      update: vi.fn(),
    },
  },
  getSettlementDate: vi.fn(() => '2026-04-21'),
}));

vi.mock('../../services/assetAllocation', () => ({
  deductAvailableForBuy: vi.fn(),
  addAvailableForSell: vi.fn(),
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
    ChevronDown: () => <span>chevron-down</span>,
  },
}));

const fund: Fund = {
  id: 1,
  code: '000001',
  name: '测试基金',
  platform: '默认账户',
  holdingShares: 100,
  costPrice: 1,
  currentNav: 1.2,
  lastUpdate: '2026-04-20',
  dayChangePct: 0,
  dayChangeVal: 0,
  settlementDays: 1,
};

describe('AdjustPositionModal theme', () => {
  it('基金摘要和操作输入应使用主题背景而不是固定浅蓝或纯白底色', () => {
    render(<AdjustPositionModal isOpen onClose={vi.fn()} fund={fund} />);

    const fundInfoCard = screen.getByText('测试基金').closest('.rounded-lg');
    expect(fundInfoCard?.className).toContain('bg-[var(--app-shell-panel-strong)]');
    expect(fundInfoCard?.className).not.toContain('bg-blue-50');

    const amountInput = screen.getByPlaceholderText('0.00');
    expect(amountInput.className).toContain('bg-[var(--app-shell-panel-strong)]');
    expect(amountInput.className).not.toContain('bg-white');
    expect(amountInput.className).not.toContain('dark:bg-white/5');
  });
});
