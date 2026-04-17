/**
 * Cloudflare Worker — Presence Tracker
 *
 * KV namespace binding: PRESENCE
 *
 * Keys:
 *   sessions  → JSON { [sessionId]: lastSeenMs }
 *   peak      → number (max concurrent ever)
 *   unique    → JSON string[] (all unique visitor IDs)
 *
 * Endpoints:
 *   POST /heartbeat  body: { sid, uid }  → updates session, returns stats
 *   GET  /stats                          → returns stats without side-effects
 *   DELETE /session   body: { sid }      → explicit disconnect
 */

interface Env {
  PRESENCE: KVNamespace;
}

interface Sessions {
  [id: string]: number;
}

interface Stats {
  current: number;
  peak: number;
  unique: number;
}

const STALE_MS = 90_000; // 90s without heartbeat = offline

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });

async function getSessions(kv: KVNamespace): Promise<Sessions> {
  const raw = await kv.get('sessions');
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Sessions;
  } catch {
    return {};
  }
}

function pruneStale(sessions: Sessions, now: number): Sessions {
  const live: Sessions = {};
  for (const [id, ts] of Object.entries(sessions)) {
    if (now - ts < STALE_MS) {
      live[id] = ts;
    }
  }
  return live;
}

async function buildStats(kv: KVNamespace, sessions: Sessions): Promise<Stats> {
  const current = Object.keys(sessions).length;
  const peak = parseInt((await kv.get('peak')) || '0', 10);
  let uniqueCount = 0;
  try {
    const raw = await kv.get('unique');
    uniqueCount = raw ? (JSON.parse(raw) as string[]).length : 0;
  } catch {
    uniqueCount = 0;
  }
  return { current, peak, unique: uniqueCount };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const kv = env.PRESENCE;

    // Strip route prefix — wrangler routes deliver /presence/* paths
    const ROUTE_PREFIX = '/presence';
    const path = url.pathname.startsWith(ROUTE_PREFIX)
      ? url.pathname.slice(ROUTE_PREFIX.length) || '/'
      : url.pathname;

    // GET /stats — read-only
    if (path === '/stats' && request.method === 'GET') {
      const now = Date.now();
      const sessions = pruneStale(await getSessions(kv), now);
      await kv.put('sessions', JSON.stringify(sessions));
      return json(await buildStats(kv, sessions));
    }

    // POST /heartbeat — upsert session
    if (path === '/heartbeat' && request.method === 'POST') {
      let body: { sid?: string; uid?: string };
      try {
        body = (await request.json()) as { sid?: string; uid?: string };
      } catch {
        return json({ error: 'invalid JSON' }, 400);
      }

      const { sid, uid } = body;
      if (!sid) return json({ error: 'missing sid' }, 400);

      const now = Date.now();
      const sessions = pruneStale(await getSessions(kv), now);
      sessions[sid] = now;
      await kv.put('sessions', JSON.stringify(sessions));

      // Update peak
      const current = Object.keys(sessions).length;
      const prevPeak = parseInt((await kv.get('peak')) || '0', 10);
      if (current > prevPeak) {
        await kv.put('peak', String(current));
      }

      // Track unique visitors
      if (uid) {
        const uniqueRaw = await kv.get('unique');
        let uniqueSet: Set<string>;
        try {
          uniqueSet = new Set(uniqueRaw ? (JSON.parse(uniqueRaw) as string[]) : []);
        } catch {
          uniqueSet = new Set();
        }
        if (!uniqueSet.has(uid)) {
          uniqueSet.add(uid);
          await kv.put('unique', JSON.stringify([...uniqueSet]));
        }
      }

      return json(await buildStats(kv, sessions));
    }

    // DELETE /session — explicit disconnect
    if (path === '/session' && request.method === 'DELETE') {
      let body: { sid?: string };
      try {
        body = (await request.json()) as { sid?: string };
      } catch {
        return json({ error: 'invalid JSON' }, 400);
      }

      if (body.sid) {
        const now = Date.now();
        const sessions = pruneStale(await getSessions(kv), now);
        delete sessions[body.sid];
        await kv.put('sessions', JSON.stringify(sessions));
      }

      return json({ ok: true });
    }

    return new Response('Not Found', { status: 404, headers: CORS_HEADERS });
  },
};
