import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../services/i18n';
import { resetDragState, useEdgeSwipe } from '../services/edgeSwipeState';
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

export const WelcomeModal: React.FC = () => {
  const { t, language } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const overlayId = 'welcome-modal';
  const { isDragging, dragX, activeOverlayId, setDragState, snapBackX } = useEdgeSwipe();
  const [closeTargetX, setCloseTargetX] = useState<number | null>(null);
  const translateX = isDragging && activeOverlayId === overlayId ? dragX : 0;
  const snapX = activeOverlayId === overlayId ? snapBackX : null;
  const transformX = closeTargetX ?? snapX ?? translateX;
  const transition = closeTargetX !== null || snapX !== null ? 'transform 220ms ease' : 'none';

  useEffect(() => {
    const lastSeen = localStorage.getItem('lastSeenVersion');
    if (lastSeen !== CURRENT_VERSION) {
      setIsOpen(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem('lastSeenVersion', CURRENT_VERSION);
    setIsOpen(false);
  };

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
      if (activeOverlayId === overlayId) {
        resetDragState(setDragState);
      }
    };
  }, [activeOverlayId, overlayId, setDragState]);

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
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="bg-white dark:bg-card-dark rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 fade-in duration-300 max-h-[90vh] flex flex-col"
        style={{ transform: `translateX(${transformX}px)`, transition }}
        onTransitionEnd={() => {
          if (closeTargetX !== null) {
            setCloseTargetX(null);
            resetDragState(setDragState);
            handleClose();
            return;
          }
          if (snapX !== null) {
            resetDragState(setDragState);
          }
        }}
      >
        {/* 顶部插画/背景区 */}
        <div className="h-32 bg-gradient-to-br from-blue-500 to-blue-700 relative overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 opacity-20 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9IiNmZmYiLz48L3N2Zz4=')] bg-[length:20px_20px]"></div>
          <div className="text-white text-center z-10 px-4">
            <h2 className="text-xl font-bold mb-1 truncate">
              {t('common.welcome') || '欢迎使用小胡养基'}
            </h2>
            <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-xs font-mono font-bold backdrop-blur-md max-w-full truncate">
              {CURRENT_VERSION}
            </span>
          </div>
        </div>

        {/* 内容区 */}
        <div className="p-6">
          <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">
            {isZh ? '近期更新' : 'Recent Updates'}
          </h3>

          <ul className="space-y-3 max-h-64 overflow-y-auto pr-2">
            {COMMITS.length > 0 ? (
              COMMITS.map((commit, idx) => {
                const subject = isZh ? commit.subjectZh : commit.subjectEn;
                const colorClass = colors[idx % colors.length];

                return (
                  <li key={commit.hash} className="flex gap-3 items-start">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${colorClass}`}
                    >
                      <span className="text-[10px] font-bold font-mono">{idx + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
                        {cleanSubject(subject)}
                      </p>
                      <span className="text-[10px] text-gray-400 font-mono">{commit.hash}</span>
                    </div>
                  </li>
                );
              })
            ) : (
              <li className="flex gap-3 items-start">
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
                  <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-0.5">
                    常规更新
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
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
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl transition-colors shadow-lg shadow-blue-500/30"
            >
              {t('common.gotIt') || '我知道了'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
