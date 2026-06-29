import { beforeEach, describe, expect, test } from 'bun:test';

import { clearMocks, deleteMock, mockResponse, setupRPC } from '../test-utils';
import { useCourseStore } from './courseStore';

setupRPC();

beforeEach(() => {
  useCourseStore.setState({ courses: [], loading: false, error: null, loaded: false });
  clearMocks();
});

describe('courseStore', () => {
  test('load sets courses and loaded flag', async () => {
    const courses = [
      {
        id: 'math',
        course: 'Math',
        displayName: 'Math',
        domain: 'math',
        prerequisites: [],
        modules: [{ id: '01', name: 'A', timeHours: 1, prerequisites: [], topics: [] }],
        timeBudgetHours: 10,
        targetLevel: 'beginner',
        learningObjectives: [],
      },
    ];
    mockResponse('coursesList', courses);
    const result = await useCourseStore.getState().load();
    expect(result).toEqual(courses);
    expect(useCourseStore.getState().courses).toEqual(courses);
    expect(useCourseStore.getState().loading).toBe(false);
    expect(useCourseStore.getState().loaded).toBe(true);
  });

  test('load skips if already loaded', async () => {
    useCourseStore.setState({ loaded: true });
    const result = await useCourseStore.getState().load();
    expect(result).toEqual([]);
  });

  test('load sets error on failure', async () => {
    const origError = console.error;
    console.error = () => {};
    deleteMock('coursesList');
    try {
      await useCourseStore.getState().load();
    } catch {
      // expected
    }
    expect(useCourseStore.getState().error).toBeTruthy();
    expect(useCourseStore.getState().loading).toBe(false);
    console.error = origError;
  });

  test('reset clears state', () => {
    useCourseStore.setState({
      courses: [
        {
          id: 'math',
          course: 'Math',
          displayName: 'Math',
          domain: 'math',
          prerequisites: [],
          modules: [],
          timeBudgetHours: 10,
          targetLevel: 'beginner',
          learningObjectives: [],
        },
      ],
      loading: true,
      error: 'err',
      loaded: true,
    });
    useCourseStore.getState().reset();
    expect(useCourseStore.getState().courses).toEqual([]);
    expect(useCourseStore.getState().loading).toBe(false);
    expect(useCourseStore.getState().loaded).toBe(false);
    expect(useCourseStore.getState().error).toBeNull();
  });
});
