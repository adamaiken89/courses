import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../api';
import { useSettingsStore } from '../../stores/settingsStore';
import { Button } from '../ui';

export default function ApiKeySection() {
  const { t } = useTranslation();
  const hasApiKey = useSettingsStore((s) => s.hasApiKey);
  const setHasApiKey = useSettingsStore((s) => s.setHasApiKey);
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSaveKey = async () => {
    if (!apiKey.trim()) return;
    await api.gemini.setKey(apiKey.trim());
    setHasApiKey(true);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
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
  );
}
