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

export const fetchMarketIndices = async (): Promise<MarketIndex[]> => {
    try {
        const response = await fetch('https://www.morningstar.cn/cn-api/market/index');
        if (!response.ok) {
            throw new Error(`Market API error: ${response.status}`);
        }
        const json: FullApiResponse = await response.json();

        // Extract China indices
        const chinaIndices = json?.data?.watchData?.data?.china || [];

        return chinaIndices.map(item => ({
            name: item.name,
            value: item.totalAmount,
            // Mapping:
            // Internal 'change' -> API 'changeAmount'
            // Internal 'changePct' -> API 'change'
            change: (item as any).changeAmount || 0,
            changePct: item.change
        }));
    } catch (error) {
        console.error('Failed to fetch market indices:', error);
        return [];
    }
};

// --- Morningstar API Functions ---

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

export const fetchEastMoneyLatestNav = async (fundCode: string): Promise<{ nav: number, navDate: string, navChangePercent: number } | null> => {
    try {
        const response = await fetch(`/eastmoney-api/F10DataApi.aspx?type=lsjz&code=${fundCode}&page=1&per=1`);
        if (!response.ok) return null;
        const text = await response.text();

        // 解析返回的 JS 文本： var apidata={ content:"<table...",...};
        // 匹配第一行: <td>2026-02-24</td><td class='tor bold'>1.8649</td><td class='tor bold'>1.8649</td><td class='tor bold grn'>-6.21%</td>
        const regex = /<tr>\s*<td>(\d{4}-\d{2}-\d{2})<\/td>\s*<td[^>]*>([\d\.]+)<\/td>\s*<td[^>]*>[\d\.]+<\/td>\s*<td[^>]*>([-\d\.]+)%?<\/td>/;
        const match = text.match(regex);

        if (match) {
            const navDate = match[1];
            const nav = parseFloat(match[2]);
            const navChangePercent = parseFloat(match[3]) || 0; // 处理可能的空值或无效值
            return { nav, navDate, navChangePercent };
        }
        return null;
    } catch (error) {
        console.error(`Failed to fetch EastMoney NAV for ${fundCode}`, error);
        return null;
    }
};

// --- Tencent Stock API Functions ---

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
