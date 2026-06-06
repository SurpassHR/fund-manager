import {
  GIST_SYNC_FILENAME,
  type GistClientErrorCode,
  type GistListItem,
  type GithubUser,
  type TokenFormatValidationResult,
} from './types';
import { parseAndNormalizeFundBackup } from '../fundBackup';

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_API_VERSION = '2022-11-28';

type GithubGistResponse = {
  id: string;
  description: string | null;
  updated_at: string;
  files?: Record<
    string,
    {
      filename?: string;
      size?: number;
      language?: string | null;
      type?: string;
      raw_url?: string;
      truncated?: boolean;
      content?: string;
    }
  >;
};

type GithubApiErrorBody = {
  message?: string;
};

export class GistClientError extends Error {
  code: GistClientErrorCode;
  status?: number;

  constructor(params: { code: GistClientErrorCode; message: string; status?: number }) {
    super(params.message);
    this.name = 'GistClientError';
    this.code = params.code;
    this.status = params.status;
  }
}

const buildGithubHeaders = (token: string): HeadersInit => ({
  Accept: 'application/vnd.github+json',
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
  'X-GitHub-Api-Version': GITHUB_API_VERSION,
});

const mapStatusToCode = (status: number): GistClientErrorCode => {
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 422) return 'VALIDATION_FAILED';
  return 'UNKNOWN_ERROR';
};

const safeParseErrorMessage = async (response: Response): Promise<string> => {
  try {
    const data = (await response.json()) as GithubApiErrorBody;
    if (typeof data.message === 'string' && data.message.trim()) {
      return data.message;
    }
  } catch {
    // ignore JSON parse error
  }

  try {
    const text = await response.text();
    return text || 'GitHub API request failed';
  } catch {
    return 'GitHub API request failed';
  }
};

const githubRequest = async <T>(params: {
  path: string;
  token: string;
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
}): Promise<T> => {
  const { path, token, method = 'GET', body } = params;
  try {
    const response = await fetch(`${GITHUB_API_BASE}${path}`, {
      method,
      cache: 'no-store',
      headers: buildGithubHeaders(token),
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const message = await safeParseErrorMessage(response);
      throw new GistClientError({
        code: mapStatusToCode(response.status),
        status: response.status,
        message,
      });
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof GistClientError) {
      throw error;
    }

    throw new GistClientError({
      code: 'NETWORK_ERROR',
      message: error instanceof Error ? error.message : 'Network request failed',
    });
  }
};

const mapGistListItem = (gist: GithubGistResponse): GistListItem => {
  const files = Object.entries(gist.files || {}).reduce<NonNullable<GistListItem['files']>>(
    (acc, [fileKey, fileValue]) => {
      acc[fileKey] = {
        filename: fileValue.filename || fileKey,
        size: fileValue.size,
        language: fileValue.language,
        type: fileValue.type,
        raw_url: fileValue.raw_url,
        truncated: fileValue.truncated,
        content: fileValue.content,
      };
      return acc;
    },
    {},
  );
  return {
    id: gist.id,
    description: gist.description || '',
    updated_at: gist.updated_at,
    hasSyncFile: Boolean(files[GIST_SYNC_FILENAME]),
    files,
  };
};

const isValidBackupContent = (content: string) => {
  try {
    parseAndNormalizeFundBackup(content);
    return true;
  } catch {
    return false;
  }
};

const resolveSyncFileContent = async (token: string, gistId: string) => {
  const gist = await githubRequest<GithubGistResponse>({
    path: `/gists/${gistId}`,
    token,
    method: 'GET',
  });

  const file = gist.files?.[GIST_SYNC_FILENAME];
  if (!file) {
    return null;
  }

  if (typeof file.content === 'string') {
    return file.content;
  }

  if (!file.raw_url) {
    return null;
  }

  const response = await fetch(file.raw_url, { cache: 'no-store' });
  if (!response.ok) {
    throw new GistClientError({
      code: mapStatusToCode(response.status),
      status: response.status,
      message: await safeParseErrorMessage(response),
    });
  }
  return response.text();
};

export const validateGithubTokenFormat = (token: string): TokenFormatValidationResult => {
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    return {
      isValid: false,
      normalizedToken,
      reason: 'EMPTY',
    };
  }

  if (normalizedToken.length < 20) {
    return {
      isValid: false,
      normalizedToken,
      reason: 'TOO_SHORT',
    };
  }

  if (/\s/.test(normalizedToken) || !/^[A-Za-z0-9_]+$/.test(normalizedToken)) {
    return {
      isValid: false,
      normalizedToken,
      reason: 'INVALID_CHARACTERS',
    };
  }

  const supportedPrefix =
    normalizedToken.startsWith('ghp_') ||
    normalizedToken.startsWith('github_pat_') ||
    normalizedToken.startsWith('gho_') ||
    normalizedToken.startsWith('ghu_') ||
    normalizedToken.startsWith('ghs_') ||
    normalizedToken.startsWith('ghr_');

  if (!supportedPrefix) {
    return {
      isValid: false,
      normalizedToken,
      reason: 'UNSUPPORTED_PREFIX',
    };
  }

  return {
    isValid: true,
    normalizedToken,
  };
};

