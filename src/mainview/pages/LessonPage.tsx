import { useState, useCallback, useEffect } from 'react';
import LessonSection from '../sections/LessonSection';
import ModuleSwitcher from '../components/ModuleSwitcher';
import LessonToolbar from '../components/lesson/LessonToolbar';
import SearchOverlay from '../components/SearchOverlay';
import PageLayout from '../layouts/PageLayout';
import PageHeader from '../layouts/PageHeader';
import PageContent from '../layouts/PageContent';
import { useCourseStore } from '../stores/courseStore';
import { useLessonUIStore } from '../stores/lessonUIStore';
import type { Course, ModuleMeta } from '../../bun/types';

interface LessonFeatureProps {
  course: Course;
  module: ModuleMeta;
  initialSectionID?: string;
  onBack: () => void;
  onSelectModule: (m: ModuleMeta) => void;
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
  const [pendingSearchQuery, setPendingSearchQuery] = useState<string | null>(null);

  useEffect(() => {
    setPendingSearchQuery(null);
  }, [module.id]);

  const handleSearchNavigate = useCallback(
    (courseID: string, moduleID: string | number, query?: string) => {
      const c = courses.find((x) => x.id === courseID);
      const m = c?.modules.find((x) => x.id === moduleID);
      if (c && m) {
        setPendingSearchQuery(query || null);
        onSelectModule(m);
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
        <LessonSection
          course={course}
          module={module}
          initialSectionID={initialSectionID}
          initialSearchQuery={pendingSearchQuery}
        />
      </PageContent>
      {searchCourseOpen && (
        <SearchOverlay
          initialCourseID={course.id}
          initialCourseName={course.displayName}
          onClose={() => setSearchCourseOpen(false)}
          onNavigate={handleSearchNavigate}
        />
      )}
    </PageLayout>
  );
}
