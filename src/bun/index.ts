import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from 'bun';
import { BrowserWindow, Updater } from 'electrobun/bun';
import * as CourseLoader from './course-loader';
import * as Storage from './storage';
import * as Gemini from './gemini';
import { QuizEngine } from './quiz-engine';
import {
  getDueCardsForCourse,
  getStarredCardsForCourse,
  getCardsForCourse,
  toggleStar,
} from './srs';
import { createSRSCard, performReview } from './srs';
import * as Search from './search';
import * as Stats from './stats';
import * as Sync from './sync';
import { logger } from './logger';
import type { QuizQuestion, SRSDeck } from './types';
import { processLessonMarkdown } from './lesson-markdown';

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

const API_PORT = 50001;

let _quizEngine: QuizEngine | null = null;

function getQuizEngine(): QuizEngine {
  if (!_quizEngine) _quizEngine = new QuizEngine();
  return _quizEngine;
}

const app = new Hono();

app.use('/*', cors());

app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  logger.info({
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    duration: `${duration}ms`,
  });
});

app.onError((err, c) => {
  logger.error({ err: err.message, path: c.req.path }, 'Unhandled error');
  return c.json({ error: err.message }, 500);
});

app.notFound((c) => {
  logger.warn({ path: c.req.path }, 'Route not found');
  return c.json({ error: 'Not found' }, 404);
});

// --- Stats ---

app.get('/api/stats/:courseId', (c) => {
  try {
    return c.json(Stats.getCourseStats(c.req.param('courseId')));
  } catch (e) {
    logger.error(
      { err: (e as Error).message, courseId: c.req.param('courseId') },
      'Failed to get stats',
    );
    return c.json({ error: (e as Error).message }, 404);
  }
});

app.get('/api/stats/global', (c) => c.json(Stats.getGlobalStats()));

app.post('/api/stats/session', async (c) => {
  const body = (await c.req.json()) as {
    courseID: string;
    moduleID: string | number;
    durationMinutes: number;
    type: 'reading' | 'quiz' | 'review';
    score?: number;
    total?: number;
  };
  Storage.addStudySession(body);
  return c.json({ ok: true });
});

// --- Search ---

app.get('/api/search', (c) => {
  const q = c.req.query('q') || '';
  const courseID = c.req.query('courseID') || undefined;
  return c.json(Search.searchAll(q, courseID));
});

// --- Courses ---

app.get('/api/courses', (c) => c.json(CourseLoader.loadCourses()));

app.get('/api/courses/:courseId/modules', (c) => {
  const courses = CourseLoader.loadCourses();
  const course = courses.find((s) => s.id === c.req.param('courseId'));
  return c.json(course?.modules || []);
});

// --- Lesson & Quiz ---

app.get('/api/courses/:courseId/modules/:moduleId/lesson', (c) => {
  const content = CourseLoader.loadLesson(c.req.param('courseId'), c.req.param('moduleId'));
  const processed = processLessonMarkdown(content);
  return c.json({ content, ...processed });
});

app.get('/api/courses/:courseId/modules/:moduleId/quiz', (c) => {
  return c.json(CourseLoader.loadQuiz(c.req.param('courseId'), c.req.param('moduleId')));
});

app.get('/api/courses/:courseId/modules/:moduleId/sections', (c) => {
  const content = CourseLoader.loadLesson(c.req.param('courseId'), c.req.param('moduleId'));
  const processed = processLessonMarkdown(content);
  return c.json(processed.sections);
});

// --- SRS ---

app.get('/api/courses/:courseId/srs', (c) => {
  const deck = CourseLoader.loadSRSDeck(c.req.param('courseId'));
  return c.json(deck);
});

app.post('/api/courses/:courseId/srs', async (c) => {
  const body = (await c.req.json()) as { cardId: string };
  const courseId = c.req.param('courseId');
  const deck = CourseLoader.loadSRSDeck(courseId);
  const updated = toggleStar(deck, body.cardId);
  CourseLoader.saveSRSDeck(updated, courseId);
  return c.json(updated);
});

app.post('/api/courses/:courseId/srs/review', async (c) => {
  const body = (await c.req.json()) as { cardId: string; correct: boolean; deck: SRSDeck };
  const courseId = c.req.param('courseId');
  const deck = body.deck || CourseLoader.loadSRSDeck(courseId);
  const card = deck.cards[body.cardId];
  if (!card) return c.json({ error: 'Card not found' }, 404);
  const updatedCard = performReview(card, body.correct);
  deck.cards[body.cardId] = updatedCard;
  CourseLoader.saveSRSDeck(deck, courseId);
  return c.json(updatedCard);
});

app.post('/api/courses/:courseId/srs/create', async (c) => {
  const body = (await c.req.json()) as { question: QuizQuestion; moduleId: string | number };
  const courseId = c.req.param('courseId');
  const card = createSRSCard(body.question, body.moduleId, courseId);
  const deck = CourseLoader.loadSRSDeck(courseId);
  deck.cards[card.id] = card;
  CourseLoader.saveSRSDeck(deck, courseId);
  return c.json(card);
});

