export const GIST_AUTO_SYNC_DATA_CHANGED_EVENT = 'fund-manager:gist-sync-data-changed';
export const GIST_SYNC_LOCAL_UPDATED_AT_KEY = 'gistSync.localUpdatedAt.v1';

export type GistSyncChangeReason =
  | 'holding'
  | 'adjust-position'
  | 'rebalance'
  | 'watchlist'
  | 'investment-plan'
  | 'scanner-import';

const isValidTimestamp = (value: unknown): value is string => {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
};

export const readLocalSyncTimestamp = (): string | null => {
  if (typeof localStorage === 'undefined') return null;
  const value = localStorage.getItem(GIST_SYNC_LOCAL_UPDATED_AT_KEY);
  return isValidTimestamp(value) ? value : null;
};

export const writeLocalSyncTimestamp = (timestamp: string): void => {
  if (!isValidTimestamp(timestamp) || typeof localStorage === 'undefined') return;
  localStorage.setItem(GIST_SYNC_LOCAL_UPDATED_AT_KEY, timestamp);
};

export const markGistSyncDataChanged = (
  reason: GistSyncChangeReason,
  timestamp = new Date().toISOString(),
): void => {
  writeLocalSyncTimestamp(timestamp);

  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(GIST_AUTO_SYNC_DATA_CHANGED_EVENT, {
      detail: { reason, timestamp },
    }),
  );
};
