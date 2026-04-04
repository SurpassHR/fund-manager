# LLM Provider/Model 分层改造 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 AI 配置从“按用途耦合”改为“Provider 与 Model 分层管理”，用户先配置 Provider，再在图像识别/持仓分析页面分别选择要使用的 Provider + Model。

**Architecture:** 抽离统一的 Provider Registry 与 Model Catalog 层；设置页只负责维护 provider 凭证与模型清单，不再承载用途绑定；各业务页面通过独立“使用策略选择器”保存自己的 provider/model 选择并在运行时解析。

**Tech Stack:** React 19, TypeScript, Context API, Vitest, React Testing Library.

---

## Chunk 1: 配置域模型重构（Provider Registry + Usage Selection）

### Task 1: 扩展 SettingsContext 数据结构，拆分“配置”与“用途选择”

**Files:**

- Modify: `services/SettingsContext.tsx`
- Test: `components/__tests__/SettingsPage.aiCustomProvider.test.tsx`

- [ ] **Step 1: 写失败测试（新字段存在并可更新）**

在测试中新增断言，覆盖以下字段：

- `ocrAiProvider`, `ocrAiModel`
- `analysisAiProvider`, `analysisAiModel`
- 保留 provider 凭证字段（openai/gemini/custom）

Run: `npm run test -- components/__tests__/SettingsPage.aiCustomProvider.test.tsx -t "usage selection"`
Expected: FAIL（字段不存在或未渲染）

- [ ] **Step 2: 在 SettingsContext 增加用途选择字段和 setter**

实现要点：

- 新增用途级状态（OCR / Analysis）
- `parseSavedSettings` 兼容旧结构：缺失时回退默认值
- 默认值建议：`ocrAiProvider='openai'`, `analysisAiProvider='openai'`，model 默认跟随对应 provider 默认模型

- [ ] **Step 3: 持久化兼容与迁移逻辑**

实现要点：

- 若旧数据仅有 `aiProvider`，首次加载时将旧值迁移到两个用途 provider
- 若旧数据仅有 `openaiModel/geminiModel/customOpenAiModel`，用途 model 默认按用途 provider 推导

- [ ] **Step 4: 运行最小测试确认通过**

Run: `npm run test -- components/__tests__/SettingsPage.aiCustomProvider.test.tsx`
Expected: PASS

### Task 2: 新增 provider/model 运行时解析器（按用途）

**Files:**

- Modify: `services/aiProviderConfig.ts`
- Create: `services/__tests__/aiProviderConfig.usage.test.ts`

- [ ] **Step 1: 写失败测试（按用途解析 runtime）**

覆盖场景：

- OCR 选 Gemini，Analysis 选 Custom OpenAI
- 缺失 api key/model 时返回可识别的空值状态
- custom provider 下 `baseURL/modelsEndpoint` 规范化

Run: `npm run test -- services/__tests__/aiProviderConfig.usage.test.ts`
Expected: FAIL

- [ ] **Step 2: 实现用途参数化解析函数**

建议 API：

- `resolveAiRuntimeConfigByUsage(settings, usage)`
- `usage: 'ocr' | 'analysis'`

输出：

- `provider`, `apiKey`, `model`, `baseURL?`, `modelsEndpoint?`

- [ ] **Step 3: 保留向后兼容入口（若现有调用未改完）**

可选策略：

- `resolveAiRuntimeConfig` 内部委托 `usage='ocr'`（临时）
- 在本次改造末尾再统一替换调用点

- [ ] **Step 4: 运行测试**

Run: `npm run test -- services/__tests__/aiProviderConfig.usage.test.ts`
Expected: PASS

---

## Chunk 2: 设置页改造（仅管理 provider 与 model，不绑定用途）

### Task 3: 重构 AI 设置主视图文案与结构

**Files:**

- Modify: `components/SettingsPage.tsx`
- Modify: `services/i18n.tsx`
- Test: `components/__tests__/SettingsPage.aiCustomProvider.test.tsx`

- [ ] **Step 1: 写失败测试（新分区结构）**

新增断言：

