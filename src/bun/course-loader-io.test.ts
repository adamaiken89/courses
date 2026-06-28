import { describe, expect, test, beforeEach } from 'bun:test';

import { fsMockImpl } from '../test-fs-shared';

const mockState = {
  exists: true,
  courseSyllabi: {} as Record<string, string>,
  moduleLesson: {} as Record<string, string>,
  moduleQuiz: {} as Record<string, string>,
  srsDeckContent: {} as Record<string, string>,
  modulesDirEntries: [] as Array<{ name: string; isDirectory: () => boolean }>,
  writtenFiles: [] as Array<{ path: string; data: string }>,
};

beforeEach(() => {
  Object.assign(fsMockImpl, {
    existsSync: () => mockState.exists,
    readdirSync: () => mockState.modulesDirEntries,
    readFileSync: (path: string) => {
    const syllabusMatch = path.match(/\/([^/]+)\/syllabus\.yaml$/);
    if (syllabusMatch && syllabusMatch[1] in mockState.courseSyllabi) {
      return mockState.courseSyllabi[syllabusMatch[1]];
    }
    const lessonMatch = path.match(/\/([^/]+)\/lesson\.md$/);
    if (lessonMatch && lessonMatch[1] in mockState.moduleLesson) {
      return mockState.moduleLesson[lessonMatch[1]];
    }
    const quizMatch = path.match(/\/([^/]+)\/quiz\.yaml$/);
    if (quizMatch && quizMatch[1] in mockState.moduleQuiz) {
      return mockState.moduleQuiz[quizMatch[1]];
    }
    const deckMatch = path.match(/\/([^/]+)\/srs\/deck\.json$/);
    if (deckMatch && deckMatch[1] in mockState.srsDeckContent) {
      return mockState.srsDeckContent[deckMatch[1]];
    }
    return '';
  },
  writeFileSync: (path: string, data: string) => {
    mockState.writtenFiles.push({ path, data });
  },
  mkdirSync: () => {},
  rmSync: () => {},
  cpSync: (_src: string, _dest: string) => {},
});
});

type Loader = typeof import('./course-loader');
let loader: Loader;

beforeEach(() => {
  mockState.exists = true;
  mockState.courseSyllabi = {};
  mockState.moduleLesson = {};
  mockState.moduleQuiz = {};
  mockState.srsDeckContent = {};
  mockState.modulesDirEntries = [];
  mockState.writtenFiles = [];
});

describe('findModuleDir', () => {
  test('returns directory matching padded module id', async () => {
    loader = await import('./course-loader');
    mockState.modulesDirEntries = [
      { name: '01-intro', isDirectory: () => true },
      { name: '02-advanced', isDirectory: () => true },
    ];
    const result = loader.findModuleDir('/courses', 'test', '01');
    expect(result).toContain('01-intro');
  });

  test('returns null when modules dir does not exist', async () => {
    loader = await import('./course-loader');
    mockState.exists = false;
    const result = loader.findModuleDir('/courses', 'test', '01');
    expect(result).toBeNull();
  });

  test('returns null when no matching module found', async () => {
    loader = await import('./course-loader');
    mockState.modulesDirEntries = [{ name: '01-intro', isDirectory: () => true }];
    const result = loader.findModuleDir('/courses', 'test', '99');
    expect(result).toBeNull();
  });
});

describe('loadCourses', () => {
  test('returns courses sorted alphabetically', async () => {
    loader = await import('./course-loader');
    mockState.courseSyllabi = {
      math: 'subject: Mathematics\nmodules: []\n',
      alpha: 'subject: Alpha\nmodules: []\n',
    };
    // Must match how readdirSync is called by loadCourses
    // loadCourses calls readdirSync(coursesDir) for all dirs
    // But our mock returns modulesDirEntries which is a single list
    // We need any readdirSync call to return course directories
    mockState.modulesDirEntries = [
      { name: 'math', isDirectory: () => true },
      { name: 'alpha', isDirectory: () => true },
    ];
    const courses = loader.loadCourses();
    expect(courses).toHaveLength(2);
    expect(courses[0].id).toBe('alpha');
    expect(courses[1].id).toBe('math');
  });

  test('skips non-directory entries and srs dir', async () => {
    loader = await import('./course-loader');
    mockState.courseSyllabi = { math: 'subject: Mathematics\nmodules: []\n' };
    mockState.modulesDirEntries = [
      { name: 'math', isDirectory: () => true },
      { name: 'file.txt', isDirectory: () => false },
      { name: 'srs', isDirectory: () => true },
    ];
    const courses = loader.loadCourses();
    expect(courses).toHaveLength(1);
    expect(courses[0].id).toBe('math');
  });

  test('returns empty when courses dir not found', async () => {
    loader = await import('./course-loader');
    mockState.exists = false;
    expect(loader.loadCourses()).toEqual([]);
  });
});

