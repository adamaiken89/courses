import { useTranslation } from 'react-i18next';
import { useViewStore } from '../stores/viewStore';

export default function BackToCourseList() {
  const { t } = useTranslation();
  const replace = useViewStore((s) => s.replace);

  return (
    <button
      onClick={() => replace({ type: 'courseList' })}
      className="text-gray-400 hover:text-white transition-colors text-sm shrink-0"
    >
      {t('common.courseReader')}
    </button>
  );
}
