import { useTranslation } from 'react-i18next';

import { useLessonStore } from '../../stores/lessonStore';
import { Button } from '../ui';

function ToolsButton() {
  const { t } = useTranslation();
  const showTools = useLessonStore((s) => s.showTools);
  const toggleTools = useLessonStore((s) => s.toggleTools);

  return (
    <Button
      variant={showTools ? 'toggleActive' : 'toggle'}
      size="sm"
      onClick={toggleTools}
      title={t('lesson.toggleStudyTools')}
    >
      {t('lesson.tools')}
    </Button>
  );
}

export default ToolsButton;
