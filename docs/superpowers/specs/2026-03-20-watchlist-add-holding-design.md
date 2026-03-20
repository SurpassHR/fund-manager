# 设计文档：自选页右键「添加持仓」

## 1. 背景与目标

当前 `Watchlist` 页面支持右键菜单（编辑/删除）与查看详情，但缺少从“观察标的”快速转“持仓录入”的路径。用户需求为：

- 在自选页右键点击**未持有的基金**时，可直接执行“添加持仓”；
- 添加成功后，**保留自选项**，不自动移除。

目标是以最小改动复用现有持仓录入能力（`AddFundModal`），降低重复实现和后续维护成本。

## 2. 范围

### 2.1 In Scope

- `components/Watchlist.tsx`：扩展右键菜单，新增“添加持仓”入口与弹窗状态管理。
- `components/AddFundModal.tsx`：支持接收来自自选项的预填信息（代码/名称/当前价）。
- `services/i18n.tsx`：新增文案键（中英）。
- 最小化测试补充（优先组件交互层）。

### 2.2 Out of Scope

- 新增“一键自动买入”类快捷交易。
- 改造持仓建仓/加仓业务规则。
- 自选与持仓的自动同步删除或双向绑定。

## 3. 方案对比与选型

### 方案 A（采用）

在 `Watchlist` 右键菜单增加“添加持仓”，点击后打开 `AddFundModal`，并预填当前自选基金信息。

- 优点：复用现有录入、校验、存储逻辑；改动集中，风险低。
- 缺点：仍需用户完成份额/成本等字段确认。

### 方案 B（未采用）

菜单内直接“一键生成持仓（默认参数）”。

- 风险：默认份额/成本参数可能误导，资金数据错误成本高。

### 方案 C（未采用）

新增轻量表单（份额+成本）后写入持仓。

- 风险：与 `AddFundModal` 的逻辑重复，后续维护和一致性成本高。

## 4. 交互设计

### 4.1 入口规则

- 仅 `WatchlistItem.type === 'fund'` 显示“添加持仓”。
- `type === 'index'` 不显示该入口，避免将指数误写为基金持仓。
- “未持有”的判定口径（本次明确）：
  - 若 `db.funds` 中存在 `code === watchlist.code` 且 `holdingShares > 0` 的任意记录，则视为“已持有”；
  - 仅在“未持有”时显示“添加持仓”。
  - 该口径为**全局代码维度**（不分账户），用于避免重复建仓入口。

### 4.2 菜单位置

在右键菜单中，建议排序：

1. 编辑
2. 添加持仓（新增）
3. 删除

### 4.3 操作结果

- 点击“添加持仓”后打开 `AddFundModal`。
- 保存成功后仅新增 `db.funds` 记录，`db.watchlists` 不修改。
- 用户仍停留在自选页，自选项保留。

## 5. 数据流与状态设计

## 5.1 `Watchlist` 状态新增

- `isAddFundOpen: boolean`：控制持仓弹窗开关。
- `prefillWatchlistItem: WatchlistItem | null`：记录当前由哪条自选项触发。

## 5.2 右键动作流程

1. 在菜单点击“添加持仓”；
2. 将目标 `WatchlistItem` 写入 `prefillWatchlistItem`；
3. 关闭右键菜单并打开 `AddFundModal`。
4. 若弹窗已打开，则本次点击直接返回（防重入）。

## 5.3 `AddFundModal` 入参扩展

新增可选入参：

- `prefillWatchlistItem?: WatchlistItem`

初始化优先级（必须遵循）：

1. `editFund` 存在：走“编辑持仓”逻辑，忽略 `prefillWatchlistItem`；
2. `editFund` 不存在且 `prefillWatchlistItem` 存在：走“自选预填新增”逻辑；
3. 两者都不存在：走现有“空白新增”逻辑。

初始化行为：

