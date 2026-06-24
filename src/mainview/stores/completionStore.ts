import { create } from 'zustand';
import { api } from '../api';
import { logger } from '../logger';
import { showToast } from '../toast';

function key(courseId: string, moduleId: string | number) {
  return `${courseId}:${moduleId}`;
}

interface CompletionState {
  completed: Record<string, boolean>;
  counts: Record<string, number>;
  totalModules: Record<string, number>;
  loading: Record<string, boolean>;
  load(courseId: string, moduleId: string | number): Promise<void>;
  loadCourse(courseId: string): Promise<void>;
  toggle(courseId: string, moduleId: string | number): Promise<void>;
  get(courseId: string, moduleId: string | number): boolean;
  getProgress(courseId: string): { completed: number; total: number };
}

export const useCompletionStore = create<CompletionState>((set, get) => ({
  completed: {},
  counts: {},
  totalModules: {},
  loading: {},

  load: async (courseId, moduleId) => {
    const k = key(courseId, moduleId);
    try {
      const result = await api.storage.isCompleted(courseId, moduleId);
      set((s) => ({ completed: { ...s.completed, [k]: result.completed } }));
    } catch {
      showToast.error('toast.loadFailed');
    }
  },

  loadCourse: async (courseId) => {
    set((s) => ({ loading: { ...s.loading, [courseId]: true } }));
    try {
      const mods = await api.courses.modules(courseId);
      const count = await api.storage.completedCount(courseId);
      set((s) => ({
        totalModules: { ...s.totalModules, [courseId]: mods.length },
        counts: { ...s.counts, [courseId]: count.count },
      }));
    } catch {
      showToast.error('toast.loadFailed');
    } finally {
      set((s) => ({ loading: { ...s.loading, [courseId]: false } }));
    }
  },

  toggle: async (courseId, moduleId) => {
    const k = key(courseId, moduleId);
    try {
      const result = await api.storage.toggleCompleted(courseId, moduleId);
      set((s) => ({ completed: { ...s.completed, [k]: result.completed } }));
      const count = await api.storage.completedCount(courseId);
      set((s) => ({ counts: { ...s.counts, [courseId]: count.count } }));
      if (result.completed) {
        api.stats
          .logSession({
            courseID: courseId,
            moduleID: moduleId,
            durationMinutes: 10,
            type: 'reading',
          })
          .catch((err) => {
            logger.warn({ err }, 'Failed to log reading session');
          });
      }
    } catch {
      showToast.error('toast.loadFailed');
    }
  },

  get: (courseId, moduleId) => {
    return get().completed[key(courseId, moduleId)] ?? false;
  },

  getProgress: (courseId) => {
    return {
      completed: get().counts[courseId] ?? 0,
      total: get().totalModules[courseId] ?? 0,
    };
  },
}));
