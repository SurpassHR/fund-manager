import { fetchRecentHistoricalNavs } from './api';
import type { FundStreak } from '../types';

/**
 * 从每日涨跌幅数组计算连涨/连跌天数。
 * @param changes 每日涨跌幅数组，索引 0 为最近一个交易日
 * @returns 连涨/连跌信息；天数 < 2 或首个有效值为平盘时返回 null
 */
export function computeStreak(changes: number[]): FundStreak | null {
  if (changes.length === 0) return null;

  const dir = classifyChange(changes[0]);
  if (!dir) return null;

  let days = 1;
  for (let i = 1; i < changes.length; i++) {
    if (classifyChange(changes[i]) !== dir) break;
    days++;
  }

  return days >= 2 ? { days, direction: dir } : null;
}

/**
 * 将涨跌幅归类为方向。
 * > 0 → 'up', < 0 → 'down', === 0 → null（平盘）
 */
function classifyChange(change: number): 'up' | 'down' | null {
  if (change > 0) return 'up';
  if (change < 0) return 'down';
  return null;
}

/**
 * 获取基金最近 N 个交易日的日涨跌幅序列（%）。
 * 指数 0 为最近一个交易日。
 * @param fundCode 基金代码
 * @param maxDays 最大返回天数（默认 10）
 * @returns 日涨跌幅数组，失败时返回空数组
 */
export async function fetchRecentDayChanges(fundCode: string, maxDays = 10): Promise<number[]> {
  const navs = await fetchRecentHistoricalNavs(fundCode, maxDays + 3);
  if (navs.length < 2) return [];

  const changes: number[] = [];
  for (let i = 0; i < navs.length - 1 && changes.length < maxDays; i++) {
    const prevNav = navs[i + 1].nav;
    if (prevNav <= 0) continue;
    const pct = ((navs[i].nav - prevNav) / prevNav) * 100;
    changes.push(pct);
  }
  return changes;
}

/**
 * 获取基金的连涨/连跌信息。
 * 组合 fetchRecentDayChanges + computeStreak。
 * @param fundCode 基金代码
 * @returns 连涨/连跌信息；天数不足或获取失败时返回 null
 */
export async function fetchFundStreak(fundCode: string): Promise<FundStreak | null> {
  const changes = await fetchRecentDayChanges(fundCode);
  return computeStreak(changes);
}

// ---- 缓存层 ----

const streakCache = new Map<string, { result: FundStreak | null; ts: number }>();
const STREAK_CACHE_TTL = 4 * 60 * 60 * 1000; // 4 小时

/**
 * 带缓存的单基金连涨/连跌查询。
 * 4 小时内相同基金代码命中缓存，避免重复请求东方财富 API。
 */
export async function getCachedFundStreak(fundCode: string): Promise<FundStreak | null> {
  const cached = streakCache.get(fundCode);
  if (cached && Date.now() - cached.ts < STREAK_CACHE_TTL) {
    return cached.result;
  }
  const result = await fetchFundStreak(fundCode);
  streakCache.set(fundCode, { result, ts: Date.now() });
  return result;
}

/**
 * 批量获取多个基金的连涨/连跌信息，返回 code → FundStreak | null 的映射。
 * 内部并行请求但通过东方财富队列自动串行化（受 api.ts 中 eastMoneyQueue 控制）。
 */
export async function getCachedFundStreaks(
  codes: string[],
): Promise<Map<string, FundStreak | null>> {
  const results = await Promise.all(codes.map((code) => getCachedFundStreak(code)));
  const map = new Map<string, FundStreak | null>();
  codes.forEach((code, i) => map.set(code, results[i]));
  return map;
}
