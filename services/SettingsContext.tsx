/* eslint-disable react-refresh/only-export-components */

import React, { createContext, useContext, useState } from 'react';
import {
  DEFAULT_LLM_BUSINESS_CONFIG,
  migrateBusinessModelConfig,
  sanitizeBusinessModelConfig,
  type BusinessModelConfig,
  type LlmBusinessKey,
} from './businessModelConfig';

export type AiProvider = 'openai' | 'gemini' | 'customOpenAi';

export interface LlmProviderConfig {
  id: string;
  kind: AiProvider;
  name: string;
  apiKey: string;
  model: string;
  temperature: number;
  icon: string;
  baseURL: string;
  modelsEndpoint: string;
}

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
  customOpenAiApiKey: string;
  setCustomOpenAiApiKey: (val: string) => void;
  customOpenAiBaseUrl: string;
  setCustomOpenAiBaseUrl: (val: string) => void;
  customOpenAiModelsEndpoint: string;
  setCustomOpenAiModelsEndpoint: (val: string) => void;
  customOpenAiModel: string;
  setCustomOpenAiModel: (val: string) => void;
  geminiApiKey: string;
  setGeminiApiKey: (val: string) => void;
  geminiModel: string;
  setGeminiModel: (val: string) => void;
  githubToken: string;
  setGithubToken: (val: string) => void;
  defaultGistTarget: DefaultGistTargetSnapshot | null;
  setDefaultGistTarget: (val: DefaultGistTargetSnapshot | null) => void;
  llmProviders: LlmProviderConfig[];
  setLlmProviders: (val: LlmProviderConfig[]) => void;
  addLlmProvider: (kind: AiProvider) => string;
  updateLlmProvider: (id: string, patch: Partial<LlmProviderConfig>) => void;
  removeLlmProvider: (id: string) => void;
  businessModelConfig: BusinessModelConfig;
  setBusinessModelConfig: (val: BusinessModelConfig) => void;
  updateBusinessModelConfig: (key: LlmBusinessKey, val: Partial<BusinessModelConfig[LlmBusinessKey]>) => void;
}

const STORAGE_KEY = 'app-settings-preference';

