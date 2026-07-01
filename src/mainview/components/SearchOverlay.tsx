import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';

import type { SearchResult } from '../../bun/search';
import { api } from '../api';
import { useCourseStore } from '../stores/courseStore';
import { showToast } from '../toast';
import CourseFilterChips from './CourseFilterChips';
import SearchResultItem from './SearchResultItem';

interface SearchOverlayProps {
  initialCourseIDs?: string[];
  initialCourseNames?: string[];
  onClose: () => void;
  onNavigate: (courseID: string, moduleID: string, query?: string, sectionID?: string) => void;
}

export default function SearchOverlay({
  initialCourseIDs,
  initialCourseNames,
  onClose,
  onNavigate,
}: SearchOverlayProps) {
  const { t } = useTranslation();
  const [closing, setClosing] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleClose = useCallback(() => {
    setClosing(true);
    closeTimerRef.current = setTimeout(() => onClose(), 200);
  }, [onClose]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const courses = useCourseStore((s) => s.courses);
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState('');
  const [allResults, setAllResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [courseFilters, setCourseFilters] = useState<string[]>(() => initialCourseIDs ?? []);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const resultsRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    if (courseFilters.length === 0) return allResults;
    return allResults.filter((r) => courseFilters.includes(r.courseID));
  }, [allResults, courseFilters]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim()) {
      setAllResults([]);
      return;
    }
    setLoading(true);
    timerRef.current = setTimeout(() => {
      void (async () => {
        try {
          const res = await api.search(query);
          setAllResults(res);
          setSelectedIdx(-1);
        } catch {
          showToast.error('toast.loadFailed');
          setAllResults([]);
        } finally {
          setLoading(false);
        }
      })();
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  const handleSelectionChange = useCallback((ids: string[]) => {
    setCourseFilters(ids);
    setSelectedIdx(-1);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        inputRef.current?.select();
        return;
      }
      if (e.key === 'Escape') {
        handleClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' && selectedIdx >= 0 && selectedIdx < results.length) {
        e.preventDefault();
        const r = results[selectedIdx];
        onNavigate(r.courseID, r.moduleID, query, r.sectionID);
        handleClose();
      }
    },
    [handleClose, results, selectedIdx, onNavigate, query],
  );

  const groupedResults = useMemo(() => {
    const grouped = new Map<
      string,
      { courseName: string; items: { r: SearchResult; idx: number }[] }
    >();
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const existing = grouped.get(r.courseID);
      if (existing) {
        existing.items.push({ r, idx: i });
      } else {
        grouped.set(r.courseID, {
          courseName: r.courseName,
          items: [{ r, idx: i }],
        });
      }
    }
    return grouped;
  }, [results]);

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-start justify-center pt-20 ${closing ? 'anim-overlay-out' : 'anim-overlay-in'}`}
    >
      <div className="fixed inset-0 bg-black/50" onClick={handleClose} />
      <div
        className={`relative bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 ${closing ? 'anim-pop-out' : 'anim-pop-in'}`}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-700">
          <span className="text-gray-400 text-sm">{t('icons.search')}</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => startTransition(() => setQuery(e.target.value))}
            placeholder={
              courseFilters.length > 0
                ? t('search.placeholderFiltered', {
                    count: courseFilters.length,
                  })
                : t('search.placeholder')
            }
            className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-500 outline-none"
          />
          {loading && <span className="text-xs text-gray-500">...</span>}
          <button
            onClick={handleClose}
            className="text-xs text-gray-500 hover:text-gray-300 px-1.5"
          >
            ESC
          </button>
        </div>

        <CourseFilterChips
          initialCourseIDs={initialCourseIDs}
          initialCourseNames={initialCourseNames}
          allCourses={courses}
          selectedIDs={courseFilters}
          onSelectionChange={handleSelectionChange}
          onEscape={() => inputRef.current?.focus()}
        />

        <div className="max-h-96 overflow-y-auto" ref={resultsRef}>
          {results.length > 0 && (
            <div className="px-2 py-1 text-[10px] text-gray-500 border-b border-gray-700">
              {t('search.results', { count: results.length })}
            </div>
          )}
          {results.length === 0 && query.trim() && !loading && (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              {t('search.noResults')}
            </div>
          )}
          {Array.from(groupedResults.entries()).map(([courseID, group]) => (
            <div key={courseID}>
              <div className="px-3 py-1.5 text-[11px] font-medium text-gray-400 bg-gray-800 border-b border-gray-700/50 sticky top-0 z-[1]">
                {group.courseName}
              </div>
              {group.items.map(({ r, idx }) => (
                <SearchResultItem
                  key={`${r.type}:${r.courseID}:${r.moduleID}:${idx}`}
                  result={r}
                  query={query}
                  isActive={selectedIdx === idx}
                  onNavigate={() => {
                    onNavigate(r.courseID, r.moduleID, query, r.sectionID);
                    handleClose();
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
