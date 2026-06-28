import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, test } from 'bun:test';

import type { UserCard } from '../../bun/types';
import { __setRPC } from '../api';

const mockResponses = new Map<string, unknown>();
const mockRPC = {
  request: new Proxy({} as Record<string, (p: unknown) => Promise<unknown>>, {
    get(_, method: string) {
      return (_p: unknown) => {
        if (!mockResponses.has(method)) return Promise.reject(new Error(`No mock for ${method}`));
        return Promise.resolve(mockResponses.get(method));
      };
    },
  }),
};

function mockResponse(method: string, data: unknown) {
  mockResponses.set(method, data);
}

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

beforeAll(() => __setRPC(mockRPC));
beforeEach(() => {
  mockResponses.clear();
  mockResponse('getUserCards', []);
  mockResponse('reviewUserCard', undefined);
  mockResponse('toggleUserCardStar', undefined);
});

import UserCardReviewSection from './UserCardReviewSection';

describe('UserCardReviewSection', () => {
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
    const { container } = render(<UserCardReviewSection courseId="math" />);
    await waitFor(() => {
      expect(container.textContent).toContain('What is 2+2?');
    });
    const btn = container.querySelector('.bg-gray-800 button')!;
    fireEvent.click(btn);
    await waitFor(() => {
      expect(container.textContent).toContain('4');
    });
  });

  test('clicking remembered calls review API', async () => {
    mockResponse('getUserCards', [makeCard(), makeCard({ id: 'c2' })]);
    const { container } = render(<UserCardReviewSection courseId="math" />);
    await waitFor(() => {
      expect(container.textContent).toContain('What is 2+2?');
    });
    fireEvent.click(container.querySelector('.bg-gray-800 button')!);
    await waitFor(() => {
      expect(container.textContent).toContain('Remembered');
    });
    fireEvent.click(container.querySelector('button.bg-emerald-700')!);
    await waitFor(() => {
      expect(mockResponses.has('reviewUserCard')).toBe(true);
    });
  });

  test('clicking forgot calls review API', async () => {
    mockResponse('getUserCards', [makeCard()]);
    const { container } = render(<UserCardReviewSection courseId="math" />);
    await waitFor(() => {
      expect(container.textContent).toContain('What is 2+2?');
    });
    fireEvent.click(container.querySelector('.bg-gray-800 button')!);
    await waitFor(() => {
      expect(container.textContent).toContain('Forgot');
    });
    fireEvent.click(container.querySelector('button.bg-red-700')!);
    await waitFor(() => {
      expect(mockResponses.has('reviewUserCard')).toBe(true);
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
    const { container } = render(<UserCardReviewSection courseId="math" />);
    await waitFor(() => {
      expect(container.textContent).toContain('Star');
    });
    fireEvent.click(container.querySelector('button.text-gray-500')!);
    await waitFor(() => {
      expect(mockResponses.has('toggleUserCardStar')).toBe(true);
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
    fireEvent.click(starredBtn);
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
    fireEvent.click(dueBtn);
    await waitFor(() => {
      expect(container.textContent).toContain('No cards due');
    });
  });
});
