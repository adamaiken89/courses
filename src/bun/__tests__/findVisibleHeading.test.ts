import { describe, expect, test } from 'bun:test';
import { findVisibleHeading } from '../../mainview/hooks/useLesson';
import type { Section } from '../../bun/types';

function toSections(ids: string[], level: number = 2): Section[] {
  return ids.map((id) => ({ id, heading: id, level, parentID: null }));
}

function makeContainer(
  headings: { id: string; top: number }[],
  opts?: { scrollTop?: number; clientHeight?: number; scrollHeight?: number; rectTop?: number },
): HTMLElement {
  const div = document.createElement('div');
  Object.defineProperty(div, 'getBoundingClientRect', {
    value: () => ({
      top: opts?.rectTop ?? 0,
      bottom: 1000,
      left: 0,
      right: 800,
      width: 800,
      height: 1000,
      x: 0,
      y: opts?.rectTop ?? 0,
      toJSON: () => {},
    }),
  });
  Object.defineProperty(div, 'scrollTop', {
    value: opts?.scrollTop ?? 0,
    writable: true,
  });
  Object.defineProperty(div, 'clientHeight', {
    value: opts?.clientHeight ?? 1000,
  });
  Object.defineProperty(div, 'scrollHeight', {
    value: opts?.scrollHeight ?? 3000,
  });

  for (const h of headings) {
    const el = document.createElement('h2');
    el.id = h.id;
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({
        top: h.top,
        bottom: h.top + 30,
        left: 0,
        right: 800,
        width: 800,
        height: 30,
        x: 0,
        y: h.top,
        toJSON: () => {},
      }),
    });
    div.appendChild(el);
  }

  return div;
}

describe('findVisibleHeading', () => {
  test('returns null when no headings exist', () => {
    const container = makeContainer([]);
    expect(findVisibleHeading(container, [])).toBeNull();
  });

  test('returns null when all headings are below threshold', () => {
    const container = makeContainer([
      { id: 'section-a', top: 200 },
      { id: 'section-b', top: 400 },
    ]);
    expect(findVisibleHeading(container, toSections(['section-a', 'section-b']))).toBeNull();
  });

  test('returns heading above threshold', () => {
    const container = makeContainer([
      { id: 'section-a', top: 50 },
      { id: 'section-b', top: 200 },
    ]);
    expect(findVisibleHeading(container, toSections(['section-a', 'section-b']))).toBe('section-a');
  });

  test('returns last heading when multiple are above threshold (same level)', () => {
    const container = makeContainer([
      { id: 'section-a', top: 10 },
      { id: 'section-b', top: 50 },
      { id: 'section-c', top: 100 },
    ]);
    expect(findVisibleHeading(container, toSections(['section-a', 'section-b', 'section-c']))).toBe(
      'section-c',
    );
  });

  test('accounts for container offset from viewport top', () => {
    const container = makeContainer(
      [
        { id: 'section-a', top: 200 },
        { id: 'section-b', top: 250 },
      ],
      { rectTop: 100 },
    );
    expect(findVisibleHeading(container, toSections(['section-a', 'section-b']))).toBe('section-a');
  });

  test('returns last section when scrolled to bottom', () => {
    const container = makeContainer(
      [
        { id: 'section-a', top: -100 },
        { id: 'section-b', top: -50 },
      ],
      { scrollTop: 2000, clientHeight: 500, scrollHeight: 2500 },
    );
    expect(findVisibleHeading(container, toSections(['section-a', 'section-b']))).toBe('section-b');
  });

  test('forces last section when at bottom even if headings above threshold', () => {
    const container = makeContainer(
      [
        { id: 'section-a', top: -500 },
        { id: 'section-b', top: -300 },
        { id: 'section-c', top: 50 },
      ],
      { scrollTop: 2000, clientHeight: 500, scrollHeight: 2500 },
    );
    const sections = [
      { id: 'section-a', heading: 'A', level: 2, parentID: null },
      { id: 'section-b', heading: 'B', level: 2, parentID: null },
      { id: 'section-c', heading: 'C', level: 2, parentID: null },
    ];
    expect(findVisibleHeading(container, sections)).toBe('section-c');
  });

  test('does not force last section when not at bottom', () => {
    const container = makeContainer(
      [
        { id: 'section-a', top: -100 },
        { id: 'section-b', top: 200 },
      ],
      { scrollTop: 100, clientHeight: 500, scrollHeight: 2500 },
    );
    expect(findVisibleHeading(container, toSections(['section-a', 'section-b']))).toBe('section-a');
  });

  test('returns heading at exact threshold boundary', () => {
    const container = makeContainer([{ id: 'section-a', top: 120 }], { rectTop: 0 });
    expect(findVisibleHeading(container, toSections(['section-a']))).toBe('section-a');
  });

  test('returns null when heading is 1px below threshold', () => {
    const container = makeContainer([{ id: 'section-a', top: 121 }], { rectTop: 0 });
    expect(findVisibleHeading(container, toSections(['section-a']))).toBeNull();
  });

  test('works with mixed h1-h6 elements', () => {
    const div = document.createElement('div');
    Object.defineProperty(div, 'getBoundingClientRect', {
      value: () => ({
        top: 0,
        bottom: 1000,
        left: 0,
        right: 800,
        width: 800,
        height: 1000,
        x: 0,
        y: 0,
        toJSON: () => {},
      }),
    });
    Object.defineProperty(div, 'scrollTop', { value: 0, writable: true });
    Object.defineProperty(div, 'clientHeight', { value: 1000 });
    Object.defineProperty(div, 'scrollHeight', { value: 3000 });

    const h1 = document.createElement('h1');
    h1.id = 'title';
    Object.defineProperty(h1, 'getBoundingClientRect', {
      value: () => ({
        top: 10,
        bottom: 40,
        left: 0,
        right: 800,
        width: 800,
        height: 30,
        x: 0,
        y: 10,
        toJSON: () => {},
      }),
    });
    div.appendChild(h1);

    const h3 = document.createElement('h3');
    h3.id = 'sub';
    Object.defineProperty(h3, 'getBoundingClientRect', {
      value: () => ({
        top: 80,
        bottom: 110,
        left: 0,
        right: 800,
        width: 800,
        height: 30,
        x: 0,
        y: 80,
        toJSON: () => {},
      }),
    });
    div.appendChild(h3);

    expect(
      findVisibleHeading(div, [
        { id: 'title', heading: 'Title', level: 1, parentID: null },
        { id: 'sub', heading: 'Sub', level: 3, parentID: null },
      ]),
    ).toBe('sub');
  });

  test('returns deepest heading when multiple levels are above threshold', () => {
    const container = makeContainer([
      { id: 'chapter', top: 10 },
      { id: 'section', top: 50 },
      { id: 'subsection', top: 100 },
    ]);
    expect(
      findVisibleHeading(container, [
        { id: 'chapter', heading: 'Chapter', level: 1, parentID: null },
        { id: 'section', heading: 'Section', level: 2, parentID: 'chapter' },
        { id: 'subsection', heading: 'Subsection', level: 3, parentID: 'section' },
      ]),
    ).toBe('subsection');
  });

  test('prefers deeper heading over later shallower heading', () => {
    const container = makeContainer([
      { id: 'deep', top: 10 },
      { id: 'shallow', top: 100 },
    ]);
    expect(
      findVisibleHeading(container, [
        { id: 'deep', heading: 'Deep Section', level: 3, parentID: null },
        { id: 'shallow', heading: 'Shallow Section', level: 1, parentID: null },
      ]),
    ).toBe('deep');
  });
});
