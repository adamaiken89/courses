import { useState, useEffect, useCallback, useRef, useOptimistic } from 'react';
import { api } from '../api';
import { logger } from '../logger';
import { showToast } from '../toast';
import type { Section } from '../components/sidebar-types';

type DivRef = React.RefObject<HTMLDivElement>;

interface UseLessonReturn {
  content: string;
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

export function useLesson(
  courseId: string,
  moduleId: number,
  initialSectionID?: string,
): UseLessonReturn {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<Section[]>([]);
  const [visibleSection, setVisibleSection] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [optimisticIsCompleted, toggleOptimistic] = useOptimistic<boolean, 1>(
    isCompleted,
    (state) => !state,
  );
  const [totalModules, setTotalModules] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null) as DivRef;

  const scrollToSection = useCallback((sectionId: string) => {
    const container = contentRef.current;
    if (!container) return;
    const el = container.querySelector(`[id="${sectionId}"]`);
    if (!el) return;
    const offset =
      el.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop -
      20;
    container.scrollTop = offset;
    container.focus();
  }, []);

  const handleScroll = useCallback(() => {
    if (!contentRef.current || sections.length === 0) return;
    const el = contentRef.current;
    const headings = el.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let currentId: string | null = null;
    headings.forEach((h) => {
      const rect = h.getBoundingClientRect();
      if (rect.top < 150) currentId = h.id;
    });
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 80;
    if (atBottom && sections.length > 0) {
      currentId = sections[sections.length - 1].id;
    }
    setVisibleSection(currentId);
  }, [sections]);

  const handleToggleCompleted = useCallback(async () => {
    toggleOptimistic(1);
    const result = await api.storage.toggleCompleted(courseId, moduleId);
    setIsCompleted(result.completed);
    const count = await api.storage.completedCount(courseId);
    setCompletedCount(count.count);
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
  }, [courseId, moduleId, toggleOptimistic]);

  useEffect(() => {
    setLoading(true);
    contentRef.current?.scrollTo(0, 0);
    api.courses
      .lesson(courseId, moduleId)
      .then((lesson) => {
        setContent(lesson.content);
        setLoading(false);
        requestAnimationFrame(() => contentRef.current?.focus());
      })
      .catch((err) => {
        logger.warn({ err }, 'Failed to load lesson');
        showToast.error('toast.loadFailed');
        setLoading(false);
      });
    api.courses
      .sections(courseId, moduleId)
      .then(setSections)
      .catch((err) => {
        logger.warn({ err }, 'Failed to load sections');
        showToast.error('toast.loadFailed');
      });
    api.storage
      .isCompleted(courseId, moduleId)
      .then((r) => setIsCompleted(r.completed))
      .catch((err) => {
        logger.warn({ err }, 'Failed to check completion');
        showToast.error('toast.loadFailed');
      });
    api.courses
      .modules(courseId)
      .then((mods) => {
        setTotalModules(mods.length);
        api.storage
          .completedCount(courseId)
          .then((r) => setCompletedCount(r.count))
          .catch((err) => {
            logger.warn({ err }, 'Failed to get completed count');
          });
      })
      .catch((err) => {
        logger.warn({ err }, 'Failed to load modules');
        showToast.error('toast.loadFailed');
      });
  }, [courseId, moduleId]);

  useEffect(() => {
    if (initialSectionID && content) {
      requestAnimationFrame(() => {
        scrollToSection(initialSectionID);
      });
    }
  }, [initialSectionID, content, scrollToSection]);

  return {
    content,
    loading,
    sections,
    visibleSection,
    isCompleted: optimisticIsCompleted,
    totalModules,
    completedCount,
    contentRef,
    setVisibleSection,
    scrollToSection,
    handleScroll,
    handleToggleCompleted,
  };
}
