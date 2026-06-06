import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FundAssetAllocationSummary } from '../FundAssetAllocationSummary';

describe('FundAssetAllocationSummary', () => {
  it('shows equity cash other allocation and report date', () => {
    render(
      <FundAssetAllocationSummary
        allocation={{
          equityPct: 67.44,
          cashPct: 36.52,
          otherPct: 1.68,
          asOfDate: '2026-03-31',
        }}
      />,
    );

    expect(screen.getByText('股票仓位')).toBeInTheDocument();
    expect(screen.getByText('67.44%')).toBeInTheDocument();
    expect(screen.getByText('现金')).toBeInTheDocument();
    expect(screen.getByText('36.52%')).toBeInTheDocument();
    expect(screen.getByText('其他')).toBeInTheDocument();
    expect(screen.getByText('1.68%')).toBeInTheDocument();
    expect(screen.getByText('报告期 2026-03-31')).toBeInTheDocument();
  });

  it('shows a subtle fallback when allocation is unavailable', () => {
    render(<FundAssetAllocationSummary allocation={null} />);

    expect(screen.getByText('暂未获取到资产配置比例')).toBeInTheDocument();
  });
});
