import { useTranslation } from 'react-i18next';

import type { Bookmark } from '../../../bun/types';
import { useCurrentLesson } from '../../hooks/useCurrentLesson';
import { useBookmarksStore } from '../../stores/bookmarksStore';
import { Button } from '../ui';

const EMPTY_BOOKMARKS: Bookmark[] = [];

function BookmarkButton() {
  const { t } = useTranslation();
  const { course, module } = useCurrentLesson();

  const k = course && module ? `${course.id}:${module.id}` : '';
  const byModule = useBookmarksStore((s) => s.byModule);
  const bookmarks = k ? (byModule[k] ?? EMPTY_BOOKMARKS) : EMPTY_BOOKMARKS;
  const hasActiveBookmark = bookmarks.some((b) => !b.sectionID);

  return (
    <Button
      variant={hasActiveBookmark ? 'toggleActive' : 'toggle'}
      size="sm"
      onClick={() => {
        if (!course || !module) return;
        const k = `${course.id}:${module.id}`;
        const bm = useBookmarksStore.getState().byModule[k] ?? [];
        const existing = bm.find((b) => !b.sectionID);
        if (existing) {
          void useBookmarksStore.getState().remove(existing.id);
        } else {
          void useBookmarksStore.getState().toggle(course.id, module.id, module.name, null);
        }
      }}
      title={t('lesson.bookmarkModule')}
    >
      {hasActiveBookmark ? t('icons.bookmarkFilled') : t('icons.bookmarkEmpty')}{' '}
      {t('lesson.bookmark')}
    </Button>
  );
}

export default BookmarkButton;
