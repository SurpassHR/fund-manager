import { describe, expect, it } from 'vitest';
import { parseOcrResult } from '../aiOcr';

const JSON_PAYLOAD = JSON.stringify({
  source: 'Alipay',
  asOfDate: null,
  currency: 'CNY',
  items: [
    {
      name: '示例基金',
      amount: 123.45,
      dayGain: 1.2,
      holdingGain: -3.4,
      holdingGainPct: -2.7,
      codeHint: null,
    },
  ],
  warnings: ['ok'],
});

describe('parseOcrResult', () => {
  it('支持解析 markdown 代码块中的 JSON', () => {
    const wrapped = `模型输出如下：\n\n\
\`\`\`json\n${JSON_PAYLOAD}\n\`\`\``;
    const parsed = parseOcrResult(wrapped);

    expect(parsed?.source).toBe('Alipay');
    expect(parsed?.items[0]?.name).toBe('示例基金');
  });

  it('支持解析前后有说明文字的 JSON', () => {
    const wrapped = `请参考：${JSON_PAYLOAD}\n以上为识别结果`;
    const parsed = parseOcrResult(wrapped);

    expect(parsed?.currency).toBe('CNY');
    expect(parsed?.items).toHaveLength(1);
  });
});
