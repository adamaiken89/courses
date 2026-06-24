import { create } from 'zustand';
import { api } from '../api';
import { logger } from '../logger';
import { showToast } from '../toast';
import type { Course } from '../../bun/types';

interface CourseState {
  courses: Course[];
  progress: Record<string, number>;
  loading: boolean;
  error: string | null;
  loaded: boolean;
  load: () => void;
  reset: () => void;
}

export const useCourseStore = create<CourseState>((set, get) => ({
  courses: [],
  progress: {},
  loading: false,
  error: null,
  loaded: false,
  load: () => {
    if (get().loaded) return;
    logger.debug('Loading courses');
    set({ loading: true, error: null });
    api.courses
      .list()
      .then(async (courses) => {
        logger.info({ count: courses.length }, 'Courses loaded');
        const progressEntries = await Promise.all(
          courses.map(async (c) => {
            try {
              const { count } = await api.storage.completedCount(c.id);
              return [c.id, count] as const;
            } catch {
              return [c.id, 0] as const;
            }
          }),
        );
        const progress = Object.fromEntries(progressEntries);
        set({ courses, progress, loading: false, loaded: true });
      })
      .catch((e: Error) => {
        logger.error({ err: e.message }, 'Failed to load courses');
        showToast.error('toast.loadFailed');
        set({ error: e.message, loading: false });
      });
  },
  reset: () => set({ courses: [], progress: {}, loading: false, error: null, loaded: false }),
}));
