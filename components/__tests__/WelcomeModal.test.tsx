/// <reference types="vitest/globals" />
import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WelcomeModal } from '../WelcomeModal';
import { LanguageProvider } from '../../services/i18n';
import { EdgeSwipeProvider } from '../../services/edgeSwipeState';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ initial: _i, animate: _a, exit: _e, ...rest }: Record<string, unknown>) => (
      <div {...rest} />
    ),
  },
}));

const CURRENT_VERSION = 'v0.2.0';

const renderWelcomeModal = () => {
  return render(
    <LanguageProvider>
      <EdgeSwipeProvider>
        <WelcomeModal />
      </EdgeSwipeProvider>
    </LanguageProvider>,
  );
};

describe('WelcomeModal', () => {
  it('opens changelog when receiving open event even after current version is seen', async () => {
    localStorage.setItem('lastSeenVersion', CURRENT_VERSION);

    renderWelcomeModal();

    expect(screen.queryByRole('button', { name: '我知道了' })).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new CustomEvent('open-changelog'));
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '我知道了' })).toBeInTheDocument();
    });
  });

  it('stores current version when closing', async () => {
    localStorage.removeItem('lastSeenVersion');

    renderWelcomeModal();

    const closeButton = await screen.findByRole('button', { name: '我知道了' });
    fireEvent.click(closeButton);

    expect(localStorage.getItem('lastSeenVersion')).toBe(CURRENT_VERSION);
  });

  it('renders backdrop and closes on click', async () => {
    localStorage.removeItem('lastSeenVersion');

    renderWelcomeModal();

    await screen.findByRole('button', { name: '我知道了' });
    const backdrop = document.querySelector('.backdrop-blur-md')!;

    expect(backdrop).toHaveClass('bg-black/30');

    fireEvent.click(backdrop);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '我知道了' })).not.toBeInTheDocument();
    });
    expect(localStorage.getItem('lastSeenVersion')).toBe(CURRENT_VERSION);
  });

  it('closes when pressing Escape key', async () => {
    localStorage.removeItem('lastSeenVersion');

    renderWelcomeModal();

    await screen.findByRole('button', { name: '我知道了' });

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '我知道了' })).not.toBeInTheDocument();
    });
    expect(localStorage.getItem('lastSeenVersion')).toBe(CURRENT_VERSION);
  });
});
