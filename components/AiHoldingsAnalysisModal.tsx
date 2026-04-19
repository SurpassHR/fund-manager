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

const formatRelativeTime = (iso: string): string => {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
};

const MODE_OPTIONS: Array<{ value: AiAnalysisMode; label: string }> = [
  { value: 'quick', label: '快速分析' },
  { value: 'deep', label: '深度分析' },
  { value: 'risk', label: '风险评估' },
];

const QUESTION_TEMPLATES = ['分析我的持仓风险', '给出配置建议', '看看我的收益结构'];

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
  const [openSessionMenuId, setOpenSessionMenuId] = useState<string>('');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [reminderMenuOpen, setReminderMenuOpen] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const allocationChartRef = useRef<HTMLDivElement | null>(null);
  const performanceChartRef = useRef<HTMLDivElement | null>(null);
  const scrollRegionRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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
    const s = readAiReminderSettings();
    setReminderEnabled(s.enabled);
    setReminderFrequency(s.frequency);

    const now = new Date().toISOString();
    if (
      shouldTriggerAiReminder({
        enabled: s.enabled,
        frequency: s.frequency,
        lastReminderAt: s.lastReminderAt,
        now,
      })
    ) {
      notifyAiReminder('AI 持仓分析提醒', '该做一次新的持仓分析了');
      writeAiReminderSettings({ ...s, lastReminderAt: now });
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

  const handleRenameSession = (sessionId: string) => {
    const target = sessions.find((s) => s.id === sessionId);
    if (!target) return;
    const nextTitle = window.prompt('请输入新的会话名称', target.title)?.trim();
    if (!nextTitle) return;
    setSessions((prev) =>
      prev.map((session) =>
        session.id === sessionId
          ? { ...session, title: nextTitle, updatedAt: new Date().toISOString() }
          : session,
      ),
    );
  };

  const handleDeleteSession = (sessionId: string) => {
    const target = sessions.find((s) => s.id === sessionId);
    if (!target) return;
    if (!window.confirm('确定删除当前会话吗？')) return;

    setSessions((prev) => {
      const remaining = prev.filter((session) => session.id !== sessionId);
      if (remaining.length === 0) {
        const next = createSession(1);
        setActiveSessionId(next.id);
        return [next];
      }
      if (activeSessionId === sessionId) {
        setActiveSessionId(remaining[0].id);
      }
      return remaining;
    });
  };

  const handleExportSession = (sessionId?: string) => {
    const target = sessionId
      ? sessions.find((s) => s.id === sessionId)
      : activeSession;
    if (!target || typeof window === 'undefined') return;
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      session: target,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${target.title || 'ai-session'}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportMarkdown = (sessionId?: string) => {
    const target = sessionId
      ? sessions.find((s) => s.id === sessionId)
      : activeSession;
    if (!target || typeof window === 'undefined') return;
    const markdown = [`# ${target.title}`, '', ...target.messages.map((message) => {
      const title = message.role === 'user' ? '## 用户' : '## AI';
      return `${title}\n\n${message.content}`;
    })].join('\n');
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${target.title || 'ai-session'}.md`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

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
        if (openSessionMenuId || exportMenuOpen || reminderMenuOpen) {
          setOpenSessionMenuId('');
          setExportMenuOpen(false);
          setReminderMenuOpen(false);
          return;
        }
        handleClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleClose, isOpen, openSessionMenuId, exportMenuOpen, reminderMenuOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (!openSessionMenuId && !exportMenuOpen && !reminderMenuOpen) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-menu-anchor]')) return;
      setOpenSessionMenuId('');
      setExportMenuOpen(false);
      setReminderMenuOpen(false);
    };
    window.addEventListener('mousedown', onPointer);
    return () => window.removeEventListener('mousedown', onPointer);
  }, [isOpen, openSessionMenuId, exportMenuOpen, reminderMenuOpen]);

  useEffect(() => {
    if (!scrollRegionRef.current) return;
    scrollRegionRef.current.scrollTop = scrollRegionRef.current.scrollHeight;
  }, [activeMessages.length, streamingContent, activeSessionId]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [question]);

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
  const isEmptyState = hasHoldings && activeMessages.length === 0 && !isStreaming;

  useEffect(() => {
    if (!isOpen || !inspectorOpen) return;
    if (!allocationChartRef.current || !performanceChartRef.current || !hasHoldings) return;
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
  }, [hasHoldings, isOpen, inspectorOpen, summary.holdings]);

  const sendLabel =
    activeMessages.length === 0
      ? t('common.aiHoldingAnalysisStart') || '分析持仓'
      : t('common.aiHoldingAnalysisAsk') || '继续提问';

  const currentModeLabel = MODE_OPTIONS.find((m) => m.value === analysisMode)?.label || '';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[70] bg-black/45 backdrop-blur-md flex items-end sm:items-center justify-center sm:p-4"
          onClick={handleClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            data-testid="ai-analysis-modal-shell"
            className="flex h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] text-[var(--app-shell-ink)] shadow-[var(--app-shell-shadow)] sm:h-[min(90vh,980px)] sm:w-[1120px] sm:max-w-[1120px] sm:flex-row sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            initial={isDesktop ? { opacity: 0, scale: 0.96, y: 20 } : { opacity: 1, y: 40 }}
            animate={isDesktop ? { opacity: 1, scale: 1, y: 0 } : { opacity: 1, y: 0 }}
            exit={isDesktop ? { opacity: 0, scale: 0.96, y: 20 } : { opacity: 1, y: 40 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          >
            {/* Sidebar */}
            <aside
              data-testid="ai-analysis-sidebar"
              className="hidden shrink-0 flex-col border-r border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] sm:flex sm:w-[256px]"
            >
              <div className="flex flex-col gap-3 p-3">
                <button
                  onClick={handleNewSession}
                  className="flex items-center justify-center gap-2 rounded-lg border border-[var(--app-shell-line-strong)] bg-[var(--app-shell-panel-strong)] px-3 py-2 text-sm font-medium text-[var(--app-shell-ink)] transition-colors hover:border-[var(--app-shell-accent)] hover:text-[var(--app-shell-accent)]"
                >
                  <Icons.Plus size={16} />
                  {t('common.aiHoldingAnalysisNewSession') || '新建会话'}
                </button>
                <div className="relative">
                  <Icons.Search
                    size={14}
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--app-shell-muted)]"
                  />
                  <input
                    value={sessionKeyword}
                    onChange={(e) => setSessionKeyword(e.target.value)}
                    placeholder="搜索会话"
                    className="w-full rounded-lg border border-[var(--app-shell-line)] bg-transparent py-1.5 pl-8 pr-2 text-sm text-[var(--app-shell-ink)] placeholder:text-[var(--app-shell-muted)] focus:border-[var(--app-shell-accent)] focus:outline-none"
                  />
                </div>
              </div>

              <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--app-shell-muted)]">
                会话列表
              </div>
              <ul className="flex-1 overflow-y-auto px-2 pb-2">
                {filteredSessions.length === 0 && (
                  <li className="px-3 py-4 text-center text-xs text-[var(--app-shell-muted)]">
                    没有匹配的会话
                  </li>
                )}
                {filteredSessions.map((session) => {
                  const active = session.id === activeSessionId;
                  const menuOpen = openSessionMenuId === session.id;
                  return (
                    <li
                      key={session.id}
                      data-active={active}
                      aria-current={active ? 'true' : undefined}
                      className={`group relative mb-1 rounded-lg transition-colors ${
                        active
                          ? 'bg-[var(--app-shell-accent-soft)]'
                          : 'hover:bg-[var(--app-shell-line)]'
                      }`}
                    >
                      <button
                        onClick={() => handleSwitchSession(session.id)}
                        className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left"
                      >
                        <span className="w-full truncate text-sm text-[var(--app-shell-ink)]">
                          {session.title}
                        </span>
                        <span className="text-[11px] text-[var(--app-shell-muted)]">
                          {formatRelativeTime(session.updatedAt)}
                        </span>
                      </button>
                      <div
                        data-menu-anchor
                        className={`absolute right-1.5 top-1.5 ${
                          active || menuOpen
                            ? 'opacity-100'
                            : 'opacity-0 group-hover:opacity-100'
                        } transition-opacity`}
                      >
                        <button
                          aria-label="会话更多操作"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenSessionMenuId(menuOpen ? '' : session.id);
                          }}
                          className="flex h-6 w-6 items-center justify-center rounded text-[var(--app-shell-muted)] hover:bg-[var(--app-shell-panel-strong)] hover:text-[var(--app-shell-ink)]"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="5" r="1.5" />
                            <circle cx="12" cy="12" r="1.5" />
                            <circle cx="12" cy="19" r="1.5" />
                          </svg>
                        </button>
                        {menuOpen && (
                          <div className="absolute right-0 top-7 z-10 w-36 overflow-hidden rounded-lg border border-[var(--app-shell-line-strong)] bg-[var(--app-shell-panel-strong)] shadow-lg">
                            <button
                              onClick={() => {
                                handleRenameSession(session.id);
                                setOpenSessionMenuId('');
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--app-shell-ink)] hover:bg-[var(--app-shell-line)]"
                            >
                              <Icons.Edit size={12} /> 重命名会话
                            </button>
                            <button
                              onClick={() => {
                                handleExportMarkdown(session.id);
                                setOpenSessionMenuId('');
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--app-shell-ink)] hover:bg-[var(--app-shell-line)]"
                            >
                              <Icons.Changelog size={12} /> 导出 Markdown
                            </button>
                            <button
                              onClick={() => {
                                handleExportSession(session.id);
                                setOpenSessionMenuId('');
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--app-shell-ink)] hover:bg-[var(--app-shell-line)]"
                            >
                              <Icons.Archive size={12} /> 导出 JSON
                            </button>
                            <button
                              onClick={() => {
                                handleDeleteSession(session.id);
                                setOpenSessionMenuId('');
                              }}
                              className="flex w-full items-center gap-2 border-t border-[var(--app-shell-line)] px-3 py-2 text-left text-xs text-[var(--color-stock-red)] hover:bg-[var(--app-shell-line)]"
                            >
                              <Icons.Trash size={12} /> 删除会话
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="border-t border-[var(--app-shell-line)] p-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--app-shell-muted)]">
                  持仓概览
                </div>
                <div className="mt-1 text-lg font-semibold text-[var(--app-shell-ink)]">
                  {formatCurrency(summary.totalAssets)}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                  <span
                    className={`rounded-md bg-[var(--app-shell-line)] px-2 py-0.5 ${getSignColor(
                      summary.holdingGain,
                    )}`}
                  >
                    {formatSignedCurrency(summary.holdingGain)}
                  </span>
                  <span
                    className={`rounded-md bg-[var(--app-shell-line)] px-2 py-0.5 ${getSignColor(
                      summary.totalDayGain,
                    )}`}
                  >
                    日 {formatSignedCurrency(summary.totalDayGain)}
                  </span>
                </div>
                <div className="mt-2 text-[10px] text-[var(--app-shell-muted)]">
                  {t('common.asOf') || '更新至'} {summary.asOf}
                </div>
              </div>
            </aside>

            {/* Main column */}
            <section className="flex min-w-0 flex-1 flex-col">
              {/* Toolbar */}
              <header
                data-testid="ai-analysis-toolbar"
                className="flex shrink-0 items-center gap-3 border-b border-[var(--app-shell-line)] px-4 py-3 sm:px-5"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[var(--app-shell-ink)]">
                      {t('common.aiHoldingAnalysisTitle') || 'AI 持仓分析'}
                    </div>
                    <div className="flex min-w-0 items-center gap-1 text-[11px] text-[var(--app-shell-muted)]">
                      <span>当前对话</span>
                      <span>·</span>
                      <span className="truncate text-[var(--app-shell-ink)]">
                        {activeSession?.title || buildSessionTitle(1)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="hidden items-center rounded-full bg-[var(--app-shell-line)] p-0.5 text-xs md:flex">
                  {MODE_OPTIONS.map(({ value, label }) => {
                    const active = analysisMode === value;
                    return (
                      <button
                        key={value}
                        onClick={() => setAnalysisMode(value)}
                        className={`rounded-full px-3 py-1 transition-colors ${
                          active
                            ? 'bg-[var(--app-shell-panel-strong)] text-[var(--app-shell-ink)] shadow-sm'
                            : 'text-[var(--app-shell-muted)] hover:text-[var(--app-shell-ink)]'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-1">
                  {/* Reminder */}
                  <div className="relative" data-menu-anchor>
                    <button
                      aria-label="提醒设置"
                      onClick={() => {
                        setReminderMenuOpen((prev) => !prev);
                        setExportMenuOpen(false);
                      }}
                      className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                        reminderEnabled
                          ? 'bg-[var(--app-shell-accent-soft)] text-[var(--app-shell-accent)]'
                          : 'text-[var(--app-shell-muted)] hover:bg-[var(--app-shell-line)] hover:text-[var(--app-shell-ink)]'
                      }`}
                    >
                      <Icons.Bell size={16} />
                    </button>
                    {reminderMenuOpen && (
                      <div className="absolute right-0 top-10 z-10 w-56 rounded-lg border border-[var(--app-shell-line-strong)] bg-[var(--app-shell-panel-strong)] p-3 shadow-lg">
                        <label className="flex items-center justify-between text-xs text-[var(--app-shell-ink)]">
                          <span>开启定期提醒</span>
                          <input
                            aria-label="开启定期提醒"
                            type="checkbox"
                            checked={reminderEnabled}
                            onChange={(e) => setReminderEnabled(e.target.checked)}
                          />
                        </label>
                        <div className="mt-3 flex items-center justify-between text-xs text-[var(--app-shell-ink)]">
                          <span>提醒频率</span>
                          <select
                            aria-label="提醒频率"
                            value={reminderFrequency}
                            onChange={(e) =>
                              setReminderFrequency(e.target.value as AiReminderFrequency)
                            }
                            className="rounded border border-[var(--app-shell-line)] bg-transparent px-2 py-1 text-xs"
                          >
                            <option value="daily">每天</option>
                            <option value="weekly">每周</option>
                            <option value="monthly">每月</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Export */}
                  <div className="relative" data-menu-anchor>
                    <button
                      aria-label="导出会话"
                      onClick={() => {
                        setExportMenuOpen((prev) => !prev);
                        setReminderMenuOpen(false);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--app-shell-muted)] transition-colors hover:bg-[var(--app-shell-line)] hover:text-[var(--app-shell-ink)]"
                    >
                      <Icons.Changelog size={16} />
                    </button>
                    {exportMenuOpen && (
                      <div className="absolute right-0 top-10 z-10 w-40 overflow-hidden rounded-lg border border-[var(--app-shell-line-strong)] bg-[var(--app-shell-panel-strong)] shadow-lg">
                        <button
                          onClick={() => {
                            handleExportMarkdown();
                            setExportMenuOpen(false);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--app-shell-ink)] hover:bg-[var(--app-shell-line)]"
                        >
                          <Icons.Changelog size={12} /> 导出 Markdown
                        </button>
                        <button
                          onClick={() => {
                            handleExportSession();
                            setExportMenuOpen(false);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--app-shell-ink)] hover:bg-[var(--app-shell-line)]"
                        >
                          <Icons.Archive size={12} /> 导出 JSON
                        </button>
                        {activeMessages.length > 0 && (
                          <button
                            onClick={() => {
                              resetActiveSession();
                              setExportMenuOpen(false);
                            }}
                            className="flex w-full items-center gap-2 border-t border-[var(--app-shell-line)] px-3 py-2 text-left text-xs text-[var(--app-shell-muted)] hover:bg-[var(--app-shell-line)] hover:text-[var(--app-shell-ink)]"
                          >
                            <Icons.Refresh size={12} /> 清空对话
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Inspector toggle */}
                  <button
                    aria-label={inspectorOpen ? '收起分析面板' : '查看分析面板'}
                    onClick={() => setInspectorOpen((prev) => !prev)}
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                      inspectorOpen
                        ? 'bg-[var(--app-shell-accent-soft)] text-[var(--app-shell-accent)]'
                        : 'text-[var(--app-shell-muted)] hover:bg-[var(--app-shell-line)] hover:text-[var(--app-shell-ink)]'
                    }`}
                  >
                    <Icons.Chart size={16} />
                  </button>

                  <div className="mx-1 h-5 w-px bg-[var(--app-shell-line)]" />

                  <button
                    aria-label="关闭"
                    onClick={handleClose}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--app-shell-muted)] transition-colors hover:bg-[var(--app-shell-line)] hover:text-[var(--app-shell-ink)]"
                  >
                    <Icons.X size={18} />
                  </button>
                </div>
              </header>

              {/* Message viewport */}
              <div
                data-testid="ai-analysis-message-viewport"
                ref={scrollRegionRef}
                className="min-h-0 flex-1 overflow-y-auto scroll-smooth"
              >
                {!hasHoldings ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                    <div className="text-sm text-[var(--app-shell-muted)]">
                      {t('common.aiHoldingAnalysisNoHoldings') || '暂无持仓，请先添加基金。'}
                    </div>
                  </div>
                ) : isEmptyState ? (
                  <div className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--app-shell-accent-soft)] text-[var(--app-shell-accent)]">
                      <Icons.TrendingUp size={22} />
                    </div>
                    <div className="max-w-md">
                      <div className="text-xl font-semibold text-[var(--app-shell-ink)]">
                        今天想聊聊哪部分持仓？
                      </div>
                      <div className="mt-2 text-sm text-[var(--app-shell-muted)]">
                        {t('common.aiHoldingAnalysisHint') ||
                          '可以询问收益结构、风险集中度、持仓分布，或让 AI 给出配置建议。'}
                      </div>
                      <div className="mt-2 text-[11px] text-[var(--app-shell-muted)]">
                        当前模式 · {currentModeLabel}
                      </div>
                    </div>
                    <div className="flex max-w-xl flex-wrap justify-center gap-2">
                      {QUESTION_TEMPLATES.map((template) => (
                        <button
                          key={template}
                          onClick={() => {
                            setQuestion(template);
                            textareaRef.current?.focus();
                          }}
                          className="rounded-full border border-[var(--app-shell-line-strong)] bg-[var(--app-shell-panel)] px-3.5 py-1.5 text-xs text-[var(--app-shell-ink)] transition-colors hover:border-[var(--app-shell-accent)] hover:text-[var(--app-shell-accent)]"
                        >
                          {template}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
                    {activeMessages.map((msg, idx) => (
                      <article
                        key={`${msg.role}-${idx}`}
                        className={`max-w-3xl ${msg.role === 'user' ? 'ml-auto' : ''}`}
                      >
                        {msg.role === 'user' ? (
                          <div className="inline-block rounded-2xl rounded-tr-sm bg-[var(--app-shell-accent-soft)] px-4 py-2.5 text-sm leading-6 text-[var(--app-shell-ink)]">
                            <div className="whitespace-pre-wrap">{msg.content}</div>
                          </div>
                        ) : (
                          <div>
                            <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--app-shell-muted)]">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--app-shell-accent-soft)] text-[var(--app-shell-accent)]">
                                <Icons.Chat size={11} />
                              </span>
                              AI 分析
                            </div>
                            <div
                              className="markdown-body text-[var(--app-shell-ink)]"
                              dangerouslySetInnerHTML={renderMarkdown(msg.content)}
                            />
                          </div>
                        )}
                      </article>
                    ))}
                    {isStreaming && (
                      <article className="max-w-3xl">
                        <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--app-shell-muted)]">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--app-shell-accent-soft)] text-[var(--app-shell-accent)]">
                            <Icons.Chat size={11} />
                          </span>
                          AI 分析
                        </div>
                        {streamingContent ? (
                          <div
                            className="markdown-body text-[var(--app-shell-ink)]"
                            dangerouslySetInnerHTML={renderMarkdown(streamingContent)}
                          />
                        ) : (
                          <div className="flex items-center gap-1.5 text-sm text-[var(--app-shell-muted)]">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--app-shell-accent)]" />
                            {t('common.analyzing') || '分析中...'}
                          </div>
                        )}
                      </article>
                    )}
                  </div>
                )}
              </div>

              {/* Composer */}
              <div
                data-testid="ai-analysis-composer"
                className="shrink-0 border-t border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] px-4 py-3 sm:px-6"
              >
                {error && (
                  <div className="mx-auto mb-2 max-w-3xl text-xs text-[var(--color-stock-red)]">
                    {error}
                  </div>
                )}
                {hasHoldings && activeMessages.length > 0 && (
                  <div className="mx-auto mb-2 flex max-w-3xl flex-wrap gap-1.5">
                    {QUESTION_TEMPLATES.map((template) => (
                      <button
                        key={template}
                        onClick={() => {
                          setQuestion(template);
                          textareaRef.current?.focus();
                        }}
                        className="rounded-full bg-[var(--app-shell-line)] px-3 py-1 text-[11px] text-[var(--app-shell-muted)] transition-colors hover:text-[var(--app-shell-ink)]"
                      >
                        {template}
                      </button>
                    ))}
                  </div>
                )}
                <div className="mx-auto max-w-3xl">
                  <div className="relative rounded-3xl border border-[var(--app-shell-line-strong)] bg-[var(--app-shell-panel-strong)] px-5 py-3 pr-14 transition-colors focus-within:border-[var(--app-shell-accent)]">
                    <textarea
                      ref={textareaRef}
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          if (canSubmit) handleAnalyze();
                        }
                      }}
                      placeholder={
                        t('common.aiHoldingAnalysisPlaceholder') || '输入你想了解的问题…'
                      }
                      disabled={isStreaming}
                      rows={1}
                      className="block w-full resize-none bg-transparent text-sm leading-6 text-[var(--app-shell-ink)] placeholder:text-[var(--app-shell-muted)] focus:outline-none disabled:opacity-60"
                      style={{ maxHeight: '200px' }}
                    />
                    <div className="absolute bottom-2 right-2">
                      {isStreaming ? (
                        <button
                          aria-label={t('common.aiHoldingAnalysisStop') || '停止生成'}
                          onClick={handleStop}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--app-shell-ink)] text-[var(--app-shell-paper)] transition-opacity hover:opacity-90"
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
                            <rect x="2" y="2" width="8" height="8" rx="1.5" />
                          </svg>
                        </button>
                      ) : (
                        <button
                          aria-label={sendLabel}
                          onClick={() => handleAnalyze()}
                          disabled={!canSubmit}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1677ff] text-white transition-opacity hover:opacity-90 disabled:bg-[var(--app-shell-line-strong)] disabled:text-[var(--app-shell-muted)] disabled:opacity-100"
                        >
                          <Icons.ArrowUp size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--app-shell-muted)]">
                    <span>Enter 发送 · Shift + Enter 换行</span>
                    <span className="md:hidden">当前模式 · {currentModeLabel}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Inspector drawer */}
            <AnimatePresence>
              {inspectorOpen && (
                <motion.aside
                  data-testid="ai-analysis-inspector"
                  initial={{ opacity: 0, x: 32 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 32 }}
                  transition={{ type: 'spring', damping: 26, stiffness: 240 }}
                  className="hidden w-[320px] shrink-0 flex-col overflow-hidden border-l border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] lg:flex"
                >
                  <header className="flex shrink-0 items-center justify-between border-b border-[var(--app-shell-line)] px-4 py-3">
                    <div className="text-sm font-semibold text-[var(--app-shell-ink)]">
                      分析面板
                    </div>
                    <button
                      aria-label="收起分析面板"
                      onClick={() => setInspectorOpen(false)}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--app-shell-muted)] hover:bg-[var(--app-shell-line)] hover:text-[var(--app-shell-ink)]"
                    >
                      <Icons.X size={14} />
                    </button>
                  </header>
                  <div className="flex-1 space-y-6 overflow-y-auto p-4">
                    <section>
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--app-shell-muted)]">
                        组合总览
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <div className="text-[11px] text-[var(--app-shell-muted)]">总资产</div>
                          <div className="mt-0.5 font-semibold text-[var(--app-shell-ink)]">
                            {formatCurrency(summary.totalAssets)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-[var(--app-shell-muted)]">持有收益</div>
                          <div
                            className={`mt-0.5 font-semibold ${getSignColor(summary.holdingGain)}`}
                          >
                            {formatSignedCurrency(summary.holdingGain)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-[var(--app-shell-muted)]">日收益</div>
                          <div
                            className={`mt-0.5 font-semibold ${getSignColor(summary.totalDayGain)}`}
                          >
                            {formatSignedCurrency(summary.totalDayGain)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-[var(--app-shell-muted)]">当前模式</div>
                          <div className="mt-0.5 font-semibold text-[var(--app-shell-ink)]">
                            {currentModeLabel}
                          </div>
                        </div>
                      </div>
                    </section>

                    <section>
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--app-shell-muted)]">
                        提醒与计划
                      </div>
                      <label className="flex items-center justify-between text-xs text-[var(--app-shell-ink)]">
                        <span>开启定期提醒</span>
                        <input
                          aria-label="开启定期提醒"
                          type="checkbox"
                          checked={reminderEnabled}
                          onChange={(e) => setReminderEnabled(e.target.checked)}
                        />
                      </label>
                      <div className="mt-2 flex items-center justify-between text-xs text-[var(--app-shell-ink)]">
                        <span>提醒频率</span>
                        <select
                          aria-label="提醒频率"
                          value={reminderFrequency}
                          onChange={(e) =>
                            setReminderFrequency(e.target.value as AiReminderFrequency)
                          }
                          className="rounded border border-[var(--app-shell-line)] bg-transparent px-2 py-1 text-xs"
                        >
                          <option value="daily">每天</option>
                          <option value="weekly">每周</option>
                          <option value="monthly">每月</option>
                        </select>
                      </div>
                    </section>

                    <section>
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--app-shell-muted)]">
                        导出
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => handleExportMarkdown()}
                          className="flex items-center gap-2 rounded-lg border border-[var(--app-shell-line)] bg-transparent px-3 py-2 text-left text-xs text-[var(--app-shell-ink)] transition-colors hover:border-[var(--app-shell-accent)] hover:text-[var(--app-shell-accent)]"
                        >
                          <Icons.Changelog size={13} /> 导出 Markdown
                        </button>
                        <button
                          onClick={() => handleExportSession()}
                          className="flex items-center gap-2 rounded-lg border border-[var(--app-shell-line)] bg-transparent px-3 py-2 text-left text-xs text-[var(--app-shell-ink)] transition-colors hover:border-[var(--app-shell-accent)] hover:text-[var(--app-shell-accent)]"
                        >
                          <Icons.Archive size={13} /> 导出 JSON
                        </button>
                      </div>
                    </section>

                    <section>
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--app-shell-muted)]">
                        图表洞察
                      </div>
                      <div className="space-y-4">
                        <div>
                          <div className="mb-1 text-[11px] text-[var(--app-shell-muted)]">
                            资产配置
                          </div>
                          <div ref={allocationChartRef} className="h-48 w-full" />
                        </div>
                        <div>
                          <div className="mb-1 text-[11px] text-[var(--app-shell-muted)]">
                            收益对比
                          </div>
                          <div ref={performanceChartRef} className="h-48 w-full" />
                        </div>
                      </div>
                    </section>
                  </div>
                </motion.aside>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
