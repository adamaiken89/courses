import { beforeEach, describe, expect, test } from 'bun:test';

import { fsMockImpl } from '../testFsShared';

const mockSyllabi: Record<string, string> = {};
const mockLessons: Record<string, string | null> = {};
const mockDirEntries: Array<{ name: string; isDirectory: () => boolean }> = [];
const mockCourseModules: Record<string, Array<{ name: string; isDirectory: () => boolean }>> = {};
const mockStorageData: Record<string, unknown> = {};

function modDir(id: string, name: string): string {
  return `${id}-${name.toLowerCase().replace(/\s+/g, '-')}`;
}

function addCourse(courseId: string, courseName: string, moduleNames: string[]) {
  let yaml = `subject: ${courseName}\nmodules:\n`;
  const modEntries: Array<{ name: string; isDirectory: () => boolean }> = [];
  for (let i = 0; i < moduleNames.length; i++) {
    const mid = `${String(i + 1).padStart(2, '0')}`;
    yaml += `  - id: "${mid}"\n    name: ${moduleNames[i]}\n    time_hours: 1\n    prerequisites: []\n    topics: []\n`;
    modEntries.push({ name: modDir(mid, moduleNames[i]), isDirectory: () => true });
  }
  mockCourseModules[courseId] = modEntries;
  mockSyllabi[courseId] = yaml;
  mockDirEntries.push({ name: courseId, isDirectory: () => true });
}

function setLesson(mod: string, content: string | null) {
  mockLessons[mod] = content;
}

type Search = typeof import('./search');
let search: Search;

beforeEach(() => {
  for (const k of Object.keys(mockSyllabi)) delete mockSyllabi[k];
  for (const k of Object.keys(mockLessons)) delete mockLessons[k];
  for (const k of Object.keys(mockStorageData)) delete mockStorageData[k];
  for (const k of Object.keys(mockCourseModules)) delete mockCourseModules[k];
  mockDirEntries.length = 0;

  Object.assign(fsMockImpl, {
    existsSync: () => true,
    readdirSync: (p: string) => {
      const modMatch = p.match(/\/([^/]+)\/modules$/);
      if (modMatch && modMatch[1] in mockCourseModules) {
        return mockCourseModules[modMatch[1]];
      }
      return mockDirEntries;
    },
    readFileSync: (p: string) => {
      if (p.includes('data.json')) return JSON.stringify(mockStorageData);
      const syllabusMatch = p.match(/\/([^/]+)\/syllabus\.yaml$/);
      if (syllabusMatch && syllabusMatch[1] in mockSyllabi) {
        return mockSyllabi[syllabusMatch[1]];
      }
      const lessonMatch = p.match(/\/([^/]+)\/lesson\.md$/);
      if (lessonMatch && lessonMatch[1] in mockLessons) {
        return mockLessons[lessonMatch[1]] ?? '';
      }
      return '';
    },
    writeFileSync: () => {},
    mkdirSync: () => {},
    rmSync: () => {},
    cpSync: () => {},
  });
});

