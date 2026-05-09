import React, { Component } from 'react';
import type { ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] 未捕获的渲染错误:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-app-bg,#f5f7fa)] dark:bg-[#050608] p-6">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-[var(--app-shell-accent-soft)] flex items-center justify-center">
              <svg
                className="w-8 h-8 text-[var(--app-shell-accent)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                />
              </svg>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-[var(--app-shell-ink)]">应用出现异常</h2>
              <p className="mt-2 text-sm text-[var(--app-shell-muted)]">
                很抱歉，发生了未预期的错误。请尝试重新加载页面。
              </p>
            </div>

            {this.state.error && (
              <pre className="mt-3 p-3 rounded-lg text-left text-xs text-[var(--app-shell-muted)] bg-[var(--app-shell-panel)] border border-[var(--app-shell-line)] overflow-auto max-h-32">
                {this.state.error.message}
              </pre>
            )}

            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium
                         bg-[var(--app-shell-accent)] text-white
                         hover:opacity-90 active:scale-[0.98] transition-all"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182"
                />
              </svg>
              重新加载
            </button>

            <p className="text-xs text-[var(--app-shell-muted)]">
              如果问题持续出现，请尝试清除浏览器缓存或联系技术支持。
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
