/// <reference types="vitest/globals" />
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { ServicesPanel } from '../ServicesPanel';
import { LanguageProvider } from '../../services/i18n';

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

vi.mock('../../services/serviceStatus', () => ({
  getServiceApiStatuses: vi.fn(async () => [
    {
      id: 'morningstar',
      name: 'Morningstar Fund API',
      provider: 'Morningstar',
      endpoint: 'https://www.morningstar.cn/cn-api/public/v1/fund-cache/{query}',
      auth: 'none',
      status: 'ok',
      message: '连接正常',
      checkedAt: '2026-01-01T10:00:00.000Z',
    },
    {
      id: 'openai',
      name: 'OpenAI Models API',
      provider: 'OpenAI',
      endpoint: 'https://api.openai.com/v1/models',
      auth: 'apiKey',
      status: 'idle',
      message: '未配置 API Key',
      checkedAt: '2026-01-01T10:00:00.000Z',
    },
  ]),
}));

describe('ServicesPanel', () => {
  it('renders all active API status cards', async () => {
    render(
      <LanguageProvider>
        <ServicesPanel />
      </LanguageProvider>,
    );

    expect(await screen.findByText('Morningstar Fund API')).toBeInTheDocument();
    expect(screen.getByText('OpenAI Models API')).toBeInTheDocument();
    expect(screen.getByText(/https:\/\/api.openai.com\/v1\/models/i)).toBeInTheDocument();
    expect(screen.getByText('未配置 API Key')).toBeInTheDocument();
  });
});
