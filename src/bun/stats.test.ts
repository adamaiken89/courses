import { describe, expect, test, mock, beforeEach } from 'bun:test';

import type { Course, SRSDeck } from './types';
import { fsMockImpl } from '../testFsShared';

const mockCourses: Course[] = [];
const mockDeck: SRSDeck = { cards: {} };

let storageData: Record<string, unknown> = {
  highlights: [],
  notes: [],
  bookmarks: [],
  completedModules: [],
  studySessions: [],
  userCards: [],
};

mock.module('./courseLoader', () => ({
  loadCourses: () => mockCourses,
  loadSRSDeck: () => mockDeck,
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
  storageData = {
    highlights: [],
    notes: [],
    bookmarks: [],
    completedModules: [],
    studySessions: [],
    userCards: [],
  };
  Object.assign(fsMockImpl, {
    existsSync: () => true,
    readFileSync: () => JSON.stringify(storageData),
    writeFileSync: () => {},
    mkdirSync: () => {},
    readdirSync: () => [],
    rmSync: () => {},
    cpSync: () => {},
  });
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
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    storageData.studySessions = [
      {
        date: yesterday.toISOString(),
        courseID: 'math',
        durationMinutes: 10,
        type: 'quiz',
        score: 4,
        total: 5,
      },
      {
        date: today.toISOString(),
        courseID: 'math',
        durationMinutes: 10,
        type: 'quiz',
        score: 3,
        total: 5,
      },
    ];
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
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    storageData.studySessions = [
      { date: yesterday.toISOString(), courseID: 'math', durationMinutes: 30, type: 'reading' },
      { date: today.toISOString(), courseID: 'math', durationMinutes: 15, type: 'reading' },
    ];
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
    storageData.completedModules = [
      { courseID: 'math', moduleID: '01', completedAt: '2024-01-01' },
    ];
    const today = new Date();
    storageData.studySessions = [
      {
        date: today.toISOString(),
        courseID: 'math',
        durationMinutes: 30,
        type: 'reading',
      },
    ];
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
