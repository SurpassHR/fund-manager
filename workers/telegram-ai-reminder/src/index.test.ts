/// <reference types="vitest/globals" />
import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';

import worker from './index';

ed.hashes.sha512 = (...messages) => sha512(ed.etc.concatBytes(...messages));

const backupPayload = {
  version: 1,
  exportDate: '2026-05-18T10:00:00.000Z',
  investmentProfile: {
    riskTolerance: '稳健',
    investmentHorizon: '3-5年',
    externalAssets: '现金 5 万',
  },
  funds: [
    {
      code: '000001',
      name: '测试基金A',
      platform: '默认账户',
      holdingShares: 100,
      costPrice: 1,
      currentNav: 1.2,
      lastUpdate: '2026-05-18',
      dayChangePct: 1.5,
      dayChangeVal: 1.8,
    },
  ],
  watchlists: [
    {
      code: '000001',
      name: '测试基金A',
      type: 'fund',
      platform: '默认账户',
      anchorPrice: 1.1,
      anchorDate: '2026-05-01',
      currentPrice: 1.2,
      dayChangePct: 1.5,
      lastUpdate: '2026-05-18',
    },
    {
      code: '000002',
      name: '未持有基金B',
      type: 'fund',
      platform: '默认账户',
      anchorPrice: 1.5,
      anchorDate: '2026-05-01',
      currentPrice: 1.35,
      dayChangePct: -0.8,
      lastUpdate: '2026-05-18',
    },
    {
      code: 'sh000300',
      name: '沪深300',
      type: 'index',
      anchorPrice: 4000,
      anchorDate: '2026-05-01',
      currentPrice: 4100,
      dayChangePct: 0.3,
      lastUpdate: '2026-05-18',
    },
  ],
};

const backupPayloadWithoutBuildCandidates = {
  ...backupPayload,
  watchlists: backupPayload.watchlists.filter((item) => item.code !== '000002'),
};

const holdingsPayload = {
  data: {
    portfolioDate: '2026-03-31',
    equityHoldings: [
      { ticker: '600519', name: '贵州茅台', weight: 8.5, sector: '消费' },
      { ticker: '300750', name: '宁德时代', weight: 5.2, sector: '新能源' },
    ],
  },
};

const marketText =
  'v_sh000001="1~上证指数~000001~3050.12~~~~~~~~~~~~~~~~~~~~~~~~~~~20260518150000~12.34~0.41";\n' +
  'v_sz399006="51~创业板指~399006~2200.50~~~~~~~~~~~~~~~~~~~~~~~~~~~20260518150000~-8.80~-0.40";';

const eastMoneyNewsPayload = {
  data: {
    list: [
      {
        title: 'A股人工智能板块午后走强',
        mediaName: '东方财富',
        url: 'https://finance.eastmoney.com/a/test.html',
        showTime: '2026-05-18 12:00:00',
      },
    ],
  },
};

const sinaNewsPayload = {
  result: {
    data: [
      {
        title: '新能源板块震荡回升',
        source: '新浪财经',
        url: 'https://finance.sina.com.cn/test.html',
        ctime: String(Math.floor(Date.now() / 1000)),
      },
    ],
  },
};

const emptyEastMoneyNewsPayload = { data: { list: [] } };
const emptySinaNewsPayload = { result: { data: [] } };
const eastMoneyFundFlowPayload = {
  data: {
    diff: [
      { f12: 'BK0800', f14: '人工智能', f3: 2.1, f62: 3200000000, f184: 4.5 },
      { f12: 'BK0428', f14: '新能源', f3: 1.2, f62: 1800000000, f184: 2.8 },
    ],
  },
};

const env = {
  TELEGRAM_BOT_TOKEN: 'telegram-token',
  TELEGRAM_CHAT_ID: '123456',
  GITHUB_TOKEN: 'github-token',
  GIST_ID: 'gist-id',
  GIST_FILENAME: 'fund-manager-sync.json',
  AI_PROVIDER: 'customOpenAi',
  AI_API_KEY: 'ai-token',
  AI_MODEL: 'test-model',
  AI_BASE_URL: 'https://example.com/v1',
  AI_MODE: 'deep',
  AI_QUESTION:
    '请基于当前持仓、A 股市场指数、市场情绪、中文财经新闻和投资画像，重点判断当前是否适合加仓、是否需要减仓、是否达到清仓条件。',
};

const qqEnv = {
  ...env,
  QQ_OFFICIAL_ENABLED: 'true',
  QQ_OFFICIAL_APP_ID: '1903963785',
  QQ_OFFICIAL_APP_SECRET: 'test-secret',
  QQ_OFFICIAL_ALLOWED_GROUP_OPENIDS: 'group-openid',
  QQ_OFFICIAL_ALLOWED_MEMBER_OPENIDS: 'member-openid',
};

