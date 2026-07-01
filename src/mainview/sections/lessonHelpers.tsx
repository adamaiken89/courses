import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { headingId } from '../../bun/lessonMarkdown';
import MermaidDiagram from '../components/MermaidDiagram';

function CodeBlockWithCopy({ children }: { children?: React.ReactNode }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = extractText(children);
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative group">
      <pre>{children}</pre>
      <button
        onClick={() => void handleCopy()}
        className="absolute top-8 right-2 px-2 py-1 text-xs rounded bg-gray-700/80 text-gray-300 hover:bg-gray-600 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
      >
        {copied ? t('selection.copied') : t('lesson.copy')}
      </button>
    </div>
  );
}

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
  pre: ({ children }: { children?: React.ReactNode }) => (
    <CodeBlockWithCopy>{children}</CodeBlockWithCopy>
  ),
  code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
    if (className?.includes('language-mermaid')) {
      const code = typeof children === 'string' ? children : String(children);
      return <MermaidDiagram code={code.replace(/\n$/, '')} />;
    }
    return <code className={className}>{children}</code>;
  },
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
