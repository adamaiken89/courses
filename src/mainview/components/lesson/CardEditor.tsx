import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface CardEditorProps {
  selectedText: string;
  x: number;
  y: number;
  onSave: (front: string, back: string) => void;
  onCancel: () => void;
}

export default function CardEditor({ selectedText, x, y, onSave, onCancel }: CardEditorProps) {
  const { t } = useTranslation();
  const [front, setFront] = useState(selectedText);
  const [back, setBack] = useState('');

  return (
    <div
      data-testid="card-editor"
      className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-xl"
      style={{
        left: x,
        top: y - 120,
        transform: 'translate(-50%, 0)',
        width: '300px',
      }}
    >
      <p className="text-[10px] text-gray-500 mb-2 font-semibold uppercase tracking-wider">
        {t('lesson.createCard')}
      </p>
      <label className="text-[10px] text-gray-400 block mb-0.5">{t('userCardReview.front')}</label>
      <textarea
        value={front}
        onChange={(e) => setFront(e.target.value)}
        placeholder={t('studyTools.cardFront')}
        className="w-full bg-gray-700 border border-gray-600 rounded text-xs p-2 text-gray-200 placeholder-gray-500 resize-none h-16 focus:outline-none focus:border-indigo-500 mb-2"
        autoFocus
      />
      <label className="text-[10px] text-gray-400 block mb-0.5">{t('userCardReview.back')}</label>
      <textarea
        value={back}
        onChange={(e) => setBack(e.target.value)}
        placeholder={t('studyTools.cardBack')}
        className="w-full bg-gray-700 border border-gray-600 rounded text-xs p-2 text-gray-200 placeholder-gray-500 resize-none h-20 focus:outline-none focus:border-indigo-500"
      />
      <div className="flex gap-2 mt-1.5">
        <button
          onClick={() => onSave(front, back)}
          disabled={!front.trim() || !back.trim()}
          className="flex-1 py-1 text-[10px] bg-indigo-700 hover:bg-indigo-600 rounded disabled:opacity-40"
        >
          {t('common.save')}
        </button>
        <button onClick={onCancel} className="py-1 text-[10px] text-gray-400 hover:text-gray-200">
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}
