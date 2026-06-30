import { useEffect } from 'react';

import { api } from '../api';
import { useSettingsStore } from '../stores/settingsStore';
import { useSyncStore } from '../stores/syncStore';

export function useSettingsPage() {
  const hasApiKey = useSettingsStore((s) => s.hasApiKey);
  const setHasApiKey = useSettingsStore((s) => s.setHasApiKey);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const incFontSize = useSettingsStore((s) => s.incFontSize);
  const decFontSize = useSettingsStore((s) => s.decFontSize);
  const contentWidth = useSettingsStore((s) => s.contentWidth);
  const setContentWidth = useSettingsStore((s) => s.setContentWidth);
  const locale = useSettingsStore((s) => s.locale);
  const setLocale = useSettingsStore((s) => s.setLocale);
  const transitionStyle = useSettingsStore((s) => s.transitionStyle);
  const setTransitionStyle = useSettingsStore((s) => s.setTransitionStyle);

  const lastSyncTime = useSyncStore((s) => s.lastSyncTime);
  const lastSyncedCommit = useSyncStore((s) => s.lastSyncedCommit);
  const isSyncing = useSyncStore((s) => s.isSyncing);
  const remoteRepoURL = useSyncStore((s) => s.remoteRepoURL);
  const syncError = useSyncStore((s) => s.error);
  const loadSyncStatus = useSyncStore((s) => s.loadStatus);
  const startSync = useSyncStore((s) => s.startSync);
  const setRepoURL = useSyncStore((s) => s.setRepoURL);

  useEffect(() => {
    void api.gemini.hasKey().then((r) => {
      setHasApiKey(r.hasKey);
    });
    void loadSyncStatus();
  }, [setHasApiKey, loadSyncStatus]);

  return {
    hasApiKey,
    setHasApiKey,
    theme,
    setTheme,
    fontSize,
    setFontSize,
    incFontSize,
    decFontSize,
    contentWidth,
    setContentWidth,
    locale,
    setLocale,
    transitionStyle,
    setTransitionStyle,
    lastSyncTime,
    lastSyncedCommit,
    isSyncing,
    remoteRepoURL,
    syncError,
    loadSyncStatus,
    startSync,
    setRepoURL,
  };
}
