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
      {/* Backdrop overlay */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm"
            onClick={() => setIsExpanded(false)}
          />
        )}
      </AnimatePresence>

      {/* Ticker Container */}
      <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] left-0 right-0 flex flex-col z-40">
        {/* Expanded panel */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full bg-white dark:bg-card-dark border-t border-gray-100 dark:border-border-dark overflow-hidden origin-bottom shadow-[0_-10px_40px_rgba(0,0,0,0.1)] dark:shadow-none"
            >
              <div className="w-full max-w-7xl mx-auto px-4 py-3 pb-4 flex flex-col gap-2">
                <div className="text-xs font-bold font-sans text-gray-400 dark:text-gray-500 mb-2 uppercase">
                  全球市场指数 (Global Indices)
                </div>
                {indices.map((idx) => (
                  <div
                    key={idx.name}
                    className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-white/5 last:border-0 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors rounded-lg px-2 -mx-2"
                  >
                    <span className="font-medium text-gray-700 dark:text-gray-200 text-sm w-32 truncate">
                      {idx.name}
                    </span>
                    <div className="flex gap-4 items-center justify-end text-sm flex-1">
                      <span
                        className={`font-sans font-bold w-16 text-right ${getSignColor(idx.change)}`}
                      >
                        {idx.value.toFixed(2)}
                      </span>
                      <span
                        className={`font-sans w-16 text-right hidden sm:block ${getSignColor(idx.change)}`}
                      >
                        {idx.change.toFixed(2)}
                      </span>
                      <span
                        className={`font-sans font-bold w-16 text-right ${getSignColor(idx.change)}`}
                      >
                        {formatPct(idx.changePct)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Existing single-line ticker */}
        <div
          className="w-full bg-white dark:bg-card-dark border-t border-gray-100 dark:border-border-dark h-10 flex justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="w-full max-w-7xl px-4 flex items-center justify-between text-sm">
            <div className="flex items-center gap-4 w-full overflow-hidden">
              <span className="font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">
                {current.name}
              </span>
              <span className={`font-sans font-bold ${getSignColor(current.change)}`}>
                {current.value.toFixed(2)}
              </span>
              <span className={`font-sans ${getSignColor(current.change)} hidden sm:inline`}>
                {current.change.toFixed(2)}
              </span>
              <span className={`font-sans font-bold ${getSignColor(current.change)}`}>
                {formatPct(current.changePct)}
              </span>
            </div>
            <div className="text-gray-400 pl-4 flex-shrink-0">
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              >
                <Icons.ArrowUp
                  size={16}
                  className={isExpanded ? 'text-blue-500' : 'text-gray-300 dark:text-gray-500'}
                />
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
