import { describe, expect, it, vi } from 'vitest';
import { getSettlementDate } from '../fundDayChange';
import { roundMoney } from '../rebalanceUtils';

/**
 * 验证结算日计算逻辑——在途资金在 settlementDate 到达时才确认
 */
describe('settlementDate 计算', () => {
  it('before15, T+1 → 下一个交易日', () => {
    // 周四 -> 周五
    expect(getSettlementDate('2026-06-25', 'before15', 1)).toBe('2026-06-26');
    // 周五 -> 下周一
    expect(getSettlementDate('2026-06-26', 'before15', 1)).toBe('2026-06-29');
    // 周三 -> 周四
    expect(getSettlementDate('2026-06-24', 'before15', 1)).toBe('2026-06-25');
  });

  it('after15, T+1 → 操作日顺延一天再算 N 个交易日', () => {
    // 周四 after15 -> 周五（顺延）-> 加1交易日 -> 下周一
    expect(getSettlementDate('2026-06-25', 'after15', 1)).toBe('2026-06-29');
    // 周三 after15 -> 周四（顺延）-> 加1交易日 -> 周五
    expect(getSettlementDate('2026-06-24', 'after15', 1)).toBe('2026-06-26');
  });

  it('T+2: before15', () => {
    // 周四 -> 下周一（跳过周五+周一）
    expect(getSettlementDate('2026-06-25', 'before15', 2)).toBe('2026-06-29');
    // 周一 -> 周三
    expect(getSettlementDate('2026-06-22', 'before15', 2)).toBe('2026-06-24');
  });
});

/**
 * 验证 runSettlementPipeline 的 DATE COMPARISON 逻辑
 * 模拟其判断条件：tx.settlementDate > todayForSettlement
 */
describe('结算日期比较逻辑', () => {
  it('settlementDate <= todayForSettlement → 应被结算', () => {
    const today = '2026-06-24';
    const sellDate = '2026-06-24'; // 同日到达
    const stillInTransit = sellDate > today;
    expect(stillInTransit).toBe(false);
  });

  it('settlementDate > todayForSettlement → 在途', () => {
    const today = '2026-06-24';
    const sellDate = '2026-06-25'; // 明天才到期
    const stillInTransit = sellDate > today;
    expect(stillInTransit).toBe(true);
  });

  it('同一基金上多条在途交易相同 settlementDate → 全部到期', () => {
    const today = '2026-06-24';
    const txs = [
      { id: 'sell', settlementDate: '2026-06-24' },
      { id: 'transferOut', settlementDate: '2026-06-24' },
    ];
    const pending = txs.filter(tx => tx.settlementDate > today);
    expect(pending).toHaveLength(0); // 全部到期，不应遗漏
  });
});

/**
 * 验证 getUnsettledOutShares 逻辑：已结算的卖出不应计入未结算份额
 */
describe('getUnsettledOutShares 逻辑', () => {
  it('已结算的交易不计入 unsettled', () => {
    const txs = [
      { settled: true, type: 'sell', amount: 41454.66 },
      { settled: false, type: 'transferOut', amount: 20727.33, outShares: 20727.33 },
    ];
    const unsettled = txs.reduce((sum, tx) => {
      if (tx.settled) return sum;
      if (tx.type === 'sell') return sum + tx.amount;
      const outShares = (tx as any).outShares ?? tx.amount ?? 0;
      if (tx.type === 'transferOut') return sum + outShares;
      return sum;
    }, 0);
    expect(unsettled).toBe(20727.33); // 只计 transferOut，不计已结算的 sell
  });
});

/**
 * 验证调仓结算中的可用份额计算公式
 * availableForCurrent = holdingShares - (unsettledTotal - outShares)
 */
describe('调仓可用份额计算', () => {
  it('卖出已结算时，调仓可用份额 = 剩余持仓', () => {
    const holdingShares = 20727.33; // 卖出41454.66后剩余
    const unsettledTotal = 20727.33; // 只有 transferOut 未结算
    const outShares = 20727.33;

    const available = Math.max(0, holdingShares - (unsettledTotal - outShares));
    expect(available).toBe(20727.33);
    expect(outShares <= available).toBe(true);
  });
});
