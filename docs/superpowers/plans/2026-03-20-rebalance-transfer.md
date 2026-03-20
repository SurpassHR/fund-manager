# Rebalance Transfer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现“调仓”能力：用户按卖出份额发起 A→B 调仓，支持逐笔设置卖出/买入手续费，净值未就绪前保持在途，按 `effectiveOpDate` 原子结算。

**Architecture:** 在现有 `Fund.pendingTransactions` 模型上扩展 `transferOut/transferIn` 双边关联交易，通过 `transferId` 绑定为同一结算单元。调仓创建在新弹窗 `RebalanceModal` 内完成；结算复用 `refreshFundData` 主循环，新增“调仓双边结算器”并采用 Dexie 事务保证原子性与幂等性。

**Tech Stack:** React 19 + TypeScript + Dexie + Vitest + RTL + Vite

---

## Chunk 1: 类型与文案契约（RED → GREEN）

### Task 1: 扩展交易类型并固化单位语义

**Files:**

- Modify: `types.ts`
- Create: `services/rebalance.types.test.ts`（如项目习惯放 components 可改为邻近测试）

- [ ] **Step 1: 写失败测试（transfer 类型存在）**
- [ ] **Step 2: 运行测试确认 FAIL**
  - Run: `npm run test -- services/rebalance.types.test.ts -t "supports transfer transaction types"`
- [ ] **Step 3: 最小实现 type 扩展为 `transferOut | transferIn`**
- [ ] **Step 4: 运行测试确认 PASS**

- [ ] **Step 5: 写失败测试（transfer 字段/单位契约）**
- [ ] **Step 6: 运行测试确认 FAIL**
  - Run: `npm run test -- services/rebalance.types.test.ts -t "defines transfer fields and units"`
- [ ] **Step 7: 最小实现字段（transferId/outShares/inShares/fee 等）**
- [ ] **Step 8: 运行测试确认 PASS**

### Task 2: 新增调仓 i18n 文案键

**Files:**

- Modify: `services/i18n.tsx`
- Create: `components/RebalanceModal.i18n.test.tsx`

- [ ] **Step 1: 写失败测试（zh 文案键）**
- [ ] **Step 2: 运行测试确认 FAIL**
  - Run: `npm run test -- components/RebalanceModal.i18n.test.tsx -t "has zh rebalance keys"`
- [ ] **Step 3: 最小实现 zh 键（调仓入口、字段、费率、提示）**
- [ ] **Step 4: 运行测试确认 PASS**

- [ ] **Step 5: 写失败测试（en 文案键）**
- [ ] **Step 6: 运行测试确认 FAIL**
  - Run: `npm run test -- components/RebalanceModal.i18n.test.tsx -t "has en rebalance keys"`
- [ ] **Step 7: 最小实现 en 键**
- [ ] **Step 8: 运行测试确认 PASS**

---

## Chunk 2: 调仓弹窗与提交（RED → GREEN）

### Task 3: 新建 RebalanceModal 交互骨架

**Files:**

- Create: `components/RebalanceModal.tsx`
- Create: `components/RebalanceModal.test.tsx`

- [ ] **Step 1: 写失败测试（弹窗基础字段渲染）**
- [ ] **Step 2: 运行测试确认 FAIL**
  - Run: `npm run test -- components/RebalanceModal.test.tsx -t "renders rebalance form fields"`
- [ ] **Step 3: 最小实现字段 UI（转出/转入/日期/时间/份额/双费率）**
- [ ] **Step 4: 运行测试确认 PASS**

- [ ] **Step 5: 写失败测试（默认费率卖0.5买0）**
- [ ] **Step 6: 运行测试确认 FAIL**
  - Run: `npm run test -- components/RebalanceModal.test.tsx -t "uses default sell and buy fee rates"`
- [ ] **Step 7: 最小实现默认值逻辑**
- [ ] **Step 8: 运行测试确认 PASS**

- [ ] **Step 9: 写失败测试（转入基金仅限已持仓）**
- [ ] **Step 10: 运行测试确认 FAIL**
  - Run: `npm run test -- components/RebalanceModal.test.tsx -t "lists only existing holdings as transfer-in targets"`
