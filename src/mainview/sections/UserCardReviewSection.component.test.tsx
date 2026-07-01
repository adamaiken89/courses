import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test } from 'bun:test';

import type { UserCard } from '../../bun/types';
import { clearMocks, hasMock, mockResponse, setupRPC } from '../testUtils';

function makeCard(overrides?: Partial<UserCard>): UserCard {
  return {
    id: 'c1',
    courseId: 'math',
    moduleId: '01',
    front: 'What is 2+2?',
    back: '4',
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewDate: new Date(Date.now() - 86400000).toISOString(),
    lastReviewed: null,
    isStarred: false,
    createdAt: new Date(0).toISOString(),
    ...overrides,
  };
}

setupRPC();

beforeEach(() => {
  clearMocks();
  mockResponse('getUserCards', []);
  mockResponse('reviewUserCard', undefined);
  mockResponse('toggleUserCardStar', undefined);
});

import UserCardReviewSection from './UserCardReviewSection';

describe('UserCardReviewSection', () => {
  const user = userEvent.setup();
  test('shows loading state initially', () => {
    mockResponse('getUserCards', new Promise(() => {}));
    const { container } = render(<UserCardReviewSection courseId="math" />);
    expect(container.textContent).toContain('Loading review cards');
  });

  test('shows empty state when no cards', async () => {
    mockResponse('getUserCards', []);
    const { container } = render(<UserCardReviewSection courseId="math" />);
    await waitFor(() => {
      expect(container.textContent).toContain('No cards yet');
    });
  });

  test('shows card front when loaded', async () => {
    mockResponse('getUserCards', [makeCard()]);
    const { container } = render(<UserCardReviewSection courseId="math" />);
    await waitFor(() => {
      expect(container.textContent).toContain('What is 2+2?');
    });
  });

  test('shows filter buttons', async () => {
    mockResponse('getUserCards', [makeCard()]);
    const { container } = render(<UserCardReviewSection courseId="math" />);
    await waitFor(() => {
      expect(container.textContent).toContain('All');
      expect(container.textContent).toContain('Due');
      expect(container.textContent).toContain('Starred');
    });
  });

  test('clicking show answer reveals back', async () => {
    mockResponse('getUserCards', [makeCard()]);
    const { container, getByTestId } = render(<UserCardReviewSection courseId="math" />);
    await waitFor(() => {
      expect(container.textContent).toContain('What is 2+2?');
    });
    await user.click(getByTestId('show-answer'));
    await waitFor(() => {
      expect(container.textContent).toContain('4');
    });
  });

  test('clicking remembered calls review API', async () => {
    mockResponse('getUserCards', [makeCard(), makeCard({ id: 'c2' })]);
    mockResponse('reviewUserCard', undefined);
    const { container, getByTestId } = render(<UserCardReviewSection courseId="math" />);
    await waitFor(() => {
      expect(container.textContent).toContain('What is 2+2?');
    });
    await user.click(getByTestId('show-answer'));
    await waitFor(() => {
      expect(container.textContent).toContain('Remembered');
    });
    await user.click(getByTestId('btn-remembered'));
    await waitFor(() => {
      expect(hasMock('reviewUserCard')).toBe(true);
    });
  });

  test('clicking forgot calls review API', async () => {
    mockResponse('getUserCards', [makeCard()]);
    mockResponse('reviewUserCard', undefined);
    const { container, getByTestId } = render(<UserCardReviewSection courseId="math" />);
    await waitFor(() => {
      expect(container.textContent).toContain('What is 2+2?');
    });
    await user.click(getByTestId('show-answer'));
    await waitFor(() => {
      expect(container.textContent).toContain('Forgot');
    });
    await user.click(getByTestId('btn-forgot'));
    await waitFor(() => {
      expect(hasMock('reviewUserCard')).toBe(true);
    });
  });

  test('starred card shows filled star icon', async () => {
    mockResponse('getUserCards', [makeCard({ isStarred: true })]);
    const { container } = render(<UserCardReviewSection courseId="math" />);
    await waitFor(() => {
      expect(container.textContent).toContain('Unstar');
    });
  });

  test('star button toggles via API', async () => {
    mockResponse('getUserCards', [makeCard()]);
    mockResponse('toggleUserCardStar', { ...makeCard(), isStarred: true });
    const { container, getByTestId } = render(<UserCardReviewSection courseId="math" />);
    await waitFor(() => {
      expect(container.textContent).toContain('Star');
    });
    await user.click(getByTestId('btn-star'));
    await waitFor(() => {
      expect(hasMock('toggleUserCardStar')).toBe(true);
    });
  });

  test('shows card counter', async () => {
    mockResponse('getUserCards', [makeCard()]);
    const { container } = render(<UserCardReviewSection courseId="math" />);
    await waitFor(() => {
      expect(container.textContent).toMatch(/1 \/ 1/);
    });
  });

  test('switching filter shows noStarredCards', async () => {
    mockResponse('getUserCards', []);
    const { container } = render(<UserCardReviewSection courseId="math" />);
    await waitFor(() => {
      expect(container.textContent).toContain('All');
    });
    const starredBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Starred',
    )!;
    await user.click(starredBtn);
    await waitFor(() => {
      expect(container.textContent).toContain('No starred cards');
    });
  });

  test('switching filter to due shows noDueCards', async () => {
    mockResponse('getUserCards', []);
    const { container } = render(<UserCardReviewSection courseId="math" />);
    await waitFor(() => {
      expect(container.textContent).toContain('No cards yet');
    });
    const dueBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Due',
    )!;
    await user.click(dueBtn);
    await waitFor(() => {
      expect(container.textContent).toContain('No cards due');
    });
  });
});
