import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { useTranslation } from '../services/i18n';
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
  const { t } = useTranslation();

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

  const selectedPlanExists =
    !prefillFundCode && (plans || []).some((p) => p.fundCode === selectedFundCode);

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
      <div className="p-4 border-b border-gray-100 dark:border-border-dark flex justify-between items-center bg-gray-50 dark:bg-white/5 shrink-0">
        <h3 className="font-bold text-gray-800 dark:text-gray-100">定投计划</h3>
        <button onClick={onClose}>
          <Icons.Plus className="transform rotate-45 text-gray-400" />
        </button>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto flex-1">
        {/* 现有计划列表 */}
        {plans && plans.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              现有计划 ({plans.length})
            </div>
            {plans.map((plan) => {
              const fundName = fundNameByCode.get(plan.fundCode) || plan.fundCode;
              return (
                <div
                  key={plan.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-border-dark"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                      {fundName}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {plan.fundCode} · {formatFrequency(plan.frequency, plan.frequencyDay)} · ¥
                      {plan.amount.toFixed(2)}
                    </div>
                    {plan.lastExecutedDate && (
                      <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                        上次执行: {plan.lastExecutedDate}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    {/* 启用/停用开关 */}
                    <button
                      onClick={() => plan.id != null && handleToggleActive(plan.id, plan.active)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        plan.active ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          plan.active ? 'translate-x-4' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    {/* 删除按钮 */}
                    <button
                      onClick={() => plan.id != null && handleDelete(plan.id)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
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
          <div className="space-y-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30">
            <div className="text-sm font-semibold text-blue-800 dark:text-blue-200">
              {prefillFundCode ? `为 ${prefillFundName} 设置定投` : '新建定投计划'}
            </div>

            {/* 基金选择（预选时仅展示不可改） */}
            {prefillFundCode ? (
              <div className="p-2 rounded-lg bg-white dark:bg-card-dark border border-blue-200 dark:border-blue-800/50 text-sm text-gray-700 dark:text-gray-300">
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
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
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
                className={`w-full p-2 rounded-lg bg-white dark:bg-card-dark border text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${noSpinnerClass} ${
                  inputError ? 'border-red-400' : 'border-gray-200 dark:border-border-dark'
                }`}
                inputMode="decimal"
              />
            </div>

            {/* 频率选择 */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                定投频率
              </label>
              <div className="flex gap-2">
                {FREQUENCY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFrequency(opt.value)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      frequency === opt.value
                        ? 'bg-blue-500 text-white'
                        : 'bg-white dark:bg-card-dark text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-border-dark'
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
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
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
                            ? 'bg-blue-500 text-white'
                            : 'bg-white dark:bg-card-dark text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-border-dark'
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
                            ? 'bg-blue-500 text-white'
                            : 'bg-white dark:bg-card-dark text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-border-dark'
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
            <p className="text-[11px] text-blue-600 dark:text-blue-400">
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
                className="flex-1 py-2 rounded-lg text-sm text-gray-500 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
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
            className="w-full p-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:text-blue-500 hover:border-blue-400 dark:hover:border-blue-500 transition-colors text-sm"
          >
            + 新增定投计划
          </button>
        )}
      </div>
    </ModalShell>
  );
};
