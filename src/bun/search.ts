import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import * as CourseLoader from './course-loader';
import { processLessonMarkdown } from './lesson-markdown';
import type { Course } from './types';

export interface SearchResult {
  type: 'lesson' | 'note' | 'highlight';
  courseID: string;
  courseName: string;
  moduleID: string;
  moduleName: string;
  sectionID?: string;
  sectionTitle?: string;
  snippet: string;
}

const DATA_DIR = join(process.env.HOME || '', '.coursereader');
const DB_FILE = join(DATA_DIR, 'data.json');

interface StoredNote {
  id: string;
  courseID: string;
  moduleID: string;
  content: string;
}

interface StoredHighlight {
  id: string;
  courseID: string;
  moduleID: string;
  selectedText: string;
}

interface StorageData {
  notes?: StoredNote[];
  highlights?: StoredHighlight[];
}

function loadStorage(): StorageData {
  if (!existsSync(DB_FILE)) return {};
  try {
    return JSON.parse(readFileSync(DB_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function highlightMatches(text: string, query: string): string {
  const lower = text.toLowerCase();
  const qlower = query.toLowerCase();
  const idx = lower.indexOf(qlower);
  if (idx === -1) return text.slice(0, 200);
  const start = Math.max(0, idx - 80);
  const end = Math.min(text.length, idx + query.length + 120);
  let snippet = text.slice(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';
  return snippet;
}

function findSectionForMatch(
  content: string,
  query: string,
): { sectionID: string; sectionTitle: string; snippet: string } | null {
  const { sections } = processLessonMarkdown(content);
  if (!sections.length) return null;

  const lines = content.split('\n');
  const qLower = query.toLowerCase();

  for (let i = 0; i < sections.length; i++) {
    const heading = sections[i].heading;
    const startLine = lines.findIndex((l) =>
      l.toLowerCase().includes(`# ${heading.toLowerCase()}`),
    );
    if (startLine === -1) continue;

    let endLine = lines.length;
    for (let j = i + 1; j < sections.length; j++) {
      const nextLine = lines.findIndex((l) =>
        l.toLowerCase().includes(`# ${sections[j].heading.toLowerCase()}`),
      );
      if (nextLine > startLine) {
        endLine = nextLine;
        break;
      }
    }

    const sectionText = lines.slice(startLine, endLine).join('\n');
    if (sectionText.toLowerCase().includes(qLower)) {
      return {
        sectionID: sections[i].id,
        sectionTitle: heading,
        snippet: highlightMatches(sectionText, query),
      };
    }
  }
  return null;
}

function score(text: string, query: string): number {
  const lower = text.toLowerCase();
  const qlower = query.toLowerCase();
  let s = 0;
  if (lower === qlower) s += 100;
  if (lower.startsWith(qlower)) s += 50;
  const count = (lower.match(new RegExp(qlower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || [])
    .length;
  s += count * 10;
  return s;
}

export function searchAll(query: string, courseID?: string): SearchResult[] {
  if (!query.trim()) return [];
  const q = query.trim();
  const results: SearchResult[] = [];
  const seen = new Set<string>();
  const qlower = q.toLowerCase();

  const allCourses = CourseLoader.loadCourses();
  const courses: Course[] = courseID ? allCourses.filter((c) => c.id === courseID) : allCourses;

  for (const course of courses) {
    for (const mod of course.modules) {
      try {
        const content = CourseLoader.loadLesson(course.id, mod.id);
        if (!content) continue;
        if (content.toLowerCase().includes(qlower)) {
          const key = `lesson:${course.id}:${mod.id}`;
          if (!seen.has(key)) {
            seen.add(key);
            const sectionMatch = findSectionForMatch(content, q);
            results.push({
              type: 'lesson',
              courseID: course.id,
              courseName: course.displayName,
              moduleID: mod.id,
              moduleName: mod.name,
              sectionID: sectionMatch?.sectionID,
              sectionTitle: sectionMatch?.sectionTitle,
              snippet: sectionMatch?.snippet ?? highlightMatches(content, q),
            });
          }
        }
      } catch {}
    }
  }

  const storage = loadStorage();

  if (storage.notes) {
    for (const note of storage.notes) {
      if (courseID && note.courseID !== courseID) continue;
      if (note.content.toLowerCase().includes(qlower)) {
        const course = courses.find((c) => c.id === note.courseID);
        const key = `note:${note.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            type: 'note',
            courseID: note.courseID,
            courseName: course?.displayName || note.courseID,
            moduleID: note.moduleID,
            moduleName:
              course?.modules.find((m) => m.id === note.moduleID)?.name ||
              `Module ${note.moduleID}`,
            snippet: highlightMatches(note.content, q),
          });
        }
      }
    }
  }

  if (storage.highlights) {
    for (const hl of storage.highlights) {
      if (courseID && hl.courseID !== courseID) continue;
      if (hl.selectedText.toLowerCase().includes(qlower)) {
        const course = courses.find((c) => c.id === hl.courseID);
        const key = `hl:${hl.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            type: 'highlight',
            courseID: hl.courseID,
            courseName: course?.displayName || hl.courseID,
            moduleID: hl.moduleID,
            moduleName:
              course?.modules.find((m) => m.id === hl.moduleID)?.name || `Module ${hl.moduleID}`,
            snippet: highlightMatches(hl.selectedText, q),
          });
        }
      }
    }
  }

  results.sort((a, b) => score(b.snippet, q) - score(a.snippet, q));
  return results.slice(0, 50);
}
