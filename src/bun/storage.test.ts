import { describe, expect, test, beforeEach } from 'bun:test';

import { fsMockImpl } from '../testFsShared';

let state = {
  exists: true,
  data: JSON.stringify({
    highlights: [],
    notes: [],
    bookmarks: [],
    completedModules: [],
    studySessions: [],
    userCards: [],
  }),
};

beforeEach(() => {
  state = {
    exists: true,
    data: JSON.stringify({
      highlights: [],
      notes: [],
      bookmarks: [],
      completedModules: [],
      studySessions: [],
      userCards: [],
    }),
  };
  Object.assign(fsMockImpl, {
    existsSync: () => state.exists,
    readFileSync: () => state.data,
    writeFileSync: (_path: string, raw: string) => {
      state.data = raw;
    },
    mkdirSync: () => {},
    readdirSync: () => [],
    rmSync: () => {},
    cpSync: (_src: string, _dest: string) => {},
  });
});

type Storage = typeof import('./storage');
let mod: Storage;

beforeEach(() => {
  state.exists = true;
  state.data = JSON.stringify({
    highlights: [],
    notes: [],
    bookmarks: [],
    completedModules: [],
    studySessions: [],
    userCards: [],
  });
});

describe('highlights', () => {
  test('addHighlight creates highlight with all fields', async () => {
    mod = await import('./storage');
    const h = mod.addHighlight('c1', '01', 'selected text', 0, 13, 'pink');
    expect(h.courseID).toBe('c1');
    expect(h.moduleID).toBe('01');
    expect(h.selectedText).toBe('selected text');
    expect(h.startOffset).toBe(0);
    expect(h.endOffset).toBe(13);
    expect(h.color).toBe('pink');
    expect(h.id).toBeDefined();
    expect(h.createdAt).toBeDefined();
  });

  test('addHighlight defaults color to yellow', async () => {
    mod = await import('./storage');
    const h = mod.addHighlight('c1', '01', 'text', 0, 4);
    expect(h.color).toBe('yellow');
  });

  test('getHighlightsForModule returns highlights sorted by createdAt', async () => {
    mod = await import('./storage');
    mod.addHighlight('c1', '01', 'early', 0, 5, 'yellow');
    const h2 = mod.addHighlight('c1', '01', 'late', 6, 10, 'pink');
    const highlights = mod.getHighlightsForModule('c1', '01');
    expect(highlights).toHaveLength(2);
    expect(highlights[0].selectedText).toBe('early');
    expect(highlights[1].selectedText).toBe('late');
    expect(highlights[highlights.length - 1].id).toBe(h2.id);
  });

  test('getHighlightsForModule filters by courseID and moduleID', async () => {
    mod = await import('./storage');
    mod.addHighlight('c1', '01', 'a', 0, 1);
    mod.addHighlight('c1', '02', 'b', 0, 1);
    mod.addHighlight('c2', '01', 'c', 0, 1);
    expect(mod.getHighlightsForModule('c1', '01')).toHaveLength(1);
    expect(mod.getHighlightsForModule('c1', '01')[0].selectedText).toBe('a');
    expect(mod.getHighlightsForModule('c1', '02')).toHaveLength(1);
    expect(mod.getHighlightsForModule('c2', '01')).toHaveLength(1);
  });

  test('deleteHighlight removes highlight', async () => {
    mod = await import('./storage');
    const h = mod.addHighlight('c1', '01', 'text', 0, 4);
    expect(mod.getHighlightsForModule('c1', '01')).toHaveLength(1);
    mod.deleteHighlight(h.id);
    expect(mod.getHighlightsForModule('c1', '01')).toHaveLength(0);
  });

  test('deleteHighlight is idempotent for missing id', async () => {
    mod = await import('./storage');
    mod.addHighlight('c1', '01', 'text', 0, 4);
    mod.deleteHighlight('nonexistent');
    expect(mod.getHighlightsForModule('c1', '01')).toHaveLength(1);
  });

  test('addHighlight deduplicates same location and text, updates color only', async () => {
    mod = await import('./storage');
    const h1 = mod.addHighlight('c1', '01', 'text', 0, 4, 'yellow');
    const h2 = mod.addHighlight('c1', '01', 'text', 0, 4, 'pink');
    expect(h2.id).toBe(h1.id);
    expect(h2.color).toBe('pink');
    expect(mod.getHighlightsForModule('c1', '01')).toHaveLength(1);
  });

  test('addHighlight does not dedup different text', async () => {
    mod = await import('./storage');
    mod.addHighlight('c1', '01', 'text', 0, 4, 'yellow');
    mod.addHighlight('c1', '01', 'other', 0, 4, 'pink');
    expect(mod.getHighlightsForModule('c1', '01')).toHaveLength(2);
  });

  test('addHighlight does not dedup different offsets', async () => {
    mod = await import('./storage');
    mod.addHighlight('c1', '01', 'text', 0, 4, 'yellow');
    mod.addHighlight('c1', '01', 'text', 5, 9, 'pink');
    expect(mod.getHighlightsForModule('c1', '01')).toHaveLength(2);
  });
});

