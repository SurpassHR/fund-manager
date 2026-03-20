import { describe, expect, it } from 'vitest';
import { getEffectiveOperationDate, roundMoney, roundShares } from './rebalanceUtils';

describe('rebalanceUtils', () => {
  it('keeps weekday date for before15', () => {
    expect(getEffectiveOperationDate('2026-03-18', 'before15')).toBe('2026-03-18');
  });

  it('moves to next weekday for after15', () => {
    expect(getEffectiveOperationDate('2026-03-20', 'after15')).toBe('2026-03-23');
  });

  it('moves weekend to monday', () => {
    expect(getEffectiveOperationDate('2026-03-21', 'before15')).toBe('2026-03-23');
  });

  it('rounds money and shares to six digits', () => {
    expect(roundMoney(1.12345678)).toBe(1.123457);
    expect(roundShares(3.45678912)).toBe(3.456789);
  });
});
