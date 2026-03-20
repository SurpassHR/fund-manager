# Sync Issues (Unresolved Only)

## SYNC-1

- Severity: HIGH
- Files: components/FundDetail.test.tsx ↔ components/FundDetail.tsx
- Problem: `keeps desktop detail wrapper full-width centering classes` 用“源码字符串包含断言”校验样式类名，当前实现已拆分/重构，断言失效导致测试失败（1 failed）。
- Fix: 改为基于渲染结果的 DOM 断言（查询目标容器并校验 classList），不要对完整源码文本做 contains 断言。
- Status: pending

## SYNC-2

- Severity: HIGH
- Files: components/SettingsPage.gistSync.test.tsx ↔ components/SettingsPage.tsx
- Problem: 3 条 gist 同步集成测试均失败（`expected "spy" to be called at least once`），说明测试触发链路与当前设置页实现脱节（token 校验、下载、上传分支均未命中预期调用）。
- Fix: 对齐测试与真实交互路径（按钮文案/可见状态/触发条件），确保 mock 注入点与实际调用函数一致；补齐必要的 i18n/mode 触发前置条件。
- Status: pending

## SYNC-3

- Severity: MEDIUM
- Files: verification tooling
- Problem: `lsp_diagnostics` 工具调用失败（Binary not found: `/home/hr/.cache/opencode/node_modules/bin/orchestrator`），当前无法完成 LSP 维度验收。
- Fix: 修复该二进制工具链或提供等效 TypeScript/ESLint 诊断命令作为替代门禁后再复验。
- Status: pending

## SYNC-4

- Severity: MEDIUM
- Files: components/GistSyncChooserCard.tsx ↔ services/gistSync/types.ts
- Problem: 组件内仍重复定义 `MAX_DESCRIPTION_LEN = 25`，未复用领域常量 `GIST_DESCRIPTION_MAX_LENGTH`，存在规则漂移风险。
- Fix: 在组件中直接引用 `GIST_DESCRIPTION_MAX_LENGTH`，移除本地重复常量。
- Status: pending
