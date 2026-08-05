import { describe, expect, it, vi } from 'vitest';

import { fetchEastMoneyF10, fetchParentETFInfo, fetchParentETFPct } from '../api';

describe('ETF联接母基金解析', () => {
  it('通过 fetch 读取 F10 内容（替换旧的 script 注入方式）', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      // loadEastMoneyApiData 调用 fetch → 返回 var apidata=... 格式的文本
      return {
        ok: true,
        text: async () =>
          'var apidata=<table><tr><td>投资目标</td><td>本基金主要投资于嘉实中证稀土产业ETF(516150.SH)</td></tr></table>',
      };
    });

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const result = await fetchEastMoneyF10('024424');

    expect(result).toContain('嘉实中证稀土产业ETF');
    expect(result).toContain('516150.SH');
    expect(fetchMock).toHaveBeenCalledTimes(1);

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
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () =>
        'var apidata=<table><tr><td>投资目标</td><td>本基金主要投资于嘉实中证稀土产业ETF(516150.SH)</td></tr></table>',
    }));

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const result = await fetchParentETFInfo('991036', '某某ETF联接C');
    expect(result).toEqual({
      parentCode: '516150.SH',
      parentName: '嘉实中证稀土产业ETF',
    });

    vi.unstubAllGlobals();
  });

  it('QDII ETF联接基金命中手动映射', async () => {
    const result015311 = await fetchParentETFInfo(
      '015311',
      '华泰柏瑞南方东英恒生科技ETF联接(QDII)C',
    );
    expect(result015311).toEqual({
      parentCode: '513180.SH',
      parentName: '华泰柏瑞南方东英恒生科技ETF',
    });

    const result006328 = await fetchParentETFInfo(
      '006328',
      '易方达中证海外中国互联网50ETF联接(QDII)C(人民币份额)',
    );
    expect(result006328).toEqual({
      parentCode: '513050.SH',
      parentName: '易方达中证海外中国互联网50ETF',
    });
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