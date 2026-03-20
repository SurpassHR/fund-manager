import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GistClientError,
  createSyncGist,
  listSyncGists,
  validateGithubTokenFormat,
  verifyGithubToken,
} from './client';
import { GIST_SYNC_FILENAME } from './types';

const mockedFetch = vi.fn();

const mockJsonResponse = (status: number, data: unknown): Response => {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn(async () => data),
    text: vi.fn(async () => JSON.stringify(data)),
  } as unknown as Response;
};

describe('gistSync/client', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
    vi.stubGlobal('fetch', mockedFetch);
  });

  it('validates token format heuristically', () => {
    expect(validateGithubTokenFormat('ghp_abcdefghijklmnopqrstuvwxyz1234567890')).toMatchObject({
      isValid: true,
    });

    expect(validateGithubTokenFormat('')).toMatchObject({
      isValid: false,
      reason: 'EMPTY',
    });

    expect(validateGithubTokenFormat('invalid token with space')).toMatchObject({
      isValid: false,
    });
  });

  it('filters gists by fixed sync filename and sorts by updated_at desc', async () => {
    mockedFetch.mockResolvedValue(
      mockJsonResponse(200, [
        {
          id: 'a',
          description: 'older matched',
          updated_at: '2026-01-01T00:00:00Z',
          files: {
            [GIST_SYNC_FILENAME]: { filename: GIST_SYNC_FILENAME, size: 10 },
          },
        },
        {
          id: 'b',
          description: 'ignored',
          updated_at: '2026-01-03T00:00:00Z',
          files: {
            'another.json': { filename: 'another.json', size: 10 },
          },
        },
        {
          id: 'c',
          description: 'newer matched',
          updated_at: '2026-01-02T00:00:00Z',
          files: {
            [GIST_SYNC_FILENAME]: { filename: GIST_SYNC_FILENAME, size: 10 },
          },
        },
      ]),
    );

    const gists = await listSyncGists('ghp_abcdefghijklmnopqrstuvwxyz1234567890');

    expect(gists).toHaveLength(2);
    expect(gists.map((item) => item.id)).toEqual(['c', 'a']);
    expect(gists.every((item) => item.hasSyncFile)).toBe(true);
    expect(mockedFetch).toHaveBeenCalledWith(
      'https://api.github.com/gists',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('maps 401/403/422 and network errors to typed client error', async () => {
    mockedFetch.mockResolvedValueOnce(mockJsonResponse(401, { message: 'bad credentials' }));
    await expect(
      verifyGithubToken('ghp_abcdefghijklmnopqrstuvwxyz1234567890'),
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });

    mockedFetch.mockResolvedValueOnce(mockJsonResponse(403, { message: 'forbidden' }));
    await expect(listSyncGists('ghp_abcdefghijklmnopqrstuvwxyz1234567890')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    mockedFetch.mockResolvedValueOnce(mockJsonResponse(422, { message: 'unprocessable' }));
    await expect(
      createSyncGist({
        token: 'ghp_abcdefghijklmnopqrstuvwxyz1234567890',
        content: '{"hello":"world"}',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });

    mockedFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const networkError = await listSyncGists('ghp_abcdefghijklmnopqrstuvwxyz1234567890').catch(
      (error) => error,
    );
    expect(networkError).toBeInstanceOf(GistClientError);
    expect(networkError).toMatchObject({ code: 'NETWORK_ERROR' });
  });
});
