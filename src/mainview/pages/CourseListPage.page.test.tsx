import { render } from '@testing-library/react';
import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test';

import type { Course } from '../../bun/types';
import i18n from '../i18n';
import { useCompletionStore } from '../stores/completionStore';
import { useCourseStore } from '../stores/courseStore';

void mock.module('../layouts/PageLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="page-layout">{children}</div>
  ),
}));
void mock.module('../layouts/PageHeader', () => ({
  default: ({ actions }: { actions?: React.ReactNode }) => (
    <header data-testid="page-header">{actions}</header>
  ),
}));
void mock.module('../layouts/PageContent', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <main data-testid="page-content">{children}</main>
  ),
}));

afterAll(() => {
  mock.restore();
});

import CourseListPage from './CourseListPage';

const mockCourse: Course = {
  id: 'cs101',
  course: 'CS 101',
  displayName: 'Intro to CS',
  timeBudgetHours: 40,
  targetLevel: 'beginner',
  domain: 'Computer Science',
  prerequisites: [],
  learningObjectives: ['Learn basics', 'Write programs'],
  modules: [
    { id: 'mod-01', name: 'Module 1', timeHours: 10, prerequisites: [], topics: ['intro'] },
    { id: 'mod-02', name: 'Module 2', timeHours: 10, prerequisites: [], topics: ['loops'] },
  ],
};

describe('CourseListPage', () => {
  beforeEach(() => {
    void i18n.changeLanguage('en-US');
    useCourseStore.setState({
      courses: [],
      loading: false,
      error: null,
      loaded: true,
    });
    useCompletionStore.setState({
      completed: {},
      totalModules: {},
      loading: {},
      loaded: true,
    });
  });

  test('shows empty message when no courses', () => {
    const { container } = render(
      <CourseListPage
        onSelectCourse={() => {}}
        onOpenSettings={() => {}}
        onOpenBookmarks={() => {}}
        onOpenDashboard={() => {}}
      />,
    );
    expect(container.textContent).toContain('No courses');
  });

  test('shows courses when loaded', () => {
    useCourseStore.setState({ courses: [mockCourse], loaded: true });
    const { container } = render(
      <CourseListPage
        onSelectCourse={() => {}}
        onOpenSettings={() => {}}
        onOpenBookmarks={() => {}}
        onOpenDashboard={() => {}}
      />,
    );
    expect(container.textContent).toContain('Intro to CS');
  });

  test('calls onSelectCourse when course clicked', () => {
    useCourseStore.setState({ courses: [mockCourse], loaded: true });
    let selected: Course | null = null;
    const { container } = render(
      <CourseListPage
        onSelectCourse={(c) => {
          selected = c;
        }}
        onOpenSettings={() => {}}
        onOpenBookmarks={() => {}}
        onOpenDashboard={() => {}}
      />,
    );
    const courseBtn = container.querySelector('button.text-left') as HTMLButtonElement;
    courseBtn.click();
    expect(selected).toBeTruthy();
    expect(selected!.id).toBe('cs101');
  });

  test('calls onOpenSettings when settings clicked', () => {
    useCourseStore.setState({ courses: [mockCourse], loaded: true });
    let called = false;
    const { getByText } = render(
      <CourseListPage
        onSelectCourse={() => {}}
        onOpenSettings={() => {
          called = true;
        }}
        onOpenBookmarks={() => {}}
        onOpenDashboard={() => {}}
      />,
    );
    getByText('Settings').click();
    expect(called).toBe(true);
  });

  test('calls onOpenBookmarks when bookmarks clicked', () => {
    useCourseStore.setState({ courses: [mockCourse], loaded: true });
    let called = false;
    const { getByText } = render(
      <CourseListPage
        onSelectCourse={() => {}}
        onOpenSettings={() => {}}
        onOpenBookmarks={() => {
          called = true;
        }}
        onOpenDashboard={() => {}}
      />,
    );
    getByText('Bookmarks').click();
    expect(called).toBe(true);
  });

  test('shows loading state', () => {
    useCourseStore.setState({ loading: true });
    const { container } = render(
      <CourseListPage
        onSelectCourse={() => {}}
        onOpenSettings={() => {}}
        onOpenBookmarks={() => {}}
        onOpenDashboard={() => {}}
      />,
    );
    expect(container.textContent).toContain('Loading courses');
  });

  test('shows error state', () => {
    useCourseStore.setState({ error: 'Network error' });
    const { container } = render(
      <CourseListPage
        onSelectCourse={() => {}}
        onOpenSettings={() => {}}
        onOpenBookmarks={() => {}}
        onOpenDashboard={() => {}}
      />,
    );
    expect(container.textContent).toContain('Network error');
  });

  test('displays progress for completed modules', () => {
    useCourseStore.setState({ courses: [mockCourse], loaded: true });
    useCompletionStore.setState({
      completed: { 'cs101:mod-01': true },
    });
    const { container } = render(
      <CourseListPage
        onSelectCourse={() => {}}
        onOpenSettings={() => {}}
        onOpenBookmarks={() => {}}
        onOpenDashboard={() => {}}
      />,
    );
    expect(container.textContent).toContain('1/2');
  });

  test('displays learning objectives', () => {
    useCourseStore.setState({ courses: [mockCourse], loaded: true });
    const { container } = render(
      <CourseListPage
        onSelectCourse={() => {}}
        onOpenSettings={() => {}}
        onOpenBookmarks={() => {}}
        onOpenDashboard={() => {}}
      />,
    );
    expect(container.textContent).toContain('Learn basics');
    expect(container.textContent).toContain('Write programs');
  });
});
