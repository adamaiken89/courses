import { useTranslation } from 'react-i18next';

import { useBookmarks } from '../../hooks/useBookmarks';
import { useCourseStore } from '../../stores/courseStore';
import { useLessonStore } from '../../stores/lessonStore';
import { useLessonViewStore } from '../../stores/lessonViewStore';
import { useViewStore } from '../../stores/viewStore';

export default function BookmarksTab() {
  const { t } = useTranslation();
  const visibleSection = useLessonStore((s) => s.visibleSection);

  const views = useViewStore((s) => s.views);
  const lastView = views[views.length - 1];
  const courseId = lastView?.type === 'lesson' ? lastView.course.id : '';
  const moduleId = lastView?.type === 'lesson' ? lastView.module.id : '';

  const { sections } = useLessonViewStore();

  const course = useCourseStore((s) => s.courses.find((c) => c.id === courseId));
  const moduleName = course?.modules.find((m) => m.id === moduleId)?.name ?? '';
  const courseName = course?.displayName ?? '';

  const { bookmarks, loading, handleToggleBookmark, handleDeleteBookmark } = useBookmarks(
    courseId,
    moduleId,
    visibleSection,
  );

  const sectionOpt = visibleSection ? sections.find((s) => s.id === visibleSection)?.heading : null;

  return (
    <div>
      {loading ? (
        <p className="text-xs text-gray-500">{t('studyTools.loadingBookmarks')}</p>
      ) : bookmarks.length === 0 ? (
        <p className="text-xs text-gray-500">{t('studyTools.noBookmarks')}</p>
      ) : (
        bookmarks.map((b) => (
          <div key={b.id} className="bg-gray-800 border border-gray-700 rounded p-2 mb-2">
            <p className="text-xs text-gray-300">{b.title}</p>
            <p className="text-[10px] text-indigo-400 mt-0.5">{courseName}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {b.sectionID ? t('studyTools.bookmarkType') : t('studyTools.moduleType')}
            </p>
            <button
              onClick={() => {
                void handleDeleteBookmark(b.id);
              }}
              className="text-[10px] text-red-400 hover:text-red-300 mt-1"
            >
              {t('common.delete')}
            </button>
          </div>
        ))
      )}
      <button
        onClick={() => {
          const title = visibleSection ? `${moduleName} – ${sectionOpt ?? ''}` : moduleName;
          void handleToggleBookmark(title, visibleSection);
        }}
        className="w-full py-1 text-xs bg-amber-700 hover:bg-amber-600 rounded mt-2"
      >
        {bookmarks.some((b) => (visibleSection ? b.sectionID === visibleSection : !b.sectionID))
          ? t('studyTools.removeBookmark')
          : t('studyTools.addBookmark')}
      </button>
    </div>
  );
}
