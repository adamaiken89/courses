import { describe, expect, test } from 'bun:test';
import { parse } from './yaml';

describe('parse', () => {
  test('parses simple mapping', () => {
    const result = parse('key: value');
    expect(result).toEqual({ key: 'value' });
  });

  test('parses numeric value', () => {
    const result = parse('count: 42');
    expect(result).toEqual({ count: 42 });
  });

  test('parses boolean values', () => {
    const result = parse('active: true\nvisible: false');
    expect(result).toEqual({ active: true, visible: false });
  });

  test('parses null values', () => {
    const result = parse('a: null\nb: ~');
    expect(result).toEqual({ a: null, b: null });
  });

  test('parses quoted strings', () => {
    const result = parse('title: \'hello\'\ndesc: "world"');
    expect(result).toEqual({ title: 'hello', desc: 'world' });
  });

  test('parses nested mapping', () => {
    const yaml = `course:
  name: Math
  level: 101`;
    const result = parse(yaml);
    expect(result).toEqual({ course: { name: 'Math', level: 101 } });
  });

  test('parses sequence', () => {
    const yaml = `items:
  - apple
  - banana
  - cherry`;
    const result = parse(yaml);
    expect(result).toEqual({ items: ['apple', 'banana', 'cherry'] });
  });

  test('parses sequence of mappings', () => {
    const yaml = `modules:
  - id: "01"
    name: Intro
  - id: "02"
    name: Advanced`;
    const result = parse(yaml);
    expect(result).toEqual({
      modules: [
        { id: '01', name: 'Intro' },
        { id: '02', name: 'Advanced' },
      ],
    });
  });

  test('parses inline array', () => {
    const result = parse('tags: [a, b, c]');
    expect(result).toEqual({ tags: ['a', 'b', 'c'] });
  });

  test('parses empty inline array', () => {
    const result = parse('tags: []');
    expect(result).toEqual({ tags: [] });
  });

  test('strips comments', () => {
    const result = parse('key: value # this is a comment');
    expect(result).toEqual({ key: 'value' });
  });

  test('skips comment lines', () => {
    const result = parse('# comment\nkey: value\n# another');
    expect(result).toEqual({ key: 'value' });
  });

  test('handles empty input', () => {
    expect(parse('')).toBeNull();
  });

  test('returns null for whitespace-only input', () => {
    expect(parse('  \n\n')).toBeNull();
  });

  test('parses empty nested value as null', () => {
    const result = parse('key:\n  other: val');
    expect(result).toEqual({ key: { other: 'val' } });
  });

  test('parses sequence with nested mappings', () => {
    const yaml = `- item: first
  price: 10
- item: second
  price: 20`;
    const result = parse(yaml);
    expect(result).toEqual([
      { item: 'first', price: 10 },
      { item: 'second', price: 20 },
    ]);
  });

  test('handles escape sequences in double-quoted strings', () => {
    const result = parse('text: "line1\\nline2"');
    expect(result).toEqual({ text: 'line1\nline2' });
  });

  test('handles escaped quotes in double-quoted strings', () => {
    const result = parse('text: "she said \\"hello\\""');
    expect(result).toEqual({ text: 'she said "hello"' });
  });
});
