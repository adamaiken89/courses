import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test } from 'bun:test';

import type { SRSCard } from '../../bun/types';
import { clearMocks, hasMock, mockResponse, setupRPC } from '../testUtils';

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

setupRPC();

beforeEach(() => {
  clearMocks();
  mockResponse('getSRSDeck', { cards: {} });
});

import ReviewSection from './ReviewSection';

describe('ReviewSection', () => {
  const user = userEvent.setup();
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

  test('shows answer when show answer clicked', async () => {
    mockResponse('getSRSDeck', { cards: { c1: makeCard('c1') } });
    const { container, getByTestId } = render(<ReviewSection {...props} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Show Answer');
    });
    await user.click(getByTestId('show-answer'));
    await waitFor(() => {
      expect(container.textContent).toContain('Forgot');
      expect(container.textContent).toContain('Remembered');
    });
  });

  test('shows answer side with question, answer, explanation', async () => {
    mockResponse('getSRSDeck', { cards: { c1: makeCard('c1') } });
    const { container, getByTestId } = render(<ReviewSection {...props} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Show Answer');
    });
    await user.click(getByTestId('show-answer'));
    await waitFor(() => {
      expect(container.textContent).toContain('4');
      expect(container.textContent).toContain('Simple addition');
    });
  });

  test('calls review API on remembered', async () => {
    const card = makeCard('c1');
    mockResponse('getSRSDeck', { cards: { c1: card } });
    mockResponse('reviewSRSCard', { ...card, repetitions: 1, interval: 1 });
    const { container, getByTestId } = render(<ReviewSection {...props} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Show Answer');
    });
    await user.click(getByTestId('show-answer'));
    await waitFor(() => {
      expect(container.textContent).toContain('Remembered');
    });
    await user.click(getByTestId('btn-remembered'));
    await waitFor(() => {
      expect(hasMock('reviewSRSCard')).toBe(true);
    });
  });

  test('calls review API on forgot', async () => {
    const card = makeCard('c1');
    mockResponse('getSRSDeck', { cards: { c1: card } });
    mockResponse('reviewSRSCard', { ...card, repetitions: 0, interval: 0 });
    const { container, getByTestId } = render(<ReviewSection {...props} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Show Answer');
    });
    await user.click(getByTestId('show-answer'));
    await waitFor(() => {
      expect(container.textContent).toContain('Forgot');
    });
    await user.click(getByTestId('btn-forgot'));
    await waitFor(() => {
      expect(hasMock('reviewSRSCard')).toBe(true);
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
    mockResponse('toggleSRSStar', makeCard('c1', { isStarred: false }));
    const { container, getByTestId } = render(<ReviewSection {...props} />);
    await waitFor(() => {
      expect(container.textContent).toContain('Unstar');
    });
    await user.click(getByTestId('btn-star'));
    await waitFor(() => {
      expect(hasMock('toggleSRSStar')).toBe(true);
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
    const dueBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Due',
    )!;
    await user.click(dueBtn);
    await waitFor(() => {
      expect(container.textContent).toContain('No cards due');
    });
  });
});
