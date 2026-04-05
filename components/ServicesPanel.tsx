import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Icons } from './Icon';
import { useTranslation } from '../services/i18n';
import { useSettings } from '../services/SettingsContext';
import {
  getInitialServiceApiStatuses,
  streamServiceApiStatuses,
  type ServiceApiStatus,
  type ServiceHealthStatus,
} from '../services/serviceStatus';

const statusDotMap: Record<ServiceHealthStatus, string> = {
  idle: 'bg-gray-400 dark:bg-gray-500',
  checking: 'bg-gray-400 dark:bg-gray-500',
  ok: 'bg-emerald-500 dark:bg-emerald-400',
  degraded: 'bg-rose-500 dark:bg-rose-400',
  error: 'bg-rose-500 dark:bg-rose-400',
};

const shouldBreath = (status: ServiceHealthStatus) =>
  status === 'ok' || status === 'error' || status === 'degraded';

const getStatusTextZh = (status: ServiceHealthStatus) => {
  switch (status) {
    case 'ok':
      return '连接正常';
    case 'error':
      return '连接失败';
    case 'degraded':
      return '服务异常';
    case 'checking':
      return '检测中';
    default:
      return '未配置';
  }
};

const formatCheckedAt = (value: string) => {
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return '--';
  return `${time.toLocaleDateString()} ${time.toLocaleTimeString()}`;
};

export const ServicesPanel: React.FC = () => {
  const { t } = useTranslation();
  const {
    openaiApiKey,
    geminiApiKey,
    customOpenAiApiKey,
    customOpenAiBaseUrl,
    customOpenAiModelsEndpoint,
    githubToken,
  } = useSettings();
  const [statusList, setStatusList] = useState<ServiceApiStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const runtimeConfig = useMemo(
    () => ({
      openaiApiKey,
      geminiApiKey,
      customOpenAiApiKey,
      customOpenAiBaseUrl,
      customOpenAiModelsEndpoint,
      githubToken,
    }),
    [
      openaiApiKey,
      geminiApiKey,
      customOpenAiApiKey,
      customOpenAiBaseUrl,
      customOpenAiModelsEndpoint,
      githubToken,
    ],
  );

  const refreshStatuses = useCallback(async () => {
    const initial = getInitialServiceApiStatuses(runtimeConfig);
    setStatusList(initial);
    setIsLoading(false);
    setIsRefreshing(true);
    try {
      const next = await streamServiceApiStatuses(runtimeConfig, (item) => {
        setStatusList((prev) => prev.map((status) => (status.id === item.id ? item : status)));
      });
      setStatusList(next);
    } finally {
      setIsRefreshing(false);
    }
  }, [runtimeConfig]);

  useEffect(() => {
    void refreshStatuses();
  }, [refreshStatuses]);

  return (
    <div className="min-h-[60vh] pt-20 pb-44 md:pt-24 md:pb-28">
      <div className="px-4 py-4 md:px-5 md:py-5">
        <div className="rounded-[1.9rem] border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] p-4 shadow-[var(--app-shell-shadow)] backdrop-blur-xl md:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[var(--app-shell-ink)]">
                {t('common.services') || '服务'} API
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                void refreshStatuses();
              }}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-shell-ink)] transition hover:border-[var(--app-shell-line-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Icons.Refresh size={14} />
              {isRefreshing ? '刷新中' : '刷新状态'}
            </button>
          </div>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--app-shell-muted)]">
            展示当前应用中正在使用的全部 API 服务状态，包括行情、基金、AI 与同步相关接口。
          </p>
        </div>
      </div>

      <div className="space-y-4 px-4 md:px-5">
        {isLoading ? (
          <div className="rounded-[1.75rem] border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] p-5 text-sm text-[var(--app-shell-muted)] shadow-[var(--app-shell-shadow)]">
            正在检测 API 状态...
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {statusList.map((item) => (
              <section
                key={item.id}
                className="rounded-[1.75rem] border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] p-4 shadow-[var(--app-shell-shadow)] backdrop-blur-xl md:p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--app-shell-ink)]">
                      {item.name}
                    </h3>
                  </div>
                  <span
                    className="inline-flex items-center gap-2"
                    aria-label={`status-${item.status}`}
                  >
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${statusDotMap[item.status]} ${shouldBreath(item.status) ? 'animate-pulse' : ''}`}
                    />
                    <span className="whitespace-nowrap text-xs text-[var(--app-shell-muted)]">
                      {getStatusTextZh(item.status)}
                    </span>
                  </span>
                </div>

                <div className="mt-4 space-y-2 text-sm text-[var(--app-shell-muted)]">
                  <div>
                    <span className="font-semibold text-[var(--app-shell-ink)]">Endpoint：</span>
                    <span className="break-all">{item.endpoint}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-[var(--app-shell-ink)]">Auth：</span>
                    <span>{item.auth}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-[var(--app-shell-ink)]">Checked：</span>
                    <span>{formatCheckedAt(item.checkedAt)}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-[var(--app-shell-ink)]">Message：</span>
                    <span>{item.message || '--'}</span>
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
