import React from 'react';

import { headingId } from '../../bun/lesson-markdown';

function extractText(children: React.ReactNode): string {
  let text = '';
  const walk = (node: React.ReactNode) => {
    if (typeof node === 'string') text += node;
    else if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object' && 'props' in node) {
      walk((node as { props: { children: React.ReactNode } }).props.children);
    }
  };
  walk(children);
  return text;
}

const headingRenderer = (level: number) =>
  function Heading({ children }: { children?: React.ReactNode }) {
    const text = extractText(children);
    const id = headingId(text);
    const Tag = `h${level}` as keyof React.JSX.IntrinsicElements;
    return <Tag id={id}>{children}</Tag>;
  };

export const components = {
  h1: headingRenderer(1),
  h2: headingRenderer(2),
  h3: headingRenderer(3),
  h4: headingRenderer(4),
  h5: headingRenderer(5),
  h6: headingRenderer(6),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="table-wrapper">
      <table>{children}</table>
    </div>
  ),
};

export function getTextOffset(
  container: HTMLElement,
  range: Range,
): { start: number; end: number } | null {
  try {
    const offsetOf = (node: Node, offset: number): number => {
      const r = document.createRange();
      r.setStart(container, 0);
      r.setEnd(node, offset);
      return r.toString().length;
    };
    const a = offsetOf(range.startContainer, range.startOffset);
    const b = offsetOf(range.endContainer, range.endOffset);
    return { start: Math.min(a, b), end: Math.max(a, b) };
  } catch {
    return null;
  }
}
