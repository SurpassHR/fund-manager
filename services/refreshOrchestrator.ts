import { refreshFundData, refreshWatchlistData, runSettlementPipeline } from './db';

type RefreshStage = 'funds' | 'watchlist' | 'settlement';

type StageMetrics = {
  total: number;
  success: number;
  failed: number;
  lastDurationMs: number;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  lastErrorMessage: string | null;
};

export type RefreshMetricsSnapshot = Record<RefreshStage, StageMetrics>;

const createEmptyStageMetrics = (): StageMetrics => ({
  total: 0,
  success: 0,
  failed: 0,
  lastDurationMs: 0,
  lastSuccessAt: null,
  lastFailureAt: null,
  lastErrorMessage: null,
});

const refreshMetrics: RefreshMetricsSnapshot = {
  funds: createEmptyStageMetrics(),
  watchlist: createEmptyStageMetrics(),
  settlement: createEmptyStageMetrics(),
};

const recordMetric = (stage: RefreshStage, durationMs: number, error?: unknown) => {
  const metrics = refreshMetrics[stage];
  metrics.total += 1;
  metrics.lastDurationMs = durationMs;

  if (!error) {
    metrics.success += 1;
    metrics.lastSuccessAt = Date.now();
    metrics.lastErrorMessage = null;
    return;
  }

  metrics.failed += 1;
  metrics.lastFailureAt = Date.now();
  metrics.lastErrorMessage = error instanceof Error ? error.message : String(error);
};

const runWithMetrics = async (stage: RefreshStage, runner: () => Promise<void>) => {
  const start = performance.now();
  try {
    await runner();
    recordMetric(stage, performance.now() - start);
  } catch (error) {
    recordMetric(stage, performance.now() - start, error);
    throw error;
  }
};

export const getRefreshMetricsSnapshot = (): RefreshMetricsSnapshot => ({
  funds: { ...refreshMetrics.funds },
  watchlist: { ...refreshMetrics.watchlist },
  settlement: { ...refreshMetrics.settlement },
});

export const refreshHoldingsWithStrategy = async (params?: {
  force?: boolean;
  useUnifiedRefresh?: boolean;
}): Promise<void> => {
  const force = params?.force ?? false;
  const useUnifiedRefresh = params?.useUnifiedRefresh ?? false;

  if (!useUnifiedRefresh) {
    await runWithMetrics('funds', () => refreshFundData({ force, includeSettlement: true }));
    return;
  }

  await runWithMetrics('funds', () => refreshFundData({ force, includeSettlement: false }));
  await runWithMetrics('settlement', () => runSettlementPipeline({ force }));
};

export const refreshWatchlistWithMetrics = async (params?: { force?: boolean }): Promise<void> => {
  const force = params?.force ?? false;
  await runWithMetrics('watchlist', () => refreshWatchlistData({ force }));
};
