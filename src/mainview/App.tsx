import { lazy, Suspense, useCallback, useEffect, useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';

import SearchOverlay from './components/SearchOverlay';
import { useCourseStore } from './stores/courseStore';
import { useViewStore } from './stores/viewStore';
import { useSyncStore } from './stores/syncStore';
import { useSettingsStore } from './stores/settingsStore';
import { useShortcuts } from './hooks/useShortcuts';

import type { Course, ModuleMeta } from '../bun/types';

const BookmarksPage = lazy(() => import('./pages/BookmarksPage'));
const CourseListPage = lazy(() => import('./pages/CourseListPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ModuleListPage = lazy(() => import('./pages/ModuleListPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const LessonPage = lazy(() => import('./pages/LessonPage'));
const QuizPage = lazy(() => import('./pages/QuizPage'));
const ReviewPage = lazy(() => import('./pages/ReviewPage'));
const UserCardReviewPage = lazy(() => import('./pages/UserCardReviewPage'));

export default function App() {
  const { t } = useTranslation();
  const views = useViewStore((s) => s.views);
  const push = useViewStore((s) => s.push);
  const pop = useViewStore((s) => s.pop);
  const replace = useViewStore((s) => s.replace);
  const [, startTransition] = useTransition();
  const currentView = views[views.length - 1];
  const courses = useCourseStore((s) => s.courses);
  const loadCourses = useCourseStore((s) => s.load);
  const focusMode = useSettingsStore((s) => s.focusMode);

  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (currentView) {
      setLoading(false);
      return;
    }
    replace({ type: 'courseList' });
    setLoading(false);
  }, [currentView, replace]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    useSyncStore
      .getState()
      .loadStatus()
      .then(() => {
        const syncState = useSyncStore.getState();
        if (syncState.remoteRepoURL) {
          useSyncStore
            .getState()
            .startSync()
            .then(() => {
              useCourseStore.getState().reset();
              useCourseStore.getState().load();
            });
        }
      });
  }, []);

  useShortcuts('global', {
    search: () => setSearchOpen(true),
  });

  const handleSearchNavigate = useCallback(
    (courseID: string, moduleID: string | number) => {
      const course = courses.find((c) => c.id === courseID);
      const mod = course?.modules.find((m) => m.id === moduleID);
      if (course && mod) {
        startTransition(() => push({ type: 'lesson', course, module: mod }));
      }
    },
    [courses, push, startTransition],
  );

  const handleSelectModule = (course: Course, module: ModuleMeta) => {
    startTransition(() => push({ type: 'lesson', course, module }));
  };

  const handleStartReview = (course: Course) => {
    startTransition(() => push({ type: 'review', course }));
  };

  const handleSwitchCourse = (course: Course) => {
    startTransition(() => replace({ type: 'lesson', course, module: course.modules[0] }));
  };

  const handleSelectCourse = (course: Course) => {
    startTransition(() => push({ type: 'moduleList', course }));
  };

  if (loading || !currentView) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-400 flex items-center justify-center">
        {t('common.loading')}
      </div>
    );
  }

  const viewContent = (() => {
    switch (currentView.type) {
      case 'courseList':
        return (
          <CourseListPage
            onSelectCourse={handleSelectCourse}
            onOpenSettings={() => push({ type: 'settings' })}
            onOpenBookmarks={() => push({ type: 'bookmarks' })}
            onOpenDashboard={() => push({ type: 'dashboard' })}
          />
        );

      case 'moduleList':
        return (
          <ModuleListPage
            course={currentView.course}
            onSelectModule={(m) => handleSelectModule(currentView.course, m)}
            onSelectCourse={handleSelectCourse}
            onOpenSettings={() => push({ type: 'settings' })}
            onOpenBookmarks={() => push({ type: 'bookmarks' })}
            onOpenDashboard={() => push({ type: 'dashboard' })}
          />
        );

      case 'lesson':
        return (
          <LessonPage
            course={currentView.course}
            module={currentView.module}
            initialSectionID={currentView.sectionID}
            onBack={() => replace({ type: 'moduleList', course: currentView.course })}
            onSelectModule={(m) => handleSelectModule(currentView.course, m)}
            onStartQuiz={() =>
              push({ type: 'quiz', course: currentView.course, module: currentView.module })
            }
            onStartReview={() => handleStartReview(currentView.course)}
          />
        );

      case 'quiz':
        return (
          <QuizPage
            courseId={currentView.course.id}
            moduleId={currentView.module.id}
            onBack={pop}
            onSwitchCourse={handleSwitchCourse}
          />
        );

      case 'review':
        return (
          <ReviewPage
            courseId={currentView.course.id}
            onBack={pop}
            onSwitchCourse={handleSwitchCourse}
          />
        );

      case 'userCardReview':
        return (
          <UserCardReviewPage
            courseId={currentView.course.id}
            onBack={pop}
            onSwitchCourse={handleSwitchCourse}
          />
        );

      case 'settings':
        return <SettingsPage onBack={pop} />;

      case 'bookmarks':
        return (
          <BookmarksPage
            onBack={pop}
            onSwitchCourse={handleSwitchCourse}
            onOpen={(courseID, moduleID, sectionID, courses) => {
              const course = courses.find((c: Course) => c.id === courseID);
              const module = course?.modules.find((m) => m.id === moduleID);
              if (course && module) {
                replace({ type: 'lesson', course, module, sectionID: sectionID || undefined });
              }
            }}
          />
        );

      case 'dashboard':
        return <DashboardPage courseID={currentView.courseID} onBack={pop} />;
    }
  })();

  return (
    <>
      <Suspense
        fallback={
          <div className="min-h-screen bg-gray-900 text-gray-400 flex items-center justify-center">
            {t('common.loading')}
          </div>
        }
      >
        {viewContent}
      </Suspense>
      {!focusMode && (
        <button
          onClick={() => setSearchOpen(true)}
          className="fixed bottom-4 left-4 z-50 w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 shadow-lg flex items-center justify-center text-white transition-colors"
          title={t('app.search')}
        >
          {t('icons.search')}
        </button>
      )}
      {searchOpen && (
        <SearchOverlay onClose={() => setSearchOpen(false)} onNavigate={handleSearchNavigate} />
      )}
    </>
  );
}
