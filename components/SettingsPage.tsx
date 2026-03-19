import React, { useEffect, useRef, useState } from 'react';
import { Icons } from './Icon';
import { useTranslation } from '../services/i18n';
import { useTheme } from '../services/ThemeContext';
import { useSettings } from '../services/SettingsContext';
import { exportFunds, exportSyncPayload, importFunds, importSyncPayload } from '../services/db';
import { listGeminiModels, listOpenAiModels } from '../services/aiOcr';
import { pullFromGist, pushToGist, testGistAuth } from '../services/gistSync';

interface SettingsPageProps {
  onBack?: () => void;
  initialShowAiSettings?: boolean;
}

type ThemeOption = 'system' | 'light' | 'dark';

export const SettingsPage: React.FC<SettingsPageProps> = ({ onBack, initialShowAiSettings }) => {
  const { t } = useTranslation();
  const { mode, setMode } = useTheme();
  const {
    autoRefresh,
    setAutoRefresh,
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
    gistToken,
    setGistToken,
    gistId,
    setGistId,
    gistFileName,
    setGistFileName,
  } = useSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAiSettings, setShowAiSettings] = useState(Boolean(initialShowAiSettings));
  const [showGistSettings, setShowGistSettings] = useState(false);
  const [openaiModels, setOpenaiModels] = useState<string[]>([]);
  const [geminiModels, setGeminiModels] = useState<string[]>([]);
  const [openaiLoading, setOpenaiLoading] = useState(false);
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [openaiError, setOpenaiError] = useState('');
  const [geminiError, setGeminiError] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);

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

  const handleTestGistConnection = async () => {
    if (!gistToken.trim()) {
      alert(t('common.gistTokenRequired') || 'Please enter GitHub token');
      return;
    }

    setSyncLoading(true);
    try {
      const result = await testGistAuth(gistToken.trim());
      alert(
        (t('common.gistConnectionSuccess') || 'Connected as {user}').replace(
          '{user}',
          result.login,
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      alert(`${t('common.gistConnectionFailed') || 'Connection failed'}: ${message}`);
    } finally {
      setSyncLoading(false);
    }
  };

  const handlePushToGist = async () => {
    if (!gistToken.trim()) {
      alert(t('common.gistTokenRequired') || 'Please enter GitHub token');
      return;
    }

    setSyncLoading(true);
    try {
      const syncPayload = await exportSyncPayload();
      const result = await pushToGist({
        token: gistToken.trim(),
        gistId: gistId.trim() || undefined,
        fileName: gistFileName.trim() || 'fund-manager-sync.json',
        syncPayload,
      });
      if (!gistId.trim()) {
        setGistId(result.gistId);
      }
      alert(
        (t('common.gistPushSuccess') || 'Uploaded to gist: {id}').replace('{id}', result.gistId),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      alert(`${t('common.gistPushFailed') || 'Upload failed'}: ${message}`);
    } finally {
      setSyncLoading(false);
    }
  };

  const handlePullFromGist = async () => {
    if (!gistToken.trim()) {
      alert(t('common.gistTokenRequired') || 'Please enter GitHub token');
      return;
    }
    if (!gistId.trim()) {
      alert(t('common.gistIdRequired') || 'Please enter Gist ID');
      return;
    }

    const confirmed = window.confirm(
      t('common.gistPullOverwriteConfirm') ||
        'This will overwrite local holdings, accounts and watchlist. Continue?',
    );
    if (!confirmed) return;

    setSyncLoading(true);
    try {
      const { payload } = await pullFromGist({
        token: gistToken.trim(),
        gistId: gistId.trim(),
        fileName: gistFileName.trim() || 'fund-manager-sync.json',
      });
      await importSyncPayload(payload, { overwrite: true });
      alert(t('common.gistPullSuccess') || 'Downloaded and replaced local data');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      alert(`${t('common.gistPullFailed') || 'Download failed'}: ${message}`);
    } finally {
      setSyncLoading(false);
    }
  };

  useEffect(() => {
    if (initialShowAiSettings) {
      setShowAiSettings(true);
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

  if (showAiSettings) {
    return (
      <div className="min-h-[60vh] pb-24">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => setShowAiSettings(false)}
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

            <p className="text-[10px] text-gray-400">
              {t('common.aiPrivacyTip') || '截图仅用于识别，不会保存到服务器。'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (showGistSettings) {
    return (
      <div className="min-h-[60vh] pb-24">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => setShowGistSettings(false)}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            <Icons.ArrowUp size={20} className="text-gray-600 dark:text-gray-300 -rotate-90" />
          </button>
          <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">
            {t('common.gistSync') || 'Gist Sync'}
          </h2>
        </div>

        <div className="px-4 mt-2">
          <div className="bg-white dark:bg-card-dark rounded-xl overflow-hidden shadow-sm p-4 space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">
                {t('common.gistToken') || 'GitHub Token'}
              </label>
              <input
                type="password"
                value={gistToken}
                onChange={(e) => setGistToken(e.target.value)}
                placeholder="ghp_..."
                className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-white/5 focus:outline-none focus:border-blue-500 text-gray-900 dark:text-gray-100 text-sm"
              />
              <a
                href="https://github.com/settings/tokens/new?description=fund-manager-sync&scopes=gist"
                target="_blank"
                rel="noreferrer"
                className="inline-block mt-1.5 text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
              >
                {t('common.gistTokenCreateLink') || 'Create a GitHub token with gist scope'}
              </a>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">
                {t('common.gistId') || 'Gist ID'}
              </label>
              <input
                type="text"
                value={gistId}
                onChange={(e) => setGistId(e.target.value)}
                placeholder={
                  t('common.gistIdPlaceholder') || 'Leave empty to auto-create on upload'
                }
                className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-white/5 focus:outline-none focus:border-blue-500 text-gray-900 dark:text-gray-100 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">
                {t('common.gistFileName') || 'Gist File Name'}
              </label>
              <input
                type="text"
                value={gistFileName}
                onChange={(e) => setGistFileName(e.target.value)}
                placeholder="fund-manager-sync.json"
                className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-white/5 focus:outline-none focus:border-blue-500 text-gray-900 dark:text-gray-100 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={handleTestGistConnection}
                disabled={syncLoading}
                className="px-3 py-2 text-xs font-bold rounded-lg bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-white/15 disabled:opacity-50"
              >
                {t('common.gistTestConnection') || 'Test Connection'}
              </button>
              <button
                onClick={handlePushToGist}
                disabled={syncLoading}
                className="px-3 py-2 text-xs font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {t('common.gistPush') || 'Upload to Gist'}
              </button>
              <button
                onClick={handlePullFromGist}
                disabled={syncLoading}
                className="px-3 py-2 text-xs font-bold rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {t('common.gistPull') || 'Download from Gist'}
              </button>
            </div>

            <p className="text-[10px] text-gray-400">
              {t('common.gistSyncTip') ||
                'Token is stored locally only. Download action will overwrite local data.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] pb-24">
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
        </div>
      </div>

      {/* AI 设置入口 */}
      <div className="px-4 mt-6">
        <div className="text-xs font-bold font-sans text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2 px-1">
          {t('common.aiSettings') || 'AI 识别设置'}
        </div>
        <div className="bg-white dark:bg-card-dark rounded-xl overflow-hidden shadow-sm">
          <button
            onClick={() => setShowAiSettings(true)}
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

      {/* Gist 同步设置入口 */}
      <div className="px-4 mt-6">
        <div className="text-xs font-bold font-sans text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2 px-1">
          {t('common.gistSync') || 'Gist Sync'}
        </div>
        <div className="bg-white dark:bg-card-dark rounded-xl overflow-hidden shadow-sm">
          <button
            onClick={() => setShowGistSettings(true)}
            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-6 flex justify-center text-gray-500 dark:text-gray-400">
                <Icons.Settings size={18} />
              </div>
              <span className="text-sm font-sans text-gray-800 dark:text-gray-100">
                {t('common.gistSettingsManage') || 'Manage Gist Sync Settings'}
              </span>
            </div>
            <Icons.ArrowDown size={16} className="text-gray-400 -rotate-90" />
          </button>
        </div>
      </div>
    </div>
  );
};
