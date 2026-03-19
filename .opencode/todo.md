# Mission: 实现 GitHub Gist 同步新流程（移除手填 gist id，支持自动发现/选择/默认目标）

> 规划方法：并行优先（HPFA），仅规划不实现。
>
> Confidence: HIGH（项目结构）/ HIGH（GitHub API 端点）/ MEDIUM（现有 UI 交互细节需实现时微调）

## Project Context (for workers)

- Tech: React 19 + TypeScript + Vite + Vitest + framer-motion
- 关键文件：`components/SettingsPage.tsx`、`services/SettingsContext.tsx`、`services/db.ts`、`services/i18n.tsx`
- 官方 API 依据：
  - `GET /user` 验证 token: https://docs.github.com/en/rest/users/users?apiVersion=2022-11-28#get-the-authenticated-user
  - `GET /gists` / `POST /gists` / `PATCH /gists/{gist_id}`: https://docs.github.com/en/rest/gists/gists?apiVersion=2022-11-28
  - PAT 管理说明: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens

## File Manifest

| Action | File Path                                 | Description                                           | Dependencies                                                                                                         |
| ------ | ----------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| CREATE | services/gistSync/types.ts                | gist 同步领域类型定义                                 | -                                                                                                                    |
| CREATE | services/gistSync/client.ts               | GitHub token 校验 + gist 列表/下载/创建/覆盖 API 封装 | services/gistSync/types.ts                                                                                           |
| CREATE | services/gistSync/client.test.ts          | gist API 封装与过滤排序单测                           | services/gistSync/client.ts                                                                                          |
| CREATE | services/gistSync/index.ts                | gistSync 对外入口导出                                 | services/gistSync/types.ts, services/gistSync/client.ts                                                              |
| CREATE | services/fundBackup.ts                    | 导入导出 JSON 的纯函数（供文件与 gist 复用）          | -                                                                                                                    |
| CREATE | services/fundBackup.test.ts               | fundBackup 纯函数单测                                 | services/fundBackup.ts                                                                                               |
| MODIFY | services/db.ts                            | 复用 fundBackup（保持现有文件导入导出行为）           | services/fundBackup.ts                                                                                               |
| CREATE | components/GistSyncChooserCard.tsx        | 动画选择卡（下载/上传共用）                           | services/gistSync/types.ts                                                                                           |
| CREATE | components/GistSyncChooserCard.test.tsx   | 选择卡交互与显示单测                                  | components/GistSyncChooserCard.tsx                                                                                   |
| MODIFY | services/SettingsContext.tsx              | 新增 github token、默认 gist 目标持久化字段           | -                                                                                                                    |
| MODIFY | components/SettingsPage.tsx               | 接入新同步 UI/流程（下载卡、上传卡、默认目标一键）    | services/gistSync/index.ts, components/GistSyncChooserCard.tsx, services/SettingsContext.tsx, services/fundBackup.ts |
| MODIFY | services/i18n.tsx                         | 新增中英文文案 key（token/gist/错误/按钮/限制说明）   | -                                                                                                                    |
| CREATE | components/SettingsPage.gistSync.test.tsx | 主流程集成测试（默认目标回退、上传下载分支）          | components/SettingsPage.tsx                                                                                          |

## Parallel Execution Map

- **Parallel Group P1（可同时开始）**：G1 API层、G2 数据模型层、G3 选择卡 UI、G4 文案层
- **Parallel Group P2（依赖 P1 产出）**：G5 SettingsPage 集成编排
- **Parallel Group P3（依赖 P1+P2）**：G6 Reviewer 验证闭环 + 全系统验证

---

## G1: GitHub Gist API 与规则层（P1）| status: completed

### P1.1: 类型与 API 封装 | agent: Worker

- [x] T1.1.1 | description: CREATE `services/gistSync/types.ts`，定义 Token 验证结果、Gist 列表项、上传模式（create/overwrite）、固定文件名常量 `fund-manager-sync.json` | agent: Worker | size: S | dependencies: - | success: 类型覆盖设置页所需字段（id/description/updated_at/files 命中状态）且常量不可变（只读导出）。
- [x] T1.1.2 | description: CREATE `services/gistSync/client.ts`，实现 token 格式启发式校验 + `GET /user` 验证、`GET /gists` 拉取并按固定文件名过滤、按 `updated_at` 降序排序、下载内容、创建 gist、覆盖 gist | agent: Worker | size: M | dependencies: T1.1.1 | success: API 封装包含统一 headers（Accept + Authorization + API version），并对 401/403/422 等返回可区分错误类型。
- [x] T1.1.3 | description: CREATE `services/gistSync/index.ts` 作为公共出口，避免 SettingsPage 直接耦合内部实现 | agent: Worker | size: XS | dependencies: T1.1.1,T1.1.2 | success: SettingsPage 后续仅从 index 引入，不直接引用内部文件路径。

