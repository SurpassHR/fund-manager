# OpenAI Compatible Provider Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增独立 OpenAI Compatible 提供方，支持自定义 Base URL、可选模型列表拉取与手动模型输入，并接入 OCR 与持仓分析链路。

**Architecture:** 在现有 OpenAI/Gemini 逻辑上新增 custom provider；通过统一运行时配置解析器给 UI 与服务层复用；模型列表采用“可选拉取 + 手动输入兜底”。

**Tech Stack:** React 19, TypeScript, OpenAI SDK, Vitest, RTL.

---

## Task 1: 扩展配置与运行时解析

**Files:**

- Modify: `services/SettingsContext.tsx`
- Create: `services/aiProviderConfig.ts`
- Test: `services/__tests__/aiProviderConfig.test.ts`

- [x] Step 1: 为 SettingsContext 增加 custom provider 与持久化字段
- [x] Step 2: 新建 `resolveAiRuntimeConfig` 统一 provider 解析
- [x] Step 3: 新增测试覆盖 custom 配置解析与空 URL 回退

## Task 2: 服务层支持 OpenAI Compatible

**Files:**

- Modify: `services/aiOcr.ts`
- Modify: `services/aiAnalysis.ts`
- Test: `services/__tests__/aiOcr.customModels.test.ts`

- [x] Step 1: OCR 支持 custom provider + baseURL
- [x] Step 2: 新增 `listCustomOpenAiModels`（endpoint 优先，fallback baseURL/models）
- [x] Step 3: 持仓分析普通/流式接口支持 custom provider + baseURL
- [x] Step 4: 新增 custom models 拉取测试

## Task 3: UI 接入与设置页增强

**Files:**

- Modify: `components/SettingsPage.tsx`
- Modify: `components/ScannerModal.tsx`
- Modify: `components/AiHoldingsAnalysisModal.tsx`
- Modify: `services/i18n.tsx`
- Test: `components/__tests__/SettingsPage.aiCustomProvider.test.tsx`
- Modify: `components/__tests__/SettingsPage.gistSync.test.tsx`

- [x] Step 1: 设置页新增 `OpenAI Compatible` 提供方与配置卡片
- [x] Step 2: 模型交互支持“可选拉取 + 手动输入兜底”
- [x] Step 3: Scanner 与 Holdings Analysis 改为走统一 runtime config
- [x] Step 4: 补充 i18n key 与设置页相关测试

## Task 4: 质量与收尾

**Files:**

- Modify: `services/__tests__/db.backupWatchlist.unit.test.ts`

- [x] Step 1: 修复仓库内既有 lint error（`no-explicit-any`）
- [x] Step 2: 运行验证命令（`npm run test` / `npm run build` / `npm run lint`）
- [x] Step 3: 完成提交 `✨ feat(ai): add openai-compatible provider support`

---

## Verification Notes

- `npm run test`：通过（149/149）
- `npm run build`：通过
- `npm run lint`：无 error（存在 4 条历史 warning）
