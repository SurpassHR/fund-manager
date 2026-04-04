/// <reference types="vitest/globals" />
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SettingsPage } from '../SettingsPage';

const mockedDeps = vi.hoisted(() => ({
  t: (k: string) => k,
  theme: { mode: 'system' as const, setMode: vi.fn() },
  settings: {
    autoRefresh: false,
    setAutoRefresh: vi.fn(),
    aiProvider: 'customOpenAi' as const,
    setAiProvider: vi.fn(),
    openaiApiKey: '',
    setOpenaiApiKey: vi.fn(),
    openaiModel: 'gpt-4o-mini',
    setOpenaiModel: vi.fn(),
    customOpenAiApiKey: 'custom-key',
    setCustomOpenAiApiKey: vi.fn(),
    customOpenAiBaseUrl: 'https://api.example.com/v1',
    setCustomOpenAiBaseUrl: vi.fn(),
    customOpenAiModelsEndpoint: '',
    setCustomOpenAiModelsEndpoint: vi.fn(),
    customOpenAiModel: 'qwen-plus',
    setCustomOpenAiModel: vi.fn(),
    geminiApiKey: '',
    setGeminiApiKey: vi.fn(),
    geminiModel: 'gemini-3.1-flash-lite-preview',
    setGeminiModel: vi.fn(),
    githubToken: '',
    setGithubToken: vi.fn(),
    defaultGistTarget: null,
    setDefaultGistTarget: vi.fn(),
    llmProviders: [
      {
        id: 'p-openai',
        kind: 'openai',
        name: 'OpenAI',
        apiKey: '',
        model: 'gpt-4o-mini',
        temperature: 0.2,
        icon: '🧠',
        baseURL: '',
        modelsEndpoint: '',
      },
      {
        id: 'p-custom',
        kind: 'customOpenAi',
        name: 'OpenAI Compatible',
        apiKey: 'custom-key',
        model: 'qwen-plus',
        temperature: 0.2,
        icon: '🔌',
        baseURL: 'https://api.example.com/v1',
        modelsEndpoint: '',
      },
    ],
    setLlmProviders: vi.fn(),
    addLlmProvider: vi.fn(() => 'p-custom'),
    updateLlmProvider: vi.fn(),
    removeLlmProvider: vi.fn(),
    businessModelConfig: {
      aiHoldingsAnalysis: { providerId: 'p-custom', providerKind: 'customOpenAi', model: 'qwen-plus' },
      syncHoldings: { providerId: 'p-custom', providerKind: 'customOpenAi', model: 'qwen-plus' },
    },
    setBusinessModelConfig: vi.fn(),
    updateBusinessModelConfig: vi.fn(),
  },
  listCustomOpenAiModels: vi.fn(async (_args?: unknown) => [] as string[]),
}));

vi.mock('../../services/i18n', () => ({
  useTranslation: () => ({ t: mockedDeps.t }),
}));

vi.mock('../../services/ThemeContext', () => ({
  useTheme: () => mockedDeps.theme,
}));

vi.mock('../../services/SettingsContext', () => ({
  useSettings: () => mockedDeps.settings,
}));

vi.mock('../../services/aiOcr', () => ({
  listOpenAiModels: vi.fn(async () => []),
  listGeminiModels: vi.fn(async () => []),
  listCustomOpenAiModels: (args: unknown) => mockedDeps.listCustomOpenAiModels(args),
}));

vi.mock('../../services/db', () => ({
  exportFunds: vi.fn(async () => {}),
  importFunds: vi.fn(async () => ({ added: 0, skipped: 0 })),
  importFundsFromBackupContent: vi.fn(async () => ({ added: 0, skipped: 0 })),
  exportFundsToJsonString: vi.fn(async () => '{"version":1,"funds":[]}'),
}));

vi.mock('../../services/gistSync/index', () => ({
  GIST_SYNC_FILENAME: 'fund-manager-sync.json',
  GistClientError: class extends Error {
    code = 'UNKNOWN';
  },
  validateGithubTokenFormat: () => ({ isValid: false, normalizedToken: '' }),
  verifyGithubToken: vi.fn(),
  listSyncGists: vi.fn(async () => []),
  downloadSyncGistContent: vi.fn(),
  createSyncGist: vi.fn(),
  overwriteSyncGist: vi.fn(),
}));

vi.mock('../GistSyncChooserCard', () => ({
  GistSyncChooserCard: () => null,
}));

describe('SettingsPage custom openai provider', () => {
  it('custom provider 下展示兼容配置字段', () => {
    const { container } = render(<SettingsPage initialShowAiSettings />);

    expect(screen.getByText('common.llmSettingsManage')).toBeTruthy();
    fireEvent.click(screen.getAllByText('🔌 兼容接口')[0]);

    expect(screen.getByDisplayValue('https://api.example.com/v1')).toBeTruthy();
    expect(container.querySelector('input[list="provider-model-options"]')).toBeNull();
    expect(
      screen.getByText(
        '配置层不包含业务用途绑定；业务动作（智能持仓分析/同步持仓）将在执行前选择模型提供方与模型。',
      ),
    ).toBeTruthy();
  });

  it('模型拉取失败时在业务模型区域保留手动输入能力', async () => {
    mockedDeps.listCustomOpenAiModels.mockRejectedValueOnce(new Error('boom'));
    const { container } = render(<SettingsPage initialShowAiSettings />);

    await waitFor(() => {
      expect(mockedDeps.listCustomOpenAiModels).toHaveBeenCalled();
    });

    const modelInput = container.querySelector(
      'input[list="business-model-options-aiHoldingsAnalysis"]',
    ) as HTMLInputElement;
    fireEvent.change(modelInput, { target: { value: 'manual-model' } });

    expect(mockedDeps.settings.updateBusinessModelConfig).toHaveBeenCalledWith(
      'aiHoldingsAnalysis',
      expect.objectContaining({ model: 'manual-model' }),
    );
  });
});
