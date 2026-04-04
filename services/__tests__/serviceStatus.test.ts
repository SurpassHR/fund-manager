/// <reference types="vitest/globals" />
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../aiOcr', () => ({
  listOpenAiModels: vi.fn(),
  listGeminiModels: vi.fn(),
  listCustomOpenAiModels: vi.fn(),
}));

vi.mock('../gistSync/client', () => ({
  verifyGithubToken: vi.fn(),
}));

import { getServiceApiStatuses } from '../serviceStatus';

const mockFetch = vi.fn<typeof fetch>();

describe('serviceStatus', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockFetch.mockReset();
  });

  it('returns idle for key/token based APIs when credentials missing', async () => {
    const appendSpy = vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      if (node instanceof HTMLScriptElement) {
        setTimeout(() => node.onload?.(new Event('load')));
      }
      return node;
    });

    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('morningstar.cn')) {
        return new Response('{}', { status: 200 });
      }
      if (url.includes('qt.gtimg.cn')) {
        return new Response('v_sh000001="1~上证指数~000001~3028.05~..."', { status: 200 });
      }
      return new Response('{}', { status: 404 });
    });

    const list = await getServiceApiStatuses({
      openaiApiKey: '',
      geminiApiKey: '',
      customOpenAiApiKey: '',
      customOpenAiBaseUrl: '',
      customOpenAiModelsEndpoint: '',
      githubToken: '',
    });

    expect(list).toHaveLength(7);
    expect(list.find((item) => item.id === 'morningstar')?.status).toBe('ok');
    expect(list.find((item) => item.id === 'tencent-quote')?.status).toBe('ok');
    expect(list.find((item) => item.id === 'eastmoney-fundf10')?.status).toBe('ok');
    expect(list.find((item) => item.id === 'openai')?.status).toBe('idle');
    expect(list.find((item) => item.id === 'gemini')?.status).toBe('idle');
    expect(list.find((item) => item.id === 'github-gist')?.status).toBe('idle');

    appendSpy.mockRestore();
  });

  it('marks morningstar as error when probe fails', async () => {
    const appendSpy = vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      if (node instanceof HTMLScriptElement) {
        setTimeout(() => node.onerror?.(new Event('error')));
      }
      return node;
    });

    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('morningstar.cn')) {
        throw new Error('network down');
      }
      if (url.includes('qt.gtimg.cn')) {
        return new Response('v_sh000001="1~上证指数~000001~3028.05~..."', { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });

    const list = await getServiceApiStatuses({
      openaiApiKey: '',
      geminiApiKey: '',
      customOpenAiApiKey: '',
      customOpenAiBaseUrl: '',
      customOpenAiModelsEndpoint: '',
      githubToken: '',
    });

    expect(list.find((item) => item.id === 'morningstar')?.status).toBe('error');
    expect(list.find((item) => item.id === 'eastmoney-fundf10')?.status).toBe('error');

    appendSpy.mockRestore();
  });
});
