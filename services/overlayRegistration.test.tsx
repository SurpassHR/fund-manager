import type React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useOverlayRegistration } from './overlayRegistration.tsx';
import { getActiveOverlayId, resetOverlayStack } from './overlayStack';

const Demo: React.FC<{ open: boolean }> = ({ open }) => {
  useOverlayRegistration('demo', open, () => undefined);
  return null;
};

describe('useOverlayRegistration', () => {
  beforeEach(() => resetOverlayStack());

  it('registers on open and unregisters on close', () => {
    const { rerender, unmount } = render(<Demo open={false} />);
    expect(getActiveOverlayId()).toBe(null);

    rerender(<Demo open />);
    expect(getActiveOverlayId()).toBe('demo');

    rerender(<Demo open={false} />);
    expect(getActiveOverlayId()).toBe(null);

    unmount();
    expect(getActiveOverlayId()).toBe(null);
  });
});
