import type { Course, ModuleMeta } from '../../bun/types';
import { useViewStore } from '../stores/viewStore';

export function useCurrentLesson(): { course: Course | null; module: ModuleMeta | null } {
  const views = useViewStore((s) => s.views);
  const lastView = views[views.length - 1];
  if (lastView?.type === 'lesson') {
    return { course: lastView.course, module: lastView.module };
  }
  return { course: null, module: null };
}