const createProviderId = () => `llm_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

const getDefaultModelByKind = (kind: AiProvider) => {
  if (kind === 'gemini') return 'gemini-3.1-flash-lite-preview';
  return 'gpt-4o-mini';
};

const createDefaultProvider = (kind: AiProvider): LlmProviderConfig => ({
  id: createProviderId(),
  kind,
  name:
    kind === 'openai'
      ? '开放模型'
      : kind === 'gemini'
        ? '双子模型'
        : '兼容接口',
  apiKey: '',
  model: getDefaultModelByKind(kind),
  temperature: 0.2,
  icon: kind === 'openai' ? '🧠' : kind === 'gemini' ? '✨' : '🔌',
  baseURL: '',
  modelsEndpoint: '',
});

const parseLlmProviders = (value: unknown): LlmProviderConfig[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const candidate = item as Partial<LlmProviderConfig>;
      if (
        typeof candidate.id !== 'string' ||
        (candidate.kind !== 'openai' && candidate.kind !== 'gemini' && candidate.kind !== 'customOpenAi')
      ) {
        return null;
      }
      return {
        id: candidate.id,
        kind: candidate.kind,
        name: typeof candidate.name === 'string' ? candidate.name : createDefaultProvider(candidate.kind).name,
        apiKey: typeof candidate.apiKey === 'string' ? candidate.apiKey : '',
        model:
          typeof candidate.model === 'string' && candidate.model
            ? candidate.model
            : getDefaultModelByKind(candidate.kind),
        temperature:
          typeof candidate.temperature === 'number' && Number.isFinite(candidate.temperature)
            ? candidate.temperature
            : 0.2,
        icon: typeof candidate.icon === 'string' ? candidate.icon : createDefaultProvider(candidate.kind).icon,
        baseURL: typeof candidate.baseURL === 'string' ? candidate.baseURL : '',
        modelsEndpoint: typeof candidate.modelsEndpoint === 'string' ? candidate.modelsEndpoint : '',
      };
    })
    .filter((item): item is LlmProviderConfig => Boolean(item));
};

const defaultSettings = {
  autoRefresh: false,
  useUnifiedRefresh: false,
  aiProvider: 'openai' as AiProvider,
  openaiApiKey: '',
  openaiModel: 'gpt-4o-mini',
  customOpenAiApiKey: '',
  customOpenAiBaseUrl: '',
  customOpenAiModelsEndpoint: '',
  customOpenAiModel: 'gpt-4o-mini',
  geminiApiKey: '',
  geminiModel: 'gemini-3.1-flash-lite-preview',
  githubToken: '',
  defaultGistTarget: null as DefaultGistTargetSnapshot | null,
  llmProviders: [
    createDefaultProvider('openai'),
    createDefaultProvider('gemini'),
    createDefaultProvider('customOpenAi'),
  ] as LlmProviderConfig[],
  businessModelConfig: DEFAULT_LLM_BUSINESS_CONFIG,
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

  const resolveProvider = (value: unknown): AiProvider | null => {
    if (value === 'openai' || value === 'gemini' || value === 'customOpenAi') {
      return value;
    }
    return null;
  };

  const openaiModel =
    typeof parsed.openaiModel === 'string' ? parsed.openaiModel : defaultSettings.openaiModel;
  const customOpenAiModel =
    typeof parsed.customOpenAiModel === 'string'
      ? parsed.customOpenAiModel
      : defaultSettings.customOpenAiModel;
  const geminiModel =
    typeof parsed.geminiModel === 'string' ? parsed.geminiModel : defaultSettings.geminiModel;

  const legacyProvider = resolveProvider(parsed.aiProvider) || defaultSettings.aiProvider;
  const parsedProviders = parseLlmProviders(parsed.llmProviders);
  const migratedProviders =
    parsedProviders.length > 0
      ? parsedProviders
      : [
          {
            ...createDefaultProvider('openai'),
            apiKey: typeof parsed.openaiApiKey === 'string' ? parsed.openaiApiKey : '',
            model: openaiModel,
          },
          {
            ...createDefaultProvider('gemini'),
            apiKey: typeof parsed.geminiApiKey === 'string' ? parsed.geminiApiKey : '',
            model: geminiModel,
          },
          {
            ...createDefaultProvider('customOpenAi'),
            apiKey: typeof parsed.customOpenAiApiKey === 'string' ? parsed.customOpenAiApiKey : '',
            model: customOpenAiModel,
            baseURL:
              typeof parsed.customOpenAiBaseUrl === 'string' ? parsed.customOpenAiBaseUrl : '',
            modelsEndpoint:
              typeof parsed.customOpenAiModelsEndpoint === 'string'
                ? parsed.customOpenAiModelsEndpoint
                : '',
          },
        ];

  const parsedBusinessModelConfig = sanitizeBusinessModelConfig(
    parsed.businessModelConfig,
    DEFAULT_LLM_BUSINESS_CONFIG,
  );
  const migratedBusinessModelConfig =
    typeof parsed.businessModelConfig === 'object' && parsed.businessModelConfig
      ? parsedBusinessModelConfig
      : migrateBusinessModelConfig(
          {
            aiProvider: legacyProvider,
            openaiModel,
            geminiModel,
            customOpenAiModel,
          },
          DEFAULT_LLM_BUSINESS_CONFIG,
        );

  return {
    autoRefresh:
      typeof parsed.autoRefresh === 'boolean' ? parsed.autoRefresh : defaultSettings.autoRefresh,
    useUnifiedRefresh:
      typeof parsed.useUnifiedRefresh === 'boolean'
        ? parsed.useUnifiedRefresh
        : defaultSettings.useUnifiedRefresh,
    aiProvider: legacyProvider,
    openaiApiKey:
      typeof parsed.openaiApiKey === 'string' ? parsed.openaiApiKey : defaultSettings.openaiApiKey,
    openaiModel,
    customOpenAiApiKey:
      typeof parsed.customOpenAiApiKey === 'string'
        ? parsed.customOpenAiApiKey
        : defaultSettings.customOpenAiApiKey,
    customOpenAiBaseUrl:
      typeof parsed.customOpenAiBaseUrl === 'string'
        ? parsed.customOpenAiBaseUrl
        : defaultSettings.customOpenAiBaseUrl,
    customOpenAiModelsEndpoint:
      typeof parsed.customOpenAiModelsEndpoint === 'string'
        ? parsed.customOpenAiModelsEndpoint
        : defaultSettings.customOpenAiModelsEndpoint,
    customOpenAiModel,
    geminiApiKey:
      typeof parsed.geminiApiKey === 'string' ? parsed.geminiApiKey : defaultSettings.geminiApiKey,
    geminiModel,
    githubToken:
      typeof parsed.githubToken === 'string' ? parsed.githubToken : defaultSettings.githubToken,
    defaultGistTarget: parseDefaultGistTarget(parsed.defaultGistTarget),
    llmProviders: migratedProviders,
    businessModelConfig: migratedBusinessModelConfig,
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
  customOpenAiApiKey: defaultSettings.customOpenAiApiKey,
  setCustomOpenAiApiKey: () => {},
  customOpenAiBaseUrl: defaultSettings.customOpenAiBaseUrl,
  setCustomOpenAiBaseUrl: () => {},
  customOpenAiModelsEndpoint: defaultSettings.customOpenAiModelsEndpoint,
  setCustomOpenAiModelsEndpoint: () => {},
  customOpenAiModel: defaultSettings.customOpenAiModel,
  setCustomOpenAiModel: () => {},
  geminiApiKey: defaultSettings.geminiApiKey,
  setGeminiApiKey: () => {},
  geminiModel: defaultSettings.geminiModel,
  setGeminiModel: () => {},
  githubToken: defaultSettings.githubToken,
  setGithubToken: () => {},
  defaultGistTarget: defaultSettings.defaultGistTarget,
  setDefaultGistTarget: () => {},
  llmProviders: defaultSettings.llmProviders,
  setLlmProviders: () => {},
  addLlmProvider: () => '',
  updateLlmProvider: () => {},
  removeLlmProvider: () => {},
  businessModelConfig: defaultSettings.businessModelConfig,
  setBusinessModelConfig: () => {},
  updateBusinessModelConfig: () => {},
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
  const setCustomOpenAiApiKey = (val: string) => updateSettings({ customOpenAiApiKey: val });
  const setCustomOpenAiBaseUrl = (val: string) => updateSettings({ customOpenAiBaseUrl: val });
  const setCustomOpenAiModelsEndpoint = (val: string) =>
    updateSettings({ customOpenAiModelsEndpoint: val });
  const setCustomOpenAiModel = (val: string) => updateSettings({ customOpenAiModel: val });
  const setGeminiApiKey = (val: string) => updateSettings({ geminiApiKey: val });
  const setGeminiModel = (val: string) => updateSettings({ geminiModel: val });
  const setGithubToken = (val: string) => updateSettings({ githubToken: val });
  const setDefaultGistTarget = (val: DefaultGistTargetSnapshot | null) =>
    updateSettings({ defaultGistTarget: val });
  const setLlmProviders = (val: LlmProviderConfig[]) => updateSettings({ llmProviders: val });
  const addLlmProvider = (kind: AiProvider) => {
    const created = createDefaultProvider(kind);
    setSettings((prev) => {
      const next = { ...prev, llmProviders: [...prev.llmProviders, created] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    return created.id;
  };
  const updateLlmProvider = (id: string, patch: Partial<LlmProviderConfig>) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        llmProviders: prev.llmProviders.map((provider) =>
          provider.id === id ? { ...provider, ...patch } : provider,
        ),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };
  const removeLlmProvider = (id: string) => {
    setSettings((prev) => {
      const nextProviders = prev.llmProviders.filter((provider) => provider.id !== id);
      const next = { ...prev, llmProviders: nextProviders };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };
  const setBusinessModelConfig = (val: BusinessModelConfig) =>
    updateSettings({ businessModelConfig: val });
  const updateBusinessModelConfig = (
    key: LlmBusinessKey,
    val: Partial<BusinessModelConfig[LlmBusinessKey]>,
  ) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        businessModelConfig: {
          ...prev.businessModelConfig,
          [key]: {
            ...prev.businessModelConfig[key],
            ...val,
          },
        },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

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
        customOpenAiApiKey: settings.customOpenAiApiKey,
        setCustomOpenAiApiKey,
        customOpenAiBaseUrl: settings.customOpenAiBaseUrl,
        setCustomOpenAiBaseUrl,
        customOpenAiModelsEndpoint: settings.customOpenAiModelsEndpoint,
        setCustomOpenAiModelsEndpoint,
        customOpenAiModel: settings.customOpenAiModel,
        setCustomOpenAiModel,
        geminiApiKey: settings.geminiApiKey,
        setGeminiApiKey,
        geminiModel: settings.geminiModel,
        setGeminiModel,
        githubToken: settings.githubToken,
        setGithubToken,
        defaultGistTarget: settings.defaultGistTarget,
        setDefaultGistTarget,
        llmProviders: settings.llmProviders,
        setLlmProviders,
        addLlmProvider,
        updateLlmProvider,
        removeLlmProvider,
        businessModelConfig: settings.businessModelConfig,
        setBusinessModelConfig,
        updateBusinessModelConfig,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
