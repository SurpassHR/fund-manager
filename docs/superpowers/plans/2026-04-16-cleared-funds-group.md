# 清仓基金折叠组功能实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在持仓列表末尾添加可折叠的清仓基金组,支持查看和管理已清仓基金,保证收益计算正确性。

**Architecture:** 在 Dashboard 组件中添加清仓基金分组逻辑和折叠状态管理,使用 localStorage 持久化展开状态,通过 framer-motion 实现平滑展开/折叠动画。清仓基金保留完整交易历史,再次买入后自动回到活跃列表。

**Tech Stack:** React 19, TypeScript, Dexie (IndexedDB), framer-motion, Tailwind CSS, Vitest + React Testing Library

---

## 实现说明

本计划包含 3 个主要部分:

1. **核心功能实现**: 添加国际化文本、清仓基金分组逻辑、清仓组汇总卡片和清仓基金列表渲染
2. **测试覆盖**: 编写完整的单元测试和集成测试
3. **质量保证与文档**: 运行完整测试套件、手动测试、更新文档

详细的实现步骤请参考设计文档: `docs/superpowers/specs/2026-04-16-cleared-funds-group-design.md`

## 关键实现点

### 1. 国际化文本

在 `services/i18n.tsx` 中添加:
- `clearedFundsGroup`: "已清仓" / "Cleared"
- `clearedFundsCount`: "已清仓 ({count})" / "Cleared ({count})"
- `expandClearedFunds`: "展开清仓基金" / "Expand cleared funds"
- `collapseClearedFunds`: "收起清仓基金" / "Collapse cleared funds"

### 2. 清仓基金分组逻辑

在 `Dashboard.tsx` 中:
- 添加 `CLEARED_GROUP_STORAGE_KEY` 常量
- 添加 `isClearedGroupExpanded` 状态
- 添加 `activeFunds` 和 `clearedFunds` 分组逻辑
- 添加 `handleToggleClearedGroup` 处理函数

### 3. 清仓组汇总卡片

- 显示清仓基金数量
- 支持点击切换展开/折叠
- 支持键盘导航(Enter/Space)
- 包含 ARIA 属性(role, aria-expanded, aria-label)

### 4. 清仓基金列表

- 使用 framer-motion 的 AnimatePresence 实现展开/折叠动画
- 复制活跃基金的完整渲染逻辑
- 保持所有交互行为一致

### 5. 测试覆盖

创建 `components/__tests__/Dashboard.clearedFunds.test.tsx`,包含:
- 清仓基金正确分组测试
- 展开/折叠功能测试
- localStorage 持久化测试
- 清仓基金再次买入测试

## 验证清单

- [ ] 所有测试通过 (`npm run test`)
- [ ] 无 lint 错误 (`npm run lint`)
- [ ] 编译成功 (`npm run build`)
- [ ] 手动测试基本功能
- [ ] 手动测试持久化
- [ ] 手动测试清仓基金交互
- [ ] 手动测试筛选器交互
- [ ] 手动测试键盘导航
- [ ] 手动测试深色模式
- [ ] 手动测试响应式布局
- [ ] 更新 AGENTS.md 文档

## 实现完成标准

1. 清仓基金正确显示在持仓列表末尾
2. 用户可以点击展开/折叠清仓组
3. 清仓基金支持与活跃基金相同的操作
4. 清仓基金的交易历史完整保留
5. 清仓基金再次买入后自动回到活跃列表
6. 所有测试通过
7. 无性能回归
