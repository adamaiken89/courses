import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface ViewerSearchProps {
  query: string;
  totalMatches: number;
  currentMatch: number;
  onQueryChange: (q: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

export default function ViewerSearch({
  query,
  totalMatches,
  currentMatch,
  onQueryChange,
  onPrev,
  onNext,
  onClose,
}: ViewerSearchProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        inputRef.current?.select();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) onPrev();
        else onNext();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
    },
    [onNext, onPrev, onClose],
  );

  return (
    <div
      data-testid="viewer-search"
      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-750 border-b border-gray-700 text-xs shrink-0"
    >
      <span className="text-gray-400 text-sm">{t('icons.search')}</span>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('viewerSearch.placeholder')}
        className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-500 outline-none min-w-0"
      />
      {query && (
        <span className="text-gray-500 tabular-nums whitespace-nowrap">
          {totalMatches > 0
            ? t('viewerSearch.matchCount', { current: currentMatch + 1, total: totalMatches })
            : t('viewerSearch.noMatches')}
        </span>
      )}
      {query && totalMatches > 0 && (
        <>
          <button
            onClick={onPrev}
            className="text-gray-400 hover:text-white px-1 py-0.5 rounded transition-colors"
            title={t('viewerSearch.prev')}
          >
            ↑
          </button>
          <button
            onClick={onNext}
            className="text-gray-400 hover:text-white px-1 py-0.5 rounded transition-colors"
            title={t('viewerSearch.next')}
          >
            ↓
          </button>
        </>
      )}
      <button
        onClick={onClose}
        className="text-gray-500 hover:text-gray-300 px-1.5 py-0.5 rounded transition-colors"
        title={t('icons.close')}
      >
        {t('icons.close')}
      </button>
    </div>
  );
}
