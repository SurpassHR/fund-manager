const PROXY_PREFIX = '/llm-proxy';

type Env = {
  LLM_PROXY_ALLOWED_HOSTS?: string;
};

const getHeaderValue = (request: Request, name: string): string => {
  const value = request.headers.get(name);
  return typeof value === 'string' ? value.trim() : '';
};

const joinPath = (basePath: string, appendPath: string): string => {
  const normalizedBase = basePath.replace(/\/+$/, '');
  const normalizedAppend = appendPath.replace(/^\/+/, '');
  return `${normalizedBase}/${normalizedAppend}`.replace(/\/+/g, '/');
};

const resolveTargetUrl = (request: Request): URL | null => {
  const endpoint = getHeaderValue(request, 'X-LLM-Target-Endpoint');
  if (endpoint) {
    return new URL(endpoint);
  }

  const baseUrl = getHeaderValue(request, 'X-LLM-Target-Base-URL');
  if (!baseUrl) {
    return null;
  }

  const incomingUrl = new URL(request.url);
  const requestPath = incomingUrl.pathname.startsWith(PROXY_PREFIX)
    ? incomingUrl.pathname.slice(PROXY_PREFIX.length) || '/'
    : incomingUrl.pathname || '/';

  const targetUrl = new URL(baseUrl);
  targetUrl.pathname = joinPath(targetUrl.pathname, requestPath);
  targetUrl.search = incomingUrl.search;
  return targetUrl;
};

const isHostAllowed = (targetUrl: URL, env: Env): boolean => {
  const allowedHostsRaw = env.LLM_PROXY_ALLOWED_HOSTS?.trim() || '';
  if (!allowedHostsRaw) {
    return true;
  }
  const allowList = allowedHostsRaw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return allowList.includes(targetUrl.host.toLowerCase());
};

const buildForwardHeaders = (request: Request): Headers => {
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (
      lower === 'host' ||
      lower === 'content-length' ||
      lower === 'x-llm-target-endpoint' ||
      lower === 'x-llm-target-base-url'
    ) {
      return;
    }
    headers.set(key, value);
  });
  return headers;
};

const jsonError = (status: number, code: string, message: string): Response => {
  return new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const targetUrl = resolveTargetUrl(request);
      if (!targetUrl) {
        return jsonError(400, 'MISSING_LLM_PROXY_TARGET', '缺少上游目标地址请求头');
      }

      if (targetUrl.protocol !== 'https:') {
        return jsonError(403, 'LLM_PROXY_HTTPS_REQUIRED', '仅允许 https 上游地址');
      }

      if (!isHostAllowed(targetUrl, env)) {
        return jsonError(403, 'LLM_PROXY_HOST_NOT_ALLOWED', `上游主机未在允许列表: ${targetUrl.host}`);
      }

      const method = request.method.toUpperCase();
      const headers = buildForwardHeaders(request);
      const upstreamResponse = await fetch(targetUrl.toString(), {
        method,
        headers,
        body: method === 'GET' || method === 'HEAD' ? undefined : request.body,
        redirect: 'follow',
      });

      const responseHeaders = new Headers(upstreamResponse.headers);
      responseHeaders.set('Cache-Control', 'no-store');
      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        headers: responseHeaders,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown worker proxy error';
      return jsonError(502, 'LLM_PROXY_FAILED', message);
    }
  },
};