describe('notes', () => {
  test('addNote creates note with correct fields', async () => {
    mod = await import('./storage');
    const n = mod.addNote('c1', '01', 'my note');
    expect(n.courseID).toBe('c1');
    expect(n.moduleID).toBe('01');
    expect(n.content).toBe('my note');
    expect(n.highlightID).toBeNull();
    expect(n.sectionID).toBeNull();
    expect(n.id).toBeDefined();
    expect(n.createdAt).toBeDefined();
    expect(n.updatedAt).toBe(n.createdAt);
  });

  test('addNote with highlightID and sectionID', async () => {
    mod = await import('./storage');
    const n = mod.addNote('c1', '01', 'linked note', 'h-1', 's-1');
    expect(n.highlightID).toBe('h-1');
    expect(n.sectionID).toBe('s-1');
  });

  test('getNotesForModule returns notes sorted by createdAt', async () => {
    mod = await import('./storage');
    mod.addNote('c1', '01', 'first');
    const n2 = mod.addNote('c1', '01', 'second');
    const notes = mod.getNotesForModule('c1', '01');
    expect(notes).toHaveLength(2);
    expect(notes[0].content).toBe('first');
    expect(notes[notes.length - 1].id).toBe(n2.id);
  });

  test('updateNote updates content', async () => {
    mod = await import('./storage');
    const n = mod.addNote('c1', '01', 'original');
    mod.updateNote(n.id, 'updated');
    const notes = mod.getNotesForModule('c1', '01');
    expect(notes[0].content).toBe('updated');
    expect(notes[0].updatedAt).toBeDefined();
  });

  test('updateNote no-ops for missing id', async () => {
    mod = await import('./storage');
    mod.addNote('c1', '01', 'original');
    mod.updateNote('nonexistent', 'updated');
    const notes = mod.getNotesForModule('c1', '01');
    expect(notes[0].content).toBe('original');
  });

  test('deleteNote removes note', async () => {
    mod = await import('./storage');
    const n = mod.addNote('c1', '01', 'text');
    expect(mod.getNotesForModule('c1', '01')).toHaveLength(1);
    mod.deleteNote(n.id);
    expect(mod.getNotesForModule('c1', '01')).toHaveLength(0);
  });
});

describe('annotations', () => {
  test('addAnnotation creates highlight and note linked together', async () => {
    mod = await import('./storage');
    const { highlight, note } = mod.addAnnotation({
      courseID: 'c1',
      moduleID: '01',
      selectedText: 'selected',
      startOffset: 0,
      endOffset: 8,
      color: 'green',
      noteContent: 'my annotation',
    });
    expect(highlight.courseID).toBe('c1');
    expect(highlight.color).toBe('green');
    expect(note.content).toBe('my annotation');
    expect(note.highlightID).toBe(highlight.id);
  });
});

