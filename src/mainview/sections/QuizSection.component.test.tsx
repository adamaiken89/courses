import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, mock, test } from 'bun:test';

import type { QuizQuestion } from '../../bun/types';

type QuizStatus = 'loading' | 'ready' | 'completed';

const selectAnswer = mock<(answer: string) => void>();
const nextQuestion = mock<() => void>();
const skipQuestion = mock<() => void>();
const retry = mock<() => void>();

const mockActions = { selectAnswer, nextQuestion, skipQuestion, retry };

const mockReturn: {
  status: QuizStatus;
  questions: QuizQuestion[];
  currentIndex: number;
  selectedAnswers: Record<string, string>;
  currentQuestion: QuizQuestion | undefined;
  hasAnswer: boolean;
  score: number;
  percentage: number;
} = {
  status: 'ready',
  questions: [],
  currentIndex: 0,
  selectedAnswers: {},
  currentQuestion: undefined,
  hasAnswer: false,
  score: 0,
  percentage: 0,
};

void mock.module('../hooks/useQuizEngine', () => ({
  useQuizEngine: () => ({
    ...mockReturn,
    ...mockActions,
    get currentQuestion() {
      return mockReturn.questions[mockReturn.currentIndex] ?? undefined;
    },
    get hasAnswer() {
      const q = mockReturn.questions[mockReturn.currentIndex];
      return q ? mockReturn.selectedAnswers[q.id] !== undefined : false;
    },
    get score() {
      return mockReturn.questions.filter(
        (q: QuizQuestion) => mockReturn.selectedAnswers[q.id] === q.answer,
      ).length;
    },
    get percentage() {
      return mockReturn.questions.length > 0
        ? Math.round((mockReturn.score / mockReturn.questions.length) * 100)
        : 0;
    },
  }),
}));

import QuizSection from './QuizSection';

function makeQuestion(id: string, overrides?: Partial<Omit<QuizQuestion, 'id'>>): QuizQuestion {
  return {
    id,
    question: 'What is 2+2?',
    options: { A: '3', B: '4', C: '5', D: '6' },
    answer: 'B',
    explanation: 'Simple addition',
    difficulty: 1,
    tags: ['math'],
    ...overrides,
  };
}

beforeEach(() => {
  mockReturn.status = 'ready';
  mockReturn.questions = [];
  mockReturn.currentIndex = 0;
  mockReturn.selectedAnswers = {};
  selectAnswer.mockReset();
  nextQuestion.mockReset();
  skipQuestion.mockReset();
  retry.mockReset();
});

describe('QuizSection', () => {
  const props = { courseId: 'cs101', moduleId: 'mod-01' };

  test('renders loading state', () => {
    mockReturn.status = 'loading';
    const { container } = render(<QuizSection {...props} />);
    expect(container.textContent).toContain('Loading quiz');
  });

  test('renders empty state when no questions', () => {
    const { container } = render(<QuizSection {...props} />);
    expect(container.textContent).toContain('No quiz questions');
  });

  test('renders active question with options', () => {
    mockReturn.questions = [makeQuestion('q1')];
    const { container } = render(<QuizSection {...props} />);
    expect(container.textContent).toContain('What is 2+2?');
    expect(container.textContent).toContain('Skip');
    expect(container.textContent).toContain('Finish Quiz');
  });

  test('calls selectAnswer when option clicked', () => {
    mockReturn.questions = [makeQuestion('q1')];
    const { getByText } = render(<QuizSection {...props} />);
    fireEvent.click(getByText('4'));
    expect(selectAnswer).toHaveBeenCalledTimes(1);
    expect(selectAnswer).toHaveBeenCalledWith('B');
  });

  test('shows explanation after answering', () => {
    mockReturn.questions = [makeQuestion('q1')];
    mockReturn.selectedAnswers = { q1: 'B' };
    const { container } = render(<QuizSection {...props} />);
    expect(container.textContent).toContain('Simple addition');
  });

  test('calls nextQuestion when next clicked', () => {
    mockReturn.questions = [makeQuestion('q1'), makeQuestion('q2', { question: 'What is 3+3?' })];
    mockReturn.selectedAnswers = { q1: 'B' };
    mockReturn.hasAnswer = true;
    const { getByText } = render(<QuizSection {...props} />);
    fireEvent.click(getByText('Next Question'));
    expect(nextQuestion).toHaveBeenCalledTimes(1);
  });

  test('shows completed state with score and retry', () => {
    mockReturn.status = 'completed';
    mockReturn.questions = [makeQuestion('q1')];
    mockReturn.selectedAnswers = { q1: 'B' };
    mockReturn.score = 1;
    mockReturn.percentage = 100;
    const { container } = render(<QuizSection {...props} />);
    expect(container.textContent).toContain('Quiz Complete');
    expect(container.textContent).toContain('100%');
    expect(container.textContent).toContain('Retry');
  });

  test('calls retry when retry button clicked', () => {
    mockReturn.status = 'completed';
    mockReturn.questions = [makeQuestion('q1')];
    mockReturn.selectedAnswers = { q1: 'B' };
    mockReturn.score = 1;
    mockReturn.percentage = 100;
    const { getByText } = render(<QuizSection {...props} />);
    fireEvent.click(getByText('Retry'));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
