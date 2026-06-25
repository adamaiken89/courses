import { useState } from 'react';
import LessonSection from '../sections/LessonSection';
import ModuleSwitcher from '../components/ModuleSwitcher';
import LessonToolbar from '../components/lesson/LessonToolbar';
import PageLayout from '../layouts/PageLayout';
import PageHeader from '../layouts/PageHeader';
import PageContent from '../layouts/PageContent';
import { useBookmarks } from '../hooks/useBookmarks';
import { useHighlights } from '../hooks/useHighlights';
import { useLesson } from '../hooks/useLesson';
import { useSettingsStore } from '../stores/settingsStore';
import { useViewStore } from '../stores/viewStore';
import { useCourseStore } from '../stores/courseStore';
import type { Course, ModuleMeta } from '../../bun/types';

interface LessonFeatureProps {
  course: Course;
  module: ModuleMeta;
  initialSectionID?: string;
  onBack: () => void;
  onSelectModule: (m: ModuleMeta) => void;
  onStartQuiz: () => void;
  onStartReview: () => void;
}

export default function LessonFeature({
  course,
  module,
  initialSectionID,
  onBack,
  onSelectModule,
  onStartQuiz,
  onStartReview,
}: LessonFeatureProps) {
  const push = useViewStore((s) => s.push);
  const courses = useCourseStore((s) => s.courses);
  const [showTools, setShowTools] = useState(false);
  const [showPomodoro, setShowPomodoro] = useState(false);
  const currentIdx = course.modules.findIndex((m) => m.id === module.id);
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < course.modules.length - 1;

  const {
    content,
    loading,
    sections,
    visibleSection,
    isCompleted,
    completedCount,
    totalModules,
    contentRef,
    scrollToSection,
    handleScroll,
    handleToggleCompleted,
  } = useLesson(course.id, module.id, initialSectionID);

  const {
    bookmarks,
    handleToggleBookmark: toggleBookmark,
    hasActiveBookmark,
  } = useBookmarks(course.id, module.id, visibleSection);

  const { highlights, addHighlight } = useHighlights(course.id, module.id);

  const handleToggleBookmark = () => {
    const title = visibleSection
      ? `${module.name} – ${sections.find((s) => s.id === visibleSection)?.heading}`
      : module.name;
    toggleBookmark(title, visibleSection);
  };

  const handleReviewCards = () => {
    const found = courses.find((c) => c.id === course.id);
    if (found) push({ type: 'userCardReview', course: found });
  };

  const showSections = useSettingsStore((s) => s.showSections);
  const toggleSections = useSettingsStore((s) => s.toggleSections);

  const toolbar = (
    <LessonToolbar
      showTools={showTools}
      showPomodoro={showPomodoro}
      hasActiveBookmark={hasActiveBookmark}
      completedCount={completedCount}
      totalModules={totalModules}
      onToggleBookmark={handleToggleBookmark}
      onToggleTools={() => setShowTools(!showTools)}
      onTogglePomodoro={() => setShowPomodoro(!showPomodoro)}
      onReviewCards={handleReviewCards}
      onStartQuiz={onStartQuiz}
      onStartReview={onStartReview}
    />
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
        toolbar={toolbar}
      />
      <PageContent className="px-0 py-0">
        <LessonSection
          courseId={course.id}
          courseName={course.displayName}
          module={module}
          content={content}
          loading={loading}
          sections={sections}
          visibleSection={visibleSection}
          isCompleted={isCompleted}
          contentRef={contentRef}
          scrollToSection={scrollToSection}
          handleScroll={handleScroll}
          handleToggleCompleted={handleToggleCompleted}
          bookmarks={bookmarks}
          highlights={highlights}
          addHighlight={addHighlight}
          hasPrevModule={hasPrev}
          hasNextModule={hasNext}
          onPrevModule={hasPrev ? () => onSelectModule(course.modules[currentIdx - 1]) : undefined}
          onNextModule={hasNext ? () => onSelectModule(course.modules[currentIdx + 1]) : undefined}
          showTools={showTools}
          showPomodoro={showPomodoro}
          setShowTools={setShowTools}
          showSections={showSections}
          onToggleSections={toggleSections}
          onToggleBookmark={toggleBookmark}
        />
      </PageContent>
    </PageLayout>
  );
}
