import { useEffect } from 'react';

import type { Note } from '../../bun/types';
import { useNotesStore } from '../stores/notesStore';

interface UseNotesReturn {
  notes: Note[];
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useNotes(courseId: string, moduleId: string): UseNotesReturn {
  const load = useNotesStore((s) => s.load);
  const loading = useNotesStore((s) => s.loading[`${courseId}:${moduleId}`] ?? false);

  useEffect(() => {
    void load(courseId, moduleId);
  }, [courseId, moduleId, load]);

  const k = `${courseId}:${moduleId}`;
  const notes = useNotesStore((s) => s.byModule[k]) ?? [];

  return { notes, loading, refresh: () => load(courseId, moduleId) };
}