- 页面存在“大模型配置”区块
- 页面存在“用途选择”区块（OCR、持仓分析各一组 provider/model）
- 不再以单一全局 `aiProvider` 驱动所有用途

Run: `npm run test -- components/__tests__/SettingsPage.aiCustomProvider.test.tsx -t "大模型配置"`
Expected: FAIL

- [ ] **Step 2: 实现“大模型配置”区块（Provider Registry）**

行为约束：

- 只编辑 provider 级配置（api key / base url / models endpoint / provider 可用模型）
- 不显示“这个 provider 用于哪个功能”的控件

- [ ] **Step 3: 实现“用途选择”区块（Usage Binding）**

行为约束：

- OCR：选择 provider + model
- 持仓分析：选择 provider + model
- model 下拉内容由当前用途 provider 决定，支持手动输入兜底（沿用 custom 输入体验）

- [ ] **Step 4: 重构模型加载逻辑**

实现要点：

- 保留 `listOpenAiModels` / `listGeminiModels` / `listCustomOpenAiModels`
- 将加载结果缓存到 provider 维度状态
- 用途选择时复用缓存，减少重复请求

- [ ] **Step 5: 更新中英文文案并跑测试**

Run: `npm run test -- components/__tests__/SettingsPage.aiCustomProvider.test.tsx`
Expected: PASS

---

## Chunk 3: 业务页面接入（按用途读取 provider/model）

### Task 4: 图像识别链路改造为 OCR 用途配置

**Files:**

- Modify: `components/ScannerModal.tsx`
- Modify: `services/aiProviderConfig.ts`
- Test: `services/__tests__/aiOcr.customModels.test.ts`

- [ ] **Step 1: 写失败测试（OCR 使用 ocr usage 配置）**

Run: `npm run test -- services/__tests__/aiOcr.customModels.test.ts -t "ocr usage"`
Expected: FAIL

- [ ] **Step 2: ScannerModal 改为调用 usage 解析器**

替换：

- `resolveAiRuntimeConfig(settings)` → `resolveAiRuntimeConfigByUsage(settings, 'ocr')`

- [ ] **Step 3: 校验 key 缺失提示与回退流程不变**

Run: `npm run test -- components/__tests__/FundDetail.test.tsx`
Expected: PASS（无回归）

### Task 5: 持仓分析链路改造为 analysis 用途配置

**Files:**

- Modify: `components/AiHoldingsAnalysisModal.tsx`
- Modify: `services/aiAnalysis.ts`（仅在必要时）
- Test: `components/__tests__/FundDetail.test.tsx`

- [ ] **Step 1: 写失败测试（analysis 使用 analysis usage 配置）**

Run: `npm run test -- components/__tests__/FundDetail.test.tsx -t "AI 持仓分析"`
Expected: FAIL（provider/model 断言不匹配）

- [ ] **Step 2: Analysis Modal 切换到 usage 解析器**

替换：

- `resolveAiRuntimeConfig(settings)` → `resolveAiRuntimeConfigByUsage(settings, 'analysis')`

- [ ] **Step 3: 校验流式响应链路无回归**

Run: `npm run test -- components/__tests__/FundDetail.test.tsx`
Expected: PASS

---

## Chunk 4: 回归验证与质量门禁

### Task 6: 完整验证（lint + 类型 + 单测）

**Files:**

- N/A（全局验证）

- [ ] **Step 1: 运行 LSP/类型检查**

Run: `npm run build`
Expected: PASS（`tsc` + `vite build`）

- [ ] **Step 2: 运行 AI 相关测试集**

Run: `npm run test -- components/__tests__/SettingsPage.aiCustomProvider.test.tsx services/__tests__/aiProviderConfig.usage.test.ts services/__tests__/aiOcr.customModels.test.ts`
Expected: PASS

- [ ] **Step 3: 运行全量测试**

Run: `npm run test`
Expected: PASS

- [ ] **Step 4: 运行 lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 5: 提交（按功能拆分）**

建议提交粒度：

1. `feat(settings): split ai provider registry and usage selection`
2. `feat(ai): route ocr and analysis through usage runtime config`
3. `test(ai): cover usage-based provider model resolution`
