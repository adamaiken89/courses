import type { Highlight } from '../../bun/types';

type HastText = { type: 'text'; value: string };
export type HastElement = {
  type: 'element';
  tagName: string;
  properties?: Record<string, string>;
  children: HastNode[];
};
export type HastRoot = { type: 'root'; children: HastNode[] };
export type HastNode = HastText | HastElement | HastRoot | { type: string; [key: string]: unknown };

export const HIGHLIGHT_COLORS: Record<string, string> = {
  yellow: '#facc15',
  green: '#4ade80',
  blue: '#60a5fa',
  pink: '#f472b6',
  orange: '#fb923c',
  purple: '#c084fc',
  cyan: '#22d3ee',
  red: '#f87171',
  note: '#ef4444',
};

function splitText(text: string, highlights: Highlight[]): HastNode[] {
  for (const h of highlights) {
    const trimmed = h.selectedText.trim();
    const idx = text.indexOf(trimmed);
    if (idx === -1) continue;

    const nodes: HastNode[] = [];
    if (idx > 0) nodes.push(...splitText(text.slice(0, idx), highlights));
    const isNote = h.color === 'note';
    nodes.push({
      type: 'element',
      tagName: 'mark',
      properties: {
        style: isNote
          ? `color: #ef4444; text-decoration: underline; text-decoration-color: #ef4444; text-underline-offset: 3px; cursor: pointer`
          : `background-color: ${HIGHLIGHT_COLORS[h.color] || h.color}; color: #1f2937; border-radius: 2px; padding: 0 2px`,
        dataHighlightId: h.id,
        ...(isNote ? { dataNoteId: h.id } : {}),
      },
      children: [{ type: 'text', value: trimmed }],
    });
    const remaining = text.slice(idx + trimmed.length);
    if (remaining) nodes.push(...splitText(remaining, highlights));
    return nodes;
  }
  return [{ type: 'text', value: text }];
}

function transformTree(node: HastElement, highlights: Highlight[], skip = false): void {
  if (!node?.children || !Array.isArray(node.children)) return;

  const newChildren: HastNode[] = [];
  for (const child of node.children) {
    if (child == null || typeof child !== 'object') {
      newChildren.push(child);
      continue;
    }
    if (child.type === 'text' && 'value' in child && typeof child.value === 'string' && !skip) {
      const parts = splitText(child.value, highlights);
      newChildren.push(...parts);
    } else {
      const deeper =
        skip ||
        (child as HastElement).tagName === 'mark' ||
        (child as HastElement).tagName === 'pre' ||
        (child as HastElement).tagName === 'code';
      if ('children' in child && child.children != null) {
        transformTree(child as HastElement, highlights, deeper);
      }
      newChildren.push(child);
    }
  }
  node.children = newChildren;
}

export function rehypeHighlightText(highlights: Highlight[]) {
  return (tree: HastNode) => {
    if (highlights.length === 0) return;
    if (tree && typeof tree === 'object' && 'children' in tree) {
      transformTree(tree as HastElement, highlights);
    }
  };
}
