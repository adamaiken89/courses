import { render } from '@testing-library/react';
import { beforeEach, describe, expect, mock, test } from 'bun:test';

import type { Course, ModuleMeta } from '../../bun/types';
import i18n from '../i18n';
import { useCompletionStore } from '../stores/completionStore';

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
  default: ({ actions, center }: { actions?: React.ReactNode; center?: React.ReactNode }) => (
    <header data-testid="page-header">
      {center}
      {actions}
    </header>
  ),
}));

void mock.module('../layouts/PageContent', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <main data-testid="page-content">{children}</main>
  ),
}));

import ModuleListPage from './ModuleListPage';

const mockModules: ModuleMeta[] = [
  { id: 'mod-01', name: 'Module 1', timeHours: 10, prerequisites: [], topics: ['intro'] },
  { id: 'mod-02', name: 'Module 2', timeHours: 15, prerequisites: [], topics: ['advanced'] },
];

const mockCourse: Course = {
  id: 'cs101',
  course: 'CS 101',
  displayName: 'Intro to CS',
  timeBudgetHours: 40,
  targetLevel: 'beginner',
  domain: 'Computer Science',
  prerequisites: [],
  learningObjectives: [],
  modules: mockModules,
};

describe('ModuleListPage', () => {
  beforeEach(() => {
    void i18n.changeLanguage('en-US');
    useCompletionStore.setState({
      completed: {},
      totalModules: {},
      loading: {},
      loaded: true,
    });
  });

  test('renders all modules', () => {
    const { container } = render(
      <ModuleListPage
        course={mockCourse}
        onSelectModule={() => {}}
        onSelectCourse={() => {}}
        onOpenSettings={() => {}}
        onOpenBookmarks={() => {}}
        onOpenDashboard={() => {}}
      />,
    );
    expect(container.textContent).toContain('Module 1');
    expect(container.textContent).toContain('Module 2');
  });

  test('calls onSelectModule when module clicked', () => {
    let selected: ModuleMeta | null = null;
    const { container } = render(
      <ModuleListPage
        course={mockCourse}
        onSelectModule={(m) => {
          selected = m;
        }}
        onSelectCourse={() => {}}
        onOpenSettings={() => {}}
        onOpenBookmarks={() => {}}
        onOpenDashboard={() => {}}
      />,
    );
    const moduleBtns = container.querySelectorAll('button.text-left');
    (moduleBtns[0] as HTMLButtonElement).click();
    expect(selected).toBeTruthy();
    expect(selected!.id).toBe('mod-01');
  });

  test('shows completed badge for completed modules', () => {
    useCompletionStore.setState({
      completed: { 'cs101:mod-01': true },
    });
    const { container } = render(
      <ModuleListPage
        course={mockCourse}
        onSelectModule={() => {}}
        onSelectCourse={() => {}}
        onOpenSettings={() => {}}
        onOpenBookmarks={() => {}}
        onOpenDashboard={() => {}}
      />,
    );
    const completedBadge = container.querySelector('.bg-emerald-900\\/50');
    expect(completedBadge).toBeTruthy();
  });

  test('renders CourseSwitcher with courseId', () => {
    const { container } = render(
      <ModuleListPage
        course={mockCourse}
        onSelectModule={() => {}}
        onSelectCourse={() => {}}
        onOpenSettings={() => {}}
        onOpenBookmarks={() => {}}
        onOpenDashboard={() => {}}
      />,
    );
    const switcher = container.querySelector('[data-testid="course-switcher"]');
    expect(switcher).toBeTruthy();
    expect(switcher!.getAttribute('data-current')).toBe('cs101');
  });

  test('calls onOpenSettings when settings clicked', () => {
    let called = false;
    const { getByText } = render(
      <ModuleListPage
        course={mockCourse}
        onSelectModule={() => {}}
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
    let called = false;
    const { getByText } = render(
      <ModuleListPage
        course={mockCourse}
        onSelectModule={() => {}}
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

  test('displays module topics', () => {
    const { container } = render(
      <ModuleListPage
        course={mockCourse}
        onSelectModule={() => {}}
        onSelectCourse={() => {}}
        onOpenSettings={() => {}}
        onOpenBookmarks={() => {}}
        onOpenDashboard={() => {}}
      />,
    );
    expect(container.textContent).toContain('intro');
    expect(container.textContent).toContain('advanced');
  });
});
