import type { RefObject } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import type { PluggableList } from 'unified';
import { useShallow } from 'zustand/react/shallow';

import type { MetaField } from '../../../bun/lessonMarkdown';
import { useAutoCopy } from '../../hooks/useAutoCopy';
import { useDelayedUnmount } from '../../hooks/useDelayedUnmount';
import type { UseLessonSearchReturn } from '../../hooks/useLessonSearch';
import { useNotePopoverOnClick } from '../../hooks/useNotePopoverOnClick';
import { useNotes } from '../../hooks/useNotes';
import { useSelection } from '../../hooks/useSelection';
import { components } from '../../sections/lessonHelpers';
import LessonSelectionOverlays from '../../sections/LessonSelectionOverlays';
import { useSettingsStore } from '../../stores/settingsStore';
import { THEME_TOKENS, themeToCSSVars } from '../../themes';
import LessonContentCompletionButton from './LessonContentCompletionButton';
import LessonContentHeader from './LessonContentHeader';
import ViewerSearch from './ViewerSearch';

interface LessonContentViewerProps {
  courseId: string;
  moduleId: string;
  onRefreshHighlights: () => void;
  contentRef: RefObject<HTMLDivElement | null>;
  h1: string;
  meta: MetaField[];
  bodyContent: string;
  handleScroll: () => void;
  isCompleted: boolean;
  toggleCompleted: () => void;
  rehypePlugins: PluggableList;
  search: UseLessonSearchReturn;
}

export default function LessonContentViewer({
  courseId,
  moduleId,
  onRefreshHighlights,
  contentRef,
  h1,
  meta,
  bodyContent,
  handleScroll,
  isCompleted,
  toggleCompleted,
  rehypePlugins,
  search,
}: LessonContentViewerProps) {
  const { contentWidth, fontSize, theme } = useSettingsStore(
    useShallow((s) => ({ contentWidth: s.contentWidth, fontSize: s.fontSize, theme: s.theme })),
  );
  const themeVars = themeToCSSVars(THEME_TOKENS[theme]);

  const { notes } = useNotes(courseId, moduleId);
  const selectionState = useSelection(contentRef);
  const { handleTextSelectionWithAutoCopy } = useAutoCopy(selectionState.handleTextSelection);
  useNotePopoverOnClick(
    contentRef,
    notes,
    selectionState.setSelectedHighlight,
    selectionState.handleTextSelection,
  );

  const showSearch = useDelayedUnmount(search.searchActive, 200);

  return (
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
          className={`sticky top-0 z-10 ${search.searchActive ? 'anim-fade-in-up' : 'anim-fade-out'}`}
        >
          <ViewerSearch
            query={search.searchQuery}
            totalMatches={search.totalMatches}
            currentMatch={search.currentMatchIndex}
            onQueryChange={search.handleSearchQueryChange}
            onPrev={search.handleSearchPrev}
            onNext={search.handleSearchNext}
            onClose={search.handleSearchClose}
          />
        </div>
      )}
      <div
        className={`p-6 book-content${contentWidth === 'wide' ? ' book-content-wide' : contentWidth === 'standard' ? ' book-content-standard' : ''}`}
        style={{ fontSize: `${fontSize}px`, ...themeVars }}
      >
        <LessonContentHeader h1={h1} meta={meta} rehypePlugins={rehypePlugins} />
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkBreaks]}
          rehypePlugins={rehypePlugins}
          components={components}
        >
          {bodyContent}
        </ReactMarkdown>

        <div style={{ height: '50vh' }} />

        <LessonContentCompletionButton
          isCompleted={isCompleted}
          toggleCompleted={toggleCompleted}
        />
      </div>

      <LessonSelectionOverlays
        courseId={courseId}
        moduleId={moduleId}
        contentRef={contentRef}
        onRefreshHighlights={onRefreshHighlights}
      />
    </div>
  );
}
