import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { countCompleted, useCompletionStore } from '../../mainview/stores/completionStore';
import { mockFetch, restoreFetch } from './mock-fetch';

beforeEach(() => {
  useCompletionStore.setState(useCompletionStore.getInitialState());
});

afterEach(restoreFetch);

describe('completionStore', () => {
  test('default state', () => {
    const s = useCompletionStore.getState();
    expect(s.completed).toEqual({});
    expect(s.totalModules).toEqual({});
  });

  test('get returns false for unknown key', () => {
    expect(useCompletionStore.getState().get('course1', '01')).toBe(false);
  });

  test('getProgress returns 0/0 when no data', () => {
    const p = useCompletionStore.getState().getProgress('course1');
    expect(p.completed).toBe(0);
    expect(p.total).toBe(0);
  });

  test('load sets completed and loading false', async () => {
    mockFetch({ '/storage/completed': { completed: true } });
    useCompletionStore.getState().load('course1', '01');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(useCompletionStore.getState().get('course1', '01')).toBe(true);
  });

  test('loadCourse sets totalModules and completed from API', async () => {
    mockFetch({
      '/courses/course1/modules': [{ id: '01' }, { id: '02' }, { id: '03' }],
      '/storage/completed/modules': { moduleIDs: ['1', '2'] },
    });
    useCompletionStore.getState().loadCourse('course1');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const s = useCompletionStore.getState();
    expect(s.totalModules['course1']).toBe(3);
    expect(countCompleted(s.completed, 'course1')).toBe(2);
  });
});
