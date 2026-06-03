/// <reference types="vitest/globals" />
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InvestmentPlanModal } from '../InvestmentPlanModal';
import type { Fund, InvestmentPlan } from '../../types';

const mocked = vi.hoisted(() => {
  const funds: Fund[] = [
    {
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
    },
  ];
  const plans: InvestmentPlan[] = [
    {
      id: 1,
      fundCode: '000001',
      amount: 100,
      frequency: 'weekly',
      frequencyDay: 1,
      active: true,
    },
  ];

  return { funds, plans };
});

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (fn: () => unknown) => fn(),
}));

vi.mock('../../services/db', () => ({
  db: {
    funds: {
      toArray: () => mocked.funds,
    },
  },
}));

vi.mock('../../services/investmentPlan', () => ({
  addInvestmentPlan: vi.fn(),
  updateInvestmentPlan: vi.fn(),
  deleteInvestmentPlan: vi.fn(),
  getAllInvestmentPlans: () => mocked.plans,
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
  },
}));

describe('InvestmentPlanModal theme', () => {
  it('现有定投计划卡片应使用当前主题背景', () => {
    render(<InvestmentPlanModal isOpen onClose={vi.fn()} />);

    const planCard = screen.getByText('测试基金').closest('.rounded-xl');
    expect(planCard?.className).toContain('bg-[var(--app-shell-panel-strong)]');
    expect(planCard?.className).not.toContain('bg-gray-50');
    expect(planCard?.className).not.toContain('dark:bg-white/5');
  });
});
