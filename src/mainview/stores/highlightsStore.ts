import { create } from 'zustand';
import { api } from '../api';
import { showToast } from '../toast';
import type { Highlight } from '../components/sidebar-types';

function key(courseId: string, moduleId: string | number) {
  return `${courseId}:${moduleId}`;
}

interface HighlightsState {
  byModule: Record<string, Highlight[]>;
  loading: Record<string, boolean>;
  load(courseId: string, moduleId: string | number): Promise<void>;
  add(courseId: string, moduleId: string | number, text: string, color: string): Promise<void>;
  remove(id: string): Promise<void>;
  getForModule(courseId: string, moduleId: string | number): Highlight[];
}

export const useHighlightsStore = create<HighlightsState>((set, get) => ({
  byModule: {},
  loading: {},

  load: async (courseId, moduleId) => {
    const k = key(courseId, moduleId);
    set((s) => ({ loading: { ...s.loading, [k]: true } }));
    try {
      const highlights = await api.storage.highlights(courseId, moduleId);
      set((s) => ({ byModule: { ...s.byModule, [k]: highlights } }));
    } catch {
      showToast.error('toast.loadFailed');
      set((s) => ({ byModule: { ...s.byModule, [k]: [] } }));
    } finally {
      set((s) => ({ loading: { ...s.loading, [k]: false } }));
    }
  },

  add: async (courseId, moduleId, text, color) => {
    const highlight = await api.storage.addHighlight({
      courseID: courseId,
      moduleID: moduleId,
      selectedText: text,
      startOffset: 0,
      endOffset: 0,
      color,
    });
    const k = key(courseId, moduleId);
    set((s) => ({
      byModule: { ...s.byModule, [k]: [...(s.byModule[k] ?? []), highlight] },
    }));
  },

  remove: async (id) => {
    await api.storage.deleteHighlight(id);
    set((s) => {
      const byModule = { ...s.byModule };
      for (const k of Object.keys(byModule)) {
        byModule[k] = byModule[k].filter((h) => h.id !== id);
      }
      return { byModule };
    });
  },

  getForModule: (courseId, moduleId) => {
    return get().byModule[key(courseId, moduleId)] ?? [];
  },
}));
