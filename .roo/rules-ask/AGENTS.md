# Project Ask Rules (Non-Obvious Only)

- Explain EastMoney integration as queue-serialized script injection around global `window.apidata`; emphasize it is intentionally not a normal `fetch` API flow.
- When documenting date behavior, highlight local `YYYY-MM-DD` helpers as source of truth for trading decisions; UTC-formatted ISO dates are known to cause day-boundary mistakes.
- Describe day-gain logic with the cost-effective-date gate (`effectivePctDate <= costDate => 0`) to avoid mislabeling this as a bug.
- Clarify intraday estimate semantics: system uses top-10 holdings quote estimation only when market is trading and official NAV date is not today.
- Mention i18n implementation is custom context (`useTranslation().t("common.xxx")`), missing keys return path string, and default language is `zh` without provider-level persistence.
- Build/runtime specifics worth surfacing: build injects latest 5 commits to `VITE_COMMITS_JSON` (optional Gemini translation); app base is `/fund-manager/`; Danjuan calls rely on dev proxy `/djapi` with forced `Referer`.
- Commands are intentionally limited to `dev`/`build`/`preview`; repository provides no lint/test script and no single-test runner entry.
