import { create } from 'zustand';
import { api } from '../api';
import { logger } from '../logger';
import { showToast } from '../toast';

interface SyncState {
  lastSyncTime: string | null;
  lastSyncedCommit: string | null;
  isSyncing: boolean;
  remoteRepoURL: string;
  error: string | null;
  loadStatus: () => Promise<void>;
  startSync: () => Promise<void>;
  setRepoURL: (url: string) => Promise<void>;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  lastSyncTime: null,
  lastSyncedCommit: null,
  isSyncing: false,
  remoteRepoURL: '',
  error: null,

  loadStatus: async () => {
    try {
      const status = await api.sync.status();
      set({
        lastSyncTime: status.lastSyncTime,
        lastSyncedCommit: status.lastSyncedCommit,
        isSyncing: status.isSyncing,
        remoteRepoURL: status.remoteRepoURL,
        error: null,
      });
      logger.debug({ remoteRepoURL: status.remoteRepoURL }, 'Sync status loaded');
    } catch (e) {
      logger.error({ err: (e as Error).message }, 'Failed to load sync status');
      set({ error: (e as Error).message });
    }
  },

  startSync: async () => {
    if (get().isSyncing) return;
    logger.info('Starting sync');
    set({ isSyncing: true, error: null });
    try {
      const result = await api.sync.start();
      if (result.success) {
        logger.info({ commitHash: result.commitHash }, 'Sync completed');
        showToast.success('toast.syncComplete');
        set({
          lastSyncTime: new Date().toISOString(),
          lastSyncedCommit: result.commitHash,
          isSyncing: false,
        });
      } else {
        logger.warn({ message: result.message }, 'Sync failed');
        showToast.error('toast.syncFailed');
        set({ isSyncing: false, error: result.message });
      }
    } catch (e) {
      logger.error({ err: (e as Error).message }, 'Sync error');
      showToast.error('toast.syncFailed');
      set({ isSyncing: false, error: (e as Error).message });
    }
  },

  setRepoURL: async (url: string) => {
    try {
      await api.sync.setURL(url);
      set({ remoteRepoURL: url, error: null });
      logger.info('Sync repo URL set');
    } catch (e) {
      logger.error({ err: (e as Error).message }, 'Failed to set sync repo URL');
      set({ error: (e as Error).message });
    }
  },
}));
