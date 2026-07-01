import { describe, expect, test, beforeEach } from 'bun:test';

import { fsMockImpl } from '../testFsShared';

const mockSyllabi: Record<string, string> = {};
const mockDirEntries: Array<{ name: string; isDirectory: () => boolean }> = [];

let storageData: Record<string, unknown> = {};

function addCourse(courseId: string, courseName: string, moduleNames: string[]) {
  let yaml = `subject: ${courseName}\nmodules:\n`;
  for (let i = 0; i < moduleNames.length; i++) {
    const mid = `${String(i + 1).padStart(2, '0')}`;
    yaml += `  - id: "${mid}"\n    name: ${moduleNames[i]}\n    time_hours: 1\n    prerequisites: []\n    topics: []\n`;
  }
  mockSyllabi[courseId] = yaml;
  mockDirEntries.push({ name: courseId, isDirectory: () => true });
}

type Stats = typeof import('./stats');
let stats: Stats;

beforeEach(() => {
  for (const k of Object.keys(mockSyllabi)) delete mockSyllabi[k];
  mockDirEntries.length = 0;
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
    readdirSync: () => mockDirEntries,
    readFileSync: (p: string) => {
      if (p.includes('data.json')) return JSON.stringify(storageData);
      if (p.includes('deck.json')) return JSON.stringify({ cards: {} });
      const syllabusMatch = p.match(/\/([^/]+)\/syllabus\.yaml$/);
      if (syllabusMatch && syllabusMatch[1] in mockSyllabi) {
        return mockSyllabi[syllabusMatch[1]];
      }
      return '';
    },
    writeFileSync: () => {},
    mkdirSync: () => {},
    rmSync: () => {},
    cpSync: () => {},
  });
});

describe('getCourseStats', () => {
  test('returns stats for valid course', async () => {
    stats = await import('./stats');
    addCourse('math', 'Math', ['Intro']);
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
    addCourse('math', 'Math', []);
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
    addCourse('math', 'Math', []);
    const result = stats.getCourseStats('math');
    expect(result.avgQuizScore).toBe(0);
    expect(result.quizAttempts).toBe(0);
  });

  test('computes totalStudyMinutes from sessions', async () => {
    stats = await import('./stats');
    addCourse('math', 'Math', []);
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
    addCourse('math', 'Mathematics', ['A', 'B']);
    addCourse('physics', 'Physics', ['C']);
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
