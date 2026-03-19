import { describe, expect, it } from 'vitest';
import type { Fund } from '../types';
import {
  buildFundBackupPayload,
  buildFundBackupKey,
  findDuplicateFundBackupKeys,
  parseAndNormalizeFundBackup,
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
});
