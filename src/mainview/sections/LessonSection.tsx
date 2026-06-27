import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import type { PluggableList } from 'unified';

import type { Course, ModuleMeta, Note } from '../../bun/types';
import { api } from '../api';
import { COMPLETION_GREEN, COMPLETION_GREEN_DARK, SECTION_ACTIVE_TEXT } from '../colors';
import CardEditor from '../components/lesson/CardEditor';
import NoteEditor from '../components/lesson/NoteEditor';
import NotePopover from '../components/lesson/NotePopover';
import SectionsPanel from '../components/lesson/SectionsPanel';
import SelectionToolbar from '../components/lesson/SelectionToolbar';
import ViewerSearch from '../components/lesson/ViewerSearch';
import PomodoroTimer from '../components/PomodoroTimer';
import { rehypeHighlightText } from '../components/rehype-highlight-text';
import { rehypeSearchText } from '../components/rehype-search-text';
import StudyTools from '../components/StudyTools';
import { useBookmarks } from '../hooks/useBookmarks';
import { useHighlights } from '../hooks/useHighlights';
import { useLesson } from '../hooks/useLesson';
import { useLessonNav } from '../hooks/useLessonNav';
import { useLessonSearch } from '../hooks/useLessonSearch';
import { useNotes } from '../hooks/useNotes';
import { useSelection } from '../hooks/useSelection';
import { useShortcuts } from '../hooks/useShortcuts';
import { useHighlightsStore } from '../stores/highlightsStore';
import { useLessonUIStore } from '../stores/lessonUIStore';
import { useSettingsStore } from '../stores/settingsStore';
import { THEME_TOKENS, themeToCSSVars } from '../themes';
import { components, getTextOffset } from './lesson-helpers';
import LessonContext from './LessonContext';

interface Props {
  course: Course;
  module: ModuleMeta;
  initialSectionID?: string;
  initialSearchQuery?: string | null;
}

