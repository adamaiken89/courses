import { useCallback, useEffect } from 'react';

import type { Highlight } from '../../bun/types';
import { useHighlightsStore } from '../stores/highlightsStore';

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

export function useHighlights(courseId: string, moduleId: string): UseHighlightsReturn {
  const load = useHighlightsStore((s) => s.load);
  const add = useHighlightsStore((s) => s.add);
  const remove = useHighlightsStore((s) => s.remove);
  const loading = useHighlightsStore((s) => s.loading[`${courseId}:${moduleId}`] ?? false);

  useEffect(() => {
    void load(courseId, moduleId);
  }, [courseId, moduleId, load]);

  const k = `${courseId}:${moduleId}`;
  const highlights = useHighlightsStore((s) => s.byModule[k]) ?? [];

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
