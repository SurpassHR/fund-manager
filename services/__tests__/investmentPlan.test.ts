import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Fund, InvestmentPlan, PendingTransaction } from '../../types';
import { db } from '../db';
import {
  executeInvestmentPlans,
  shouldExecuteToday,
  getAllInvestmentPlans,
  addInvestmentPlan,
  updateInvestmentPlan,
  deleteInvestmentPlan,
} from '../investmentPlan';

// --- helpers ---

const buildPlan = (overrides?: Partial<InvestmentPlan>): InvestmentPlan => ({
  id: 1,
  fundCode: '000001',
  amount: 100,
  active: true,
  frequency: 'daily',
  createdAt: '2026-05-10',
  ...overrides,
});

const buildFund = (overrides?: Partial<Fund>): Fund => ({
  id: 1,
  code: '000001',
  name: '测试基金',
  platform: '天天基金',
  holdingShares: 100,
  costPrice: 1.5,
  currentNav: 1.8,
  lastUpdate: '2026-05-14',
  dayChangePct: 0.5,
  dayChangeVal: 0.01,
  settlementDays: 1,
  ...overrides,
});

const mockToday = (dateStr: string) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(dateStr));
  return () => vi.useRealTimers();
};

// --- tests ---

describe('executeInvestmentPlans', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lastExecutedDate 为今日时跳过，防止重复执行', async () => {
    const restore = mockToday('2026-05-14');

    const alreadyExecutedPlan = buildPlan({ id: 1, lastExecutedDate: '2026-05-14' });
    const fund = buildFund();

    vi.spyOn(db.investmentPlans, 'where').mockReturnValue({
      equals: () => ({ toArray: () => Promise.resolve([alreadyExecutedPlan]) }),
    } as never);
    const fundSpy = vi.spyOn(db.funds, 'toArray').mockResolvedValue([fund]);
    const fundUpdateSpy = vi.spyOn(db.funds, 'update').mockResolvedValue(1);
    const planUpdateSpy = vi.spyOn(db.investmentPlans, 'update').mockResolvedValue(1);

    await executeInvestmentPlans();

    // 不应该更新任何基金（因为今天已经执行过）
    expect(fundUpdateSpy).not.toHaveBeenCalled();
    expect(planUpdateSpy).not.toHaveBeenCalled();

    restore();
  });

  it('正常执行：创建买入在途交易并更新 lastExecutedDate', async () => {
    const restore = mockToday('2026-05-14');

    const plan = buildPlan({ id: 1, lastExecutedDate: '2026-05-13' });
    const fund = buildFund({
      pendingTransactions: [
        {
          id: 'existing-tx',
          type: 'buy',
          date: '2026-05-10',
          time: 'before15',
          amount: 50,
          settlementDate: '2026-05-13',
          settled: false,
        },
      ],
    });

    vi.spyOn(db.investmentPlans, 'where').mockReturnValue({
      equals: () => ({ toArray: () => Promise.resolve([plan]) }),
    } as never);
    vi.spyOn(db.funds, 'toArray').mockResolvedValue([fund]);
    const fundUpdateSpy = vi.spyOn(db.funds, 'update').mockResolvedValue(1);
    const planUpdateSpy = vi.spyOn(db.investmentPlans, 'update').mockResolvedValue(1);

    await executeInvestmentPlans();

    // 验证基金更新被调用
    expect(fundUpdateSpy).toHaveBeenCalledTimes(1);
    expect(fundUpdateSpy).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        pendingTransactions: expect.arrayContaining([
          expect.objectContaining({ id: 'existing-tx' }),
          expect.objectContaining({
            type: 'buy',
            amount: 100,
            date: '2026-05-14',
            time: 'before15',
            settled: false,
          }),
        ]),
      }),
    );

    // 验证计划 lastExecutedDate 更新
    expect(planUpdateSpy).toHaveBeenCalledWith(1, { lastExecutedDate: '2026-05-14' });

    restore();
  });

  it('目标基金不存在时跳过', async () => {
    const restore = mockToday('2026-05-14');

    const plan = buildPlan({ id: 1, fundCode: '999999', lastExecutedDate: '2026-05-13' });
    const otherFund = buildFund({ code: '000001' }); // 不同代码

    vi.spyOn(db.investmentPlans, 'where').mockReturnValue({
      equals: () => ({ toArray: () => Promise.resolve([plan]) }),
    } as never);
    vi.spyOn(db.funds, 'toArray').mockResolvedValue([otherFund]);
    const fundUpdateSpy = vi.spyOn(db.funds, 'update').mockResolvedValue(1);
    const planUpdateSpy = vi.spyOn(db.investmentPlans, 'update').mockResolvedValue(1);

    await executeInvestmentPlans();

    expect(fundUpdateSpy).not.toHaveBeenCalled();
    expect(planUpdateSpy).not.toHaveBeenCalled();

    restore();
  });

  it('settlementDate 使用基金级别的 T+N 计算', async () => {
    const restore = mockToday('2026-05-14'); // Wednesday

    const plan = buildPlan({ id: 1, lastExecutedDate: '2026-05-13' });
    const fund = buildFund({ settlementDays: 3 }); // T+3

    vi.spyOn(db.investmentPlans, 'where').mockReturnValue({
      equals: () => ({ toArray: () => Promise.resolve([plan]) }),
    } as never);
    vi.spyOn(db.funds, 'toArray').mockResolvedValue([fund]);
    const fundUpdateSpy = vi.spyOn(db.funds, 'update').mockResolvedValue(1);
    vi.spyOn(db.investmentPlans, 'update').mockResolvedValue(1);

    await executeInvestmentPlans();

    const updateArg = fundUpdateSpy.mock.calls[0]?.[1] as
      | { pendingTransactions: PendingTransaction[] }
      | undefined;
    const newTx = updateArg?.pendingTransactions?.find((tx) => tx.id.startsWith('inv_'));
    expect(newTx).toBeDefined();
    // Wednesday + T+3 trading days = next Monday
    // 14(Wed) -> 15(Thu, T+1) -> 16(Fri, T+2) -> 19(Mon, T+3)
    expect(newTx?.settlementDate).toBe('2026-05-19');

    restore();
  });

  it('多个活跃计划同时执行', async () => {
    const restore = mockToday('2026-05-14');

    const plan1 = buildPlan({
      id: 1,
      fundCode: '000001',
      amount: 100,
      lastExecutedDate: '2026-05-13',
    });
    const plan2 = buildPlan({
      id: 2,
      fundCode: '000002',
      amount: 200,
      lastExecutedDate: '2026-05-13',
    });
    const fund1 = buildFund({ id: 1, code: '000001' });
    const fund2 = buildFund({ id: 2, code: '000002' });

    vi.spyOn(db.investmentPlans, 'where').mockReturnValue({
      equals: () => ({ toArray: () => Promise.resolve([plan1, plan2]) }),
    } as never);
    vi.spyOn(db.funds, 'toArray').mockResolvedValue([fund1, fund2]);
    const fundUpdateSpy = vi.spyOn(db.funds, 'update').mockResolvedValue(1);
    const planUpdateSpy = vi.spyOn(db.investmentPlans, 'update').mockResolvedValue(1);

    await executeInvestmentPlans();

    expect(fundUpdateSpy).toHaveBeenCalledTimes(2);
    expect(planUpdateSpy).toHaveBeenCalledTimes(2);

    restore();
  });

  it('无活跃计划时不执行任何操作', async () => {
    const restore = mockToday('2026-05-14');

    vi.spyOn(db.investmentPlans, 'where').mockReturnValue({
      equals: () => ({ toArray: () => Promise.resolve([]) }),
    } as never);
    const fundSpy = vi.spyOn(db.funds, 'toArray');
    const fundUpdateSpy = vi.spyOn(db.funds, 'update');

    await executeInvestmentPlans();

    // funds.toArray 不应该被调用（提前返回）
    expect(fundSpy).not.toHaveBeenCalled();
    expect(fundUpdateSpy).not.toHaveBeenCalled();

    restore();
  });
});

