import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, mock, test } from 'bun:test';

import type { SRSCard } from '../../bun/types';
import type { FilterMode } from '../hooks/useCardReviewState';

type SetShowAnswer = (v: boolean) => void;
type SetFilter = (f: FilterMode) => void;

const setShowAnswer = mock<SetShowAnswer>();
const setFilter = mock<SetFilter>();
const handleReview = mock<(correct: boolean) => Promise<void>>();
const handleToggleStar = mock<() => Promise<void>>();
const reload = mock<() => void>();

const mockActions = { setShowAnswer, setFilter, handleReview, handleToggleStar, reload };

const mockReturn: {
  cards: SRSCard[];
  loading: boolean;
  currentIndex: number;
  showAnswer: boolean;
  filter: FilterMode;
  deck: { cards: Record<string, SRSCard> };
  currentCard: SRSCard | undefined;
} = {
  cards: [],
  loading: false,
  currentIndex: 0,
  showAnswer: false,
  filter: 'all',
  deck: { cards: {} },
  currentCard: undefined,
};

void mock.module('../hooks/useReviewState', () => ({
  useReviewState: () => ({
    ...mockReturn,
    ...mockActions,
    get currentCard() { return mockReturn.cards[mockReturn.currentIndex] ?? undefined; },
  }),
}));

import ReviewSection from './ReviewSection';

function makeCard(id: string, overrides?: Partial<Omit<SRSCard, 'id'>>): SRSCard {
  return {
    id,
    questionId: 'q1',
    moduleId: 'mod-01',
    courseId: 'cs101',
    question: 'What is 2+2?',
    answer: '4',
    explanation: 'Simple addition',
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewDate: new Date(Date.now() + 86400000).toISOString(),
    lastReviewed: null,
    isStarred: false,
    ...overrides,
  };
}

beforeEach(() => {
  mockReturn.cards = [];
  mockReturn.loading = false;
  mockReturn.currentIndex = 0;
  mockReturn.showAnswer = false;
  mockReturn.filter = 'all';
  setShowAnswer.mockReset();
  setFilter.mockReset();
  handleReview.mockReset();
  handleToggleStar.mockReset();
  reload.mockReset();
});

describe('ReviewSection', () => {
  const props = { courseId: 'cs101' };

  test('renders loading state', () => {
    mockReturn.loading = true;
    const { container } = render(<ReviewSection {...props} />);
    expect(container.textContent).toContain('Loading review cards');
  });

  test('renders empty state when no cards', () => {
    const { container } = render(<ReviewSection {...props} />);
    expect(container.textContent).toContain('No cards in deck');
    expect(container.textContent).toContain('Complete a quiz');
  });

  test('renders card with question and show answer button', () => {
    mockReturn.cards = [makeCard('c1')];
    const { container } = render(<ReviewSection {...props} />);
    expect(container.textContent).toContain('What is 2+2?');
    expect(container.textContent).toContain('Show Answer');
  });

  test('shows answer when show answer clicked', () => {
    mockReturn.cards = [makeCard('c1')];
    const { getByText } = render(<ReviewSection {...props} />);
    fireEvent.click(getByText('Show Answer'));
    expect(setShowAnswer).toHaveBeenCalledWith(true);
  });

  test('shows answer side with question, answer, explanation', () => {
    mockReturn.cards = [makeCard('c1')];
    mockReturn.showAnswer = true;
    const { container } = render(<ReviewSection {...props} />);
    expect(container.textContent).toContain('What is 2+2?');
    expect(container.textContent).toContain('4');
    expect(container.textContent).toContain('Simple addition');
    expect(container.textContent).toContain('Forgot');
    expect(container.textContent).toContain('Remembered');
  });

  test('calls handleReview with correct on remembered', () => {
    mockReturn.cards = [makeCard('c1')];
    mockReturn.showAnswer = true;
    const { getByText } = render(<ReviewSection {...props} />);
    fireEvent.click(getByText('Remembered'));
    expect(handleReview).toHaveBeenCalledWith(true);
  });

  test('calls handleReview with false on forgot', () => {
    mockReturn.cards = [makeCard('c1')];
    mockReturn.showAnswer = true;
    const { getByText } = render(<ReviewSection {...props} />);
    fireEvent.click(getByText('Forgot'));
    expect(handleReview).toHaveBeenCalledWith(false);
  });

  test('shows star icon for starred card', () => {
    mockReturn.cards = [makeCard('c1', { isStarred: true })];
    const { container } = render(<ReviewSection {...props} />);
    expect(container.textContent).toContain('★');
    expect(container.textContent).toContain('Unstar');
  });

  test('shows unstarred option for non-starred card', () => {
    mockReturn.cards = [makeCard('c1', { isStarred: false })];
    const { container } = render(<ReviewSection {...props} />);
    expect(container.textContent).toContain('☆ Star');
  });

  test('calls handleToggleStar when star button clicked', () => {
    mockReturn.cards = [makeCard('c1', { isStarred: true })];
    const { container } = render(<ReviewSection {...props} />);
    const buttons = container.querySelectorAll('button');
    fireEvent.click(buttons[buttons.length - 1]);
    expect(handleToggleStar).toHaveBeenCalledTimes(1);
  });

  test('renders filter buttons', () => {
    mockReturn.cards = [makeCard('c1')];
    const { container } = render(<ReviewSection {...props} />);
    expect(container.textContent).toContain('All');
    expect(container.textContent).toContain('Due');
    expect(container.textContent).toContain('Starred');
  });

  test('calls setFilter when filter clicked', () => {
    mockReturn.cards = [makeCard('c1')];
    const { getByText } = render(<ReviewSection {...props} />);
    fireEvent.click(getByText('Due'));
    expect(setFilter).toHaveBeenCalledWith('due');
  });

  test('shows empty state messages per filter', () => {
    mockReturn.filter = 'due';
    const { container } = render(<ReviewSection {...props} />);
    expect(container.textContent).toContain('No cards due');
  });
});
