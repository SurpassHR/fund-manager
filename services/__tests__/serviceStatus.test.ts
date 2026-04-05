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

import {
  getInitialServiceApiStatuses,
  streamServiceApiStatuses,
  type ServiceApiStatus,
} from '../serviceStatus';

const mockFetch = vi.fn<typeof fetch>();

describe('serviceStatus', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockFetch.mockReset();
  });

  it('returns checking status for all apis in initial list', () => {
    const list = getInitialServiceApiStatuses({
      openaiApiKey: '',
      geminiApiKey: '',
      customOpenAiApiKey: '',
      customOpenAiBaseUrl: '',
      customOpenAiModelsEndpoint: '',
      githubToken: '',
    });

    expect(list).toHaveLength(7);
    expect(list.every((item) => item.status === 'checking')).toBe(true);
  });

  it('streams per-api result without waiting all checks finished', async () => {
    const appendSpy = vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      if (node instanceof HTMLScriptElement) {
        setTimeout(() => node.onload?.(new Event('load')));
      }
      return node;
    });

    let resolveMorningstar!: (value: Response) => void;
    const morningstarPromise = new Promise<Response>((resolve) => {
      resolveMorningstar = resolve;
    });

    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('morningstar.cn')) {
        return morningstarPromise;
      }
      if (url.includes('qt.gtimg.cn')) {
        return Promise.resolve(
          new Response('v_sh000001="1~上证指数~000001~3028.05~..."', { status: 200 }),
        );
      }
      return Promise.resolve(new Response('{}', { status: 404 }));
    });

    const updates: ServiceApiStatus[] = [];
    const task = streamServiceApiStatuses(
      {
        openaiApiKey: '',
        geminiApiKey: '',
        customOpenAiApiKey: '',
        customOpenAiBaseUrl: '',
        customOpenAiModelsEndpoint: '',
        githubToken: '',
      },
      (item) => {
        updates.push(item);
      },
    );

    await vi.waitFor(() => {
      expect(updates.some((item) => item.id === 'tencent-quote')).toBe(true);
    });
    expect(updates.some((item) => item.id === 'morningstar')).toBe(false);

    resolveMorningstar(new Response('{}', { status: 200 }));
    const list = await task;

    expect(list).toHaveLength(7);
    expect(list.find((item) => item.id === 'morningstar')?.status).toBe('ok');
    expect(list.find((item) => item.id === 'openai')?.status).toBe('idle');

    appendSpy.mockRestore();
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

    const list = await streamServiceApiStatuses({
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

    const list = await streamServiceApiStatuses({
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
