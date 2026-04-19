/// <reference types="vitest/globals" />
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AiHoldingsAnalysisModal } from '../AiHoldingsAnalysisModal';
import { LanguageProvider } from '../../services/i18n';

const { analyzeHoldingsChatStreamMock } = vi.hoisted(() => ({
  analyzeHoldingsChatStreamMock: vi.fn(async () => '分析完成'),
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
  const actual = await vi.importActual<typeof import('../../services/aiAnalysis')>(
    '../../services/aiAnalysis',
  );

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

const renderModal = () =>
  render(
    <LanguageProvider>
      <AiHoldingsAnalysisModal isOpen onClose={vi.fn()} holdingsSnapshot={holdingsSnapshot} />
    </LanguageProvider>,
  );

describe('AiHoldingsAnalysisModal', () => {
  beforeEach(() => {
    window.localStorage.clear();
    analyzeHoldingsChatStreamMock.mockClear();
  });

  it('支持切换分析模式并带着 mode 调用分析接口', async () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: '风险评估' }));
    fireEvent.change(screen.getByPlaceholderText('输入你想了解的问题…'), {
      target: { value: '帮我看看风险' },
    });
    fireEvent.click(screen.getByRole('button', { name: '分析持仓' }));

    await waitFor(() => expect(analyzeHoldingsChatStreamMock).toHaveBeenCalled());
    expect(analyzeHoldingsChatStreamMock.mock.calls[0][0].analysisMode).toBe('risk');
  });

  it('点击快捷问题模板后填入问题框', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: '分析我的持仓风险' }));

    expect(screen.getByPlaceholderText('输入你想了解的问题…')).toHaveValue('分析我的持仓风险');
  });

  it('支持重命名并删除当前会话', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('新的会话名');
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderModal();

    fireEvent.click(screen.getByRole('button', { name: '会话更多操作' }));
    fireEvent.click(screen.getByRole('button', { name: /重命名会话/ }));
    const renamedNodes = await screen.findAllByText('新的会话名');
    expect(renamedNodes.length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: '会话更多操作' }));
    fireEvent.click(screen.getByRole('button', { name: /删除会话/ }));
    await waitFor(() => {
      expect(screen.queryByText('新的会话名')).not.toBeInTheDocument();
    });
  });

  it('支持导出 markdown 会话记录', async () => {
    const createObjectURL = vi.fn(() => 'blob:mock');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(window.URL, 'createObjectURL', { value: createObjectURL, writable: true });
    Object.defineProperty(window.URL, 'revokeObjectURL', { value: revokeObjectURL, writable: true });

    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    renderModal();

    fireEvent.change(screen.getByPlaceholderText('输入你想了解的问题…'), {
      target: { value: '帮我总结一下' },
    });
    fireEvent.click(screen.getByRole('button', { name: '分析持仓' }));

    await waitFor(() => expect(analyzeHoldingsChatStreamMock).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: '导出会话' }));
    fireEvent.click(screen.getByRole('button', { name: /导出 Markdown/ }));

    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
  });

  it('默认展示聊天主区，并通过按钮打开分析抽屉', () => {
    renderModal();

    expect(screen.getByRole('button', { name: '查看分析面板' })).toBeInTheDocument();
    expect(screen.queryByText('资产配置')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '查看分析面板' }));
    expect(screen.getByTestId('ai-analysis-inspector')).toBeInTheDocument();
    expect(screen.getByText('资产配置')).toBeInTheDocument();
    expect(screen.getByText('收益对比')).toBeInTheDocument();
    expect(screen.getByText('组合总览')).toBeInTheDocument();
    expect(screen.getByText('提醒与计划')).toBeInTheDocument();
    expect(screen.getByText('图表洞察')).toBeInTheDocument();
  });

  it('支持开启并设置定期分析提醒', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: '查看分析面板' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '开启定期提醒' }));
    fireEvent.change(screen.getByRole('combobox', { name: '提醒频率' }), {
      target: { value: 'weekly' },
    });

    expect(screen.getByRole('checkbox', { name: '开启定期提醒' })).toBeChecked();
    expect(screen.getByRole('combobox', { name: '提醒频率' })).toHaveValue('weekly');
  });

  it('桌面端使用 min(90vh,980px) 的双栏工作台，并保留模糊背景层', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1440, writable: true });
    renderModal();

    const shell = screen.getByTestId('ai-analysis-modal-shell');
    expect(shell.className).toContain('sm:w-[1120px]');
    expect(shell.className).toContain('sm:h-[min(90vh,980px)]');

    const overlay = shell.closest('.fixed');
    expect(overlay?.className).toContain('backdrop-blur');

    const viewport = screen.getByTestId('ai-analysis-message-viewport');
    expect(viewport.className).toContain('overflow-y-auto');
  });

  it('工具栏、消息区、输入区构成主区三段式', () => {
    renderModal();

    const toolbar = screen.getByTestId('ai-analysis-toolbar');
    const viewport = screen.getByTestId('ai-analysis-message-viewport');
    const composer = screen.getByTestId('ai-analysis-composer');
    const mainSection = toolbar.parentElement;

    expect(mainSection).toBe(viewport.parentElement);
    expect(mainSection).toBe(composer.parentElement);
    expect(screen.getByText('当前对话')).toBeInTheDocument();
  });

  it('消息区使用更舒适的阅读宽度与平滑滚动容器', async () => {
    renderModal();

    fireEvent.change(screen.getByPlaceholderText('输入你想了解的问题…'), {
      target: { value: '请详细分析我的组合' },
    });
    fireEvent.click(screen.getByRole('button', { name: '分析持仓' }));

    await waitFor(() => expect(analyzeHoldingsChatStreamMock).toHaveBeenCalled());

    const scrollRegion = screen.getByTestId('ai-analysis-message-viewport');
    expect(scrollRegion.className).toContain('scroll-smooth');

    const assistantArticle = screen.getByText('分析完成').closest('article');
    expect(assistantArticle?.className).toContain('max-w-3xl');
  });
});
