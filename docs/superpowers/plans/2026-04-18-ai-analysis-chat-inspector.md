# AI Analysis Chat Inspector Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 AI 持仓分析弹窗改为“左侧窄会话栏 + 右侧宽聊天区 + 底部固定输入框 + 可开关分析抽屉”。

**Architecture:** 保持现有 `AiHoldingsAnalysisModal.tsx` 为主组件，不额外拆大型文件；通过新增 `inspectorOpen` 状态，把当前拥挤的持仓概览、收益对比、提醒设置和图表迁移到右侧分析抽屉。聊天区保留简洁摘要、消息流和固定输入区。

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Framer Motion, ECharts, Vitest, RTL

---

## Chunk 1: Tests first

### Task 1: 更新组件测试描述新布局

**Files:**
- Modify: `components/__tests__/AiHoldingsAnalysisModal.test.tsx`
- Modify: `components/__tests__/AiHoldingsAnalysisModal.integration.test.tsx`

- [ ] 写失败测试：默认显示聊天主区与分析面板按钮，而不是把图表直接塞在聊天区
- [ ] 运行测试确认失败

## Chunk 2: Minimal implementation

### Task 2: 添加分析抽屉状态与新布局

**Files:**
- Modify: `components/AiHoldingsAnalysisModal.tsx`

- [ ] 添加 `inspectorOpen` 状态与切换按钮
- [ ] 把持仓概览、提醒、图表从聊天主区迁移到右侧抽屉
- [ ] 在聊天主区顶部保留轻量摘要
- [ ] 保持底部输入框固定、消息区单独滚动

## Chunk 3: Verification

### Task 3: 验证

**Files:**
- Test: `components/__tests__/AiHoldingsAnalysisModal.test.tsx`
- Test: `components/__tests__/AiHoldingsAnalysisModal.integration.test.tsx`

- [ ] 运行针对性测试
- [ ] 运行 `npm run build`
