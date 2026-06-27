import { headingId } from '../../../bun/lesson-markdown';
import type { Section } from '../../../bun/types';

export function scrollToHighlightEl(
  contentRef: React.RefObject<HTMLDivElement | null>,
  highlightId: string,
) {
  const container = contentRef.current;
  if (!container) return false;
  const el = container.querySelector(`mark[data-highlight-id="${highlightId}"]`);
  if (!el) return false;
  const offset =
    el.getBoundingClientRect().top -
    container.getBoundingClientRect().top +
    container.scrollTop -
    60;
  container.scrollTop = offset;
  return true;
}

export function findSectionIdForHighlight(
  contentRef: React.RefObject<HTMLDivElement | null>,
  highlightId: string,
  sections: Section[],
): { id: string; heading: string } | null {
  const container = contentRef.current;
  if (!container) return null;
  const el = container.querySelector(`mark[data-highlight-id="${highlightId}"]`);
  if (!el) return null;
  let node: HTMLElement | null = el.parentElement;
  while (node && node !== container) {
    const prevSibling = node.previousElementSibling as HTMLElement | null;
    if (prevSibling && /^H[1-6]$/.test(prevSibling.tagName)) {
      const hId = prevSibling.id;
      const heading = prevSibling.textContent?.trim() ?? '';
      if (hId) {
        const sec = sections.find((s) => s.id === hId);
        return { id: hId, heading: sec?.heading ?? heading };
      }
      if (heading) {
        const sec = sections.find((s) => s.heading === heading);
        return { id: sec?.id ?? headingId(heading), heading };
      }
    }
    if (!prevSibling) {
      node = node.parentElement;
    } else {
      let child: Element | null = prevSibling;
      let last: Element = child;
      while (child) {
        last = child;
        child = child.lastElementChild;
      }
      if (/^H[1-6]$/.test(last.tagName)) {
        const hId = (last as HTMLElement).id;
        const heading = last.textContent?.trim() ?? '';
        if (hId) {
          const sec = sections.find((s) => s.id === hId);
          return { id: hId, heading: sec?.heading ?? heading };
        }
        if (heading) {
          const sec = sections.find((s) => s.heading === heading);
          return { id: sec?.id ?? headingId(heading), heading };
        }
      }
      node = prevSibling;
    }
  }
  return null;
}
