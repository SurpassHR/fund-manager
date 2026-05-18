import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';

ed.hashes.sha512 = (...messages) => sha512(ed.etc.concatBytes(...messages));

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
  TELEGRAM_WEBHOOK_SECRET?: string;
  MARKET_ANALYSIS_ENABLED?: string;
  MARKET_INDEX_CODES?: string;
  NEWS_ANALYSIS_ENABLED?: string;
  NEWS_PROVIDER?: 'eastmoney' | 'sina' | 'mixed';
  NEWS_LOOKBACK_HOURS?: string;
  NEWS_MAX_ITEMS?: string;
  NEWS_QUERY_TIMEOUT_MS?: string;
  QQ_OFFICIAL_ENABLED?: string;
  QQ_OFFICIAL_APP_ID?: string;
  QQ_OFFICIAL_APP_SECRET?: string;
  QQ_OFFICIAL_ALLOWED_GROUP_OPENIDS?: string;
  QQ_OFFICIAL_ALLOWED_MEMBER_OPENIDS?: string;
}

interface ScheduledController {
  scheduledTime: number;
  cron: string;
}

type ScheduledAnalysisType = 'midday' | 'lateSession' | 'close';

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

interface FundBackupPayload {
  version: number;
  exportDate: string;
  funds: BackupFund[];
  watchlists?: BackupWatchlistItem[];
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

interface BackupWatchlistItem {
  code: string;
  name: string;
  type: 'fund' | 'index';
  platform?: string;
  anchorPrice: number;
  anchorDate: string;
  currentPrice: number;
  dayChangePct: number;
  lastUpdate: string;
}

interface BuildCandidateSnapshotItem {
  code: string;
  name: string;
  platform?: string;
  source: 'watchlist' | 'fundFlowFallback';
  matchedFlowTheme?: string;
  reason?: string;
  currentPrice: number;
  dayChangePct: number;
  anchorPrice: number;
  anchorDate: string;
  lastUpdate: string;
  anchorChangePct: number;
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
  buildCandidates: BuildCandidateSnapshotItem[];
  fallbackBuildCandidates: BuildCandidateSnapshotItem[];
  heldFundCodes: string[];
  equityOverlap: EquityOverlapItem[];
  dataCoverage: HoldingsDataCoverage;
  investmentProfile?: InvestmentProfileSnapshot;
}

interface MarketIndexSnapshot {
  code: string;
  name: string;
  price: number;
  changePct: number;
  change?: number;
  updateTime?: string;
}

interface MarketSnapshot {
  asOf: string;
  indices: MarketIndexSnapshot[];
  dataStatus: 'available' | 'partial' | 'missing';
}

interface NewsItemSnapshot {
  title: string;
  source?: string;
  url?: string;
  publishedAt?: string;
  language?: string;
}

interface NewsSnapshot {
  asOf: string;
  provider: 'eastmoney' | 'sina' | 'mixed';
  keywords: string[];
  lookbackHours: number;
  items: NewsItemSnapshot[];
  dataStatus: 'available' | 'missing' | 'failed';
  failedSources?: string[];
}

interface EastMoneyFundFlowResponse {
  data?: {
    diff?: Array<{
      f12?: string;
      f14?: string;
      f3?: number | string;
      f62?: number | string;
      f184?: number | string;
    }>;
  };
}

interface FundFlowItemSnapshot {
  code?: string;
  name: string;
  category: 'sector' | 'concept';
  netInflow: number;
  netInflowRank: number;
  changePct?: number;
  mainNetInflowPct?: number;
}

interface FundFlowSnapshot {
  asOf: string;
  provider: 'eastmoney';
  items: FundFlowItemSnapshot[];
  dataStatus: 'available' | 'partial' | 'missing' | 'failed';
  failedSources?: string[];
}

interface AnalysisContextSnapshot {
  holdings: HoldingsSnapshot;
  marketSnapshot?: MarketSnapshot;
  newsSnapshot?: NewsSnapshot;
  fundFlowSnapshot?: FundFlowSnapshot;
}

interface TelegramUpdate {
  message?: {
    text?: string;
    chat?: {
      id?: number | string;
    };
  };
}

interface QqOfficialPayload {
  id?: string;
  op?: number;
  t?: string;
  d?: unknown;
}

interface QqOfficialValidationPayload {
  plain_token?: string;
  event_ts?: string;
}

interface QqOfficialGroupAtMessage {
  id?: string;
  content?: string;
  group_openid?: string;
  author?: {
    member_openid?: string;
  };
}

interface QqOfficialAccessTokenResponse {
  access_token?: string;
  expires_in?: string | number;
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
const TENCENT_QUOTE_API = 'https://qt.gtimg.cn/q=';
const EASTMONEY_NEWS_API = 'https://np-listapi.eastmoney.com/comm/web/getNewsByColumns';
const EASTMONEY_FUND_FLOW_API = 'https://push2.eastmoney.com/api/qt/clist/get';
const SINA_FINANCE_ROLL_API = 'https://feed.mix.sina.com.cn/api/roll/get';
const QQ_OFFICIAL_API_BASE = 'https://api.sgroup.qq.com';
const QQ_OFFICIAL_ACCESS_TOKEN_API = 'https://bots.qq.com/app/getAppAccessToken';
const DEFAULT_NEWS_QUERY_TIMEOUT_MS = 5000;
const DEFAULT_FUND_FLOW_QUERY_TIMEOUT_MS = 3000;
const DEFAULT_AI_QUESTION =
  '请基于当前持仓、A 股市场指数、市场情绪、中文财经新闻和投资画像，重点判断当前是否适合加仓、是否需要减仓、是否达到清仓条件。请给出明确但条件化的结论、依据、触发条件和明日观察点。';
const SHORT_ANALYSIS_QUESTION =
  '请输出 Telegram 短版分析，控制在 1200 字以内。先给一句明确结论，再用短段落说明市场情绪、A股环境、中文财经新闻、资金流入最强方向、持仓状态、今日建仓候选、今日加仓候选、是否需要减仓、是否达到清仓条件和明日观察点。不要展开长篇推理。建仓候选只能从 buildCandidates 中选择，不能推荐 holdings 中已有基金；加仓候选只能从 holdings 中选择。如果没有合适候选，分别明确写“今日暂无适合建仓的基金”或“今日暂无适合加仓的基金”。';
const DETAILED_ANALYSIS_QUESTION = DEFAULT_AI_QUESTION;
const MIDDAY_ANALYSIS_QUESTION =
  '请输出午盘休息分析，控制在 1000 字以内。重点总结上午市场情绪、A 股指数强弱、资金流入最强方向、中文财经新闻利好/风险，并判断下午是否适合观察、低吸、小额试探或暂不操作。建仓候选优先从 buildCandidates 选择，buildCandidates 为空时可参考 fallbackBuildCandidates 但必须标注“候选来源：资金流方向兜底，非你的自选基金”。午盘不做激进操作建议，不要建议清仓，必须给出下午观察点。';
const LATE_SESSION_ACTION_QUESTION =
  '请输出尾盘半小时操作提醒，控制在 1000 字以内。重点服务 14:50 前是否加仓、是否减仓、是否有未持有建仓候选。必须结合 A 股市场情绪、资金流入最强方向、中文财经新闻利好/风险、当前持仓涨跌、未持有建仓候选和投资画像。结论要明确但条件化，例如“只适合小额加仓/暂不加仓/需要小幅减仓/继续观察”。不轻易建议清仓；如 buildCandidates 为空可参考 fallbackBuildCandidates，但必须标注“候选来源：资金流方向兜底，非你的自选基金”。输出 14:50 前操作建议和放弃操作条件。';
const CLOSE_ANALYSIS_QUESTION =
  '请输出收盘分析，控制在 1200 字以内。总结全天市场情绪、资金流入最强方向、中文财经新闻影响、持仓表现、今日建仓/加仓/减仓判断和明日观察点。收盘分析重点是复盘和明日触发条件，不要编造缺失数据。建仓候选优先从 buildCandidates 选择，buildCandidates 为空时可参考 fallbackBuildCandidates 但必须标注“候选来源：资金流方向兜底，非你的自选基金”。';
const SCHEDULED_ANALYSIS_CONFIG: Record<
  ScheduledAnalysisType,
  { title: string; question: string; maxLength?: number }
> = {
  midday: {
    title: '养基AI午盘休息分析',
    question: MIDDAY_ANALYSIS_QUESTION,
    maxLength: 1400,
  },
  lateSession: {
    title: '养基AI尾盘操作提醒',
    question: LATE_SESSION_ACTION_QUESTION,
    maxLength: 1400,
  },
  close: {
    title: '养基AI收盘分析',
    question: CLOSE_ANALYSIS_QUESTION,
    maxLength: 1600,
  },
};
const COMMAND_QUESTION_MAP: Record<string, { question: string; maxLength?: number }> = {
  分析: { question: SHORT_ANALYSIS_QUESTION, maxLength: 1600 },
  市场分析: { question: SHORT_ANALYSIS_QUESTION, maxLength: 1600 },
  详细分析: { question: DETAILED_ANALYSIS_QUESTION },
  加仓: {
    question:
      '请只回答当前是否适合加仓，控制在 1000 字以内。加仓候选只能从 holdings 当前已持有基金中选择，不能从 buildCandidates 中选择。请结合 A 股市场、中文财经新闻、持仓盈亏、仓位集中度、底层重合度和投资画像，给出结论、依据、触发条件和不适合加仓的风险。如果没有合适加仓候选，明确写“今日暂无适合加仓的基金”。',
    maxLength: 1200,
  },
  建仓: {
    question:
      '请只回答今天哪只未持有基金最适合建仓，控制在 1000 字以内。建仓候选优先从 buildCandidates 中选择，严禁推荐 holdings 或 heldFundCodes 中已经持有的基金；如果 buildCandidates 为空，可以从 fallbackBuildCandidates 中选择，但必须明确写“候选来源：资金流方向兜底，非你的自选基金”。必须先结合 marketSnapshot 判断市场情绪，再结合 newsSnapshot 提取今日利好方向和风险方向，并结合 fundFlowSnapshot 判断资金流入最强方向。只有当候选基金与市场情绪、利好方向、资金流入方向匹配，且与现有持仓不过度重复、锚点偏离合理、符合投资画像时，才可以列为建仓候选。如果 fundFlowSnapshot 缺失或 failed，必须说明“资金流数据暂不可用，本次仅基于市场情绪和新闻利好判断”，不得编造资金流。如果 buildCandidates 和 fallbackBuildCandidates 都为空、市场/新闻/资金流依据不足或没有匹配候选，必须明确写“今日暂无适合建仓的基金”，不能为了回答硬选。请按“市场情绪、今日利好方向、资金流入最强方向、未持有建仓候选、建仓方式、放弃建仓条件”输出，不要输出“为什么不选已有基金”。',
    maxLength: 1200,
  },
  减仓: {
    question:
      '请只回答当前是否需要减仓，控制在 1000 字以内。必须结合 A 股市场、中文财经新闻、持仓盈亏、重合度和投资画像，给出结论、依据、触发条件和暂不减仓的条件。',
    maxLength: 1200,
  },
  清仓: {
    question:
      '请只回答当前是否达到清仓条件，控制在 1000 字以内。清仓判断必须严格，不能只因为单日涨跌；必须结合长期逻辑失效、风格偏离、风险画像冲突、重合度过高或明确止盈止损条件。',
    maxLength: 1200,
  },
};
const TELEGRAM_ANALYSIS_COMMANDS = Object.keys(COMMAND_QUESTION_MAP);
const TELEGRAM_HELP_TEXT =
  '发送“分析”获取短版判断；发送“详细分析”获取完整分析；也可发送“建仓”“加仓”“减仓”“清仓”获取专项判断。';
const TELEGRAM_ANALYSIS_PENDING_TEXT = '收到，正在结合市场情绪、资金流和持仓分析...';
const DEFAULT_MARKET_INDEX_CODES = [
  'sh000001',
  'sz399001',
  'sz399006',
  'sh000300',
  'sh000016',
  'sh000905',
  'sh000852',
  'sh000688',
];
const MARKET_INDEX_NAMES: Record<string, string> = {
  sh000001: '上证指数',
  sz399001: '深证成指',
  sz399006: '创业板指',
  sh000300: '沪深300',
  sh000016: '上证50',
  sh000905: '中证500',
  sh000852: '中证1000',
  sh000688: '科创50',
};
const FUND_FLOW_FALLBACK_CANDIDATES: Array<{
  keywords: string[];
  code: string;
  name: string;
  reason: string;
}> = [
  {
    keywords: ['人工智能', 'ai', '软件', '计算机', '数字', '芯片', '半导体', '电子', '元件', 'pcb', '印制电路板'],
    code: '017811',
    name: '东方人工智能主题混合C',
    reason: '匹配 AI/计算机/半导体方向资金流',
  },
  {
    keywords: ['半导体', '芯片', '电子', '元件', 'pcb', '印制电路板', '集成电路'],
    code: '012969',
    name: '国泰中证半导体材料设备主题ETF联接C',
    reason: '匹配半导体设备与电子产业链资金流',
  },
  {
    keywords: ['新能源', '电池', '光伏', '锂电', '储能', '低碳', '电力设备'],
    code: '012103',
    name: '国寿安保低碳经济混合C',
    reason: '匹配新能源/低碳方向资金流',
  },
  {
    keywords: ['创新', '创业板', '科创', '成长', '自动化设备', '机器人', '高端制造'],
    code: '501205',
    name: '鹏华创新未来混合(LOF)C',
    reason: '匹配科技成长与高端制造方向资金流',
  },
  {
    keywords: ['消费', '食品饮料', '白酒', '医药', '医疗'],
    code: '012414',
    name: '招商中证白酒指数C',
    reason: '匹配消费/食品饮料方向资金流',
  },
];

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

const isEnabled = (value: string | undefined, defaultValue = true) => {
  if (value === undefined) return defaultValue;
  return value.trim().toLowerCase() !== 'false';
};

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseCsvSet = (value: string | undefined) =>
  new Set(
    (value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );

const textEncoder = new TextEncoder();

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

const hexToBytes = (hex: string) => {
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) {
    throw new Error('无效的十六进制字符串');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
};

const fetchText = async (url: string, init: RequestInit, label: string): Promise<string> => {
  const response = await fetch(url, init);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`${label} 请求失败: ${response.status} ${text}`.trim());
  }
  return response.text();
};

const fetchTextWithTimeout = async (
  url: string,
  init: RequestInit,
  label: string,
  timeoutMs: number,
): Promise<string> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchText(url, { ...init, signal: controller.signal }, label);
  } finally {
    clearTimeout(timeout);
  }
};

