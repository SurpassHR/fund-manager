import { expect, test } from 'vitest';
import { deriveFundGainActivationState, getSettlementDate } from '../db';

test('getSettlementDate respects T+2 trading days across weekend', () => {
  // Friday 2023-09-01, settlementDays = 2, before15 (no after15 shift)
  const result = getSettlementDate('2023-09-01', 'before15', 2);
  // Expected: Monday 2023-09-04 (first trading day) and Tuesday 2023-09-05 (second)
  expect(result).toBe('2023-09-05');
});

test('gain inactive before settlement date', () => {
  const buyDate = '2023-09-01'; // Friday
  const settlementDays = 2;
  const settlement = getSettlementDate(buyDate, 'before15', settlementDays);
  const effectivePctDate = '2023-09-04'; // Monday, still before settlement (Tuesday)

  const activation = deriveFundGainActivationState({
    buyDate,
    buyTime: 'before15',
    settlementDays,
    effectivePctDate,
    costPrice: 1,
  });

  expect(settlement).toBe('2023-09-05');
  expect(activation.isGainActive).toBe(false);
  expect(activation.dayChangeBaseNav).toBeUndefined();
});

test('gain becomes active on settlement date', () => {
  const activation = deriveFundGainActivationState({
    buyDate: '2023-09-01',
    buyTime: 'before15',
    settlementDays: 2,
    effectivePctDate: '2023-09-05',
    costPrice: 1.2345,
  });

  expect(activation.isGainActive).toBe(true);
  expect(activation.dayChangeBaseNav).toBe(1.2345);
});
