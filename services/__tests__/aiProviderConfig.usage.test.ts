import { describe, expect, it } from 'vitest';
import { resolveAiRuntimeConfigByUsage } from '../aiProviderConfig';

describe('resolveAiRuntimeConfigByUsage', () => {
  it('按用途分别解析 provider 与 model', () => {
    const settings = {
      aiProvider: 'openai' as const,
      ocrAiProvider: 'gemini' as const,
      ocrAiModel: 'gemini-2.5-flash',
      analysisAiProvider: 'customOpenAi' as const,
      analysisAiModel: 'qwen-plus',
      openaiApiKey: 'openai-key',
      openaiModel: 'gpt-4o-mini',
      geminiApiKey: 'gemini-key',
      geminiModel: 'gemini-3.1-flash-lite-preview',
      customOpenAiApiKey: 'custom-key',
      customOpenAiBaseUrl: ' https://api.example.com/v1 ',
      customOpenAiModelsEndpoint: ' https://api.example.com/v1/models ',
      customOpenAiModel: 'custom-default',
    };

    const ocrRuntime = resolveAiRuntimeConfigByUsage(settings, 'ocr');
    const analysisRuntime = resolveAiRuntimeConfigByUsage(settings, 'analysis');

    expect(ocrRuntime).toEqual({
      provider: 'gemini',
      apiKey: 'gemini-key',
      model: 'gemini-2.5-flash',
    });

    expect(analysisRuntime).toEqual({
      provider: 'customOpenAi',
      apiKey: 'custom-key',
      model: 'qwen-plus',
      baseURL: 'https://api.example.com/v1',
      modelsEndpoint: 'https://api.example.com/v1/models',
    });
  });

  it('当用途模型为空时回退到 provider 默认模型', () => {
    const settings = {
      aiProvider: 'openai' as const,
      ocrAiProvider: 'openai' as const,
      ocrAiModel: '',
      analysisAiProvider: 'customOpenAi' as const,
      analysisAiModel: '',
      openaiApiKey: 'openai-key',
      openaiModel: 'gpt-4o-mini',
      geminiApiKey: 'gemini-key',
      geminiModel: 'gemini-3.1-flash-lite-preview',
      customOpenAiApiKey: 'custom-key',
      customOpenAiBaseUrl: '   ',
      customOpenAiModelsEndpoint: '   ',
      customOpenAiModel: 'qwen-max',
    };

    const ocrRuntime = resolveAiRuntimeConfigByUsage(settings, 'ocr');
    const analysisRuntime = resolveAiRuntimeConfigByUsage(settings, 'analysis');

    expect(ocrRuntime).toEqual({
      provider: 'openai',
      apiKey: 'openai-key',
      model: 'gpt-4o-mini',
    });
    expect(analysisRuntime.provider).toBe('customOpenAi');
    expect(analysisRuntime.model).toBe('qwen-max');
    expect(analysisRuntime.baseURL).toBeUndefined();
    expect(analysisRuntime.modelsEndpoint).toBeUndefined();
  });
});
