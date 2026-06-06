import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  refreshFundData: vi.fn(async () => {}),
  refreshWatchlistData: vi.fn(async () => {}),
  runSettlementPipeline: vi.fn(async () => {}),
}));

vi.mock('../db', () => ({
  refreshFundData: mocked.refreshFundData,
  refreshWatchlistData: mocked.refreshWatchlistData,
  runSettlementPipeline: mocked.runSettlementPipeline,
}));

describe('refreshOrchestrator', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('uses legacy path by default and keeps settlement coupled', async () => {
    const { refreshHoldingsWithStrategy, getRefreshMetricsSnapshot } =
      await import('../refreshOrchestrator');

    await refreshHoldingsWithStrategy();

    expect(mocked.refreshFundData).toHaveBeenCalledWith({
      force: false,
      includeSettlement: true,
    });
    expect(mocked.runSettlementPipeline).not.toHaveBeenCalled();

    const metrics = getRefreshMetricsSnapshot();
    expect(metrics.funds.total).toBe(1);
    expect(metrics.funds.success).toBe(1);
    expect(metrics.settlement.total).toBe(0);
  });

  it('uses unified path when gray flag is enabled', async () => {
    const { refreshHoldingsWithStrategy, getRefreshMetricsSnapshot } =
      await import('../refreshOrchestrator');

    await refreshHoldingsWithStrategy({ force: true, useUnifiedRefresh: true });

    expect(mocked.refreshFundData).toHaveBeenCalledWith({
      force: true,
      includeSettlement: false,
    });
    expect(mocked.runSettlementPipeline).toHaveBeenCalledWith({ force: true });

    const metrics = getRefreshMetricsSnapshot();
    expect(metrics.funds.total).toBe(1);
    expect(metrics.settlement.total).toBe(1);
    expect(metrics.settlement.success).toBe(1);
  });

  it('records watchlist refresh metrics', async () => {
    const { refreshWatchlistWithMetrics, getRefreshMetricsSnapshot } =
      await import('../refreshOrchestrator');

    await refreshWatchlistWithMetrics({ force: true });

    expect(mocked.refreshWatchlistData).toHaveBeenCalledWith({ force: true });

    const metrics = getRefreshMetricsSnapshot();
    expect(metrics.watchlist.total).toBe(1);
    expect(metrics.watchlist.success).toBe(1);
  });
});
