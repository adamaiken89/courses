import { beforeAll, beforeEach, describe, expect, test } from 'bun:test';

import { __setRPC } from '../api';
import { countCompleted, useCompletionStore } from './completionStore';

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
  useCompletionStore.setState({ completed: {}, totalModules: {}, loading: {}, loaded: false });
  mockResponses.clear();
});

function mockResponse(method: string, data: unknown) {
  mockResponses.set(method, data);
}

describe('completionStore', () => {
  test('load sets completed for module', async () => {
    mockResponse('isModuleCompleted', true);
    await useCompletionStore.getState().load('math', '01');
    expect(useCompletionStore.getState().completed['math:01']).toBe(true);
  });

  test('load sets false when not completed', async () => {
    mockResponse('isModuleCompleted', false);
    await useCompletionStore.getState().load('math', '01');
    expect(useCompletionStore.getState().completed['math:01']).toBe(false);
  });

  test('loadCourse loads modules and completed IDs', async () => {
    mockResponse('modulesList', [
      { id: '01', name: 'A', timeHours: 1, prerequisites: [], topics: [] },
      { id: '02', name: 'B', timeHours: 1, prerequisites: [], topics: [] },
    ]);
    mockResponse('getCompletedModuleIDs', ['01']);
    await useCompletionStore.getState().loadCourse('math');
    expect(useCompletionStore.getState().totalModules['math']).toBe(2);
    expect(useCompletionStore.getState().completed['math:01']).toBe(true);
    expect(useCompletionStore.getState().completed['math:02']).toBeUndefined();
  });

  test('loadModules sets completed IDs', async () => {
    mockResponse('getCompletedModuleIDs', ['01', '03']);
    await useCompletionStore.getState().loadModules('math');
    expect(useCompletionStore.getState().completed['math:01']).toBe(true);
    expect(useCompletionStore.getState().completed['math:03']).toBe(true);
  });

  test('loadAll loads completion for all courses', async () => {
    mockResponse('getCompletedModuleIDs', ['01']);
    await useCompletionStore.getState().loadAll(['math', 'physics']);
    expect(useCompletionStore.getState().loaded).toBe(true);
    expect(useCompletionStore.getState().completed['math:01']).toBe(true);
  });

  test('loadAll skips if already loaded', async () => {
    useCompletionStore.setState({ loaded: true });
    mockResponses.set('getCompletedModuleIDs', ['01']);
    await useCompletionStore.getState().loadAll(['math']);
    expect(mockResponses.has('getCompletedModuleIDs')).toBe(true);
  });

  test('toggle marks completed', async () => {
    mockResponse('toggleModuleCompleted', true);
    mockResponse('logSession', { ok: true });
    await useCompletionStore.getState().toggle('math', '01');
    expect(useCompletionStore.getState().completed['math:01']).toBe(true);
  });

  test('get returns boolean', () => {
    useCompletionStore.setState({ completed: { 'math:01': true } });
    expect(useCompletionStore.getState().get('math', '01')).toBe(true);
    expect(useCompletionStore.getState().get('math', '02')).toBe(false);
  });

  test('countCompleted counts for course', () => {
    const completed = { 'math:01': true, 'math:02': false, 'physics:01': true };
    expect(countCompleted(completed, 'math')).toBe(1);
  });

  test('getProgress returns counts', () => {
    useCompletionStore.setState({ completed: { 'math:01': true }, totalModules: { math: 3 } });
    const progress = useCompletionStore.getState().getProgress('math');
    expect(progress.completed).toBe(1);
    expect(progress.total).toBe(3);
  });
});
