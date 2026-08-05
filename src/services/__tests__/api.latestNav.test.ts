import { describe, expect, it, vi } from 'vitest';

import { fetchEastMoneyLatestNav } from '../api';

describe('fetchEastMoneyLatestNav', () => {
  it('parses previous nav from the second row when latest nav is available', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () =>
        'var apidata=' +
        '<table>' +
        '<tr><td>2026-03-20</td><td>3.0710</td><td>3.0710</td><td>1.15%</td></tr>' +
        '<tr><td>2026-03-19</td><td>3.0360</td><td>3.0360</td><td>-0.12%</td></tr>' +
        '</table>',
    }));

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const result = await fetchEastMoneyLatestNav('000001', { force: true });

    expect(result).toEqual({
      navDate: '2026-03-20',
      nav: 3.071,
      navChangePercent: 1.15,
      previousNav: 3.036,
    });

    vi.unstubAllGlobals();
  });
});