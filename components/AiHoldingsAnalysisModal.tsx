import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icons } from './Icon';
import { useTranslation } from '../services/i18n';
import { useSettings } from '../services/SettingsContext';
import { analyzeHoldingsChatStream } from '../services/aiAnalysis';
import type { AiAnalysisMessage, HoldingsSnapshot } from '../services/aiAnalysis';
import {
  formatCurrency,
  formatPct,
  formatSignedCurrency,
  getSignColor,
} from '../services/financeUtils';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

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
  const abortControllerRef = useRef<AbortController | null>(null);

  type AiChatSession = {
    id: string;
    title: string;
    messages: AiAnalysisMessage[];
    createdAt: string;
    updatedAt: string;
  };

  const STORAGE_KEY = 'ai_holdings_sessions';
  const ACTIVE_KEY = 'ai_holdings_active_session';

  const [sessions, setSessions] = useState<AiChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState('');

  const { t } = useTranslation();
  const { aiProvider, openaiApiKey, openaiModel, geminiApiKey, geminiModel } = useSettings();
  const apiKey = aiProvider === 'openai' ? openaiApiKey : geminiApiKey;
  const model = aiProvider === 'openai' ? openaiModel : geminiModel;

  const handleClose = () => {
    abortControllerRef.current?.abort();
    setQuestion('');
    setError('');
    setStreamingContent('');
    setIsStreaming(false);
    onClose();
  };

  const handleApiKeyIssue = () => {
    const shouldOpen = confirm(t('common.aiKeyMissing') || '请先在设置里填写 API Key');
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
      };
    },
    [buildSessionTitle],
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

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) || sessions[0],
    [sessions, activeSessionId],
  );

  const activeMessages = activeSession?.messages || [];

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
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
  };

  const handleAnalyze = async (forceDefault?: boolean) => {
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
    const nextQuestion = forceDefault
      ? defaultQuestion
      : trimmedQuestion || (activeMessages.length === 0 ? defaultQuestion : '');
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
        provider: aiProvider,
        apiKey,
        model,
        holdings: snapshot,
        messages: activeMessages,
        question: nextQuestion,
        signal: abortController.signal,
        onDelta: (delta) => {
          streamedText += delta;
          setStreamingContent((prev) => prev + delta);
        },
      });
      const reply =
        answer || streamedText || t('common.aiHoldingAnalysisEmpty') || '未收到有效回复，请重试';
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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
          onClick={handleClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="bg-white dark:bg-card-dark w-full sm:w-[640px] sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
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

            <div className="p-4 overflow-y-auto flex-grow bg-gray-50/50 dark:bg-transparent space-y-4">
              <div className="bg-white dark:bg-card-dark rounded-xl overflow-hidden shadow-sm p-4 border border-gray-100 dark:border-border-dark">
                <div className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                  {t('common.aiHoldingsSnapshot') || '持仓概览'}
                </div>
                <div className="text-2xl font-bold text-gray-800 dark:text-gray-100 mt-2">
                  {formatCurrency(summary.totalAssets)}
                </div>
                <div className="flex flex-wrap gap-3 text-xs mt-2">
                  <span className={`${getSignColor(summary.holdingGain)} font-sans`}>
                    {t('common.totalGain') || '持有收益'}:{' '}
                    {formatSignedCurrency(summary.holdingGain)} ({formatPct(summary.holdingGainPct)}
                    )
                  </span>
                  <span className={`${getSignColor(summary.totalDayGain)} font-sans`}>
                    {t('common.dayGain') || '日收益'}: {formatSignedCurrency(summary.totalDayGain)}{' '}
                    ({formatPct(summary.totalDayGainPct)})
                  </span>
                </div>
              </div>

              <div className="bg-white dark:bg-card-dark rounded-xl overflow-hidden shadow-sm p-4 space-y-3 border border-gray-100 dark:border-border-dark">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-gray-800 dark:text-gray-100">
                    {t('common.aiHoldingAnalysis') || 'AI 持仓分析'}
                  </div>
                  <div className="flex items-center gap-2">
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

                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <span className="font-medium text-gray-500">
                    {t('common.aiHoldingAnalysisSession') || '会话'}
                  </span>
                  <select
                    value={activeSessionId}
                    onChange={(e) => handleSwitchSession(e.target.value)}
                    className="px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-white/5 text-gray-700 dark:text-gray-100"
                  >
                    {sessions.map((session, idx) => (
                      <option key={session.id} value={session.id}>
                        {session.title || buildSessionTitle(idx + 1)}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleNewSession}
                    className="px-2 py-1 rounded bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-200"
                  >
                    {t('common.aiHoldingAnalysisNewSession') || '新建会话'}
                  </button>
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
                  <div className="flex flex-col gap-2 max-h-[40vh] overflow-y-auto pr-1">
                    {activeMessages.map((msg, idx) => (
                      <div
                        key={`${msg.role}-${idx}`}
                        className={`rounded-lg px-3 py-2 text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'self-end bg-blue-50 dark:bg-blue-900/30 text-gray-700 dark:text-gray-100'
                            : 'self-start bg-gray-50 dark:bg-white/10 text-gray-800 dark:text-gray-100'
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
                      <div className="self-start rounded-lg px-3 py-2 text-sm leading-relaxed bg-gray-50 dark:bg-white/10 text-gray-800 dark:text-gray-100">
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
                )}

                {error && <div className="text-xs text-red-500">{error}</div>}

                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={t('common.aiHoldingAnalysisPlaceholder') || '输入你想了解的问题…'}
                  disabled={isStreaming}
                  className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-white/5 focus:outline-none focus:border-blue-500 text-gray-900 dark:text-gray-100 text-sm min-h-[96px] disabled:opacity-60"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAnalyze(false)}
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
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
