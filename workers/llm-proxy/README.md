# LLM Proxy Worker（Cloudflare）

## 目标

为前端统一提供同源路径 `/llm-proxy/*`，避免浏览器跨域限制。

当前策略为 **A 方案：透传前端 Authorization**：
- 前端继续携带 `Authorization: Bearer xxx`
- Worker 不保存第三方模型密钥，仅转发请求

---

## 请求协议（与前端现有实现一致）

前端请求固定走同源路径：
- `POST /llm-proxy/chat/completions`
- `GET /llm-proxy/models`

并通过以下头指定上游：

1. `X-LLM-Target-Endpoint`（完整上游 URL，优先级更高）
2. `X-LLM-Target-Base-URL`（上游 base URL，Worker 会拼接当前请求 path/query）

示例：

```http
GET /llm-proxy/models
Authorization: Bearer sk-xxx
X-LLM-Target-Endpoint: https://ice.v.ua/v1/models
```

```http
POST /llm-proxy/chat/completions
Authorization: Bearer sk-xxx
X-LLM-Target-Base-URL: https://ice.v.ua/v1
Content-Type: application/json
```

---

## 本地调试

```bash
cd workers/llm-proxy
npx wrangler dev
```

默认监听 `http://127.0.0.1:8787`。

---

## 部署到 Cloudflare

```bash
cd workers/llm-proxy
npx wrangler login
npx wrangler deploy
```

部署后在 Cloudflare Dashboard 为 Worker 绑定路由：

- 推荐：`你的站点域名/llm-proxy/*`

确保你的前端页面与该路由在**同一域名**下，这样浏览器就是同源请求，不会触发 CORS 拦截。

---

## 可选安全加固（建议）

通过 `LLM_PROXY_ALLOWED_HOSTS` 限制可转发上游主机（逗号分隔）：

```toml
[vars]
LLM_PROXY_ALLOWED_HOSTS = "api.openai.com,ice.v.ua,generativelanguage.googleapis.com"
```

若请求目标主机不在列表中，Worker 返回 403。
