import { useTranslation } from 'react-i18next';

import { useFloatingPosition } from '../../hooks/useFloatingPosition';
import { Button } from '../ui';
import { ColorPickerRow } from './ColorPickerRow';

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
  copied?: boolean;
  onCopiedChange?: (v: boolean) => void;
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
  copied = false,
  onCopiedChange,
}: SelectionToolbarProps) {
  const { t } = useTranslation();
  const { menuRef, position } = useFloatingPosition(x, y, selectionTop);

  const handleCopy = () => {
    if (!selectedText) return;
    onCopy(selectedText);
    onCopiedChange?.(true);
  };

  return (
    <div
      ref={menuRef}
      data-testid="selection-toolbar"
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