describe('bookmarks', () => {
  test('addBookmark creates bookmark with all fields', async () => {
    mod = await import('./storage');
    const b = mod.addBookmark('c1', '01', 'Chapter 1', 'chapter-1', 42);
    expect(b.courseID).toBe('c1');
    expect(b.moduleID).toBe('01');
    expect(b.title).toBe('Chapter 1');
    expect(b.sectionID).toBe('chapter-1');
    expect(b.scrollPosition).toBe(42);
    expect(b.id).toBeDefined();
    expect(b.createdAt).toBeDefined();
  });

  test('addBookmark with defaults', async () => {
    mod = await import('./storage');
    const b = mod.addBookmark('c1', '01', 'Title');
    expect(b.sectionID).toBeNull();
    expect(b.scrollPosition).toBe(0);
  });

  test('getAllBookmarks returns all bookmarks', async () => {
    mod = await import('./storage');
    mod.addBookmark('c1', '01', 'first');
    mod.addBookmark('c1', '02', 'second');
    const all = mod.getAllBookmarks();
    expect(all).toHaveLength(2);
    const titles = all.map((b) => b.title).sort();
    expect(titles).toEqual(['first', 'second']);
  });

  test('getBookmarksForCourse filters by courseID', async () => {
    mod = await import('./storage');
    mod.addBookmark('c1', '01', 'a');
    mod.addBookmark('c2', '01', 'b');
    const books = mod.getBookmarksForCourse('c1');
    expect(books).toHaveLength(1);
    expect(books[0].title).toBe('a');
  });

  test('getBookmarksForModule filters by both', async () => {
    mod = await import('./storage');
    mod.addBookmark('c1', '01', 'a');
    mod.addBookmark('c1', '02', 'b');
    mod.addBookmark('c2', '01', 'c');
    expect(mod.getBookmarksForModule('c1', '01')).toHaveLength(1);
  });

  test('deleteBookmark removes bookmark', async () => {
    mod = await import('./storage');
    const b = mod.addBookmark('c1', '01', 't');
    expect(mod.getAllBookmarks()).toHaveLength(1);
    mod.deleteBookmark(b.id);
    expect(mod.getAllBookmarks()).toHaveLength(0);
  });

  test('isBookmarked returns true only for bookmarked course+module', async () => {
    mod = await import('./storage');
    mod.addBookmark('c1', '01', 't');
    expect(mod.isBookmarked('c1', '01')).toBe(true);
    expect(mod.isBookmarked('c1', '02')).toBe(false);
    expect(mod.isBookmarked('c2', '01')).toBe(false);
  });
});

describe('module completion', () => {
  test('isModuleCompleted returns false initially', async () => {
    mod = await import('./storage');
    expect(mod.isModuleCompleted('c1', '01')).toBe(false);
  });

  test('toggleModuleCompleted adds module, returns true', async () => {
    mod = await import('./storage');
    const result = mod.toggleModuleCompleted('c1', '01');
    expect(result).toBe(true);
    expect(mod.isModuleCompleted('c1', '01')).toBe(true);
  });

  test('toggleModuleCompleted removes module, returns false', async () => {
    mod = await import('./storage');
    mod.toggleModuleCompleted('c1', '01');
    const result = mod.toggleModuleCompleted('c1', '01');
    expect(result).toBe(false);
    expect(mod.isModuleCompleted('c1', '01')).toBe(false);
  });

  test('getCompletedModuleCount returns count for course', async () => {
    mod = await import('./storage');
    mod.toggleModuleCompleted('c1', '01');
    mod.toggleModuleCompleted('c1', '02');
    mod.toggleModuleCompleted('c2', '01');
    expect(mod.getCompletedModuleCount('c1')).toBe(2);
    expect(mod.getCompletedModuleCount('c2')).toBe(1);
  });
});

describe('gemini key', () => {
  test('getGeminiKey returns null when not set', async () => {
    mod = await import('./storage');
    expect(mod.getGeminiKey()).toBeNull();
  });

  test('setGeminiKey stores key', async () => {
    mod = await import('./storage');
    mod.setGeminiKey('test-key-123');
    expect(mod.getGeminiKey()).toBe('test-key-123');
  });

  test('setGeminiKey overwrites existing key', async () => {
    mod = await import('./storage');
    mod.setGeminiKey('old');
    mod.setGeminiKey('new');
    expect(mod.getGeminiKey()).toBe('new');
  });
});

