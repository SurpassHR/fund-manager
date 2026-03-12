# AGENTS.md

This file provides guidance to agents when working with code in this repository.

- Commands: only `npm run dev`, `npm run build`, `npm run preview` exist; no lint/test scripts are defined in [`package.json`](package.json:1).
- Build step reads `GEMINI_API_KEY` to translate the latest 5 git commit subjects at build time and injects them into `import.meta.env.VITE_COMMITS_JSON`; without the key it falls back to raw subjects ([`vite.config.ts`](vite.config.ts:7)).
- Dev server proxies `/djapi` to `https://danjuanfunds.com` and forces `Referer` header; base path is `/fund-manager/` for GH Pages ([`vite.config.ts`](vite.config.ts:84)).
- EastMoney endpoints rely on script injection that writes to global `window.apidata`; requests MUST be serialized via the internal queue to avoid data races ([`services/api.ts`](services/api.ts:124)).
- Market trading detection uses Tencent index timestamp and a 9:20 weekday fallback; do not rely on system time alone ([`services/api.ts`](services/api.ts:397)).
- Date logic for NAV/settlement uses local date strings (not `toISOString`) to avoid UTC shifts ([`services/db.ts`](services/db.ts:60)).
- DB init is guarded by a singleton promise to survive React StrictMode double-invocation; keep this pattern if refactoring ([`services/db.ts`](services/db.ts:37)).
- I18n is a custom dictionary/context with default language `zh`; use `useTranslation().t("common.key")` paths from [`services/i18n.tsx`](services/i18n.tsx:1).
- Project-wide standards are documented in [`GEMINI.md`](GEMINI.md:1); treat them as the canonical style guide unless a file-specific rule says otherwise.