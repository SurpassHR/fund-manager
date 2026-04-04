import { afterEach, describe, expect, it, vi } from 'vitest';
import { listCustomOpenAiModels } from '../aiOcr';

describe('listCustomOpenAiModels', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('优先使用自定义 models endpoint 拉取模型列表', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ id: 'qwen-plus' }, { id: 'qwen-max' }] }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const models = await listCustomOpenAiModels({
      apiKey: 'custom-key',
      baseURL: 'https://api.example.com/v1',
      modelsEndpoint: 'https://gateway.example.com/openai/models',
    });

    expect(fetchMock).toHaveBeenCalledWith('https://gateway.example.com/openai/models', {
      headers: {
        Authorization: 'Bearer custom-key',
      },
    });
    expect(models).toEqual(['qwen-max', 'qwen-plus']);
  });

  it('在未提供 models endpoint 时回退到 baseURL/models', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ id: 'model-b' }, { id: 'model-a' }] }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const models = await listCustomOpenAiModels({
      apiKey: 'custom-key',
      baseURL: 'https://api.example.com/v1/',
    });

    expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/v1/models', {
      headers: {
        Authorization: 'Bearer custom-key',
      },
    });
    expect(models).toEqual(['model-a', 'model-b']);
  });
});
