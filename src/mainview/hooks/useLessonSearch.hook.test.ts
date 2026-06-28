import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'bun:test';
import { createRef } from 'react';

import { useLessonSearch } from './useLessonSearch';

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

  test('handleSearchPrev wraps from 0 to last (totalMatches - 1 = -1)', () => {
    const { result } = renderHook(() => useLessonSearch(contentRef, '01'));
    act(() => result.current.handleSearchPrev());
    expect(result.current.currentMatchIndex).toBe(-1);
  });
});