const fetchJson = async <T>(url: string, init: RequestInit, label: string): Promise<T> => {
  const text = await fetchText(url, init, label);
  return JSON.parse(text) as T;
};

const fetchJsonWithTimeout = async <T>(
  url: string,
  init: RequestInit,
  label: string,
  timeoutMs: number,
): Promise<T> => {
  const text = await fetchTextWithTimeout(url, init, label, timeoutMs);
  return JSON.parse(text) as T;
};

const buildQqOfficialSeed = (secret: string) => {
  let seed = secret;
  while (seed.length < 32) seed += seed;
  return textEncoder.encode(seed.slice(0, 32));
};

const signQqOfficialMessage = async (secret: string, message: string) => {
  return bytesToHex(await ed.sign(textEncoder.encode(message), buildQqOfficialSeed(secret)));
};

const verifyQqOfficialSignature = async (env: Env, rawBody: string, request: Request) => {
  const signature = request.headers.get('X-Signature-Ed25519');
  const timestamp = request.headers.get('X-Signature-Timestamp');
  if (!signature || !timestamp) return false;
  try {
    const secret = requireEnv(env, 'QQ_OFFICIAL_APP_SECRET');
    const publicKey = await ed.getPublicKey(buildQqOfficialSeed(secret));
    return await ed.verify(hexToBytes(signature), textEncoder.encode(`${timestamp}${rawBody}`), publicKey);
  } catch {
    return false;
  }
};

