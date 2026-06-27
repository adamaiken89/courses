import { describe, expect, test, afterEach } from 'bun:test';
import { render, waitFor, act } from '@testing-library/react';
import QuizSection from '../../mainview/sections/QuizSection';
import { mockFetch, restoreFetch } from './mock-fetch';

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

const defaultProps = {
  courseId: 'test',
  moduleId: '01',
  onBack: () => {},
};

afterEach(restoreFetch);

describe('QuizSection snapshots', () => {
  test('loading state', async () => {
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<QuizSection {...defaultProps} />));
    });
    expect(container.innerHTML).toMatchSnapshot();
  });

  test('empty quiz (no questions)', async () => {
    mockFetch({ '/quiz/start': [] });
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<QuizSection {...defaultProps} />));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await waitFor(() => expect(container.textContent).toContain('No quiz questions'));
    expect(container.innerHTML).toMatchSnapshot();
  });

  test('first question displayed', async () => {
    mockFetch({ '/quiz/start': mockQuestions });
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<QuizSection {...defaultProps} />));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await waitFor(() => expect(container.textContent).toContain('What is 2+2?'));
    expect(container.innerHTML).toMatchSnapshot();
  });
});
