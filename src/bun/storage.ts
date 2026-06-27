import { logger } from './logger';
import type { Highlight, Note, Bookmark, CompletedModule, StudySession, UserCard } from './types';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.env.HOME || '', '.coursereader');
const DB_FILE = join(DATA_DIR, 'data.json');

interface StorageData {
  highlights: Highlight[];
  notes: Note[];
  bookmarks: Bookmark[];
  completedModules: CompletedModule[];
  studySessions: StudySession[];
  userCards: UserCard[];
  geminiAPIKey?: string;
  remoteRepoURL?: string;
  lastSyncedCommit?: string | null;
  lastSyncTime?: string | null;
}

function load(): StorageData {
  if (!existsSync(DB_FILE))
    return {
      highlights: [],
      notes: [],
      bookmarks: [],
      completedModules: [],
      studySessions: [],
      userCards: [],
    };
  try {
    const data = JSON.parse(readFileSync(DB_FILE, 'utf-8'));
    if (!data.completedModules) data.completedModules = [];
    if (!data.studySessions) data.studySessions = [];
    if (!data.userCards) data.userCards = [];
    return data;
  } catch (e) {
    logger.warn(
      { err: (e as Error).message, file: DB_FILE },
      'Failed to load data.json, using defaults',
    );
    return {
      highlights: [],
      notes: [],
      bookmarks: [],
      completedModules: [],
      studySessions: [],
      userCards: [],
    };
  }
}

function save(data: StorageData): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

