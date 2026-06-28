import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, test } from 'bun:test';

import type { SRSCard } from '../../bun/types';
import { __setRPC } from '../api';

type RPCProxy = { request: Record<string, (p: unknown) => Promise<unknown>> };

const mockResponses = new Map<string, unknown>();

const mockRPC: RPCProxy = {
  request: new Proxy(
    {} as Record<string, (params: unknown) => Promise<unknown>>,
    {
      get(_: object, method: string) {
        return (params: unknown) => {
          if (!mockResponses.has(method))
            return Promise.reject(new Error(`No mock for ${method}`));
          const response = mockResponses.get(method);
          if (typeof response === 'function') return (response as (p: unknown) => Promise<unknown>)(params);
          return Promise.resolve(response);
        };
      },
    },
  ) as Record<string, (p: unknown) => Promise<unknown>>,
};

function mockResponse(method: string, data: unknown) {
  mockResponses.set(method, data);
}

beforeAll(() => {
  __setRPC(mockRPC);
});

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
  mockResponses.clear();
});

describe('useReviewState', () => {
  test('loads cards on mount', async () => {
    const cards = [{ ...baseCard('c1') }];
    mockResponse('getSRSDeck', { cards: { c1: cards[0] } });
    mockResponse('reviewSRSCard', cards[0]);

    const { result } = renderHook(() => useReviewState('math'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.cards).toHaveLength(1);
    expect(result.current.currentCard?.id).toBe('c1');
  });

  test('respects due filter', async () => {
    const futureCard = { ...baseCard('c1'), nextReviewDate: '2099-01-01T00:00:00.000Z' };
    mockResponse('getSRSDeck', { cards: { c1: futureCard } });

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
    mockResponse('getSRSDeck', { cards: { c1: cards[0], c2: cards[1] } });
    mockResponse('reviewSRSCard', cards[0]);

    const { result } = renderHook(() => useReviewState('math'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.cards).toHaveLength(2);

    mockResponse('getSRSDeck', { cards: { c1: cards[0] } });
    act(() => result.current.setFilter('starred'));
    await waitFor(() => expect(result.current.filter).toBe('starred'));
    expect(result.current.cards).toHaveLength(1);
    expect(result.current.currentCard?.id).toBe('c1');
  });

  test('handleReview calls API and advances', async () => {
    const cards = [{ ...baseCard('c1') }, { ...baseCard('c2') }];
    mockResponse('getSRSDeck', { cards: { c1: cards[0], c2: cards[1] } });
    mockResponse('reviewSRSCard', cards[0]);

    const { result } = renderHook(() => useReviewState('math'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.currentIndex).toBe(0);

    mockResponse('reviewSRSCard', cards[0]);
    await act(async () => {
      await result.current.handleReview(true);
    });

    expect(result.current.currentIndex).toBe(1);
    expect(result.current.currentCard?.id).toBe('c2');
  });

  test('handleToggleStar toggles star in state', async () => {
    const cards = [{ ...baseCard('c1') }];
    mockResponse('getSRSDeck', { cards: { c1: cards[0] } });
    mockResponse('toggleSRSStar', undefined);

    const { result } = renderHook(() => useReviewState('math'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.currentCard?.isStarred).toBe(false);

    await act(async () => {
      await result.current.handleToggleStar();
    });

    expect(result.current.currentCard?.isStarred).toBe(true);
  });

  test('reload re-fetches deck', async () => {
    const cards = [{ ...baseCard('c1') }];
    mockResponse('getSRSDeck', { cards: { c1: cards[0] } });

    const { result } = renderHook(() => useReviewState('math'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.currentCard?.id).toBe('c1');

    const newCards = [{ ...baseCard('c2') }];
    mockResponse('getSRSDeck', { cards: { c2: newCards[0] } });

    act(() => result.current.reload());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.currentCard?.id).toBe('c2');
  });
});
