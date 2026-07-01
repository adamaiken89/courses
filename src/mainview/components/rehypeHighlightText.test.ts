import { describe, expect, test } from 'bun:test';

import type { Highlight } from '../../bun/types';
import type { HastElement, HastNode, HastRoot } from './rehypeHighlightText';
import { rehypeHighlightText } from './rehypeHighlightText';
function mkHighlight(id: string, text: string, color: string): Highlight {
  return {
    id,
    courseID: 'test',
    moduleID: '01',
    selectedText: text,
    startOffset: 0,
    endOffset: text.length,
    color,
    createdAt: new Date().toISOString(),
  };
}

function textNode(value: string) {
  return { type: 'text' as const, value };
}

function element(
  tagName: string,
  children: HastNode[],
  props?: Record<string, string>,
): HastElement {
  return { type: 'element' as const, tagName, children, properties: props };
}

function rootNode(children: HastNode[]): HastRoot {
  return { type: 'root' as const, children };
}

function asEl(node: HastNode): HastElement {
  return node as HastElement;
}

function textVal(node: HastNode): string {
  return (node as { value: string }).value;
}

function callPlugin(tree: HastRoot, highlights: Highlight[]) {
  const fn = rehypeHighlightText(highlights);
  fn(tree);
}

describe('rehypeHighlightText', () => {
  test('no highlights leaves tree unchanged', () => {
    const tree = rootNode([element('p', [textNode('Hello world')])]);
    callPlugin(tree, []);
    expect(textVal(asEl(tree.children[0]).children[0])).toBe('Hello world');
  });

  test('highlights matching text wraps in mark', () => {
    const tree = rootNode([element('p', [textNode('Hello world')])]);
    callPlugin(tree, [mkHighlight('1', 'world', 'yellow')]);
    const pChildren = asEl(tree.children[0]).children;
    expect(pChildren.length).toBe(2);
    expect(textVal(pChildren[0])).toBe('Hello ');
    expect(asEl(pChildren[1]).tagName).toBe('mark');
    expect(textVal(asEl(pChildren[1]).children[0])).toBe('world');
  });

  test('highlight with no match leaves text unchanged', () => {
    const tree = rootNode([element('p', [textNode('Hello world')])]);
    callPlugin(tree, [mkHighlight('1', 'nomatch', 'blue')]);
    expect(textVal(asEl(tree.children[0]).children[0])).toBe('Hello world');
  });

  test('skips pre and code blocks', () => {
    const tree = rootNode([element('pre', [element('code', [textNode('code here')])])]);
    callPlugin(tree, [mkHighlight('1', 'code', 'yellow')]);
    const code = asEl(asEl(tree.children[0]).children[0]).children[0];
    expect(textVal(code)).toBe('code here');
  });

  test('multiple highlights in same text node', () => {
    const tree = rootNode([element('p', [textNode('Hello beautiful world')])]);
    callPlugin(tree, [mkHighlight('1', 'Hello', 'yellow'), mkHighlight('2', 'world', 'blue')]);
    const pChildren = asEl(tree.children[0]).children;
    expect(pChildren.length).toBeGreaterThanOrEqual(3);
  });

  test('handles empty tree gracefully', () => {
    const tree = rootNode([]);
    callPlugin(tree, [mkHighlight('1', 'test', 'yellow')]);
    expect(tree.children).toHaveLength(0);
  });

  test('handles tree with no children property', () => {
    const fn = rehypeHighlightText([mkHighlight('1', 'test', 'yellow')]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => fn(null as any)).not.toThrow();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => fn(undefined as any)).not.toThrow();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => fn('string' as any)).not.toThrow();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => fn(42 as any)).not.toThrow();
  });

  test('preserves existing mark elements', () => {
    const tree = rootNode([
      element('p', [element('mark', [textNode('existing')]), textNode(' test')]),
    ]);
    callPlugin(tree, [mkHighlight('1', 'test', 'yellow')]);
    const pChildren = asEl(tree.children[0]).children;
    expect(asEl(pChildren[0]).tagName).toBe('mark');
    expect(textVal(asEl(pChildren[0]).children[0])).toBe('existing');
  });

  test('nested elements recurse correctly', () => {
    const tree = rootNode([
      element('p', [element('strong', [textNode('bold text')]), textNode(' here')]),
    ]);
    callPlugin(tree, [mkHighlight('1', 'bold text', 'green')]);
    const strong = asEl(asEl(tree.children[0]).children[0]);
    expect(strong.tagName).toBe('strong');
    expect(strong.children.length).toBe(1);
    expect(asEl(strong.children[0]).tagName).toBe('mark');
  });

  test('highlight at start of text', () => {
    const tree = rootNode([element('p', [textNode('Hello world')])]);
    callPlugin(tree, [mkHighlight('1', 'Hello', 'yellow')]);
    const pChildren = asEl(tree.children[0]).children;
    expect(asEl(pChildren[0]).tagName).toBe('mark');
    expect(textVal(asEl(pChildren[0]).children[0])).toBe('Hello');
  });

  test('highlight at end of text', () => {
    const tree = rootNode([element('p', [textNode('Hello world')])]);
    callPlugin(tree, [mkHighlight('1', 'world', 'yellow')]);
    const pChildren = asEl(tree.children[0]).children;
    expect(asEl(pChildren[1]).tagName).toBe('mark');
    expect(textVal(asEl(pChildren[1]).children[0])).toBe('world');
  });
});
