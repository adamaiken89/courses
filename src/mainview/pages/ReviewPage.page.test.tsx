import { describe, expect, mock, test } from 'bun:test';

import { render } from '@testing-library/react';

import ReviewPage from './ReviewPage';

void mock.module('../sections/ReviewSection', () => ({
  default: ({ courseId }: { courseId: string }) => (
    <div data-testid="review-section" data-courseid={courseId}>
      ReviewSection
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
  }: {
    onBack?: () => void;
    backLabel?: string;
    center?: React.ReactNode;
    actions?: React.ReactNode;
  }) => (
    <header data-testid="page-header">
      {onBack && <button onClick={onBack}>{backLabel ?? '← Back'}</button>}
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

describe('ReviewPage', () => {
  const defaultProps = {
    courseId: 'cs101',
    onBack: () => {},
    onSwitchCourse: () => {},
  };

  test('renders ReviewSection with courseId', () => {
    const { container } = render(<ReviewPage {...defaultProps} />);
    const section = container.querySelector('[data-testid="review-section"]');
    expect(section).toBeTruthy();
    expect(section!.getAttribute('data-courseid')).toBe('cs101');
  });

  test('renders CourseSwitcher with currentCourseId', () => {
    const { container } = render(<ReviewPage {...defaultProps} />);
    const switcher = container.querySelector('[data-testid="course-switcher"]');
    expect(switcher).toBeTruthy();
    expect(switcher!.getAttribute('data-current')).toBe('cs101');
  });

  test('calls onBack when back button clicked', () => {
    let called = false;
    const { getByText } = render(
      <ReviewPage
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
