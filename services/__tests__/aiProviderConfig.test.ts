import { describe, expect, it } from 'vitest';
import { resolveAiRuntimeConfig } from '../aiProviderConfig';

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
