import { useState, useCallback } from 'react';

interface HighlightSelection {
  text: string;
  range: Range;
}

interface UseHighlightPickerReturn {
  showHighlightPicker: boolean;
  showNoteEditor: boolean;
  showCardEditor: boolean;
  noteText: string;
  highlightSelection: HighlightSelection | null;
  pickerPos: { x: number; y: number; selectionTop: number };
  handleTextSelection: () => void;
  openNoteEditor: () => void;
  openCardEditor: () => void;
  setNoteText: (text: string) => void;
  closeHighlightPicker: () => void;
  closeNoteEditor: () => void;
  closeCardEditor: () => void;
}

export function useHighlightPicker(): UseHighlightPickerReturn {
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [showCardEditor, setShowCardEditor] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [highlightSelection, setHighlightSelection] = useState<HighlightSelection | null>(null);
  const [pickerPos, setPickerPos] = useState({ x: 0, y: 0, selectionTop: 0 });

  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) {
      setShowHighlightPicker(false);
      setHighlightSelection(null);
      return;
    }
    const text = selection.toString().trim();
    if (!text || text.length > 500) return;
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setHighlightSelection({ text, range });
    setPickerPos({ x: rect.left + rect.width / 2, y: rect.bottom, selectionTop: rect.top });
    setShowHighlightPicker(true);
  }, []);

  const openNoteEditor = useCallback(() => {
    setShowNoteEditor(true);
    setNoteText('');
  }, []);

  const openCardEditor = useCallback(() => {
    setShowCardEditor(true);
  }, []);

  const closeHighlightPicker = useCallback(() => {
    setShowHighlightPicker(false);
    setHighlightSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  const closeNoteEditor = useCallback(() => {
    setShowNoteEditor(false);
    setNoteText('');
  }, []);

  const closeCardEditor = useCallback(() => {
    setShowCardEditor(false);
  }, []);

  return {
    showHighlightPicker,
    showNoteEditor,
    showCardEditor,
    noteText,
    highlightSelection,
    pickerPos,
    handleTextSelection,
    openNoteEditor,
    openCardEditor,
    setNoteText,
    closeHighlightPicker,
    closeNoteEditor,
    closeCardEditor,
  };
}
