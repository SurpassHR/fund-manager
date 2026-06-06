import React, { useRef } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import RefreshButton, { type RefreshButtonHandle } from './RefreshButton';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ initial: _i, animate: _a, exit: _e, ...rest }: Record<string, unknown>) => (
      <div {...rest} />
    ),
  },
}));

function WrapperWithRef({
  onRefresh,
  refCallback,
  disabled,
  size,
}: {
  onRefresh: () => Promise<void>;
  refCallback: (ref: RefreshButtonHandle | null) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}) {
  const btnRef = useRef<RefreshButtonHandle>(null);
  React.useEffect(() => {
    refCallback(btnRef.current);
  }, [refCallback]);
  return <RefreshButton ref={btnRef} onRefresh={onRefresh} disabled={disabled} size={size} />;
}

describe('RefreshButton', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    vi.spyOn(window, 'cancelAnimationFrame').mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ---- 渲染 ----

  it('渲染 RefreshCw 图标', () => {
    render(<RefreshButton onRefresh={vi.fn()} />);
    expect(screen.getByRole('button')).toBeDefined();
    expect(document.querySelector('svg')).toBeTruthy();
  });

  it('默认 size=sm 应用 h-8 w-8', () => {
    render(<RefreshButton onRefresh={vi.fn()} />);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('h-8');
    expect(btn.className).toContain('w-8');
  });

  it('size=md 应用 h-10 w-10', () => {
    render(<RefreshButton onRefresh={vi.fn()} size="md" />);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('h-10');
    expect(btn.className).toContain('w-10');
  });

  // ---- 点击刷新流程 ----

  it('点击触发 onRefresh（在 settle 前即被调用）', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(<RefreshButton onRefresh={onRefresh} />);

    fireEvent.click(screen.getByRole('button'));

    // onRefresh 在 await timer 之前就已调用
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('刷新期间按钮 disabled', async () => {
    let resolve: (v: unknown) => void;
    const onRefresh = vi.fn().mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    render(<RefreshButton onRefresh={onRefresh} />);

    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toBeDisabled();

    // 清理挂起的 timer
    resolve!(undefined);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
  });

  it('刷新完成后进入冷却状态', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(<RefreshButton onRefresh={onRefresh} />);

    fireEvent.click(screen.getByRole('button'));

    // 等待最小刷新时间 1000ms
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });

    // 进度环应显示 .active class
    const progress = document.querySelector('.rb-progress');
    expect(progress?.className).toContain('active');
  });

  it('冷却期间点击不触发 onRefresh', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(<RefreshButton onRefresh={onRefresh} />);

    fireEvent.click(screen.getByRole('button'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });

    // 冷却中再次点击
    fireEvent.click(screen.getByRole('button'));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  // ---- 自动刷新冷却 ----

  it('通过 ref 调用 triggerCooldown 触发冷却', async () => {
    const onRefresh = vi.fn();
    let capturedRef: RefreshButtonHandle | null = null;

    render(
      <WrapperWithRef
        onRefresh={onRefresh}
        refCallback={(r) => {
          capturedRef = r;
        }}
      />,
    );

    await act(async () => {
      capturedRef?.triggerCooldown();
    });

    // 验证进入冷却
    const progress = document.querySelector('.rb-progress');
    expect(progress?.className).toContain('active');
    // 确认未触发刷新回调
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('refresh 过程中 triggerCooldown 不重复触发冷却', async () => {
    let resolve: (v: unknown) => void;
    const onRefresh = vi.fn().mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    let capturedRef: RefreshButtonHandle | null = null;

    render(
      <WrapperWithRef
        onRefresh={onRefresh}
        refCallback={(r) => {
          capturedRef = r;
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button'));
    // 此时正在刷新（isRefreshing=true），triggerCooldown 应跳过
    capturedRef?.triggerCooldown();

    // 进度环不应显示（未进入冷却）
    const progress = document.querySelector('.rb-progress');
    expect(progress?.className).not.toContain('active');

    resolve!(undefined);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
  });

  // ---- disabled prop ----

  it('disabled 状态下点击不触发 onRefresh', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(<RefreshButton onRefresh={onRefresh} disabled />);

    fireEvent.click(screen.getByRole('button'));
    expect(onRefresh).not.toHaveBeenCalled();
  });

  // ---- 卸载清理 ----

  it('卸载时取消 RAF 不报错', () => {
    const { unmount } = render(<RefreshButton onRefresh={vi.fn()} />);
    expect(() => unmount()).not.toThrow();
  });
});
