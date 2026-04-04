import type { AiProvider } from './SettingsContext';

export interface AiSettingsSnapshot {
  aiProvider: AiProvider;
  openaiApiKey: string;
  openaiModel: string;
  geminiApiKey: string;
  geminiModel: string;
  customOpenAiApiKey: string;
  customOpenAiBaseUrl: string;
  customOpenAiModelsEndpoint: string;
  customOpenAiModel: string;
}

export interface AiRuntimeConfig {
  provider: AiProvider;
  apiKey: string;
  model: string;
  baseURL?: string;
  modelsEndpoint?: string;
}

const normalizeOptionalUrl = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed || undefined;
};

export const resolveAiRuntimeConfig = (settings: AiSettingsSnapshot): AiRuntimeConfig => {
  if (settings.aiProvider === 'openai') {
    return {
      provider: 'openai',
      apiKey: settings.openaiApiKey,
      model: settings.openaiModel,
    };
  }

  if (settings.aiProvider === 'gemini') {
    return {
      provider: 'gemini',
      apiKey: settings.geminiApiKey,
      model: settings.geminiModel,
    };
  }

  return {
    provider: 'customOpenAi',
    apiKey: settings.customOpenAiApiKey,
    model: settings.customOpenAiModel,
    baseURL: normalizeOptionalUrl(settings.customOpenAiBaseUrl),
    modelsEndpoint: normalizeOptionalUrl(settings.customOpenAiModelsEndpoint),
  };
};
