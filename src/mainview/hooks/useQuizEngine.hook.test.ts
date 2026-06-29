import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'bun:test';

import { clearMocks, deleteMock, mockResponse, setupRPC } from '../test-utils';
import { useQuizEngine } from './useQuizEngine';

setupRPC();

beforeEach(() => {
  clearMocks();
  mockResponse('logSession', { ok: true });
});

const aQuestion = {
  id: 'q1',
  question: 'What is 2+2?',
  options: { a: '3', b: '4', c: '5', d: '6' },
  answer: 'b',
  difficulty: 1,
  tags: [],
  explanation: '2+2=4',
};

describe('useQuizEngine', () => {
  test('initial state has status loading', async () => {
    mockResponse('quizStart', [aQuestion]);
    const { result } = renderHook(() => useQuizEngine('math', '01'));
    expect(result.current.status).toBe('loading');
    expect(result.current.questions).toEqual([]);
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.currentQuestion).toBeUndefined();
    expect(result.current.score).toBe(0);
    expect(result.current.percentage).toBe(0);
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });

  test('loads questions and transitions to ready', async () => {
    mockResponse('quizStart', [aQuestion]);
    const { result } = renderHook(() => useQuizEngine('math', '01'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.questions).toEqual([aQuestion]);
    expect(result.current.currentQuestion).toEqual(aQuestion);
  });

  test('load failed shows empty questions', async () => {
    const origError = console.error;
    const origWarn = console.warn;
    console.error = () => {};
    console.warn = () => {};

    deleteMock('quizStart');
    const { result } = renderHook(() => useQuizEngine('math', '01'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.questions).toEqual([]);

    console.error = origError;
    console.warn = origWarn;
  });

  test('selectAnswer records answer', async () => {
    mockResponse('quizStart', [aQuestion]);
    const { result } = renderHook(() => useQuizEngine('math', '01'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => result.current.selectAnswer('b'));
    expect(result.current.selectedAnswers['q1']).toBe('b');
  });

  test('selectAnswer updates hasAnswer', async () => {
    mockResponse('quizStart', [aQuestion]);
    const { result } = renderHook(() => useQuizEngine('math', '01'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.hasAnswer).toBe(false);
    act(() => result.current.selectAnswer('b'));
    expect(result.current.hasAnswer).toBe(true);
  });

  test('nextQuestion increments index', async () => {
    mockResponse('quizStart', [aQuestion, { ...aQuestion, id: 'q2', question: 'Q2?' }]);
    const { result } = renderHook(() => useQuizEngine('math', '01'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => result.current.nextQuestion());
    expect(result.current.currentIndex).toBe(1);
    expect(result.current.currentQuestion?.id).toBe('q2');
  });

  test('nextQuestion on last question sets completed', async () => {
    mockResponse('quizStart', [aQuestion]);
    const { result } = renderHook(() => useQuizEngine('math', '01'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => result.current.nextQuestion());
    expect(result.current.status).toBe('completed');
  });

  test('skipQuestion increments index', async () => {
    mockResponse('quizStart', [aQuestion, { ...aQuestion, id: 'q2', question: 'Q2?' }]);
    const { result } = renderHook(() => useQuizEngine('math', '01'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => result.current.skipQuestion());
    expect(result.current.currentIndex).toBe(1);
  });

  test('skipQuestion on last question sets completed', async () => {
    mockResponse('quizStart', [aQuestion]);
    const { result } = renderHook(() => useQuizEngine('math', '01'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => result.current.skipQuestion());
    expect(result.current.status).toBe('completed');
  });

  test('retry resets to first question', async () => {
    mockResponse('quizStart', [aQuestion, { ...aQuestion, id: 'q2', question: 'Q2?' }]);
    const { result } = renderHook(() => useQuizEngine('math', '01'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => result.current.selectAnswer('b'));
    act(() => result.current.nextQuestion());
    act(() => result.current.selectAnswer('c'));
    act(() => result.current.retry());
    expect(result.current.status).toBe('ready');
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.selectedAnswers).toEqual({});
  });

  test('score and percentage computed correctly', async () => {
    mockResponse('quizStart', [
      aQuestion,
      { ...aQuestion, id: 'q2', question: 'Q2?', answer: 'c' },
    ]);
    const { result } = renderHook(() => useQuizEngine('math', '01'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => result.current.selectAnswer('b'));
    act(() => result.current.nextQuestion());
    act(() => result.current.selectAnswer('a'));
    expect(result.current.score).toBe(1);
    expect(result.current.percentage).toBe(50);
  });
});
