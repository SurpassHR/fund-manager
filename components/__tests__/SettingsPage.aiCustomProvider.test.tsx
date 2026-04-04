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
    render(<SettingsPage initialShowAiSettings />);

    expect(screen.getByDisplayValue('https://api.example.com/v1')).toBeTruthy();
    expect(screen.getByDisplayValue('qwen-plus')).toBeTruthy();
  });

  it('模型拉取失败时保留手动输入能力', async () => {
    mockedDeps.listCustomOpenAiModels.mockRejectedValueOnce(new Error('boom'));
    render(<SettingsPage initialShowAiSettings />);

    await waitFor(() => {
      expect(mockedDeps.listCustomOpenAiModels).toHaveBeenCalled();
    });

    const modelInput = screen.getByDisplayValue('qwen-plus');
    fireEvent.change(modelInput, { target: { value: 'manual-model' } });

    expect(mockedDeps.settings.setCustomOpenAiModel).toHaveBeenCalledWith('manual-model');
  });
});
