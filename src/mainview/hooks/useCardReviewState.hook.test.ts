import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, mock, test } from 'bun:test';

import { useCardReviewState } from './useCardReviewState';

interface TestCard {
  id: string;
  front: string;
  isStarred: boolean;
  dueDate: string;
}

const now = new Date('2024-06-15T12:00:00Z');

function makeCard(overrides: Partial<TestCard> & { id: string }): TestCard {
  return {
    front: 'Q?',
    isStarred: false,
    dueDate: '2024-06-10T00:00:00Z',
    ...overrides,
  };
}

const mockFetchAll = mock<() => Promise<TestCard[]>>();
const mockFilterCards = mock<(cards: TestCard[], filter: string) => TestCard[]>();
const mockReviewCard = mock<(card: TestCard, correct: boolean) => Promise<void>>();
const mockToggleStar = mock<(card: TestCard) => Promise<TestCard>>();
const mockIsStarred = mock<(card: TestCard) => boolean>();

function defaultFilterCards(cards: TestCard[], filter: string) {
  if (filter === 'starred') return cards.filter((c) => c.isStarred);
  if (filter === 'due') return cards.filter((c) => new Date(c.dueDate) <= now);
  return cards;
}

function defaultIsStarred(card: TestCard) {
  return card.isStarred;
}

beforeEach(() => {
  mockFetchAll.mockReset();
  mockFilterCards.mockReset();
  mockReviewCard.mockReset();
  mockToggleStar.mockReset();
  mockIsStarred.mockReset();
});

