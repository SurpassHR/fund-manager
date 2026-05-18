interface Env {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
  GITHUB_TOKEN: string;
  GIST_ID: string;
  GIST_FILENAME?: string;
  AI_PROVIDER?: 'openai' | 'gemini' | 'deepseek' | 'customOpenAi';
  AI_API_KEY: string;
  AI_MODEL: string;
  AI_BASE_URL?: string;
  AI_MODE?: 'quick' | 'deep' | 'risk';
  AI_QUESTION?: string;
  CRON_SECRET?: string;
}

interface ScheduledController {
  scheduledTime: number;
  cron: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

interface FundBackupPayload {
  version: number;
  exportDate: string;
  funds: BackupFund[];
  investmentProfile?: InvestmentProfileSnapshot;
}

interface InvestmentProfileSnapshot {
  riskTolerance?: string;
  investmentHorizon?: string;
  externalAssets?: string;
  notes?: string;
}

interface BackupFund {
  code: string;
  name: string;
  platform: string;
  holdingShares: number;
  costPrice: number;
  currentNav: number;
  lastUpdate: string;
  dayChangePct: number;
  dayChangeVal: number;
  buyDate?: string;
  buyTime?: 'before15' | 'after15';
  settlementDays?: number;
}

interface FundHoldingsApiResponse {
  data?: {
    portfolioDate?: string;
    equityHoldings?: Array<{
      ticker?: string;
      name?: string;
      weight?: number;
      sector?: string;
    }>;
  };
}

interface HoldingEquitySnapshot {
  ticker: string;
  name: string;
  weight: number;
  sector?: string;
}

interface EquityOverlapItem {
  ticker: string;
  name: string;
  fundCount: number;
  funds: string[];
  maxWeight: number;
  totalWeight: number;
}

interface HoldingsDataCoverage {
  topEquityHoldings: 'available' | 'partial' | 'missing';
  industryDistribution: 'available' | 'partial' | 'missing';
  managerChanges: 'missing';
  externalAssets: 'available' | 'missing';
  riskProfile: 'available' | 'missing';
  investmentHorizon: 'available' | 'missing';
}

interface HoldingSnapshotItem {
  code: string;
  name: string;
  platform: string;
  holdingShares: number;
  costPrice: number;
  currentNav: number;
  marketValue: number;
  totalCost: number;
  totalGain: number;
  totalGainPct: number;
  dayChangePct: number;
  dayChangeVal: number;
  lastUpdate: string;
  buyDate?: string;
  buyTime?: 'before15' | 'after15';
  settlementDays?: number;
  topEquityHoldings?: HoldingEquitySnapshot[];
  holdingsDataStatus?: 'available' | 'missing' | 'failed';
  holdingsDataDate?: string;
}

interface HoldingsSnapshot {
  asOf: string;
  currency: string;
  totalAssets: number;
  totalDayGain: number;
  totalDayGainPct: number;
  holdingGain: number;
  holdingGainPct: number;
  holdings: HoldingSnapshotItem[];
  equityOverlap: EquityOverlapItem[];
  dataCoverage: HoldingsDataCoverage;
  investmentProfile?: InvestmentProfileSnapshot;
}

interface GithubGistResponse {
  files?: Record<
    string,
    {
      content?: string;
      raw_url?: string;
    }
  >;
}

const GITHUB_API_VERSION = '2022-11-28';
const DEFAULT_GIST_FILENAME = 'fund-manager-sync.json';
const TELEGRAM_MESSAGE_LIMIT = 3900;
const MORNINGSTAR_API_BASE = 'https://www.morningstar.cn/cn-api';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

const requireEnv = (env: Env, key: keyof Env): string => {
  const value = env[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`缺少环境变量 ${key}`);
  }
  return value.trim();
};

const round = (value: number, digits = 2) => Number(value.toFixed(digits));

const fetchText = async (url: string, init: RequestInit, label: string): Promise<string> => {
  const response = await fetch(url, init);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`${label} 请求失败: ${response.status} ${text}`.trim());
  }
  return response.text();
};

