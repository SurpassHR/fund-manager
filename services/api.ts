import type {
  MarketIndex,
  FundCommonDataResponse,
  FundHoldingsResponse,
  MorningstarResponse,
  FundPerformanceResponse,
  EastMoneyPingzhongData,
  EquityHolding,
  TrackingInfo,
  TrackingSource,
  TrackingConfidence,
  ParentEtfInfo,
} from '../types';
import {
  ETF_LINK_PARENT_MAP,
  extractIndexName,
  getIndexCode,
  inferParentEtfName,
  isEtfLinkFundName,
} from './constants';

// --- API Configurations ---
const MORNINGSTAR_API_BASE = 'https://www.morningstar.cn/cn-api';
const TENCENT_STOCK_API = 'https://qt.gtimg.cn/q=';

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

type EastMoneyApiData = {
  content?: string;
};

type EastMoneyKlineResponse = {
  data?: {
    klines?: string[];
  };
};

type EastMoneyWindow = Window & {
  apidata?: EastMoneyApiData;
};

type CallbackWindow = Window & Record<string, (json: EastMoneyKlineResponse) => void>;

const memoryCache = new Map<string, CacheEntry<unknown>>();
const inFlightCache = new Map<string, Promise<unknown>>();

const normalizeTicker = (ticker: string) => ticker.replace(/\D/g, '');

const buildCodesKey = (codes: string[]) => codes.slice().sort().join(',');

const withCache = async <T>(params: {
  key: string;
  ttlMs: number;
  force?: boolean;
  fetcher: () => Promise<T>;
  shouldCache?: (value: T) => boolean;
}): Promise<T> => {
  const { key, ttlMs, force, fetcher, shouldCache } = params;
  const now = Date.now();

  if (!force) {
    const cached = memoryCache.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.value as T;
    }

    const inFlight = inFlightCache.get(key);
    if (inFlight) {
      return inFlight as Promise<T>;
    }
  }

  const promise = (async () => {
    const result = await fetcher();
    if (!force) {
      const shouldStore = shouldCache
        ? shouldCache(result)
        : result !== null && result !== undefined;
      if (shouldStore) {
        memoryCache.set(key, { value: result, expiresAt: Date.now() + ttlMs });
      }
    }
    return result;
  })();

  inFlightCache.set(key, promise);
  try {
    return await promise;
  } finally {
    inFlightCache.delete(key);
  }
};

/**
 * Fetches market indices data for major China markets using Tencent API.
 * Replaces the broken Morningstar endpoint.
 * @returns A promise that resolves to an array of MarketIndex objects.
 */
export const fetchMarketIndices = async (): Promise<MarketIndex[]> => {
  try {
    const majorIndices = [
      { code: 'sh000001', name: '上证指数' },
      { code: 'sz399001', name: '深证成指' },
      { code: 'sz399006', name: '创业板指' },
      { code: 'sh000300', name: '沪深300' },
      { code: 'sh000016', name: '上证50' },
    ];

    const quotes = await fetchGeneralTencentQuotes(majorIndices.map((i) => i.code));

    const results: MarketIndex[] = [];
    for (const idx of majorIndices) {
      const data = quotes[idx.code];
      if (data) {
        // Ticker expects value (current price), change (amount), and changePct
        // We have currentPrice and changePct. We can calculate change amount:
        // changeAmount = currentPrice - (currentPrice / (1 + changePct/100))
        const prevClose = data.currentPrice / (1 + data.changePct / 100);
        const changeAmount = data.currentPrice - prevClose;

        results.push({
          name: idx.name,
          value: data.currentPrice,
          change: changeAmount,
          changePct: data.changePct,
        });
      }
    }
    return results;
  } catch (error) {
    console.error('Failed to fetch market indices from Tencent:', error);
    return [];
  }
};

// --- Morningstar API Functions ---

/**
 * Fetches common data for a specific fund from Morningstar.
 * @param fundCode - The code of the fund to fetch.
 * @returns A promise that resolves to the fund's common data or null if the request fails.
 */
export const fetchFundCommonData = async (
  fundCode: string,
  options?: { force?: boolean },
): Promise<FundCommonDataResponse | null> => {
  try {
    return await withCache({
      key: `ms-common:${fundCode}`,
      ttlMs: 30000,
      force: options?.force,
      fetcher: async () => {
        const response = await fetch(`${MORNINGSTAR_API_BASE}/v2/funds/${fundCode}/common-data`);
        if (!response.ok) throw new Error(`Failed to fetch common data for ${fundCode}`);
        return await response.json();
      },
    });
  } catch (error) {
    console.error(error);
    return null;
  }
};

