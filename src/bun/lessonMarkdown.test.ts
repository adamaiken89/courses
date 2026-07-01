import { describe, expect, test } from 'bun:test';
import { processLessonMarkdown, headingId } from './lessonMarkdown';

describe('headingId', () => {
  test('lowercases and hyphenates', () => {
    expect(headingId('Hello World')).toBe('hello-world');
  });

  test('removes colons, commas, parentheses', () => {
    expect(headingId('Hello, World (test): Part 1')).toBe('hello-world-test-part-1');
  });

  test('removes non-alphanumeric characters', () => {
    expect(headingId('What is 2+2?')).toBe('what-is-22');
  });
});

describe('processLessonMarkdown', () => {
  test('extracts h1 title', () => {
    const result = processLessonMarkdown('# Chapter One\n\nContent');
    expect(result.h1).toBe('Chapter One');
  });

  test('extracts meta fields from paragraph after h1', () => {
    const md = `# Lesson 1

est. study time: 30 min
language: TypeScript
description: Learn basics

## Section`;
    const result = processLessonMarkdown(md);
    expect(result.meta).toHaveLength(3);
    expect(result.meta[0]).toMatchObject({ key: 'est. study time', value: '30 min' });
    expect(result.meta[1]).toMatchObject({ key: 'language', value: 'TypeScript' });
    expect(result.meta[2]).toMatchObject({ key: 'description', value: 'Learn basics' });
  });

  test('skips unknown meta fields', () => {
    const md = `# Title

est. study time: 10 min
unknown: ignored

## Section`;
    const result = processLessonMarkdown(md);
    expect(result.meta).toHaveLength(1);
  });

  test('returns empty meta when no fields found', () => {
    const result = processLessonMarkdown('# Title\n\nContent');
    expect(result.meta).toEqual([]);
  });

  test('parses section headings', () => {
    const md = `# Title

## Section A

### Sub A1

## Section B`;
    const result = processLessonMarkdown(md);
    expect(result.sections).toHaveLength(4);
    expect(result.sections[0]).toMatchObject({
      id: 'title',
      heading: 'Title',
      level: 1,
      parentID: null,
    });
    expect(result.sections[1]).toMatchObject({
      id: 'section-a',
      heading: 'Section A',
      level: 2,
      parentID: 'title',
    });
    expect(result.sections[2]).toMatchObject({
      id: 'sub-a1',
      heading: 'Sub A1',
      level: 3,
      parentID: 'section-a',
    });
    expect(result.sections[3]).toMatchObject({
      id: 'section-b',
      heading: 'Section B',
      level: 2,
      parentID: 'title',
    });
  });

  test('handles empty markdown', () => {
    const result = processLessonMarkdown('');
    expect(result.h1).toBe('');
    expect(result.meta).toEqual([]);
    expect(result.sections).toEqual([]);
    expect(result.bodyContent).toBe('');
  });

  test('handles markdown without h1', () => {
    const result = processLessonMarkdown('## Section\n\nContent');
    expect(result.h1).toBe('');
    expect(result.sections).toHaveLength(1);
  });

  test('strips header lines from bodyContent', () => {
    const md = `# Title

est. study time: 10 min

## Section 1

Body text`;
    const result = processLessonMarkdown(md);
    expect(result.bodyContent).not.toContain('# Title');
    expect(result.bodyContent).toContain('## Section 1');
    expect(result.bodyContent).toContain('Body text');
  });

  test('returns full markdown as bodyContent when no header', () => {
    const result = processLessonMarkdown('Just text');
    expect(result.bodyContent).toBe('Just text');
  });
});