### P1.2: API层测试与评审 | agent: Reviewer

- [x] T1.2.1 | description: CREATE `services/gistSync/client.test.ts`，覆盖 token 校验分支、文件名过滤、updated_at 降序、错误映射 | agent: Worker | size: M | dependencies: T1.1.2 | success: 测试覆盖至少：合法/非法 token 输入、仅保留 `fund-manager-sync.json`、排序正确、网络错误分类。
- [x] T1.2.2 | description: 审查 G1 产物（接口签名、错误处理、不可变文件名约束） | agent: Reviewer | size: S | dependencies: T1.2.1,T1.1.3 | success: Reviewer 给出“可供 UI 集成”结论，或明确列出必须修复项。

## G2: 备份数据模型复用层（P1）| status: completed

### P2.1: 抽离可复用导入导出纯函数 | agent: Worker

- [x] T2.1.1 | description: CREATE `services/fundBackup.ts`，抽离导出 payload 构建与导入 payload 校验/归一化逻辑，供本地文件与 gist 双复用 | agent: Worker | size: M | dependencies: - | success: 纯函数不依赖 DOM/File API，可直接接收/返回 JSON 对象或字符串。
- [x] T2.1.2 | description: MODIFY `services/db.ts`，将现有 `exportFunds`/`importFunds` 接入 `fundBackup.ts`，保持现有行为不回归 | agent: Worker | size: S | dependencies: T2.1.1 | success: 现有导入导出入口函数签名与外部调用保持兼容。

### P2.2: 备份层测试与评审 | agent: Reviewer

- [x] T2.2.1 | description: CREATE `services/fundBackup.test.ts`，覆盖合法 payload、缺失字段、重复基金 key、id 清理等规则 | agent: Worker | size: M | dependencies: T2.1.1 | success: 对关键边界输入给出稳定结果，失败输入返回可识别错误。
- [x] T2.2.2 | description: 审查 G2 产物（纯函数边界、与 db.ts 集成正确性） | agent: Reviewer | size: S | dependencies: T2.1.2,T2.2.1 | success: Reviewer 确认“gist 与文件导入导出复用路径清晰且无重复逻辑扩散”。

## G3: 动画选择卡 UI 组件层（P1）| status: completed

### P3.1: 选择卡实现 | agent: Worker

- [x] T3.1.1 | description: CREATE `components/GistSyncChooserCard.tsx`，实现通用动画卡（framer-motion），支持两种模式：下载选择 & 上传选择（新建/覆盖） | agent: Worker | size: M | dependencies: T1.1.1 | success: 点击“从 gist 下载/上传到 gist”可分别触发对应卡片展示与关闭动画。
- [x] T3.1.2 | description: 在选择卡中实现 gist 列表项展示：描述、最后修改时间（updated_at 格式化）、命中固定文件名标识 | agent: Worker | size: S | dependencies: T3.1.1 | success: 每个列表项可见最后修改时间，且交互目标（选择 gist）清晰可点击。
- [x] T3.1.3 | description: 在上传模式中实现描述输入限制（max 25 chars）与剩余长度提示 | agent: Worker | size: S | dependencies: T3.1.1 | success: 输入超过 25 字符被阻止或截断，UI 明确提示限制。

### P3.2: UI 组件测试与评审 | agent: Reviewer

- [x] T3.2.1 | description: CREATE `components/GistSyncChooserCard.test.tsx`，覆盖模式切换、列表选择、描述长度限制、时间展示 | agent: Worker | size: M | dependencies: T3.1.2,T3.1.3 | success: 测试断言下载/上传模式核心交互路径均可通过。
- [x] T3.2.2 | description: 审查 G3 产物（动效、可访问性、交互完整性） | agent: Reviewer | size: S | dependencies: T3.2.1 | success: Reviewer 确认“卡片交互符合 feature scope 且可集成”。

## G4: 设置持久化与文案层（P1）| status: completed

### P4.1: 设置字段与文案扩展 | agent: Worker

- [x] T4.1.1 | description: MODIFY `services/SettingsContext.tsx`，新增 github token、默认 gist 目标（id + 快照信息）的持久化字段与 setter | agent: Worker | size: S | dependencies: - | success: 新字段可在刷新后恢复；不破坏现有 AI/主题设置。
- [x] T4.1.2 | description: MODIFY `services/i18n.tsx`，新增 gist 同步相关中英文文案（按钮、提示、错误、空状态、回退提示） | agent: Worker | size: S | dependencies: - | success: SettingsPage 所需 key 全部存在，避免渲染时回退 path 字符串。

### P4.2: 评审 | agent: Reviewer

