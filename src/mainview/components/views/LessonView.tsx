import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';

import { useBookmarks } from '../../hooks/useBookmarks';
import { useHighlights } from '../../hooks/useHighlights';
import { useLesson } from '../../hooks/useLesson';
import { useHighlightPicker } from '../../hooks/useHighlightPicker';
import { useSettingsStore } from '../../stores/settingsStore';
import { THEME_TOKENS, themeToCSSVars } from '../../themes';
import LessonToolbar from '../lesson/LessonToolbar';
import SectionsPanel from '../lesson/SectionsPanel';
import SelectionToolbar from '../lesson/SelectionToolbar';
import NoteEditor from '../lesson/NoteEditor';
import CardEditor from '../lesson/CardEditor';
import StudyTools from '../StudyTools';
import PomodoroTimer from '../PomodoroTimer';
import { rehypeHighlightText } from '../rehype-highlight-text';
import { useViewStore } from '../../stores/viewStore';
import { useCourseStore } from '../../stores/courseStore';
import type { ModuleMeta } from '../../../bun/types';

interface Props {
  courseId: string;
  module: ModuleMeta;
  initialSectionID?: string;
  onPrevModule?: () => void;
  onNextModule?: () => void;
  hasPrevModule?: boolean;
  hasNextModule?: boolean;
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

function headingId(children: React.ReactNode): string {
  return extractText(children)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[:,()]/g, '')
    .replace(/[^a-z0-9-]/g, '');
}

const headingRenderer = (level: number) =>
  function Heading({ children }: { children?: React.ReactNode }) {
    const id = headingId(children);
    const Tag = `h${level}` as keyof JSX.IntrinsicElements;
    return <Tag id={id}>{children}</Tag>;
  };

const components = {
  h1: headingRenderer(1), h2: headingRenderer(2), h3: headingRenderer(3),
  h4: headingRenderer(4), h5: headingRenderer(5), h6: headingRenderer(6),
};

