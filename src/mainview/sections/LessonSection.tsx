import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { api } from '../api';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import type { PluggableList } from 'unified';

import { useSelection } from '../hooks/useSelection';
import { useSettingsStore } from '../stores/settingsStore';
import { THEME_TOKENS, themeToCSSVars } from '../themes';
import { COMPLETION_GREEN, COMPLETION_GREEN_DARK, SECTION_ACTIVE_TEXT } from '../colors';
import SectionsPanel from '../components/lesson/SectionsPanel';
import SelectionToolbar from '../components/lesson/SelectionToolbar';
import type { SelectionToolbarHandle } from '../components/lesson/SelectionToolbar';
import NoteEditor from '../components/lesson/NoteEditor';
import CardEditor from '../components/lesson/CardEditor';
import StudyTools from '../components/StudyTools';
import PomodoroTimer from '../components/PomodoroTimer';
import ViewerSearch from '../components/lesson/ViewerSearch';
import { rehypeHighlightText } from '../components/rehype-highlight-text';
import { rehypeSearchText } from '../components/rehype-search-text';
import { useShortcuts } from '../hooks/useShortcuts';
import type { ModuleMeta, Bookmark, Highlight, Section } from '../../bun/types';
import type { MetaField } from '../../bun/lesson-markdown';
import { headingId } from '../../bun/lesson-markdown';

type DivRef = React.RefObject<HTMLDivElement>;

interface Props {
  courseId: string;
  courseName: string;
  module: ModuleMeta;
  content: string;
  h1: string;
  meta: MetaField[];
  bodyContent: string;
  loading: boolean;
  sections: Section[];
  visibleSection: string | null;
  isCompleted: boolean;
  contentRef: DivRef;
  scrollToSection: (sectionId: string) => void;
  handleScroll: () => void;
  handleToggleCompleted: () => Promise<void>;
  bookmarks: Bookmark[];
  highlights: Highlight[];
  addHighlight: (
    text: string,
    color: string,
    startOffset?: number,
    endOffset?: number,
  ) => Promise<void>;
  onPrevModule?: () => void;
  onNextModule?: () => void;
  hasPrevModule?: boolean;
  hasNextModule?: boolean;
  showTools: boolean;
  showPomodoro: boolean;
  setShowTools: (v: boolean) => void;
  showSections: boolean;
  onToggleSections: () => void;
  onToggleBookmark: (title: string, sectionID: string | null) => Promise<void>;
  onCourseSearch?: () => void;
  initialSearchQuery?: string | null;
}

function extractText(children: React.ReactNode): string {
  let text = '';
  const walk = (node: React.ReactNode) => {
    if (typeof node === 'string') text += node;
    else if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object' && 'props' in node) {
      walk((node as { props: { children: React.ReactNode } }).props.children);
    }
  };
  walk(children);
  return text;
}

const headingRenderer = (level: number) =>
  function Heading({ children }: { children?: React.ReactNode }) {
    const text = extractText(children);
    const id = headingId(text);
    const Tag = `h${level}` as keyof React.JSX.IntrinsicElements;
    return <Tag id={id}>{children}</Tag>;
  };

const components = {
  h1: headingRenderer(1),
  h2: headingRenderer(2),
  h3: headingRenderer(3),
  h4: headingRenderer(4),
  h5: headingRenderer(5),
  h6: headingRenderer(6),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="table-wrapper">
      <table>{children}</table>
    </div>
  ),
};

