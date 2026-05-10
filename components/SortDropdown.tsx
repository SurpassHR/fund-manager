import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Icons } from './Icon';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

export interface SortDropdownOption {
  key: string;
  label: string;
}

interface SortDropdownProps {
  options: SortDropdownOption[];
  activeKey: string | null;
  direction: 'asc' | 'desc';
  onSelect: (key: string) => void;
  onReset: () => void;
}

export const SortDropdown: React.FC<SortDropdownProps> = ({
  options,
  activeKey,
  direction,
  onSelect,
  onReset,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const reduceMotion = usePrefersReducedMotion();

  const activeOption = options.find((o) => o.key === activeKey);

  const updatePosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
  }, []);

  const openDropdown = useCallback(() => {
    updatePosition();
    const idx = activeKey ? options.findIndex((o) => o.key === activeKey) : -1;
    setHighlightedIndex(idx);
    setIsOpen(true);
  }, [activeKey, options, updatePosition]);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  const selectOption = useCallback(
    (key: string) => {
      onSelect(key);
      closeDropdown();
    },
    [onSelect, closeDropdown],
  );

  const handleReset = useCallback(() => {
    onReset();
    closeDropdown();
  }, [onReset, closeDropdown]);

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
      if (!isOpen) {
        openDropdown();
      }
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
        selectOption(options[highlightedIndex].key);
      }
    }
  };

  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, scale: 0.95, y: -8 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.95, y: -8 },
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
        className="flex items-center gap-1 text-[11px] font-semibold tracking-[0.14em] text-slate-400 transition-colors hover:text-slate-600 dark:text-gray-500 dark:hover:text-gray-300"
      >
        <span className={activeKey ? 'text-slate-700 dark:text-gray-200' : ''}>
          {activeOption?.label ?? '排序'}
        </span>
        {activeKey && (
          <Icons.ArrowUp size={12} className={direction === 'asc' ? '' : 'rotate-180'} />
        )}
        <Icons.ChevronDown
          size={12}
          className={`transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {createPortal(
        <AnimatePresence>
          {isOpen && menuPosition && (
            <motion.div
              {...motionProps}
              ref={panelRef}
              data-testid="sort-dropdown-panel"
              className="fixed z-[100] min-w-[160px] rounded-xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)]/98 py-1.5 shadow-[var(--app-shell-shadow)] backdrop-blur-xl"
              style={{ top: menuPosition.top, right: menuPosition.right }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={handlePanelKeyDown}
              role="listbox"
            >
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--app-shell-muted)]">
                排序方式
              </div>
              {options.map((option, index) => {
                const isActive = option.key === activeKey;
                const isHighlighted = index === highlightedIndex;
                return (
                  <button
                    key={option.key}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => selectOption(option.key)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`flex w-full items-center justify-between px-3 py-2 text-sm transition-colors ${
                      isHighlighted ? 'bg-[var(--app-shell-panel-strong)]' : ''
                    } ${
                      isActive
                        ? 'text-[var(--app-shell-accent)] font-semibold'
                        : 'text-slate-600 dark:text-gray-300'
                    }`}
                  >
                    <span>{option.label}</span>
                    {isActive && (
                      <Icons.ArrowUp
                        size={14}
                        className={direction === 'asc' ? '' : 'rotate-180'}
                      />
                    )}
                  </button>
                );
              })}
              <div className="mx-3 my-1 border-t border-[var(--app-shell-line)]" />
              <button
                type="button"
                onClick={handleReset}
                onMouseEnter={() => setHighlightedIndex(-1)}
                className="flex w-full items-center gap-1.5 px-3 py-2 text-sm text-[var(--app-shell-muted)] transition-colors hover:text-slate-600 dark:hover:text-gray-300"
              >
                <Icons.X size={14} />
                重置排序
              </button>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
};
