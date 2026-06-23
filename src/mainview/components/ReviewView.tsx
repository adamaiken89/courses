import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { filterVariants } from './ui';
import PageHeader from '../layouts/PageHeader';
import PageLayout from '../layouts/PageLayout';
import PageContent from '../layouts/PageContent';
import type { SRSCard, SRSDeck } from '../../bun/types';

interface Props {
  courseId: string;
  onBack: () => void;
}

export default function ReviewView({ courseId, onBack }: Props) {
  const { t } = useTranslation();
  const [cards, setCards] = useState<SRSCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [filter, setFilter] = useState<'all' | 'due' | 'starred'>('all');
  const [deck, setDeck] = useState<SRSDeck>({ cards: {} });

  const loadCards = (f: typeof filter) => {
    setLoading(true);
    api.courses.srs.filter(courseId, f).then((result) => {
      setCards(result);
      setLoading(false);
      setCurrentIndex(0);
      setShowAnswer(false);
    });
  };

  useEffect(() => {
    api.courses.srs.get(courseId).then((d) => {
      setDeck(d);
      const due = Object.values(d.cards).filter(
        (c: SRSCard) => new Date(c.nextReviewDate) <= new Date(),
      );
      setCards(due);
      setLoading(false);
    });
  }, [courseId]);

  const handleFilterChange = (f: typeof filter) => {
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

  if (loading)
    return <div className="p-8 text-center text-gray-400">{t('review.loadingCards')}</div>;

  const currentCard = cards[currentIndex];

  return (
    <PageLayout>
      <PageHeader
        onBack={onBack}
        title={t('review.cards', { count: cards.length })}
        actions={
          <div className="flex items-center gap-2">
            {(['all', 'due', 'starred'] as const).map((f) => (
              <button
                key={f}
                onClick={() => handleFilterChange(f)}
                className={filterVariants({ active: filter === f })}
              >
                {f === 'all'
                  ? t('review.all')
                  : f === 'due'
                    ? t('review.due')
                    : t('review.starred')}
              </button>
            ))}
          </div>
        }
      />
      <PageContent className="max-w-xl mx-auto px-6 py-12">
        {cards.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-4">
              {filter === 'due'
                ? t('review.noDueCards')
                : filter === 'starred'
                  ? t('review.noStarredCards')
                  : t('review.noCards')}
            </p>
            <p className="text-sm text-gray-500">{t('review.completeQuiz')}</p>
          </div>
        ) : (
          currentCard && (
            <div>
              <div className="text-xs text-gray-500 mb-2 text-center">
                {t('review.cardOf', { current: currentIndex + 1, total: cards.length })}
                {currentCard.isStarred && <span className="ml-2 text-yellow-500">★</span>}
              </div>

              <div className="bg-gray-800 rounded-xl p-8 min-h-[200px] flex flex-col items-center justify-center text-center mb-6">
                {!showAnswer ? (
                  <div>
                    <h3 className="text-lg font-medium mb-6">{currentCard.question}</h3>
                    <button
                      onClick={() => setShowAnswer(true)}
                      className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
                    >
                      {t('review.showAnswer')}
                    </button>
                  </div>
                ) : (
                  <div className="w-full">
                    <div className="mb-4 pb-4 border-b border-gray-700">
                      <p className="text-sm text-gray-400 mb-1">{t('review.question')}</p>
                      <p className="text-lg font-medium">{currentCard.question}</p>
                    </div>
                    <div className="mb-4">
                      <p className="text-sm text-gray-400 mb-1">{t('review.answer')}</p>
                      <p className="text-lg">{currentCard.answer}</p>
                    </div>
                    <div className="mb-6">
                      <p className="text-sm text-gray-400 mb-1">{t('review.explanation')}</p>
                      <p className="text-sm text-gray-300">{currentCard.explanation}</p>
                    </div>
                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={() => handleReview(false)}
                        className="px-6 py-2 bg-red-700 hover:bg-red-600 rounded-lg transition-colors"
                      >
                        {t('review.forgot')}
                      </button>
                      <button
                        onClick={() => handleReview(true)}
                        className="px-6 py-2 bg-emerald-700 hover:bg-emerald-600 rounded-lg transition-colors"
                      >
                        {t('review.remembered')}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-center gap-2">
                {currentCard.isStarred ? (
                  <button
                    onClick={async () => {
                      await api.courses.srs.toggleStar(courseId, currentCard.id);
                      loadCards(filter);
                    }}
                    className="text-xs text-yellow-500 hover:text-yellow-400"
                  >
                    {t('review.unstar')}
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      await api.courses.srs.toggleStar(courseId, currentCard.id);
                      loadCards(filter);
                    }}
                    className="text-xs text-gray-500 hover:text-gray-400"
                  >
                    {t('review.star')}
                  </button>
                )}
              </div>
            </div>
          )
        )}
      </PageContent>
    </PageLayout>
  );
}