const fetchJson = async <T>(url: string, init: RequestInit, label: string): Promise<T> => {
  const text = await fetchText(url, init, label);
  return JSON.parse(text) as T;
};

const readGistBackup = async (env: Env): Promise<FundBackupPayload> => {
  const token = requireEnv(env, 'GITHUB_TOKEN');
  const gistId = requireEnv(env, 'GIST_ID');
  const filename = env.GIST_FILENAME?.trim() || DEFAULT_GIST_FILENAME;

  const gist = await fetchJson<GithubGistResponse>(
    `https://api.github.com/gists/${gistId}`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
        'User-Agent': 'fund-manager-telegram-ai-reminder',
      },
    },
    '读取 Gist',
  );

  const file = gist.files?.[filename];
  if (!file) {
    throw new Error(`Gist 中未找到 ${filename}`);
  }

  const content =
    typeof file.content === 'string'
      ? file.content
      : file.raw_url
        ? await fetchText(
            file.raw_url,
            {
              cache: 'no-store',
              headers: {
                Accept: 'application/vnd.github+json',
                Authorization: `Bearer ${token}`,
                'X-GitHub-Api-Version': GITHUB_API_VERSION,
                'User-Agent': 'fund-manager-telegram-ai-reminder',
              },
            },
            '读取 Gist raw 文件',
          )
        : '';
  if (!content) {
    throw new Error(`Gist 文件 ${filename} 内容为空`);
  }

  const payload = JSON.parse(content) as Partial<FundBackupPayload>;
  if (payload.version !== 1 || !Array.isArray(payload.funds)) {
    throw new Error('Gist 内容不是有效的 fund-manager 备份');
  }

  return payload as FundBackupPayload;
};

const fetchFundHoldings = async (fundCode: string): Promise<FundHoldingsApiResponse | null> => {
  try {
    return await fetchJson<FundHoldingsApiResponse>(
      `${MORNINGSTAR_API_BASE}/v2/funds/${fundCode}/holdings`,
      { headers: { Accept: 'application/json' } },
      `读取基金 ${fundCode} 持仓`,
    );
  } catch (error) {
    console.warn(`读取基金 ${fundCode} 前十大持仓失败`, error);
    return null;
  }
};

const fetchFundHoldingsEnrichment = async (fundCode: string) => {
  const response = await fetchFundHoldings(fundCode);
  const equities = response?.data?.equityHoldings ?? [];
  if (!response) return { status: 'failed' as const };
  if (equities.length === 0) return { status: 'missing' as const };

  return {
    status: 'available' as const,
    portfolioDate: response.data?.portfolioDate,
    topEquityHoldings: equities.slice(0, 10).map((holding) => ({
      ticker: holding.ticker || '',
      name: holding.name || holding.ticker || '',
      weight: round(Number(holding.weight || 0), 4),
      sector: holding.sector,
    })),
  };
};

const buildEquityOverlap = (holdings: HoldingSnapshotItem[]): EquityOverlapItem[] => {
  const byTicker = new Map<
    string,
    { name: string; fundWeights: Map<string, number>; totalWeight: number; maxWeight: number }
  >();

  holdings.forEach((fund) => {
    fund.topEquityHoldings?.forEach((equity) => {
      const ticker = equity.ticker.trim();
      if (!ticker) return;
      const current = byTicker.get(ticker) ?? {
        name: equity.name || ticker,
        fundWeights: new Map<string, number>(),
        totalWeight: 0,
        maxWeight: 0,
      };
      current.fundWeights.set(fund.name, equity.weight);
      current.totalWeight += equity.weight;
      current.maxWeight = Math.max(current.maxWeight, equity.weight);
      byTicker.set(ticker, current);
    });
  });

  return Array.from(byTicker.entries())
    .map(([ticker, item]) => ({
      ticker,
      name: item.name,
      fundCount: item.fundWeights.size,
      funds: Array.from(item.fundWeights.keys()),
      maxWeight: round(item.maxWeight),
      totalWeight: round(item.totalWeight),
    }))
    .filter((item) => item.fundCount > 1)
    .sort((a, b) => b.fundCount - a.fundCount || b.totalWeight - a.totalWeight)
    .slice(0, 20);
};

