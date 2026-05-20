import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  formatCurrency,
  formatSignedCurrency,
  getSignColor,
  formatPct,
} from '../services/financeUtils';
import { Icons } from './Icon';
import RefreshButton, { type RefreshButtonHandle } from './RefreshButton';

export interface AssetAllocationCardProps {
  /** 基金资产（持仓总市值） */
  fundAssets: number;
  /** 可用资产（余额宝类随时可取用资产） */
  availableAssets: number;
  /** 是否已配置资产分配 */
  isConfigured: boolean;
  /** 持有收益 */
  holdingGain: number;
  /** 持有收益率 */
  holdingGainPct: number;
  /** 累计收益 */
  cumulativeGain: number;
  /** 累计收益率 */
  cumulativeGainPct: number;
  /** 今日收益 */
  totalDayGain: number;
  /** 今日收益率 */
  totalDayGainPct: number;
  /** 是否显示数值（隐私模式） */
  showValues: boolean;
  /** 切换隐私模式 */
  onToggleShowValues: () => void;
  /** 手动刷新回调 */
  onRefresh: () => Promise<void>;
  /** 编辑总资产回调：用户输入新的总资产值 */
  onSetTotalAssets: (total: number) => void;
  /** 点击总资产打开历史走势 */
  onOpenTotalAssetsHistory: () => void;
  /** RefreshButton 的 ref，用于触发冷却动画 */
  refreshBtnRef?: React.RefObject<RefreshButtonHandle | null>;
}

/**
 * 账户资产卡片组件
 *
 * 三列水平布局展示总资产、基金/可用资产分配、持有与累计盈亏。
 * 作为独立模块嵌入 Dashboard 的资产概览区域。
 */
