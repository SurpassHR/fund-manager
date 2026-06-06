import React from 'react';
import ReactDOM from 'react-dom/client';
import './app.css';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';

const rootElement = document.getElementById('root');
if (!rootElement) {
  document.body.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:sans-serif;padding:24px;background:#f5f7fa">
      <div style="max-width:400px;text-align:center">
        <h2 style="color:#333;font-size:1.125rem;font-weight:600;margin-bottom:8px">应用加载失败</h2>
        <p style="color:#666;font-size:0.875rem">无法找到页面挂载点，请刷新页面重试。</p>
        <button onclick="location.reload()" style="margin-top:16px;padding:8px 20px;border-radius:8px;font-size:0.875rem;font-weight:500;background:#1677ff;color:#fff;border:none;cursor:pointer">
          重新加载
        </button>
      </div>
    </div>`;
} else {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  );
}
