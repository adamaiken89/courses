import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';
import { useSettingsStore } from '../../stores/settingsStore';
import { useSyncStore } from '../../stores/syncStore';
import PageHeader from '../../layouts/PageHeader';
import PageLayout from '../../layouts/PageLayout';
import PageContent from '../../layouts/PageContent';
import { selectableCardVariants } from '../ui';
import type { Theme } from '../../themes';
interface ThemeCard {
  id: Theme;
  icon: string;
  labelKey: string;
  descKey: string;
}

const THEME_CARDS: ThemeCard[] = [
  { id: 'dark', icon: '🌙', labelKey: 'settings.themes.dark', descKey: 'settings.themes.darkDesc' },
  { id: 'oled', icon: '🖤', labelKey: 'settings.themes.oled', descKey: 'settings.themes.oledDesc' },
  { id: 'nord', icon: '❄️', labelKey: 'settings.themes.nord', descKey: 'settings.themes.nordDesc' },
  {
    id: 'sepia',
    icon: '📜',
    labelKey: 'settings.themes.sepia',
    descKey: 'settings.themes.sepiaDesc',
  },
  {
    id: 'gruvbox',
    icon: '🪵',
    labelKey: 'settings.themes.gruvbox',
    descKey: 'settings.themes.gruvboxDesc',
  },
  {
    id: 'light',
    icon: '☀️',
    labelKey: 'settings.themes.light',
    descKey: 'settings.themes.lightDesc',
  },
  {
    id: 'solarized-dark',
    icon: '🔆',
    labelKey: 'settings.themes.solarized',
    descKey: 'settings.themes.solarizedDesc',
  },
  {
    id: 'catppuccin',
    icon: '🩷',
    labelKey: 'settings.themes.catppuccin',
    descKey: 'settings.themes.catppuccinDesc',
  },
];

interface Props {
  onBack: () => void;
}