describe('addInvestmentPlan', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('创建计划时自动设置 createdAt', async () => {
    const restore = mockToday('2026-05-14');

    const addSpy = vi.spyOn(db.investmentPlans, 'add').mockResolvedValue(1);

    await addInvestmentPlan({ fundCode: '000001', amount: 100, active: true, frequency: 'daily' });

    expect(addSpy).toHaveBeenCalledWith({
      fundCode: '000001',
      amount: 100,
      active: true,
      frequency: 'daily',
      createdAt: '2026-05-14',
    });

    restore();
  });
});

describe('updateInvestmentPlan', () => {
  it('更新计划字段', async () => {
    const updateSpy = vi.spyOn(db.investmentPlans, 'update').mockResolvedValue(1);

    await updateInvestmentPlan(1, { active: false, amount: 200 });

    expect(updateSpy).toHaveBeenCalledWith(1, { active: false, amount: 200 });
  });
});

describe('deleteInvestmentPlan', () => {
  it('删除计划', async () => {
    const deleteSpy = vi.spyOn(db.investmentPlans, 'delete').mockResolvedValue(undefined);

    await deleteInvestmentPlan(1);

    expect(deleteSpy).toHaveBeenCalledWith(1);
  });
});

describe('getAllInvestmentPlans', () => {
  it('返回所有计划', async () => {
    const plans: InvestmentPlan[] = [buildPlan({ id: 1 }), buildPlan({ id: 2, active: false })];
    vi.spyOn(db.investmentPlans, 'toArray').mockResolvedValue(plans);

    const result = await getAllInvestmentPlans();
    expect(result).toHaveLength(2);
  });
});