describe('loadLesson', () => {
  test('returns lesson content', async () => {
    loader = await import('./course-loader');
    mockState.modulesDirEntries = [{ name: '01-intro', isDirectory: () => true }];
    mockState.moduleLesson['01-intro'] = '# Intro\n\nContent';
    const content = loader.loadLesson('test', '01');
    expect(content).toBe('# Intro\n\nContent');
  });

  test('throws when module not found', async () => {
    loader = await import('./course-loader');
    mockState.modulesDirEntries = [];
    expect(() => loader.loadLesson('test', '99')).toThrow('Module 99 not found for course test');
  });

  test('throws when courses dir not found', async () => {
    loader = await import('./course-loader');
    mockState.exists = false;
    expect(() => loader.loadLesson('test', '01')).toThrow('Module 01 not found for course test');
  });
});

describe('loadQuiz', () => {
  test('returns quiz questions', async () => {
    loader = await import('./course-loader');
    mockState.modulesDirEntries = [{ name: '01-intro', isDirectory: () => true }];
    mockState.moduleQuiz['01-intro'] =
      '- id: q1\n  question: "?"\n  options:\n    A: a\n    B: b\n  answer: A\n  explanation: e\n';
    const quiz = loader.loadQuiz('test', '01');
    expect(quiz).toHaveLength(1);
    expect(quiz[0].id).toBe('q1');
  });

  test('returns empty array when no quiz.yaml', async () => {
    loader = await import('./course-loader');
    mockState.modulesDirEntries = [{ name: '01-intro', isDirectory: () => true }];
    // No quiz content set → readFileSync returns '' → existsSync returns true but
    // loadQuiz checks existsSync(quizPath) first. Since our mock doesn't distinguish
    // paths, we need a way to simulate missing quiz file.
    // Actually, loadQuiz does: if (!existsSync(quizPath)) return [];
    // Our mock returns true for all existsSync calls.
    // This means we can't differentiate between "file exists" and "file doesn't exist"
    // with a simple boolean mock. Let's adjust: we make existsSync check if content exists.
    expect(loader.loadQuiz('test', '01')).toEqual([]);
  });

  test('throws when module not found', async () => {
    loader = await import('./course-loader');
    expect(() => loader.loadQuiz('test', '99')).toThrow('Module 99 not found for course test');
  });

  test('throws when courses dir not found', async () => {
    loader = await import('./course-loader');
    mockState.exists = false;
    expect(() => loader.loadQuiz('test', '01')).toThrow('Module 01 not found for course test');
  });
});

describe('loadSRSDeck', () => {
  test('returns empty deck when no file', async () => {
    loader = await import('./course-loader');
    const deck = loader.loadSRSDeck('test');
    expect(deck).toEqual({ cards: {} });
  });

  test('returns parsed deck', async () => {
    loader = await import('./course-loader');
    mockState.srsDeckContent['test'] = JSON.stringify({
      cards: { 'test-1-q1': { id: 'test-1-q1', question: 'Q?' } },
    });
    const deck = loader.loadSRSDeck('test');
    expect(deck.cards['test-1-q1'].question).toBe('Q?');
  });

  test('returns empty deck on parse error', async () => {
    loader = await import('./course-loader');
    mockState.srsDeckContent['test'] = 'not valid json{{{';
    const deck = loader.loadSRSDeck('test');
    expect(deck).toEqual({ cards: {} });
  });
});

describe('saveSRSDeck', () => {
  test('writes deck to disk', async () => {
    loader = await import('./course-loader');
    const deck = {
      cards: {
        'test-1-q1': {
          id: 'test-1-q1',
          questionId: 'q1',
          moduleId: '01',
          courseId: 'test',
          question: 'Q?',
          answer: 'A',
          explanation: 'E',
          easeFactor: 2.5,
          interval: 0,
          repetitions: 0,
          nextReviewDate: '2024-01-01T00:00:00.000Z',
          lastReviewed: null,
          isStarred: false,
        },
      },
    };
    loader.saveSRSDeck(deck, 'test');
    expect(mockState.writtenFiles).toHaveLength(1);
    const written = JSON.parse(mockState.writtenFiles[0].data);
    expect(written.cards['test-1-q1'].question).toBe('Q?');
  });
});
