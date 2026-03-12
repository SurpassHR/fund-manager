# Project Coding Rules (Non-Obvious Only)

- EastMoney fund NAV requests must go through the shared queue in `services/api.ts`; only `fetchEastMoneyLatestNav` and `fetchHistoricalFundNav` are queue-safe wrappers around global `window.apidata` script injection.
- For EastMoney script injection, always keep both cleanup actions in success/error paths: remove inserted `<script>` and reset `window.apidata`; otherwise stale payload contaminates later requests.
- Do not remove `initPromise`, `refreshPromise`, or `refreshWatchlistPromise` guards in `services/db.ts`; they prevent StrictMode double-init races and overlapping refresh writes.
- Trading/business dates in refresh and settlement logic must use local `YYYY-MM-DD` helpers, not UTC-derived `toISOString`, to avoid off-by-one-day decisions.
- Day gain is intentionally gated by cost-effective date (`effectivePctDate <= costDate` => force day gain to 0); preserve this rule even if quote data exists.
- Pending transactions are settled inside `refreshFundData` (same pipeline as quote refresh), not by independent background job.
- Intraday estimate is conditional: only when market is considered trading and official NAV is not today, estimate from top-10 holdings real-time quotes.
- `checkIsMarketTrading` must prioritize Tencent index timestamp parsing and only use weekday+09:20 fallback on API parse failure.
- I18n uses custom context in `services/i18n.tsx`; use `useTranslation().t("common.xxx")`. Missing keys intentionally return the original path string.
- Language defaults to `zh` on provider init and is not persisted in i18n provider state; don’t design features assuming language auto-restore.
