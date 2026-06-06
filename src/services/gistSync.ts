import type { Account, Fund, WatchlistItem } from '../types';

const GITHUB_API_BASE = 'https://api.github.com';

export interface SyncPayload {
  schemaVersion: number;
  exportedAt: string;
  app: 'fund-manager';
  payload: {
    funds: Fund[];
    accounts: Account[];
    watchlists: WatchlistItem[];
  };
}

type GistFile = {
  filename: string;
  content?: string;
};

type GistResponse = {
  id: string;
  html_url: string;
  updated_at: string;
  owner?: { login?: string };
  files?: Record<string, GistFile>;
};

const parseGithubError = async (res: Response): Promise<string> => {
  let msg = `GitHub API error ${res.status}`;
  try {
    const body = (await res.json()) as { message?: string };
    if (body.message) msg = body.message;
  } catch {
    // ignore
  }
  return msg;
};

const requestGithub = async (url: string, token: string, init?: RequestInit) => {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    throw new Error(await parseGithubError(res));
  }
  return res;
};

export const validateSyncPayload = (raw: unknown): raw is SyncPayload => {
  if (!raw || typeof raw !== 'object') return false;
  const obj = raw as Record<string, unknown>;
  if (obj.schemaVersion !== 1) return false;
  if (obj.app !== 'fund-manager') return false;
  if (typeof obj.exportedAt !== 'string') return false;
  if (!obj.payload || typeof obj.payload !== 'object') return false;
  const payload = obj.payload as Record<string, unknown>;
  if (!Array.isArray(payload.funds)) return false;
  if (!Array.isArray(payload.accounts)) return false;
  if (!Array.isArray(payload.watchlists)) return false;
  return true;
};

export const testGistAuth = async (token: string): Promise<{ login: string }> => {
  const res = await requestGithub(`${GITHUB_API_BASE}/user`, token, { method: 'GET' });
  const user = (await res.json()) as { login?: string };
  return { login: user.login || '' };
};

export const pullFromGist = async ({
  token,
  gistId,
  fileName,
}: {
  token: string;
  gistId: string;
  fileName: string;
}): Promise<{ payload: SyncPayload; updatedAt: string }> => {
  const res = await requestGithub(`${GITHUB_API_BASE}/gists/${gistId}`, token, { method: 'GET' });
  const gist = (await res.json()) as GistResponse;
  const files = gist.files || {};
  const file = files[fileName] || Object.values(files)[0];
  if (!file || !file.content) {
    throw new Error('Sync file not found in gist');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(file.content);
  } catch {
    throw new Error('Invalid sync payload JSON');
  }

  if (!validateSyncPayload(parsed)) {
    throw new Error('Invalid sync payload format');
  }

  return {
    payload: parsed,
    updatedAt: gist.updated_at,
  };
};

export const pushToGist = async ({
  token,
  gistId,
  fileName,
  syncPayload,
}: {
  token: string;
  gistId?: string;
  fileName: string;
  syncPayload: SyncPayload;
}): Promise<{ gistId: string; url: string; updatedAt: string }> => {
  const content = JSON.stringify(syncPayload, null, 2);

  if (gistId) {
    const res = await requestGithub(`${GITHUB_API_BASE}/gists/${gistId}`, token, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: {
          [fileName]: { content },
        },
      }),
    });
    const gist = (await res.json()) as GistResponse;
    return {
      gistId: gist.id,
      url: gist.html_url,
      updatedAt: gist.updated_at,
    };
  }

  const createRes = await requestGithub(`${GITHUB_API_BASE}/gists`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      description: 'fund-manager sync payload',
      public: false,
      files: {
        [fileName]: { content },
      },
    }),
  });
  const gist = (await createRes.json()) as GistResponse;
  return {
    gistId: gist.id,
    url: gist.html_url,
    updatedAt: gist.updated_at,
  };
};
