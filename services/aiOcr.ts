import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

export type AiProvider = 'openai' | 'gemini';

export interface OcrHoldingItem {
  name: string;
  amount?: number;
  dayChangePct?: number;
  dayGain?: number;
  nav?: number;
  shares?: number;
  codeHint?: string;
}

export interface OcrResult {
  source: string;
  asOfDate?: string;
  currency?: string;
  items: OcrHoldingItem[];
  warnings?: string[];
}

const SYSTEM_PROMPT = `你是一个金融基金持仓截图识别器。请从图片中提取“基金名称、持仓金额、持仓涨跌幅、昨日收益”等字段，并返回严格的 JSON。\n\n要求：\n1) 只输出 JSON，不要 markdown，不要解释文字。\n2) JSON 结构如下：\n{\n  "source": "...",\n  "asOfDate": "YYYY-MM-DD | null",\n  "currency": "CNY | ... | null",\n  "items": [\n    {\n      "name": "基金名称",\n      "amount": number|null,\n      "dayChangePct": number|null,\n      "dayGain": number|null,\n      "nav": number|null,\n      "shares": number|null,\n      "codeHint": "可能的代码或缩写|null"\n    }\n  ],\n  "warnings": ["..."]\n}\n3) 金额单位以截图为准，百分比输出为数值（例如 -1.23 表示 -1.23%）。\n4) 若字段缺失请填 null，不要猜测。\n5) 如果识别不到任何基金，items 为空数组。\n6) source 写明截图来源应用名称（如支付宝/天天基金/蚂蚁财富/未知）。`;

const normalizeNumber = (val: any) => {
  if (val === null || val === undefined || val === '') return undefined;
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
  if (Number.isNaN(num)) return undefined;
  return num;
};

export const parseOcrResult = (raw: string): OcrResult | null => {
  try {
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.items)) return null;
    return {
      source: String(data.source || ''),
      asOfDate: data.asOfDate || undefined,
      currency: data.currency || undefined,
      items: data.items.map((item: any) => ({
        name: String(item.name || '').trim(),
        amount: normalizeNumber(item.amount),
        dayChangePct: normalizeNumber(item.dayChangePct),
        dayGain: normalizeNumber(item.dayGain),
        nav: normalizeNumber(item.nav),
        shares: normalizeNumber(item.shares),
        codeHint: item.codeHint ? String(item.codeHint) : undefined,
      })).filter((item: OcrHoldingItem) => item.name),
      warnings: Array.isArray(data.warnings) ? data.warnings.map((w: any) => String(w)) : undefined,
    };
  } catch {
    return null;
  }
};

const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = (e) => reject(e);
  reader.readAsDataURL(file);
});

export const listOpenAiModels = async (apiKey: string): Promise<string[]> => {
  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  const response = await client.models.list();
  const models = response.data
    .map(m => m.id)
    .filter(id => id.includes('gpt'))
    .sort();
  return models;
};

export const listGeminiModels = async (apiKey: string): Promise<string[]> => {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  if (!res.ok) throw new Error('GEMINI_MODELS_FAILED');
  const json = await res.json();
  const models = (json.models || [])
    .filter((m: any) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m: any) => String(m.name || ''))
    .filter(Boolean)
    .map((name: string) => name.replace(/^models\//, ''))
    .sort();
  return models;
};

export const recognizeHoldingsFromImage = async (params: {
  provider: AiProvider;
  apiKey: string;
  model: string;
  file: File;
}): Promise<OcrResult> => {
  const { provider, apiKey, model, file } = params;
  if (!apiKey) throw new Error('MISSING_API_KEY');

  const dataUrl = await fileToBase64(file);

  if (provider === 'openai') {
    const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: '请识别并按 JSON 结构输出。' },
            { type: 'image_url', image_url: { url: dataUrl } }
          ]
        }
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    });

    const content = response.choices?.[0]?.message?.content || '';
    const parsed = parseOcrResult(content);
    if (!parsed) throw new Error('INVALID_JSON');
    return parsed;
  }

  const gemini = new GoogleGenerativeAI(apiKey);
  const geminiModel = gemini.getGenerativeModel({
    model,
    systemInstruction: SYSTEM_PROMPT,
  });
  const base64 = dataUrl.split(',')[1] || '';
  const result = await geminiModel.generateContent([
    { text: '请识别并按 JSON 结构输出。' },
    { inlineData: { data: base64, mimeType: file.type || 'image/png' } },
  ]);
  const text = result.response.text();
  const parsed = parseOcrResult(text);
  if (!parsed) throw new Error('INVALID_JSON');
  return parsed;
};
