import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';

import type { SearchResult } from '../../bun/search';
import { api } from '../api';
import { useCourseStore } from '../stores/courseStore';
import { showToast } from '../toast';

interface SearchOverlayProps {
  initialCourseIDs?: string[];
  initialCourseNames?: string[];
  onClose: () => void;
  /** sectionID enables section-level scroll-to on navigate. Used by both
   *  global search (App.tsx) and course-scoped search (LessonPage.tsx). */
  onNavigate: (courseID: string, moduleID: string, query?: string, sectionID?: string) => void;
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="text-indigo-300 underline decoration-indigo-400/60 decoration-1 underline-offset-2">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}


export default function SearchOverlay({
  initialCourseIDs,
  initialCourseNames,
  onClose,
  onNavigate,
}: SearchOverlayProps) {
  const { t } = useTranslation();
  const courses = useCourseStore((s) => s.courses);
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState('');
  const [allResults, setAllResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [courseFilters, setCourseFilters] = useState<string[]>(() => initialCourseIDs ?? []);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [courseDropdownOpen, setCourseDropdownOpen] = useState(false);
  const [courseFilterText, setCourseFilterText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const courseInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const resultsRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Build name lookup from initial props + courses
  const courseNameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (initialCourseIDs && initialCourseNames) {
      for (let i = 0; i < initialCourseIDs.length; i++) {
        map.set(initialCourseIDs[i], initialCourseNames[i]);
      }
    }
    for (const c of courses) {
      if (!map.has(c.id)) map.set(c.id, c.displayName);
    }
    return map;
  }, [courses, initialCourseIDs, initialCourseNames]);

  const filteredCourses = useMemo(() => {
    if (!courseDropdownOpen) return [];
    const text = courseFilterText.toLowerCase();
    return courses.filter(
      (c) =>
        !courseFilters.includes(c.id) &&
        (!text || c.displayName.toLowerCase().includes(text)),
    );
  }, [courses, courseFilters, courseFilterText, courseDropdownOpen]);

  const results = useMemo(() => {
    if (courseFilters.length === 0) return allResults;
    return allResults.filter((r) => courseFilters.includes(r.courseID));
  }, [allResults, courseFilters]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!courseDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setCourseDropdownOpen(false);
        setCourseFilterText('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [courseDropdownOpen]);

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
          // Always search globally; filter client-side by courseFilters
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

  const addCourse = useCallback((id: string) => {
    setCourseFilters((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setCourseDropdownOpen(false);
    setCourseFilterText('');
    setSelectedIdx(-1);
  }, []);

  const removeCourse = useCallback((id: string) => {
    setCourseFilters((prev) => prev.filter((c) => c !== id));
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
        onClose();
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
        onClose();
        return;
      }
    },
    [onClose, results, selectedIdx, onNavigate, query],
  );

  const handleCourseInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCourseDropdownOpen(false);
        setCourseFilterText('');
        inputRef.current?.focus();
        return;
      }
      if (e.key === 'Enter' && filteredCourses.length > 0) {
        e.preventDefault();
        addCourse(filteredCourses[0].id);
        courseInputRef.current?.focus();
        return;
      }
    },
    [filteredCourses, addCourse],
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg mx-4"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
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
          <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-300 px-1.5">
            ESC
          </button>
        </div>

        {/* Course filter chips + add button */}
        <div className="px-3 py-1.5 border-b border-gray-700 flex items-center gap-1 flex-wrap relative">
          {courseFilters.length === 0 && (
            <span className="text-[10px] text-gray-500">{t('search.allCoursesHint')}</span>
          )}
          {courseFilters.map((id) => (
            <span
              key={id}
              className="text-[10px] text-indigo-400 bg-indigo-900/30 px-2 py-0.5 rounded-full flex items-center gap-1"
            >
              {courseNameMap.get(id) ?? id}
              <button
                onClick={() => removeCourse(id)}
                className="text-indigo-300 hover:text-white ml-0.5"
              >
                {t('icons.close')}
              </button>
            </span>
          ))}
          <button
            onClick={() => {
              setCourseDropdownOpen((o) => !o);
              setCourseFilterText('');
              setTimeout(() => courseInputRef.current?.focus(), 0);
            }}
            className="text-[10px] text-gray-400 hover:text-gray-200 px-1.5 py-0.5 rounded bg-gray-700/50 hover:bg-gray-700 transition-colors"
          >
            + {t('search.addCourse')}
          </button>

          {/* Typeahead dropdown */}
          {courseDropdownOpen && (
            <div
              ref={dropdownRef}
              className="absolute left-0 top-full w-full bg-gray-800 border border-gray-600 rounded-b-lg shadow-xl z-10 max-h-48 overflow-y-auto"
            >
              <input
                ref={courseInputRef}
                type="text"
                value={courseFilterText}
                onChange={(e) => setCourseFilterText(e.target.value)}
                onKeyDown={handleCourseInputKeyDown}
                placeholder={t('search.courseFilterPlaceholder')}
                className="w-full px-3 py-2 bg-transparent text-xs text-gray-200 placeholder-gray-500 outline-none border-b border-gray-600"
              />
              {courseFilterText && filteredCourses.length === 0 && (
                <div className="px-3 py-2 text-[10px] text-gray-500">{t('search.noResults')}</div>
              )}
              {courseFilterText && filteredCourses.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    addCourse(c.id);
                    courseInputRef.current?.focus();
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-indigo-900/30 transition-colors"
                >
                  {highlightMatch(c.displayName, courseFilterText)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Results */}
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
          {(() => {
            // Group results by course
            const grouped = new Map<string, { courseName: string; items: { r: SearchResult; idx: number }[] }>();
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
            return Array.from(grouped.entries()).map(([courseID, group]) => (
              <div key={courseID}>
                <div className="px-3 py-1.5 text-[11px] font-medium text-gray-400 bg-gray-800 border-b border-gray-700/50 sticky top-0 z-[1]">
                  {group.courseName}
                </div>
                {group.items.map(({ r, idx }) => (
                  <button
                    key={`${r.type}:${r.courseID}:${r.moduleID}:${idx}`}
                    onClick={() => {
                      onNavigate(r.courseID, r.moduleID, query, r.sectionID);
                      onClose();
                    }}
                    className={`w-full text-left px-3 py-2 border-b border-gray-700/50 last:border-0 transition-colors ${
                      selectedIdx === idx ? 'bg-indigo-900/30' : 'hover:bg-gray-750'
                    }`}
                  >
                    <div className="min-w-0">
                      {(r.sectionTitle || r.moduleName) && (
                        <p className="text-[10px] text-gray-500 truncate mb-0.5">
                          {r.moduleName}
                          {r.sectionTitle && (
                            <>
                              <span className="text-gray-600"> &rsaquo; </span>
                              {highlightMatch(r.sectionTitle, query)}
                            </>
                          )}
                        </p>
                      )}
                      <p className="text-xs text-gray-300 line-clamp-2 leading-relaxed">
                        {highlightMatch(r.snippet, query)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ));
          })()}
        </div>
      </div>
    </div>
  );
}
