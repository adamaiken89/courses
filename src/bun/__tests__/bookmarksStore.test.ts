import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { useBookmarksStore } from '../../mainview/stores/bookmarksStore';
import { mockFetch, restoreFetch } from './mock-fetch';
import '../../mainview/i18n';

const mockBookmark = {
  id: 'b1',
  courseID: 'course1',
  moduleID: '01',
  title: 'Chapter 1',
  sectionID: null,
  scrollPosition: 0,
  createdAt: '2024-01-01',
};

beforeEach(() => {
  useBookmarksStore.setState(useBookmarksStore.getInitialState());
});

afterEach(restoreFetch);

describe('bookmarksStore', () => {
  test('default state', () => {
    const s = useBookmarksStore.getState();
    expect(s.byModule).toEqual({});
    expect(s.loading).toEqual({});
  });

  test('getForModule returns empty array for unknown module', () => {
    expect(useBookmarksStore.getState().getForModule('c', '01')).toEqual([]);
  });

  test('getActive returns undefined for unknown module', () => {
    expect(useBookmarksStore.getState().getActive('c', '01', null)).toBeUndefined();
  });

  test('load fetches bookmarks and stores them', async () => {
    mockFetch({ '/storage/bookmarks/module': [mockBookmark] });
    useBookmarksStore.getState().load('course1', '01');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(useBookmarksStore.getState().getForModule('course1', '01')).toHaveLength(1);
  });

  test('remove deletes bookmark and removes from state', async () => {
    useBookmarksStore.setState({ byModule: { 'course1:1': [mockBookmark] } });
    mockFetch({ '/storage/bookmarks/b1': { ok: true } });
    await useBookmarksStore.getState().remove('b1');
    expect(useBookmarksStore.getState().getForModule('course1', '01')).toEqual([]);
  });
});
