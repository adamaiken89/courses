import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'bun:test';

import { useBookmarksStore } from '../stores/bookmarksStore';
import { clearMocks, mockResponse, setupRPC } from '../test-utils';
import { useBookmarks } from './useBookmarks';

setupRPC();

beforeEach(() => {
  useBookmarksStore.setState({ byModule: {}, loading: {} });
  clearMocks();
  mockResponse('getModuleBookmarks', new Promise(() => {}));
});

const aBookmark = (
  overrides: Partial<{
    id: string;
    courseID: string;
    moduleID: string;
    sectionID: string | null;
    title: string;
    scrollPosition: number;
    createdAt: string;
  }> & { id: string },
): NonNullable<ReturnType<typeof useBookmarksStore.getState>['byModule'][string][number]> => ({
  courseID: 'math',
  moduleID: '01',
  sectionID: null,
  title: 'Module Bookmark',
  scrollPosition: 0,
  createdAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

describe('useBookmarks', () => {
  test('returns loading state from store', () => {
    useBookmarksStore.setState({ loading: { 'math:01': true } });
    const { result } = renderHook(() => useBookmarks('math', '01', null));
    expect(result.current.loading).toBe(true);
  });

  test('returns bookmarks from store', () => {
    const bm = aBookmark({ id: 'b1' });
    useBookmarksStore.setState({ byModule: { 'math:01': [bm] } });
    const { result } = renderHook(() => useBookmarks('math', '01', null));
    expect(result.current.bookmarks).toEqual([bm]);
  });

  test('sectionBookmark found when visibleSection matches', () => {
    const sectionBm = aBookmark({ id: 'b1', sectionID: 's1', title: 'Section 1' });
    useBookmarksStore.setState({ byModule: { 'math:01': [sectionBm] } });
    const { result } = renderHook(() => useBookmarks('math', '01', 's1'));
    expect(result.current.sectionBookmark?.id).toBe('b1');
    expect(result.current.hasActiveBookmark).toBe(true);
    expect(result.current.activeBookmarkId).toBe('b1');
  });

  test('sectionBookmark undefined when visibleSection does not match', () => {
    const sectionBm = aBookmark({ id: 'b1', sectionID: 's1', title: 'Section 1' });
    useBookmarksStore.setState({ byModule: { 'math:01': [sectionBm] } });
    const { result } = renderHook(() => useBookmarks('math', '01', 's2'));
    expect(result.current.sectionBookmark).toBeUndefined();
    expect(result.current.hasActiveBookmark).toBe(false);
  });

  test('moduleBookmark found when visibleSection is null', () => {
    const moduleBm = aBookmark({ id: 'b1', sectionID: null, title: 'Module BM' });
    useBookmarksStore.setState({ byModule: { 'math:01': [moduleBm] } });
    const { result } = renderHook(() => useBookmarks('math', '01', null));
    expect(result.current.moduleBookmark?.id).toBe('b1');
    expect(result.current.hasActiveBookmark).toBe(true);
    expect(result.current.activeBookmarkId).toBe('b1');
  });

  test('handleToggleBookmark calls store toggle with correct args', async () => {
    mockResponse('getModuleBookmarks', []);
    mockResponse('addBookmark', {
      id: 'new-bm',
      courseID: 'math',
      moduleID: '01',
      sectionID: 's1',
      title: 'My Bookmark',
      scrollPosition: 0,
      createdAt: '2024-01-01T00:00:00.000Z',
    });
    const { result } = renderHook(() => useBookmarks('math', '01', null));
    await act(async () => {
      await result.current.handleToggleBookmark('My Bookmark', 's1');
    });
    expect(useBookmarksStore.getState().byModule['math:01']).toHaveLength(1);
  });
});
