import { useState, useCallback, useMemo } from 'react';
import { api } from '../api';
import { useCardReviewState } from './useCardReviewState';
import type { SRSCard, SRSDeck } from '../../bun/types';
import type { FilterMode } from './useCardReviewState';

interface UseReviewStateReturn {
  cards: SRSCard[];
  loading: boolean;
  currentIndex: number;
  showAnswer: boolean;
  filter: FilterMode;
  deck: SRSDeck;
  currentCard: SRSCard | undefined;
  setShowAnswer: (v: boolean) => void;
  setFilter: (f: FilterMode) => void;
  handleReview: (correct: boolean) => Promise<void>;
  handleToggleStar: () => Promise<void>;
  reload: () => void;
}

export function useReviewState(courseId: string): UseReviewStateReturn {
  const [deck, setDeck] = useState<SRSDeck>({ cards: {} });

  const fetchAll = useCallback(async () => {
    const d = await api.courses.srs.get(courseId);
    setDeck(d);
    return Object.values(d.cards);
  }, [courseId]);

  const filterCards = useCallback((cards: SRSCard[], filter: FilterMode) => {
    if (filter === 'due') return cards.filter((c) => new Date(c.nextReviewDate) <= new Date());
    if (filter === 'starred') return cards.filter((c) => c.isStarred);
    return cards;
  }, []);

  const reviewCard = useCallback(
    async (card: SRSCard, correct: boolean) => {
      const result = await api.courses.srs.review(courseId, card.id, correct, deck);
      setDeck((d) => ({ ...d, cards: { ...d.cards, [card.id]: result } }));
    },
    [courseId, deck],
  );

  const toggleStar = useCallback(
    async (card: SRSCard) => {
      await api.courses.srs.toggleStar(courseId, card.id);
      return { ...card, isStarred: !card.isStarred };
    },
    [courseId],
  );

  const state = useCardReviewState<SRSCard>({
    fetchAll,
    filterCards,
    reviewCard,
    toggleStar,
    isStarred: useCallback((c: SRSCard) => c.isStarred, []),
  });

  return useMemo(
    () => ({
      ...state,
      deck,
    }),
    [state, deck],
  );
}
