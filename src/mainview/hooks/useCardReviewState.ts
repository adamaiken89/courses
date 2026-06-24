import { useState, useEffect, useCallback } from 'react';
import { showToast } from '../toast';

export type FilterMode = 'all' | 'due' | 'starred';

interface CardReviewOpts<TCard> {
  fetchAll: () => Promise<TCard[]>;
  filterCards: (cards: TCard[], filter: FilterMode) => TCard[];
  reviewCard: (card: TCard, correct: boolean) => Promise<void>;
  toggleStar: (card: TCard) => Promise<TCard>;
  isStarred: (card: TCard) => boolean;
}

interface UseCardReviewStateReturn<TCard> {
  cards: TCard[];
  loading: boolean;
  currentIndex: number;
  showAnswer: boolean;
  filter: FilterMode;
  currentCard: TCard | undefined;
  setShowAnswer: (v: boolean) => void;
  setFilter: (f: FilterMode) => void;
  handleReview: (correct: boolean) => Promise<void>;
  handleToggleStar: () => Promise<void>;
  reload: () => void;
}

export function useCardReviewState<TCard>(
  opts: CardReviewOpts<TCard>,
): UseCardReviewStateReturn<TCard> {
  const { fetchAll, filterCards, reviewCard, toggleStar } = opts;
  const [cards, setCards] = useState<TCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [filter, setFilter] = useState<FilterMode>('all');

  const loadCards = useCallback(
    (f: FilterMode) => {
      setLoading(true);
      fetchAll()
        .then((all) => {
          const filtered = filterCards(all, f);
          setCards(filtered);
          setLoading(false);
          setCurrentIndex(0);
          setShowAnswer(false);
        })
        .catch(() => {
          showToast.error('toast.loadFailed');
          setLoading(false);
        });
    },
    [fetchAll, filterCards],
  );

  useEffect(() => {
    loadCards('due');
  }, [loadCards]);

  const handleReview = async (correct: boolean) => {
    const card = cards[currentIndex];
    if (!card) return;
    await reviewCard(card, correct);
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
    const updated = await toggleStar(card);
    setCards((prev) => prev.map((c) => (c === card ? updated : c)));
  };

  const currentCard = cards[currentIndex];

  return {
    cards,
    loading,
    currentIndex,
    showAnswer,
    filter,
    currentCard,
    setShowAnswer,
    setFilter: (f: FilterMode) => {
      setFilter(f);
      loadCards(f);
    },
    handleReview,
    handleToggleStar,
    reload: () => loadCards(filter),
  };
}
