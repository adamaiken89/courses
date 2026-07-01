import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { useSelection } from './useSelection';

function mockSelection(text: string, collapsed: boolean, rangeRect?: Partial<DOMRect>) {
  const range = {
    getBoundingClientRect: () => ({
      top: 100,
      left: 200,
      right: 400,
      bottom: 120,
      width: 200,
      height: 20,
      x: 200,
      y: 100,
      toJSON: () => {},
      ...rangeRect,
    }),
    commonAncestorContainer: document.body,
  } as unknown as Range;

  const sel = {
    isCollapsed: collapsed,
    rangeCount: collapsed ? 0 : 1,
    toString: () => text,
    getRangeAt: (_i: number) => range,
    removeAllRanges: () => {},
  } as unknown as Selection;

  return sel;
}

import { useLessonStore as useSelectionStore } from '../stores/lessonStore';

beforeEach(() => {
  useSelectionStore.setState({
    showToolbar: false,
    showNoteEditor: false,
    showCardEditor: false,
    noteText: '',
    selection: null,
    pickerPos: { x: 0, y: 0, selectionTop: 0 },
    selectedHighlightId: null,
  });
});

afterEach(() => {
  // @ts-expect-error getSelection is read-only on Window type; deleting to reset mock
  delete (window as Record<string, unknown>).getSelection;
});