/**
 * Fetches holding data for a specific fund from Morningstar.
 * @param fundCode - The code of the fund.
 * @returns A promise that resolves to the fund's holding data or null if the request fails.
 */
export const fetchFundHoldings = async (
  fundCode: string,
  options?: { force?: boolean },
): Promise<FundHoldingsResponse | null> => {
  try {
    return await withCache({
      key: `ms-holdings:${fundCode}`,
      ttlMs: 24 * 60 * 60 * 1000,
      force: options?.force,
      fetcher: async () => {
        const response = await fetch(`${MORNINGSTAR_API_BASE}/v2/funds/${fundCode}/holdings`);
        if (!response.ok) throw new Error(`Failed to fetch holdings for ${fundCode}`);
        return await response.json();
      },
    });
  } catch (error) {
    console.error(error);
    return null;
  }
};

export const fetchFundPerformance = async (
  fundCode: string,
  options?: { force?: boolean },
): Promise<FundPerformanceResponse | null> => {
  try {
    return await withCache({
      key: `ms-performance:${fundCode}`,
      ttlMs: 24 * 60 * 60 * 1000,
      force: options?.force,
      fetcher: async () => {
        const response = await fetch(`${MORNINGSTAR_API_BASE}/v2/funds/${fundCode}/performance`);
        if (!response.ok) throw new Error(`Failed to fetch performance for ${fundCode}`);
        return await response.json();
      },
    });
  } catch (error) {
    console.error(error);
    return null;
  }
};

/**
 * Searches for funds matching the provided query string using Morningstar's cache API.
 * @param query - The search query (e.g., fund code or name).
 * @returns A promise that resolves to the search results or null on failure.
 */
export const searchFunds = async (query: string): Promise<MorningstarResponse | null> => {
  try {
    return await withCache({
      key: `ms-search:${query}`,
      ttlMs: 10 * 60 * 1000,
      fetcher: async () => {
        const response = await fetch(
          `${MORNINGSTAR_API_BASE}/public/v1/fund-cache/${encodeURIComponent(query)}`,
        );
        if (!response.ok) throw new Error(`Failed to search funds with query: ${query}`);
        return await response.json();
      },
    });
  } catch (error) {
    console.error(error);
    return null;
  }
};

// --- EastMoney API Functions ---

// 使用队列严格控制并发，防止污染唯一的全局变量 window.apidata
let eastMoneyQueue = Promise.resolve();

const PINGZHONG_GLOBALS = [
  'ishb',
  'fS_name',
  'fS_code',
  'fund_sourceRate',
  'fund_Rate',
  'fund_minsg',
  'stockCodes',
  'zqCodes',
  'stockCodesNew',
  'zqCodesNew',
  'syl_1n',
  'syl_6y',
  'syl_3y',
  'syl_1y',
  'Data_fundSharesPositions',
  'Data_netWorthTrend',
  'Data_ACWorthTrend',
  'Data_grandTotal',
  'Data_rateInSimilarType',
  'Data_rateInSimilarPersent',
  'Data_fluctuationScale',
  'Data_holderStructure',
  'Data_assetAllocation',
  'Data_performanceEvaluation',
  'Data_currentFundManager',
  'Data_buySedemption',
  'swithSameType',
] as const;

const loadEastMoneyApiData = async (url: string): Promise<EastMoneyApiData | null> => {
  return await new Promise((resolve) => {
    eastMoneyQueue = eastMoneyQueue.then(() => {
      return new Promise<void>((innerResolve) => {
        const script = document.createElement('script');
        script.src = url;
        script.referrerPolicy = 'no-referrer';

        const finish = (result: EastMoneyApiData | null) => {
          if (document.head.contains(script)) {
            document.head.removeChild(script);
          }
          (window as EastMoneyWindow).apidata = undefined;
          resolve(result);
          innerResolve();
        };

        script.onload = () => {
          finish((window as EastMoneyWindow).apidata || null);
        };

        script.onerror = () => {
          finish(null);
        };

        document.head.appendChild(script);
      });
    });
  });
};

