import { describe, expect, it } from 'vitest';
import {
  getConfiguredLlmProviders,
  resolveAiRuntimeConfig,
  resolveAiRuntimeConfigByBusiness,
} from '../aiProviderConfig';

describe('resolveAiRuntimeConfig', () => {
  it('在 customOpenAi 下返回自定义配置', () => {
    const runtime = resolveAiRuntimeConfig({
      aiProvider: 'customOpenAi',
      openaiApiKey: 'openai-key',
      openaiModel: 'gpt-4o-mini',
      geminiApiKey: 'gemini-key',
      geminiModel: 'gemini-2.5-flash',
      customOpenAiApiKey: 'custom-key',
      customOpenAiModel: 'qwen-plus',
      customOpenAiBaseUrl: ' https://api.example.com/v1 ',
      customOpenAiModelsEndpoint: ' https://api.example.com/v1/models ',
    });

    expect(runtime).toEqual({
      provider: 'customOpenAi',
      apiKey: 'custom-key',
      model: 'qwen-plus',
      baseURL: 'https://api.example.com/v1',
      modelsEndpoint: 'https://api.example.com/v1/models',
    });
  });

  it('在 customOpenAi 且 baseURL 为空时安全回退为 undefined', () => {
    const runtime = resolveAiRuntimeConfig({
      aiProvider: 'customOpenAi',
      openaiApiKey: '',
      openaiModel: 'gpt-4o-mini',
      geminiApiKey: '',
      geminiModel: 'gemini-2.5-flash',
      customOpenAiApiKey: 'custom-key',
      customOpenAiModel: 'custom-model',
      customOpenAiBaseUrl: '   ',
      customOpenAiModelsEndpoint: '   ',
    });

    expect(runtime.baseURL).toBeUndefined();
    expect(runtime.modelsEndpoint).toBeUndefined();
    expect(runtime.apiKey).toBe('custom-key');
  });
});

describe('provider registry & business runtime', () => {
  it('仅返回已配置凭据的 provider', () => {
    const providers = getConfiguredLlmProviders([
      {
        id: 'p1',
        kind: 'openai',
        name: 'OpenAI',
        apiKey: 'openai-key',
        model: 'gpt-4o-mini',
        temperature: 0.2,
        icon: '🧠',
        baseURL: '',
        modelsEndpoint: '',
      },
      {
        id: 'p2',
        kind: 'gemini',
        name: 'Gemini',
        apiKey: '',
        model: 'gemini-2.5-flash',
        temperature: 0.2,
        icon: '✨',
        baseURL: '',
        modelsEndpoint: '',
      },
      {
        id: 'p3',
        kind: 'customOpenAi',
        name: 'Custom',
        apiKey: 'custom-key',
        model: 'qwen-plus',
        temperature: 0.2,
        icon: '🔌',
        baseURL: '',
        modelsEndpoint: '',
      },
    ]);

    expect(providers.map((item) => item.id)).toEqual(['p1']);
  });

  it('按业务配置解析 runtime（优先 providerId）', () => {
    const runtime = resolveAiRuntimeConfigByBusiness(
      {
        aiProvider: 'openai',
        openaiApiKey: '',
        openaiModel: 'gpt-4o-mini',
        geminiApiKey: '',
        geminiModel: 'gemini-2.5-flash',
        customOpenAiApiKey: '',
        customOpenAiBaseUrl: '',
        customOpenAiModelsEndpoint: '',
        customOpenAiModel: 'qwen-plus',
        llmProviders: [
          {
            id: 'p-openai',
            kind: 'openai',
            name: 'OpenAI',
            apiKey: 'openai-key',
            model: 'gpt-4o-mini',
            temperature: 0.2,
            icon: '🧠',
            baseURL: '',
            modelsEndpoint: '',
          },
        ],
        businessModelConfig: {
          aiHoldingsAnalysis: {
            providerId: 'p-openai',
            providerKind: 'openai',
            model: 'gpt-4.1-mini',
          },
          syncHoldings: {
            providerId: '',
            providerKind: 'openai',
            model: 'gpt-4o-mini',
          },
        },
      },
      'aiHoldingsAnalysis',
    );

    expect(runtime.provider).toBe('openai');
    expect(runtime.apiKey).toBe('openai-key');
    expect(runtime.model).toBe('gpt-4.1-mini');
  });
});
