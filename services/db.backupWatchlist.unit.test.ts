import { afterEach, describe, expect, it, vi } from 'vitest';
import { db, exportFundsToJsonString, importFundsFromBackupContent } from './db';

describe('db backup watchlist sync data flow', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exports watchlists into backup json for gist upload', async () => {
    vi.spyOn(db.funds, 'toArray').mockResolvedValue([]);
    vi.spyOn(db.watchlists, 'toArray').mockResolvedValue([
      {
        id: 1,
        code: '110011',
        name: '易方达中小盘',
        type: 'fund',
        platform: '天天基金',
        anchorPrice: 1.23,
        anchorDate: '2026-03-20',
        currentPrice: 1.24,
        dayChangePct: 0.81,
        lastUpdate: '2026-03-20',
      },
    ]);

    const payload = JSON.parse(await exportFundsToJsonString()) as {
      version: number;
      funds: unknown[];
      watchlists?: Array<{ code: string; id?: number }>;
    };

    expect(payload.version).toBe(1);
    expect(payload.funds).toHaveLength(0);
    expect(payload.watchlists).toHaveLength(1);
    expect(payload.watchlists?.[0]?.code).toBe('110011');
    expect(payload.watchlists?.[0]).not.toHaveProperty('id');
  });

  it('imports watchlists from gist backup content', async () => {
    vi.spyOn(db.funds, 'toArray').mockResolvedValue([]);
    vi.spyOn(db.watchlists, 'toArray').mockResolvedValue([]);
    const addWatchlistSpy = vi.spyOn(db.watchlists, 'add').mockResolvedValue(1);

    const backup = {
      version: 1,
      exportDate: '2026-03-20T00:00:00.000Z',
      funds: [],
      watchlists: [
        {
          code: '110011',
          name: '易方达中小盘',
          type: 'fund',
          platform: '天天基金',
          anchorPrice: 1.23,
          anchorDate: '2026-03-20',
          currentPrice: 1.24,
          dayChangePct: 0.81,
          lastUpdate: '2026-03-20',
        },
      ],
    };

    const result = await importFundsFromBackupContent(JSON.stringify(backup));

    expect(addWatchlistSpy).toHaveBeenCalledTimes(1);
    expect(addWatchlistSpy).toHaveBeenCalledWith(
      expect.objectContaining({ code: '110011', type: 'fund' }),
    );
    expect(result).toEqual({ added: 1, skipped: 0 });
  });
});
