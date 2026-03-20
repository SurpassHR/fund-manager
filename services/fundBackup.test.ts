import { describe, expect, it } from 'vitest';
import type { Account, Fund, WatchlistItem } from '../types';
import {
  buildFundBackupPayload,
  buildFundBackupKey,
  findDuplicateFundBackupKeys,
  parseAndNormalizeFundBackup,
  parseAndNormalizeFundBackupPayload,
} from './fundBackup';

const buildFund = (overrides?: Partial<Fund>): Fund => ({
  code: '000001',
  name: '测试基金',
  platform: '天天基金',
  holdingShares: 100,
  costPrice: 1.23,
  currentNav: 1.25,
  lastUpdate: '2026-03-19',
  dayChangePct: 0.5,
  dayChangeVal: 2,
  ...overrides,
});

const buildWatchlist = (overrides?: Partial<WatchlistItem>): WatchlistItem => ({
  code: '000300',
  name: '沪深300',
  type: 'index',
  anchorPrice: 1000,
  anchorDate: '2026-03-19',
  currentPrice: 1005,
  dayChangePct: 0.5,
  lastUpdate: '2026-03-19',
  ...overrides,
});

const buildAccount = (overrides?: Partial<Account>): Account => ({
  name: 'Default',
  isDefault: true,
  ...overrides,
});

describe('fundBackup', () => {
  it('构建与解析合法 payload', () => {
    const payload = buildFundBackupPayload([buildFund()], '2026-03-19T00:00:00.000Z');
    const normalized = parseAndNormalizeFundBackup(payload);

    expect(payload.version).toBe(1);
    expect(payload.exportDate).toBe('2026-03-19T00:00:00.000Z');
    expect(normalized).toHaveLength(1);
    expect(normalized[0]?.code).toBe('000001');
  });

  it('缺失字段时抛出可识别错误', () => {
    const malformed = {
      version: 1,
      exportDate: '2026-03-19T00:00:00.000Z',
      funds: [
        {
          code: '000001',
          platform: '天天基金',
        },
      ],
    };

    expect(() => parseAndNormalizeFundBackup(malformed)).toThrowError('无效的备份文件格式');
  });

  it('识别重复基金 key', () => {
    const funds = [
      buildFund({ code: '000001', platform: 'A' }),
      buildFund({ code: '000001', platform: 'A' }),
      buildFund({ code: '000001', platform: 'B' }),
    ];

    const duplicated = findDuplicateFundBackupKeys(funds);

    expect(duplicated).toEqual([buildFundBackupKey({ code: '000001', platform: 'A' })]);
  });

  it('导出与导入归一化都清理 id 字段', () => {
    const withId = buildFund({ id: 88 });
    const payload = buildFundBackupPayload([withId], '2026-03-19T00:00:00.000Z');

    expect('id' in payload.funds[0]).toBe(false);

    const normalized = parseAndNormalizeFundBackup({
      version: 1,
      exportDate: '2026-03-19T00:00:00.000Z',
      funds: [{ ...withId }],
    });

    expect('id' in normalized[0]).toBe(false);
  });

  it('支持在备份中携带自选基金并保持向后兼容', () => {
    const payload = buildFundBackupPayload(
      [buildFund()],
      '2026-03-19T00:00:00.000Z',
      [buildAccount({ id: 7 })],
      [buildWatchlist({ id: 9, platform: '天天基金', type: 'fund', code: '110011' })],
    );

    const normalized = parseAndNormalizeFundBackupPayload(payload);

    expect(normalized.accounts).toHaveLength(1);
    expect(normalized.accounts[0]?.name).toBe('Default');
    expect('id' in normalized.accounts[0]).toBe(false);
    expect(normalized.watchlists).toHaveLength(1);
    expect(normalized.watchlists[0]?.code).toBe('110011');
    expect(normalized.watchlists[0]?.platform).toBe('天天基金');
    expect('id' in normalized.watchlists[0]).toBe(false);

    const legacyPayload = {
      version: 1,
      exportDate: '2026-03-19T00:00:00.000Z',
      funds: [buildFund()],
    };

    expect(parseAndNormalizeFundBackup(legacyPayload)).toHaveLength(1);
    expect(parseAndNormalizeFundBackupPayload(legacyPayload).watchlists).toEqual([]);
  });
});
