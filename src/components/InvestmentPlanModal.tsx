import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';

import { Icons } from './Icon';
import { SelectDropdown } from './SelectDropdown';
import { ModalShell } from './ModalShell';
import {
  addInvestmentPlan,
  updateInvestmentPlan,
  deleteInvestmentPlan,
  getAllInvestmentPlans,
} from '../services/investmentPlan';
import type { InvestmentFrequency } from '../types';

interface InvestmentPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 从右键菜单预选的基金代码，自动填充且不可更改 */
  prefillFundCode?: string;
}

const FREQUENCY_OPTIONS: { value: InvestmentFrequency; label: string }[] = [
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
];

const WEEKDAY_OPTIONS = [
  { value: '0', label: '周日' },
  { value: '1', label: '周一' },
  { value: '2', label: '周二' },
  { value: '3', label: '周三' },
  { value: '4', label: '周四' },
  { value: '5', label: '周五' },
  { value: '6', label: '周六' },
];

const MONTH_DAY_OPTIONS = Array.from({ length: 28 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1} 号`,
}));

const formatFrequency = (freq: InvestmentFrequency, day?: number): string => {
  switch (freq) {
    case 'daily':
      return '每天';
    case 'weekly': {
      const wd = WEEKDAY_OPTIONS.find((o) => Number(o.value) === day);
      return `每${wd?.label ?? ''}`;
    }
    case 'monthly':
      return `每月${day ?? ''}号`;
    default:
      return '';
  }
};

export const InvestmentPlanModal: React.FC<InvestmentPlanModalProps> = ({
  isOpen,
  onClose,
  prefillFundCode,
}) => {
  const funds = useLiveQuery(() => db.funds.toArray());
  const plans = useLiveQuery(() => getAllInvestmentPlans());

  const [selectedFundCode, setSelectedFundCode] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<InvestmentFrequency>('daily');
  const [frequencyDay, setFrequencyDay] = useState<string>('');
  const [inputError, setInputError] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const noSpinnerClass =
    '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';

  // 重置表单，如果有预选基金则自动进入添加模式
  useEffect(() => {
    if (isOpen) {
      if (prefillFundCode) {
        setSelectedFundCode(prefillFundCode);
        setIsAdding(true);
      } else {
        setSelectedFundCode('');
        setIsAdding(false);
      }
      setAmount('');
      setFrequency('daily');
      setFrequencyDay('');
      setInputError('');
    }
  }, [isOpen, prefillFundCode]);

  // 频率变化时重置 day
  useEffect(() => {
    setFrequencyDay('');
  }, [frequency]);

  // 基金选项（仅展示已持仓基金）
  const fundOptions = (funds || [])
    .filter((f) => f.code)
    .map((f) => ({
      value: f.code,
      label: `${f.name} (${f.code})`,
    }));

  // 计划对应基金名称
  const fundNameByCode = new Map((funds || []).map((f) => [f.code, f.name]));

  // 预选基金名称
  const prefillFundName = prefillFundCode
    ? fundNameByCode.get(prefillFundCode) || prefillFundCode
    : null;
  // 预选基金是否已有计划
  const prefillPlanExists = prefillFundCode
    ? (plans || []).some((p) => p.fundCode === prefillFundCode)
    : false;

  const handleAddPlan = async () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) {
      setInputError('请输入有效的定投金额');
      return;
    }
    if (!selectedFundCode) {
      setInputError('请选择基金');
      return;
    }
    if (frequency !== 'daily' && !frequencyDay) {
      setInputError('请选择定投日期');
      return;
    }

    setInputError('');
    await addInvestmentPlan({
      fundCode: selectedFundCode,
      amount: val,
      active: true,
      frequency,
      frequencyDay: frequency !== 'daily' ? Number(frequencyDay) : undefined,
    });

    setSelectedFundCode('');
    setAmount('');
    setIsAdding(false);
  };

  const handleToggleActive = async (planId: number, currentActive: boolean) => {
    await updateInvestmentPlan(planId, { active: !currentActive });
  };

  const handleDelete = async (planId: number) => {
    await deleteInvestmentPlan(planId);
  };

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} overlayId="investment-plan-modal" edgeSwipe>
      {/* Header */}
      <div className="p-4 border-b border-[var(--app-shell-line)] flex justify-between items-center bg-[var(--app-shell-panel)] shrink-0">
        <h3 className="font-bold text-[var(--app-shell-ink)]">定投计划</h3>
        <button
          onClick={onClose}
          className="rounded-full p-1 text-[var(--app-shell-muted)] transition-colors hover:bg-[var(--app-shell-line)]"
        >
          <Icons.Plus className="transform rotate-45" />
        </button>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto flex-1">
        {/* 现有计划列表 */}
        {plans && plans.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[var(--app-shell-muted)] uppercase tracking-wider">
              现有计划 ({plans.length})
            </div>
            {plans.map((plan) => {
              const fundName = fundNameByCode.get(plan.fundCode) || plan.fundCode;
              return (
                <div
                  key={plan.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-[var(--app-shell-panel-strong)] border border-[var(--app-shell-line)]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--app-shell-ink)] truncate">
                      {fundName}
                    </div>
                    <div className="text-xs text-[var(--app-shell-muted)] mt-0.5">
                      {plan.fundCode} · {formatFrequency(plan.frequency, plan.frequencyDay)} · ¥
                      {plan.amount.toFixed(2)}
                    </div>
                    {plan.lastExecutedDate && (
                      <div className="text-[10px] text-[var(--app-shell-muted)] mt-0.5">
                        上次执行: {plan.lastExecutedDate}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    {/* 启用/停用开关 */}
                    <button
                      onClick={() => plan.id != null && handleToggleActive(plan.id, plan.active)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 ease-in-out focus:outline-none ${
                        plan.active
                          ? 'bg-[var(--app-shell-accent)]'
                          : 'bg-[var(--app-shell-line-strong)]'
                      }`}
                      style={{
                        boxShadow: plan.active ? '0 0 10px var(--app-shell-accent-soft)' : 'none',
                      }}
                    >
                      <span className="sr-only">Toggle Switch</span>
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ease-in-out ${
                          plan.active ? 'translate-x-6' : 'translate-x-1'
                        }`}
                        style={{
                          boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                        }}
                      />
                    </button>
                    {/* 删除按钮 */}
                    <button
                      onClick={() => plan.id != null && handleDelete(plan.id)}
                      className="p-1 text-[var(--app-shell-muted)] hover:text-red-500 transition-colors"
                    >
                      <Icons.Plus className="transform rotate-45 w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 预选基金已有计划提示 */}
        {prefillPlanExists && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 text-sm text-amber-700 dark:text-amber-300">
            {prefillFundName} 已有定投计划，请在列表中管理。
          </div>
        )}

        {/* 添加新计划 */}
        {isAdding ? (
          <div className="space-y-3 p-4 rounded-xl bg-[var(--app-shell-panel)] border border-[var(--app-shell-line)]">
            <div className="text-sm font-semibold text-[var(--app-shell-ink)]">
              {prefillFundCode ? `为 ${prefillFundName} 设置定投` : '新建定投计划'}
            </div>

            {/* 基金选择（预选时仅展示不可改） */}
            {prefillFundCode ? (
              <div className="p-2 rounded-lg bg-[var(--app-shell-panel-strong)] border border-[var(--app-shell-line)] text-sm text-[var(--app-shell-ink)]">
                {prefillFundName} ({prefillFundCode})
              </div>
            ) : (
              <SelectDropdown
                options={fundOptions}
                value={selectedFundCode}
                onChange={(value) => {
                  setSelectedFundCode(value);
                  setInputError('');
                }}
                placeholder="选择已持仓基金"
              />
            )}

            {/* 金额输入 */}
            <div>
              <label className="block text-xs font-medium text-[var(--app-shell-muted)] mb-1">
                每次定投金额 (CNY)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setInputError('');
                }}
                placeholder="如: 100"
                className={`w-full p-2 rounded-lg bg-[var(--app-shell-panel-strong)] border text-sm text-[var(--app-shell-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--app-shell-accent-soft)] focus:border-[var(--app-shell-accent)] ${noSpinnerClass} ${
                  inputError ? 'border-red-400' : 'border-[var(--app-shell-line)]'
                }`}
                inputMode="decimal"
              />
            </div>

            {/* 频率选择 */}
            <div>
              <label className="block text-xs font-medium text-[var(--app-shell-muted)] mb-1">
                定投频率
              </label>
              <div className="flex gap-2">
                {FREQUENCY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFrequency(opt.value)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      frequency === opt.value
                        ? 'bg-[var(--app-shell-accent)] text-white'
                        : 'bg-[var(--app-shell-panel-strong)] text-[var(--app-shell-muted)] border border-[var(--app-shell-line)] hover:text-[var(--app-shell-ink)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 频率日期选择 */}
            {frequency !== 'daily' && (
              <div>
                <label className="block text-xs font-medium text-[var(--app-shell-muted)] mb-1">
                  {frequency === 'weekly' ? '选择星期' : '选择日期'}
                </label>
                {frequency === 'weekly' ? (
                  <div className="grid grid-cols-7 gap-1">
                    {WEEKDAY_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setFrequencyDay(opt.value)}
                        className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          frequencyDay === opt.value
                            ? 'bg-[var(--app-shell-accent)] text-white'
                            : 'bg-[var(--app-shell-panel-strong)] text-[var(--app-shell-muted)] border border-[var(--app-shell-line)] hover:text-[var(--app-shell-ink)]'
                        }`}
                      >
                        {opt.label.replace('周', '')}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-7 gap-1 max-h-32 overflow-y-auto">
                    {MONTH_DAY_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setFrequencyDay(opt.value)}
                        className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          frequencyDay === opt.value
                            ? 'bg-[var(--app-shell-accent)] text-white'
                            : 'bg-[var(--app-shell-panel-strong)] text-[var(--app-shell-muted)] border border-[var(--app-shell-line)] hover:text-[var(--app-shell-ink)]'
                        }`}
                      >
                        {opt.value}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 提示 */}
            <p className="text-[11px] text-[var(--app-shell-muted)]">
              按设定频率自动创建买入交易，遵循基金 T+N 结算规则
            </p>

            {inputError && <p className="text-xs text-red-500">{inputError}</p>}

            {/* 按钮 */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => {
                  setIsAdding(false);
                  setInputError('');
                }}
                className="flex-1 py-2 rounded-lg text-sm text-[var(--app-shell-muted)] bg-[var(--app-shell-panel-strong)] hover:text-[var(--app-shell-ink)] transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAddPlan}
                className="flex-1 py-2 rounded-lg text-sm text-white bg-blue-500 hover:bg-blue-600 transition-colors"
              >
                确认
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full p-3 rounded-xl border-2 border-dashed border-[var(--app-shell-line-strong)] text-[var(--app-shell-muted)] hover:text-[var(--app-shell-accent)] hover:border-[var(--app-shell-accent)] transition-colors text-sm"
          >
            + 新增定投计划
          </button>
        )}
      </div>
    </ModalShell>
  );
};
