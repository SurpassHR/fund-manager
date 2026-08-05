/**
 * Cloudflare Worker — API 网关
 *
 * 为 fund-manager 前端提供跨域 API 代理，解决 CORS 问题。
 *
 * 路由：
 *   POST /api-gateway/fetch   body: { url, options? }  → 通用代理（fetch + CORS）
 *   GET/POST /api-gateway/morningstar/*                 → 代理到 www.morningstar.cn
 *   GET/POST /api-gateway/em-f10                        → 代理到 fundf10.eastmoney.com
 *   GET/POST /api-gateway/em-pingzhong/*                → 代理到 fund.eastmoney.com
 */

interface Env {
  // 无需绑定 KV 或 secret，纯代理
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Referer, Origin',
  'Access-Control-Max-Age': '86400',
};

const ROUTE_PREFIX = '/api-gateway';

// 上游目标映射
const UPSTREAM: Record<string, string> = {
  '/morningstar': 'https://www.morningstar.cn',
  '/em-f10': 'https://fundf10.eastmoney.com',
  '/em-pingzhong': 'https://fund.eastmoney.com/pingzhongdata',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });

const textResponse = (body: string, status = 200, contentType = 'text/plain; charset=utf-8') =>
  new Response(body, {
    status,
    headers: { 'Content-Type': contentType, ...CORS_HEADERS },
  });

/**
 * 通用 proxy fetch — 前端通过 POST /fetch 发送 { url, options? } 
 * 由 Worker 在后端发起 fetch，返回结果 + CORS 头
 */
async function handleProxyFetch(request: Request): Promise<Response> {
  let body: { url?: string; options?: Record<string, unknown> };
  try {
    body = (await request.json()) as { url?: string; options?: Record<string, unknown> };
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  const { url, options = {} } = body;
  if (!url || typeof url !== 'string') {
    return json({ error: 'missing or invalid url' }, 400);
  }

  try {
    // 构造上游请求
    const upstreamRequest = new Request(url, {
      method: options.method as string || 'GET',
      headers: {
        ...(options.headers as Record<string, string> || {}),
        'User-Agent': 'Mozilla/5.0 (compatible; FundManager/1.0)',
      },
      body: options.body as BodyInit | undefined,
    });

    const upstreamResponse = await fetch(upstreamRequest);
    const contentType = upstreamResponse.headers.get('Content-Type') || 'text/plain';
    const text = await upstreamResponse.text();

    return textResponse(text, upstreamResponse.status, contentType);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown proxy error';
    return json({ error: 'PROXY_FAILED', message }, 502);
  }
}

/**
 * 路径前缀匹配代理 — 将 /api-gateway/{target}/xxx 代理到上游
 */
async function handleRouteProxy(path: string, request: Request): Promise<Response> {
  // 匹配路由前缀
  const matchedPrefix = Object.keys(UPSTREAM).find((prefix) =>
    path.startsWith(prefix + '/') || path === prefix,
  );

  if (!matchedPrefix) {
    return new Response('Not Found', { status: 404, headers: CORS_HEADERS });
  }

  const upstreamBase = UPSTREAM[matchedPrefix];
  let upstreamUrl: string;

  if (matchedPrefix === '/em-f10') {
    // 特殊处理：query string 透传
    const url = new URL(request.url);
    upstreamUrl = `${upstreamBase}/F10DataApi.aspx${url.search}`;
  } else if (matchedPrefix === '/em-pingzhong') {
    // /api-gateway/em-pingzhong/{fundCode}.js?v=xxx → https://fund.eastmoney.com/pingzhongdata/{fundCode}.js?v=xxx
    const suffix = path.slice(matchedPrefix.length); // e.g. /012620.js?v=xxx
    const url = new URL(request.url);
    upstreamUrl = `${upstreamBase}${suffix}${url.search}`;
  } else {
    // /api-gateway/morningstar/v2/funds/xxx/holdings → https://www.morningstar.cn/v2/funds/xxx/holdings
    const suffix = path.slice(matchedPrefix.length);
    upstreamUrl = `${upstreamBase}${suffix}`;
  }

  try {
    const upstreamRequest = new Request(upstreamUrl, {
      method: request.method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FundManager/1.0)',
        Referer: 'https://www.morningstar.cn/',
        Accept: request.headers.get('Accept') || '*/*',
      },
    });

    const upstreamResponse = await fetch(upstreamRequest);
    const contentType = upstreamResponse.headers.get('Content-Type') || 'text/plain';
    const text = await upstreamResponse.text();

    return textResponse(text, upstreamResponse.status, contentType);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown proxy error';
    return json({ error: 'UPSTREAM_FAILED', message }, 502);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // 提取 /api-gateway 后的路径
    const path = url.pathname.startsWith(ROUTE_PREFIX)
      ? url.pathname.slice(ROUTE_PREFIX.length) || '/'
      : url.pathname;

    // 通用 proxy fetch
    if (path === '/fetch' && request.method === 'POST') {
      return handleProxyFetch(request);
    }

    // 路由代理
    return handleRouteProxy(path, request);
  },
};