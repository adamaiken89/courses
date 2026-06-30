import { useCallback, useEffect, useRef, useState } from 'react';

import type { Course, ModuleMeta } from '../../bun/types';
import LessonToolbar from '../components/lesson/LessonToolbar';
import ModuleSwitcher from '../components/ModuleSwitcher';
import SearchOverlay from '../components/SearchOverlay';
import PageContent from '../layouts/PageContent';
import PageHeader from '../layouts/PageHeader';
import PageLayout from '../layouts/PageLayout';
import LessonSection from '../sections/LessonSection';
import { useCourseStore } from '../stores/courseStore';
import { useLessonUIStore } from '../stores/lessonUIStore';
import { useSettingsStore } from '../stores/settingsStore';

interface LessonFeatureProps {
  course: Course;
  module: ModuleMeta;
  initialSectionID?: string;
  onBack: () => void;
  onSelectModule: (m: ModuleMeta, sectionID?: string) => void;
}

export default function LessonFeature({
  course,
  module,
  initialSectionID,
  onBack,
  onSelectModule,
}: LessonFeatureProps) {
  const courses = useCourseStore((s) => s.courses);
  const searchCourseOpen = useLessonUIStore((s) => s.searchCourseOpen);
  const setSearchCourseOpen = useLessonUIStore((s) => s.setSearchCourseOpen);
  const transitionStyle = useSettingsStore((s) => s.transitionStyle);
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
