/// <reference types="vitest/globals" />
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { Header } from './Header';
import { LanguageProvider } from '../services/i18n';

describe('Header', () => {
  it('renders the provided title', () => {
    render(
      <LanguageProvider>
        <Header title="Test Title" />
      </LanguageProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Test Title' })).toBeInTheDocument();
  });

  it('shows the language toggle button', () => {
    render(
      <LanguageProvider>
        <Header title="Title" />
      </LanguageProvider>,
    );

    expect(screen.getByRole('button', { name: 'EN' })).toBeInTheDocument();
  });

  it('shows changelog button and dispatches open event', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    render(
      <LanguageProvider>
        <Header title="Title" />
      </LanguageProvider>,
    );

    const button = screen.getByRole('button', { name: '更新日志' });
    fireEvent.click(button);

    expect(dispatchSpy).toHaveBeenCalled();
    const event = dispatchSpy.mock.calls.at(-1)?.[0];
    expect(event).toBeInstanceOf(CustomEvent);
    expect((event as CustomEvent).type).toBe('open-changelog');

    dispatchSpy.mockRestore();
  });
});
