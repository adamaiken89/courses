import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, act } from '@testing-library/react';
import LessonSection from '../../mainview/sections/LessonSection';
import { useSettingsStore } from '../../mainview/stores/settingsStore';
import { useLessonUIStore } from '../../mainview/stores/lessonUIStore';
import { processLessonMarkdown } from '../lesson-markdown';
import { mockFetch, restoreFetch } from './mock-fetch';
import type { Course } from '../types';
import '../../mainview/i18n';

const mockCourse = {
  id: 'test',
  course: 'test',
  displayName: 'Test Course',
  targetLevel: 'beginner',
  domain: 'test',
  prerequisites: [],
  learningObjectives: [],
  modules: [{ id: 1, name: 'Intro Module', timeHours: 2, prerequisites: [], topics: [] }],
  timeBudgetHours: 0,
} as Course;

const mockModule = { id: 1, name: 'Intro Module', timeHours: 2, prerequisites: [], topics: [] };

beforeEach(() => {
  localStorage.removeItem('coursereader-focus');
  localStorage.removeItem('coursereader-sections');
  useSettingsStore.setState({ focusMode: false, showSections: false });
});

const mockContent = `# Introduction\n\nEst. study time: 2h\nLanguage: en\n\nWelcome to the lesson.\n\n## Chapter 1\n\nFirst chapter content.`;
const processed = processLessonMarkdown(mockContent);

const defaultProps = {
  course: mockCourse,
  module: mockModule,
};

afterEach(() => {
  restoreFetch();
  useLessonUIStore.setState({
    showTools: false,
    showPomodoro: false,
    searchCourseOpen: false,
  });
});

function mockAll() {
  mockFetch({
    '/api/courses/test/modules/1/lesson': {
      content: mockContent,
      h1: processed.h1,
      meta: processed.meta,
      bodyContent: processed.bodyContent,
      sections: processed.sections,
    },
    '/api/storage/completed': { completed: false },
    '/api/courses/test/modules': mockCourse.modules,
    '/api/storage/completed/count': { count: 0 },
    '/api/storage/bookmarks/module': [],
    '/api/storage/highlights': [],
    '/api/storage/notes': [],
  });
}

describe('LessonSection interaction', () => {
  test('renders h1 title', async () => {
    mockAll();
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<LessonSection {...defaultProps} />));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.textContent).toContain('Introduction');
  });

  test('renders mark as complete button', async () => {
    mockAll();
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<LessonSection {...defaultProps} />));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const btn = container.querySelector('button.w-full');
    expect(btn).not.toBeNull();
  });

  test('shows meta info', async () => {
    mockAll();
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<LessonSection {...defaultProps} />));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.querySelector('.lesson-meta')).not.toBeNull();
  });

  test('shows sections panel when showSections is true', async () => {
    mockAll();
    useSettingsStore.setState({ showSections: true });
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<LessonSection {...defaultProps} />));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const sectionsPanel = container.querySelector('.fixed');
    expect(sectionsPanel).not.toBeNull();
  });

  test('loading state shows loading text', async () => {
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<LessonSection {...defaultProps} />));
    });
    expect(container.textContent).toMatch(/loading/i);
  });
});
