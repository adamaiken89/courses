import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Course } from '../../bun/types';
import { highlightMatch } from './searchHighlight';

interface CourseFilterChipsProps {
  initialCourseIDs?: string[];
  initialCourseNames?: string[];
  allCourses: Course[];
  selectedIDs: string[];
  onSelectionChange: (ids: string[]) => void;
  onEscape?: () => void;
}

export default function CourseFilterChips({
  initialCourseIDs,
  initialCourseNames,
  allCourses,
  selectedIDs,
  onSelectionChange,
  onEscape,
}: CourseFilterChipsProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [ft, setFt] = useState('');
  const ddRef = useRef<HTMLDivElement>(null);
  const inpRef = useRef<HTMLInputElement>(null);
  const nameMap = useMemo(() => {
    const m = new Map<string, string>();
    if (initialCourseIDs && initialCourseNames)
      for (let i = 0; i < initialCourseIDs.length; i++)
        m.set(initialCourseIDs[i], initialCourseNames[i]);
    for (const c of allCourses) if (!m.has(c.id)) m.set(c.id, c.displayName);
    return m;
  }, [allCourses, initialCourseIDs, initialCourseNames]);
  const filtered = useMemo(() => {
    if (!open) return [];
    const text = ft.toLowerCase();
    return allCourses.filter(
      (c) => !selectedIDs.includes(c.id) && (!text || c.displayName.toLowerCase().includes(text)),
    );
  }, [allCourses, selectedIDs, ft, open]);
  const closeDrop = useCallback(() => {
    setOpen(false);
    setFt('');
  }, []);
  const addCourse = useCallback(
    (id: string) => {
      if (!selectedIDs.includes(id)) onSelectionChange([...selectedIDs, id]);
      closeDrop();
    },
    [selectedIDs, onSelectionChange, closeDrop],
  );
  const removeCourse = useCallback(
    (id: string) => {
      onSelectionChange(selectedIDs.filter((c) => c !== id));
    },
    [selectedIDs, onSelectionChange],
  );
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ddRef.current && !ddRef.current.contains(e.target as Node)) closeDrop();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, closeDrop]);
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeDrop();
        onEscape?.();
        return;
      }
      if (e.key === 'Enter' && filtered.length > 0) {
        e.preventDefault();
        addCourse(filtered[0].id);
        inpRef.current?.focus();
      }
    },
    [filtered, addCourse, onEscape, closeDrop],
  );
  return (
    <div className="px-3 py-1.5 border-b border-gray-700 flex items-center gap-1 flex-wrap relative">
      {selectedIDs.length === 0 && (
        <span className="text-[10px] text-gray-500">{t('search.allCoursesHint')}</span>
      )}
      {selectedIDs.map((id) => (
        <span
          key={id}
          className="text-[10px] text-indigo-400 bg-indigo-900/30 px-2 py-0.5 rounded-full flex items-center gap-1"
        >
          {nameMap.get(id) ?? id}
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
          setOpen((o) => !o);
          setFt('');
          setTimeout(() => inpRef.current?.focus(), 0);
        }}
        className="text-[10px] text-gray-400 hover:text-gray-200 px-1.5 py-0.5 rounded bg-gray-700/50 hover:bg-gray-700 transition-colors"
      >
        + {t('search.addCourse')}
      </button>
      {open && (
        <div
          ref={ddRef}
          className="absolute left-0 top-full w-full bg-gray-800 border border-gray-600 rounded-b-lg shadow-xl z-10 max-h-48 overflow-y-auto"
        >
          <input
            ref={inpRef}
            type="text"
            value={ft}
            onChange={(e) => setFt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('search.courseFilterPlaceholder')}
            className="w-full px-3 py-2 bg-transparent text-xs text-gray-200 placeholder-gray-500 outline-none border-b border-gray-600"
          />
          {ft && filtered.length === 0 && (
            <div className="px-3 py-2 text-[10px] text-gray-500">{t('search.noResults')}</div>
          )}
          {ft &&
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  addCourse(c.id);
                  inpRef.current?.focus();
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-indigo-900/30 transition-colors"
              >
                {highlightMatch(c.displayName, ft)}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
