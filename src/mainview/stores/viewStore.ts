import { create } from "zustand";
import type { Subject, ModuleMeta } from "../../bun/types";

export type View =
  | { type: "landing" }
  | { type: "subjectList" }
  | { type: "moduleList"; subject: Subject }
  | { type: "lesson"; subject: Subject; module: ModuleMeta; sectionID?: string }
  | { type: "quiz"; subject: Subject; module: ModuleMeta }
  | { type: "review"; subject: Subject }
  | { type: "settings" }
  | { type: "bookmarks" };

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