describe('study sessions', () => {
  function daysAgo(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
  }

  const today = daysAgo(0);

  test('addStudySession with default date', async () => {
    mod = await import('./storage');
    const s = mod.addStudySession({
      courseID: 'c1',
      moduleID: '01',
      durationMinutes: 30,
      type: 'reading',
    });
    expect(s.date).toBe(today);
    expect(s.courseID).toBe('c1');
    expect(s.durationMinutes).toBe(30);
    expect(s.type).toBe('reading');
  });

  test('addStudySession with custom date', async () => {
    mod = await import('./storage');
    const s = mod.addStudySession({
      date: '2024-01-15',
      courseID: 'c1',
      moduleID: '01',
      durationMinutes: 15,
      type: 'quiz',
      score: 3,
      total: 5,
    });
    expect(s.date).toBe('2024-01-15');
    expect(s.score).toBe(3);
    expect(s.total).toBe(5);
  });

  test('getStudySessions filters by course and sorts desc', async () => {
    mod = await import('./storage');
    mod.addStudySession({
      date: '2024-01-10',
      courseID: 'c1',
      moduleID: '01',
      durationMinutes: 10,
      type: 'reading',
    });
    mod.addStudySession({
      date: '2024-01-12',
      courseID: 'c1',
      moduleID: '01',
      durationMinutes: 20,
      type: 'reading',
    });
    mod.addStudySession({
      date: '2024-01-11',
      courseID: 'c2',
      moduleID: '01',
      durationMinutes: 5,
      type: 'reading',
    });
    const sessions = mod.getStudySessions('c1');
    expect(sessions).toHaveLength(2);
    expect(sessions[0].date).toBe('2024-01-12');
    expect(sessions[1].date).toBe('2024-01-10');
  });

  test('getStudySessions with days filter', async () => {
    mod = await import('./storage');
    mod.addStudySession({
      date: daysAgo(1),
      courseID: 'c1',
      moduleID: '01',
      durationMinutes: 10,
      type: 'reading',
    });
    mod.addStudySession({
      date: daysAgo(10),
      courseID: 'c1',
      moduleID: '01',
      durationMinutes: 10,
      type: 'reading',
    });
    expect(mod.getStudySessions('c1', 7)).toHaveLength(1);
  });

  test('getGlobalStudySessions returns all sessions', async () => {
    mod = await import('./storage');
    mod.addStudySession({
      date: '2024-01-10',
      courseID: 'c1',
      moduleID: '01',
      durationMinutes: 10,
      type: 'reading',
    });
    mod.addStudySession({
      date: '2024-01-11',
      courseID: 'c2',
      moduleID: '01',
      durationMinutes: 5,
      type: 'reading',
    });
    expect(mod.getGlobalStudySessions()).toHaveLength(2);
  });

  test('getGlobalStudySessions with days filter', async () => {
    mod = await import('./storage');
    mod.addStudySession({
      date: daysAgo(1),
      courseID: 'c1',
      moduleID: '01',
      durationMinutes: 10,
      type: 'reading',
    });
    mod.addStudySession({
      date: daysAgo(10),
      courseID: 'c1',
      moduleID: '01',
      durationMinutes: 10,
      type: 'reading',
    });
    expect(mod.getGlobalStudySessions(7)).toHaveLength(1);
  });

  test('getDailyStreak returns 0 when no sessions', async () => {
    mod = await import('./storage');
    expect(mod.getDailyStreak()).toBe(0);
  });

  test('getDailyStreak returns 1 when one session today', async () => {
    mod = await import('./storage');
    mod.addStudySession({ courseID: 'c1', moduleID: '01', durationMinutes: 10, type: 'reading' });
    expect(mod.getDailyStreak()).toBe(1);
  });

  test('getDailyStreak counts consecutive days', async () => {
    mod = await import('./storage');
    mod.addStudySession({
      date: daysAgo(0),
      courseID: 'c1',
      moduleID: '01',
      durationMinutes: 10,
      type: 'reading',
    });
    mod.addStudySession({
      date: daysAgo(1),
      courseID: 'c1',
      moduleID: '01',
      durationMinutes: 10,
      type: 'reading',
    });
    mod.addStudySession({
      date: daysAgo(2),
      courseID: 'c1',
      moduleID: '01',
      durationMinutes: 10,
      type: 'reading',
    });
    expect(mod.getDailyStreak()).toBe(3);
  });

  test('getDailyStreak breaks on gap', async () => {
    mod = await import('./storage');
    mod.addStudySession({
      date: daysAgo(0),
      courseID: 'c1',
      moduleID: '01',
      durationMinutes: 10,
      type: 'reading',
    });
    mod.addStudySession({
      date: daysAgo(1),
      courseID: 'c1',
      moduleID: '01',
      durationMinutes: 10,
      type: 'reading',
    });
    mod.addStudySession({
      date: daysAgo(3),
      courseID: 'c1',
      moduleID: '01',
      durationMinutes: 10,
      type: 'reading',
    });
    expect(mod.getDailyStreak()).toBe(2);
  });

  test('getDailyStreak returns 0 if most recent session is not today or yesterday', async () => {
    mod = await import('./storage');
    mod.addStudySession({
      date: daysAgo(5),
      courseID: 'c1',
      moduleID: '01',
      durationMinutes: 10,
      type: 'reading',
    });
    expect(mod.getDailyStreak()).toBe(0);
  });
});

