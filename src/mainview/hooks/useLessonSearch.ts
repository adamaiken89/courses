import type { RefObject } from 'react';
import { useCallback, useEffect, useState } from 'react';

export interface UseLessonSearchReturn {
  searchActive: boolean;
  searchQuery: string;
  currentMatchIndex: number;
  totalMatches: number;
  setSearchActive: (v: boolean) => void;
  handleSearchQueryChange: (q: string) => void;
  handleSearchPrev: () => void;
  handleSearchNext: () => void;
  handleSearchClose: () => void;
}

export function useLessonSearch(
  contentRef: RefObject<HTMLDivElement | null>,
  moduleId: string,
  initialSearchQuery?: string | null,
): UseLessonSearchReturn {
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);

  useEffect(() => {
    setSearchActive(false);
    setSearchQuery('');
    setCurrentMatchIndex(0);
    setTotalMatches(0);
  }, [moduleId]);

  useEffect(() => {
    if (initialSearchQuery) {
      setSearchActive(true);
      setSearchQuery(initialSearchQuery);
      setCurrentMatchIndex(0);
      setTotalMatches(0);
    }
  }, [initialSearchQuery]);

  useEffect(() => {
    if (!searchActive || !searchQuery) return;
    const el = contentRef.current;
    if (!el) return;
    const matches = el.querySelectorAll<HTMLElement>('mark[data-search-match]');
    setTotalMatches(matches.length);
    if (matches.length > 0) {
      const idx = Math.min(currentMatchIndex, matches.length - 1);
      const target = matches[idx];
      const offset =
        target.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 80;
      el.scrollTop = offset; // eslint-disable-line react-compiler/react-compiler
    }
  }, [searchQuery, searchActive, currentMatchIndex, contentRef]);

  const handleSearchQueryChange = useCallback((q: string) => {
    setSearchQuery(q);
    setCurrentMatchIndex(0);
  }, []);

  const handleSearchPrev = useCallback(() => {
    setCurrentMatchIndex((i) => (i > 0 ? i - 1 : totalMatches - 1));
  }, [totalMatches]);

  const handleSearchNext = useCallback(() => {
    setCurrentMatchIndex((i) => (i < totalMatches - 1 ? i + 1 : 0));
  }, [totalMatches]);

  const handleSearchClose = useCallback(() => {
    setSearchActive(false);
    setSearchQuery('');
    setCurrentMatchIndex(0);
    setTotalMatches(0);
  }, []);

  return {
    searchActive,
    searchQuery,
    currentMatchIndex,
    totalMatches,
    setSearchActive,
    handleSearchQueryChange,
    handleSearchPrev,
    handleSearchNext,
    handleSearchClose,
  };
}
