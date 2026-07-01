import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { findSectionIdForHighlight, scrollToHighlightEl } from './notesHelpers';

function makeContainer(innerHTML: string): HTMLDivElement {
  const div = document.createElement('div');
  div.innerHTML = innerHTML;
  return div;
}

describe('scrollToHighlightEl', () => {
  let container: HTMLDivElement;
  let ref: React.RefObject<HTMLDivElement | null>;

  beforeEach(() => {
    container = makeContainer('<mark data-highlight-id="h1">hello</mark>');
    document.body.appendChild(container);
    ref = { current: container };
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  test('returns false when ref has no current', () => {
    expect(scrollToHighlightEl({ current: null }, 'h1')).toBe(false);
  });

  test('returns false when element not found', () => {
    expect(scrollToHighlightEl(ref, 'nonexistent')).toBe(false);
  });

  test('returns true and scrolls container when element found', () => {
    const el = container.querySelector('mark')!;
    el.getBoundingClientRect = () => ({
      top: 200,
      left: 0,
      right: 100,
      bottom: 220,
      width: 100,
      height: 20,
      x: 0,
      y: 200,
      toJSON: () => ({}),
    });
    container.getBoundingClientRect = () => ({
      top: 50,
      left: 0,
      right: 500,
      bottom: 500,
      width: 500,
      height: 450,
      x: 0,
      y: 50,
      toJSON: () => ({}),
    });
    container.scrollTop = 0;

    const result = scrollToHighlightEl(ref, 'h1');
    expect(result).toBe(true);
    expect(container.scrollTop).toBe(200 - 50 + 0 - 60);
  });
});

describe('findSectionIdForHighlight', () => {
  let container: HTMLDivElement;

  const sections = [
    { id: 'intro', heading: 'Introduction', level: 2, parentID: null },
    { id: 'body', heading: 'Body', level: 2, parentID: null },
  ];

  beforeEach(() => {
    container = makeContainer(`
      <h2 id="intro">Introduction</h2>
      <p>Some text <mark data-highlight-id="h1">highlight</mark></p>
      <h2 id="body">Body</h2>
      <p>More text</p>
    `);
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  test('returns null when ref has no current', () => {
    expect(findSectionIdForHighlight({ current: null }, 'h1', sections)).toBeNull();
  });

  test('returns null when element not found', () => {
    const ref = { current: container };
    expect(findSectionIdForHighlight(ref, 'nonexistent', sections)).toBeNull();
  });

  test('finds section by previous sibling heading id', () => {
    const ref = { current: container };
    const result = findSectionIdForHighlight(ref, 'h1', sections);
    expect(result).toEqual({ id: 'intro', heading: 'Introduction' });
  });

  test('finds section when heading id matches in sections array', () => {
    const c2 = makeContainer(`
      <h2 id="custom-id">Custom Heading</h2>
      <p>Text <mark data-highlight-id="h2">word</mark></p>
    `);
    document.body.appendChild(c2);
    const ref = { current: c2 };
    const result = findSectionIdForHighlight(ref, 'h2', [
      { id: 'custom-id', heading: 'Custom Heading', level: 2, parentID: null },
    ]);
    expect(result).toEqual({ id: 'custom-id', heading: 'Custom Heading' });
    document.body.removeChild(c2);
  });
});
