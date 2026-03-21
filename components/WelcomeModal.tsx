import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../services/i18n';
import { resetDragState, useEdgeSwipe } from '../services/useEdgeSwipe';
import { useOverlayRegistration } from '../services/overlayRegistration';

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

const MODAL_TRANSITION_MS = 260;

export const WelcomeModal: React.FC = () => {
  const { t, language } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const overlayId = 'welcome-modal';
  const { isDragging, activeOverlayId, setDragState, snapBackX } = useEdgeSwipe();
  const [closeTargetX, setCloseTargetX] = useState<number | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const openRafRef = useRef<number | null>(null);
  const translateX =
    isDragging && activeOverlayId === overlayId ? 'var(--edge-swipe-drag-x, 0px)' : '0px';
  const snapX = activeOverlayId === overlayId ? snapBackX : null;
  const transformX =
    closeTargetX !== null ? `${closeTargetX}px` : snapX !== null ? `${snapX}px` : translateX;
  const transition = closeTargetX !== null || snapX !== null ? 'transform 220ms ease' : undefined;
  const modalOffsetY = isVisible ? 0 : 10;
  const modalScale = isVisible ? 1 : 0.96;

  const openModal = useCallback(() => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    if (openRafRef.current !== null) {
      window.cancelAnimationFrame(openRafRef.current);
      openRafRef.current = null;
    }

    setCloseTargetX(null);
    setIsOpen(true);
    setIsVisible(false);

    openRafRef.current = window.requestAnimationFrame(() => {
      setIsVisible(true);
      openRafRef.current = null;
    });
  }, []);

  useEffect(() => {
    const lastSeen = localStorage.getItem('lastSeenVersion');
    if (lastSeen !== CURRENT_VERSION) {
      openModal();
    }
  }, [openModal]);

  useEffect(() => {
    const openHandler = () => {
      openModal();
    };

    window.addEventListener('open-changelog', openHandler as EventListener);
    return () => {
      window.removeEventListener('open-changelog', openHandler as EventListener);
    };
  }, [openModal]);

  const closeImmediately = useCallback(() => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    if (openRafRef.current !== null) {
      window.cancelAnimationFrame(openRafRef.current);
      openRafRef.current = null;
    }

    localStorage.setItem('lastSeenVersion', CURRENT_VERSION);
    setIsVisible(false);
    setIsOpen(false);
  }, []);

  const handleClose = useCallback(() => {
    localStorage.setItem('lastSeenVersion', CURRENT_VERSION);
    setIsVisible(false);

    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsOpen(false);
      closeTimeoutRef.current = null;
    }, MODAL_TRANSITION_MS);
  }, []);

  const requestClose = useCallback(
    (payload?: { source?: 'edge-swipe' | 'programmatic'; targetX?: number }) => {
      if (payload?.source === 'edge-swipe' && payload.targetX !== undefined) {
        setCloseTargetX(payload.targetX);
        return;
      }
      handleClose();
    },
    [handleClose],
  );

  useOverlayRegistration(overlayId, isOpen, requestClose);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
      if (openRafRef.current !== null) {
        window.cancelAnimationFrame(openRafRef.current);
      }
      if (activeOverlayId === overlayId) {
        resetDragState(setDragState);
      }
    };
  }, [activeOverlayId, overlayId, setDragState]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [handleClose, isOpen]);

  if (!isOpen) return null;

  const isZh = language === 'zh';

  const colors = [
    'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
    'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
    'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400',
    'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400',
    'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400',
  ];

  // Strip common emoji prefixes from subject
  const cleanSubject = (s: string) =>
    s
      .replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F]+\s*/u, '')
      .replace(
        /^(feat|fix|chore|refactor|docs|style|perf|test|ci|build|revert)(\(.+?\))?:\s*/i,
        '',
      );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        data-testid="welcome-backdrop"
        className={`absolute inset-0 transition-all duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${isVisible ? 'bg-black/60 backdrop-blur-sm' : 'bg-black/0 backdrop-blur-0'}`}
        onClick={handleClose}
      />
      <div
        data-testid="welcome-modal-card"
        className={`flex max-h-[90vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-[var(--app-shell-line)] bg-[var(--app-shell-panel)] shadow-[var(--app-shell-shadow)] transition-all duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        style={{
          transform: `translate3d(${transformX}, ${modalOffsetY}px, 0) scale(${modalScale})`,
          transition,
        }}
        onTransitionEnd={() => {
          if (closeTargetX !== null) {
            setCloseTargetX(null);
            resetDragState(setDragState);
            closeImmediately();
            return;
          }
          if (snapX !== null) {
            resetDragState(setDragState);
          }
        }}
      >
        {/* 顶部插画/背景区 */}
          <div className="relative flex h-32 items-center justify-center overflow-hidden bg-gradient-to-br from-[var(--app-shell-accent)] to-blue-700">
          <div className="absolute inset-0 opacity-20 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9IiNmZmYiLz48L3N2Zz4=')] bg-[length:20px_20px]"></div>
          <div className="text-white text-center z-10 px-4">
            <h2 className="text-xl font-bold mb-1 truncate">
              {t('common.welcome') || '欢迎使用小胡养基'}
            </h2>
            <span className="inline-block max-w-full truncate rounded-full bg-white/20 px-3 py-1 text-xs font-bold font-mono backdrop-blur-md">
              {CURRENT_VERSION}
            </span>
          </div>
        </div>

        {/* 内容区 */}
        <div className="p-6">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-[var(--app-shell-muted)]">
            {isZh ? '近期更新' : 'Recent Updates'}
          </h3>

          <ul className="space-y-3 max-h-64 overflow-y-auto pr-2">
            {COMMITS.length > 0 ? (
              COMMITS.map((commit, idx) => {
                const subject = isZh ? commit.subjectZh : commit.subjectEn;
                const colorClass = colors[idx % colors.length];

                return (
                  <li
                    key={commit.hash}
                    className="flex items-start gap-3 rounded-xl px-1.5 py-1 transition-colors hover:bg-[var(--app-shell-panel-strong)]/72"
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${colorClass}`}
                    >
                      <span className="text-[10px] font-bold font-mono">{idx + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-relaxed text-[var(--app-shell-ink)]">
                        {cleanSubject(subject)}
                      </p>
                      <span className="font-mono text-[10px] text-[var(--app-shell-muted)]">
                        {commit.hash}
                      </span>
                    </div>
                  </li>
                );
              })
            ) : (
              <li className="flex items-start gap-3 rounded-xl px-1.5 py-1 transition-colors hover:bg-[var(--app-shell-panel-strong)]/72">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
                    <polyline points="16 7 22 7 22 13"></polyline>
                  </svg>
                </div>
                <div>
                  <h4 className="mb-0.5 text-sm font-bold text-[var(--app-shell-ink)]">
                    常规更新
                  </h4>
                  <p className="text-xs leading-relaxed text-[var(--app-shell-muted)]">
                    带来了性能改进和问题修复。
                  </p>
                </div>
              </li>
            )}
          </ul>

          {/* 按钮 */}
          <div className="mt-8">
            <button
              onClick={handleClose}
              className="w-full rounded-xl bg-[var(--app-shell-accent)] py-3.5 font-bold text-white shadow-lg shadow-blue-500/30 transition-colors hover:brightness-95 active:brightness-90"
            >
              {t('common.gotIt') || '我知道了'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
