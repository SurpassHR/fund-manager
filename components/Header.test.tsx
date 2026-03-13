/// <reference types="vitest/globals" />
import React from 'react';
import { render, screen } from '@testing-library/react';
import { Header } from './Header';
import { LanguageProvider } from '../services/i18n';

describe('Header', () => {
  it('renders the provided title', () => {
    render(
      <LanguageProvider>
        <Header title='Test Title' />
      </LanguageProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Test Title' })).toBeInTheDocument();
  });

  it('shows the language toggle button', () => {
    render(
      <LanguageProvider>
        <Header title='Title' />
      </LanguageProvider>,
    );

    expect(screen.getByRole('button', { name: 'EN' })).toBeInTheDocument();
  });
});
