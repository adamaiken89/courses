import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';

import type { Course, ModuleMeta } from '../../bun/types';
import { __setRPC } from '../api';
import { useCompletionStore } from '../stores/completionStore';
import { useHighlightsStore } from '../stores/highlightsStore';
import { useLessonUIStore } from '../stores/lessonUIStore';
import { useNotesStore } from '../stores/notesStore';
import { useSettingsStore } from '../stores/settingsStore';

type RPCProxy = { request: Record<string, (p: unknown) => Promise<unknown>> };
const mockResponses = new Map<string, unknown>();
const rpcCalls: string[] = [];

const mockRPC: RPCProxy = {
  request: new Proxy({} as Record<string, (p: unknown) => Promise<unknown>>, {
    get(_, method: string) {
      return (_p: unknown) => {
        rpcCalls.push(method);
        if (!mockResponses.has(method))
          return Promise.reject(new Error(`No mock for ${method}`));
        return Promise.resolve(mockResponses.get(method));
      };
    },
  }),
};

function mockResponse(method: string, data: unknown) {
  mockResponses.set(method, data);
}

beforeAll(() => {
  __setRPC(mockRPC);
});

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
  mockResponses.clear();
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

describe('LessonSection', () => {
  const props = { course: mockCourse, module: mockModuleMeta };

  test('renders loading state', () => {
    mockResponses.delete('loadLesson');
    mockResponses.set('loadLesson', new Promise(() => {}));
    const { container } = render(<LessonSection {...props} />);
    expect(container.textContent).toContain('Loading lesson');
  });

  test('renders lesson content when loaded', async () => {
    const { container } = render(<LessonSection {...props} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Test Heading');
    });
    expect(container.textContent).toContain('Test body content');
  });

  test('renders completion button when not completed', async () => {
    const { container } = render(<LessonSection {...props} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Mark as Complete');
    });
  });

  test('renders completed state', async () => {
    mockResponse('isModuleCompleted', true);
    const { container } = render(<LessonSection {...props} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Completed');
    });
    expect(container.textContent).not.toContain('Mark as Complete');
  });

  test('renders pomodoro timer when enabled', async () => {
    useLessonUIStore.setState({ showPomodoro: true });
    const { container } = render(<LessonSection {...props} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Focus');
    });
  });

  test('renders study tools when showTools is true and not focusing', async () => {
    useLessonUIStore.setState({ showTools: true });
    const { container } = render(<LessonSection {...props} />);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="study-tools"]')).toBeTruthy();
    });
  });

  test('hides study tools when focus mode is on', async () => {
    useLessonUIStore.setState({ showTools: true });
    useSettingsStore.setState({ focusMode: true });
    const { container } = render(<LessonSection {...props} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Test Heading');
    });
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
    const { container } = render(<LessonSection {...props} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Test Heading');
    });
    expect(container.querySelector('.fixed.right-4.w-64')).toBeTruthy();
  });

  test('renders viewer search when search is active via initialSearchQuery', async () => {
    const { container } = render(
      <LessonSection {...props} initialSearchQuery="test query" />,
    );
    await waitFor(() => {
      expect(container.querySelector('[data-testid="viewer-search"]')).toBeTruthy();
    });
  });

  test('renders selection toolbar when there is a selection', async () => {
    const { container } = render(<LessonSection {...props} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Test Heading');
    });

    const contentDiv = container.querySelector('.flex-1.overflow-y-auto')!;
    const mockSel = makeMockSelection('some selectable text', contentDiv);
    const restore = installMockSelection(mockSel);

    fireEvent.mouseUp(contentDiv);

    await waitFor(() => {
      expect(container.querySelector('.fixed.z-50')).toBeTruthy();
    });
    restore();
  });

  test('renders note editor when open', async () => {
    const { container } = render(<LessonSection {...props} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Test Heading');
    });

    const contentDiv = container.querySelector('.flex-1.overflow-y-auto')!;
    const mockSel = makeMockSelection('note-worthy text', contentDiv);
    const restore = installMockSelection(mockSel);

    fireEvent.mouseUp(contentDiv);

    await waitFor(() => {
      expect(container.querySelector('.fixed.z-50')).toBeTruthy();
    });

    const addNoteBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Add Note'),
    )!;
    fireEvent.click(addNoteBtn);

    await waitFor(() => {
      expect(container.querySelector('[data-testid="note-editor"]')).toBeTruthy();
    });
    restore();
  });

  test('renders card editor when open', async () => {
    const { container } = render(<LessonSection {...props} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Test Heading');
    });

    const contentDiv = container.querySelector('.flex-1.overflow-y-auto')!;
    const mockSel = makeMockSelection('card-worthy text', contentDiv);
    const restore = installMockSelection(mockSel);

    fireEvent.mouseUp(contentDiv);

    await waitFor(() => {
      expect(container.querySelector('.fixed.z-50')).toBeTruthy();
    });

    const createCardBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Create Card'),
    )!;
    fireEvent.click(createCardBtn);

    await waitFor(() => {
      expect(container.querySelector('[data-testid="card-editor"]')).toBeTruthy();
    });
    restore();
  });

  test('renders toggle sections button when sections panel hidden and not focusing', async () => {
    const { container } = render(<LessonSection {...props} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Test Heading');
    });
    expect(container.textContent).toContain('☰');
  });

  test('calls handleToggleCompleted when completion button clicked', async () => {
    mockResponse('toggleModuleCompleted', undefined);
    mockResponse('logSession', undefined);

    const { container } = render(<LessonSection {...props} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Mark as Complete');
    });

    const btn = container.querySelector('button.w-full')!;
    fireEvent.click(btn);

    await waitFor(() => {
      expect(rpcCalls).toContain('toggleModuleCompleted');
    });
  });
});
