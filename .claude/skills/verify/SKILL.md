---
name: verify
description: Run lint and tests to verify changes before marking a task complete. Use this after making non-trivial edits, especially before claiming work is done.
---

# /verify

Run the full verification pipeline for this repo.

## Command sequence

```bash
npm run lint && npm run test
```

- `npm run lint` → ESLint over the whole project (ignores `dist`, `node_modules`)
- `npm run test` → Vitest in run mode (CI-style, no watch)

## Notes

- 单文件 lint: `npm run lint -- components/Dashboard.tsx`
- 单测试文件: `npm run test -- components/Watchlist.test.tsx`
- 按名称过滤: `npm run test -- -t "renders watchlist"`
- 若只改了非代码文件（README/docs），可以跳过本命令。
- 测试环境为 jsdom，canvas 不可用；新增 ECharts 初始化时保留测试环境保护（参见 AGENTS.md "AI 持仓分析开发约定"）。

## What to report

- 通过时输出简短成功摘要。
- 失败时列出具体报错，指向文件与行号，不要替用户猜测修复。
