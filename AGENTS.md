# AGENTS.md

This file provides guidance to agents when working with code in this repository.

- Commands: only `npm run dev`, `npm run build`, `npm run preview`; no lint/test scripts (including single-test) exist in [`package.json`](package.json:1).
- Build embeds latest 5 git commit subjects into `import.meta.env.VITE_COMMITS_JSON`; if `GEMINI_API_KEY` is set it translates via Gemini, otherwise raw subjects are used ([`vite.config.ts`](vite.config.ts:7)).
- Dev server proxy `/djapi` is required for Danjuan requests and forces `Referer`; base path is `/fund-manager/` for GH Pages ([`vite.config.ts`](vite.config.ts:84)).
- EastMoney APIs rely on script injection writing to global `window.apidata`; requests MUST be serialized via the internal queue ([`services/api.ts`](services/api.ts:124)).
- Market trading detection uses Tencent index timestamp with a 9:20 weekday fallback; do not rely on system time alone ([`services/api.ts`](services/api.ts:397)).
- NAV/settlement date strings must use local date formatting helpers (avoid `toISOString` to prevent UTC shifts) ([`services/db.ts`](services/db.ts:60)).
- DB init uses a singleton promise to avoid React StrictMode double-invocation races; keep the guard if refactoring ([`services/db.ts`](services/db.ts:37)).
- I18n is a custom dictionary/context (default `zh`); use `useTranslation().t("common.key")` paths ([`services/i18n.tsx`](services/i18n.tsx:1)).
- Project-wide standards live in [`GEMINI.md`](GEMINI.md:1); treat as canonical unless a file-specific rule overrides it.
