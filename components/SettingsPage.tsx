import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Icons } from './Icon';
import { useTranslation } from '../services/i18n';
import { useTheme } from '../services/ThemeContext';
import { useSettings } from '../services/SettingsContext';
import {
  exportFunds,
  exportFundsToJsonString,
  importFunds,
  importFundsFromBackupContent,
} from '../services/db';
import { listCustomOpenAiModels, listGeminiModels, listOpenAiModels } from '../services/aiOcr';
import {
  createSyncGist,
  downloadSyncGistContent,
  GIST_SYNC_FILENAME,
  GistClientError,
  listSyncGists,
  overwriteSyncGist,
  validateGithubTokenFormat,
  verifyGithubToken,
  type GistListItem,
} from '../services/gistSync/index';
import { GistSyncChooserCard } from './GistSyncChooserCard';
import { AnimatedSwitcher } from './transitions/AnimatedSwitcher';
import { getConfiguredLlmProviders } from '../services/aiProviderConfig';

interface SettingsPageProps {
  onBack?: () => void;
  initialShowAiSettings?: boolean;
}

type ThemeOption = 'system' | 'light' | 'dark';
type SettingsView = 'main' | 'ai' | 'gist';

export const SettingsPage: React.FC<SettingsPageProps> = ({ onBack, initialShowAiSettings }) => {
  const { t } = useTranslation();
  const { mode, setMode } = useTheme();
  const {
    autoRefresh,
    setAutoRefresh,
    openaiApiKey,
    setOpenaiApiKey,
    setOpenaiModel,
    customOpenAiApiKey,
    setCustomOpenAiApiKey,
    customOpenAiBaseUrl,
    setCustomOpenAiBaseUrl,
    customOpenAiModelsEndpoint,
    setCustomOpenAiModelsEndpoint,
    setCustomOpenAiModel,
    geminiApiKey,
    setGeminiApiKey,
    setGeminiModel,
    githubToken,
    setGithubToken,
    defaultGistTarget,
    setDefaultGistTarget,
    llmProviders,
    addLlmProvider,
    updateLlmProvider,
    removeLlmProvider,
    businessModelConfig,
    updateBusinessModelConfig,
  } = useSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeView, setActiveView] = useState<SettingsView>(initialShowAiSettings ? 'ai' : 'main');
  const [openaiModels, setOpenaiModels] = useState<string[]>([]);
  const [customOpenAiModels, setCustomOpenAiModels] = useState<string[]>([]);
  const [customProviderModelsById, setCustomProviderModelsById] = useState<
    Record<string, string[]>
  >({});
  const [geminiModels, setGeminiModels] = useState<string[]>([]);
  const [, setOpenaiLoading] = useState(false);
  const [, setCustomOpenAiLoading] = useState(false);
  const [, setGeminiLoading] = useState(false);
  const [, setOpenaiError] = useState('');
  const [, setCustomOpenAiError] = useState('');
  const [, setGeminiError] = useState('');
  const [tokenFormatState, setTokenFormatState] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [tokenApiState, setTokenApiState] = useState<'idle' | 'checking' | 'valid' | 'invalid'>(
    'idle',
  );
  const [syncGists, setSyncGists] = useState<GistListItem[]>([]);
  const [gistChooserOpen, setGistChooserOpen] = useState(false);
  const [gistChooserMode, setGistChooserMode] = useState<'download' | 'upload'>('download');
  const [syncBusy, setSyncBusy] = useState(false);
  const [gistListRefreshing, setGistListRefreshing] = useState(false);
  const [gistListCooldownSec, setGistListCooldownSec] = useState(0);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [showAddProvider, setShowAddProvider] = useState(false);
  const providerItems = llmProviders;

  const getProviderModels = (provider: 'openai' | 'gemini' | 'customOpenAi') => {
    if (provider === 'openai') return openaiModels;
    if (provider === 'gemini') return geminiModels;
    return customOpenAiModels;
  };

  useEffect(() => {
    if (!providerItems.length) {
      setSelectedProviderId('');
      return;
    }
    if (!providerItems.some((provider) => provider.id === selectedProviderId)) {
      setSelectedProviderId(providerItems[0].id);
    }
  }, [providerItems, selectedProviderId]);

  const themeOptions: { value: ThemeOption; label: string; icon: React.ReactNode }[] = [
    {
      value: 'system',
      label: t('common.themeSystem'),
      icon: <Icons.Settings size={18} />,
    },
    {
      value: 'light',
      label: t('common.themeLight'),
      icon: <Icons.Sun size={18} />,
    },
    {
      value: 'dark',
      label: t('common.themeDark'),
      icon: <Icons.Moon size={18} />,
    },
  ];

  const handleExport = async () => {
    try {
      await exportFunds();
    } catch (e) {
      console.error('Export failed', e);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await importFunds(file);
      const msg = (t('common.importSuccess') || '新增 {added} 条，跳过 {skipped} 条重复')
        .replace('{added}', String(result.added))
        .replace('{skipped}', String(result.skipped));
      alert(msg);
    } catch (err) {
      alert(t('common.importError') || '导入失败');
      console.error(err);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getSyncErrorMessage = (error: unknown): string => {
    if (!(error instanceof GistClientError)) {
      return t('common.gistSyncErrorUnknown') || 'Gist 同步失败，请稍后重试。';
    }

    if (error.code === 'UNAUTHORIZED') {
      return t('common.gistSyncErrorUnauthorized') || 'Token 未授权（401）。';
    }
    if (error.code === 'FORBIDDEN') {
      return t('common.gistSyncErrorForbidden') || '访问被拒绝（403）。';
    }
    if (error.code === 'NOT_FOUND' || error.code === 'SYNC_FILE_NOT_FOUND') {
      return t('common.gistSyncErrorNotFound') || '目标 gist 不存在（404）。';
    }
    if (error.code === 'VALIDATION_FAILED' || error.code === 'UNPROCESSABLE') {
      return t('common.gistSyncErrorValidation') || '请求校验失败（422）。';
    }
    if (error.code === 'NETWORK_ERROR') {
      return t('common.gistSyncErrorNetwork') || '网络异常，请重试。';
    }

    return t('common.gistSyncErrorUnknown') || 'Gist 同步失败，请稍后重试。';
  };

  const getUnknownSyncErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
      if (error.message.includes('无效的备份文件格式')) {
        return (
          t('common.gistSyncErrorInvalidBackup') ||
          'Gist 文件内容不是有效备份格式，请选择包含 fund-manager-sync.json 的正确备份。'
        );
      }

      if (error.message.trim()) {
        const prefix = t('common.gistSyncErrorUnknownWithReason') || 'Gist 同步失败：';
        return `${prefix} ${error.message}`;
      }
    }

    return t('common.gistSyncErrorUnknown') || 'Gist 同步失败，请稍后重试。';
  };

  const refreshSyncGists = useCallback(
    async (token: string) => {
      const list = await listSyncGists(token);
      setSyncGists(list);

      if (!defaultGistTarget) return;
      const foundDefault = list.find((item) => item.id === defaultGistTarget.id);
      if (!foundDefault) {
        setDefaultGistTarget(null);
        alert(t('common.gistDefaultTargetFallback') || '默认目标已失效，请重新选择。');
        return;
      }

      if (
        foundDefault.description !== defaultGistTarget.description ||
        foundDefault.updated_at !== defaultGistTarget.updatedAt
      ) {
        setDefaultGistTarget({
          id: foundDefault.id,
          description: foundDefault.description,
          updatedAt: foundDefault.updated_at,
          fileName: GIST_SYNC_FILENAME,
        });
      }
    },
    [defaultGistTarget, setDefaultGistTarget, t],
  );

  const triggerGistListRefresh = async (rateLimited = false) => {
    if (!githubToken || tokenApiState !== 'valid') return;
    if (gistListRefreshing) return;
    if (rateLimited && gistListCooldownSec > 0) return;

    setGistListRefreshing(true);
    try {
      await refreshSyncGists(githubToken);
      if (rateLimited) {
        setGistListCooldownSec(5);
      }
    } finally {
      setGistListRefreshing(false);
    }
  };

  const saveDefaultTarget = (gist: GistListItem) => {
    setDefaultGistTarget({
      id: gist.id,
      description: gist.description,
      updatedAt: gist.updated_at,
      fileName: GIST_SYNC_FILENAME,
    });
  };

  const handleDownloadFromGist = async (gistId: string) => {
    if (!githubToken || syncBusy) return;
    const target = syncGists.find((item) => item.id === gistId);
    if (target?.isBackupValid === false) {
      alert(
        t('common.gistSyncErrorInvalidBackup') ||
          'Gist 文件内容不是有效备份格式，请选择包含 fund-manager-sync.json 的正确备份。',
      );
      return;
    }

    setSyncBusy(true);
    try {
      const content = await downloadSyncGistContent({ token: githubToken, gistId });
      const importResult = await importFundsFromBackupContent(content, {
        importMode: 'replaceAll',
      });
      const selected = target ?? syncGists.find((item) => item.id === gistId);
      if (selected) {
        saveDefaultTarget(selected);
      }
      const importSummary = (t('common.importSuccess') || '新增 {added} 条，跳过 {skipped} 条重复')
        .replace('{added}', String(importResult.added))
        .replace('{skipped}', String(importResult.skipped));
      alert(`${t('common.gistSyncDownloadSuccess') || '已从 gist 下载并导入。'}\n${importSummary}`);
      setGistChooserOpen(false);
      await refreshSyncGists(githubToken);
    } catch (error) {
      alert(
        error instanceof GistClientError
          ? getSyncErrorMessage(error)
          : getUnknownSyncErrorMessage(error),
      );
      if (defaultGistTarget?.id === gistId) {
        setDefaultGistTarget(null);
      }
    } finally {
      setSyncBusy(false);
    }
  };

  const handleUploadToGist = async (
    payload:
      | { mode: 'create'; description: string }
      | { mode: 'overwrite'; gistId: string; description: string },
  ) => {
    if (!githubToken || syncBusy) return;
    setSyncBusy(true);
    try {
      const backupContent = await exportFundsToJsonString();
      const saved =
        payload.mode === 'create'
          ? await createSyncGist({
              token: githubToken,
              content: backupContent,
              description: payload.description,
            })
          : await overwriteSyncGist({
              token: githubToken,
              gistId: payload.gistId,
              content: backupContent,
              description: payload.description,
            });

      saveDefaultTarget(saved);
      alert(t('common.gistSyncUploadSuccess') || '上传到 gist 成功。');
      setGistChooserOpen(false);
      await refreshSyncGists(githubToken);
    } catch (error) {
      alert(
        error instanceof GistClientError
          ? getSyncErrorMessage(error)
          : getUnknownSyncErrorMessage(error),
      );
    } finally {
      setSyncBusy(false);
    }
  };

  const handleDownloadClick = async () => {
    if (!githubToken) {
      return;
    }

    if (defaultGistTarget) {
      await handleDownloadFromGist(defaultGistTarget.id);
      return;
    }

    setGistChooserMode('download');
    setGistChooserOpen(true);
  };

  const handleUploadClick = async () => {
    if (!githubToken) {
      return;
    }

    if (defaultGistTarget) {
      await handleUploadToGist({
        mode: 'overwrite',
        gistId: defaultGistTarget.id,
        description: defaultGistTarget.description,
      });
      return;
    }

    setGistChooserMode('upload');
    setGistChooserOpen(true);
  };

  useEffect(() => {
    if (initialShowAiSettings) {
      setActiveView('ai');
    }
  }, [initialShowAiSettings]);

  useEffect(() => {
    let active = true;
    const openaiProvider = providerItems.find((provider) => provider.kind === 'openai');
    const openaiKey = openaiProvider?.apiKey || openaiApiKey;
    if (!openaiKey) {
      setOpenaiModels([]);
      setOpenaiError('');
      return;
    }
    setOpenaiLoading(true);
    setOpenaiError('');
    listOpenAiModels(openaiKey)
      .then((models) => {
        if (!active) return;
        setOpenaiModels(models);
      })
      .catch(() => {
        if (!active) return;
        setOpenaiError(t('common.modelFetchFailed') || '模型列表获取失败');
        setOpenaiModels([]);
      })
      .finally(() => {
        if (!active) return;
        setOpenaiLoading(false);
      });
    return () => {
      active = false;
    };
  }, [providerItems, openaiApiKey, t]);

  useEffect(() => {
    let active = true;
    const customProvider = providerItems.find((provider) => provider.kind === 'customOpenAi');
    const customKey = customProvider?.apiKey || customOpenAiApiKey;
    const customBaseUrl = customProvider?.baseURL || customOpenAiBaseUrl;
    const customModelsEndpoint = customProvider?.modelsEndpoint || customOpenAiModelsEndpoint;
    if (!customKey || (!customModelsEndpoint && !customBaseUrl)) {
      setCustomOpenAiModels([]);
      setCustomOpenAiError('');
      return;
    }
    setCustomOpenAiLoading(true);
    setCustomOpenAiError('');
    listCustomOpenAiModels({
      apiKey: customKey,
      baseURL: customBaseUrl,
      modelsEndpoint: customModelsEndpoint,
    })
      .then((models) => {
        if (!active) return;
        setCustomOpenAiModels(models);
      })
      .catch(() => {
        if (!active) return;
        setCustomOpenAiError(t('common.modelFetchFailed') || '模型列表获取失败');
        setCustomOpenAiModels([]);
      })
      .finally(() => {
        if (!active) return;
        setCustomOpenAiLoading(false);
      });

    return () => {
      active = false;
    };
  }, [providerItems, customOpenAiApiKey, customOpenAiBaseUrl, customOpenAiModelsEndpoint, t]);

  useEffect(() => {
    let active = true;
    const customProviders = providerItems.filter((provider) => provider.kind === 'customOpenAi');
    if (customProviders.length === 0) {
      setCustomProviderModelsById({});
      return;
    }

    const loadAllCustomProviderModels = async () => {
      const entries = await Promise.all(
        customProviders.map(async (provider) => {
          const apiKey = provider.apiKey.trim();
          const baseURL = provider.baseURL.trim();
          const modelsEndpoint = provider.modelsEndpoint.trim();
          if (!apiKey || (!baseURL && !modelsEndpoint)) {
            return [provider.id, []] as const;
          }
          try {
            const models = await listCustomOpenAiModels({
              apiKey,
              baseURL,
              modelsEndpoint,
            });
            return [provider.id, models] as const;
          } catch {
            return [provider.id, []] as const;
          }
        }),
      );

      if (!active) return;
      setCustomProviderModelsById(Object.fromEntries(entries));
    };

    void loadAllCustomProviderModels();
    return () => {
      active = false;
    };
  }, [providerItems]);

  useEffect(() => {
    let active = true;
    const geminiProvider = providerItems.find((provider) => provider.kind === 'gemini');
    const geminiKey = geminiProvider?.apiKey || geminiApiKey;
    if (!geminiKey) {
      setGeminiModels([]);
      setGeminiError('');
      return;
    }
    setGeminiLoading(true);
    setGeminiError('');
    listGeminiModels(geminiKey)
      .then((models) => {
        if (!active) return;
        setGeminiModels(models);
      })
      .catch(() => {
        if (!active) return;
        setGeminiError(t('common.modelFetchFailed') || '模型列表获取失败');
        setGeminiModels([]);
      })
      .finally(() => {
        if (!active) return;
        setGeminiLoading(false);
      });
    return () => {
      active = false;
    };
  }, [providerItems, geminiApiKey, t]);

  useEffect(() => {
    const formatted = validateGithubTokenFormat(githubToken);
    if (!formatted.isValid) {
      setTokenFormatState(githubToken ? 'invalid' : 'idle');
      setTokenApiState('idle');
      setSyncGists([]);
      return;
    }

    setTokenFormatState('valid');
    setTokenApiState('checking');
    let active = true;

    verifyGithubToken(formatted.normalizedToken)
      .then(async () => {
        if (!active) return;
        setTokenApiState('valid');
        await refreshSyncGists(formatted.normalizedToken);
      })
      .catch(() => {
        if (!active) return;
        setTokenApiState('invalid');
        setSyncGists([]);
      });

    return () => {
      active = false;
    };
  }, [githubToken, refreshSyncGists]);

  useEffect(() => {
    if (gistListCooldownSec <= 0) return;
    const timer = setTimeout(() => {
      setGistListCooldownSec((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [gistListCooldownSec]);

  const selectedProvider = providerItems.find((provider) => provider.id === selectedProviderId);
  const updateProviderWithLegacySync = (
    providerId: string,
    patch: Partial<{
      apiKey: string;
      model: string;
      baseURL: string;
      modelsEndpoint: string;
      name: string;
      icon: string;
      temperature: number;
    }>,
  ) => {
    const provider = providerItems.find((item) => item.id === providerId);
    if (!provider) return;
    updateLlmProvider(providerId, patch);

    if (provider.kind === 'openai') {
      if (typeof patch.apiKey === 'string') setOpenaiApiKey(patch.apiKey);
      if (typeof patch.model === 'string') setOpenaiModel(patch.model);
    } else if (provider.kind === 'gemini') {
      if (typeof patch.apiKey === 'string') setGeminiApiKey(patch.apiKey);
      if (typeof patch.model === 'string') setGeminiModel(patch.model);
    } else {
      if (typeof patch.apiKey === 'string') setCustomOpenAiApiKey(patch.apiKey);
      if (typeof patch.model === 'string') setCustomOpenAiModel(patch.model);
      if (typeof patch.baseURL === 'string') setCustomOpenAiBaseUrl(patch.baseURL);
      if (typeof patch.modelsEndpoint === 'string') {
        setCustomOpenAiModelsEndpoint(patch.modelsEndpoint);
      }
    }
  };

  const getProviderDisplayName = (kind: 'openai' | 'gemini' | 'customOpenAi') => {
    if (kind === 'openai') return '开放模型';
    if (kind === 'gemini') return '双子模型';
    return '兼容接口';
  };

  const businessItems: { key: 'aiHoldingsAnalysis' | 'syncHoldings'; label: string }[] = [
    { key: 'aiHoldingsAnalysis', label: t('common.businessAiHoldingsAnalysis') || '智能持仓分析' },
    { key: 'syncHoldings', label: t('common.businessSyncHoldings') || '同步持仓识别' },
  ];
  const configuredProviders = getConfiguredLlmProviders(providerItems);

  const aiSettingsView = (
    <div className="min-h-[60vh] pt-20 pb-44 md:pt-24 md:pb-28">
      <div className="px-4 py-4 md:px-5 md:py-5">
        <div className="rounded-[1.75rem] border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] p-4 shadow-[var(--app-shell-shadow)] backdrop-blur-xl md:p-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveView('main')}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] transition hover:border-[var(--app-shell-line-strong)] hover:text-[var(--app-shell-accent)]"
            >
              <Icons.ArrowUp size={18} className="-rotate-90" />
            </button>
            <div>
              <div className="text-[0.62rem] font-semibold tracking-[0.14em] text-[var(--app-shell-muted)]">
                大模型面板
              </div>
              <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[var(--app-shell-ink)]">
                {t('common.llmSettings') || '大模型配置'}
              </h2>
            </div>
          </div>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--app-shell-muted)]">
            管理识别与分析模型来源，让持仓录入流程保持可追踪、可切换、可回退。
          </p>
        </div>
      </div>

      <div className="space-y-4 px-4 md:px-5">
        <section className="rounded-[1.75rem] border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] p-4 shadow-[var(--app-shell-shadow)] backdrop-blur-xl md:p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-[0.62rem] font-semibold tracking-[0.14em] text-[var(--app-shell-muted)]">
                模型配置
              </div>
              <div className="mt-1 text-base font-semibold text-[var(--app-shell-ink)]">
                {t('common.llmSettingsManage') || '管理大模型配置'}
              </div>
            </div>
          </div>

          <div className="grid min-h-[520px] gap-4 md:grid-cols-[260px_1fr]">
            <aside className="relative rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] p-3 pb-14">
              <div className="space-y-2">
                {providerItems.map((provider) => (
                  <button
                    key={provider.id}
                    onClick={() => setSelectedProviderId(provider.id)}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition ${
                      selectedProviderId === provider.id
                        ? 'border-[var(--app-shell-line-strong)] bg-[var(--app-shell-panel)]'
                        : 'border-transparent bg-transparent hover:border-[var(--app-shell-line)]'
                    }`}
                  >
                    <span className="truncate">
                      {provider.icon} {getProviderDisplayName(provider.kind)}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--app-shell-muted)]">
                      {getProviderDisplayName(provider.kind)}
                    </span>
                  </button>
                ))}
              </div>

              <div className="absolute right-3 bottom-3">
                <button
                  onClick={() => setShowAddProvider((prev) => !prev)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)]"
                  title="新增模型提供方"
                >
                  <Icons.Plus size={16} />
                </button>
                {showAddProvider && (
                  <div className="absolute right-0 bottom-12 w-44 rounded-xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] p-2 shadow-[var(--app-shell-shadow)]">
                    {(['openai', 'gemini', 'customOpenAi'] as const).map((kind) => (
                      <button
                        key={kind}
                        onClick={() => {
                          const createdId = addLlmProvider(kind);
                          setSelectedProviderId(createdId);
                          setShowAddProvider(false);
                        }}
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--app-shell-panel-strong)]"
                      >
                        {kind === 'openai'
                          ? '开放模型'
                          : kind === 'gemini'
                            ? '双子模型'
                            : '兼容接口'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </aside>

            <div className="rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] p-4">
              {!selectedProvider ? (
                <div className="flex h-full min-h-[380px] items-center justify-center text-sm text-[var(--app-shell-muted)]">
                  请先在左侧选择模型提供方，再进行详细配置。
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-[var(--app-shell-ink)]">
                      {getProviderDisplayName(selectedProvider.kind)} 详细配置
                    </div>
                    <button
                      onClick={() => removeLlmProvider(selectedProvider.id)}
                      className="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-600"
                    >
                      删除
                    </button>
                  </div>

                  <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-shell-muted)]">
                    图标
                  </label>
                  <input
                    type="text"
                    value={selectedProvider.icon}
                    onChange={(e) =>
                      updateProviderWithLegacySync(selectedProvider.id, { icon: e.target.value })
                    }
                    className="w-full rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] px-4 py-3 text-sm"
                  />

                  <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-shell-muted)]">
                    名称
                  </label>
                  <input
                    type="text"
                    value={selectedProvider.name}
                    onChange={(e) =>
                      updateProviderWithLegacySync(selectedProvider.id, { name: e.target.value })
                    }
                    className="w-full rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] px-4 py-3 text-sm"
                  />

                  <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-shell-muted)]">
                    接口密钥
                  </label>
                  <input
                    type="password"
                    value={selectedProvider.apiKey}
                    onChange={(e) =>
                      updateProviderWithLegacySync(selectedProvider.id, { apiKey: e.target.value })
                    }
                    className="w-full rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] px-4 py-3 text-sm"
                  />

                  <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-shell-muted)]">
                    温度系数
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={2}
                    step={0.1}
                    value={selectedProvider.temperature}
                    onChange={(e) =>
                      updateProviderWithLegacySync(selectedProvider.id, {
                        temperature: Number.parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] px-4 py-3 text-sm"
                  />

                  {selectedProvider.kind === 'customOpenAi' && (
                    <>
                      <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-shell-muted)]">
                        服务地址
                      </label>
                      <input
                        type="text"
                        value={selectedProvider.baseURL}
                        onChange={(e) =>
                          updateProviderWithLegacySync(selectedProvider.id, {
                            baseURL: e.target.value,
                          })
                        }
                        className="w-full rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] px-4 py-3 text-sm"
                      />

                      <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-shell-muted)]">
                        模型列表地址
                      </label>
                      <input
                        type="text"
                        value={selectedProvider.modelsEndpoint}
                        onChange={(e) =>
                          updateProviderWithLegacySync(selectedProvider.id, {
                            modelsEndpoint: e.target.value,
                          })
                        }
                        className="w-full rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] px-4 py-3 text-sm"
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <p className="mt-4 text-xs text-[var(--app-shell-muted)]">
            配置层不包含业务用途绑定；业务动作（智能持仓分析/同步持仓）将在执行前选择模型提供方与模型。
          </p>
        </section>

        <section className="rounded-[1.75rem] border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] p-4 shadow-[var(--app-shell-shadow)] backdrop-blur-xl md:p-5">
          <div className="mb-4">
            <div className="text-[0.62rem] font-semibold tracking-[0.14em] text-[var(--app-shell-muted)]">
              {t('common.businessModelConfig') || '业务模型配置'}
            </div>
            <div className="mt-1 text-base font-semibold text-[var(--app-shell-ink)]">
              {t('common.businessModelConfigDesc') || '按业务选择模型'}
            </div>
          </div>

          <div className="space-y-3">
            {businessItems.map((item) => {
              const selected = businessModelConfig[item.key];
              const selectedBusinessProvider = configuredProviders.find(
                (provider) => provider.id === selected.providerId,
              );
              const scopedProviderModels = selectedBusinessProvider
                ? selectedBusinessProvider.kind === 'customOpenAi'
                  ? (customProviderModelsById[selectedBusinessProvider.id] ?? [])
                  : getProviderModels(selectedBusinessProvider.kind)
                : [];
              const businessModelOptions = Array.from(
                new Set(
                  [
                    ...scopedProviderModels,
                    selectedBusinessProvider?.model || '',
                    selected.model,
                  ].filter((model): model is string => Boolean(model)),
                ),
              );
              const businessModelListId = `business-model-options-${item.key}`;
              const modelPlaceholder = selected.providerId ? '可选择或输入模型' : '请先选择供应商';
              return (
                <div
                  key={item.key}
                  className="rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] p-3"
                >
                  <div className="mb-2 text-sm font-semibold text-[var(--app-shell-ink)]">
                    {item.label}
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <select
                      value={selected.providerId}
                      onChange={(e) => {
                        const providerId = e.target.value;
                        const provider = configuredProviders.find((p) => p.id === providerId);
                        updateBusinessModelConfig(item.key, {
                          providerId,
                          providerKind: provider?.kind ?? selected.providerKind,
                          model: provider?.model || selected.model,
                        });
                      }}
                      className="rounded-xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] px-3 py-2 text-sm"
                    >
                      <option value="">{t('common.chooseProvider') || '请选择供应商'}</option>
                      {configuredProviders.map((provider) => (
                        <option key={provider.id} value={provider.id}>
                          {provider.icon} {getProviderDisplayName(provider.kind)}
                        </option>
                      ))}
                    </select>
                    <input
                      list={businessModelListId}
                      value={selected.model}
                      placeholder={modelPlaceholder}
                      onChange={(e) =>
                        updateBusinessModelConfig(item.key, {
                          model: e.target.value,
                        })
                      }
                      className="rounded-xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] px-3 py-2 text-sm"
                    />
                    <datalist id={businessModelListId}>
                      {businessModelOptions.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </datalist>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );

  const gistSyncSettingsView = (
    <div className="min-h-[60vh] pt-20 pb-44 md:pt-24 md:pb-28">
      <div className="px-4 py-4 md:px-5 md:py-5">
        <div className="rounded-[1.75rem] border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] p-4 shadow-[var(--app-shell-shadow)] backdrop-blur-xl md:p-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveView('main')}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] transition hover:border-[var(--app-shell-line-strong)] hover:text-[var(--app-shell-accent)]"
            >
              <Icons.ArrowUp size={18} className="-rotate-90" />
            </button>
            <div>
              <div className="text-[0.62rem] font-semibold tracking-[0.14em] text-[var(--app-shell-muted)]">
                同步协议
              </div>
              <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[var(--app-shell-ink)]">
                {t('common.gistSync') || 'GitHub Gist 同步'}
              </h2>
            </div>
          </div>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--app-shell-muted)]">
            使用 GitHub Gist 作为远程备份目标，在本地保存 Token 并维护默认同步目标。
          </p>
        </div>
      </div>

      <div className="space-y-4 px-4 md:px-5">
        <section className="rounded-[1.75rem] border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] p-4 shadow-[var(--app-shell-shadow)] backdrop-blur-xl md:p-5">
          <div className="mb-4">
            <div className="text-[0.62rem] font-semibold tracking-[0.14em] text-[var(--app-shell-muted)]">
              凭证
            </div>
            <div className="mt-1 text-base font-semibold text-[var(--app-shell-ink)]">
              {t('common.githubToken') || 'GitHub Token'}
            </div>
          </div>

          <div className="space-y-3">
            <input
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder={t('common.githubTokenPlaceholder') || 'ghp_xxx / github_pat_xxx'}
              className="w-full rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] px-4 py-3 text-sm text-[var(--app-shell-ink)] outline-none transition focus:border-[var(--app-shell-line-strong)]"
            />
            <p className="text-sm text-[var(--app-shell-muted)]">
              {t('common.githubTokenHelp') || 'Token 仅保存在本地。'}
            </p>
            <a
              href="https://github.com/settings/tokens/new?scopes=gist&description=fund-manager-gist-sync"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex text-sm font-medium text-[var(--app-shell-accent)] hover:underline"
            >
              {t('common.githubTokenCreateLink') ||
                '没有令牌？点击创建 GitHub Personal Access Token（ghp）'}
            </a>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] px-4 py-3">
                <div className="text-[10px] font-semibold tracking-[0.14em] text-[var(--app-shell-muted)]">
                  格式
                </div>
                <div className="mt-2 text-sm font-semibold text-[var(--app-shell-ink)]">
                  {tokenFormatState === 'invalid' &&
                    (t('common.githubTokenFormatInvalid') || 'Token 格式看起来不合法。')}
                  {tokenFormatState === 'valid' &&
                    (t('common.githubTokenFormatValid') || 'Token 格式校验通过。')}
                  {tokenFormatState === 'idle' && '—'}
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] px-4 py-3">
                <div className="text-[10px] font-semibold tracking-[0.14em] text-[var(--app-shell-muted)]">
                  接口状态
                </div>
                <div className="mt-2 text-sm font-semibold text-[var(--app-shell-ink)]">
                  {tokenApiState === 'checking' &&
                    (t('common.githubTokenApiChecking') || '正在向 GitHub 验证 Token...')}
                  {tokenApiState === 'valid' &&
                    (t('common.githubTokenApiValid') || 'GitHub Token 验证通过。')}
                  {tokenApiState === 'invalid' &&
                    (t('common.githubTokenApiInvalid') || 'GitHub Token 验证失败。')}
                  {tokenApiState === 'idle' && '—'}
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] px-4 py-3 md:col-span-2 xl:col-span-1">
                <div className="text-[10px] font-semibold tracking-[0.14em] text-[var(--app-shell-muted)]">
                  默认目标
                </div>
                <div className="mt-2 text-sm font-semibold text-[var(--app-shell-ink)]">
                  {defaultGistTarget
                    ? defaultGistTarget.description || defaultGistTarget.id
                    : t('common.gistDefaultTargetNone') || '未设置默认目标'}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] p-4 shadow-[var(--app-shell-shadow)] backdrop-blur-xl md:p-5">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[0.62rem] font-semibold tracking-[0.14em] text-[var(--app-shell-muted)]">
                操作
              </div>
              <div className="mt-1 text-base font-semibold text-[var(--app-shell-ink)]">
                上传 / 下载
              </div>
            </div>
            {tokenApiState === 'valid' && syncGists.length === 0 && (
              <p className="text-sm text-amber-600 dark:text-amber-300">
                {t('common.gistChooserEmpty') || '没有可用 gist，请先新建。'}
              </p>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <button
              type="button"
              onClick={handleDownloadClick}
              disabled={tokenApiState !== 'valid' || syncBusy}
              className="rounded-2xl border border-gray-900 bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-50 dark:border-blue-400/20 dark:bg-blue-500/15 dark:text-blue-100"
            >
              {t('common.gistSyncDownload') || '从 Gist 下载'}
            </button>
            <button
              type="button"
              onClick={handleUploadClick}
              disabled={tokenApiState !== 'valid' || syncBusy}
              className="rounded-2xl border border-gray-900 bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-50 dark:border-blue-400/20 dark:bg-blue-500/15 dark:text-blue-100"
            >
              {t('common.gistSyncUpload') || '上传到 Gist'}
            </button>
            <button
              type="button"
              onClick={() => {
                setGistChooserMode('download');
                setGistChooserOpen(true);
              }}
              disabled={tokenApiState !== 'valid'}
              className="rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] px-4 py-3 text-sm font-semibold text-[var(--app-shell-ink)] transition disabled:opacity-50"
            >
              {t('common.gistChooserSelect') || '选择目标'}
            </button>
          </div>
        </section>
      </div>

      <GistSyncChooserCard
        isOpen={gistChooserOpen}
        defaultMode={gistChooserMode}
        gists={syncGists}
        onRefreshList={
          tokenApiState === 'valid'
            ? () => {
                void triggerGistListRefresh(true);
              }
            : undefined
        }
        isRefreshingList={gistListRefreshing}
        refreshCooldownSec={gistListCooldownSec}
        onClose={() => setGistChooserOpen(false)}
        onRequestDownload={(gistId) => {
          void handleDownloadFromGist(gistId);
        }}
        onRequestUpload={(payload) => {
          void handleUploadToGist(payload);
        }}
      />
    </div>
  );

  const mainSettingsView = (
    <div className="min-h-[60vh] pt-20 pb-44 md:pt-24 md:pb-28">
      <div className="px-4 py-4 md:px-5 md:py-5">
        <div className="rounded-[1.9rem] border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] p-4 shadow-[var(--app-shell-shadow)] backdrop-blur-xl md:p-5">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] transition hover:border-[var(--app-shell-line-strong)] hover:text-[var(--app-shell-accent)]"
              >
                <Icons.ArrowUp size={18} className="-rotate-90" />
              </button>
            )}
            <div>
              <div className="text-[0.62rem] font-semibold tracking-[0.14em] text-[var(--app-shell-muted)]">
                控制面板
              </div>
              <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[var(--app-shell-ink)]">
                {t('common.settings')}
              </h2>
            </div>
          </div>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--app-shell-muted)]">
            在同一控制台中管理主题、自动刷新、大模型能力与数据同步，保证持仓工作台的节奏统一。
          </p>
        </div>
      </div>

      <div className="space-y-4 px-4 md:px-5">
        <section className="rounded-[1.75rem] border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] p-4 shadow-[var(--app-shell-shadow)] backdrop-blur-xl md:p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-[0.62rem] font-semibold tracking-[0.14em] text-[var(--app-shell-muted)]">
                视觉系统
              </div>
              <div className="mt-1 text-base font-semibold text-[var(--app-shell-ink)]">
                {t('common.theme')}
              </div>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setMode(opt.value)}
                className={`rounded-2xl border px-4 py-4 text-left transition ${
                  mode === opt.value
                    ? 'border-[var(--app-shell-line-strong)] bg-[var(--app-shell-panel-strong)] text-[var(--app-shell-ink)] shadow-[0_10px_24px_rgba(15,23,42,0.08)] dark:border-blue-400/20 dark:bg-blue-500/15 dark:text-blue-100 dark:shadow-none'
                    : 'border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] text-[var(--app-shell-ink)]'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-current/15">
                      {opt.icon}
                    </div>
                    <span className="text-sm font-semibold">{opt.label}</span>
                  </div>
                  {mode === opt.value && <Icons.Check size={16} />}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] p-4 shadow-[var(--app-shell-shadow)] backdrop-blur-xl md:p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-[0.62rem] font-semibold tracking-[0.14em] text-[var(--app-shell-muted)]">
                运行设置
              </div>
              <div className="mt-1 text-base font-semibold text-[var(--app-shell-ink)]">
                {t('common.features') || '功能'}
              </div>
            </div>
            <div className="rounded-full border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] px-3 py-1 text-[10px] font-semibold tracking-[0.14em] text-[var(--app-shell-muted)]">
              已启用
            </div>
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--app-shell-line)]">
                <Icons.Refresh size={18} />
              </div>
              <span className="text-sm font-semibold text-[var(--app-shell-ink)]">
                {t('common.autoRefresh') || '自动刷新持仓行情'}
              </span>
            </div>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`relative h-7 w-12 rounded-full transition-colors ${autoRefresh ? 'bg-gray-900 dark:bg-blue-500/20' : 'bg-gray-200 dark:bg-white/10'}`}
            >
              <div
                className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${autoRefresh ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </button>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-[1.75rem] border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] p-4 shadow-[var(--app-shell-shadow)] backdrop-blur-xl md:p-5">
            <div className="mb-4">
              <div className="text-[0.62rem] font-semibold tracking-[0.14em] text-[var(--app-shell-muted)]">
                智能配置
              </div>
              <div className="mt-1 text-base font-semibold text-[var(--app-shell-ink)]">
                {t('common.llmSettings') || '大模型配置'}
              </div>
            </div>
            <button
              onClick={() => setActiveView('ai')}
              className="flex w-full items-center justify-between rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] px-4 py-4 text-left transition hover:border-[var(--app-shell-line-strong)]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--app-shell-line)]">
                  <Icons.Settings size={18} />
                </div>
                <span className="text-sm font-semibold text-[var(--app-shell-ink)]">
                  {t('common.llmSettingsManage') || '管理大模型配置'}
                </span>
              </div>
              <Icons.ArrowDown size={16} className="-rotate-90 text-[var(--app-shell-muted)]" />
            </button>
          </section>

          <section className="rounded-[1.75rem] border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] p-4 shadow-[var(--app-shell-shadow)] backdrop-blur-xl md:p-5">
            <div className="mb-4">
              <div className="text-[0.62rem] font-semibold tracking-[0.14em] text-[var(--app-shell-muted)]">
                远程备份
              </div>
              <div className="mt-1 text-base font-semibold text-[var(--app-shell-ink)]">
                {t('common.sync') || '同步'}
              </div>
            </div>
            <button
              onClick={() => setActiveView('gist')}
              className="flex w-full items-center justify-between rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] px-4 py-4 text-left transition hover:border-[var(--app-shell-line-strong)]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--app-shell-line)]">
                  <Icons.Refresh size={18} />
                </div>
                <span className="text-sm font-semibold text-[var(--app-shell-ink)]">
                  {t('common.gistSync') || 'GitHub Gist 同步'}
                </span>
              </div>
              <Icons.ArrowDown size={16} className="-rotate-90 text-[var(--app-shell-muted)]" />
            </button>
          </section>
        </div>

        <section className="rounded-[1.75rem] border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] p-4 shadow-[var(--app-shell-shadow)] backdrop-blur-xl md:p-5">
          <div className="mb-4">
            <div className="text-[0.62rem] font-semibold tracking-[0.14em] text-[var(--app-shell-muted)]">
              本地归档
            </div>
            <div className="mt-1 text-base font-semibold text-[var(--app-shell-ink)]">
              {t('common.data') || '数据'}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <button
              onClick={handleExport}
              className="flex items-center justify-between rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] px-4 py-4 text-left transition hover:border-[var(--app-shell-line-strong)]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--app-shell-line)]">
                  <Icons.ArrowUp size={18} />
                </div>
                <span className="text-sm font-semibold text-[var(--app-shell-ink)]">
                  {t('common.exportData') || '导出数据'}
                </span>
              </div>
              <Icons.ArrowDown size={16} className="-rotate-90 text-[var(--app-shell-muted)]" />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-between rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] px-4 py-4 text-left transition hover:border-[var(--app-shell-line-strong)]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--app-shell-line)]">
                  <Icons.ArrowDown size={18} />
                </div>
                <span className="text-sm font-semibold text-[var(--app-shell-ink)]">
                  {t('common.importData') || '导入数据'}
                </span>
              </div>
              <Icons.ArrowDown size={16} className="-rotate-90 text-[var(--app-shell-muted)]" />
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
        </section>
      </div>
    </div>
  );

  return (
    <AnimatedSwitcher viewKey={activeView} preset="pageFadeLift" mode="wait">
      {activeView === 'ai'
        ? aiSettingsView
        : activeView === 'gist'
          ? gistSyncSettingsView
          : mainSettingsView}
    </AnimatedSwitcher>
  );
};
