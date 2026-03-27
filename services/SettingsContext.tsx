/* eslint-disable react-refresh/only-export-components */

import React, { createContext, useContext, useState } from 'react';

export type AiProvider = 'openai' | 'gemini';

export interface DefaultGistTargetSnapshot {
  id: string;
  description: string;
  updatedAt: string;
  fileName: string;
}

interface SettingsContextValue {
  autoRefresh: boolean;
  setAutoRefresh: (val: boolean) => void;
  useUnifiedRefresh: boolean;
  setUseUnifiedRefresh: (val: boolean) => void;
  aiProvider: AiProvider;
  setAiProvider: (val: AiProvider) => void;
  openaiApiKey: string;
  setOpenaiApiKey: (val: string) => void;
  openaiModel: string;
  setOpenaiModel: (val: string) => void;
  geminiApiKey: string;
  setGeminiApiKey: (val: string) => void;
  geminiModel: string;
  setGeminiModel: (val: string) => void;
  githubToken: string;
  setGithubToken: (val: string) => void;
  defaultGistTarget: DefaultGistTargetSnapshot | null;
  setDefaultGistTarget: (val: DefaultGistTargetSnapshot | null) => void;
}

const STORAGE_KEY = 'app-settings-preference';

const defaultSettings = {
  autoRefresh: false,
  useUnifiedRefresh: false,
  aiProvider: 'openai' as AiProvider,
  openaiApiKey: '',
  openaiModel: 'gpt-4o-mini',
  geminiApiKey: '',
  geminiModel: 'gemini-3.1-flash-lite-preview',
  githubToken: '',
  defaultGistTarget: null as DefaultGistTargetSnapshot | null,
};

const parseDefaultGistTarget = (value: unknown): DefaultGistTargetSnapshot | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<DefaultGistTargetSnapshot>;
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.description !== 'string' ||
    typeof candidate.updatedAt !== 'string' ||
    typeof candidate.fileName !== 'string'
  ) {
    return null;
  }
  return {
    id: candidate.id,
    description: candidate.description,
    updatedAt: candidate.updatedAt,
    fileName: candidate.fileName,
  };
};

const parseSavedSettings = (saved: string): typeof defaultSettings => {
  const parsed = JSON.parse(saved) as Record<string, unknown>;
  if (!parsed || typeof parsed !== 'object') {
    return defaultSettings;
  }

  return {
    autoRefresh:
      typeof parsed.autoRefresh === 'boolean' ? parsed.autoRefresh : defaultSettings.autoRefresh,
    useUnifiedRefresh:
      typeof parsed.useUnifiedRefresh === 'boolean'
        ? parsed.useUnifiedRefresh
        : defaultSettings.useUnifiedRefresh,
    aiProvider:
      parsed.aiProvider === 'openai' || parsed.aiProvider === 'gemini'
        ? parsed.aiProvider
        : defaultSettings.aiProvider,
    openaiApiKey:
      typeof parsed.openaiApiKey === 'string' ? parsed.openaiApiKey : defaultSettings.openaiApiKey,
    openaiModel:
      typeof parsed.openaiModel === 'string' ? parsed.openaiModel : defaultSettings.openaiModel,
    geminiApiKey:
      typeof parsed.geminiApiKey === 'string' ? parsed.geminiApiKey : defaultSettings.geminiApiKey,
    geminiModel:
      typeof parsed.geminiModel === 'string' ? parsed.geminiModel : defaultSettings.geminiModel,
    githubToken:
      typeof parsed.githubToken === 'string' ? parsed.githubToken : defaultSettings.githubToken,
    defaultGistTarget: parseDefaultGistTarget(parsed.defaultGistTarget),
  };
};

const SettingsContext = createContext<SettingsContextValue>({
  autoRefresh: defaultSettings.autoRefresh,
  setAutoRefresh: () => {},
  useUnifiedRefresh: defaultSettings.useUnifiedRefresh,
  setUseUnifiedRefresh: () => {},
  aiProvider: defaultSettings.aiProvider,
  setAiProvider: () => {},
  openaiApiKey: defaultSettings.openaiApiKey,
  setOpenaiApiKey: () => {},
  openaiModel: defaultSettings.openaiModel,
  setOpenaiModel: () => {},
  geminiApiKey: defaultSettings.geminiApiKey,
  setGeminiApiKey: () => {},
  geminiModel: defaultSettings.geminiModel,
  setGeminiModel: () => {},
  githubToken: defaultSettings.githubToken,
  setGithubToken: () => {},
  defaultGistTarget: defaultSettings.defaultGistTarget,
  setDefaultGistTarget: () => {},
});

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<typeof defaultSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return parseSavedSettings(saved);
      }
    } catch (e) {
      console.error('Failed to parse settings', e);
    }
    return defaultSettings;
  });

  const updateSettings = (patch: Partial<typeof defaultSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const setAutoRefresh = (val: boolean) => updateSettings({ autoRefresh: val });
  const setUseUnifiedRefresh = (val: boolean) => updateSettings({ useUnifiedRefresh: val });
  const setAiProvider = (val: AiProvider) => updateSettings({ aiProvider: val });
  const setOpenaiApiKey = (val: string) => updateSettings({ openaiApiKey: val });
  const setOpenaiModel = (val: string) => updateSettings({ openaiModel: val });
  const setGeminiApiKey = (val: string) => updateSettings({ geminiApiKey: val });
  const setGeminiModel = (val: string) => updateSettings({ geminiModel: val });
  const setGithubToken = (val: string) => updateSettings({ githubToken: val });
  const setDefaultGistTarget = (val: DefaultGistTargetSnapshot | null) =>
    updateSettings({ defaultGistTarget: val });

  return (
    <SettingsContext.Provider
      value={{
        autoRefresh: settings.autoRefresh,
        setAutoRefresh,
        useUnifiedRefresh: settings.useUnifiedRefresh,
        setUseUnifiedRefresh,
        aiProvider: settings.aiProvider,
        setAiProvider,
        openaiApiKey: settings.openaiApiKey,
        setOpenaiApiKey,
        openaiModel: settings.openaiModel,
        setOpenaiModel,
        geminiApiKey: settings.geminiApiKey,
        setGeminiApiKey,
        geminiModel: settings.geminiModel,
        setGeminiModel,
        githubToken: settings.githubToken,
        setGithubToken,
        defaultGistTarget: settings.defaultGistTarget,
        setDefaultGistTarget,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
