import { MarketIndex } from '../types';

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
