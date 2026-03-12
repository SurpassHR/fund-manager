# Project Debug Rules (Non-Obvious Only)

- If EastMoney fund NAV/history intermittently returns wrong rows or empty data, inspect queue serialization first: concurrent script injection corrupts shared `window.apidata` state.
- In EastMoney failure paths, verify both cleanup steps executed (`removeChild(script)` and `window.apidata = undefined`); missing either often causes next request contamination rather than immediate crash.
- For "today gain" anomalies, check `effectivePctDate` vs computed cost date first; rule intentionally zeroes day gain when `effectivePctDate <= costDate`.
- Debug market-open behavior via Tencent quote field parsing in `checkIsMarketTrading`; weekday+09:20 logic is fallback only when API parse fails.
- For stale/duplicated refresh symptoms, confirm `refreshPromise` and `refreshWatchlistPromise` are intact and not bypassed by parallel callers.
- Pending buy/sell state transitions are applied only in `refreshFundData`; if settlement appears stuck, debug refresh pipeline execution instead of searching for an external scheduler.
