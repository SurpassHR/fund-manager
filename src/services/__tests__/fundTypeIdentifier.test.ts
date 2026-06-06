import { describe, expect, it } from 'vitest';
import { identifyFundType } from '../fundTypeIdentifier';
import type { FundCategory, UnderlyingMarket } from '../../types';

describe('identifyFundType', () => {
  const classify = (params: {
    code: string;
    name?: string;
    morningstarCategory?: string;
    fundType?: string;
  }): { category: FundCategory; underlyingMarket: UnderlyingMarket } => identifyFundType(params);

  // QDII by code prefix
  it('classifies 16xxxx code as QDII', () => {
    const result = classify({ code: '160213' });
    expect(result.category).toBe('QDII');
  });

  it('classifies 16xxxx code as QDII with US underlying when name suggests US', () => {
    const result = classify({ code: '160213', name: '国泰纳斯达克100' });
    expect(result.category).toBe('QDII');
    expect(result.underlyingMarket).toBe('US');
  });

  it('classifies 16xxxx code as QDII with GLOBAL when name suggests global', () => {
    const result = classify({ code: '163813', name: '南方全球精选' });
    expect(result.category).toBe('QDII');
    expect(result.underlyingMarket).toBe('GLOBAL');
  });

  // QDII by name
  it('classifies fund with QDII in name', () => {
    const result = classify({ code: '001234', name: '华夏QDII全球股票' });
    expect(result.category).toBe('QDII');
  });

  // HK by name
  it('classifies HK fund by name keyword 港股', () => {
    const result = classify({ code: '000071', name: '恒生港股通精选' });
    expect(result.category).toBe('HK');
    expect(result.underlyingMarket).toBe('HK');
  });

  it('classifies HK fund by name keyword 恒生', () => {
    const result = classify({ code: '002345', name: '易方达恒生中国企业' });
    expect(result.category).toBe('HK');
    expect(result.underlyingMarket).toBe('HK');
  });

  // US by name keywords
  it('classifies US underlying by name keyword 纳斯达克', () => {
    const result = classify({ code: '160213', name: '国泰纳斯达克100' });
    expect(result.underlyingMarket).toBe('US');
  });

  it('classifies US underlying by name keyword 标普', () => {
    const result = classify({ code: '000834', name: '大成标普500等权重' });
    expect(result.underlyingMarket).toBe('US');
  });

  it('classifies US underlying by name keyword 美国', () => {
    const result = classify({ code: '162411', name: '华宝美国消费' });
    expect(result.underlyingMarket).toBe('US');
  });

  it('classifies US underlying by name keyword 道琼斯', () => {
    const result = classify({ code: '513400', name: '道琼斯工业平均ETF' });
    expect(result.underlyingMarket).toBe('US');
  });

  // Morningstar category
  it('uses Morningstar category QDII美国股票', () => {
    const result = classify({
      code: '000001',
      name: '某基金',
      morningstarCategory: 'QDII美国股票',
    });
    expect(result.category).toBe('QDII');
    expect(result.underlyingMarket).toBe('US');
  });

  it('uses Morningstar category 沪港深股票', () => {
    const result = classify({
      code: '000001',
      name: '某基金',
      morningstarCategory: '沪港深股票',
    });
    expect(result.category).toBe('HK');
    expect(result.underlyingMarket).toBe('HK');
  });

  it('uses Morningstar category QDII环球股票', () => {
    const result = classify({
      code: '000001',
      name: '某基金',
      morningstarCategory: 'QDII环球股票',
    });
    expect(result.category).toBe('QDII');
    expect(result.underlyingMarket).toBe('GLOBAL');
  });

  // ETF
  it('classifies 5xxxxx code as ETF', () => {
    const result = classify({ code: '510050', name: '华夏上证50ETF' });
    expect(result.category).toBe('ETF');
    expect(result.underlyingMarket).toBe('CN');
  });

  // ETF_LINK
  it('classifies ETF联接 as ETF_LINK', () => {
    const result = classify({ code: '001234', name: '嘉实中证500ETF联接' });
    expect(result.category).toBe('ETF_LINK');
  });

  // Default DOMESTIC
  it('defaults to DOMESTIC for 6-digit CN fund', () => {
    const result = classify({ code: '000001', name: '华夏成长' });
    expect(result.category).toBe('DOMESTIC');
    expect(result.underlyingMarket).toBe('CN');
  });

  // Unknown
  it('returns UNKNOWN for unrecognized fund', () => {
    const result = classify({ code: 'ABC' });
    expect(result.category).toBe('UNKNOWN');
    expect(result.underlyingMarket).toBe('CN');
  });

  // Empty input
  it('handles empty name gracefully', () => {
    const result = classify({ code: '160213' });
    expect(result.category).toBe('QDII');
    expect(result.underlyingMarket).toBe('US');
  });

  // HK + QDII combo
  it('resolves QDII when both QDII and HK keywords present', () => {
    // QDII 优先级高于 HK（因为名称中 QDII 先匹配）
    const result = classify({ code: '001691', name: '南方香港QDII' });
    expect(result.category).toBe('QDII');
    expect(result.underlyingMarket).toBe('HK');
  });
});