const buildHoldingsDataCoverage = (
  holdings: HoldingSnapshotItem[],
  investmentProfile?: InvestmentProfileSnapshot,
): HoldingsDataCoverage => {
  const availableCount = holdings.filter((item) => item.topEquityHoldings?.length).length;
  const sectorAvailableCount = holdings.filter((item) =>
    item.topEquityHoldings?.some((equity) => equity.sector?.trim()),
  ).length;
  const resolveCoverage = (count: number) => {
    if (holdings.length === 0 || count === 0) return 'missing';
    return count === holdings.length ? 'available' : 'partial';
  };

  return {
    topEquityHoldings: resolveCoverage(availableCount),
    industryDistribution: resolveCoverage(sectorAvailableCount),
    managerChanges: 'missing',
    externalAssets: investmentProfile?.externalAssets?.trim() ? 'available' : 'missing',
    riskProfile: investmentProfile?.riskTolerance?.trim() ? 'available' : 'missing',
    investmentHorizon: investmentProfile?.investmentHorizon?.trim() ? 'available' : 'missing',
  };
};

const buildHoldingsSnapshot = async (payload: FundBackupPayload): Promise<HoldingsSnapshot> => {
  const validFunds = payload.funds
    .filter((fund) => fund.holdingShares > 0 && fund.currentNav > 0)
  const enrichments = await Promise.all(
    validFunds.map(async (fund) => [fund.code, await fetchFundHoldingsEnrichment(fund.code)] as const),
  );
  const enrichmentMap = new Map(enrichments);
  const holdings = validFunds.map<HoldingSnapshotItem>((fund) => {
      const marketValue = fund.holdingShares * fund.currentNav;
      const totalCost = fund.holdingShares * fund.costPrice;
      const totalGain = marketValue - totalCost;
      const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
      const enrichment = enrichmentMap.get(fund.code);

      return {
        code: fund.code,
        name: fund.name,
        platform: fund.platform,
        holdingShares: round(fund.holdingShares, 4),
        costPrice: round(fund.costPrice, 4),
        currentNav: round(fund.currentNav, 4),
        marketValue: round(marketValue),
        totalCost: round(totalCost),
        totalGain: round(totalGain),
        totalGainPct: round(totalGainPct),
        dayChangePct: round(fund.dayChangePct),
        dayChangeVal: round(fund.dayChangeVal),
        lastUpdate: fund.lastUpdate,
        buyDate: fund.buyDate,
        buyTime: fund.buyTime,
        settlementDays: fund.settlementDays,
        topEquityHoldings: enrichment?.topEquityHoldings,
        holdingsDataStatus: enrichment?.status ?? 'missing',
        holdingsDataDate: enrichment?.portfolioDate,
      };
    });

  const totalAssets = holdings.reduce((sum, item) => sum + item.marketValue, 0);
  const totalDayGain = holdings.reduce((sum, item) => sum + item.dayChangeVal, 0);
  const totalCost = holdings.reduce((sum, item) => sum + item.totalCost, 0);
  const holdingGain = holdings.reduce((sum, item) => sum + item.totalGain, 0);

  return {
    asOf: payload.exportDate || new Date().toISOString(),
    currency: 'CNY',
    totalAssets: round(totalAssets),
    totalDayGain: round(totalDayGain),
    totalDayGainPct: totalAssets - totalDayGain > 0 ? round((totalDayGain / (totalAssets - totalDayGain)) * 100) : 0,
    holdingGain: round(holdingGain),
    holdingGainPct: totalCost > 0 ? round((holdingGain / totalCost) * 100) : 0,
    holdings,
    equityOverlap: buildEquityOverlap(holdings),
    dataCoverage: buildHoldingsDataCoverage(holdings, payload.investmentProfile),
    investmentProfile: payload.investmentProfile,
  };
};

