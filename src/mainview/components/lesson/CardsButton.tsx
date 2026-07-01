import { useTranslation } from 'react-i18next';

import { useCurrentLesson } from '../../hooks/useCurrentLesson';
import { useCourseStore } from '../../stores/courseStore';
import { useViewStore } from '../../stores/viewStore';
import { Button } from '../ui';

function CardsButton() {
  const { t } = useTranslation();
  const { course } = useCurrentLesson();
  const courses = useCourseStore((s) => s.courses);
  const push = useViewStore((s) => s.push);

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => {
        if (!course) return;
        const found = courses.find((c) => c.id === course.id);
        if (found) push({ type: 'userCardReview', course: found });
      }}
      title={t('lesson.reviewFlashcards')}
    >
      {t('icons.cards')} {t('lesson.cards')}
    </Button>
  );
}

export default CardsButton;
