type HastText = { type: 'text'; value: string };
type HastElement = {
  type: 'element';
  tagName: string;
  properties?: Record<string, string>;
  children: HastNode[];
};
type HastNode = HastText | HastElement | { type: string; [key: string]: unknown };

export const SEARCH_HIGHLIGHT_COLOR = '#f97316';
export const SEARCH_HIGHLIGHT_ACTIVE = '#ea580c';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitText(text: string, qlower: string): HastNode[] {
  const regex = new RegExp(`(${escapeRegExp(qlower)})`, 'gi');
  const parts = text.split(regex);
  if (parts.length <= 1) return [{ type: 'text', value: text }];

  return parts.map((part) => {
    if (part.toLowerCase() === qlower) {
      return {
        type: 'element',
        tagName: 'mark',
        properties: {
          'data-search-match': '',
          style: `background-color: rgba(249, 115, 22, 0.2); border: 2px solid #f97316; border-radius: 2px; padding: 0 1px; color: inherit;`,
        },
        children: [{ type: 'text', value: part }],
      };
    }
    return { type: 'text', value: part };
  });
}

function transformTree(node: HastElement, qlower: string, skip = false): void {
  if (!node?.children || !Array.isArray(node.children)) return;

  const newChildren: HastNode[] = [];
  for (const child of node.children) {
    if (child == null || typeof child !== 'object') {
      newChildren.push(child);
      continue;
    }
    if (child.type === 'text' && 'value' in child && typeof child.value === 'string' && !skip) {
      const parts = splitText(child.value, qlower);
      newChildren.push(...parts);
    } else {
      const deeper =
        skip ||
        (child as HastElement).tagName === 'mark' ||
        (child as HastElement).tagName === 'pre' ||
        (child as HastElement).tagName === 'code' ||
        (child as HastElement).tagName === 'svg' ||
        (child as HastElement).tagName === 'math';
      if ('children' in child && child.children != null) {
        transformTree(child as HastElement, qlower, deeper);
      }
      newChildren.push(child);
    }
  }
  node.children = newChildren;
}

export function rehypeSearchText(query: string) {
  const qlower = query.trim().toLowerCase();
  if (!qlower) return () => {};
  return (tree: HastNode) => {
    if (tree && typeof tree === 'object' && 'children' in tree) {
      transformTree(tree as HastElement, qlower);
    }
  };
}
