import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';

import { api } from '../api';
import { useBookmarks } from '../hooks/useBookmarks';
import { useHighlights } from '../hooks/useHighlights';
import { useSettingsStore } from '../stores/settingsStore';
import { THEME_TOKENS, themeToCSSVars } from '../themes';
import { Section } from './sidebar-types';
import { toggleVariants } from './ui';
import StudyTools from './StudyTools';
import { rehypeHighlightText, HIGHLIGHT_COLORS } from './rehype-highlight-text';
import type { ModuleMeta } from '../../bun/types';
import type { Theme } from '../themes';

interface Props {
  courseId: string;
  module: ModuleMeta;
  initialSectionID?: string;
  onStartQuiz: () => void;
  onPrevModule?: () => void;
  onNextModule?: () => void;
  hasPrevModule?: boolean;
  hasNextModule?: boolean;
  prevModuleName?: string;
  nextModuleName?: string;
}

function extractText(children: ReactNode): string {
  let text = '';
  const walk = (node: ReactNode) => {
    if (typeof node === 'string') text += node;
    else if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object' && 'props' in node) {
      walk((node as { props: { children: ReactNode } }).props.children);
    }
  };
  walk(children);
  return text;
}

function headingId(children: ReactNode): string {
  return extractText(children)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[:,()]/g, '')
    .replace(/[^a-z0-9-]/g, '');
}

const headingRenderer = (level: number) =>
  function Heading({ children }: { children?: ReactNode }) {
    const id = headingId(children);
    const Tag = `h${level}` as keyof JSX.IntrinsicElements;
    return <Tag id={id}>{children}</Tag>;
  };

const components = {
  h1: headingRenderer(1),
  h2: headingRenderer(2),
  h3: headingRenderer(3),
  h4: headingRenderer(4),
  h5: headingRenderer(5),
  h6: headingRenderer(6),
};

const THEME_LABELS: Record<Theme, string> = {
  dark: 'Dark',
  oled: 'OLED',
  nord: 'Nord',
  sepia: 'Sepia',
  gruvbox: 'Gruvbox',
  light: 'Light',
  'solarized-dark': 'Solarized',
  catppuccin: 'Catppuccin',
};
const THEME_ICONS: Record<Theme, string> = {
  dark: '🌙',
  oled: '🖤',
  nord: '❄️',
  sepia: '📜',
  gruvbox: '🪵',
  light: '☀️',
  'solarized-dark': '🔆',
  catppuccin: '🩷',
};

