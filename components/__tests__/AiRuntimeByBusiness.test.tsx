/// <reference types="vitest/globals" />
import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AiHoldingsAnalysisModal } from '../AiHoldingsAnalysisModal';
import { ScannerModal } from '../ScannerModal';

const mocked = vi.hoisted(() => ({
  t: (k: string) => k,
  settings: {
    aiProvider: 'openai' as const,
    setAiProvider: vi.fn(),
    autoRefresh: false,
    setAutoRefresh: vi.fn(),
    useUnifiedRefresh: false,
    setUseUnifiedRefresh: vi.fn(),
    openaiApiKey: 'openai-key',
    setOpenaiApiKey: vi.fn(),
    openaiModel: 'gpt-4o-mini',
    setOpenaiModel: vi.fn(),
    customOpenAiApiKey: '',
    setCustomOpenAiApiKey: vi.fn(),
    customOpenAiBaseUrl: '',
    setCustomOpenAiBaseUrl: vi.fn(),
    customOpenAiModelsEndpoint: '',
    setCustomOpenAiModelsEndpoint: vi.fn(),
    customOpenAiModel: '',
    setCustomOpenAiModel: vi.fn(),
    geminiApiKey: '',
    setGeminiApiKey: vi.fn(),
    geminiModel: 'gemini-2.5-flash',
    setGeminiModel: vi.fn(),
    githubToken: '',
    setGithubToken: vi.fn(),
    defaultGistTarget: null,
    setDefaultGistTarget: vi.fn(),
    llmProviders: [],
    setLlmProviders: vi.fn(),
    addLlmProvider: vi.fn(),
    updateLlmProvider: vi.fn(),
    removeLlmProvider: vi.fn(),
    businessModelConfig: {
      aiHoldingsAnalysis: { providerId: '', providerKind: 'openai', model: '' },
      syncHoldings: { providerId: '', providerKind: 'openai', model: '' },
    },
    setBusinessModelConfig: vi.fn(),
    updateBusinessModelConfig: vi.fn(),
  },
  resolveByBusiness: vi.fn((..._args: unknown[]) => ({
    provider: 'openai' as const,
    apiKey: 'openai-key',
    model: 'gpt-4o-mini',
  })),
}));

vi.mock('../../services/i18n', () => ({
  useTranslation: () => ({ t: mocked.t }),
}));

vi.mock('../../services/SettingsContext', () => ({
  useSettings: () => mocked.settings,
}));

vi.mock('../../services/aiProviderConfig', () => ({
  resolveAiRuntimeConfigByBusiness: (settings: unknown, key: unknown) =>
    mocked.resolveByBusiness(settings, key),
}));

vi.mock('../../services/aiAnalysis', () => ({
  analyzeHoldingsChatStream: vi.fn(async () => 'ok'),
}));

vi.mock('../../services/aiOcr', () => ({
  recognizeHoldingsFromImage: vi.fn(async () => ({ items: [] })),
}));

vi.mock('../../services/db', () => ({
  db: {
    funds: { toArray: vi.fn(async () => []) },
    accounts: { toArray: vi.fn(async () => []) },
  },
}));

vi.mock('../../services/api', () => ({
  searchFunds: vi.fn(async () => ({ data: [] })),
  fetchFundCommonData: vi.fn(async () => ({ data: { nav: 1, navDate: '2026-01-01', navChangePercent: 0 } })),
}));

vi.mock('../../services/useEdgeSwipe', () => ({
  useEdgeSwipe: () => ({
    isDragging: false,
    activeOverlayId: null,
    setDragState: vi.fn(),
    snapBackX: null,
  }),
  resetDragState: vi.fn(),
}));

vi.mock('../../services/overlayRegistration', () => ({
  useOverlayRegistration: vi.fn(),
}));

describe('runtime by business key', () => {
  it('ai 持仓分析按业务键读取 runtime', () => {
    render(
      <AiHoldingsAnalysisModal
        isOpen
        onClose={vi.fn()}
        holdingsSnapshot={{
          asOf: '2026-01-01',
          currency: 'CNY',
          totalAssets: 0,
          totalDayGain: 0,
          totalDayGainPct: 0,
          holdingGain: 0,
          holdingGainPct: 0,
          holdings: [],
        }}
      />,
    );

    expect(mocked.resolveByBusiness).toHaveBeenCalledWith(mocked.settings, 'aiHoldingsAnalysis');
  });

  it('同步持仓按业务键读取 runtime', () => {
    render(<ScannerModal isOpen onClose={vi.fn()} />);
    expect(mocked.resolveByBusiness).toHaveBeenCalledWith(mocked.settings, 'syncHoldings');
  });
});
