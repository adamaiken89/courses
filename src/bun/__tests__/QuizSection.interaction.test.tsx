import { describe, expect, test, afterEach } from 'bun:test';
import { render, waitFor, act } from '@testing-library/react';
import QuizSection from '../../mainview/sections/QuizSection';
import { mockFetch, restoreFetch } from './mock-fetch';
import '../../mainview/i18n';

const mockQuestions = [
  {
    id: 'q1',
    question: 'What is 2+2?',
    options: { A: '3', B: '4', C: '5' },
    answer: 'B',
    explanation: 'Basic addition',
    difficulty: 1,
    tags: ['math'],
  },
  {
    id: 'q2',
    question: 'What color is sky?',
    options: { A: 'Red', B: 'Green', C: 'Blue' },
    answer: 'C',
    explanation: 'Light scattering',
    difficulty: 1,
    tags: ['science'],
  },
];

const defaultProps = { courseId: 'test', moduleId: '01' };

afterEach(restoreFetch);

describe('QuizSection interaction', () => {
  test('renders first question after loading', async () => {
    mockFetch({ '/quiz/start': mockQuestions });
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<QuizSection {...defaultProps} />));
    });
    await waitFor(() => expect(container.textContent).toContain('What is 2+2?'));
  });

  test('shows answer options', async () => {
    mockFetch({ '/quiz/start': mockQuestions });
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<QuizSection {...defaultProps} />));
    });
    await waitFor(() => {
      expect(container.textContent).toContain('3');
      expect(container.textContent).toContain('4');
      expect(container.textContent).toContain('5');
    });
  });

  test('shows empty state when no questions', async () => {
    mockFetch({ '/quiz/start': [] });
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<QuizSection {...defaultProps} />));
    });
    await waitFor(() => expect(container.textContent).toMatch(/no quiz/i));
  });

  test('shows loading state initially', async () => {
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<QuizSection {...defaultProps} />));
    });
    expect(container.innerHTML).toMatchSnapshot();
  });
});
