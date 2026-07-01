import { useCallback, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { Course, ModuleMeta } from '../../bun/types';
import LessonToolbar from '../components/lesson/LessonToolbar';
import ModuleSwitcher from '../components/ModuleSwitcher';
import SearchOverlay from '../components/SearchOverlay';
import { useShortcuts } from '../hooks/useShortcuts';
import PageContent from '../layouts/PageContent';
import PageHeader from '../layouts/PageHeader';
import PageLayout from '../layouts/PageLayout';
import LessonSection from '../sections/LessonSection';
import { useBookmarksStore } from '../stores/bookmarksStore';
import { useCourseStore } from '../stores/courseStore';
import { useLessonStore } from '../stores/lessonStore';
import type { TransitionStyle } from '../stores/settingsStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useViewStore } from '../stores/viewStore';

interface LessonFeatureProps {
  course: Course;
  module: ModuleMeta;
  initialSectionID?: string;
  onBack: () => void;
  onSelectModule: (m: ModuleMeta, sectionID?: string) => void;
}

export default function LessonPage({
  course,
  module,
  initialSectionID,
  onBack,
  onSelectModule,
}: LessonFeatureProps) {
  const courses = useCourseStore((s) => s.courses);
  const searchCourseOpen = useLessonStore((s) => s.searchCourseOpen);
  const setSearchCourseOpen = useLessonStore((s) => s.setSearchCourseOpen);
  const push = useViewStore((s) => s.push);
  const {
    toggleFocusMode,
    incFontSize,
    decFontSize,
    cycleTheme,
    contentWidth,
    setContentWidth,
    transitionStyle,
    setTransitionStyle,
  } = useSettingsStore(
    useShallow((s) => ({
      toggleFocusMode: s.toggleFocusMode,
      incFontSize: s.incFontSize,
      decFontSize: s.decFontSize,
      cycleTheme: s.cycleTheme,
      contentWidth: s.contentWidth,
      setContentWidth: s.setContentWidth,
      transitionStyle: s.transitionStyle,
      setTransitionStyle: s.setTransitionStyle,
    })),
  );
  const { toggleTools, togglePomodoro } = useLessonStore(
    useShallow((s) => ({
      toggleTools: s.toggleTools,
      togglePomodoro: s.togglePomodoro,
    })),
  );

  const cycleTransition = useCallback(() => {
    const order: TransitionStyle[] = ['none', 'flip', 'slide', 'fade'];
    const next = order[(order.indexOf(transitionStyle) + 1) % order.length];
    setTransitionStyle(next);
  }, [transitionStyle, setTransitionStyle]);

  useShortcuts('lessonToolbar', {
    decFontSize,
    incFontSize,
    cycleTheme,
    toggleWidth: () => {
      const order: Array<'narrow' | 'standard' | 'wide'> = ['narrow', 'standard', 'wide'];
      const next = order[(order.indexOf(contentWidth) + 1) % order.length];
      setContentWidth(next);
    },
    bookmark: () => {
      if (!course || !module) return;
      const k = `${course.id}:${module.id}`;
      const bm = useBookmarksStore.getState().byModule[k] ?? [];
      const existing = bm.find((b) => !b.sectionID);
      if (existing) {
        void useBookmarksStore.getState().remove(existing.id);
      } else {
        void useBookmarksStore.getState().toggle(course.id, module.id, module.name, null);
      }
    },
    focusMode: toggleFocusMode,
    pomodoro: togglePomodoro,
    tools: toggleTools,
    reviewCards: () => {
      if (!course) return;
      const found = courses.find((c) => c.id === course.id);
      if (found) push({ type: 'userCardReview', course: found });
    },
    quiz: () => {
      if (!course || !module) return;
      push({ type: 'quiz', course, module });
    },
    review: () => {
      if (!course) return;
      push({ type: 'review', course });
    },
    cycleTransition: () => cycleTransition(),
  });

  const [pendingSearchQuery, setPendingSearchQuery] = useState<string | null>(null);
  const [animClass, setAnimClass] = useState('');
  const [contentKey, setContentKey] = useState(0);
  const prevModuleRef = useRef(module);

  useEffect(() => {
    const prev = prevModuleRef.current;
    prevModuleRef.current = module;
    if (transitionStyle === 'none' || !prev || prev.id === module.id) return;

    const prevIdx = course.modules.findIndex((m) => m.id === prev.id);
    const currIdx = course.modules.findIndex((m) => m.id === module.id);
    const direction = prevIdx === -1 || currIdx >= prevIdx ? 'forward' : 'back';

    const classMap: Record<string, { forward: string; back: string }> = {
      fade: { forward: 'anim-fade', back: 'anim-fade' },
      slide: { forward: 'anim-slide-right', back: 'anim-slide-left' },
      flip: { forward: 'anim-flip', back: 'anim-flip' },
    };

    const cls = classMap[transitionStyle]?.[direction] ?? '';
    if (!cls) return;

    setContentKey((k) => k + 1);
    setAnimClass(cls);
    const timer = setTimeout(() => setAnimClass(''), 500);
    return () => clearTimeout(timer);
  }, [module, course.modules, transitionStyle]);

  useEffect(() => {
    setPendingSearchQuery(null);
  }, [module.id]);

  const handleSearchNavigate = useCallback(
    (courseID: string, moduleID: string, query?: string, sectionID?: string) => {
      const c = courses.find((x) => x.id === courseID);
      const m = c?.modules.find((x) => x.id === moduleID);
      if (c && m) {
        setPendingSearchQuery(query ?? null);
        onSelectModule(m, sectionID);
      }
    },
    [courses, onSelectModule],
  );

  return (
    <PageLayout>
      <PageHeader
        onBack={onBack}
        backLabel={course.displayName}
        center={
          <ModuleSwitcher
            modules={course.modules}
            currentModuleId={module.id}
            onSelect={onSelectModule}
          />
        }
        toolbar={<LessonToolbar />}
      />
      <PageContent className="px-0 py-0">
        <div key={contentKey} className={`flex flex-col ${animClass || ''}`}>
          <LessonSection
            course={course}
            module={module}
            initialSectionID={initialSectionID}
            initialSearchQuery={pendingSearchQuery}
          />
        </div>
      </PageContent>
      {searchCourseOpen && (
        <SearchOverlay
          initialCourseIDs={[course.id]}
          initialCourseNames={[course.displayName]}
          onClose={() => setSearchCourseOpen(false)}
          onNavigate={handleSearchNavigate}
        />
      )}
    </PageLayout>
  );
}
