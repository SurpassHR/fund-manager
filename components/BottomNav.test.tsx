/// <reference types="vitest/globals" />
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import { BottomNav } from './BottomNav';
import { LanguageProvider } from '../services/i18n';

describe('BottomNav', () => {
  it('renders exactly one active animation indicator', () => {
    render(
      <LanguageProvider>
        <BottomNav activeTab="holding" onTabChange={() => undefined} />
      </LanguageProvider>,
    );

    expect(screen.getAllByTestId('bottom-nav-active-indicator')).toHaveLength(1);
  });

  it('moves active animation indicator when active tab changes', () => {
    const { rerender } = render(
      <LanguageProvider>
        <BottomNav activeTab="holding" onTabChange={() => undefined} />
      </LanguageProvider>,
    );

    const holdingButton = screen.getByRole('button', { name: /持有/i });
    expect(within(holdingButton).getByTestId('bottom-nav-active-indicator')).toBeInTheDocument();

    rerender(
      <LanguageProvider>
        <BottomNav activeTab="settings" onTabChange={() => undefined} />
      </LanguageProvider>,
    );

    const settingsButton = screen.getByRole('button', { name: /设置/i });
    expect(within(settingsButton).getByTestId('bottom-nav-active-indicator')).toBeInTheDocument();
  });
});