describe('user cards', () => {
  test('addUserCard creates card with SM-2 defaults', async () => {
    mod = await import('./storage');
    const c = mod.addUserCard('c1', '01', 'front text', 'back text');
    expect(c.courseId).toBe('c1');
    expect(c.moduleId).toBe('01');
    expect(c.front).toBe('front text');
    expect(c.back).toBe('back text');
    expect(c.easeFactor).toBe(2.5);
    expect(c.interval).toBe(0);
    expect(c.repetitions).toBe(0);
    expect(c.isStarred).toBe(false);
    expect(c.lastReviewed).toBeNull();
    expect(c.id).toBeDefined();
    expect(c.createdAt).toBeDefined();
  });

  test('getUserCards filters by courseId', async () => {
    mod = await import('./storage');
    mod.addUserCard('c1', '01', 'f1', 'b1');
    mod.addUserCard('c2', '01', 'f2', 'b2');
    const cards = mod.getUserCards('c1');
    expect(cards).toHaveLength(1);
  });

  test('getUserCards filters by courseId and moduleId', async () => {
    mod = await import('./storage');
    mod.addUserCard('c1', '01', 'f1', 'b1');
    mod.addUserCard('c1', '02', 'f2', 'b2');
    const cards = mod.getUserCards('c1', '02');
    expect(cards).toHaveLength(1);
  });

  test('getAllUserCards returns all sorted by createdAt', async () => {
    mod = await import('./storage');
    mod.addUserCard('c1', '01', 'f1', 'b1');
    const c2 = mod.addUserCard('c1', '02', 'f2', 'b2');
    const all = mod.getAllUserCards();
    expect(all).toHaveLength(2);
    expect(all[all.length - 1].id).toBe(c2.id);
  });

  test('getUserCardById returns card or undefined', async () => {
    mod = await import('./storage');
    const c = mod.addUserCard('c1', '01', 'f', 'b');
    expect(mod.getUserCardById(c.id)?.front).toBe('f');
    expect(mod.getUserCardById('nonexistent')).toBeUndefined();
  });

  test('updateUserCard updates front and back', async () => {
    mod = await import('./storage');
    const c = mod.addUserCard('c1', '01', 'old front', 'old back');
    const updated = mod.updateUserCard(c.id, { front: 'new front', back: 'new back' });
    expect(updated).not.toBeNull();
    expect(updated!.front).toBe('new front');
    expect(updated!.back).toBe('new back');
  });

  test('updateUserCard returns null for missing id', async () => {
    mod = await import('./storage');
    expect(mod.updateUserCard('nonexistent', { front: 'x' })).toBeNull();
  });

  test('deleteUserCard removes card', async () => {
    mod = await import('./storage');
    const c = mod.addUserCard('c1', '01', 'f', 'b');
    expect(mod.getAllUserCards()).toHaveLength(1);
    mod.deleteUserCard(c.id);
    expect(mod.getAllUserCards()).toHaveLength(0);
  });

  test('reviewUserCard: correct first review', async () => {
    mod = await import('./storage');
    const c = mod.addUserCard('c1', '01', 'f', 'b');
    const now = new Date('2024-06-15T12:00:00Z');
    const r = mod.reviewUserCard(c.id, true, now);
    expect(r!.repetitions).toBe(1);
    expect(r!.interval).toBe(1);
    expect(r!.easeFactor).toBe(2.6);
    expect(r!.lastReviewed).toBe('2024-06-15T12:00:00.000Z');
    expect(r!.nextReviewDate).toBe('2024-06-16T12:00:00.000Z');
  });

  test('reviewUserCard: correct second review', async () => {
    mod = await import('./storage');
    const c = mod.addUserCard('c1', '01', 'f', 'b');
    const now = new Date('2024-06-15T12:00:00Z');
    mod.reviewUserCard(c.id, true, now);
    const r = mod.reviewUserCard(c.id, true, new Date('2024-06-16T12:00:00Z'));
    expect(r!.repetitions).toBe(2);
    expect(r!.interval).toBe(6);
    expect(r!.easeFactor).toBe(2.7);
  });

  test('reviewUserCard: correct third review uses ease factor', async () => {
    mod = await import('./storage');
    const c = mod.addUserCard('c1', '01', 'f', 'b');
    mod.reviewUserCard(c.id, true, new Date('2024-06-15T12:00:00Z'));
    mod.reviewUserCard(c.id, true, new Date('2024-06-16T12:00:00Z'));
    const r = mod.reviewUserCard(c.id, true, new Date('2024-06-22T12:00:00Z'));
    expect(r!.repetitions).toBe(3);
    expect(r!.interval).toBe(Math.round(6 * 2.7));
  });

  test('reviewUserCard: incorrect resets', async () => {
    mod = await import('./storage');
    const c = mod.addUserCard('c1', '01', 'f', 'b');
    mod.reviewUserCard(c.id, true, new Date('2024-06-15T12:00:00Z')); // correct once
    const r = mod.reviewUserCard(c.id, false, new Date('2024-06-16T12:00:00Z'));
    expect(r!.repetitions).toBe(0);
    expect(r!.interval).toBe(1);
    expect(r!.easeFactor).toBe(2.4);
  });

  test('reviewUserCard: ease factor floor at 1.3', async () => {
    mod = await import('./storage');
    const c = mod.addUserCard('c1', '01', 'f', 'b');
    // 6 wrong reviews: ease = 2.5 - 6*0.2 = 1.3
    mod.reviewUserCard(c.id, false, new Date('2024-06-15T12:00:00Z'));
    mod.reviewUserCard(c.id, false, new Date('2024-06-16T12:00:00Z'));
    mod.reviewUserCard(c.id, false, new Date('2024-06-17T12:00:00Z'));
    mod.reviewUserCard(c.id, false, new Date('2024-06-18T12:00:00Z'));
    mod.reviewUserCard(c.id, false, new Date('2024-06-19T12:00:00Z'));
    const r = mod.reviewUserCard(c.id, false, new Date('2024-06-20T12:00:00Z'));
    expect(r!.easeFactor).toBe(1.3);
  });

  test('reviewUserCard returns null for missing card', async () => {
    mod = await import('./storage');
    expect(mod.reviewUserCard('nonexistent', true)).toBeNull();
  });

  test('toggleUserCardStar toggles star', async () => {
    mod = await import('./storage');
    const c = mod.addUserCard('c1', '01', 'f', 'b');
    expect(mod.getUserCardById(c.id)!.isStarred).toBe(false);
    mod.toggleUserCardStar(c.id);
    expect(mod.getUserCardById(c.id)!.isStarred).toBe(true);
    mod.toggleUserCardStar(c.id);
    expect(mod.getUserCardById(c.id)!.isStarred).toBe(false);
  });

  test('toggleUserCardStar returns null for missing card', async () => {
    mod = await import('./storage');
    expect(mod.toggleUserCardStar('nonexistent')).toBeNull();
  });
});

describe('edge cases', () => {
  test('handles missing file: load returns empty storage', async () => {
    state.exists = false;
    mod = await import('./storage');
    expect(mod.getHighlightsForModule('c1', '01')).toEqual([]);
    expect(mod.getNotesForModule('c1', '01')).toEqual([]);
    expect(mod.getAllBookmarks()).toEqual([]);
    const c = mod.addUserCard('c1', '01', 'f', 'b');
    expect(c.front).toBe('f');
  });

  test('handles corrupted JSON file', async () => {
    state.data = 'not valid json{{{';
    mod = await import('./storage');
    const h = mod.addHighlight('c1', '01', 'survived', 0, 8);
    expect(h.selectedText).toBe('survived');
    expect(mod.getHighlightsForModule('c1', '01')).toHaveLength(1);
  });
});
