import React, { useEffect, useRef, useState } from 'react';
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
    ocrAiProvider,
    setOcrAiProvider,
    ocrAiModel,
    setOcrAiModel,
    analysisAiProvider,
    setAnalysisAiProvider,
    analysisAiModel,
    setAnalysisAiModel,
    openaiApiKey,
    setOpenaiApiKey,
    openaiModel,
    setOpenaiModel,
    customOpenAiApiKey,
    setCustomOpenAiApiKey,
    customOpenAiBaseUrl,
    setCustomOpenAiBaseUrl,
    customOpenAiModelsEndpoint,
    setCustomOpenAiModelsEndpoint,
    customOpenAiModel,
    setCustomOpenAiModel,
    geminiApiKey,
    setGeminiApiKey,
    geminiModel,
    setGeminiModel,
    githubToken,
    setGithubToken,
    defaultGistTarget,
    setDefaultGistTarget,
  } = useSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeView, setActiveView] = useState<SettingsView>(initialShowAiSettings ? 'ai' : 'main');
  const [openaiModels, setOpenaiModels] = useState<string[]>([]);
  const [customOpenAiModels, setCustomOpenAiModels] = useState<string[]>([]);
  const [geminiModels, setGeminiModels] = useState<string[]>([]);
  const [openaiLoading, setOpenaiLoading] = useState(false);
  const [customOpenAiLoading, setCustomOpenAiLoading] = useState(false);
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [openaiError, setOpenaiError] = useState('');
  const [customOpenAiError, setCustomOpenAiError] = useState('');
  const [geminiError, setGeminiError] = useState('');
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

  const getProviderModels = (provider: 'openai' | 'gemini' | 'customOpenAi') => {
    if (provider === 'openai') return openaiModels;
    if (provider === 'gemini') return geminiModels;
    return customOpenAiModels;
  };

  const getProviderApiKey = (provider: 'openai' | 'gemini' | 'customOpenAi') => {
    if (provider === 'openai') return openaiApiKey;
    if (provider === 'gemini') return geminiApiKey;
    return customOpenAiApiKey;
  };

  const getProviderModelFallback = (provider: 'openai' | 'gemini' | 'customOpenAi') => {
    if (provider === 'openai') return openaiModel;
    if (provider === 'gemini') return geminiModel;
    return customOpenAiModel;
  };

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

  const refreshSyncGists = async (token: string) => {
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
  };

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
    if (!openaiApiKey) {
      setOpenaiModels([]);
      setOpenaiError('');
      return;
    }
    setOpenaiLoading(true);
    setOpenaiError('');
    listOpenAiModels(openaiApiKey)
      .then((models) => {
        if (!active) return;
        setOpenaiModels(models);
        if (!models.includes(openaiModel) && models[0]) {
          setOpenaiModel(models[0]);
        }
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
  }, [openaiApiKey, openaiModel, setOpenaiModel, t]);

  useEffect(() => {
    let active = true;
    if (!customOpenAiApiKey || (!customOpenAiModelsEndpoint && !customOpenAiBaseUrl)) {
      setCustomOpenAiModels([]);
      setCustomOpenAiError('');
      return;
    }
    setCustomOpenAiLoading(true);
    setCustomOpenAiError('');
    listCustomOpenAiModels({
      apiKey: customOpenAiApiKey,
      baseURL: customOpenAiBaseUrl,
      modelsEndpoint: customOpenAiModelsEndpoint,
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
  }, [customOpenAiApiKey, customOpenAiBaseUrl, customOpenAiModelsEndpoint, t]);

  useEffect(() => {
    let active = true;
    if (!geminiApiKey) {
      setGeminiModels([]);
      setGeminiError('');
      return;
    }
    setGeminiLoading(true);
    setGeminiError('');
    listGeminiModels(geminiApiKey)
      .then((models) => {
        if (!active) return;
        setGeminiModels(models);
        if (!models.includes(geminiModel) && models[0]) {
          setGeminiModel(models[0]);
        }
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
  }, [geminiApiKey, geminiModel, setGeminiModel, t]);

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
  }, [githubToken]);

  useEffect(() => {
    if (gistListCooldownSec <= 0) return;
    const timer = setTimeout(() => {
      setGistListCooldownSec((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [gistListCooldownSec]);

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
              <div className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-[var(--app-shell-muted)]">
                AI Console
              </div>
              <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[var(--app-shell-ink)]">
                {t('common.llmSettings') || '大模型配置'}
              </h2>
            </div>
          </div>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--app-shell-muted)]">
            管理 OCR 与识别模型来源，让持仓录入流程保持可追踪、可切换、可回退。
          </p>
        </div>
      </div>

      <div className="space-y-4 px-4 md:px-5">
        <section className="rounded-[1.75rem] border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] p-4 shadow-[var(--app-shell-shadow)] backdrop-blur-xl md:p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-[var(--app-shell-muted)]">
                LLM Registry
              </div>
              <div className="mt-1 text-base font-semibold text-[var(--app-shell-ink)]">
                {t('common.llmSettingsManage') || '大模型配置'}
              </div>
            </div>
          </div>
          <p className="text-sm text-[var(--app-shell-muted)]">
            仅维护 Provider 与模型能力配置，不在这里绑定业务用途。
          </p>
        </section>

        <div className="grid gap-4 xl:grid-cols-3">
          <section className="rounded-[1.75rem] border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] p-4 shadow-[var(--app-shell-shadow)] backdrop-blur-xl md:p-5">
            <div className="mb-4">
              <div className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-[var(--app-shell-muted)]">
                OpenAI Stack
              </div>
              <div className="mt-1 text-base font-semibold text-[var(--app-shell-ink)]">
                {t('common.openaiKey') || 'OpenAI API Key'}
              </div>
            </div>
            <div className="space-y-3">
              <input
                type="password"
                value={openaiApiKey}
                onChange={(e) => setOpenaiApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] px-4 py-3 text-sm text-[var(--app-shell-ink)] outline-none transition focus:border-[var(--app-shell-line-strong)]"
              />
              <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-shell-muted)]">
                {t('common.openaiModel') || 'OpenAI 模型'}
              </label>
              <select
                value={openaiModel}
                onChange={(e) => setOpenaiModel(e.target.value)}
                className="w-full rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] px-4 py-3 text-sm text-[var(--app-shell-ink)] outline-none transition focus:border-[var(--app-shell-line-strong)]"
              >
                {!openaiApiKey && (
                  <option value="">
                    {t('common.modelSelectPlaceholder') || '请先填写 API Key'}
                  </option>
                )}
                {openaiLoading && (
                  <option value="">{t('common.modelLoading') || '模型加载中...'}</option>
                )}
                {openaiError && !openaiLoading && <option value="">{openaiError}</option>}
                {openaiModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
                {!openaiModels.includes(openaiModel) && openaiModel && (
                  <option value={openaiModel}>{openaiModel}</option>
                )}
              </select>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] p-4 shadow-[var(--app-shell-shadow)] backdrop-blur-xl md:p-5">
            <div className="mb-4">
              <div className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-[var(--app-shell-muted)]">
                OpenAI Compatible
              </div>
              <div className="mt-1 text-base font-semibold text-[var(--app-shell-ink)]">
                {t('common.customOpenAiBaseUrl') || '兼容接口 Base URL'}
              </div>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                value={customOpenAiBaseUrl}
                onChange={(e) => setCustomOpenAiBaseUrl(e.target.value)}
                placeholder="https://api.example.com/v1"
                className="w-full rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] px-4 py-3 text-sm text-[var(--app-shell-ink)] outline-none transition focus:border-[var(--app-shell-line-strong)]"
              />
              <input
                type="password"
                value={customOpenAiApiKey}
                onChange={(e) => setCustomOpenAiApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] px-4 py-3 text-sm text-[var(--app-shell-ink)] outline-none transition focus:border-[var(--app-shell-line-strong)]"
              />
              <input
                type="text"
                value={customOpenAiModelsEndpoint}
                onChange={(e) => setCustomOpenAiModelsEndpoint(e.target.value)}
                placeholder={
                  t('common.customOpenAiModelsEndpointPlaceholder') ||
                  '可选：自定义模型列表地址（留空则使用 baseURL/models）'
                }
                className="w-full rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] px-4 py-3 text-sm text-[var(--app-shell-ink)] outline-none transition focus:border-[var(--app-shell-line-strong)]"
              />
              <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-shell-muted)]">
                {t('common.customOpenAiModel') || '兼容模型（可手动输入）'}
              </label>
              <input
                list="custom-openai-model-options"
                value={customOpenAiModel}
                onChange={(e) => setCustomOpenAiModel(e.target.value)}
                className="w-full rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] px-4 py-3 text-sm text-[var(--app-shell-ink)] outline-none transition focus:border-[var(--app-shell-line-strong)]"
              />
              <datalist id="custom-openai-model-options">
                {customOpenAiModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </datalist>
              {customOpenAiLoading && (
                <p className="text-xs text-[var(--app-shell-muted)]">
                  {t('common.modelLoading') || '模型加载中...'}
                </p>
              )}
              {!customOpenAiLoading && customOpenAiError && (
                <p className="text-xs text-[var(--app-shell-muted)]">{customOpenAiError}</p>
              )}
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] p-4 shadow-[var(--app-shell-shadow)] backdrop-blur-xl md:p-5">
            <div className="mb-4">
              <div className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-[var(--app-shell-muted)]">
                Gemini Stack
              </div>
              <div className="mt-1 text-base font-semibold text-[var(--app-shell-ink)]">
                {t('common.geminiKey') || 'Gemini API Key'}
              </div>
            </div>
            <div className="space-y-3">
              <input
                type="password"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                placeholder="AI..."
                className="w-full rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] px-4 py-3 text-sm text-[var(--app-shell-ink)] outline-none transition focus:border-[var(--app-shell-line-strong)]"
              />
              <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-shell-muted)]">
                {t('common.geminiModel') || 'Gemini 模型'}
              </label>
              <select
                value={geminiModel}
                onChange={(e) => setGeminiModel(e.target.value)}
                className="w-full rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] px-4 py-3 text-sm text-[var(--app-shell-ink)] outline-none transition focus:border-[var(--app-shell-line-strong)]"
              >
                {!geminiApiKey && (
                  <option value="">
                    {t('common.modelSelectPlaceholder') || '请先填写 API Key'}
                  </option>
                )}
                {geminiLoading && (
                  <option value="">{t('common.modelLoading') || '模型加载中...'}</option>
                )}
                {geminiError && !geminiLoading && <option value="">{geminiError}</option>}
                {geminiModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
                {!geminiModels.includes(geminiModel) && geminiModel && (
                  <option value={geminiModel}>{geminiModel}</option>
                )}
              </select>
            </div>
          </section>
        </div>

        <section className="rounded-[1.75rem] border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] p-4 shadow-[var(--app-shell-shadow)] backdrop-blur-xl md:p-5">
          <div className="mb-4">
            <div className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-[var(--app-shell-muted)]">
              Usage Routing
            </div>
            <div className="mt-1 text-base font-semibold text-[var(--app-shell-ink)]">用途选择</div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3 rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] p-4">
              <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-shell-muted)]">
                图像识别 Provider
              </label>
              <select
                value={ocrAiProvider}
                onChange={(e) => {
                  const nextProvider = e.target.value as 'openai' | 'gemini' | 'customOpenAi';
                  setOcrAiProvider(nextProvider);
                  const nextModels = getProviderModels(nextProvider);
                  const fallbackModel = getProviderModelFallback(nextProvider);
                  if (nextModels[0]) {
                    setOcrAiModel(nextModels[0]);
                  } else if (fallbackModel) {
                    setOcrAiModel(fallbackModel);
                  }
                }}
                className="w-full rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] px-4 py-3 text-sm text-[var(--app-shell-ink)] outline-none transition focus:border-[var(--app-shell-line-strong)]"
              >
                <option value="openai">OpenAI</option>
                <option value="gemini">Gemini</option>
                <option value="customOpenAi">OpenAI Compatible</option>
              </select>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-shell-muted)]">
                图像识别 Model
              </label>
              <input
                list="ocr-model-options"
                value={ocrAiModel}
                onChange={(e) => setOcrAiModel(e.target.value)}
                placeholder={
                  getProviderApiKey(ocrAiProvider)
                    ? '输入或选择模型'
                    : t('common.modelSelectPlaceholder') || '请先填写 API Key'
                }
                className="w-full rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] px-4 py-3 text-sm text-[var(--app-shell-ink)] outline-none transition focus:border-[var(--app-shell-line-strong)]"
              />
              <datalist id="ocr-model-options">
                {getProviderModels(ocrAiProvider).map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </datalist>
            </div>

            <div className="space-y-3 rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] p-4">
              <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-shell-muted)]">
                持仓分析 Provider
              </label>
              <select
                value={analysisAiProvider}
                onChange={(e) => {
                  const nextProvider = e.target.value as 'openai' | 'gemini' | 'customOpenAi';
                  setAnalysisAiProvider(nextProvider);
                  const nextModels = getProviderModels(nextProvider);
                  const fallbackModel = getProviderModelFallback(nextProvider);
                  if (nextModels[0]) {
                    setAnalysisAiModel(nextModels[0]);
                  } else if (fallbackModel) {
                    setAnalysisAiModel(fallbackModel);
                  }
                }}
                className="w-full rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] px-4 py-3 text-sm text-[var(--app-shell-ink)] outline-none transition focus:border-[var(--app-shell-line-strong)]"
              >
                <option value="openai">OpenAI</option>
                <option value="gemini">Gemini</option>
                <option value="customOpenAi">OpenAI Compatible</option>
              </select>
              <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-shell-muted)]">
                持仓分析 Model
              </label>
              <input
                list="analysis-model-options"
                value={analysisAiModel}
                onChange={(e) => setAnalysisAiModel(e.target.value)}
                placeholder={
                  getProviderApiKey(analysisAiProvider)
                    ? '输入或选择模型'
                    : t('common.modelSelectPlaceholder') || '请先填写 API Key'
                }
                className="w-full rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] px-4 py-3 text-sm text-[var(--app-shell-ink)] outline-none transition focus:border-[var(--app-shell-line-strong)]"
              />
              <datalist id="analysis-model-options">
                {getProviderModels(analysisAiProvider).map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </datalist>
            </div>
          </div>
        </section>

        <p className="px-1 text-[11px] uppercase tracking-[0.18em] text-[var(--app-shell-muted)]">
          {t('common.aiPrivacyTip') || '截图仅用于识别，不会保存到服务器。'}
        </p>
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
              <div className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-[var(--app-shell-muted)]">
                Sync Protocol
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
            <div className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-[var(--app-shell-muted)]">
              Credential
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
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] px-4 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--app-shell-muted)]">
                  Format
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
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--app-shell-muted)]">
                  API Status
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
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--app-shell-muted)]">
                  Default Target
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
              <div className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-[var(--app-shell-muted)]">
                Actions
              </div>
              <div className="mt-1 text-base font-semibold text-[var(--app-shell-ink)]">
                Upload / Download Flow
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
              <div className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-[var(--app-shell-muted)]">
                Control Room
              </div>
              <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[var(--app-shell-ink)]">
                {t('common.settings')}
              </h2>
            </div>
          </div>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--app-shell-muted)]">
            在同一控制台中管理主题、自动刷新、AI 识别与数据同步，保证持仓工作台的节奏统一。
          </p>
        </div>
      </div>

      <div className="space-y-4 px-4 md:px-5">
        <section className="rounded-[1.75rem] border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] p-4 shadow-[var(--app-shell-shadow)] backdrop-blur-xl md:p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-[var(--app-shell-muted)]">
                Visual System
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
              <div className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-[var(--app-shell-muted)]">
                Runtime
              </div>
              <div className="mt-1 text-base font-semibold text-[var(--app-shell-ink)]">
                {t('common.features') || '功能'}
              </div>
            </div>
            <div className="rounded-full border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--app-shell-muted)]">
              Live
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
              <div className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-[var(--app-shell-muted)]">
                Intelligence
              </div>
              <div className="mt-1 text-base font-semibold text-[var(--app-shell-ink)]">
                {t('common.aiSettings') || 'AI 识别设置'}
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
              <div className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-[var(--app-shell-muted)]">
                Remote Backup
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
            <div className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-[var(--app-shell-muted)]">
              Local Archive
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
