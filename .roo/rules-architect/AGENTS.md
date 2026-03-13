# Project Architect Rules (Non-Obvious Only)

- Treat EastMoney NAV access as shared-state: only queue-serialized entry points may touch global `window.apidata`.
- Preserve script lifecycle cleanup (DOM removal + `window.apidata` reset) as a reliability invariant.
- Keep refresh single-flight (`initPromise`, `refreshPromise`, `refreshWatchlistPromise`) to avoid StrictMode double-init and overlapping writes.
- Domain timeline is local-date driven (`YYYY-MM-DD`) for settlement and gain activation; avoid UTC-based trading decisions.
- Daily PnL semantics include the cost-effective-date gate (`effectivePctDate <= costDateStr => day gain 0`).
- Settlement is coupled to `refreshFundData`; adding detached background settlement workers risks divergence.
- Market session source-of-truth is Tencent index timestamp parsing; weekday+09:20 is fallback only on parse failure.
- Intraday estimate is holdings-driven (top-10 quotes) and only when official NAV is not today during trading.
- Welcome/version UX depends on build-injected commit env vars + `localStorage.lastSeenVersion`; malformed commit JSON is ignored.
- Runtime assumptions are non-default: base `/fund-manager/` and Danjuan dev proxy `/djapi` with forced `Referer`.
