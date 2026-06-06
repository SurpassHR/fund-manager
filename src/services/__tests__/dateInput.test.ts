/// <reference types="vitest/globals" />
import { describe, expect, it } from 'vitest';
import { isValidIsoDate, shiftIsoDateByDays } from '../dateInput';

describe('dateInput utils', () => {
  it('应校验合法与非法日期', () => {
    expect(isValidIsoDate('2026-04-01')).toBe(true);
    expect(isValidIsoDate('2026-02-29')).toBe(false);
    expect(isValidIsoDate('2024-02-29')).toBe(true);
    expect(isValidIsoDate('2026-4-1')).toBe(false);
    expect(isValidIsoDate('')).toBe(false);
  });

  it('应在跨月与跨年时正确按天调整', () => {
    expect(shiftIsoDateByDays('2026-04-01', -1)).toBe('2026-03-31');
    expect(shiftIsoDateByDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('应正确处理闰年边界', () => {
    expect(shiftIsoDateByDays('2024-03-01', -1)).toBe('2024-02-29');
    expect(shiftIsoDateByDays('2024-02-29', 1)).toBe('2024-03-01');
  });
});
