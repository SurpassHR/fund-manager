import { Fund, MarketIndex } from './types';

export const INITIAL_FUNDS: Fund[] = [];

export const MOCK_INDICES: MarketIndex[] = [
  { name: 'Shanghai Composite', value: 3086.12, change: -12.55, changePct: -0.40 },
  { name: 'Shenzhen Component', value: 10051.62, change: -75.58, changePct: -0.75 },
  { name: 'ChiNext Index', value: 1985.33, change: -22.11, changePct: -1.10 },
];

export const FILTERS = ['All', 'Default', 'Alipay', 'Tencent', 'Bank', 'Others'];