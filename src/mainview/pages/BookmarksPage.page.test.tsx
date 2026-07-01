import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, mock, test } from 'bun:test';

import type { Bookmark } from '../../bun/types';
import i18n from '../i18n';
import { useCourseStore } from '../stores/courseStore';
import { clearMocks, hasMock, mockResponse, setupRPC } from '../testUtils';

void mock.module('../components/CourseSwitcher', () => ({
  default: ({ currentCourseId, onSelect }: { currentCourseId?: string; onSelect: () => void }) => (
    <div data-testid="course-switcher" data-current={currentCourseId}>
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

setupRPC();

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
  const user = userEvent.setup();
  beforeEach(() => {
    void i18n.changeLanguage('en-US');
    clearMocks();
    mockResponse('getAllBookmarks', [mockBookmark]);
    mockResponse('courses', []);
    useCourseStore.setState({ courses: [], loading: false, error: null, loaded: true });
  });

  test('shows loading state initially', () => {
    mockResponse('getAllBookmarks', new Promise(() => {}));
    const { container } = render(
      <BookmarksPage onBack={() => {}} onOpen={() => {}} onSwitchCourse={() => {}} />,
    );
    expect(container.textContent).toContain('Loading bookmarks');
  });

  test('shows empty message when no bookmarks', async () => {
    mockResponse('getAllBookmarks', []);
    const { container } = render(
      <BookmarksPage onBack={() => {}} onOpen={() => {}} onSwitchCourse={() => {}} />,
    );
    await waitFor(() => {
      expect(container.textContent).toContain('No bookmarks');
    });
  });

  test('renders bookmarks list', async () => {
    const { container } = render(
      <BookmarksPage onBack={() => {}} onOpen={() => {}} onSwitchCourse={() => {}} />,
    );
    await waitFor(() => {
      expect(container.textContent).toContain('Test Bookmark');
    });
  });

  test('calls onOpen with correct args when bookmark clicked', async () => {
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
    await waitFor(() => {
      expect(container.textContent).toContain('Test Bookmark');
    });
    const btn = container.querySelector('button.w-full') as HTMLButtonElement;
    await user.click(btn);
    expect(opened).toBeTruthy();
    expect(opened!.courseID).toBe('cs101');
    expect(opened!.moduleID).toBe('mod-01');
  });

  test('deletes bookmark when delete clicked', async () => {
    mockResponse('deleteBookmark', { ok: true });
    const { container } = render(
      <BookmarksPage onBack={() => {}} onOpen={() => {}} onSwitchCourse={() => {}} />,
    );
    await waitFor(() => {
      expect(container.textContent).toContain('Test Bookmark');
    });
    const deleteBtn = container.querySelector('button[title*="delete" i]') as HTMLButtonElement;
    expect(deleteBtn).toBeTruthy();
    await user.click(deleteBtn);
    await waitFor(() => {
      expect(hasMock('deleteBookmark')).toBe(true);
    });
  });

  test('calls onBack when back button clicked', async () => {
    let called = false;
    const { getByText } = render(
      <BookmarksPage
        onBack={() => {
          called = true;
        }}
        onOpen={() => {}}
        onSwitchCourse={() => {}}
      />,
    );
    await waitFor(() => {
      expect(getByText('← Back')).toBeTruthy();
    });
    await user.click(getByText('← Back'));
    expect(called).toBe(true);
  });
});