app.get('/api/courses/:courseId/srs/filter/:filter', (c) => {
  const deck = CourseLoader.loadSRSDeck(c.req.param('courseId'));
  switch (c.req.param('filter')) {
    case 'due':
      return c.json(getDueCardsForCourse(deck, c.req.param('courseId')));
    case 'starred':
      return c.json(getStarredCardsForCourse(deck, c.req.param('courseId')));
    default:
      return c.json(getCardsForCourse(deck, c.req.param('courseId')));
  }
});

// --- Storage: Highlights ---

app.get('/api/storage/highlights', (c) => {
  const courseID = c.req.query('courseID')!;
  const moduleID = c.req.query('moduleID')!;
  return c.json(Storage.getHighlightsForModule(courseID, moduleID));
});

app.post('/api/storage/highlights', async (c) => {
  const body = (await c.req.json()) as {
    courseID: string;
    moduleID: string | number;
    selectedText: string;
    startOffset: number;
    endOffset: number;
    color?: string;
  };
  const highlight = Storage.addHighlight(
    body.courseID,
    body.moduleID,
    body.selectedText,
    body.startOffset,
    body.endOffset,
    body.color,
  );
  return c.json(highlight, 201);
});

app.delete('/api/storage/highlights/:id', (c) => {
  Storage.deleteHighlight(c.req.param('id'));
  return c.json({ ok: true });
});

// --- Storage: Notes ---

app.get('/api/storage/notes', (c) => {
  const courseID = c.req.query('courseID')!;
  const moduleID = c.req.query('moduleID')!;
  return c.json(Storage.getNotesForModule(courseID, moduleID));
});

app.post('/api/storage/notes', async (c) => {
  const body = (await c.req.json()) as {
    courseID: string;
    moduleID: string | number;
    content: string;
    highlightID?: string;
    sectionID?: string;
  };
  const note = Storage.addNote(
    body.courseID,
    body.moduleID,
    body.content,
    body.highlightID,
    body.sectionID,
  );
  return c.json(note, 201);
});

app.put('/api/storage/notes/:id', async (c) => {
  const body = (await c.req.json()) as { content: string };
  Storage.updateNote(c.req.param('id'), body.content);
  return c.json({ ok: true });
});

app.post('/api/storage/annotations', async (c) => {
  const body = (await c.req.json()) as {
    courseID: string;
    moduleID: string | number;
    selectedText: string;
    startOffset: number;
    endOffset: number;
    color: string;
    noteContent: string;
  };
  const result = Storage.addAnnotation(body);
  return c.json(result, 201);
});

app.delete('/api/storage/notes/:id', (c) => {
  Storage.deleteNote(c.req.param('id'));
  return c.json({ ok: true });
});

// --- Storage: Bookmarks ---

app.get('/api/storage/bookmarks', (c) => c.json(Storage.getAllBookmarks()));

app.get('/api/storage/bookmarks/course/:courseID', (c) =>
  c.json(Storage.getBookmarksForCourse(c.req.param('courseID'))),
);

app.post('/api/storage/bookmarks', async (c) => {
  const body = (await c.req.json()) as {
    courseID: string;
    moduleID: string | number;
    title: string;
    sectionID?: string;
    scrollPosition?: number;
  };
  const bookmark = Storage.addBookmark(
    body.courseID,
    body.moduleID,
    body.title,
    body.sectionID,
    body.scrollPosition,
  );
  return c.json(bookmark, 201);
});

app.delete('/api/storage/bookmarks/:id', (c) => {
  Storage.deleteBookmark(c.req.param('id'));
  return c.json({ ok: true });
});

app.get('/api/storage/bookmarks/module/:courseID/:moduleID', (c) =>
  c.json(Storage.getBookmarksForModule(c.req.param('courseID'), c.req.param('moduleID'))),
);

app.get('/api/storage/check-bookmark', (c) => {
  const courseID = c.req.query('courseID')!;
  const moduleID = c.req.query('moduleID')!;
  return c.json(Storage.isBookmarked(courseID, moduleID));
});

// --- Storage: Completion ---

app.get('/api/storage/completed', (c) => {
  const courseID = c.req.query('courseID')!;
  const moduleID = c.req.query('moduleID')!;
  return c.json({ completed: Storage.isModuleCompleted(courseID, moduleID) });
});

app.post('/api/storage/completed', async (c) => {
  const body = (await c.req.json()) as { courseID: string; moduleID: string | number };
  const completed = Storage.toggleModuleCompleted(body.courseID, body.moduleID);
  return c.json({ completed });
});

app.get('/api/storage/completed/count', (c) => {
  const courseID = c.req.query('courseID')!;
  return c.json({ count: Storage.getCompletedModuleCount(courseID) });
});

// --- Gemini ---

app.get('/api/gemini/key', (c) => c.json({ hasKey: Gemini.hasAPIKey() }));