export const fetchEastMoneyPingzhongData = async (
  fundCode: string,
  options?: { force?: boolean },
): Promise<EastMoneyPingzhongData | null> => {
  return withCache({
    key: `em-pingzhong:${fundCode}`,
    ttlMs: 30 * 60 * 1000,
    force: options?.force,
    fetcher: async () => {
      return new Promise<EastMoneyPingzhongData | null>((resolve) => {
        eastMoneyQueue = eastMoneyQueue.then(() => {
          return new Promise<void>((innerResolve) => {
            const now = new Date();
            const v = [
              now.getFullYear(),
              String(now.getMonth() + 1).padStart(2, '0'),
              String(now.getDate()).padStart(2, '0'),
              String(now.getHours()).padStart(2, '0'),
              String(now.getMinutes()).padStart(2, '0'),
              String(now.getSeconds()).padStart(2, '0'),
            ].join('');

            const script = document.createElement('script');
            script.src = `https://fund.eastmoney.com/pingzhongdata/${fundCode}.js?v=${v}`;
            script.referrerPolicy = 'no-referrer';

            const win = window as unknown as Window &
              Record<string, unknown> & {
                syl_1y?: string;
                syl_3y?: string;
                syl_6y?: string;
                syl_1n?: string;
                Data_grandTotal?: EastMoneyPingzhongData['grandTotal'];
                Data_netWorthTrend?: EastMoneyPingzhongData['netWorthTrend'];
                Data_ACWorthTrend?: EastMoneyPingzhongData['acWorthTrend'];
              };

            const cleanup = () => {
              if (document.head.contains(script)) {
                document.head.removeChild(script);
              }
              for (const key of PINGZHONG_GLOBALS) {
                try {
                  delete win[key];
                } catch {
                  // noop
                }
              }
            };

            const finish = (result: EastMoneyPingzhongData | null) => {
              cleanup();
              resolve(result);
              innerResolve();
            };

            script.onload = () => {
              try {
                finish({
                  syl_1y: win.syl_1y ?? '',
                  syl_3y: win.syl_3y ?? '',
                  syl_6y: win.syl_6y ?? '',
                  syl_1n: win.syl_1n ?? '',
                  grandTotal: win.Data_grandTotal ?? [],
                  netWorthTrend: win.Data_netWorthTrend ?? [],
                  acWorthTrend: win.Data_ACWorthTrend ?? [],
                });
              } catch (error) {
                console.error(`Error reading pingzhongdata for ${fundCode}`, error);
                finish(null);
              }
            };

            script.onerror = () => {
              console.error(`Failed to load pingzhongdata script for ${fundCode}`);
              finish(null);
            };

            document.head.appendChild(script);
          });
        });
      });
    },
    shouldCache: (value) => value !== null,
  });
};

/**
 * Fetches the latest Net Asset Value (NAV) data for a fund from EastMoney.
 * Uses a queue to prevent concurrent requests from polluting the global window.apidata.
 * @param fundCode - The code of the fund.
 * @returns A promise resolving to an object containing nav, navDate, and navChangePercent, or null.
 */
export const fetchEastMoneyLatestNav = async (
  fundCode: string,
  options?: { force?: boolean },
): Promise<{ nav: number; navDate: string; navChangePercent: number; previousNav?: number } | null> => {
  return withCache({
    key: `em-latest-nav:${fundCode}`,
    ttlMs: 30000,
    force: options?.force,
    fetcher: async () => {
      const data = await loadEastMoneyApiData(
        `https://fundf10.eastmoney.com/F10DataApi.aspx?type=lsjz&code=${fundCode}&page=1&per=2&rt=${Date.now()}`,
      );
      if (!data?.content) return null;
      try {
        const rowRegex =
          /<tr>\s*<td>(\d{4}-\d{2}-\d{2})<\/td>\s*<td[^>]*>([\d.]+)<\/td>\s*<td[^>]*>[\d.]+<\/td>\s*<td[^>]*>([-\d.]+)%?<\/td>/g;
        const rows = Array.from(data.content.matchAll(rowRegex));
        const latestRow = rows[0];
        if (!latestRow) return null;
        const previousRow = rows[1];
        return {
          navDate: latestRow[1],
          nav: parseFloat(latestRow[2]),
          navChangePercent: parseFloat(latestRow[3]) || 0,
          previousNav: previousRow?.[2] ? parseFloat(previousRow[2]) : undefined,
        };
      } catch (e) {
        console.error(`Error parsing EastMoney data for ${fundCode}`, e);
        return null;
      }
    },
    shouldCache: (value) => value !== null,
  });
};

