# Telegram AI 持仓定时提醒 Worker

这个 Worker 会按 Cloudflare Cron 定时读取 GitHub Gist 中的 `fund-manager-sync.json`，调用 AI 生成持仓分析，并发送到指定 Telegram 聊天。

## 准备 Telegram Bot

1. 在 Telegram 搜索 `@BotFather`。
2. 发送 `/newbot` 创建机器人。
3. 记录 BotFather 返回的 `TELEGRAM_BOT_TOKEN`。
4. 给新机器人发送一条任意消息。
5. 访问下面地址获取 `chat_id`：

```text
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getUpdates
```

返回 JSON 里 `message.chat.id` 就是 `TELEGRAM_CHAT_ID`。

## 准备 Gist 同步

1. 在小胡养基应用设置页配置 GitHub Gist 同步。
2. 上传一次数据，确保 Gist 中存在 `fund-manager-sync.json`。
3. 记录该 Gist 的 ID。
4. GitHub Token 至少需要能读取这个私有 Gist。

## 配置密钥

进入当前目录：

```bash
cd workers/telegram-ai-reminder
```

依次写入密钥：

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put GIST_ID
npx wrangler secret put AI_API_KEY
npx wrangler secret put AI_MODEL
```

如果使用 OpenAI 兼容接口，还需要：

```bash
npx wrangler secret put AI_BASE_URL
```

可选：为手动触发接口 `/run` 增加保护。

```bash
npx wrangler secret put CRON_SECRET
```

## AI Provider

`wrangler.toml` 默认：

```toml
AI_PROVIDER = "customOpenAi"
AI_MODE = "deep"
```

支持值：

- `customOpenAi`：OpenAI 兼容接口，需要 `AI_BASE_URL`。
- `openai`：官方 OpenAI，自动使用 `https://api.openai.com/v1`。
- `deepseek`：自动使用 `https://api.deepseek.com/v1`。
- `gemini`：使用 Gemini REST API。

常见示例：

```bash
# DeepSeek
AI_PROVIDER=deepseek
AI_MODEL=deepseek-chat

# OpenAI Compatible
AI_PROVIDER=customOpenAi
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini

# Gemini
AI_PROVIDER=gemini
AI_MODEL=gemini-1.5-flash
```

## 定时配置

当前 Cron：

```toml
crons = ["30 7 * * 1-5"]
```

含义：Cloudflare 使用 UTC，对应北京时间工作日 `15:30`。

如果要改为北京时间每天 `21:00`：

```toml
crons = ["0 13 * * *"]
```

## 本地调试

```bash
npx wrangler dev
```

手动触发：

```bash
curl -X POST http://localhost:8789/run
```

如果配置了 `CRON_SECRET`：

```bash
curl -X POST http://localhost:8789/run \
  -H "Authorization: Bearer <CRON_SECRET>"
```

## 部署

```bash
npx wrangler deploy
```

部署后可在 Cloudflare Workers 的 Triggers 页面确认 Cron 已启用。

## 注意事项

- 不要把 `TELEGRAM_BOT_TOKEN`、`GITHUB_TOKEN`、`AI_API_KEY` 写进代码或提交到仓库。
- Telegram 单条消息有限制，Worker 会自动拆分长分析结果。
- Worker 读取的是最近一次同步到 Gist 的数据；如果前端没有上传新数据，分析也会基于旧快照。
- 发送内容为普通文本，避免 Telegram Markdown 特殊字符导致发送失败。
