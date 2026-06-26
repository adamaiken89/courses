import { useEffect, useMemo, useCallback } from 'react';
import { useHighlightsStore } from '../stores/highlightsStore';
import type { Highlight } from '../../bun/types';

interface UseHighlightsReturn {
  highlights: Highlight[];
  loading: boolean;
  addHighlight: (
    text: string,
    color: string,
    startOffset?: number,
    endOffset?: number,
  ) => Promise<void>;
  deleteHighlight: (id: string) => Promise<void>;
}

export function useHighlights(courseId: string, moduleId: string | number): UseHighlightsReturn {
  const load = useHighlightsStore((s) => s.load);
  const add = useHighlightsStore((s) => s.add);
  const remove = useHighlightsStore((s) => s.remove);
  const getForModule = useHighlightsStore((s) => s.getForModule);
  const loading = useHighlightsStore((s) => s.loading[`${courseId}:${moduleId}`] ?? false);

  useEffect(() => {
    load(courseId, moduleId);
  }, [courseId, moduleId, load]);

  const highlights = useMemo(
    () => getForModule(courseId, moduleId),
    [getForModule, courseId, moduleId],
  );

  const addHighlight = useCallback(
    async (text: string, color: string, startOffset?: number, endOffset?: number) => {
      await add(courseId, moduleId, text, color, startOffset, endOffset);
    },
    [add, courseId, moduleId],
  );

  const deleteHighlight = useCallback(
    async (id: string) => {
      await remove(id);
    },
    [remove],
  );

  return { highlights, loading, addHighlight, deleteHighlight };
}
