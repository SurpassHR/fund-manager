/// <reference types="vitest/globals" />
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPage } from './SettingsPage';

const mockedDeps = vi.hoisted(() => ({
  setGithubToken: vi.fn(),
  setDefaultGistTarget: vi.fn(),
  verifyGithubToken: vi.fn(),
  listSyncGists: vi.fn(),
  downloadSyncGistContent: vi.fn(),
  createSyncGist: vi.fn(),
  overwriteSyncGist: vi.fn(),
  importFundsFromBackupContent: vi.fn(),
  exportFundsToJsonString: vi.fn(),
  t: (k: string) => k,
  theme: { mode: 'system' as const, setMode: vi.fn() },
  settings: {
    autoRefresh: false,
    setAutoRefresh: vi.fn(),
    aiProvider: 'openai' as const,
    setAiProvider: vi.fn(),
    openaiApiKey: '',
    setOpenaiApiKey: vi.fn(),
    openaiModel: 'gpt-4o-mini',
    setOpenaiModel: vi.fn(),
    geminiApiKey: '',
    setGeminiApiKey: vi.fn(),
    geminiModel: 'gemini-3.1-flash-lite-preview',
    setGeminiModel: vi.fn(),
    githubToken: 'ghp_abcdefghijklmnopqrstuvwxyz123456',
    setGithubToken: vi.fn(),
    defaultGistTarget: null as null | {
      id: string;
      description: string;
      updatedAt: string;
      fileName: string;
    },
    setDefaultGistTarget: vi.fn(),
  },
}));

let chooserLastProps: Record<string, unknown> | null = null;

vi.mock('../services/i18n', () => ({
  useTranslation: () => ({ t: mockedDeps.t }),
}));

vi.mock('../services/ThemeContext', () => ({
  useTheme: () => mockedDeps.theme,
}));

vi.mock('../services/SettingsContext', () => ({
  useSettings: () => mockedDeps.settings,
}));

vi.mock('../services/aiOcr', () => ({
  listOpenAiModels: vi.fn(async () => []),
  listGeminiModels: vi.fn(async () => []),
}));

vi.mock('../services/db', () => ({
  exportFunds: vi.fn(async () => {}),
  importFunds: vi.fn(async () => ({ added: 1, skipped: 0 })),
  importFundsFromBackupContent: mockedDeps.importFundsFromBackupContent,
  exportFundsToJsonString: mockedDeps.exportFundsToJsonString,
}));

