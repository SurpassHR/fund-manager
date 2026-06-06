import { useCallback, useEffect, useRef, useState } from 'react';

export const AUTO_REFRESH_INTERVAL_MS = 15000;
export const AUTO_REFRESH_STALE_MS = 60000;

type RefreshScope = 'fund' | 'watchlist';

export type RefreshExecutionStatus = 'success' | 'partial_failed' | 'failed' | 'skipped';

export type RefreshExecutionResult = {
  status: RefreshExecutionStatus;
  attempted: number;
  failed: number;
  completedAt: number;
};

export type RefreshUiStatus = 'idle' | 'running' | 'success' | 'partial_failed' | 'failed';

type RefreshRunner = (options?: { force?: boolean }) => Promise<RefreshExecutionResult | void>;

type UseUnifiedAutoRefreshParams = {
  scope: RefreshScope;
  enabled: boolean;
  refresh: RefreshRunner;
  intervalMs?: number;
  staleMs?: number;
};

const LAST_SUCCESS_KEY_PREFIX = 'lastAutoUpdate_timestamp';

export const buildRefreshLastSuccessKey = (scope: RefreshScope) =>
  `${LAST_SUCCESS_KEY_PREFIX}:${scope}`;

export const readRefreshLastSuccessAt = (scope: RefreshScope): number | null => {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(buildRefreshLastSuccessKey(scope));
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? null : parsed;
};

export const writeRefreshLastSuccessAt = (scope: RefreshScope, timestamp: number) => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(buildRefreshLastSuccessKey(scope), String(timestamp));
};

export const isRefreshStale = (lastSuccessAt: number | null, staleMs = AUTO_REFRESH_STALE_MS) => {
  if (lastSuccessAt == null) return true;
  return Date.now() - lastSuccessAt > staleMs;
};

const toUiStatus = (status: RefreshExecutionStatus | undefined): RefreshUiStatus => {
  if (status === 'partial_failed') return 'partial_failed';
  if (status === 'failed') return 'failed';
  if (status === 'success' || status === 'skipped') return 'success';
  return 'success';
};

export const useUnifiedAutoRefresh = ({
  scope,
  enabled,
  refresh,
  intervalMs = AUTO_REFRESH_INTERVAL_MS,
  staleMs = AUTO_REFRESH_STALE_MS,
}: UseUnifiedAutoRefreshParams) => {
  const [refreshStatus, setRefreshStatus] = useState<RefreshUiStatus>('idle');
  const [lastAttemptAt, setLastAttemptAt] = useState<number | null>(null);
  const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(() =>
    readRefreshLastSuccessAt(scope),
  );

  const inFlightRef = useRef<Promise<RefreshExecutionResult | void> | null>(null);
  const lastSuccessRef = useRef<number | null>(lastSuccessAt);

  useEffect(() => {
    const restored = readRefreshLastSuccessAt(scope);
    setLastSuccessAt(restored);
  }, [scope]);

  useEffect(() => {
    lastSuccessRef.current = lastSuccessAt;
  }, [lastSuccessAt]);

  const runRefresh = useCallback(
    async (force = false) => {
      if (inFlightRef.current) return undefined;

      const task = (async () => {
        setRefreshStatus('running');
        setLastAttemptAt(Date.now());

        try {
          const result = await refresh({ force });
          const resultStatus = result && typeof result === 'object' ? result.status : undefined;
          const uiStatus = toUiStatus(resultStatus);
          setRefreshStatus(uiStatus);

          if (resultStatus !== 'failed') {
            const successAt =
              result && typeof result === 'object' ? result.completedAt : Date.now();
            setLastSuccessAt(successAt);
            writeRefreshLastSuccessAt(scope, successAt);
          }

          return result;
        } catch (error) {
          setRefreshStatus('failed');
          throw error;
        } finally {
          inFlightRef.current = null;
        }
      })();

      inFlightRef.current = task;
      return task;
    },
    [refresh, scope],
  );

  useEffect(() => {
    if (!enabled) return;

    const maybeRefresh = () => {
      if (document.visibilityState !== 'visible') return;
      if (isRefreshStale(lastSuccessRef.current, staleMs)) {
        void runRefresh(false);
      }
    };

    maybeRefresh();

    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void runRefresh(false);
    }, intervalMs);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        maybeRefresh();
      }
    };

    const onWindowFocus = () => {
      maybeRefresh();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onWindowFocus);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onWindowFocus);
    };
  }, [enabled, intervalMs, runRefresh, staleMs]);

  return {
    refreshStatus,
    lastAttemptAt,
    lastSuccessAt,
    isStale: isRefreshStale(lastSuccessAt, staleMs),
    triggerRefresh: runRefresh,
  };
};
