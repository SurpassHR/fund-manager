/**
 * 指数名称到代码的映射表
 * 用于将基金跟踪的指数名称转换为可查询的指数代码
 *
 * 代码格式说明:
 * - 腾讯股票API格式: sh000001(上证), sz399001(深证), hk00700(港股)
 * - 境外指数使用通用代码: SPX(标普500), NDX(纳斯达克100), HSI(恒生指数)
 */
export const INDEX_CODE_MAP: Record<string, string> = {
  // 境内指数
  上证指数: 'sh000001',
  上证综指: 'sh000001',
  深证成指: 'sz399001',
  深证成份指数: 'sz399001',
  创业板指: 'sz399006',
  创业板指数: 'sz399006',
  沪深300: 'sh000300',
  沪深300指数: 'sh000300',
  中证500: 'sh000905',
  中证500指数: 'sh000905',
  中证1000: 'sh000852',
  中证1000指数: 'sh000852',
  上证50: 'sh000016',
  上证50指数: 'sh000016',
  科创50: 'sh000688',
  科创50指数: 'sh000688',

  // 美股指数
  标普500: 'SPX',
  标普500指数: 'SPX',
  'S&P500': 'SPX',
  'S&P 500': 'SPX',
  纳斯达克100: 'NDX',
  纳斯达克100指数: 'NDX',
  NASDAQ100: 'NDX',
  'NASDAQ 100': 'NDX',
  纳斯达克指数: 'IXIC',
  NASDAQ: 'IXIC',
  道琼斯: 'DJI',
  道琼斯指数: 'DJI',
  道琼斯工业平均指数: 'DJI',
  'Dow Jones': 'DJI',

  // 港股指数
  恒生指数: 'HSI',
  恒生: 'HSI',
  'Hang Seng': 'HSI',
  恒生科技: 'HSTECH',
  恒生科技指数: 'HSTECH',
  恒生中国企业: 'HSCEI',
  国企指数: 'HSCEI',

  // 其他境外指数
  日经225: 'N225',
  日经指数: 'N225',
  'Nikkei 225': 'N225',
  富时100: 'FTSE',
  'FTSE 100': 'FTSE',
  德国DAX: 'DAX',
  DAX: 'DAX',
};

/**
 * ETF 联接基金 -> 母 ETF 代码映射
 *
 * 说明：
 * - key: 联接基金代码
 * - value.parentCode: 母 ETF 代码（带交易所后缀）
 * - value.parentName: 母 ETF 名称（用于 UI/日志）
 */
export const ETF_LINK_PARENT_MAP: Record<string, { parentCode: string; parentName: string }> = {
  // 嘉实中证稀土产业 ETF 联接 A/C
  '011035': { parentCode: '516150.SH', parentName: '嘉实中证稀土产业ETF' },
  // 嘉实中证稀土产业 ETF 联接 C -> 嘉实中证稀土产业 ETF
  '011036': { parentCode: '516150.SH', parentName: '嘉实中证稀土产业ETF' },
};

/**
 * 判断是否为 ETF 联接基金名称
 */
export const isEtfLinkFundName = (fundName?: string): boolean => {
  if (!fundName) return false;
  const normalized = fundName.replace(/\s+/g, '');
  return /ETF[联连]接|[联连]接ETF|[联连]接[A-Z]?$/i.test(normalized);
};

/**
 * 从联接基金名称推断母 ETF 名称
 * 例如: "嘉实中证稀土产业ETF联接C" -> "嘉实中证稀土产业ETF"
 */
export const inferParentEtfName = (fundName?: string): string | null => {
  if (!fundName) return null;
  const normalized = fundName.trim();
  const match = normalized.match(/(.+?ETF)(?:[联连]接[A-Z]?|[A-Z])?$/i);
  return match?.[1]?.trim() || null;
};

/**
 * 从业绩比较基准中提取指数名称
 *
 * 业绩比较基准格式示例:
 * - "标普500指数收益率(使用估值汇率折算)×95%+人民币活期存款利率(税后)×5%"
 * - "纳斯达克100指数收益率×80%+中证全债指数收益率×20%"
 * - "恒生指数收益率"
 *
 * @param benchmark - 业绩比较基准字符串
 * @returns 提取的指数名称,如果无法提取则返回 null
 */
export const extractIndexName = (benchmark: string | null): string | null => {
  if (!benchmark) return null;

  // 移除常见的后缀和修饰词
  const cleaned = benchmark
    .replace(/收益率/g, '')
    .replace(/\(使用估值汇率折算\)/g, '')
    .replace(/\(税后\)/g, '')
    .replace(/×\d+%/g, '') // 移除权重
    .replace(/\+.*$/g, '') // 移除加号后的内容
    .trim();

  // 尝试匹配已知指数名称
  for (const indexName of Object.keys(INDEX_CODE_MAP)) {
    if (cleaned.includes(indexName)) {
      return indexName;
    }
  }

  // 如果没有匹配,返回清理后的字符串(可能是新指数)
  return cleaned || null;
};

/**
 * 根据指数名称获取对应的代码
 *
 * @param indexName - 指数名称
 * @returns 指数代码,如果未找到则返回 null
 */
export const getIndexCode = (indexName: string | null): string | null => {
  if (!indexName) return null;
  return INDEX_CODE_MAP[indexName] || null;
};
