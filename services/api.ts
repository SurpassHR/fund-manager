import { MarketIndex, FundCommonDataResponse, MorningstarResponse } from '../types';

// --- API Configurations ---
const MORNINGSTAR_API_BASE = 'https://www.morningstar.cn/cn-api';
const TENCENT_STOCK_API = 'https://qt.gtimg.cn/q=';

// --- Interfaces ---
interface MarketDataResponse {
    watchData: {
        data: {
            china: Array<{
                name: string;
                totalAmount: number;
                change: number; // percentage change value e.g. -1.25 for -1.25%
                id: string;
                // The API returns change as percentage directy in 'change' field for these indices?
                // Let's verify with the example response:
                // "change": -1.2538, "changeAmount": -59.1724
                // So 'change' is the percentage.
            }>;
        };
    };
}

// Ensure the response structure matches deep nested access
interface FullApiResponse {
    data: MarketDataResponse;
}

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

        const quotes = await fetchGeneralTencentQuotes(majorIndices.map(i => i.code));
        
        const results: MarketIndex[] = [];
        for (const idx of majorIndices) {
            const data = quotes[idx.code];
            if (data) {
                // Ticker expects value (current price), change (amount), and changePct
                // We have currentPrice and changePct. We can calculate change amount:
                // changeAmount = currentPrice - (currentPrice / (1 + changePct/100))
                const prevClose = data.currentPrice / (1 + (data.changePct / 100));
                const changeAmount = data.currentPrice - prevClose;
                
                results.push({
                    name: idx.name,
                    value: data.currentPrice,
                    change: changeAmount,
                    changePct: data.changePct
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
export const fetchFundCommonData = async (fundCode: string): Promise<FundCommonDataResponse | null> => {
    try {
        const response = await fetch(`${MORNINGSTAR_API_BASE}/v2/funds/${fundCode}/common-data`);
        if (!response.ok) throw new Error(`Failed to fetch common data for ${fundCode}`);
        return await response.json();
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
export const fetchFundHoldings = async (fundCode: string): Promise<any | null> => {
    try {
        const response = await fetch(`${MORNINGSTAR_API_BASE}/v2/funds/${fundCode}/holdings`);
        if (!response.ok) throw new Error(`Failed to fetch holdings for ${fundCode}`);
        return await response.json();
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
        const response = await fetch(`${MORNINGSTAR_API_BASE}/public/v1/fund-cache/${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error(`Failed to search funds with query: ${query}`);
        return await response.json();
    } catch (error) {
        console.error(error);
        return null;
    }
};

// --- EastMoney API Functions ---

// 使用队列严格控制并发，防止污染唯一的全局变量 window.apidata
let eastMoneyQueue = Promise.resolve();

/**
 * Fetches the latest Net Asset Value (NAV) data for a fund from EastMoney.
 * Uses a queue to prevent concurrent requests from polluting the global window.apidata.
 * @param fundCode - The code of the fund.
 * @returns A promise resolving to an object containing nav, navDate, and navChangePercent, or null.
 */
export const fetchEastMoneyLatestNav = async (fundCode: string): Promise<{ nav: number, navDate: string, navChangePercent: number } | null> => {
    return new Promise((resolve) => {
        eastMoneyQueue = eastMoneyQueue.then(() => {
            return new Promise<void>((innerResolve) => {
                const script = document.createElement('script');
                // fundf10 端点不校验 Referer，返回 var apidata={...} 格式
                script.src = `https://fundf10.eastmoney.com/F10DataApi.aspx?type=lsjz&code=${fundCode}&page=1&per=1&rt=${Date.now()}`;
                // 不发送当前页面的 Referer，保护隐私
                script.referrerPolicy = 'no-referrer';

                script.onload = () => {
                    let result = null;
                    try {
                        // 脚本执行后会将结果赋值给全局 window.apidata
                        const data = (window as any).apidata;
                        if (data && data.content) {
                            const regex = /<tr>\s*<td>(\d{4}-\d{2}-\d{2})<\/td>\s*<td[^>]*>([\d\.]+)<\/td>\s*<td[^>]*>[\d\.]+<\/td>\s*<td[^>]*>([-\d\.]+)%?<\/td>/;
                            const match = data.content.match(regex);
                            if (match) {
                                result = {
                                    navDate: match[1],
                                    nav: parseFloat(match[2]),
                                    navChangePercent: parseFloat(match[3]) || 0
                                };
                            }
                        }
                    } catch (e) {
                        console.error(`Error parsing EastMoney data for ${fundCode}`, e);
                    } finally {
                        if (document.head.contains(script)) {
                            document.head.removeChild(script);
                        }
                        (window as any).apidata = undefined;

                        resolve(result);
                        innerResolve();
                    }
                };

                script.onerror = () => {
                    console.error(`Failed to load EastMoney script for ${fundCode}`);
                    if (document.head.contains(script)) {
                        document.head.removeChild(script);
                    }
                    resolve(null);
                    innerResolve();
                };

                document.head.appendChild(script);
            });
        });
    });
};

/**
 * Fetches the historical Net Asset Value (NAV) data for a fund from EastMoney for a specific date.
 * Uses script injection to bypass CORS, reading from the global window.apidata.
 * @param fundCode - The code of the fund.
 * @param date - The target date in YYYY-MM-DD format.
 * @returns A promise resolving to the NAV number or null if not found.
 */
export const fetchHistoricalFundNav = async (fundCode: string, date: string): Promise<number | null> => {
    return new Promise((resolve) => {
        eastMoneyQueue = eastMoneyQueue.then(() => {
            return new Promise<void>((innerResolve) => {
                // To support non-trading days, query a date range of 30 days ending on the target date
                const [year, month, day] = date.split('-').map(Number);
                const d = new Date(year, month - 1, day - 30);
                const startDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

                const script = document.createElement('script');
                // per=1 gets only the latest 1 record within the range (since results are descending by date)
                script.src = `https://fundf10.eastmoney.com/F10DataApi.aspx?type=lsjz&code=${fundCode}&page=1&per=1&sdate=${startDateStr}&edate=${date}&rt=${Date.now()}`;
                script.referrerPolicy = 'no-referrer';

                script.onload = () => {
                    let result = null;
                    try {
                        const data = (window as any).apidata;
                        if (data && data.content) {
                            const regex = /<tr>\s*<td>\d{4}-\d{2}-\d{2}<\/td>\s*<td[^>]*>([\d\.]+)<\/td>/;
                            const match = data.content.match(regex);
                            if (match && match[1]) {
                                result = parseFloat(match[1]);
                            }
                        }
                    } catch (e) {
                        console.error(`Error parsing historical EastMoney data for ${fundCode} on ${date}`, e);
                    } finally {
                        if (document.head.contains(script)) {
                            document.head.removeChild(script);
                        }
                        (window as any).apidata = undefined;
                        resolve(result);
                        innerResolve();
                    }
                };

                script.onerror = () => {
                    console.error(`Failed to load historical EastMoney script for ${fundCode} on ${date}`);
                    if (document.head.contains(script)) {
                        document.head.removeChild(script);
                    }
                    resolve(null);
                    innerResolve();
                };

                document.head.appendChild(script);
            });
        });
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
export const fetchRealTimeQuotes = async (codes: string[], top10Holdings: any[]): Promise<Record<string, number>> => {
    if (!codes || codes.length === 0) return {};

    try {
        const qtUrl = `${TENCENT_STOCK_API}${codes.map((c: string) => `s_${c}`).join(',')}`;
        const res = await fetch(qtUrl);
        const qText = await res.text();

        const quoteMap: Record<string, number> = {};
        qText.split(';').forEach(line => {
            if (line.includes('=')) {
                const rightSide = line.split('=')[1].replace(/"/g, '');
                const parts = rightSide.split('~');
                if (parts.length > 5) {
                    const ticker = parts[2];
                    const pct = parseFloat(parts[5]);

                    const matchedHolding = top10Holdings.find((h: any) => h.ticker.endsWith(ticker));
                    if (matchedHolding) {
                        quoteMap[matchedHolding.ticker] = pct;
                    }
                }
            }
        });
        return quoteMap;
    } catch (error) {
        console.error('Failed to fetch real-time quotes:', error);
        throw error; // Re-throw to allow caller to handle fallback
    }
};

/**
 * Fetch generic Tencent quotes for any list of codes (sh000001, sz399001, etc.)
 * Returns { [code]: { currentPrice: number, changePct: number } }
 */
export const fetchGeneralTencentQuotes = async (codes: string[]): Promise<Record<string, { currentPrice: number, changePct: number }>> => {
    if (!codes || codes.length === 0) return {};

    try {
        const qtUrl = `${TENCENT_STOCK_API}${codes.join(',')}`;
        const res = await fetch(qtUrl);
        const qText = await res.text();

        const quoteMap: Record<string, { currentPrice: number, changePct: number }> = {};
        qText.split(';').forEach(line => {
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
export const fetchHistoricalIndexPrice = async (code: string, date: string): Promise<number | null> => {
    return new Promise((resolve) => {
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

        (window as any)[callbackName] = (json: any) => {
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
            delete (window as any)[callbackName];
        };

        script.onerror = () => {
            console.error(`Failed to load historical index script for ${code} on ${date}`);
            cleanup();
            resolve(null);
        };

        document.head.appendChild(script);
    });
};

/**
 * Checks if the Chinese stock market is currently trading based on the update time of the Shanghai Composite Index.
 * Falls back to local time checks if the API fails.
 * @returns A promise evaluating to true if the market is open and trading (after 9:20 AM on a weekday).
 */
export const checkIsMarketTrading = async (): Promise<boolean> => {
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
};
