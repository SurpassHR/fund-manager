import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { RebalanceModal } from '../RebalanceModal';
import type { Fund } from '../../types';

vi.mock('../../services/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../services/api', () => ({
  fetchFundCommonData: vi.fn(),
  fetchHistoricalFundNavWithDate: vi.fn(),
  searchFunds: vi.fn(),
}));

vi.mock('../../services/db', () => ({
  db: {
    funds: {
      where: vi.fn(() => ({ equals: vi.fn(() => ({ first: vi.fn() })) })),
      add: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
    },
    transaction: vi.fn(),
  },
  getSettlementDate: vi.fn(() => '2026-04-21'),
}));

const sourceFund: Fund = {
  id: 1,
  code: '000001',
  name: '测试基金',
  platform: '默认账户',
  holdingShares: 100,
  costPrice: 1,
  currentNav: 1,
  lastUpdate: '2026-04-20',
  dayChangePct: 0,
  dayChangeVal: 0,
  settlementDays: 1,
};

describe('RebalanceModal', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  });

  it('locks page scroll while the modal is open', () => {
    const { rerender, unmount } = render(
      <RebalanceModal isOpen={false} onClose={vi.fn()} sourceFund={sourceFund} funds={[sourceFund]} />,
    );

    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.style.overflow).toBe('');

    rerender(
      <RebalanceModal isOpen onClose={vi.fn()} sourceFund={sourceFund} funds={[sourceFund]} />,
    );

    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');

    unmount();

    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.style.overflow).toBe('');
  });
});