vi.mock('../services/gistSync/index', () => ({
  GIST_SYNC_FILENAME: 'fund-manager-sync.json',
  GistClientError: class extends Error {
    code: string;

    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
  validateGithubTokenFormat: () => ({ isValid: true, normalizedToken: 'ghp_test' }),
  verifyGithubToken: mockedDeps.verifyGithubToken,
  listSyncGists: mockedDeps.listSyncGists,
  downloadSyncGistContent: mockedDeps.downloadSyncGistContent,
  createSyncGist: mockedDeps.createSyncGist,
  overwriteSyncGist: mockedDeps.overwriteSyncGist,
}));

vi.mock('./GistSyncChooserCard', () => ({
  GistSyncChooserCard: (props: Record<string, unknown>) => {
    chooserLastProps = props;
    return <div data-testid="gist-chooser" />;
  },
}));

describe('SettingsPage gist sync integration', () => {
  const findViewRoot = (container: HTMLElement): HTMLDivElement | undefined => {
    return Array.from(container.querySelectorAll('div')).find((node) =>
      node.className.includes('min-h-[60vh]'),
    ) as HTMLDivElement | undefined;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    chooserLastProps = null;
    mockedDeps.verifyGithubToken.mockResolvedValue({ id: 1, login: 'tester' });
    mockedDeps.listSyncGists.mockResolvedValue([
      {
        id: 'g1',
        description: '默认备份',
        updated_at: '2026-03-19T00:00:00Z',
        hasSyncFile: true,
        files: { 'fund-manager-sync.json': { filename: 'fund-manager-sync.json' } },
      },
    ]);
    mockedDeps.downloadSyncGistContent.mockResolvedValue('{"version":1,"funds":[]}');
    mockedDeps.importFundsFromBackupContent.mockResolvedValue({ added: 1, skipped: 0 });
    mockedDeps.exportFundsToJsonString.mockResolvedValue('{"version":1,"funds":[]}');
    mockedDeps.createSyncGist.mockResolvedValue({
      id: 'g-new',
      description: '新建',
      updated_at: '2026-03-20T00:00:00Z',
      hasSyncFile: true,
      files: { 'fund-manager-sync.json': { filename: 'fund-manager-sync.json' } },
    });
    mockedDeps.overwriteSyncGist.mockResolvedValue({
      id: 'g1',
      description: '覆盖',
      updated_at: '2026-03-20T00:00:00Z',
      hasSyncFile: true,
      files: { 'fund-manager-sync.json': { filename: 'fund-manager-sync.json' } },
    });
    vi.stubGlobal('alert', vi.fn());
  });

  it('verifies token and fetches filtered gist list', async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      expect(mockedDeps.verifyGithubToken).toHaveBeenCalled();
      expect(mockedDeps.listSyncGists).toHaveBeenCalled();
    });
  });

  it('opens chooser and handles download callback', async () => {
    render(<SettingsPage />);

    await waitFor(() => expect(mockedDeps.listSyncGists).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'common.gistSync' }));
    const downloadButton = await screen.findByRole('button', { name: 'common.gistSyncDownload' });
    fireEvent.click(downloadButton);

    expect(chooserLastProps?.isOpen).toBe(true);
    await (chooserLastProps?.onRequestDownload as (gistId: string) => Promise<void>)('g1');

    expect(mockedDeps.downloadSyncGistContent).toHaveBeenCalledWith({
      token: expect.any(String),
      gistId: 'g1',
    });
    expect(mockedDeps.importFundsFromBackupContent).toHaveBeenCalled();
  });

  it('handles upload create and overwrite branches', async () => {
    render(<SettingsPage />);
    await waitFor(() => expect(mockedDeps.listSyncGists).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'common.gistSync' }));
    const uploadButton = await screen.findByRole('button', { name: 'common.gistSyncUpload' });
    fireEvent.click(uploadButton);

    await (
      chooserLastProps?.onRequestUpload as (payload: {
        mode: 'create' | 'overwrite';
        gistId?: string;
        description: string;
      }) => Promise<void>
    )({ mode: 'create', description: '新建描述' });
    expect(mockedDeps.createSyncGist).toHaveBeenCalled();

    await (
      chooserLastProps?.onRequestUpload as (payload: {
        mode: 'create' | 'overwrite';
        gistId?: string;
        description: string;
      }) => Promise<void>
    )({ mode: 'overwrite', gistId: 'g1', description: '覆盖描述' });
    expect(mockedDeps.overwriteSyncGist).toHaveBeenCalled();
  });

  it('为主视图与二级视图保留 fixed 头部顶部安全间距', async () => {
    const { container } = render(<SettingsPage />);

    const mainRoot = findViewRoot(container);
    expect(mainRoot?.className).toContain('pt-20');
    expect(mainRoot?.className).toContain('md:pt-24');

    fireEvent.click(screen.getByRole('button', { name: 'common.gistSync' }));

    await waitFor(() => {
      const gistRoot = findViewRoot(container);
      expect(gistRoot?.className).toContain('pt-20');
      expect(gistRoot?.className).toContain('md:pt-24');
    });

    const { container: aiContainer } = render(<SettingsPage initialShowAiSettings />);
    const aiRoot = findViewRoot(aiContainer);
    expect(aiRoot?.className).toContain('pt-20');
    expect(aiRoot?.className).toContain('md:pt-24');
  });
});
