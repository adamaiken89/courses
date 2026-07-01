import { useTranslation } from 'react-i18next';

import { useLessonStore } from '../../stores/lessonStore';
import { Button } from '../ui';

function SearchCourseButton() {
  const { t } = useTranslation();
  const setSearchCourseOpen = useLessonStore((s) => s.setSearchCourseOpen);

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => setSearchCourseOpen(true)}
      title={t('lesson.searchCourse')}
    >
      {t('icons.search')} {t('lesson.searchCourse')}
    </Button>
  );
}

export default SearchCourseButton;
