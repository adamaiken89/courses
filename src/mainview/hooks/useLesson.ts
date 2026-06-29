import { startTransition, useCallback, useEffect, useOptimistic, useRef, useState } from 'react';

import type { MetaField } from '../../bun/lesson-markdown';
import type { Section } from '../../bun/types';
import { api } from '../api';
import { logger } from '../logger';
import { showToast } from '../toast';

type DivRef = React.RefObject<HTMLDivElement>;

const SCROLL_OFFSET = 120;

export function findVisibleHeading(container: HTMLElement, sections: Section[]): string | null {
  if (sections.length === 0) return null;

  const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
  if (headings.length === 0) return null;

  const containerRect = container.getBoundingClientRect();
  const threshold = containerRect.top + SCROLL_OFFSET;

  let bestId: string | null = null;

  for (const h of headings) {
    if (h.getBoundingClientRect().top <= threshold) {
      bestId = h.id;
    }
  }

  return bestId;
}

interface UseLessonReturn {
  content: string;
  h1: string;
  meta: MetaField[];
  bodyContent: string;
  loading: boolean;
  sections: Section[];
  visibleSection: string | null;
  isCompleted: boolean;
  totalModules: number;
  completedCount: number;
  contentRef: DivRef;
  setVisibleSection: (id: string | null) => void;
  scrollToSection: (sectionId: string) => void;
  handleScroll: () => void;
  handleToggleCompleted: () => Promise<void>;
}

interface UseLessonCompletion {
  isCompleted: boolean;
  completedCount: number;
  totalModules: number;
  toggle: (courseId: string, moduleId: string) => Promise<void>;
}

export function useLesson(
  courseId: string,
  moduleId: string,
  completion: UseLessonCompletion,
  initialSectionID?: string,
): UseLessonReturn {
  const [content, setContent] = useState('');
  const [h1, setH1] = useState('');
  const [meta, setMeta] = useState<MetaField[]>([]);
  const [bodyContent, setBodyContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<Section[]>([]);
  const [visibleSection, setVisibleSection] = useState<string | null>(initialSectionID ?? null);

  const [optimisticIsCompleted, toggleOptimistic] = useOptimistic<boolean, 1>(
    completion.isCompleted,
    (state) => !state,
  );

  const contentRef = useRef<HTMLDivElement>(null) as DivRef;
  const sectionsRef = useRef<Section[]>([]);

  sectionsRef.current = sections;

  const scrollToSection = useCallback((sectionId: string) => {
    const container = contentRef.current;
    if (!container) {
      logger.debug({ sectionId }, 'scrollToSection: no container');
      return;
    }
    const el = container.querySelector(`[id="${sectionId}"]`);
    if (!el) {
      const ids = Array.from(container.querySelectorAll('h1,h2,h3,h4,h5,h6')).map((h) => h.id);
      logger.debug({ sectionId, ids }, 'scrollToSection: element not found');
      return;
    }
    const offset =
      el.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop -
      20;
    logger.debug({ sectionId, offset }, 'scrollToSection: scrolling');
    container.scrollTop = offset;
    container.focus();
  }, []);

  const handleScroll = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const id = findVisibleHeading(el, sectionsRef.current);
    setVisibleSection(id);
    logger.debug({ id, sectionsCount: sectionsRef.current.length }, 'handleScroll');
  }, []);

  const { toggle } = completion;

  const handleToggleCompleted = useCallback(async () => {
    startTransition(() => {
      toggleOptimistic(1);
    });
    await toggle(courseId, moduleId);
  }, [courseId, moduleId, toggle, toggleOptimistic]);

  useEffect(() => {
    setLoading(true);
    contentRef.current?.scrollTo(0, 0);
    api.courses
      .lesson(courseId, moduleId)
      .then((lesson) => {
        setContent(lesson.content);
        setH1(lesson.h1);
        setMeta(lesson.meta);
        setBodyContent(lesson.bodyContent);
        setSections(lesson.sections);
        setLoading(false);
        requestAnimationFrame(() => {
          contentRef.current?.focus();
          handleScroll();
        });
      })
      .catch((err) => {
        logger.warn({ err }, 'Failed to load lesson');
        showToast.error('toast.loadFailed');
        setLoading(false);
      });
  }, [courseId, moduleId, handleScroll]);

  useEffect(() => {
    if (initialSectionID && content) {
      requestAnimationFrame(() => {
        scrollToSection(initialSectionID);
      });
    }
  }, [initialSectionID, content, scrollToSection]);

  return {
    content,
    h1,
    meta,
    bodyContent,
    loading,
    sections,
    visibleSection,
    isCompleted: optimisticIsCompleted,
    totalModules: completion.totalModules,
    completedCount: completion.completedCount,
    contentRef,
    setVisibleSection,
    scrollToSection,
    handleScroll,
    handleToggleCompleted,
  };
}
