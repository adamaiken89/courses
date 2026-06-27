import { create } from 'zustand';

interface LessonUIState {
  showTools: boolean;
  showPomodoro: boolean;
  searchCourseOpen: boolean;
  toggleTools: () => void;
  togglePomodoro: () => void;
  setSearchCourseOpen: (v: boolean) => void;
}

export const useLessonUIStore = create<LessonUIState>((set) => ({
  showTools: false,
  showPomodoro: false,
  searchCourseOpen: false,
  toggleTools: () => set((s) => ({ showTools: !s.showTools })),
  togglePomodoro: () => set((s) => ({ showPomodoro: !s.showPomodoro })),
  setSearchCourseOpen: (v) => set({ searchCourseOpen: v }),
}));
