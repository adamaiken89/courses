import { fireEvent, render } from '@testing-library/react';
import { describe, expect, mock,test } from 'bun:test';

import type { Bookmark, Section } from '../../../bun/types';
import SectionsPanel from './SectionsPanel';

function makeSection(id: string, heading: string, level: number): Section {
  return { id, heading, level, parentID: 'root' };
}

const defaultSections: Section[] = [
  makeSection('intro', 'Introduction', 1),
  makeSection('body', 'Body Content', 2),
  makeSection('conclusion', 'Conclusion', 1),
];

const defaultBookmarks: Bookmark[] = [
  {
    id: 'bm1',
    courseID: 'c1',
    moduleID: '01',
    sectionID: 'body',
    title: 'Body Content',
    scrollPosition: 0,
    createdAt: '2024-01-01',
  },
];

describe('SectionsPanel', () => {
  test('renders section headings', () => {
    const { getByText } = render(
      <SectionsPanel
        sections={defaultSections}
        visibleSection={null}
        bookmarks={[]}
        onScrollToSection={() => {}}
        onToggleSectionBookmark={() => {}}
        onClose={() => {}}
      />,
    );
    expect(getByText('Introduction')).toBeInTheDocument();
    expect(getByText('Body Content')).toBeInTheDocument();
    expect(getByText('Conclusion')).toBeInTheDocument();
  });

  test('highlights active section', () => {
    const { getByText } = render(
      <SectionsPanel
        sections={defaultSections}
        visibleSection="body"
        bookmarks={[]}
        onScrollToSection={() => {}}
        onToggleSectionBookmark={() => {}}
        onClose={() => {}}
      />,
    );
    const bodyBtn = getByText('Body Content').closest('button');
    expect(bodyBtn).toBeTruthy();
  });

  test('shows bookmark star for bookmarked sections', () => {
    const { getAllByText } = render(
      <SectionsPanel
        sections={defaultSections}
        visibleSection={null}
        bookmarks={defaultBookmarks}
        onScrollToSection={() => {}}
        onToggleSectionBookmark={() => {}}
        onClose={() => {}}
      />,
    );
    const starIcons = getAllByText('★');
    expect(starIcons.length).toBe(1);
  });

  test('clicking section calls onScrollToSection', () => {
    const onScroll = mock(() => {});
    const { getByText } = render(
      <SectionsPanel
        sections={defaultSections}
        visibleSection={null}
        bookmarks={[]}
        onScrollToSection={onScroll}
        onToggleSectionBookmark={() => {}}
        onClose={() => {}}
      />,
    );
    fireEvent.click(getByText('Introduction'));
    expect(onScroll).toHaveBeenCalledTimes(1);
    expect(onScroll).toHaveBeenCalledWith('intro');
  });

  test('clicking bookmark toggles bookmark', () => {
    const onToggle = mock(() => {});
    const { getByText } = render(
      <SectionsPanel
        sections={defaultSections}
        visibleSection={null}
        bookmarks={defaultBookmarks}
        onScrollToSection={() => {}}
        onToggleSectionBookmark={onToggle}
        onClose={() => {}}
      />,
    );
    fireEvent.click(getByText('★'));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('body', true, 'Body Content');
  });

  test('clicking close calls onClose', () => {
    const onClose = mock(() => {});
    const { getByText } = render(
      <SectionsPanel
        sections={defaultSections}
        visibleSection={null}
        bookmarks={[]}
        onScrollToSection={() => {}}
        onToggleSectionBookmark={() => {}}
        onClose={onClose}
      />,
    );
    fireEvent.click(getByText('→'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('shows empty state when no sections', () => {
    const { container } = render(
      <SectionsPanel
        sections={[]}
        visibleSection={null}
        bookmarks={[]}
        onScrollToSection={() => {}}
        onToggleSectionBookmark={() => {}}
        onClose={() => {}}
      />,
    );
    expect(container.querySelector('[data-section-id]')).toBeNull();
  });
});
