/// <reference types="vitest/globals" />
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FundDetail } from '../FundDetail';
import type { Fund } from '../../types';

const mockedApi = vi.hoisted(() => ({
  fetchFundCommonData: vi.fn(),
  fetchFundHoldings: vi.fn(),
  fetchParentETFInfo: vi.fn(),
  fetchFundPerformance: vi.fn(),
  fetchEastMoneyPingzhongData: vi.fn(),
  fetchTencentStockQuotes: vi.fn(),
  buildTencentQuoteCodes: vi.fn(() => []),
}));

const chartSpies = vi.hoisted(() => ({
  clear: vi.fn(),
  dispose: vi.fn(),
  resize: vi.fn(),
  setOption: vi.fn(),
}));

vi.mock('../../services/api', () => ({
  fetchFundCommonData: mockedApi.fetchFundCommonData,
  fetchFundHoldings: mockedApi.fetchFundHoldings,
  fetchParentETFInfo: mockedApi.fetchParentETFInfo,
  fetchFundPerformance: mockedApi.fetchFundPerformance,
  fetchEastMoneyPingzhongData: mockedApi.fetchEastMoneyPingzhongData,
  fetchTencentStockQuotes: mockedApi.fetchTencentStockQuotes,
  buildTencentQuoteCodes: mockedApi.buildTencentQuoteCodes,
}));

vi.mock('../../services/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../services/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
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
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}));

