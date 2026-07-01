import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkBreaks from 'remark-breaks';
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
import { rehypeHighlightText } from '../components/rehypeHighlightText';
import { rehypeSearchText } from '../components/rehypeSearchText';
import StudyTools from '../components/StudyTools';
import { useBookmarks } from '../hooks/useBookmarks';
import { useDelayedUnmount } from '../hooks/useDelayedUnmount';
import { useHighlights } from '../hooks/useHighlights';
import { useLesson } from '../hooks/useLesson';
import { useLessonNav } from '../hooks/useLessonNav';
import { useLessonSearch } from '../hooks/useLessonSearch';
import { useLessonSection } from '../hooks/useLessonSection';
import { useNotes } from '../hooks/useNotes';
import { useSelection } from '../hooks/useSelection';
import { useShortcuts } from '../hooks/useShortcuts';
import { useHighlightsStore } from '../stores/highlightsStore';
import { THEME_TOKENS, themeToCSSVars } from '../themes';
import LessonContext from './LessonContext';
import { components, getTextOffset } from './lessonHelpers';
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
    isCompleted,
    completedCount,
    totalModules,
    toggle,
    showTools,
    showPomodoro,
    toggleTools,
    setSearchCourseOpen,
    focusMode,
    theme,
    fontSize,
    contentWidth,
    showSections,
    toggleSections,
  } = useLessonSection(course, module);

  const {
    content,
    h1,
    meta,
    bodyContent,
    loading,
    sections,
    visibleSection,
    isCompleted: optimisticIsCompleted,
    contentRef,
    scrollToSection,
    handleScroll,
    handleToggleCompleted,
  } = useLesson(
    course.id,
    module.id,
    { isCompleted, completedCount, totalModules, toggle },
    initialSectionID,
  );

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

  const showStudyTools = useDelayedUnmount(showTools && !focusMode, 250);
  const showSectionsPanel = useDelayedUnmount(showSections && !focusMode, 250);
  const showPomodoroTimer = useDelayedUnmount(showPomodoro, 200);
  const showSelectionBar = useDelayedUnmount(
    !!(showToolbar && selection && !showNoteEditor && !showCardEditor),
    150,
  );
  const showNotePopover = useDelayedUnmount(!!popoverNote, 150);

  const themeVars = useMemo(() => themeToCSSVars(THEME_TOKENS[theme]), [theme]);

  const notesRef = useRef(notes);
  notesRef.current = notes;

  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoCopyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setCopiedWithTimer = useCallback((v: boolean) => {
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    setCopied(v);
    if (v) {
      copiedTimerRef.current = setTimeout(() => setCopied(false), 700);
    }
  }, []);

  const triggerAutoCopy = useCallback(() => {
    if (autoCopyTimerRef.current) clearTimeout(autoCopyTimerRef.current);
    autoCopyTimerRef.current = setTimeout(() => {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.rangeCount) {
        const text = sel.toString();
        if (text.trim()) {
          void navigator.clipboard.writeText(text);
          setCopiedWithTimer(true);
        }
      }
    }, 500);
  }, [setCopiedWithTimer]);

  const handleTextSelectionWithAutoCopy = useCallback(() => {
    handleTextSelection();
    triggerAutoCopy();
  }, [handleTextSelection, triggerAutoCopy]);

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

  const showSearch = useDelayedUnmount(searchActive, 200);

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
    // Flash the newly created highlight
    requestAnimationFrame(() => {
      const marks = el?.querySelectorAll('mark');
      marks?.forEach((mark) => {
        if (mark.textContent?.trim() === selection.text.trim() && !mark.dataset.flashApplied) {
          mark.dataset.flashApplied = 'true';
          mark.classList.add('anim-highlight-flash');
          setTimeout(() => mark.classList.remove('anim-highlight-flash'), 600);
        }
      });
    });
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
      toggleSections();
    },
    findInPage: () => setSearchActive(true),
    courseSearch: () => setSearchCourseOpen(true),
  });

  useEffect(() => {
    return () => {
      if (autoCopyTimerRef.current) clearTimeout(autoCopyTimerRef.current);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

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

  // Scroll reveal: fade-in-up sections as they enter the viewport
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !entry.target.getAttribute('data-revealed')) {
            entry.target.setAttribute('data-revealed', 'true');
            entry.target.classList.add('anim-fade-in-up');
          }
        }
      },
      { root: el, threshold: 0.1 },
    );
    const sections = el.querySelectorAll('.book-content > h2, .book-content > h3');
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [contentRef, bodyContent]);

  if (loading)
    return <div className="p-8 text-center text-gray-400">{t('lesson.loadingLesson')}</div>;

  return (
    <LessonContext.Provider
      value={{ contentRef, scrollToSection, sections, visibleSection, content }}
    >
      <div className="flex flex-1 overflow-hidden">
        {showStudyTools && (
          <div
            className={
              showTools && !focusMode ? 'anim-panel-slide-left' : 'anim-panel-slide-left-exit'
            }
          >
            <StudyTools courseId={course.id} moduleId={module.id} onClose={() => toggleTools()} />
          </div>
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

          {showPomodoroTimer && (
            <div className={`relative h-0 z-40 ${showPomodoro ? 'anim-pop-in' : 'anim-pop-out'}`}>
              <div className="absolute left-4 top-2">
                <PomodoroTimer compact={focusMode} />
              </div>
            </div>
          )}

          {showSectionsPanel && (
            <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50 overflow-visible">
              <div
                className={
                  showSections && !focusMode
                    ? 'anim-panel-slide-right'
                    : 'anim-panel-slide-right-exit'
                }
              >
                <SectionsPanel
                  sections={sections}
                  visibleSection={visibleSection}
                  bookmarks={bookmarks}
                  onScrollToSection={scrollToSection}
                  onToggleSectionBookmark={handleToggleSectionBookmark}
                  onClose={toggleSections}
                  hasPrev={hasPrev}
                  hasNext={hasNext}
                  onPrevModule={goPrev}
                  onNextModule={goNext}
                />
              </div>
            </div>
          )}

          <div
            className="flex-1 overflow-y-auto"
            data-testid="lesson-content"
            ref={contentRef}
            tabIndex={-1}
            onScroll={handleScroll}
            onMouseUp={handleTextSelectionWithAutoCopy}
          >
            {showSearch && (
              <div
                className={`sticky top-0 z-10 ${searchActive ? 'anim-fade-in-up' : 'anim-fade-out'}`}
              >
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
                  remarkPlugins={[remarkGfm, remarkBreaks]}
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
                      <span key={m.key} style={isDesc ? { flexBasis: '100%' } : undefined}>
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
                remarkPlugins={[remarkGfm, remarkBreaks]}
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
                    data-testid="complete-btn"
                    className="w-full py-3 rounded-lg font-semibold text-sm transition-all duration-200"
                    style={{
                      background: optimisticIsCompleted
                        ? `linear-gradient(135deg, ${COMPLETION_GREEN}, ${COMPLETION_GREEN_DARK})`
                        : 'var(--book-code-bg)',
                      color: optimisticIsCompleted ? SECTION_ACTIVE_TEXT : 'var(--book-text)',
                      border: `1px solid ${optimisticIsCompleted ? COMPLETION_GREEN_DARK : 'var(--book-h2-border)'}`,
                    }}
                  >
                    {optimisticIsCompleted ? t('lesson.completed') : t('lesson.markAsComplete')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showSelectionBar && selection && !showNoteEditor && !showCardEditor && (
        <div className={showToolbar ? 'anim-pop-in' : 'anim-pop-out'}>
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
            copied={copied}
            onCopiedChange={setCopiedWithTimer}
          />
        </div>
      )}

      {showNotePopover && popoverNote && (
        <div className={popoverNote ? 'anim-pop-in' : 'anim-pop-out'}>
          <NotePopover
            note={popoverNote.note}
            x={popoverNote.x}
            y={popoverNote.y}
            onClose={() => setPopoverNote(null)}
          />
        </div>
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
