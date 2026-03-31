import { afterEach, describe, expect, it, vi } from 'vitest';
import { db, migrateWatchlistNamesInDb } from '../db';

describe('watchlist name migration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('仅更新名称含前缀代码的自选项', async () => {
    vi.spyOn(db.watchlists, 'toArray').mockResolvedValue([
      {
        id: 1,
        code: '110011',
        name: '110011 易方达中小盘',
        type: 'fund',
        anchorPrice: 1.2,
        anchorDate: '2026-03-20',
        currentPrice: 1.21,
        dayChangePct: 0.1,
        lastUpdate: '2026-03-20',
      },
      {
        id: 2,
        code: '161903',
        name: '万家行业优选',
        type: 'fund',
        anchorPrice: 1.2,
        anchorDate: '2026-03-20',
        currentPrice: 1.21,
        dayChangePct: 0.1,
        lastUpdate: '2026-03-20',
      },
    ]);
    const updateSpy = vi.spyOn(db.watchlists, 'update').mockResolvedValue(1);

    await migrateWatchlistNamesInDb();

    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalledWith(1, { name: '易方达中小盘' });
  });
});
