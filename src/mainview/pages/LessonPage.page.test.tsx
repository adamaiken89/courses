import { render } from '@testing-library/react';
import { beforeEach, describe, expect, mock, test } from 'bun:test';

import type { Course, ModuleMeta } from '../../bun/types';
import { useCourseStore } from '../stores/courseStore';
import { useLessonStore } from '../stores/lessonStore';

void mock.module('../sections/LessonSection', () => ({
  default: ({
    course,
    module: mod,
    initialSectionID,
  }: {
    course: Course;
    module: ModuleMeta;
    initialSectionID?: string;
  }) => (
    <div
      data-testid="lesson-section"
      data-courseid={course.id}
      data-moduleid={mod.id}
      data-sectionid={initialSectionID ?? ''}
    >
      LessonSection
    </div>
  ),
}));

void mock.module('../components/ModuleSwitcher', () => ({
  default: ({
    currentModuleId,
    onSelect,
  }: {
    modules: ModuleMeta[];
    currentModuleId: string;
    onSelect: (m: ModuleMeta) => void;
  }) => (
    <div data-testid="module-switcher" data-current={currentModuleId}>
      <button
        onClick={() =>
          onSelect({ id: 'other', name: 'Other', timeHours: 5, prerequisites: [], topics: [] })
        }
      >
        Switch
      </button>
    </div>
  ),
}));

void mock.module('../components/lesson/LessonToolbar', () => ({
  default: () => <div data-testid="lesson-toolbar" />,
}));

void mock.module('../components/SearchOverlay', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="search-overlay">
      <button onClick={onClose}>Close Search</button>
    </div>
  ),
}));
void mock.module('../layouts/PageLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="page-layout">{children}</div>
  ),
}));
void mock.module('../layouts/PageHeader', () => ({
  default: ({
    onBack,
    backLabel,
    center,
    toolbar,
  }: {
    onBack?: () => void;
    backLabel?: string;
    center?: React.ReactNode;
    toolbar?: React.ReactNode;
  }) => (
    <header data-testid="page-header">
      {onBack && <button onClick={onBack}>{backLabel ?? '← Back'}</button>}
      {center}
      {toolbar}
    </header>
  ),
}));
void mock.module('../layouts/PageContent', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <main data-testid="page-content">{children}</main>
  ),
}));

import LessonPage from './LessonPage';

const mockModule: ModuleMeta = {
  id: 'mod-01',
  name: 'Module 1',
  timeHours: 10,
  prerequisites: [],
  topics: ['intro'],
};

const mockCourse: Course = {
  id: 'cs101',
  course: 'CS 101',
  displayName: 'Intro to CS',
  timeBudgetHours: 40,
  targetLevel: 'beginner',
  domain: 'Computer Science',
  prerequisites: [],
  learningObjectives: [],
  modules: [mockModule],
};

describe('LessonPage', () => {
  beforeEach(() => {
    useCourseStore.setState({
      courses: [mockCourse],
      loading: false,
      error: null,
      loaded: true,
    });
    useLessonStore.setState({
      showTools: false,
      showPomodoro: false,
      searchCourseOpen: false,
    });
  });

  test('renders LessonSection with correct props', () => {
    const { container } = render(
      <LessonPage
        course={mockCourse}
        module={mockModule}
        onBack={() => {}}
        onSelectModule={() => {}}
      />,
    );
    const section = container.querySelector('[data-testid="lesson-section"]');
    expect(section).toBeTruthy();
    expect(section!.getAttribute('data-courseid')).toBe('cs101');
    expect(section!.getAttribute('data-moduleid')).toBe('mod-01');
  });

  test('passes initialSectionID to LessonSection', () => {
    const { container } = render(
      <LessonPage
        course={mockCourse}
        module={mockModule}
        initialSectionID="sec-01"
        onBack={() => {}}
        onSelectModule={() => {}}
      />,
    );
    const section = container.querySelector('[data-testid="lesson-section"]');
    expect(section!.getAttribute('data-sectionid')).toBe('sec-01');
  });

  test('renders ModuleSwitcher with current module', () => {
    const { container } = render(
      <LessonPage
        course={mockCourse}
        module={mockModule}
        onBack={() => {}}
        onSelectModule={() => {}}
      />,
    );
    const switcher = container.querySelector('[data-testid="module-switcher"]');
    expect(switcher).toBeTruthy();
    expect(switcher!.getAttribute('data-current')).toBe('mod-01');
  });

  test('renders LessonToolbar', () => {
    const { container } = render(
      <LessonPage
        course={mockCourse}
        module={mockModule}
        onBack={() => {}}
        onSelectModule={() => {}}
      />,
    );
    expect(container.querySelector('[data-testid="lesson-toolbar"]')).toBeTruthy();
  });

  test('calls onBack when back button clicked', () => {
    let called = false;
    const { container } = render(
      <LessonPage
        course={mockCourse}
        module={mockModule}
        onBack={() => {
          called = true;
        }}
        onSelectModule={() => {}}
      />,
    );
    const header = container.querySelector('[data-testid="page-header"]');
    const backBtn = header!.querySelector('button');
    backBtn!.click();
    expect(called).toBe(true);
  });

  test('does not render SearchOverlay when closed', () => {
    const { container } = render(
      <LessonPage
        course={mockCourse}
        module={mockModule}
        onBack={() => {}}
        onSelectModule={() => {}}
      />,
    );
    expect(container.querySelector('[data-testid="search-overlay"]')).toBeNull();
  });

  test('renders SearchOverlay when searchCourseOpen is true', () => {
    useLessonStore.setState({ searchCourseOpen: true });
    const { container } = render(
      <LessonPage
        course={mockCourse}
        module={mockModule}
        onBack={() => {}}
        onSelectModule={() => {}}
      />,
    );
    expect(container.querySelector('[data-testid="search-overlay"]')).toBeTruthy();
  });

  test('passes course displayName as backLabel', () => {
    const { container } = render(
      <LessonPage
        course={mockCourse}
        module={mockModule}
        onBack={() => {}}
        onSelectModule={() => {}}
      />,
    );
    const header = container.querySelector('[data-testid="page-header"]');
    expect(header!.textContent).toContain('Intro to CS');
  });
});
