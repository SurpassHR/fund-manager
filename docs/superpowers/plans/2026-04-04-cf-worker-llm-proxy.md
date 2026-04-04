# Cloudflare Worker LLM Proxy Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为生产环境提供 `/llm-proxy/*` 同源代理，解决浏览器跨域并保持前端现有调用协议不变（透传 Authorization）。

**Architecture:** 在 Cloudflare Worker 中实现一层轻量 HTTP 反向代理，读取 `X-LLM-Target-Endpoint` / `X-LLM-Target-Base-URL` 决定上游目标；前端继续请求 `/llm-proxy/*`。开发环境保留 Vite 中间件，生产环境由 Worker 承接。

**Tech Stack:** Cloudflare Workers (TypeScript), Wrangler, Vite + React 前端。

---

### Task 1: 新增 Worker 代理实现

**Files:**
- Create: `workers/llm-proxy/src/index.ts`

- [ ] **Step 1: 编写 Worker 路由与目标 URL 解析逻辑**
- [ ] **Step 2: 实现请求头透传与安全过滤（去除 Host 与内部目标头）**
- [ ] **Step 3: 增加 HTTPS 校验与可选上游 host 白名单（环境变量）**
- [ ] **Step 4: 增加错误响应（400/403/502）与 JSON 错误体**

### Task 2: 新增 Wrangler 配置与部署说明

**Files:**
- Create: `workers/llm-proxy/wrangler.toml`
- Create: `workers/llm-proxy/README.md`

- [ ] **Step 1: 写 wrangler 基础配置（name/main/compatibility_date）**
- [ ] **Step 2: 写部署文档（dev / publish / route 绑定 / 环境变量）**
- [ ] **Step 3: 补充与前端协议一致的请求头约定说明**

### Task 3: 回归验证

**Files:**
- Modify: `none`

- [ ] **Step 1: 运行 `npm run lint`**
- [ ] **Step 2: 运行 `npm run test -- --run`**
- [ ] **Step 3: 运行 `npm run build`**