export default function LessonSection({
  course,
  module,
  initialSectionID,
  initialSearchQuery,
}: Props) {
  const { t } = useTranslation();

  const {
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
  } = useLesson(course.id, module.id, initialSectionID);

  const { bookmarks, handleToggleBookmark: toggleBookmark } = useBookmarks(
    course.id,
    module.id,
    visibleSection,
  );
  const {
    highlights,
    addHighlight: addHighlightFn,
    deleteHighlight,
  } = useHighlights(course.id, module.id);
  const { notes } = useNotes(course.id, module.id);
  const { hasPrev, hasNext, goPrev, goNext } = useLessonNav(course, module);

  const showTools = useLessonUIStore((s) => s.showTools);
  const showPomodoro = useLessonUIStore((s) => s.showPomodoro);
  const setShowTools = useLessonUIStore((s) => s.toggleTools);

  const {
    showToolbar,
    showNoteEditor,
    showCardEditor,
    noteText,
    selection,
    pickerPos,
    selectedHighlightId,
    handleTextSelection,
    setSelectedHighlight,
    openNoteEditor,
    openCardEditor,
    setNoteText,
    closeToolbar,
    closeNoteEditor,
    closeCardEditor,
  } = useSelection(contentRef);

  const activeHighlight = useMemo(() => {
    if (selectedHighlightId) {
      return highlights.find((h) => h.id === selectedHighlightId) ?? null;
    }
    const el = contentRef.current;
    if (!selection || !el) return null;
    const offsets = getTextOffset(el, selection.range);
    if (!offsets) return null;
    return (
      highlights.find((h) => {
        const hs = h.startOffset;
        const he = h.endOffset;
        return (
          (offsets.start >= hs && offsets.start < he) ||
          (offsets.end > hs && offsets.end <= he) ||
          (offsets.start <= hs && offsets.end >= he)
        );
      }) ?? null
    );
  }, [highlights, selectedHighlightId, selection, contentRef]);
  const activeHighlightColor = activeHighlight?.color;

  const [popoverNote, setPopoverNote] = useState<{ note: Note; x: number; y: number } | null>(null);

  const focusMode = useSettingsStore((s) => s.focusMode);
  const theme = useSettingsStore((s) => s.theme);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const contentWidth = useSettingsStore((s) => s.contentWidth);
  const showSections = useSettingsStore((s) => s.showSections);
  const toggleSections = useSettingsStore((s) => s.toggleSections);
  const themeVars = useMemo(() => themeToCSSVars(THEME_TOKENS[theme]), [theme]);

  const notesRef = useRef(notes);
  notesRef.current = notes;

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'MARK' && target.dataset.highlightId) {
        if (target.dataset.noteId) {
          const highlightId = target.dataset.highlightId;
          const found = notesRef.current.find((n) => n.highlightID === highlightId);
          if (found) {
            const rect = target.getBoundingClientRect();
            setPopoverNote({ note: found, x: rect.left + rect.width / 2, y: rect.top });
          }
          return;
        }
        const range = document.createRange();
        range.selectNodeContents(target);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        setSelectedHighlight(target.dataset.highlightId);
        handleTextSelection();
        return;
      }
      if (target.closest('button') || target.closest('[data-no-select]')) return;
      const existingSel = window.getSelection();
      if (existingSel && !existingSel.isCollapsed && existingSel.rangeCount) {
        setSelectedHighlight(null);
        handleTextSelection();
        return;
      }
      const caretRange = document.caretRangeFromPoint(e.clientX, e.clientY);
      if (!caretRange) return;
      const textNode = caretRange.startContainer;
      if (textNode.nodeType !== Node.TEXT_NODE) return;
      const text = textNode.textContent ?? '';
      let start = caretRange.startOffset;
      let end = caretRange.startOffset;
      while (start > 0 && /\w/.test(text[start - 1])) start--;
      while (end < text.length && /\w/.test(text[end])) end++;
      if (start === end) return;
      const range = document.createRange();
      range.setStart(textNode, start);
      range.setEnd(textNode, end);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      setSelectedHighlight(null);
      handleTextSelection();
    };
    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }, [contentRef, handleTextSelection, setSelectedHighlight]);

  const {
    searchActive,
    searchQuery,
    currentMatchIndex,
    totalMatches,
    setSearchActive,
    handleSearchQueryChange,
    handleSearchPrev,
    handleSearchNext,
    handleSearchClose,
  } = useLessonSearch(contentRef, module.id, initialSearchQuery);

  const rehypePlugins = useMemo(
    () =>
      [
        rehypeHighlight,
        [rehypeHighlightText, highlights],
        ...(searchActive && searchQuery ? [[rehypeSearchText, searchQuery]] : []),
      ] as PluggableList,
    [highlights, searchActive, searchQuery],
  );

  const handleToggleSectionBookmark = (
    sectionId: string,
    _hasBookmark: boolean,
    heading: string,
  ) => {
    void toggleBookmark(`${module.name} – ${heading}`, sectionId);
  };

  const handleAddHighlight = async (color: string) => {
    if (!selection) return;
    const el = contentRef.current;
    const offsets = el ? getTextOffset(el, selection.range) : null;
    if (!offsets) return;
    await addHighlightFn(selection.text, color, offsets.start, offsets.end);
    closeToolbar();
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  const handleAddAnnotation = async () => {
    if (!selection || !noteText.trim()) return;
    const el = contentRef.current;
    const offsets = el ? getTextOffset(el, selection.range) : null;
    if (!offsets) return;
    await api.storage.addAnnotation({
      courseID: course.id,
      moduleID: module.id,
      selectedText: selection.text,
      startOffset: offsets.start,
      endOffset: offsets.end,
      color: 'note',
      noteContent: noteText.trim(),
    });
    closeToolbar();
    closeNoteEditor();
    void useHighlightsStore.getState().load(course.id, module.id);
  };

  const handleCreateCard = async (front: string, back: string) => {
    if (!selection) return;
    await api.usercards.create(course.id, module.id, front, back);
    closeToolbar();
    closeCardEditor();
  };

  useShortcuts('lesson', {
    prevModule: () => {
      if (showToolbar) return;
      if (hasPrev) goPrev();
    },
    nextModule: () => {
      if (showToolbar) return;
      if (hasNext) goNext();
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
    courseSearch: () => useLessonUIStore.getState().setSearchCourseOpen(true),
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'c' && selection) {
        e.preventDefault();
        void navigator.clipboard.writeText(selection.text);
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
        if (e.deltaX > 0 && hasNext) goNext();
        else if (e.deltaX < 0 && hasPrev) goPrev();
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [hasPrev, hasNext, goPrev, goNext, contentRef]);

  if (loading)
    return <div className="p-8 text-center text-gray-400">{t('lesson.loadingLesson')}</div>;

  return (
    <LessonContext.Provider
      value={{ contentRef, scrollToSection, sections, visibleSection, content }}
    >
      <div className="flex flex-1 overflow-hidden">
        {showTools && !focusMode && (
          <StudyTools courseId={course.id} moduleId={module.id} onClose={() => setShowTools()} />
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
              {h1 && (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={rehypePlugins}
                  components={components}
                >
                  {`# ${h1}`}
                </ReactMarkdown>
              )}
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

              <div style={{ height: '50vh' }} />

              {!focusMode && (
                <div style={{ marginTop: '3rem' }}>
                  <button
                    onClick={() => {
                      void handleToggleCompleted();
                    }}
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
          x={pickerPos.x}
          y={pickerPos.y}
          selectionTop={pickerPos.selectionTop}
          selectedText={selection.text}
          onSelectColor={(color) => {
            void handleAddHighlight(color);
          }}
          onOpenNote={openNoteEditor}
          onCreateCard={openCardEditor}
          onCopy={(text) => {
            void handleCopy(text);
          }}
          onDeleteHighlight={
            activeHighlight
              ? () => {
                  void deleteHighlight(activeHighlight.id);
                  closeToolbar();
                }
              : undefined
          }
          activeHighlightColor={activeHighlightColor}
        />
      )}

      {popoverNote && (
        <NotePopover
          note={popoverNote.note}
          x={popoverNote.x}
          y={popoverNote.y}
          onClose={() => setPopoverNote(null)}
        />
      )}

      {showCardEditor && selection && (
        <CardEditor
          selectedText={selection.text}
          x={pickerPos.x}
          y={pickerPos.y}
          onSave={(front, back) => {
            void handleCreateCard(front, back);
          }}
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
          onSave={() => {
            void handleAddAnnotation();
          }}
          onCancel={closeNoteEditor}
        />
      )}
    </LessonContext.Provider>
  );
}
