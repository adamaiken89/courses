import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, mock, test } from 'bun:test';

import type { Course, ModuleMeta } from '../../bun/types';

const scrollToSection = mock<(sectionId: string) => void>();
const handleScroll = mock<() => void>();
const handleToggleCompleted = mock<() => Promise<void>>();
const handleTextSelection = mock<() => void>();
const setSelectedHighlight = mock<(id: string | null) => void>();
const openNoteEditor = mock<() => void>();
const openCardEditor = mock<() => void>();
const setNoteText = mock<(text: string) => void>();
const closeToolbar = mock<() => void>();
const closeNoteEditor = mock<() => void>();
const closeCardEditor = mock<() => void>();
const addHighlight = mock<(text: string, color: string, startOffset?: number, endOffset?: number) => Promise<void>>();
const deleteHighlight = mock<(id: string) => Promise<void>>();
const handleToggleBookmark = mock<(title: string, sectionId: string | null) => Promise<void>>();
const goPrev = mock<() => void>();
const goNext = mock<() => void>();
const setSearchActive = mock<(v: boolean) => void>();
const handleSearchQueryChange = mock<(q: string) => void>();
const handleSearchPrev = mock<() => void>();
const handleSearchNext = mock<() => void>();
const handleSearchClose = mock<() => void>();

const mockLesson: Record<string, unknown> = {
  content: '',
  h1: 'Test Heading',
  meta: [],
  bodyContent: 'Test body content',
  loading: false,
  sections: [],
  visibleSection: null,
  isCompleted: false,
  totalModules: 0,
  completedCount: 0,
  contentRef: { current: document.createElement('div') },
  setVisibleSection: () => {},
  scrollToSection,
  handleScroll,
  handleToggleCompleted,
};

const mockBookmarks: Record<string, unknown> = {
  bookmarks: [],
  loading: false,
  handleToggleBookmark,
  handleDeleteBookmark: mock<() => Promise<void>>(),
  sectionBookmark: undefined,
  moduleBookmark: undefined,
  hasActiveBookmark: false,
  activeBookmarkId: undefined,
};

const mockHighlights: Record<string, unknown> = {
  highlights: [],
  loading: false,
  addHighlight,
  deleteHighlight,
};

const mockNotes: Record<string, unknown> = {
  notes: [],
  loading: false,
  refresh: mock<() => Promise<void>>(),
};

const mockLessonNav: Record<string, unknown> = {
  hasPrev: false,
  hasNext: false,
  goPrev,
  goNext,
};

const mockSelection: Record<string, unknown> = {
  showToolbar: false,
  showNoteEditor: false,
  showCardEditor: false,
  noteText: '',
  selection: null,
  pickerPos: { x: 0, y: 0, selectionTop: 0 },
  selectedHighlightId: null,
  handleTextSelection,
  setSelectedHighlight,
  openNoteEditor,
  openCardEditor,
  setNoteText,
  closeToolbar,
  closeNoteEditor,
  closeCardEditor,
};

const mockSearch: Record<string, unknown> = {
  searchActive: false,
  searchQuery: '',
  currentMatchIndex: 0,
  totalMatches: 0,
  setSearchActive,
  handleSearchQueryChange,
  handleSearchPrev,
  handleSearchNext,
  handleSearchClose,
};

const defaultLessonUI = {
  showTools: false,
  showPomodoro: false,
};

const defaultSettings = {
  focusMode: false,
  fontSize: 16,
  contentWidth: 'standard' as const,
  showSections: false,
  theme: 'dark' as const,
};

void mock.module('../hooks/useLesson', () => ({
  useLesson: () => ({ ...mockLesson }),
}));

void mock.module('../hooks/useBookmarks', () => ({
  useBookmarks: () => ({ ...mockBookmarks }),
}));

void mock.module('../hooks/useHighlights', () => ({
  useHighlights: () => ({ ...mockHighlights }),
}));

void mock.module('../hooks/useNotes', () => ({
  useNotes: () => ({ ...mockNotes }),
}));

void mock.module('../hooks/useLessonNav', () => ({
  useLessonNav: () => ({ ...mockLessonNav }),
}));

void mock.module('../hooks/useSelection', () => ({
  useSelection: () => ({ ...mockSelection }),
}));

void mock.module('../hooks/useShortcuts', () => ({
  useShortcuts: () => {},
}));

void mock.module('../hooks/useLessonSearch', () => ({
  useLessonSearch: () => ({ ...mockSearch }),
}));

import { useHighlightsStore } from '../stores/highlightsStore';
import { useLessonUIStore } from '../stores/lessonUIStore';
import { useSettingsStore } from '../stores/settingsStore';

void mock.module('react-markdown', () => ({
  default: ({ children }: { children?: string }) => (
    <div data-testid="markdown">{String(children)}</div>
  ),
}));

void mock.module('../components/lesson/SectionsPanel', () => ({
  default: () => <div data-testid="sections-panel" />,
}));

void mock.module('../components/lesson/SelectionToolbar', () => ({
  default: () => <div data-testid="selection-toolbar" />,
}));

void mock.module('../components/lesson/NoteEditor', () => ({
  default: () => <div data-testid="note-editor" />,
}));

void mock.module('../components/lesson/CardEditor', () => ({
  default: () => <div data-testid="card-editor" />,
}));

void mock.module('../components/lesson/NotePopover', () => ({
  default: () => <div data-testid="note-popover" />,
}));

void mock.module('../components/lesson/ViewerSearch', () => ({
  default: () => <div data-testid="viewer-search" />,
}));

