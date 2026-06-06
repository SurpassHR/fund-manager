import type React from 'react';
import type { FundAssetAllocation } from '../types';

interface FundAssetAllocationSummaryProps {
  allocation: FundAssetAllocation | null;
}

const formatAllocationPct = (value: number) => `${value.toFixed(2)}%`;

export const FundAssetAllocationSummary: React.FC<FundAssetAllocationSummaryProps> = ({
  allocation,
}) => {
  if (!allocation) {
    return (
      <div className="mb-4 border-y border-[var(--app-shell-line)] py-3 text-xs text-gray-500 dark:text-gray-400">
        暂未获取到资产配置比例
      </div>
    );
  }

  const items = [
    { label: '股票仓位', value: formatAllocationPct(allocation.equityPct), accent: 'bg-red-400' },
    { label: '现金', value: formatAllocationPct(allocation.cashPct), accent: 'bg-sky-400' },
    { label: '其他', value: formatAllocationPct(allocation.otherPct), accent: 'bg-amber-400' },
  ];

  return (
    <div className="mb-4 border-y border-[var(--app-shell-line)] py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="grid flex-1 grid-cols-3 gap-3 min-w-[14rem]">
          {items.map((item) => (
            <div key={item.label} className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                <span className={`h-1.5 w-1.5 rounded-full ${item.accent}`} />
                <span>{item.label}</span>
              </div>
              <div className="mt-1 font-sans text-sm font-semibold text-gray-800 dark:text-gray-100">
                {item.value}
              </div>
            </div>
          ))}
        </div>
        {allocation.asOfDate && (
          <div className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
            报告期 {allocation.asOfDate}
          </div>
        )}
      </div>
    </div>
  );
};
