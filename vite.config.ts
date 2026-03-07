import path from 'path';
import { execSync } from 'child_process';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(async ({ mode }) => {
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

  // Determine translations
  let subjectZh = commitSubject;
  let subjectEn = commitSubject;
  let bodyZh = commitBody;
  let bodyEn = commitBody;

  if (env.GEMINI_API_KEY && commitSubject) {
    console.log('Gemini API key found, attempting to translate commit message...');
    try {
      const prompt = `Translate the following git commit subject and body into both Simplified Chinese and English. 
Return ONLY a valid JSON object with EXACTLY these keys: "subjectZh", "subjectEn", "bodyZh", "bodyEn".
Do not include markdown blocks or any other text.
      
Subject to translate:
${commitSubject}

Body to translate:
${commitBody}
`;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textResponse) {
          const parsed = JSON.parse(textResponse);
          if (parsed.subjectZh) subjectZh = parsed.subjectZh;
          if (parsed.subjectEn) subjectEn = parsed.subjectEn;
          if (parsed.bodyZh) bodyZh = parsed.bodyZh;
          if (parsed.bodyEn) bodyEn = parsed.bodyEn;
          console.log('Commit message successfully translated.');
        }
      } else {
        console.warn('Gemini API request failed:', response.statusText);
      }
    } catch (e) {
      console.warn('Failed to translate git commit info via Gemini:', e);
    }
  } else {
    console.log('Skipping translation. GEMINI_API_KEY not found or commit subject is empty.');
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
      'import.meta.env.VITE_LATEST_COMMIT_SUBJECT_ZH': JSON.stringify(subjectZh),
      'import.meta.env.VITE_LATEST_COMMIT_SUBJECT_EN': JSON.stringify(subjectEn),
      'import.meta.env.VITE_LATEST_COMMIT_BODY_ZH': JSON.stringify(bodyZh),
      'import.meta.env.VITE_LATEST_COMMIT_BODY_EN': JSON.stringify(bodyEn),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