app.post('/api/gemini/key', async (c) => {
  const body = (await c.req.json()) as { key: string };
  Gemini.setAPIKey(body.key);
  return c.json({ ok: true });
});

app.post('/api/gemini/ask', async (c) => {
  const body = (await c.req.json()) as { question: string; context: string };
  try {
    const response = await Gemini.askGemini(body.question, body.context);
    return c.json({ response });
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'Gemini ask failed');
    return c.json({ error: (err as Error).message }, 400);
  }
});

// --- Quiz Engine ---

app.post('/api/quiz/start', async (c) => {
  const body = (await c.req.json()) as { courseId: string; moduleId: string | number };
  const questions = CourseLoader.loadQuiz(body.courseId, body.moduleId);
  const engine = new QuizEngine();
  engine.load(questions, body.courseId, body.moduleId);
  _quizEngine = engine;
  return c.json(questions);
});

app.get('/api/quiz/state', (c) => {
  const engine = getQuizEngine();
  return c.json({
    currentIndex: engine.currentIndex,
    selectedAnswers: engine.selectedAnswers,
    isCompleted: engine.isCompleted,
    currentQuestion: engine.currentQuestion,
    score: engine.score,
    percentage: engine.percentage,
  });
});

app.post('/api/quiz/select', async (c) => {
  const body = (await c.req.json()) as { answer: string };
  getQuizEngine().selectAnswer(body.answer);
  return c.json({ ok: true });
});

app.post('/api/quiz/next', (c) => {
  getQuizEngine().nextQuestion();
  return c.json({ ok: true });
});

app.post('/api/quiz/reset', (c) => {
  getQuizEngine().reset();
  return c.json({ ok: true });
});

// --- UserCard ---

app.get('/api/usercards', (c) => {
  const courseId = c.req.query('courseId') || undefined;
  const moduleId = c.req.query('moduleId') || undefined;
  return c.json(Storage.getUserCards(courseId, moduleId));
});

app.post('/api/usercards', async (c) => {
  const body = (await c.req.json()) as {
    courseId: string;
    moduleId: string | number;
    front: string;
    back: string;
  };
  const card = Storage.addUserCard(body.courseId, body.moduleId, body.front, body.back);
  return c.json(card, 201);
});

app.delete('/api/usercards/:id', (c) => {
  Storage.deleteUserCard(c.req.param('id'));
  return c.json({ ok: true });
});

app.post('/api/usercards/:id/review', async (c) => {
  const body = (await c.req.json()) as { correct: boolean };
  const card = Storage.reviewUserCard(c.req.param('id'), body.correct);
  if (!card) return c.json({ error: 'Card not found' }, 404);
  return c.json(card);
});

app.post('/api/usercards/:id/star', (c) => {
  const card = Storage.toggleUserCardStar(c.req.param('id'));
  if (!card) return c.json({ error: 'Card not found' }, 404);
  return c.json(card);
});

// --- Sync ---

app.get('/api/sync/status', (c) => {
  const config = Storage.getSyncConfig();
  return c.json({
    lastSyncTime: config.lastSyncTime,
    lastSyncedCommit: config.lastSyncedCommit,
    isSyncing: Sync.isSyncing(),
    remoteRepoURL: config.remoteRepoURL,
  });
});

app.post('/api/sync/start', async (c) => {
  const result = await Sync.syncCourses();
  return c.json(result);
});

app.post('/api/sync/config', async (c) => {
  const body = (await c.req.json()) as { remoteRepoURL: string };
  Storage.saveSyncConfig({ remoteRepoURL: body.remoteRepoURL });
  return c.json({ ok: true });
});

// --- Start server ---

async function getMainViewUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === 'dev') {
    try {
      await fetch(DEV_SERVER_URL, { method: 'HEAD' });
      logger.info(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
      return `${DEV_SERVER_URL}?apiPort=${API_PORT}`;
    } catch {
      logger.warn("Vite dev server not running. Run 'bun run dev:hmr' for HMR.");
    }
  }
  return `views://mainview/index.html?apiPort=${API_PORT}`;
}

const server = serve({
  port: API_PORT,
  fetch: app.fetch,
});

logger.info({ port: API_PORT }, 'API server running');

const syncConfig = Storage.getSyncConfig();
if (syncConfig.remoteRepoURL) {
  Sync.syncCourses()
    .then((result) => {
      if (!result.unchanged) logger.info({ message: result.message }, 'Auto-sync');
    })
    .catch((err) => logger.error({ err }, 'Auto-sync failed'));
}

try {
  const mainViewUrl = await getMainViewUrl();
  new BrowserWindow({
    title: 'CourseReader',
    url: mainViewUrl,
    frame: {
      width: 1100,
      height: 800,
      x: 200,
      y: 200,
    },
  });
  logger.info('CourseReader started');
} catch (err) {
  logger.info('BrowserWindow not available (running standalone API server)');
}

process.on('beforeExit', () => {
  server.stop();
});