describe('useCardReviewState', () => {
  test('loads cards with due filter on mount', async () => {
    const cards = [makeCard({ id: 'a' }), makeCard({ id: 'b', dueDate: '2024-06-20T00:00:00Z' })];
    mockFetchAll.mockResolvedValue(cards);
    mockFilterCards.mockImplementation((all, _f) => defaultFilterCards(all, _f));

    const { result } = renderHook(() =>
      useCardReviewState({
        fetchAll: mockFetchAll,
        filterCards: mockFilterCards,
        reviewCard: mockReviewCard,
        toggleStar: mockToggleStar,
        isStarred: defaultIsStarred,
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.cards).toHaveLength(1);
    expect(result.current.currentCard?.id).toBe('a');
  });

  test('sets loading true initially', () => {
    mockFetchAll.mockImplementation(() => new Promise(() => {}));
    mockFilterCards.mockImplementation((all) => all);

    const { result } = renderHook(() =>
      useCardReviewState({
        fetchAll: mockFetchAll,
        filterCards: mockFilterCards,
        reviewCard: mockReviewCard,
        toggleStar: mockToggleStar,
        isStarred: defaultIsStarred,
      }),
    );

    expect(result.current.loading).toBe(true);
  });

  test('handles fetch error gracefully', async () => {
    mockFetchAll.mockRejectedValue(new Error('fetch failed'));
    mockFilterCards.mockImplementation((all) => all);

    const { result } = renderHook(() =>
      useCardReviewState({
        fetchAll: mockFetchAll,
        filterCards: mockFilterCards,
        reviewCard: mockReviewCard,
        toggleStar: mockToggleStar,
        isStarred: defaultIsStarred,
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.cards).toEqual([]);
  });

  test('setShowAnswer toggles showAnswer', async () => {
    mockFetchAll.mockResolvedValue([makeCard({ id: 'a' })]);
    mockFilterCards.mockImplementation((all) => all);

    const { result } = renderHook(() =>
      useCardReviewState({
        fetchAll: mockFetchAll,
        filterCards: mockFilterCards,
        reviewCard: mockReviewCard,
        toggleStar: mockToggleStar,
        isStarred: defaultIsStarred,
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.showAnswer).toBe(false);
    act(() => result.current.setShowAnswer(true));
    expect(result.current.showAnswer).toBe(true);
  });

  test('handleReview advances to next card', async () => {
    const cards = [makeCard({ id: 'a' }), makeCard({ id: 'b' })];
    mockFetchAll.mockResolvedValue(cards);
    mockFilterCards.mockImplementation((all) => all);
    mockReviewCard.mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useCardReviewState({
        fetchAll: mockFetchAll,
        filterCards: mockFilterCards,
        reviewCard: mockReviewCard,
        toggleStar: mockToggleStar,
        isStarred: defaultIsStarred,
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.currentIndex).toBe(0);

    await act(async () => {
      await result.current.handleReview(true);
    });

    expect(result.current.currentIndex).toBe(1);
    expect(result.current.currentCard?.id).toBe('b');
    expect(result.current.showAnswer).toBe(false);
    expect(mockReviewCard).toHaveBeenCalledTimes(1);
    expect(mockReviewCard).toHaveBeenCalledWith(cards[0], true);
  });

  test('handleReview reloads when last card reviewed', async () => {
    const cards = [makeCard({ id: 'a' })];
    mockFetchAll.mockResolvedValue(cards);
    mockFilterCards.mockImplementation((all, f) => defaultFilterCards(all, f));
    mockReviewCard.mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useCardReviewState({
        fetchAll: mockFetchAll,
        filterCards: mockFilterCards,
        reviewCard: mockReviewCard,
        toggleStar: mockToggleStar,
        isStarred: defaultIsStarred,
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetchAll).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.handleReview(true);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetchAll).toHaveBeenCalledTimes(2);
  });

  test('handleReview no-ops when no current card', async () => {
    mockFetchAll.mockResolvedValue([]);
    mockFilterCards.mockImplementation((all) => all);

    const { result } = renderHook(() =>
      useCardReviewState({
        fetchAll: mockFetchAll,
        filterCards: mockFilterCards,
        reviewCard: mockReviewCard,
        toggleStar: mockToggleStar,
        isStarred: defaultIsStarred,
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.handleReview(true);
    });
    expect(mockReviewCard).not.toHaveBeenCalled();
  });

  test('handleToggleStar toggles star on current card', async () => {
    const cards = [makeCard({ id: 'a', isStarred: false })];
    mockFetchAll.mockResolvedValue(cards);
    mockFilterCards.mockImplementation((all) => all);
    mockToggleStar.mockImplementation(async (card) => ({ ...card, isStarred: true }));

    const { result } = renderHook(() =>
      useCardReviewState({
        fetchAll: mockFetchAll,
        filterCards: mockFilterCards,
        reviewCard: mockReviewCard,
        toggleStar: mockToggleStar,
        isStarred: defaultIsStarred,
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.currentCard?.isStarred).toBe(false);

    await act(async () => {
      await result.current.handleToggleStar();
    });

    expect(result.current.currentCard?.isStarred).toBe(true);
    expect(mockToggleStar).toHaveBeenCalledWith(cards[0]);
  });

  test('handleToggleStar no-ops when no current card', async () => {
    mockFetchAll.mockResolvedValue([]);
    mockFilterCards.mockImplementation((all) => all);

    const { result } = renderHook(() =>
      useCardReviewState({
        fetchAll: mockFetchAll,
        filterCards: mockFilterCards,
        reviewCard: mockReviewCard,
        toggleStar: mockToggleStar,
        isStarred: defaultIsStarred,
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.handleToggleStar();
    });
    expect(mockToggleStar).not.toHaveBeenCalled();
  });

  test('setFilter changes filter and reloads cards', async () => {
    mockFetchAll.mockResolvedValue([makeCard({ id: 'a' })]);
    mockFilterCards.mockImplementation((all, _f) => all);

    const { result } = renderHook(() =>
      useCardReviewState({
        fetchAll: mockFetchAll,
        filterCards: mockFilterCards,
        reviewCard: mockReviewCard,
        toggleStar: mockToggleStar,
        isStarred: defaultIsStarred,
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetchAll).toHaveBeenCalledTimes(1);

    act(() => result.current.setFilter('starred'));
    await waitFor(() => expect(result.current.filter).toBe('starred'));
    expect(mockFetchAll).toHaveBeenCalledTimes(2);
  });

  test('reload re-fetches with current filter', async () => {
    mockFetchAll.mockResolvedValue([makeCard({ id: 'a' })]);
    mockFilterCards.mockImplementation((all, _f) => all);

    const { result } = renderHook(() =>
      useCardReviewState({
        fetchAll: mockFetchAll,
        filterCards: mockFilterCards,
        reviewCard: mockReviewCard,
        toggleStar: mockToggleStar,
        isStarred: defaultIsStarred,
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetchAll).toHaveBeenCalledTimes(1);

    act(() => result.current.reload());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetchAll).toHaveBeenCalledTimes(2);
  });
});
