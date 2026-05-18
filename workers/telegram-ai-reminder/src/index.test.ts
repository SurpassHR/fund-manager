/// <reference types="vitest/globals" />
import worker from './index';

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

const newsPayload = {
  articles: [
    {
      title: 'A股人工智能板块午后走强',
      domain: 'example.cn',
      url: 'https://example.cn/news/ai',
      seendate: '20260518T120000Z',
      language: 'Chinese',
    },
  ],
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
  AI_QUESTION: '请分析持仓',
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('telegram ai reminder worker', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('读取 Gist 持仓、调用 AI 并发送 Telegram', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          files: {
            'fund-manager-sync.json': {
              content: JSON.stringify(backupPayload),
            },
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(holdingsPayload))
      .mockResolvedValueOnce(new Response(marketText))
      .mockResolvedValueOnce(jsonResponse(newsPayload))
      .mockResolvedValueOnce(
        jsonResponse({
          choices: [{ message: { content: '组合整体表现良好。' } }],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
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
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.github.com/gists/gist-id',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer github-token' }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://www.morningstar.cn/cn-api/v2/funds/000001/holdings',
      expect.objectContaining({ headers: expect.objectContaining({ Accept: 'application/json' }) }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('https://qt.gtimg.cn/q='),
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('https://api.gdeltproject.org/api/v2/doc/doc'),
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      'https://example.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer ai-token' }),
      }),
    );
    const aiBody = JSON.parse(fetchMock.mock.calls[4][1].body as string) as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(aiBody.messages[0].content).toContain('测试基金A');
    expect(aiBody.messages[0].content).toContain('贵州茅台');
    expect(aiBody.messages[0].content).toContain('dataCoverage');
    expect(aiBody.messages[0].content).toContain('稳健');
    expect(aiBody.messages[0].content).toContain('风险承受能力: available');
    expect(aiBody.messages[0].content).toContain('marketSnapshot');
    expect(aiBody.messages[0].content).toContain('newsSnapshot');
    expect(aiBody.messages[0].content).toContain('上证指数');
    expect(aiBody.messages[0].content).toContain('A股人工智能板块午后走强');
    expect(aiBody.messages[0].content).toContain('是否适合加仓');
    expect(aiBody.messages[0].content).toContain('不得编造新闻标题、财报数据或公告内容');
    expect(aiBody.messages[0].content).toContain('不要编造不存在的数据');
    expect(aiBody.messages[1].content).toBe('请分析持仓');

    const telegramBody = JSON.parse(fetchMock.mock.calls[5][1].body as string) as {
      chat_id: string;
      text: string;
    };
    expect(fetchMock.mock.calls[5][0]).toBe(
      'https://api.telegram.org/bottelegram-token/sendMessage',
    );
    expect(telegramBody.chat_id).toBe('123456');
    expect(telegramBody.text).toContain('小胡养基 AI 持仓分析');
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
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          files: {
            'fund-manager-sync.json': {
              content: JSON.stringify(backupPayload),
            },
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(holdingsPayload))
      .mockResolvedValueOnce(new Response(marketText))
      .mockResolvedValueOnce(jsonResponse({ articles: [] }))
      .mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: longText } }] }))
      .mockImplementation(() => Promise.resolve(jsonResponse({ ok: true })));
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
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          files: {
            'fund-manager-sync.json': {
              content: JSON.stringify(backupPayload),
            },
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(holdingsPayload))
      .mockResolvedValueOnce(new Response(marketText))
      .mockResolvedValueOnce(jsonResponse(newsPayload))
      .mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: 'DeepSeek 分析' } }] }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(
      new Request('https://worker.example/run', { method: 'POST' }),
      { ...env, AI_PROVIDER: 'deepseek', AI_BASE_URL: undefined },
    );

    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[4][0]).toBe('https://api.deepseek.com/v1/chat/completions');
  });

  it('Gemini provider 使用 Gemini REST API', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          files: {
            'fund-manager-sync.json': {
              content: JSON.stringify(backupPayload),
            },
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(holdingsPayload))
      .mockResolvedValueOnce(new Response(marketText))
      .mockResolvedValueOnce(jsonResponse(newsPayload))
      .mockResolvedValueOnce(
        jsonResponse({ candidates: [{ content: { parts: [{ text: 'Gemini 分析' }] } }] }),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(
      new Request('https://worker.example/run', { method: 'POST' }),
      { ...env, AI_PROVIDER: 'gemini', AI_MODEL: 'gemini-1.5-flash', AI_BASE_URL: undefined },
    );

    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[4][0]).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=ai-token',
    );
  });

  it('新闻为空时在 prompt 中标记消息面缺失', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          files: {
            'fund-manager-sync.json': {
              content: JSON.stringify(backupPayload),
            },
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(holdingsPayload))
      .mockResolvedValueOnce(new Response(marketText))
      .mockResolvedValueOnce(jsonResponse({ articles: [] }))
      .mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: '缺失分析' } }] }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(
      new Request('https://worker.example/run', { method: 'POST' }),
      env,
    );

    expect(response.status).toBe(200);
    const aiBody = JSON.parse(fetchMock.mock.calls[4][1].body as string) as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(aiBody.messages[0].content).toContain('消息面/财报/公告数据: missing');
    expect(aiBody.messages[0].content).toContain('消息面/财报/公告数据缺失');
  });
});
