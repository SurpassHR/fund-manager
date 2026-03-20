# UI/UX Editorial Overhaul Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有基金管理应用升级为具有“金融终端 × 编辑杂志感”的高辨识度界面，在不破坏现有数据与交互主流程的前提下，统一全局视觉语言、增强信息层级与关键页面体验。

**Architecture:** 以现有 React + Tailwind 结构为基础，不大规模改动信息架构，而是通过全局主题变量、壳层背景、头部/底部导航重构，以及 Dashboard / SettingsPage 的局部重新编排完成体验升级。优先保持已有业务逻辑和测试稳定，仅对视觉容器、排版、层次、状态表达和局部交互进行结构化增强。

**Tech Stack:** React 19、TypeScript、Vite、Tailwind CSS v4、framer-motion、Vitest、React Testing Library

---

## File Structure Map

- **Modify:** `app.css`
  - 建立新的全局主题变量、字体栈、背景纹理、公共面板样式、滚动与发光细节。
- **Modify:** `App.tsx`
  - 重构应用壳层、主背景、页面宽度与全局装饰层，让 Header / main / BottomNav 形成统一舞台。
- **Modify:** `components/Header.tsx`
  - 重做顶部头部，加入更强品牌感、市场晨报式标题区、状态/操作分层。
- **Modify:** `components/BottomNav.tsx`
  - 重做底部导航为更有终端感的悬浮面板，强化当前 tab 的灯带与层级。
- **Modify:** `components/Dashboard.tsx`
  - 优化资产总览、筛选条、列表卡片、操作区的层次和节奏，保留现有业务行为。
- **Modify:** `components/SettingsPage.tsx`
  - 重构设置页为更像“控制台”的分区布局，提升 AI / 数据 / 同步设置的信息设计。
- **Modify/Test as needed:** `components/Header.test.tsx`
  - 若头部文案或可访问名称变化，更新测试查询。
- **Modify/Test as needed:** `components/BottomNav.test.tsx`
  - 若导航按钮结构变化，保持 active indicator 相关测试继续有效。

---

## Chunk 1: Global Shell + Theme Language

### Task 1: 全局视觉地基

**Files:**
- Modify: `app.css`
- Modify: `App.tsx`

- [ ] **Step 1: 先阅读并确认现有全局壳层依赖点**

检查 `App.tsx` 中 `Header`、`AnimatedSwitcher`、`Ticker`、`BottomNav` 的布局顺序，以及 `app.css` 当前主题变量。

- [ ] **Step 2: 在 `app.css` 中写入新的主题变量与公共外观层**

实现内容应包含：
- 更有性格的字体栈（避免继续使用 Roboto/默认系统观感作为唯一主字体）
- 深色主舞台背景变量
- 金属/终端感边框、发光、渐变雾面、纹理噪点类
- 通用面板类，例如：
  - `.editorial-shell`
  - `.terminal-panel`
  - `.terminal-grid`
  - `.signal-dot`
  - `.noise-overlay`

- [ ] **Step 3: 在 `App.tsx` 中重构根容器布局**

将原本普通背景容器升级为分层舞台：
- 背景渐变 / 辐射光斑 / 噪点叠层
- 主内容区使用更清晰的宽度与底部留白
- 保持 `Header -> main -> Ticker -> BottomNav` 功能顺序不变
- 不改动 `activeTab`、overlay、edge swipe 业务逻辑

- [ ] **Step 4: 运行类型检查与构建**

Run: `npm run build`
Expected: build pass

---

## Chunk 2: Header + Bottom Navigation Refresh

### Task 2: 顶部头部改造成“市场晨报”风格

**Files:**
- Modify: `components/Header.tsx`
- Test: `components/Header.test.tsx`

- [ ] **Step 1: 先补/调整头部测试预期**

确认这些行为仍被覆盖：
- 标题仍可见
- 语言切换按钮仍可点击/可访问
- changelog 事件仍会 dispatch

- [ ] **Step 2: 实现新的 Header 结构**

设计要求：
- 左侧不再是随意头像块，而是更像品牌徽记 / masthead
- 标题区体现“基金晨报 / 市场面板”式层次，可包含小号 eyebrow 文案
- 右侧操作区统一成胶囊/面板按钮体系
- 保持 `toggleLanguage` 与 `openChangelog` 行为不变
- 避免引入无用途按钮；`Search` / `Chat` 可以保留为视觉操作入口但样式需统一

- [ ] **Step 3: 运行头部测试**

Run: `npm run test -- components/Header.test.tsx`
Expected: PASS

### Task 3: 底部导航改造成悬浮终端面板

