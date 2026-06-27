import { describe, expect, test, afterEach } from 'bun:test';
import { render, waitFor, act } from '@testing-library/react';
import LessonSection from '../../mainview/sections/LessonSection';
import { processLessonMarkdown, headingId } from '../lesson-markdown';
import { mockFetch, restoreFetch } from './mock-fetch';
import { useLessonUIStore } from '../../mainview/stores/lessonUIStore';
import type { Course } from '../types';

const mockCourse = {
  id: 'test',
  course: 'test',
  displayName: 'Test Course',
  targetLevel: 'beginner',
  domain: 'test',
  prerequisites: [],
  learningObjectives: [],
  modules: [{ id: '01', name: 'Intro Module', timeHours: 2, prerequisites: [], topics: [] }],
  timeBudgetHours: 0,
} as Course;

const mockModule = { id: '01', name: 'Intro Module', timeHours: 2, prerequisites: [], topics: [] };

const mockContent = `# Introduction

Welcome to the lesson.

## Chapter 1

First chapter content.

### Section 1.1

Details here.

## Chapter 2

Second chapter.`;

const processed = processLessonMarkdown(mockContent);

const defaultProps = {
  course: mockCourse,
  module: mockModule,
};

afterEach(() => {
  restoreFetch();
  useLessonUIStore.setState({
    showTools: false,
    showPomodoro: false,
    searchCourseOpen: false,
  });
});

function mockAll() {
  mockFetch({
    '/api/courses/test/modules/01/lesson': {
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
  });
}

describe('LessonSection snapshots', () => {
  test('loading state', async () => {
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<LessonSection {...defaultProps} />));
    });
    expect(container.innerHTML).toMatchSnapshot();
  });

  test('content loaded', async () => {
    mockAll();
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<LessonSection {...defaultProps} />));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await waitFor(() => expect(container.textContent).toContain('Introduction'));
    expect(container.innerHTML).toMatchSnapshot();
  });
});

describe('processLessonMarkdown', () => {
  test('parses study time and language meta', () => {
    const md = `# Module 1\n\nEst. study time: 2h\nLanguage: en\n\n## Section`;
    const result = processLessonMarkdown(md);
    expect(result.meta).toEqual([
      { key: 'est. study time', icon: '⏱', label: 'Study Time', value: '2h' },
      { key: 'language', icon: '🌐', label: 'Language', value: 'en' },
    ]);
  });

  test('parses description and framework', () => {
    const md = `# Module 2\n\nEst. study time: 2.5h\nLanguage: en\nDescription: A deep dive\nFramework: TypeScript\n\n## Next`;
    const result = processLessonMarkdown(md);
    expect(result.meta).toHaveLength(4);
    expect(result.meta[2]).toEqual({
      key: 'description',
      icon: '📝',
      label: 'Description',
      value: 'A deep dive',
    });
    expect(result.meta[3]).toEqual({
      key: 'framework',
      icon: '🔧',
      label: 'Framework',
      value: 'TypeScript',
    });
  });

  test('returns empty meta when none', () => {
    const md = `# Module\n\n## Section\n\nContent here.`;
    const result = processLessonMarkdown(md);
    expect(result.meta).toEqual([]);
  });

  test('stops meta scan at first ## heading', () => {
    const md = `# Module\n\nEst. study time: 1h\n\n## Section\n\nLanguage: en`;
    const result = processLessonMarkdown(md);
    expect(result.meta).toHaveLength(1);
    expect(result.meta[0].key).toBe('est. study time');
  });

  test('ignores unknown meta fields', () => {
    const md = `# Module\n\nEst. study time: 3h\nDifficulty: hard\n\n## Section`;
    const result = processLessonMarkdown(md);
    expect(result.meta).toHaveLength(1);
    expect(result.meta[0].key).toBe('est. study time');
  });

  test('handles blank lines between H1 and metadata', () => {
    const md = `# Module\n\n\nEst. study time: 2h\nLanguage: zh\n\n## Next`;
    const result = processLessonMarkdown(md);
    expect(result.meta).toHaveLength(2);
  });

  test('extracts H1 heading text', () => {
    expect(processLessonMarkdown('# Module 1: React Overview').h1).toBe('Module 1: React Overview');
  });

  test('returns empty H1 when none', () => {
    expect(processLessonMarkdown('## Section\n\nContent').h1).toBe('');
  });

  test('ignores deeper headings for H1', () => {
    expect(processLessonMarkdown('## Not H1\n### Also not').h1).toBe('');
  });
});

