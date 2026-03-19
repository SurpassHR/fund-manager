import path from 'path';
import { execSync } from 'child_process';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const MAX_COMMITS = 5;

  // Fetch the latest 5 git commits
  // Format: hash\x1fsubject\x1fbody\x1e (record separator between commits, unit separator between fields)
  interface CommitInfo {
    hash: string;
    subject: string;
    body: string;
    subjectZh?: string;
    subjectEn?: string;
  }

  interface CommitTranslation {
    hash: string;
    zh: string;
    en: string;
  }

  let commits: CommitInfo[] = [];

  const safeParseJson = (raw: string): unknown => {
    const direct = raw.trim();
    try {
      return JSON.parse(direct);
    } catch {
      // continue to extract JSON fragment
    }

    const firstBracket = direct.indexOf('[');
    const lastBracket = direct.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      const fragment = direct.slice(firstBracket, lastBracket + 1);
      try {
        return JSON.parse(fragment);
      } catch {
        // ignore
      }
    }

    const firstBrace = direct.indexOf('{');
    const lastBrace = direct.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const fragment = direct.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(fragment);
      } catch {
        // ignore
      }
    }

    return null;
  };

  const normalizeTranslations = (payload: unknown): CommitTranslation[] => {
    const candidates = Array.isArray(payload)
      ? payload
      : payload &&
          typeof payload === 'object' &&
          'items' in payload &&
          Array.isArray((payload as { items: unknown[] }).items)
        ? (payload as { items: unknown[] }).items
        : [];

    return candidates
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const obj = item as Record<string, unknown>;
        const hash = typeof obj.hash === 'string' ? obj.hash.trim() : '';
        const zh = typeof obj.zh === 'string' ? obj.zh.trim() : '';
        const en = typeof obj.en === 'string' ? obj.en.trim() : '';
        if (!hash || !zh || !en) return null;
        return { hash, zh, en };
      })
      .filter((item): item is CommitTranslation => item !== null);
  };

  try {
    const gitLog = execSync(
      `git log -${MAX_COMMITS} --pretty=format:"%h%x1f%s%x1f%b%x1e"`,
    ).toString();
    const records = gitLog.split('\x1e').filter((r) => r.trim());
    commits = records.map((record) => {
      const parts = record.trim().split('\x1f');
      return {
        hash: parts[0] || '',
        subject: parts[1] || '',
        body: (parts[2] || '').trim(),
      };
    });
  } catch (error) {
    console.warn('Failed to fetch git commit info:', error);
  }

  // Translate all subjects at once via Gemini
  if (env.GEMINI_API_KEY && commits.length > 0) {
    console.log('Gemini API key found, translating commit subjects...');
    try {
      const subjects = commits
        .map((c) => `{"hash":"${c.hash}","subject":"${c.subject}"}`)
        .join('\n');
      const prompt = `Translate each git commit subject into both Simplified Chinese and English.
Input lines are JSON objects with keys "hash" and "subject".
Return ONLY a valid JSON array of objects, each with keys "hash", "zh", and "en".
The output hash must match the input hash exactly.
Do not include markdown blocks or any other text.

Subjects:
${subjects}`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json',
            },
          }),
        },
      );

      if (response.ok) {
        const data = await response.json();
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textResponse) {
          const parsed = safeParseJson(textResponse);
          const translations = normalizeTranslations(parsed);
          if (translations.length > 0) {
            const byHash = new Map(translations.map((item) => [item.hash, item]));
            commits = commits.map((commit) => {
              const matched = byHash.get(commit.hash);
              if (!matched) return commit;
              return {
                ...commit,
                subjectZh: matched.zh,
                subjectEn: matched.en,
              };
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
  const commitsJson = JSON.stringify(
    commits.slice(0, MAX_COMMITS).map((c) => ({
      hash: c.hash,
      subjectZh: c.subjectZh || c.subject,
      subjectEn: c.subjectEn || c.subject,
    })),
  );

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
            Referer: 'https://danjuanfunds.com/',
          },
        },
      },
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
