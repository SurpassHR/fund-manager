import { listCustomOpenAiModels, listGeminiModels, listOpenAiModels } from './aiOcr';
import { verifyGithubToken } from './gistSync/client';

export type ServiceHealthStatus = 'idle' | 'checking' | 'ok' | 'error' | 'degraded';

export interface ServiceRuntimeConfig {
  openaiApiKey: string;
  geminiApiKey: string;
  customOpenAiApiKey: string;
  customOpenAiBaseUrl: string;
  customOpenAiModelsEndpoint: string;
  githubToken: string;
}

export interface ServiceApiStatus {
  id: string;
  name: string;
  provider: string;
  endpoint: string;
  auth: 'none' | 'apiKey' | 'token';
  status: ServiceHealthStatus;
  message: string;
  checkedAt: string;
}

const nowIso = () => new Date().toISOString();

const ok = (
  base: Omit<ServiceApiStatus, 'status' | 'message' | 'checkedAt'>,
): ServiceApiStatus => ({
  ...base,
  status: 'ok',
  message: '连接正常',
  checkedAt: nowIso(),
});

const fail = (
  base: Omit<ServiceApiStatus, 'status' | 'message' | 'checkedAt'>,
  message: string,
  status: ServiceHealthStatus = 'error',
): ServiceApiStatus => ({
  ...base,
  status,
  message,
  checkedAt: nowIso(),
});

const idle = (
  base: Omit<ServiceApiStatus, 'status' | 'message' | 'checkedAt'>,
  message: string,
): ServiceApiStatus => ({
  ...base,
  status: 'idle',
  message,
  checkedAt: nowIso(),
});

const probeEastMoneyScript = async (): Promise<boolean> => {
  return await new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = `https://fundf10.eastmoney.com/F10DataApi.aspx?type=lsjz&code=000001&page=1&per=1&rt=${Date.now()}`;
    script.referrerPolicy = 'no-referrer';

    const finish = (result: boolean) => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
      (window as Window & { apidata?: unknown }).apidata = undefined;
      resolve(result);
    };

    script.onload = () => finish(true);
    script.onerror = () => finish(false);
    document.head.appendChild(script);
  });
};

export const getServiceApiStatuses = async (
  config: ServiceRuntimeConfig,
): Promise<ServiceApiStatus[]> => {
  const tasks: Promise<ServiceApiStatus>[] = [
    (async () => {
      const base = {
        id: 'morningstar',
        name: 'Morningstar Fund API',
        provider: 'Morningstar',
        endpoint: 'https://www.morningstar.cn/cn-api/public/v1/fund-cache/{query}',
        auth: 'none' as const,
      };
      try {
        const res = await fetch('https://www.morningstar.cn/cn-api/public/v1/fund-cache/110011');
        return res.ok ? ok(base) : fail(base, `HTTP ${res.status}`);
      } catch (error) {
        return fail(base, error instanceof Error ? error.message : '请求失败');
      }
    })(),
    (async () => {
      const base = {
        id: 'tencent-quote',
        name: 'Tencent Quote API',
        provider: 'Tencent',
        endpoint: 'https://qt.gtimg.cn/q=sh000001',
        auth: 'none' as const,
      };
      try {
        const res = await fetch('https://qt.gtimg.cn/q=sh000001');
        const text = await res.text();
        if (!res.ok) return fail(base, `HTTP ${res.status}`);
        if (!text.includes('~')) return fail(base, '返回格式异常', 'degraded');
        return ok(base);
      } catch (error) {
        return fail(base, error instanceof Error ? error.message : '请求失败');
      }
    })(),
    (async () => {
      const base = {
        id: 'eastmoney-fundf10',
        name: 'EastMoney FundF10 Script API',
        provider: 'EastMoney',
        endpoint: 'https://fundf10.eastmoney.com/F10DataApi.aspx',
        auth: 'none' as const,
      };
      try {
        const loaded = await probeEastMoneyScript();
        return loaded ? ok(base) : fail(base, '脚本加载失败');
      } catch (error) {
        return fail(base, error instanceof Error ? error.message : '脚本探测失败');
      }
    })(),
    (async () => {
      const base = {
        id: 'github-gist',
        name: 'GitHub Gist API',
        provider: 'GitHub',
        endpoint: 'https://api.github.com',
        auth: 'token' as const,
      };
      if (!config.githubToken.trim()) return idle(base, '未配置 Token');
      try {
        await verifyGithubToken(config.githubToken.trim());
        return ok(base);
      } catch (error) {
        return fail(base, error instanceof Error ? error.message : 'Token 验证失败');
      }
    })(),
    (async () => {
      const base = {
        id: 'openai',
        name: 'OpenAI Models API',
        provider: 'OpenAI',
        endpoint: 'https://api.openai.com/v1/models',
        auth: 'apiKey' as const,
      };
      if (!config.openaiApiKey.trim()) return idle(base, '未配置 API Key');
      try {
        await listOpenAiModels(config.openaiApiKey.trim());
        return ok(base);
      } catch (error) {
        return fail(base, error instanceof Error ? error.message : '模型列表获取失败');
      }
    })(),
    (async () => {
      const base = {
        id: 'gemini',
        name: 'Gemini Models API',
        provider: 'Google Gemini',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
        auth: 'apiKey' as const,
      };
      if (!config.geminiApiKey.trim()) return idle(base, '未配置 API Key');
      try {
        await listGeminiModels(config.geminiApiKey.trim());
        return ok(base);
      } catch (error) {
        return fail(base, error instanceof Error ? error.message : '模型列表获取失败');
      }
    })(),
    (async () => {
      const base = {
        id: 'custom-openai',
        name: 'Custom OpenAI Compatible API',
        provider: 'OpenAI Compatible',
        endpoint:
          config.customOpenAiModelsEndpoint.trim() || `${config.customOpenAiBaseUrl.trim()}/models`,
        auth: 'apiKey' as const,
      };
      if (!config.customOpenAiApiKey.trim()) return idle(base, '未配置 API Key');
      if (!config.customOpenAiBaseUrl.trim() && !config.customOpenAiModelsEndpoint.trim()) {
        return idle(base, '未配置 Base URL/Models Endpoint');
      }
      try {
        await listCustomOpenAiModels({
          apiKey: config.customOpenAiApiKey.trim(),
          baseURL: config.customOpenAiBaseUrl.trim(),
          modelsEndpoint: config.customOpenAiModelsEndpoint.trim(),
        });
        return ok(base);
      } catch (error) {
        return fail(base, error instanceof Error ? error.message : '模型列表获取失败');
      }
    })(),
  ];

  return await Promise.all(tasks);
};
