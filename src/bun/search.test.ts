import { beforeEach, describe, expect, mock, test } from 'bun:test';

import type { Course } from './types';

const mockCourses: Course[] = [];
const mockLessonContent: Map<string, string | null> = new Map();

mock.module('./course-loader', () => ({
  loadCourses: () => mockCourses,
  loadLesson: (courseID: string, modID: string) =>
    mockLessonContent.get(`${courseID}:${modID}`) ?? null,
}));

type Search = typeof import('./search');
let search: Search;

beforeEach(() => {
  mockCourses.length = 0;
  mockLessonContent.clear();
});

function makeCourse(id: string, name: string, mods: string[]): Course {
  return {
    id,
    displayName: name,
    course: name,
    modules: mods.map((m, i) => ({
      id: `${String(i + 1).padStart(2, '0')}`,
      name: m,
      timeHours: 1,
      prerequisites: [],
      topics: [],
    })),
    timeBudgetHours: 10,
    targetLevel: 'beginner',
    domain: 'math',
    prerequisites: [],
    learningObjectives: [],
  };
}

describe('searchAll', () => {
  test('returns empty array for empty query', async () => {
    search = await import('./search');
    expect(search.searchAll('')).toEqual([]);
    expect(search.searchAll('   ')).toEqual([]);
  });

  test('finds matches in lessons', async () => {
    search = await import('./search');
    mockCourses.push(makeCourse('math', 'Math', ['Intro']));
    mockLessonContent.set('math:01', 'This is about calculus and algebra');

    const results = search.searchAll('calculus');
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('lesson');
    expect(results[0].courseID).toBe('math');
  });

  test('filters by courseID', async () => {
    search = await import('./search');
    mockCourses.push(makeCourse('math', 'Math', ['Intro']));
    mockCourses.push(makeCourse('physics', 'Physics', ['Intro']));
    mockLessonContent.set('math:01', 'calculus content');
    mockLessonContent.set('physics:01', 'physics content');

    const results = search.searchAll('content', 'math');
    expect(results).toHaveLength(1);
    expect(results[0].courseID).toBe('math');
  });

  test('deduplicates results', async () => {
    search = await import('./search');
    mockCourses.push(makeCourse('math', 'Math', ['Intro']));
    mockLessonContent.set('math:01', 'calculus calculus calculus');

    const results = search.searchAll('calculus');
    expect(results).toHaveLength(1);
  });

  test('handles no matching results', async () => {
    search = await import('./search');
    mockCourses.push(makeCourse('math', 'Math', ['Intro']));
    mockLessonContent.set('math:01', 'algebra');

    const results = search.searchAll('calculus');
    expect(results).toEqual([]);
  });

  test('handles lesson load failure gracefully', async () => {
    search = await import('./search');
    mockCourses.push(makeCourse('math', 'Math', ['Intro']));
    mockLessonContent.set('math:01', null);

    const results = search.searchAll('anything');
    expect(results).toEqual([]);
  });

  test('sorts results by relevance', async () => {
    search = await import('./search');
    mockCourses.push(makeCourse('math', 'Math', ['A', 'B', 'C']));
    mockLessonContent.set('math:01', 'calculus algebra');
    mockLessonContent.set('math:02', 'calculus');
    mockLessonContent.set('math:03', 'other topic');

    const results = search.searchAll('calculus');
    expect(results).toHaveLength(2);
  });

  test('caps results at 50', async () => {
    search = await import('./search');
    const mods = Array.from({ length: 60 }, (_, i) => `M${i}`);
    mockCourses.push(makeCourse('big', 'Big', mods));
    for (let i = 0; i < 60; i++) {
      const id = `${String(i + 1).padStart(2, '0')}`;
      mockLessonContent.set(`big:${id}`, 'searchable content');
    }

    const results = search.searchAll('searchable');
    expect(results.length).toBeLessThanOrEqual(50);
  });

  test('case insensitive matching', async () => {
    search = await import('./search');
    mockCourses.push(makeCourse('math', 'Math', ['Intro']));
    mockLessonContent.set('math:01', 'CALCULUS AND ALGEBRA');

    const results = search.searchAll('calculus');
    expect(results).toHaveLength(1);
  });

  test('snippet contains query context', async () => {
    search = await import('./search');
    mockCourses.push(makeCourse('math', 'Math', ['Intro']));
    mockLessonContent.set('math:01', 'This is a long text about calculus and other things');

    const results = search.searchAll('calculus');
    expect(results[0].snippet).toContain('calculus');
  });
});
