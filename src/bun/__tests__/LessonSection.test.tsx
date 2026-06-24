import { describe, expect, test, afterEach } from 'bun:test';
import { render, waitFor } from '@testing-library/react';
import LessonSection from '../../mainview/sections/LessonSection';
import { mockFetch, restoreFetch } from './mock-fetch';

const mockContent = `# Introduction

Welcome to the lesson.

## Chapter 1

First chapter content.

### Section 1.1

Details here.

## Chapter 2

Second chapter.`;

const defaultProps = {
  courseId: 'test',
  courseName: 'Test Course',
  module: { id: 1, name: 'Intro Module', timeHours: 2, prerequisites: [], topics: [] },
  content: '',
  loading: true,
  sections: [],
  visibleSection: null,
  isCompleted: false,
  contentRef: { current: null } as unknown as React.RefObject<HTMLDivElement>,
  scrollToSection: () => {},
  handleScroll: () => {},
  handleToggleCompleted: async () => {},
  bookmarks: [],
  highlights: [],
  addHighlight: async () => {},
  onToggleBookmark: async () => {},
  showTools: false,
  showPomodoro: false,
  setShowTools: () => {},
  showSections: false,
  onToggleSections: () => {},
};

afterEach(restoreFetch);

function mockAll(opts?: { content?: string }) {
  mockFetch({
    '/api/storage/bookmarks/module': [],
    '/api/storage/highlights': [],
    '/lesson': opts?.content ? { content: opts.content } : { content: '' },
    '/sections': [],
    '/notes': [],
  });
}

describe('LessonSection snapshots', () => {
  test('loading state', () => {
    mockAll();
    const { container } = render(<LessonSection {...defaultProps} />);
    expect(container.innerHTML).toMatchSnapshot();
  });

  test('content loaded', async () => {
    mockAll({ content: mockContent });
    const { container } = render(
      <LessonSection {...defaultProps} loading={false} content={mockContent} />,
    );
    await waitFor(() => expect(container.textContent).toContain('Introduction'));
    expect(container.innerHTML).toMatchSnapshot();
  });
});