const oneBotEnv = {
  ...env,
  QQ_BOT_ENABLED: 'true',
  QQ_BOT_API_BASE: 'https://onebot.example',
  QQ_BOT_ACCESS_TOKEN: 'onebot-token',
  QQ_ALLOWED_GROUP_IDS: '123456789',
  QQ_ALLOWED_USER_IDS: '987654321',
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const mockBaseSuccessfulFetches = (
  fetchMock: ReturnType<typeof vi.fn>,
  eastMoneyNews = eastMoneyNewsPayload,
  sinaNews = sinaNewsPayload,
) => {
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('api.github.com/gists')) {
      return Promise.resolve(
        jsonResponse({
          files: {
            'fund-manager-sync.json': {
              content: JSON.stringify(backupPayload),
            },
          },
        }),
      );
    }
    if (url.includes('morningstar.cn')) return Promise.resolve(jsonResponse(holdingsPayload));
    if (url.includes('qt.gtimg.cn')) return Promise.resolve(new Response(marketText));
    if (url.includes('np-listapi.eastmoney.com')) return Promise.resolve(jsonResponse(eastMoneyNews));
    if (url.includes('push2.eastmoney.com/api/qt/clist/get')) {
      return Promise.resolve(jsonResponse(eastMoneyFundFlowPayload));
    }
    if (url.includes('feed.mix.sina.com.cn')) return Promise.resolve(jsonResponse(sinaNews));
    if (url.includes('chat/completions')) {
      return Promise.resolve(jsonResponse({ choices: [{ message: { content: '组合整体表现良好。' } }] }));
    }
    if (url.includes('generativelanguage.googleapis.com')) {
      return Promise.resolve(
        jsonResponse({ candidates: [{ content: { parts: [{ text: 'Gemini 分析' }] } }] }),
      );
    }
    if (url.includes('api.telegram.org')) return Promise.resolve(jsonResponse({ ok: true }));
    return Promise.resolve(jsonResponse({}));
  });
};

const findAiRequestBody = (fetchMock: ReturnType<typeof vi.fn>) => {
  const call = fetchMock.mock.calls.find((item) => String(item[0]).includes('/chat/completions'));
  if (!call) throw new Error('AI request not found');
  return JSON.parse(call[1].body as string) as { messages: Array<{ role: string; content: string }> };
};

const waitForScheduledTasks = async (tasks: Promise<unknown>[]) => {
  await Promise.all(tasks);
};

const buildQqRequest = (body: unknown, headers?: HeadersInit) =>
  new Request('https://worker.example/qq-official', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

const buildOneBotRequest = (body: unknown) =>
  new Request('https://worker.example/qq', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const buildQqSeed = (secret: string) => {
  let seed = secret;
  while (seed.length < 32) seed += seed;
  return new TextEncoder().encode(seed.slice(0, 32));
};

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

const buildSignedQqRequest = async (body: unknown, secret = qqEnv.QQ_OFFICIAL_APP_SECRET) => {
  const rawBody = JSON.stringify(body);
  const timestamp = '1725442341';
  const signature = bytesToHex(
    await ed.sign(new TextEncoder().encode(`${timestamp}${rawBody}`), buildQqSeed(secret)),
  );
  return new Request('https://worker.example/qq-official', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signature-Ed25519': signature,
      'X-Signature-Timestamp': timestamp,
    },
    body: rawBody,
  });
};

