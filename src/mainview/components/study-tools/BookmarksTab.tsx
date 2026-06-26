import { useTranslation } from 'react-i18next';
import { useBookmarks } from '../../hooks/useBookmarks';
import type { Section } from '../../../bun/types';

interface BookmarksTabProps {
  courseId: string;
  moduleId: string | number;
  moduleName: string;
  courseName: string;
  sections: Section[];
  visibleSection: string | null;
}

export default function BookmarksTab({
  courseId,
  moduleId,
  moduleName,
  courseName,
  sections,
  visibleSection,
}: BookmarksTabProps) {
  const { t } = useTranslation();
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
              onClick={() => handleDeleteBookmark(b.id)}
              className="text-[10px] text-red-400 hover:text-red-300 mt-1"
            >
              {t('common.delete')}
            </button>
          </div>
        ))
      )}
      <button
        onClick={() => {
          const title = visibleSection ? `${moduleName} – ${sectionOpt || ''}` : moduleName;
          handleToggleBookmark(title, visibleSection);
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
