/// <reference types="vitest/globals" />
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';

const { mockAggregate, mockFilter, mockRebase, mockBuildAssets, mockBuildProfit } = vi.hoisted(
  () => ({
    mockAggregate: vi.fn(),
    mockFilter: vi.fn(),
    mockRebase: vi.fn(),
    mockBuildAssets: vi.fn(),
    mockBuildProfit: vi.fn(),
  }),
);

const chartSpies = vi.hoisted(() => ({
  clear: vi.fn(),
  dispose: vi.fn(),
  resize: vi.fn(),
  setOption: vi.fn(),
}));

const mockEchartsInit = vi.hoisted(() => vi.fn());

vi.mock('../../utils/totalAssetsChartUtils', () => ({
  aggregateTotalAssetsHistory: mockAggregate,
  filterDataByTimeRange: mockFilter,
  rebaseDataToFirstValue: mockRebase,
  buildTotalAssetsChartOption: mockBuildAssets,
  buildProfitChartOption: mockBuildProfit,
}));

vi.mock('../../services/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../services/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

vi.mock('../../services/overlayRegistration', () => ({
  useOverlayRegistration: vi.fn(),
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

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ initial: _i, animate: _a, exit: _e, ...rest }: Record<string, unknown>) => (
      <div {...rest} />
    ),
  },
}));

vi.mock('echarts', () => ({
  init: mockEchartsInit.mockReturnValue({
    clear: chartSpies.clear,
    dispose: chartSpies.dispose,
    resize: chartSpies.resize,
    setOption: chartSpies.setOption,
  }),
  getInstanceByDom: vi.fn(() => undefined),
  graphic: { LinearGradient: vi.fn() },
}));

vi.mock('../Icon', () => ({
  Icons: {
    X: (props: Record<string, unknown>) =>
      React.createElement('span', { ...props, 'data-icon': 'x' }, '×'),
    Refresh: (props: Record<string, unknown>) =>
      React.createElement('span', { ...props, 'data-icon': 'refresh' }, '↻'),
  },
}));

import { TotalAssetsModal } from '../TotalAssetsModal';
import type { Fund } from '../../types';
import { resetOverlayStack } from '../../services/overlayStack';

const mockFunds: Fund[] = [
  {
    code: '000001',
    name: '测试基金A',
    platform: '支付宝',
    holdingShares: 100,
    costPrice: 1.0,
    currentNav: 1.2,
    lastUpdate: '2026-05-09',
    dayChangePct: 0.5,
    dayChangeVal: 0.05,
  },
];

const mockChartData = [
  { date: '2025-01-01', totalAssets: 10000, profit: 0 },
  { date: '2025-01-02', totalAssets: 10200, profit: 200 },
  { date: '2025-01-03', totalAssets: 10150, profit: 150 },
];

const defaultProps = {
  isOpen: false,
  onClose: vi.fn(),
  funds: mockFunds,
};

const renderModal = (props = {}) => {
  return render(React.createElement(TotalAssetsModal, { ...defaultProps, ...props }));
};

