export {
  createSyncGist,
  downloadSyncGistContent,
  GistClientError,
  listSyncGists,
  overwriteSyncGist,
  validateGithubTokenFormat,
  verifyGithubToken,
} from './client';

export {
  GIST_DESCRIPTION_MAX_LENGTH,
  GIST_SYNC_FILENAME,
  type GistClientErrorCode,
  type GistListItem,
  type GistSyncUploadMode,
  type TokenFormatValidationResult,
} from './types';

export { getBackupSyncTimestamp, isRemoteBackupNewer } from './metadata';
export {
  markGistSyncDataChanged,
  readLocalSyncTimestamp,
  writeLocalSyncTimestamp,
} from './autoSyncState';
