import path from 'path';
import { execSync } from 'child_process';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  // Fetch the latest git commit information to display in the WelcomeModal
  let commitHash = 'unknown';
  let commitSubject = 'Unknown Update';
  let commitBody = '';

  try {
    const gitLog = execSync('git log -1 --pretty=format:"%h|%s|%b"').toString();
    const parts = gitLog.split('|');
    if (parts.length >= 2) {
      commitHash = parts[0];
      commitSubject = parts[1];
      commitBody = parts.slice(2).join('|'); // Body might contain pipe characters
    }
  } catch (error) {
    console.warn('Failed to fetch git commit info:', error);
  }

  return {
    base: '/fund-manager/',
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'import.meta.env.VITE_LATEST_COMMIT_HASH': JSON.stringify(commitHash),
      'import.meta.env.VITE_LATEST_COMMIT_SUBJECT': JSON.stringify(commitSubject),
      'import.meta.env.VITE_LATEST_COMMIT_BODY': JSON.stringify(commitBody),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
