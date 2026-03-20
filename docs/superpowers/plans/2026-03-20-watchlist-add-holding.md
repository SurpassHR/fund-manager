# Watchlist Add Holding Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在自选页右键“未持有基金”时可添加持仓；保存后保留自选项。

**Architecture:** `Watchlist` 控制入口与状态，`AddFundModal` 扩展 prefill 初始化优先级（`editFund > prefill > blank`），持仓写入仍复用原 `db.funds.add` 逻辑。

**Tech Stack:** React 19 + TypeScript + Dexie + Vitest + RTL

---

## Chunk 1: 入口显示（RED → GREEN）

### Task 1: 仅“未持有基金”显示菜单项

**Files:**

- Create: `components/Watchlist.addHolding.test.tsx`
- Modify: `components/Watchlist.tsx`

- [ ] **Step 1: 写失败测试（fund+unheld 显示）**
- [ ] **Step 2: 运行该测试，确认 FAIL**
  - Run: `npm run test -- components/Watchlist.addHolding.test.tsx -t "shows add holding for unheld fund"`
- [ ] **Step 3: 最小实现显示条件（fund && unheld）**
- [ ] **Step 4: 运行该测试，确认 PASS**

- [ ] **Step 5: 写失败测试（index 不显示）**
- [ ] **Step 6: 运行该测试，确认 FAIL**
  - Run: `npm run test -- components/Watchlist.addHolding.test.tsx -t "hides add holding for index"`
- [ ] **Step 7: 最小实现 index 屏蔽逻辑**
- [ ] **Step 8: 运行该测试，确认 PASS**

- [ ] **Step 9: 写失败测试（fund+held 不显示）**
- [ ] **Step 10: 运行该测试，确认 FAIL**
  - Run: `npm run test -- components/Watchlist.addHolding.test.tsx -t "hides add holding for held fund"`
- [ ] **Step 11: 最小实现 held 判定（同 code 且 holdingShares > 0）**
- [ ] **Step 12: 运行该测试，确认 PASS**

## Chunk 2: i18n 文案键（RED → GREEN）

### Task 2: 新增 add-holding 文案

**Files:**

- Modify: `services/i18n.tsx`
- Modify: `components/Watchlist.addHolding.test.tsx`

- [ ] **Step 1: 写失败测试（zh 文案键存在）**
- [ ] **Step 2: 运行该测试，确认 FAIL**
  - Run: `npm run test -- components/Watchlist.addHolding.test.tsx -t "has zh add-holding translation keys"`
- [ ] **Step 3: 最小实现 zh 键**
  - `addHoldingFromWatchlist`
  - `addHoldingFromWatchlistInvalid`
- [ ] **Step 4: 运行该测试，确认 PASS**

- [ ] **Step 5: 写失败测试（en 文案键存在）**
- [ ] **Step 6: 运行该测试，确认 FAIL**
  - Run: `npm run test -- components/Watchlist.addHolding.test.tsx -t "has en add-holding translation keys"`
- [ ] **Step 7: 最小实现 en 键**
- [ ] **Step 8: 运行该测试，确认 PASS**

## Chunk 3: AddFundModal prefill 优先级（RED → GREEN）

### Task 3: `editFund > prefill > blank`

**Files:**

- Create: `components/AddFundModal.prefill.test.tsx`
- Modify: `components/AddFundModal.tsx`

- [ ] **Step 1: 写失败测试（editFund 优先）**
- [ ] **Step 2: 运行该测试，确认 FAIL**
  - Run: `npm run test -- components/AddFundModal.prefill.test.tsx -t "edit fund takes precedence"`
- [ ] **Step 3: 最小实现 editFund 优先**
- [ ] **Step 4: 运行该测试，确认 PASS**

- [ ] **Step 5: 写失败测试（prefill 次优先）**
- [ ] **Step 6: 运行该测试，确认 FAIL**
  - Run: `npm run test -- components/AddFundModal.prefill.test.tsx -t "uses prefill when edit fund absent"`
- [ ] **Step 7: 最小实现 prefill 分支**
- [ ] **Step 8: 运行该测试，确认 PASS**

- [ ] **Step 9: 写失败测试（blank 默认）**
- [ ] **Step 10: 运行该测试，确认 FAIL**
  - Run: `npm run test -- components/AddFundModal.prefill.test.tsx -t "uses blank mode when no edit and no prefill"`
- [ ] **Step 11: 最小实现 blank 默认行为**
- [ ] **Step 12: 运行该测试，确认 PASS**

## Chunk 4: Watchlist 点击联动（RED → GREEN）

### Task 4: 点击菜单打开预填弹窗 + 状态清理

**Files:**

- Modify: `components/Watchlist.tsx`
- Modify: `components/Watchlist.addHolding.test.tsx`

