export type BackupSyncTimestampSource = 'syncUpdatedAt' | 'exportDate' | 'fallback';

export interface BackupSyncTimestamp {
  timestamp: string;
  source: BackupSyncTimestampSource;
}

const isValidTimestamp = (value: unknown): value is string => {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
};

export const getBackupSyncTimestamp = (
  content: string | unknown,
  fallbackTimestamp?: string | null,
): BackupSyncTimestamp | null => {
  let parsed: unknown;
  try {
    parsed = typeof content === 'string' ? JSON.parse(content) : content;
  } catch {
    return isValidTimestamp(fallbackTimestamp)
      ? { timestamp: fallbackTimestamp, source: 'fallback' }
      : null;
  }

  if (parsed && typeof parsed === 'object') {
    const payload = parsed as Record<string, unknown>;
    if (isValidTimestamp(payload.syncUpdatedAt)) {
      return { timestamp: payload.syncUpdatedAt, source: 'syncUpdatedAt' };
    }
    if (isValidTimestamp(payload.exportDate)) {
      return { timestamp: payload.exportDate, source: 'exportDate' };
    }
  }

  if (isValidTimestamp(fallbackTimestamp)) {
    return { timestamp: fallbackTimestamp, source: 'fallback' };
  }

  return null;
};

export const isRemoteBackupNewer = (
  remoteTimestamp: string | null | undefined,
  localTimestamp: string | null | undefined,
): boolean => {
  if (!isValidTimestamp(remoteTimestamp)) return false;
  if (!isValidTimestamp(localTimestamp)) return true;
  return Date.parse(remoteTimestamp) > Date.parse(localTimestamp);
};
