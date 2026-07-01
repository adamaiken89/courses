import { beforeEach, describe, expect, test } from 'bun:test';

import { clearMocks, deleteMock, mockResponse, setupRPC } from '../testUtils';
import { useBookmarksStore } from './bookmarksStore';

setupRPC();

beforeEach(() => {
  useBookmarksStore.setState({ byModule: {}, loading: {} });
  clearMocks();
});

describe('bookmarksStore', () => {
  test('load populates byModule', async () => {
    const bookmarks = [
      {
        id: 'b1',
        courseID: 'math',
        moduleID: '01',
        sectionID: null,
        title: 'Intro',
        scrollPosition: 0,
        createdAt: '2024-01-01',
      },
    ];
    mockResponse('getModuleBookmarks', bookmarks);
    await useBookmarksStore.getState().load('math', '01');
    expect(useBookmarksStore.getState().byModule['math:01']).toEqual(bookmarks);
    expect(useBookmarksStore.getState().loading['math:01']).toBe(false);
  });

  test('load handles error', async () => {
    const origError = console.error;
    console.error = () => {};
    deleteMock('getModuleBookmarks');
    await useBookmarksStore.getState().load('math', '01');
    expect(useBookmarksStore.getState().byModule['math:01']).toEqual([]);
    console.error = origError;
  });

  test('toggle creates bookmark when none exists', async () => {
    const bookmark = {
      id: 'b1',
      courseID: 'math',
      moduleID: '01',
      sectionID: null,
      title: 'Intro',
      scrollPosition: 0,
      createdAt: '2024-01-01',
    };
    mockResponse('addBookmark', bookmark);
    await useBookmarksStore.getState().toggle('math', '01', 'Intro', null);
    expect(useBookmarksStore.getState().byModule['math:01']).toHaveLength(1);
    expect(useBookmarksStore.getState().byModule['math:01'][0].id).toBe('b1');
  });

  test('toggle removes existing bookmark', async () => {
    useBookmarksStore.setState({
      byModule: {
        'math:01': [
          {
            id: 'b1',
            courseID: 'math',
            moduleID: '01',
            sectionID: null,
            title: 'Intro',
            scrollPosition: 0,
            createdAt: '2024-01-01',
          },
        ],
      },
    });
    mockResponse('deleteBookmark', { ok: true });
    await useBookmarksStore.getState().toggle('math', '01', 'Intro', null);
    expect(useBookmarksStore.getState().byModule['math:01']).toEqual([]);
  });

  test('remove deletes bookmark', async () => {
    useBookmarksStore.setState({
      byModule: {
        'math:01': [
          {
            id: 'b1',
            courseID: 'math',
            moduleID: '01',
            sectionID: null,
            title: 'Intro',
            scrollPosition: 0,
            createdAt: '2024-01-01',
          },
        ],
      },
    });
    mockResponse('deleteBookmark', { ok: true });
    await useBookmarksStore.getState().remove('b1');
    expect(useBookmarksStore.getState().byModule['math:01']).toEqual([]);
    expect(useBookmarksStore.getState().getForModule('math', '01')).toEqual([]);
  });

  test('getForModule returns bookmarks', () => {
    useBookmarksStore.setState({
      byModule: {
        'math:01': [
          {
            id: 'b1',
            courseID: 'math',
            moduleID: '01',
            sectionID: null,
            title: 'Intro',
            scrollPosition: 0,
            createdAt: '2024-01-01',
          },
        ],
      },
    });
    expect(useBookmarksStore.getState().getForModule('math', '01')).toHaveLength(1);
    expect(useBookmarksStore.getState().getForModule('other', '01')).toEqual([]);
  });

  test('getActive returns bookmark for section', () => {
    useBookmarksStore.setState({
      byModule: {
        'math:01': [
          {
            id: 'b1',
            courseID: 'math',
            moduleID: '01',
            sectionID: 's1',
            title: 'S1',
            scrollPosition: 0,
            createdAt: '2024-01-01',
          },
          {
            id: 'b2',
            courseID: 'math',
            moduleID: '01',
            sectionID: null,
            title: 'NoSection',
            scrollPosition: 0,
            createdAt: '2024-01-01',
          },
        ],
      },
    });
    expect(useBookmarksStore.getState().getActive('math', '01', 's1')?.id).toBe('b1');
    expect(useBookmarksStore.getState().getActive('math', '01', null)?.id).toBe('b2');
  });
});
