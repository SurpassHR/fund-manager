import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createGistAutoSyncScheduler,
  GIST_AUTO_SYNC_IDLE_DELAY_MS,
  GIST_REMOTE_CHECK_INTERVAL_MS,
} from '../autoSyncScheduler';

describe('gistSync auto sync scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('本地操作后等待 10 分钟无新操作才推送', async () => {
    const pushLocal = vi.fn(async () => undefined);
    const checkRemote = vi.fn(async () => undefined);
    const scheduler = createGistAutoSyncScheduler({ pushLocal, checkRemote });

    scheduler.markDirty();
    await vi.advanceTimersByTimeAsync(GIST_AUTO_SYNC_IDLE_DELAY_MS - 1);
    expect(pushLocal).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(pushLocal).toHaveBeenCalledTimes(1);

    scheduler.dispose();
  });

  it('10 分钟内再次操作会重置空闲推送计时', async () => {
    const pushLocal = vi.fn(async () => undefined);
    const checkRemote = vi.fn(async () => undefined);
    const scheduler = createGistAutoSyncScheduler({ pushLocal, checkRemote });

    scheduler.markDirty();
    await vi.advanceTimersByTimeAsync(GIST_AUTO_SYNC_IDLE_DELAY_MS - 1);
    scheduler.markDirty();
    await vi.advanceTimersByTimeAsync(GIST_AUTO_SYNC_IDLE_DELAY_MS - 1);
    expect(pushLocal).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(pushLocal).toHaveBeenCalledTimes(1);

    scheduler.dispose();
  });

  it('启动后每半小时检查一次远端时间戳', async () => {
    const pushLocal = vi.fn(async () => undefined);
    const checkRemote = vi.fn(async () => undefined);
    const scheduler = createGistAutoSyncScheduler({ pushLocal, checkRemote });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(GIST_REMOTE_CHECK_INTERVAL_MS - 1);
    expect(checkRemote).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(checkRemote).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(GIST_REMOTE_CHECK_INTERVAL_MS);
    expect(checkRemote).toHaveBeenCalledTimes(2);

    scheduler.dispose();
  });
});
