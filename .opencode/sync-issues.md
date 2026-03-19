# Sync Issues (Unresolved Only)

## SYNC-1

- Severity: HIGH
- Files: components/GistSyncChooserCard.test.tsx ↔ components/GistSyncChooserCard.tsx
- Problem: G3 组件测试未全通过。`shows gist description and readable updated time` 断言期望 `2026-03-19 09:10`，但组件按本地时区格式化后实际渲染为 `2026-03-19 17:10`，导致 `npm run test` 失败（1 failed）。
- Fix: 将时间断言改为与实现一致的“本地时区稳定断言”（建议 mock `Date`/时区，或断言 `formatGistUpdatedAt` 输出再比对 DOM），避免写死 UTC 时间。
- Status: pending

## SYNC-2

- Severity: MEDIUM
- Files: components/GistSyncChooserCard.tsx ↔ services/gistSync/types.ts
- Problem: 组件内重复定义 `MAX_DESCRIPTION_LEN = 25`，与领域常量 `GIST_DESCRIPTION_MAX_LENGTH` 重复，存在后续改动不同步风险（模块化一致性不足）。
- Fix: 在组件中复用 `services/gistSync/types.ts` 的 `GIST_DESCRIPTION_MAX_LENGTH` 常量，移除本地重复定义。
- Status: pending

## SYNC-3

- Severity: MEDIUM
- Files: verification tooling
- Problem: `lsp_diagnostics` 工具调用失败（Binary not found: `/home/hr/.cache/opencode/node_modules/bin/orchestrator`），当前无法完成 LSP 维度验收。
- Fix: 修复该二进制工具链或提供等效 TypeScript/ESLint 诊断命令作为替代门禁后再复验。
- Status: pending