- 当 `isOpen === true` 且 `editFund` 为空且 `prefillWatchlistItem` 存在时：
  - 预填基金代码/名称（跳过搜索步骤）；
  - `currentNav` 先使用 `prefillWatchlistItem.currentPrice` 作为初值；
  - `costPrice` 走当前默认逻辑（默认等于当前净值/价格），用户可改。
  - 账户字段策略：默认账户继续复用现有 `getFallbackAccountName()`（账户必填，不新增空值分支）。

存储行为：

- 完全复用 `handleSave` 的 `db.funds.add` 逻辑；
- 不新增对 `db.watchlists` 的写操作。

状态清理时机：

- `Watchlist`：
  - 打开弹窗时设置 `prefillWatchlistItem`；
  - 关闭弹窗（保存成功/取消）后清空 `prefillWatchlistItem`；
- `AddFundModal`：沿用现有 `handleClose` 清理内部表单状态，不保留上一次预填痕迹。

## 6. 异常与边界处理

- 入口可见性：指数项不展示按钮。
- 数据保护：若自选项缺关键字段（`id/code/name/currentPrice`），点击时给出提示并中止。
  - 提示形式：沿用现有页面习惯使用 `alert`；
  - i18n 文案新增建议：`common.addHoldingFromWatchlistInvalid`（中英文）。
- API 刷新失败：沿用弹窗既有兜底策略，不阻断保存。
- 并发保护：连续点击“添加持仓”只允许首次生效（由 `isAddFundOpen` 短路）。

## 7. 测试与验收

## 7.1 测试点

1. 自选基金项显示“添加持仓”，指数项不显示。
2. 点击后弹出 `AddFundModal`，基金信息已预填。
3. 补充份额并保存后，`db.funds` 新增成功。
4. 保存后 `db.watchlists` 对应项仍存在。
5. 原有右键功能（编辑/删除）与详情查看不受影响。

建议最小可执行用例（示例）：

- 组件交互测试（`Watchlist.test.tsx`）：
  - 构造 `fund` 与 `index` 两类自选数据；
  - 触发右键后断言：`fund` 行菜单存在“添加持仓”，`index` 行不存在；
  - 点击“添加持仓”后断言 `AddFundModal` 打开且显示预填 code/name。
- 存储断言测试（可在组件测试内 mock `db`）：
  - 保存后断言 `db.funds.add` 被调用；
  - 同时断言 `db.watchlists.delete/update` 未被调用。
- i18n 回归断言：
  - 新增文案键存在中英文映射，避免直接显示 key path。

## 7.2 验收标准

- 自选页可通过右键将基金快捷转入持仓录入流程；
- 新持仓在持仓页可见且数据有效；
- 自选保留，不自动移除；
- 无回归影响。

验收与验证方法对应：

- “可快捷转入”→ 组件交互测试 + 手工冒烟（右键 -> 打开弹窗）；
- “持仓新增成功”→ `db.funds.add` 调用断言 + 页面可见性冒烟；
- “自选保留”→ `db.watchlists` 无删除/更新断言；
- “无回归影响”→ 现有 watchlist 菜单项与详情点击路径回归测试。

## 8. 实施影响评估

- 影响面：中低（主要集中在 2 个组件 + i18n 文案）。
- 兼容性：高（重用现有持仓弹窗/DB 写入路径）。
- 回滚策略：移除菜单项与预填入参即可恢复。

## 9. 风险与缓解

- 风险：预填对象类型与 `AddFundModal` 现有 `selectedFund` 分支判断不匹配。
  - 缓解：在 `AddFundModal` 增加明确的 prefill 分支，避免依赖模糊类型守卫。
- 风险：重复添加同代码基金到不同账户导致用户感知“重复”。
  - 缓解：沿用现有账户字段逻辑；后续可独立增加重复提示策略（不在本次范围）。

## 10. 结论

采用方案 A：在 `Watchlist` 右键新增“添加持仓”，打开 `AddFundModal` 并预填基金信息；保存后仅新增持仓，保持自选项不变。该方案在实现复杂度、可维护性与用户体验之间平衡最佳。
