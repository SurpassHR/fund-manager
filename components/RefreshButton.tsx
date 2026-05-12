import React, {
  useState,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
  useEffect,
} from 'react';
import { RefreshCw } from 'lucide-react';

export interface RefreshButtonHandle {
  /** 触发冷却动画（不执行刷新回调） */
  triggerCooldown: () => void;
}

interface RefreshButtonProps {
  onRefresh: () => Promise<void>;
  disabled?: boolean;
  /** sm = h-8 w-8 (Dashboard), md = h-10 w-10 (Watchlist) */
  size?: 'sm' | 'md';
  className?: string;
}

const COOLDOWN_MS = 5000;
const MIN_REFRESH_MS = 1000;
const COOLDOWN_COLOR = '#22d3ee';

const STYLE_ID = 'refresh-button-styles';

let stylesInjected = false;

function injectStyles() {
  if (stylesInjected || typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) {
    stylesInjected = true;
    return;
  }
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .rb-track {
      position: absolute;
      inset: 0;
      padding: 2px;
      border-radius: 50%;
      pointer-events: none;
      opacity: 0.5;
      background: #cbd5e1;
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
    }
    .dark .rb-track {
      background: #334155;
    }
    .rb-progress {
      position: absolute;
      inset: 0;
      padding: 2px;
      border-radius: 50%;
      pointer-events: none;
      filter: drop-shadow(0 0 6px ${COOLDOWN_COLOR});
      opacity: 0;
      transform: scale(1.05);
      transition: opacity 0.4s ease, transform 0.4s ease;
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
    }
    .rb-progress.active {
      opacity: 1;
      transform: scale(1);
    }
  `;
  document.head.appendChild(style);
  stylesInjected = true;
}

const RefreshButton = forwardRef<RefreshButtonHandle, RefreshButtonProps>(
  ({ onRefresh, disabled = false, size = 'sm', className = '' }, ref) => {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isCoolingDown, setIsCoolingDown] = useState(false);

    const progressRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef(0);
    const coolingDownGateRef = useRef(false);

    // 注入全局样式（仅一次）
    useEffect(() => {
      injectStyles();
    }, []);

    // 冷却动画（RAF）
    const runCooldown = useCallback(() => {
      if (coolingDownGateRef.current) return;
      coolingDownGateRef.current = true;
      setIsCoolingDown(true);

      const startTime = Date.now();
      const progress = progressRef.current;
      if (progress) {
        progress.style.background = `conic-gradient(${COOLDOWN_COLOR} 100%, transparent 100%)`;
      }

      const update = () => {
        const elapsed = Date.now() - startTime;
        const percent = Math.min(100, (elapsed / COOLDOWN_MS) * 100);
        const remaining = 100 - percent;

        if (progress) {
          progress.style.background = `conic-gradient(${COOLDOWN_COLOR} ${remaining}%, transparent ${remaining}%)`;
        }

        if (elapsed < COOLDOWN_MS) {
          rafRef.current = requestAnimationFrame(update);
        } else {
          if (progress) {
            progress.style.background = '';
          }
          setIsCoolingDown(false);
          coolingDownGateRef.current = false;
        }
      };

      rafRef.current = requestAnimationFrame(update);
    }, []);

    // 暴露给外部的冷却触发方法
    const triggerCooldown = useCallback(() => {
      if (isRefreshing || coolingDownGateRef.current) return;
      runCooldown();
    }, [isRefreshing, runCooldown]);

    useImperativeHandle(ref, () => ({ triggerCooldown }), [triggerCooldown]);

    // 手动点击刷新
    const handleClick = useCallback(async () => {
      if (disabled || isRefreshing || coolingDownGateRef.current) return;

      setIsRefreshing(true);

      const startTime = Date.now();
      try {
        await onRefresh();
      } finally {
        const elapsed = Date.now() - startTime;
        if (elapsed < MIN_REFRESH_MS) {
          await new Promise((res) => setTimeout(res, MIN_REFRESH_MS - elapsed));
        }
        setIsRefreshing(false);
        runCooldown();
      }
    }, [disabled, isRefreshing, onRefresh, runCooldown]);

    // 卸载清理 RAF
    useEffect(() => {
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }, []);

    const isDisabled = disabled || isRefreshing;
    const sizeClass = size === 'md' ? 'h-10 w-10' : 'h-8 w-8';
    const iconSize = size === 'md' ? 16 : 14;

    return (
      <button
        onClick={handleClick}
        disabled={isDisabled}
        className={`refresh-btn relative flex items-center justify-center overflow-hidden rounded-full border transition-all duration-200 active:scale-92 ${sizeClass} ${
          isDisabled
            ? 'cursor-not-allowed border-[var(--app-shell-line)] bg-[var(--app-shell-panel-strong)] text-slate-500 dark:border-white/10 dark:bg-white/10 dark:text-gray-400'
            : 'cursor-pointer border-[var(--app-shell-line-strong)] bg-[var(--app-shell-panel-strong)] text-slate-800 dark:border-blue-400/30 dark:bg-blue-500/15 dark:text-blue-100'
        } ${className}`}
      >
        {/* 轨道环 */}
        <div className="rb-track" />
        {/* 进度环 */}
        <div ref={progressRef} className={`rb-progress ${isCoolingDown ? 'active' : ''}`} />
        {/* 图标容器 */}
        <div className="relative z-10">
          <RefreshCw
            size={iconSize}
            className={isRefreshing ? 'animate-spin' : ''}
            style={isRefreshing ? { animationDuration: '0.8s' } : undefined}
          />
        </div>
      </button>
    );
  },
);

RefreshButton.displayName = 'RefreshButton';

export default RefreshButton;
