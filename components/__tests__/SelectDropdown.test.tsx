/// <reference types="vitest/globals" />
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockedUsePrefersReducedMotion = vi.hoisted(() => vi.fn(() => false));
vi.mock('../hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: mockedUsePrefersReducedMotion,
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({
      initial: _i,
      animate: _a,
      exit: _e,
      transition: _t,
      ...rest
    }: Record<string, unknown>) => <div {...rest} />,
  },
}));

vi.mock('../Icon', () => ({
  Icons: {
    ChevronDown: ({ size, className }: { size?: number; className?: string }) => (
      <span data-testid="chevron-down" className={className} style={{ fontSize: size }} />
    ),
    Check: ({ size }: { size?: number }) => (
      <span data-testid="check-icon" style={{ fontSize: size }} />
    ),
  },
}));

import { SelectDropdown } from '../SelectDropdown';
import type { SelectDropdownOption } from '../SelectDropdown';

const DEFAULT_OPTIONS: SelectDropdownOption[] = [
  { value: 'before15', label: '15:00前' },
  { value: 'after15', label: '15:00后' },
];

const renderDropdown = (props: Partial<Parameters<typeof SelectDropdown>[0]> = {}) => {
  return render(
    <SelectDropdown options={DEFAULT_OPTIONS} value="" onChange={vi.fn()} {...props} />,
  );
};

describe('SelectDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUsePrefersReducedMotion.mockReturnValue(false);
  });

  it('renders trigger button with placeholder when no value', () => {
    renderDropdown({ placeholder: '请选择时间' });
    const trigger = screen.getByRole('button');
    expect(trigger).toHaveTextContent('请选择时间');
  });

  it('renders trigger button with active option label', () => {
    renderDropdown({ value: 'before15' });
    const trigger = screen.getByRole('button');
    expect(trigger).toHaveTextContent('15:00前');
  });

  it('opens dropdown on trigger click', () => {
    renderDropdown();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('15:00前')).toBeInTheDocument();
    expect(screen.getByText('15:00后')).toBeInTheDocument();
  });

  it('closes dropdown on outside click', () => {
    renderDropdown();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('15:00前')).toBeInTheDocument();
    fireEvent.click(document.body);
    expect(screen.queryByText('15:00前')).not.toBeInTheDocument();
  });

  it('selects an option and calls onChange', () => {
    const onChange = vi.fn();
    renderDropdown({ onChange });
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('15:00后'));
    expect(onChange).toHaveBeenCalledWith('after15');
    expect(screen.queryByText('15:00后')).not.toBeInTheDocument();
  });

  it('shows check icon on active option', () => {
    renderDropdown({ value: 'before15' });
    fireEvent.click(screen.getByRole('button'));
    const checks = screen.getAllByTestId('check-icon');
    expect(checks.length).toBe(1);
  });

  it('ArrowDown opens dropdown from trigger', () => {
    renderDropdown();
    const trigger = screen.getByRole('button');
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(screen.getByText('15:00前')).toBeInTheDocument();
  });

  it('Enter selects highlighted option', () => {
    const onChange = vi.fn();
    renderDropdown({ onChange });
    fireEvent.click(screen.getByRole('button'));
    const panel = document.querySelector('[data-testid="select-dropdown-panel"]')!;
    fireEvent.keyDown(panel, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('before15');
  });

  it('Escape closes dropdown', () => {
    renderDropdown();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('15:00前')).toBeInTheDocument();
    const panel = document.querySelector('[data-testid="select-dropdown-panel"]')!;
    fireEvent.keyDown(panel, { key: 'Escape' });
    expect(screen.queryByText('15:00前')).not.toBeInTheDocument();
  });

  it('clicking trigger again closes dropdown', () => {
    renderDropdown();
    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);
    expect(screen.getByText('15:00前')).toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.queryByText('15:00前')).not.toBeInTheDocument();
  });

  it('uses reduced motion when preferred', () => {
    mockedUsePrefersReducedMotion.mockReturnValue(true);
    renderDropdown();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('15:00前')).toBeInTheDocument();
  });
});
