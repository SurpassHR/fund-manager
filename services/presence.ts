/**
 * Client-side presence tracker.
 *
 * Sends heartbeats to the Cloudflare Worker every 30s
 * and exposes reactive stats (current / peak / unique).
 */

const HEARTBEAT_INTERVAL_MS = 30_000;

// Worker URL — set via env or fallback.
// In production, replace with your deployed worker URL.
const WORKER_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PRESENCE_WORKER_URL) || '';

/** Generate a random session ID (per tab). */
const generateSid = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Get or create a persistent unique visitor ID (across sessions). */
const getOrCreateUid = (): string => {
  const KEY = 'fm_visitor_uid';
  let uid = localStorage.getItem(KEY);
  if (!uid) {
    uid = crypto.randomUUID?.() ?? generateSid();
    localStorage.setItem(KEY, uid);
  }
  return uid;
};

export interface PresenceStats {
  current: number;
  peak: number;
  unique: number;
}

type Listener = (stats: PresenceStats) => void;

let sid: string | null = null;
let uid: string | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let latestStats: PresenceStats = { current: 0, peak: 0, unique: 0 };
const listeners = new Set<Listener>();

const notify = () => {
  listeners.forEach((fn) => fn(latestStats));
};

const sendHeartbeat = async (): Promise<void> => {
  if (!WORKER_URL) return;
  try {
    const res = await fetch(`${WORKER_URL}/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sid, uid }),
    });
    if (res.ok) {
      latestStats = (await res.json()) as PresenceStats;
      notify();
    }
  } catch {
    // Network error — silently ignore, will retry next interval.
  }
};

const sendDisconnect = (): void => {
  if (!WORKER_URL || !sid) return;
  // Use sendBeacon for reliability during page unload
  const payload = JSON.stringify({ sid });
  if (navigator.sendBeacon) {
    navigator.sendBeacon(
      `${WORKER_URL}/session`,
      new Blob([payload], { type: 'application/json' }),
    );
  }
};

/** Fetch stats without side-effects (read-only). */
export const fetchPresenceStats = async (): Promise<PresenceStats | null> => {
  if (!WORKER_URL) return null;
  try {
    const res = await fetch(`${WORKER_URL}/stats`);
    if (res.ok) {
      const stats = (await res.json()) as PresenceStats;
      latestStats = stats;
      notify();
      return stats;
    }
  } catch {
    // ignore
  }
  return null;
};

/** Start heartbeat loop. Idempotent — calling multiple times is safe. */
export const startPresence = (): void => {
  if (timer) return;
  if (!WORKER_URL) return;

  sid = generateSid();
  uid = getOrCreateUid();

  // Initial heartbeat immediately
  void sendHeartbeat();

  timer = setInterval(() => {
    void sendHeartbeat();
  }, HEARTBEAT_INTERVAL_MS);

  // Clean up on page unload
  window.addEventListener('beforeunload', sendDisconnect);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      sendDisconnect();
    } else if (document.visibilityState === 'visible' && sid) {
      void sendHeartbeat();
    }
  });
};

/** Subscribe to stats changes. Returns an unsubscribe function. */
export const subscribePresence = (fn: Listener): (() => void) => {
  listeners.add(fn);
  // Deliver current value immediately
  fn(latestStats);
  return () => listeners.delete(fn);
};

/** Get the latest cached stats (synchronous). */
export const getPresenceStats = (): PresenceStats => latestStats;

/** Check if presence tracking is configured (worker URL is set). */
export const isPresenceEnabled = (): boolean => !!WORKER_URL;
