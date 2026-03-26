import { afterEach, describe, expect, it, vi } from 'vitest';
import { db, exportFundsToJsonString, importFundsFromBackupContent } from './db';

describe('db backup watchlist sync data flow', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exports watchlists into backup json for gist upload', async () => {
    vi.spyOn(db.funds, 'toArray').mockResolvedValue([]);
    vi.spyOn(db.accounts, 'toArray').mockResolvedValue([
      {
        id: 1,
        name: 'Default',
        isDefault: true,
      },
    ]);
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
      accounts?: Array<{ name: string; id?: number }>;
      watchlists?: Array<{ code: string; id?: number }>;
    };

    expect(payload.version).toBe(1);
    expect(payload.funds).toHaveLength(0);
    expect(payload.accounts).toHaveLength(1);
    expect(payload.accounts?.[0]?.name).toBe('Default');
    expect(payload.accounts?.[0]).not.toHaveProperty('id');
    expect(payload.watchlists).toHaveLength(1);
    expect(payload.watchlists?.[0]?.code).toBe('110011');
    expect(payload.watchlists?.[0]).not.toHaveProperty('id');
  });

  it('imports watchlists and accounts from gist backup content', async () => {
    vi.spyOn(db.funds, 'toArray').mockResolvedValue([]);
    vi.spyOn(db.accounts, 'toArray').mockResolvedValue([]);
    vi.spyOn(db.watchlists, 'toArray').mockResolvedValue([]);
    const addAccountSpy = vi.spyOn(db.accounts, 'add').mockResolvedValue(1);
    const addWatchlistSpy = vi.spyOn(db.watchlists, 'add').mockResolvedValue(1);

    const backup = {
      version: 1,
      exportDate: '2026-03-20T00:00:00.000Z',
      funds: [],
      accounts: [{ name: '券商A', isDefault: false }],
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

    expect(addAccountSpy).toHaveBeenCalledTimes(1);
    expect(addAccountSpy).toHaveBeenCalledWith(expect.objectContaining({ name: '券商A' }));
    expect(addWatchlistSpy).toHaveBeenCalledTimes(1);
    expect(addWatchlistSpy).toHaveBeenCalledWith(
      expect.objectContaining({ code: '110011', type: 'fund' }),
    );
    expect(result).toEqual({ added: 2, skipped: 0 });
  });

  it('creates missing account from imported fund platform when legacy backup has no accounts', async () => {
    vi.spyOn(db.funds, 'toArray').mockResolvedValue([]);
    vi.spyOn(db.accounts, 'toArray').mockResolvedValue([
      { id: 1, name: 'Default', isDefault: true },
    ]);
    vi.spyOn(db.watchlists, 'toArray').mockResolvedValue([]);

    const addAccountSpy = vi.spyOn(db.accounts, 'add').mockResolvedValue(2);
    const addFundSpy = vi.spyOn(db.funds, 'add').mockResolvedValue(1);

    const legacyBackup = {
      version: 1,
      exportDate: '2026-03-20T00:00:00.000Z',
      funds: [
        {
          code: '000001',
          name: '测试基金',
          platform: '券商B',
          holdingShares: 100,
          costPrice: 1,
          currentNav: 1,
          lastUpdate: '2026-03-20',
          dayChangePct: 0,
          dayChangeVal: 0,
        },
      ],
      watchlists: [],
    };

    const result = await importFundsFromBackupContent(JSON.stringify(legacyBackup));

    expect(addAccountSpy).toHaveBeenCalledTimes(1);
    expect(addAccountSpy).toHaveBeenCalledWith(expect.objectContaining({ name: '券商B' }));
    expect(addFundSpy).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ added: 2, skipped: 0 });
  });

  it('overwrites existing fund when gist strategy is overwriteIfDifferent', async () => {
    vi.spyOn(db.accounts, 'toArray').mockResolvedValue([
      { id: 1, name: '券商A', isDefault: false },
    ]);
    vi.spyOn(db.watchlists, 'toArray').mockResolvedValue([]);
    vi.spyOn(db.funds, 'toArray').mockResolvedValue([
      {
        id: 1,
        code: '000001',
        name: '测试基金',
        platform: '券商A',
        holdingShares: 100,
        costPrice: 1,
        currentNav: 1,
        lastUpdate: '2026-03-20',
        dayChangePct: 0,
        dayChangeVal: 0,
      },
    ]);

    const addFundSpy = vi.spyOn(db.funds, 'add').mockResolvedValue(2);
    const updateFundSpy = vi.spyOn(db.funds, 'update').mockResolvedValue(1);

    const incoming = {
      version: 1,
      exportDate: '2026-03-21T00:00:00.000Z',
      funds: [
        {
          code: '000001',
          name: '测试基金',
          platform: '券商A',
          holdingShares: 200,
          costPrice: 1.2,
          currentNav: 1.3,
          lastUpdate: '2026-03-21',
          dayChangePct: 1,
          dayChangeVal: 2,
        },
      ],
      accounts: [],
      watchlists: [],
    };

    const result = await importFundsFromBackupContent(JSON.stringify(incoming), {
      duplicateFundStrategy: 'overwriteIfDifferent',
    });

    expect(addFundSpy).not.toHaveBeenCalled();
    expect(updateFundSpy).toHaveBeenCalledTimes(1);
    expect(updateFundSpy).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        code: '000001',
        platform: '券商A',
        holdingShares: 200,
      }),
    );
    expect(result).toEqual({ added: 0, skipped: 0 });
  });
});
