# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Rule Sources

- Cursor rules: none found in `.cursor/rules/` or `.cursorrules`.
- Copilot rules: none found in `.github/copilot-instructions.md`.

## Repo Layout (Observed)

- Entry point: `index.tsx` mounts `App.tsx` and throws on missing `#root`.
- UI: `components/` for React components and modals.
- Services/data: `services/` for API, DB, i18n, settings, theme, etc.
- Shared types: `types.ts` (reused throughout services and components).
- Styling: `app.css` plus Tailwind utility classes.
- Tests: `setupTests.ts` and optional `test/` fixtures.
- Vite env types: `src/vite-env.d.ts` (only file in `src/`).

## Build, Lint, Test

- Install: `npm install`
- Dev server: `npm run dev` (Vite, default http://localhost:3000)
- Build: `npm run build` (runs `tsc` then `vite build`)
- Preview build: `npm run preview`
- Lint all: `npm run lint`
- Lint + fix: `npm run lint:fix`
- Lint single file: `npm run lint -- components/Dashboard.tsx`
- Test all (CI): `npm run test`
- Test watch (dev): `npm run test:watch`
- Test UI: `npm run test:ui`
- Single test file: `npm run test -- components/Watchlist.test.tsx`
- Single test by name: `npm run test -- -t "renders watchlist"`

Notes:

- Tests use Vitest + React Testing Library + jsdom.
- Setup file is `setupTests.ts` and it loads `@testing-library/jest-dom`.
- Test typings are isolated in `tsconfig.test.json`.
- Add tests as `*.test.ts`/`*.test.tsx` near source files or in `__tests__/`.

## Tooling + Configs

- ESLint config: `eslint.config.js` with React/TS rules and hooks checks.
- Prettier config: `prettier.config.cjs` (single quotes, semicolons, 100-width).
- TS config: `tsconfig.json` with ES2022 target and `@/*` alias to repo root.
- Vitest config: `vitest.config.ts` (jsdom, globals, setup file).
- Vite config: `vite.config.ts` (GitHub Pages base, commit injection, dev proxy).

ESLint highlights:

- `@typescript-eslint/no-unused-vars` warns; ignore args with `_` prefix.
- `@typescript-eslint/consistent-type-imports` warns; prefer `import type`.
- `react-refresh/only-export-components` warns; allow constant exports only.

TypeScript config notes:

- `moduleResolution` is `bundler` and `module` is `ESNext`.
- `allowImportingTsExtensions` is enabled; prefer existing patterns in a file.
- `noEmit` is true; builds rely on Vite/tsc for type checks.

## Code Style (Observed + Expected)

- Language: TypeScript + React 19, ES modules.
- Components are function components using hooks; keep them pure and declarative.
- Use `React.FC` only if it matches existing patterns in the file.
- Prefer `const` over `let` unless reassigned; use explicit `return` in early exits.
- Keep async flows readable; prefer `async/await` with `try/catch` and clear fallbacks.
- Avoid deep nested ternaries in JSX; use helpers or early returns.
- Use Tailwind utilities consistently; keep class lists readable and wrapped.

Formatting (Prettier enforced):

- Single quotes, semicolons, trailing commas.
- 2-space indentation.
- Prefer 100-character line width; wrap JSX props if needed.
- Keep JSX attributes aligned and readable.

Imports:

- Group order: React/builtins, third-party, internal absolute (`@/`), then relative.
- Use relative paths for local siblings as seen in existing files.
- Keep named imports sorted logically (not necessarily alphabetically).
- Use type-only imports; ESLint warns on mixed value/type imports.

Types:

- Keep shared types in `types.ts` and reuse them instead of inline `any`.
- If `any` is needed (3rd-party responses), confine it to parsing boundaries.
- Prefer explicit return types on exported async helpers for clarity.

Naming:

- Components: PascalCase, same as filename.
- Hooks: `useXxx`.
- Types/interfaces: PascalCase.
- Constants: UPPER_SNAKE_CASE only for true constants (API base URLs, etc.).
- Local variables: camelCase.

Error handling:

- API helpers return `null`/`[]` on failure and log with context.
- Re-throw only when the caller must handle a fallback (`fetchRealTimeQuotes`).
- Avoid user-visible errors for background refresh; use graceful degradation.
- Throw early for invalid app state (e.g. missing root element).

State + storage:

- IndexedDB is managed via Dexie in `services/db.ts`.
- Use existing `initPromise`/`refreshPromise` guards for concurrency safety.
- Prefer session/local storage patterns already used in components.

## Testing Guidance

- Use Vitest globals (`describe`, `it`, `expect`, `vi`) as configured in ESLint.
- Add tests near the component/service they cover.
- Prefer RTL queries via `screen` and semantic selectors.
- Keep tests deterministic; avoid relying on real network calls.

## I18n

- Use `useTranslation().t("common.xxx")` from `services/i18n.tsx`.
- Missing keys return the path; language defaults to `zh` with no persistence.

## Domain Rules (Critical)

- EastMoney NAV access must be serialized through the shared queue in `services/api.ts`; only `fetchEastMoneyLatestNav` and `fetchHistoricalFundNav` are safe entry points because they read/write global `window.apidata` via script injection.
- EastMoney script-injection flow must always remove the injected `<script>` and reset `window.apidata` on both success and error, or stale payload will contaminate later requests.
- Keep `initPromise`, `refreshPromise`, and `refreshWatchlistPromise` guards in `services/db.ts` to avoid StrictMode double-init and overlapping refresh writes.
- Trading/settlement dates must use local `YYYY-MM-DD` helpers (for example `getLocalDateString`/`getCostDateStr`) instead of UTC `toISOString` to prevent day-boundary errors.
- Day gain is intentionally gated: if `effectivePctDate <= costDateStr`, `dayChangePct`/`dayChangeVal` must be forced to 0 even if quote data exists.
- Pending transactions are settled inside `refreshFundData`; there is no separate background settlement worker.
- Intraday estimate only runs when market is trading and official NAV is not today, using top-10 holdings real-time quotes.
- `checkIsMarketTrading` must prefer Tencent index timestamp parsing and only fall back to weekday+09:20 if API parsing fails.

## Vite/Runtime Assumptions

- Vite base is `/fund-manager/` for GitHub Pages.
- Danjuan requests rely on dev proxy `/djapi` with forced `Referer` header.
- Vite config injects latest 5 commits into `import.meta.env.VITE_COMMITS_JSON`.
- Optional Gemini translation happens when `GEMINI_API_KEY` exists.
- `WelcomeModal` uses `VITE_LATEST_COMMIT_HASH` + `localStorage.lastSeenVersion` and ignores malformed commit JSON.

## Data + Date Handling

- Always prefer local-date helpers for trading/settlement logic.
- Do not use UTC conversions that can shift dates across boundaries.
- Day gain is driven by `effectivePctDate` and is zeroed pre-cost date.
- Pending transactions settle during `refreshFundData` refresh only.
