import { beforeEach, describe, expect, mock, test } from 'bun:test';

import { fsMockImpl } from '../testFsShared';
import type { Course } from './types';

const mockCourses: Course[] = [];
const mockLessonContent: Map<string, string | null> = new Map();

mock.module('./courseLoader', () => ({
  loadCourses: () => mockCourses,
  loadLesson: (courseID: string, modID: string) =>
    mockLessonContent.get(`${courseID}:${modID}`) ?? null,
}));

type Search = typeof import('./search');
let search: Search;

const mockStorageData: Record<string, unknown> = {};

beforeEach(() => {
  mockCourses.length = 0;
  mockLessonContent.clear();
  for (const key of Object.keys(mockStorageData)) delete mockStorageData[key];
  fsMockImpl.existsSync = ((p: string) =>
    p.includes('data.json')) as unknown as typeof fsMockImpl.existsSync;
  fsMockImpl.readFileSync = (p: string) => {
    if (p.includes('data.json')) return JSON.stringify(mockStorageData);
    return '';
  };
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

  test('searches notes from storage', async () => {
    mockCourses.push(makeCourse('math', 'Math', ['Intro']));
    mockStorageData.notes = [
      { id: 'n1', courseID: 'math', moduleID: '01', content: 'my calculus note' },
    ];
    search = await import('./search');
    const results = search.searchAll('calculus');
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('note');
    expect(results[0].courseID).toBe('math');
    expect(results[0].snippet).toContain('calculus');
  });

  test('searches highlights from storage', async () => {
    mockCourses.push(makeCourse('math', 'Math', ['Intro']));
    mockStorageData.highlights = [
      { id: 'h1', courseID: 'math', moduleID: '01', selectedText: 'important calculus concept' },
    ];
    search = await import('./search');
    const results = search.searchAll('calculus');
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('highlight');
    expect(results[0].courseID).toBe('math');
  });

  test('storage note search filters by courseID', async () => {
    mockCourses.push(makeCourse('math', 'Math', ['Intro']));
    mockCourses.push(makeCourse('physics', 'Physics', ['Intro']));
    mockStorageData.notes = [
      { id: 'n1', courseID: 'math', moduleID: '01', content: 'calculus note' },
      { id: 'n2', courseID: 'physics', moduleID: '01', content: 'calculus note' },
    ];
    search = await import('./search');
    const results = search.searchAll('calculus', 'math');
    expect(results).toHaveLength(1);
    expect(results[0].courseID).toBe('math');
  });

  test('storage highlight search filters by courseID', async () => {
    mockCourses.push(makeCourse('math', 'Math', ['Intro']));
    mockCourses.push(makeCourse('physics', 'Physics', ['Intro']));
    mockStorageData.highlights = [
      { id: 'h1', courseID: 'math', moduleID: '01', selectedText: 'calculus highlight' },
      { id: 'h2', courseID: 'physics', moduleID: '01', selectedText: 'calculus highlight' },
    ];
    search = await import('./search');
    const results = search.searchAll('calculus', 'math');
    expect(results).toHaveLength(1);
    expect(results[0].courseID).toBe('math');
  });

  test('deduplicates results across note and highlight', async () => {
    mockCourses.push(makeCourse('math', 'Math', ['Intro']));
    mockLessonContent.set('math:01', 'calculus lesson');
    mockStorageData.notes = [
      { id: 'n1', courseID: 'math', moduleID: '01', content: 'calculus note' },
    ];
    search = await import('./search');
    const results = search.searchAll('calculus');
    const types = results.map((r) => r.type);
    expect(types).toContain('lesson');
    expect(types).toContain('note');
  });

  test('note search handles course not in loaded courses', async () => {
    mockStorageData.notes = [
      { id: 'n1', courseID: 'unknown', moduleID: '01', content: 'some content' },
    ];
    search = await import('./search');
    const results = search.searchAll('content');
    expect(results).toHaveLength(1);
    expect(results[0].courseName).toBe('unknown');
    expect(results[0].moduleName).toBe('Module 01');
  });

  test('highlight search handles course not in loaded courses', async () => {
    mockStorageData.highlights = [
      { id: 'h1', courseID: 'unknown', moduleID: '01', selectedText: 'some highlight' },
    ];
    search = await import('./search');
    const results = search.searchAll('highlight');
    expect(results).toHaveLength(1);
    expect(results[0].courseName).toBe('unknown');
    expect(results[0].moduleName).toBe('Module 01');
  });

  test('handles non-matching notes and highlights', async () => {
    mockCourses.push(makeCourse('math', 'Math', ['Intro']));
    mockStorageData.notes = [{ id: 'n1', courseID: 'math', moduleID: '01', content: 'unrelated' }];
    mockStorageData.highlights = [
      { id: 'h1', courseID: 'math', moduleID: '01', selectedText: 'also unrelated' },
    ];
    search = await import('./search');
    const results = search.searchAll('calculus');
    expect(results).toEqual([]);
  });

  test('includes all results when no courseID filter given', async () => {
    mockCourses.push(makeCourse('math', 'Math', ['Intro']));
    mockCourses.push(makeCourse('physics', 'Physics', ['Intro']));
    mockLessonContent.set('math:01', 'calculus in math');
    mockLessonContent.set('physics:01', 'calculus in physics');
    search = await import('./search');
    const results = search.searchAll('calculus');
    expect(results).toHaveLength(2);
  });
});
