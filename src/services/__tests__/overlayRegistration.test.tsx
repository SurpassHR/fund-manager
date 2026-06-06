import type React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useOverlayRegistration } from '../overlayRegistration.tsx';
import { getActiveOverlayId, resetOverlayStack } from '../overlayStack';

const Demo: React.FC<{ open: boolean }> = ({ open }) => {
  useOverlayRegistration('demo', open, () => undefined);
  return null;
};

describe('useOverlayRegistration', () => {
  beforeEach(() => {
    resetOverlayStack();
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  });

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

  it('locks page scroll while overlay is open', () => {
    const { rerender, unmount } = render(<Demo open={false} />);

    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.style.overflow).toBe('');

    rerender(<Demo open />);
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');

    rerender(<Demo open={false} />);
    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.style.overflow).toBe('');

    unmount();
  });

  it('keeps page scroll locked until the last overlay closes', () => {
    const NestedDemo: React.FC<{ firstOpen: boolean; secondOpen: boolean }> = ({
      firstOpen,
      secondOpen,
    }) => {
      useOverlayRegistration('first', firstOpen, () => undefined);
      useOverlayRegistration('second', secondOpen, () => undefined);
      return null;
    };

    const { rerender } = render(<NestedDemo firstOpen secondOpen={false} />);
    expect(document.body.style.overflow).toBe('hidden');

    rerender(<NestedDemo firstOpen secondOpen />);
    expect(document.body.style.overflow).toBe('hidden');

    rerender(<NestedDemo firstOpen={false} secondOpen />);
    expect(document.body.style.overflow).toBe('hidden');

    rerender(<NestedDemo firstOpen={false} secondOpen={false} />);
    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.style.overflow).toBe('');
  });
});
