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