export default function LessonView({
  courseId,
  module,
  initialSectionID,
  onStartQuiz: _onStartQuiz,
  onPrevModule,
  onNextModule,
  hasPrevModule,
  hasNextModule,
  prevModuleName: _prevModuleName,
  nextModuleName: _nextModuleName,
}: Props) {
  const { t } = useTranslation();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<Section[]>([]);
  const [visibleSection, setVisibleSection] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [highlightSelection, setHighlightSelection] = useState<{
    text: string;
    range: Range;
  } | null>(null);
  const [highlightPickerPos, setHighlightPickerPos] = useState({ x: 0, y: 0 });

  const {
    bookmarks,
    handleToggleBookmark: toggleBookmark,
    handleDeleteBookmark: _handleDeleteBookmark,
    hasActiveBookmark,
  } = useBookmarks(courseId, module.id, visibleSection);
  const {
    highlights,
    addHighlight,
    deleteHighlight: _deleteHighlight,
  } = useHighlights(courseId, module.id);

  const [showTools, setShowTools] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [totalModules, setTotalModules] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);

  const fontSize = useSettingsStore((s) => s.fontSize);
  const theme = useSettingsStore((s) => s.theme);
  const wideMode = useSettingsStore((s) => s.wideMode);
  const setWideMode = useSettingsStore((s) => s.setWideMode);
  const showSections = useSettingsStore((s) => s.showSections);
  const toggleSections = useSettingsStore((s) => s.toggleSections);
  const incFontSize = useSettingsStore((s) => s.incFontSize);
  const decFontSize = useSettingsStore((s) => s.decFontSize);
  const cycleTheme = useSettingsStore((s) => s.cycleTheme);
  const themeVars = useMemo(() => themeToCSSVars(THEME_TOKENS[theme]), [theme]);
  const rehypePlugins = useMemo(
    () => [rehypeHighlight, rehypeHighlightText(highlights)],
    [highlights],
  );

  useEffect(() => {
    setLoading(true);
    contentRef.current?.scrollTo(0, 0);
    api.courses
      .lesson(courseId, module.id)
      .then((lesson) => {
        setContent(lesson.content);
        setLoading(false);
        requestAnimationFrame(() => contentRef.current?.focus());
      })
      .catch(() => setLoading(false));
    api.courses
      .sections(courseId, module.id)
      .then(setSections)
      .catch(() => {});
    api.storage
      .isCompleted(courseId, module.id)
      .then((r) => setIsCompleted(r.completed))
      .catch(() => {});
    api.courses
      .modules(courseId)
      .then((mods) => {
        setTotalModules(mods.length);
        api.storage
          .completedCount(courseId)
          .then((r) => setCompletedCount(r.count))
          .catch(() => {});
      })
      .catch(() => {});
  }, [courseId, module.id]);

  useEffect(() => {
    if (initialSectionID && content) {
      requestAnimationFrame(() => {
        scrollToSection(initialSectionID);
      });
    }
  }, [initialSectionID, content]);

  const handleToggleBookmark = useCallback(() => {
    const title = visibleSection
      ? `${module.name} – ${sections.find((s) => s.id === visibleSection)?.heading}`
      : module.name;
    toggleBookmark(title, visibleSection);
  }, [visibleSection, module.name, sections, toggleBookmark]);

  const handleToggleSectionBookmark = useCallback(
    (sectionId: string, _hasBookmark: boolean, heading: string) => {
      toggleBookmark(`${module.name} – ${heading}`, sectionId);
    },
    [module.name, toggleBookmark],
  );

  const handleToggleCompleted = useCallback(async () => {
    const result = await api.storage.toggleCompleted(courseId, module.id);
    setIsCompleted(result.completed);
    const count = await api.storage.completedCount(courseId);
    setCompletedCount(count.count);
  }, [courseId, module.id]);

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) {
      setShowHighlightPicker(false);
      setHighlightSelection(null);
      return;
    }
    const text = selection.toString().trim();
    if (!text || text.length > 500) return;
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setHighlightSelection({ text, range });
    setHighlightPickerPos({ x: rect.left + rect.width / 2, y: rect.top - 10 });
    setShowHighlightPicker(true);
  };

  const handleAddHighlight = async (color: string) => {
    if (!highlightSelection) return;
    await addHighlight(highlightSelection.text, color);
    setShowHighlightPicker(false);
    setHighlightSelection(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleScroll = () => {
    if (!contentRef.current || sections.length === 0) return;
    const el = contentRef.current;
    const headings = el.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let currentId: string | null = null;
    headings.forEach((h) => {
      const rect = h.getBoundingClientRect();
      if (rect.top < 150) currentId = h.id;
    });
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 80;
    if (atBottom && sections.length > 0) {
      currentId = sections[sections.length - 1].id;
    }
    setVisibleSection(currentId);
  };

  const scrollToSection = (sectionId: string) => {
    const container = contentRef.current;
    if (!container) return;
    const el = container.querySelector(`[id="${sectionId}"]`);
    if (!el) return;
    const offset =
      el.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop -
      20;
    container.scrollTop = offset;
    container.focus();
  };

  const sectionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visibleSection || !sectionsRef.current) return;
    const el = sectionsRef.current.querySelector(`[data-section-id="${visibleSection}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [visibleSection]);

  const LEVEL_COLORS = ['#d1d5db', '#c7d2fe', '#bae6fd', '#d9f99d', '#fde68a', '#e9d5ff'];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (showHighlightPicker) return;
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (hasPrevModule && onPrevModule) onPrevModule();
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (hasNextModule && onNextModule) onNextModule();
          break;
        case 'ArrowUp':
          e.preventDefault();
          contentRef.current?.scrollBy({ top: -80, behavior: 'smooth' });
          break;
        case 'ArrowDown':
          e.preventDefault();
          contentRef.current?.scrollBy({ top: 80, behavior: 'smooth' });
          break;
        case 't':
        case 'T':
          cycleTheme();
          break;
        case 'w':
        case 'W':
          setWideMode(!wideMode);
          break;
        case 's':
        case 'S':
          toggleSections();
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    hasPrevModule,
    hasNextModule,
    onPrevModule,
    onNextModule,
    showHighlightPicker,
    cycleTheme,
    setWideMode,
    toggleSections,
  ]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);
      if (absX > 40 && absX > absY * 1.5) {
        e.preventDefault();
        if (e.deltaX > 0 && hasNextModule && onNextModule) onNextModule();
        else if (e.deltaX < 0 && hasPrevModule && onPrevModule) onPrevModule();
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [hasPrevModule, hasNextModule, onPrevModule, onNextModule]);

  if (loading)
    return <div className="p-8 text-center text-gray-400">{t('lesson.loadingLesson')}</div>;

  return (
    <div className="flex flex-1 overflow-hidden">
      {showTools && (
        <StudyTools
          courseId={courseId}
          moduleId={module.id}
          moduleName={module.name}
          sections={sections}
          visibleSection={visibleSection}
          content={content}
          onClose={() => setShowTools(false)}
        />
      )}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-1.5 flex items-center gap-2 shrink-0">
          <button
            onClick={decFontSize}
            className="px-2 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 rounded"
            title={t('lesson.decreaseFontSize')}
          >
            A-
          </button>
          <span className="text-xs text-gray-400 w-8 text-center">{fontSize}</span>
          <button
            onClick={incFontSize}
            className="px-2 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 rounded"
            title={t('lesson.increaseFontSize')}
          >
            A+
          </button>
          <div className="h-3 w-px bg-gray-600" />
          <button
            onClick={cycleTheme}
            className="px-2 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 rounded"
            title={`${t('settings.readingTheme')}: ${THEME_LABELS[theme]}`}
          >
            {THEME_ICONS[theme]}
          </button>
          <div className="h-3 w-px bg-gray-600" />
          <button
            onClick={() => setWideMode(!wideMode)}
            className={toggleVariants({ active: wideMode })}
            title={t('lesson.toggleWideMode')}
          >
            {wideMode ? t('lesson.wide') : t('lesson.narrow')}
          </button>
          <div className="h-3 w-px bg-gray-600" />
          <button
            onClick={handleToggleBookmark}
            className={toggleVariants({ active: hasActiveBookmark })}
            title={visibleSection ? t('lesson.bookmarkSection') : t('lesson.bookmarkModule')}
          >
            {hasActiveBookmark ? '★' : '☆'} {t('lesson.bookmark')}
          </button>
          <div className="h-3 w-px bg-gray-600" />
          <button
            onClick={() => setShowTools(!showTools)}
            className={toggleVariants({ active: showTools })}
            title={t('lesson.toggleStudyTools')}
          >
            {t('lesson.tools')}
          </button>
        </div>

        {!showSections && (
          <button
            onClick={toggleSections}
            className="fixed right-4 top-24 z-50 w-10 h-10 rounded-full bg-gray-800 border border-gray-700 shadow-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            title={t('lesson.toggleSectionsPanel')}
          >
            ☰
          </button>
        )}

        {showSections && (
          <div className="relative h-0 z-50">
            <div className="absolute right-4 top-2 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl flex flex-col">
              {sections.length > 0 && (
                <>
                  <div className="shrink-0 px-2.5 py-1.5 border-b border-gray-700 flex items-center justify-between">
                    <span className="text-xs font-semibold text-indigo-400">
                      {t('lesson.sections')}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-500">{sections.length}</span>
                      <button onClick={toggleSections} className={toggleVariants({ active: true })}>
                        →
                      </button>
                    </div>
                  </div>
                  <div className="overflow-y-auto max-h-[70vh]" ref={sectionsRef}>
                    {sections.map((s) => {
                      const isActive = s.id === visibleSection;
                      const isBookmarked = bookmarks.some((b) => b.sectionID === s.id);
                      const levelColor = LEVEL_COLORS[Math.min(s.level - 1, 5)];
                      return (
                        <button
                          key={s.id}
                          data-section-id={s.id}
                          onClick={() => scrollToSection(s.id)}
                          className="w-full text-left px-2.5 py-0.5 text-xs transition-colors"
                          style={Object.assign(
                            { paddingLeft: `${(s.level - 1) * 16 + 10}px` },
                            isActive
                              ? { backgroundColor: '#4f46e5', color: '#fff' }
                              : { backgroundColor: 'transparent', color: levelColor },
                          )}
                          onMouseEnter={(e) => {
                            if (!isActive) e.currentTarget.style.backgroundColor = '#374151';
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
                                handleToggleSectionBookmark(s.id, isBookmarked, s.heading);
                              }}
                              className="shrink-0 cursor-pointer"
                              style={{
                                color: isBookmarked ? '#fbbf24' : isActive ? '#fff' : '#4b5563',
                              }}
                              title={
                                isBookmarked
                                  ? t('lesson.removeBookmark')
                                  : t('lesson.bookmarkSection')
                              }
                            >
                              {isBookmarked ? '★' : '☆'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div
          className="flex-1 overflow-y-auto p-6"
          ref={contentRef}
          tabIndex={-1}
          onScroll={handleScroll}
          onMouseUp={handleTextSelection}
        >
          <div
            className={`book-content${wideMode ? ' book-content-wide' : ''}`}
            style={{ fontSize: `${fontSize}px`, ...themeVars }}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={rehypePlugins}
              components={components}
            >
              {content}
            </ReactMarkdown>

            <div
              style={{
                marginTop: '6rem',
                paddingTop: '2rem',
                borderTop: '1px solid var(--book-h2-border)',
                marginBottom: '50vh',
              }}
            >
              {totalModules > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs opacity-60">{t('lesson.moduleProgress')}</span>
                    <span className="text-xs opacity-60">
                      {completedCount}/{totalModules}
                    </span>
                  </div>
                  <div
                    className="h-1.5 rounded-full overflow-hidden"
                    style={{ background: 'var(--book-code-bg)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(completedCount / totalModules) * 100}%`,
                        background:
                          completedCount === totalModules
                            ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                            : 'linear-gradient(90deg, #6366f1, #818cf8)',
                      }}
                    />
                  </div>
                </div>
              )}
              <button
                onClick={handleToggleCompleted}
                className="w-full py-3 rounded-lg font-semibold text-sm transition-all duration-200"
                style={{
                  background: isCompleted
                    ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                    : 'var(--book-code-bg)',
                  color: isCompleted ? '#fff' : 'var(--book-text)',
                  border: `1px solid ${isCompleted ? '#16a34a' : 'var(--book-h2-border)'}`,
                }}
              >
                {isCompleted ? t('lesson.completed') : t('lesson.markAsComplete')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showHighlightPicker && highlightSelection && (
        <div
          className="fixed z-50 flex gap-1 bg-gray-800 border border-gray-600 rounded-lg p-1.5 shadow-xl"
          style={{
            left: highlightPickerPos.x,
            top: highlightPickerPos.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          {Object.entries(HIGHLIGHT_COLORS).map(([name, color]) => (
            <button
              key={name}
              onClick={() => handleAddHighlight(name)}
              className="w-6 h-6 rounded-full border-2 border-gray-600 hover:border-white transition-colors"
              style={{ backgroundColor: color }}
              title={name}
            />
          ))}
          <div className="w-px h-6 bg-gray-600 mx-1" />
          <button
            onClick={() => {
              setShowHighlightPicker(false);
              setHighlightSelection(null);
              window.getSelection()?.removeAllRanges();
            }}
            className="w-6 h-6 rounded text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors flex items-center justify-center"
            title={t('lesson.cancelHighlight')}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