export function getHighlightsForModule(courseID: string, moduleID: string): Highlight[] {
  const data = load();
  return data.highlights
    .filter((h) => h.courseID === courseID && h.moduleID === moduleID)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function addHighlight(
  courseID: string,
  moduleID: string,
  selectedText: string,
  startOffset: number,
  endOffset: number,
  color: string = 'yellow',
): Highlight {
  const data = load();
  const existing = data.highlights.find(
    (h) =>
      h.courseID === courseID &&
      h.moduleID === moduleID &&
      h.selectedText === selectedText &&
      h.startOffset === startOffset &&
      h.endOffset === endOffset,
  );
  if (existing) {
    existing.color = color;
    save(data);
    return existing;
  }
  const highlight: Highlight = {
    id: crypto.randomUUID(),
    courseID,
    moduleID,
    selectedText,
    startOffset,
    endOffset,
    color,
    createdAt: new Date().toISOString(),
  };
  data.highlights.push(highlight);
  save(data);
  return highlight;
}

export function deleteHighlight(id: string): void {
  const data = load();
  data.highlights = data.highlights.filter((h) => h.id !== id);
  save(data);
}

export function addNote(
  courseID: string,
  moduleID: string,
  content: string,
  highlightID?: string,
  sectionID?: string,
): Note {
  const data = load();
  const now = new Date().toISOString();
  const note: Note = {
    id: crypto.randomUUID(),
    courseID,
    moduleID,
    highlightID: highlightID || null,
    sectionID: sectionID || null,
    content,
    createdAt: now,
    updatedAt: now,
  };
  data.notes.push(note);
  save(data);
  return note;
}

export function getNotesForModule(courseID: string, moduleID: string): Note[] {
  const data = load();
  return data.notes
    .filter((n) => n.courseID === courseID && n.moduleID === moduleID)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function updateNote(id: string, content: string): void {
  const data = load();
  const note = data.notes.find((n) => n.id === id);
  if (note) {
    note.content = content;
    note.updatedAt = new Date().toISOString();
    save(data);
  }
}

export function deleteNote(id: string): void {
  const data = load();
  data.notes = data.notes.filter((n) => n.id !== id);
  save(data);
}

export function addAnnotation(data: {
  courseID: string;
  moduleID: string;
  selectedText: string;
  startOffset: number;
  endOffset: number;
  color: string;
  noteContent: string;
}): { highlight: Highlight; note: Note } {
  const highlight = addHighlight(
    data.courseID,
    data.moduleID,
    data.selectedText,
    data.startOffset,
    data.endOffset,
    data.color,
  );
  const note = addNote(data.courseID, data.moduleID, data.noteContent, highlight.id, undefined);
  return { highlight, note };
}

export function addBookmark(
  courseID: string,
  moduleID: string,
  title: string,
  sectionID?: string,
  scrollPosition: number = 0,
): Bookmark {
  const data = load();
  const bookmark: Bookmark = {
    id: crypto.randomUUID(),
    courseID,
    moduleID,
    sectionID: sectionID || null,
    title,
    scrollPosition,
    createdAt: new Date().toISOString(),
  };
  data.bookmarks.push(bookmark);
  save(data);
  return bookmark;
}

export function getAllBookmarks(): Bookmark[] {
  const data = load();
  return data.bookmarks.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function getBookmarksForCourse(courseID: string): Bookmark[] {
  const data = load();
  return data.bookmarks
    .filter((b) => b.courseID === courseID)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getBookmarksForModule(courseID: string, moduleID: string): Bookmark[] {
  const data = load();
  return data.bookmarks
    .filter((b) => b.courseID === courseID && b.moduleID === moduleID)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function deleteBookmark(id: string): void {
  const data = load();
  data.bookmarks = data.bookmarks.filter((b) => b.id !== id);
  save(data);
}

export function getGeminiKey(): string | null {
  const data = load();
  return data.geminiAPIKey || null;
}

export function setGeminiKey(key: string): void {
  const data = load();
  data.geminiAPIKey = key;
  save(data);
}

export function isBookmarked(courseID: string, moduleID: string): boolean {
  const data = load();
  return data.bookmarks.some((b) => b.courseID === courseID && b.moduleID === moduleID);
}

export function isModuleCompleted(courseID: string, moduleID: string): boolean {
  const data = load();
  return data.completedModules.some((m) => m.courseID === courseID && m.moduleID === moduleID);
}

export function toggleModuleCompleted(courseID: string, moduleID: string): boolean {
  const data = load();
  const idx = data.completedModules.findIndex(
    (m) => m.courseID === courseID && m.moduleID === moduleID,
  );
  if (idx >= 0) {
    data.completedModules.splice(idx, 1);
    save(data);
    return false;
  }
  data.completedModules.push({ courseID, moduleID, completedAt: new Date().toISOString() });
  save(data);
  return true;
}

export function getCompletedModuleIDs(courseID: string): string[] {
  const data = load();
  return data.completedModules.filter((m) => m.courseID === courseID).map((m) => m.moduleID);
}

export function getCompletedModuleCount(courseID: string): number {
  const data = load();
  return data.completedModules.filter((m) => m.courseID === courseID).length;
}

export function addStudySession(
  session: Omit<StudySession, 'date'> & { date?: string },
): StudySession {
  const data = load();
  const full: StudySession = {
    ...session,
    date: session.date || new Date().toISOString().split('T')[0],
  };
  data.studySessions.push(full);
  save(data);
  return full;
}

export function getStudySessions(courseID: string, days?: number): StudySession[] {
  const data = load();
  let sessions = data.studySessions.filter((s) => s.courseID === courseID);
  if (days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    sessions = sessions.filter((s) => new Date(s.date) >= cutoff);
  }
  return sessions.sort((a, b) => b.date.localeCompare(a.date));
}

export function getGlobalStudySessions(days?: number): StudySession[] {
  const data = load();
  let sessions = [...data.studySessions];
  if (days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    sessions = sessions.filter((s) => new Date(s.date) >= cutoff);
  }
  return sessions.sort((a, b) => b.date.localeCompare(a.date));
}

export function getDailyStreak(): number {
  const data = load();
  const dates = [...new Set(data.studySessions.map((s) => s.date))].sort().reverse();
  if (dates.length === 0) return 0;
  let streak = 1;
  const today = new Date().toISOString().split('T')[0];
  if (dates[0] !== today && dates[0] !== yesterday()) return 0;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const diff = (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

// --- UserCard CRUD ---

export function addUserCard(
  courseId: string,
  moduleId: string,
  front: string,
  back: string,
): UserCard {
  const data = load();
  const card: UserCard = {
    id: crypto.randomUUID(),
    courseId,
    moduleId,
    front,
    back,
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewDate: new Date().toISOString(),
    lastReviewed: null,
    isStarred: false,
    createdAt: new Date().toISOString(),
  };
  data.userCards.push(card);
  save(data);
  return card;
}

export function getUserCards(courseId?: string, moduleId?: string): UserCard[] {
  const data = load();
  let cards = data.userCards;
  if (courseId) cards = cards.filter((c) => c.courseId === courseId);
  if (moduleId !== undefined) cards = cards.filter((c) => c.moduleId === moduleId);
  return cards.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function getAllUserCards(): UserCard[] {
  const data = load();
  return [...data.userCards].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export function getUserCardById(id: string): UserCard | undefined {
  const data = load();
  return data.userCards.find((c) => c.id === id);
}

export function deleteUserCard(id: string): void {
  const data = load();
  data.userCards = data.userCards.filter((c) => c.id !== id);
  save(data);
}

export function updateUserCard(
  id: string,
  updates: { front?: string; back?: string },
): UserCard | null {
  const data = load();
  const card = data.userCards.find((c) => c.id === id);
  if (!card) return null;
  if (updates.front !== undefined) card.front = updates.front;
  if (updates.back !== undefined) card.back = updates.back;
  save(data);
  return card;
}

export function reviewUserCard(id: string, correct: boolean, now?: Date): UserCard | null {
  const data = load();
  const card = data.userCards.find((c) => c.id === id);
  if (!card) return null;
  const nowDate = now || new Date();
  const updated = { ...card };
  if (correct) {
    updated.repetitions += 1;
    if (updated.repetitions === 1) updated.interval = 1;
    else if (updated.repetitions === 2) updated.interval = 6;
    else updated.interval = Math.round(updated.interval * updated.easeFactor);
    updated.easeFactor = Math.max(1.3, updated.easeFactor + 0.1);
  } else {
    updated.repetitions = 0;
    updated.interval = 1;
    updated.easeFactor = Math.max(1.3, updated.easeFactor - 0.2);
  }
  const nextDate = new Date(nowDate);
  nextDate.setDate(nextDate.getDate() + updated.interval);
  updated.nextReviewDate = nextDate.toISOString();
  updated.lastReviewed = nowDate.toISOString();
  Object.assign(card, updated);
  save(data);
  return card;
}

export function toggleUserCardStar(id: string): UserCard | null {
  const data = load();
  const card = data.userCards.find((c) => c.id === id);
  if (!card) return null;
  card.isStarred = !card.isStarred;
  save(data);
  return card;
}

// --- Sync Config ---

export function getSyncConfig(): {
  remoteRepoURL: string;
  lastSyncedCommit: string | null;
  lastSyncTime: string | null;
} {
  const data = load();
  return {
    remoteRepoURL: data.remoteRepoURL || '',
    lastSyncedCommit: data.lastSyncedCommit || null,
    lastSyncTime: data.lastSyncTime || null,
  };
}

export function clearAllData(): void {
  save({
    highlights: [],
    notes: [],
    bookmarks: [],
    completedModules: [],
    studySessions: [],
    userCards: [],
  });
}

export function saveSyncConfig(config: {
  remoteRepoURL?: string;
  lastSyncedCommit?: string | null;
  lastSyncTime?: string | null;
}): void {
  const data = load();
  if (config.remoteRepoURL !== undefined) data.remoteRepoURL = config.remoteRepoURL;
  if (config.lastSyncedCommit !== undefined) data.lastSyncedCommit = config.lastSyncedCommit;
  if (config.lastSyncTime !== undefined) data.lastSyncTime = config.lastSyncTime;
  save(data);
}
