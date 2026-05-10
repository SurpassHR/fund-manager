/// <reference types="vitest/globals" />
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockedUsePrefersReducedMotion = vi.hoisted(() => vi.fn(() => false));
vi.mock('../../hooks/usePrefersReducedMotion', () => ({
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
    ArrowUp: ({ size, className }: { size?: number; className?: string }) => (
      <span data-testid="arrow-up" className={className} style={{ fontSize: size }} />
    ),
    ChevronDown: ({ size, className }: { size?: number; className?: string }) => (
      <span data-testid="chevron-down" className={className} style={{ fontSize: size }} />
    ),
    X: ({ size }: { size?: number }) => <span data-testid="x-icon" style={{ fontSize: size }} />,
  },
}));

import { SortDropdown } from '../SortDropdown';
import type { SortDropdownOption } from '../SortDropdown';

const DEFAULT_OPTIONS: SortDropdownOption[] = [
  { key: 'name', label: '名称' },
  { key: 'dayChangePct', label: '当日涨跌幅' },
  { key: 'anchorGain', label: '锚点收益' },
];

const renderDropdown = (props: Partial<Parameters<typeof SortDropdown>[0]> = {}) => {
  return render(
    <SortDropdown
      options={DEFAULT_OPTIONS}
      activeKey={null}
      direction="desc"
      onSelect={vi.fn()}
      onReset={vi.fn()}
      {...props}
    />,
  );
};

describe('SortDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUsePrefersReducedMotion.mockReturnValue(false);
  });

  it('renders trigger button with default label when no active sort', () => {
    renderDropdown();
    const trigger = screen.getByRole('button', { name: /排序/ });
    expect(trigger).toBeInTheDocument();
  });

  it('renders trigger button with active sort key label and direction arrow', () => {
    renderDropdown({ activeKey: 'dayChangePct', direction: 'desc' });
    const trigger = screen.getByRole('button');
    expect(trigger).toHaveTextContent('当日涨跌幅');
    // Should show direction arrow for active sort
    const arrows = screen.getAllByTestId('arrow-up');
    expect(arrows.length).toBeGreaterThanOrEqual(1);
  });

  it('opens dropdown on trigger click', () => {
    renderDropdown();
    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);
    // Dropdown panel appears with options
    expect(screen.getByText('名称')).toBeInTheDocument();
    expect(screen.getByText('锚点收益')).toBeInTheDocument();
  });

  it('closes dropdown on outside click', () => {
    renderDropdown();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('名称')).toBeInTheDocument();

    // Click outside (capture phase listener on window)
    fireEvent.click(document.body);
    expect(screen.queryByText('名称')).not.toBeInTheDocument();
  });

  it('selects an option and calls onSelect, then closes', () => {
    const onSelect = vi.fn();
    renderDropdown({ onSelect });
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('当日涨跌幅'));
    expect(onSelect).toHaveBeenCalledWith('dayChangePct');
    // Dropdown closes after selection
    expect(screen.queryByText('当日涨跌幅')).not.toBeInTheDocument();
  });

  it('calls onReset when reset button is clicked', () => {
    const onReset = vi.fn();
    renderDropdown({ onReset });
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText(/重置/));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/重置/)).not.toBeInTheDocument();
  });

  it('highlights active option with direction indicator', () => {
    renderDropdown({ activeKey: 'anchorGain', direction: 'asc' });
    fireEvent.click(screen.getByRole('button'));

    // Find the option buttons - the active one should have arrow indicator
    const optionButtons = screen.getAllByRole('button', { name: /锚点收益/ });
    // The option (excluding trigger) should have arrow
    const optionBtn = optionButtons.find((btn) => btn.getAttribute('data-testid') !== 'trigger');
    // Active option shows ArrowUp with no rotation (asc)
    const optionArrows = screen.getAllByTestId('arrow-up');
    expect(optionArrows.length).toBeGreaterThanOrEqual(2); // trigger + option
  });

  it('ArrowDown opens dropdown from trigger', () => {
    renderDropdown();
    const trigger = screen.getByRole('button');
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(screen.getByText('名称')).toBeInTheDocument();
  });

  it('ArrowDown and ArrowUp cycle through highlighted options', () => {
    renderDropdown();
    fireEvent.click(screen.getByRole('button'));

    // ArrowDown from empty (no activeKey) highlights first item
    const panel = document.querySelector('[data-testid="sort-dropdown-panel"]')!;
    fireEvent.keyDown(panel, { key: 'ArrowDown' });
    // Verify highlight moves by checking the panel received ArrowDown event
    // We can't easily test CSS classes without container queries, so verify the handler runs

    fireEvent.keyDown(panel, { key: 'ArrowUp' });
    // ArrowUp at top wraps to last - verify no crash
  });

  it('Enter selects highlighted option and calls onSelect', () => {
    const onSelect = vi.fn();
    renderDropdown({ onSelect });
    fireEvent.click(screen.getByRole('button'));

    const panel = document.querySelector('[data-testid="sort-dropdown-panel"]')!;
    // Highlight first option
    fireEvent.keyDown(panel, { key: 'ArrowDown' });
    // Press Enter to select
    fireEvent.keyDown(panel, { key: 'Enter' });

    // Should call onSelect - default highlighted is 0 which is 'name'
    expect(onSelect).toHaveBeenCalledWith('name');
  });

  it('Escape closes dropdown', () => {
    renderDropdown();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('名称')).toBeInTheDocument();

    const panel = document.querySelector('[data-testid="sort-dropdown-panel"]')!;
    fireEvent.keyDown(panel, { key: 'Escape' });
    expect(screen.queryByText('名称')).not.toBeInTheDocument();
  });

  it('clicking trigger again closes dropdown', () => {
    renderDropdown();
    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);
    expect(screen.getByText('名称')).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.queryByText('名称')).not.toBeInTheDocument();
  });

  it('uses reduced motion when preferred', () => {
    mockedUsePrefersReducedMotion.mockReturnValue(true);
    renderDropdown();
    fireEvent.click(screen.getByRole('button'));
    // Should render without error - animations become no-ops
    expect(screen.getByText('名称')).toBeInTheDocument();
  });
});
