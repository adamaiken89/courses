import { describe, expect, test, afterEach } from 'bun:test';
import { api } from '../../mainview/api';
import { mockFetch, restoreFetch } from './mock-fetch';
import type { SearchResult } from '../../bun/search';

afterEach(restoreFetch);

describe('api', () => {
  test('courses.list returns courses', async () => {
    const mockCourses = [
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
    ];
    mockFetch({ '/courses': mockCourses });
    const result = await api.courses.list();
    expect(result).toEqual(mockCourses);
  });

  test('courses.modules returns modules', async () => {
    const mockModules = [
      { id: '01', name: 'Algebra', timeHours: 3, prerequisites: [], topics: [] },
    ];
    mockFetch({ '/courses/math/modules': mockModules });
    const result = await api.courses.modules('math');
    expect(result).toEqual(mockModules);
  });

  test('courses.lesson returns lesson response', async () => {
    const mockLesson = {
      content: '# Algebra',
      h1: 'Algebra',
      meta: [],
      sections: [],
      bodyContent: '',
    };
    mockFetch({ '/courses/math/modules/01/lesson': mockLesson });
    const result = await api.courses.lesson('math', '01');
    expect(result.content).toBe('# Algebra');
  });

  test('courses.quiz returns quiz questions', async () => {
    const mockQuiz = [
      {
        id: 'q1',
        question: 'What is 2+2?',
        options: { A: '3', B: '4' },
        answer: 'B',
        explanation: 'Math',
        difficulty: 1,
        tags: [],
      },
    ];
    mockFetch({ '/courses/math/modules/01/quiz': mockQuiz });
    const result = await api.courses.quiz('math', '01');
    expect(result).toHaveLength(1);
  });

  test('courses.srs.get returns deck', async () => {
    const mockDeck = { cards: {} };
    mockFetch({ '/courses/math/srs': mockDeck });
    const result = await api.courses.srs.get('math');
    expect(result).toEqual(mockDeck);
  });

  test('search returns search results', async () => {
    const mockResults: SearchResult[] = [
      {
        type: 'lesson',
        courseID: 'math',
        courseName: 'Math',
        moduleID: '01',
        moduleName: 'Algebra',
        sectionID: 's1',
        snippet: 'Algebra',
      },
    ];
    mockFetch({ '/search': mockResults });
    const result = await api.search('algebra');
    expect(result).toEqual(mockResults);
  });

  test('search with courseID includes param', async () => {
    const mockResults: SearchResult[] = [];
    mockFetch({ '/search': mockResults });
    const result = await api.search('algebra', 'math');
    expect(result).toEqual(mockResults);
  });

  test('quiz.start returns questions', async () => {
    const mockQuestions = [
      {
        id: 'q1',
        question: '?',
        options: { A: '1' },
        answer: 'A',
        explanation: '',
        difficulty: 1,
        tags: [],
      },
    ];
    mockFetch({ '/quiz/start': mockQuestions });
    const result = await api.quiz.start('math', '01');
    expect(result).toEqual(mockQuestions);
  });

  test('quiz.select sends answer', async () => {
    mockFetch({ '/quiz/select': { ok: true } });
    const result = await api.quiz.select('A');
    expect(result).toEqual({ ok: true });
  });

  test('storage.highlights returns highlights', async () => {
    const mockHighlights = [
      {
        id: 'h1',
        courseID: 'math',
        moduleID: '01',
        selectedText: 'text',
        color: 'yellow',
        startOffset: 0,
        endOffset: 4,
        createdAt: '2024-01-01',
      },
    ];
    mockFetch({ '/storage/highlights': mockHighlights });
    const result = await api.storage.highlights('math', '01');
    expect(result).toEqual(mockHighlights);
  });

  test('storage.addHighlight creates highlight', async () => {
    const mockHL = {
      id: 'h1',
      courseID: 'math',
      moduleID: '01',
      selectedText: 'text',
      color: 'green',
      startOffset: 0,
      endOffset: 4,
      createdAt: '2024-01-01',
    };
    mockFetch({ '/storage/highlights': mockHL });
    const result = await api.storage.addHighlight({
      courseID: 'math',
      moduleID: '01',
      selectedText: 'text',
      startOffset: 0,
      endOffset: 4,
      color: 'green',
    });
    expect(result.color).toBe('green');
  });

  test('gemini.hasKey returns key status', async () => {
    mockFetch({ '/gemini/key': { hasKey: true } });
    const result = await api.gemini.hasKey();
    expect(result.hasKey).toBe(true);
  });

  test('gemini.setKey posts key', async () => {
    mockFetch({ '/gemini/key': { ok: true } });
    const result = await api.gemini.setKey('sk-123');
    expect(result).toEqual({ ok: true });
  });

  test('usercards.list returns user cards', async () => {
    const mockCards = [
      {
        id: 'uc1',
        courseId: 'math',
        moduleId: '01',
        front: 'Q?',
        back: 'A.',
        easeFactor: 2.5,
        interval: 0,
        repetitions: 0,
        nextReviewDate: new Date().toISOString(),
        lastReviewed: null,
        isStarred: false,
        createdAt: new Date().toISOString(),
      },
    ];
    mockFetch({ '/usercards': mockCards });
    const result = await api.usercards.list('math');
    expect(result).toHaveLength(1);
  });

  test('throws on non-ok response', async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
      })) as unknown as typeof globalThis.fetch;
    expect(api.courses.list()).rejects.toThrow('Not found');
  });

  test('sync.status returns sync info', async () => {
    const mockStatus = {
      lastSyncTime: '2024-01-01T00:00:00Z',
      lastSyncedCommit: 'abc',
      isSyncing: false,
      remoteRepoURL: '',
    };
    mockFetch({ '/sync/status': mockStatus });
    const result = await api.sync.status();
    expect(result.lastSyncTime).toBe('2024-01-01T00:00:00Z');
  });
});
