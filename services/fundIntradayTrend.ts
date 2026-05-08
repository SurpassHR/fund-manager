import type { IntradayPoint } from './api';
import type { EquityHolding } from '../types';

export interface FundIntradayPoint {
  /** Time string in HH:MM format */
  time: string;
  /** Estimated net asset value at that time */
  estimatedNav: number;
}

const normalizeTicker = (ticker?: string) => (ticker ? ticker.replace(/\D/g, '') : '');

/**
 * 将个股分时数据按持仓权重加权合成为基金级日内走势。
 *
 * @param intradayData      — key 为 ticker（可带后缀，如 000001.SZ），value 为分时点数组
 * @param holdings          — 持仓列表，含 ticker 和 weight
 * @param lastNav           — 基金最新净值，作为估算锚点
 * @param stockPrevCloseMap — 可选，normalized ticker → 前收盘价；提供时以前收盘价为基准，否则以首点价格为基准
 * @returns 按时间排序的基金估算净值序列，有效权重为 0 时返回空数组
 */
export const calcFundIntradayTrend = (
  intradayData: Record<string, IntradayPoint[]>,
  holdings: EquityHolding[],
  lastNav: number,
  stockPrevCloseMap?: Record<string, number>,
): FundIntradayPoint[] => {
  // 1. 匹配持仓与分时数据
  const matched: { weight: number; points: IntradayPoint[]; basePrice: number }[] = [];
  let totalWeight = 0;

  const intradayKeys = new Map<string, string>(); // normalized → original key
  for (const key of Object.keys(intradayData)) {
    const nk = normalizeTicker(key);
    if (nk) intradayKeys.set(nk, key);
  }

  for (const holding of holdings) {
    const nk = normalizeTicker(holding.ticker);
    if (!nk) continue;

    const dataKey = intradayKeys.get(nk);
    if (!dataKey) continue;

    const points = intradayData[dataKey];
    if (!points || points.length < 2) continue;

    const firstPrice = points[0].price;
    if (firstPrice === 0 || Number.isNaN(firstPrice)) continue;

    // 以前收盘价为基准（若提供且有效），否则以首点（开盘价）为基准
    const prevClose = stockPrevCloseMap?.[nk];
    const basePrice =
      prevClose && prevClose > 0 && !Number.isNaN(prevClose) ? prevClose : firstPrice;

    matched.push({ weight: holding.weight, points, basePrice });
    totalWeight += holding.weight;
  }

  if (matched.length === 0 || totalWeight === 0) return [];

  // 2. 收集所有唯一时间点并排序
  const timeSet = new Set<string>();
  for (const { points } of matched) {
    for (const p of points) {
      timeSet.add(p.time);
    }
  }
  const allTimes = Array.from(timeSet).sort();

  // 3. 为每只个股计算相对于基准价的涨跌幅序列，缺失点 forward fill
  const stockChangeSeries: number[][] = [];

  for (const { points, basePrice } of matched) {
    const changes: number[] = [];
    let lastKnownPrice = points[0].price;
    let pointIdx = 0;

    for (const time of allTimes) {
      while (pointIdx < points.length && points[pointIdx].time <= time) {
        lastKnownPrice = points[pointIdx].price;
        pointIdx++;
      }
      changes.push((lastKnownPrice / basePrice - 1) * 100);
    }

    stockChangeSeries.push(changes);
  }

  // 4. 按持仓权重加权求和，计算估算净值
  const result: FundIntradayPoint[] = [];
  for (let i = 0; i < allTimes.length; i++) {
    let weightedChange = 0;
    for (let j = 0; j < matched.length; j++) {
      if (j >= stockChangeSeries.length) break;
      weightedChange += (matched[j].weight / totalWeight) * stockChangeSeries[j][i];
    }
    result.push({
      time: allTimes[i],
      estimatedNav: lastNav * (1 + weightedChange / 100),
    });
  }

  return result;
};