/**
 * Fetches the historical Net Asset Value (NAV) data for a fund from EastMoney for a specific date.
 * Uses script injection to bypass CORS, reading from the global window.apidata.
 * @param fundCode - The code of the fund.
 * @param date - The target date in YYYY-MM-DD format.
 * @returns A promise resolving to the NAV number or null if not found.
 */
export const fetchHistoricalFundNav = async (
  fundCode: string,
  date: string,
): Promise<number | null> => {
  const result = await fetchHistoricalFundNavWithDate(fundCode, date);
  return result?.nav ?? null;
};

export const fetchHistoricalFundNavWithDate = async (
  fundCode: string,
  date: string,
): Promise<{ nav: number; navDate: string } | null> => {
  return withCache({
    key: `em-hist-nav-with-date:${fundCode}:${date}`,
    ttlMs: 24 * 60 * 60 * 1000,
    fetcher: async () => {
      const [year, month, day] = date.split('-').map(Number);
      const d = new Date(year, month - 1, day - 30);
      const startDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const data = await loadEastMoneyApiData(
        `https://fundf10.eastmoney.com/F10DataApi.aspx?type=lsjz&code=${fundCode}&page=1&per=1&sdate=${startDateStr}&edate=${date}&rt=${Date.now()}`,
      );
      if (!data?.content) return null;
      try {
        const regex = /<tr>\s*<td>(\d{4}-\d{2}-\d{2})<\/td>\s*<td[^>]*>([\d.]+)<\/td>/;
        const match = data.content.match(regex);
        if (!match?.[1] || !match?.[2]) return null;
        return {
          navDate: match[1],
          nav: parseFloat(match[2]),
        };
      } catch (e) {
        console.error(`Error parsing historical EastMoney data for ${fundCode} on ${date}`, e);
        return null;
      }
    },
    shouldCache: (value) => value !== null,
  });
};

// --- Tencent & EastMoney Stock/Index API Functions ---

/**
 * Fetches real-time stock quotes from Tencent Stock API for given stock codes.
 * Matches them against fund top 10 holdings to return a map of ticker to percentage change.
 * @param codes - Formatted stock codes (e.g. sh600519).
 * @param top10Holdings - Array of the fund's top 10 holding objects.
 * @returns A promise that resolves to a record mapping ticker symbols to their real-time percentage change.
 */
export const fetchRealTimeQuotes = async (
  codes: string[],
  top10Holdings: EquityHolding[],
  options?: { force?: boolean },
): Promise<Record<string, number>> => {
  if (!codes || codes.length === 0) return {};

  try {
    const quoteMap = await fetchTencentStockQuotes(codes, options);
    const mapped: Record<string, number> = {};
    top10Holdings.forEach((holding) => {
      const key = holding?.ticker ? normalizeTicker(holding.ticker) : '';
      if (!key) return;
      const quote = quoteMap[key];
      if (quote && typeof quote.pct === 'number') {
        mapped[holding.ticker] = quote.pct;
      }
    });
    return mapped;
  } catch (error) {
    console.error('Failed to fetch real-time quotes:', error);
    throw error; // Re-throw to allow caller to handle fallback
  }
};

export const buildTencentQuoteCodes = (tickers: Array<string | null | undefined>): string[] => {
  return tickers
    .map((ticker) => {
      if (!ticker) return null;
      if (ticker.length === 5) return `hk${ticker}`;
      if (ticker.length === 6) {
        if (ticker.startsWith('6')) return `sh${ticker}`;
        if (ticker.startsWith('0') || ticker.startsWith('3')) return `sz${ticker}`;
        if (ticker.startsWith('83') || ticker.startsWith('87') || ticker.startsWith('43'))
          return `bj${ticker}`;
      }
      return null;
    })
    .filter(Boolean) as string[];
};