vi.mock('echarts', () => ({
  init: vi.fn(() => ({
    clear: chartSpies.clear,
    dispose: chartSpies.dispose,
    resize: chartSpies.resize,
    setOption: chartSpies.setOption,
  })),
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

describe('FundDetail history performance source', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    mockedApi.fetchFundCommonData.mockResolvedValue(null);
    mockedApi.fetchFundHoldings.mockResolvedValue({ data: { equityHoldings: [] } });
    mockedApi.fetchParentETFInfo.mockResolvedValue(null);
    mockedApi.fetchTencentStockQuotes.mockResolvedValue({});
    mockedApi.fetchFundPerformance.mockResolvedValue({
      data: {
        dayEnd: {
          endDate: '2026-04-01',
          nav: 1.2345,
          change: 0.5,
          changeP: 0.5,
          returns: {
            YTD: 6.66,
            Y1: 7.77,
            Y3: 8.88,
            sinceInception: 9.99,
          },
        },
        quarterly: { returns: [] },
        annual: {
          returns: [
            { k: 2024, v: 12.34 },
            { k: 2025, v: -5.67 },
          ],
        },
      },
    });
    mockedApi.fetchEastMoneyPingzhongData.mockResolvedValue({
      syl_1y: '1.11',
      syl_3y: '2.22',
      syl_6y: '3.33',
      syl_1n: '4.44',
      grandTotal: [
        {
          name: '本基金',
          data: [
            [new Date('2026-04-03').getTime(), 1.2],
            [new Date('2026-04-07').getTime(), 2.4],
          ],
        },
        {
          name: '业绩比较基准',
          data: [
            [new Date('2026-04-03').getTime(), 0.8],
            [new Date('2026-04-07').getTime(), 1.6],
          ],
        },
      ],
      netWorthTrend: [
        { x: new Date('2026-04-03').getTime(), y: 1.4321, equityReturn: -0.12, unitMoney: '' },
        { x: new Date('2026-04-07').getTime(), y: 1.5, equityReturn: 1.23, unitMoney: '' },
      ],
      acWorthTrend: [
        [new Date('2026-04-03').getTime(), 1.7321],
        [new Date('2026-04-07').getTime(), 1.8],
      ],
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: {
            tsData: {
              dates: ['2026-04-03', '2026-04-04', '2026-04-05', '2026-04-07'],
              funds: [[1.2, 0, 0, 2.4]],
              catAvg: [0, 0, 0, 0],
              bmk1: [0.8, 0, 0, 1.6],
            },
          },
        }),
      })),
    );
  });

  it('uses EastMoney pingzhongdata values for summary cards', async () => {
    render(<FundDetail fund={fund} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(mockedApi.fetchEastMoneyPingzhongData).toHaveBeenCalledWith('000001');
    });

    expect(await screen.findByText('近1月')).toBeInTheDocument();
    expect(screen.getByText('近3月')).toBeInTheDocument();
    expect(screen.getByText('近6月')).toBeInTheDocument();
    expect(screen.getByText('近1年')).toBeInTheDocument();
    expect(screen.getByText('+1.11%')).toBeInTheDocument();
    expect(screen.getByText('+2.22%')).toBeInTheDocument();
    expect(screen.getByText('+3.33%')).toBeInTheDocument();
    expect(screen.getByText('+4.44%')).toBeInTheDocument();
  });

  it('uses EastMoney trading dates for chart and history instead of weekend-filled growth data', async () => {
    render(<FundDetail fund={fund} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(chartSpies.setOption).toHaveBeenCalled();
    });

    const latestOption = chartSpies.setOption.mock.calls.at(-1)?.[0] as {
      xAxis?: { data?: string[] };
    };

    expect(latestOption.xAxis?.data).toEqual(['2026-04-03', '2026-04-07']);
    expect(screen.queryByText('04-04')).not.toBeInTheDocument();
    expect(screen.queryByText('04-05')).not.toBeInTheDocument();
    expect(screen.getByText('04-07')).toBeInTheDocument();
    expect(screen.getByText('04-03')).toBeInTheDocument();
  });

  it('keeps latest unit nav and accumulated nav stable when switching time ranges', async () => {
    render(<FundDetail fund={fund} onBack={vi.fn()} />);

    expect((await screen.findAllByText('1.5000')).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('1.8000')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '3M' }));

    await waitFor(() => {
      expect(screen.getAllByText('1.5000').length).toBeGreaterThanOrEqual(2);
    });
    expect(screen.getByText('1.8000')).toBeInTheDocument();
  });

  it('shows annual returns aggregated from EastMoney acc worth trend', async () => {
    mockedApi.fetchEastMoneyPingzhongData.mockResolvedValueOnce({
      syl_1y: '1.11',
      syl_3y: '2.22',
      syl_6y: '3.33',
      syl_1n: '4.44',
      grandTotal: [
        {
          name: '本基金',
          data: [
            [new Date('2024-12-31').getTime(), 0],
            [new Date('2025-12-31').getTime(), 10],
          ],
        },
      ],
      netWorthTrend: [
        { x: new Date('2025-12-31').getTime(), y: 1.5, equityReturn: 1.23, unitMoney: '' },
      ],
      acWorthTrend: [
        [new Date('2023-12-29').getTime(), 1],
        [new Date('2024-12-31').getTime(), 1.2],
        [new Date('2025-12-31').getTime(), 1.5],
      ],
    });

    render(<FundDetail fund={fund} onBack={vi.fn()} />);

    expect(await screen.findByText('2024')).toBeInTheDocument();
    expect(screen.getByText('+20.00%')).toBeInTheDocument();
    expect(screen.getByText('2025')).toBeInTheDocument();
    expect(screen.getByText('+25.00%')).toBeInTheDocument();
  });

  it('falls back to Morningstar annual returns when EastMoney annual return base is insufficient', async () => {
    mockedApi.fetchEastMoneyPingzhongData.mockResolvedValueOnce({
      syl_1y: '1.11',
      syl_3y: '2.22',
      syl_6y: '3.33',
      syl_1n: '4.44',
      grandTotal: [
        {
          name: '本基金',
          data: [[new Date('2025-12-31').getTime(), 10]],
        },
      ],
      netWorthTrend: [
        { x: new Date('2025-12-31').getTime(), y: 1.5, equityReturn: 1.23, unitMoney: '' },
      ],
      acWorthTrend: [[new Date('2025-12-31').getTime(), 1.5]],
    });

    render(<FundDetail fund={fund} onBack={vi.fn()} />);

    expect(await screen.findByText('2024')).toBeInTheDocument();
    expect(screen.getByText('+12.34%')).toBeInTheDocument();
    expect(screen.getByText('2025')).toBeInTheDocument();
    expect(screen.getByText('-5.67%')).toBeInTheDocument();
  });
});
