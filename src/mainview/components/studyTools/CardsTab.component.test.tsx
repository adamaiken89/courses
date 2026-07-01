import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test } from 'bun:test';

import { useViewStore } from '../../stores/viewStore';
import { clearMocks, mockResponse, setupRPC } from '../../testUtils';

setupRPC();

import CardsTab from './CardsTab';

function makeUserCard(
  overrides: Partial<{
    id: string;
    front: string;
    back: string;
    interval: number;
    repetitions: number;
    nextReviewDate: string;
    isStarred: boolean;
  }> & { id: string },
) {
  return {
    courseId: 'test',
    moduleId: '01',
    front: 'What is X?',
    back: 'X is Y',
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewDate: '2026-07-01T00:00:00.000Z',
    lastReviewed: null,
    isStarred: false,
    ...overrides,
  };
}

describe('CardsTab', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    clearMocks();
    useViewStore.setState({
      views: [
        {
          type: 'lesson',
          course: {
            id: 'test',
            course: 'test',
            displayName: 'Test',
            timeBudgetHours: 0,
            targetLevel: '',
            domain: '',
            prerequisites: [],
            learningObjectives: [],
            modules: [],
          },
          module: { id: '01', name: '', timeHours: 0, prerequisites: [], topics: [] },
        },
      ],
    });
  });

  test('renders loading state', () => {
    mockResponse('getUserCards', new Promise(() => {}));
    const { getByText } = render(<CardsTab />);
    expect(getByText('Loading...')).toBeInTheDocument();
  });

  test('renders empty state', async () => {
    mockResponse('getUserCards', []);
    const { findByText } = render(<CardsTab />);
    expect(
      await findByText('No cards yet. Select text in the lesson to create cards.'),
    ).toBeInTheDocument();
  });

  test('renders cards list', async () => {
    mockResponse('getUserCards', [
      makeUserCard({ id: 'c1', front: 'What is A?', back: 'A is B', interval: 1, repetitions: 2 }),
      makeUserCard({ id: 'c2', front: 'What is C?', back: 'C is D' }),
    ]);
    const { findByText, getByText } = render(<CardsTab />);
    expect(await findByText('What is A?')).toBeInTheDocument();
    expect(getByText('What is C?')).toBeInTheDocument();
    expect(getByText(/^Due/)).toBeInTheDocument();
    expect(getByText(/^Reps/)).toBeInTheDocument();
  });

  test('deletes card on close click', async () => {
    mockResponse('getUserCards', [
      makeUserCard({ id: 'c1', front: 'What is A?', back: 'A is B' }),
      makeUserCard({ id: 'c2', front: 'What is C?', back: 'C is D' }),
    ]);
    mockResponse('deleteUserCard', null);
    const { findByText, getAllByText, queryByText } = render(<CardsTab />);
    expect(await findByText('What is A?')).toBeInTheDocument();
    const closeButtons = getAllByText('✕');
    await user.click(closeButtons[0]);
    await waitFor(() => {
      expect(queryByText('What is A?')).not.toBeInTheDocument();
    });
    expect(queryByText('What is C?')).toBeInTheDocument();
  });
});
