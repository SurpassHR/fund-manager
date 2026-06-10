import { describe, expect, it } from 'vitest';
import { getBackupSyncTimestamp, isRemoteBackupNewer } from '../metadata';

describe('gistSync metadata', () => {
  it('优先读取新同步格式中的 syncUpdatedAt', () => {
    const content = JSON.stringify({
      version: 1,
      exportDate: '2026-06-09T01:00:00.000Z',
      syncUpdatedAt: '2026-06-09T02:00:00.000Z',
      funds: [],
    });

    expect(getBackupSyncTimestamp(content)).toEqual({
      timestamp: '2026-06-09T02:00:00.000Z',
      source: 'syncUpdatedAt',
    });
  });

  it('兼容旧同步文件，缺少 syncUpdatedAt 时回退到 exportDate', () => {
    const content = JSON.stringify({
      version: 1,
      exportDate: '2026-06-08T23:30:00.000Z',
      funds: [],
    });

    expect(getBackupSyncTimestamp(content)).toEqual({
      timestamp: '2026-06-08T23:30:00.000Z',
      source: 'exportDate',
    });
  });

  it('仅当远端时间戳较新时允许覆盖本地', () => {
    expect(
      isRemoteBackupNewer('2026-06-09T02:00:00.000Z', '2026-06-09T01:59:59.000Z'),
    ).toBe(true);
    expect(
      isRemoteBackupNewer('2026-06-09T02:00:00.000Z', '2026-06-09T02:00:00.000Z'),
    ).toBe(false);
    expect(
      isRemoteBackupNewer('2026-06-09T01:00:00.000Z', '2026-06-09T02:00:00.000Z'),
    ).toBe(false);
  });
});
