import { describe, expect, test } from 'bun:test';
import { parseCourse, parseQuiz, parseSections } from '../course-loader';
import { createSRSCard, performReview } from '../srs';
import type { QuizQuestion, SRSCard } from '../types';

describe('parseCourse', () => {
  const validYAML = `
subject: Test Subject
time_budget_hours: 20
target_level: beginner
domain: programming
prerequisites:
  - basic math
learning_objectives:
  - Understand X
  - Understand Y
modules:
  - id: "01"
    name: Intro
    time_hours: 2
    prerequisites: []
    topics:
      - basics
  - id: "02"
    name: Advanced
    time_hours: 3
    prerequisites:
      - 1
    topics:
      - advanced
`;

  test('parses valid YAML', () => {
    const result = parseCourse(validYAML, 'test-subject');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('test-subject');
    expect(result!.course).toBe('Test Subject');
    expect(result!.timeBudgetHours).toBe(20);
    expect(result!.targetLevel).toBe('beginner');
    expect(result!.domain).toBe('programming');
    expect(result!.prerequisites).toEqual(['basic math']);
    expect(result!.learningObjectives).toEqual(['Understand X', 'Understand Y']);
    expect(result!.modules).toHaveLength(2);
    expect(result!.modules[0].id).toBe('01');
    expect(result!.modules[0].name).toBe('Intro');
    expect(result!.modules[0].timeHours).toBe(2);
    expect(result!.modules[1].prerequisites).toEqual(['01']);
    expect(result!.modules[1].topics).toEqual(['advanced']);
  });

  test('returns null for empty input', () => {
    expect(parseCourse('', 'test')).toBeNull();
  });

  test('returns null for missing subject field', () => {
    expect(parseCourse('name: no-subject', 'test')).toBeNull();
  });

  test('handles missing optional fields', () => {
    const result = parseCourse('subject: Minimal', 'minimal');
    expect(result).not.toBeNull();
    expect(result!.timeBudgetHours).toBe(40);
    expect(result!.targetLevel).toBe('intermediate');
    expect(result!.domain).toBe('');
    expect(result!.prerequisites).toEqual([]);
    expect(result!.learningObjectives).toEqual([]);
    expect(result!.modules).toEqual([]);
  });
});

describe('parseQuiz', () => {
  const validYAML = `
- id: q1
  question: What is 2+2?
  options:
    A: "3"
    B: "4"
    C: "5"
  answer: B
  explanation: Basic math
  difficulty: 1
  tags:
    - math
- id: q2
  question: What is water?
  options:
    A: H2O
    B: CO2
  answer: A
  explanation: Chemistry
  difficulty: 2
  tags:
    - chemistry
`;

  test('parses valid quiz YAML', () => {
    const result = parseQuiz(validYAML);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('q1');
    expect(result[0].question).toBe('What is 2+2?');
    expect(result[0].options).toEqual({ A: '3', B: '4', C: '5' });
    expect(result[0].answer).toBe('B');
    expect(result[0].explanation).toBe('Basic math');
    expect(result[0].difficulty).toBe(1);
    expect(result[0].tags).toEqual(['math']);
    expect(result[1].id).toBe('q2');
    expect(result[1].answer).toBe('A');
  });

  test('returns empty array for non-array YAML', () => {
    expect(parseQuiz('key: value')).toEqual([]);
  });

  test('returns empty array for empty input', () => {
    expect(parseQuiz('')).toEqual([]);
  });
});

describe('parseSections', () => {
  test('parses markdown headings', () => {
    const md = `
# Title

Some text

## Section 1

Content

### Subsection

More

## Section 2

Last
`;
    const sections = parseSections(md);
    expect(sections).toHaveLength(4);
    expect(sections[0]).toEqual({ id: 'title', heading: 'Title', level: 1, parentID: null });
    expect(sections[1]).toEqual({
      id: 'section-1',
      heading: 'Section 1',
      level: 2,
      parentID: 'title',
    });
    expect(sections[2]).toEqual({
      id: 'subsection',
      heading: 'Subsection',
      level: 3,
      parentID: 'section-1',
    });
    expect(sections[3]).toEqual({
      id: 'section-2',
      heading: 'Section 2',
      level: 2,
      parentID: 'title',
    });
  });

  test('handles empty markdown', () => {
    expect(parseSections('')).toEqual([]);
  });

  test('handles markdown without headings', () => {
    expect(parseSections('Just a paragraph.\n\nAnother one.')).toEqual([]);
  });

  test('generates correct parent for sibling headings', () => {
    const md = `
## A
## B
### B1
## C
`;
    const sections = parseSections(md);
    expect(sections[0].parentID).toBeNull();
    expect(sections[1].parentID).toBeNull();
    expect(sections[2].parentID).toBe('b');
    expect(sections[3].parentID).toBeNull();
  });

  test('normalizes heading IDs (removes punctuation)', () => {
    const md = `# Hello, World! (test): Part 1`;
    const sections = parseSections(md);
    expect(sections[0].id).toBe('hello-world-test-part-1');
  });

  test('ignores headings inside code blocks', () => {
    const md = `
# Real Heading

\`\`\`
# fake heading
\`\`\`

## Real Subsection

\`\`\`bash
# bash comment
echo hi

## section-like in code block
\`\`\`

### Real Nested
`;
    const sections = parseSections(md);
    expect(sections).toHaveLength(3);
    expect(sections[0].heading).toBe('Real Heading');
    expect(sections[1].heading).toBe('Real Subsection');
    expect(sections[2].heading).toBe('Real Nested');
  });
});

