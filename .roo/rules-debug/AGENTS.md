# Project Debug Rules (Non-Obvious Only)

- EastMoney NAV/history issues: first check queue serialization and script cleanup (`removeChild` + `window.apidata = undefined`); concurrent injections or missing cleanup contaminate later requests.
- Today gain anomalies: verify `effectivePctDate` vs cost date gate (`effectivePctDate <= costDateStr` => day gain forced to 0).
- Market-open detection: `checkIsMarketTrading` should parse Tencent index timestamp; weekday+09:20 is fallback on API parse failure.
- Stale/duplicated refresh: confirm `initPromise`, `refreshPromise`, `refreshWatchlistPromise` guards aren't bypassed.
- Settlement issues: pending transactions settle inside `refreshFundData`, not a separate scheduler.
