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
    id: 'ths-fuyao',
    name: 'THS Fuyao Quote API',
    provider: '同花顺',
    endpoint: 'https://quota-h.10jqka.com.cn/fuyao/common_hq_aggr/quote/v1/multi_last_snapshot',
    auth: 'none',
  },
  {
    id: 'tencent-us-minute',
    name: 'Tencent US Minute API',
    provider: 'Tencent',
    endpoint: 'https://web.ifzq.gtimg.cn/appstock/app/UsMinute/query',
    auth: 'none',
  },
  {
    id: 'tencent-us-quote',
    name: 'Tencent US Quote API',
    provider: 'Tencent',
    endpoint: 'https://web.ifzq.gtimg.cn/appstock/app/UsMinute/query',
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
    const base = getServiceApiBases(config).find((item) => item.id === 'tencent-us-minute');
    if (!base) throw new Error('MISSING_SERVICE_API_BASE');
    try {
      const url = `https://web.ifzq.gtimg.cn/appstock/app/UsMinute/query?_var=min_data_usAAPLOQ&code=usAAPL.OQ&r=${Math.random()}`;
      const res = await fetch(url);
      if (!res.ok) return fail(base, `HTTP ${res.status}`);
      const rawText = await res.text();
      const jsonStart = rawText.indexOf('{');
      if (jsonStart < 0) return fail(base, '返回格式异常，非 JSONP', 'degraded');
      const json = JSON.parse(rawText.slice(jsonStart));
      if ((json as { code?: number }).code !== 0)
        return fail(base, `接口返回错误码: ${(json as { code?: number }).code}`, 'degraded');
      const data = (json as { data?: Record<string, { data?: { data?: unknown } }> }).data?.[
        'usAAPL.OQ'
      ]?.data?.data;
      if (!data || !Array.isArray(data) || data.length === 0)
        return fail(base, '无分钟数据', 'degraded');
      return ok(base);
    } catch (error) {
      return fail(base, error instanceof Error ? error.message : '请求失败');
    }
  })(),
  (async () => {
    const base = getServiceApiBases(config).find((item) => item.id === 'tencent-us-quote');
    if (!base) throw new Error('MISSING_SERVICE_API_BASE');
    try {
      const intraday = await (async () => {
        const url = `https://web.ifzq.gtimg.cn/appstock/app/UsMinute/query?_var=min_data_usAAPLOQ&code=usAAPL.OQ&r=${Math.random()}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const rawText = await res.text();
        const jsonStart = rawText.indexOf('{');
        if (jsonStart < 0) return null;
        const json = JSON.parse(rawText.slice(jsonStart));
        if ((json as { code?: number }).code !== 0) return null;
        return (
          (json as { data?: Record<string, { data?: { data?: string[] } }> }).data?.['usAAPL.OQ']
            ?.data?.data ?? null
        );
      })();
      if (!intraday || intraday.length === 0) return fail(base, '无行情数据', 'degraded');
      if (intraday.length < 2) return fail(base, '分钟数据不足，无法计算涨跌幅', 'degraded');
      const firstParts = intraday[0].split(' ');
      const lastParts = intraday[intraday.length - 1].split(' ');
      if (firstParts.length < 2 || lastParts.length < 2)
        return fail(base, '分钟数据格式异常', 'degraded');
      return ok(base);
    } catch (error) {
      return fail(base, error instanceof Error ? error.message : '请求失败');
    }
  })(),
  (async () => {
    const base = getServiceApiBases(config).find((item) => item.id === 'ths-fuyao');
    if (!base) throw new Error('MISSING_SERVICE_API_BASE');
    try {
      const res = await fetch(
        'https://quota-h.10jqka.com.cn/fuyao/common_hq_aggr/quote/v1/multi_last_snapshot',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Fuyao-Auth':
              'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhdXRob3JpemVyX25hbWVzcGFjZSI6ImNvbW1vbi1ocS1hZ2dyIiwibGljZW5zZWVfdHlwZSI6IkZST05UX0FQUCIsImxpY2Vuc2VlX25hbWVzcGFjZSI6Imh4a2xpbmUtTkVXU19hcHBOZXdzRmxvd0hvbWVfUGFnZSJ9.ldrvWTheNnGOa_rH_buA6OoUpLtW2bhcdr3fABrGHbk',
            'Source-Id': 'hxkline-NEWS_appNewsFlowHome_Page',
            Platform: 'hxkline',
            'X-Auth-Type': 'ths',
            'X-Auth-Version': '1.0',
            'X-Auth-ProgId': '7047',
            'X-Auth-AppName': 'AINVEST',
            Referer: 'https://www.10jqka.com.cn/',
            Origin: 'https://www.10jqka.com.cn',
          },
          body: JSON.stringify({
            code_list: [{ market: '16', codes: ['1A0001'] }],
            trade_class: 'intraday',
            data_fields: ['55', '6'],
            lang: 'zh_cn',
            gpid: 1,
          }),
        },
      );
      if (!res.ok) return fail(base, `HTTP ${res.status}`);
      const json = await res.json();
      if (json.status_code !== 0) return fail(base, json.status_msg || '接口异常', 'degraded');
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
