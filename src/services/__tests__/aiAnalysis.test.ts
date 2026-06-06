import { describe, expect, it } from 'vitest';
import {
  buildHoldingsAnalysisPrompt,
  buildEquityOverlap,
  buildHoldingsDataCoverage,
  compressAiAnalysisMessages,
  buildAiAnalysisCacheKey,
  getCachedAiAnalysisResult,
  parseStructuredAnalysisResult,
  setCachedAiAnalysisResult,
  type AiAnalysisMessage,
  type HoldingsSnapshot,
} from '../aiAnalysis';

const snapshot: HoldingsSnapshot = {
  asOf: '2026-04-18',
  currency: 'CNY',
  totalAssets: 100000,
  totalDayGain: 200,
  totalDayGainPct: 0.2,
  holdingGain: 5000,
  holdingGainPct: 5,
  holdings: [
    {
      code: '000001',
      name: '中欧医疗健康',
      platform: '支付宝',
      holdingShares: 1000,
      costPrice: 1,
      currentNav: 1.2,
      marketValue: 1200,
      totalCost: 1000,
      totalGain: 200,
      totalGainPct: 20,
        dayChangePct: 1.2,
        dayChangeVal: 12,
        lastUpdate: '2026-04-18',
        topEquityHoldings: [
          { ticker: '600519', name: '贵州茅台', weight: 8, sector: '消费' },
          { ticker: '300750', name: '宁德时代', weight: 5, sector: '新能源' },
        ],
        holdingsDataStatus: 'available',
      },
    {
      code: '110011',
      name: '易方达中小盘',
      platform: '天天基金',
      holdingShares: 800,
      costPrice: 2,
      currentNav: 1.8,
      marketValue: 1440,
      totalCost: 1600,
      totalGain: -160,
      totalGainPct: -10,
        dayChangePct: -0.8,
        dayChangeVal: -8,
        lastUpdate: '2026-04-18',
        topEquityHoldings: [{ ticker: '600519', name: '贵州茅台', weight: 3, sector: '消费' }],
        holdingsDataStatus: 'available',
      },
  ],
};

snapshot.equityOverlap = buildEquityOverlap(snapshot.holdings);
snapshot.investmentProfile = {
  riskTolerance: '稳健',
  investmentHorizon: '3-5年',
  externalAssets: '现金 5 万',
};
snapshot.dataCoverage = buildHoldingsDataCoverage(snapshot.holdings, snapshot.investmentProfile);

describe('buildHoldingsAnalysisPrompt', () => {
  it('根据不同分析模式生成差异化提示词', () => {
    const quick = buildHoldingsAnalysisPrompt(snapshot, { mode: 'quick' });
    const risk = buildHoldingsAnalysisPrompt(snapshot, { mode: 'risk' });

    expect(quick).toContain('快速');
    expect(risk).toContain('风险');
    expect(quick).not.toEqual(risk);
    expect(quick).toContain('总资产');
    expect(quick).toContain('不要编造不存在的数据');
    expect(quick).toContain('当前数据缺失/不完整');
    expect(quick).toContain('equityOverlap');
    expect(quick).toContain('贵州茅台');
  });

  it('计算底层股票重合度和数据覆盖情况', () => {
    const overlap = buildEquityOverlap(snapshot.holdings);
    const coverage = buildHoldingsDataCoverage(snapshot.holdings);

    expect(overlap).toEqual([
      {
        ticker: '600519',
        name: '贵州茅台',
        fundCount: 2,
        funds: ['中欧医疗健康', '易方达中小盘'],
        maxWeight: 8,
        totalWeight: 11,
      },
    ]);
    expect(coverage.topEquityHoldings).toBe('available');
    expect(coverage.industryDistribution).toBe('available');
    expect(coverage.managerChanges).toBe('missing');
    expect(coverage.riskProfile).toBe('missing');
  });

  it('投资画像存在时标记风险承受能力和投资期限为 available', () => {
    const coverage = buildHoldingsDataCoverage(snapshot.holdings, snapshot.investmentProfile);

    expect(coverage.externalAssets).toBe('available');
    expect(coverage.riskProfile).toBe('available');
    expect(coverage.investmentHorizon).toBe('available');
  });
});

describe('compressAiAnalysisMessages', () => {
  it('超出阈值时压缩旧消息并保留最近消息', () => {
    const messages: AiAnalysisMessage[] = Array.from({ length: 6 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `第 ${index + 1} 条消息，${'内容'.repeat(20)}`,
    }));

    const compressed = compressAiAnalysisMessages(messages, {
      maxTokens: 80,
      keepRecentMessages: 2,
    });

    expect(compressed.length).toBeLessThan(messages.length);
    expect(compressed[0]?.role).toBe('assistant');
    expect(compressed[0]?.content).toContain('历史对话摘要');
    expect(compressed.at(-1)?.content).toContain('第 6 条消息');
  });
});

describe('parseStructuredAnalysisResult', () => {
  it('从 markdown + json 代码块中提取结构化分析结果', () => {
    const text = `## 结论\n\n组合需要继续分散。\n\n\










\
\
\


\
\




\



\
\


\

\`\`\`json
{
  "summary": "组合集中度偏高",
  "bullets": ["医疗占比较高"],
  "risks": ["单行业暴露"],
  "opportunities": ["增加宽基"],
  "actions": ["降低单主题仓位"],
  "metrics": [{ "key": "concentration", "label": "集中度", "value": 0.62 }],
  "visualizations": [{ "type": "pie", "title": "资产配置", "series": [{ "name": "权益", "value": 80 }] }]
}
\`\`\``;

    const parsed = parseStructuredAnalysisResult(text);

    expect(parsed?.summary).toBe('组合集中度偏高');
    expect(parsed?.risks).toContain('单行业暴露');
    expect(parsed?.visualizations?.[0]?.type).toBe('pie');
  });
});

describe('ai analysis cache', () => {
  it('为相同持仓与问题生成稳定缓存 key，并可读写缓存结果', () => {
    const key = buildAiAnalysisCacheKey({
      holdings: snapshot,
      question: '帮我分析风险',
      analysisMode: 'risk',
      provider: 'openai',
      model: 'gpt-4o-mini',
    });

    expect(key).toContain('ai_analysis_cache:');

    setCachedAiAnalysisResult(key, '缓存结果');
    expect(getCachedAiAnalysisResult(key)).toBe('缓存结果');
  });
});
