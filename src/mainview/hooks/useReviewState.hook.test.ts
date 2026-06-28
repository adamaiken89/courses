import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, mock, test } from 'bun:test';

import type { SRSCard } from '../../bun/types';

const mockGetSRSDeck = mock<(courseId: string) => Promise<{ cards: Record<string, SRSCard> }>>();
const mockReviewSRSCard =
  mock<(courseId: string, cardId: string, correct: boolean, deck: unknown) => Promise<SRSCard>>();
const mockToggleSRSStar = mock<(courseId: string, cardId: string) => Promise<void>>();

void mock.module('../api', () => ({
  api: {
    courses: {
      srs: {
        get: (courseId: string) => mockGetSRSDeck(courseId),
        review: (courseId: string, cardId: string, correct: boolean, deck: unknown) =>
          mockReviewSRSCard(courseId, cardId, correct, deck),
        toggleStar: (courseId: string, cardId: string) => mockToggleSRSStar(courseId, cardId),
      },
    },
  },
  __setRPC: mock(() => {}),
}));

import { useReviewState } from './useReviewState';

function baseCard(id: string): SRSCard {
  return {
    id,
    questionId: 'q1',
    moduleId: '01',
    courseId: 'math',
    question: 'Q?',
    answer: 'A',
    explanation: 'E',
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewDate: '2024-01-01T00:00:00.000Z',
    lastReviewed: null,
    isStarred: false,
  };
}

beforeEach(() => {
  mockGetSRSDeck.mockReset();
  mockReviewSRSCard.mockReset();
  mockToggleSRSStar.mockReset();
});

describe('useReviewState', () => {
  test('loads cards on mount', async () => {
    const cards = [{ ...baseCard('c1') }];
    mockGetSRSDeck.mockResolvedValue({ cards: { c1: cards[0] } });
    mockReviewSRSCard.mockResolvedValue(cards[0]);

    const { result } = renderHook(() => useReviewState('math'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.cards).toHaveLength(1);
    expect(result.current.currentCard?.id).toBe('c1');
  });

  test('respects due filter', async () => {
    const futureCard = { ...baseCard('c1'), nextReviewDate: '2099-01-01T00:00:00.000Z' };
    mockGetSRSDeck.mockResolvedValue({ cards: { c1: futureCard } });

    const { result } = renderHook(() => useReviewState('math'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.cards).toHaveLength(0);
    expect(result.current.currentCard).toBeUndefined();
  });

  test('setFilter changes filter and reloads', async () => {
    const cards = [
      { ...baseCard('c1'), isStarred: true },
      { ...baseCard('c2'), isStarred: false },
    ];
    mockGetSRSDeck.mockResolvedValue({ cards: { c1: cards[0], c2: cards[1] } });
    mockReviewSRSCard.mockResolvedValue(cards[0]);

    const { result } = renderHook(() => useReviewState('math'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.cards).toHaveLength(2);

    act(() => result.current.setFilter('starred'));
    await waitFor(() => expect(result.current.filter).toBe('starred'));
    expect(result.current.cards).toHaveLength(1);
    expect(result.current.currentCard?.id).toBe('c1');
  });

  test('handleReview calls API and advances', async () => {
    const cards = [{ ...baseCard('c1') }, { ...baseCard('c2') }];
    mockGetSRSDeck.mockResolvedValue({ cards: { c1: cards[0], c2: cards[1] } });
    mockReviewSRSCard.mockResolvedValue(cards[0]);

    const { result } = renderHook(() => useReviewState('math'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.currentIndex).toBe(0);

    await act(async () => {
      await result.current.handleReview(true);
    });

    expect(result.current.currentIndex).toBe(1);
    expect(result.current.currentCard?.id).toBe('c2');
    expect(mockReviewSRSCard).toHaveBeenCalledTimes(1);
  });

  test('handleToggleStar toggles star in state', async () => {
    const cards = [{ ...baseCard('c1') }];
    mockGetSRSDeck.mockResolvedValue({ cards: { c1: cards[0] } });
    mockToggleSRSStar.mockResolvedValue(undefined);

    const { result } = renderHook(() => useReviewState('math'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.currentCard?.isStarred).toBe(false);

    await act(async () => {
      await result.current.handleToggleStar();
    });

    expect(result.current.currentCard?.isStarred).toBe(true);
    expect(mockToggleSRSStar).toHaveBeenCalledWith('math', 'c1');
  });

  test('reload re-fetches deck', async () => {
    const cards = [{ ...baseCard('c1') }];
    mockGetSRSDeck.mockResolvedValue({ cards: { c1: cards[0] } });

    const { result } = renderHook(() => useReviewState('math'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.currentCard?.id).toBe('c1');

    const newCards = [{ ...baseCard('c2') }];
    mockGetSRSDeck.mockResolvedValue({ cards: { c2: newCards[0] } });

    act(() => result.current.reload());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.currentCard?.id).toBe('c2');
  });
});
