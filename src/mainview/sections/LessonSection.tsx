import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import rehypeHighlight from 'rehype-highlight';
import type { PluggableList } from 'unified';

import type { Course, ModuleMeta } from '../../bun/types';
import LessonContentViewer from '../components/lesson/LessonContentViewer';
import SectionsPanel from '../components/lesson/SectionsPanel';
import PomodoroTimer from '../components/PomodoroTimer';
import { rehypeHighlightText } from '../components/rehypeHighlightText';
import { rehypeSearchText } from '../components/rehypeSearchText';
import StudyTools from '../components/StudyTools';
import { useBookmarks } from '../hooks/useBookmarks';
import { useHighlights } from '../hooks/useHighlights';
import { useLesson } from '../hooks/useLesson';
import { useLessonAnimations } from '../hooks/useLessonAnimations';
import { useLessonNav } from '../hooks/useLessonNav';
import { useLessonSearch } from '../hooks/useLessonSearch';
import { useLessonSection } from '../hooks/useLessonSection';
import { useShortcuts } from '../hooks/useShortcuts';
import { useLessonStore as useSelectionStore } from '../stores/lessonStore';
import { useLessonViewStore } from '../stores/lessonViewStore';

interface Props {
  course: Course;
  module: ModuleMeta;
  initialSectionID?: string;
  initialSearchQuery?: string | null;
}

export default function LessonSection({
  course,
  module,
  initialSectionID,
  initialSearchQuery,
}: Props) {
  const { t } = useTranslation();

  const {
    isCompleted,
    completedCount,
    totalModules,
    toggle,
    showTools,
    showPomodoro,
    toggleTools,
    setSearchCourseOpen,
    focusMode,
    showSections,
    toggleSections,
  } = useLessonSection(course, module);

  const lessonData = useLesson(
    course.id,
    module.id,
    { isCompleted, completedCount, totalModules, toggle },
    initialSectionID,
  );

  const {
    content,
    h1,
    meta,
    bodyContent,
    loading,
    sections,
    isCompleted: optimisticIsCompleted,
    contentRef,
    scrollToSection,
    handleScroll,
    handleToggleCompleted,
  } = lessonData;

  const synced = useRef(false);
  if (!synced.current || content !== useLessonViewStore.getState().content) {
    useLessonViewStore.getState().set({
      content,
      sections,
      contentRef,
      scrollToSection,
    });
    synced.current = true;
  }

  useBookmarks(course.id, module.id, null);
  const { highlights } = useHighlights(course.id, module.id);
  const nav = useLessonNav(course, module);

  const search = useLessonSearch(contentRef, module.id, initialSearchQuery);

  const { showStudyTools, showSectionsPanel, showPomodoroTimer } = useLessonAnimations({
    showTools,
    focusMode,
    showSections,
    showPomodoro,
  });

  const handleRefreshHighlights = useCallback(() => {
    const hs = import('../stores/highlightsStore');
    void hs.then((m) => m.useHighlightsStore.getState().load(course.id, module.id));
  }, [course.id, module.id]);

  const showToolbar = useSelectionStore((s) => s.showToolbar);

  useShortcuts('lesson', {
    prevModule: () => {
      if (showToolbar) return;
      if (nav.hasPrev) nav.goPrev();
    },
    nextModule: () => {
      if (showToolbar) return;
      if (nav.hasNext) nav.goNext();
    },
    scrollUp: () => {
      if (showToolbar) return;
      contentRef.current?.scrollBy({ top: -80, behavior: 'smooth' });
    },
    scrollDown: () => {
      if (showToolbar) return;
      contentRef.current?.scrollBy({ top: 80, behavior: 'smooth' });
    },
    toggleSections: () => {
      if (showToolbar) return;
      toggleSections();
    },
    findInPage: () => search.setSearchActive(true),
    courseSearch: () => setSearchCourseOpen(true),
  });

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);
      if (absX > 40 && absX > absY * 1.5) {
        e.preventDefault();
        if (e.deltaX > 0 && nav.hasNext) nav.goNext();
        else if (e.deltaX < 0 && nav.hasPrev) nav.goPrev();
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [nav, contentRef]);

  const rehypePlugins = useMemo(
    () =>
      [
        rehypeHighlight,
        [rehypeHighlightText, highlights],
        ...(search.searchActive && search.searchQuery
          ? [[rehypeSearchText, search.searchQuery]]
          : []),
      ] as PluggableList,
    [highlights, search.searchActive, search.searchQuery],
  );

  if (loading)
    return <div className="p-8 text-center text-gray-400">{t('lesson.loadingLesson')}</div>;

  return (
    <div className="flex flex-1 overflow-hidden">
      {showStudyTools && (
        <div
          className={
            showTools && !focusMode ? 'anim-panel-slide-left' : 'anim-panel-slide-left-exit'
          }
        >
          <StudyTools onClose={() => toggleTools()} />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {!showSections && !focusMode && (
          <button
            onClick={toggleSections}
            className="fixed right-4 top-1/2 -translate-y-1/2 z-50 w-10 h-10 rounded-full bg-gray-800 border border-gray-700 shadow-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          >
            ☰
          </button>
        )}

        {showPomodoroTimer && (
          <div className={`relative h-0 z-40 ${showPomodoro ? 'anim-pop-in' : 'anim-pop-out'}`}>
            <div className="absolute left-4 top-2">
              <PomodoroTimer compact={focusMode} />
            </div>
          </div>
        )}

        {showSectionsPanel && (
          <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50 overflow-visible">
            <div
              className={
                showSections && !focusMode
                  ? 'anim-panel-slide-right'
                  : 'anim-panel-slide-right-exit'
              }
            >
              <SectionsPanel
                sections={sections}
                courseId={course.id}
                moduleId={module.id}
                moduleName={module.name}
                hasPrev={nav.hasPrev}
                hasNext={nav.hasNext}
                onGoPrev={nav.goPrev}
                onGoNext={nav.goNext}
                onScrollToSection={scrollToSection}
                onClose={toggleSections}
              />
            </div>
          </div>
        )}

        <LessonContentViewer
          courseId={course.id}
          moduleId={module.id}
          onRefreshHighlights={handleRefreshHighlights}
          contentRef={contentRef}
          h1={h1}
          meta={meta}
          bodyContent={bodyContent}
          handleScroll={handleScroll}
          isCompleted={optimisticIsCompleted}
          toggleCompleted={() => {
            void handleToggleCompleted();
          }}
          rehypePlugins={rehypePlugins}
          search={search}
        />
      </div>
    </div>
  );
}