const buildQqOfficialValidationResponse = async (env: Env, data: QqOfficialValidationPayload) => {
  const plainToken = data.plain_token?.trim();
  const eventTs = data.event_ts?.trim();
  if (!plainToken || !eventTs) throw new Error('QQ 回调验证参数缺失');
  const signature = await signQqOfficialMessage(
    requireEnv(env, 'QQ_OFFICIAL_APP_SECRET'),
    `${eventTs}${plainToken}`,
  );
  return { plain_token: plainToken, signature };
};

const fetchQqOfficialAccessToken = async (env: Env) => {
  const response = await fetchJson<QqOfficialAccessTokenResponse>(
    QQ_OFFICIAL_ACCESS_TOKEN_API,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId: requireEnv(env, 'QQ_OFFICIAL_APP_ID'),
        clientSecret: requireEnv(env, 'QQ_OFFICIAL_APP_SECRET'),
      }),
    },
    '获取 QQ 官方 access_token',
  );
  if (!response.access_token) throw new Error('QQ 官方 access_token 为空');
  return response.access_token;
};

const sendQqOfficialGroupMessage = async (params: {
  env: Env;
  groupOpenid: string;
  content: string;
  msgId: string;
  msgSeq: number;
}) => {
  const accessToken = await fetchQqOfficialAccessToken(params.env);
  await fetchJson<unknown>(
    `${QQ_OFFICIAL_API_BASE}/v2/groups/${params.groupOpenid}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `QQBot ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: params.content,
        msg_type: 0,
        msg_id: params.msgId,
        msg_seq: params.msgSeq,
      }),
    },
    '发送 QQ 官方群消息',
  );
  return 1;
};

