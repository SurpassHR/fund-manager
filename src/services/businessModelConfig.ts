import type { AiProvider } from './SettingsContext';

export type LlmBusinessKey = 'aiHoldingsAnalysis' | 'syncHoldings';

export interface BusinessModelSelection {
  providerId: string;
  providerKind: AiProvider;
  model: string;
}

export type BusinessModelConfig = Record<LlmBusinessKey, BusinessModelSelection>;

export const LLM_BUSINESS_KEYS: LlmBusinessKey[] = ['aiHoldingsAnalysis', 'syncHoldings'];

export const DEFAULT_LLM_BUSINESS_CONFIG: BusinessModelConfig = {
  aiHoldingsAnalysis: {
    providerId: '',
    providerKind: 'openai',
    model: '',
  },
  syncHoldings: {
    providerId: '',
    providerKind: 'openai',
    model: '',
  },
};

const isProvider = (value: unknown): value is AiProvider =>
  value === 'openai' || value === 'gemini' || value === 'customOpenAi';

export const sanitizeBusinessModelConfig = (
  raw: unknown,
  fallback: BusinessModelConfig = DEFAULT_LLM_BUSINESS_CONFIG,
): BusinessModelConfig => {
  if (!raw || typeof raw !== 'object') {
    return { ...fallback };
  }

  const value = raw as Partial<Record<LlmBusinessKey, unknown>>;
  const output = { ...fallback };

  for (const key of LLM_BUSINESS_KEYS) {
    const candidate = value[key];
    if (!candidate || typeof candidate !== 'object') {
      output[key] = fallback[key];
      continue;
    }
    const item = candidate as Partial<BusinessModelSelection>;
    output[key] = {
      providerId: typeof item.providerId === 'string' ? item.providerId : fallback[key].providerId,
      providerKind: isProvider(item.providerKind) ? item.providerKind : fallback[key].providerKind,
      model: typeof item.model === 'string' ? item.model : fallback[key].model,
    };
  }

  return output;
};

export const migrateBusinessModelConfig = (
  legacy: Partial<{
    aiProvider: AiProvider;
    openaiModel: string;
    geminiModel: string;
    customOpenAiModel: string;
  }> | null,
  fallback: BusinessModelConfig = DEFAULT_LLM_BUSINESS_CONFIG,
): BusinessModelConfig => {
  if (!legacy || !legacy.aiProvider) {
    return { ...fallback };
  }

  const providerKind = legacy.aiProvider;
  const model =
    providerKind === 'openai'
      ? legacy.openaiModel || ''
      : providerKind === 'gemini'
        ? legacy.geminiModel || ''
        : legacy.customOpenAiModel || '';

  return {
    aiHoldingsAnalysis: {
      providerId: '',
      providerKind,
      model,
    },
    syncHoldings: {
      providerId: '',
      providerKind,
      model,
    },
  };
};
