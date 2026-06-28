import { beforeAll, beforeEach, describe, expect, test } from 'bun:test';

import { __setRPC } from '../api';
import { useCourseStore } from './courseStore';

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
  useCourseStore.setState({ courses: [], loading: false, error: null, loaded: false });
  mockResponses.clear();
});

function mockResponse(method: string, data: unknown) {
  mockResponses.set(method, data);
}

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
    mockResponse('getCompletedModuleIDs', []);
    useCourseStore.getState().load();
    await new Promise((r) => setTimeout(r, 10));
    expect(useCourseStore.getState().courses).toEqual(courses);
    expect(useCourseStore.getState().loading).toBe(false);
    expect(useCourseStore.getState().loaded).toBe(true);
  });

  test('load skips if already loaded', () => {
    useCourseStore.setState({ loaded: true });
    useCourseStore.getState().load();
    expect(mockResponses.size).toBe(0);
  });

  test('load sets error on failure', async () => {
    mockResponses.delete('coursesList');
    useCourseStore.getState().load();
    await new Promise((r) => setTimeout(r, 10));
    expect(useCourseStore.getState().error).toBeTruthy();
    expect(useCourseStore.getState().loading).toBe(false);
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
