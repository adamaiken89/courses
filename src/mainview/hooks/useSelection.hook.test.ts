import { act, fireEvent, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'bun:test';

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

  test('handleTextSelection with collapsed selection hides toolbar', () => {
    window.getSelection = () => mockSelection('', true);
    const { result } = renderHook(() => useSelection());
    act(() => result.current.handleTextSelection());
    expect(result.current.showToolbar).toBe(false);
    expect(result.current.selection).toBeNull();
  });

  test('handleTextSelection with valid text sets toolbar and selection', () => {
    window.getSelection = () => mockSelection('selected text', false);
    const { result } = renderHook(() => useSelection());
    act(() => result.current.handleTextSelection());
    expect(result.current.showToolbar).toBe(true);
    expect(result.current.selection).not.toBeNull();
    expect(result.current.selection?.text).toBe('selected text');
  });

  test('handleTextSelection ignores text over 500 chars', () => {
    window.getSelection = () => mockSelection('x'.repeat(501), false);
    const { result } = renderHook(() => useSelection());
    act(() => result.current.handleTextSelection());
    expect(result.current.showToolbar).toBe(false);
    expect(result.current.selection).toBeNull();
  });

  test('openNoteEditor shows editor and clears note text', () => {
    const { result } = renderHook(() => useSelection());
    act(() => result.current.setNoteText('old text'));
    act(() => result.current.openNoteEditor());
    expect(result.current.showNoteEditor).toBe(true);
    expect(result.current.noteText).toBe('');
  });

  test('closeToolbar clears everything', () => {
    const removeAllRanges = (() => {}) as Selection['removeAllRanges'];
    window.getSelection = () => ({ removeAllRanges }) as unknown as Selection;
    const { result } = renderHook(() => useSelection());
    act(() => result.current.openNoteEditor());
    act(() => result.current.closeToolbar());
    expect(result.current.showToolbar).toBe(false);
    expect(result.current.selection).toBeNull();
    expect(result.current.selectedHighlightId).toBeNull();
  });

  test('closeNoteEditor hides editor and clears text', () => {
    const { result } = renderHook(() => useSelection());
    act(() => result.current.openNoteEditor());
    act(() => result.current.setNoteText('some text'));
    act(() => result.current.closeNoteEditor());
    expect(result.current.showNoteEditor).toBe(false);
    expect(result.current.noteText).toBe('');
  });

  test('selectionchange event triggers handleTextSelection', () => {
    window.getSelection = () => mockSelection('selected text', false);
    const ref = { current: document.body };
    const { result } = renderHook(() => useSelection(ref));
    act(() => {
      fireEvent(document, new Event('selectionchange'));
    });
    expect(result.current.showToolbar).toBe(true);
  });

  test('openCardEditor shows card editor', () => {
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
