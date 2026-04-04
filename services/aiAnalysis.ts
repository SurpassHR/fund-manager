import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getLlmProxyBaseUrl } from './llmProxy';

export type AiProvider = 'openai' | 'gemini' | 'customOpenAi';

export interface AiAnalysisMessage {
  role: 'user' | 'assistant';
  content: string;
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

const buildSystemPrompt = (holdings: HoldingsSnapshot) =>
  `你是一个基金持仓分析助手，请基于用户的当前持仓数据进行分析与答疑。要求：\n1) 使用简体中文回答。\n2) 先给出简明的要点结论，再根据问题补充细节。\n3) 只基于给定持仓数据推理，不要编造不存在的数据。\n4) 可以给出风险提示与改进方向，但避免提供具体买卖指令。\n\n以下是用户当前持仓快照(JSON)：\n${JSON.stringify(holdings, null, 2)}`;

export const analyzeHoldingsChat = async (params: {
  provider: AiProvider;
  apiKey: string;
  model: string;
  baseURL?: string;
  holdings: HoldingsSnapshot;
  messages: AiAnalysisMessage[];
  question: string;
}): Promise<string> => {
  const { provider, apiKey, model, baseURL, holdings, messages, question } = params;
  if (!apiKey) throw new Error('MISSING_API_KEY');

  const systemPrompt = buildSystemPrompt(holdings);
  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) throw new Error('EMPTY_QUESTION');

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
        ...messages.map((m) => ({ role: m.role, content: m.content })),
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
    ...messages.map((m) => ({
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

  const systemPrompt = buildSystemPrompt(holdings);
  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) throw new Error('EMPTY_QUESTION');

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
            ...messages.map((m) => ({ role: m.role, content: m.content })),
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
      ...messages.map((m) => ({
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
