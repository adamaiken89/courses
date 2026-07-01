import { describe, expect, test } from 'bun:test';

import { rehypeSearchText } from './rehypeSearchText';

type HastNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, string>;
  children?: HastNode[];
  value?: string;
};

describe('rehypeSearchText', () => {
  test('returns empty handler for empty query', () => {
    const handler = rehypeSearchText('');
    expect(handler).toBeInstanceOf(Function);
  });

  test('wraps matching text in mark elements', () => {
    const tree: HastNode = {
      type: 'root',
      children: [{ type: 'text', value: 'hello world hello' }],
    };
    const handler = rehypeSearchText('hello');
    handler(tree);
    const children = tree.children!;
    expect(children).toHaveLength(5);
    expect(children[1].tagName).toBe('mark');
    expect(children[1].children?.[0]).toEqual({ type: 'text', value: 'hello' });
    expect(children[3].tagName).toBe('mark');
    expect(children[3].children?.[0]).toEqual({ type: 'text', value: 'hello' });
  });

  test('ignores content inside pre tags', () => {
    const tree: HastNode = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'pre',
          properties: {},
          children: [{ type: 'text', value: 'hello' }],
        },
      ],
    };
    const handler = rehypeSearchText('hello');
    handler(tree);
    const preChildren = (tree.children![0] as HastNode).children!;
    expect(preChildren).toHaveLength(1);
    expect(preChildren[0].type).toBe('text');
  });

  test('ignores content inside code tags', () => {
    const tree: HastNode = {
      type: 'root',
      children: [
        { type: 'element', tagName: 'code', children: [{ type: 'text', value: 'hello' }] },
      ],
    };
    const handler = rehypeSearchText('hello');
    handler(tree);
    const codeChildren = (tree.children![0] as HastNode).children!;
    expect(codeChildren).toHaveLength(1);
    expect(codeChildren[0].type).toBe('text');
  });

  test('handles case insensitive matching', () => {
    const tree: HastNode = {
      type: 'root',
      children: [{ type: 'text', value: 'HELLO World' }],
    };
    const handler = rehypeSearchText('hello');
    handler(tree);
    const children = tree.children!;
    expect(children[1].tagName).toBe('mark');
  });

  test('no match returns unchanged text', () => {
    const tree: HastNode = {
      type: 'root',
      children: [{ type: 'text', value: 'no match here' }],
    };
    const handler = rehypeSearchText('zzzz');
    handler(tree);
    expect(tree.children).toHaveLength(1);
    expect((tree.children![0] as HastNode).type).toBe('text');
  });
});
