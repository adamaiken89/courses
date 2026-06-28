import { describe, expect, test, mock, beforeEach } from 'bun:test';

import type { Course, SRSDeck } from './types';

const mockCourses: Course[] = [];
const mockDeck: SRSDeck = { cards: {} };
const mockCompletedCounts: Record<string, number> = {};
const mockStreak = 0;
const mockSessions: Array<{
  date: string;
  courseID: string;
  durationMinutes: number;
  type: string;
  score?: number;
  total?: number;
}> = [];

mock.module('./course-loader', () => ({
  loadCourses: () => mockCourses,
  loadSRSDeck: () => mockDeck,
}));

mock.module('./storage', () => ({
  getCompletedModuleCount: (courseID: string) => mockCompletedCounts[courseID] ?? 0,
  getStudySessions: (_courseID: string, _days?: number) => mockSessions,
  getGlobalStudySessions: (_days?: number) => mockSessions,
  getDailyStreak: () => mockStreak,
}));

mock.module('./srs', () => ({
  getCardsForCourse: () => Object.values(mockDeck.cards),
  getDueCardsForCourse: () => [],
}));

type Stats = typeof import('./stats');
let stats: Stats;

beforeEach(() => {
  mockCourses.length = 0;
  mockDeck.cards = {};
  Object.keys(mockCompletedCounts).forEach((k) => delete mockCompletedCounts[k]);
  mockSessions.length = 0;
});

describe('getCourseStats', () => {
  test('returns stats for valid course', async () => {
    stats = await import('./stats');
    mockCourses.push({
      id: 'math',
      course: 'Math',
      modules: [{ id: '01', name: 'Intro', timeHours: 2, prerequisites: [], topics: [] }],
      displayName: 'Math',
      timeBudgetHours: 20,
      targetLevel: 'beginner',
      domain: 'math',
      prerequisites: [],
      learningObjectives: [],
    });
    const result = stats.getCourseStats('math');
    expect(result.courseID).toBe('math');
    expect(result.totalModules).toBe(1);
  });

  test('throws for nonexistent course', async () => {
    stats = await import('./stats');
    expect(() => stats.getCourseStats('nonexistent')).toThrow('Course nonexistent not found');
  });

  test('computes avgQuizScore from quiz sessions', async () => {
    stats = await import('./stats');
    mockCourses.push({
      id: 'math',
      course: 'Math',
      modules: [],
      displayName: 'Math',
      timeBudgetHours: 20,
      targetLevel: 'beginner',
      domain: 'math',
      prerequisites: [],
      learningObjectives: [],
    });
    mockSessions.push(
      {
        date: '2024-01-01',
        courseID: 'math',
        durationMinutes: 10,
        type: 'quiz',
        score: 4,
        total: 5,
      },
      {
        date: '2024-01-02',
        courseID: 'math',
        durationMinutes: 10,
        type: 'quiz',
        score: 3,
        total: 5,
      },
    );
    const result = stats.getCourseStats('math');
    expect(result.quizAttempts).toBe(2);
    expect(result.avgQuizScore).toBe(70);
  });

  test('returns 0 avgQuizScore when no quiz sessions', async () => {
    stats = await import('./stats');
    mockCourses.push({
      id: 'math',
      course: 'Math',
      modules: [],
      displayName: 'Math',
      timeBudgetHours: 20,
      targetLevel: 'beginner',
      domain: 'math',
      prerequisites: [],
      learningObjectives: [],
    });
    const result = stats.getCourseStats('math');
    expect(result.avgQuizScore).toBe(0);
    expect(result.quizAttempts).toBe(0);
  });

  test('computes totalStudyMinutes from sessions', async () => {
    stats = await import('./stats');
    mockCourses.push({
      id: 'math',
      course: 'Math',
      modules: [],
      displayName: 'Math',
      timeBudgetHours: 20,
      targetLevel: 'beginner',
      domain: 'math',
      prerequisites: [],
      learningObjectives: [],
    });
    mockSessions.push(
      { date: '2024-01-01', courseID: 'math', durationMinutes: 30, type: 'reading' },
      { date: '2024-01-02', courseID: 'math', durationMinutes: 15, type: 'reading' },
    );
    const result = stats.getCourseStats('math');
    expect(result.totalStudyMinutes).toBe(45);
  });
});

describe('getGlobalStats', () => {
  test('returns global stats across courses', async () => {
    stats = await import('./stats');
    mockCourses.push(
      {
        id: 'math',
        course: 'Math',
        displayName: 'Mathematics',
        modules: [
          { id: '01', name: 'A', timeHours: 1, prerequisites: [], topics: [] },
          { id: '02', name: 'B', timeHours: 1, prerequisites: [], topics: [] },
        ],
        timeBudgetHours: 20,
        targetLevel: 'beginner',
        domain: '',
        prerequisites: [],
        learningObjectives: [],
      },
      {
        id: 'physics',
        course: 'Physics',
        displayName: 'Physics',
        modules: [{ id: '01', name: 'C', timeHours: 1, prerequisites: [], topics: [] }],
        timeBudgetHours: 20,
        targetLevel: 'beginner',
        domain: '',
        prerequisites: [],
        learningObjectives: [],
      },
    );
    mockCompletedCounts['math'] = 1;
    mockCompletedCounts['physics'] = 0;
    mockSessions.push({
      date: '2024-01-01',
      courseID: 'math',
      durationMinutes: 30,
      type: 'reading',
    });

    const result = stats.getGlobalStats();
    expect(result.totalCourses).toBe(2);
    expect(result.totalModules).toBe(3);
    expect(result.totalCompletedModules).toBe(1);
    expect(result.totalStudyMinutes).toBe(30);
    expect(result.courseSummaries).toHaveLength(2);
    expect(result.courseSummaries[0]).toMatchObject({ courseID: 'math', completed: 1, total: 2 });
  });

  test('returns empty summaries when no courses', async () => {
    stats = await import('./stats');
    const result = stats.getGlobalStats();
    expect(result.totalCourses).toBe(0);
    expect(result.courseSummaries).toEqual([]);
  });
});
