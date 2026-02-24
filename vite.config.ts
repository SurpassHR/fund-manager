import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: '/fund-manager/',
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/eastmoney-api': {
          target: 'https://fundf10.eastmoney.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/eastmoney-api/, '')
        }
      }
    },
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
