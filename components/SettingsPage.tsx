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
import { listGeminiModels, listOpenAiModels } from '../services/aiOcr';
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
import { getRefreshMetricsSnapshot } from '../services/refreshOrchestrator';

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
    useUnifiedRefresh,
    setUseUnifiedRefresh,
    aiProvider,
    setAiProvider,
    openaiApiKey,
    setOpenaiApiKey,
    openaiModel,
    setOpenaiModel,
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
  const [geminiModels, setGeminiModels] = useState<string[]>([]);
  const [openaiLoading, setOpenaiLoading] = useState(false);
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [openaiError, setOpenaiError] = useState('');
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
  const [refreshMetrics, setRefreshMetrics] = useState(getRefreshMetricsSnapshot);

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
      const importResult = await importFundsFromBackupContent(content);
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
    const timer = setInterval(() => {
      setRefreshMetrics(getRefreshMetricsSnapshot());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

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
    <div className="min-h-[60vh] pb-44 md:pb-28">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => setActiveView('main')}
          className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
        >
          <Icons.ArrowUp size={20} className="text-gray-600 dark:text-gray-300 -rotate-90" />
        </button>
        <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">
          {t('common.aiSettings')}
        </h2>
      </div>

      <div className="px-4 mt-2">
        <div className="bg-white dark:bg-card-dark rounded-xl overflow-hidden shadow-sm p-4 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">
              {t('common.aiProvider') || '模型提供方'}
            </label>
            <select
              value={aiProvider}
              onChange={(e) => setAiProvider(e.target.value as 'openai' | 'gemini')}
              className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-white/5 focus:outline-none focus:border-blue-500 text-gray-900 dark:text-gray-100 text-sm"
            >
              <option value="openai">OpenAI</option>
              <option value="gemini">Gemini</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-500">
              {t('common.openaiKey') || 'OpenAI API Key'}
            </label>
            <input
              type="password"
              value={openaiApiKey}
              onChange={(e) => setOpenaiApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-white/5 focus:outline-none focus:border-blue-500 text-gray-900 dark:text-gray-100 text-sm"
            />
            <label className="block text-xs font-bold text-gray-500">
              {t('common.openaiModel') || 'OpenAI 模型'}
            </label>
            <select
              value={openaiModel}
              onChange={(e) => setOpenaiModel(e.target.value)}
              className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-white/5 focus:outline-none focus:border-blue-500 text-gray-900 dark:text-gray-100 text-sm"
            >
              {!openaiApiKey && (
                <option value="">{t('common.modelSelectPlaceholder') || '请先填写 API Key'}</option>
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

          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-500">
              {t('common.geminiKey') || 'Gemini API Key'}
            </label>
            <input
              type="password"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              placeholder="AI..."
              className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-white/5 focus:outline-none focus:border-blue-500 text-gray-900 dark:text-gray-100 text-sm"
            />
            <label className="block text-xs font-bold text-gray-500">
              {t('common.geminiModel') || 'Gemini 模型'}
            </label>
            <select
              value={geminiModel}
              onChange={(e) => setGeminiModel(e.target.value)}
              className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-white/5 focus:outline-none focus:border-blue-500 text-gray-900 dark:text-gray-100 text-sm"
            >
              {!geminiApiKey && (
                <option value="">{t('common.modelSelectPlaceholder') || '请先填写 API Key'}</option>
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

          <p className="text-[10px] text-gray-400">
            {t('common.aiPrivacyTip') || '截图仅用于识别，不会保存到服务器。'}
          </p>
        </div>
      </div>
    </div>
  );

  const gistSyncSettingsView = (
    <div className="min-h-[60vh] pb-44 md:pb-28">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => setActiveView('main')}
          className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
        >
          <Icons.ArrowUp size={20} className="text-gray-600 dark:text-gray-300 -rotate-90" />
        </button>
        <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">
          {t('common.gistSync') || 'GitHub Gist 同步'}
        </h2>
      </div>

      <div className="px-4 mt-2">
        <div className="bg-white dark:bg-card-dark rounded-xl overflow-hidden shadow-sm p-4 space-y-3">
          <div className="space-y-1">
            <label className="block text-xs font-bold text-gray-500">
              {t('common.githubToken') || 'GitHub Token'}
            </label>
            <input
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder={t('common.githubTokenPlaceholder') || 'ghp_xxx / github_pat_xxx'}
              className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-white/5 focus:outline-none focus:border-blue-500 text-gray-900 dark:text-gray-100 text-sm"
            />
            <p className="text-[11px] text-gray-400">
              {t('common.githubTokenHelp') || 'Token 仅保存在本地。'}
            </p>
            <p className="text-[11px] text-gray-500">
              {tokenFormatState === 'invalid' &&
                (t('common.githubTokenFormatInvalid') || 'Token 格式看起来不合法。')}
              {tokenFormatState === 'valid' &&
                (t('common.githubTokenFormatValid') || 'Token 格式校验通过。')}
            </p>
            <p className="text-[11px] text-gray-500">
              {tokenApiState === 'checking' &&
                (t('common.githubTokenApiChecking') || '正在向 GitHub 验证 Token...')}
              {tokenApiState === 'valid' &&
                (t('common.githubTokenApiValid') || 'GitHub Token 验证通过。')}
              {tokenApiState === 'invalid' &&
                (t('common.githubTokenApiInvalid') || 'GitHub Token 验证失败。')}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDownloadClick}
              disabled={tokenApiState !== 'valid' || syncBusy}
              className="rounded-lg px-3 py-2 text-sm text-white bg-blue-600 disabled:opacity-50"
            >
              {t('common.gistSyncDownload') || '从 Gist 下载'}
            </button>
            <button
              type="button"
              onClick={handleUploadClick}
              disabled={tokenApiState !== 'valid' || syncBusy}
              className="rounded-lg px-3 py-2 text-sm text-white bg-blue-600 disabled:opacity-50"
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
              className="rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-white/5 disabled:opacity-50"
            >
              {t('common.gistChooserSelect') || '选择目标'}
            </button>
          </div>

          <p className="text-[11px] text-gray-500">
            {defaultGistTarget
              ? `${t('common.gistDefaultTarget') || '默认目标 Gist'}: ${defaultGistTarget.description || defaultGistTarget.id}`
              : t('common.gistDefaultTargetNone') || '未设置默认目标'}
          </p>
          {tokenApiState === 'valid' && syncGists.length === 0 && (
            <p className="text-[11px] text-amber-600">
              {t('common.gistChooserEmpty') || '没有可用 gist，请先新建。'}
            </p>
          )}
        </div>
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
    <div className="min-h-[60vh] pb-44 md:pb-28">
      {/* 标题栏 */}
      <div className="flex items-center gap-3 px-4 py-3">
        {onBack && (
          <button
            onClick={onBack}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            <Icons.ArrowUp size={20} className="text-gray-600 dark:text-gray-300 -rotate-90" />
          </button>
        )}
        <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">
          {t('common.settings')}
        </h2>
      </div>

      {/* 主题设置 */}
      <div className="px-4 mt-2">
        <div className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2 px-1">
          {t('common.theme')}
        </div>
        <div className="bg-white dark:bg-card-dark rounded-xl overflow-hidden shadow-sm">
          {themeOptions.map((opt, idx) => (
            <button
              key={opt.value}
              onClick={() => setMode(opt.value)}
              className={`w-full flex items-center justify-between px-4 py-3.5 transition-colors
                hover:bg-gray-50 dark:hover:bg-white/5
                ${idx < themeOptions.length - 1 ? 'border-b border-gray-100 dark:border-border-dark' : ''}
              `}
            >
              <div className="flex items-center gap-3">
                <div className="w-6 flex justify-center text-gray-500 dark:text-gray-400">
                  {opt.icon}
                </div>
                <span className="text-sm text-gray-800 dark:text-gray-100">{opt.label}</span>
              </div>
              {mode === opt.value && (
                <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2 6L5 9L10 3"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 功能设置 */}
      <div className="px-4 mt-6">
        <div className="text-xs font-bold font-sans text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2 px-1">
          {t('common.features') || '功能'}
        </div>
        <div className="bg-white dark:bg-card-dark rounded-xl overflow-hidden shadow-sm">
          <div className="w-full flex items-center justify-between px-4 py-3.5">
            <div className="flex items-center gap-3">
              <div className="w-6 flex justify-center text-gray-500 dark:text-gray-400">
                <Icons.Refresh size={18} />
              </div>
              <span className="text-sm font-sans text-gray-800 dark:text-gray-100">
                {t('common.autoRefresh') || '自动刷新持仓行情'}
              </span>
            </div>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`w-10 h-6 rounded-full transition-colors relative ${autoRefresh ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${autoRefresh ? 'translate-x-5' : 'translate-x-1'}`}
              />
            </button>
          </div>

          <div className="w-full flex items-center justify-between px-4 py-3.5 border-t border-gray-100 dark:border-border-dark">
            <div className="flex items-center gap-3">
              <div className="w-6 flex justify-center text-gray-500 dark:text-gray-400">
                <Icons.Refresh size={18} />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-sans text-gray-800 dark:text-gray-100">
                  {t('common.useUnifiedRefresh') || '启用统一刷新流水线'}
                </span>
                <span className="text-[11px] text-gray-400">
                  {useUnifiedRefresh
                    ? t('common.useUnifiedRefreshOnDesc') || '灰度开启：行情与结算解耦'
                    : t('common.useUnifiedRefreshOffDesc') || '回滚模式：沿用旧刷新路径'}
                </span>
              </div>
            </div>
            <button
              onClick={() => setUseUnifiedRefresh(!useUnifiedRefresh)}
              className={`w-10 h-6 rounded-full transition-colors relative ${useUnifiedRefresh ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${useUnifiedRefresh ? 'translate-x-5' : 'translate-x-1'}`}
              />
            </button>
          </div>

          <div className="w-full px-4 py-3.5 border-t border-gray-100 dark:border-border-dark">
            <div className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-2">
              {t('common.refreshMetrics') || '刷新指标'}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] text-gray-500 dark:text-gray-400">
              <div>
                {t('common.refreshMetricsFunds') || '持仓'}: {refreshMetrics.funds.success}/
                {refreshMetrics.funds.total}
              </div>
              <div>
                {t('common.refreshMetricsWatchlist') || '自选'}:{' '}
                {refreshMetrics.watchlist.success}/{refreshMetrics.watchlist.total}
              </div>
              <div>
                {t('common.refreshMetricsSettlement') || '结算'}:{' '}
                {refreshMetrics.settlement.success}/{refreshMetrics.settlement.total}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI 设置入口 */}
      <div className="px-4 mt-6">
        <div className="text-xs font-bold font-sans text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2 px-1">
          {t('common.aiSettings') || 'AI 识别设置'}
        </div>
        <div className="bg-white dark:bg-card-dark rounded-xl overflow-hidden shadow-sm">
          <button
            onClick={() => setActiveView('ai')}
            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-6 flex justify-center text-gray-500 dark:text-gray-400">
                <Icons.Settings size={18} />
              </div>
              <span className="text-sm font-sans text-gray-800 dark:text-gray-100">
                {t('common.aiSettingsManage') || '管理 AI 识别设置'}
              </span>
            </div>
            <Icons.ArrowDown size={16} className="text-gray-400 -rotate-90" />
          </button>
        </div>
      </div>

      {/* 数据管理 */}
      <div className="px-4 mt-6">
        <div className="text-xs font-bold font-sans text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2 px-1">
          {t('common.data') || '数据'}
        </div>
        <div className="bg-white dark:bg-card-dark rounded-xl overflow-hidden shadow-sm">
          <button
            onClick={handleExport}
            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border-b border-gray-100 dark:border-border-dark"
          >
            <div className="flex items-center gap-3">
              <div className="w-6 flex justify-center text-gray-500 dark:text-gray-400">
                <Icons.ArrowUp size={18} />
              </div>
              <span className="text-sm font-sans text-gray-800 dark:text-gray-100">
                {t('common.exportData') || '导出数据'}
              </span>
            </div>
            <Icons.ArrowDown size={16} className="text-gray-400 -rotate-90" />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-6 flex justify-center text-gray-500 dark:text-gray-400">
                <Icons.ArrowDown size={18} />
              </div>
              <span className="text-sm font-sans text-gray-800 dark:text-gray-100">
                {t('common.importData') || '导入数据'}
              </span>
            </div>
            <Icons.ArrowDown size={16} className="text-gray-400 -rotate-90" />
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleImport}
        />
      </div>

      {/* Gist 同步设置入口（二级菜单） */}
      <div className="px-4 mt-6">
        <div className="text-xs font-bold font-sans text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2 px-1">
          {t('common.sync') || '同步'}
        </div>
        <div className="bg-white dark:bg-card-dark rounded-xl overflow-hidden shadow-sm">
          <button
            onClick={() => setActiveView('gist')}
            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-6 flex justify-center text-gray-500 dark:text-gray-400">
                <Icons.Refresh size={18} />
              </div>
              <span className="text-sm font-sans text-gray-800 dark:text-gray-100">
                {t('common.gistSync') || 'GitHub Gist 同步'}
              </span>
            </div>
            <Icons.ArrowDown size={16} className="text-gray-400 -rotate-90" />
          </button>
        </div>
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
