# Project Context

## Environment

- Language: TypeScript
- Framework: React 19 + Vite 6
- Runtime: Browser (ESM)
- Package Manager: npm
- Build: `npm run build` (`tsc && vite build`)
- Test: `npm run test` (Vitest + jsdom)
- Lint: `npm run lint` (ESLint 9)

## Project Type

- [x] Application (Web)
- [ ] Library/Package
- [ ] Microservice
- [ ] Monorepo

## Infrastructure

- Container: None detected
- Orchestration: None detected
- CI/CD: `.github/workflows/` exists (per repo docs)
- Cloud/IaC: None detected

## Structure

- Entry: `index.tsx` -> `App.tsx`
- UI: `components/*.tsx`
- Services: `services/*.ts*`
- Shared types: `types.ts`
- Styling: `app.css` + Tailwind classes
- Tests: colocated `*.test.ts` / `*.test.tsx`
- Shared app settings storage: `services/SettingsContext.tsx` (localStorage)

## Relevant Existing Areas For This Feature

- Settings UI: `components/SettingsPage.tsx`
- Settings persistence: `services/SettingsContext.tsx`
- Data import/export baseline: `services/db.ts` (`exportFunds`, `importFunds`)
- I18n dictionary: `services/i18n.tsx`
- Animated UI conventions: multiple components use `framer-motion`

## Observed Conventions

- Function components + hooks
- LocalStorage persistence inside context update function
- Graceful network failures with user-facing fallback text
- TypeScript types are explicit for service interfaces

## Notes

- No existing gist sync workflow currently detected.
- `.opencode/todo.md` existed but was placeholder-only.
