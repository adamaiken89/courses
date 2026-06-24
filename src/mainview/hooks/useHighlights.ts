import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { logger } from '../logger';
import { showToast } from '../toast';
import type { Highlight } from '../components/sidebar-types';

interface UseHighlightsReturn {
  highlights: Highlight[];
  loading: boolean;
  addHighlight: (text: string, color: string) => Promise<void>;
  deleteHighlight: (id: string) => Promise<void>;
}

export function useHighlights(courseId: string, moduleId: number): UseHighlightsReturn {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.storage
      .highlights(courseId, moduleId)
      .then(setHighlights)
      .catch((err) => {
        logger.warn({ err }, 'Failed to load highlights');
        showToast.error('toast.loadFailed');
        setHighlights([]);
      })
      .finally(() => setLoading(false));
  }, [courseId, moduleId]);

  const addHighlight = useCallback(
    async (text: string, color: string) => {
      const highlight = await api.storage.addHighlight({
        courseID: courseId,
        moduleID: moduleId,
        selectedText: text,
        startOffset: 0,
        endOffset: 0,
        color,
      });
      setHighlights((prev) => [...prev, highlight]);
    },
    [courseId, moduleId],
  );

  const deleteHighlight = useCallback(async (id: string) => {
    await api.storage.deleteHighlight(id);
    setHighlights((prev) => prev.filter((h) => h.id !== id));
  }, []);

  return { highlights, loading, addHighlight, deleteHighlight };
}
