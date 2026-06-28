import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, test } from 'bun:test';

import { __setRPC } from '../api';
import { useCompletionStore } from '../stores/completionStore';
import { useLesson } from './useLesson';

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
  useCompletionStore.setState({
    completed: {},
    totalModules: {},
    loading: {},
    loaded: false,
  });
  mockResponses.clear();
});

function mockResponse(method: string, data: unknown) {
  mockResponses.set(method, data);
}

const lessonData = {
  content: '# Test\n\nHello world',
  h1: 'Test Lesson',
  meta: [{ key: 'author', value: 'Test', icon: '👤', label: 'Author' }],
  bodyContent: 'Hello world',
  sections: [{ id: 'sec1', heading: 'Section 1', level: 2, parentID: null }],
};

describe('useLesson', () => {
  test('initial state has loading true', () => {
    mockResponse('loadLesson', lessonData);
    mockResponse('isModuleCompleted', false);
    mockResponse('modulesList', []);
    mockResponse('getCompletedModuleIDs', []);
    const { result } = renderHook(() => useLesson('math', '01'));
    expect(result.current.loading).toBe(true);
    expect(result.current.content).toBe('');
    expect(result.current.h1).toBe('');
    expect(result.current.sections).toEqual([]);
  });

  test('load populates content and sections', async () => {
    mockResponse('loadLesson', lessonData);
    mockResponse('isModuleCompleted', false);
    mockResponse('modulesList', [{ id: '01', name: 'Intro', number: '01' }]);
    mockResponse('getCompletedModuleIDs', []);
    const { result } = renderHook(() => useLesson('math', '01'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.content).toBe(lessonData.content);
    expect(result.current.h1).toBe(lessonData.h1);
    expect(result.current.meta).toEqual(lessonData.meta);
    expect(result.current.bodyContent).toBe(lessonData.bodyContent);
    expect(result.current.sections).toEqual(lessonData.sections);
  });

  test('load failure sets loading false', async () => {
    mockResponse('loadLesson', undefined);
    mockResponse('isModuleCompleted', false);
    mockResponse('modulesList', []);
    mockResponse('getCompletedModuleIDs', []);
    const { result } = renderHook(() => useLesson('math', '01'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.content).toBe('');
  });

  test('isCompleted reads from completion store', async () => {
    mockResponse('loadLesson', lessonData);
    mockResponse('isModuleCompleted', false);
    mockResponse('modulesList', []);
    mockResponse('getCompletedModuleIDs', []);
    const { result } = renderHook(() => useLesson('math', '01'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isCompleted).toBe(false);
  });

  test('handleToggleCompleted flips isCompleted', async () => {
    mockResponse('loadLesson', lessonData);
    mockResponse('isModuleCompleted', false);
    mockResponse('modulesList', [{ id: '01', name: 'Intro', number: '01' }]);
    mockResponse('getCompletedModuleIDs', []);
    mockResponse('toggleModuleCompleted', true);
    mockResponse('logSession', { ok: true });
    const { result } = renderHook(() => useLesson('math', '01'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isCompleted).toBe(false);
    await act(async () => {
      await result.current.handleToggleCompleted();
    });
    expect(result.current.isCompleted).toBe(true);
  });

  test('scrollToSection no-ops when contentRef is null', () => {
    mockResponse('loadLesson', lessonData);
    mockResponse('isModuleCompleted', false);
    mockResponse('modulesList', []);
    mockResponse('getCompletedModuleIDs', []);
    const { result } = renderHook(() => useLesson('math', '01'));
    expect(() => result.current.scrollToSection('sec1')).not.toThrow();
  });

  test('handleScroll no-ops when contentRef is null', () => {
    mockResponse('loadLesson', lessonData);
    mockResponse('isModuleCompleted', false);
    mockResponse('modulesList', []);
    mockResponse('getCompletedModuleIDs', []);
    const { result } = renderHook(() => useLesson('math', '01'));
    expect(() => result.current.handleScroll()).not.toThrow();
  });

  test('initialSectionID sets visibleSection', async () => {
    mockResponse('loadLesson', lessonData);
    mockResponse('isModuleCompleted', false);
    mockResponse('modulesList', []);
    mockResponse('getCompletedModuleIDs', []);
    const { result } = renderHook(() => useLesson('math', '01', 'sec1'));
    expect(result.current.visibleSection).toBe('sec1');
    await waitFor(() => expect(result.current.loading).toBe(false));
  });
});
