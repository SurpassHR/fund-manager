export const GIST_AUTO_SYNC_IDLE_DELAY_MS = 10 * 60 * 1000;
export const GIST_REMOTE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

interface GistAutoSyncSchedulerOptions {
  pushLocal: () => Promise<void>;
  checkRemote: () => Promise<void>;
  idleDelayMs?: number;
  remoteCheckIntervalMs?: number;
}

interface GistAutoSyncScheduler {
  start: () => void;
  markDirty: () => void;
  dispose: () => void;
}

export const createGistAutoSyncScheduler = ({
  pushLocal,
  checkRemote,
  idleDelayMs = GIST_AUTO_SYNC_IDLE_DELAY_MS,
  remoteCheckIntervalMs = GIST_REMOTE_CHECK_INTERVAL_MS,
}: GistAutoSyncSchedulerOptions): GistAutoSyncScheduler => {
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let remoteCheckTimer: ReturnType<typeof setInterval> | null = null;
  let pushing = false;
  let checkingRemote = false;

  const clearIdleTimer = () => {
    if (!idleTimer) return;
    clearTimeout(idleTimer);
    idleTimer = null;
  };

  const runPushLocal = async () => {
    idleTimer = null;
    if (pushing) return;
    pushing = true;
    try {
      await pushLocal();
    } finally {
      pushing = false;
    }
  };

  const runRemoteCheck = async () => {
    if (checkingRemote) return;
    checkingRemote = true;
    try {
      await checkRemote();
    } finally {
      checkingRemote = false;
    }
  };

  return {
    start: () => {
      if (remoteCheckTimer) return;
      remoteCheckTimer = setInterval(() => {
        void runRemoteCheck().catch((error) => {
          console.error('自动检查 Gist 同步失败', error);
        });
      }, remoteCheckIntervalMs);
    },
    markDirty: () => {
      clearIdleTimer();
      idleTimer = setTimeout(() => {
        void runPushLocal().catch((error) => {
          console.error('自动上传 Gist 同步失败', error);
        });
      }, idleDelayMs);
    },
    dispose: () => {
      clearIdleTimer();
      if (remoteCheckTimer) {
        clearInterval(remoteCheckTimer);
        remoteCheckTimer = null;
      }
    },
  };
};
