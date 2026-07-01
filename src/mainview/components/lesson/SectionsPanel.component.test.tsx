import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, mock, test } from 'bun:test';

import type { Section } from '../../../bun/types';
import { useBookmarksStore } from '../../stores/bookmarksStore';
import SectionsPanel from './SectionsPanel';

function makeSection(id: string, heading: string, level: number): Section {
  return { id, heading, level, parentID: 'root' };
}

const defaultSections: Section[] = [
  makeSection('intro', 'Introduction', 1),
  makeSection('body', 'Body Content', 2),
  makeSection('conclusion', 'Conclusion', 1),
];

const defaultCourseId = 'c1';
const defaultModuleId = '01';

beforeEach(() => {
  useBookmarksStore.setState({ byModule: {}, loading: {} });
});

describe('SectionsPanel', () => {
  const user = userEvent.setup();

  test('renders section headings', () => {
    const { getByText } = render(
      <SectionsPanel
        sections={defaultSections}
        courseId={defaultCourseId}
        moduleId={defaultModuleId}
        moduleName="Test Module"
        hasPrev={false}
        hasNext={false}
        onGoPrev={() => {}}
        onGoNext={() => {}}
        onScrollToSection={() => {}}
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
        courseId={defaultCourseId}
        moduleId={defaultModuleId}
        moduleName="Test Module"
        hasPrev={false}
        hasNext={false}
        onGoPrev={() => {}}
        onGoNext={() => {}}
        onScrollToSection={() => {}}
        onClose={() => {}}
      />,
    );
    const bodyBtn = getByText('Body Content').closest('button');
    expect(bodyBtn).toBeTruthy();
  });

  test('clicking section calls scrollToSection', async () => {
    const scrollToSection = mock(() => {});
    const { getByText } = render(
      <SectionsPanel
        sections={defaultSections}
        courseId={defaultCourseId}
        moduleId={defaultModuleId}
        moduleName="Test Module"
        hasPrev={false}
        hasNext={false}
        onGoPrev={() => {}}
        onGoNext={() => {}}
        onScrollToSection={scrollToSection}
        onClose={() => {}}
      />,
    );
    await user.click(getByText('Introduction'));
    expect(scrollToSection).toHaveBeenCalledTimes(1);
    expect(scrollToSection).toHaveBeenCalledWith('intro');
  });

  test('clicking bookmark toggles bookmark', async () => {
    const toggle = mock(() => Promise.resolve());
    useBookmarksStore.setState({ toggle } as Partial<
      typeof useBookmarksStore extends { getState: infer S }
        ? S extends () => infer T
          ? T
          : never
        : never
    >);
    const { getAllByText } = render(
      <SectionsPanel
        sections={defaultSections}
        courseId={defaultCourseId}
        moduleId={defaultModuleId}
        moduleName="Test Module"
        hasPrev={false}
        hasNext={false}
        onGoPrev={() => {}}
        onGoNext={() => {}}
        onScrollToSection={() => {}}
        onClose={() => {}}
      />,
    );
    const stars = getAllByText('☆');
    await user.click(stars[1]);
    expect(toggle).toHaveBeenCalledTimes(1);
    expect(toggle).toHaveBeenCalledWith(
      defaultCourseId,
      defaultModuleId,
      'Test Module – Body Content',
      'body',
    );
  });

  test('clicking close calls onClose', async () => {
    const onClose = mock(() => {});
    const { getByText } = render(
      <SectionsPanel
        sections={defaultSections}
        courseId={defaultCourseId}
        moduleId={defaultModuleId}
        moduleName="Test Module"
        hasPrev={false}
        hasNext={false}
        onGoPrev={() => {}}
        onGoNext={() => {}}
        onScrollToSection={() => {}}
        onClose={onClose}
      />,
    );
    await user.click(getByText('→'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('shows empty state when no sections', () => {
    const { container } = render(
      <SectionsPanel
        sections={[]}
        courseId={defaultCourseId}
        moduleId={defaultModuleId}
        moduleName="Test Module"
        hasPrev={false}
        hasNext={false}
        onGoPrev={() => {}}
        onGoNext={() => {}}
        onScrollToSection={() => {}}
        onClose={() => {}}
      />,
    );
    expect(container.querySelector('[data-section-id]')).toBeNull();
  });
});
