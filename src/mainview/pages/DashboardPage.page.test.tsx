import { render } from '@testing-library/react';
import { beforeEach, describe, expect, mock, test } from 'bun:test';

import i18n from '../i18n';

const mockGetCourseStatsFn = mock(
  (_id: string): Promise<Record<string, unknown> | null> => Promise.resolve(null),
);
const mockGetGlobalStatsFn = mock(
  (): Promise<Record<string, unknown> | null> => Promise.resolve(null),
);

void mock.module('../api', () => ({
  api: {
    stats: {
      course: (id: string) => mockGetCourseStatsFn(id),
      global: () => mockGetGlobalStatsFn(),
      logSession: mock(() => Promise.resolve(undefined)),
    },
  },
  __setRPC: mock(() => {}),
}));

void mock.module('../layouts/PageLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="page-layout">{children}</div>
  ),
}));

void mock.module('../layouts/PageHeader', () => ({
  default: ({ onBack, title }: { onBack?: () => void; title?: string }) => (
    <header data-testid="page-header">
      {title && <h1>{title}</h1>}
      {onBack && <button onClick={onBack}>← Back</button>}
    </header>
  ),
}));

void mock.module('../layouts/PageContent', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <main data-testid="page-content">{children}</main>
  ),
}));

void mock.module('../components/ui/StatCard', () => ({
  StatCard: ({
    label,
    value,
    suffix,
  }: {
    label: string;
    value: string | number;
    suffix?: string;
  }) => (
    <div data-testid="stat-card">
      <span>{label}</span>
      <span>{String(value)}</span>
      {suffix && <span>{suffix}</span>}
    </div>
  ),
}));

import DashboardPage from './DashboardPage';

describe('DashboardPage', () => {
  beforeEach(() => {
    void i18n.changeLanguage('en-US');
    mockGetCourseStatsFn.mockClear();
    mockGetGlobalStatsFn.mockClear();
    mockGetCourseStatsFn.mockImplementation(() => Promise.resolve(null));
    mockGetGlobalStatsFn.mockImplementation(() => Promise.resolve(null));
  });

  test('shows loading state initially', () => {
    mockGetGlobalStatsFn.mockImplementation(() => new Promise(() => {}));
    const { container } = render(<DashboardPage onBack={() => {}} />);
    expect(container.textContent).toContain('Loading');
  });

  test('shows no data when stats are null', async () => {
    const { container } = render(<DashboardPage onBack={() => {}} />);
    await Bun.sleep(10);
    expect(container.textContent).toContain('No data');
  });

  test('renders global stats when available', async () => {
    mockGetGlobalStatsFn.mockImplementation(() =>
      Promise.resolve({
        totalCourses: 3,
        totalModules: 12,
        totalCompletedModules: 5,
        totalStudyMinutes: 240,
        streak: 7,
        courseSummaries: [{ courseID: 'cs101', courseName: 'CS 101', completed: 3, total: 6 }],
      }),
    );
    const { container } = render(<DashboardPage onBack={() => {}} />);
    await Bun.sleep(10);
    expect(container.textContent).toContain('CS 101');
    expect(container.textContent).toContain('3/6');
  });

  test('renders course stats when courseID provided', async () => {
    mockGetCourseStatsFn.mockImplementation(() =>
      Promise.resolve({
        courseID: 'cs101',
        totalModules: 6,
        completedModules: 3,
        avgQuizScore: 85,
        quizAttempts: 10,
        srsDueCount: 5,
        srsTotalCards: 20,
        totalStudyMinutes: 120,
        streak: 3,
        recentSessions: [
          {
            date: '2025-01-15',
            type: 'reading',
            durationMinutes: 30,
          },
        ],
      }),
    );
    const { container } = render(<DashboardPage courseID="cs101" onBack={() => {}} />);
    await Bun.sleep(10);
    expect(mockGetCourseStatsFn).toHaveBeenCalledWith('cs101');
    expect(container.textContent).toContain('3/6');
    expect(container.textContent).toContain('85');
  });

  test('calls onBack when back button clicked', async () => {
    let called = false;
    const { getByText } = render(
      <DashboardPage
        onBack={() => {
          called = true;
        }}
      />,
    );
    getByText('← Back').click();
    expect(called).toBe(true);
  });
});
