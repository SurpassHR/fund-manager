import { useEffect, useRef } from 'react';
import { importFundsFromBackupContent, exportFundsToJsonString } from '../services/db';
import {
  downloadSyncGistContent,
  GIST_SYNC_FILENAME,
  overwriteSyncGist,
} from '../services/gistSync/index';
import { createGistAutoSyncScheduler } from '../services/gistSync/autoSyncScheduler';
import {
  GIST_AUTO_SYNC_DATA_CHANGED_EVENT,
  readLocalSyncTimestamp,
  writeLocalSyncTimestamp,
} from '../services/gistSync/autoSyncState';
import { getBackupSyncTimestamp, isRemoteBackupNewer } from '../services/gistSync/metadata';
import { parseInvestmentProfile, useSettings } from '../services/SettingsContext';

export const useGistAutoSync = (): void => {
  const {
    githubToken,
    defaultGistTarget,
    investmentProfile,
    setDefaultGistTarget,
    setInvestmentProfile,
  } = useSettings();

  const latestRef = useRef({
    githubToken,
    defaultGistTarget,
    investmentProfile,
    setDefaultGistTarget,
    setInvestmentProfile,
  });

  useEffect(() => {
    latestRef.current = {
      githubToken,
      defaultGistTarget,
      investmentProfile,
      setDefaultGistTarget,
      setInvestmentProfile,
    };
  }, [
    githubToken,
    defaultGistTarget,
    investmentProfile,
    setDefaultGistTarget,
    setInvestmentProfile,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const applyRemoteContent = async (content: string, timestamp: string) => {
      const parsed = JSON.parse(content) as { investmentProfile?: unknown };
      await importFundsFromBackupContent(content, { importMode: 'replaceAll' });
      if (parsed.investmentProfile && typeof parsed.investmentProfile === 'object') {
        latestRef.current.setInvestmentProfile(parseInvestmentProfile(parsed.investmentProfile));
      }
      writeLocalSyncTimestamp(timestamp);
    };

    const checkRemote = async () => {
      const { githubToken: token, defaultGistTarget: target } = latestRef.current;
      if (!token || !target) return;

      const content = await downloadSyncGistContent({ token, gistId: target.id });
      const remoteTimestamp = getBackupSyncTimestamp(content, target.updatedAt);
      if (!remoteTimestamp) return;

      const localTimestamp = readLocalSyncTimestamp() ?? target.updatedAt;
      if (!isRemoteBackupNewer(remoteTimestamp.timestamp, localTimestamp)) return;

      await applyRemoteContent(content, remoteTimestamp.timestamp);
    };

    const pushLocal = async () => {
      const {
        githubToken: token,
        defaultGistTarget: target,
        investmentProfile: profile,
        setDefaultGistTarget: saveDefaultGistTarget,
      } = latestRef.current;
      if (!token || !target) return;

      const content = await exportFundsToJsonString(profile);
      const localTimestamp = getBackupSyncTimestamp(content);
      if (!localTimestamp) return;

      const remoteContent = await downloadSyncGistContent({ token, gistId: target.id });
      const remoteTimestamp = getBackupSyncTimestamp(remoteContent, target.updatedAt);
      if (isRemoteBackupNewer(remoteTimestamp?.timestamp, localTimestamp.timestamp)) {
        await applyRemoteContent(remoteContent, remoteTimestamp!.timestamp);
        return;
      }

      const saved = await overwriteSyncGist({
        token,
        gistId: target.id,
        content,
        description: target.description,
      });

      writeLocalSyncTimestamp(localTimestamp.timestamp);
      saveDefaultGistTarget({
        id: saved.id,
        description: saved.description,
        updatedAt: saved.updated_at,
        fileName: GIST_SYNC_FILENAME,
      });
    };

    const scheduler = createGistAutoSyncScheduler({ pushLocal, checkRemote });
    const handleDataChanged = () => scheduler.markDirty();

    window.addEventListener(GIST_AUTO_SYNC_DATA_CHANGED_EVENT, handleDataChanged);
    scheduler.start();

    return () => {
      window.removeEventListener(GIST_AUTO_SYNC_DATA_CHANGED_EVENT, handleDataChanged);
      scheduler.dispose();
    };
  }, []);
};
