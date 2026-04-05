/// <reference types="vitest/globals" />
import React from 'react';
import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import { ServicesPanel } from '../ServicesPanel';
import { LanguageProvider } from '../../services/i18n';
import type { ServiceApiStatus } from '../../services/serviceStatus';

vi.mock('../../services/SettingsContext', () => ({
  useSettings: () => ({
    openaiApiKey: '',
    geminiApiKey: '',
    customOpenAiApiKey: '',
    customOpenAiBaseUrl: '',
    customOpenAiModelsEndpoint: '',
    githubToken: '',
  }),
}));

const { streamServiceApiStatusesMock } = vi.hoisted(() => ({
  streamServiceApiStatusesMock: vi.fn(),
}));

vi.mock('../../services/serviceStatus', () => ({
  getInitialServiceApiStatuses: vi.fn(() => [
    {
      id: 'morningstar',
      name: 'Morningstar Fund API',
      provider: 'Morningstar',
      endpoint: 'https://www.morningstar.cn/cn-api/public/v1/fund-cache/{query}',
      auth: 'none',
      status: 'checking',
      message: '检测中',
      checkedAt: '2026-01-01T10:00:00.000Z',
    },
    {
      id: 'openai',
      name: 'OpenAI Models API',
      provider: 'OpenAI',
      endpoint: 'https://api.openai.com/v1/models',
      auth: 'apiKey',
      status: 'checking',
      message: '检测中',
      checkedAt: '2026-01-01T10:00:00.000Z',
    },
  ]),
  streamServiceApiStatuses: streamServiceApiStatusesMock,
}));

describe('ServicesPanel', () => {
  it('renders checking cards immediately and updates per api result', async () => {
    let onUpdate: ((item: ServiceApiStatus) => void) | null = null;

    streamServiceApiStatusesMock.mockImplementation(
      async (_config: unknown, callback?: (item: ServiceApiStatus) => void) => {
        onUpdate = callback ?? null;
        return await new Promise<ServiceApiStatus[]>((_resolve) => {});
      },
    );

    render(
      <LanguageProvider>
        <ServicesPanel />
      </LanguageProvider>,
    );

    expect(await screen.findByText('Morningstar Fund API')).toBeInTheDocument();
    expect(screen.getByText('OpenAI Models API')).toBeInTheDocument();
    expect(screen.getAllByText('检测中').length).toBeGreaterThanOrEqual(2);

    await act(async () => {
      onUpdate?.({
        id: 'openai',
        name: 'OpenAI Models API',
        provider: 'OpenAI',
        endpoint: 'https://api.openai.com/v1/models',
        auth: 'apiKey',
        status: 'idle',
        message: '未配置 API Key',
        checkedAt: '2026-01-01T10:00:00.000Z',
      });
    });

    expect(screen.getByText('未配置 API Key')).toBeInTheDocument();
  });
});
