import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { Course, ModuleMeta } from '../../bun/types';
import { countCompleted, useCompletionStore } from '../stores/completionStore';
import { useLessonStore } from '../stores/lessonStore';
import { useSettingsStore } from '../stores/settingsStore';

export function useLessonSection(course: Course, module: ModuleMeta) {
  const storeKey = `${course.id}:${module.id}`;
  const isCompleted = useCompletionStore((s) => s.completed[storeKey] ?? false);
  const completedCount = useCompletionStore((s) => countCompleted(s.completed, course.id));
  const totalModules = useCompletionStore((s) => s.totalModules[course.id] ?? 0);
  const {
    toggle,
    load: loadCompletion,
    loadCourse: loadCourseCompletion,
  } = useCompletionStore(
    useShallow((s) => ({ toggle: s.toggle, load: s.load, loadCourse: s.loadCourse })),
  );

  const { showTools, showPomodoro, toggleTools, setSearchCourseOpen } = useLessonStore(
    useShallow((s) => ({
      showTools: s.showTools,
      showPomodoro: s.showPomodoro,
      toggleTools: s.toggleTools,
      setSearchCourseOpen: s.setSearchCourseOpen,
    })),
  );

  const { focusMode, showSections, toggleSections } = useSettingsStore(
    useShallow((s) => ({
      focusMode: s.focusMode,
      showSections: s.showSections,
      toggleSections: s.toggleSections,
    })),
  );

  useEffect(() => {
    void loadCompletion(course.id, module.id);
    void loadCourseCompletion(course.id);
  }, [course.id, module.id, loadCompletion, loadCourseCompletion]);

  return {
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
  };
}
