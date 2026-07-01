import { unified } from 'unified';
import remarkParse from 'remark-parse';
import type { Root, Content, Heading } from 'mdast';
import { toString } from 'mdast-util-to-string';
import type { Section } from './types';

export interface MetaField {
  key: string;
  icon: string;
  label: string;
  value: string;
}

export interface LessonMarkdownResult {
  h1: string;
  meta: MetaField[];
  sections: Section[];
  bodyContent: string;
}

const META_FIELDS: Record<string, { icon: string; label: string }> = {
  'est. study time': { icon: '⏱', label: 'Study Time' },
  language: { icon: '🌐', label: 'Language' },
  description: { icon: '📝', label: 'Description' },
  framework: { icon: '🔧', label: 'Framework' },
};

function extractText(node: Content): string {
  if (node.type === 'text' || node.type === 'inlineCode') return (node as { value: string }).value;
  if ('children' in node) {
    return (node.children as Content[]).map(extractText).join('');
  }
  return '';
}

export function headingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[:,()]/g, '')
    .replace(/[^a-z0-9-]/g, '');
}

export function processLessonMarkdown(markdown: string): LessonMarkdownResult {
  const tree = unified().use(remarkParse).parse(markdown) as Root;

  let h1 = '';
  const meta: MetaField[] = [];
  const sections: Section[] = [];
  let headerEndLine = 0;

  const levelStack: number[] = [];
  const idStack: string[] = [];
  let pastH1 = false;
  let metaDone = false;

  for (const child of tree.children) {
    if (child.type === 'heading') {
      const h = child as Heading;
      const headingText = extractText(h);

      if (h.depth === 1) {
        h1 = headingText;
        pastH1 = true;
        if (h.position) headerEndLine = Math.max(headerEndLine, h.position.end.line);
        const id = headingId(headingText);
        levelStack.push(h.depth);
        idStack.push(id);
        sections.push({ id, heading: headingText, level: h.depth, parentID: null });
        continue;
      }

      while (levelStack.length && levelStack[levelStack.length - 1] >= h.depth) {
        levelStack.pop();
        idStack.pop();
      }
      const parentID = idStack.length > 0 ? idStack[idStack.length - 1] : null;
      levelStack.push(h.depth);
      const id = headingId(headingText);
      idStack.push(id);
      sections.push({ id, heading: headingText, level: h.depth, parentID });

      if (h.depth === 2 && pastH1) metaDone = true;
      continue;
    }

    if (pastH1 && !metaDone && child.type === 'paragraph') {
      const text = toString(child);
      for (const line of text.split('\n')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) continue;
        const label = line.slice(0, colonIdx).trim().toLowerCase();
        const field = META_FIELDS[label];
        if (field) {
          meta.push({
            key: label,
            icon: field.icon,
            label: field.label,
            value: line.slice(colonIdx + 1).trim(),
          });
          if (child.position) headerEndLine = Math.max(headerEndLine, child.position.end.line);
        }
      }
    }
  }

  let bodyContent = markdown;
  if (headerEndLine > 0) {
    const lines = markdown.split('\n');
    let end = headerEndLine;
    while (end < lines.length && !lines[end].trim()) end++;
    bodyContent = lines.slice(end).join('\n');
  }

  return { h1, meta, sections, bodyContent };
}
