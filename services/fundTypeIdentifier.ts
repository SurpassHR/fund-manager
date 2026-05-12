import type { FundCategory, UnderlyingMarket } from '../types';

interface IdentifyFundTypeParams {
  code: string;
  name?: string;
  morningstarCategory?: string;
  fundType?: string;
}

interface IdentifyFundTypeResult {
  category: FundCategory;
  underlyingMarket: UnderlyingMarket;
}

const QDII_CODE_PREFIXES = ['16'];
const ETF_LINK_KEYWORD = 'ETF联接';
const ETF_CODE_PREFIX = '5';

const US_NAME_KEYWORDS = ['纳斯达克', '标普', '美国', '道琼斯', '纳指'];
const HK_NAME_KEYWORDS = ['港股', '恒生', '香港'];
const QDII_NAME_KEYWORDS = ['QDII', '全球', '海外'];
const MORNINGSTAR_US_CATEGORIES = ['QDII美国股票'];
const MORNINGSTAR_HK_CATEGORIES = ['沪港深股票'];
const MORNINGSTAR_GLOBAL_CATEGORIES = ['QDII环球股票'];

export const identifyFundType = (params: IdentifyFundTypeParams): IdentifyFundTypeResult => {
  const { code, name = '', morningstarCategory = '' } = params;

  let category: FundCategory = 'UNKNOWN';
  let underlyingMarket: UnderlyingMarket = 'CN';

  // 1. Code prefix — QDII
  if (QDII_CODE_PREFIXES.some((prefix) => code.startsWith(prefix))) {
    category = 'QDII';
  }

  // 2. Code prefix — ETF / ETF_LINK
  if (code.startsWith(ETF_CODE_PREFIX) && category === 'UNKNOWN') {
    category = 'ETF';
  }

  // 3. Name keywords — ETF_LINK (highest priority among name-based)
  if (name.includes(ETF_LINK_KEYWORD)) {
    category = 'ETF_LINK';
  }

  // 4. Name keywords — QDII
  if (QDII_NAME_KEYWORDS.some((kw) => name.includes(kw)) && category !== 'ETF_LINK') {
    category = 'QDII';
  }

  // 5. Name keywords — HK
  if (
    HK_NAME_KEYWORDS.some((kw) => name.includes(kw)) &&
    category !== 'ETF_LINK' &&
    category !== 'QDII'
  ) {
    category = 'HK';
  }

  // 6. Morningstar category
  if (MORNINGSTAR_HK_CATEGORIES.some((kw) => morningstarCategory.includes(kw))) {
    if (category === 'UNKNOWN') category = 'HK';
  }
  if (MORNINGSTAR_GLOBAL_CATEGORIES.some((kw) => morningstarCategory.includes(kw))) {
    if (category === 'UNKNOWN') category = 'QDII';
  }
  if (MORNINGSTAR_US_CATEGORIES.some((kw) => morningstarCategory.includes(kw))) {
    if (category === 'UNKNOWN') category = 'QDII';
  }

  // 7. Default: 6-digit CN fund → DOMESTIC
  if (category === 'UNKNOWN' && /^\d{6}$/.test(code)) {
    category = 'DOMESTIC';
  }

  // --- 确定 underlyingMarket ---

  // US keywords
  if (US_NAME_KEYWORDS.some((kw) => name.includes(kw))) {
    underlyingMarket = 'US';
  } else if (MORNINGSTAR_US_CATEGORIES.some((kw) => morningstarCategory.includes(kw))) {
    underlyingMarket = 'US';
  }

  // HK keywords (if not already US)
  if (underlyingMarket === 'CN' || underlyingMarket === 'US') {
    if (HK_NAME_KEYWORDS.some((kw) => name.includes(kw))) {
      underlyingMarket = 'HK';
    } else if (MORNINGSTAR_HK_CATEGORIES.some((kw) => morningstarCategory.includes(kw))) {
      underlyingMarket = 'HK';
    }
  }

  // GLOBAL keywords (if not already set to specific market)
  const hasGlobalKeyword = ['全球', '海外'].some((kw) => name.includes(kw));
  if (
    hasGlobalKeyword &&
    underlyingMarket === 'CN' &&
    !US_NAME_KEYWORDS.some((kw) => name.includes(kw)) &&
    !HK_NAME_KEYWORDS.some((kw) => name.includes(kw))
  ) {
    underlyingMarket = 'GLOBAL';
  }
  if (
    MORNINGSTAR_GLOBAL_CATEGORIES.some((kw) => morningstarCategory.includes(kw)) &&
    underlyingMarket === 'CN'
  ) {
    underlyingMarket = 'GLOBAL';
  }

  // QDII without specific market hint → GLOBAL
  if (category === 'QDII' && underlyingMarket === 'CN') {
    underlyingMarket = 'US';
  }

  // HK → HK market
  if (category === 'HK') {
    underlyingMarket = 'HK';
  }

  return { category, underlyingMarket };
};