- [ ] **Step 11: 最小实现转入下拉过滤（仅 db.funds 当前持仓）**
- [ ] **Step 12: 运行测试确认 PASS**

### Task 4: 提交时创建双边 pending 并绑定 transferId

**Files:**

- Modify: `components/RebalanceModal.tsx`
- Modify: `components/RebalanceModal.test.tsx`

- [ ] **Step 1: 写失败测试（提交后双边交易都创建）**
- [ ] **Step 2: 运行测试确认 FAIL**
  - Run: `npm run test -- components/RebalanceModal.test.tsx -t "creates paired transfer pending transactions"`
- [ ] **Step 3: 最小实现提交逻辑（A transferOut + B transferIn）**
- [ ] **Step 4: 运行测试确认 PASS**

- [ ] **Step 5: 写失败测试（transferId 一致）**
- [ ] **Step 6: 运行测试确认 FAIL**
  - Run: `npm run test -- components/RebalanceModal.test.tsx -t "uses same transferId for both sides"`
- [ ] **Step 7: 最小实现关联 ID 生成与写入**
- [ ] **Step 8: 运行测试确认 PASS**

- [ ] **Step 9: 写失败测试（超卖/同基金阻止提交）**
- [ ] **Step 10: 运行测试确认 FAIL**
  - Run: `npm run test -- components/RebalanceModal.test.tsx -t "blocks invalid rebalance submissions"`
- [ ] **Step 11: 最小实现校验（availableShares 与 A!=B）**
- [ ] **Step 12: 运行测试确认 PASS**

---

## Chunk 3: Dashboard 与历史展示接线（RED → GREEN）

### Task 5: Dashboard 增加调仓入口与弹窗挂载

**Files:**

- Modify: `components/Dashboard.tsx`
- Create: `components/Dashboard.rebalance.test.tsx`

- [ ] **Step 1: 写失败测试（菜单中显示调仓入口）**
- [ ] **Step 2: 运行测试确认 FAIL**
  - Run: `npm run test -- components/Dashboard.rebalance.test.tsx -t "shows rebalance action in context menu"`
- [ ] **Step 3: 最小实现菜单入口与状态变量**
- [ ] **Step 4: 运行测试确认 PASS**

- [ ] **Step 5: 写失败测试（点击后打开 RebalanceModal）**
- [ ] **Step 6: 运行测试确认 FAIL**
  - Run: `npm run test -- components/Dashboard.rebalance.test.tsx -t "opens rebalance modal from context menu"`
- [ ] **Step 7: 最小实现弹窗挂载与关闭清理**
- [ ] **Step 8: 运行测试确认 PASS**

- [ ] **Step 9: 写失败测试（transfer 双边在途计数生效）**
- [ ] **Step 10: 运行测试确认 FAIL**
  - Run: `npm run test -- components/Dashboard.rebalance.test.tsx -t "counts transfer pending on both funds"`
- [ ] **Step 11: 最小实现/修正在途计数兼容 transferOut/transferIn**
- [ ] **Step 12: 运行测试确认 PASS**

### Task 6: 历史记录兼容 transfer 类型展示

**Files:**

- Modify: `components/TransactionHistoryModal.tsx`
- Create: `components/TransactionHistoryModal.rebalance.test.tsx`

- [ ] **Step 1: 写失败测试（transferOut 标签与主单位）**
- [ ] **Step 2: 运行测试确认 FAIL**
  - Run: `npm run test -- components/TransactionHistoryModal.rebalance.test.tsx -t "renders transferOut history entry"`
- [ ] **Step 3: 最小实现 transferOut 展示文案与单位**
- [ ] **Step 4: 运行测试确认 PASS**

- [ ] **Step 5: 写失败测试（transferIn 标签与主单位）**
- [ ] **Step 6: 运行测试确认 FAIL**
  - Run: `npm run test -- components/TransactionHistoryModal.rebalance.test.tsx -t "renders transferIn history entry"`
