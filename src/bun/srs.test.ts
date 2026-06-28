import { describe, expect, test } from 'bun:test';
import {
  getDueCards,
  getStarredCards,
  getAllCards,
  getCardsForCourse,
  getDueCardsForCourse,
  getStarredCardsForCourse,
  toggleStar,
} from './srs';
import type { SRSDeck, SRSCard } from './types';

function makeCard(overrides: Partial<SRSCard> & { id: string }): SRSCard {
  return {
    questionId: 'q1',
    moduleId: '01',
    courseId: 'test',
    question: 'Q?',
    answer: 'A',
    explanation: 'E',
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewDate: '2024-01-01T00:00:00.000Z',
    lastReviewed: null,
    isStarred: false,
    ...overrides,
  };
}

function makeDeck(cards: SRSCard[]): SRSDeck {
  const map: Record<string, SRSCard> = {};
  for (const c of cards) {
    map[c.id] = c;
  }
  return { cards: map };
}

describe('getDueCards', () => {
  const now = new Date('2024-06-15T12:00:00Z');

  test('returns cards with nextReviewDate <= now', () => {
    const deck = makeDeck([
      makeCard({ id: 'a', nextReviewDate: '2024-06-10T00:00:00Z' }),
      makeCard({ id: 'b', nextReviewDate: '2024-06-15T12:00:00Z' }),
      makeCard({ id: 'c', nextReviewDate: '2024-06-20T00:00:00Z' }),
    ]);
    const due = getDueCards(deck, now);
    expect(due).toHaveLength(2);
    expect(due.map((c) => c.id)).toEqual(['a', 'b']);
  });

  test('returns empty array when no cards due', () => {
    const deck = makeDeck([makeCard({ id: 'a', nextReviewDate: '2024-06-20T00:00:00Z' })]);
    expect(getDueCards(deck, now)).toHaveLength(0);
  });

  test('returns empty array for empty deck', () => {
    expect(getDueCards({ cards: {} }, now)).toEqual([]);
  });

  test('sorts by nextReviewDate ascending', () => {
    const deck = makeDeck([
      makeCard({ id: 'c', nextReviewDate: '2024-06-12T00:00:00Z' }),
      makeCard({ id: 'a', nextReviewDate: '2024-06-01T00:00:00Z' }),
      makeCard({ id: 'b', nextReviewDate: '2024-06-10T00:00:00Z' }),
    ]);
    const due = getDueCards(deck, now);
    expect(due.map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('getStarredCards', () => {
  test('returns only starred cards', () => {
    const deck = makeDeck([
      makeCard({ id: 'a', isStarred: true }),
      makeCard({ id: 'b', isStarred: false }),
      makeCard({ id: 'c', isStarred: true }),
    ]);
    const starred = getStarredCards(deck);
    expect(starred).toHaveLength(2);
    expect(starred.map((c) => c.id)).toEqual(['a', 'c']);
  });

  test('returns empty when none starred', () => {
    const deck = makeDeck([makeCard({ id: 'a' }), makeCard({ id: 'b' })]);
    expect(getStarredCards(deck)).toHaveLength(0);
  });
});

describe('getAllCards', () => {
  test('returns all cards sorted by nextReviewDate', () => {
    const deck = makeDeck([
      makeCard({ id: 'b', nextReviewDate: '2024-06-10T00:00:00Z' }),
      makeCard({ id: 'a', nextReviewDate: '2024-06-01T00:00:00Z' }),
    ]);
    const all = getAllCards(deck);
    expect(all.map((c) => c.id)).toEqual(['a', 'b']);
  });

  test('returns empty for empty deck', () => {
    expect(getAllCards({ cards: {} })).toEqual([]);
  });
});

describe('getCardsForCourse', () => {
  test('filters by courseId', () => {
    const deck = makeDeck([
      makeCard({ id: 'a', courseId: 'math' }),
      makeCard({ id: 'b', courseId: 'physics' }),
      makeCard({ id: 'c', courseId: 'math' }),
    ]);
    const cards = getCardsForCourse(deck, 'math');
    expect(cards).toHaveLength(2);
    expect(cards.map((c) => c.id)).toEqual(['a', 'c']);
  });
});

describe('getDueCardsForCourse', () => {
  const now = new Date('2024-06-15T12:00:00Z');

  test('filters due cards by course', () => {
    const deck = makeDeck([
      makeCard({ id: 'a', courseId: 'math', nextReviewDate: '2024-06-10T00:00:00Z' }),
      makeCard({ id: 'b', courseId: 'physics', nextReviewDate: '2024-06-10T00:00:00Z' }),
      makeCard({ id: 'c', courseId: 'math', nextReviewDate: '2024-06-20T00:00:00Z' }),
    ]);
    const due = getDueCardsForCourse(deck, 'math', now);
    expect(due).toHaveLength(1);
    expect(due[0].id).toBe('a');
  });
});

describe('getStarredCardsForCourse', () => {
  test('filters starred cards by course', () => {
    const deck = makeDeck([
      makeCard({ id: 'a', courseId: 'math', isStarred: true }),
      makeCard({ id: 'b', courseId: 'physics', isStarred: true }),
      makeCard({ id: 'c', courseId: 'math', isStarred: false }),
    ]);
    const starred = getStarredCardsForCourse(deck, 'math');
    expect(starred).toHaveLength(1);
    expect(starred[0].id).toBe('a');
  });
});

describe('toggleStar', () => {
  test('toggles isStarred from false to true', () => {
    const deck = makeDeck([makeCard({ id: 'a', isStarred: false })]);
    const result = toggleStar(deck, 'a');
    expect(result.cards['a'].isStarred).toBe(true);
  });

  test('toggles isStarred from true to false', () => {
    const deck = makeDeck([makeCard({ id: 'a', isStarred: true })]);
    const result = toggleStar(deck, 'a');
    expect(result.cards['a'].isStarred).toBe(false);
  });

  test('returns original deck if card not found', () => {
    const deck = makeDeck([makeCard({ id: 'a' })]);
    const result = toggleStar(deck, 'nonexistent');
    expect(result).toBe(deck);
  });

  test('does not mutate original deck', () => {
    const deck = makeDeck([makeCard({ id: 'a', isStarred: false })]);
    toggleStar(deck, 'a');
    expect(deck.cards['a'].isStarred).toBe(false);
  });
});