**Files:**
- Modify: `components/BottomNav.tsx`
- Test: `components/BottomNav.test.tsx`

- [ ] **Step 1: 保留现有 active indicator 测试目标**

继续保留 `data-testid="bottom-nav-active-indicator"`，减少测试改动面。

- [ ] **Step 2: 实现新的 BottomNav 视觉层**

设计要求：
- 导航容器不再是贴边白条，而是悬浮、半透明、带边框与阴影的控制面板
- 激活态有更强的灯带/底色/缩放，但不破坏原有 `framer-motion` 动画逻辑
- 标签与图标要有更清晰的层级，移动端点击区域保持充足

- [ ] **Step 3: 运行底部导航测试**

Run: `npm run test -- components/BottomNav.test.tsx`
Expected: PASS

---

## Chunk 3: Dashboard Information Hierarchy Upgrade

### Task 4: 首页资产总览与筛选区重排

**Files:**
- Modify: `components/Dashboard.tsx`

- [ ] **Step 1: 只改布局与样式，不碰核心计算逻辑**

保持以下逻辑不变：
- `calculateSummary`
- `refreshFundData`
- 排序逻辑
- context menu / modal / selectedFund 主流程

- [ ] **Step 2: 重构顶部筛选条与总览卡视觉**

目标：
- 筛选区更像“市场分栏”而不是普通 tab 条
- 总览卡突出总资产、累计收益、当日收益三层信息
- 刷新按钮的冷却状态表达更高级但逻辑不变
- 保持 `showValues`、`cooldown`、`isRefreshing` 行为一致

- [ ] **Step 3: 优化列表头与持仓列表项的可读性**

目标：
- 让行信息更像终端行情卡片
- 保留桌面/移动双布局
- 强化 fund code / platform / estimated tag / 数值颜色的视觉秩序
- 避免改变点击行为与长按菜单逻辑

- [ ] **Step 4: 重构底部快捷操作区与 AI 分析入口**

目标：
- 操作按钮统一为同一视觉系统
- AI 持仓分析入口变成高辨识度 spotlight 模块

- [ ] **Step 5: 运行 Dashboard 相关诊断**

Run: `npm run build`
Expected: build pass

---

## Chunk 4: Settings Console Redesign

### Task 5: 设置页改造成控制台式分区体验

**Files:**
- Modify: `components/SettingsPage.tsx`

- [ ] **Step 1: 保留视图切换状态机，不改 `activeView` 逻辑**

保留：
- `main | ai | gist`
- token 校验 / gist 同步 / import/export / AI model 加载的现有行为

- [ ] **Step 2: 重构主设置页布局**

目标：
- 顶部不是简单标题，而是带说明的控制台封面
- `theme / features / AI / data / sync` 五块形成统一的 section 语言
- 列表项从“普通设置按钮”升级为更具仪表盘感的卡片行

- [ ] **Step 3: 重构 AI 设置页布局**

目标：
- OpenAI / Gemini 配置形成两个更明确的配置区
- 输入框、下拉框、说明文字采用统一控制台表单样式
- 保持原有 state / effects / model fetching 行为

- [ ] **Step 4: 重构 Gist 同步页布局**

目标：
- token、校验状态、默认目标、操作按钮形成更清晰的操作流
- 让“格式校验 / API 校验 / 可用 gist 状态”层级更清楚
- 保持 `GistSyncChooserCard` 的接线方式不变，除非样式需要轻微包裹

- [ ] **Step 5: 运行构建，确保 TS/JSX 无回归**

Run: `npm run build`
Expected: build pass

---

## Chunk 5: Final Verification

### Task 6: 回归验证与质量收尾

**Files:**
- Verify affected files above
- Test: `components/Header.test.tsx`
- Test: `components/BottomNav.test.tsx`

- [ ] **Step 1: 运行局部测试**

Run: `npm run test -- components/Header.test.tsx components/BottomNav.test.tsx`
Expected: PASS

- [ ] **Step 2: 运行 LSP 诊断**

Run via diagnostics tool on modified files or project-wide where feasible.
Expected: no new blocking diagnostics in touched files

- [ ] **Step 3: 运行完整构建**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: 运行完整测试并记录基线问题**

Run: `npm run test`
Expected: existing pre-existing failures may remain in `components/SettingsPage.gistSync.test.tsx`; no new failures introduced by this UI/UX overhaul

- [ ] **Step 5: 汇总变更说明**

记录：
- 修改了哪些文件
- 新视觉方向具体落地在哪些区域
- 验证结果
- 若仍有测试失败，明确说明是既有基线问题还是新引入问题
