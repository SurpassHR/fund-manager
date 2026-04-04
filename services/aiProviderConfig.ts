import type { AiProvider, LlmProviderConfig } from './SettingsContext';
import type { BusinessModelConfig, LlmBusinessKey } from './businessModelConfig';

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
  llmProviders?: LlmProviderConfig[];
  businessModelConfig?: BusinessModelConfig;
}

export interface AiRuntimeConfig {
  provider: AiProvider;
  providerId?: string;
  apiKey: string;
  model: string;
  baseURL?: string;
  modelsEndpoint?: string;
  temperature?: number;
}

const normalizeOptionalUrl = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed || undefined;
};

export const resolveAiRuntimeConfigFromProvider = (
  provider: LlmProviderConfig,
  selectedModel?: string,
): AiRuntimeConfig => {
  return {
    provider: provider.kind,
    providerId: provider.id,
    apiKey: provider.apiKey,
    model: selectedModel || provider.model,
    baseURL: normalizeOptionalUrl(provider.baseURL),
    modelsEndpoint: normalizeOptionalUrl(provider.modelsEndpoint),
    temperature: provider.temperature,
  };
};

export const getConfiguredLlmProviders = (providers: LlmProviderConfig[] = []): LlmProviderConfig[] => {
  return providers.filter((provider) => {
    if (!provider.apiKey.trim()) return false;
    if (provider.kind !== 'customOpenAi') return true;
    return Boolean(provider.baseURL.trim() || provider.modelsEndpoint.trim());
  });
};

export const resolveAiRuntimeConfigByBusiness = (
  settings: AiSettingsSnapshot,
  businessKey: LlmBusinessKey,
): AiRuntimeConfig => {
  const configuredProviders = getConfiguredLlmProviders(settings.llmProviders || []);
  const businessSelection = settings.businessModelConfig?.[businessKey];

  if (businessSelection) {
    const providerById = configuredProviders.find(
      (provider) => provider.id === businessSelection.providerId,
    );
    if (providerById) {
      return resolveAiRuntimeConfigFromProvider(providerById, businessSelection.model);
    }
    const providerByKind = configuredProviders.find(
      (provider) => provider.kind === businessSelection.providerKind,
    );
    if (providerByKind) {
      return resolveAiRuntimeConfigFromProvider(providerByKind, businessSelection.model);
    }
  }

  if (configuredProviders[0]) {
    return resolveAiRuntimeConfigFromProvider(configuredProviders[0]);
  }

  return resolveAiRuntimeConfig(settings);
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
