import { createContext, useContext } from 'react';
import type { RefObject } from 'react';
import type { Section } from '../../bun/types';

interface LessonContextValue {
  contentRef: RefObject<HTMLDivElement | null>;
  scrollToSection: (sectionId: string) => void;
  sections: Section[];
  visibleSection: string | null;
  content: string;
}

const LessonContext = createContext<LessonContextValue | null>(null);

export function useLessonContext(): LessonContextValue {
  const ctx = useContext(LessonContext);
  if (!ctx) throw new Error('useLessonContext must be used within LessonContextProvider');
  return ctx;
}

export default LessonContext;
