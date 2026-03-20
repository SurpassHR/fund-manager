import React, { useState, useEffect } from 'react';
import { fetchMarketIndices } from '../services/api';
import type { MarketIndex } from '../types';
import { getSignColor, formatPct } from '../services/financeUtils';
import { Icons } from './Icon';
import { motion, AnimatePresence } from 'framer-motion';

export const Ticker: React.FC = () => {
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [index, setIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const data = await fetchMarketIndices();
      if (data && data.length > 0) {
        setIndices(data);
      }
    };
    loadData();
    // Refresh every minute
    const refreshTimer = setInterval(loadData, 60000);
    return () => clearInterval(refreshTimer);
  }, []);

  useEffect(() => {
    if (indices.length === 0) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % indices.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [indices.length]);

  if (indices.length === 0) return null;

  const current = indices[index];

  return (
    <>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-black/25 backdrop-blur-sm"
            onClick={() => setIsExpanded(false)}
          />
        )}
      </AnimatePresence>

      <div className="fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom,0px))] left-0 right-0 z-40 px-3 sm:px-4">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2.5 sm:gap-3">
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0, y: 12 }}
                animate={{ height: 'auto', opacity: 1, y: 0 }}
                exit={{ height: 0, opacity: 0, y: 12 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden rounded-[1.5rem] border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)]/95 shadow-[var(--app-shell-shadow)] backdrop-blur-2xl"
              >
                <div className="px-4 py-3.5 sm:px-5 sm:py-4">
                  <div className="mb-2.5 text-[0.62rem] font-semibold tracking-[0.24em] text-[var(--app-shell-muted)]">
                    全球市场指数
                  </div>
                  <div className="space-y-2">
                    {indices.map((idx) => (
                      <div
                        key={idx.name}
                        className="flex items-center justify-between rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] px-3 py-2.5 transition-colors"
                      >
                        <span className="w-32 truncate text-sm font-semibold text-[var(--app-shell-ink)]">
                          {idx.name}
                        </span>
                        <div className="flex flex-1 items-center justify-end gap-4 text-sm">
                          <span className={`w-16 text-right font-bold ${getSignColor(idx.change)}`}>
                            {idx.value.toFixed(2)}
                          </span>
                          <span
                            className={`hidden w-16 text-right sm:block ${getSignColor(idx.change)}`}
                          >
                            {idx.change.toFixed(2)}
                          </span>
                          <span className={`w-16 text-right font-bold ${getSignColor(idx.change)}`}>
                            {formatPct(idx.changePct)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="button"
            className="group flex h-[3.125rem] w-full items-center justify-center rounded-[1.35rem] border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)]/96 shadow-[0_12px_32px_rgba(15,23,42,0.1)] backdrop-blur-2xl transition"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="flex w-full max-w-5xl items-center justify-between px-4 text-sm sm:px-5">

              <div className="flex min-w-0 items-center gap-4 overflow-hidden">
                <span className="text-[0.62rem] font-semibold tracking-[0.2em] text-[var(--app-shell-muted)]">
                  指数
                </span>
                <span className="truncate font-semibold text-[var(--app-shell-ink)]">{current.name}</span>
                <span className={`font-bold ${getSignColor(current.change)}`}>{current.value.toFixed(2)}</span>
                <span className={`hidden sm:inline ${getSignColor(current.change)}`}>
                  {current.change.toFixed(2)}
                </span>
                <span className={`font-bold ${getSignColor(current.change)}`}>
                  {formatPct(current.changePct)}
                </span>
              </div>
              <div className="pl-4 text-[var(--app-shell-muted)]">
                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                >
                  <Icons.ArrowUp
                    size={16}
                    className={isExpanded ? 'text-[var(--app-shell-accent)]' : 'opacity-70'}
                  />
                </motion.div>
              </div>
            </div>
          </button>
        </div>
      </div>
    </>
  );
};
