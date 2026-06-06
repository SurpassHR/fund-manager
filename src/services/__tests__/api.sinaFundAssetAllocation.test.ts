import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchSinaFundAssetAllocation } from '../api';

describe('fetchSinaFundAssetAllocation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses equity cash and other allocation from Sina JSONP callback rows', async () => {
    const appendSpy = vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      if (node instanceof HTMLScriptElement) {
        const callbackName = new URL(node.src).searchParams.get('callback');
        expect(callbackName).toMatch(/^__sinaFundTopHold_/);
        setTimeout(() => {
          (window as Window & Record<string, (value: unknown) => void>)[callbackName!]({
          result: {
            status: { code: 0 },
            data: {
              zcpz: [
                { name: 'TOTFDNAV', value: '17994150868.8900', ENDDATE: '20260331' },
                { name: '权益类（股票与存托凭证等）', value: '67.4400' },
                { name: '银行存款和结算备付金', value: '36.5200' },
                { name: '其他投资', value: '1.6800' },
              ],
            },
          },
          });
          node.onload?.(new Event('load'));
        });
      }
      return node;
    });

    const result = await fetchSinaFundAssetAllocation('025208', { force: true });

    expect(result).toEqual({
      equityPct: 67.44,
      cashPct: 36.52,
      otherPct: 1.68,
      asOfDate: '2026-03-31',
    });
    expect(appendSpy).toHaveBeenCalled();
    const script = appendSpy.mock.calls[0]?.[0] as HTMLScriptElement;
    expect(script.src).toContain('symbol=025208');
  });

  it('returns null when Sina JSONP response misses zcpz allocation rows', async () => {
    vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      if (node instanceof HTMLScriptElement) {
        const callbackName = new URL(node.src).searchParams.get('callback');
        setTimeout(() => {
          (window as Window & Record<string, (value: unknown) => void>)[callbackName!]({
            result: { status: { code: 0 }, data: { zcpz: [] } },
          });
          node.onload?.(new Event('load'));
        });
      }
      return node;
    });

    await expect(fetchSinaFundAssetAllocation('025208', { force: true })).resolves.toBeNull();
  });
});
