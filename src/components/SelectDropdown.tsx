import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Icons } from './Icon';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

export interface SelectDropdownOption {
  value: string;
  label: string;
}

interface SelectDropdownProps {
  options: SelectDropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}

export const SelectDropdown: React.FC<SelectDropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = '请选择',
  className = '',
  ariaLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const reduceMotion = usePrefersReducedMotion();

  const activeOption = options.find((o) => o.value === value);

  const updatePosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, []);

  const openDropdown = useCallback(() => {
    updatePosition();
    const idx = value ? options.findIndex((o) => o.value === value) : -1;
    setHighlightedIndex(idx >= 0 ? idx : 0);
    setIsOpen(true);
  }, [value, options, updatePosition]);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  const selectOption = useCallback(
    (optValue: string) => {
      onChange(optValue);
      closeDropdown();
    },
    [onChange, closeDropdown],
  );

  // Click outside (capture phase to beat stopPropagation from other overlays)
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    };
    window.addEventListener('click', handleClick, true);
    return () => window.removeEventListener('click', handleClick, true);
  }, [isOpen, closeDropdown]);

  // Scroll position update
  useEffect(() => {
    if (!isOpen) return;
    const handleScroll = () => updatePosition();
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [isOpen, updatePosition]);

  // Keyboard: trigger
  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) openDropdown();
    } else if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault();
        closeDropdown();
      }
    }
  };

  // Keyboard: panel
  const handlePanelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeDropdown();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev + 1;
        return next >= options.length ? 0 : next;
      });
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev - 1;
        return next < 0 ? options.length - 1 : next;
      });
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < options.length) {
        selectOption(options[highlightedIndex].value);
      }
    }
  };

  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, scale: 0.95, y: -6 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.95, y: -6 },
        transition: { duration: 0.12, ease: 'easeOut' as const },
      };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (isOpen ? closeDropdown() : openDropdown())}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        className={`flex items-center justify-between gap-2 text-sm transition-colors ${className}`}
      >
        <span
          className={activeOption ? 'text-[var(--app-shell-ink)]' : 'text-[var(--app-shell-muted)]'}
        >
          {activeOption?.label ?? placeholder}
        </span>
        <Icons.ChevronDown
          size={14}
          className={`shrink-0 text-[var(--app-shell-muted)] transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {createPortal(
        <AnimatePresence>
          {isOpen && menuPosition && (
            <motion.div
              {...motionProps}
              ref={panelRef}
              data-testid="select-dropdown-panel"
              className="fixed z-[100] min-w-[140px] rounded-xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)]/98 py-1.5 shadow-[var(--app-shell-shadow)] backdrop-blur-xl"
              style={{
                top: menuPosition.top,
                left: menuPosition.left,
                minWidth: menuPosition.width,
              }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={handlePanelKeyDown}
              role="listbox"
            >
              {options.map((option, index) => {
                const isActive = option.value === value;
                const isHighlighted = index === highlightedIndex;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => selectOption(option.value)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors ${
                      isHighlighted ? 'bg-[var(--app-shell-panel-strong)]' : ''
                    } ${
                      isActive
                        ? 'text-[var(--app-shell-accent)] font-semibold'
                        : 'text-[var(--app-shell-ink)]'
                    }`}
                  >
                    {option.label}
                    {isActive && <Icons.Check size={14} className="ml-auto shrink-0" />}
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
};
