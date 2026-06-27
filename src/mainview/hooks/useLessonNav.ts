import { useCallback } from 'react';
import { useViewStore } from '../stores/viewStore';
import type { Course, ModuleMeta } from '../../bun/types';

interface UseLessonNavReturn {
  hasPrev: boolean;
  hasNext: boolean;
  goPrev: () => void;
  goNext: () => void;
}

export function useLessonNav(course: Course, module: ModuleMeta): UseLessonNavReturn {
  const push = useViewStore((s) => s.push);

  const currentIdx = course.modules.findIndex((m) => m.id === module.id);
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < course.modules.length - 1;

  const goPrev = useCallback(() => {
    if (hasPrev) push({ type: 'lesson', course, module: course.modules[currentIdx - 1] });
  }, [hasPrev, course, currentIdx, push]);

  const goNext = useCallback(() => {
    if (hasNext) push({ type: 'lesson', course, module: course.modules[currentIdx + 1] });
  }, [hasNext, course, currentIdx, push]);

  return { hasPrev, hasNext, goPrev, goNext };
}
