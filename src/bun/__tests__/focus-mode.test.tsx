import { describe, expect, test, afterEach } from 'bun:test';
import { render } from '@testing-library/react';
import LessonSection from '../../mainview/sections/LessonSection';
import { useSettingsStore } from '../../mainview/stores/settingsStore';
import { mockFetch, restoreFetch } from './mock-fetch';

const mockContent = `# Introduction

Welcome to the lesson.

Est. study time: 2h
Language: en

## Chapter 1

First chapter content.`;

const defaultProps = {
  courseId: 'test',
  courseName: 'Test Course',
  module: { id: 1, name: 'Intro Module', timeHours: 2, prerequisites: [], topics: [] },
  content: mockContent,
  loading: false,
  sections: [{ id: 'chapter-1', heading: 'Chapter 1', level: 2, parentID: null }],
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

afterEach(() => {
  restoreFetch();
  useSettingsStore.setState({ focusMode: false });
});

function mockAll() {
  mockFetch({
    '/api/storage/bookmarks/module': [],
    '/api/storage/highlights': [],
  });
}

describe('Focus mode', () => {
  test('hides meta block when enabled', () => {
    mockAll();
    useSettingsStore.setState({ focusMode: true });
    const { container } = render(<LessonSection {...defaultProps} />);
    expect(container.querySelector('.lesson-meta')).toBeNull();
  });

  test('shows meta block when disabled', () => {
    mockAll();
    useSettingsStore.setState({ focusMode: false });
    const { container } = render(<LessonSection {...defaultProps} />);
    expect(container.querySelector('.lesson-meta')).not.toBeNull();
  });

  test('hides mark as complete button when enabled', () => {
    mockAll();
    useSettingsStore.setState({ focusMode: true });
    const { container } = render(<LessonSection {...defaultProps} />);
    expect(container.querySelector('button.w-full')).toBeNull();
  });

  test('shows mark as complete button when disabled', () => {
    mockAll();
    useSettingsStore.setState({ focusMode: false });
    const { container } = render(<LessonSection {...defaultProps} />);
    expect(container.querySelector('button.w-full')).not.toBeNull();
  });

  test('hides study tools sidebar when enabled', () => {
    mockAll();
    useSettingsStore.setState({ focusMode: true });
    const { container } = render(<LessonSection {...defaultProps} showTools={true} />);
    expect(container.querySelector('[class*="study-tools"]')).toBeNull();
  });

  test('hides sections panel when enabled', () => {
    mockAll();
    useSettingsStore.setState({ focusMode: true });
    const { container } = render(<LessonSection {...defaultProps} showSections={true} />);
    expect(container.querySelector('[class*="sections-panel"]')).toBeNull();
  });

  test('hides sections toggle button when enabled', () => {
    mockAll();
    useSettingsStore.setState({ focusMode: true });
    const { container } = render(<LessonSection {...defaultProps} showSections={false} />);
    expect(container.querySelector('button[title="Toggle sections panel"]')).toBeNull();
  });
});
