/// <reference types="vitest/globals" />
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FundSearchInput } from '../FundSearchInput';

vi.mock('../../services/api', () => ({
  searchFunds: vi.fn(),
}));

vi.mock('../../services/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../Icon', () => ({
  Icons: {
    Search: () => <span>search</span>,
    Settings: () => <span>settings</span>,
    Plus: () => <span>plus</span>,
  },
}));

describe('FundSearchInput theme', () => {
  it('搜索输入框聚焦态应使用当前主题背景而不是 paper 底色', () => {
    render(<FundSearchInput onSelect={vi.fn()} />);

    const input = screen.getByPlaceholderText('common.searchFund');
    expect(input.className).toContain('focus:bg-[var(--app-shell-panel-strong)]');
    expect(input.className).not.toContain('focus:bg-[var(--app-shell-paper)]');
    expect(input.className).not.toContain('dark:focus:bg-[var(--app-shell-paper-dark)]');
  });
});
