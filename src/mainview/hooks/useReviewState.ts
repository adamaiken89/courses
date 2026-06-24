import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { showToast } from '../toast';
import type { SRSCard, SRSDeck } from '../../bun/types';

type FilterMode = 'all' | 'due' | 'starred';

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
  const [cards, setCards] = useState<SRSCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [deck, setDeck] = useState<SRSDeck>({ cards: {} });

  const loadCards = useCallback(
    (f: FilterMode) => {
      setLoading(true);
      api.courses.srs
        .filter(courseId, f)
        .then((result) => {
          setCards(result);
          setLoading(false);
          setCurrentIndex(0);
          setShowAnswer(false);
        })
        .catch(() => {
          showToast.error('toast.loadFailed');
          setLoading(false);
        });
    },
    [courseId],
  );

  useEffect(() => {
    api.courses.srs
      .get(courseId)
      .then((d) => {
        setDeck(d);
        const due = Object.values(d.cards).filter(
          (c: SRSCard) => new Date(c.nextReviewDate) <= new Date(),
        );
        setCards(due);
        setLoading(false);
      })
      .catch(() => {
        showToast.error('toast.loadFailed');
        setLoading(false);
      });
  }, [courseId]);

  const handleFilterChange = (f: FilterMode) => {
    setFilter(f);
    loadCards(f);
  };

  const handleReview = async (correct: boolean) => {
    const card = cards[currentIndex];
    if (!card) return;
    const result = await api.courses.srs.review(courseId, card.id, correct, deck);
    const updatedDeck = { ...deck, cards: { ...deck.cards, [card.id]: result } };
    setDeck(updatedDeck);
    setShowAnswer(false);
    if (currentIndex < cards.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      loadCards(filter);
    }
  };

  const handleToggleStar = async () => {
    const card = cards[currentIndex];
    if (!card) return;
    await api.courses.srs.toggleStar(courseId, card.id);
    loadCards(filter);
  };

  const currentCard = cards[currentIndex];

  return {
    cards,
    loading,
    currentIndex,
    showAnswer,
    filter,
    deck,
    currentCard,
    setShowAnswer,
    setFilter: handleFilterChange,
    handleReview,
    handleToggleStar,
    reload: () => loadCards(filter),
  };
}