const sendQqOfficialGroupTextChunks = async (params: {
  env: Env;
  groupOpenid: string;
  text: string;
  msgId: string;
  startSeq: number;
}) => {
  const chunks = splitTelegramMessage(params.text);
  let sentMessages = 0;
  for (const [index, chunk] of chunks.entries()) {
    sentMessages += await sendQqOfficialGroupMessage({
      env: params.env,
      groupOpenid: params.groupOpenid,
      content: chunk,
      msgId: params.msgId,
      msgSeq: params.startSeq + index,
    });
  }
  return sentMessages;
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

const parseTencentMarketLine = (line: string): MarketIndexSnapshot | null => {
  if (!line.includes('=')) return null;
  const [leftSide, rawRightSide] = line.split('=');
  const code = leftSide?.match(/v_(.+)/)?.[1];
  if (!code || !rawRightSide) return null;

  const parts = rawRightSide.replace(/"/g, '').split('~');
  const name = parts[1] || MARKET_INDEX_NAMES[code] || code;
  const price = Number.parseFloat(parts[3] || '');
  const changePct = Number.parseFloat(parts[32] || '');
  const change = Number.parseFloat(parts[31] || '');
  const updateTime = parts[30];
  if (!Number.isFinite(price) || !Number.isFinite(changePct)) return null;

  return {
    code,
    name,
    price: round(price, 2),
    changePct: round(changePct, 2),
    change: Number.isFinite(change) ? round(change, 2) : undefined,
    updateTime,
  };
};

const fetchMarketSnapshot = async (env: Env): Promise<MarketSnapshot | undefined> => {
  if (!isEnabled(env.MARKET_ANALYSIS_ENABLED, true)) return undefined;
  const codes = (env.MARKET_INDEX_CODES || DEFAULT_MARKET_INDEX_CODES.join(','))
    .split(',')
    .map((code) => code.trim())
    .filter(Boolean);
  if (codes.length === 0) return undefined;

  try {
    const text = await fetchText(`${TENCENT_QUOTE_API}${codes.join(',')}`, {}, '读取 A 股市场指数');
    const indices = text
      .split(';')
      .map(parseTencentMarketLine)
      .filter((item): item is MarketIndexSnapshot => Boolean(item));
    const status =
      indices.length === 0 ? 'missing' : indices.length === codes.length ? 'available' : 'partial';
    return {
      asOf: new Date().toISOString(),
      indices,
      dataStatus: status,
    };
  } catch (error) {
    console.warn('读取 A 股市场指数失败', error);
    return {
      asOf: new Date().toISOString(),
      indices: [],
      dataStatus: 'missing',
    };
  }
};

const fetchEastMoneyFundFlowItems = async (
  category: FundFlowItemSnapshot['category'],
  fs: string,
  maxItems: number,
  timeoutMs: number,
): Promise<FundFlowItemSnapshot[]> => {
  const url = new URL(EASTMONEY_FUND_FLOW_API);
  url.searchParams.set('pn', '1');
  url.searchParams.set('pz', String(maxItems));
  url.searchParams.set('po', '1');
  url.searchParams.set('np', '1');
  url.searchParams.set('ut', 'bd1d9ddb04089700cf9c27f6f7426281');
  url.searchParams.set('fltt', '2');
  url.searchParams.set('invt', '2');
  url.searchParams.set('fid', 'f62');
  url.searchParams.set('fs', fs);
  url.searchParams.set('fields', 'f12,f14,f3,f62,f184');
  const response = await fetchJsonWithTimeout<EastMoneyFundFlowResponse>(
    url.toString(),
    { headers: { Accept: 'application/json' } },
    `读取东方财富${category === 'sector' ? '行业板块' : '概念板块'}资金流`,
    timeoutMs,
  );

  return (response.data?.diff || [])
    .map<FundFlowItemSnapshot | null>((item, index) => {
      const name = item.f14?.trim();
      const netInflow = Number(item.f62);
      if (!name || !Number.isFinite(netInflow)) return null;
      const changePct = Number(item.f3);
      const mainNetInflowPct = Number(item.f184);

      return {
        code: item.f12,
        name,
        category,
        netInflow: round(netInflow, 2),
        netInflowRank: index + 1,
        changePct: Number.isFinite(changePct) ? round(changePct, 2) : undefined,
        mainNetInflowPct: Number.isFinite(mainNetInflowPct) ? round(mainNetInflowPct, 2) : undefined,
      };
    })
    .filter((item): item is FundFlowItemSnapshot => Boolean(item));
};

const fetchFundFlowSnapshot = async (env: Env): Promise<FundFlowSnapshot | undefined> => {
  if (!isEnabled(env.MARKET_ANALYSIS_ENABLED, true)) return undefined;
  const timeoutMs = Math.min(
    parsePositiveInt(env.NEWS_QUERY_TIMEOUT_MS, DEFAULT_FUND_FLOW_QUERY_TIMEOUT_MS),
    5000,
  );
  const failedSources: string[] = [];
  const items: FundFlowItemSnapshot[] = [];

  try {
    items.push(...(await fetchEastMoneyFundFlowItems('sector', 'm:90+t:2', 10, timeoutMs)));
  } catch {
    failedSources.push('eastmoney-sector-flow');
  }

  try {
    items.push(...(await fetchEastMoneyFundFlowItems('concept', 'm:90+t:3', 10, timeoutMs)));
  } catch {
    failedSources.push('eastmoney-concept-flow');
  }

  const rankedItems = items
    .sort((a, b) => b.netInflow - a.netInflow)
    .slice(0, 12)
    .map((item, index) => ({ ...item, netInflowRank: index + 1 }));

  if (rankedItems.length === 0 && failedSources.length > 0) {
    return {
      asOf: new Date().toISOString(),
      provider: 'eastmoney',
      items: [],
      dataStatus: 'failed',
      failedSources,
    };
  }

  return {
    asOf: new Date().toISOString(),
    provider: 'eastmoney',
    items: rankedItems,
    dataStatus:
      rankedItems.length === 0 ? 'missing' : failedSources.length > 0 ? 'partial' : 'available',
    failedSources: failedSources.length > 0 ? failedSources : undefined,
  };
};

const buildNewsKeywords = (holdings: HoldingsSnapshot) => {
  const keywords = new Set<string>([
    'A股',
    '政策',
    '财报',
    '公告',
    '业绩预告',
    '人工智能',
    '低碳',
    '新能源',
  ]);
  holdings.holdings.slice(0, 5).forEach((fund) => keywords.add(fund.name));
  holdings.holdings.forEach((fund) => {
    fund.topEquityHoldings?.slice(0, 5).forEach((equity) => {
      if (equity.name.trim()) keywords.add(equity.name.trim());
      if (equity.sector?.trim()) keywords.add(equity.sector.trim());
    });
  });
  return Array.from(keywords).slice(0, 18);
};

interface EastMoneyNewsItem {
  title?: string;
  mediaName?: string;
  showTime?: string;
  url?: string;
  uniqueUrl?: string;
}

interface EastMoneyNewsResponse {
  data?: {
    list?: EastMoneyNewsItem[];
  };
}

interface SinaNewsItem {
  title?: string;
  url?: string;
  ctime?: string;
  media_name?: string;
  source?: string;
}

interface SinaNewsResponse {
  result?: {
    data?: SinaNewsItem[];
  };
}

const isNewsWithinLookback = (publishedAt: string | undefined, lookbackHours: number) => {
  if (!publishedAt) return true;
  const normalized = /^\d+$/.test(publishedAt)
    ? Number.parseInt(publishedAt, 10) * 1000
    : Date.parse(publishedAt.replace(/-/g, '/'));
  if (!Number.isFinite(normalized)) return true;
  return Date.now() - normalized <= lookbackHours * 60 * 60 * 1000;
};

const dedupeNewsItems = (items: NewsItemSnapshot[], maxItems: number) => {
  const seen = new Set<string>();
  return items
    .filter((item) => {
      const key = item.url || item.title;
      if (!item.title || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maxItems);
};

const fetchEastMoneyNews = async (
  maxItems: number,
  lookbackHours: number,
  timeoutMs: number,
): Promise<NewsItemSnapshot[]> => {
  const url = new URL(EASTMONEY_NEWS_API);
  url.searchParams.set('client', 'web');
  url.searchParams.set('biz', 'web_news_col');
  url.searchParams.set('column', '345');
  url.searchParams.set('order', '1');
  url.searchParams.set('needInteractData', '0');
  url.searchParams.set('page_index', '1');
  url.searchParams.set('page_size', String(maxItems));
  url.searchParams.set('req_trace', String(Date.now()));
  const response = await fetchJsonWithTimeout<EastMoneyNewsResponse>(
    url.toString(),
    { headers: { Accept: 'application/json' } },
    '读取东方财富新闻',
    timeoutMs,
  );

  return (response.data?.list || [])
    .map<NewsItemSnapshot | null>((item) => {
      const title = item.title?.trim();
      if (!title) return null;
      return {
        title,
        source: item.mediaName || '东方财富',
        url: item.url || item.uniqueUrl,
        publishedAt: item.showTime,
        language: 'zh-CN',
      };
    })
    .filter((item): item is NewsItemSnapshot => Boolean(item))
    .filter((item) => isNewsWithinLookback(item.publishedAt, lookbackHours));
};

const fetchSinaNews = async (
  maxItems: number,
  lookbackHours: number,
  timeoutMs: number,
): Promise<NewsItemSnapshot[]> => {
  const url = new URL(SINA_FINANCE_ROLL_API);
  url.searchParams.set('pageid', '153');
  url.searchParams.set('lid', '2510');
  url.searchParams.set('k', '');
  url.searchParams.set('num', String(maxItems));
  url.searchParams.set('page', '1');
  url.searchParams.set('r', String(Date.now()));
  const response = await fetchJsonWithTimeout<SinaNewsResponse>(
    url.toString(),
    { headers: { Accept: 'application/json' } },
    '读取新浪财经新闻',
    timeoutMs,
  );

  return (response.result?.data || [])
    .map<NewsItemSnapshot | null>((item) => {
      const title = item.title?.trim();
      if (!title) return null;
      return {
        title,
        source: item.media_name || item.source || '新浪财经',
        url: item.url,
        publishedAt: item.ctime,
        language: 'zh-CN',
      };
    })
    .filter((item): item is NewsItemSnapshot => Boolean(item))
    .filter((item) => isNewsWithinLookback(item.publishedAt, lookbackHours));
};

const fetchNewsSnapshot = async (
  env: Env,
  holdings: HoldingsSnapshot,
): Promise<NewsSnapshot | undefined> => {
  if (!isEnabled(env.NEWS_ANALYSIS_ENABLED, true)) return undefined;
  const configuredProvider = env.NEWS_PROVIDER || 'mixed';
  const provider =
    configuredProvider === 'eastmoney' || configuredProvider === 'sina' || configuredProvider === 'mixed'
      ? configuredProvider
      : 'mixed';

  const lookbackHours = parsePositiveInt(env.NEWS_LOOKBACK_HOURS, 72);
  const maxItems = Math.min(parsePositiveInt(env.NEWS_MAX_ITEMS, 12), 25);
  const timeoutMs = Math.min(
    parsePositiveInt(env.NEWS_QUERY_TIMEOUT_MS, DEFAULT_NEWS_QUERY_TIMEOUT_MS),
    10000,
  );
  const keywords = buildNewsKeywords(holdings);
  const items: NewsItemSnapshot[] = [];
  const failedSources: string[] = [];

  if (provider === 'eastmoney' || provider === 'mixed') {
    try {
      items.push(...(await fetchEastMoneyNews(maxItems, lookbackHours, timeoutMs)));
    } catch {
      failedSources.push('eastmoney');
    }
  }

  if ((provider === 'sina' || provider === 'mixed') && items.length < maxItems) {
    try {
      items.push(...(await fetchSinaNews(maxItems, lookbackHours, timeoutMs)));
    } catch {
      failedSources.push('sina');
    }
  }

  const uniqueItems = dedupeNewsItems(items, maxItems);
  const expectedSources = provider === 'mixed' ? 2 : 1;
  if (failedSources.length >= expectedSources && uniqueItems.length === 0) {
    return {
      asOf: new Date().toISOString(),
      provider,
      keywords,
      lookbackHours,
      items: [],
      dataStatus: 'failed',
      failedSources,
    };
  }

  return {
    asOf: new Date().toISOString(),
    provider,
    keywords,
    lookbackHours,
    items: uniqueItems,
    dataStatus: uniqueItems.length > 0 ? 'available' : 'missing',
    failedSources: failedSources.length > 0 ? failedSources : undefined,
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

const buildBuildCandidates = (
  watchlists: BackupWatchlistItem[] | undefined,
  heldFundCodes: Set<string>,
): BuildCandidateSnapshotItem[] => {
  return (watchlists || [])
    .filter((item) => item.type === 'fund' && !heldFundCodes.has(item.code))
    .map((item) => ({
      code: item.code,
      name: item.name,
      platform: item.platform,
      source: 'watchlist',
      currentPrice: round(item.currentPrice, 4),
      dayChangePct: round(item.dayChangePct),
      anchorPrice: round(item.anchorPrice, 4),
      anchorDate: item.anchorDate,
      lastUpdate: item.lastUpdate,
      anchorChangePct:
        item.anchorPrice > 0 ? round(((item.currentPrice - item.anchorPrice) / item.anchorPrice) * 100) : 0,
    }))
    .sort((a, b) => a.dayChangePct - b.dayChangePct || a.anchorChangePct - b.anchorChangePct)
    .slice(0, 20);
};

const buildFallbackBuildCandidates = (
  fundFlowSnapshot: FundFlowSnapshot | undefined,
  heldFundCodes: Set<string>,
): BuildCandidateSnapshotItem[] => {
  if (!fundFlowSnapshot?.items.length) return [];
  const flowThemes = fundFlowSnapshot.items.slice(0, 6).map((item) => item.name.toLowerCase());
  const seen = new Set<string>();

  return FUND_FLOW_FALLBACK_CANDIDATES.filter((candidate) => !heldFundCodes.has(candidate.code))
    .map<BuildCandidateSnapshotItem | null>((candidate) => {
      const matchedTheme = flowThemes.find((theme) =>
        candidate.keywords.some((keyword) => theme.includes(keyword.toLowerCase())),
      );
      if (!matchedTheme || seen.has(candidate.code)) return null;
      seen.add(candidate.code);

      return {
        code: candidate.code,
        name: candidate.name,
        source: 'fundFlowFallback',
        matchedFlowTheme: matchedTheme,
        reason: candidate.reason,
        currentPrice: 0,
        dayChangePct: 0,
        anchorPrice: 0,
        anchorDate: '',
        lastUpdate: fundFlowSnapshot.asOf,
        anchorChangePct: 0,
      };
    })
    .filter((item): item is BuildCandidateSnapshotItem => Boolean(item))
    .slice(0, 5);
};

const buildHoldingsSnapshot = async (payload: FundBackupPayload): Promise<HoldingsSnapshot> => {
  const validFunds = payload.funds
    .filter((fund) => fund.holdingShares > 0 && fund.currentNav > 0)
  const heldFundCodeSet = new Set(validFunds.map((fund) => fund.code));
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
    buildCandidates: buildBuildCandidates(payload.watchlists, heldFundCodeSet),
    fallbackBuildCandidates: [],
    heldFundCodes: Array.from(heldFundCodeSet),
    equityOverlap: buildEquityOverlap(holdings),
    dataCoverage: buildHoldingsDataCoverage(holdings, payload.investmentProfile),
    investmentProfile: payload.investmentProfile,
  };
};

const buildHoldingsAnalysisPrompt = (context: AnalysisContextSnapshot, mode: string) => {
  const { holdings, marketSnapshot, newsSnapshot, fundFlowSnapshot } = context;
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
    `未持有自选建仓候选数量: ${holdings.buildCandidates.length}`,
    `资金流兜底建仓候选数量: ${holdings.fallbackBuildCandidates.length}`,
    `A股市场数据: ${marketSnapshot?.dataStatus ?? 'missing'}`,
    `消息面/财报/公告数据: ${newsSnapshot?.dataStatus ?? 'missing'}`,
    `资金流数据: ${fundFlowSnapshot?.dataStatus ?? 'missing'}`,
    fundFlowSnapshot?.items[0]
      ? `资金流入最强方向: ${fundFlowSnapshot.items[0].name} (${fundFlowSnapshot.items[0].netInflow})`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  return `${modeInstruction}\n要求：\n1) 使用简体中文回答。\n2) 只基于给定 JSON 数据推理，不要编造不存在的数据。\n3) 如果前十大重仓股、真实行业分布、基金经理调仓、账户外资产、风险承受能力或投资期限在 dataCoverage 中标记为 missing/partial，必须明确说明“当前数据缺失/不完整”，不能当作已知事实分析。\n4) 如果 marketSnapshot 缺失或 dataStatus 为 missing/partial，必须说明“A 股市场数据缺失/不完整”，不得假设指数涨跌。\n5) 如果 newsSnapshot 缺失或 dataStatus 为 failed，必须说明“中文财经新闻接口失败，消息面/财报/公告暂不可用”，不得说成近 72 小时无新闻。\n6) 如果 newsSnapshot.dataStatus 为 missing，才可以说明“最近 ${newsSnapshot?.lookbackHours ?? 72} 小时未抓到可用中文财经新闻项”。\n7) 如果 fundFlowSnapshot 缺失、dataStatus 为 missing 或 failed，必须说明“资金流数据暂不可用”，不得编造资金流入方向或金额；如果 partial，必须说明资金流数据不完整。\n8) 不得编造新闻标题、财报数据、公告内容或资金流数据，不得把未确认传闻当事实。\n9) 可以基于 topEquityHoldings 和 equityOverlap 分析底层股票重合度；没有数据时必须跳过。\n10) 必须分开输出“今日建仓候选”“今日加仓候选”“是否需要减仓”“是否达到清仓条件”四段，结论只能是条件判断，例如“暂不适合/只适合小额分批/等待确认/未达到清仓条件”。\n11) 今日建仓候选优先从 buildCandidates 中选择，严禁推荐 holdings 或 heldFundCodes 中已有基金。只有当 buildCandidates 为空时，才可以从 fallbackBuildCandidates 中选择；使用 fallbackBuildCandidates 时必须明确写“候选来源：资金流方向兜底，非你的自选基金”。建仓判断必须同时考虑 A 股市场情绪、中文财经新闻利好/风险、fundFlowSnapshot 资金流入最强方向、候选基金锚点偏离和投资画像。如果两个候选列表都为空或没有合适候选，必须明确写“今日暂无适合建仓的基金”，不能硬选。\n12) 今日加仓候选只能从 holdings 中选择；如果没有合适加仓候选，必须明确写“今日暂无适合加仓的基金”。\n13) 加仓、减仓、清仓建议必须同时给出依据和触发条件；清仓不能只因为单日涨跌，必须基于长期逻辑失效、风格偏离、风险画像冲突、重合度过高或明确止盈止损条件。\n14) 输出适合 Telegram 阅读，标题清晰，重点用短句。\n\n请按以下结构输出：\n一、A 股市场环境\n二、持仓表现\n三、消息面/财报/公告影响\n四、资金流入最强方向\n五、今日建仓候选\n六、今日加仓候选\n七、是否需要减仓\n八、是否达到清仓条件\n九、明日观察点\n\n组合摘要：\n${summary}\n\n以下是分析上下文(JSON)：\n${JSON.stringify(context, null, 2)}`;
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

const analyzeHoldings = async (
  env: Env,
  context: AnalysisContextSnapshot,
  questionOverride?: string,
) => {
  if (context.holdings.holdings.length === 0) {
    return '当前 Gist 备份中没有有效持仓，未生成 AI 分析。';
  }

  const mode = env.AI_MODE || 'deep';
  const question = questionOverride || env.AI_QUESTION || DEFAULT_AI_QUESTION;
  const systemPrompt = buildHoldingsAnalysisPrompt(context, mode);
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

const sendTelegramMessage = async (env: Env, text: string, chatId = requireEnv(env, 'TELEGRAM_CHAT_ID')) => {
  const token = requireEnv(env, 'TELEGRAM_BOT_TOKEN');
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

const truncateForTelegram = (text: string, maxLength?: number) => {
  if (!maxLength || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}\n\n已截断，发送“详细分析”查看完整版本。`;
};

const buildAnalysisMessage = async (
  env: Env,
  options?: { question?: string; maxLength?: number; title?: string },
) => {
  const payload = await readGistBackup(env);
  const snapshot = await buildHoldingsSnapshot(payload);
  const [marketSnapshot, newsSnapshot, fundFlowSnapshot] = await Promise.all([
    fetchMarketSnapshot(env),
    fetchNewsSnapshot(env, snapshot),
    fetchFundFlowSnapshot(env),
  ]);
  const heldFundCodeSet = new Set(snapshot.heldFundCodes);
  const snapshotWithFallback: HoldingsSnapshot = {
    ...snapshot,
    fallbackBuildCandidates: buildFallbackBuildCandidates(fundFlowSnapshot, heldFundCodeSet),
  };
  const analysis = await analyzeHoldings(
    env,
    { holdings: snapshotWithFallback, marketSnapshot, newsSnapshot, fundFlowSnapshot },
    options?.question,
  );
  const title = `${options?.title || '养基AI持仓分析'}\n时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n`;
  const body = truncateForTelegram(analysis, options?.maxLength);

  return {
    text: `${title}\n${body}`,
    holdings: snapshot.holdings.length,
    totalAssets: snapshot.totalAssets,
  };
};

const runReminder = async (env: Env) => {
  const analysisMessage = await buildAnalysisMessage(env);
  const sentMessages = await sendTelegramMessage(env, analysisMessage.text);

  return {
    ok: true,
    holdings: analysisMessage.holdings,
    totalAssets: analysisMessage.totalAssets,
    sentMessages,
  };
};

const resolveScheduledAnalysisType = (cron: string): ScheduledAnalysisType => {
  if (cron === '35 3 * * 1-5') return 'midday';
  if (cron === '30 6 * * 1-5') return 'lateSession';
  return 'close';
};

const runScheduledReminder = async (env: Env, analysisType: ScheduledAnalysisType) => {
  const config = SCHEDULED_ANALYSIS_CONFIG[analysisType];
  const analysisMessage = await buildAnalysisMessage(env, config);
  const sentMessages = await sendTelegramMessage(env, analysisMessage.text);

  return {
    ok: true,
    analysisType,
    holdings: analysisMessage.holdings,
    totalAssets: analysisMessage.totalAssets,
    sentMessages,
  };
};

const isAuthorizedManualRun = (request: Request, env: Env) => {
  if (!env.CRON_SECRET) return true;
  return request.headers.get('Authorization') === `Bearer ${env.CRON_SECRET}`;
};

const isAuthorizedTelegramWebhook = (request: Request, env: Env) => {
  if (!env.TELEGRAM_WEBHOOK_SECRET) return true;
  return request.headers.get('X-Telegram-Bot-Api-Secret-Token') === env.TELEGRAM_WEBHOOK_SECRET;
};

const resolveTelegramCommandConfig = (text: string) => {
  const normalized = text.trim().replace(/^\//, '').toLowerCase();
  const command = TELEGRAM_ANALYSIS_COMMANDS.find((item) => item.toLowerCase() === normalized);
  return command ? COMMAND_QUESTION_MAP[command] : null;
};

const handleTelegramWebhook = async (request: Request, env: Env) => {
  if (!isAuthorizedTelegramWebhook(request, env)) {
    return json({ ok: false, error: '未授权' }, 401);
  }

  const update = (await request.json().catch(() => null)) as TelegramUpdate | null;
  const chatId = update?.message?.chat?.id;
  const text = update?.message?.text?.trim() || '';
  if (!chatId) return json({ ok: true, ignored: true });

  const chatIdStr = String(chatId);
  if (chatIdStr !== requireEnv(env, 'TELEGRAM_CHAT_ID')) {
    return json({ ok: true, ignored: true });
  }

  const commandConfig = resolveTelegramCommandConfig(text);
  if (!commandConfig) {
    const sentMessages = await sendTelegramMessage(env, TELEGRAM_HELP_TEXT, chatIdStr);
    return json({ ok: true, handled: 'help', sentMessages });
  }

  const pendingMessages = await sendTelegramMessage(env, TELEGRAM_ANALYSIS_PENDING_TEXT, chatIdStr);
  try {
    const analysisMessage = await buildAnalysisMessage(env, commandConfig);
    const analysisMessages = await sendTelegramMessage(env, analysisMessage.text, chatIdStr);
    return json({
      ok: true,
      handled: 'analysis',
      holdings: analysisMessage.holdings,
      totalAssets: analysisMessage.totalAssets,
      sentMessages: pendingMessages + analysisMessages,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    const failureMessages = await sendTelegramMessage(env, `分析失败：${message}`, chatIdStr);
    return json(
      { ok: false, handled: 'analysis', error: message, sentMessages: pendingMessages + failureMessages },
      500,
    );
  }
};

const extractQqOfficialCommandText = (content: string | undefined) => {
  return (content || '')
    .replace(/<@![^>]+>/g, '')
    .replace(/<@[^>]+>/g, '')
    .trim();
};

const isAuthorizedQqOfficialMessage = (env: Env, message: QqOfficialGroupAtMessage) => {
  const allowedGroups = parseCsvSet(env.QQ_OFFICIAL_ALLOWED_GROUP_OPENIDS);
  const allowedMembers = parseCsvSet(env.QQ_OFFICIAL_ALLOWED_MEMBER_OPENIDS);
  const groupOpenid = message.group_openid || '';
  const memberOpenid = message.author?.member_openid || '';
  const allowedGroup = allowedGroups.size > 0 && allowedGroups.has(groupOpenid);
  const allowedMember = allowedMembers.size > 0 && allowedMembers.has(memberOpenid);
  if (!allowedGroup || !allowedMember) {
    console.warn('忽略未授权 QQ 官方机器人消息', { groupOpenid, memberOpenid });
  }
  return allowedGroup && allowedMember;
};

const handleQqOfficialWebhook = async (request: Request, env: Env) => {
  if (!isEnabled(env.QQ_OFFICIAL_ENABLED, false)) {
    return json({ ok: false, error: 'QQ 官方机器人未启用' }, 404);
  }

  const rawBody = await request.text();
  const payload = JSON.parse(rawBody) as QqOfficialPayload;

  if (payload.op === 13) {
    return json(await buildQqOfficialValidationResponse(env, payload.d as QqOfficialValidationPayload));
  }

  const hasSignatureHeaders =
    request.headers.has('X-Signature-Ed25519') || request.headers.has('X-Signature-Timestamp');
  if (hasSignatureHeaders && !(await verifyQqOfficialSignature(env, rawBody, request))) {
    return json({ ok: false, error: 'QQ 官方回调签名无效' }, 401);
  }

  if (payload.t !== 'GROUP_AT_MESSAGE_CREATE') {
    return json({ ok: true, ignored: true });
  }

  const message = payload.d as QqOfficialGroupAtMessage;
  if (!message.group_openid || !message.id) {
    return json({ ok: true, ignored: true });
  }

  if (!isAuthorizedQqOfficialMessage(env, message)) {
    return json({ ok: true, ignored: true });
  }

  const commandConfig = resolveTelegramCommandConfig(extractQqOfficialCommandText(message.content));
  if (!commandConfig) {
    return json({ ok: true, handled: 'help' });
  }

  const pendingMessages = await sendQqOfficialGroupTextChunks({
    env,
    groupOpenid: message.group_openid,
    text: TELEGRAM_ANALYSIS_PENDING_TEXT,
    msgId: message.id,
    startSeq: 1,
  });

  try {
    const analysisMessage = await buildAnalysisMessage(env, commandConfig);
    const analysisMessages = await sendQqOfficialGroupTextChunks({
      env,
      groupOpenid: message.group_openid,
      text: analysisMessage.text,
      msgId: message.id,
      startSeq: 2,
    });

    return json({
      ok: true,
      handled: 'analysis',
      holdings: analysisMessage.holdings,
      totalAssets: analysisMessage.totalAssets,
      sentMessages: pendingMessages + analysisMessages,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    const failureMessages = await sendQqOfficialGroupTextChunks({
      env,
      groupOpenid: message.group_openid,
      text: `分析失败：${errorMessage}`,
      msgId: message.id,
      startSeq: 2,
    });
    return json(
      {
        ok: false,
        handled: 'analysis',
        error: errorMessage,
        sentMessages: pendingMessages + failureMessages,
      },
      500,
    );
  }
};

const setupTelegramWebhook = async (request: Request, env: Env) => {
  if (!isAuthorizedManualRun(request, env)) {
    return json({ ok: false, error: '未授权' }, 401);
  }
  const secretToken = requireEnv(env, 'TELEGRAM_WEBHOOK_SECRET');
  const token = requireEnv(env, 'TELEGRAM_BOT_TOKEN');
  const url = new URL(request.url);
  const webhookUrl = `${url.origin}/telegram`;
  const result = await fetchJson<unknown>(
    `https://api.telegram.org/bot${token}/setWebhook`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl, secret_token: secretToken }),
    },
    '设置 Telegram webhook',
  );

  return json({ ok: true, webhookUrl, result });
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return json({ ok: true, service: 'telegram-ai-reminder' });
    }

    if (url.pathname === '/telegram' && request.method === 'POST') {
      try {
        return await handleTelegramWebhook(request, env);
      } catch (error) {
        return json(
          { ok: false, error: error instanceof Error ? error.message : '未知错误' },
          500,
        );
      }
    }

    if (url.pathname === '/qq-official' && request.method === 'POST') {
      try {
        return await handleQqOfficialWebhook(request, env);
      } catch (error) {
        return json(
          { ok: false, error: error instanceof Error ? error.message : '未知错误' },
          500,
        );
      }
    }

    if (url.pathname === '/setup-telegram-webhook' && request.method === 'POST') {
      try {
        return await setupTelegramWebhook(request, env);
      } catch (error) {
        return json(
          { ok: false, error: error instanceof Error ? error.message : '未知错误' },
          500,
        );
      }
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

  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const analysisType = resolveScheduledAnalysisType(event.cron);
    ctx.waitUntil(
      runScheduledReminder(env, analysisType).catch(async (error) => {
        const message = error instanceof Error ? error.message : '未知错误';
        await sendTelegramMessage(env, `${SCHEDULED_ANALYSIS_CONFIG[analysisType].title}定时任务失败：${message}`).catch(
          () => undefined,
        );
      }),
    );
  },
};
