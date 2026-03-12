# AGENTS.md

This file provides guidance to agents when working with code in this repository.

- Only `fetchEastMoneyLatestNav` and `fetchHistoricalFundNav` are safe EastMoney fund-NAV entry points; both must stay serialized through the shared `eastMoneyQueue` because they read/write the same global `window.apidata`.
- EastMoney script-injection flow depends on strict cleanup (`removeChild` + `window.apidata = undefined`) after both success and error; missing cleanup leaks stale payload into subsequent requests.
- Watchlist and holding refreshes are concurrency-guarded (`refreshPromise`, `refreshWatchlistPromise`); removing these guards causes overlapping writes and inconsistent day-change fields.
- DB init must keep the singleton `initPromise` guard to survive React StrictMode double invocation without duplicate default-account inserts.
- Business dates for NAV/settlement logic must use local date strings (`YYYY-MM-DD`) from local helpers; avoid introducing UTC-based `toISOString` into trading-date decisions.
- Daily gain activation is intentionally gated by cost-effective date: if `effectivePctDate <= costDate`, day gain is forced to 0 even when a quote exists.
- Settlement application is coupled to refresh: pending transactions are auto-settled during `refreshFundData`, not by a separate scheduler.
- Trading-session detection is data-driven: `checkIsMarketTrading` trusts Tencent index timestamp first, then falls back to local weekday + 09:20 only when API parsing fails.
- Fund intraday estimate path is conditional: when official NAV date is not today but market is trading, system estimates day change from top-10 holdings quotes.
- I18n is custom context (not i18next): translations must use `useTranslation().t("common.xxx")`; missing keys return the path string itself.
- Language default is hardcoded to `zh` in provider and is not persisted; do not assume automatic language restore.
- Build injects latest 5 git commits into `import.meta.env.VITE_COMMITS_JSON`; if `GEMINI_API_KEY` exists, subjects are translated during build-time network call.
- Welcome modal versioning is coupled to injected env vars and `localStorage.lastSeenVersion`; malformed commit JSON is silently ignored.
- Vite runtime assumptions are non-default: app base is `/fund-manager/`, and Danjuan requests require dev proxy `/djapi` with forced `Referer`.
- Available scripts are intentionally minimal (`dev`/`build`/`preview` only); there is no lint script, no test script, and no single-test entrypoint.
