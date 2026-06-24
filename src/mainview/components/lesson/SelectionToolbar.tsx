import { useState, useRef, useEffect, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import { HIGHLIGHT_COLORS } from '../rehype-highlight-text';
import { Button } from '../ui';

interface SelectionToolbarProps {
  ref?: React.Ref<SelectionToolbarHandle>;
  x: number;
  y: number;
  selectionTop: number;
  selectedText?: string;
  onSelectColor: (color: string) => void;
  onOpenNote: () => void;
  onCreateCard: () => void;
  onCopy: (text: string) => void;
  onCancel: () => void;
}

export interface SelectionToolbarHandle {
  triggerCopy: () => void;
}

function SelectionToolbar({
  ref,
  x,
  y,
  selectionTop,
  selectedText,
  onSelectColor,
  onOpenNote,
  onCreateCard,
  onCopy,
  onCancel,
}: SelectionToolbarProps) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [position, setPosition] = useState({ x, y });

  const handleCopy = () => {
    if (!selectedText) return;
    onCopy(selectedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  };

  useImperativeHandle(ref, () => ({
    triggerCopy: handleCopy,
  }));

  useEffect(() => {
    if (!menuRef.current) return;
    const menuRect = menuRef.current.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;
    const gap = 8;

    let top = y + gap;
    const belowEnd = top + menuRect.height + gap;
    if (belowEnd > viewportH) {
      top = selectionTop - menuRect.height - gap;
    }
    if (top < gap) top = gap;

    let left = x;
    const halfW = menuRect.width / 2;
    if (left - halfW < gap) left = gap + halfW;
    if (left + halfW > viewportW - gap) left = viewportW - gap - halfW;

    setPosition({ x: left, y: top });
  }, [x, y, selectionTop]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 min-w-[140px]"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translateX(-50%)',
      }}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        {Object.entries(HIGHLIGHT_COLORS).map(([name, color]) => (
          <button
            key={name}
            onClick={() => onSelectColor(name)}
            className="w-5 h-5 rounded-full border border-gray-500 hover:scale-125 transition-transform shrink-0"
            style={{ backgroundColor: color }}
            title={name}
          />
        ))}
        <div className="w-px h-5 bg-gray-600" />
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {t('icons.close')}
        </Button>
      </div>

      <div className="h-px bg-gray-600 my-0.5" />

      <Button variant="ghost" size="md" onClick={onOpenNote} className="w-full justify-start">
        <span className="shrink-0">{t('icons.note')}</span>
        {t('lesson.addNote')}
      </Button>

      <Button variant="ghost" size="md" onClick={onCreateCard} className="w-full justify-start">
        <span className="shrink-0">{t('icons.cards')}</span>
        {t('lesson.createCard')}
      </Button>

      <Button variant="ghost" size="md" onClick={handleCopy} className="w-full justify-start">
        <span className="shrink-0">{t('icons.clipboard')}</span>
        {copied ? t('selection.copied') : t('lesson.copy')}
      </Button>
    </div>
  );
}

export default SelectionToolbar;
