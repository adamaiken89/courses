import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { logger } from '../../logger';
import { toggleVariants } from '../ui';
import {
  SECTION_ACTIVE_BG,
  SECTION_ACTIVE_TEXT,
  SECTION_HOVER_BG,
  SECTION_INACTIVE_BOOKMARK,
  BOOKMARK_AMBER,
  SECTION_LEVEL_COLORS,
} from '../../colors';
import type { Section, Bookmark } from '../sidebar-types';

interface SectionsPanelProps {
  sections: Section[];
  visibleSection: string | null;
  bookmarks: Bookmark[];
  onScrollToSection: (sectionId: string) => void;
  onToggleSectionBookmark: (sectionId: string, hasBookmark: boolean, heading: string) => void;
  onClose: () => void;
}

export default function SectionsPanel({
  sections,
  visibleSection,
  bookmarks,
  onScrollToSection,
  onToggleSectionBookmark,
  onClose,
}: SectionsPanelProps) {
  const { t } = useTranslation();
  const sectionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visibleSection || !sectionsRef.current) return;
    const el = sectionsRef.current.querySelector(`[data-section-id="${visibleSection}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [visibleSection]);

  return (
    <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl flex flex-col max-h-[70vh]">
      {sections.length > 0 && (
        <>
          <div className="shrink-0 px-2.5 py-1.5 border-b border-gray-700 flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-400">{t('lesson.sections')}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-500">{sections.length}</span>
              <button onClick={onClose} className={toggleVariants({ active: true })}>
                →
              </button>
            </div>
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
