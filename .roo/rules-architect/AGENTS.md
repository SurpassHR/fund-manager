# Project Architect Rules (Non-Obvious Only)

- Treat EastMoney NAV access as a shared-state subsystem: both latest and historical fund NAV calls must stay serialized through one queue due to single global `window.apidata` channel.
- Preserve strict script-lifecycle cleanup contracts in EastMoney flows (DOM script removal + global reset) as a core reliability invariant, not an implementation detail.
- Keep refresh architecture single-flight (`initPromise`, `refreshPromise`, `refreshWatchlistPromise`) to prevent StrictMode double-init duplication and overlapping writes.
- Domain timeline model is local-date driven (`YYYY-MM-DD`) for settlement and gain activation; avoid redesigns that pivot trading decisions to UTC timestamps.
- Daily PnL semantics include an explicit activation gate by cost-effective date; architecture changes must retain `effectivePctDate <= costDate => day gain 0` behavior.
- Settlement is coupled to refresh cycle by design; introducing detached background settlement workers risks divergence from NAV snapshot timing.
- Market session source-of-truth is Tencent index timestamp parsing, with weekday+09:20 fallback only on parse/API failure.
- Watchlist/fund intraday estimation path is conditional and holdings-driven (top-10 weighted quotes), only when official NAV is not yet for today during trading.
- Versioned welcome UX depends on build-injected commit env vars and `localStorage.lastSeenVersion`; malformed commit JSON is intentionally ignored.
- Tooling assumptions are non-default: base path `/fund-manager/`, Danjuan dev proxy `/djapi` + forced `Referer`, and scripts limited to `dev`/`build`/`preview` without lint/test entries.
