import type { AiProvider } from './SettingsContext';

export type AiUsage = 'ocr' | 'analysis';

export interface AiSettingsSnapshot {
  aiProvider: AiProvider;
  ocrAiProvider: AiProvider;
  ocrAiModel: string;
  analysisAiProvider: AiProvider;
  analysisAiModel: string;
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

const resolveProviderModel = (settings: AiSettingsSnapshot, provider: AiProvider) => {
  if (provider === 'openai') return settings.openaiModel;
  if (provider === 'gemini') return settings.geminiModel;
  return settings.customOpenAiModel;
};

const resolveProviderApiKey = (settings: AiSettingsSnapshot, provider: AiProvider) => {
  if (provider === 'openai') return settings.openaiApiKey;
  if (provider === 'gemini') return settings.geminiApiKey;
  return settings.customOpenAiApiKey;
};

export const resolveAiRuntimeConfigByUsage = (
  settings: AiSettingsSnapshot,
  usage: AiUsage,
): AiRuntimeConfig => {
  const provider = usage === 'ocr' ? settings.ocrAiProvider : settings.analysisAiProvider;
  const selectedModel = usage === 'ocr' ? settings.ocrAiModel : settings.analysisAiModel;

  if (provider === 'openai') {
    return {
      provider: 'openai',
      apiKey: resolveProviderApiKey(settings, provider),
      model: selectedModel || resolveProviderModel(settings, provider),
    };
  }

  if (provider === 'gemini') {
    return {
      provider: 'gemini',
      apiKey: resolveProviderApiKey(settings, provider),
      model: selectedModel || resolveProviderModel(settings, provider),
    };
  }

  return {
    provider: 'customOpenAi',
    apiKey: resolveProviderApiKey(settings, provider),
    model: selectedModel || resolveProviderModel(settings, provider),
    baseURL: normalizeOptionalUrl(settings.customOpenAiBaseUrl),
    modelsEndpoint: normalizeOptionalUrl(settings.customOpenAiModelsEndpoint),
  };
};

export const resolveAiRuntimeConfig = (settings: AiSettingsSnapshot): AiRuntimeConfig => {
  return resolveAiRuntimeConfigByUsage(settings, 'ocr');
};