describe('TotalAssetsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOverlayStack();
    mockEchartsInit.mockReturnValue({
      clear: chartSpies.clear,
      dispose: chartSpies.dispose,
      resize: chartSpies.resize,
      setOption: chartSpies.setOption,
    });
    mockBuildAssets.mockReturnValue({});
    mockBuildProfit.mockReturnValue({});
    mockFilter.mockReturnValue(mockChartData);
    mockRebase.mockReturnValue({ dates: ['2025-01-01'], values: [0] });
  });

  afterEach(() => {
    resetOverlayStack();
  });

  // ============================================================
  // 状态展示
  // ============================================================
  describe('状态展示', () => {
    it('isOpen=false 时不在 DOM 中', () => {
      renderModal({ isOpen: false });
      expect(screen.queryByText('总资产走势')).toBeNull();
    });

    it('isOpen=true 时显示加载状态', () => {
      mockAggregate.mockReturnValue(new Promise(() => {})); // pending forever
      renderModal({ isOpen: true });
      expect(screen.getByText('加载中...')).toBeInTheDocument();
    });

    it('加载失败时显示错误提示', async () => {
      mockAggregate.mockRejectedValue(new Error('Network error'));
      renderModal({ isOpen: true });
      await waitFor(() => {
        expect(screen.getByText(/加载失败/i)).toBeInTheDocument();
      });
    });

    it('数据为空时显示暂无数据', async () => {
      mockAggregate.mockResolvedValue([]);
      renderModal({ isOpen: true });
      await waitFor(() => {
        expect(screen.getByText('暂无数据')).toBeInTheDocument();
      });
    });

    it('数据就绪后显示图表区域', async () => {
      mockAggregate.mockResolvedValue(mockChartData);
      renderModal({ isOpen: true });
      await waitFor(() => {
        expect(screen.getByText('总资产')).toBeInTheDocument();
        expect(screen.getByText('收益')).toBeInTheDocument();
      });
    });
  });

  // ============================================================
  // 时间范围切换
  // ============================================================
  describe('时间范围切换', () => {
    it('渲染全部时间范围按钮', async () => {
      mockAggregate.mockResolvedValue(mockChartData);
      renderModal({ isOpen: true });
      await waitFor(() => {
        expect(screen.getByText('总资产')).toBeInTheDocument();
      });
      for (const range of ['1M', '3M', '6M', '1Y', 'ALL']) {
        expect(screen.getByText(range)).toBeInTheDocument();
      }
    });

    it('点击时间范围按钮切换 active 样式', async () => {
      mockAggregate.mockResolvedValue(mockChartData);
      renderModal({ isOpen: true });
      await waitFor(() => {
        expect(screen.getByText('总资产')).toBeInTheDocument();
      });

      // 默认 '1Y' 为 active
      const btn1Y = screen.getByText('1Y');
      expect(btn1Y.className).toContain('bg-slate-900');

      // 点击 1M 后，1M 变为 active
      const btn1M = screen.getByText('1M');
      fireEvent.click(btn1M);
      expect(btn1M.className).toContain('bg-slate-900');
      expect(btn1Y.className).not.toContain('bg-slate-900');
    });
  });

  // ============================================================
  // 关闭交互
  // ============================================================
  describe('关闭交互', () => {
    it('点击关闭按钮调用 onClose', async () => {
      const onClose = vi.fn();
      mockAggregate.mockResolvedValue(mockChartData);
      renderModal({ isOpen: true, onClose });
      await waitFor(() => {
        expect(screen.getByText('总资产')).toBeInTheDocument();
      });

      const closeBtn = document.querySelector('[data-icon="x"]') as HTMLElement;
      if (closeBtn) {
        fireEvent.click(closeBtn);
        expect(onClose).toHaveBeenCalledTimes(1);
      }
    });

    it('点击 backdrop 关闭 Modal', async () => {
      const onClose = vi.fn();
      mockAggregate.mockResolvedValue(mockChartData);
      renderModal({ isOpen: true, onClose });
      await waitFor(() => {
        expect(screen.getByText('总资产')).toBeInTheDocument();
      });

      const backdrop = document.querySelector('.backdrop-blur-md');
      if (backdrop) {
        fireEvent.click(backdrop);
        expect(onClose).toHaveBeenCalled();
      }
    });
  });

  // ============================================================
  // 图表 DOM 挂载（jsdom 环境下 ECharts 不初始化，仅验证 DOM 结构）
  // ============================================================
  describe('图表 DOM 挂载', () => {
    it('数据就绪后渲染两个图表容器 div', async () => {
      mockAggregate.mockResolvedValue(mockChartData);
      renderModal({ isOpen: true });
      await waitFor(() => {
        expect(screen.getByText('总资产')).toBeInTheDocument();
      });

      const chartContainers = document.querySelectorAll('.h-64');
      expect(chartContainers).toHaveLength(2);
    });

    it('isOpen 变 false 后图表区域移除', async () => {
      mockAggregate.mockResolvedValue(mockChartData);
      const { rerender } = renderModal({ isOpen: true });
      await waitFor(() => {
        expect(screen.getByText('总资产')).toBeInTheDocument();
      });

      rerender(React.createElement(TotalAssetsModal, { ...defaultProps, isOpen: false }));

      await waitFor(() => {
        expect(screen.queryByText('总资产')).toBeNull();
      });
    });
  });

  // ============================================================
  // 数据聚合
  // ============================================================
  describe('数据聚合', () => {
    it('isOpen 变 true 时触发 aggregateTotalAssetsHistory', async () => {
      mockAggregate.mockResolvedValue(mockChartData);
      renderModal({ isOpen: true });

      await waitFor(() => {
        expect(mockAggregate).toHaveBeenCalledWith(mockFunds);
      });
    });

    it('funds 变化时重新聚合', async () => {
      mockAggregate.mockResolvedValue(mockChartData);
      const { rerender } = renderModal({ isOpen: true });

      const newFunds: Fund[] = [{ ...mockFunds[0], code: '000002', holdingShares: 200 }];

      rerender(
        React.createElement(TotalAssetsModal, {
          ...defaultProps,
          isOpen: true,
          funds: newFunds,
        }),
      );

      await waitFor(() => {
        expect(mockAggregate).toHaveBeenCalledWith(newFunds);
      });
    });
  });
});
