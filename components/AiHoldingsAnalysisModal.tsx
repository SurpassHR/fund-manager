import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icons } from './Icon';
import { useTranslation } from '../services/i18n';
import { useSettings } from '../services/SettingsContext';
import { analyzeHoldingsChatStream } from '../services/aiAnalysis';
import type { AiAnalysisMessage, AiAnalysisMode, HoldingsSnapshot } from '../services/aiAnalysis';
import { buildAiAnalysisCacheKey, getCachedAiAnalysisResult, setCachedAiAnalysisResult } from '../services/aiAnalysis';
import {
  notifyAiReminder,
  readAiReminderSettings,
  shouldTriggerAiReminder,
  writeAiReminderSettings,
  type AiReminderFrequency,
} from '../services/aiReminder';
import {
  resolveAiRuntimeConfigByBusiness,
} from '../services/aiProviderConfig';
import {
  formatCurrency,
  formatPct,
  formatSignedCurrency,
  getSignColor,
} from '../services/financeUtils';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import * as echarts from 'echarts';

interface AiHoldingsAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  holdingsSnapshot: HoldingsSnapshot | null;
}

marked.setOptions({
  gfm: true,
  breaks: true,
});

const getLocalDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const renderMarkdown = (content: string) => ({
  __html: DOMPurify.sanitize(marked.parse(content || '', { async: false })),
});

const isAbortError = (err: unknown) => {
  if (err instanceof DOMException && err.name === 'AbortError') return true;
  if (typeof err === 'object' && err !== null && 'name' in err) {
    const name = (err as { name?: string }).name;
    return name === 'AbortError';
  }
  return false;
};

