import { describe, expect, test } from 'bun:test';
import { rehypeHighlightText } from '../../mainview/components/rehype-highlight-text';
import type { Highlight } from '../../bun/types';

function mkHighlight(id: string, text: string, color: string): Highlight {
  return {
    id,
    courseID: 'test',
    moduleID: 1,
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

function element(tagName: string, children: any[], props?: Record<string, string>) {
  return { type: 'element' as const, tagName, children, properties: props };
}

function rootNode(children: any[]) {
  return { type: 'root' as const, children };
}

function callPlugin(tree: any, highlights: Highlight[]) {
  const fn = rehypeHighlightText(highlights);
  fn(tree as any);
}

describe('rehypeHighlightText', () => {
  test('no highlights leaves tree unchanged', () => {
    const tree = rootNode([element('p', [textNode('Hello world')])]);
    callPlugin(tree, []);
    expect(tree.children[0].children[0].value).toBe('Hello world');
  });

  test('highlights matching text wraps in mark', () => {
    const tree = rootNode([element('p', [textNode('Hello world')])]);
    callPlugin(tree, [mkHighlight('1', 'world', 'yellow')]);
    const pChildren = tree.children[0].children;
    expect(pChildren.length).toBe(2);
    expect(pChildren[0].value).toBe('Hello ');
    expect(pChildren[1].tagName).toBe('mark');
    expect(pChildren[1].children[0].value).toBe('world');
  });

  test('highlight with no match leaves text unchanged', () => {
    const tree = rootNode([element('p', [textNode('Hello world')])]);
    callPlugin(tree, [mkHighlight('1', 'nomatch', 'blue')]);
    expect(tree.children[0].children[0].value).toBe('Hello world');
  });

  test('skips pre and code blocks', () => {
    const tree = rootNode([element('pre', [element('code', [textNode('code here')])])]);
    callPlugin(tree, [mkHighlight('1', 'code', 'yellow')]);
    const code = tree.children[0].children[0].children[0];
    expect(code.value).toBe('code here');
  });

  test('multiple highlights in same text node', () => {
    const tree = rootNode([element('p', [textNode('Hello beautiful world')])]);
    callPlugin(tree, [mkHighlight('1', 'Hello', 'yellow'), mkHighlight('2', 'world', 'blue')]);
    const pChildren = tree.children[0].children;
    expect(pChildren.length).toBeGreaterThanOrEqual(3);
  });

  test('handles empty tree gracefully', () => {
    const tree = rootNode([]);
    callPlugin(tree, [mkHighlight('1', 'test', 'yellow')]);
    expect(tree.children).toHaveLength(0);
  });

  test('handles tree with no children property', () => {
    const fn = rehypeHighlightText([mkHighlight('1', 'test', 'yellow')]);
    expect(() => fn(null as any)).not.toThrow();
    expect(() => fn(undefined as any)).not.toThrow();
    expect(() => fn('string' as any)).not.toThrow();
    expect(() => fn(42 as any)).not.toThrow();
  });

  test('preserves existing mark elements', () => {
    const tree = rootNode([
      element('p', [element('mark', [textNode('existing')]), textNode(' test')]),
    ]);
    callPlugin(tree, [mkHighlight('1', 'test', 'yellow')]);
    const pChildren = tree.children[0].children;
    expect(pChildren[0].tagName).toBe('mark');
    expect(pChildren[0].children[0].value).toBe('existing');
  });

  test('nested elements recurse correctly', () => {
    const tree = rootNode([
      element('p', [element('strong', [textNode('bold text')]), textNode(' here')]),
    ]);
    callPlugin(tree, [mkHighlight('1', 'bold text', 'green')]);
    const strong = tree.children[0].children[0];
    expect(strong.tagName).toBe('strong');
    expect(strong.children.length).toBe(1);
    expect(strong.children[0].tagName).toBe('mark');
  });

  test('highlight at start of text', () => {
    const tree = rootNode([element('p', [textNode('Hello world')])]);
    callPlugin(tree, [mkHighlight('1', 'Hello', 'yellow')]);
    const pChildren = tree.children[0].children;
    expect(pChildren[0].tagName).toBe('mark');
    expect(pChildren[0].children[0].value).toBe('Hello');
  });

  test('highlight at end of text', () => {
    const tree = rootNode([element('p', [textNode('Hello world')])]);
    callPlugin(tree, [mkHighlight('1', 'world', 'yellow')]);
    const pChildren = tree.children[0].children;
    expect(pChildren[1].tagName).toBe('mark');
    expect(pChildren[1].children[0].value).toBe('world');
  });
});
