import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getLlmProxyBaseUrl } from './llmProxy';

export type AiProvider = 'openai' | 'gemini' | 'customOpenAi';

export interface AiAnalysisMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type AiAnalysisMode = 'quick' | 'deep' | 'risk';

export interface AiPromptOptions {
  mode?: AiAnalysisMode;
}

export interface AiCompressionOptions {
  maxTokens: number;
  keepRecentMessages?: number;
}

export interface AiStructuredAnalysisResult {
  summary: string;
  bullets: string[];
  risks: string[];
  opportunities: string[];
  actions: string[];
  metrics?: Array<{
    key: string;
    label: string;
    value: number | string;
    unit?: string;
  }>;
  visualizations?: Array<{
    type: 'pie' | 'bar' | 'line' | 'heatmap' | 'radar';
    title: string;
    description?: string;
    series: Array<{
      name: string;
      value: number;
      category?: string;
      color?: string;
    }>;
  }>;
}

export interface AiAnalysisStreamHandlers {
  onDelta?: (delta: string) => void;
  onDone?: (fullText: string) => void;
  onError?: (error: unknown) => void;
}

export interface HoldingSnapshotItem {
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
}

export interface HoldingsSnapshot {
  asOf: string;
  currency: string;
  totalAssets: number;
  totalDayGain: number;
  totalDayGainPct: number;
  holdingGain: number;
  holdingGainPct: number;
  holdings: HoldingSnapshotItem[];
}

const OPENAI_BASE_URL = 'https://api.openai.com/v1';
const AI_ANALYSIS_CACHE_PREFIX = 'ai_analysis_cache:';

const estimateTokens = (text: string) => Math.ceil(text.length * 0.7);

const buildHoldingsSummary = (holdings: HoldingsSnapshot) => {
  const sortedByGain = [...holdings.holdings].sort((a, b) => b.totalGainPct - a.totalGainPct);
  const sortedByValue = [...holdings.holdings].sort((a, b) => b.marketValue - a.marketValue);
  const topGain = sortedByGain[0];
  const topLoss = sortedByGain[sortedByGain.length - 1];
  const concentration =
    holdings.totalAssets > 0
      ? sortedByValue.slice(0, 3).reduce((sum, item) => sum + item.marketValue, 0) / holdings.totalAssets
      : 0;

  return {
    lines: [
      `总资产: ${holdings.totalAssets}`,
      `持仓数量: ${holdings.holdings.length}`,
      `总收益: ${holdings.holdingGain} (${holdings.holdingGainPct}%)`,
      `日收益: ${holdings.totalDayGain} (${holdings.totalDayGainPct}%)`,
      topGain ? `收益最佳: ${topGain.name} (${topGain.totalGainPct}%)` : '',
      topLoss ? `收益最弱: ${topLoss.name} (${topLoss.totalGainPct}%)` : '',
      `前三大仓位集中度: ${(concentration * 100).toFixed(1)}%`,
    ].filter(Boolean),
  };
};

export const buildHoldingsAnalysisPrompt = (
  holdings: HoldingsSnapshot,
  options: AiPromptOptions = {},
) => {
  const mode = options.mode || 'quick';
  const summary = buildHoldingsSummary(holdings).lines.join('\n');

  const modeInstruction =
    mode === 'risk'
      ? '你是一位专注风险评估的基金持仓分析助手，请优先识别回撤、集中度、单市场暴露与组合脆弱点。'
      : mode === 'deep'
        ? '你是一位资深基金投顾，请从收益、配置、集中度、风险、改进建议等多个维度做深度分析。'
        : '你是一位基金持仓分析助手，请用快速诊断方式先给关键结论，再补充依据。';

  const modeChecklist =
    mode === 'risk'
      ? '请输出：1) 风险结论 2) 风险来源 3) 风险缓释建议。'
      : mode === 'deep'
        ? '请输出：1) 组合概览 2) 收益归因 3) 风险评估 4) 优化建议。'
        : '请输出：1) 快速结论 2) 关键亮点 3) 主要问题 4) 下一步建议。';

  return `${modeInstruction}\n要求：\n1) 使用简体中文回答。\n2) 只基于给定持仓数据推理，不要编造不存在的数据。\n3) 避免直接给出买卖指令，但可以给方向性建议。\n4) 当前模式: ${mode === 'quick' ? '快速' : mode === 'deep' ? '深度' : '风险'}分析。\n\n组合摘要：\n${summary}\n\n${modeChecklist}\n\n以下是用户当前持仓快照(JSON)：\n${JSON.stringify(holdings, null, 2)}`;
};

