import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { HIGHLIGHT_COLORS } from '../rehype-highlight-text';
import { Button } from '../ui';

interface SelectionToolbarProps {
  x: number;
  y: number;
  selectionTop: number;
  selectedText?: string;
  onSelectColor: (color: string) => void;
  onOpenNote: () => void;
  onCreateCard: () => void;
  onCopy: (text: string) => void;
  onDeleteHighlight?: () => void;
  activeHighlightColor?: string;
}

function ColorPickerRow({
  activeHighlightColor,
  onSelectColor,
  onDeleteHighlight,
}: {
  activeHighlightColor?: string;
  onSelectColor: (color: string) => void;
  onDeleteHighlight?: () => void;
}) {
  return (
    <div className="flex items-center justify-center gap-2 px-3 py-2">
      {Object.entries(HIGHLIGHT_COLORS)
        .filter(([name]) => name !== 'note')
        .map(([name, color]) => {
          const isActive = activeHighlightColor === name;
          return (
            <button
              key={name}
              onClick={() => (isActive ? onDeleteHighlight?.() : onSelectColor(name))}
              className={`w-5 h-5 rounded-full border transition-transform shrink-0 ${
                isActive
                  ? 'border-white scale-125 ring-1 ring-white'
                  : 'border-gray-500 hover:scale-125'
              }`}
              style={{ backgroundColor: color }}
              title={name}
            />
          );
        })}
    </div>
  );
}

function SelectionToolbar({
  x,
  y,
  selectionTop,
  selectedText,
  onSelectColor,
  onOpenNote,
  onCreateCard,
  onCopy,
  onDeleteHighlight,
  activeHighlightColor,
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
      <ColorPickerRow
        activeHighlightColor={activeHighlightColor}
        onSelectColor={onSelectColor}
        onDeleteHighlight={onDeleteHighlight}
      />

      <div className="h-px bg-gray-600 my-0.5" />

      <Button variant="ghost" size="md" onClick={onOpenNote} className="justify-start">
        <span className="shrink-0">{t('icons.note')}</span>
        <span className="truncate">{t('lesson.addNote')}</span>
      </Button>

      <Button variant="ghost" size="md" onClick={onCreateCard} className="justify-start">
        <span className="shrink-0">{t('icons.cards')}</span>
        <span className="truncate">{t('lesson.createCard')}</span>
      </Button>

      <Button variant="ghost" size="md" onClick={handleCopy} className="justify-start">
        <span className="shrink-0">{t('icons.clipboard')}</span>
        <span className="truncate">{copied ? t('selection.copied') : t('lesson.copy')}</span>
      </Button>
    </div>
  );
}

export default SelectionToolbar;
