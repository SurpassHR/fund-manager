import { describe, expect, it } from 'vitest';

import { ETF_LINK_PARENT_MAP, inferParentEtfName, isEtfLinkFundName } from '../constants';

describe('isEtfLinkFundName', () => {
  it('识别标准 ETF 联接基金名称', () => {
    expect(isEtfLinkFundName('嘉实中证稀土产业ETF联接C')).toBe(true);
    expect(isEtfLinkFundName('嘉实中证稀土产业ETF联接A')).toBe(true);
    expect(isEtfLinkFundName('天弘中证光伏产业指数ETF联接C')).toBe(true);
  });

  it('识别 QDII ETF 联接基金名称', () => {
    expect(isEtfLinkFundName('华泰柏瑞南方东英恒生科技ETF联接(QDII)C')).toBe(true);
    expect(isEtfLinkFundName('易方达中证海外中国互联网50ETF联接(QDII)C(人民币份额)')).toBe(true);
    expect(isEtfLinkFundName('广发纳斯达克100ETF联接(QDII)C')).toBe(true);
    expect(isEtfLinkFundName('华夏纳斯达克100ETF联接(QDII)A(人民币)')).toBe(true);
  });

  it('识别使用中文括号的 QDII ETF 联接基金名称', () => {
    expect(isEtfLinkFundName('华泰柏瑞南方东英恒生科技ETF联接（QDII）C')).toBe(true);
    expect(isEtfLinkFundName('易方达中证海外中国互联网50ETF联接（QDII）C(人民币份额)')).toBe(true);
  });

  it('识别使用"连接"而非"联接"的基金名称', () => {
    expect(isEtfLinkFundName('某某ETF连接C')).toBe(true);
  });

  it('非 ETF 联接基金名称返回 false', () => {
    expect(isEtfLinkFundName('华泰柏瑞南方东英恒生科技ETF')).toBe(false);
    expect(isEtfLinkFundName('沪深300指数')).toBe(false);
    expect(isEtfLinkFundName('')).toBe(false);
    expect(isEtfLinkFundName(undefined)).toBe(false);
  });
});

describe('inferParentEtfName', () => {
  it('从标准 ETF 联接基金名称推断母 ETF 名称', () => {
    expect(inferParentEtfName('嘉实中证稀土产业ETF联接C')).toBe('嘉实中证稀土产业ETF');
    expect(inferParentEtfName('嘉实中证稀土产业ETF联接A')).toBe('嘉实中证稀土产业ETF');
    expect(inferParentEtfName('天弘中证光伏产业指数ETF联接C')).toBe('天弘中证光伏产业指数ETF');
  });

  it('从 QDII ETF 联接基金名称推断母 ETF 名称（英文括号）', () => {
    expect(inferParentEtfName('华泰柏瑞南方东英恒生科技ETF联接(QDII)C')).toBe(
      '华泰柏瑞南方东英恒生科技ETF',
    );
    expect(inferParentEtfName('易方达中证海外中国互联网50ETF联接(QDII)C(人民币份额)')).toBe(
      '易方达中证海外中国互联网50ETF',
    );
    expect(inferParentEtfName('广发纳斯达克100ETF联接(QDII)C')).toBe('广发纳斯达克100ETF');
    expect(inferParentEtfName('华夏纳斯达克100ETF联接(QDII)A(人民币)')).toBe('华夏纳斯达克100ETF');
  });

  it('从 QDII ETF 联接基金名称推断母 ETF 名称（中文括号）', () => {
    expect(inferParentEtfName('华泰柏瑞南方东英恒生科技ETF联接（QDII）C')).toBe(
      '华泰柏瑞南方东英恒生科技ETF',
    );
    expect(inferParentEtfName('易方达中证海外中国互联网50ETF联接（QDII）C(人民币份额)')).toBe(
      '易方达中证海外中国互联网50ETF',
    );
  });

  it('从使用"连接"的基金名称推断', () => {
    expect(inferParentEtfName('嘉实中证稀土产业ETF连接C')).toBe('嘉实中证稀土产业ETF');
  });

  it('非 ETF 联接基金名称返回 null', () => {
    expect(inferParentEtfName('华泰柏瑞南方东英恒生科技ETF')).toBeNull();
    expect(inferParentEtfName('沪深300指数')).toBeNull();
    expect(inferParentEtfName('')).toBeNull();
    expect(inferParentEtfName(undefined)).toBeNull();
  });
});

describe('ETF_LINK_PARENT_MAP', () => {
  it('包含华泰柏瑞南方东英恒生科技 ETF 联接(QDII)映射', () => {
    expect(ETF_LINK_PARENT_MAP['015310']).toEqual({
      parentCode: '513180.SH',
      parentName: '华泰柏瑞南方东英恒生科技ETF',
    });
    expect(ETF_LINK_PARENT_MAP['015311']).toEqual({
      parentCode: '513180.SH',
      parentName: '华泰柏瑞南方东英恒生科技ETF',
    });
  });

  it('包含易方达中证海外中国互联网50 ETF 联接(QDII)映射', () => {
    expect(ETF_LINK_PARENT_MAP['006327']).toEqual({
      parentCode: '513050.SH',
      parentName: '易方达中证海外中国互联网50ETF',
    });
    expect(ETF_LINK_PARENT_MAP['006328']).toEqual({
      parentCode: '513050.SH',
      parentName: '易方达中证海外中国互联网50ETF',
    });
  });

  it('保留原有的嘉实中证稀土产业 ETF 联接映射', () => {
    expect(ETF_LINK_PARENT_MAP['011035']).toEqual({
      parentCode: '516150.SH',
      parentName: '嘉实中证稀土产业ETF',
    });
    expect(ETF_LINK_PARENT_MAP['011036']).toEqual({
      parentCode: '516150.SH',
      parentName: '嘉实中证稀土产业ETF',
    });
  });
});
