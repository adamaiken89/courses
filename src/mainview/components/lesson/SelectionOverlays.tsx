import type { RefObject } from 'react';

import type { Note } from '../../../bun/types';
import { useHighlightsStore } from '../../stores/highlightsStore';
import { useLessonStore as useSelectionStore } from '../../stores/lessonStore';
import CardEditor from './CardEditor';
import NoteEditor from './NoteEditor';
import NotePopover from './NotePopover';
import SelectionToolbar from './SelectionToolbar';
interface SelectionOverlaysProps {
  courseId: string;
  moduleId: string;
  contentRef: RefObject<HTMLDivElement | null>;
  showSelectionBar: boolean;
  showNotePopover: boolean;
  popoverNote: { note: Note; x: number; y: number } | null;
  onClosePopoverNote: () => void;
  onSelectColor: (color: string) => void;
  onCopy: (text: string) => void;
  onDeleteHighlight: (() => void) | undefined;
  onSaveNote: () => void;
  onSaveCard: (front: string, back: string) => void;
  copied: boolean;
  onCopiedChange: (v: boolean) => void;
}

export default function SelectionOverlays({
  courseId,
  moduleId,
  contentRef,
  showSelectionBar,
  showNotePopover,
  popoverNote,
  onClosePopoverNote,
  onSelectColor,
  onCopy,
  onDeleteHighlight,
  onSaveNote,
  onSaveCard,
  copied,
  onCopiedChange,
}: SelectionOverlaysProps) {
  const selection = useSelectionStore((s) => s.selection);
  const showNoteEditor = useSelectionStore((s) => s.showNoteEditor);
  const showCardEditor = useSelectionStore((s) => s.showCardEditor);
  const showToolbar = useSelectionStore((s) => s.showToolbar);
  const pickerPos = useSelectionStore((s) => s.pickerPos);
  const noteText = useSelectionStore((s) => s.noteText);
  const openNoteEditor = useSelectionStore((s) => s.openNoteEditor);
  const openCardEditor = useSelectionStore((s) => s.openCardEditor);
  const setNoteText = useSelectionStore((s) => s.setNoteText);
  const closeNoteEditor = useSelectionStore((s) => s.closeNoteEditor);
  const closeCardEditor = useSelectionStore((s) => s.closeCardEditor);

  const highlights = useHighlightsStore((s) => s.byModule[`${courseId}:${moduleId}`]) ?? [];
  const activeHighlightColor = (() => {
    const el = contentRef.current;
    if (!selection || !el) return undefined;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return undefined;
    const range = sel.getRangeAt(0);
    const selectedHighlight = highlights.find((h) => {
      if (!h.startOffset && h.startOffset !== 0) return false;
      return range.toString() === h.selectedText;
    });
    return selectedHighlight?.color;
  })();

  const selectedText = selection?.text ?? '';

  return (
    <>
      {showSelectionBar && selection && !showNoteEditor && !showCardEditor && (
        <div className={showToolbar ? 'anim-pop-in' : 'anim-pop-out'}>
          <SelectionToolbar
            x={pickerPos.x}
            y={pickerPos.y}
            selectionTop={pickerPos.selectionTop}
            selectedText={selectedText}
            onSelectColor={onSelectColor}
            onOpenNote={openNoteEditor}
            onCreateCard={openCardEditor}
            onCopy={onCopy}
            onDeleteHighlight={onDeleteHighlight}
            activeHighlightColor={activeHighlightColor}
            copied={copied}
            onCopiedChange={onCopiedChange}
          />
        </div>
      )}

      {showNotePopover && popoverNote && (
        <div className={popoverNote ? 'anim-pop-in' : 'anim-pop-out'}>
          <NotePopover
            note={popoverNote.note}
            x={popoverNote.x}
            y={popoverNote.y}
            onClose={onClosePopoverNote}
          />
        </div>
      )}

      {showCardEditor && selection && (
        <CardEditor
          selectedText={selectedText}
          x={pickerPos.x}
          y={pickerPos.y}
          onSave={onSaveCard}
          onCancel={closeCardEditor}
        />
      )}

      {showNoteEditor && selection && (
        <NoteEditor
          selectedText={selectedText}
          noteText={noteText}
          x={pickerPos.x}
          y={pickerPos.y}
          onChange={setNoteText}
          onSave={onSaveNote}
          onCancel={closeNoteEditor}
        />
      )}
    </>
  );
}
