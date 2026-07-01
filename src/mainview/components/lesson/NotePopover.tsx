import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { Note } from '../../../bun/types';

interface NotePopoverProps {
  note: Note;
  x: number;
  y: number;
  onClose: () => void;
}

export default function NotePopover({ note, x, y, onClose }: NotePopoverProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  const clampedTop = Math.max(8, y - 120);
  const clampedLeft = Math.min(Math.max(8, x), window.innerWidth - 8);

  return (
    <div
      ref={ref}
      data-testid="note-popover"
      className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-xl max-w-xs"
      style={{
        left: clampedLeft,
        top: clampedTop,
        transform: 'translate(-50%, 0)',
      }}
    >
      <p className="text-[10px] text-gray-500 mb-1.5 font-medium uppercase tracking-wide">
        {t('icons.note')} {t('studyTools.notes')}
      </p>
      <p className="text-xs text-gray-200 whitespace-pre-wrap">{note.content}</p>
    </div>
  );
}
