import { useTranslation } from 'react-i18next';

import { useSettingsStore } from '../../stores/settingsStore';
import { Button } from '../ui';

export default function FontSizeSection() {
  const { t } = useTranslation();
  const fontSize = useSettingsStore((s) => s.fontSize);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const incFontSize = useSettingsStore((s) => s.incFontSize);
  const decFontSize = useSettingsStore((s) => s.decFontSize);

  return (
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
  );
}
