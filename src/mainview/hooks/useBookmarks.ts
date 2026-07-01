import { useEffect } from 'react';

import type { Bookmark } from '../../bun/types';
import { useBookmarksStore } from '../stores/bookmarksStore';

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
  moduleId: string,
  visibleSection: string | null,
): UseBookmarksReturn {
  const load = useBookmarksStore((s) => s.load);
  const toggle = useBookmarksStore((s) => s.toggle);
  const remove = useBookmarksStore((s) => s.remove);
  const loading = useBookmarksStore((s) => s.loading[`${courseId}:${moduleId}`] ?? false);

  useEffect(() => {
    void load(courseId, moduleId);
  }, [courseId, moduleId, load]);

  const k = `${courseId}:${moduleId}`;
  const bookmarks = useBookmarksStore((s) => s.byModule[k]) ?? [];

  const sectionBookmark = visibleSection
    ? bookmarks.find((b) => b.sectionID === visibleSection)
    : undefined;
  const moduleBookmark = bookmarks.find((b) => !b.sectionID);

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
