import { describe, expect, it } from 'vitest';
import { RefreshStateStore } from './refreshStateStore';

describe('RefreshStateStore', () => {
  it('tracks running and last success for task', () => {
    const store = new RefreshStateStore();

    store.markTaskStart('funds', { force: false });
    const runningState = store.getSnapshot();
    expect(runningState.running.funds).toBe(true);

    store.markTaskSuccess('funds');
    const successState = store.getSnapshot();

    expect(successState.running.funds).toBe(false);
    expect(successState.lastSuccessAt.funds).toBeTypeOf('number');
  });

  it('tracks partial failure and stale flags', () => {
    const store = new RefreshStateStore();

    store.markTaskFailure('watchlist', new Error('network'));    
    store.markTaskStale('watchlist', true);

    const snapshot = store.getSnapshot();

    expect(snapshot.partialFailed.watchlist).toBe(true);
    expect(snapshot.stale.watchlist).toBe(true);
  });
});
