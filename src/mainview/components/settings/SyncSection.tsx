import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useSyncStore } from '../../stores/syncStore';
import { showToast } from '../../toast';
import { Button } from '../ui';

export default function SyncSection() {
  const { t } = useTranslation();
  const repoRef = useRef<HTMLInputElement>(null);
  const [repoURL, setRepoURL] = useState('');
  const [repoSaved, setRepoSaved] = useState(false);
  const lastSyncTime = useSyncStore((s) => s.lastSyncTime);
  const lastSyncedCommit = useSyncStore((s) => s.lastSyncedCommit);
  const isSyncing = useSyncStore((s) => s.isSyncing);
  const remoteRepoURL = useSyncStore((s) => s.remoteRepoURL);
  const syncError = useSyncStore((s) => s.error);
  const startSync = useSyncStore((s) => s.startSync);
  const setRepoURLStore = useSyncStore((s) => s.setRepoURL);

  useEffect(() => {
    if (remoteRepoURL) setRepoURL(remoteRepoURL);
  }, [remoteRepoURL]);

  const handleRepoKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
      e.preventDefault();
      repoRef.current?.select();
    }
  }, []);

  return (
    <section className="bg-gray-800 rounded-xl p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4">{t('settings.remoteContent')}</h3>
      <p className="text-sm text-gray-400 mb-4">{t('settings.remoteContentDesc')}</p>
      <div className="flex gap-2 mb-3">
        <input
          ref={repoRef}
          type="text"
          value={repoURL}
          onChange={(e) => setRepoURL(e.target.value)}
          onKeyDown={handleRepoKeyDown}
          placeholder="https://github.com/adamaiken89/course-content"
          className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500"
        />
        <Button
          variant="secondary"
          size="md"
          onClick={() => {
            void (async () => {
              try {
                const text = await navigator.clipboard.readText();
                setRepoURL(text);
              } catch {
                showToast.error('toast.clipboardFailed');
              }
            })();
          }}
          title={t('settings.pasteClipboard')}
        >
          {t('settings.paste')}
        </Button>
        <Button
          variant="secondary"
          size="md"
          onClick={() => {
            void (async () => {
              try {
                await navigator.clipboard.writeText(repoURL);
              } catch {
                showToast.error('toast.clipboardFailed');
              }
            })();
          }}
          disabled={!repoURL.trim()}
          title={t('settings.copyClipboard')}
        >
          {t('settings.copy')}
        </Button>
        <Button
          variant="primary"
          size="lg"
          onClick={() => {
            void (async () => {
              if (!repoURL.trim()) return;
              await setRepoURLStore(repoURL.trim());
              setRepoSaved(true);
              setTimeout(() => setRepoSaved(false), 2000);
            })();
          }}
          disabled={!repoURL.trim()}
        >
          {repoSaved ? t('settings.saved') : t('settings.saveUrl')}
        </Button>
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          size="lg"
          onClick={() => {
            void startSync();
          }}
          disabled={isSyncing || !remoteRepoURL}
          loading={isSyncing}
        >
          {isSyncing ? t('settings.syncing') : t('settings.syncNow')}
        </Button>
        {lastSyncTime && (
          <span className="text-xs text-gray-500">
            {t('settings.lastSynced')}
            {new Date(lastSyncTime).toLocaleString()}
          </span>
        )}
      </div>
      {lastSyncedCommit && (
        <p className="text-xs text-gray-500 mt-2">
          {t('settings.commit')}
          {lastSyncedCommit.slice(0, 7)}
        </p>
      )}
      {syncError && <p className="text-xs text-red-400 mt-2">{syncError}</p>}
    </section>
  );
}