export default function LessonView({
  courseId,
  module,
  initialSectionID,
  onPrevModule,
  onNextModule,
  hasPrevModule,
  hasNextModule,
}: Props) {
  const { t } = useTranslation();
  const [showTools, setShowTools] = useState(false);
  const [showPomodoro, setShowPomodoro] = useState(false);

  const {
    content, loading, sections, visibleSection,
    isCompleted, totalModules, completedCount,
    contentRef, scrollToSection, handleScroll,
    handleToggleCompleted,
  } = useLesson(courseId, module.id, initialSectionID);

  const {
    bookmarks, handleToggleBookmark: toggleBookmark, hasActiveBookmark,
  } = useBookmarks(courseId, module.id, visibleSection);
  const { highlights, addHighlight } = useHighlights(courseId, module.id);

  const {
    showHighlightPicker, showNoteEditor, showCardEditor, noteText,
    highlightSelection, pickerPos,
    handleTextSelection, openNoteEditor, openCardEditor, setNoteText,
    closeHighlightPicker, closeNoteEditor, closeCardEditor,
  } = useHighlightPicker();

  const focusMode = useSettingsStore((s) => s.focusMode);
  const theme = useSettingsStore((s) => s.theme);
  const pushView = useViewStore((s) => s.push);
  const courses = useCourseStore((s) => s.courses);

  const handleReviewCards = () => {
    const course = courses.find((c) => c.id === courseId);
    if (course) pushView({ type: 'userCardReview', course });
  };
  const fontSize = useSettingsStore((s) => s.fontSize);
  const wideMode = useSettingsStore((s) => s.wideMode);
  const showSections = useSettingsStore((s) => s.showSections);
  const toggleSections = useSettingsStore((s) => s.toggleSections);
  const themeVars = useMemo(() => themeToCSSVars(THEME_TOKENS[theme]), [theme]);
  const rehypePlugins = useMemo(
    () => [rehypeHighlight, rehypeHighlightText(highlights)],
    [highlights],
  );

  const handleToggleBookmark = () => {
    const title = visibleSection
      ? `${module.name} – ${sections.find((s) => s.id === visibleSection)?.heading}`
      : module.name;
    toggleBookmark(title, visibleSection);
  };

  const handleToggleSectionBookmark = (
    sectionId: string, _hasBookmark: boolean, heading: string,
  ) => {
    toggleBookmark(`${module.name} – ${heading}`, sectionId);
  };

  const handleAddHighlight = async (color: string) => {
    if (!highlightSelection) return;
    await addHighlight(highlightSelection.text, color);
    closeHighlightPicker();
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  const handleAddAnnotation = async () => {
    if (!highlightSelection || !noteText.trim()) return;
    await api.storage.addAnnotation({
      courseID: courseId,
      moduleID: module.id,
      selectedText: highlightSelection.text,
      startOffset: 0,
      endOffset: 0,
      color: 'yellow',
      noteContent: noteText.trim(),
    });
    closeHighlightPicker();
    closeNoteEditor();
    api.storage.highlights(courseId, module.id).then(() => {});
  };

  const handleCreateCard = async (front: string, back: string) => {
    if (!highlightSelection) return;
    await api.usercards.create(courseId, module.id, front, back);
    closeHighlightPicker();
    closeCardEditor();
  };

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
        case 't': case 'T':
          useSettingsStore.getState().cycleTheme();
          break;
        case 'w': case 'W':
          useSettingsStore.getState().setWideMode(!wideMode);
          break;
        case 's': case 'S':
          useSettingsStore.getState().toggleSections();
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    hasPrevModule, hasNextModule, onPrevModule, onNextModule,
    showHighlightPicker, contentRef, wideMode,
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
  }, [hasPrevModule, hasNextModule, onPrevModule, onNextModule, contentRef]);

  if (loading)
    return <div className="p-8 text-center text-gray-400">{t('lesson.loadingLesson')}</div>;

  return (
    <>
      <div className="flex flex-1 overflow-hidden">
        {showTools && !focusMode && (
          <StudyTools
            courseId={courseId}
            moduleId={module.id}
            moduleName={module.name}
            sections={sections}
            visibleSection={visibleSection}
            content={content}
            highlights={highlights}
            onClose={() => setShowTools(false)}
          />
        )}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <LessonToolbar
            focusMode={focusMode}
            showTools={showTools}
            showPomodoro={showPomodoro}
            hasActiveBookmark={hasActiveBookmark}
            completedCount={completedCount}
            totalModules={totalModules}
            onToggleBookmark={handleToggleBookmark}
            onToggleTools={() => setShowTools(!showTools)}
            onTogglePomodoro={() => setShowPomodoro(!showPomodoro)}
            onReviewCards={handleReviewCards}
          />

          {!showSections && !focusMode && (
            <button
              onClick={toggleSections}
              className="fixed right-4 top-1/2 -translate-y-1/2 z-50 w-10 h-10 rounded-full bg-gray-800 border border-gray-700 shadow-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
              title={t('lesson.toggleSectionsPanel')}
            >
              ☰
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

              <div style={{ marginTop: '3rem' }}>
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
      </div>

      {showHighlightPicker && highlightSelection && !showNoteEditor && !showCardEditor && (
        <SelectionToolbar
          x={pickerPos.x}
          y={pickerPos.y}
          selectionTop={pickerPos.selectionTop}
          selectedText={highlightSelection.text}
          onSelectColor={handleAddHighlight}
          onOpenNote={openNoteEditor}
          onCreateCard={openCardEditor}
          onCopy={handleCopy}
          onCancel={closeHighlightPicker}
        />
      )}

      {showCardEditor && highlightSelection && (
        <CardEditor
          selectedText={highlightSelection.text}
          x={pickerPos.x}
          y={pickerPos.y}
          onSave={handleCreateCard}
          onCancel={closeCardEditor}
        />
      )}

      {showNoteEditor && highlightSelection && (
        <NoteEditor
          selectedText={highlightSelection.text}
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
