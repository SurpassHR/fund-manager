import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LLM_BUSINESS_CONFIG,
  LLM_BUSINESS_KEYS,
  migrateBusinessModelConfig,
  sanitizeBusinessModelConfig,
} from '../businessModelConfig';

describe('businessModelConfig', () => {
  it('提供固定业务键与默认配置', () => {
    expect(LLM_BUSINESS_KEYS).toEqual(['aiHoldingsAnalysis', 'syncHoldings']);
    expect(DEFAULT_LLM_BUSINESS_CONFIG.aiHoldingsAnalysis.providerId).toBe('');
    expect(DEFAULT_LLM_BUSINESS_CONFIG.syncHoldings.providerId).toBe('');
  });

  it('可从旧版 aiProvider 字段迁移', () => {
    const migrated = migrateBusinessModelConfig(
      { aiProvider: 'gemini', geminiModel: 'gemini-2.5-flash' },
      DEFAULT_LLM_BUSINESS_CONFIG,
    );

    expect(migrated.aiHoldingsAnalysis.providerKind).toBe('gemini');
    expect(migrated.aiHoldingsAnalysis.model).toBe('gemini-2.5-flash');
    expect(migrated.syncHoldings.providerKind).toBe('gemini');
    expect(migrated.syncHoldings.model).toBe('gemini-2.5-flash');
  });

  it('清洗非法值并回退默认', () => {
    const sanitized = sanitizeBusinessModelConfig(
      {
        aiHoldingsAnalysis: { providerId: 1, providerKind: 'wrong', model: null },
        syncHoldings: { providerId: 'ok', providerKind: 'openai', model: 9 },
      } as unknown,
      DEFAULT_LLM_BUSINESS_CONFIG,
    );

    expect(sanitized.aiHoldingsAnalysis).toEqual(DEFAULT_LLM_BUSINESS_CONFIG.aiHoldingsAnalysis);
    expect(sanitized.syncHoldings.providerId).toBe('ok');
    expect(sanitized.syncHoldings.providerKind).toBe('openai');
    expect(sanitized.syncHoldings.model).toBe('');
  });
});
