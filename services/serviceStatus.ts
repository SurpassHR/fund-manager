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

type ServiceApiBase = Omit<ServiceApiStatus, 'status' | 'message' | 'checkedAt'>;

const nowIso = () => new Date().toISOString();

const ok = (base: ServiceApiBase): ServiceApiStatus => ({
  ...base,
  status: 'ok',
  message: '连接正常',
  checkedAt: nowIso(),
});

const fail = (
  base: ServiceApiBase,
  message: string,
  status: ServiceHealthStatus = 'error',
): ServiceApiStatus => ({
  ...base,
  status,
  message,
  checkedAt: nowIso(),
});

const idle = (base: ServiceApiBase, message: string): ServiceApiStatus => ({
  ...base,
  status: 'idle',
  message,
  checkedAt: nowIso(),
});

const checking = (base: ServiceApiBase): ServiceApiStatus => ({
  ...base,
  status: 'checking',
  message: '检测中',
  checkedAt: nowIso(),
});

const getServiceApiBases = (config: ServiceRuntimeConfig): ServiceApiBase[] => [
  {
    id: 'morningstar',
    name: 'Morningstar Fund API',
    provider: 'Morningstar',
    endpoint: 'https://www.morningstar.cn/cn-api/public/v1/fund-cache/{query}',
    auth: 'none',
  },
  {
    id: 'tencent-quote',
    name: 'Tencent Quote API',
    provider: 'Tencent',
    endpoint: 'https://qt.gtimg.cn/q=sh000001',
    auth: 'none',
  },
  {
    id: 'eastmoney-fundf10',
    name: 'EastMoney FundF10 Script API',
    provider: 'EastMoney',
    endpoint: 'https://fundf10.eastmoney.com/F10DataApi.aspx',
    auth: 'none',
  },
  {
    id: 'github-gist',
    name: 'GitHub Gist API',
    provider: 'GitHub',
    endpoint: 'https://api.github.com',
    auth: 'token',
  },
  {
    id: 'openai',
    name: 'OpenAI Models API',
    provider: 'OpenAI',
    endpoint: 'https://api.openai.com/v1/models',
    auth: 'apiKey',
  },
  {
    id: 'gemini',
    name: 'Gemini Models API',
    provider: 'Google Gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    auth: 'apiKey',
  },
  {
    id: 'custom-openai',
    name: 'Custom OpenAI Compatible API',
    provider: 'OpenAI Compatible',
    endpoint:
      config.customOpenAiModelsEndpoint.trim() || `${config.customOpenAiBaseUrl.trim()}/models`,
    auth: 'apiKey',
  },
];

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

export const getInitialServiceApiStatuses = (config: ServiceRuntimeConfig): ServiceApiStatus[] => {
  return getServiceApiBases(config).map((base) => checking(base));
};

const runServiceApiCheckTasks = (config: ServiceRuntimeConfig): Promise<ServiceApiStatus>[] => [
  (async () => {
    const base = getServiceApiBases(config).find((item) => item.id === 'morningstar');
    if (!base) throw new Error('MISSING_SERVICE_API_BASE');
    try {
      const res = await fetch('https://www.morningstar.cn/cn-api/public/v1/fund-cache/110011');
      return res.ok ? ok(base) : fail(base, `HTTP ${res.status}`);
    } catch (error) {
      return fail(base, error instanceof Error ? error.message : '请求失败');
    }
  })(),
  (async () => {
    const base = getServiceApiBases(config).find((item) => item.id === 'tencent-quote');
    if (!base) throw new Error('MISSING_SERVICE_API_BASE');
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
    const base = getServiceApiBases(config).find((item) => item.id === 'eastmoney-fundf10');
    if (!base) throw new Error('MISSING_SERVICE_API_BASE');
    try {
      const loaded = await probeEastMoneyScript();
      return loaded ? ok(base) : fail(base, '脚本加载失败');
    } catch (error) {
      return fail(base, error instanceof Error ? error.message : '脚本探测失败');
    }
  })(),
  (async () => {
    const base = getServiceApiBases(config).find((item) => item.id === 'github-gist');
    if (!base) throw new Error('MISSING_SERVICE_API_BASE');
    if (!config.githubToken.trim()) return idle(base, '未配置 Token');
    try {
      await verifyGithubToken(config.githubToken.trim());
      return ok(base);
    } catch (error) {
      return fail(base, error instanceof Error ? error.message : 'Token 验证失败');
    }
  })(),
  (async () => {
    const base = getServiceApiBases(config).find((item) => item.id === 'openai');
    if (!base) throw new Error('MISSING_SERVICE_API_BASE');
    if (!config.openaiApiKey.trim()) return idle(base, '未配置 API Key');
    try {
      await listOpenAiModels(config.openaiApiKey.trim());
      return ok(base);
    } catch (error) {
      return fail(base, error instanceof Error ? error.message : '模型列表获取失败');
    }
  })(),
  (async () => {
    const base = getServiceApiBases(config).find((item) => item.id === 'gemini');
    if (!base) throw new Error('MISSING_SERVICE_API_BASE');
    if (!config.geminiApiKey.trim()) return idle(base, '未配置 API Key');
    try {
      await listGeminiModels(config.geminiApiKey.trim());
      return ok(base);
    } catch (error) {
      return fail(base, error instanceof Error ? error.message : '模型列表获取失败');
    }
  })(),
  (async () => {
    const base = getServiceApiBases(config).find((item) => item.id === 'custom-openai');
    if (!base) throw new Error('MISSING_SERVICE_API_BASE');
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

export const streamServiceApiStatuses = async (
  config: ServiceRuntimeConfig,
  onItemResolved?: (item: ServiceApiStatus) => void,
): Promise<ServiceApiStatus[]> => {
  const tasks = runServiceApiCheckTasks(config).map(async (task) => {
    const item = await task;
    onItemResolved?.(item);
    return item;
  });

  return await Promise.all(tasks);
};

export const getServiceApiStatuses = async (
  config: ServiceRuntimeConfig,
): Promise<ServiceApiStatus[]> => {
  return await streamServiceApiStatuses(config);
};
