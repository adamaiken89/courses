import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'bun:test';
import { createRef } from 'react';

import { useLessonSearch } from './useLessonSearch';

function addMarks(el: HTMLDivElement, count: number) {
  for (let i = 0; i < count; i++) {
    const mark = document.createElement('mark');
    mark.setAttribute('data-search-match', '');
    mark.textContent = `match-${i}`;
    el.appendChild(mark);
  }
}

describe('useLessonSearch', () => {
  const contentRef = createRef<HTMLDivElement>();

  beforeEach(() => {
    contentRef.current = document.createElement('div');
  });

  test('initial state is inactive', () => {
    const { result } = renderHook(() => useLessonSearch(contentRef, '01'));
    expect(result.current.searchActive).toBe(false);
    expect(result.current.searchQuery).toBe('');
    expect(result.current.currentMatchIndex).toBe(0);
    expect(result.current.totalMatches).toBe(0);
  });

  test('setSearchActive toggles', () => {
    const { result } = renderHook(() => useLessonSearch(contentRef, '01'));
    act(() => result.current.setSearchActive(true));
    expect(result.current.searchActive).toBe(true);
  });

  test('handleSearchQueryChange sets query and resets index', () => {
    const { result } = renderHook(() => useLessonSearch(contentRef, '01'));
    act(() => result.current.setSearchActive(true));
    act(() => result.current.handleSearchQueryChange('hello'));
    expect(result.current.searchQuery).toBe('hello');
    expect(result.current.currentMatchIndex).toBe(0);
  });

  test('handleSearchClose resets all', () => {
    const { result } = renderHook(() => useLessonSearch(contentRef, '01'));
    act(() => result.current.setSearchActive(true));
    act(() => result.current.handleSearchQueryChange('hello'));
    act(() => result.current.handleSearchClose());
    expect(result.current.searchActive).toBe(false);
    expect(result.current.searchQuery).toBe('');
    expect(result.current.currentMatchIndex).toBe(0);
    expect(result.current.totalMatches).toBe(0);
  });

  test('moduleId change resets state', () => {
    const { result, rerender } = renderHook(
      ({ moduleId }: { moduleId: string }) => useLessonSearch(contentRef, moduleId),
      { initialProps: { moduleId: '01' } },
    );
    act(() => result.current.setSearchActive(true));
    act(() => result.current.handleSearchQueryChange('hello'));
    rerender({ moduleId: '02' });
    expect(result.current.searchActive).toBe(false);
    expect(result.current.searchQuery).toBe('');
    expect(result.current.currentMatchIndex).toBe(0);
    expect(result.current.totalMatches).toBe(0);
  });

  test('initialSearchQuery sets search active', () => {
    const { result } = renderHook(() => useLessonSearch(contentRef, '01', 'prefilled'));
    expect(result.current.searchActive).toBe(true);
    expect(result.current.searchQuery).toBe('prefilled');
  });

  test('handles null initialSearchQuery', () => {
    const { result } = renderHook(() => useLessonSearch(contentRef, '01', null));
    expect(result.current.searchActive).toBe(false);
    expect(result.current.searchQuery).toBe('');
  });

  test('handleSearchPrev with 0 total matches wraps to end', () => {
    const { result } = renderHook(() => useLessonSearch(contentRef, '01'));
    act(() => result.current.handleSearchPrev());
    expect(result.current.currentMatchIndex).toBe(-1);
  });

  test('handleSearchNext with 0 total advances index', () => {
    const { result } = renderHook(() => useLessonSearch(contentRef, '01'));
    act(() => result.current.handleSearchNext());
    expect(result.current.currentMatchIndex).toBe(0);
  });

  test('handleSearchPrev wraps from 0 to last', () => {
    const { result } = renderHook(() => useLessonSearch(contentRef, '01'));
    act(() => result.current.handleSearchPrev());
    expect(result.current.currentMatchIndex).toBe(-1);
  });

  describe('effect scans for marks in contentRef', () => {
    test('sets totalMatches from mark elements', () => {
      addMarks(contentRef.current!, 3);
      const { result } = renderHook(() => useLessonSearch(contentRef, '01'));
      act(() => result.current.setSearchActive(true));
      act(() => result.current.handleSearchQueryChange('hello'));
      expect(result.current.totalMatches).toBe(3);
    });

    test('sets totalMatches to 0 when no marks exist', () => {
      const { result } = renderHook(() => useLessonSearch(contentRef, '01'));
      act(() => result.current.setSearchActive(true));
      act(() => result.current.handleSearchQueryChange('hello'));
      expect(result.current.totalMatches).toBe(0);
    });

    test('does not scan when searchActive is false', () => {
      addMarks(contentRef.current!, 3);
      const { result } = renderHook(() => useLessonSearch(contentRef, '01'));
      act(() => result.current.handleSearchQueryChange('hello'));
      expect(result.current.totalMatches).toBe(0);
    });

    test('does not scan when query is empty', () => {
      addMarks(contentRef.current!, 3);
      const { result } = renderHook(() => useLessonSearch(contentRef, '01'));
      act(() => result.current.setSearchActive(true));
      act(() => result.current.handleSearchQueryChange(''));
      expect(result.current.totalMatches).toBe(0);
    });

    test('does not crash when contentRef.current is null', () => {
      contentRef.current = null;
      const { result } = renderHook(() => useLessonSearch(contentRef, '01'));
      act(() => result.current.setSearchActive(true));
      act(() => result.current.handleSearchQueryChange('hello'));
      expect(result.current.totalMatches).toBe(0);
    });

    test('re-scans on query change', () => {
      addMarks(contentRef.current!, 5);
      const { result } = renderHook(() => useLessonSearch(contentRef, '01'));
      act(() => result.current.setSearchActive(true));
      act(() => result.current.handleSearchQueryChange('hello'));
      expect(result.current.totalMatches).toBe(5);
      act(() => result.current.handleSearchQueryChange('world'));
      expect(result.current.totalMatches).toBe(5);
    });

    test('handleSearchPrev navigates between matches', () => {
      addMarks(contentRef.current!, 3);
      const { result } = renderHook(() => useLessonSearch(contentRef, '01'));
      act(() => result.current.setSearchActive(true));
      act(() => result.current.handleSearchQueryChange('hello'));
      act(() => result.current.handleSearchPrev());
      expect(result.current.currentMatchIndex).toBe(2);
      act(() => result.current.handleSearchPrev());
      expect(result.current.currentMatchIndex).toBe(1);
    });

    test('handleSearchNext navigates between matches', () => {
      addMarks(contentRef.current!, 3);
      const { result } = renderHook(() => useLessonSearch(contentRef, '01'));
      act(() => result.current.setSearchActive(true));
      act(() => result.current.handleSearchQueryChange('hello'));
      act(() => result.current.handleSearchNext());
      expect(result.current.currentMatchIndex).toBe(1);
      act(() => result.current.handleSearchNext());
      expect(result.current.currentMatchIndex).toBe(2);
      act(() => result.current.handleSearchNext());
      expect(result.current.currentMatchIndex).toBe(0);
    });

    test('handleSearchClose clears totalMatches', () => {
      addMarks(contentRef.current!, 3);
      const { result } = renderHook(() => useLessonSearch(contentRef, '01'));
      act(() => result.current.setSearchActive(true));
      act(() => result.current.handleSearchQueryChange('hello'));
      expect(result.current.totalMatches).toBe(3);
      act(() => result.current.handleSearchClose());
      expect(result.current.totalMatches).toBe(0);
    });
  });
});
