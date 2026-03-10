import path from 'path';
import { execSync } from 'child_process';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, '.', '');

  // Fetch the latest 5 git commits
  // Format: hash\x1fsubject\x1fbody\x1e (record separator between commits, unit separator between fields)
  interface CommitInfo { hash: string; subject: string; body: string; subjectZh?: string; subjectEn?: string; }
  let commits: CommitInfo[] = [];

  try {
    const gitLog = execSync('git log -5 --pretty=format:"%h%x1f%s%x1f%b%x1e"').toString();
    const records = gitLog.split('\x1e').filter(r => r.trim());
    commits = records.map(record => {
      const parts = record.trim().split('\x1f');
      return {
        hash: parts[0] || '',
        subject: parts[1] || '',
        body: (parts[2] || '').trim()
      };
    });
  } catch (error) {
    console.warn('Failed to fetch git commit info:', error);
  }

  // Translate all subjects at once via Gemini
  if (env.GEMINI_API_KEY && commits.length > 0) {
    console.log('Gemini API key found, translating commit subjects...');
    try {
      const subjects = commits.map((c, i) => `${i + 1}. ${c.subject}`).join('\n');
      const prompt = `Translate each of these git commit subjects into both Simplified Chinese and English.
Return ONLY a valid JSON array of objects, each with keys "zh" and "en".
Do not include markdown blocks or any other text.

Subjects:
${subjects}`;

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
          if (Array.isArray(parsed)) {
            parsed.forEach((t: { zh: string; en: string }, i: number) => {
              if (commits[i]) {
                commits[i].subjectZh = t.zh;
                commits[i].subjectEn = t.en;
              }
            });
          }
          console.log('Commit subjects successfully translated.');
        }
      } else {
        console.warn('Gemini API request failed:', response.statusText);
      }
    } catch (e) {
      console.warn('Failed to translate via Gemini:', e);
    }
  }

  // Serialize commits as JSON for injection
  const commitsJson = JSON.stringify(commits.map(c => ({
    hash: c.hash,
    subjectZh: c.subjectZh || c.subject,
    subjectEn: c.subjectEn || c.subject,
  })));

  return {
    base: '/fund-manager/',
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/djapi': {
          target: 'https://danjuanfunds.com',
          changeOrigin: true,
          headers: {
            Referer: 'https://danjuanfunds.com/'
          }
        }
      }
    },
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'import.meta.env.VITE_LATEST_COMMIT_HASH': JSON.stringify(commits[0]?.hash || 'unknown'),
      'import.meta.env.VITE_COMMITS_JSON': JSON.stringify(commitsJson),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
