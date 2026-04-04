/// <reference types="vitest/globals" />
import React from 'react';
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';

import App from '../../App';

vi.mock('../Header', () => ({
  Header: ({ title }: { title: string }) => <header>{title}</header>,
}));

vi.mock('../BottomNav', () => ({
  BottomNav: () => <nav data-testid="bottom-nav" />,
}));

vi.mock('../Dashboard', () => ({
  Dashboard: () => <section>dashboard</section>,
}));

vi.mock('../Watchlist', () => ({
  Watchlist: () => <section>watchlist</section>,
}));

vi.mock('../Ticker', () => ({
  Ticker: () => <div data-testid="ticker" />,
}));

vi.mock('../ScannerModal', () => ({
  ScannerModal: () => null,
}));

vi.mock('../SettingsPage', () => ({
  SettingsPage: () => <section>settings</section>,
}));

vi.mock('../ServicesPanel', () => ({
  ServicesPanel: () => <section>services</section>,
}));

vi.mock('../WelcomeModal', () => ({
  WelcomeModal: () => null,
}));

vi.mock('../transitions/AnimatedSwitcher', () => ({
  AnimatedSwitcher: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../Icon', () => ({
  Icons: {
    Grid: () => null,
  },
}));

vi.mock('../../services/i18n', () => ({
  LanguageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../services/ThemeContext', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../services/SettingsContext', () => ({
  SettingsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../services/edgeSwipeState', () => ({
  EdgeSwipeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../services/useEdgeSwipe', () => ({
  resetDragState: vi.fn(),
  useEdgeSwipe: () => ({
    setDragState: vi.fn(),
    isDragging: false,
  }),
}));

vi.mock('../../services/overlayStack', () => ({
  closeTopOverlay: vi.fn(),
  getActiveOverlayId: vi.fn(() => null),
}));

describe('App shell background layers', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('保留背景与噪点图层节点，供 fixed 背景样式挂载', () => {
    const { container } = render(<App />);

    const shell = container.querySelector('.app-shell');
    const backdrop = container.querySelector('.app-shell__backdrop');
    const noise = container.querySelector('.app-shell__noise');
    const content = container.querySelector('.app-shell__content');

    expect(shell).toBeInTheDocument();
    expect(backdrop).toBeInTheDocument();
    expect(backdrop).toHaveAttribute('aria-hidden', 'true');
    expect(noise).toBeInTheDocument();
    expect(noise).toHaveAttribute('aria-hidden', 'true');
    expect(content).toBeInTheDocument();
  });
});
