# 调仓功能设计（第一阶段）

## 1. 目标与范围

### 1.1 目标

- 支持用户在一次操作中，将基金 A 的部分份额按“操作日净值”换仓到基金 B。
- 在操作日真实净值可用前，交易始终显示为“在途”。
- 手续费按**每笔调仓单独选择**，支持卖出侧与买入侧分别设置。

### 1.2 第一阶段范围（已确认）

- 输入方式：**卖出份额**。
- 每笔调仓分别选择手续费（不做基金级长期费率配置）。
- 默认手续费：**卖出 0.5%**，**买入 0%**。
- 手续费选项：`1.5% / 0.5% / 0.1% / 0`。
- 调仓采用双边关联在途交易（A 转出 + B 转入）。
- 结算按 `effectiveOpDate` 对应净值（历史净值）执行。

### 1.3 非目标（第一阶段不做）

- 不做“按基金/按持有天数自动费率规则”引擎。
- 不支持在调仓流程中创建新基金（仅可选已持仓基金）。
- 不新增独立后台结算 worker（沿用现有 refreshFundData 流程触发）。

---

## 2. 现状与约束

### 2.1 现有模型

- `Fund.pendingTransactions` 已支持在途交易列表。
- `PendingTransaction.type` 当前仅有 `buy | sell`。
- 结算逻辑位于 `services/db.ts` 的 `refreshFundData` 内。

### 2.2 关键技术约束

- EastMoney 历史净值查询需通过 `fetchHistoricalFundNav`，并遵守全局 `window.apidata` 队列串行约束。
- 交易日/结算日逻辑需使用本地日期字符串（避免 UTC 日期偏移问题）。
- 调仓必须保证 A/B 双边一致性，禁止单边落账。

---

## 3. 核心方案

### 3.1 交易建模

将一次调仓建模为两条关联在途交易：

- A 基金：`transferOut`（转出）
- B 基金：`transferIn`（转入）

两条交易通过同一个 `transferId` 关联，作为同一事务单元结算。

### 3.2 数据结构调整（类型层）

在 `types.ts` 中扩展 `PendingTransaction`：

- `type`: `'buy' | 'sell' | 'transferOut' | 'transferIn'`
- 新增字段（调仓专用，可选）：
  - `transferId?: string`
  - `counterpartyFundCode?: string`
  - `sellFeeRate?: number`（0~1）
  - `buyFeeRate?: number`（0~1）
  - `outShares?: number`（转出份额）
  - `inShares?: number`（转入份额，结算后写入）
  - `grossAmount?: number`（卖出毛金额）
  - `netOutAmount?: number`（卖出净金额）
  - `netInAmount?: number`（买入前金额）
  - `settledNavDateUsed?: string`（本次结算实际命中的净值日期）

> 说明：保持向后兼容，现有 `buy/sell` 交易不受影响。

### 3.3 计算公式与日期定义

先定义有效操作日 `effectiveOpDate`（统一 A/B 两侧）：

- 以统一交易日判定函数为准（优先接入交易日历/行情可用性判定），周末顺延仅作为 fallback。
- 若 `opDate` 为非交易日，顺延到下一交易日。
- 若 `opTime = after15`，在上述基础上再顺延一个交易日。
- 必须使用本地日期规则（YYYY-MM-DD，本地时区），避免 UTC 偏移。

设：

- `outShares` = 用户输入卖出份额
- `navA(effectiveOpDate)` = A 在有效操作日净值
- `navB(effectiveOpDate)` = B 在有效操作日净值
- `sellFee` = 卖出手续费率
- `buyFee` = 买入手续费率

计算链路：

1. `grossOut = outShares * navA(effectiveOpDate)`
2. `netOut = grossOut * (1 - sellFee)`
3. `netIn = netOut * (1 - buyFee)`
4. `inShares = netIn / navB(effectiveOpDate)`

成本口径（第一阶段固定）：

- B 侧新增成本采用 `netIn`（买入手续费后实际入场资金）
- `newCostPriceB = (oldCostValueB + netIn) / (oldSharesB + inShares)`

### 3.4 结算触发与原子性

- 结算触发点：`refreshFundData` 周期中。
- 历史净值查询使用 `fetchHistoricalFundNav(code, effectiveOpDate)`。
- 仅当 A/B 两只基金在 `effectiveOpDate` 的净值都可获取时，才进行调仓结算。
- 结算使用 Dexie transaction 一次性更新：
  - A 扣减份额
  - B 增加份额并更新加权成本
  - A/B 对应 pending 统一 `settled=true`
- 任意步骤失败 => 整单回滚，双边保持在途。

幂等性规则：

- 同一 `transferId` 仅允许结算一次。
- `refreshFundData` 多次触发时，结算前必须检查该 `transferId` 对应双边记录是否已 `settled=true`；若已结算则跳过。
- 若出现异常重试，必须基于最新 DB 状态重读并重判，禁止依据内存旧快照重复入账。

净值日期可追溯规则：

- 由于历史接口可能返回区间内最新记录，结算落账时需保存 `settledNavDateUsed`。
- 若无法确认是目标日净值，首版策略为“保持在途并等待下次”，不做模糊结算。

