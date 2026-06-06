import React, { useEffect } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  buildRefreshLastSuccessKey,
  isRefreshStale,
  readRefreshLastSuccessAt,
  useUnifiedAutoRefresh,
  writeRefreshLastSuccessAt,
} from '../refreshPolicy';

type RefreshRunner = (options?: { force?: boolean }) => Promise<{
  status: 'success' | 'partial_failed' | 'failed' | 'skipped';
  attempted: number;
  failed: number;
  completedAt: number;
}>;

const UnifiedRefreshProbe: React.FC<{
  enabled: boolean;
  refresh: RefreshRunner;
  scope: 'fund' | 'watchlist';
  intervalMs?: number;
  staleMs?: number;
  onReady?: (trigger: (force?: boolean) => Promise<unknown> | undefined) => void;
}> = ({ enabled, refresh, scope, intervalMs, staleMs, onReady }) => {
  const { triggerRefresh } = useUnifiedAutoRefresh({
    scope,
    enabled,
    refresh,
    intervalMs,
    staleMs,
  });

  useEffect(() => {
    onReady?.(triggerRefresh);
  }, [onReady, triggerRefresh]);

  return null;
};

describe('refreshPolicy', () => {
  it('builds scope-specific storage keys', () => {
    expect(buildRefreshLastSuccessKey('fund')).toBe('lastAutoUpdate_timestamp:fund');
    expect(buildRefreshLastSuccessKey('watchlist')).toBe('lastAutoUpdate_timestamp:watchlist');
  });

  it('reads and writes last success timestamp in sessionStorage', () => {
    const ts = Date.now();
    writeRefreshLastSuccessAt('fund', ts);
    expect(readRefreshLastSuccessAt('fund')).toBe(ts);
  });

  it('marks refresh stale when missing or older than threshold', () => {
    expect(isRefreshStale(null, 60_000)).toBe(true);
    expect(isRefreshStale(Date.now() - 61_000, 60_000)).toBe(true);
    expect(isRefreshStale(Date.now() - 30_000, 60_000)).toBe(false);
  });

  it('triggers refresh when window regains focus and data is stale', async () => {
    sessionStorage.clear();
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });

    const refresh = vi.fn(async () => ({
      status: 'failed' as const,
      attempted: 1,
      failed: 1,
      completedAt: Date.now(),
    }));

    render(
      React.createElement(UnifiedRefreshProbe, {
        enabled: true,
        scope: 'watchlist',
        intervalMs: 60_000,
        staleMs: 60_000,
        refresh,
      }),
    );

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(2);
    });
  });

  it('drops new refresh requests while current refresh is running', async () => {
    const resolveRef: { current?: () => void } = {};
    const refresh = vi.fn(
      () =>
        new Promise<{
          status: 'success';
          attempted: number;
          failed: number;
          completedAt: number;
        }>((resolve) => {
          resolveRef.current = () =>
            resolve({
              status: 'success',
              attempted: 1,
              failed: 0,
              completedAt: Date.now(),
            });
        }),
    );

    const triggerRef: { current?: (force?: boolean) => Promise<unknown> | undefined } = {};
    render(
      React.createElement(UnifiedRefreshProbe, {
        enabled: false,
        scope: 'fund',
        refresh,
        onReady: (nextTrigger) => {
          triggerRef.current = nextTrigger;
        },
      }),
    );

    await waitFor(() => {
      expect(triggerRef.current).toBeDefined();
    });
    if (!triggerRef.current) {
      throw new Error('triggerRefresh should be ready');
    }

    let first: Promise<unknown> | undefined;
    let second: Promise<unknown> | undefined;
    await act(async () => {
      first = triggerRef.current?.(true) as Promise<unknown> | undefined;
      second = triggerRef.current?.(true) as Promise<unknown> | undefined;
    });

    expect(refresh).toHaveBeenCalledTimes(1);
    await expect(second).resolves.toBeUndefined();

    if (!resolveRef.current) {
      throw new Error('refresh promise should be in-flight');
    }
    await act(async () => {
      resolveRef.current?.();
    });
    await first;
  });
});
