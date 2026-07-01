import { useTranslation } from 'react-i18next';

import { useSettingsStore } from '../../stores/settingsStore';
import { Button } from '../ui';

function FontSizeControl() {
  const { t } = useTranslation();
  const fontSize = useSettingsStore((s) => s.fontSize);
  const incFontSize = useSettingsStore((s) => s.incFontSize);
  const decFontSize = useSettingsStore((s) => s.decFontSize);

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={decFontSize}
        title={t('lesson.decreaseFontSize')}
      >
        A-
      </Button>
      <span className="text-xs text-gray-400 w-8 text-center">{fontSize}</span>
      <Button
        variant="secondary"
        size="sm"
        onClick={incFontSize}
        title={t('lesson.increaseFontSize')}
      >
        A+
      </Button>
    </>
  );
}

export default FontSizeControl;