- [ ] **Step 7: 最小实现 transferIn 展示文案与单位**
- [ ] **Step 8: 运行测试确认 PASS**

---

## Chunk 4: 结算引擎（effectiveOpDate + 幂等 + 原子）（RED → GREEN）

### Task 7: 提取并测试 effectiveOpDate 规则

**Files:**

- Create: `services/rebalanceUtils.ts`
- Create: `services/rebalanceUtils.test.ts`
- Modify: `services/db.ts`

- [ ] **Step 1: 写失败测试（before15 工作日不顺延）**
- [ ] **Step 2: 运行测试确认 FAIL**
  - Run: `npm run test -- services/rebalanceUtils.test.ts -t "keeps op date for weekday before 15"`
- [ ] **Step 3: 最小实现 effectiveOpDate 基础逻辑**
- [ ] **Step 4: 运行测试确认 PASS**

- [ ] **Step 5: 写失败测试（after15 顺延）**
- [ ] **Step 6: 运行测试确认 FAIL**
  - Run: `npm run test -- services/rebalanceUtils.test.ts -t "rolls to next trading day after 15"`
- [ ] **Step 7: 最小实现 after15 分支**
- [ ] **Step 8: 运行测试确认 PASS**

- [ ] **Step 9: 写失败测试（周末/节假判定 fallback）**
- [ ] **Step 10: 运行测试确认 FAIL**
  - Run: `npm run test -- services/rebalanceUtils.test.ts -t "handles non-trading days with fallback"`
- [ ] **Step 11: 最小实现非交易日处理与 fallback 说明注释**
- [ ] **Step 12: 运行测试确认 PASS**

### Task 8: 在 refreshFundData 中实现双边结算器

**Files:**

- Modify: `services/db.ts`
- Create: `services/db.rebalanceSettlement.test.ts`

- [ ] **Step 1: 写失败测试（净值缺失时不结算）**
- [ ] **Step 2: 运行测试确认 FAIL**
  - Run: `npm run test -- services/db.rebalanceSettlement.test.ts -t "keeps transfer pending when nav unavailable"`
- [ ] **Step 3: 最小实现缺失净值保持在途**
- [ ] **Step 4: 运行测试确认 PASS**

- [ ] **Step 5: 写失败测试（命中日期不等于 effectiveOpDate 时保持在途）**
- [ ] **Step 6: 运行测试确认 FAIL**
  - Run: `npm run test -- services/db.rebalanceSettlement.test.ts -t "keeps pending when nav date does not match effectiveOpDate"`
- [ ] **Step 7: 最小实现日期命中校验 + settledNavDateUsed 落库**
- [ ] **Step 8: 运行测试确认 PASS**

- [ ] **Step 9: 写失败测试（净值就绪双边结算）**
- [ ] **Step 10: 运行测试确认 FAIL**
  - Run: `npm run test -- services/db.rebalanceSettlement.test.ts -t "settles paired transfer atomically"`
- [ ] **Step 11: 最小实现公式与落账（netIn 计入 B 成本）**
- [ ] **Step 12: 运行测试确认 PASS**

- [ ] **Step 13: 写失败测试（幂等：同 transferId 不重复结算）**
- [ ] **Step 14: 运行测试确认 FAIL**
  - Run: `npm run test -- services/db.rebalanceSettlement.test.ts -t "does not settle same transfer twice"`
- [ ] **Step 15: 最小实现幂等守卫（settled 判定 + 重读）**
- [ ] **Step 16: 运行测试确认 PASS**

- [ ] **Step 17: 写失败测试（结算前二次超卖校验失败保持在途）**
- [ ] **Step 18: 运行测试确认 FAIL**
  - Run: `npm run test -- services/db.rebalanceSettlement.test.ts -t "keeps pending when shares become insufficient before settlement"`
- [ ] **Step 19: 最小实现结算前二次 availableShares 校验**
- [ ] **Step 20: 运行测试确认 PASS**

- [ ] **Step 21: 写失败测试（事务失败回滚）**
- [ ] **Step 22: 运行测试确认 FAIL**
  - Run: `npm run test -- services/db.rebalanceSettlement.test.ts -t "rolls back transfer settlement on failure"`
