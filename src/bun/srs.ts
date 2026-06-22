import type { SRSCard, SRSDeck, QuizQuestion } from "./types";

export function getDueCards(deck: SRSDeck, now?: Date): SRSCard[] {
  const nowDate = now || new Date();
  return Object.values(deck.cards)
    .filter((c) => new Date(c.nextReviewDate) <= nowDate)
    .sort((a, b) => new Date(a.nextReviewDate).getTime() - new Date(b.nextReviewDate).getTime());
}

export function getStarredCards(deck: SRSDeck): SRSCard[] {
  return Object.values(deck.cards)
    .filter((c) => c.isStarred)
    .sort((a, b) => new Date(a.nextReviewDate).getTime() - new Date(b.nextReviewDate).getTime());
}

export function getAllCards(deck: SRSDeck): SRSCard[] {
  return Object.values(deck.cards).sort(
    (a, b) => new Date(a.nextReviewDate).getTime() - new Date(b.nextReviewDate).getTime()
  );
}

export function getCardsForSubject(deck: SRSDeck, subjectId: string): SRSCard[] {
  return getAllCards(deck).filter((c) => c.subjectId === subjectId);
}

export function getDueCardsForSubject(deck: SRSDeck, subjectId: string, now?: Date): SRSCard[] {
  return getDueCards(deck, now).filter((c) => c.subjectId === subjectId);
}

export function getStarredCardsForSubject(deck: SRSDeck, subjectId: string): SRSCard[] {
  return getStarredCards(deck).filter((c) => c.subjectId === subjectId);
}

export function createSRSCard(question: QuizQuestion, moduleId: number, subjectId: string, now?: Date): SRSCard {
  const nowISO = (now || new Date()).toISOString();
  return {
    id: `${subjectId}-${moduleId}-${question.id}`,
    questionId: question.id,
    moduleId,
    subjectId,
    question: question.question,
    answer: `${question.answer}. ${question.options[question.answer] || ""}`,
    explanation: question.explanation,
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewDate: nowISO,
    lastReviewed: null,
    isStarred: false,
  };
}

export function performReview(card: SRSCard, correct: boolean, now?: Date): SRSCard {
  const nowDate = now || new Date();
  const updated = { ...card };

  if (correct) {
    updated.repetitions += 1;
    if (updated.repetitions === 1) updated.interval = 1;
    else if (updated.repetitions === 2) updated.interval = 6;
    else updated.interval = Math.round(updated.interval * updated.easeFactor);
    updated.easeFactor = Math.max(1.3, updated.easeFactor + 0.1);
  } else {
    updated.repetitions = 0;
    updated.interval = 1;
    updated.easeFactor = Math.max(1.3, updated.easeFactor - 0.2);
  }

  const nextDate = new Date(nowDate);
  nextDate.setDate(nextDate.getDate() + updated.interval);
  updated.nextReviewDate = nextDate.toISOString();
  updated.lastReviewed = nowDate.toISOString();

  return updated;
}

export function toggleStar(deck: SRSDeck, cardId: string): SRSDeck {
  const card = deck.cards[cardId];
  if (!card) return deck;
  return {
    ...deck,
    cards: {
      ...deck.cards,
      [cardId]: { ...card, isStarred: !card.isStarred },
    },
  };
}
