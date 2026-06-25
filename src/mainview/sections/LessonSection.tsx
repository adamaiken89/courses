import { useEffect, useMemo, useRef } from 'react';
import { api } from '../api';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';

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
import { rehypeHighlightText } from '../components/rehype-highlight-text';
import type { ModuleMeta, Bookmark, Highlight } from '../../bun/types';
import type { Section } from '../components/sidebar-types';

type DivRef = React.RefObject<HTMLDivElement>;

interface Props {
  courseId: string;
  courseName: string;
  module: ModuleMeta;
  content: string;
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
  addHighlight: (text: string, color: string) => Promise<void>;
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
}

const META_FIELDS: Record<string, { icon: string; label: string }> = {
  'est. study time': { icon: '⏱', label: 'Study Time' },
  language: { icon: '🌐', label: 'Language' },
  description: { icon: '📝', label: 'Description' },
  framework: { icon: '🔧', label: 'Framework' },
};

export function parseLessonMeta(
  markdown: string,
): { key: string; icon: string; label: string; value: string }[] {
  const meta: { key: string; icon: string; label: string; value: string }[] = [];
  const lines = markdown.split('\n');
  let pastH1 = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ')) {
      pastH1 = true;
      continue;
    }
    if (trimmed.startsWith('##')) break;
    if (!pastH1) continue;
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    const label = trimmed.slice(0, colonIdx).trim().toLowerCase();
    const field = META_FIELDS[label];
    if (field) {
      meta.push({
        key: label,
        icon: field.icon,
        label: field.label,
        value: trimmed.slice(colonIdx + 1).trim(),
      });
    }
  }
  return meta;
}

export function parseH1(markdown: string): string {
  for (const line of markdown.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ')) return trimmed.slice(2).trim();
  }
  return '';
}

export function stripMetaLines(markdown: string): string {
  const lines = markdown.split('\n');
  let lastMetaIdx = -1;
  let pastH1 = false;
  let h1Idx = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('# ')) {
      pastH1 = true;
      h1Idx = i;
      continue;
    }
    if (trimmed.startsWith('##')) break;
    if (!pastH1) continue;
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    const label = trimmed.slice(0, colonIdx).trim().toLowerCase();
    if (META_FIELDS[label]) {
      lastMetaIdx = i;
    }
  }
  if (lastMetaIdx === -1) return markdown;
  let end = lastMetaIdx + 1;
  while (end < lines.length && !lines[end].trim()) end++;
  if (h1Idx >= 0) {
    return lines.slice(end).join('\n');
  }
  return lines.slice(end).join('\n');
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
  const lessonMeta = useMemo(() => parseLessonMeta(content), [content]);
  const h1Text = useMemo(() => parseH1(content), [content]);
  const bodyContent = useMemo(() => {
    if (!h1Text && lessonMeta.length === 0) return content;
    const lines = content.split('\n');
    let h1End = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('# ')) {
        h1End = i + 1;
        break;
      }
    }
    if (h1End === -1) return content;
    while (h1End < lines.length && !lines[h1End].trim()) h1End++;
    if (lessonMeta.length === 0) return lines.slice(h1End).join('\n');
    let metaEnd = h1End;
    for (let i = h1End; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith('##')) break;
      if (!trimmed) {
        metaEnd = i + 1;
        continue;
      }
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx === -1) continue;
      const label = trimmed.slice(0, colonIdx).trim().toLowerCase();
      if (META_FIELDS[label]) metaEnd = i + 1;
    }
    while (metaEnd < lines.length && !lines[metaEnd].trim()) metaEnd++;
    return lines.slice(metaEnd).join('\n');
  }, [content, h1Text, lessonMeta]);
  const rehypePlugins = useMemo(
    () => [rehypeHighlight, rehypeHighlightText(highlights)],
    [highlights],
  );

  const handleToggleSectionBookmark = (
    sectionId: string,
    _hasBookmark: boolean,
    heading: string,
  ) => {
    onToggleBookmark(`${module.name} – ${heading}`, sectionId);
  };

  const handleAddHighlight = async (color: string) => {
    if (!selection) return;
    await addHighlightFn(selection.text, color);
    closeToolbar();
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  const handleAddAnnotation = async () => {
    if (!selection || !noteText.trim()) return;
    await api.storage.addAnnotation({
      courseID: courseId,
      moduleID: module.id,
      selectedText: selection.text,
      startOffset: 0,
      endOffset: 0,
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if ((e.metaKey || e.ctrlKey) && e.key === 'c' && selection) {
        e.preventDefault();
        selectionToolbarRef.current?.triggerCopy();
        return;
      }

      if (showToolbar) return;
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
          useSettingsStore.getState().cycleTheme();
          break;
        case 'w':
        case 'W':
          {
            const order: Array<'narrow' | 'standard' | 'wide'> = ['narrow', 'standard', 'wide'];
            const next =
              order[(order.indexOf(useSettingsStore.getState().contentWidth) + 1) % order.length];
            useSettingsStore.getState().setContentWidth(next);
          }
          break;
        case 's':
        case 'S':
          useSettingsStore.getState().toggleSections();
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
    showToolbar,
    contentRef,
    contentWidth,
    selection,
    closeToolbar,
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
            <div
              className={`p-6 book-content${contentWidth === 'wide' ? ' book-content-wide' : contentWidth === 'standard' ? ' book-content-standard' : ''}`}
              style={{ fontSize: `${fontSize}px`, ...themeVars }}
            >
              {h1Text && <h1 id={headingId(h1Text)}>{h1Text}</h1>}
              {!focusMode && lessonMeta.length > 0 && (
                <div className="lesson-meta">
                  {lessonMeta.map((m, i) => {
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