- [x] T4.2.1 | description: 审查 G4 产物（localStorage 兼容、旧配置迁移容错、文案完整性） | agent: Reviewer | size: S | dependencies: T4.1.1,T4.1.2 | success: Reviewer 确认旧用户配置可平滑升级，无字段解析异常风险。

## G5: SettingsPage 集成编排（P2）| status: completed

### P5.1: 主流程接线 | agent: Worker | dependencies: T1.1.3,T2.1.2,T3.2.2,T4.2.1

- [x] T5.1.1 | description: MODIFY `components/SettingsPage.tsx`，移除手动 gist id 方案（若存在旧入口则清理），新增 GitHub token 输入与校验状态展示（格式 + API 验证） | agent: Worker | size: M | dependencies: T1.1.3,T4.1.1,T4.1.2 | success: 用户输入 token 后可看到明确的“格式校验 + API 验证”状态反馈。
- [x] T5.1.2 | description: 接入“从 gist 下载”流程：按钮打开动画选择卡 -> 用户选 gist -> 下载并触发导入；若默认目标失效则自动回退选择器 | agent: Worker | size: M | dependencies: T5.1.1,T2.1.2,T3.1.2 | success: 默认目标可一键下载；默认失效时自动弹出选择卡，无静默失败。
- [x] T5.1.3 | description: 接入“上传到 gist”流程：按钮打开动画卡 -> 用户选“新建”或“覆盖已有” -> 完成上传；描述可编辑且最多 25 字 | agent: Worker | size: M | dependencies: T5.1.1,T2.1.2,T3.1.3 | success: 两条上传分支都可走通，且描述限制有效。
- [x] T5.1.4 | description: 默认目标记忆策略：成功选择后保存默认 gist；每次操作先尝试默认目标，校验失败再回退 chooser 并提示 | agent: Worker | size: S | dependencies: T5.1.2,T5.1.3,T4.1.1 | success: 默认目标命中时无需二次选择；失效时自动回退且提示原因。

### P5.2: 集成测试与评审 | agent: Reviewer

- [x] T5.2.1 | description: CREATE `components/SettingsPage.gistSync.test.tsx` 基础骨架与 mock（gist API、settings、导入导出） | agent: Worker | size: S | dependencies: T5.1.4 | success: 测试基架可稳定渲染 SettingsPage 且可控制 API 返回场景。
- [x] T5.2.2 | description: 在同测试文件新增“下载流程”场景：弹卡、选择 gist、默认目标失效回退 | agent: Worker | size: M | dependencies: T5.2.1 | success: 下载相关成功/失败路径均有断言。
- [x] T5.2.3 | description: 在同测试文件新增“上传流程”场景：新建/覆盖分支、描述 25 字限制、最后修改时间展示 | agent: Worker | size: M | dependencies: T5.2.1 | success: 上传双分支与描述限制断言均通过。
- [x] T5.2.4 | description: 审查 G5 集成结果（逻辑正确性、交互一致性、回退策略） | agent: Reviewer | size: S | dependencies: T5.2.2,T5.2.3 | success: Reviewer 给出“功能范围已覆盖”或明确缺口清单。

## G6: 全链路验证与收尾（P3）| status: completed

### P6.1: 分流评审汇总 | agent: Reviewer

- [x] T6.1.1 | description: 汇总 G1/G2/G3/G4/G5 Reviewer 结论并生成缺口清单（若有） | agent: Reviewer | size: S | dependencies: T1.2.2,T2.2.2,T3.2.2,T4.2.1,T5.2.4 | success: 缺口项具备“文件+现象+建议修复”三元信息。

### P6.2: 最终系统验证 | agent: Reviewer

- [x] T6.2.1 | description: 运行类型/测试诊断（至少 `lsp_diagnostics` + gist 相关测试集）并确认无阻断问题 | agent: Reviewer | size: S | dependencies: T6.1.1 | success: 无 blocker 级类型错误，gist 同步相关测试通过。
- [x] T6.2.2 | description: 进行需求逐条对照验收（9 条 feature scope 全覆盖） | agent: Reviewer | size: S | dependencies: T6.2.1 | success: 每条需求有对应实现位置与测试证据映射。

---

## 依赖最小化说明

- G1/G2/G3/G4 均可并行，不互相阻塞。
- G5 仅依赖必要接口与组件，不等待非关键文档工作。
- G6 仅在各工作流完成后执行最终闭环。

## 执行注意事项（给 Worker/Reviewer）

- 固定同步文件名 `fund-manager-sync.json` 不可配置。
- token “格式校验”仅做 UX 预检查；权威校验必须以 `GET /user` 为准。
- 所有 gist 列表展示必须带 `updated_at`（格式化后显示）。
- 默认目标策略必须实现“命中一键同步 / 失效回退选择器”。
- 严禁把 token 打印到日志或错误消息。
