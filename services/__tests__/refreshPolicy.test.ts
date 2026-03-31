import { describe, expect, it } from 'vitest';
import {
  buildRefreshLastSuccessKey,
  isRefreshStale,
  readRefreshLastSuccessAt,
  writeRefreshLastSuccessAt,
} from '../refreshPolicy';

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
});
