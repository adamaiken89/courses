import { useState, useEffect, useRef, useCallback, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { showToast } from '../toast';
import type { SearchResult } from '../../bun/search';

interface SearchOverlayProps {
  onClose: () => void;
  onNavigate: (courseID: string, moduleID: number) => void;
}

const TYPE_ICONS: Record<string, string> = {
  lesson: 'icons.searchLesson',
  note: 'icons.note',
  highlight: 'icons.searchHighlight',
};

export default function SearchOverlay({ onClose, onNavigate }: SearchOverlayProps) {
  const { t } = useTranslation();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await api.search(query);
        setResults(res);
      } catch {
        showToast.error('toast.loadFailed');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-700">
          <span className="text-gray-400 text-sm">{t('icons.search')}</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => startTransition(() => setQuery(e.target.value))}
            placeholder={t('search.placeholder')}
            className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-500 outline-none"
          />
          {loading && <span className="text-xs text-gray-500">...</span>}
          <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-300 px-1.5">
            ESC
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto">
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
          {results.map((r, i) => (
            <button
              key={`${r.type}:${r.courseID}:${r.moduleID}:${i}`}
              onClick={() => {
                onNavigate(r.courseID, r.moduleID);
                onClose();
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-gray-750 border-b border-gray-700/50 last:border-0 transition-colors"
            >
              <div className="flex items-start gap-2">
                <span className="text-sm shrink-0 mt-0.5">
                  {t(TYPE_ICONS[r.type] || 'icons.searchLesson')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-300 truncate">{r.snippet}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {t(`search.${r.type}Result`)} {t('search.inCourse', { course: r.courseName })}{' '}
                    &middot; {r.moduleName}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