export const fetchTencentStockQuotes = async (
  codes: string[],
  options?: { force?: boolean },
): Promise<Record<string, { price: string; pct: number }>> => {
  if (!codes || codes.length === 0) return {};

  try {
    const key = `tencent-stock:${buildCodesKey(codes)}`;
    return await withCache({
      key,
      ttlMs: 10000,
      force: options?.force,
      fetcher: async () => {
        const qtUrl = `${TENCENT_STOCK_API}${codes.map((c: string) => `s_${c}`).join(',')}`;
        const res = await fetch(qtUrl);
        const qText = await res.text();

        const quoteMap: Record<string, { price: string; pct: number }> = {};
        qText.split(';').forEach((line) => {
          if (line.includes('=')) {
            const rightSide = line.split('=')[1].replace(/"/g, '');
            const parts = rightSide.split('~');
            if (parts.length > 5) {
              const ticker = parts[2];
              const price = parts[3];
              const pct = parseFloat(parts[5]);
              const key = normalizeTicker(ticker);
              if (key) {
                quoteMap[key] = { price, pct };
              }
            }
          }
        });
        return quoteMap;
      },
    });
  } catch (error) {
    console.error('Failed to fetch Tencent stock quotes:', error);
    throw error;
  }
};

/**
 * Fetch generic Tencent quotes for any list of codes (sh000001, sz399001, etc.)
 * Returns { [code]: { currentPrice: number, changePct: number } }
 */
export const fetchGeneralTencentQuotes = async (
  codes: string[],
  options?: { force?: boolean },
): Promise<Record<string, { currentPrice: number; changePct: number }>> => {
  if (!codes || codes.length === 0) return {};

  try {
    const key = `tencent-general:${buildCodesKey(codes)}`;
    return await withCache({
      key,
      ttlMs: 10000,
      force: options?.force,
      fetcher: async () => {
        const qtUrl = `${TENCENT_STOCK_API}${codes.join(',')}`;
        const res = await fetch(qtUrl);
        const qText = await res.text();

        const quoteMap: Record<string, { currentPrice: number; changePct: number }> = {};
        qText.split(';').forEach((line) => {
          if (line.includes('=')) {
            // e.g. v_sh000001="1~上证指数~000001~3028.05~...
            const leftSide = line.split('=')[0]; // v_sh000001
            const reqCodeMatch = leftSide.match(/v_(.+)/);
            if (!reqCodeMatch) return;
            const reqCode = reqCodeMatch[1]; // sh000001

            const rightSide = line.split('=')[1].replace(/"/g, '');
            const parts = rightSide.split('~');

            // format depending on index/stock. Usually indices have current at index 3, and pct at 32
            if (parts.length > 32) {
              // 3 is current price, 32 is pct change for standard quotes
              const currentPrice = parseFloat(parts[3]);
              const changePct = parseFloat(parts[32]);
              if (!isNaN(currentPrice) && !isNaN(changePct)) {
                quoteMap[reqCode] = { currentPrice, changePct };
              }
            }
          }
        });
        return quoteMap;
      },
    });
  } catch (error) {
    console.error('Failed to fetch general Tencent quotes:', error);
    return {};
  }
};

/**
 * Fetches the historical closing price of an index or stock for a specific date from EastMoney.
 * @param code - The index code (e.g. sh000001, sz399001).
 * @param date - The target date in YYYY-MM-DD format.
 * @returns A promise resolving to the closing price or null if not found.
 */
export const fetchHistoricalIndexPrice = async (
  code: string,
  date: string,
): Promise<number | null> => {
  return withCache({
    key: `em-hist-index:${code}:${date}`,
    ttlMs: 24 * 60 * 60 * 1000,
    fetcher: () =>
      new Promise((resolve) => {
        let secid = '';
        if (code.startsWith('sh') || code.startsWith('shanghai')) {
          secid = `1.${code.replace(/\D/g, '')}`;
        } else if (code.startsWith('sz') || code.startsWith('shenzhen')) {
          secid = `0.${code.replace(/\D/g, '')}`;
        } else if (code.startsWith('bj')) {
          secid = `0.${code.replace(/\D/g, '')}`; // EastMoney uses 0 for BJ usually in some endpoints, or 0. for SZ. Actually for index, mostly sh or sz.
        } else {
          secid = `1.${code}`;
        }

        const formattedDate = date.replace(/-/g, ''); // 2024-01-05 -> 20240105

        // Query a 30-day range to fallback to the latest available trading day
        const [year, month, day] = date.split('-').map(Number);
        const d = new Date(year, month - 1, day - 30);
        const startFormattedDate = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

        const callbackName = `eastmoney_cb_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        const url = `http://push2his.eastmoney.com/api/qt/stock/kline/get?fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=101&fqt=1&secid=${secid}&beg=${startFormattedDate}&end=${formattedDate}&cb=${callbackName}`;

        const script = document.createElement('script');
        script.src = url;
        script.referrerPolicy = 'no-referrer';

        const callbackWindow = window as unknown as CallbackWindow;
        callbackWindow[callbackName] = (json: EastMoneyKlineResponse) => {
          let result = null;
          try {
            if (json && json.data && json.data.klines && json.data.klines.length > 0) {
              // Get the last item in the array to get the most recent trading day up to the end date
              const latestKline = json.data.klines[json.data.klines.length - 1];
              const parts = latestKline.split(',');
              if (parts.length > 2) {
                result = parseFloat(parts[2]);
              }
            }
          } catch (e) {
            console.error(`Error parsing historical index price for ${code}`, e);
          } finally {
            cleanup();
            resolve(result);
          }
        };

        const cleanup = () => {
          if (document.head.contains(script)) {
            document.head.removeChild(script);
          }
          delete callbackWindow[callbackName];
        };

        script.onerror = () => {
          console.error(`Failed to load historical index script for ${code} on ${date}`);
          cleanup();
          resolve(null);
        };

        document.head.appendChild(script);
      }),
    shouldCache: (value) => value !== null,
  });
};

/**
 * Checks if the Chinese stock market is currently trading based on the update time of the Shanghai Composite Index.
 * Falls back to local time checks if the API fails.
 * @returns A promise evaluating to true if the market is open and trading (after 9:20 AM on a weekday).
 */
export const checkIsMarketTrading = async (options?: { force?: boolean }): Promise<boolean> => {
  return withCache({
    key: 'market-trading',
    ttlMs: 10000,
    force: options?.force,
    fetcher: async () => {
      try {
        const res = await fetch(`${TENCENT_STOCK_API}sh000001`);
        const text = await res.text();
        const parts = text.split('~');
        if (parts.length > 30) {
          const updateTime = parts[30]; // e.g., "20260224161415"
          if (updateTime && updateTime.length >= 8) {
            const marketDateStr = updateTime.substring(0, 8);
            const d = new Date();
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const todayStr = `${year}${month}${day}`;

            // If the market index date is today, today is a trading day
            const isAfter920 = d.getHours() > 9 || (d.getHours() === 9 && d.getMinutes() >= 20);
            return marketDateStr === todayStr && isAfter920;
          }
        }
      } catch (e) {
        console.error('Failed to check market status', e);
      }

      // Fallback if API fails
      const now = new Date();
      const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;
      const isAfter920 = now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() >= 20);
      return isWeekday && isAfter920;
    },
    shouldCache: () => true,
  });
};

// --- Fund Tracking Info API Functions ---

/**
 * Fetches fund F10 data (基金档案) from EastMoney.
 * Returns HTML content containing tracking index and benchmark information.
 *
 * @param fundCode - The code of the fund
 * @returns A promise resolving to HTML content or null on failure
 */
export const fetchEastMoneyF10 = async (fundCode: string): Promise<string | null> => {
  try {
    return await withCache({
      key: `em-f10:${fundCode}`,
      ttlMs: 24 * 60 * 60 * 1000, // 24小时缓存
      fetcher: async () => {
        const data = await loadEastMoneyApiData(
          `https://fundf10.eastmoney.com/F10DataApi.aspx?type=jbgk&code=${fundCode}&rt=${Date.now()}`,
        );
        if (!data?.content) {
          console.warn(`No F10 content found for ${fundCode}`);
          return null;
        }

        return data.content;
      },
      shouldCache: (value) => value !== null,
    });
  } catch (error) {
    console.error(`Failed to fetch F10 for ${fundCode}:`, error);
    return null;
  }
};

/**
 * Fetches fund tracking information using a hybrid approach:
 * 1. Try EastMoney F10 (highest confidence)
 * 2. Fallback to Morningstar category (medium confidence)
 * 3. Fallback to manual configuration (if available)
 *
 * @param fundCode - The code of the fund
 * @param fundName - The name of the fund (optional, for inference)
 * @returns A promise resolving to TrackingInfo or null
 */
export const fetchFundTrackingInfo = async (
  fundCode: string,
  fundName?: string,
): Promise<TrackingInfo | null> => {
  try {
    // Step 1: Try EastMoney F10
    const f10Html = await fetchEastMoneyF10(fundCode);
    if (f10Html) {
      // 解析跟踪标的
      const trackingRegex = /<th>跟踪标的<\/th><td>([^<]+)<\/td>/;
      const trackingMatch = f10Html.match(trackingRegex);
      let trackingIndex = trackingMatch ? trackingMatch[1].trim() : null;

      // 如果是"该基金无跟踪标的",则设为 null
      if (trackingIndex === '该基金无跟踪标的') {
        trackingIndex = null;
      }

      // 如果找到跟踪标的,直接返回
      if (trackingIndex) {
        const indexCode = getIndexCode(trackingIndex);
        if (indexCode) {
          return {
            indexName: trackingIndex,
            indexCode,
            source: 'EASTMONEY' as TrackingSource,
            confidence: 'HIGH' as TrackingConfidence,
            lastUpdate: new Date().toISOString(),
          };
        }
      }

      // 如果没有跟踪标的,尝试从业绩比较基准提取
      const benchmarkRegex = /<th>业绩比较基准<\/th><td>([^<]+)<\/td>/;
      const benchmarkMatch = f10Html.match(benchmarkRegex);
      const benchmark = benchmarkMatch ? benchmarkMatch[1].trim() : null;

      if (benchmark) {
        const extractedIndex = extractIndexName(benchmark);
        if (extractedIndex) {
          const indexCode = getIndexCode(extractedIndex);
          if (indexCode) {
            return {
              indexName: extractedIndex,
              indexCode,
              source: 'EASTMONEY' as TrackingSource,
              confidence: 'MEDIUM' as TrackingConfidence,
              lastUpdate: new Date().toISOString(),
            };
          }
        }
      }
    }

    // Step 2: Fallback to Morningstar category
    const commonData = await fetchFundCommonData(fundCode);
    if (commonData?.data?.morningstarCategory) {
      const category = commonData.data.morningstarCategory;

      // 尝试从晨星分类推断跟踪指数
      // 例如: "QDII美国股票" -> 可能跟踪标普500或纳斯达克
      // 这里只做简单映射,复杂情况需要手动配置
      const categoryMap: Record<string, { indexName: string; indexCode: string }> = {
        QDII美国股票: { indexName: '标普500指数', indexCode: 'SPX' },
        沪港深股票: { indexName: '恒生指数', indexCode: 'HSI' },
      };

      const inferred = categoryMap[category];
      if (inferred) {
        return {
          indexName: inferred.indexName,
          indexCode: inferred.indexCode,
          source: 'MORNINGSTAR' as TrackingSource,
          confidence: 'MEDIUM' as TrackingConfidence,
          lastUpdate: new Date().toISOString(),
        };
      }
    }

    // Step 3: No tracking info found
    console.warn(`No tracking info found for ${fundCode} (${fundName || 'unknown'})`);
    return null;
  } catch (error) {
    console.error(`Failed to fetch tracking info for ${fundCode}:`, error);
    return null;
  }
};

const formatParentEtfTencentCode = (parentCode: string): string | null => {
  const normalized = parentCode.trim().toUpperCase();
  const match = normalized.match(/^(\d{6})(?:\.(SH|SZ))?$/);
  if (!match) return null;
  const code = match[1];
  const market = match[2];

  if (market === 'SH') return `sh${code}`;
  if (market === 'SZ') return `sz${code}`;
  if (code.startsWith('5') || code.startsWith('6')) return `sh${code}`;
  return `sz${code}`;
};

const normalizeParentEtfCode = (rawCode: string): string => {
  const upper = rawCode.trim().toUpperCase();
  const full = upper.match(/^(\d{6})\.(SH|SZ)$/);
  if (full) return `${full[1]}.${full[2]}`;

  const codeOnly = upper.match(/^(\d{6})$/)?.[1] || '';
  if (!codeOnly) return '';
  return codeOnly.startsWith('5') || codeOnly.startsWith('6')
    ? `${codeOnly}.SH`
    : `${codeOnly}.SZ`;
};

const decodeF10HtmlText = (html: string): string => {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
};

const extractParentEtfFromF10 = (f10Html: string): ParentEtfInfo | null => {
  const plain = decodeF10HtmlText(f10Html);

  const normalizeParentName = (raw: string): string => {
    const trimmed = raw
      .trim()
      .replace(/^(本基金(?:主要)?投资于|主要投资于|投资于)/, '')
      .trim();
    const tail = trimmed.match(/([\u4e00-\u9fa5A-Za-z0-9·\-（）()]{2,}ETF)\s*$/i);
    return (tail?.[1] || trimmed).trim();
  };

  // name + code, e.g. 嘉实中证稀土产业ETF 516150.SH / 嘉实中证稀土产业ETF(516150)
  const nameCodeMatch = plain.match(/([\u4e00-\u9fa5A-Za-z0-9·\-（）()]+ETF)[^\d]{0,24}(\d{6}(?:\.(?:SH|SZ))?)/i);
  if (nameCodeMatch?.[1] && nameCodeMatch?.[2]) {
    const normalizedCode = normalizeParentEtfCode(nameCodeMatch[2]);
    if (normalizedCode) {
      return {
        parentName: normalizeParentName(nameCodeMatch[1]),
        parentCode: normalizedCode,
      };
    }
  }

  // code + name, e.g. 516150.SH 嘉实中证稀土产业ETF
  const codeNameMatch = plain.match(/(\d{6}(?:\.(?:SH|SZ))?)[^\u4e00-\u9fa5A-Za-z]{0,24}([\u4e00-\u9fa5A-Za-z0-9·\-（）()]+ETF)/i);
  if (codeNameMatch?.[1] && codeNameMatch?.[2]) {
    const normalizedCode = normalizeParentEtfCode(codeNameMatch[1]);
    if (normalizedCode) {
      return {
        parentName: normalizeParentName(codeNameMatch[2]),
        parentCode: normalizedCode,
      };
    }
  }

  return null;
};

/**
 * 获取 ETF 联接基金对应的母 ETF 信息。
 *
 * 策略：
 * 1) 优先使用手动映射（最高置信度，便于维护关键基金）
 * 2) 再通过名称推断（如 "ETF联接C" -> "ETF"）
 *
 * 注意：名称推断当前仅返回名称，不会自动检索市场代码。
 */
export const fetchParentETFInfo = async (
  fundCode: string,
  fundName?: string,
): Promise<ParentEtfInfo | null> => {
  return withCache({
    key: `parent-etf:${fundCode}:${fundName || ''}`,
    ttlMs: 24 * 60 * 60 * 1000,
    fetcher: async () => {
      const mapped = ETF_LINK_PARENT_MAP[fundCode];
      if (mapped) {
        return {
          parentCode: mapped.parentCode,
          parentName: mapped.parentName,
        };
      }

      const f10Html = await fetchEastMoneyF10(fundCode);
      if (f10Html) {
        const fromF10 = extractParentEtfFromF10(f10Html);
        if (fromF10) {
          return fromF10;
        }
      }

      if (!isEtfLinkFundName(fundName)) {
        return null;
      }

      const inferredParentName = inferParentEtfName(fundName);
      if (!inferredParentName) return null;

      // 尝试用晨星搜索补全代码
      const search = await searchFunds(inferredParentName);
      const candidate =
        search?.data?.find((item) => {
          if (!item?.fundName || !item?.symbol) return false;
          const symbol = String(item.symbol).trim();
          return /\d{6}/.test(symbol) && item.fundName.includes('ETF');
        }) || null;

      const matchedCode = candidate?.symbol ? String(candidate.symbol).match(/\d{6}/)?.[0] : null;

      return {
        parentCode: matchedCode ? normalizeParentEtfCode(matchedCode) : '',
        parentName: inferredParentName,
      };
    },
    shouldCache: () => true,
  });
};

/**
 * 获取 ETF 联接基金母 ETF 的实时涨跌幅（%）
 */
export const fetchParentETFPct = async (
  parentInfo: ParentEtfInfo,
  options?: { force?: boolean },
): Promise<number | null> => {
  if (!parentInfo.parentCode) return null;
  const tencentCode = formatParentEtfTencentCode(parentInfo.parentCode);
  if (!tencentCode) return null;

  const quoteMap = await fetchTencentStockQuotes([tencentCode], options);
  const normalized = normalizeTicker(tencentCode);
  const quote = quoteMap[normalized];
  return typeof quote?.pct === 'number' ? quote.pct : null;
};
