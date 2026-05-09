/// <reference types="vitest/globals" />
import React from 'react';
import * as echarts from 'echarts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FundDetail } from '../FundDetail';
import type { Fund } from '../../types';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject } satisfies Deferred<T>;
};

const mockedApi = vi.hoisted(() => ({
  fetchFundCommonData: vi.fn(),
  fetchFundHoldings: vi.fn(),
  fetchParentETFInfo: vi.fn(),
  fetchFundPerformance: vi.fn(),
  fetchEastMoneyPingzhongData: vi.fn(),
  fetchTencentStockQuotes: vi.fn(),
  fetchTencentIntradayData: vi.fn(),
  buildTencentQuoteCodes: vi.fn(() => []),
  checkIsMarketTrading: vi.fn(() => Promise.resolve(false)),
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
  fetchTencentIntradayData: mockedApi.fetchTencentIntradayData,
  buildTencentQuoteCodes: mockedApi.buildTencentQuoteCodes,
  checkIsMarketTrading: mockedApi.checkIsMarketTrading,
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
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('echarts', () => ({
  init: vi.fn(() => ({
    clear: chartSpies.clear,
    dispose: chartSpies.dispose,
    resize: chartSpies.resize,
    setOption: chartSpies.setOption,
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

describe('FundDetail history performance source', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    mockedApi.fetchFundCommonData.mockResolvedValue(null);
    mockedApi.fetchFundHoldings.mockResolvedValue({ data: { equityHoldings: [] } });
    mockedApi.fetchParentETFInfo.mockResolvedValue(null);
    mockedApi.fetchTencentStockQuotes.mockResolvedValue({});
    mockedApi.fetchTencentIntradayData.mockResolvedValue({});
    mockedApi.checkIsMarketTrading.mockResolvedValue(false);
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
        { x: new Date('2025-10-07').getTime(), y: 1.2, equityReturn: -10.5, unitMoney: '' },
        { x: new Date('2025-11-07').getTime(), y: 1.25, equityReturn: -7.2, unitMoney: '' },
        { x: new Date('2025-12-07').getTime(), y: 1.3, equityReturn: -5.0, unitMoney: '' },
        { x: new Date('2026-01-07').getTime(), y: 1.35, equityReturn: -3.1, unitMoney: '' },
        { x: new Date('2026-02-07').getTime(), y: 1.38, equityReturn: -1.5, unitMoney: '' },
        { x: new Date('2026-03-07').getTime(), y: 1.4, equityReturn: -0.5, unitMoney: '' },
        { x: new Date('2026-04-03').getTime(), y: 1.4321, equityReturn: -0.12, unitMoney: '' },
        { x: new Date('2026-04-07').getTime(), y: 1.5, equityReturn: 1.23, unitMoney: '' },
      ],
      acWorthTrend: [
        [new Date('2023-12-31').getTime(), 1.4],
        [new Date('2024-12-31').getTime(), 1.5],
        [new Date('2025-10-07').getTime(), 1.5],
        [new Date('2025-11-07').getTime(), 1.55],
        [new Date('2025-12-31').getTime(), 1.6],
        [new Date('2026-01-07').getTime(), 1.65],
        [new Date('2026-02-07').getTime(), 1.68],
        [new Date('2026-03-07').getTime(), 1.7],
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

    expect(latestOption.xAxis?.data).toEqual(['2026-03-07', '2026-04-03', '2026-04-07']);
    expect(screen.queryByText('04-04')).not.toBeInTheDocument();
    expect(screen.queryByText('04-05')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('common.historyNav'));
    expect(screen.getByText('04-07')).toBeInTheDocument();
    expect(screen.getByText('04-03')).toBeInTheDocument();
  });

  it('hides chart loading overlay after EastMoney data arrives during a cancelled fallback fetch', async () => {
    const deferredPingzhong = createDeferred<Awaited<
      ReturnType<typeof mockedApi.fetchEastMoneyPingzhongData>
    > | null>();

    mockedApi.fetchFundCommonData.mockResolvedValueOnce({
      data: {
        nav: 1.2345,
        navDate: '2026-04-07',
        navChangePercent: 0.5,
      },
    });
    mockedApi.fetchEastMoneyPingzhongData.mockReturnValueOnce(deferredPingzhong.promise);
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );

    render(<FundDetail fund={fund} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('refresh')).toBeInTheDocument();
    });

    deferredPingzhong.resolve({
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
        { x: new Date('2025-10-07').getTime(), y: 1.2, equityReturn: -10.5, unitMoney: '' },
        { x: new Date('2025-11-07').getTime(), y: 1.25, equityReturn: -7.2, unitMoney: '' },
        { x: new Date('2025-12-07').getTime(), y: 1.3, equityReturn: -5.0, unitMoney: '' },
        { x: new Date('2026-01-07').getTime(), y: 1.35, equityReturn: -3.1, unitMoney: '' },
        { x: new Date('2026-02-07').getTime(), y: 1.38, equityReturn: -1.5, unitMoney: '' },
        { x: new Date('2026-03-07').getTime(), y: 1.4, equityReturn: -0.5, unitMoney: '' },
        { x: new Date('2026-04-03').getTime(), y: 1.4321, equityReturn: -0.12, unitMoney: '' },
        { x: new Date('2026-04-07').getTime(), y: 1.5, equityReturn: 1.23, unitMoney: '' },
      ],
      acWorthTrend: [
        [new Date('2023-12-31').getTime(), 1.4],
        [new Date('2024-12-31').getTime(), 1.5],
        [new Date('2025-10-07').getTime(), 1.5],
        [new Date('2025-11-07').getTime(), 1.55],
        [new Date('2025-12-31').getTime(), 1.6],
        [new Date('2026-01-07').getTime(), 1.65],
        [new Date('2026-02-07').getTime(), 1.68],
        [new Date('2026-03-07').getTime(), 1.7],
        [new Date('2026-04-03').getTime(), 1.7321],
        [new Date('2026-04-07').getTime(), 1.8],
      ],
    });

    await waitFor(() => {
      expect(chartSpies.setOption).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.queryByText('refresh')).not.toBeInTheDocument();
    });
  });

  it('keeps latest unit nav and accumulated nav stable when switching time ranges', async () => {
    render(<FundDetail fund={fund} onBack={vi.fn()} />);

    fireEvent.click(screen.getByText('common.historyNav'));

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

    await screen.findByText('common.annualReturns');
    fireEvent.click(screen.getByText('common.annualReturns'));

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

    await screen.findByText('common.annualReturns');
    fireEvent.click(screen.getByText('common.annualReturns'));

    expect(await screen.findByText('2024')).toBeInTheDocument();
    expect(screen.getByText('+12.34%')).toBeInTheDocument();
    expect(screen.getByText('2025')).toBeInTheDocument();
    expect(screen.getByText('-5.67%')).toBeInTheDocument();
  });

  it('T+2 买入次日详情页不应展示持有收益和日收益', async () => {
    mockedApi.fetchFundCommonData.mockResolvedValueOnce({
      data: {
        nav: 1.2345,
        navDate: '2026-04-23',
        navChangePercent: 0.5,
      },
    });

    render(
      <FundDetail
        fund={{
          ...fund,
          currentNav: 1.2345,
          lastUpdate: '2026-04-23',
          dayChangePct: 0.5,
          dayChangeVal: 7.89,
          buyDate: '2026-04-22',
          buyTime: 'before15',
          settlementDays: 2,
        }}
        onBack={vi.fn()}
      />,
    );

    await screen.findByText('1.2345');

    expect(screen.queryByText('+23.45')).not.toBeInTheDocument();
    expect(screen.queryByText('+7.89')).not.toBeInTheDocument();
  });

  it('详情页实时涨跌幅可用时，应回推日收益而不是沿用落库 0', async () => {
    mockedApi.fetchFundCommonData.mockResolvedValueOnce({
      data: {
        nav: 1.2345,
        navDate: '2026-04-23',
        navChangePercent: 0.5,
      },
    });

    render(
      <FundDetail
        fund={{
          ...fund,
          holdingShares: 100,
          currentNav: 1.2,
          lastUpdate: '2026-04-22',
          dayChangePct: 0,
          dayChangeVal: 0,
          buyDate: '2026-04-10',
          buyTime: 'before15',
          settlementDays: 1,
        }}
        onBack={vi.fn()}
      />,
    );

    await screen.findByText('1.2345');

    expect(screen.getByText('+0.50%')).toBeInTheDocument();
    expect(screen.getByText('+0.61')).toBeInTheDocument();
  });

  it('fund.lastUpdate 已进入确认日时，不应被旧 navDate 误判为在途', async () => {
    mockedApi.fetchFundCommonData.mockResolvedValueOnce({
      data: {
        nav: 1.2345,
        navDate: '2026-04-22',
        navChangePercent: 0.5,
      },
    });

    render(
      <FundDetail
        fund={{
          ...fund,
          holdingShares: 100,
          currentNav: 1.2345,
          lastUpdate: '2026-04-23',
          dayChangePct: 0.5,
          dayChangeVal: 7.89,
          buyDate: '2026-04-22',
          buyTime: 'before15',
          settlementDays: 1,
        }}
        onBack={vi.fn()}
      />,
    );

    await screen.findByText('1.2345');

    expect(screen.queryByText('common.inTransit')).not.toBeInTheDocument();
    expect(screen.getAllByText('+23.45').length).toBeGreaterThanOrEqual(2);
  });

  it('commonData 日期落后于 fund.lastUpdate 时，应按 fund 快照计算日收益', async () => {
    mockedApi.fetchFundCommonData.mockResolvedValueOnce({
      data: {
        nav: 1.2345,
        navDate: '2026-04-22',
        navChangePercent: 0,
      },
    });

    render(
      <FundDetail
        fund={{
          ...fund,
          holdingShares: 100,
          currentNav: 1.2345,
          lastUpdate: '2026-04-23',
          dayChangePct: 0.5,
          dayChangeVal: 0.61,
          buyDate: '2026-04-10',
          buyTime: 'before15',
          settlementDays: 1,
        }}
        onBack={vi.fn()}
      />,
    );

    await screen.findByText('1.2345');

    expect(screen.queryByText('common.inTransit')).not.toBeInTheDocument();
    expect(screen.getByText('+0.50%')).toBeInTheDocument();
    expect(screen.getByText('+0.61')).toBeInTheDocument();
  });

  it('history NAV section is collapsed by default', async () => {
    render(<FundDetail fund={fund} onBack={vi.fn()} />);
    await screen.findByText('common.historyNav');

    expect(screen.queryByText('04-03')).not.toBeInTheDocument();
    expect(screen.queryByText('04-07')).not.toBeInTheDocument();
  });

  it('history NAV section expands when header is clicked', async () => {
    render(<FundDetail fund={fund} onBack={vi.fn()} />);
    await screen.findByText('common.historyNav');

    fireEvent.click(screen.getByText('common.historyNav'));

    await waitFor(() => {
      expect(screen.getByText('04-03')).toBeInTheDocument();
      expect(screen.getByText('04-07')).toBeInTheDocument();
    });
  });

  it('history NAV section collapses when header is clicked again', async () => {
    render(<FundDetail fund={fund} onBack={vi.fn()} />);
    await screen.findByText('common.historyNav');

    fireEvent.click(screen.getByText('common.historyNav'));
    await waitFor(() => {
      expect(screen.getByText('04-03')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('common.historyNav'));
    await waitFor(() => {
      expect(screen.queryByText('04-03')).not.toBeInTheDocument();
    });
  });

  it('annual returns section is collapsed by default', async () => {
    render(<FundDetail fund={fund} onBack={vi.fn()} />);
    await screen.findByText('common.annualReturns');

    expect(screen.queryByText('2024')).not.toBeInTheDocument();
    expect(screen.queryByText('2025')).not.toBeInTheDocument();
  });

  it('annual returns section expands when header is clicked', async () => {
    render(<FundDetail fund={fund} onBack={vi.fn()} />);
    await screen.findByText('common.annualReturns');

    fireEvent.click(screen.getByText('common.annualReturns'));

    await waitFor(() => {
      expect(screen.getByText('2024')).toBeInTheDocument();
      expect(screen.getByText('2025')).toBeInTheDocument();
    });
  });

  it('annual returns section is not rendered when there is no data', async () => {
    mockedApi.fetchFundPerformance.mockResolvedValueOnce({
      data: { annual: { returns: [] } },
    });
    mockedApi.fetchEastMoneyPingzhongData.mockResolvedValueOnce({
      acWorthTrend: [[new Date('2025-12-31').getTime(), 1.5]],
      netWorthTrend: [],
      grandTotal: [],
    });

    render(<FundDetail fund={fund} onBack={vi.fn()} />);
    await screen.findByText('common.historyNav');

    expect(screen.queryByText('common.annualReturns')).not.toBeInTheDocument();
  });

  it('holdings section renders before history NAV section', async () => {
    mockedApi.fetchFundHoldings.mockResolvedValueOnce({
      data: {
        equityHoldings: [{ ticker: '600519', name: '贵州茅台', weight: 10 }],
      },
    });

    render(<FundDetail fund={fund} onBack={vi.fn()} />);

    await screen.findByText(/当前基金持仓明细/);

    const holdingsHeading = screen.getByText(/当前基金持仓明细/);
    const historyHeading = screen.getByText('common.historyNav');

    expect(
      holdingsHeading.compareDocumentPosition(historyHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('collapse states are not persisted to localStorage', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    render(<FundDetail fund={fund} onBack={vi.fn()} />);
    await screen.findByText('common.historyNav');

    fireEvent.click(screen.getByText('common.historyNav'));

    const collapseRelatedCalls = setItemSpy.mock.calls.filter(
      ([key]) =>
        typeof key === 'string' &&
        (key.includes('collapse') || key.includes('expanded') || key.includes('history')),
    );
    expect(collapseRelatedCalls).toHaveLength(0);

    setItemSpy.mockRestore();
  });

  it('shows sparkline column when intraday data is available', async () => {
    mockedApi.fetchFundHoldings.mockResolvedValue({
      data: {
        equityHoldings: [
          { ticker: '600519', name: '贵州茅台', weight: 5.5, sector: '消费', styleBox: '大盘' },
        ],
      },
    });
    mockedApi.fetchTencentStockQuotes.mockResolvedValue({
      '600519': { price: '1800.00', pct: 2.5 },
    });
    mockedApi.fetchTencentIntradayData.mockResolvedValue({
      '600519': [
        { time: '09:30', price: 1780 },
        { time: '09:31', price: 1790 },
        { time: '09:32', price: 1800 },
      ],
    });
    mockedApi.buildTencentQuoteCodes.mockReturnValue(['sh600519']);

    render(<FundDetail fund={fund} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('贵州茅台')).toBeInTheDocument();
    });

    // Sparkline SVG should exist
    const svg = document.querySelector('svg[aria-hidden="true"]');
    expect(svg).not.toBeNull();
    expect(svg!.querySelector('polyline')).not.toBeNull();
  });

  it('does not render sparkline when intraday data is empty', async () => {
    mockedApi.fetchFundHoldings.mockResolvedValue({
      data: {
        equityHoldings: [
          { ticker: '600519', name: '贵州茅台', weight: 5.5, sector: '消费', styleBox: '大盘' },
        ],
      },
    });
    mockedApi.fetchTencentStockQuotes.mockResolvedValue({
      '600519': { price: '1800.00', pct: 2.5 },
    });
    mockedApi.fetchTencentIntradayData.mockResolvedValue({});
    mockedApi.buildTencentQuoteCodes.mockReturnValue(['sh600519']);

    render(<FundDetail fund={fund} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('贵州茅台')).toBeInTheDocument();
    });

    // No sparkline SVG should exist
    expect(document.querySelector('svg[aria-hidden="true"]')).toBeNull();
  });

  it('uses responsive auto-fit grid layout for holdings', async () => {
    mockedApi.fetchFundHoldings.mockResolvedValue({
      data: {
        equityHoldings: [
          { ticker: '600519', name: '贵州茅台', weight: 5.5, sector: '消费', styleBox: '大盘' },
        ],
      },
    });
    mockedApi.fetchTencentStockQuotes.mockResolvedValue({
      '600519': { price: '1800.00', pct: 2.5 },
    });
    mockedApi.fetchTencentIntradayData.mockResolvedValue({});
    mockedApi.buildTencentQuoteCodes.mockReturnValue(['sh600519']);

    render(<FundDetail fund={fund} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('贵州茅台')).toBeInTheDocument();
    });

    // The holdings grid should use auto-fit responsive layout
    const gridContainer = document.querySelector('[class*="grid-cols-\\[auto_1fr_auto_"]');
    expect(gridContainer).not.toBeNull();
  });

  describe('intraday trend chart', () => {
    const setupIntradayData = () => {
      mockedApi.fetchFundHoldings.mockResolvedValue({
        data: {
          equityHoldings: [
            { ticker: '600519', name: '贵州茅台', weight: 5.5, sector: '消费', styleBox: '大盘' },
          ],
        },
      });
      mockedApi.fetchTencentStockQuotes.mockResolvedValue({
        '600519': { price: '1800.00', pct: 2.5 },
      });
      mockedApi.fetchTencentIntradayData.mockResolvedValue({
        '600519': [
          { time: '09:30', price: 1780 },
          { time: '09:31', price: 1790 },
          { time: '09:32', price: 1800 },
        ],
      });
      mockedApi.buildTencentQuoteCodes.mockReturnValue(['sh600519']);
    };

    it('renders intraday chart when intraday data is available', async () => {
      setupIntradayData();

      render(<FundDetail fund={fund} onBack={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('日内走势')).toBeInTheDocument();
      });

      // ECharts 初始化在 chartReady (50ms) 后才触发，需等待 setOption 调用
      await waitFor(() => {
        expect(chartSpies.setOption).toHaveBeenCalled();
      });
      const initCalls = vi.mocked(echarts.init).mock.calls;
      expect(initCalls.length).toBeGreaterThanOrEqual(2); // main chart + intraday chart
    });

    it('renders intraday chart even when market is not trading', async () => {
      mockedApi.checkIsMarketTrading.mockResolvedValue(false);
      setupIntradayData();

      render(<FundDetail fund={fund} onBack={vi.fn()} />);

      // 即使 isMarketTrading=false，只要有日内数据就应该渲染图表
      await waitFor(() => {
        expect(screen.getByText('日内走势')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(chartSpies.setOption).toHaveBeenCalled();
      });
    });

    it('does not render intraday chart when intraday data is empty', async () => {
      mockedApi.checkIsMarketTrading.mockResolvedValue(true);
      mockedApi.fetchFundHoldings.mockResolvedValue({
        data: {
          equityHoldings: [
            { ticker: '600519', name: '贵州茅台', weight: 5.5, sector: '消费', styleBox: '大盘' },
          ],
        },
      });
      mockedApi.fetchTencentStockQuotes.mockResolvedValue({
        '600519': { price: '1800.00', pct: 2.5 },
      });
      mockedApi.fetchTencentIntradayData.mockResolvedValue({});
      mockedApi.buildTencentQuoteCodes.mockReturnValue(['sh600519']);

      render(<FundDetail fund={fund} onBack={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('贵州茅台')).toBeInTheDocument();
      });

      expect(screen.queryByText('日内走势')).not.toBeInTheDocument();
    });

    it('initializes intraday chart immediately when data arrives', async () => {
      setupIntradayData();

      render(<FundDetail fund={fund} onBack={vi.fn()} />);

      // 等待持仓数据加载完成
      await waitFor(() => {
        expect(screen.getByText('贵州茅台')).toBeInTheDocument();
      });

      // 数据就绪后日内走势区域应立即渲染（不依赖 isMarketTrading）
      expect(screen.getByText('日内走势')).toBeInTheDocument();

      // ECharts 在 chartReady 后初始化
      await waitFor(() => {
        const initCalls = vi.mocked(echarts.init).mock.calls;
        expect(initCalls.length).toBeGreaterThanOrEqual(2);
      });
    });
  });
});
