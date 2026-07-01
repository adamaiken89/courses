import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';

import type { Note } from '../../bun/types';
import { useLessonStore as useSelectionStore } from '../stores/lessonStore';

export function useNotePopoverOnClick(
  contentRef: RefObject<HTMLElement | null>,
  notes: Note[],
  setSelectedHighlight: (id: string | null) => void,
  handleTextSelection: () => void,
) {
  const notesRef = useRef(notes);
  notesRef.current = notes;

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'MARK' && target.dataset.highlightId) {
        if (target.dataset.noteId) {
          const highlightId = target.dataset.highlightId;
          const found = notesRef.current.find((n) => n.highlightID === highlightId);
          if (found) {
            const rect = target.getBoundingClientRect();
            useSelectionStore
              .getState()
              .setPopoverNote({ note: found, x: rect.left + rect.width / 2, y: rect.top });
          }
          return;
        }
        const range = document.createRange();
        range.selectNodeContents(target);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        setSelectedHighlight(target.dataset.highlightId);
        handleTextSelection();
        return;
      }
      if (target.closest('button') || target.closest('[data-no-select]')) return;
      const existingSel = window.getSelection();
      if (existingSel && !existingSel.isCollapsed && existingSel.rangeCount) {
        e.preventDefault();
        setSelectedHighlight(null);
        handleTextSelection();
        return;
      }
      const caretRange = document.caretRangeFromPoint(e.clientX, e.clientY);
      if (!caretRange) return;
      const textNode = caretRange.startContainer;
      if (textNode.nodeType !== Node.TEXT_NODE) return;
      const text = textNode.textContent ?? '';
      let start = caretRange.startOffset;
      let end = caretRange.startOffset;
      while (start > 0 && /\w/.test(text[start - 1])) start--;
      while (end < text.length && /\w/.test(text[end])) end++;
      if (start === end) return;
      const range = document.createRange();
      range.setStart(textNode, start);
      range.setEnd(textNode, end);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      setSelectedHighlight(null);
      handleTextSelection();
    };
    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }, [contentRef, handleTextSelection, setSelectedHighlight]);
}