const buildSystemPrompt = (holdings: HoldingsSnapshot, options?: AiPromptOptions) =>
  buildHoldingsAnalysisPrompt(holdings, options);

export const compressAiAnalysisMessages = (
  messages: AiAnalysisMessage[],
  options: AiCompressionOptions,
): AiAnalysisMessage[] => {
  const keepRecentMessages = options.keepRecentMessages ?? 4;
  const totalTokens = messages.reduce((sum, item) => sum + estimateTokens(item.content), 0);
  if (totalTokens <= options.maxTokens || messages.length <= keepRecentMessages + 1) {
    return messages;
  }

  const recentMessages = messages.slice(-keepRecentMessages);
  const oldMessages = messages.slice(0, -keepRecentMessages);
  const summaryText = oldMessages
    .map((item) => `${item.role === 'user' ? '用户' : '助手'}: ${item.content}`)
    .join('\n')
    .slice(0, Math.max(40, options.maxTokens));

  return [
    {
      role: 'assistant',
      content: `[历史对话摘要]\n${summaryText}`,
    },
    ...recentMessages,
  ];
};

export const parseStructuredAnalysisResult = (
  text: string,
): AiStructuredAnalysisResult | null => {
  const matches = [...text.matchAll(/```json\s*([\s\S]*?)```/g)];
  const raw = matches.at(-1)?.[1]?.trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AiStructuredAnalysisResult;
  } catch {
    return null;
  }
};

export const buildAiAnalysisCacheKey = (params: {
  holdings: HoldingsSnapshot;
  question: string;
  analysisMode: AiAnalysisMode;
  provider: AiProvider;
  model: string;
}) => {
  const { holdings, question, analysisMode, provider, model } = params;
  const holdingsFingerprint = holdings.holdings
    .map((item) => `${item.code}:${item.marketValue}:${item.totalGainPct}:${item.dayChangePct}`)
    .join('|');

  return `${AI_ANALYSIS_CACHE_PREFIX}${provider}:${model}:${analysisMode}:${question.trim()}:${holdings.asOf}:${holdingsFingerprint}`;
};

export const getCachedAiAnalysisResult = (cacheKey: string): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(cacheKey);
  } catch {
    return null;
  }
};

export const setCachedAiAnalysisResult = (cacheKey: string, value: string) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(cacheKey, value);
  } catch {
    // ignore storage failures
  }
};

