import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { useCourseStore } from '../../mainview/stores/courseStore';
import { mockFetch, restoreFetch } from './mock-fetch';
import type { Course } from '../../bun/types';

const mockCourse: Course = {
  id: 'math-101',
  course: 'Mathematics 101',
  displayName: 'Mathematics 101',
  domain: 'mathematics',
  prerequisites: [],
  modules: [{ id: '01', name: 'Algebra', timeHours: 3, prerequisites: [], topics: [] }],
  timeBudgetHours: 20,
  targetLevel: 'beginner',
  learningObjectives: [],
};

beforeEach(() => {
  useCourseStore.setState(useCourseStore.getInitialState());
});

afterEach(restoreFetch);

describe('courseStore', () => {
  test('default state', () => {
    const s = useCourseStore.getState();
    expect(s.courses).toEqual([]);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
    expect(s.loaded).toBe(false);
  });

  test('load sets courses and progress', async () => {
    mockFetch({
      '/courses': [mockCourse],
      '/storage/completed/modules': { moduleIDs: ['1'] },
    });
    useCourseStore.getState().load();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const s = useCourseStore.getState();
    expect(s.courses).toHaveLength(1);
    expect(s.loading).toBe(false);
    expect(s.loaded).toBe(true);
  });

  test('load sets error on failure', async () => {
    globalThis.fetch = (async () =>
      new Response(null, { status: 500 })) as unknown as typeof globalThis.fetch;
    useCourseStore.getState().load();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const s = useCourseStore.getState();
    expect(s.error).toBeTruthy();
    expect(s.loading).toBe(false);
  });

  test('load is idempotent when already loaded', () => {
    useCourseStore.setState({ loaded: true, courses: [mockCourse] });
    useCourseStore.getState().load();
    expect(useCourseStore.getState().courses).toHaveLength(1);
    expect(useCourseStore.getState().loaded).toBe(true);
  });

  test('reset clears all state', () => {
    useCourseStore.setState({ courses: [mockCourse], loaded: true });
    useCourseStore.getState().reset();
    const s = useCourseStore.getState();
    expect(s.courses).toEqual([]);
    expect(s.loaded).toBe(false);
  });
});
