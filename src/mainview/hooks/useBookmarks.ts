import { useState, useEffect, useCallback, useOptimistic } from 'react';
import { api } from '../api';
import { logger } from '../logger';
import { showToast } from '../toast';
import type { Bookmark } from '../components/sidebar-types';

type OptimisticAction = { type: 'add'; bookmark: Bookmark } | { type: 'delete'; id: string };

interface UseBookmarksReturn {
  bookmarks: Bookmark[];
  loading: boolean;
  handleToggleBookmark: (title: string, sectionID: string | null) => Promise<void>;
  handleDeleteBookmark: (id: string) => Promise<void>;
  sectionBookmark: Bookmark | undefined;
  moduleBookmark: Bookmark | undefined;
  hasActiveBookmark: boolean;
  activeBookmarkId: string | undefined;
}

export function useBookmarks(
  courseId: string,
  moduleId: number,
  visibleSection: string | null,
): UseBookmarksReturn {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);

  const [optimisticBookmarks, addOptimistic] = useOptimistic(
    bookmarks,
    (state, action: OptimisticAction) => {
      if (action.type === 'delete') {
        return state.filter((b) => b.id !== action.id);
      }
      if (action.type === 'add') {
        return state.some(
          (b) =>
            b.moduleID === action.bookmark.moduleID && b.sectionID === action.bookmark.sectionID,
        )
          ? state
          : [...state, action.bookmark];
      }
      return state;
    },
  );

  useEffect(() => {
    setLoading(true);
    api.storage
      .moduleBookmarks(courseId, moduleId)
      .then(setBookmarks)
      .catch((err) => {
        logger.warn({ err }, 'Failed to load bookmarks');
        showToast.error('toast.loadFailed');
        setBookmarks([]);
      })
      .finally(() => setLoading(false));
  }, [courseId, moduleId]);

  const sectionBookmark = optimisticBookmarks.find((b) => b.sectionID === visibleSection);
  const moduleBookmark = optimisticBookmarks.find((b) => !b.sectionID);
  const hasActiveBookmark = visibleSection ? !!sectionBookmark : !!moduleBookmark;
  const activeBookmarkId = visibleSection ? sectionBookmark?.id : moduleBookmark?.id;

  const handleToggleBookmark = useCallback(
    async (title: string, sectionID: string | null) => {
      const existing = sectionID
        ? bookmarks.find((b) => b.sectionID === sectionID)
        : bookmarks.find((b) => !b.sectionID);
      if (existing) {
        addOptimistic({ type: 'delete', id: existing.id });
        await api.storage.deleteBookmark(existing.id);
        setBookmarks((prev) => prev.filter((b) => b.id !== existing.id));
      } else {
        const temp: Bookmark = {
          id: `optimistic-${Date.now()}`,
          courseID: courseId,
          moduleID: moduleId,
          title,
          sectionID,
          scrollPosition: 0,
          createdAt: new Date().toISOString(),
        };
        addOptimistic({ type: 'add', bookmark: temp });
        const bookmark = await api.storage.addBookmark({
          courseID: courseId,
          moduleID: moduleId,
          title,
          sectionID: sectionID ?? undefined,
          scrollPosition: 0,
        });
        setBookmarks((prev) => [...prev, bookmark]);
      }
    },
    [bookmarks, courseId, moduleId, addOptimistic],
  );

  const handleDeleteBookmark = useCallback(
    async (id: string) => {
      addOptimistic({ type: 'delete', id });
      await api.storage.deleteBookmark(id);
      setBookmarks((prev) => prev.filter((b) => b.id !== id));
    },
    [addOptimistic],
  );

  return {
    bookmarks: optimisticBookmarks,
    loading,
    handleToggleBookmark,
    handleDeleteBookmark,
    sectionBookmark,
    moduleBookmark,
    hasActiveBookmark,
    activeBookmarkId,
  };
}
