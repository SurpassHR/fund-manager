# 自定义 OpenAI Compatible 接入设计说明

## 1. 背景与目标

当前应用已支持 OpenAI 与 Gemini 两类模型提供方，但部分用户使用的是 OpenAI Compatible 网关（如自建代理或第三方兼容服务），需要：

1. 在不破坏现有 OpenAI/Gemini 体验的前提下新增独立提供方；
2. 支持自定义 `Base URL` 与可选 `models endpoint`；
3. 模型选择支持“可选拉取 + 手动输入兜底”；
4. 让 OCR 与 AI 持仓分析两条链路都能复用该配置。

## 2. 设计范围

### 包含

- Settings 中新增 `customOpenAi` 提供方及相关字段持久化；
- 新增统一运行时配置解析器，统一向业务层输出 provider/apiKey/model/baseURL；
- OCR 与 AI 分析服务新增 `customOpenAi` 路由；
- 设置页新增 OpenAI Compatible 配置区与模型拉取逻辑；
- 补充单测与回归。

### 不包含

- 对 OpenAI/Gemini 原分支做行为调整；
- 新增新的模型协议层抽象（本次保持最小侵入改造）。

补充说明：本次包含少量测试代码质量修复（`no-explicit-any`），仅为 lint 合规，不改变业务行为。

## 3. 方案选择与取舍

采用“**独立 provider + 复用 OpenAI SDK + 统一运行时解析**”方案。

### 选择理由

- **风险低**：复用现有 OpenAI 请求路径，不引入额外协议层；
- **改动集中**：配置、服务、UI 各层边界明确；
- **可扩展**：后续可在 `aiProviderConfig` 上平滑扩展更多兼容厂商。

### 未采用方案

- 全量重构为多 Adapter 架构：收益高但本次改动面过大，非当前需求最优解。

## 4. 详细设计

## 4.1 配置层（SettingsContext）

新增 provider：`customOpenAi`。

新增字段：

- `customOpenAiApiKey`
- `customOpenAiBaseUrl`
- `customOpenAiModelsEndpoint`
- `customOpenAiModel`

并在本地存储解析时保证向后兼容：旧数据缺字段时回退默认值。

## 4.2 运行时配置解析层（aiProviderConfig）

新增 `resolveAiRuntimeConfig(settings)`，输出统一结构：

- `provider`
- `apiKey`
- `model`
- `baseURL?`
- `modelsEndpoint?`

约束：`baseURL/modelsEndpoint` 仅在 `customOpenAi` 分支生效，且空白字符串会被标准化为 `undefined`。

## 4.3 服务层

### OCR（aiOcr）

- `recognizeHoldingsFromImage` 增加 `baseURL?` 参数；
- 当 provider 为 `customOpenAi` 时，初始化 OpenAI 客户端传入 `baseURL`；
- 新增 `listCustomOpenAiModels({ apiKey, baseURL?, modelsEndpoint? })`：
  - 优先请求 `modelsEndpoint`；
  - 否则请求 `baseURL + /models`；
  - 均不可用时返回空列表，由 UI 手动输入兜底。

### 持仓分析（aiAnalysis）

- 普通与流式接口均增加 `baseURL?`；
- `customOpenAi` 分支复用 OpenAI chat/completions 路径并透传 `baseURL`。

## 4.4 UI 层

### SettingsPage

- provider 下拉新增 `OpenAI Compatible`；
- 新增独立配置区：
  - Base URL
  - API Key
  - Models Endpoint（可选）
  - Model（可手动输入）
- 自动拉取模型失败时仅提示，不阻断手动输入。

### ScannerModal / AiHoldingsAnalysisModal

- 改为调用 `resolveAiRuntimeConfig`，不再各自分散判断 provider；
- custom provider 时将 `baseURL` 透传到服务层。

## 5. 错误处理策略

- 缺少 API Key：沿用既有“引导打开设置”流程；
- 模型拉取失败：显示失败提示，继续允许手动输入模型；
- 当 `modelsEndpoint` 与 `baseURL` 均为空时：返回空模型列表，仅保留手动输入路径；
- 网络/鉴权错误：保持现有业务提示语义，不引入破坏性改动。

## 6. 测试与验证

新增测试：

- `services/__tests__/aiProviderConfig.test.ts`
  - 覆盖 custom provider 解析；
  - 覆盖空 URL 回退行为。
- `services/__tests__/aiOcr.customModels.test.ts`
  - 覆盖 models endpoint 优先级；
  - 覆盖 baseURL `/models` 回退。
- `components/__tests__/SettingsPage.aiCustomProvider.test.tsx`
  - 覆盖 custom 配置区渲染；
  - 覆盖模型拉取失败时手动输入可用。

关键断言映射：

- endpoint 优先级：`listCustomOpenAiModels` 首先请求 `modelsEndpoint`；
- fallback 路径：未配置 endpoint 时请求 `baseURL/models`；
- 手动输入兜底：模型拉取失败后 `setCustomOpenAiModel` 仍可被触发。

回归验证：

- `npm run test` 通过；
- `npm run build` 通过；
- `npm run lint` 无 error（保留历史 warning）。

## 7. 实施结果映射

核心实现提交：`aaa8076`。

主要变更文件：

- `services/SettingsContext.tsx`
- `services/aiProviderConfig.ts`
- `services/aiOcr.ts`
- `services/aiAnalysis.ts`
- `components/SettingsPage.tsx`
- `components/ScannerModal.tsx`
- `components/AiHoldingsAnalysisModal.tsx`
- `services/i18n.tsx`
- 对应新增/更新测试文件。

说明：

- `components/__tests__/SettingsPage.gistSync.test.tsx` 的修改用于补齐 settings mock 字段，确保兼容新 provider 字段；
- `services/__tests__/db.backupWatchlist.unit.test.ts` 的修改用于修复既有 lint 错误（`no-explicit-any`）。