const buildHoldingsAnalysisPrompt = (holdings: HoldingsSnapshot, mode: string) => {
  const sortedByGain = [...holdings.holdings].sort((a, b) => b.totalGainPct - a.totalGainPct);
  const sortedByValue = [...holdings.holdings].sort((a, b) => b.marketValue - a.marketValue);
  const topGain = sortedByGain[0];
  const topLoss = sortedByGain.at(-1);
  const concentration =
    holdings.totalAssets > 0
      ? sortedByValue.slice(0, 3).reduce((sum, item) => sum + item.marketValue, 0) /
        holdings.totalAssets
      : 0;

  const modeInstruction =
    mode === 'risk'
      ? '你是一位专注风险评估的基金持仓分析助手，请优先识别回撤、集中度、单市场暴露与组合脆弱点。'
      : mode === 'quick'
        ? '你是一位基金持仓分析助手，请用快速诊断方式先给关键结论，再补充依据。'
        : '你是一位资深基金投顾，请从收益、配置、集中度、风险、改进建议等多个维度做深度分析。';

  const summary = [
    `总资产: ${holdings.totalAssets}`,
    `持仓数量: ${holdings.holdings.length}`,
    `总收益: ${holdings.holdingGain} (${holdings.holdingGainPct}%)`,
    `日收益: ${holdings.totalDayGain} (${holdings.totalDayGainPct}%)`,
    topGain ? `收益最佳: ${topGain.name} (${topGain.totalGainPct}%)` : '',
    topLoss ? `收益最弱: ${topLoss.name} (${topLoss.totalGainPct}%)` : '',
    `前三大仓位集中度: ${(concentration * 100).toFixed(1)}%`,
    `前十大重仓股数据: ${holdings.dataCoverage.topEquityHoldings}`,
    `真实行业分布数据: ${holdings.dataCoverage.industryDistribution}`,
    `基金经理最新调仓数据: ${holdings.dataCoverage.managerChanges}`,
    `账户外资产数据: ${holdings.dataCoverage.externalAssets}`,
    `风险承受能力: ${holdings.dataCoverage.riskProfile}`,
    `投资期限: ${holdings.dataCoverage.investmentHorizon}`,
    `底层股票重合项数量: ${holdings.equityOverlap.length}`,
  ]
    .filter(Boolean)
    .join('\n');

  return `${modeInstruction}\n要求：\n1) 使用简体中文回答。\n2) 只基于给定持仓数据推理，不要编造不存在的数据。\n3) 如果前十大重仓股、真实行业分布、基金经理调仓、账户外资产、风险承受能力或投资期限在 dataCoverage 中标记为 missing/partial，必须明确说明“当前数据缺失/不完整”，不能当作已知事实分析。\n4) 可以基于 topEquityHoldings 和 equityOverlap 分析底层股票重合度；没有数据时必须跳过。\n5) 避免直接给出买卖指令，但可以给方向性建议。\n6) 输出适合 Telegram 阅读，标题清晰，重点用短句。\n\n组合摘要：\n${summary}\n\n以下是用户当前持仓快照(JSON)：\n${JSON.stringify(holdings, null, 2)}`;
};

const resolveAiEndpoint = (env: Env) => {
  const provider = env.AI_PROVIDER || 'customOpenAi';
  if (provider === 'gemini') {
    return { provider, baseUrl: 'https://generativelanguage.googleapis.com/v1beta' };
  }
  if (provider === 'deepseek') {
    return { provider, baseUrl: 'https://api.deepseek.com/v1' };
  }
  if (provider === 'openai') {
    return { provider, baseUrl: 'https://api.openai.com/v1' };
  }
  return { provider, baseUrl: requireEnv(env, 'AI_BASE_URL') };
};