describe('createSRSCard', () => {
  const q: QuizQuestion = {
    id: 'q1',
    question: 'What is 2+2?',
    options: { A: '3', B: '4' },
    answer: 'B',
    explanation: 'Basic math',
    difficulty: 1,
    tags: ['math'],
  };

  test('creates card with correct fields', () => {
    const fixedDate = new Date('2024-01-01T00:00:00Z');
    const card = createSRSCard(q, '01', 'math', fixedDate);
    expect(card.id).toBe('math-01-q1');
    expect(card.questionId).toBe('q1');
    expect(card.moduleId).toBe('01');
    expect(card.courseId).toBe('math');
    expect(card.question).toBe('What is 2+2?');
    expect(card.answer).toBe('B. 4');
    expect(card.explanation).toBe('Basic math');
    expect(card.easeFactor).toBe(2.5);
    expect(card.interval).toBe(0);
    expect(card.repetitions).toBe(0);
    expect(card.nextReviewDate).toBe('2024-01-01T00:00:00.000Z');
    expect(card.lastReviewed).toBeNull();
    expect(card.isStarred).toBe(false);
  });

  test('appends option text to answer', () => {
    const q2: QuizQuestion = { ...q, answer: 'A', options: { A: '3', B: '4' } };
    const card = createSRSCard(q2, '01', 'math', new Date('2024-01-01'));
    expect(card.answer).toBe('A. 3');
  });
});

describe('performReview', () => {
  const baseCard: SRSCard = {
    id: 'test-1-q1',
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
  };

  const fixedDate = new Date('2024-06-15T12:00:00Z');

  test('correct answer: increments repetitions, updates interval (first time)', () => {
    const result = performReview(baseCard, true, fixedDate);
    expect(result.repetitions).toBe(1);
    expect(result.interval).toBe(1);
    expect(result.easeFactor).toBe(2.6);
    expect(result.lastReviewed).toBe('2024-06-15T12:00:00.000Z');
  });

  test('correct answer: second repetition interval is 6', () => {
    const card = { ...baseCard, repetitions: 1, interval: 1 };
    const result = performReview(card, true, fixedDate);
    expect(result.repetitions).toBe(2);
    expect(result.interval).toBe(6);
  });

  test('correct answer: third+ repetition uses ease factor', () => {
    const card = { ...baseCard, repetitions: 2, interval: 6, easeFactor: 2.5 };
    const result = performReview(card, true, fixedDate);
    expect(result.repetitions).toBe(3);
    expect(result.interval).toBe(15);
    expect(result.easeFactor).toBe(2.6);
  });

  test('incorrect answer: resets repetitions, interval to 1, reduces ease factor', () => {
    const card = { ...baseCard, repetitions: 5, interval: 30, easeFactor: 2.5 };
    const result = performReview(card, false, fixedDate);
    expect(result.repetitions).toBe(0);
    expect(result.interval).toBe(1);
    expect(result.easeFactor).toBe(2.3);
    expect(result.lastReviewed).toBe('2024-06-15T12:00:00.000Z');
  });

  test('ease factor never goes below 1.3', () => {
    const card = { ...baseCard, repetitions: 0, easeFactor: 1.3 };
    const result = performReview(card, false, fixedDate);
    expect(result.easeFactor).toBe(1.3);
  });

  test('does not mutate original card', () => {
    const original = { ...baseCard };
    const result = performReview(baseCard, true, fixedDate);
    expect(original.repetitions).toBe(0);
    expect(result.repetitions).toBe(1);
  });
});