export const verifyGithubToken = async (token: string): Promise<GithubUser> => {
  return await githubRequest<GithubUser>({
    path: '/user',
    token,
    method: 'GET',
  });
};

export const listSyncGists = async (token: string): Promise<GistListItem[]> => {
  const allGists = await githubRequest<GithubGistResponse[]>({
    path: '/gists',
    token,
    method: 'GET',
  });

  const matched = allGists
    .map(mapGistListItem)
    .filter((item) => item.hasSyncFile)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  return Promise.all(
    matched.map(async (item) => {
      try {
        const content = await resolveSyncFileContent(token, item.id);
        if (!content) {
          return { ...item, isBackupValid: false };
        }
        return { ...item, isBackupValid: isValidBackupContent(content) };
      } catch {
        return { ...item, isBackupValid: false };
      }
    }),
  );
};

export const downloadSyncGistContent = async (params: {
  token: string;
  gistId: string;
}): Promise<string> => {
  const { token, gistId } = params;
  const gist = await githubRequest<GithubGistResponse>({
    path: `/gists/${gistId}`,
    token,
    method: 'GET',
  });

  const file = gist.files?.[GIST_SYNC_FILENAME];
  if (!file) {
    throw new GistClientError({
      code: 'SYNC_FILE_NOT_FOUND',
      message: `Gist does not contain ${GIST_SYNC_FILENAME}`,
    });
  }

  if (typeof file.content === 'string') {
    return file.content;
  }

  if (file.raw_url) {
    try {
      const response = await fetch(file.raw_url, {
        cache: 'no-store',
        headers: buildGithubHeaders(token),
      });

      if (!response.ok) {
        const message = await safeParseErrorMessage(response);
        throw new GistClientError({
          code: mapStatusToCode(response.status),
          status: response.status,
          message,
        });
      }

      return await response.text();
    } catch (error) {
      if (error instanceof GistClientError) throw error;
      throw new GistClientError({
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network request failed',
      });
    }
  }

  throw new GistClientError({
    code: 'SYNC_FILE_NOT_FOUND',
    message: `Gist file ${GIST_SYNC_FILENAME} has no readable content`,
  });
};

export const createSyncGist = async (params: {
  token: string;
  content: string;
  description?: string;
}): Promise<GistListItem> => {
  const { token, content, description = '' } = params;
  const gist = await githubRequest<GithubGistResponse>({
    path: '/gists',
    token,
    method: 'POST',
    body: {
      description,
      public: false,
      files: {
        [GIST_SYNC_FILENAME]: {
          content,
        },
      },
    },
  });

  return mapGistListItem(gist);
};

export const overwriteSyncGist = async (params: {
  token: string;
  gistId: string;
  content: string;
  description?: string;
}): Promise<GistListItem> => {
  const { token, gistId, content, description } = params;
  const gist = await githubRequest<GithubGistResponse>({
    path: `/gists/${gistId}`,
    token,
    method: 'PATCH',
    body: {
      ...(description !== undefined ? { description } : {}),
      files: {
        [GIST_SYNC_FILENAME]: {
          content,
        },
      },
    },
  });

  return mapGistListItem(gist);
};
