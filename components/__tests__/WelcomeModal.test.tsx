/// <reference types="vitest/globals" />
import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WelcomeModal } from '../WelcomeModal';
import { LanguageProvider } from '../../services/i18n';
import { EdgeSwipeProvider } from '../../services/edgeSwipeState';

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

  it('uses nonlinear easing classes and delayed close transition', async () => {
    localStorage.removeItem('lastSeenVersion');

    renderWelcomeModal();

    const closeButton = await screen.findByRole('button', { name: '我知道了' });
    const modalCard = screen.getByTestId('welcome-modal-card');
    const backdrop = screen.getByTestId('welcome-backdrop');

    await waitFor(() => {
      expect(backdrop).toHaveClass('bg-black/50');
    });

    expect(modalCard).toHaveClass('ease-[cubic-bezier(0.22,1,0.36,1)]');
    expect(backdrop).toHaveClass('transition-all');
    expect(backdrop).toHaveClass('duration-[260ms]');

    vi.useFakeTimers();
    fireEvent.click(backdrop);

    expect(screen.getByRole('button', { name: '我知道了' })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(260);
    });

    expect(screen.queryByRole('button', { name: '我知道了' })).not.toBeInTheDocument();
    expect(localStorage.getItem('lastSeenVersion')).toBe(CURRENT_VERSION);

    vi.useRealTimers();
  });

  it('closes when pressing Escape key', async () => {
    localStorage.removeItem('lastSeenVersion');

    renderWelcomeModal();

    await screen.findByRole('button', { name: '我知道了' });

    vi.useFakeTimers();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.getByRole('button', { name: '我知道了' })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(260);
    });

    expect(screen.queryByRole('button', { name: '我知道了' })).not.toBeInTheDocument();
    expect(localStorage.getItem('lastSeenVersion')).toBe(CURRENT_VERSION);

    vi.useRealTimers();
  });
});
