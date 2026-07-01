import { useTranslation } from 'react-i18next';

import { useSettingsStore } from '../../stores/settingsStore';
import { selectableCardVariants } from '../ui';

const LOCALES = [
  { code: 'en-US', labelKey: 'settings.englishUS' },
  { code: 'en-GB', labelKey: 'settings.englishUK' },
  { code: 'en-CA', labelKey: 'settings.englishCA' },
  { code: 'en-AU', labelKey: 'settings.englishAU' },
  { code: 'zh-TW', labelKey: 'settings.chineseTW' },
];

export default function LanguageSection() {
  const { t } = useTranslation();
  const locale = useSettingsStore((s) => s.locale);
  const setLocale = useSettingsStore((s) => s.setLocale);

  return (
    <section className="bg-gray-800 rounded-xl p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4">{t('settings.language')}</h3>
      <div className="flex flex-wrap gap-2">
        {LOCALES.map((l) => (
          <button
            key={l.code}
            onClick={() => setLocale(l.code)}
            className={`px-3 py-1.5 text-xs rounded-lg border ${selectableCardVariants({ selected: locale === l.code })}`}
          >
            {t(l.labelKey)}
          </button>
        ))}
      </div>
    </section>
  );
}
