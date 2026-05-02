/// <reference types="vitest/globals" />
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ModalShell } from '../ModalShell';
import { EdgeSwipeProvider } from '../../services/edgeSwipeState';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ initial: _i, animate: _a, exit: _e, ...rest }: Record<string, unknown>) => (
      <div {...rest} />
    ),
  },
}));

const renderModalShell = (props: Partial<Parameters<typeof ModalShell>[0]> = {}) => {
  return render(
    <EdgeSwipeProvider>
      <ModalShell isOpen={true} onClose={vi.fn()} overlayId="test-modal" {...props}>
        <div>modal content</div>
      </ModalShell>
    </EdgeSwipeProvider>,
  );
};

describe('ModalShell acrylic frosted glass', () => {
  it('renders backdrop with semi-transparent dark overlay for acrylic effect', () => {
    renderModalShell();

    const backdrop = document.querySelector('.backdrop-blur-md')!;
    expect(backdrop).not.toBeNull();
    expect(backdrop).toHaveClass('bg-black/30');
  });

  it('renders card with semi-transparent background and blur for frosted glass', () => {
    renderModalShell();

    const card = document.querySelector('.backdrop-blur-xl')!;
    expect(card).not.toBeNull();
    expect(card).toHaveClass('bg-white/10');
    expect(card).toHaveClass('dark:bg-card-dark/10');
  });

  it('always applies acrylic transparency classes even with custom className', () => {
    renderModalShell({ className: 'custom-structural border-2' });

    const card = document.querySelector('.backdrop-blur-xl')!;
    expect(card).not.toBeNull();
    // 亚克力透明度类始终由 ModalShell 强制应用
    expect(card).toHaveClass('bg-white/10');
    expect(card).toHaveClass('dark:bg-card-dark/10');
    // 自定义结构类也保留
    expect(card).toHaveClass('custom-structural');
    expect(card).toHaveClass('border-2');
  });

  it('passes through onClose when clicking backdrop', () => {
    const onClose = vi.fn();
    renderModalShell({ onClose });

    const backdrop = document.querySelector('.backdrop-blur-md')!;
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders children inside card', () => {
    renderModalShell();

    expect(screen.getByText('modal content')).toBeInTheDocument();
  });
});