describe('shouldExecuteToday', () => {
  it('daily 频率总是返回 true', () => {
    expect(shouldExecuteToday('daily')).toBe(true);
  });

  it('weekly 频率匹配星期几', () => {
    const today = new Date();
    const currentDay = today.getDay();
    expect(shouldExecuteToday('weekly', currentDay)).toBe(true);
    const nonMatchingDay = (currentDay + 1) % 7;
    expect(shouldExecuteToday('weekly', nonMatchingDay)).toBe(false);
  });

  it('weekly 缺少 frequencyDay 返回 false', () => {
    expect(shouldExecuteToday('weekly')).toBe(false);
  });

  it('monthly 频率匹配日期', () => {
    const today = new Date();
    const currentDate = today.getDate();
    if (currentDate <= 28) {
      expect(shouldExecuteToday('monthly', currentDate)).toBe(true);
    }
    const nonMatchingDate = currentDate === 1 ? 2 : 1;
    if (nonMatchingDate <= 28) {
      expect(shouldExecuteToday('monthly', nonMatchingDate)).toBe(false);
    }
  });

  it('monthly 缺少 frequencyDay 返回 false', () => {
    expect(shouldExecuteToday('monthly')).toBe(false);
  });
});

describe('executeInvestmentPlans 频率过滤', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('weekly 频率不匹配时跳过执行', async () => {
    const restore = mockToday('2026-05-14'); // Thursday (day=4)
    const todayDow = new Date('2026-05-14').getDay(); // 4

    // 设置频率为不匹配的星期 (如 day != today)
    const nonMatchingDay = todayDow === 0 ? 1 : 0;
    const plan = buildPlan({
      id: 1,
      frequency: 'weekly',
      frequencyDay: nonMatchingDay,
      lastExecutedDate: '2026-05-13',
    });
    const fund = buildFund();

    vi.spyOn(db.investmentPlans, 'where').mockReturnValue({
      equals: () => ({ toArray: () => Promise.resolve([plan]) }),
    } as never);
    vi.spyOn(db.funds, 'toArray').mockResolvedValue([fund]);
    const fundUpdateSpy = vi.spyOn(db.funds, 'update').mockResolvedValue(1);
    const planUpdateSpy = vi.spyOn(db.investmentPlans, 'update').mockResolvedValue(1);

    await executeInvestmentPlans();

    // 频率不匹配，不应该更新
    expect(fundUpdateSpy).not.toHaveBeenCalled();
    expect(planUpdateSpy).not.toHaveBeenCalled();

    restore();
  });
});
