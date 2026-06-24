import { create } from 'zustand';
import type { Course, ModuleMeta } from '../../bun/types';

export type View =
  | { type: 'courseList' }
  | { type: 'moduleList'; course: Course }
  | { type: 'lesson'; course: Course; module: ModuleMeta; sectionID?: string }
  | { type: 'quiz'; course: Course; module: ModuleMeta }
  | { type: 'review'; course: Course }
  | { type: 'userCardReview'; course: Course }
  | { type: 'settings' }
  | { type: 'bookmarks' }
  | { type: 'dashboard'; courseID?: string };

interface ViewState {
  views: View[];
  push: (view: View) => void;
  pop: () => void;
  popToRoot: () => void;
  replace: (view: View) => void;
}

export const useViewStore = create<ViewState>((set) => ({
  views: [] as View[],
  push: (view) => set((s) => ({ views: [...s.views, view] })),
  pop: () => set((s) => ({ views: s.views.slice(0, -1) })),
  popToRoot: () => set({ views: [] as View[] }),
  replace: (view) => set((s) => ({ views: [...s.views.slice(0, -1), view] })),
}));
