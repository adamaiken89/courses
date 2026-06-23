import type { Highlight } from './sidebar-types';

type HastText = { type: 'text'; value: string };
type HastElement = {
  type: 'element';
  tagName: string;
  properties?: Record<string, string>;
  children: HastNode[];
};
type HastNode = HastText | HastElement | { type: string; [key: string]: unknown };

export const HIGHLIGHT_COLORS: Record<string, string> = {
  yellow: '#facc15',
  green: '#4ade80',
  blue: '#60a5fa',
  pink: '#f472b6',
};

function splitText(text: string, highlights: Highlight[]): HastNode[] {
  for (const h of highlights) {
    const idx = text.indexOf(h.selectedText);
    if (idx === -1) continue;

    const nodes: HastNode[] = [];
    if (idx > 0) nodes.push(...splitText(text.slice(0, idx), highlights));
    nodes.push({
      type: 'element',
      tagName: 'mark',
      properties: {
        style: `background-color: ${HIGHLIGHT_COLORS[h.color] || h.color}; color: #1f2937; border-radius: 2px; padding: 0 2px`,
        dataHighlightId: h.id,
      },
      children: [{ type: 'text', value: h.selectedText }],
    });
    const remaining = text.slice(idx + h.selectedText.length);
    if (remaining) nodes.push(...splitText(remaining, highlights));
    return nodes;
  }
  return [{ type: 'text', value: text }];
}

function transformTree(node: HastElement, highlights: Highlight[], skip = false): void {
  if (!node.children) return;

  const newChildren: HastNode[] = [];
  for (const child of node.children) {
    if (child.type === 'text' && 'value' in child && typeof child.value === 'string' && !skip) {
      const parts = splitText(child.value, highlights);
      newChildren.push(...parts);
    } else {
      const deeper =
        skip ||
        (child as HastElement).tagName === 'mark' ||
        (child as HastElement).tagName === 'pre' ||
        (child as HastElement).tagName === 'code';
      if ('children' in child) transformTree(child as HastElement, highlights, deeper);
      newChildren.push(child);
    }
  }
  node.children = newChildren;
}

export function rehypeHighlightText(highlights: Highlight[]) {
  return (tree: HastElement) => {
    if (highlights.length === 0) return;
    transformTree(tree, highlights);
  };
}