const analyzeWithOpenAiCompatible = async (params: {
  env: Env;
  baseUrl: string;
  systemPrompt: string;
  question: string;
}) => {
  const apiKey = requireEnv(params.env, 'AI_API_KEY');
  const model = requireEnv(params.env, 'AI_MODEL');
  const response = await fetchJson<{
    choices?: Array<{ message?: { content?: string } }>;
  }>(
    `${params.baseUrl.replace(/\/$/, '')}/chat/completions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: params.systemPrompt },
          { role: 'user', content: params.question },
        ],
        temperature: 0.2,
      }),
    },
    '调用 AI',
  );

  const content = response.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('AI 返回内容为空');
  return content;
};

const analyzeWithGemini = async (params: { env: Env; systemPrompt: string; question: string }) => {
  const apiKey = requireEnv(params.env, 'AI_API_KEY');
  const model = requireEnv(params.env, 'AI_MODEL');
  const response = await fetchJson<{
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  }>(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: params.systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: params.question }] }],
        generationConfig: { temperature: 0.2 },
      }),
    },
    '调用 Gemini',
  );

  const content = response.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
  if (!content) throw new Error('Gemini 返回内容为空');
  return content;
};

const analyzeHoldings = async (env: Env, holdings: HoldingsSnapshot) => {
  if (holdings.holdings.length === 0) {
    return '当前 Gist 备份中没有有效持仓，未生成 AI 分析。';
  }

  const mode = env.AI_MODE || 'deep';
  const question =
    env.AI_QUESTION ||
    '请基于最新持仓数据做一次收盘后持仓复盘，重点说明组合表现、主要风险、机会和下一步观察清单。';
  const systemPrompt = buildHoldingsAnalysisPrompt(holdings, mode);
  const endpoint = resolveAiEndpoint(env);

  if (endpoint.provider === 'gemini') {
    return analyzeWithGemini({ env, systemPrompt, question });
  }

  return analyzeWithOpenAiCompatible({ env, baseUrl: endpoint.baseUrl, systemPrompt, question });
};

const splitTelegramMessage = (text: string) => {
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > TELEGRAM_MESSAGE_LIMIT) {
    let cut = rest.lastIndexOf('\n', TELEGRAM_MESSAGE_LIMIT);
    if (cut < 1000) cut = TELEGRAM_MESSAGE_LIMIT;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
};

const sendTelegramMessage = async (env: Env, text: string) => {
  const token = requireEnv(env, 'TELEGRAM_BOT_TOKEN');
  const chatId = requireEnv(env, 'TELEGRAM_CHAT_ID');
  const chunks = splitTelegramMessage(text);

  for (const chunk of chunks) {
    await fetchText(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: chunk,
          disable_web_page_preview: true,
        }),
      },
      '发送 Telegram 消息',
    );
  }

  return chunks.length;
};

const runReminder = async (env: Env) => {
  const payload = await readGistBackup(env);
  const snapshot = await buildHoldingsSnapshot(payload);
  const analysis = await analyzeHoldings(env, snapshot);
  const title = `小胡养基 AI 持仓分析\n时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n`;
  const sentMessages = await sendTelegramMessage(env, `${title}\n${analysis}`);

  return {
    ok: true,
    holdings: snapshot.holdings.length,
    totalAssets: snapshot.totalAssets,
    sentMessages,
  };
};

const isAuthorizedManualRun = (request: Request, env: Env) => {
  if (!env.CRON_SECRET) return true;
  return request.headers.get('Authorization') === `Bearer ${env.CRON_SECRET}`;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return json({ ok: true, service: 'telegram-ai-reminder' });
    }

    if (url.pathname === '/run' && request.method === 'POST') {
      if (!isAuthorizedManualRun(request, env)) {
        return json({ ok: false, error: '未授权' }, 401);
      }

      try {
        return json(await runReminder(env));
      } catch (error) {
        return json(
          { ok: false, error: error instanceof Error ? error.message : '未知错误' },
          500,
        );
      }
    }

    return json({ ok: false, error: 'Not Found' }, 404);
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      runReminder(env).catch(async (error) => {
        const message = error instanceof Error ? error.message : '未知错误';
        await sendTelegramMessage(env, `小胡养基 AI 持仓分析定时任务失败：${message}`).catch(
          () => undefined,
        );
      }),
    );
  },
};
