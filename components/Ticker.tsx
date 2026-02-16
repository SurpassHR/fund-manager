import React, { useState, useEffect } from 'react';
import { MOCK_INDICES } from '../constants';
import { getSignColor, formatPct } from '../services/financeUtils';
import { Icons } from './Icon';

export const Ticker: React.FC = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % MOCK_INDICES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const current = MOCK_INDICES[index];

  return (
    // Adjusted bottom position: 56px (Nav height) + env(safe-area-inset-bottom)
    <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] left-0 right-0 bg-white border-t border-gray-100 h-10 flex justify-center z-40">
        <div className="w-full max-w-7xl px-4 flex items-center justify-between text-sm">
           <div className="flex items-center gap-4 w-full overflow-hidden">
             <span className="font-medium text-gray-700 whitespace-nowrap">{current.name}</span>
             <span className={`font-mono font-bold ${getSignColor(current.change)}`}>
               {current.value.toFixed(2)}
             </span>
             <span className={`font-mono ${getSignColor(current.change)} hidden sm:inline`}>
               {current.change.toFixed(2)}
             </span>
             <span className={`font-mono ${getSignColor(current.change)}`}>
               {formatPct(current.changePct)}
             </span>
           </div>
           <div className="text-gray-400 pl-4">
              <Icons.ArrowUp size={16} className="text-gray-300" />
           </div>
       </div>
    </div>
  );
};