import { db, getSettlementDate } from './db';
import { deductAvailableForBuy } from './assetAllocation';
import type { InvestmentPlan, InvestmentFrequency, PendingTransaction } from '../types';

const getLocalDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// === 频率匹配 ===

/**
 * 检查今天是否匹配定投频率。
 * - daily: 总是匹配
 * - weekly: frequencyDay 等于今天星期几 (0=Sun, 6=Sat)
 * - monthly: frequencyDay 等于今天日期 (1-28)
 */
export const shouldExecuteToday = (
  frequency: InvestmentFrequency,
  frequencyDay?: number,
): boolean => {
  const today = new Date();
  switch (frequency) {
    case 'daily':
      return true;
    case 'weekly': {
      if (frequencyDay === undefined) return false;
      return today.getDay() === frequencyDay;
    }
    case 'monthly': {
      if (frequencyDay === undefined) return false;
      return today.getDate() === frequencyDay;
    }
    default:
      return false;
  }
};

// === CRUD ===

export const addInvestmentPlan = async (plan: Omit<InvestmentPlan, 'id' | 'createdAt'>) => {
  return db.investmentPlans.add({
    ...plan,
    createdAt: getLocalDateString(),
  });
};

export const updateInvestmentPlan = async (id: number, changes: Partial<InvestmentPlan>) => {
  return db.investmentPlans.update(id, changes);
};

export const deleteInvestmentPlan = async (id: number) => {
  return db.investmentPlans.delete(id);
};

export const getActiveInvestmentPlans = async () => {
  return db.investmentPlans.where('active').equals(1).toArray();
};

export const getAllInvestmentPlans = async () => {
  return db.investmentPlans.toArray();
};

// === 每日定投执行 ===

let executionPromise: Promise<void> | null = null;

/**
 * 执行所有活跃定投计划：为每个当天满足频率且尚未执行的计划创建一笔买入在途交易。
 * 内置防重入锁，同一时刻只允许一次执行。
 * 使用 lastExecutedDate 防止同一天内重复执行。
 */
export const executeInvestmentPlans = async (): Promise<void> => {
  if (executionPromise) return executionPromise;

  executionPromise = (async () => {
    try {
      const today = getLocalDateString();
      const activePlans = await getActiveInvestmentPlans();

      if (activePlans.length === 0) return;

      const allFunds = await db.funds.toArray();
      const fundByCode = new Map(allFunds.map((f) => [f.code, f]));

      for (const plan of activePlans) {
        if (plan.lastExecutedDate === today) continue;

        // 频率不匹配则跳过
        if (!shouldExecuteToday(plan.frequency, plan.frequencyDay)) continue;

        const fund = fundByCode.get(plan.fundCode);
        if (!fund || !fund.id) continue;

        const settlementDays = fund.settlementDays ?? 1;
        const settlementDate = getSettlementDate(today, 'before15', settlementDays);

        const newTx: PendingTransaction = {
          id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          type: 'buy',
          date: today,
          time: 'before15',
          amount: plan.amount,
          settlementDate,
          settled: false,
        };

        const existingPending = fund.pendingTransactions || [];
        await db.funds.update(fund.id, {
          pendingTransactions: [...existingPending, newTx],
        });

        deductAvailableForBuy(plan.amount);

        await db.investmentPlans.update(plan.id!, { lastExecutedDate: today });
      }
    } catch (err) {
      console.error('定投计划执行失败', err);
    } finally {
      executionPromise = null;
    }
  })();

  return executionPromise;
};