describe('useSelection', () => {
  test('initial state', () => {
    const { result } = renderHook(() => useSelection());
    expect(result.current.showToolbar).toBe(false);
    expect(result.current.showNoteEditor).toBe(false);
    expect(result.current.showCardEditor).toBe(false);
    expect(result.current.noteText).toBe('');
    expect(result.current.selection).toBeNull();
    expect(result.current.selectedHighlightId).toBeNull();
  });

  describe('handleTextSelection', () => {
    test('with collapsed selection hides toolbar', () => {
      window.getSelection = () => mockSelection('', true);
      const { result } = renderHook(() => useSelection());
      act(() => result.current.handleTextSelection());
      expect(result.current.showToolbar).toBe(false);
      expect(result.current.selection).toBeNull();
    });

    test('with null selection hides toolbar', () => {
      window.getSelection = () => null;
      const { result } = renderHook(() => useSelection());
      act(() => result.current.handleTextSelection());
      expect(result.current.showToolbar).toBe(false);
    });

    test('with null rangeCount hides toolbar', () => {
      const sel = {
        isCollapsed: true,
        rangeCount: 0,
        toString: () => '',
        getRangeAt: () => ({}) as Range,
        removeAllRanges: () => {},
      } as unknown as Selection;
      window.getSelection = () => sel;
      const { result } = renderHook(() => useSelection());
      act(() => result.current.handleTextSelection());
      expect(result.current.showToolbar).toBe(false);
    });

    test('with valid text sets toolbar and selection', () => {
      window.getSelection = () => mockSelection('selected text', false);
      const { result } = renderHook(() => useSelection());
      act(() => result.current.handleTextSelection());
      expect(result.current.showToolbar).toBe(true);
      expect(result.current.selection).not.toBeNull();
      expect(result.current.selection?.text).toBe('selected text');
    });

    test('ignores text over 500 chars', () => {
      window.getSelection = () => mockSelection('x'.repeat(501), false);
      const { result } = renderHook(() => useSelection());
      act(() => result.current.handleTextSelection());
      expect(result.current.showToolbar).toBe(false);
      expect(result.current.selection).toBeNull();
    });

    test('hides toolbar for empty trimmed text', () => {
      window.getSelection = () => mockSelection('   ', false);
      const { result } = renderHook(() => useSelection());
      act(() => result.current.handleTextSelection());
      expect(result.current.showToolbar).toBe(false);
      expect(result.current.selection).toBeNull();
    });
  });

  describe('selectionchange event', () => {
    test('triggers handleTextSelection with valid selection', () => {
      window.getSelection = () => mockSelection('selected text', false);
      const ref = { current: document.body };
      const { result } = renderHook(() => useSelection(ref));
      act(() => {
        document.dispatchEvent(new Event('selectionchange'));
      });
      expect(result.current.showToolbar).toBe(true);
    });

    test('hides toolbar when selection collapsed', () => {
      window.getSelection = () => mockSelection('', true);
      const ref = { current: document.body };
      const { result } = renderHook(() => useSelection(ref));
      act(() => {
        document.dispatchEvent(new Event('selectionchange'));
      });
      expect(result.current.showToolbar).toBe(false);
    });

    test('no-op when selection outside container', () => {
      const outsideEl = document.createElement('div');
      window.getSelection = () => {
        const range = {
          getBoundingClientRect: () => ({
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: 0,
            height: 0,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          }),
          commonAncestorContainer: outsideEl,
        } as unknown as Range;
        return {
          isCollapsed: false,
          rangeCount: 1,
          toString: () => 'text',
          getRangeAt: () => range,
          removeAllRanges: () => {},
        } as unknown as Selection;
      };
      const ref = { current: document.body };
      const { result } = renderHook(() => useSelection(ref));
      act(() => {
        document.dispatchEvent(new Event('selectionchange'));
      });
      expect(result.current.showToolbar).toBe(false);
    });

    test('no-op when container ref is null', () => {
      window.getSelection = () => mockSelection('text', false);
      const { result } = renderHook(() => useSelection());
      act(() => {
        document.dispatchEvent(new Event('selectionchange'));
      });
      expect(result.current.showToolbar).toBe(false);
    });
  });

  describe('scroll position update', () => {
    test('does nothing without selection', () => {
      const el = document.createElement('div');
      const ref = { current: el };
      const { result } = renderHook(() => useSelection(ref));
      el.dispatchEvent(new Event('scroll'));
      expect(result.current.pickerPos).toEqual({ x: 0, y: 0, selectionTop: 0 });
    });

    test('repositions toolbar on scroll when selection exists', () => {
      window.getSelection = () => mockSelection('text', false);
      const el = document.createElement('div');
      const ref = { current: el };
      const { result } = renderHook(() => useSelection(ref));
      act(() => result.current.handleTextSelection());
      act(() => {
        el.dispatchEvent(new Event('scroll'));
      });
      expect(result.current.pickerPos.x).toBeGreaterThan(0);
    });

    test('pickerPos set correctly after handleTextSelection', () => {
      window.getSelection = () =>
        mockSelection('text', false, { left: 100, right: 300, top: 50, bottom: 70 });
      const { result } = renderHook(() => useSelection());
      act(() => result.current.handleTextSelection());
      expect(result.current.pickerPos.x).toBe(200);
      expect(result.current.pickerPos.y).toBe(70);
    });

    test('cancels previous animation frame on rapid scroll', () => {
      window.getSelection = () => mockSelection('text', false);
      const el = document.createElement('div');
      const ref = { current: el };
      const { result } = renderHook(() => useSelection(ref));
      act(() => result.current.handleTextSelection());
      act(() => {
        el.dispatchEvent(new Event('scroll'));
        el.dispatchEvent(new Event('scroll'));
      });
      expect(result.current.pickerPos.x).toBeGreaterThan(0);
    });
  });

  describe('openNoteEditor', () => {
    test('shows editor and clears note text', () => {
      const { result } = renderHook(() => useSelection());
      act(() => result.current.setNoteText('old text'));
      act(() => result.current.openNoteEditor());
      expect(result.current.showNoteEditor).toBe(true);
      expect(result.current.noteText).toBe('');
    });
  });

  describe('closeToolbar', () => {
    test('clears everything', () => {
      const removeAllRanges = (() => {}) as Selection['removeAllRanges'];
      window.getSelection = () => ({ removeAllRanges }) as unknown as Selection;
      const { result } = renderHook(() => useSelection());
      act(() => result.current.openNoteEditor());
      act(() => result.current.closeToolbar());
      expect(result.current.showToolbar).toBe(false);
      expect(result.current.selection).toBeNull();
      expect(result.current.selectedHighlightId).toBeNull();
    });
  });

  describe('closeNoteEditor', () => {
    test('hides editor and clears text', () => {
      const { result } = renderHook(() => useSelection());
      act(() => result.current.openNoteEditor());
      act(() => result.current.setNoteText('some text'));
      act(() => result.current.closeNoteEditor());
      expect(result.current.showNoteEditor).toBe(false);
      expect(result.current.noteText).toBe('');
    });
  });

  describe('openCardEditor', () => {
    test('shows card editor', () => {
      const { result } = renderHook(() => useSelection());
      act(() => result.current.openCardEditor());
      expect(result.current.showCardEditor).toBe(true);
    });

    test('closeCardEditor hides card editor', () => {
      const { result } = renderHook(() => useSelection());
      act(() => result.current.openCardEditor());
      act(() => result.current.closeCardEditor());
      expect(result.current.showCardEditor).toBe(false);
    });
  });

  describe('setSelectedHighlight', () => {
    test('updates selectedHighlightId', () => {
      const { result } = renderHook(() => useSelection());
      act(() => result.current.setSelectedHighlight('h-1'));
      expect(result.current.selectedHighlightId).toBe('h-1');
    });

    test('clears to null', () => {
      const { result } = renderHook(() => useSelection());
      act(() => result.current.setSelectedHighlight('h-1'));
      act(() => result.current.setSelectedHighlight(null));
      expect(result.current.selectedHighlightId).toBeNull();
    });
  });
});
