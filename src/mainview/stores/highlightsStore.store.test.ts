import { beforeAll, beforeEach, describe, expect, test } from 'bun:test';

import { __setRPC } from '../api';
import { useHighlightsStore } from './highlightsStore';

type RPCProxy = { request: Record<string, (p: unknown) => Promise<unknown>> };
const mockResponses = new Map<string, unknown>();

const mockRPC: RPCProxy = {
  request: new Proxy({} as Record<string, (p: unknown) => Promise<unknown>>, {
    get(_, method: string) {
      return (_p: unknown) => {
        const response = mockResponses.get(method);
        if (response === undefined) return Promise.reject(new Error(`No mock for ${method}`));
        return Promise.resolve(response);
      };
    },
  }),
};

beforeAll(() => {
  __setRPC(mockRPC);
});

beforeEach(() => {
  useHighlightsStore.setState({ byModule: {}, loading: {} });
  mockResponses.clear();
});

function mockResponse(method: string, data: unknown) {
  mockResponses.set(method, data);
}

describe('highlightsStore', () => {
  test('load populates byModule', async () => {
    const highlights = [
      {
        id: 'h1',
        courseID: 'math',
        moduleID: '01',
        selectedText: 'text',
        color: 'yellow',
        startOffset: 0,
        endOffset: 4,
        createdAt: '2024-01-01',
      },
    ];
    mockResponse('getHighlights', highlights);
    await useHighlightsStore.getState().load('math', '01');
    expect(useHighlightsStore.getState().byModule['math:01']).toEqual(highlights);
    expect(useHighlightsStore.getState().loading['math:01']).toBe(false);
  });

  test('load handles error', async () => {
    mockResponses.delete('getHighlights');
    await useHighlightsStore.getState().load('math', '01');
    expect(useHighlightsStore.getState().byModule['math:01']).toEqual([]);
  });

  test('add inserts highlight', async () => {
    const highlight = {
      id: 'h1',
      courseID: 'math',
      moduleID: '01',
      selectedText: 'hello',
      color: 'yellow',
      startOffset: 0,
      endOffset: 5,
      createdAt: '2024-01-01',
    };
    mockResponse('addHighlight', highlight);
    await useHighlightsStore.getState().add('math', '01', 'hello', 'yellow', 0, 5);
    expect(useHighlightsStore.getState().getForModule('math', '01')).toHaveLength(1);
    expect(useHighlightsStore.getState().getForModule('math', '01')[0].id).toBe('h1');
  });

  test('remove deletes highlight', async () => {
    useHighlightsStore.setState({
      byModule: {
        'math:01': [
          {
            id: 'h1',
            courseID: 'math',
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
    mockResponse('deleteHighlight', { ok: true });
    await useHighlightsStore.getState().remove('h1');
    expect(useHighlightsStore.getState().getForModule('math', '01')).toEqual([]);
  });

  test('remove handles non-existent module', async () => {
    mockResponse('deleteHighlight', { ok: true });
    await useHighlightsStore.getState().remove('nonexistent');
  });

  test('getForModule returns empty for unknown module', () => {
    expect(useHighlightsStore.getState().getForModule('math', '99')).toEqual([]);
  });
});
