import { describe, expect, test } from 'bun:test';
import { render } from '@testing-library/react';
import ModuleListPage from '../../mainview/pages/ModuleListPage';
import '../../mainview/i18n';

const mockCourse = {
  id: 'math-101',
  course: 'Mathematics 101',
  displayName: 'Mathematics 101',
  domain: 'mathematics',
  prerequisites: [],
  modules: [
    {
      id: '01',
      name: 'Algebra Basics',
      timeHours: 3,
      prerequisites: [],
      topics: ['equations', 'variables'],
    },
    { id: '02', name: 'Geometry', timeHours: 2, prerequisites: [], topics: ['shapes'] },
  ],
  timeBudgetHours: 20,
  targetLevel: 'beginner',
  learningObjectives: [],
};

const defaultProps = {
  course: mockCourse,
  onSelectModule: () => {},
  onSelectCourse: () => {},
  onOpenSettings: () => {},
  onOpenBookmarks: () => {},
  onOpenDashboard: () => {},
};

describe('ModuleListPage snapshot', () => {
  test('renders module list with modules', () => {
    const { container } = render(<ModuleListPage {...defaultProps} />);
    expect(container.textContent).toContain('Algebra Basics');
    expect(container.textContent).toContain('Geometry');
    expect(container.innerHTML).toMatchSnapshot();
  });
});
