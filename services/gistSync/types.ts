export const GIST_SYNC_FILENAME = 'fund-manager-sync.json' as const;
export const GIST_DESCRIPTION_MAX_LENGTH = 25;

export type GistSyncUploadMode = 'create' | 'overwrite';
export type GistUploadMode = GistSyncUploadMode;

export type TokenFormatInvalidReason =
  | 'EMPTY'
  | 'TOO_SHORT'
  | 'INVALID_CHARACTERS'
  | 'UNSUPPORTED_PREFIX';

export interface TokenFormatValidationResult {
  isValid: boolean;
  normalizedToken: string;
  reason?: TokenFormatInvalidReason;
}

export type TokenValidationResult = TokenFormatValidationResult;

export interface GithubUser {
  id: number;
  login: string;
}

export interface GistFileSummary {
  filename: string;
  size?: number;
  language?: string | null;
  type?: string;
  raw_url?: string;
  truncated?: boolean;
  content?: string;
}

export interface GistListItem {
  id: string;
  description: string;
  updated_at: string;
  hasSyncFile: boolean;
  isBackupValid?: boolean;
  files: Record<string, GistFileSummary>;
}

export type GistClientErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION_FAILED'
  | 'UNPROCESSABLE'
  | 'NOT_FOUND'
  | 'NETWORK_ERROR'
  | 'SYNC_FILE_NOT_FOUND'
  | 'UNKNOWN_ERROR';