export default function SettingsView({ onBack }: Props) {
  const { t } = useTranslation();
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [repoURL, setRepoURL] = useState('');
  const [repoSaved, setRepoSaved] = useState(false);
  const hasApiKey = useSettingsStore((s) => s.hasApiKey);
  const setHasApiKey = useSettingsStore((s) => s.setHasApiKey);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const incFontSize = useSettingsStore((s) => s.incFontSize);
  const decFontSize = useSettingsStore((s) => s.decFontSize);
  const wideMode = useSettingsStore((s) => s.wideMode);
  const setWideMode = useSettingsStore((s) => s.setWideMode);
  const syncLastTime = useSyncStore((s) => s.lastSyncTime);
  const syncLastCommit = useSyncStore((s) => s.lastSyncedCommit);
  const syncIsSyncing = useSyncStore((s) => s.isSyncing);
  const syncRemoteURL = useSyncStore((s) => s.remoteRepoURL);
  const syncError = useSyncStore((s) => s.error);
  const loadSyncStatus = useSyncStore((s) => s.loadStatus);
  const startSync = useSyncStore((s) => s.startSync);
  const setRepoURLStore = useSyncStore((s) => s.setRepoURL);

  useEffect(() => {
    api.gemini.hasKey().then((r) => {
      setHasApiKey(r.hasKey);
    });
    loadSyncStatus();
  }, [setHasApiKey, loadSyncStatus]);

  useEffect(() => {
    if (syncRemoteURL) setRepoURL(syncRemoteURL);
  }, [syncRemoteURL]);

  const handleSaveKey = async () => {
    if (!apiKey.trim()) return;
    await api.gemini.setKey(apiKey.trim());
    setHasApiKey(true);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <PageLayout>
      <PageHeader onBack={onBack} title={t('common.settings')} />

      <PageContent className="max-w-2xl mx-auto px-8 py-8 w-full">
        <section className="bg-gray-800 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">{t('settings.geminiApiKey')}</h3>
          <p className="text-sm text-gray-400 mb-4">
            {t('settings.geminiApiKeyDesc')}{' '}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              className="text-indigo-400 hover:underline"
              rel="noreferrer"
            >
              {t('settings.aiStudioLink')}
            </a>
            .
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasApiKey ? t('settings.apiKeySet') : t('settings.apiKeyPlaceholder')}
              className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500"
            />
            <button
              onClick={handleSaveKey}
              disabled={!apiKey.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {saved ? t('settings.saved') : t('common.save')}
            </button>
          </div>
          {hasApiKey && !saved && (
            <p className="text-xs text-emerald-400 mt-2">{t('settings.apiKeyConfigured')}</p>
          )}
        </section>

        <section className="bg-gray-800 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Remote Content</h3>
          <p className="text-sm text-gray-400 mb-4">
            Sync course content from a GitHub repository.
          </p>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={repoURL}
              onChange={(e) => setRepoURL(e.target.value)}
              placeholder="https://github.com/user/repo"
              className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500"
            />
            <button
              onClick={async () => {
                if (!repoURL.trim()) return;
                await setRepoURLStore(repoURL.trim());
                setRepoSaved(true);
                setTimeout(() => setRepoSaved(false), 2000);
              }}
              disabled={!repoURL.trim()}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {repoSaved ? 'Saved' : 'Save URL'}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => startSync()}
              disabled={syncIsSyncing || !syncRemoteURL}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {syncIsSyncing ? (
                <>
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                  Syncing...
                </>
              ) : (
                'Sync Now'
              )}
            </button>
            {syncLastTime && (
              <span className="text-xs text-gray-500">
                Last synced: {new Date(syncLastTime).toLocaleString()}
              </span>
            )}
          </div>
          {syncLastCommit && (
            <p className="text-xs text-gray-500 mt-2">
              Commit: {syncLastCommit.slice(0, 7)}
            </p>
          )}
          {syncError && (
            <p className="text-xs text-red-400 mt-2">{syncError}</p>
          )}
        </section>

        <section className="bg-gray-800 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">{t('settings.readingTheme')}</h3>
          <div className="grid grid-cols-2 gap-3">
            {THEME_CARDS.map((t_card) => (
              <button
                key={t_card.id}
                onClick={() => setTheme(t_card.id)}
                className={`text-left ${selectableCardVariants({ selected: theme === t_card.id })}`}
              >
                <div className="text-base">{t_card.icon}</div>
                <div className="text-sm font-medium mt-1">{t(t_card.labelKey)}</div>
                <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">
                  {t(t_card.descKey)}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="bg-gray-800 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">{t('settings.fontSize')}</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={decFontSize}
              className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              A-
            </button>
            <input
              type="range"
              min={10}
              max={28}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="flex-1 accent-indigo-500"
            />
            <button
              onClick={incFontSize}
              className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              A+
            </button>
            <span className="text-sm text-gray-400 w-8 text-center">{fontSize}</span>
          </div>
        </section>

        <section className="bg-gray-800 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">{t('settings.layout')}</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setWideMode(false)}
              className={`flex-1 ${selectableCardVariants({ selected: !wideMode })}`}
            >
              <div className="text-sm font-medium">{t('settings.narrowLayout')}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{t('settings.narrowDesc')}</div>
            </button>
            <button
              onClick={() => setWideMode(true)}
              className={`flex-1 ${selectableCardVariants({ selected: wideMode })}`}
            >
              <div className="text-sm font-medium">{t('settings.wideLayout')}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{t('settings.wideDesc')}</div>
            </button>
          </div>
        </section>

        <section className="bg-gray-800 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">{t('settings.language')}</h3>
          <div className="flex flex-wrap gap-2">
            {[
              { code: 'en-US', label: '🇺🇸 English (US)' },
              { code: 'en-GB', label: '🇬🇧 English (UK)' },
              { code: 'en-CA', label: '🇨🇦 English (CA)' },
              { code: 'en-AU', label: '🇦🇺 English (AU)' },
              { code: 'zh-TW', label: '🇹🇼 繁體中文' },
            ].map((l) => (
              <button
                key={l.code}
                onClick={() => useSettingsStore.getState().setLocale(l.code)}
                className={`px-3 py-1.5 text-xs rounded-lg border ${selectableCardVariants({ selected: useSettingsStore.getState().locale === l.code })}`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </section>

        <section className="bg-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">{t('settings.about')}</h3>
          <p className="text-sm text-gray-400">{t('settings.version')}</p>
          <p className="text-sm text-gray-400">{t('settings.aboutDesc')}</p>
        </section>
      </PageContent>
    </PageLayout>
  );
}
