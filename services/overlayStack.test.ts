import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  closeTopOverlay,
  getActiveOverlayId,
  registerOverlay,
  resetOverlayStack,
  unregisterOverlay,
} from './overlayStack';

describe('overlayStack', () => {
  beforeEach(() => {
    resetOverlayStack();
  });

  it('closes top overlay in LIFO order', () => {
    const closeA = vi.fn();
    const closeB = vi.fn();

    registerOverlay('a', closeA);
    registerOverlay('b', closeB);

    closeTopOverlay();
    expect(closeB).toHaveBeenCalledTimes(1);
    expect(closeA).toHaveBeenCalledTimes(0);
  });

  it('moves re-registered overlay to top', () => {
    const closeA = vi.fn();
    const closeB = vi.fn();

    registerOverlay('a', closeA);
    registerOverlay('b', closeB);
    registerOverlay('a', closeA);

    closeTopOverlay();
    expect(closeA).toHaveBeenCalledTimes(1);
  });

  it('tracks active overlay id', () => {
    const closeA = vi.fn();
    registerOverlay('a', closeA);
    expect(getActiveOverlayId()).toBe('a');
    unregisterOverlay('a');
    expect(getActiveOverlayId()).toBe(null);
  });
});
