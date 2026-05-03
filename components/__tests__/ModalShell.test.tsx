/// <reference types="vitest/globals" />
import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ModalShell } from '../ModalShell';
import { EdgeSwipeProvider } from '../../services/edgeSwipeState';
import { closeTopOverlay, resetOverlayStack } from '../../services/overlayStack';

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

const ControlledEdgeSwipeModal = () => {
  const [isOpen, setIsOpen] = React.useState(true);

  return (
    <EdgeSwipeProvider>
      <button type="button" onClick={() => setIsOpen(true)}>
        open modal
      </button>
      <ModalShell isOpen={isOpen} onClose={() => setIsOpen(false)} overlayId="test-modal" edgeSwipe>
        <div>modal content</div>
      </ModalShell>
    </EdgeSwipeProvider>
  );
};

beforeEach(() => {
  resetOverlayStack();
});

describe('ModalShell acrylic frosted glass', () => {
  it('renders backdrop with semi-transparent dark overlay for acrylic effect', () => {
    renderModalShell();

    const backdrop = document.querySelector('.backdrop-blur-md')!;
    expect(backdrop).not.toBeNull();
    expect(backdrop).toHaveClass('bg-black/30');
  });

  it('renders card with theme-aware acrylic background and blur', () => {
    renderModalShell();

    const card = document.querySelector('.backdrop-blur-xl')!;
    expect(card).not.toBeNull();
    expect(card).toHaveClass('bg-white/80');
    expect(card).toHaveClass('dark:bg-card-dark/10');
    expect(card).not.toHaveClass('bg-white/10');
  });

  it('always applies theme-aware acrylic classes even with custom className', () => {
    renderModalShell({ className: 'custom-structural border-2' });

    const card = document.querySelector('.backdrop-blur-xl')!;
    expect(card).not.toBeNull();
    expect(card).toHaveClass('bg-white/80');
    expect(card).toHaveClass('dark:bg-card-dark/10');
    expect(card).not.toHaveClass('bg-white/10');
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

  it('resets edge swipe close offset when reopening the same modal', async () => {
    render(<ControlledEdgeSwipeModal />);

    const backdrop = document.querySelector('.backdrop-blur-md') as HTMLElement;
    act(() => {
      closeTopOverlay({ source: 'edge-swipe', targetX: 480 });
    });

    await waitFor(() => {
      expect(backdrop).toHaveStyle({ transform: 'translateX(480px)' });
    });

    fireEvent.transitionEnd(backdrop);

    await waitFor(() => {
      expect(screen.queryByText('modal content')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'open modal' }));

    await waitFor(() => {
      expect(screen.getByText('modal content')).toBeInTheDocument();
    });

    const reopenedBackdrop = document.querySelector('.backdrop-blur-md') as HTMLElement;
    expect(reopenedBackdrop).toHaveStyle({ transform: 'translateX(0px)' });
  });
});
