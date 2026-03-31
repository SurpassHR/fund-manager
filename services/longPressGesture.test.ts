import { describe, expect, it } from 'vitest';
import { hasTouchMovedBeyondThreshold } from './longPressGesture';

describe('hasTouchMovedBeyondThreshold', () => {
  it('位移未超过阈值时返回 false', () => {
    const moved = hasTouchMovedBeyondThreshold({ x: 100, y: 100 }, { x: 108, y: 109 }, 12);

    expect(moved).toBe(false);
  });

  it('纵向位移超过阈值时返回 true', () => {
    const moved = hasTouchMovedBeyondThreshold({ x: 100, y: 100 }, { x: 101, y: 120 }, 12);

    expect(moved).toBe(true);
  });

  it('横向位移超过阈值时返回 true', () => {
    const moved = hasTouchMovedBeyondThreshold({ x: 100, y: 100 }, { x: 113, y: 100 }, 12);

    expect(moved).toBe(true);
  });
});
