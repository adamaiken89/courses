import { useTranslation } from 'react-i18next';

import { useLessonStore } from '../../stores/lessonStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { Button } from '../ui';

function FocusPomodoroControls() {
  const { t } = useTranslation();
  const focusMode = useSettingsStore((s) => s.focusMode);
  const toggleFocusMode = useSettingsStore((s) => s.toggleFocusMode);
  const showPomodoro = useLessonStore((s) => s.showPomodoro);
  const togglePomodoro = useLessonStore((s) => s.togglePomodoro);

  return (
    <>
      <Button
        variant={focusMode ? 'toggleActive' : 'toggle'}
        size="sm"
        onClick={toggleFocusMode}
        title={t('lesson.focusMode')}
      >
        {focusMode ? t('lesson.focusModeOn') : t('lesson.focusModeOff')}
      </Button>
      <Button
        variant={showPomodoro ? 'toggleActive' : 'toggle'}
        size="sm"
        onClick={togglePomodoro}
        title={t('pomodoro.title')}
      >
        {t('icons.pomodoro')}
      </Button>
    </>
  );
}

export default FocusPomodoroControls;