export default function LessonSection({
  courseId,
  courseName,
  module,
  content,
  h1,
  meta,
  bodyContent,
  loading,
  sections,
  visibleSection,
  isCompleted,
  contentRef,
  scrollToSection,
  handleScroll,
  handleToggleCompleted,
  bookmarks,
  highlights,
  addHighlight: addHighlightFn,
  onPrevModule,
  onNextModule,
  hasPrevModule,
  hasNextModule,
  showTools,
  showPomodoro,
  setShowTools,
  showSections,
  onToggleSections,
  onToggleBookmark,
  onCourseSearch,
  initialSearchQuery,
}: Props) {
  const { t } = useTranslation();
  const selectionToolbarRef = useRef<SelectionToolbarHandle>(null);

  const {
    showToolbar,
    showNoteEditor,
    showCardEditor,
    noteText,
    selection,
    pickerPos,
    handleTextSelection,
    openNoteEditor,
    openCardEditor,
    setNoteText,
    closeToolbar,
    closeNoteEditor,
    closeCardEditor,
  } = useSelection(contentRef);

  const focusMode = useSettingsStore((s) => s.focusMode);
  const theme = useSettingsStore((s) => s.theme);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const contentWidth = useSettingsStore((s) => s.contentWidth);
  const toggleSections = onToggleSections;
  const themeVars = useMemo(() => themeToCSSVars(THEME_TOKENS[theme]), [theme]);

  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);

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

  const rehypePlugins = useMemo(
    () =>
      [
        rehypeHighlight,
        [rehypeHighlightText, highlights],
        ...(searchActive && searchQuery ? [[rehypeSearchText, searchQuery]] : []),
      ] as PluggableList,
    [highlights, searchActive, searchQuery],
  );

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
      el.scrollTop = offset;
    }
  }, [searchQuery, bodyContent, searchActive, currentMatchIndex, contentRef]);

  const handleToggleSectionBookmark = (
    sectionId: string,
    _hasBookmark: boolean,
    heading: string,
  ) => {
    onToggleBookmark(`${module.name} – ${heading}`, sectionId);
  };

  function getTextOffset(container: HTMLElement, range: Range): { start: number; end: number } {
    let start = 0;
    let end = 0;
    let charCount = 0;
    let foundStart = false;
    let foundEnd = false;
    const walk = (node: Node) => {
      if (foundStart && foundEnd) return;
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        const nodeStart = charCount;
        const nodeEnd = charCount + text.length;
        if (node === range.startContainer) {
          start = nodeStart + range.startOffset;
          foundStart = true;
        }
        if (node === range.endContainer) {
          end = nodeStart + range.endOffset;
          foundEnd = true;
        }
        charCount = nodeEnd;
      } else {
        for (let i = 0; i < node.childNodes.length; i++) {
          walk(node.childNodes[i]);
        }
      }
    };
    walk(container);
    return { start, end };
  }

  const handleAddHighlight = async (color: string) => {
    if (!selection) return;
    const el = contentRef.current;
    const offsets = el ? getTextOffset(el, selection.range) : { start: 0, end: 0 };
    await addHighlightFn(selection.text, color, offsets.start, offsets.end);
    closeToolbar();
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  const handleAddAnnotation = async () => {
    if (!selection || !noteText.trim()) return;
    const el = contentRef.current;
    const offsets = el ? getTextOffset(el, selection.range) : { start: 0, end: 0 };
    await api.storage.addAnnotation({
      courseID: courseId,
      moduleID: module.id,
      selectedText: selection.text,
      startOffset: offsets.start,
      endOffset: offsets.end,
      color: 'yellow',
      noteContent: noteText.trim(),
    });
    closeToolbar();
    closeNoteEditor();
    api.storage.highlights(courseId, module.id).then(() => {});
  };

  const handleCreateCard = async (front: string, back: string) => {
    if (!selection) return;
    await api.usercards.create(courseId, module.id, front, back);
    closeToolbar();
    closeCardEditor();
  };

  useShortcuts('lesson', {
    prevModule: () => {
      if (showToolbar) return;
      if (hasPrevModule && onPrevModule) onPrevModule();
    },
    nextModule: () => {
      if (showToolbar) return;
      if (hasNextModule && onNextModule) onNextModule();
    },
    scrollUp: () => {
      if (showToolbar) return;
      contentRef.current?.scrollBy({ top: -80, behavior: 'smooth' });
    },
    scrollDown: () => {
      if (showToolbar) return;
      contentRef.current?.scrollBy({ top: 80, behavior: 'smooth' });
    },
    toggleSections: () => {
      if (showToolbar) return;
      useSettingsStore.getState().toggleSections();
    },
    findInPage: () => setSearchActive(true),
    courseSearch: () => onCourseSearch?.(),
  });

  useEffect(() => {
    if (initialSearchQuery) {
      setSearchActive(true);
      setSearchQuery(initialSearchQuery);
      setCurrentMatchIndex(0);
      setTotalMatches(0);
    } else {
      setSearchActive(false);
      setSearchQuery('');
      setCurrentMatchIndex(0);
      setTotalMatches(0);
    }
  }, [module.id, initialSearchQuery]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'c' && selection) {
        e.preventDefault();
        selectionToolbarRef.current?.triggerCopy();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selection]);

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
  }, [hasPrevModule, hasNextModule, onPrevModule, onNextModule, contentRef]);

  if (loading)
    return <div className="p-8 text-center text-gray-400">{t('lesson.loadingLesson')}</div>;

  return (
    <>
      <div className="flex flex-1 overflow-hidden">
        {showTools && !focusMode && (
          <StudyTools
            courseId={courseId}
            courseName={courseName}
            moduleId={module.id}
            moduleName={module.name}
            sections={sections}
            visibleSection={visibleSection}
            content={content}
            highlights={highlights}
            onClose={() => setShowTools(false)}
          />
        )}
        <div className="flex-1 flex flex-col min-w-0">
          {!showSections && !focusMode && (
            <button
              onClick={toggleSections}
              className="fixed right-4 top-1/2 -translate-y-1/2 z-50 w-10 h-10 rounded-full bg-gray-800 border border-gray-700 shadow-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
              title={t('lesson.toggleSectionsPanel')}
            >
              {t('icons.hamburger')}
            </button>
          )}

          {showPomodoro && (
            <div className="relative h-0 z-40">
              <div className="absolute left-4 top-2">
                <PomodoroTimer compact={focusMode} />
              </div>
            </div>
          )}

          {showSections && !focusMode && (
            <SectionsPanel
              sections={sections}
              visibleSection={visibleSection}
              bookmarks={bookmarks}
              onScrollToSection={scrollToSection}
              onToggleSectionBookmark={handleToggleSectionBookmark}
              onClose={toggleSections}
            />
          )}

          <div
            className="flex-1 overflow-y-auto"
            ref={contentRef}
            tabIndex={-1}
            onScroll={handleScroll}
            onMouseUp={handleTextSelection}
          >
            {searchActive && (
              <div className="sticky top-0 z-10">
                <ViewerSearch
                  query={searchQuery}
                  totalMatches={totalMatches}
                  currentMatch={currentMatchIndex}
                  onQueryChange={handleSearchQueryChange}
                  onPrev={handleSearchPrev}
                  onNext={handleSearchNext}
                  onClose={handleSearchClose}
                />
              </div>
            )}
            <div
              className={`p-6 book-content${contentWidth === 'wide' ? ' book-content-wide' : contentWidth === 'standard' ? ' book-content-standard' : ''}`}
              style={{ fontSize: `${fontSize}px`, ...themeVars }}
            >
              {h1 && <h1 id={headingId(h1)}>{h1}</h1>}
              {!focusMode && meta.length > 0 && (
                <div className="lesson-meta">
                  {meta.map((m, i) => {
                    const isDesc = m.key === 'description';
                    return (
                      <span key={m.key}>
                        {!isDesc && i > 0 && <span className="meta-divider" />}
                        <span className={`meta-item${isDesc ? ' meta-description' : ''}`}>
                          <span className="meta-icon">{m.icon}</span>
                          <span className="meta-label">{m.label}</span>
                          <span className="meta-value">{m.value}</span>
                        </span>
                      </span>
                    );
                  })}
                </div>
              )}
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={rehypePlugins}
                components={components}
              >
                {bodyContent}
              </ReactMarkdown>

              {!focusMode && (
                <div style={{ marginTop: '3rem' }}>
                  <button
                    onClick={handleToggleCompleted}
                    className="w-full py-3 rounded-lg font-semibold text-sm transition-all duration-200"
                    style={{
                      background: isCompleted
                        ? `linear-gradient(135deg, ${COMPLETION_GREEN}, ${COMPLETION_GREEN_DARK})`
                        : 'var(--book-code-bg)',
                      color: isCompleted ? SECTION_ACTIVE_TEXT : 'var(--book-text)',
                      border: `1px solid ${isCompleted ? COMPLETION_GREEN_DARK : 'var(--book-h2-border)'}`,
                    }}
                  >
                    {isCompleted ? t('lesson.completed') : t('lesson.markAsComplete')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showToolbar && selection && !showNoteEditor && !showCardEditor && (
        <SelectionToolbar
          ref={selectionToolbarRef}
          x={pickerPos.x}
          y={pickerPos.y}
          selectionTop={pickerPos.selectionTop}
          selectedText={selection.text}
          onSelectColor={handleAddHighlight}
          onOpenNote={openNoteEditor}
          onCreateCard={openCardEditor}
          onCopy={handleCopy}
          onCancel={closeToolbar}
        />
      )}

      {showCardEditor && selection && (
        <CardEditor
          selectedText={selection.text}
          x={pickerPos.x}
          y={pickerPos.y}
          onSave={handleCreateCard}
          onCancel={closeCardEditor}
        />
      )}

      {showNoteEditor && selection && (
        <NoteEditor
          selectedText={selection.text}
          noteText={noteText}
          x={pickerPos.x}
          y={pickerPos.y}
          onChange={setNoteText}
          onSave={handleAddAnnotation}
          onCancel={closeNoteEditor}
        />
      )}
    </>
  );
}
