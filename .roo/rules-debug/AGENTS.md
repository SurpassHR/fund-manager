# Project Debug Rules (Non-Obvious Only)
- Market trading detection uses Tencent index timestamp and a 9:20 weekday fallback; if debugging stale data, verify the Tencent API response date first ([`services/api.ts`](services/api.ts:397)).
- EastMoney NAV/history and index history rely on script injection; failures often come from shared `window.apidata` state or callback cleanup, so inspect queue serialization and cleanup ([`services/api.ts`](services/api.ts:124)).