- [ ] **Step 1: 写失败测试（字段缺失告警）**
- [ ] **Step 2: 运行该测试，确认 FAIL**
  - Run: `npm run test -- components/Watchlist.addHolding.test.tsx -t "alerts on invalid watchlist item"`
- [ ] **Step 3: 最小实现字段校验 + alert**
- [ ] **Step 4: 运行该测试，确认 PASS**

- [ ] **Step 5: 写失败测试（防重入）**
- [ ] **Step 6: 运行该测试，确认 FAIL**
  - Run: `npm run test -- components/Watchlist.addHolding.test.tsx -t "prevents re-entry when modal already open"`
- [ ] **Step 7: 最小实现防重入 return**
- [ ] **Step 8: 运行该测试，确认 PASS**

- [ ] **Step 9: 写失败测试（点击后打开预填弹窗）**
- [ ] **Step 10: 运行该测试，确认 FAIL**
  - Run: `npm run test -- components/Watchlist.addHolding.test.tsx -t "opens add fund modal with prefill from watchlist"`
- [ ] **Step 11: 最小实现状态设置（open + prefill + close menu）**
- [ ] **Step 12: 运行该测试，确认 PASS**

- [ ] **Step 13: 写失败测试（onClose 清理状态）**
- [ ] **Step 14: 运行该测试，确认 FAIL**
  - Run: `npm run test -- components/Watchlist.addHolding.test.tsx -t "cleans prefill state on modal close"`
- [ ] **Step 15: 最小实现 onClose 清理（`setIsAddFundOpen(false)` + `setPrefillWatchlistItem(null)`）**
- [ ] **Step 16: 运行该测试，确认 PASS**

## Chunk 5: 保存后保留自选 + 回归（RED → GREEN）

### Task 5: 自选不删除 + 原功能不回归

**Files:**

- Modify: `components/Watchlist.addHolding.test.tsx`

- [ ] **Step 1: 写失败测试（保存后自选保留）**
- [ ] **Step 2: 运行该测试，确认 FAIL**
  - Run: `npm run test -- components/Watchlist.addHolding.test.tsx -t "keeps watchlist item after adding holding"`
- [ ] **Step 3: 最小实现/修正，确保 `db.funds.add` 调用且 `db.watchlists.delete/update` 不调用**
- [ ] **Step 4: 运行该测试，确认 PASS**

- [ ] **Step 5: 写失败测试（编辑入口不回归）**
- [ ] **Step 6: 运行该测试，确认 FAIL**
  - Run: `npm run test -- components/Watchlist.addHolding.test.tsx -t "keeps edit action working"`
- [ ] **Step 7: 最小实现修正编辑路径**
- [ ] **Step 8: 运行该测试，确认 PASS**

- [ ] **Step 9: 写失败测试（删除入口不回归）**
- [ ] **Step 10: 运行该测试，确认 FAIL**
  - Run: `npm run test -- components/Watchlist.addHolding.test.tsx -t "keeps delete action working"`
- [ ] **Step 11: 最小实现修正删除路径**
- [ ] **Step 12: 运行该测试，确认 PASS**

- [ ] **Step 13: 写失败测试（详情入口不回归）**
- [ ] **Step 14: 运行该测试，确认 FAIL**
  - Run: `npm run test -- components/Watchlist.addHolding.test.tsx -t "keeps detail navigation working"`
- [ ] **Step 15: 最小实现修正详情路径**
- [ ] **Step 16: 运行该测试，确认 PASS**

## Chunk 6: 最终验证与交接

### Task 6: 全闭环验证

**Files:**

- Modify: `docs/superpowers/specs/2026-03-20-watchlist-add-holding-design.md`（仅偏差时）

- [ ] **Step 1: 运行新增测试文件全集**
  - Run: `npm run test -- components/Watchlist.addHolding.test.tsx components/AddFundModal.prefill.test.tsx`
  - Expected: PASS

- [ ] **Step 2: 运行全量测试**
  - Run: `npm run test`
  - Expected: PASS

- [ ] **Step 3: 运行 lint**
  - Run: `npm run lint`
  - Expected: PASS

- [ ] **Step 4: 运行 build**
  - Run: `npm run build`
  - Expected: PASS

- [ ] **Step 5: 运行 LSP 诊断**
  - Run: `lsp_diagnostics({ file: "*", include_warnings: true })`
  - Expected: 无新增错误

- [ ] **Step 6: 规格核对（入口条件）**
- [ ] **Step 7: 规格核对（优先级）**
- [ ] **Step 8: 规格核对（自选保留）**
- [ ] **Step 9: 有偏差则更新规格文档**
- [ ] **Step 10: 请求代码评审（superpowers:requesting-code-review）**
- [ ] **Step 11: 若用户要求再提交**
