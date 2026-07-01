import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { UserCard } from '../../../bun/types';
import { api } from '../../api';
import { useViewStore } from '../../stores/viewStore';

export default function CardsTab() {
  const { t } = useTranslation();
  const [cards, setCards] = useState<UserCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const views = useViewStore((s) => s.views);
  const lastView = views[views.length - 1];
  const courseId = lastView?.type === 'lesson' ? lastView.course.id : '';
  const moduleId = lastView?.type === 'lesson' ? lastView.module.id : '';

  const loadCards = useCallback(() => {
    setLoading(true);
    void api.usercards
      .list(courseId, moduleId)
      .then(setCards)
      .finally(() => setLoading(false));
  }, [courseId, moduleId]);

  useEffect(() => {
    if (courseId && moduleId) loadCards();
  }, [loadCards, courseId, moduleId]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await api.usercards.delete(id);
    setCards((prev) => prev.filter((c) => c.id !== id));
    setDeletingId(null);
  };

  if (loading)
    return <div className="text-xs text-gray-500 text-center py-4">{t('common.loading')}</div>;

  if (cards.length === 0)
    return <div className="text-xs text-gray-500 text-center py-4">{t('studyTools.noCards')}</div>;

  return (
    <div className="space-y-2">
      {cards.map((card) => (
        <div key={card.id} className="bg-gray-750 border border-gray-700 rounded p-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-gray-300 font-medium truncate">{card.front}</p>
              <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{card.back}</p>
            </div>
            <button
              onClick={() => {
                void handleDelete(card.id);
              }}
              disabled={deletingId === card.id}
              className="text-[10px] text-gray-600 hover:text-red-400 shrink-0 disabled:opacity-40"
            >
              {t('icons.close')}
            </button>
          </div>
          <div className="flex items-center gap-2 mt-1 text-[9px] text-gray-600">
            {card.interval > 0 && (
              <span>
                {t('studyTools.cardDue')}: {new Date(card.nextReviewDate).toLocaleDateString()}
              </span>
            )}
            {card.repetitions > 0 && (
              <span>
                {t('studyTools.cardReps')}: {card.repetitions}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