调仓类型字段与单位约定：

| 类型          | 主输入字段  | 份额字段          | 金额字段                         | 说明                           |
| ------------- | ----------- | ----------------- | -------------------------------- | ------------------------------ |
| `transferOut` | `outShares` | `outShares`（份） | `grossAmount/netOutAmount`（元） | A 侧卖出，提交时即有 outShares |
| `transferIn`  | 无直接输入  | `inShares`（份）  | `netInAmount`（元）              | B 侧买入，结算后写入 inShares  |

展示口径约定：

- 历史列表优先展示主单位（`transferOut` 显示转出份额，`transferIn` 显示转入份额）。
- 次要信息以附注展示（金额或费率），保持与现有 buy/sell 列表风格一致。

---

## 4. UI/交互设计

### 4.1 入口

- 在持仓列表行的上下文菜单中新增 `调仓` 按钮。

### 4.2 调仓弹窗字段

- 转出基金：当前基金（只读）
- 转入基金：下拉选择（仅现有持仓）
- 操作日期：date
- 操作时间：before15 / after15
- 卖出份额：number
- 卖出手续费：下拉（默认 0.5%）
- 买入手续费：下拉（默认 0%）

### 4.3 实时预估（提示区）

- 展示：卖出毛金额、卖出净金额、可买金额、预计买入份额。
- 若任一净值不可得，显示“最终以净值更新后结算”。

### 4.4 在途与历史展示

- A/B 两侧均显示在途计数。
- 交易历史中区分 `调仓转出` / `调仓转入`，并显示关联标识（如“关联调仓”）。

---

## 5. 主要改动点（文件级）

1. `types.ts`
   - 扩展 `PendingTransaction` 类型与字段。

2. `components/Dashboard.tsx`
   - 上下文菜单新增“调仓”入口。
   - 挂载新调仓弹窗。

3. 新增 `components/RebalanceModal.tsx`
   - 调仓表单与实时预估逻辑。
   - 写入 A/B 双边 pending 交易。

4. `components/TransactionHistoryModal.tsx`
   - 兼容展示 transfer 类型文案与金额/份额单位。

5. `components/fundDetailChartUtils.ts`
   - marker 计算兼容 transferOut/transferIn（至少不报错，必要时追加样式）。

6. `services/i18n.tsx`
   - 新增调仓文案键（中英文）。

7. `services/db.ts`
   - 在现有结算流程内新增“调仓双边结算器”。
   - 基于 `fetchHistoricalFundNav` 拉取操作日净值。
   - 使用 Dexie 事务保障原子提交。

---

## 6. 异常与边界处理

1. 转入/转出基金相同：阻止提交。
2. 卖出份额 <= 0：阻止提交。
3. 超卖校验：
   - `availableShares = holdingShares - unsettledSellShares - unsettledTransferOutShares`
   - 若 `outShares > availableShares`，阻止提交。
   - 结算前再次二次校验，防并发期间份额变化。
4. 净值缺失：保持在途，等待下次刷新。
5. 历史数据缺口：提示“待净值可用后结算”，不做错误终止。
6. A 先被手动修改导致份额不足：结算阶段进行防御校验并保持在途。
7. 金额与份额精度：
   - 金额展示保留 2 位；份额展示保留 2~4 位（按现有 UI 风格）。
   - 计算与落库规则（四舍五入，half-up）：
     - `grossOut`：保留 6 位；
     - `netOut`：保留 6 位；
     - `netIn`：保留 6 位；
     - `inShares`：保留 6 位后落库；
     - `newCostPriceB`：保留 6 位后落库；
   - 汇总展示时再按金额 2 位格式化，避免展示层反向影响结算。

---

## 7. 测试策略

### 7.1 单元/组件测试

- 调仓弹窗：默认费率、下拉选择、字段校验。
- 提交行为：创建双边 pending，`transferId` 一致。

### 7.2 服务层测试（核心）

- 净值未就绪：不结算。
- 净值就绪：双边同时结算。
- 手续费计算：卖出/买入费率都生效。
- 事务回滚：中途异常不出现单边结算。
- 日期边界：`after15`、周五晚、周末提交的 `effectiveOpDate` 计算正确。
- 可卖份额防护：已存在未结算卖出/转出时，禁止超卖。

### 7.3 回归重点

- 现有 `buy/sell` 在途结算不退化。
- Dashboard 在途计数与交易历史不退化。

---

## 8. 后续与主分支同步策略

- 本功能开发在独立 worktree 分支进行。
- 后续同步 `main` 时优先使用 merge。
- 若冲突：遵循“业务一致性优先（原子结算）+ 最小改动”原则逐文件解决，并执行回归测试。

---

## 9. 验收标准（第一阶段）

1. 用户可一键提交调仓（A->B），双边均进入在途。
2. 手续费可逐笔配置，默认卖出 0.5% / 买入 0%。
3. 净值未出前保持在途；净值可用后按 `effectiveOpDate` 净值结算。
4. 结算必须双边一致，不出现单边成功。
5. 现有加减仓和展示逻辑无回归。
