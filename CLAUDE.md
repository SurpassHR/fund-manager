## CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Authoritative repo guidance

本仓库的完整开发约定（构建/测试/代码风格/AI 分析约定/EastMoney API/QDII-港股-ETF 估值域规则）维护在 AGENTS.md。以下导入使其在每次会话都完整加载:

@AGENTS.md

与 GEMINI.md 冲突时以 AGENTS.md 为准（GEMINI.md 可能已过时）。

## Claude-specific notes

- 完成任务前运行 `/verify`（`npm run lint && npm run test`）再汇报完成。
- 仅修改 `.ts/.tsx/.css/.md` 时由 PostToolUse hook 自动调用 `npx prettier --write`，无需手动格式化。
- 本地多 worktree 位于 `.worktrees/`；在根仓库下的工作会自动继承本文件。
