import path from 'path';
import { execSync } from 'child_process';
import { defineConfig, loadEnv, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const readRequestBody = async (request: NodeJS.ReadableStream) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

const resolveProxyTargetUrl = (
  requestUrl: string | undefined,
  headers: NodeJS.Dict<string | string[] | undefined>,
) => {
  const targetEndpointHeader = headers['x-llm-target-endpoint'];
  const targetBaseUrlHeader = headers['x-llm-target-base-url'];
  const targetEndpoint = Array.isArray(targetEndpointHeader)
    ? targetEndpointHeader[0]
    : targetEndpointHeader;
  const targetBaseUrl = Array.isArray(targetBaseUrlHeader)
    ? targetBaseUrlHeader[0]
    : targetBaseUrlHeader;

  if (targetEndpoint) {
    return new URL(targetEndpoint).toString();
  }

  if (!targetBaseUrl) {
    return '';
  }

  const [rawPath, rawQuery] = (requestUrl || '/').split('?');
  const base = new URL(targetBaseUrl);
  const basePath = base.pathname.replace(/\/+$/, '');
  const requestPath = (rawPath || '/').replace(/^\/+/, '');
  base.pathname = `${basePath}/${requestPath}`.replace(/\/+/g, '/');
  base.search = rawQuery ? `?${rawQuery}` : '';
  return base.toString();
};

const createLlmProxyPlugin = () => ({
  name: 'llm-proxy-dev-middleware',
  configureServer(server: ViteDevServer) {
    server.middlewares.use('/llm-proxy', async (req, res) => {
      try {
        const targetUrl = resolveProxyTargetUrl(req.url, req.headers);
        if (!targetUrl) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: 'MISSING_LLM_PROXY_TARGET' }));
          return;
        }

        const method = req.method || 'GET';
        const upstreamHeaders = new Headers();
        Object.entries(req.headers).forEach(([key, value]) => {
          if (!value) return;
          const lower = key.toLowerCase();
          if (
            lower === 'host' ||
            lower === 'content-length' ||
            lower === 'x-llm-target-base-url' ||
            lower === 'x-llm-target-endpoint'
          ) {
            return;
          }
          if (Array.isArray(value)) {
            value.forEach((item) => upstreamHeaders.append(key, item));
            return;
          }
          upstreamHeaders.set(key, value);
        });

        const body = method === 'GET' || method === 'HEAD' ? undefined : await readRequestBody(req);
        const upstreamResponse = await fetch(targetUrl, {
          method,
          headers: upstreamHeaders,
          body,
        });

        res.statusCode = upstreamResponse.status;
        upstreamResponse.headers.forEach((value, key) => {
          if (key.toLowerCase() === 'content-encoding') return;
          res.setHeader(key, value);
        });
        const buffer = Buffer.from(await upstreamResponse.arrayBuffer());
        res.end(buffer);
      } catch (error) {
        res.statusCode = 502;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(
          JSON.stringify({
            error: 'LLM_PROXY_FAILED',
            message: error instanceof Error ? error.message : 'Unknown proxy error',
          }),
        );
      }
    });
  },
});

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const MAX_COMMITS = 5;
  const resolvedBase = env.VITE_BASE_PATH?.trim() || '/';

  // Fetch the latest 5 git commits
  // Format: hash\x1fsubject\x1fbody\x1e (record separator between commits, unit separator between fields)
  interface CommitInfo {
    hash: string;
    subject: string;
    body: string;
    subjectZh?: string;
    subjectEn?: string;
  }

  interface CommitTranslation {
    hash: string;
    zh: string;
    en: string;
  }

  let commits: CommitInfo[] = [];

  const safeParseJson = (raw: string): unknown => {
    const direct = raw.trim();
    try {
      return JSON.parse(direct);
    } catch {
      // continue to extract JSON fragment
    }

    const firstBracket = direct.indexOf('[');
    const lastBracket = direct.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      const fragment = direct.slice(firstBracket, lastBracket + 1);
      try {
        return JSON.parse(fragment);
      } catch {
        // ignore
      }
    }

    const firstBrace = direct.indexOf('{');
    const lastBrace = direct.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const fragment = direct.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(fragment);
      } catch {
        // ignore
      }
    }

    return null;
  };

  const normalizeTranslations = (payload: unknown): CommitTranslation[] => {
    const candidates = Array.isArray(payload)
      ? payload
      : payload &&
          typeof payload === 'object' &&
          'items' in payload &&
          Array.isArray((payload as { items: unknown[] }).items)
        ? (payload as { items: unknown[] }).items
        : [];

    return candidates
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const obj = item as Record<string, unknown>;
        const hash = typeof obj.hash === 'string' ? obj.hash.trim() : '';
        const zh = typeof obj.zh === 'string' ? obj.zh.trim() : '';
        const en = typeof obj.en === 'string' ? obj.en.trim() : '';
        if (!hash || !zh || !en) return null;
        return { hash, zh, en };
      })
      .filter((item): item is CommitTranslation => item !== null);
  };

  try {
    const gitLog = execSync(
      `git log -${MAX_COMMITS} --pretty=format:"%h%x1f%s%x1f%b%x1e"`,
    ).toString();
    const records = gitLog.split('\x1e').filter((r) => r.trim());
    commits = records.map((record) => {
      const parts = record.trim().split('\x1f');
      return {
        hash: parts[0] || '',
        subject: parts[1] || '',
        body: (parts[2] || '').trim(),
      };
    });
  } catch (error) {
    console.warn('Failed to fetch git commit info:', error);
  }

  // Translate all subjects at once via Gemini
  if (env.GEMINI_API_KEY && commits.length > 0) {
    console.log('Gemini API key found, translating commit subjects...');
    try {
      const subjects = commits
        .map((c) => `{"hash":"${c.hash}","subject":"${c.subject}"}`)
        .join('\n');
      const prompt = `Translate each git commit subject into both Simplified Chinese and English.
Input lines are JSON objects with keys "hash" and "subject".
Return ONLY a valid JSON array of objects, each with keys "hash", "zh", and "en".
The output hash must match the input hash exactly.
Do not include markdown blocks or any other text.

Subjects:
${subjects}`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json',
            },
          }),
        },
      );

      if (response.ok) {
        const data = await response.json();
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textResponse) {
          const parsed = safeParseJson(textResponse);
          const translations = normalizeTranslations(parsed);
          if (translations.length > 0) {
            const byHash = new Map(translations.map((item) => [item.hash, item]));
            commits = commits.map((commit) => {
              const matched = byHash.get(commit.hash);
              if (!matched) return commit;
              return {
                ...commit,
                subjectZh: matched.zh,
                subjectEn: matched.en,
              };
            });
          }
          console.log('Commit subjects successfully translated.');
        }
      } else {
        console.warn('Gemini API request failed:', response.statusText);
      }
    } catch (e) {
      console.warn('Failed to translate via Gemini:', e);
    }
  }

  // Serialize commits as JSON for injection
  const commitsJson = JSON.stringify(
    commits.slice(0, MAX_COMMITS).map((c) => ({
      hash: c.hash,
      subjectZh: c.subjectZh || c.subject,
      subjectEn: c.subjectEn || c.subject,
    })),
  );

  return {
    base: resolvedBase,
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/djapi': {
          target: 'https://danjuanfunds.com',
          changeOrigin: true,
          headers: {
            Referer: 'https://danjuanfunds.com/',
          },
        },
      },
    },
    plugins: [react(), tailwindcss(), createLlmProxyPlugin()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'import.meta.env.VITE_LATEST_COMMIT_HASH': JSON.stringify(commits[0]?.hash || 'unknown'),
      'import.meta.env.VITE_COMMITS_JSON': JSON.stringify(commitsJson),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