describe('bodyContent stripping', () => {
  test('removes H1 and metadata, keeps rest', () => {
    const md = `# Module 1\n\nEst. study time: 2h\nLanguage: en\n\n## Section\n\nContent`;
    const result = processLessonMarkdown(md);
    expect(result.bodyContent).toBe(`## Section\n\nContent`);
  });

  test('strips trailing blank lines after meta', () => {
    const md = `# Title\n\nEst. study time: 1h\n\n\n\n## Body`;
    const result = processLessonMarkdown(md);
    expect(result.bodyContent).toBe(`## Body`);
  });

  test('returns original when no header found (no h1, no meta)', () => {
    const md = `## Section\n\nContent`;
    const result = processLessonMarkdown(md);
    expect(result.bodyContent).toBe(md);
  });

  test('strips h1 when no meta but h1 present', () => {
    const md = `# Title\n\nEst. study time: 2h\nLanguage: en`;
    const result = processLessonMarkdown(md);
    expect(result.bodyContent).toBe('');
  });

  test('handles only description field', () => {
    const md = `# Title\n\nDescription: Foo bar\n\n## Next`;
    const result = processLessonMarkdown(md);
    expect(result.bodyContent).toBe(`## Next`);
  });
});

describe('headingId', () => {
  test('generates kebab-case from heading text', () => {
    expect(headingId('Hello World')).toBe('hello-world');
  });

  test('removes punctuation', () => {
    expect(headingId('Variables & Data Types: Part 1 (intro)')).toBe(
      'variables--data-types-part-1-intro',
    );
  });

  test('matches parseSections output for plain text headings', () => {
    const md = `# Hello World\n## Variables & Data Types\n### Basic Example\n## Control Flow: if/else`;
    const { sections } = processLessonMarkdown(md);
    for (const s of sections) {
      expect(s.id).toBe(headingId(s.heading));
    }
  });
});

describe('sections hierarchy', () => {
  test('includes all heading levels', () => {
    const md = `# Title\n## A\n### A1\n## B`;
    const { sections } = processLessonMarkdown(md);
    expect(sections).toHaveLength(4);
    expect(sections.map((s) => s.heading)).toEqual(['Title', 'A', 'A1', 'B']);
  });

  test('tracks parent IDs correctly', () => {
    const md = `# Root\n## Child\n### Grandchild\n## Child2`;
    const { sections } = processLessonMarkdown(md);
    expect(sections[0].parentID).toBeNull();
    expect(sections[1].parentID).toBe(sections[0].id);
    expect(sections[2].parentID).toBe(sections[1].id);
    expect(sections[3].parentID).toBe(sections[0].id);
  });
});

describe('scrollToSection', () => {
  test('scrolls container to correct heading position', async () => {
    const heading = document.createElement('h2');
    heading.id = 'target-section';
    heading.textContent = 'Target Section';
    heading.getBoundingClientRect = () =>
      ({
        top: 600,
        bottom: 630,
        left: 0,
        right: 800,
        width: 800,
        height: 30,
        x: 0,
        y: 600,
        toJSON: () => {},
      }) as DOMRect;

    const container = {
      querySelector: (sel: string) => (sel === '[id="target-section"]' ? heading : null),
      getBoundingClientRect: () =>
        ({
          top: 80,
          bottom: 580,
          left: 0,
          right: 800,
          width: 800,
          height: 500,
          x: 0,
          y: 80,
          toJSON: () => {},
        }) as DOMRect,
      scrollTop: 0,
      focus: () => {},
    } as unknown as HTMLDivElement;

    const scrollToSection = (sectionId: string) => {
      const el = container.querySelector(`[id="${sectionId}"]`);
      if (!el) return;
      const offset =
        el.getBoundingClientRect().top -
        container.getBoundingClientRect().top +
        container.scrollTop -
        20;
      container.scrollTop = offset;
    };

    scrollToSection('target-section');
    expect(container.scrollTop).toBeGreaterThan(0);
    expect(container.scrollTop).toBe(500);
  });

  test('does nothing when heading not found', () => {
    const container = {
      querySelector: () => null,
      scrollTop: 0,
    } as unknown as HTMLDivElement;

    const scrollToSection = (sectionId: string) => {
      const el = container.querySelector(`[id="${sectionId}"]`);
      if (!el) return;
    };

    scrollToSection('nonexistent');
    expect(container.scrollTop).toBe(0);
  });
});