void mock.module('../components/StudyTools', () => ({
  default: () => <div data-testid="study-tools" />,
}));

void mock.module('../components/PomodoroTimer', () => ({
  default: ({ compact }: { compact?: boolean }) => <div data-testid="pomodoro-timer" data-compact={String(compact)} />,
}));

void mock.module('../components/MermaidDiagram', () => ({
  default: () => <div data-testid="mermaid-diagram" />,
}));

import LessonSection from './LessonSection';

const mockCourse: Course = {
  id: 'cs101',
  course: 'CS 101',
  timeBudgetHours: 40,
  targetLevel: 'beginner',
  domain: 'computer-science',
  prerequisites: [],
  learningObjectives: ['Learn basics'],
  modules: [],
  displayName: 'CS 101',
};

const mockModule: ModuleMeta = {
  id: 'mod-01',
  name: 'Module 1',
  timeHours: 2,
  prerequisites: [],
  topics: ['basics'],
};

beforeEach(() => {
  mockLesson.loading = false;
  mockLesson.isCompleted = false;
  mockLesson.bodyContent = 'Test body content';
  mockLesson.sections = [];
  mockLesson.visibleSection = null;
  mockBookmarks.bookmarks = [];
  mockHighlights.highlights = [];
  mockSelection.showToolbar = false;
  mockSelection.selection = null;
  mockSelection.showNoteEditor = false;
  mockSelection.showCardEditor = false;
  mockSearch.searchActive = false;
  mockLessonNav.hasPrev = false;
  mockLessonNav.hasNext = false;
  useLessonUIStore.setState(defaultLessonUI);
  useSettingsStore.setState(defaultSettings);
  useHighlightsStore.setState({ byModule: {}, loading: {} });
  scrollToSection.mockReset();
  handleScroll.mockReset();
  handleToggleCompleted.mockReset();
  handleTextSelection.mockReset();
  addHighlight.mockReset();
  deleteHighlight.mockReset();
  handleToggleBookmark.mockReset();
  goPrev.mockReset();
  goNext.mockReset();
});

describe('LessonSection', () => {
  const props = { course: mockCourse, module: mockModule };

  test('renders loading state', () => {
    mockLesson.loading = true;
    const { container } = render(<LessonSection {...props} />);
    expect(container.textContent).toContain('Loading lesson');
  });

  test('renders lesson content when loaded', () => {
    const { container } = render(<LessonSection {...props} />);
    expect(container.textContent).toContain('Test Heading');
    expect(container.textContent).toContain('Test body content');
  });

  test('renders completion button when not completed', () => {
    const { container } = render(<LessonSection {...props} />);
    expect(container.textContent).toContain('Mark as Complete');
  });

  test('renders completed state', () => {
    mockLesson.isCompleted = true;
    const { container } = render(<LessonSection {...props} />);
    expect(container.textContent).toContain('Completed');
  });

  test('renders pomodoro timer when enabled', () => {
    useLessonUIStore.setState({ showPomodoro: true });
    const { container } = render(<LessonSection {...props} />);
    expect(container.querySelector('[data-testid="pomodoro-timer"]')).toBeTruthy();
  });

  test('renders study tools when showTools is true and not focusing', () => {
    useLessonUIStore.setState({ showTools: true });
    const { container } = render(<LessonSection {...props} />);
    expect(container.querySelector('[data-testid="study-tools"]')).toBeTruthy();
  });

  test('hides study tools when focus mode is on', () => {
    useLessonUIStore.setState({ showTools: true });
    useSettingsStore.setState({ focusMode: true });
    const { container } = render(<LessonSection {...props} />);
    expect(container.querySelector('[data-testid="study-tools"]')).toBeNull();
  });

  test('renders sections panel when showSections is true', () => {
    useSettingsStore.setState({ showSections: true });
    const { container } = render(<LessonSection {...props} />);
    expect(container.querySelector('[data-testid="sections-panel"]')).toBeTruthy();
  });

  test('renders viewer search when search is active', () => {
    mockSearch.searchActive = true;
    const { container } = render(<LessonSection {...props} />);
    expect(container.querySelector('[data-testid="viewer-search"]')).toBeTruthy();
  });

  test('renders selection toolbar when there is a selection', () => {
    mockSelection.showToolbar = true;
    mockSelection.selection = { text: 'selected', range: new (window as any).Range() };
    const { container } = render(<LessonSection {...props} />);
    expect(container.querySelector('[data-testid="selection-toolbar"]')).toBeTruthy();
  });

  test('renders note editor when open', () => {
    mockSelection.showNoteEditor = true;
    mockSelection.selection = { text: 'note text', range: new (window as any).Range() };
    const { container } = render(<LessonSection {...props} />);
    expect(container.querySelector('[data-testid="note-editor"]')).toBeTruthy();
  });

  test('renders card editor when open', () => {
    mockSelection.showCardEditor = true;
    mockSelection.selection = { text: 'card text', range: new (window as any).Range() };
    const { container } = render(<LessonSection {...props} />);
    expect(container.querySelector('[data-testid="card-editor"]')).toBeTruthy();
  });

  test('renders toggle sections button when sections panel hidden and not focusing', () => {
    const { container } = render(<LessonSection {...props} />);
    expect(container.textContent).toContain('☰');
  });

  test('calls handleToggleCompleted when completion button clicked', () => {
    const { getByText } = render(<LessonSection {...props} />);
    fireEvent.click(getByText('Mark as Complete'));
    expect(handleToggleCompleted).toHaveBeenCalledTimes(1);
  });
});
