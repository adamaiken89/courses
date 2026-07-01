import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { Bookmark, Section } from '../../../bun/types';
import {
  BOOKMARK_AMBER,
  SECTION_ACTIVE_BG,
  SECTION_ACTIVE_TEXT,
  SECTION_HOVER_BG,
  SECTION_INACTIVE_BOOKMARK,
  SECTION_LEVEL_COLORS,
} from '../../colors';
import { logger } from '../../logger';
import { toggleVariants } from '../ui';

interface SectionsPanelProps {
  sections: Section[];
  visibleSection: string | null;
  bookmarks: Bookmark[];
  onScrollToSection: (sectionId: string) => void;
  onToggleSectionBookmark: (sectionId: string, hasBookmark: boolean, heading: string) => void;
  onClose: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  onPrevModule?: () => void;
  onNextModule?: () => void;
}

export default function SectionsPanel({
  sections,
  visibleSection,
  bookmarks,
  onScrollToSection,
  onToggleSectionBookmark,
  onClose,
  hasPrev,
  hasNext,
  onPrevModule,
  onNextModule,
}: SectionsPanelProps) {
  const { t } = useTranslation();
  const sectionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visibleSection || !sectionsRef.current) return;
    const el = sectionsRef.current.querySelector(`[data-section-id="${visibleSection}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [visibleSection]);

  return (
    <div
      data-testid="sections-panel"
      className="w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl flex flex-col max-h-[70vh]"
    >
      {sections.length > 0 && (
        <>
          <div className="shrink-0 px-2.5 py-1.5 border-b border-gray-700 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-indigo-400 shrink-0">
              {t('lesson.sections')}
            </span>
            <div className="flex items-center gap-1 min-w-0">
              <span className="text-[10px] text-gray-500 shrink-0">{sections.length}</span>
              <button onClick={onClose} className={toggleVariants({ active: true })}>
                →
              </button>
            </div>
          </div>
          <div className="shrink-0 flex border-b border-gray-700">
            <button
              onClick={onPrevModule}
              disabled={!hasPrev}
              className={`flex-1 text-xs py-0.5 transition-colors ${
                hasPrev
                  ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                  : 'text-gray-600 cursor-not-allowed'
              }`}
              title={t('lesson.prevModule')}
            >
              ◀
            </button>
            <button
              onClick={onNextModule}
              disabled={!hasNext}
              className={`flex-1 text-xs py-0.5 transition-colors ${
                hasNext
                  ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                  : 'text-gray-600 cursor-not-allowed'
              }`}
              title={t('lesson.nextModule')}
            >
              ▶
            </button>
          </div>
          <div className="overflow-y-auto" ref={sectionsRef}>
            {sections.map((s) => {
              const isActive = s.id === visibleSection;
              const isBookmarked = bookmarks.some((b) => b.sectionID === s.id);
              const levelColor = SECTION_LEVEL_COLORS[Math.min(s.level - 1, 5)];
              return (
                <button
                  key={s.id}
                  data-section-id={s.id}
                  onClick={() => {
                    logger.debug(
                      { sectionId: s.id, heading: s.heading },
                      'SectionsPanel: section clicked',
                    );
                    onScrollToSection(s.id);
                  }}
                  className="w-full text-left px-2.5 py-0.5 text-xs transition-colors"
                  style={Object.assign(
                    { paddingLeft: `${(s.level - 1) * 16 + 10}px` },
                    isActive
                      ? { backgroundColor: SECTION_ACTIVE_BG, color: SECTION_ACTIVE_TEXT }
                      : { backgroundColor: 'transparent', color: levelColor },
                  )}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = SECTION_HOVER_BG;
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div className="flex items-start gap-0.5" style={{ paddingRight: '2px' }}>
                    <span className="flex-1 whitespace-normal break-words min-w-0">
                      {s.heading}
                    </span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSectionBookmark(s.id, isBookmarked, s.heading);
                      }}
                      className="shrink-0 cursor-pointer"
                      style={{
                        color: isBookmarked
                          ? BOOKMARK_AMBER
                          : isActive
                            ? SECTION_ACTIVE_TEXT
                            : SECTION_INACTIVE_BOOKMARK,
                      }}
                      title={
                        isBookmarked ? t('lesson.removeBookmark') : t('lesson.bookmarkSection')
                      }
                    >
                      {isBookmarked ? t('icons.starFilled') : t('icons.starEmpty')}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
