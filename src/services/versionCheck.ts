import { useEffect, useRef, useState } from 'react';

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 分钟轮询一次

const currentVersion = import.meta.env.VITE_LATEST_COMMIT_HASH as string;

export function useVersionCheck() {
  const [newVersionAvailable, setNewVersionAvailable] = useState(false);
  const [newVersionHash, setNewVersionHash] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    if (currentVersion === 'unknown' || currentVersion === '') {
      return;
    }

    const base = import.meta.env.BASE_URL || '/';

    const checkVersion = async () => {
      try {
        const url = `${base}version.json?t=${Date.now()}`;
        const resp = await fetch(url, { cache: 'no-store' });
        if (!resp.ok) return;
        const data = await resp.json();
        if (data.hash && data.hash !== currentVersion && isMountedRef.current) {
          setNewVersionHash(data.hash);
          setNewVersionAvailable(true);
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
        }
      } catch {
        // 网络异常静默跳过，下次轮询重试
      }
    };

    // 延迟 30 秒首次检查，避免和应用初始化抢资源
    const initialTimer = setTimeout(checkVersion, 30000);

    timerRef.current = setInterval(checkVersion, POLL_INTERVAL_MS);

    return () => {
      isMountedRef.current = false;
      clearTimeout(initialTimer);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const refreshApp = () => {
    window.location.reload();
  };

  return { newVersionAvailable, newVersionHash, refreshApp };
}