describe('telegram ai reminder worker', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('读取 Gist 持仓、调用 AI 并发送 Telegram', async () => {
    const fetchMock = vi.fn();
    mockBaseSuccessfulFetches(fetchMock);
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(
      new Request('https://worker.example/run', { method: 'POST' }),
      env,
    );
    const body = (await response.json()) as {
      ok: boolean;
      holdings: number;
      totalAssets: number;
      sentMessages: number;
    };

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, holdings: 1, totalAssets: 120, sentMessages: 1 });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/gists/gist-id',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer github-token' }) }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.morningstar.cn/cn-api/v2/funds/000001/holdings',
      expect.objectContaining({ headers: expect.objectContaining({ Accept: 'application/json' }) }),
    );
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('https://qt.gtimg.cn/q='))).toBe(true);
    expect(
      fetchMock.mock.calls.some((call) => String(call[0]).includes('https://np-listapi.eastmoney.com')),
    ).toBe(true);
    const aiBody = findAiRequestBody(fetchMock);
    expect(aiBody.messages[0].content).toContain('测试基金A');
    expect(aiBody.messages[0].content).toContain('贵州茅台');
    expect(aiBody.messages[0].content).toContain('dataCoverage');
    expect(aiBody.messages[0].content).toContain('稳健');
    expect(aiBody.messages[0].content).toContain('风险承受能力: available');
    expect(aiBody.messages[0].content).toContain('marketSnapshot');
    expect(aiBody.messages[0].content).toContain('newsSnapshot');
    expect(aiBody.messages[0].content).toContain('fundFlowSnapshot');
    expect(aiBody.messages[0].content).toContain('上证指数');
    expect(aiBody.messages[0].content).toContain('A股人工智能板块午后走强');
    expect(aiBody.messages[0].content).toContain('资金流入最强方向: 人工智能');
    expect(aiBody.messages[0].content).toContain('资金流数据: available');
    expect(aiBody.messages[0].content).toContain('今日加仓候选');
    expect(aiBody.messages[0].content).toContain('不得编造新闻标题、财报数据、公告内容或资金流数据');
    expect(aiBody.messages[0].content).toContain('不要编造不存在的数据');
    expect(aiBody.messages[0].content).toContain('buildCandidates');
    expect(aiBody.messages[0].content).toContain('未持有基金B');
    expect(aiBody.messages[0].content).toContain('未持有自选建仓候选数量: 1');
    expect(aiBody.messages[0].content).toContain('资金流兜底建仓候选数量:');
    expect(aiBody.messages[1].content).toContain('是否适合加仓');

    const telegramCall = fetchMock.mock.calls.find((call) => String(call[0]).includes('api.telegram.org'));
    expect(telegramCall).toBeTruthy();
    const telegramBody = JSON.parse(telegramCall?.[1].body as string) as {
      chat_id: string;
      text: string;
    };
    expect(telegramCall?.[0]).toBe('https://api.telegram.org/bottelegram-token/sendMessage');
    expect(telegramBody.chat_id).toBe('123456');
    expect(telegramBody.text).toContain('养基AI持仓分析');
    expect(telegramBody.text).toContain('组合整体表现良好。');
  });

  it('配置 CRON_SECRET 后拒绝未授权手动触发', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(
      new Request('https://worker.example/run', { method: 'POST' }),
      { ...env, CRON_SECRET: 'secret' },
    );
    const body = (await response.json()) as { ok: boolean; error: string };

    expect(response.status).toBe(401);
    expect(body).toEqual({ ok: false, error: '未授权' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('长分析结果会拆分为多条 Telegram 消息', async () => {
    const longText = '分析'.repeat(2500);
    const fetchMock = vi.fn();
    mockBaseSuccessfulFetches(fetchMock, emptyEastMoneyNewsPayload, emptySinaNewsPayload);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('chat/completions')) {
        return Promise.resolve(jsonResponse({ choices: [{ message: { content: longText } }] }));
      }
      if (url.includes('api.github.com/gists')) {
        return Promise.resolve(
          jsonResponse({ files: { 'fund-manager-sync.json': { content: JSON.stringify(backupPayload) } } }),
        );
      }
      if (url.includes('morningstar.cn')) return Promise.resolve(jsonResponse(holdingsPayload));
      if (url.includes('qt.gtimg.cn')) return Promise.resolve(new Response(marketText));
      if (url.includes('np-listapi.eastmoney.com')) return Promise.resolve(jsonResponse(emptyEastMoneyNewsPayload));
      if (url.includes('push2.eastmoney.com/api/qt/clist/get')) {
        return Promise.resolve(jsonResponse(eastMoneyFundFlowPayload));
      }
      if (url.includes('feed.mix.sina.com.cn')) return Promise.resolve(jsonResponse(emptySinaNewsPayload));
      if (url.includes('api.telegram.org')) return Promise.resolve(jsonResponse({ ok: true }));
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(
      new Request('https://worker.example/run', { method: 'POST' }),
      env,
    );
    const body = (await response.json()) as { sentMessages: number };

    expect(response.status).toBe(200);
    expect(body.sentMessages).toBeGreaterThan(1);
    const telegramCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes('api.telegram.org'),
    );
    expect(telegramCalls).toHaveLength(body.sentMessages);
  });

  it('DeepSeek provider 使用内置 OpenAI 兼容地址', async () => {
    const fetchMock = vi.fn();
    mockBaseSuccessfulFetches(fetchMock);
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(
      new Request('https://worker.example/run', { method: 'POST' }),
      { ...env, AI_PROVIDER: 'deepseek', AI_BASE_URL: undefined },
    );

    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls.some((call) => call[0] === 'https://api.deepseek.com/v1/chat/completions')).toBe(true);
  });

  it('Gemini provider 使用 Gemini REST API', async () => {
    const fetchMock = vi.fn();
    mockBaseSuccessfulFetches(fetchMock);
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(
      new Request('https://worker.example/run', { method: 'POST' }),
      { ...env, AI_PROVIDER: 'gemini', AI_MODEL: 'gemini-1.5-flash', AI_BASE_URL: undefined },
    );

    expect(response.status).toBe(200);
    expect(
      fetchMock.mock.calls.some(
        (call) =>
          call[0] ===
          'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=ai-token',
      ),
    ).toBe(true);
  });

  it('东方财富失败但新浪成功时标记为 available', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('api.github.com/gists')) {
        return Promise.resolve(
          jsonResponse({ files: { 'fund-manager-sync.json': { content: JSON.stringify(backupPayload) } } }),
        );
      }
      if (url.includes('morningstar.cn')) return Promise.resolve(jsonResponse(holdingsPayload));
      if (url.includes('qt.gtimg.cn')) return Promise.resolve(new Response(marketText));
      if (url.includes('np-listapi.eastmoney.com')) return Promise.resolve(jsonResponse({}, 500));
      if (url.includes('push2.eastmoney.com/api/qt/clist/get')) {
        return Promise.resolve(jsonResponse(eastMoneyFundFlowPayload));
      }
      if (url.includes('feed.mix.sina.com.cn')) return Promise.resolve(jsonResponse(sinaNewsPayload));
      if (url.includes('chat/completions')) {
        return Promise.resolve(jsonResponse({ choices: [{ message: { content: '部分失败分析' } }] }));
      }
      if (url.includes('api.telegram.org')) return Promise.resolve(jsonResponse({ ok: true }));
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(
      new Request('https://worker.example/run', { method: 'POST' }),
      env,
    );

    expect(response.status).toBe(200);
    const aiBody = findAiRequestBody(fetchMock);
    expect(aiBody.messages[0].content).toContain('消息面/财报/公告数据: available');
    expect(aiBody.messages[0].content).toContain('failedSources');
    expect(aiBody.messages[0].content).toContain('新能源板块震荡回升');
  });

  it('新闻为空时在 prompt 中标记消息面缺失', async () => {
    const fetchMock = vi.fn();
    mockBaseSuccessfulFetches(fetchMock, emptyEastMoneyNewsPayload, emptySinaNewsPayload);
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(
      new Request('https://worker.example/run', { method: 'POST' }),
      env,
    );

    expect(response.status).toBe(200);
    const aiBody = findAiRequestBody(fetchMock);
    expect(aiBody.messages[0].content).toContain('消息面/财报/公告数据: missing');
    expect(aiBody.messages[0].content).toContain('可用中文财经新闻项');
  });

  it('所有中文财经新闻源失败时标记为 failed 且不等同于无新闻', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('api.github.com/gists')) {
        return Promise.resolve(
          jsonResponse({ files: { 'fund-manager-sync.json': { content: JSON.stringify(backupPayload) } } }),
        );
      }
      if (url.includes('morningstar.cn')) return Promise.resolve(jsonResponse(holdingsPayload));
      if (url.includes('qt.gtimg.cn')) return Promise.resolve(new Response(marketText));
      if (url.includes('np-listapi.eastmoney.com')) return Promise.resolve(jsonResponse({}, 500));
      if (url.includes('push2.eastmoney.com/api/qt/clist/get')) {
        return Promise.resolve(jsonResponse(eastMoneyFundFlowPayload));
      }
      if (url.includes('feed.mix.sina.com.cn')) return Promise.resolve(jsonResponse({}, 429));
      if (url.includes('chat/completions')) {
        return Promise.resolve(jsonResponse({ choices: [{ message: { content: '失败分析' } }] }));
      }
      if (url.includes('api.telegram.org')) return Promise.resolve(jsonResponse({ ok: true }));
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(
      new Request('https://worker.example/run', { method: 'POST' }),
      env,
    );

    expect(response.status).toBe(200);
    const aiBody = findAiRequestBody(fetchMock);
    expect(aiBody.messages[0].content).toContain('消息面/财报/公告数据: failed');
    expect(aiBody.messages[0].content).toContain('中文财经新闻接口失败，消息面/财报/公告暂不可用');
    expect(aiBody.messages[0].content).toContain('不得说成近 72 小时无新闻');
  });

  it('资金流失败时要求降级且不编造资金流', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('api.github.com/gists')) {
        return Promise.resolve(
          jsonResponse({ files: { 'fund-manager-sync.json': { content: JSON.stringify(backupPayload) } } }),
        );
      }
      if (url.includes('morningstar.cn')) return Promise.resolve(jsonResponse(holdingsPayload));
      if (url.includes('qt.gtimg.cn')) return Promise.resolve(new Response(marketText));
      if (url.includes('np-listapi.eastmoney.com')) return Promise.resolve(jsonResponse(eastMoneyNewsPayload));
      if (url.includes('push2.eastmoney.com/api/qt/clist/get')) {
        return Promise.resolve(jsonResponse({}, 500));
      }
      if (url.includes('feed.mix.sina.com.cn')) return Promise.resolve(jsonResponse(sinaNewsPayload));
      if (url.includes('chat/completions')) {
        return Promise.resolve(jsonResponse({ choices: [{ message: { content: '资金流失败分析' } }] }));
      }
      if (url.includes('api.telegram.org')) return Promise.resolve(jsonResponse({ ok: true }));
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(
      new Request('https://worker.example/telegram', {
        method: 'POST',
        body: JSON.stringify({ message: { text: '建仓', chat: { id: 123456 } } }),
      }),
      env,
    );

    expect(response.status).toBe(200);
    const aiBody = findAiRequestBody(fetchMock);
    expect(aiBody.messages[0].content).toContain('资金流数据: failed');
    expect(aiBody.messages[0].content).toContain('资金流数据暂不可用');
    expect(aiBody.messages[0].content).toContain('不得编造资金流入方向或金额');
    expect(aiBody.messages[1].content).toContain('资金流数据暂不可用，本次仅基于市场情绪和新闻利好判断');
  });

  it('Telegram 发送“分析”会触发短版分析并回复当前 chat', async () => {
    const fetchMock = vi.fn();
    mockBaseSuccessfulFetches(fetchMock);
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(
      new Request('https://worker.example/telegram', {
        method: 'POST',
        headers: { 'X-Telegram-Bot-Api-Secret-Token': 'webhook-secret' },
        body: JSON.stringify({ message: { text: '分析', chat: { id: 123456 } } }),
      }),
      { ...env, TELEGRAM_WEBHOOK_SECRET: 'webhook-secret' },
    );
    const body = (await response.json()) as { ok: boolean; handled: string; sentMessages: number };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.handled).toBe('analysis');
    expect(body.sentMessages).toBe(2);
    const telegramCalls = fetchMock.mock.calls.filter((call) => String(call[0]).includes('api.telegram.org'));
    expect(telegramCalls).toHaveLength(2);
    const pendingBody = JSON.parse(telegramCalls[0]?.[1].body as string) as { chat_id: string; text: string };
    const telegramBody = JSON.parse(telegramCalls[1]?.[1].body as string) as { chat_id: string; text: string };
    expect(pendingBody.chat_id).toBe('123456');
    expect(pendingBody.text).toBe('收到，正在结合市场情绪、资金流和持仓分析...');
    expect(telegramBody.chat_id).toBe('123456');
    expect(telegramBody.text).toContain('养基AI持仓分析');
    const aiBody = findAiRequestBody(fetchMock);
    expect(aiBody.messages[1].content).toContain('Telegram 短版分析');
    expect(aiBody.messages[1].content).toContain('1200 字以内');
    expect(aiBody.messages[1].content).toContain('资金流入最强方向');
    expect(aiBody.messages[1].content).toContain('今日建仓候选');
    expect(aiBody.messages[1].content).toContain('今日加仓候选');
  });

  it('Telegram 发送“详细分析”会触发完整分析问题', async () => {
    const fetchMock = vi.fn();
    mockBaseSuccessfulFetches(fetchMock);
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(
      new Request('https://worker.example/telegram', {
        method: 'POST',
        body: JSON.stringify({ message: { text: '详细分析', chat: { id: 123456 } } }),
      }),
      env,
    );

    expect(response.status).toBe(200);
    const aiBody = findAiRequestBody(fetchMock);
    expect(aiBody.messages[1].content).toContain('请基于当前持仓');
    expect(aiBody.messages[1].content).toContain('是否适合加仓');
    expect(aiBody.messages[1].content).not.toContain('Telegram 短版分析');
  });

  it('Telegram 发送“加仓”会触发专项短答', async () => {
    const fetchMock = vi.fn();
    mockBaseSuccessfulFetches(fetchMock);
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(
      new Request('https://worker.example/telegram', {
        method: 'POST',
        body: JSON.stringify({ message: { text: '加仓', chat: { id: 123456 } } }),
      }),
      env,
    );

    expect(response.status).toBe(200);
    const aiBody = findAiRequestBody(fetchMock);
    expect(aiBody.messages[1].content).toContain('只回答当前是否适合加仓');
    expect(aiBody.messages[1].content).toContain('加仓候选只能从 holdings 当前已持有基金中选择');
    expect(aiBody.messages[1].content).toContain('1000 字以内');
  });

  it('Telegram 发送“建仓”会触发建仓候选专项短答', async () => {
    const fetchMock = vi.fn();
    mockBaseSuccessfulFetches(fetchMock);
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(
      new Request('https://worker.example/telegram', {
        method: 'POST',
        body: JSON.stringify({ message: { text: '建仓', chat: { id: 123456 } } }),
      }),
      env,
    );

    expect(response.status).toBe(200);
    const aiBody = findAiRequestBody(fetchMock);
    expect(aiBody.messages[1].content).toContain('今天哪只未持有基金最适合建仓');
    expect(aiBody.messages[1].content).toContain('建仓候选优先从 buildCandidates 中选择');
    expect(aiBody.messages[1].content).toContain('严禁推荐 holdings 或 heldFundCodes 中已经持有的基金');
    expect(aiBody.messages[1].content).toContain('资金流入最强方向');
    expect(aiBody.messages[1].content).toContain('市场情绪、今日利好方向、资金流入最强方向、未持有建仓候选、建仓方式、放弃建仓条件');
    expect(aiBody.messages[1].content).toContain('不要输出“为什么不选已有基金”');
    expect(aiBody.messages[1].content).toContain('fallbackBuildCandidates');
    expect(aiBody.messages[1].content).not.toContain('为什么不是已有基金');
    expect(aiBody.messages[0].content).toContain('未持有基金B');
    expect(aiBody.messages[0].content).toContain('"heldFundCodes"');
    expect(aiBody.messages[1].content).toContain('不能为了回答硬选');
  });

  it('建仓候选为空时使用资金流方向兜底候选并标明来源', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('api.github.com/gists')) {
        return Promise.resolve(
          jsonResponse({
            files: {
              'fund-manager-sync.json': {
                content: JSON.stringify(backupPayloadWithoutBuildCandidates),
              },
            },
          }),
        );
      }
      if (url.includes('morningstar.cn')) return Promise.resolve(jsonResponse(holdingsPayload));
      if (url.includes('qt.gtimg.cn')) return Promise.resolve(new Response(marketText));
      if (url.includes('np-listapi.eastmoney.com')) return Promise.resolve(jsonResponse(eastMoneyNewsPayload));
      if (url.includes('push2.eastmoney.com/api/qt/clist/get')) {
        return Promise.resolve(jsonResponse(eastMoneyFundFlowPayload));
      }
      if (url.includes('feed.mix.sina.com.cn')) return Promise.resolve(jsonResponse(sinaNewsPayload));
      if (url.includes('chat/completions')) {
        return Promise.resolve(jsonResponse({ choices: [{ message: { content: '兜底建仓分析' } }] }));
      }
      if (url.includes('api.telegram.org')) return Promise.resolve(jsonResponse({ ok: true }));
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(
      new Request('https://worker.example/telegram', {
        method: 'POST',
        body: JSON.stringify({ message: { text: '建仓', chat: { id: 123456 } } }),
      }),
      env,
    );

    expect(response.status).toBe(200);
    const aiBody = findAiRequestBody(fetchMock);
    expect(aiBody.messages[0].content).toContain('未持有自选建仓候选数量: 0');
    expect(aiBody.messages[0].content).toContain('资金流兜底建仓候选数量:');
    expect(aiBody.messages[0].content).toContain('fallbackBuildCandidates');
    expect(aiBody.messages[0].content).toContain('fundFlowFallback');
    expect(aiBody.messages[0].content).toContain('人工智能');
    expect(aiBody.messages[1].content).toContain('候选来源：资金流方向兜底，非你的自选基金');
    expect(aiBody.messages[1].content).toContain('严禁推荐 holdings 或 heldFundCodes 中已经持有的基金');
  });

  it('Telegram 短版输出过长时会截断', async () => {
    const fetchMock = vi.fn();
    mockBaseSuccessfulFetches(fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('chat/completions')) {
        return Promise.resolve(jsonResponse({ choices: [{ message: { content: '分析'.repeat(1200) } }] }));
      }
      if (url.includes('api.github.com/gists')) {
        return Promise.resolve(
          jsonResponse({ files: { 'fund-manager-sync.json': { content: JSON.stringify(backupPayload) } } }),
        );
      }
      if (url.includes('morningstar.cn')) return Promise.resolve(jsonResponse(holdingsPayload));
      if (url.includes('qt.gtimg.cn')) return Promise.resolve(new Response(marketText));
      if (url.includes('np-listapi.eastmoney.com')) return Promise.resolve(jsonResponse(eastMoneyNewsPayload));
      if (url.includes('push2.eastmoney.com/api/qt/clist/get')) {
        return Promise.resolve(jsonResponse(eastMoneyFundFlowPayload));
      }
      if (url.includes('feed.mix.sina.com.cn')) return Promise.resolve(jsonResponse(sinaNewsPayload));
      if (url.includes('api.telegram.org')) return Promise.resolve(jsonResponse({ ok: true }));
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(
      new Request('https://worker.example/telegram', {
        method: 'POST',
        body: JSON.stringify({ message: { text: '分析', chat: { id: 123456 } } }),
      }),
      env,
    );

    expect(response.status).toBe(200);
    const telegramCalls = fetchMock.mock.calls.filter((call) => String(call[0]).includes('api.telegram.org'));
    const pendingBody = JSON.parse(telegramCalls[0]?.[1].body as string) as { text: string };
    const telegramBody = JSON.parse(telegramCalls[1]?.[1].body as string) as { text: string };
    expect(pendingBody.text).toBe('收到，正在结合市场情绪、资金流和持仓分析...');
    expect(telegramBody.text).toContain('已截断，发送“详细分析”查看完整版本。');
  });

  it('Telegram 分析失败时会在立即回复后发送失败提示', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('api.github.com/gists')) return Promise.resolve(jsonResponse({}, 500));
      if (url.includes('api.telegram.org')) return Promise.resolve(jsonResponse({ ok: true }));
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(
      new Request('https://worker.example/telegram', {
        method: 'POST',
        body: JSON.stringify({ message: { text: '分析', chat: { id: 123456 } } }),
      }),
      env,
    );
    const body = (await response.json()) as { ok: boolean; handled: string; sentMessages: number };

    expect(response.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.handled).toBe('analysis');
    expect(body.sentMessages).toBe(2);
    const telegramCalls = fetchMock.mock.calls.filter((call) => String(call[0]).includes('api.telegram.org'));
    expect(telegramCalls).toHaveLength(2);
    const pendingBody = JSON.parse(telegramCalls[0]?.[1].body as string) as { text: string };
    const failureBody = JSON.parse(telegramCalls[1]?.[1].body as string) as { text: string };
    expect(pendingBody.text).toBe('收到，正在结合市场情绪、资金流和持仓分析...');
    expect(failureBody.text).toContain('分析失败：读取 Gist 请求失败');
  });

  it('午盘 scheduled cron 使用午盘休息分析', async () => {
    const fetchMock = vi.fn();
    mockBaseSuccessfulFetches(fetchMock);
    vi.stubGlobal('fetch', fetchMock);
    const tasks: Promise<unknown>[] = [];

    await worker.scheduled(
      { scheduledTime: Date.now(), cron: '35 3 * * 1-5' },
      env,
      { waitUntil: (promise: Promise<unknown>) => tasks.push(promise) },
    );
    await waitForScheduledTasks(tasks);

    const aiBody = findAiRequestBody(fetchMock);
    expect(aiBody.messages[1].content).toContain('午盘休息分析');
    expect(aiBody.messages[1].content).toContain('下午是否适合观察、低吸、小额试探或暂不操作');
    const telegramCall = fetchMock.mock.calls.find((call) => String(call[0]).includes('api.telegram.org'));
    const telegramBody = JSON.parse(telegramCall?.[1].body as string) as { text: string };
    expect(telegramBody.text).toContain('养基AI午盘休息分析');
  });

  it('尾盘 scheduled cron 使用尾盘操作提醒', async () => {
    const fetchMock = vi.fn();
    mockBaseSuccessfulFetches(fetchMock);
    vi.stubGlobal('fetch', fetchMock);
    const tasks: Promise<unknown>[] = [];

    await worker.scheduled(
      { scheduledTime: Date.now(), cron: '30 6 * * 1-5' },
      env,
      { waitUntil: (promise: Promise<unknown>) => tasks.push(promise) },
    );
    await waitForScheduledTasks(tasks);

    const aiBody = findAiRequestBody(fetchMock);
    expect(aiBody.messages[1].content).toContain('尾盘半小时操作提醒');
    expect(aiBody.messages[1].content).toContain('14:50 前是否加仓、是否减仓');
    const telegramCall = fetchMock.mock.calls.find((call) => String(call[0]).includes('api.telegram.org'));
    const telegramBody = JSON.parse(telegramCall?.[1].body as string) as { text: string };
    expect(telegramBody.text).toContain('养基AI尾盘操作提醒');
  });

  it('收盘 scheduled cron 使用收盘分析', async () => {
    const fetchMock = vi.fn();
    mockBaseSuccessfulFetches(fetchMock);
    vi.stubGlobal('fetch', fetchMock);
    const tasks: Promise<unknown>[] = [];

    await worker.scheduled(
      { scheduledTime: Date.now(), cron: '0 7 * * 1-5' },
      env,
      { waitUntil: (promise: Promise<unknown>) => tasks.push(promise) },
    );
    await waitForScheduledTasks(tasks);

    const aiBody = findAiRequestBody(fetchMock);
    expect(aiBody.messages[1].content).toContain('收盘分析');
    expect(aiBody.messages[1].content).toContain('明日观察点');
    const telegramCall = fetchMock.mock.calls.find((call) => String(call[0]).includes('api.telegram.org'));
    const telegramBody = JSON.parse(telegramCall?.[1].body as string) as { text: string };
    expect(telegramBody.text).toContain('养基AI收盘分析');
  });

  it('QQ 官方机器人未启用时返回 404', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(buildQqRequest({ op: 0 }), env);
    const body = (await response.json()) as { ok: boolean; error: string };

    expect(response.status).toBe(404);
    expect(body).toEqual({ ok: false, error: 'QQ 官方机器人未启用' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('QQ 官方回调地址验证返回 plain_token 和 signature', async () => {
    const response = await worker.fetch(
      buildQqRequest({ op: 13, d: { plain_token: 'plain-token', event_ts: '1725442341' } }),
      qqEnv,
    );
    const body = (await response.json()) as { plain_token: string; signature: string };

    expect(response.status).toBe(200);
    expect(body.plain_token).toBe('plain-token');
    expect(body.signature).toMatch(/^[0-9a-f]{128}$/);
  });

  it('QQ 官方普通回调签名无效时拒绝', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(
      buildQqRequest(
        { op: 0, t: 'GROUP_AT_MESSAGE_CREATE', d: {} },
        { 'X-Signature-Ed25519': '00', 'X-Signature-Timestamp': '1725442341' },
      ),
      qqEnv,
    );
    const body = (await response.json()) as { ok: boolean; error: string };

    expect(response.status).toBe(401);
    expect(body).toEqual({ ok: false, error: 'QQ 官方回调签名无效' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('QQ 官方非群 @ 事件会忽略', async () => {
    const payload = { op: 0, t: 'READY', d: {} };
    const response = await worker.fetch(await buildSignedQqRequest(payload), qqEnv);
    const body = (await response.json()) as { ok: boolean; ignored: boolean };

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, ignored: true });
  });

  it('QQ 官方未授权群或用户会忽略', async () => {
    const fetchMock = vi.fn();
    mockBaseSuccessfulFetches(fetchMock);
    vi.stubGlobal('fetch', fetchMock);
    const payload = {
      op: 0,
      t: 'GROUP_AT_MESSAGE_CREATE',
      d: {
        id: 'msg-id',
        content: '分析',
        group_openid: 'other-group',
        author: { member_openid: 'member-openid' },
      },
    };

    const response = await worker.fetch(await buildSignedQqRequest(payload), qqEnv);
    const body = (await response.json()) as { ok: boolean; ignored: boolean };

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, ignored: true });
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('chat/completions'))).toBe(false);
  });

  it('QQ 官方授权用户群内触发分析会两段式回复', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('bots.qq.com/app/getAppAccessToken')) {
        return Promise.resolve(jsonResponse({ access_token: 'qq-access-token', expires_in: 7200 }));
      }
      if (url.includes('api.sgroup.qq.com/v2/groups/group-openid/messages')) {
        return Promise.resolve(jsonResponse({ id: 'sent-id', timestamp: Date.now() }));
      }
      if (url.includes('api.github.com/gists')) {
        return Promise.resolve(
          jsonResponse({ files: { 'fund-manager-sync.json': { content: JSON.stringify(backupPayload) } } }),
        );
      }
      if (url.includes('morningstar.cn')) return Promise.resolve(jsonResponse(holdingsPayload));
      if (url.includes('qt.gtimg.cn')) return Promise.resolve(new Response(marketText));
      if (url.includes('np-listapi.eastmoney.com')) return Promise.resolve(jsonResponse(eastMoneyNewsPayload));
      if (url.includes('push2.eastmoney.com/api/qt/clist/get')) {
        return Promise.resolve(jsonResponse(eastMoneyFundFlowPayload));
      }
      if (url.includes('feed.mix.sina.com.cn')) return Promise.resolve(jsonResponse(sinaNewsPayload));
      if (url.includes('chat/completions')) {
        return Promise.resolve(jsonResponse({ choices: [{ message: { content: 'QQ 分析结果' } }] }));
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);
    const payload = {
      op: 0,
      t: 'GROUP_AT_MESSAGE_CREATE',
      d: {
        id: 'msg-id',
        content: '<@!robot> 建仓',
        group_openid: 'group-openid',
        author: { member_openid: 'member-openid' },
      },
    };

    const response = await worker.fetch(await buildSignedQqRequest(payload), qqEnv);
    const body = (await response.json()) as { ok: boolean; handled: string; sentMessages: number };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.handled).toBe('analysis');
    expect(body.sentMessages).toBe(2);
    const qqMessageCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes('api.sgroup.qq.com/v2/groups/group-openid/messages'),
    );
    expect(qqMessageCalls).toHaveLength(2);
    const pendingBody = JSON.parse(qqMessageCalls[0]?.[1].body as string) as {
      content: string;
      msg_id: string;
      msg_seq: number;
    };
    const analysisBody = JSON.parse(qqMessageCalls[1]?.[1].body as string) as {
      content: string;
      msg_id: string;
      msg_seq: number;
    };
    expect(pendingBody).toEqual(
      expect.objectContaining({
        content: '收到，正在结合市场情绪、资金流和持仓分析...',
        msg_id: 'msg-id',
        msg_seq: 1,
      }),
    );
    expect(analysisBody.content).toContain('养基AI持仓分析');
    expect(analysisBody.content).toContain('QQ 分析结果');
    expect(analysisBody.msg_id).toBe('msg-id');
    expect(analysisBody.msg_seq).toBe(2);
    expect(
      fetchMock.mock.calls.some(
        (call) =>
          call[0] === 'https://bots.qq.com/app/getAppAccessToken' &&
          JSON.parse(call[1].body as string).appId === '1903963785',
      ),
    ).toBe(true);
  });

  it('OneBot 未启用时返回 404', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(buildOneBotRequest({ post_type: 'message' }), env);
    const body = (await response.json()) as { ok: boolean; error: string };

    expect(response.status).toBe(404);
    expect(body).toEqual({ ok: false, error: 'QQ OneBot 未启用' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('OneBot 未授权群或用户会忽略且不调用 AI', async () => {
    const fetchMock = vi.fn();
    mockBaseSuccessfulFetches(fetchMock);
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(
      buildOneBotRequest({
        post_type: 'message',
        message_type: 'group',
        group_id: 111,
        user_id: 987654321,
        raw_message: '分析',
      }),
      oneBotEnv,
    );
    const body = (await response.json()) as { ok: boolean; ignored: boolean };

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, ignored: true });
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('chat/completions'))).toBe(false);
  });

  it('OneBot 授权用户群内触发分析会两段式回复', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('onebot.example/send_group_msg')) return Promise.resolve(jsonResponse({ status: 'ok' }));
      if (url.includes('api.github.com/gists')) {
        return Promise.resolve(
          jsonResponse({ files: { 'fund-manager-sync.json': { content: JSON.stringify(backupPayload) } } }),
        );
      }
      if (url.includes('morningstar.cn')) return Promise.resolve(jsonResponse(holdingsPayload));
      if (url.includes('qt.gtimg.cn')) return Promise.resolve(new Response(marketText));
      if (url.includes('np-listapi.eastmoney.com')) return Promise.resolve(jsonResponse(eastMoneyNewsPayload));
      if (url.includes('push2.eastmoney.com/api/qt/clist/get')) {
        return Promise.resolve(jsonResponse(eastMoneyFundFlowPayload));
      }
      if (url.includes('feed.mix.sina.com.cn')) return Promise.resolve(jsonResponse(sinaNewsPayload));
      if (url.includes('chat/completions')) {
        return Promise.resolve(jsonResponse({ choices: [{ message: { content: 'OneBot 分析结果' } }] }));
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(
      buildOneBotRequest({
        post_type: 'message',
        message_type: 'group',
        group_id: 123456789,
        user_id: 987654321,
        raw_message: '建仓',
      }),
      oneBotEnv,
    );
    const body = (await response.json()) as { ok: boolean; handled: string; sentMessages: number };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.handled).toBe('analysis');
    expect(body.sentMessages).toBe(2);
    const oneBotCalls = fetchMock.mock.calls.filter((call) => String(call[0]).includes('onebot.example/send_group_msg'));
    expect(oneBotCalls).toHaveLength(2);
    expect(oneBotCalls[0]?.[1].headers).toEqual(
      expect.objectContaining({ Authorization: 'Bearer onebot-token' }),
    );
    const pendingBody = JSON.parse(oneBotCalls[0]?.[1].body as string) as { group_id: number; message: string };
    const analysisBody = JSON.parse(oneBotCalls[1]?.[1].body as string) as { group_id: number; message: string };
    expect(pendingBody).toEqual({
      group_id: 123456789,
      message: '收到，正在结合市场情绪、资金流和持仓分析...',
    });
    expect(analysisBody.group_id).toBe(123456789);
    expect(analysisBody.message).toContain('养基AI持仓分析');
    expect(analysisBody.message).toContain('OneBot 分析结果');
  });

  it('Telegram webhook secret 不匹配时返回 401', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(
      new Request('https://worker.example/telegram', {
        method: 'POST',
        headers: { 'X-Telegram-Bot-Api-Secret-Token': 'wrong' },
        body: JSON.stringify({ message: { text: '分析', chat: { id: 123456 } } }),
      }),
      { ...env, TELEGRAM_WEBHOOK_SECRET: 'webhook-secret' },
    );

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('受保护接口可以设置 Telegram webhook', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true, result: true }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(
      new Request('https://worker.example/setup-telegram-webhook', {
        method: 'POST',
        headers: { Authorization: 'Bearer cron-secret' },
      }),
      { ...env, CRON_SECRET: 'cron-secret', TELEGRAM_WEBHOOK_SECRET: 'webhook-secret' },
    );
    const body = (await response.json()) as { ok: boolean; webhookUrl: string };

    expect(response.status).toBe(200);
    expect(body.webhookUrl).toBe('https://worker.example/telegram');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.telegram.org/bottelegram-token/setWebhook',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          url: 'https://worker.example/telegram',
          secret_token: 'webhook-secret',
        }),
      }),
    );
  });

  it('非本人 chat id 不触发分析', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(
      new Request('https://worker.example/telegram', {
        method: 'POST',
        body: JSON.stringify({ message: { text: '分析', chat: { id: 999 } } }),
      }),
      env,
    );
    const body = (await response.json()) as { ok: boolean; ignored: boolean };

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, ignored: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('未识别 Telegram 指令时返回帮助文本', async () => {
    const fetchMock = vi.fn();
    mockBaseSuccessfulFetches(fetchMock);
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(
      new Request('https://worker.example/telegram', {
        method: 'POST',
        body: JSON.stringify({ message: { text: '你好', chat: { id: 123456 } } }),
      }),
      env,
    );
    const body = (await response.json()) as { ok: boolean; handled: string; sentMessages: number };

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, handled: 'help', sentMessages: 1 });
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('/chat/completions'))).toBe(false);
    const telegramCall = fetchMock.mock.calls.find((call) => String(call[0]).includes('api.telegram.org'));
    const telegramBody = JSON.parse(telegramCall?.[1].body as string) as { text: string };
    expect(telegramBody.text).toContain('发送“分析”');
    expect(telegramBody.text).toContain('建仓');
  });
});
