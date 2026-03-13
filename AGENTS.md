# AGENTS.md

This file provides guidance to agents when working with code in this repository.

- EastMoney NAV access must be serialized through the shared queue in `services/api.ts`; only `fetchEastMoneyLatestNav` and `fetchHistoricalFundNav` are safe entry points because they read/write global `window.apidata` via script injection.
- EastMoney script-injection flow must always remove the injected `<script>` and reset `window.apidata` on both success and error, or stale payload will contaminate later requests.
- Keep `initPromise`, `refreshPromise`, and `refreshWatchlistPromise` guards in `services/db.ts` to avoid StrictMode double-init and overlapping refresh writes.
- Trading/settlement dates must use local `YYYY-MM-DD` helpers (for example `getLocalDateString`/`getCostDateStr`) instead of UTC `toISOString` to prevent day-boundary errors.
- Day gain is intentionally gated: if `effectivePctDate <= costDateStr`, `dayChangePct`/`dayChangeVal` must be forced to 0 even if quote data exists.
- Pending transactions are settled inside `refreshFundData`; there is no separate background settlement worker.
- Intraday estimate only runs when market is trading and official NAV is not today, using top-10 holdings real-time quotes.
- `checkIsMarketTrading` must prefer Tencent index timestamp parsing and only fall back to weekday+09:20 if API parsing fails.
- I18n is custom in `services/i18n.tsx`: use `useTranslation().t("common.xxx")`; missing keys return the path, and language defaults to `zh` without provider persistence.
- Vite config injects latest 5 commits into `import.meta.env.VITE_COMMITS_JSON` (optionally Gemini-translated when `GEMINI_API_KEY` exists); `WelcomeModal` uses `VITE_LATEST_COMMIT_HASH` + `localStorage.lastSeenVersion` and ignores malformed commit JSON.
- Vite runtime assumptions are non-default: base is `/fund-manager/` and Danjuan requests rely on dev proxy `/djapi` with forced `Referer`.