- [ ] **Step 23: 最小实现 Dexie transaction 原子更新**
- [ ] **Step 24: 运行测试确认 PASS**

- [ ] **Step 25: 写失败测试（精度与舍入规则）**
- [ ] **Step 26: 运行测试确认 FAIL**
  - Run: `npm run test -- services/db.rebalanceSettlement.test.ts -t "applies rounding rules consistently"`
- [ ] **Step 27: 最小实现 half-up 舍入时点（grossOut/netOut/netIn/inShares/newCostPriceB）**
- [ ] **Step 28: 运行测试确认 PASS**

- [ ] **Step 29: 写失败测试（buy/sell 结算路径不退化）**
- [ ] **Step 30: 运行测试确认 FAIL**
  - Run: `npm run test -- services/db.rebalanceSettlement.test.ts -t "keeps buy sell settlement behavior unchanged"`
- [ ] **Step 31: 最小实现兼容处理（不影响 buy/sell 旧分支）**
- [ ] **Step 32: 运行测试确认 PASS**

- [ ] **Step 33: 实现约束检查：历史净值查询仅复用 `fetchHistoricalFundNav` 入口**
- [ ] **Step 34: 运行相关测试确认 PASS**

---

## Chunk 5: 图表与标记兼容（RED → GREEN）

### Task 9: 交易标记逻辑兼容 transfer 类型

**Files:**

- Modify: `components/fundDetailChartUtils.ts`
- Modify: `components/FundDetail.test.tsx`

- [ ] **Step 1: 写失败测试（transferOut 生成卖出标记）**
- [ ] **Step 2: 运行测试确认 FAIL**
  - Run: `npm run test -- components/FundDetail.test.tsx -t "marks transferOut with sell marker"`
- [ ] **Step 3: 最小实现 transferOut marker 兼容**
- [ ] **Step 4: 运行测试确认 PASS**

- [ ] **Step 5: 写失败测试（transferIn 不误判为 liquidation）**
- [ ] **Step 6: 运行测试确认 FAIL**
  - Run: `npm run test -- components/FundDetail.test.tsx -t "does not treat transferIn as liquidation"`
- [ ] **Step 7: 最小实现清仓判定防误判**
- [ ] **Step 8: 运行测试确认 PASS**

---

## Chunk 6: 最终验证与交接

### Task 10: 全量验证 + 规格对齐 + 评审

**Files:**

- Modify: `docs/superpowers/specs/2026-03-20-rebalance-transfer-design.md`（仅实现偏差时）

- [ ] **Step 1: 运行调仓新增测试集**
  - Run: `npm run test -- components/RebalanceModal.test.tsx components/Dashboard.rebalance.test.tsx components/TransactionHistoryModal.rebalance.test.tsx services/rebalanceUtils.test.ts services/db.rebalanceSettlement.test.ts`
  - Expected: PASS

- [ ] **Step 2: 运行相关回归测试**
  - Run: `npm run test -- components/FundDetail.test.tsx components/Watchlist.addHolding.test.tsx`
  - Expected: PASS

- [ ] **Step 3: 运行全量测试**
  - Run: `npm run test`
  - Expected: PASS

- [ ] **Step 4: 运行 lint**
  - Run: `npm run lint`
  - Expected: PASS

- [ ] **Step 5: 运行 build**
  - Run: `npm run build`
  - Expected: PASS

- [ ] **Step 6: 运行 LSP 诊断**
  - Run: `lsp_diagnostics({ file: "*", include_warnings: true })`
  - Expected: 无新增错误

- [ ] **Step 7: 规格核对（输入/默认费率）**
- [ ] **Step 8: 规格核对（effectiveOpDate + 在途）**
- [ ] **Step 9: 规格核对（原子性 + 幂等）**
- [ ] **Step 10: 若有偏差更新 spec 文档**
- [ ] **Step 11: 请求代码评审（superpowers:requesting-code-review）**
- [ ] **Step 12: 若用户要求再执行提交/PR 流程**
