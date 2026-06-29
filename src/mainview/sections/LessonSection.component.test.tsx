import { act, fireEvent, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

import type { Course, ModuleMeta } from '../../bun/types';
import { useCompletionStore } from '../stores/completionStore';
import { useHighlightsStore } from '../stores/highlightsStore';
import { useLessonUIStore } from '../stores/lessonUIStore';
import { useNotesStore } from '../stores/notesStore';
import { useSettingsStore } from '../stores/settingsStore';
import { clearMocks, deleteMock, mockResponse, mockRPC, setupRPC } from '../test-utils';

const rpcCalls: string[] = [];
const trackedMockRPC = {
  request: new Proxy(mockRPC.request, {
    get(target, method: string) {
      const original = Reflect.get(target, method) as (...a: unknown[]) => Promise<unknown>;
      return (...args: unknown[]) => {
        rpcCalls.push(method);
        return original(...args);
      };
    },
  }),
};

beforeEach(() => {
  rpcCalls.length = 0;
});

setupRPC(trackedMockRPC);

void mock.module('react-markdown', () => ({
  default: ({ children }: { children?: string }) => (
    <div data-testid="markdown">{String(children)}</div>
  ),
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

const mockModuleMeta: ModuleMeta = {
  id: 'mod-01',
  name: 'Module 1',
  timeHours: 2,
  prerequisites: [],
  topics: ['basics'],
};

const defaultLessonUI = { showTools: false, showPomodoro: false };
const defaultSettings = {
  focusMode: false,
  fontSize: 16,
  contentWidth: 'standard' as const,
  showSections: false,
  theme: 'dark' as const,
};

function setupDefaultMocks() {
  mockResponse('loadLesson', {
    h1: 'Test Heading',
    bodyContent: 'Test body content',
    meta: [],
    sections: [],
  });
  mockResponse('isModuleCompleted', false);
  mockResponse('modulesList', []);
  mockResponse('getCompletedModuleIDs', []);
  mockResponse('getModuleBookmarks', []);
  mockResponse('getHighlights', []);
  mockResponse('getNotes', []);
}

beforeEach(() => {
  clearMocks();
  rpcCalls.length = 0;
  setupDefaultMocks();
  useLessonUIStore.setState(defaultLessonUI);
  useSettingsStore.setState(defaultSettings);
  useHighlightsStore.setState({ byModule: {}, loading: {} });
  useCompletionStore.setState({ completed: {}, totalModules: {}, loading: {}, loaded: false });
  useNotesStore.setState({ byModule: {}, loading: {} });
});

function makeMockSelection(text: string, container: Node) {
  const textNode = document.createTextNode(text);
  container.appendChild(textNode);
  const mockRange = {
    getBoundingClientRect: () => ({
      left: 100,
      top: 50,
      width: 100,
      height: 20,
      bottom: 70,
      right: 200,
      toJSON: () => {},
    }),
    commonAncestorContainer: textNode,
  };
  return {
    isCollapsed: false,
    rangeCount: 1,
    getRangeAt: () => mockRange,
    toString: () => text,
    removeAllRanges: mock(() => {}),
    addRange: mock(() => {}),
  };
}

function installMockSelection(mockSel: ReturnType<typeof makeMockSelection>) {
  const orig = window.getSelection;
  window.getSelection = () => mockSel as unknown as Selection;
  return () => {
    window.getSelection = orig;
  };
}

globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
  cb(0);
  return 0;
};

async function renderAndSettle(ui: React.ReactElement) {
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(ui);
    await new Promise((r) => setTimeout(r, 0));
  });
  return result;
}

describe('LessonSection', () => {
  const user = userEvent.setup();
  const props = { course: mockCourse, module: mockModuleMeta };

  afterEach(async () => {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  });

  test('renders loading state', async () => {
    deleteMock('loadLesson');
    mockResponse('loadLesson', new Promise(() => {}));
    const { container } = await renderAndSettle(<LessonSection {...props} />);
    expect(container.textContent).toContain('Loading lesson');
  });

  test('renders lesson content when loaded', async () => {
    const { container } = await renderAndSettle(<LessonSection {...props} />);
    expect(container.textContent).toContain('Test Heading');
    expect(container.textContent).toContain('Test body content');
  });

  test('renders completion button when not completed', async () => {
    const { container } = await renderAndSettle(<LessonSection {...props} />);
    expect(container.textContent).toContain('Mark as Complete');
  });

  test('renders completed state', async () => {
    mockResponse('isModuleCompleted', true);
    const { container } = await renderAndSettle(<LessonSection {...props} />);
    expect(container.textContent).toContain('Completed');
    expect(container.textContent).not.toContain('Mark as Complete');
  });

  test('renders pomodoro timer when enabled', async () => {
    useLessonUIStore.setState({ showPomodoro: true });
    const { container } = await renderAndSettle(<LessonSection {...props} />);
    expect(container.textContent).toContain('Focus');
  });

  test('renders study tools when showTools is true and not focusing', async () => {
    useLessonUIStore.setState({ showTools: true });
    const { container } = await renderAndSettle(<LessonSection {...props} />);
    expect(container.querySelector('[data-testid="study-tools"]')).toBeTruthy();
  });

  test('hides study tools when focus mode is on', async () => {
    useLessonUIStore.setState({ showTools: true });
    useSettingsStore.setState({ focusMode: true });
    const { container } = await renderAndSettle(<LessonSection {...props} />);
    expect(container.textContent).toContain('Test Heading');
    expect(container.querySelector('[data-testid="study-tools"]')).toBeNull();
  });

  test('renders sections panel when showSections is true', async () => {
    mockResponse('loadLesson', {
      h1: 'Test Heading',
      bodyContent: 'Test body content',
      meta: [],
      sections: [{ id: 's1', heading: 'Section One', level: 1, parentID: null }],
    });
    useSettingsStore.setState({ showSections: true });
    const { container } = await renderAndSettle(<LessonSection {...props} />);
    expect(container.textContent).toContain('Test Heading');
    expect(container.querySelector('[data-testid="sections-panel"]')).toBeTruthy();
  });

  test('renders viewer search when search is active via initialSearchQuery', async () => {
    const { getByTestId } = await renderAndSettle(
      <LessonSection {...props} initialSearchQuery="test query" />,
    );
    expect(getByTestId('viewer-search')).toBeTruthy();
  });

  test('renders selection toolbar when there is a selection', async () => {
    const { getByTestId } = await renderAndSettle(<LessonSection {...props} />);

    const contentDiv = getByTestId('lesson-content');
    const mockSel = makeMockSelection('some selectable text', contentDiv);
    const restore = installMockSelection(mockSel);

    fireEvent.mouseUp(contentDiv);

    await waitFor(() => {
      expect(getByTestId('selection-toolbar')).toBeTruthy();
    });
    restore();
  });

  test('renders note editor when open', async () => {
    const { getByTestId, getByText } = await renderAndSettle(<LessonSection {...props} />);

    const contentDiv = getByTestId('lesson-content');
    const mockSel = makeMockSelection('note-worthy text', contentDiv);
    const restore = installMockSelection(mockSel);

    fireEvent.mouseUp(contentDiv);

    await waitFor(() => {
      expect(getByTestId('selection-toolbar')).toBeTruthy();
    });

    await user.click(getByText('Add Note'));

    await waitFor(() => {
      expect(getByTestId('note-editor')).toBeTruthy();
    });
    restore();
  });

  test('renders card editor when open', async () => {
    const { getByTestId, getByText } = await renderAndSettle(<LessonSection {...props} />);

    const contentDiv = getByTestId('lesson-content');
    const mockSel = makeMockSelection('card-worthy text', contentDiv);
    const restore = installMockSelection(mockSel);

    fireEvent.mouseUp(contentDiv);

    await waitFor(() => {
      expect(getByTestId('selection-toolbar')).toBeTruthy();
    });

    await user.click(getByText('Create Card'));

    await waitFor(() => {
      expect(getByTestId('card-editor')).toBeTruthy();
    });
    restore();
  });

  test('renders toggle sections button when sections panel hidden and not focusing', async () => {
    const { container } = await renderAndSettle(<LessonSection {...props} />);
    expect(container.textContent).toContain('☰');
  });

  test('calls handleToggleCompleted when completion button clicked', async () => {
    mockResponse('toggleModuleCompleted', undefined);
    mockResponse('logSession', undefined);

    const { getByTestId } = await renderAndSettle(<LessonSection {...props} />);

    await user.click(getByTestId('complete-btn'));

    await waitFor(() => {
      expect(rpcCalls).toContain('toggleModuleCompleted');
    });
  });
});
