/// <reference types="vitest/globals" />
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { Header } from '../Header';
import { LanguageProvider } from '../../services/i18n';

describe('Header', () => {
  it('renders without title (title prop is ignored)', () => {
    render(
      <LanguageProvider>
        <Header title="Test Title" />
      </LanguageProvider>,
    );

    // Header no longer renders title, it shows time instead
    expect(screen.queryByRole('heading', { name: 'Test Title' })).not.toBeInTheDocument();
    expect(screen.queryByText('FM')).not.toBeInTheDocument();
    expect(screen.queryByText('Morning Edition')).not.toBeInTheDocument();
  });

  it('shows the language toggle button', () => {
    render(
      <LanguageProvider>
        <Header title="Title" />
      </LanguageProvider>,
    );

    expect(screen.getByRole('button', { name: 'EN' })).toBeInTheDocument();
  });

  it('shows standalone changelog button and dispatches open event', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    render(
      <LanguageProvider>
        <Header title="Title" />
      </LanguageProvider>,
    );

    const button = screen.getByRole('button', { name: '更新日志' });
    fireEvent.click(button);

    expect(button).toBeInTheDocument();
    expect(dispatchSpy).toHaveBeenCalled();
    const event = dispatchSpy.mock.calls.at(-1)?.[0];
    expect(event).toBeInstanceOf(CustomEvent);
    expect((event as CustomEvent).type).toBe('open-changelog');

    dispatchSpy.mockRestore();
  });

  it('applies mobile hidden classes when hiddenOnMobile is true', () => {
    const { container } = render(
      <LanguageProvider>
        <Header title="Title" hiddenOnMobile />
      </LanguageProvider>,
    );

    const header = container.querySelector('header');
    expect(header?.className).toContain('max-md:-translate-y-full');
    expect(header?.className).toContain('max-md:opacity-0');
  });
});
