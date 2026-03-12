# Project Coding Rules (Non-Obvious Only)
- EastMoney requests in [`services/api.ts`](services/api.ts:124) MUST go through the `eastMoneyQueue` to serialize script injection that writes to global `window.apidata`.
- Date strings for NAV/settlement should use local date formatting helpers (not `toISOString`) to avoid UTC day shifts ([`services/db.ts`](services/db.ts:60)).
- Keep the singleton `initPromise` guard in [`services/db.ts`](services/db.ts:37) to avoid React StrictMode double-init races.
- I18n is a custom dictionary; use `useTranslation().t("common.key")` paths from [`services/i18n.tsx`](services/i18n.tsx:1).