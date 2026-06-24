import { useEffect, useMemo } from 'react';
import { useBookmarksStore } from '../stores/bookmarksStore';
import type { Bookmark } from '../components/sidebar-types';

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
  moduleId: string | number,
  visibleSection: string | null,
): UseBookmarksReturn {
  const load = useBookmarksStore((s) => s.load);
  const toggle = useBookmarksStore((s) => s.toggle);
  const remove = useBookmarksStore((s) => s.remove);
  const getForModule = useBookmarksStore((s) => s.getForModule);
  const getActive = useBookmarksStore((s) => s.getActive);
  const loading = useBookmarksStore((s) => s.loading[`${courseId}:${moduleId}`] ?? false);

  useEffect(() => {
    load(courseId, moduleId);
  }, [courseId, moduleId, load]);

  const bookmarks = useMemo(
    () => getForModule(courseId, moduleId),
    [getForModule, courseId, moduleId],
  );

  const sectionBookmark = useMemo(
    () => getActive(courseId, moduleId, visibleSection),
    [getActive, courseId, moduleId, visibleSection],
  );

  const moduleBookmark = useMemo(
    () => getActive(courseId, moduleId, null),
    [getActive, courseId, moduleId],
  );

  const hasActiveBookmark = visibleSection ? !!sectionBookmark : !!moduleBookmark;
  const activeBookmarkId = visibleSection ? sectionBookmark?.id : moduleBookmark?.id;

  const handleToggleBookmark = async (title: string, sectionID: string | null) => {
    await toggle(courseId, moduleId, title, sectionID);
  };

  const handleDeleteBookmark = async (id: string) => {
    await remove(id);
  };

  return {
    bookmarks,
    loading,
    handleToggleBookmark,
    handleDeleteBookmark,
    sectionBookmark,
    moduleBookmark,
    hasActiveBookmark,
    activeBookmarkId,
  };
}
