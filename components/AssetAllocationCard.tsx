import React, { useState, useCallback, useRef, useEffect } from 'react';
import { formatCurrency, formatSignedCurrency, getSignColor, formatPct } from '../services/financeUtils';
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
 * 展示总资产、基金资产、可用资产三者关系，支持编辑总资产。
 * 作为独立模块嵌入 Dashboard 的左侧资产概览区域。
 */
export const AssetAllocationCard: React.FC<AssetAllocationCardProps> = ({
  fundAssets,
  availableAssets,
  isConfigured,
  holdingGain,
  holdingGainPct,
  cumulativeGain,
  cumulativeGainPct,
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

  return (
    <div className="glass-card relative flex flex-col justify-center overflow-hidden rounded-[2rem] px-5 py-6 md:px-8 md:py-8 min-h-[200px]">
      {/* 渐变背景 */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-y-0 left-0 w-full bg-[radial-gradient(circle_at_top_left,_rgba(148,163,184,0.12),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(226,232,240,0.4),_transparent_28%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(96,165,250,0.12),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.10),_transparent_28%)]" />
      </div>

      <div className="relative">
        {/* 标题行 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[13px] font-medium tracking-wide text-slate-500 dark:text-gray-400">
            <span>资产概览</span>
            <button
              onClick={onToggleShowValues}
              className="rounded-full bg-[var(--app-shell-panel-strong)]/50 p-1 text-slate-500 transition-colors hover:text-slate-800 dark:bg-white/5 dark:text-gray-400 dark:hover:text-gray-100"
              aria-label={showValues ? '隐藏金额' : '显示金额'}
            >
              {showValues ? <Icons.Eye size={16} /> : <Icons.EyeOff size={16} />}
            </button>
          </div>
          <RefreshButton ref={refreshBtnRef} onRefresh={onRefresh} size="sm" />
        </div>

        {/* 总资产 */}
        <div>
          <div className="flex items-center gap-2">
            <div className="text-[11px] font-semibold tracking-wide text-slate-400 dark:text-gray-500">
              总资产 (CNY)
            </div>
            <button
              onClick={handleStartEdit}
              className="rounded-full bg-[var(--app-shell-panel-strong)]/50 p-0.5 text-slate-400 transition-colors hover:text-slate-600 dark:bg-white/5 dark:text-gray-500 dark:hover:text-gray-300"
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
                className="w-40 rounded-lg border border-blue-300 bg-white/90 px-3 py-1.5 text-2xl font-black tracking-[-0.04em] text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-blue-600 dark:bg-slate-800/90 dark:text-gray-50 md:text-3xl [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                  className="rounded-lg bg-slate-200 p-1.5 text-slate-500 transition-colors hover:bg-slate-300 dark:bg-white/10 dark:text-gray-400 dark:hover:bg-white/20"
                  aria-label="取消"
                >
                  <Icons.X size={16} />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={onOpenTotalAssetsHistory}
              className="mt-1 text-4xl font-black tracking-[-0.04em] text-slate-900 dark:text-gray-50 md:text-[3.25rem] md:leading-tight hover:opacity-80 transition-opacity cursor-pointer text-left"
            >
              {showValues ? formatCurrency(totalAssets) : '****'}
            </button>
          )}

          {/* 编辑时预览可用资产变化 */}
          {isEditing && editValid && (
            <div className="mt-1 text-xs text-slate-400 dark:text-gray-500">
              可用资产将调整为 {showValues ? formatCurrency(editAvailable) : '****'}
            </div>
          )}
        </div>

        {/* 基金资产 / 可用资产 双栏 */}
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <div className="rounded-xl bg-[var(--app-shell-panel-strong)]/60 px-3.5 py-3 backdrop-blur-sm dark:bg-white/5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-slate-400 dark:text-gray-500">
              <span className="inline-block h-2 w-2 rounded-full bg-red-400 dark:bg-red-500" />
              基金资产
            </div>
            <div className="mt-1 text-[15px] font-bold text-slate-800 dark:text-gray-100">
              {showValues ? formatCurrency(fundAssets) : '****'}
            </div>
            {isConfigured && (
              <div className="mt-0.5 text-[10px] text-slate-400 dark:text-gray-500">
                占比 {fundRatioPct}%
              </div>
            )}
          </div>
          <div className="rounded-xl bg-[var(--app-shell-panel-strong)]/60 px-3.5 py-3 backdrop-blur-sm dark:bg-white/5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-slate-400 dark:text-gray-500">
              <span className="inline-block h-2 w-2 rounded-full bg-blue-400 dark:bg-blue-500" />
              可用资产
            </div>
            <div className="mt-1 text-[15px] font-bold text-slate-800 dark:text-gray-100">
              {showValues ? formatCurrency(availableAssets) : '****'}
            </div>
            {isConfigured ? (
              <div className="mt-0.5 text-[10px] text-slate-400 dark:text-gray-500">
                占比 {availableRatioPct}%
              </div>
            ) : (
              <div className="mt-0.5 text-[10px] text-slate-400 dark:text-gray-500">
                点击总资产旁✏️配置
              </div>
            )}
          </div>
        </div>

        {/* 资产分配进度条（仅配置后显示） */}
        {isConfigured && totalAssets > 0 && (
          <div className="mt-3">
            <div className="flex h-1.5 overflow-hidden rounded-full bg-[var(--app-shell-panel-strong)] dark:bg-white/10">
              <div
                className="h-full rounded-full bg-red-400 transition-all duration-500 dark:bg-red-500"
                style={{ width: `${fundRatio * 100}%` }}
              />
              <div
                className="h-full rounded-full bg-blue-400 transition-all duration-500 dark:bg-blue-500"
                style={{ width: `${(1 - fundRatio) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* 收益指标 */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)]/80 px-3.5 py-1.5 transition-colors dark:border-white/5 dark:bg-white/5">
            <span className="text-[12px] font-medium text-amber-600 dark:text-amber-500">
              持有收益
            </span>
            <span className={`text-[13px] font-bold ${getSignColor(holdingGain)}`}>
              {showValues ? formatSignedCurrency(holdingGain) : '****'}
              <span className="ml-1 text-xs font-medium">
                ({showValues ? formatPct(holdingGainPct) : '****'})
              </span>
            </span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50/80 px-3.5 py-1.5 transition-colors dark:border-indigo-400/20 dark:bg-indigo-500/10">
            <span className="text-[12px] font-medium text-indigo-600 dark:text-indigo-400">
              累计收益
            </span>
            <span className={`text-[13px] font-bold ${getSignColor(cumulativeGain)}`}>
              {showValues ? formatSignedCurrency(cumulativeGain) : '****'}
              <span className="ml-1 text-xs font-medium">
                ({showValues ? formatPct(cumulativeGainPct) : '****'})
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
