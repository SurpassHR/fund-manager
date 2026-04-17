# Presence Tracker Worker

在线状态追踪 Worker，基于 Cloudflare KV 实现心跳式用户计数。

## 功能

- **当前在线人数** — 基于 30s 心跳，90s 未响应视为离线
- **峰值人数** — 历史最高并发
- **累计不同访客** — 基于 localStorage 持久化的 visitor ID

## API

| Method | Path | Body | 说明 |
|--------|------|------|------|
| `GET` | `/stats` | — | 读取统计（只读） |
| `POST` | `/heartbeat` | `{ sid, uid }` | 上报心跳，返回统计 |
| `DELETE` | `/session` | `{ sid }` | 显式断开连接 |

## 部署

```bash
cd workers/presence

# 1. 创建 KV namespace
npx wrangler kv namespace create PRESENCE

# 2. 将输出的 id 填入 wrangler.toml

# 3. 部署
npx wrangler deploy
```

## 前端配置

在 `.env` 或 GitHub Actions secrets 中设置：

```
VITE_PRESENCE_WORKER_URL=https://gp.hrfuqiang.top/presence
```

未设置时，Header 中的在线人数图标自动隐藏。
