/// <reference types="vitest/globals" />
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SettingsPage } from '../SettingsPage';
import { listCustomOpenAiModels } from '../../services/aiOcr';

const mocked = vi.hoisted(() => ({
  t: (k: string) => k,
  theme: { mode: 'system' as const, setMode: vi.fn() },
  settings: {
    autoRefresh: false,
    setAutoRefresh: vi.fn(),
    useUnifiedRefresh: false,
    setUseUnifiedRefresh: vi.fn(),
    aiProvider: 'openai' as const,
    setAiProvider: vi.fn(),
    openaiApiKey: '',
    setOpenaiApiKey: vi.fn(),
    openaiModel: 'gpt-4o-mini',
    setOpenaiModel: vi.fn(),
    customOpenAiApiKey: '',
    setCustomOpenAiApiKey: vi.fn(),
    customOpenAiBaseUrl: '',
    setCustomOpenAiBaseUrl: vi.fn(),
    customOpenAiModelsEndpoint: '',
    setCustomOpenAiModelsEndpoint: vi.fn(),
    customOpenAiModel: '',
    setCustomOpenAiModel: vi.fn(),
    geminiApiKey: '',
    setGeminiApiKey: vi.fn(),
    geminiModel: 'gemini-2.5-flash',
    setGeminiModel: vi.fn(),
    githubToken: '',
    setGithubToken: vi.fn(),
    defaultGistTarget: null,
    setDefaultGistTarget: vi.fn(),
    llmProviders: [
      {
        id: 'p-openai',
        kind: 'openai' as const,
        name: 'OpenAI',
        apiKey: 'openai-key',
        model: 'gpt-4o-mini',
        temperature: 0.2,
        icon: '🧠',
        baseURL: '',
        modelsEndpoint: '',
      },
      {
        id: 'p-custom-1',
        kind: 'customOpenAi' as const,
        name: '兼容接口 A',
        apiKey: 'custom-key-a',
        model: 'model-a',
        temperature: 0.2,
        icon: '🔌',
        baseURL: 'https://a.example.com',
        modelsEndpoint: '',
      },
      {
        id: 'p-custom-2',
        kind: 'customOpenAi' as const,
        name: '兼容接口 B',
        apiKey: 'custom-key-b',
        model: 'model-b',
        temperature: 0.2,
        icon: '🔌',
        baseURL: 'https://b.example.com',
        modelsEndpoint: 'https://b.example.com/models',
      },
      {
        id: 'p-gemini',
        kind: 'gemini' as const,
        name: 'Gemini',
        apiKey: '',
        model: 'gemini-2.5-flash',
        temperature: 0.2,
        icon: '✨',
        baseURL: '',
        modelsEndpoint: '',
      },
    ],
    setLlmProviders: vi.fn(),
    addLlmProvider: vi.fn(),
    updateLlmProvider: vi.fn(),
    removeLlmProvider: vi.fn(),
    businessModelConfig: {
      aiHoldingsAnalysis: {
        providerId: 'p-custom-2',
        providerKind: 'customOpenAi',
        model: 'model-b',
      },
      syncHoldings: { providerId: '', providerKind: 'openai', model: '' },
    },
    setBusinessModelConfig: vi.fn(),
    updateBusinessModelConfig: vi.fn(),
  },
}));

vi.mock('../../services/i18n', () => ({
  useTranslation: () => ({ t: mocked.t }),
}));

vi.mock('../../services/ThemeContext', () => ({
  useTheme: () => mocked.theme,
}));

vi.mock('../../services/SettingsContext', () => ({
  useSettings: () => mocked.settings,
}));

vi.mock('../../services/aiOcr', () => ({
  listOpenAiModels: vi.fn(async () => []),
  listGeminiModels: vi.fn(async () => []),
  listCustomOpenAiModels: vi.fn(async () => []),
}));

vi.mock('../../services/db', () => ({
  exportFunds: vi.fn(async () => {}),
  importFunds: vi.fn(async () => ({ added: 0, skipped: 0 })),
  importFundsFromBackupContent: vi.fn(async () => ({ added: 0, skipped: 0 })),
  exportFundsToJsonString: vi.fn(async () => '{}'),
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

describe('SettingsPage business model config panel', () => {
  it('展示业务模型配置并仅显示已配置供应商', () => {
    render(<SettingsPage initialShowAiSettings />);

    expect(screen.getByText('common.businessModelConfig')).toBeTruthy();
    expect(screen.getByText('common.businessAiHoldingsAnalysis')).toBeTruthy();
    expect(screen.getByText('common.businessSyncHoldings')).toBeTruthy();
    expect(screen.getAllByRole('option', { name: '🧠 开放模型' }).length).toBeGreaterThan(0);
    expect(screen.queryAllByRole('option', { name: '✨ 双子模型' })).toHaveLength(0);
  });

  it('业务模型下拉候选应从业务所选 provider 的 base_url/models 获取', async () => {
    render(<SettingsPage initialShowAiSettings />);

    await waitFor(() => {
      expect(listCustomOpenAiModels).toHaveBeenCalledWith({
        apiKey: 'custom-key-b',
        baseURL: 'https://b.example.com',
        modelsEndpoint: 'https://b.example.com/models',
      });
    });
  });
});
