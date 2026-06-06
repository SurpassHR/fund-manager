/// <reference types="vitest/globals" />
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type * as AiAnalysisModule from '../../services/aiAnalysis';
import { LanguageProvider } from '../../services/i18n';
import { AiHoldingsAnalysisModal } from '../AiHoldingsAnalysisModal';

const { analyzeHoldingsChatStreamMock } = vi.hoisted(() => ({
  analyzeHoldingsChatStreamMock: vi.fn(async () => '## 结论\n\n组合偏进攻，建议适当均衡。'),
}));

vi.mock('../../services/SettingsContext', () => ({
  useSettings: () => ({
    aiProvider: 'openai',
    openaiApiKey: 'test-key',
    openaiModel: 'gpt-4o-mini',
    geminiApiKey: '',
    geminiModel: 'gemini-2.5-flash',
    customOpenAiApiKey: '',
    customOpenAiBaseUrl: '',
    customOpenAiModelsEndpoint: '',
    customOpenAiModel: '',
    llmProviders: [],
    businessModelConfig: undefined,
  }),
}));

vi.mock('../../services/aiAnalysis', async () => {
  const actual = await vi.importActual<typeof AiAnalysisModule>('../../services/aiAnalysis');

  return {
    ...actual,
    analyzeHoldingsChatStream: analyzeHoldingsChatStreamMock,
  };
});

const holdingsSnapshot = {
  asOf: '2026-04-18',
  currency: 'CNY',
  totalAssets: 100000,
  totalDayGain: 300,
  totalDayGainPct: 0.3,
  holdingGain: 5000,
  holdingGainPct: 5,
  holdings: [
    {
      code: '000001',
      name: '测试基金',
      platform: '支付宝',
      holdingShares: 100,
      costPrice: 1,
      currentNav: 1.1,
      marketValue: 110,
      totalCost: 100,
      totalGain: 10,
      totalGainPct: 10,
      dayChangePct: 1,
      dayChangeVal: 1,
      lastUpdate: '2026-04-18',
    },
  ],
};

describe('AiHoldingsAnalysisModal integration', () => {
  beforeEach(() => {
    window.localStorage.clear();
    analyzeHoldingsChatStreamMock.mockClear();
    Object.defineProperty(window.URL, 'createObjectURL', { value: vi.fn(() => 'blob:mock') });
    Object.defineProperty(window.URL, 'revokeObjectURL', { value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  it('支持双栏聊天流与导出流程', async () => {
    render(
      <LanguageProvider>
        <AiHoldingsAnalysisModal isOpen onClose={vi.fn()} holdingsSnapshot={holdingsSnapshot} />
      </LanguageProvider>,
    );

    expect(screen.getByText('会话列表')).toBeInTheDocument();
    expect(screen.getByText('当前对话')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查看分析面板' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '风险评估' }));
    fireEvent.click(screen.getByRole('button', { name: '分析我的持仓风险' }));
    fireEvent.click(screen.getByRole('button', { name: '分析持仓' }));

    await waitFor(() => expect(analyzeHoldingsChatStreamMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('组合偏进攻，建议适当均衡。')).toBeInTheDocument();
    const assistantBubble = screen.getByText('组合偏进攻，建议适当均衡。').closest('[class*="max-w-"]');
    expect(assistantBubble?.className).toContain('max-w-3xl');

    fireEvent.click(screen.getByRole('button', { name: '查看分析面板' }));
    expect(screen.getByTestId('ai-analysis-inspector')).toBeInTheDocument();
    expect(screen.getByText('图表洞察')).toBeInTheDocument();
    expect(screen.getByText('资产配置')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '导出 Markdown' }));
    expect(window.URL.createObjectURL).toHaveBeenCalled();
  });
});
