/// <reference types="vitest/globals" />
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { Header } from '../Header';
import { LanguageProvider } from '../../services/i18n';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) => (
      <div {...props}>{children as React.ReactNode}</div>
    ),
    span: ({ children, ...props }: Record<string, unknown>) => (
      <span {...props}>{children as React.ReactNode}</span>
    ),
    button: ({ children, ...props }: Record<string, unknown>) => (
      <button {...props}>{children as React.ReactNode}</button>
    ),
  },
}));

vi.mock('../../services/presence', () => ({
  startPresence: vi.fn(),
  subscribePresence: vi.fn(() => vi.fn()),
  isPresenceEnabled: () => false,
}));

describe('Header add fund button — context-aware', () => {
  const renderHeader = (activeTab?: string) => {
    return render(
      <LanguageProvider>
        <Header
          title="Test"
          activeTab={
            activeTab as 'holding' | 'watchlist' | 'services' | 'news' | 'settings' | undefined
          }
        />
      </LanguageProvider>,
    );
  };

  it('holding 页按钮显示"添加持仓"', () => {
    renderHeader('holding');
    expect(screen.getByRole('button', { name: '添加持仓' })).toBeInTheDocument();
  });

  it('watchlist 页按钮显示"添加自选"', () => {
    renderHeader('watchlist');
    expect(screen.getByRole('button', { name: '添加自选' })).toBeInTheDocument();
  });

  it('holding 页点击按钮派发 open-add-fund 事件', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    renderHeader('holding');
    fireEvent.click(screen.getByRole('button', { name: '添加持仓' }));
    expect(dispatchSpy).toHaveBeenCalled();
    const event = dispatchSpy.mock.calls.at(-1)?.[0];
    expect(event).toBeInstanceOf(CustomEvent);
    expect((event as CustomEvent).type).toBe('open-add-fund');
    dispatchSpy.mockRestore();
  });

  it('watchlist 页点击按钮派发 open-add-watchlist 事件', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    renderHeader('watchlist');
    fireEvent.click(screen.getByRole('button', { name: '添加自选' }));
    expect(dispatchSpy).toHaveBeenCalled();
    const event = dispatchSpy.mock.calls.at(-1)?.[0];
    expect(event).toBeInstanceOf(CustomEvent);
    expect((event as CustomEvent).type).toBe('open-add-watchlist');
    dispatchSpy.mockRestore();
  });

  it('settings 页不渲染添加按钮', () => {
    renderHeader('settings');
    expect(screen.queryByRole('button', { name: '添加持仓' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '添加自选' })).not.toBeInTheDocument();
  });

  it('未传 activeTab 时不渲染添加按钮', () => {
    renderHeader(undefined);
    expect(screen.queryByRole('button', { name: '添加持仓' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '添加自选' })).not.toBeInTheDocument();
  });
});