describe('searchAll', () => {
  test('returns empty array for empty query', async () => {
    search = await import('./search');
    expect(search.searchAll('')).toEqual([]);
    expect(search.searchAll('   ')).toEqual([]);
  });

  test('finds matches in lessons', async () => {
    search = await import('./search');
    addCourse('math', 'Math', ['Intro']);
    setLesson(modDir('01', 'Intro'), 'This is about calculus and algebra');

    const results = search.searchAll('calculus');
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('lesson');
    expect(results[0].courseID).toBe('math');
  });

  test('filters by courseID', async () => {
    search = await import('./search');
    addCourse('math', 'Math', ['Intro']);
    addCourse('physics', 'Physics', ['Intro']);
    setLesson(modDir('01', 'Intro'), 'calculus content');
    setLesson(modDir('01', 'Physics'), 'physics content');

    const results = search.searchAll('content', 'math');
    expect(results).toHaveLength(1);
    expect(results[0].courseID).toBe('math');
  });

  test('deduplicates results', async () => {
    search = await import('./search');
    addCourse('math', 'Math', ['Intro']);
    setLesson(modDir('01', 'Intro'), 'calculus calculus calculus');

    const results = search.searchAll('calculus');
    expect(results).toHaveLength(1);
  });

  test('handles no matching results', async () => {
    search = await import('./search');
    addCourse('math', 'Math', ['Intro']);
    setLesson(modDir('01', 'Intro'), 'algebra');

    const results = search.searchAll('calculus');
    expect(results).toEqual([]);
  });

  test('handles lesson load failure gracefully', async () => {
    search = await import('./search');
    addCourse('math', 'Math', ['Intro']);
    // No setLesson → readFileSync returns '' → falsy → skipped

    const results = search.searchAll('anything');
    expect(results).toEqual([]);
  });

  test('sorts results by relevance', async () => {
    search = await import('./search');
    addCourse('math', 'Math', ['A', 'B', 'C']);
    setLesson(modDir('01', 'A'), 'calculus algebra');
    setLesson(modDir('02', 'B'), 'calculus');
    setLesson(modDir('03', 'C'), 'other topic');

    const results = search.searchAll('calculus');
    expect(results).toHaveLength(2);
  });

  test('caps results at 50', async () => {
    search = await import('./search');
    const mods = Array.from({ length: 60 }, (_, i) => `M${i}`);
    addCourse('big', 'Big', mods);
    for (let i = 0; i < 60; i++) {
      const mid = `${String(i + 1).padStart(2, '0')}`;
      setLesson(modDir(mid, `M${i}`), 'searchable content');
    }

    const results = search.searchAll('searchable');
    expect(results.length).toBeLessThanOrEqual(50);
  });

  test('case insensitive matching', async () => {
    search = await import('./search');
    addCourse('math', 'Math', ['Intro']);
    setLesson(modDir('01', 'Intro'), 'CALCULUS AND ALGEBRA');

    const results = search.searchAll('calculus');
    expect(results).toHaveLength(1);
  });

  test('snippet contains query context', async () => {
    search = await import('./search');
    addCourse('math', 'Math', ['Intro']);
    setLesson(modDir('01', 'Intro'), 'This is a long text about calculus and other things');

    const results = search.searchAll('calculus');
    expect(results[0].snippet).toContain('calculus');
  });

  test('searches notes from storage', async () => {
    addCourse('math', 'Math', ['Intro']);
    mockStorageData.notes = [
      { id: 'n1', courseID: 'math', moduleID: '01', content: 'my calculus note' },
    ];
    search = await import('./search');
    const results = search.searchAll('calculus');
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('note');
    expect(results[0].courseID).toBe('math');
    expect(results[0].snippet).toContain('calculus');
  });

  test('searches highlights from storage', async () => {
    addCourse('math', 'Math', ['Intro']);
    mockStorageData.highlights = [
      { id: 'h1', courseID: 'math', moduleID: '01', selectedText: 'important calculus concept' },
    ];
    search = await import('./search');
    const results = search.searchAll('calculus');
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('highlight');
    expect(results[0].courseID).toBe('math');
  });

  test('storage note search filters by courseID', async () => {
    addCourse('math', 'Math', ['Intro']);
    addCourse('physics', 'Physics', ['Intro']);
    mockStorageData.notes = [
      { id: 'n1', courseID: 'math', moduleID: '01', content: 'calculus note' },
      { id: 'n2', courseID: 'physics', moduleID: '01', content: 'calculus note' },
    ];
    search = await import('./search');
    const results = search.searchAll('calculus', 'math');
    expect(results).toHaveLength(1);
    expect(results[0].courseID).toBe('math');
  });

  test('storage highlight search filters by courseID', async () => {
    addCourse('math', 'Math', ['Intro']);
    addCourse('physics', 'Physics', ['Intro']);
    mockStorageData.highlights = [
      { id: 'h1', courseID: 'math', moduleID: '01', selectedText: 'calculus highlight' },
      { id: 'h2', courseID: 'physics', moduleID: '01', selectedText: 'calculus highlight' },
    ];
    search = await import('./search');
    const results = search.searchAll('calculus', 'math');
    expect(results).toHaveLength(1);
    expect(results[0].courseID).toBe('math');
  });

  test('deduplicates results across note and highlight', async () => {
    addCourse('math', 'Math', ['Intro']);
    setLesson(modDir('01', 'Intro'), 'calculus lesson');
    mockStorageData.notes = [
      { id: 'n1', courseID: 'math', moduleID: '01', content: 'calculus note' },
    ];
    search = await import('./search');
    const results = search.searchAll('calculus');
    const types = results.map((r) => r.type);
    expect(types).toContain('lesson');
    expect(types).toContain('note');
  });

  test('note search handles course not in loaded courses', async () => {
    mockStorageData.notes = [
      { id: 'n1', courseID: 'unknown', moduleID: '01', content: 'some content' },
    ];
    search = await import('./search');
    const results = search.searchAll('content');
    expect(results).toHaveLength(1);
    expect(results[0].courseName).toBe('unknown');
    expect(results[0].moduleName).toBe('Module 01');
  });

  test('highlight search handles course not in loaded courses', async () => {
    mockStorageData.highlights = [
      { id: 'h1', courseID: 'unknown', moduleID: '01', selectedText: 'some highlight' },
    ];
    search = await import('./search');
    const results = search.searchAll('highlight');
    expect(results).toHaveLength(1);
    expect(results[0].courseName).toBe('unknown');
    expect(results[0].moduleName).toBe('Module 01');
  });

  test('handles non-matching notes and highlights', async () => {
    addCourse('math', 'Math', ['Intro']);
    mockStorageData.notes = [{ id: 'n1', courseID: 'math', moduleID: '01', content: 'unrelated' }];
    mockStorageData.highlights = [
      { id: 'h1', courseID: 'math', moduleID: '01', selectedText: 'also unrelated' },
    ];
    search = await import('./search');
    const results = search.searchAll('calculus');
    expect(results).toEqual([]);
  });

  test('includes all results when no courseID filter given', async () => {
    addCourse('math', 'Math', ['Intro']);
    addCourse('physics', 'Physics', ['Intro']);
    setLesson(modDir('01', 'Intro'), 'calculus in math');
    setLesson(modDir('01', 'Physics'), 'calculus in physics');
    search = await import('./search');
    const results = search.searchAll('calculus');
    expect(results).toHaveLength(2);
  });
});