export const AssetAllocationCard: React.FC<AssetAllocationCardProps> = ({
  fundAssets,
  availableAssets,
  isConfigured,
  holdingGain,
  holdingGainPct,
  cumulativeGain,
  cumulativeGainPct,
  totalDayGain,
  totalDayGainPct,
  showValues,
  onToggleShowValues,
  onRefresh,
  onSetTotalAssets,
  onOpenTotalAssetsHistory,
  refreshBtnRef,
}) => {
  const totalAssets = fundAssets + availableAssets;

  // 编辑总资产状态
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = useCallback(() => {
    setEditValue(String(Math.round(totalAssets)));
    setIsEditing(true);
  }, [totalAssets]);

  const handleConfirmEdit = useCallback(() => {
    const parsed = parseFloat(editValue);
    if (isNaN(parsed) || parsed < fundAssets) {
      // 总资产不能小于基金资产
      return;
    }
    onSetTotalAssets(parsed);
    setIsEditing(false);
    setEditValue('');
  }, [editValue, fundAssets, onSetTotalAssets]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditValue('');
  }, []);

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleConfirmEdit();
      } else if (e.key === 'Escape') {
        handleCancelEdit();
      }
    },
    [handleConfirmEdit, handleCancelEdit],
  );

  // 基金资产占总资产比例（用于进度条）
  const fundRatio = totalAssets > 0 ? fundAssets / totalAssets : 0;
  const fundRatioPct = (fundRatio * 100).toFixed(1);
  const availableRatioPct = ((1 - fundRatio) * 100).toFixed(1);

  // 编辑态校验
  const editParsed = parseFloat(editValue);
  const editValid = !isNaN(editParsed) && editParsed >= fundAssets && editParsed > 0;
  const editAvailable = editValid ? Math.max(0, editParsed - fundAssets) : 0;

  // 持有盈亏与累计盈亏的符号方向
  const holdingSign = holdingGain >= 0 ? 1 : -1;
  const cumulativeSign = cumulativeGain >= 0 ? 1 : -1;

  // 卡片通用样式
  const cardBase = 'glass-card rounded-3xl p-6';

  return (
    <div className="lg:col-span-2">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* ===== CARD 1: 总资产概览 (左列, md:col-span-2) ===== */}
        <div
          className={`${cardBase} md:col-span-2 md:p-8 relative overflow-hidden flex flex-col justify-center`}
        >
          {/* 右上角流光背景 */}
          <div className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 rounded-full bg-blue-500/[0.03] blur-3xl" />

          <div className="relative">
            {/* 标题行 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[13px] font-medium tracking-wide text-gray-400">
                <span>总资产概览</span>
                <button
                  onClick={onToggleShowValues}
                  className="rounded-full p-1 text-gray-500 transition-colors hover:text-gray-300"
                  aria-label={showValues ? '隐藏金额' : '显示金额'}
                >
                  {showValues ? <Icons.Eye size={16} /> : <Icons.EyeOff size={16} />}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-[10px] font-medium text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  数据已同步
                </span>
                <RefreshButton ref={refreshBtnRef} onRefresh={onRefresh} size="sm" />
              </div>
            </div>

            {/* 总资产 + 今日收益 双栏 */}
            <div className="mt-6 flex items-end justify-between gap-4">
              {/* 左侧：总资产 */}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-[11px] font-semibold tracking-wide text-gray-500">
                    总资产 (CNY)
                  </div>
                  <button
                    onClick={handleStartEdit}
                    className="rounded-full p-0.5 text-gray-500 transition-colors hover:text-gray-300"
                    aria-label="编辑总资产"
                  >
                    <Icons.Edit size={12} />
                  </button>
                </div>

                {isEditing ? (
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      ref={inputRef}
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={handleEditKeyDown}
                      className="w-40 rounded-lg border border-blue-600 bg-slate-800/90 px-3 py-1.5 text-2xl font-black tracking-[-0.04em] text-gray-50 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 md:text-3xl [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="输入总资产"
                      min={Math.round(fundAssets)}
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={handleConfirmEdit}
                        disabled={!editValid}
                        className="rounded-lg bg-blue-500 p-1.5 text-white transition-colors hover:bg-blue-600 disabled:opacity-40"
                        aria-label="确认"
                      >
                        <Icons.Check size={16} />
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="rounded-lg bg-white/10 p-1.5 text-gray-400 transition-colors hover:bg-white/20"
                        aria-label="取消"
                      >
                        <Icons.X size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <button
                      onClick={onOpenTotalAssetsHistory}
                      className="mt-1 text-4xl font-black tracking-[-0.04em] text-gray-50 md:text-[3.25rem] md:leading-tight hover:opacity-80 transition-opacity cursor-pointer text-left"
                    >
                      {showValues ? formatCurrency(totalAssets) : '****'}
                    </button>
                    {showValues && <span className="text-lg font-medium text-gray-400">元</span>}
                  </div>
                )}

                {/* 编辑时预览可用资产变化 */}
                {isEditing && editValid && (
                  <div className="mt-1 text-xs text-gray-500">
                    可用资产将调整为 {showValues ? formatCurrency(editAvailable) : '****'}
                  </div>
                )}
              </div>

              {/* 右侧：今日收益 */}
              <div className="shrink-0 text-right">
                <div className="text-[11px] font-medium text-gray-500">今日收益</div>
                <div
                  className={`mt-1 text-2xl font-bold flex items-center justify-end gap-1 ${getSignColor(totalDayGain)}`}
                >
                  {totalDayGain >= 0 ? <Icons.ArrowUp size={14} /> : <Icons.ArrowDown size={14} />}
                  <span>{showValues ? formatSignedCurrency(totalDayGain) : '****'}</span>
                </div>
                <div className="mt-0.5 text-xs text-gray-500 text-right">
                  {showValues ? formatPct(totalDayGainPct) : '****'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== 中列: Card 2 (基金定投资产) + Card 3 (活期可用资金) ===== */}
        <div className="flex flex-col gap-6">
          {/* Card 2: 基金定投资产 */}
          <div className={`${cardBase} flex-1 flex flex-col justify-center`}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-xs font-medium text-gray-400">基金定投资产</span>
              {isConfigured && (
                <span className="ml-auto inline-flex items-center rounded-full bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-[11px] font-semibold text-red-400">
                  {fundRatioPct}%
                </span>
              )}
            </div>
            <div className="mt-2 text-xl font-bold text-gray-100">
              {showValues ? formatCurrency(fundAssets) : '****'}
            </div>
            {isConfigured && totalAssets > 0 && (
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-red-500/60 to-red-400"
                  style={{ width: `${fundRatio * 100}%` }}
                />
              </div>
            )}
          </div>

          {/* Card 3: 活期可用资金 */}
          <div className={`${cardBase} flex-1 flex flex-col justify-center`}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-xs font-medium text-gray-400">活期可用资金</span>
              {isConfigured ? (
                <span className="ml-auto inline-flex items-center rounded-full bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[11px] font-semibold text-blue-400">
                  {availableRatioPct}%
                </span>
              ) : (
                <span className="ml-auto text-[10px] text-gray-500">点击总资产旁✏️配置</span>
              )}
            </div>
            <div className="mt-2 text-xl font-bold text-gray-100">
              {showValues ? formatCurrency(availableAssets) : '****'}
            </div>
            {isConfigured && totalAssets > 0 && (
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500/60 to-blue-400"
                  style={{ width: `${(1 - fundRatio) * 100}%` }}
                />
              </div>
            )}
          </div>
        </div>

        {/* ===== 右列: Card 4 (持有盈亏) + Card 5 (累计总盈亏) ===== */}
        <div className="flex flex-col gap-6">
          {/* Card 4: 持有盈亏 */}
          <div
            className={`${cardBase} flex-1 relative overflow-hidden flex flex-col justify-center`}
          >
            {/* 绿色微缩下跌走势 SVG 背景 */}
            <svg
              className="pointer-events-none absolute inset-0 w-full h-full opacity-[0.04]"
              viewBox="0 0 200 100"
              preserveAspectRatio="none"
            >
              <path
                d="M0 35 Q20 25 40 40 T80 30 T120 50 T160 35 T200 65"
                stroke="#34d399"
                strokeWidth="2"
                fill="none"
              />
            </svg>
            <div className="relative">
              <div className="text-[11px] font-medium text-gray-500">
                <span>持有盈亏</span>
                <span className="text-gray-600"> · 截止昨日</span>
              </div>
              <div
                className={`mt-1.5 text-xl font-bold flex items-center gap-1 ${getSignColor(holdingGain)}`}
              >
                {holdingSign >= 0 ? <Icons.ArrowUp size={14} /> : <Icons.ArrowDown size={14} />}
                <span>{showValues ? formatSignedCurrency(holdingGain) : '****'}</span>
              </div>
              <div className="mt-0.5 text-xs text-gray-500">
                {showValues ? formatPct(holdingGainPct) : '****'}
              </div>
            </div>
          </div>

          {/* Card 5: 累计总盈亏 */}
          <div
            className={`${cardBase} flex-1 relative overflow-hidden flex flex-col justify-center`}
          >
            {/* 红色微缩上行趋势 SVG 背景 */}
            <svg
              className="pointer-events-none absolute inset-0 w-full h-full opacity-[0.04]"
              viewBox="0 0 200 100"
              preserveAspectRatio="none"
            >
              <path
                d="M0 60 Q20 55 40 35 T80 20 T120 25 T160 10 T200 25"
                stroke="#f87171"
                strokeWidth="2"
                fill="none"
              />
            </svg>
            <div className="relative">
              <div className="text-[11px] font-medium text-gray-500">
                <span>累计总盈亏</span>
                <span className="text-gray-600"> · 历史至今</span>
              </div>
              <div
                className={`mt-1.5 text-xl font-bold flex items-center gap-1 ${getSignColor(cumulativeGain)}`}
              >
                {cumulativeSign >= 0 ? <Icons.ArrowUp size={14} /> : <Icons.ArrowDown size={14} />}
                <span>{showValues ? formatSignedCurrency(cumulativeGain) : '****'}</span>
              </div>
              <div className="mt-0.5 text-xs text-gray-500">
                {showValues ? formatPct(cumulativeGainPct) : '****'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
