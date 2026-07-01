import { create } from 'zustand';

import type { Section } from '../../bun/types';

interface LessonViewState {
  content: string;
  sections: Section[];
  contentRef: React.RefObject<HTMLDivElement | null>;
  scrollToSection: (sectionId: string) => void;
  set: (v: Partial<LessonViewState>) => void;
}

export const useLessonViewStore = create<LessonViewState>((set) => ({
  content: '',
  sections: [],
  contentRef: { current: null } as React.RefObject<HTMLDivElement | null>,
  scrollToSection: () => {},
  set: (v) => set(v),
}));
