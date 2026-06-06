import { describe, expect, it } from 'vitest';
import { validateSyncPayload } from '../gistSync';

describe('validateSyncPayload', () => {
  it('accepts valid payload', () => {
    const payload = {
      schemaVersion: 1,
      exportedAt: '2026-03-19T00:00:00.000Z',
      app: 'fund-manager',
      payload: {
        funds: [],
        accounts: [],
        watchlists: [],
      },
    };
    expect(validateSyncPayload(payload)).toBe(true);
  });

  it('rejects invalid schema version', () => {
    const payload = {
      schemaVersion: 2,
      exportedAt: '2026-03-19T00:00:00.000Z',
      app: 'fund-manager',
      payload: {
        funds: [],
        accounts: [],
        watchlists: [],
      },
    };
    expect(validateSyncPayload(payload)).toBe(false);
  });

  it('rejects missing arrays', () => {
    const payload = {
      schemaVersion: 1,
      exportedAt: '2026-03-19T00:00:00.000Z',
      app: 'fund-manager',
      payload: {
        funds: [],
      },
    };
    expect(validateSyncPayload(payload)).toBe(false);
  });
});
