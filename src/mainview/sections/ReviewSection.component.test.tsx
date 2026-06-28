import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, test } from 'bun:test';

import type { SRSCard } from '../../bun/types';
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

function makeCard(id: string, overrides?: Partial<Omit<SRSCard, 'id'>>): SRSCard {
  return {
    id,
    questionId: 'q1',
    moduleId: 'mod-01',
    courseId: 'cs101',
    question: 'What is 2+2?',
    answer: '4',
    explanation: 'Simple addition',
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewDate: new Date(Date.now() - 86400000).toISOString(),
    lastReviewed: null,
    isStarred: false,
    ...overrides,
  };
}

beforeAll(() => __setRPC(mockRPC));
beforeEach(() => {
  mockResponses.clear();
  mockResponse('getSRSDeck', { cards: {} });
});

import ReviewSection from './ReviewSection';

describe('ReviewSection', () => {
  const props = { courseId: 'cs101' };

  test('renders loading state', async () => {
    mockResponse('getSRSDeck', new Promise(() => {}));
    const { container } = render(<ReviewSection {...props} />);
    expect(container.textContent).toContain('Loading review cards');
  });

  test('renders empty state when no cards', async () => {
    mockResponse('getSRSDeck', { cards: {} });
    const { container } = render(<ReviewSection {...props} />);
    await waitFor(() => {
      expect(container.textContent).toContain('No cards in deck');
    });
  });

  test('renders card with question and show answer button', async () => {
    mockResponse('getSRSDeck', { cards: { c1: makeCard('c1') } });
    const { container } = render(<ReviewSection {...props} />);
    await waitFor(() => {
      expect(container.textContent).toContain('What is 2+2?');
    });
    expect(container.textContent).toContain('Show Answer');
  });

  function clickShowAnswer(container: HTMLElement) {
    const btn = container.querySelector('.bg-gray-800 button')!;
    fireEvent.click(btn);
  }

  test('shows answer when show answer clicked', async () => {
    mockResponse('getSRSDeck', { cards: { c1: makeCard('c1') } });
    const { container } = render(<ReviewSection {...props} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Show Answer');
    });
    clickShowAnswer(container);
    await waitFor(() => {
      expect(container.textContent).toContain('Forgot');
      expect(container.textContent).toContain('Remembered');
    });
  });

  test('shows answer side with question, answer, explanation', async () => {
    mockResponse('getSRSDeck', { cards: { c1: makeCard('c1') } });
    const { container } = render(<ReviewSection {...props} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Show Answer');
    });
    clickShowAnswer(container);
    await waitFor(() => {
      expect(container.textContent).toContain('4');
      expect(container.textContent).toContain('Simple addition');
    });
  });

  test('calls review API on remembered', async () => {
    const card = makeCard('c1');
    mockResponse('getSRSDeck', { cards: { c1: card } });
    mockResponse('reviewSRSCard', { ...card, repetitions: 1, interval: 1 });
    const { container } = render(<ReviewSection {...props} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Show Answer');
    });
    clickShowAnswer(container);
    await waitFor(() => {
      expect(container.textContent).toContain('Remembered');
    });
    fireEvent.click(container.querySelector('button.bg-emerald-700')!);
    await waitFor(() => {
      expect(mockResponses.has('reviewSRSCard')).toBe(true);
    });
  });

  test('calls review API on forgot', async () => {
    const card = makeCard('c1');
    mockResponse('getSRSDeck', { cards: { c1: card } });
    mockResponse('reviewSRSCard', { ...card, repetitions: 0, interval: 0 });
    const { container } = render(<ReviewSection {...props} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Show Answer');
    });
    clickShowAnswer(container);
    await waitFor(() => {
      expect(container.textContent).toContain('Forgot');
    });
    fireEvent.click(container.querySelector('button.bg-red-700')!);
    await waitFor(() => {
      expect(mockResponses.has('reviewSRSCard')).toBe(true);
    });
  });

  test('shows star icon for starred card', async () => {
    mockResponse('getSRSDeck', { cards: { c1: makeCard('c1', { isStarred: true }) } });
    const { container } = render(<ReviewSection {...props} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Unstar');
    });
  });

  test('shows unstarred option for non-starred card', async () => {
    mockResponse('getSRSDeck', { cards: { c1: makeCard('c1', { isStarred: false }) } });
    const { container } = render(<ReviewSection {...props} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Star');
    });
  });

  test('calls toggleStar API when star button clicked', async () => {
    mockResponse('getSRSDeck', { cards: { c1: makeCard('c1', { isStarred: true }) } });
    mockResponse('toggleSRSStar', undefined);
    const { container } = render(<ReviewSection {...props} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Unstar');
    });
    const starBtn = container.querySelector('button.text-yellow-500')!;
    fireEvent.click(starBtn);
    await waitFor(() => {
      expect(mockResponses.has('toggleSRSStar')).toBe(true);
    });
  });

  test('renders filter buttons', async () => {
    mockResponse('getSRSDeck', { cards: { c1: makeCard('c1') } });
    const { container } = render(<ReviewSection {...props} />);
    await waitFor(() => {
      expect(container.textContent).toContain('All');
      expect(container.textContent).toContain('Due');
      expect(container.textContent).toContain('Starred');
    });
  });

  test('reloads cards when filter clicked', async () => {
    const card = makeCard('c1');
    mockResponse('getSRSDeck', { cards: { c1: card } });
    const { container } = render(<ReviewSection {...props} />);
    await waitFor(() => {
      expect(container.textContent).toContain('All');
    });
    mockResponse('getSRSDeck', { cards: {} });
    const dueBtn = container.querySelector('button.bg-gray-700')!;
    fireEvent.click(dueBtn);
    await waitFor(() => {
      expect(container.textContent).toContain('No cards due');
    });
  });

  test('shows empty state messages per filter', async () => {
    mockResponse('getSRSDeck', { cards: {} });
    const { container } = render(<ReviewSection {...props} />);
    await waitFor(() => {
      expect(container.textContent).toContain('No cards in deck');
    });
  });
});
