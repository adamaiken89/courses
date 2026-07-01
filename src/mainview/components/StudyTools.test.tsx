import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, mock, test } from 'bun:test';

import { useCourseStore } from '../stores/courseStore';
import StudyTools from './StudyTools';

const mockCourse = {
  id: 'math',
  course: 'math',
  displayName: 'Mathematics',
  modules: [{ id: '01', name: 'Algebra', timeHours: 2, topics: [], prerequisites: [] }],
  timeBudgetHours: 2,
  targetLevel: 'beginner',
  domain: 'math',
  prerequisites: [],
  learningObjectives: [],
};

function renderWithStore(component: React.ReactElement) {
  return render(component);
}

beforeEach(() => {
  useCourseStore.setState({ courses: [mockCourse], loaded: true, loading: false });
});

describe('StudyTools', () => {
  const user = userEvent.setup();

  test('renders without crashing', () => {
    const { container } = renderWithStore(<StudyTools onClose={() => {}} />);
    expect(container.firstChild).toBeTruthy();
  });

  test('renders sidebar title', () => {
    const { getByText } = renderWithStore(<StudyTools onClose={() => {}} />);
    expect(getByText('Study Tools')).toBeInTheDocument();
  });

  test('renders tab buttons', () => {
    const { getByText } = renderWithStore(<StudyTools onClose={() => {}} />);
    expect(getByText('Bookmarks')).toBeInTheDocument();
    expect(getByText('Cards')).toBeInTheDocument();
    expect(getByText('Ask AI')).toBeInTheDocument();
  });

  test('switches tab on click', async () => {
    const { getByText } = renderWithStore(<StudyTools onClose={() => {}} />);
    await user.click(getByText('Bookmarks'));
    expect(getByText('Bookmarks').className).toContain('text-indigo-400');
  });

  test('close button calls onClose', async () => {
    const onClose = mock(() => {});
    const { getByText } = renderWithStore(<StudyTools onClose={onClose} />);
    await user.click(getByText('✕'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
