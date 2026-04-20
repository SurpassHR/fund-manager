import { describe, expect, it, vi } from 'vitest';

import { fetchEastMoneyF10, fetchParentETFInfo, fetchParentETFPct } from '../api';

describe('ETF联接母基金解析', () => {
  it('通过脚本注入读取 F10 内容，避免直接 fetch 跨站接口', async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('NetworkError when attempting to fetch resource.');
    });
    const appendSpy = vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      if (node instanceof HTMLScriptElement) {
        setTimeout(() => {
          (window as Window & { apidata?: { content?: string } }).apidata = {
            content:
              '<table><tr><td>投资目标</td><td>本基金主要投资于嘉实中证稀土产业ETF(516150.SH)</td></tr></table>',
          };
          node.onload?.(new Event('load'));
        });
      }
      return node;
    });

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const result = await fetchEastMoneyF10('024424');

    expect(result).toContain('嘉实中证稀土产业ETF');
    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect((window as Window & { apidata?: unknown }).apidata).toBeUndefined();

    appendSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('优先命中手动映射', async () => {
    const result = await fetchParentETFInfo('011036', '嘉实中证稀土产业ETF联接C');
    expect(result).toEqual({
      parentCode: '516150.SH',
      parentName: '嘉实中证稀土产业ETF',
    });
  });

  it('可从 F10 文本提取母ETF名称和代码', async () => {
    const appendSpy = vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      if (node instanceof HTMLScriptElement) {
        setTimeout(() => {
          (window as Window & { apidata?: { content?: string } }).apidata = {
            content:
              '<table><tr><td>投资目标</td><td>本基金主要投资于嘉实中证稀土产业ETF(516150.SH)</td></tr></table>',
          };
          node.onload?.(new Event('load'));
        });
      }
      return node;
    });

    const result = await fetchParentETFInfo('991036', '某某ETF联接C');
    expect(result).toEqual({
      parentCode: '516150.SH',
      parentName: '嘉实中证稀土产业ETF',
    });

    appendSpy.mockRestore();
  });

  it('可查询母ETF实时涨跌幅', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('qt.gtimg.cn')) {
        return {
          ok: true,
          text: async () => 'v_s_sh516150="51~嘉实中证稀土产业ETF~516150~0.900~0.895~0.56";',
        };
      }
      return { ok: false, text: async () => '' };
    });

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const pct = await fetchParentETFPct({
      parentCode: '516150.SH',
      parentName: '嘉实中证稀土产业ETF',
    });

    expect(pct).toBeCloseTo(0.56, 6);

    vi.unstubAllGlobals();
  });
});
