import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, test } from 'bun:test';

import type { QuizQuestion } from '../../bun/types';
import { __setRPC } from '../api';

const mockResponses = new Map<string, unknown>();
const mockRPC = {
  request: new Proxy({} as Record<string, (p: unknown) => Promise<unknown>>, {
    get(_, method: string) {
      return (_p: unknown) => {
        if (!mockResponses.has(method)) return Promise.reject(new Error(`No mock for ${method}`));
        return Promise.resolve(mockResponses.get(method));
      };
    },
  }),
};

function mockResponse(method: string, data: unknown) {
  mockResponses.set(method, data);
}

function makeQuestion(id: string, overrides?: Partial<Omit<QuizQuestion, 'id'>>): QuizQuestion {
  return {
    id,
    question: `Question ${id}?`,
    options: { A: `${id}-A`, B: `${id}-B`, C: `${id}-C`, D: `${id}-D` },
    answer: 'B',
    explanation: `Explanation ${id}`,
    difficulty: 1,
    tags: [],
    ...overrides,
  };
}

beforeAll(() => __setRPC(mockRPC));
beforeEach(() => {
  mockResponses.clear();
  mockResponse('quizStart', []);
  mockResponse('logSession', undefined);
});

import QuizSection from './QuizSection';

describe('QuizSection', () => {
  const props = { courseId: 'cs101', moduleId: 'mod-01' };

  test('renders loading state', async () => {
    mockResponse('quizStart', new Promise(() => {}));
    const { container } = render(<QuizSection {...props} />);
    expect(container.textContent).toContain('Loading quiz');
  });

  test('renders empty state when no questions', async () => {
    mockResponse('quizStart', []);
    const { container } = render(<QuizSection {...props} />);
    await waitFor(() => {
      expect(container.textContent).toContain('No quiz questions');
    });
  });

  test('renders active question with options', async () => {
    mockResponse('quizStart', [makeQuestion('q1')]);
    const { container } = render(<QuizSection {...props} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Question q1?');
    });
    expect(container.textContent).toContain('Skip');
  });

  test('shows explanation after answering', async () => {
    mockResponse('quizStart', [makeQuestion('q1')]);
    const { container, getByText } = render(<QuizSection {...props} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Question q1?');
    });
    fireEvent.click(getByText('q1-B'));
    await waitFor(() => {
      expect(container.textContent).toContain('Explanation q1');
    });
  });

  test('shows next/finish button after answering', async () => {
    mockResponse('quizStart', [makeQuestion('q1'), makeQuestion('q2')]);
    const { container, getByText } = render(<QuizSection {...props} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Question q1?');
    });
    fireEvent.click(getByText('q1-B'));
    await waitFor(() => {
      expect(container.textContent).toContain('Next Question');
    });
  });

  test('advances to next question', async () => {
    mockResponse('quizStart', [makeQuestion('q1'), makeQuestion('q2')]);
    const { container, getByText } = render(<QuizSection {...props} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Question q1?');
    });
    fireEvent.click(getByText('q1-B'));
    await waitFor(() => {
      expect(container.textContent).toContain('Next Question');
    });
    fireEvent.click(getByText('Next Question'));
    await waitFor(() => {
      expect(container.textContent).toContain('Question q2?');
    });
  });

  test('shows completed state with score', async () => {
    mockResponse('quizStart', [makeQuestion('q1')]);
    const { container, getByText } = render(<QuizSection {...props} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Question q1?');
    });
    fireEvent.click(getByText('q1-B'));
    await waitFor(() => {
      expect(container.textContent).toContain('Finish Quiz');
    });
    fireEvent.click(getByText('Finish Quiz'));
    await waitFor(() => {
      expect(container.textContent).toContain('Quiz Complete');
      expect(container.textContent).toContain('100%');
    });
  });

  test('shows retry button in completed state', async () => {
    mockResponse('quizStart', [makeQuestion('q1')]);
    const { container, getByText } = render(<QuizSection {...props} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Question q1?');
    });
    fireEvent.click(getByText('q1-B'));
    await waitFor(() => {
      expect(container.textContent).toContain('Finish Quiz');
    });
    fireEvent.click(getByText('Finish Quiz'));
    await waitFor(() => {
      expect(container.textContent).toContain('Retry');
    });
  });

  test('retry resets to first question', async () => {
    mockResponse('quizStart', [makeQuestion('q1')]);
    const { container, getByText } = render(<QuizSection {...props} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Question q1?');
    });
    fireEvent.click(getByText('q1-B'));
    await waitFor(() => {
      expect(container.textContent).toContain('Finish Quiz');
    });
    fireEvent.click(getByText('Finish Quiz'));
    await waitFor(() => {
      expect(container.textContent).toContain('Retry');
    });
    fireEvent.click(getByText('Retry'));
    await waitFor(() => {
      expect(container.textContent).toContain('Question q1?');
      expect(container.textContent).toContain('Skip');
    });
  });

  test('skip advances to next question', async () => {
    mockResponse('quizStart', [makeQuestion('q1'), makeQuestion('q2')]);
    const { container, getByText } = render(<QuizSection {...props} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Question q1?');
    });
    fireEvent.click(getByText('Skip'));
    await waitFor(() => {
      expect(container.textContent).toContain('Question q2?');
    });
  });
});
