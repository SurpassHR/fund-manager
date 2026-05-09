/// <reference types="vitest/globals" />
import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FundDetail } from '../FundDetail';
import { closeTopOverlay, resetOverlayStack } from '../../services/overlayStack';
import type { Fund } from '../../types';

const mockedApi = vi.hoisted(() => ({
  fetchFundCommonData: vi.fn(),
  fetchFundHoldings: vi.fn(),
  fetchParentETFInfo: vi.fn(),
  fetchFundPerformance: vi.fn(),
  fetchEastMoneyPingzhongData: vi.fn(),
  fetchTencentStockQuotes: vi.fn(),
  fetchTencentIntradayData: vi.fn(),
  buildTencentQuoteCodes: vi.fn(() => []),
}));

vi.mock('../../services/api', () => ({
  fetchFundCommonData: mockedApi.fetchFundCommonData,
  fetchFundHoldings: mockedApi.fetchFundHoldings,
  fetchParentETFInfo: mockedApi.fetchParentETFInfo,
  fetchFundPerformance: mockedApi.fetchFundPerformance,
  fetchEastMoneyPingzhongData: mockedApi.fetchEastMoneyPingzhongData,
  fetchTencentStockQuotes: mockedApi.fetchTencentStockQuotes,
  fetchTencentIntradayData: mockedApi.fetchTencentIntradayData,
  buildTencentQuoteCodes: mockedApi.buildTencentQuoteCodes,
}));

vi.mock('../../services/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../services/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

vi.mock('../TradeMarkerLegend', () => ({
  TradeMarkerLegend: () => <div>legend</div>,
}));

vi.mock('../Icon', () => ({
  Icons: {
    ArrowUp: () => <span>arrow</span>,
    Refresh: () => <span>refresh</span>,
  },
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, initial: _i, animate: _a, exit: _e, ...props }: Record<string, unknown>) => (
      <div {...props}>{children as React.ReactNode}</div>
    ),
  },
  AnimatePresence: ({
    children,
    onExitComplete,
  }: {
    children?: React.ReactNode;
    onExitComplete?: () => void;
  }) => {
    React.useEffect(() => {
      if (!children) onExitComplete?.();
    }, [children, onExitComplete]);

    return <>{children}</>;
  },
}));

vi.mock('echarts', () => ({
  init: vi.fn(() => ({
    clear: vi.fn(),
    dispose: vi.fn(),
    resize: vi.fn(),
    setOption: vi.fn(),
  })),
  getInstanceByDom: vi.fn(() => undefined),
  graphic: {
    LinearGradient: vi.fn(),
  },
}));

const fund: Fund = {
  code: '000001',
  name: '测试基金',
  platform: 'test',
  holdingShares: 100,
  costPrice: 1,
  currentNav: 1.2,
  lastUpdate: '2026-04-01',
  dayChangePct: 0.5,
  dayChangeVal: 0.05,
};

const FundDetailHarness = () => {
  const [isVisible, setIsVisible] = React.useState(true);

  return (
    <>
      <button type="button" onClick={() => setIsVisible(true)}>
        open fund detail
      </button>
      {isVisible && <FundDetail fund={fund} onBack={() => setIsVisible(false)} />}
    </>
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  resetOverlayStack();
  localStorage.clear();

  mockedApi.fetchFundCommonData.mockResolvedValue({
    data: {
      nav: 1.2345,
      navDate: '2026-04-07',
      navChangePercent: 0.5,
    },
  });
  mockedApi.fetchFundHoldings.mockResolvedValue({ data: { equityHoldings: [] } });
  mockedApi.fetchParentETFInfo.mockResolvedValue(null);
  mockedApi.fetchTencentStockQuotes.mockResolvedValue({});
  mockedApi.fetchTencentIntradayData.mockResolvedValue({});
  mockedApi.fetchFundPerformance.mockResolvedValue({ data: { annual: { returns: [] } } });
  mockedApi.fetchEastMoneyPingzhongData.mockResolvedValue({
    syl_1y: '1.11',
    syl_3y: '2.22',
    syl_6y: '3.33',
    syl_1n: '4.44',
    grandTotal: [],
    netWorthTrend: [
      { x: new Date('2026-04-07').getTime(), y: 1.2345, equityReturn: 0.5, unitMoney: '' },
    ],
    acWorthTrend: [[new Date('2026-04-07').getTime(), 1.2345]],
  });

  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          tsData: {
            dates: ['2026-04-07'],
            funds: [[0]],
            catAvg: [0],
            bmk1: [0],
          },
        },
      }),
    })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetOverlayStack();
});

describe('FundDetail modal edge swipe lifecycle', () => {
  it('reopens the fund detail modal from the default position after edge swipe close', async () => {
    render(<FundDetailHarness />);

    await screen.findByText('测试基金');
    const backdrop = document.querySelector('.backdrop-blur-md') as HTMLElement;

    act(() => {
      closeTopOverlay({ source: 'edge-swipe', targetX: 480 });
    });

    await waitFor(() => {
      expect(backdrop).toHaveStyle({ transform: 'translateX(480px)' });
    });

    fireEvent.transitionEnd(backdrop);

    await waitFor(() => {
      expect(screen.queryByText('测试基金')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'open fund detail' }));

    await screen.findByText('测试基金');
    const reopenedBackdrop = document.querySelector('.backdrop-blur-md') as HTMLElement;
    expect(reopenedBackdrop).toHaveStyle({ transform: 'translateX(0px)' });
  });
});
