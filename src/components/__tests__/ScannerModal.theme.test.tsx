/// <reference types="vitest/globals" />
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScannerModal } from '../ScannerModal';

const mocked = vi.hoisted(() => ({
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
    investmentProfile: {},
    setInvestmentProfile: vi.fn(),
    updateInvestmentProfile: vi.fn(),
  },
}));

vi.mock('../Icon', () => ({
  Icons: {
    Plus: () => <span>plus</span>,
    Scan: () => <span>scan</span>,
  },
}));

vi.mock('../../services/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../services/SettingsContext', () => ({
  useSettings: () => mocked.settings,
}));

vi.mock('../../services/aiProviderConfig', () => ({
  resolveAiRuntimeConfigByBusiness: () => ({
    provider: 'openai',
    apiKey: 'openai-key',
    model: 'gpt-4o-mini',
  }),
}));

vi.mock('../../services/aiOcr', () => ({
  recognizeHoldingsFromImage: vi.fn(),
}));

vi.mock('../../services/api', () => ({
  searchFunds: vi.fn(),
  fetchFundCommonData: vi.fn(),
}));

vi.mock('../../services/db', () => ({
  db: {
    funds: { toArray: vi.fn(() => new Promise<never>(() => {})) },
    accounts: { toArray: vi.fn(() => new Promise<never>(() => {})) },
  },
}));

vi.mock('../../services/useEdgeSwipe', () => ({
  resetDragState: vi.fn(),
  useEdgeSwipe: () => ({
    isDragging: false,
    activeOverlayId: null,
    setDragState: vi.fn(),
    snapBackX: null,
  }),
}));

vi.mock('../../services/overlayRegistration', () => ({
  useOverlayRegistration: vi.fn(),
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({
      initial: _i,
      animate: _a,
      exit: _e,
      transition: _t,
      ...rest
    }: Record<string, unknown>) => <div {...rest} />,
  },
}));

describe('ScannerModal theme', () => {
  it('智能录入标题和上传区域应使用当前主题背景', () => {
    render(<ScannerModal isOpen onClose={vi.fn()} />);

    const header = screen.getByText('common.smartEntry').closest('.border-b');
    expect(header?.className).toContain('bg-[var(--app-shell-panel)]');
    expect(header?.className).not.toContain('bg-gray-50');

    const uploadPanel = screen.getByText('common.uploadTip').closest('.rounded-lg');
    expect(uploadPanel?.className).toContain('bg-[var(--app-shell-panel-strong)]');
    expect(uploadPanel?.className).not.toContain('bg-gray-50');
    expect(uploadPanel?.className).not.toContain('dark:bg-white/5');
  });
});
