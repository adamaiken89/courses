import { useTranslation } from 'react-i18next';

import { useCurrentLesson } from '../../hooks/useCurrentLesson';
import { useViewStore } from '../../stores/viewStore';
import { Button } from '../ui';

function QuizReviewButtons() {
  const { t } = useTranslation();
  const { course, module } = useCurrentLesson();
  const push = useViewStore((s) => s.push);

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          if (!course || !module) return;
          push({ type: 'quiz', course, module });
        }}
        title={t('common.quiz')}
      >
        {t('common.quiz')}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          if (!course) return;
          push({ type: 'review', course });
        }}
        title={t('common.review')}
      >
        {t('common.review')}
      </Button>
    </>
  );
}

export default QuizReviewButtons;
