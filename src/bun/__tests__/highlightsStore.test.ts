import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { useHighlightsStore } from '../../mainview/stores/highlightsStore';
import { mockFetch, restoreFetch } from './mock-fetch';
import '../../mainview/i18n';

beforeEach(() => {
  useHighlightsStore.setState(useHighlightsStore.getInitialState());
});

afterEach(restoreFetch);

describe('highlightsStore', () => {
  test('default state', () => {
    const s = useHighlightsStore.getState();
    expect(s.byModule).toEqual({});
    expect(s.loading).toEqual({});
  });

  test('getForModule returns empty array for unknown module', () => {
    expect(useHighlightsStore.getState().getForModule('course1', '01')).toEqual([]);
  });

  test('load fetches highlights and stores by module key', async () => {
    const mockHighlights = [
      {
        id: 'h1',
        courseID: 'course1',
        moduleID: '01',
        selectedText: 'hello',
        color: 'yellow',
        startOffset: 0,
        endOffset: 5,
        createdAt: '2024-01-01',
      },
    ];
    mockFetch({ '/storage/highlights': mockHighlights });
    useHighlightsStore.getState().load('course1', '01');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(useHighlightsStore.getState().getForModule('course1', '01')).toEqual(mockHighlights);
  });

  test('add posts highlight and appends to byModule', async () => {
    const newHighlight = {
      id: 'h1',
      courseID: 'course1',
      moduleID: '01',
      selectedText: 'text',
      color: 'green',
      startOffset: 0,
      endOffset: 4,
      createdAt: '2024-01-01',
    };
    mockFetch({ '/storage/highlights': newHighlight });
    await useHighlightsStore.getState().add('course1', '01', 'text', 'green', 0, 4);
    const highlights = useHighlightsStore.getState().getForModule('course1', '01');
    expect(highlights).toHaveLength(1);
    expect(highlights[0].color).toBe('green');
  });

  test('remove deletes and removes from state', async () => {
    // Pre-populate state
    useHighlightsStore.setState({
      byModule: {
        'course1:1': [
          {
            id: 'h1',
            courseID: 'course1',
            moduleID: '01',
            selectedText: 'text',
            color: 'yellow',
            startOffset: 0,
            endOffset: 4,
            createdAt: '2024-01-01',
          },
        ],
      },
    });
    mockFetch({ '/storage/highlights/h1': { ok: true } });
    await useHighlightsStore.getState().remove('h1');
    expect(useHighlightsStore.getState().getForModule('course1', '01')).toEqual([]);
  });
});
