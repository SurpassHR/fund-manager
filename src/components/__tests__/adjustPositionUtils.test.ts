import { describe, expect, it } from 'vitest';
import { parseSellInputToShares } from '../adjustPositionUtils';

describe('parseSellInputToShares', () => {
  it('parses plain shares input', () => {
    const result = parseSellInputToShares('50', 200);
    expect(result.shares).toBe(50);
    expect(result.kind).toBe('shares');
  });

  it('parses percent input', () => {
    const result = parseSellInputToShares('50%', 200);
    expect(result.shares).toBe(100);
    expect(result.kind).toBe('percent');
  });

  it('parses fraction input', () => {
    const result = parseSellInputToShares('1/3', 300);
    expect(result.shares).toBe(100);
    expect(result.kind).toBe('fraction');
  });

  it('returns error on invalid fraction', () => {
    const result = parseSellInputToShares('1/0', 300);
    expect(result.shares).toBeNull();
    expect(result.error).toBe('invalid');
  });

  it('returns error on invalid content', () => {
    const result = parseSellInputToShares('abc', 300);
    expect(result.shares).toBeNull();
    expect(result.error).toBe('invalid');
  });
});
