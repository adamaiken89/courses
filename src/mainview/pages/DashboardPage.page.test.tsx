import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, mock, test } from 'bun:test';

import i18n from '../i18n';
import { clearMocks, mockResponse, setupRPC } from '../test-utils';

setupRPC();

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
    clearMocks();
  });

  test('shows loading state initially', () => {
    mockResponse('getGlobalStats', new Promise(() => {}));
    const { container } = render(<DashboardPage onBack={() => {}} />);
    expect(container.textContent).toContain('Loading');
  });

  test('shows no data when stats are null', async () => {
    mockResponse('getGlobalStats', null);
    const { container } = render(<DashboardPage onBack={() => {}} />);
    await waitFor(() => {
      expect(container.textContent).toContain('No data');
    });
  });

  test('renders global stats when available', async () => {
    mockResponse('getGlobalStats', {
      totalCourses: 3,
      totalModules: 12,
      totalCompletedModules: 5,
      totalStudyMinutes: 240,
      streak: 7,
      courseSummaries: [{ courseID: 'cs101', courseName: 'CS 101', completed: 3, total: 6 }],
    });
    const { container } = render(<DashboardPage onBack={() => {}} />);
    await waitFor(() => {
      expect(container.textContent).toContain('CS 101');
    });
    expect(container.textContent).toContain('3/6');
  });

  test('renders course stats when courseID provided', async () => {
    mockResponse('getCourseStats', {
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
    });
    const { container } = render(<DashboardPage courseID="cs101" onBack={() => {}} />);
    await waitFor(() => {
      expect(container.textContent).toContain('3/6');
    });
    expect(container.textContent).toContain('85');
  });

  test('calls onBack when back button clicked', async () => {
    mockResponse('getGlobalStats', null);
    let called = false;
    let renderResult!: ReturnType<typeof render>;
    await act(async () => {
      renderResult = render(
        <DashboardPage
          onBack={() => {
            called = true;
          }}
        />,
      );
      await new Promise((r) => setTimeout(r, 0));
    });
    renderResult.getByText('← Back').click();
    expect(called).toBe(true);
  });
});
