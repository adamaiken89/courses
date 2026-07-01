import { useCallback, useState } from 'react';

import { api } from '../api';
import SelectionOverlays from '../components/lesson/SelectionOverlays';
import { useDelayedUnmount } from '../hooks/useDelayedUnmount';
import { useHighlights } from '../hooks/useHighlights';
import { useLessonStore as useSelectionStore } from '../stores/lessonStore';
import { getTextOffset } from './lessonHelpers';

interface LessonSelectionOverlaysProps {
  courseId: string;
  moduleId: string;
  contentRef: React.RefObject<HTMLDivElement | null>;
  onRefreshHighlights: () => void;
}

export default function LessonSelectionOverlays({
  courseId,
  moduleId,
  contentRef,
  onRefreshHighlights,
}: LessonSelectionOverlaysProps) {
  const { addHighlight, deleteHighlight } = useHighlights(courseId, moduleId);

  const selection = useSelectionStore((s) => s.selection);
  const showNoteEditor = useSelectionStore((s) => s.showNoteEditor);
  const showCardEditor = useSelectionStore((s) => s.showCardEditor);
  const popoverNote = useSelectionStore((s) => s.popoverNote);
  const setPopoverNote = useSelectionStore((s) => s.setPopoverNote);
  const closeToolbar = useSelectionStore((s) => s.closeToolbar);
  const closeNoteEditor = useSelectionStore((s) => s.closeNoteEditor);
  const closeCardEditor = useSelectionStore((s) => s.closeCardEditor);

  const [copied, setCopied] = useState(false);

  const setCopiedWithTimer = useCallback((v: boolean) => {
    setCopied(v);
    if (v) setTimeout(() => setCopied(false), 700);
  }, []);

  const showSelectionBar = useDelayedUnmount(
    !!(selection && !showNoteEditor && !showCardEditor),
    150,
  );
  const showNotePopover = useDelayedUnmount(!!popoverNote, 150);

  const handleAddHighlight = useCallback(
    async (color: string) => {
      const sel = useSelectionStore.getState().selection;
      if (!sel) return;
      const el = contentRef.current;
      const offsets = el ? getTextOffset(el, sel.range) : null;
      if (!offsets) return;
      await addHighlight(sel.text, color, offsets.start, offsets.end);
      closeToolbar();
      requestAnimationFrame(() => {
        const marks = el?.querySelectorAll('mark');
        marks?.forEach((mark) => {
          if (mark.textContent?.trim() === sel.text.trim() && !mark.dataset.flashApplied) {
            mark.dataset.flashApplied = 'true';
            mark.classList.add('anim-highlight-flash');
            setTimeout(() => mark.classList.remove('anim-highlight-flash'), 600);
          }
        });
      });
    },
    [contentRef, addHighlight, closeToolbar],
  );

  const handleDelete = useCallback(() => {
    const { selectedHighlightId } = useSelectionStore.getState();
    if (selectedHighlightId) {
      void deleteHighlight(selectedHighlightId);
      closeToolbar();
    }
  }, [deleteHighlight, closeToolbar]);

  const handleAddAnnotation = useCallback(async () => {
    const sel = useSelectionStore.getState().selection;
    const noteText = useSelectionStore.getState().noteText;
    if (!sel || !noteText.trim()) return;
    const el = contentRef.current;
    const offsets = el ? getTextOffset(el, sel.range) : null;
    if (!offsets) return;
    await api.storage.addAnnotation({
      courseID: courseId,
      moduleID: moduleId,
      selectedText: sel.text,
      startOffset: offsets.start,
      endOffset: offsets.end,
      color: 'note',
      noteContent: noteText.trim(),
    });
    closeToolbar();
    closeNoteEditor();
    onRefreshHighlights();
  }, [contentRef, courseId, moduleId, closeToolbar, closeNoteEditor, onRefreshHighlights]);

  const handleCreateCard = useCallback(
    async (front: string, back: string) => {
      const sel = useSelectionStore.getState().selection;
      if (!sel) return;
      await api.usercards.create(courseId, moduleId, front, back);
      closeToolbar();
      closeCardEditor();
    },
    [courseId, moduleId, closeToolbar, closeCardEditor],
  );

  return (
    <SelectionOverlays
      courseId={courseId}
      moduleId={moduleId}
      contentRef={contentRef}
      showSelectionBar={showSelectionBar}
      showNotePopover={showNotePopover}
      popoverNote={popoverNote}
      onClosePopoverNote={() => setPopoverNote(null)}
      copied={copied}
      onCopiedChange={setCopiedWithTimer}
      onSelectColor={(c) => void handleAddHighlight(c)}
      onCopy={(text) => void navigator.clipboard.writeText(text)}
      onDeleteHighlight={handleDelete}
      onSaveNote={() => void handleAddAnnotation()}
      onSaveCard={(f, b) => void handleCreateCard(f, b)}
    />
  );
}
