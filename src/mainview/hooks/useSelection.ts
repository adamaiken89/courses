import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { TextSelection } from '../stores/lessonStore';
import { useLessonStore as useSelectionStore } from '../stores/lessonStore';

export type { TextSelection };

export function useSelection(scrollContainerRef?: RefObject<HTMLElement | null>) {
  const rafRef = useRef<number>(0);
  const hideRafRef = useRef<number>(0);

  const actions = useSelectionStore(
    useShallow((s) => ({
      showToolbar: s.showToolbar,
      showNoteEditor: s.showNoteEditor,
      showCardEditor: s.showCardEditor,
      noteText: s.noteText,
      selection: s.selection,
      pickerPos: s.pickerPos,
      selectedHighlightId: s.selectedHighlightId,
      handleTextSelection: s.handleTextSelection,
      setSelectedHighlight: s.setSelectedHighlight,
      openNoteEditor: s.openNoteEditor,
      openCardEditor: s.openCardEditor,
      setNoteText: s.setNoteText,
      closeToolbar: s.closeToolbar,
      closeNoteEditor: s.closeNoteEditor,
      closeCardEditor: s.closeCardEditor,
      updatePickerPos: s.updatePickerPos,
    })),
  );

  useEffect(() => {
    const onSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) {
        cancelAnimationFrame(hideRafRef.current);
        hideRafRef.current = requestAnimationFrame(() => {
          const sel2 = window.getSelection();
          if (!sel2 || sel2.isCollapsed || !sel2.rangeCount) {
            useSelectionStore.getState().resetSelection();
          }
        });
        return;
      }
      cancelAnimationFrame(hideRafRef.current);
      const range = sel.getRangeAt(0);
      const container = scrollContainerRef?.current;
      if (!container) return;
      if (!container.contains(range.commonAncestorContainer)) return;
      useSelectionStore.getState().handleTextSelection();
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      cancelAnimationFrame(hideRafRef.current);
      document.removeEventListener('selectionchange', onSelectionChange);
    };
  }, [scrollContainerRef]);

  useEffect(() => {
    const el = scrollContainerRef?.current;
    if (!el || !actions.selection) return;
    const onScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        useSelectionStore.getState().updatePickerPos();
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(rafRef.current);
      el.removeEventListener('scroll', onScroll);
    };
  }, [actions.selection, scrollContainerRef]);

  return actions;
}
