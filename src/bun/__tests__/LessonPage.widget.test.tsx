import { describe, expect, test, afterEach } from 'bun:test';
import { render, waitFor, act } from '@testing-library/react';
import LessonPage from '../../mainview/pages/LessonPage';
import { mockFetch, restoreFetch } from './mock-fetch';
import { useLessonUIStore } from '../../mainview/stores/lessonUIStore';
import '../../mainview/i18n';

const mockCourse = {
  id: 'math-101',
  course: 'Mathematics 101',
  displayName: 'Mathematics 101',
  domain: 'mathematics',
  prerequisites: [],
  modules: [{ id: '01', name: 'Algebra', timeHours: 3, prerequisites: [], topics: [] }],
  timeBudgetHours: 20,
  targetLevel: 'beginner',
  learningObjectives: [],
};

const props = {
  course: mockCourse,
  module: { id: '01', name: 'Algebra', timeHours: 3, prerequisites: [], topics: [] },
  onBack: () => {},
  onSelectModule: () => {},
};

afterEach(() => {
  restoreFetch();
  useLessonUIStore.setState({
    showTools: false,
    showPomodoro: false,
    searchCourseOpen: false,
  });
});

describe('LessonPage snapshot', () => {
  test('loading state', async () => {
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<LessonPage {...props} />));
    });
    expect(container.innerHTML).toMatchSnapshot();
  });

  test('content loaded', async () => {
    mockFetch({
      '/courses/math-101/modules/01/lesson': {
        content: '# Algebra\n\nContent here.\n\n## Section 1\n\nDetails.',
        h1: 'Algebra',
        meta: [{ key: 'est. study time', icon: '⏱', label: 'Study Time', value: '3h' }],
        sections: [{ id: 'section-1', level: 2, heading: 'Section 1', parentID: null }],
        bodyContent: '## Section 1\n\nDetails.',
      },
      '/storage/bookmarks/module': [],
      '/storage/highlights': [],
      '/storage/notes': [],
      '/storage/completed': { completed: false },
      '/completed/count': { count: 0 },
    });
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<LessonPage {...props} />));
    });
    await waitFor(() => expect(container.textContent).toContain('Algebra'));
    expect(container.innerHTML).toMatchSnapshot();
  });
});