export const AiHoldingsAnalysisModal: React.FC<AiHoldingsAnalysisModalProps> = ({
  isOpen,
  onClose,
  holdingsSnapshot,
}) => {
  const [question, setQuestion] = useState('');
  const [error, setError] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [analysisMode, setAnalysisMode] = useState<AiAnalysisMode>('quick');
  const [sessionKeyword, setSessionKeyword] = useState('');
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderFrequency, setReminderFrequency] = useState<AiReminderFrequency>('weekly');
  const abortControllerRef = useRef<AbortController | null>(null);
  const allocationChartRef = useRef<HTMLDivElement | null>(null);
  const performanceChartRef = useRef<HTMLDivElement | null>(null);

  type AiChatSession = {
    id: string;
    title: string;
    messages: AiAnalysisMessage[];
    createdAt: string;
    updatedAt: string;
    mode?: AiAnalysisMode;
  };

  const STORAGE_KEY = 'ai_holdings_sessions';
  const ACTIVE_KEY = 'ai_holdings_active_session';

  const [sessions, setSessions] = useState<AiChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState('');

  const { t } = useTranslation();
  const settings = useSettings();
  const { provider, apiKey, model, baseURL } = resolveAiRuntimeConfigByBusiness(
    settings,
    'aiHoldingsAnalysis',
  );

  const handleClose = useCallback(() => {
    abortControllerRef.current?.abort();
    setQuestion('');
    setError('');
    setStreamingContent('');
    setIsStreaming(false);
    onClose();
  }, [onClose]);

  const handleApiKeyIssue = () => {
    const shouldOpen = confirm(t('common.aiKeyMissing') || '请先在设置里填写接口密钥');
    if (shouldOpen) {
      handleClose();
      window.dispatchEvent(new CustomEvent('open-ai-settings'));
    }
  };

  const buildSessionTitle = useCallback(
    (index: number) => `${t('common.aiHoldingAnalysisSession') || '会话'} ${index}`,
    [t],
  );

  const createSession = useCallback(
    (index: number, title?: string): AiChatSession => {
      const now = new Date().toISOString();
      return {
        id: `session_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
        title: title || buildSessionTitle(index),
        messages: [],
        createdAt: now,
        updatedAt: now,
        mode: analysisMode,
      };
    },
    [analysisMode, buildSessionTitle],
  );

  useEffect(() => {
    if (!isOpen) return;
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const storedActiveId = window.localStorage.getItem(ACTIVE_KEY);

    if (raw) {
      try {
        const parsed = JSON.parse(raw) as AiChatSession[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessions(parsed);
          const nextActive = parsed.find((s) => s.id === storedActiveId)?.id || parsed[0].id;
          setActiveSessionId(nextActive);
          return;
        }
      } catch {
        // ignore invalid storage
      }
    }

    const firstSession = createSession(1);
    setSessions([firstSession]);
    setActiveSessionId(firstSession.id);
  }, [createSession, isOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessions.length === 0) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    if (activeSessionId) {
      window.localStorage.setItem(ACTIVE_KEY, activeSessionId);
    }
  }, [sessions, activeSessionId]);

  useEffect(() => {
    if (!isOpen) return;
    const settings = readAiReminderSettings();
    setReminderEnabled(settings.enabled);
    setReminderFrequency(settings.frequency);

    const now = new Date().toISOString();
    if (
      shouldTriggerAiReminder({
        enabled: settings.enabled,
        frequency: settings.frequency,
        lastReminderAt: settings.lastReminderAt,
        now,
      })
    ) {
      notifyAiReminder('AI 持仓分析提醒', '该做一次新的持仓分析了');
      writeAiReminderSettings({ ...settings, lastReminderAt: now });
    }
  }, [isOpen]);

  useEffect(() => {
    writeAiReminderSettings({ enabled: reminderEnabled, frequency: reminderFrequency });
  }, [reminderEnabled, reminderFrequency]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) || sessions[0],
    [sessions, activeSessionId],
  );

  const activeMessages = activeSession?.messages || [];
  const filteredSessions = useMemo(() => {
    const keyword = sessionKeyword.trim().toLowerCase();
    if (!keyword) return sessions;
    return sessions.filter((session) => session.title.toLowerCase().includes(keyword));
  }, [sessionKeyword, sessions]);

  const updateSessionMessages = (
    sessionId: string,
    updater: (messages: AiAnalysisMessage[]) => AiAnalysisMessage[],
  ) => {
    if (!sessionId) return;
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id !== sessionId) return session;
        const nextMessages = updater(session.messages);
        return {
          ...session,
          messages: nextMessages,
          updatedAt: new Date().toISOString(),
        };
      }),
    );
  };

  const ensureSessionId = (initialTitle?: string) => {
    if (activeSessionId && sessions.find((s) => s.id === activeSessionId)) {
      return activeSessionId;
    }
    const next = createSession(sessions.length + 1, initialTitle);
    setSessions((prev) => [...prev, next]);
    setActiveSessionId(next.id);
    return next.id;
  };

  const resetActiveSession = () => {
    setError('');
    setQuestion('');
    setStreamingContent('');
    setIsStreaming(false);
    abortControllerRef.current?.abort();
    const sessionId = ensureSessionId();
    updateSessionMessages(sessionId, () => []);
  };

  const handleNewSession = () => {
    const next = createSession(sessions.length + 1);
    setSessions((prev) => [...prev, next]);
    setActiveSessionId(next.id);
    setQuestion('');
    setError('');
    setStreamingContent('');
    setIsStreaming(false);
    abortControllerRef.current?.abort();
  };

  const handleSwitchSession = (id: string) => {
    if (!id || id === activeSessionId) return;
    abortControllerRef.current?.abort();
    setActiveSessionId(id);
    setQuestion('');
    setError('');
    setStreamingContent('');
    setIsStreaming(false);
    const nextSession = sessions.find((session) => session.id === id);
    if (nextSession?.mode) setAnalysisMode(nextSession.mode);
  };

  const handleRenameSession = () => {
    if (!activeSession) return;
    const nextTitle = window.prompt('请输入新的会话名称', activeSession.title)?.trim();
    if (!nextTitle) return;
    setSessions((prev) =>
      prev.map((session) =>
        session.id === activeSession.id
          ? { ...session, title: nextTitle, updatedAt: new Date().toISOString() }
          : session,
      ),
    );
  };

  const handleDeleteSession = () => {
    if (!activeSession) return;
    if (!window.confirm('确定删除当前会话吗？')) return;

    setSessions((prev) => {
      const remaining = prev.filter((session) => session.id !== activeSession.id);
      if (remaining.length === 0) {
        const next = createSession(1);
        setActiveSessionId(next.id);
        return [next];
      }
      setActiveSessionId(remaining[0].id);
      return remaining;
    });
  };

  const handleExportSession = () => {
    if (!activeSession || typeof window === 'undefined') return;
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      session: activeSession,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeSession.title || 'ai-session'}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportMarkdown = () => {
    if (!activeSession || typeof window === 'undefined') return;
    const markdown = [`# ${activeSession.title}`, '', ...activeSession.messages.map((message) => {
      const title = message.role === 'user' ? '## 用户' : '## AI';
      return `${title}\n\n${message.content}`;
    })].join('\n');
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeSession.title || 'ai-session'}.md`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const questionTemplates = ['分析我的持仓风险', '给出配置建议', '看看我的收益结构'];

  const handleStop = () => {
    abortControllerRef.current?.abort();
  };

  const handleAnalyze = async () => {
    const snapshot = holdingsSnapshot;
    if (!snapshot || snapshot.holdings.length === 0) {
      setError(t('common.aiHoldingAnalysisNoHoldings') || '暂无持仓，请先添加基金');
      return;
    }
    if (!apiKey) {
      handleApiKeyIssue();
      return;
    }

    const defaultQuestion =
      t('common.aiHoldingAnalysisDefaultQuestion') ||
      '请基于当前持仓做一次全面分析（收益、风险、集中度与改进建议）。';
    const trimmedQuestion = question.trim();
    const nextQuestion = trimmedQuestion || (activeMessages.length === 0 ? defaultQuestion : '');
    if (!nextQuestion) return;

    if (isStreaming) return;

    const sessionTitle =
      activeMessages.length === 0
        ? nextQuestion.length > 12
          ? `${nextQuestion.slice(0, 12)}…`
          : nextQuestion
        : undefined;
    const sessionId = ensureSessionId(sessionTitle);
    const userMessage: AiAnalysisMessage = { role: 'user', content: nextQuestion };
    updateSessionMessages(sessionId, (prev) => [...prev, userMessage]);

    const cacheKey = buildAiAnalysisCacheKey({
      holdings: snapshot,
      question: nextQuestion,
      analysisMode,
      provider,
      model,
    });
    const cachedReply = getCachedAiAnalysisResult(cacheKey);
    if (cachedReply) {
      updateSessionMessages(sessionId, (prev) => [...prev, { role: 'assistant', content: cachedReply }]);
      setQuestion('');
      setError('');
      return;
    }

    setQuestion('');
    setError('');
    setIsStreaming(true);
    setStreamingContent('');

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    let streamedText = '';
    let appended = false;

    const appendAssistant = (text: string) => {
      const finalText = text.trim();
      if (!finalText) return;
      updateSessionMessages(sessionId, (prev) => [
        ...prev,
        { role: 'assistant', content: finalText },
      ]);
      appended = true;
    };

    try {
      const answer = await analyzeHoldingsChatStream({
        provider,
        apiKey,
        model,
        baseURL,
        holdings: snapshot,
        messages: activeMessages,
        question: nextQuestion,
        analysisMode,
        signal: abortController.signal,
        onDelta: (delta) => {
          streamedText += delta;
          setStreamingContent((prev) => prev + delta);
        },
      });
      const reply =
        answer || streamedText || t('common.aiHoldingAnalysisEmpty') || '未收到有效回复，请重试';
      setCachedAiAnalysisResult(cacheKey, reply);
      appendAssistant(reply);
    } catch (err: unknown) {
      if (isAbortError(err)) {
        if (streamedText.trim()) {
          appendAssistant(streamedText);
        }
      } else {
        console.error(err);
        setError(t('common.aiHoldingAnalysisFailed') || '分析失败，请稍后重试');
      }
    } finally {
      if (!appended && streamedText.trim()) {
        updateSessionMessages(sessionId, (prev) => [
          ...prev,
          { role: 'assistant', content: streamedText.trim() },
        ]);
      }
      setIsStreaming(false);
      setStreamingContent('');
      abortControllerRef.current = null;
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleClose, isOpen]);

  const summary = holdingsSnapshot || {
    asOf: getLocalDateString(),
    currency: 'CNY',
    totalAssets: 0,
    totalDayGain: 0,
    totalDayGainPct: 0,
    holdingGain: 0,
    holdingGainPct: 0,
    holdings: [],
  };
  const hasHoldings = summary.holdings.length > 0;
  const canSubmit = !isStreaming && hasHoldings && (question.trim() || activeMessages.length === 0);
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;

  useEffect(() => {
    if (!isOpen || !allocationChartRef.current || !performanceChartRef.current || !hasHoldings) return;
    if (typeof window !== 'undefined' && /jsdom/i.test(window.navigator.userAgent)) return;

    const allocationChart = echarts.init(allocationChartRef.current);
    const performanceChart = echarts.init(performanceChartRef.current);

    allocationChart.setOption({
      tooltip: { trigger: 'item' },
      series: [
        {
          type: 'pie',
          radius: ['45%', '70%'],
          data: summary.holdings.map((item) => ({ name: item.name, value: item.marketValue })),
        },
      ],
    });

    performanceChart.setOption({
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: summary.holdings.map((item) => item.name),
      },
      yAxis: { type: 'value' },
      series: [
        {
          type: 'bar',
          data: summary.holdings.map((item) => item.totalGainPct),
        },
      ],
    });

    return () => {
      allocationChart.dispose();
      performanceChart.dispose();
    };
  }, [hasHoldings, isOpen, summary.holdings]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-md flex items-end sm:items-center justify-center sm:p-4"
          onClick={handleClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="flex h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] shadow-[var(--app-shell-shadow)] sm:h-[78vh] sm:w-[1120px] sm:max-w-[1120px] sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            initial={isDesktop ? { opacity: 0, scale: 0.96, y: 20 } : { opacity: 1, y: 40 }}
            animate={isDesktop ? { opacity: 1, scale: 1, y: 0 } : { opacity: 1, y: 0 }}
            exit={isDesktop ? { opacity: 0, scale: 0.96, y: 20 } : { opacity: 1, y: 40 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-border-dark shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleClose}
                  className="p-1.5 -ml-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-gray-500"
                >
                  <Icons.ArrowUp size={20} className="-rotate-90" />
                </button>
                <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">
                  {t('common.aiHoldingAnalysisTitle') || 'AI 持仓分析'}
                </h2>
              </div>
              <div className="text-[10px] text-gray-400 bg-gray-50 dark:bg-white/5 px-2 py-1 rounded font-medium">
                {t('common.asOf') || '更新至'} {summary.asOf}
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-4 overflow-hidden bg-gray-50/50 p-4 dark:bg-transparent sm:flex-row">
              <aside className="overflow-hidden sm:w-[280px] sm:shrink-0 sm:border-r sm:border-gray-100 sm:pr-4 dark:sm:border-border-dark">
                <div className="bg-white dark:bg-card-dark rounded-xl overflow-hidden shadow-sm p-4 border border-gray-100 dark:border-border-dark">
                  <div className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                    持仓概览
                  </div>
                  <div className="text-2xl font-bold text-gray-800 dark:text-gray-100 mt-2">
                    {formatCurrency(summary.totalAssets)}
                  </div>
                  <div className="mt-3 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                    会话列表
                  </div>
                  <div className="mt-2 flex flex-col gap-2">
                    <input
                      value={sessionKeyword}
                      onChange={(e) => setSessionKeyword(e.target.value)}
                      placeholder="搜索会话"
                      className="px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-white/5 text-gray-700 dark:text-gray-100"
                    />
                    <button
                      onClick={handleNewSession}
                      className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white"
                    >
                      {t('common.aiHoldingAnalysisNewSession') || '新建会话'}
                    </button>
                    <select
                      value={activeSessionId}
                      onChange={(e) => handleSwitchSession(e.target.value)}
                      size={Math.min(Math.max(filteredSessions.length, 3), 8)}
                      className="min-h-[140px] rounded border border-gray-200 bg-white px-2 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-white/5 dark:text-gray-100"
                    >
                      {filteredSessions.map((session, idx) => (
                        <option key={session.id} value={session.id}>
                          {session.title || buildSessionTitle(idx + 1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </aside>

              <main className="min-w-0 flex-1 overflow-hidden">
              <div className="flex h-full min-h-0 gap-4">
              <section className="flex min-w-0 flex-1 flex-col gap-4 overflow-hidden">
              <div className="bg-white dark:bg-card-dark rounded-xl overflow-hidden shadow-sm p-4 border border-gray-100 dark:border-border-dark">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                      {t('common.aiHoldingsSnapshot') || '持仓概览'}
                    </div>
                    <div className="mt-2 text-2xl font-bold text-gray-800 dark:text-gray-100">
                      {formatCurrency(summary.totalAssets)}
                    </div>
                  </div>
                  <button
                    onClick={() => setInspectorOpen((prev) => !prev)}
                    className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900 dark:border-gray-700 dark:bg-white/5 dark:text-gray-200"
                  >
                    {inspectorOpen ? '收起分析面板' : '查看分析面板'}
                  </button>
                </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs">
                  <span className={`${getSignColor(summary.holdingGain)} rounded-full bg-gray-50 px-3 py-1 font-sans dark:bg-white/5`}>
                    {t('common.totalGain') || '持有收益'} {formatSignedCurrency(summary.holdingGain)}
                  </span>
                  <span className={`${getSignColor(summary.totalDayGain)} rounded-full bg-gray-50 px-3 py-1 font-sans dark:bg-white/5`}>
                    {t('common.dayGain') || '日收益'} {formatSignedCurrency(summary.totalDayGain)}
                  </span>
                  <span className="rounded-full bg-gray-50 px-3 py-1 text-gray-500 dark:bg-white/5 dark:text-gray-300">
                    当前模式 {analysisMode === 'quick' ? '快速分析' : analysisMode === 'deep' ? '深度分析' : '风险评估'}
                  </span>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm overflow-hidden dark:border-border-dark dark:bg-card-dark">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-gray-800 dark:text-gray-100">
                    当前对话
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRenameSession}
                      className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      重命名会话
                    </button>
                    <button
                      onClick={handleDeleteSession}
                      className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      删除会话
                    </button>
                    <button
                      onClick={handleExportSession}
                      className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      导出会话
                    </button>
                    <button
                      onClick={handleExportMarkdown}
                      className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      导出 Markdown
                    </button>
                    {activeMessages.length > 0 && (
                      <button
                        onClick={resetActiveSession}
                        className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        {t('common.clearChat') || '清空对话'}
                      </button>
                    )}
                    {isStreaming && (
                      <button
                        onClick={handleStop}
                        className="text-xs text-red-500 hover:text-red-600"
                      >
                        {t('common.aiHoldingAnalysisStop') || '停止生成'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="shrink-0 text-xs text-gray-500">
                  {t('common.aiHoldingAnalysisSession') || '会话'}：{activeSession?.title || buildSessionTitle(1)}
                </div>

                <div className="shrink-0 flex flex-wrap gap-2">
                  {([
                    ['quick', '快速分析'],
                    ['deep', '深度分析'],
                    ['risk', '风险评估'],
                  ] as const).map(([mode, label]) => {
                    const active = analysisMode === mode;
                    return (
                      <button
                        key={mode}
                        onClick={() => setAnalysisMode(mode)}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                          active
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-200'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <div className="shrink-0 flex flex-wrap gap-2">
                  {questionTemplates.map((template) => (
                    <button
                      key={template}
                      onClick={() => setQuestion(template)}
                      className="rounded-full bg-gray-100 px-3 py-1.5 text-xs text-gray-600 dark:bg-white/10 dark:text-gray-200"
                    >
                      {template}
                    </button>
                  ))}
                </div>

                {!hasHoldings && (
                  <div className="text-xs text-gray-400">
                    {t('common.aiHoldingAnalysisNoHoldings') || '暂无持仓，请先添加基金。'}
                  </div>
                )}

                {hasHoldings && activeMessages.length === 0 && (
                  <div className="text-xs text-gray-400">
                    {t('common.aiHoldingAnalysisHint') ||
                      '可询问收益结构、风险集中度、持仓分布等。'}
                  </div>
                )}

                {hasHoldings && (activeMessages.length > 0 || isStreaming) && (
                  <div
                    data-testid="ai-chat-scroll-region"
                    className="min-h-0 flex-1 overflow-y-auto pr-1 scroll-smooth"
                  >
                    <div className="mx-auto flex max-w-3xl flex-col gap-3">
                    {activeMessages.map((msg, idx) => (
                      <div
                        key={`${msg.role}-${idx}`}
                        className={`max-w-3xl rounded-2xl px-4 py-3 text-sm leading-7 shadow-sm ${
                          msg.role === 'user'
                            ? 'self-end bg-blue-50 dark:bg-blue-900/30 text-gray-700 dark:text-gray-100'
                            : 'self-start border border-gray-100 bg-gray-50 dark:border-white/10 dark:bg-white/10 text-gray-800 dark:text-gray-100'
                        }`}
                      >
                        {msg.role === 'assistant' ? (
                          <div
                            className="markdown-body"
                            dangerouslySetInnerHTML={renderMarkdown(msg.content)}
                          />
                        ) : (
                          <div className="whitespace-pre-wrap">{msg.content}</div>
                        )}
                      </div>
                    ))}
                    {isStreaming && (
                      <div className="max-w-3xl self-start rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm leading-7 text-gray-800 shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-gray-100">
                        {streamingContent ? (
                          <div
                            className="markdown-body"
                            dangerouslySetInnerHTML={renderMarkdown(streamingContent)}
                          />
                        ) : (
                          <div className="text-xs text-gray-400">
                            {t('common.analyzing') || '分析中...'}
                          </div>
                        )}
                      </div>
                    )}
                    </div>
                  </div>
                )}

                {error && <div className="text-xs text-red-500">{error}</div>}

                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={t('common.aiHoldingAnalysisPlaceholder') || '输入你想了解的问题…'}
                  disabled={isStreaming}
                  className="shrink-0 w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-white/5 focus:outline-none focus:border-blue-500 text-gray-900 dark:text-gray-100 text-sm min-h-[120px] disabled:opacity-60"
                />
                <div className="shrink-0 flex gap-2">
                  <button
                    onClick={() => handleAnalyze()}
                    disabled={!canSubmit}
                    className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-bold disabled:opacity-50"
                  >
                    {activeMessages.length === 0
                      ? t('common.aiHoldingAnalysisStart') || '分析持仓'
                      : t('common.aiHoldingAnalysisAsk') || '继续提问'}
                  </button>
                  {isStreaming && (
                    <button
                      onClick={handleStop}
                      className="px-4 bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 py-2.5 rounded-xl font-bold"
                    >
                      {t('common.aiHoldingAnalysisStop') || '停止生成'}
                    </button>
                  )}
                </div>

              </div>
              </section>

              {inspectorOpen && (
                <motion.aside
                  data-testid="ai-analysis-inspector"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 24 }}
                  transition={{ type: 'spring', damping: 24, stiffness: 260 }}
                  className="hidden w-[340px] shrink-0 overflow-hidden rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_20px_50px_rgba(15,23,42,0.08)] dark:border-border-dark dark:bg-card-dark lg:flex lg:flex-col lg:gap-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold text-gray-800 dark:text-gray-100">分析面板</div>
                    <button
                      onClick={() => setInspectorOpen(false)}
                      className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      收起
                    </button>
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-gradient-to-br from-slate-50 to-white p-4 dark:border-border-dark dark:from-white/8 dark:to-white/5">
                    <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400">组合总览</div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl bg-white/80 px-3 py-2 dark:bg-white/5">
                        <div className="text-[11px] text-gray-400">总资产</div>
                        <div className="mt-1 font-semibold text-gray-800 dark:text-gray-100">{formatCurrency(summary.totalAssets)}</div>
                      </div>
                      <div className="rounded-xl bg-white/80 px-3 py-2 dark:bg-white/5">
                        <div className="text-[11px] text-gray-400">持有收益</div>
                        <div className={`mt-1 font-semibold ${getSignColor(summary.holdingGain)}`}>{formatSignedCurrency(summary.holdingGain)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-gradient-to-br from-slate-50 to-white p-4 dark:border-border-dark dark:from-white/8 dark:to-white/5">
                    <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400">提醒与计划</div>
                    <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">定期分析提醒</div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-200">
                      <label className="flex items-center gap-2">
                        <input
                          aria-label="开启定期提醒"
                          type="checkbox"
                          checked={reminderEnabled}
                          onChange={(e) => setReminderEnabled(e.target.checked)}
                        />
                        开启定期提醒
                      </label>
                      <label className="flex items-center gap-2">
                        <span>提醒频率</span>
                        <select
                          aria-label="提醒频率"
                          value={reminderFrequency}
                          onChange={(e) => setReminderFrequency(e.target.value as AiReminderFrequency)}
                          className="rounded border border-gray-200 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-white/5"
                        >
                          <option value="daily">每天</option>
                          <option value="weekly">每周</option>
                          <option value="monthly">每月</option>
                        </select>
                      </label>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-gradient-to-br from-slate-50 to-white p-4 dark:border-border-dark dark:from-white/8 dark:to-white/5">
                    <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400">图表洞察</div>
                    <div className="grid gap-3">
                    <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3 dark:border-border-dark dark:bg-white/5">
                      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">资产配置</div>
                      <div ref={allocationChartRef} className="h-48 w-full" />
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3 dark:border-border-dark dark:bg-white/5">
                      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">收益对比</div>
                      <div ref={performanceChartRef} className="h-48 w-full" />
                    </div>
                    </div>
                  </div>
                </motion.aside>
              )}
              </div>
              </main>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
