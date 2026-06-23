import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { useCourseStore } from '../stores/courseStore';
import CourseSwitcher from './CourseSwitcher';
import PageHeader from '../layouts/PageHeader';
import PageLayout from '../layouts/PageLayout';
import PageContent from '../layouts/PageContent';
import type { Course } from '../../bun/types';

interface Bookmark {
  id: string;
  courseID: string;
  moduleID: number;
  sectionID: string | null;
  title: string;
  createdAt: string;
}

interface Props {
  onBack: () => void;
  onOpen: (courseID: string, moduleID: number, sectionID: string | null, courses: Course[]) => void;
  onSwitchCourse: (course: Course) => void;
}

export default function BookmarksView({ onBack, onOpen, onSwitchCourse }: Props) {
  const { t } = useTranslation();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const courses = useCourseStore((s) => s.courses);
  const loadCourses = useCourseStore((s) => s.load);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    api.storage.bookmarks().then((bks) => {
      setBookmarks(bks);
      setLoading(false);
    });
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await api.storage.deleteBookmark(id);
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  };

  if (loading)
    return <div className="p-8 text-center text-gray-400">{t('bookmarks.loadingBookmarks')}</div>;

  return (
    <PageLayout>
      <PageHeader
        onBack={onBack}
        title={t('bookmarks.bookmarks', { count: bookmarks.length })}
        center={<CourseSwitcher onSelect={onSwitchCourse} />}
      />
      <PageContent className="max-w-2xl mx-auto px-6 py-8">
        {bookmarks.length === 0 ? (
          <p className="text-center text-gray-500 py-12">{t('bookmarks.noBookmarks')}</p>
        ) : (
          <div className="space-y-3">
            {bookmarks.map((b) => {
              const course = courses.find((c: Course) => c.id === b.courseID);
              return (
                <div
                  key={b.id}
                  className="bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded-xl transition-colors group relative"
                >
                  <button
                    onClick={() => onOpen(b.courseID, b.moduleID, b.sectionID, courses)}
                    className="w-full text-left p-4 pr-10"
                  >
                    <h3 className="text-sm font-medium text-indigo-300">{b.title}</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {course?.displayName || b.courseID}
                      {b.sectionID ? t('bookmarks.sectionLabel') : t('bookmarks.moduleLabel')}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {new Date(b.createdAt).toLocaleDateString()}
                    </p>
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, b.id)}
                    className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 px-2 py-0.5 text-xs bg-red-800 hover:bg-red-700 rounded transition-all"
                    title={t('common.deleteBookmark')}
                  >
                    {t('common.delete')}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </PageContent>
    </PageLayout>
  );
}
