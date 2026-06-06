import { describe, it, expect } from 'vitest';
import { computeSwipeProgress } from '../edgeSwipeUtils';

describe('edgeSwipeUtils', () => {
  it('requires inward swipe by edge', () => {
    const resultLeft = computeSwipeProgress({
      edge: 'left',
      startX: 0,
      startY: 10,
      currentX: -10,
      currentY: 12,
      screenWidth: 300,
    });
    expect(resultLeft.isValid).toBe(false);
  });

  it('marks close when drag exceeds half width', () => {
    const result = computeSwipeProgress({
      edge: 'left',
      startX: 0,
      startY: 10,
      currentX: 200,
      currentY: 12,
      screenWidth: 300,
    });
    expect(result.shouldClose).toBe(true);
    expect(result.dragX).toBe(200);
  });

  it('closes for right edge inward swipe', () => {
    const result = computeSwipeProgress({
      edge: 'right',
      startX: 300,
      startY: 20,
      currentX: 80,
      currentY: 18,
      screenWidth: 300,
    });
    expect(result.isValid).toBe(true);
    expect(result.shouldClose).toBe(true);
  });

  it('does not close on invalid direction even with large drag', () => {
    const result = computeSwipeProgress({
      edge: 'left',
      startX: 0,
      startY: 10,
      currentX: -240,
      currentY: 12,
      screenWidth: 300,
    });
    expect(result.isValid).toBe(false);
    expect(result.shouldClose).toBe(false);
  });
});
