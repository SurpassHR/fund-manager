# Project Ask Rules (Non-Obvious Only)

- Explain EastMoney integration as queue-serialized script injection over global `window.apidata` (not a normal fetch).
- For date behavior, emphasize local `YYYY-MM-DD` helpers as the source of truth; avoid UTC `toISOString` in trading/settlement decisions.
- Day-gain logic includes the cost-effective-date gate (`effectivePctDate <= costDateStr => 0`), by design.
- Intraday estimate uses top-10 holdings quotes only when market is trading and official NAV is not today.
- I18n is a custom context (`useTranslation().t("common.xxx")`); missing keys return the path and default language is `zh` without provider persistence.
- Build/runtime specifics: Vite injects latest 5 commits to `VITE_COMMITS_JSON` (optional Gemini translation), Welcome modal uses commit env + `localStorage.lastSeenVersion`, app base is `/fund-manager/`, Danjuan calls rely on dev proxy `/djapi` with forced `Referer`.
