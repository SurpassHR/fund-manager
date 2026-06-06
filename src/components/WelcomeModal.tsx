import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../services/i18n';
import { ModalShell } from './ModalShell';

interface CommitEntry {
  hash: string;
  subjectZh: string;
  subjectEn: string;
}

// Read commits injected by Vite
const CURRENT_VERSION = import.meta.env.VITE_LATEST_COMMIT_HASH || 'v0.2.0';

let COMMITS: CommitEntry[] = [];
try {
  COMMITS = JSON.parse(import.meta.env.VITE_COMMITS_JSON || '[]');
} catch {
  /* ignore */
}

export const WelcomeModal: React.FC = () => {
  const { t, language } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const wasOpenRef = useRef(false);

  const openModal = useCallback(() => {
    wasOpenRef.current = true;
    setIsOpen(true);
  }, []);

  useEffect(() => {
    const lastSeen = localStorage.getItem('lastSeenVersion');
    if (lastSeen !== CURRENT_VERSION) {
      openModal();
    }
  }, [openModal]);

  useEffect(() => {
    const openHandler = () => openModal();
    window.addEventListener('open-changelog', openHandler as EventListener);
    return () => {
      window.removeEventListener('open-changelog', openHandler as EventListener);
    };
  }, [openModal]);

  const handleClose = useCallback(() => {
    localStorage.setItem('lastSeenVersion', CURRENT_VERSION);
    setIsOpen(false);
  }, []);

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

  const isZh = language === 'zh';

  // Strip common emoji prefixes from subject
  const cleanSubject = (s: string) =>
    s
      .replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F]+\s*/u, '')
      .replace(
        /^(feat|fix|chore|refactor|docs|style|perf|test|ci|build|revert)(\(.+?\))?:\s*/i,
        '',
      );

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={handleClose}
      overlayId="welcome-modal"
      edgeSwipe
      zIndex="z-[100]"
      className="flex max-h-[92vh] sm:max-h-[90vh] w-full sm:max-w-lg flex-col overflow-hidden rounded-t-[1.75rem] sm:rounded-[1.75rem] border border-[var(--app-shell-line)] shadow-[var(--app-shell-shadow)]"
      onExitComplete={() => {
        if (wasOpenRef.current) {
          wasOpenRef.current = false;
          setIsOpen(false);
        }
      }}
    >
      {/* 顶部标题区 - 添加渐变背景 */}
      <div className="relative overflow-hidden border-b border-[var(--app-shell-line)] bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 px-6 py-4">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9ImN1cnJlbnRDb2xvciIgZmlsbC1vcGFjaXR5PSIwLjA1Ii8+PC9zdmc+')] bg-[length:20px_20px] opacity-50"></div>
        <div className="relative">
          <h2 className="text-xl font-semibold tracking-[-0.04em] text-[var(--app-shell-ink)]">
            {t('common.changelog')}
          </h2>
          <div className="mt-2 inline-block rounded-full border border-blue-500/30 bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-purple-500/20 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-blue-600 dark:text-blue-400 isolate">
            {CURRENT_VERSION}
          </div>
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-3">
          {COMMITS.length > 0 ? (
            COMMITS.map((commit, idx) => {
              const subject = isZh ? commit.subjectZh : commit.subjectEn;
              const colorClasses = [
                'border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-blue-600/5',
                'border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-purple-600/5',
                'border-pink-500/30 bg-gradient-to-br from-pink-500/10 to-pink-600/5',
                'border-green-500/30 bg-gradient-to-br from-green-500/10 to-green-600/5',
                'border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-amber-600/5',
              ];
              const badgeColors = [
                'border-blue-500/30 bg-blue-500/20 text-blue-600 dark:text-blue-400',
                'border-purple-500/30 bg-purple-500/20 text-purple-600 dark:text-purple-400',
                'border-pink-500/30 bg-pink-500/20 text-pink-600 dark:text-pink-400',
                'border-green-500/30 bg-green-500/20 text-green-600 dark:text-green-400',
                'border-amber-500/30 bg-amber-500/20 text-amber-600 dark:text-amber-400',
              ];
              const colorClass = colorClasses[idx % colorClasses.length];
              const badgeColor = badgeColors[idx % badgeColors.length];

              return (
                <div
                  key={commit.hash}
                  className={`rounded-xl border p-4 transition hover:shadow-md ${colorClass}`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span
                      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full border px-2 text-[10px] font-semibold tracking-[0.2em] ${badgeColor}`}
                    >
                      {idx + 1}
                    </span>
                    <code className="rounded-md bg-[var(--app-shell-panel)]/50 px-2 py-1 font-mono text-[10px] text-[var(--app-shell-muted)]">
                      {commit.hash.substring(0, 7)}
                    </code>
                  </div>
                  <p className="text-sm leading-relaxed text-[var(--app-shell-ink)]">
                    {cleanSubject(subject)}
                  </p>
                </div>
              );
            })
          ) : (
            <div className="rounded-xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)]/50 p-4">
              <p className="text-center text-sm text-[var(--app-shell-muted)]">
                {isZh ? '暂无更新记录' : 'No updates available'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 底部按钮 */}
      <div className="border-t border-[var(--app-shell-line)] bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-pink-500/5 p-6">
        <button
          onClick={handleClose}
          className="w-full rounded-full border border-blue-500/30 bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-purple-500/20 py-3 text-sm font-semibold tracking-[0.2em] text-blue-600 transition hover:from-blue-500/30 hover:via-indigo-500/30 hover:to-purple-500/30 dark:text-blue-400 isolate"
        >
          {t('common.gotIt') || '我知道了'}
        </button>
      </div>
    </ModalShell>
  );
};
