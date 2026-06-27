import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../api';
import { Button, selectableCardVariants } from '../components/ui';
import PageContent from '../layouts/PageContent';
import PageHeader from '../layouts/PageHeader';
import PageLayout from '../layouts/PageLayout';
import { useSettingsStore } from '../stores/settingsStore';
import { useSyncStore } from '../stores/syncStore';
import type { Theme } from '../themes';
import { showToast } from '../toast';
interface ThemeCard {
  id: Theme;
  icon: string;
  labelKey: string;
  descKey: string;
}

const THEME_CARDS: ThemeCard[] = [
  {
    id: 'dark',
    icon: 'icons.themeDark',
    labelKey: 'settings.themes.dark',
    descKey: 'settings.themes.darkDesc',
  },
  {
    id: 'oled',
    icon: 'icons.themeOled',
    labelKey: 'settings.themes.oled',
    descKey: 'settings.themes.oledDesc',
  },
  {
    id: 'nord',
    icon: 'icons.themeNord',
    labelKey: 'settings.themes.nord',
    descKey: 'settings.themes.nordDesc',
  },
  {
    id: 'sepia',
    icon: 'icons.themeSepia',
    labelKey: 'settings.themes.sepia',
    descKey: 'settings.themes.sepiaDesc',
  },
  {
    id: 'gruvbox',
    icon: 'icons.themeGruvbox',
    labelKey: 'settings.themes.gruvbox',
    descKey: 'settings.themes.gruvboxDesc',
  },
  {
    id: 'light',
    icon: 'icons.themeLight',
    labelKey: 'settings.themes.light',
    descKey: 'settings.themes.lightDesc',
  },
  {
    id: 'solarized-dark',
    icon: 'icons.themeSolarized',
    labelKey: 'settings.themes.solarized',
    descKey: 'settings.themes.solarizedDesc',
  },
  {
    id: 'catppuccin',
    icon: 'icons.themeCatppuccin',
    labelKey: 'settings.themes.catppuccin',
    descKey: 'settings.themes.catppuccinDesc',
  },
];

function ClearDataButton() {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);

  const handleClear = async () => {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 5000);
      return;
    }
    await api.storage.clearAll();
    showToast.success('settings.clearDataSuccess');
    window.location.reload();
  };

  return (
    <Button
      variant="danger"
      size="lg"
      onClick={() => {
        void handleClear();
      }}
    >
      {confirming ? t('settings.confirmClearData') : t('settings.clearAllData')}
    </Button>
  );
}

interface Props {
  onBack: () => void;
}

export default function SettingsPage({ onBack }: Props) {
  const { t } = useTranslation();
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);
  const repoRef = useRef<HTMLInputElement>(null);
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
  const contentWidth = useSettingsStore((s) => s.contentWidth);
  const setContentWidth = useSettingsStore((s) => s.setContentWidth);
  const syncLastTime = useSyncStore((s) => s.lastSyncTime);
  const syncLastCommit = useSyncStore((s) => s.lastSyncedCommit);
  const syncIsSyncing = useSyncStore((s) => s.isSyncing);
  const syncRemoteURL = useSyncStore((s) => s.remoteRepoURL);
  const syncError = useSyncStore((s) => s.error);
  const loadSyncStatus = useSyncStore((s) => s.loadStatus);
  const startSync = useSyncStore((s) => s.startSync);
  const setRepoURLStore = useSyncStore((s) => s.setRepoURL);

  useEffect(() => {
    void api.gemini.hasKey().then((r) => {
      setHasApiKey(r.hasKey);
    });
    void loadSyncStatus();
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

  const handleRepoKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
      e.preventDefault();
      repoRef.current?.select();
    }
  }, []);

  return (
    <PageLayout>
      <PageHeader onBack={onBack} title={t('common.settings')} hideHeaderActions />

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
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                void handleSaveKey();
              }}
              disabled={!apiKey.trim()}
            >
              {saved ? t('settings.saved') : t('common.save')}
            </Button>
          </div>
          {hasApiKey && !saved && (
            <p className="text-xs text-emerald-400 mt-2">{t('settings.apiKeyConfigured')}</p>
          )}
        </section>

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
              disabled={syncIsSyncing || !syncRemoteURL}
              loading={syncIsSyncing}
            >
              {syncIsSyncing ? t('settings.syncing') : t('settings.syncNow')}
            </Button>
            {syncLastTime && (
              <span className="text-xs text-gray-500">
                {t('settings.lastSynced')}
                {new Date(syncLastTime).toLocaleString()}
              </span>
            )}
          </div>
          {syncLastCommit && (
            <p className="text-xs text-gray-500 mt-2">
              {t('settings.commit')}
              {syncLastCommit.slice(0, 7)}
            </p>
          )}
          {syncError && <p className="text-xs text-red-400 mt-2">{syncError}</p>}
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
                <div className="text-base">{t(t_card.icon)}</div>
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
            <Button variant="secondary" size="md" onClick={decFontSize}>
              A-
            </Button>
            <input
              type="range"
              min={10}
              max={28}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="flex-1 accent-indigo-500"
            />
            <Button variant="secondary" size="md" onClick={incFontSize}>
              A+
            </Button>
            <span className="text-sm text-gray-400 w-8 text-center">{fontSize}</span>
          </div>
        </section>

        <section className="bg-gray-800 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">{t('settings.layout')}</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setContentWidth('narrow')}
              className={`flex-1 ${selectableCardVariants({ selected: contentWidth === 'narrow' })}`}
            >
              <div className="text-sm font-medium">{t('settings.narrowLayout')}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{t('settings.narrowDesc')}</div>
            </button>
            <button
              onClick={() => setContentWidth('standard')}
              className={`flex-1 ${selectableCardVariants({ selected: contentWidth === 'standard' })}`}
            >
              <div className="text-sm font-medium">{t('settings.standardLayout')}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{t('settings.standardDesc')}</div>
            </button>
            <button
              onClick={() => setContentWidth('wide')}
              className={`flex-1 ${selectableCardVariants({ selected: contentWidth === 'wide' })}`}
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
              { code: 'en-US', label: t('settings.englishUS') },
              { code: 'en-GB', label: t('settings.englishUK') },
              { code: 'en-CA', label: t('settings.englishCA') },
              { code: 'en-AU', label: t('settings.englishAU') },
              { code: 'zh-TW', label: t('settings.chineseTW') },
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

        <section className="bg-red-900/30 border border-red-800 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold mb-2 text-red-400">{t('settings.dangerZone')}</h3>
          <p className="text-sm text-gray-400 mb-4">{t('settings.clearDataDesc')}</p>
          <ClearDataButton />
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
