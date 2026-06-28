import { render } from '@testing-library/react';
import { describe, expect, mock, test } from 'bun:test';

void mock.module('../sections/QuizSection', () => ({
  default: ({ courseId, moduleId }: { courseId: string; moduleId: string }) => (
    <div data-testid="quiz-section" data-courseid={courseId} data-moduleid={moduleId}>
      QuizSection
    </div>
  ),
}));

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
  default: ({
    onBack,
    backLabel,
    center,
    actions,
    toolbar,
  }: {
    onBack?: () => void;
    backLabel?: string;
    center?: React.ReactNode;
    actions?: React.ReactNode;
    toolbar?: React.ReactNode;
  }) => (
    <header data-testid="page-header">
      {onBack && <button onClick={onBack}>{backLabel ?? '← Back'}</button>}
      {center}
      {actions}
      {toolbar}
    </header>
  ),
}));

void mock.module('../layouts/PageContent', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <main data-testid="page-content">{children}</main>
  ),
}));

import QuizPage from './QuizPage';

describe('QuizPage', () => {
  const defaultProps = {
    courseId: 'cs101',
    moduleId: 'mod-01',
    onBack: () => {},
    onSwitchCourse: () => {},
  };

  test('renders QuizSection with correct props', () => {
    const { container } = render(<QuizPage {...defaultProps} />);
    const section = container.querySelector('[data-testid="quiz-section"]');
    expect(section).toBeTruthy();
    expect(section!.getAttribute('data-courseid')).toBe('cs101');
    expect(section!.getAttribute('data-moduleid')).toBe('mod-01');
  });

  test('renders CourseSwitcher with currentCourseId', () => {
    const { container } = render(<QuizPage {...defaultProps} />);
    const switcher = container.querySelector('[data-testid="course-switcher"]');
    expect(switcher).toBeTruthy();
    expect(switcher!.getAttribute('data-current')).toBe('cs101');
  });

  test('renders back button that calls onBack', () => {
    let called = false;
    const { getByText } = render(
      <QuizPage
        {...defaultProps}
        onBack={() => {
          called = true;
        }}
      />,
    );
    getByText('← Back').click();
    expect(called).toBe(true);
  });
});
