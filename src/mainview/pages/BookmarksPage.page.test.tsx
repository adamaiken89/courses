import { render } from '@testing-library/react';
import { beforeEach, describe, expect, mock, test } from 'bun:test';

import type { Bookmark } from '../../bun/types';
import i18n from '../i18n';
import { useCourseStore } from '../stores/courseStore';

const mockBookmarksFn = mock((): Promise<Bookmark[]> => Promise.resolve([]));
const mockDeleteBookmarkFn = mock((_id: string): Promise<void> => Promise.resolve());
const mockCoursesListFn = mock((): Promise<never[]> => Promise.resolve([]));

void mock.module('../api', () => ({
  api: {
    storage: {
      bookmarks: () => mockBookmarksFn(),
      deleteBookmark: (id: string) => mockDeleteBookmarkFn(id),
    },
    courses: {
      list: () => mockCoursesListFn(),
    },
  },
  __setRPC: mock(() => {}),
}));

void mock.module('../components/CourseSwitcher', () => ({
  default: ({ onSelect }: { onSelect: () => void }) => (
    <div data-testid="course-switcher">
      <button onClick={onSelect}>Switch</button>
    </div>
  ),
}));

void mock.module('../layouts/PageLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="page-layout">{children}</div>
  ),
}));

void mock.module('../layouts/PageHeader', () => ({
  default: ({ onBack }: { onBack?: () => void }) => (
    <header data-testid="page-header">{onBack && <button onClick={onBack}>← Back</button>}</header>
  ),
}));

void mock.module('../layouts/PageContent', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <main data-testid="page-content">{children}</main>
  ),
}));

import BookmarksPage from './BookmarksPage';

const mockBookmark: Bookmark = {
  id: 'bm-1',
  courseID: 'cs101',
  moduleID: 'mod-01',
  sectionID: 'sec-01',
  title: 'Test Bookmark',
  scrollPosition: 100,
  createdAt: '2025-01-15T10:00:00Z',
};

describe('BookmarksPage', () => {
  beforeEach(() => {
    void i18n.changeLanguage('en-US');
    mockBookmarksFn.mockClear();
    mockDeleteBookmarkFn.mockClear();
    mockCoursesListFn.mockClear();
    mockBookmarksFn.mockImplementation(() => Promise.resolve([]));
    mockCoursesListFn.mockImplementation(() => Promise.resolve([]));
    useCourseStore.setState({ courses: [], loading: false, error: null, loaded: true });
  });

  test('shows loading state initially', () => {
    mockBookmarksFn.mockImplementation(() => new Promise(() => {}));
    const { container } = render(
      <BookmarksPage onBack={() => {}} onOpen={() => {}} onSwitchCourse={() => {}} />,
    );
    expect(container.textContent).toContain('Loading bookmarks');
  });

  test('shows empty message when no bookmarks', async () => {
    const { container } = render(
      <BookmarksPage onBack={() => {}} onOpen={() => {}} onSwitchCourse={() => {}} />,
    );
    await Bun.sleep(10);
    expect(container.textContent).toContain('No bookmarks');
  });

  test('renders bookmarks list', async () => {
    mockBookmarksFn.mockImplementation(() => Promise.resolve([mockBookmark]));
    const { container } = render(
      <BookmarksPage onBack={() => {}} onOpen={() => {}} onSwitchCourse={() => {}} />,
    );
    await Bun.sleep(10);
    expect(container.textContent).toContain('Test Bookmark');
  });

  test('calls onOpen when bookmark clicked', async () => {
    mockBookmarksFn.mockImplementation(() => Promise.resolve([mockBookmark]));
    let opened: { courseID: string; moduleID: string } | null = null;
    const { container } = render(
      <BookmarksPage
        onBack={() => {}}
        onOpen={(cid, mid) => {
          opened = { courseID: cid, moduleID: mid };
        }}
        onSwitchCourse={() => {}}
      />,
    );
    await Bun.sleep(10);
    const btn = container.querySelector('button.w-full') as HTMLButtonElement;
    btn.click();
    expect(opened).toBeTruthy();
    expect(opened!.courseID).toBe('cs101');
    expect(opened!.moduleID).toBe('mod-01');
  });

  test('calls onBack when back button clicked', async () => {
    let called = false;
    const { container } = render(
      <BookmarksPage
        onBack={() => {
          called = true;
        }}
        onOpen={() => {}}
        onSwitchCourse={() => {}}
      />,
    );
    await Bun.sleep(10);
    const header = container.querySelector('[data-testid="page-header"]');
    header!.querySelector('button')!.click();
    expect(called).toBe(true);
  });
});
