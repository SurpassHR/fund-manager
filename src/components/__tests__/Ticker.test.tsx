/// <reference types="vitest/globals" />
import React from 'react';
import '@testing-library/jest-dom';
import { act, render } from '@testing-library/react';
import { Ticker } from '../Ticker';
import * as api from '../../services/api';
import type { MarketIndex } from '../../types';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ initial: _i, animate: _a, exit: _e, ...rest }: Record<string, unknown>) => (
      <div {...rest} />
    ),
  },
}));

vi.mock('../Icon', () => ({
  Icons: {
    ArrowUp: ({ size, className }: { size?: number; className?: string }) => (
      <span data-testid="arrow-up" className={className} style={{ fontSize: size }} />
    ),
  },
}));

const makeIndices = (count: number): MarketIndex[] =>
  Array.from({ length: count }, (_, i) => ({
    name: `Index ${i + 1}`,
    value: 3000 + i * 100,
    change: (i % 2 === 0 ? 1 : -1) * (10 + i),
    changePct: (i % 2 === 0 ? 0.5 : -0.3) * (1 + i * 0.1),
  }));

describe('Ticker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /**
   * 核心复现场景：
   * 1. T=1s 首次加载 6 个指数，4s 轮播在 T=5s 启动
   * 2. T=57s 时完成 14 次轮播，index = 14 % 6 = 2
   * 3. 单独 act 块推进到 T=60s，触发 60s 刷新
   * 4. act 结束时 microtask 排空 → setIndices([2 items])
   * 5. React 渲染：indices=[2], index=2 → indices[2]=undefined → crash
   *
   * 关键：使用 6 个指数（而非 5 个），确保轮播 14 次后 index=2（≥新长度 2）。
   * 拆分为多个 act 块确保 microtask 在 setIndices 后立即排空，不被后续 4s 轮播覆盖。
   */
  it('does not crash when fetchMarketIndices returns a shorter array while index is out of bounds', async () => {
    const fetchSpy = vi.spyOn(api, 'fetchMarketIndices');

    // 首次调用使用 deferred promise，在 T=1s 时解析
    let resolveFirst!: (data: MarketIndex[]) => void;
    fetchSpy.mockImplementationOnce(
      () =>
        new Promise<MarketIndex[]>((resolve) => {
          resolveFirst = resolve;
        }),
    );

    const { container } = render(<Ticker />);

    // T=0 → T=1s
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    // T=1s：解析首次数据（6 个指数），轮播在 T=5s 开始
    await act(async () => {
      resolveFirst(makeIndices(6));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(container.textContent).toContain('Index 1');

    // T=1s → T=59s：14 次轮播（5s, 9s, ..., 57s）
    // index 从 0 经过 14 次 → 14 % 6 = 2
    await act(async () => {
      await vi.advanceTimersByTimeAsync(58000);
    });

    // 设置第二次调用返回 2 个指数
    fetchSpy.mockResolvedValueOnce(makeIndices(2));

    // T=59s → T=60s：单独 act 块，60s 刷新在此触发
    // act 结束时 microtask 排空 → setIndices([2 items]) → React 渲染
    // 此时 index=2, indices 长度=2 → indices[2]=undefined → current.name 崩溃
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    // 不应崩溃，应安全降级
    expect(container).toBeTruthy();
    // index 已重置为 0，显示新数组第一项
    expect(container.textContent).toContain('Index 1');
  });

  it('handles empty array return from fetchMarketIndices gracefully', async () => {
    const fetchSpy = vi.spyOn(api, 'fetchMarketIndices');

    let resolveFirst!: (data: MarketIndex[]) => void;
    fetchSpy.mockImplementationOnce(
      () =>
        new Promise<MarketIndex[]>((resolve) => {
          resolveFirst = resolve;
        }),
    );

    const { container } = render(<Ticker />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    await act(async () => {
      resolveFirst(makeIndices(5));
      await vi.advanceTimersByTimeAsync(0);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });

    // 刷新返回空数组 —— data.length===0，不调用 setIndices，旧数据保留
    fetchSpy.mockResolvedValueOnce([]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(52000);
    });

    // 旧数据仍保留
    expect(container.textContent).toContain('Index');
    expect(container.innerHTML).not.toBe('');
  });

  it('resets index to 0 when fetchMarketIndices returns a new array', async () => {
    const fetchSpy = vi.spyOn(api, 'fetchMarketIndices');

    let resolveFirst!: (data: MarketIndex[]) => void;
    fetchSpy.mockImplementationOnce(
      () =>
        new Promise<MarketIndex[]>((resolve) => {
          resolveFirst = resolve;
        }),
    );

    render(<Ticker />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    await act(async () => {
      resolveFirst(makeIndices(5));
      await vi.advanceTimersByTimeAsync(0);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });

    const newIndices = makeIndices(5).map((idx) => ({
      ...idx,
      name: `Updated ${idx.name}`,
    }));
    fetchSpy.mockResolvedValueOnce(newIndices);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(52000);
    });

    const containerAfter = document.body.textContent || '';
    expect(containerAfter).toContain('Updated Index 1');
  });
});