export const analyzeHoldingsChat = async (params: {
  provider: AiProvider;
  apiKey: string;
  model: string;
  baseURL?: string;
  holdings: HoldingsSnapshot;
  messages: AiAnalysisMessage[];
  question: string;
  analysisMode?: AiAnalysisMode;
}): Promise<string> => {
  const { provider, apiKey, model, baseURL, holdings, messages, question, analysisMode } = params;
  if (!apiKey) throw new Error('MISSING_API_KEY');

  const systemPrompt = buildSystemPrompt(holdings, { mode: analysisMode });
  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) throw new Error('EMPTY_QUESTION');
  const preparedMessages = compressAiAnalysisMessages(messages, { maxTokens: 6000 });

  if (provider === 'openai' || provider === 'customOpenAi') {
    const targetBaseUrl = provider === 'openai' ? OPENAI_BASE_URL : baseURL?.trim() || '';
    if (!targetBaseUrl) throw new Error('MISSING_BASE_URL');
    const client = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true,
      baseURL: getLlmProxyBaseUrl(),
      defaultHeaders: {
        'X-LLM-Target-Base-URL': targetBaseUrl,
      },
    });
    const response = await client.chat.completions.create({
      model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...preparedMessages.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: trimmedQuestion },
        ],
      temperature: 0.2,
    });

    return (response.choices?.[0]?.message?.content || '').trim();
  }

  const gemini = new GoogleGenerativeAI(apiKey);
  const geminiModel = gemini.getGenerativeModel({
    model,
    systemInstruction: systemPrompt,
  });

    const contents = [
    ...preparedMessages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    { role: 'user', parts: [{ text: trimmedQuestion }] },
  ];

  const result = await geminiModel.generateContent({ contents });
  return result.response.text().trim();
};

export const analyzeHoldingsChatStream = async (
  params: {
    provider: AiProvider;
    apiKey: string;
    model: string;
    baseURL?: string;
    holdings: HoldingsSnapshot;
    messages: AiAnalysisMessage[];
    question: string;
    analysisMode?: AiAnalysisMode;
    signal?: AbortSignal;
  } & AiAnalysisStreamHandlers,
): Promise<string> => {
  const {
    provider,
    apiKey,
    model,
    baseURL,
    holdings,
    messages,
    question,
    analysisMode,
    signal,
    onDelta,
    onDone,
    onError,
  } = params;
  if (!apiKey) throw new Error('MISSING_API_KEY');

  if (signal?.aborted) {
    const err = new DOMException('Aborted', 'AbortError');
    onError?.(err);
    throw err;
  }

  const systemPrompt = buildSystemPrompt(holdings, { mode: analysisMode });
  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) throw new Error('EMPTY_QUESTION');
  const preparedMessages = compressAiAnalysisMessages(messages, { maxTokens: 6000 });

  let fullText = '';

  try {
    if (provider === 'openai' || provider === 'customOpenAi') {
      const targetBaseUrl = provider === 'openai' ? OPENAI_BASE_URL : baseURL?.trim() || '';
      if (!targetBaseUrl) throw new Error('MISSING_BASE_URL');
      const client = new OpenAI({
        apiKey,
        dangerouslyAllowBrowser: true,
        baseURL: getLlmProxyBaseUrl(),
        defaultHeaders: {
          'X-LLM-Target-Base-URL': targetBaseUrl,
        },
      });
      const stream = await client.chat.completions.create(
        {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...preparedMessages.map((m) => ({ role: m.role, content: m.content })),
            { role: 'user', content: trimmedQuestion },
          ],
          temperature: 0.2,
          stream: true,
        },
        signal ? { signal } : undefined,
      );

      for await (const chunk of stream) {
        if (signal?.aborted) break;
        const delta = chunk.choices?.[0]?.delta?.content || '';
        if (!delta) continue;
        fullText += delta;
        onDelta?.(delta);
      }

      const finalized = fullText.trim();
      onDone?.(finalized);
      return finalized;
    }

    const gemini = new GoogleGenerativeAI(apiKey);
    const geminiModel = gemini.getGenerativeModel({
      model,
      systemInstruction: systemPrompt,
    });

    const contents = [
      ...preparedMessages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      { role: 'user', parts: [{ text: trimmedQuestion }] },
    ];

    const streamResult = await geminiModel.generateContentStream({ contents });
    for await (const chunk of streamResult.stream) {
      if (signal?.aborted) break;
      const delta = chunk.text();
      if (!delta) continue;
      fullText += delta;
      onDelta?.(delta);
    }

    const finalized = fullText.trim();
    onDone?.(finalized);
    return finalized;
  } catch (err) {
    onError?.(err);
    throw err;
  }
};
