import { describe, expect, it, vi } from 'vitest';
import { RefreshOrchestrator } from './refreshOrchestrator';

describe('RefreshOrchestrator', () => {
  it('dedupes repeated requests for the same task', async () => {
    const handler = vi.fn(async () => undefined);
    const orchestrator = new RefreshOrchestrator({
      handlers: {
        funds: handler,
      },
    });

    await Promise.all([
      orchestrator.request('funds'),
      orchestrator.request('funds'),
      orchestrator.request('funds'),
    ]);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('runs higher-priority task first when queued together', async () => {
    const order: string[] = [];
    const orchestrator = new RefreshOrchestrator({
      handlers: {
        funds: async () => {
          order.push('funds');
        },
        watchlist: async () => {
          order.push('watchlist');
        },
      },
    });

    const lowPromise = orchestrator.request('funds', { priority: 'low' });
    const highPromise = orchestrator.request('watchlist', { priority: 'high' });

    await Promise.all([lowPromise, highPromise]);

    expect(order).toEqual(['watchlist', 'funds']);
  });

  it('upgrades to force rerun when force request arrives during running', async () => {
    let releaseFirstRun: (() => void) | undefined;
    let resolveFirstRunStarted: (() => void) | undefined;
    const firstRunStarted = new Promise<void>((resolve) => {
      resolveFirstRunStarted = resolve;
    });
    const runOptions: boolean[] = [];

    const orchestrator = new RefreshOrchestrator({
      handlers: {
        funds: async ({ force }) => {
          runOptions.push(force);
          if (!force) {
            await new Promise<void>((resolve) => {
              releaseFirstRun = () => {
                resolve();
              };
              resolveFirstRunStarted?.();
            });
          }
        },
      },
    });

    const firstRun = orchestrator.request('funds', { force: false });
    await firstRunStarted;

    const forceUpgradeRun = orchestrator.request('funds', { force: true });

    expect(orchestrator.getStateStore().getSnapshot().stale.funds).toBe(true);

    expect(releaseFirstRun).toBeTypeOf('function');
    releaseFirstRun?.();

    await Promise.all([firstRun, forceUpgradeRun]);

    expect(runOptions).toEqual([false, true]);
  });
});
