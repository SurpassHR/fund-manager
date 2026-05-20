/**
 * AssetAllocationCard 组件测试
 *
 * 测试资产分配卡片的渲染与交互逻辑
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssetAllocationCard } from '../AssetAllocationCard';

const DEFAULT_PROPS = {
  fundAssets: 100000,
  availableAssets: 0,
  isConfigured: false,
  holdingGain: 5000,
  holdingGainPct: 5.0,
  cumulativeGain: 8000,
  cumulativeGainPct: 8.0,
  totalDayGain: 1200,
  totalDayGainPct: 1.2,
  showValues: true,
  onToggleShowValues: vi.fn(),
  onRefresh: vi.fn().mockResolvedValue(undefined),
  onSetTotalAssets: vi.fn(),
  onOpenTotalAssetsHistory: vi.fn(),
};

// 模拟 framer-motion（RefreshButton 内部使用）
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) => (
      <div {...props}>{children as React.ReactNode}</div>
    ),
  },
}));

describe('AssetAllocationCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('渲染总资产数字（未配置时显示基金资产）', () => {
    render(<AssetAllocationCard {...DEFAULT_PROPS} />);
    // 未配置时总资产 = 基金资产 = 100,000.00
    // 使用 getAllByText 因为数字可能出现在多处
    const matches = screen.getAllByText('100,000.00');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('已配置时总资产 = 基金资产 + 可用资产', () => {
    render(<AssetAllocationCard {...DEFAULT_PROPS} availableAssets={40000} isConfigured={true} />);
    // 总资产140,000.00以大号字体显示，基金资产100,000.00在子卡片中
    const totalMatches = screen.getAllByText('140,000.00');
    expect(totalMatches.length).toBeGreaterThanOrEqual(1);
  });

  it('渲染基金定投资产和活期可用资金两个子卡片', () => {
    render(<AssetAllocationCard {...DEFAULT_PROPS} availableAssets={40000} isConfigured={true} />);
    expect(screen.getByText('基金定投资产')).toBeTruthy();
    expect(screen.getByText('活期可用资金')).toBeTruthy();
  });

  it('未配置时可用资产显示提示文字', () => {
    render(<AssetAllocationCard {...DEFAULT_PROPS} />);
    expect(screen.getByText('点击总资产旁✏️配置')).toBeTruthy();
  });

  it('已配置时显示占比百分比', () => {
    render(<AssetAllocationCard {...DEFAULT_PROPS} availableAssets={40000} isConfigured={true} />);
    // 基金占比 100000/140000 ≈ 71.4%
    expect(screen.getByText('71.4%')).toBeTruthy();
    // 可用占比 40000/140000 ≈ 28.6%
    expect(screen.getByText('28.6%')).toBeTruthy();
  });

  it('显示持有盈亏和累计总盈亏', () => {
    render(<AssetAllocationCard {...DEFAULT_PROPS} />);
    expect(screen.getByText('持有盈亏')).toBeTruthy();
    expect(screen.getByText('累计总盈亏')).toBeTruthy();
  });

  it('隐私模式下隐藏数字显示 ****', () => {
    render(<AssetAllocationCard {...DEFAULT_PROPS} showValues={false} />);
    const stars = screen.getAllByText('****');
    expect(stars.length).toBeGreaterThanOrEqual(1);
  });

  it('点击编辑按钮进入编辑模式', () => {
    render(<AssetAllocationCard {...DEFAULT_PROPS} />);
    // 点击编辑按钮（aria-label="编辑总资产"）
    const editBtn = screen.getByLabelText('编辑总资产');
    fireEvent.click(editBtn);
    // 应该出现输入框
    const input = screen.getByPlaceholderText('输入总资产');
    expect(input).toBeTruthy();
    // 确认和取消按钮应该出现
    expect(screen.getByLabelText('确认')).toBeTruthy();
    expect(screen.getByLabelText('取消')).toBeTruthy();
  });

  it('编辑时输入小于基金资产的值无法确认', () => {
    render(<AssetAllocationCard {...DEFAULT_PROPS} />);
    const editBtn = screen.getByLabelText('编辑总资产');
    fireEvent.click(editBtn);
    const input = screen.getByPlaceholderText('输入总资产');
    fireEvent.change(input, { target: { value: '50000' } });
    // 确认按钮应该被禁用
    const confirmBtn = screen.getByLabelText('确认');
    expect(confirmBtn).toBeDisabled();
  });

  it('编辑时输入有效值点击确认调用 onSetTotalAssets', () => {
    render(<AssetAllocationCard {...DEFAULT_PROPS} />);
    const editBtn = screen.getByLabelText('编辑总资产');
    fireEvent.click(editBtn);
    const input = screen.getByPlaceholderText('输入总资产');
    fireEvent.change(input, { target: { value: '150000' } });
    const confirmBtn = screen.getByLabelText('确认');
    expect(confirmBtn).not.toBeDisabled();
    fireEvent.click(confirmBtn);
    expect(DEFAULT_PROPS.onSetTotalAssets).toHaveBeenCalledWith(150000);
  });

  it('编辑时按 Enter 键确认', () => {
    render(<AssetAllocationCard {...DEFAULT_PROPS} />);
    const editBtn = screen.getByLabelText('编辑总资产');
    fireEvent.click(editBtn);
    const input = screen.getByPlaceholderText('输入总资产');
    fireEvent.change(input, { target: { value: '200000' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(DEFAULT_PROPS.onSetTotalAssets).toHaveBeenCalledWith(200000);
  });

  it('编辑时按 Escape 键取消', () => {
    render(<AssetAllocationCard {...DEFAULT_PROPS} />);
    const editBtn = screen.getByLabelText('编辑总资产');
    fireEvent.click(editBtn);
    const input = screen.getByPlaceholderText('输入总资产');
    fireEvent.change(input, { target: { value: '200000' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    // 应该退出编辑模式，回到显示模式
    expect(DEFAULT_PROPS.onSetTotalAssets).not.toHaveBeenCalled();
  });

  it('点击总资产数字打开历史走势', () => {
    render(<AssetAllocationCard {...DEFAULT_PROPS} />);
    // 总资产数字是一个 button（大号字体），查找所有匹配并点击第一个
    const totalBtns = screen.getAllByText('100,000.00');
    // 第一个（大号字体）是总资产按钮
    fireEvent.click(totalBtns[0]);
    expect(DEFAULT_PROPS.onOpenTotalAssetsHistory).toHaveBeenCalled();
  });

  it('点击眼睛按钮切换隐私模式', () => {
    render(<AssetAllocationCard {...DEFAULT_PROPS} />);
    const eyeBtn = screen.getByLabelText('隐藏金额');
    fireEvent.click(eyeBtn);
    expect(DEFAULT_PROPS.onToggleShowValues).toHaveBeenCalled();
  });
});
