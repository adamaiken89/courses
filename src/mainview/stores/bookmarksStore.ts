import { create } from 'zustand';

import type { Bookmark } from '../../bun/types';
import { api } from '../api';
import { showToast } from '../toast';

function key(courseId: string, moduleId: string) {
  return `${courseId}:${moduleId}`;
}

interface BookmarksState {
  byModule: Record<string, Bookmark[]>;
  loading: Record<string, boolean>;
  load(courseId: string, moduleId: string): Promise<void>;
  toggle(
    courseId: string,
    moduleId: string,
    title: string,
    sectionID: string | null,
  ): Promise<void>;
  remove(id: string): Promise<void>;
  getForModule(courseId: string, moduleId: string): Bookmark[];
  getActive(courseId: string, moduleId: string, sectionID: string | null): Bookmark | undefined;
}

export const useBookmarksStore = create<BookmarksState>((set, get) => ({
  byModule: {},
  loading: {},

  load: async (courseId, moduleId) => {
    const k = key(courseId, moduleId);
    set((s) => ({ loading: { ...s.loading, [k]: true } }));
    try {
      const bookmarks = await api.storage.moduleBookmarks(courseId, moduleId);
      set((s) => ({ byModule: { ...s.byModule, [k]: bookmarks } }));
    } catch {
      showToast.error('toast.loadFailed');
      set((s) => ({ byModule: { ...s.byModule, [k]: [] } }));
    } finally {
      set((s) => ({ loading: { ...s.loading, [k]: false } }));
    }
  },

  toggle: async (courseId, moduleId, title, sectionID) => {
    const k = key(courseId, moduleId);
    const existing = sectionID
      ? get().byModule[k]?.find((b) => b.sectionID === sectionID)
      : get().byModule[k]?.find((b) => !b.sectionID);
    if (existing) {
      await api.storage.deleteBookmark(existing.id);
      set((s) => ({
        byModule: { ...s.byModule, [k]: s.byModule[k]?.filter((b) => b.id !== existing.id) ?? [] },
      }));
    } else {
      const bookmark = await api.storage.addBookmark({
        courseID: courseId,
        moduleID: moduleId,
        title,
        sectionID: sectionID ?? undefined,
        scrollPosition: 0,
      });
      set((s) => ({
        byModule: { ...s.byModule, [k]: [...(s.byModule[k] ?? []), bookmark] },
      }));
    }
  },

  remove: async (id) => {
    await api.storage.deleteBookmark(id);
    set((s) => {
      const byModule = { ...s.byModule };
      for (const k of Object.keys(byModule)) {
        byModule[k] = byModule[k].filter((b) => b.id !== id);
      }
      return { byModule };
    });
  },

  getForModule: (courseId, moduleId) => {
    return get().byModule[key(courseId, moduleId)] ?? [];
  },

  getActive: (courseId, moduleId, sectionID) => {
    const bookmarks = get().byModule[key(courseId, moduleId)] ?? [];
    return sectionID
      ? bookmarks.find((b) => b.sectionID === sectionID)
      : bookmarks.find((b) => !b.sectionID);
  },
}));
