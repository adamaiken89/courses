import { describe, expect, test, afterEach } from 'bun:test';
import { render, act } from '@testing-library/react';
import LessonSection from '../../mainview/sections/LessonSection';
import { useSettingsStore } from '../../mainview/stores/settingsStore';
import { useLessonUIStore } from '../../mainview/stores/lessonUIStore';
import { mockFetch, restoreFetch } from './mock-fetch';
import { processLessonMarkdown } from '../lesson-markdown';
import type { Course } from '../types';

const mockCourse = {
  id: 'test',
  course: 'test',
  displayName: 'Test Course',
  targetLevel: 'beginner',
  domain: 'test',
  prerequisites: [],
  learningObjectives: [],
  modules: [{ id: 1, name: 'Intro Module', timeHours: 2, prerequisites: [], topics: [] }],
  timeBudgetHours: 0,
} as Course;

const mockModule = { id: 1, name: 'Intro Module', timeHours: 2, prerequisites: [], topics: [] };

const mockContent = `# Introduction

Welcome to the lesson.

Est. study time: 2h
Language: en

## Chapter 1

First chapter content.`;

const processed = processLessonMarkdown(mockContent);

const defaultProps = {
  course: mockCourse,
  module: mockModule,
};

afterEach(() => {
  restoreFetch();
  useSettingsStore.setState({ focusMode: false, showSections: false });
  useLessonUIStore.setState({
    showTools: false,
    showPomodoro: false,
    searchCourseOpen: false,
  });
});

function mockAll() {
  mockFetch({
    '/api/courses/test/modules/1/lesson': {
      content: mockContent,
      h1: processed.h1,
      meta: processed.meta,
      bodyContent: processed.bodyContent,
      sections: processed.sections,
    },
    '/api/storage/completed': { completed: false },
    '/api/courses/test/modules': mockCourse.modules,
    '/api/storage/completed/count': { count: 0 },
    '/api/storage/bookmarks/module': [],
    '/api/storage/highlights': [],
    '/api/storage/notes': [],
    '/api/storage/check-bookmark': false,
    '/courses/test/srs': { cards: {} },
    '/srs': { cards: {} },
  });
}

describe('Focus mode', () => {
  test('hides meta block when enabled', async () => {
    mockAll();
    useSettingsStore.setState({ focusMode: true });
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<LessonSection {...defaultProps} />));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.querySelector('.lesson-meta')).toBeNull();
  });

  test('shows meta block when disabled', async () => {
    mockAll();
    useSettingsStore.setState({ focusMode: false });
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<LessonSection {...defaultProps} />));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.querySelector('.lesson-meta')).not.toBeNull();
  });

  test('hides mark as complete button when enabled', async () => {
    mockAll();
    useSettingsStore.setState({ focusMode: true });
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<LessonSection {...defaultProps} />));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.querySelector('button.w-full')).toBeNull();
  });

  test('shows mark as complete button when disabled', async () => {
    mockAll();
    useSettingsStore.setState({ focusMode: false });
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<LessonSection {...defaultProps} />));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.querySelector('button.w-full')).not.toBeNull();
  });

  test('hides study tools sidebar when enabled', async () => {
    mockAll();
    useSettingsStore.setState({ focusMode: true });
    useLessonUIStore.setState({ showTools: true });
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<LessonSection {...defaultProps} />));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.querySelector('[class*="study-tools"]')).toBeNull();
  });

  test('hides sections panel when enabled', async () => {
    mockAll();
    useSettingsStore.setState({ focusMode: true, showSections: true });
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<LessonSection {...defaultProps} />));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.querySelector('[class*="sections-panel"]')).toBeNull();
  });

  test('hides sections toggle button when enabled', async () => {
    mockAll();
    useSettingsStore.setState({ focusMode: true, showSections: false });
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<LessonSection {...defaultProps} />));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.querySelector('button[title="Toggle sections panel"]')).toBeNull();
  });
});
