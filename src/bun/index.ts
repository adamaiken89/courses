import { BrowserView, BrowserWindow, Updater } from 'electrobun/bun';
import type { AppSchema } from './rpcSchema';
import * as CourseLoader from './courseLoader';
import * as Storage from './storage';
import * as Gemini from './gemini';
import { processLessonMarkdown } from './lessonMarkdown';
import {
  getDueCardsForCourse,
  getStarredCardsForCourse,
  getCardsForCourse,
  toggleStar,
  createSRSCard,
  performReview,
} from './srs';
import * as Search from './search';
import * as Stats from './stats';
import * as Sync from './sync';
import { logger } from './logger';

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

const rpc = BrowserView.defineRPC<AppSchema>({
  maxRequestTime: 30000,
  handlers: {
    requests: {
      coursesList: () => CourseLoader.loadCourses(),

      modulesList: ({ courseId }) => {
        const courses = CourseLoader.loadCourses();
        const course = courses.find((s) => s.id === courseId);
        return course?.modules || [];
      },

      loadLesson: ({ courseId, moduleId }) => {
        const content = CourseLoader.loadLesson(courseId, moduleId);
        const processed = processLessonMarkdown(content);
        return { content, ...processed };
      },

      loadQuiz: ({ courseId, moduleId }) => CourseLoader.loadQuiz(courseId, moduleId),

      getSections: ({ courseId, moduleId }) => {
        const content = CourseLoader.loadLesson(courseId, moduleId);
        return processLessonMarkdown(content).sections;
      },

      search: ({ query, courseID }) => Search.searchAll(query, courseID),

      getSRSDeck: ({ courseId }) => CourseLoader.loadSRSDeck(courseId),

      filterSRSCards: ({ courseId, filter }) => {
        const deck = CourseLoader.loadSRSDeck(courseId);
        switch (filter) {
          case 'due':
            return getDueCardsForCourse(deck, courseId);
          case 'starred':
            return getStarredCardsForCourse(deck, courseId);
          default:
            return getCardsForCourse(deck, courseId);
        }
      },

      toggleSRSStar: ({ courseId, cardId }) => {
        const deck = CourseLoader.loadSRSDeck(courseId);
        const updated = toggleStar(deck, cardId);
        CourseLoader.saveSRSDeck(updated, courseId);
        return updated;
      },

      reviewSRSCard: ({ courseId, cardId, correct, deck }) => {
        const actualDeck = deck || CourseLoader.loadSRSDeck(courseId);
        const card = actualDeck.cards[cardId];
        if (!card) throw new Error('Card not found');
        const updatedCard = performReview(card, correct);
        actualDeck.cards[cardId] = updatedCard;
        CourseLoader.saveSRSDeck(actualDeck, courseId);
        return updatedCard;
      },

      createSRSCard: ({ courseId, question, moduleId }) => {
        const card = createSRSCard(question, moduleId, courseId);
        const deck = CourseLoader.loadSRSDeck(courseId);
        deck.cards[card.id] = card;
        CourseLoader.saveSRSDeck(deck, courseId);
        return card;
      },

      quizStart: ({ courseId, moduleId }) => CourseLoader.loadQuiz(courseId, moduleId),

      getHighlights: ({ courseID, moduleID }) => Storage.getHighlightsForModule(courseID, moduleID),

      addHighlight: ({ courseID, moduleID, selectedText, startOffset, endOffset, color }) =>
        Storage.addHighlight(courseID, moduleID, selectedText, startOffset, endOffset, color),

      deleteHighlight: async ({ id }) => {
        Storage.deleteHighlight(id);
        return { ok: true as const };
      },

      addAnnotation: (data) => Storage.addAnnotation(data),

      getNotes: ({ courseID, moduleID }) => Storage.getNotesForModule(courseID, moduleID),

      addNote: ({ courseID, moduleID, content, highlightID, sectionID }) =>
        Storage.addNote(courseID, moduleID, content, highlightID, sectionID),

      updateNote: async ({ id, content }) => {
        Storage.updateNote(id, content);
        return { ok: true as const };
      },

      deleteNote: async ({ id }) => {
        Storage.deleteNote(id);
        return { ok: true as const };
      },

      getAllBookmarks: () => Storage.getAllBookmarks(),

      getCourseBookmarks: ({ courseID }) => Storage.getBookmarksForCourse(courseID),

      getModuleBookmarks: ({ courseID, moduleID }) =>
        Storage.getBookmarksForModule(courseID, moduleID),

      addBookmark: ({ courseID, moduleID, title, sectionID, scrollPosition }) =>
        Storage.addBookmark(courseID, moduleID, title, sectionID, scrollPosition),

      deleteBookmark: async ({ id }) => {
        Storage.deleteBookmark(id);
        return { ok: true as const };
      },

      checkBookmark: ({ courseID, moduleID }) => Storage.isBookmarked(courseID, moduleID),

      isModuleCompleted: ({ courseID, moduleID }) => Storage.isModuleCompleted(courseID, moduleID),

      toggleModuleCompleted: ({ courseID, moduleID }) =>
        Storage.toggleModuleCompleted(courseID, moduleID),

      getCompletedModuleIDs: ({ courseID }) => Storage.getCompletedModuleIDs(courseID),

      getCompletedModuleCount: ({ courseID }) => Storage.getCompletedModuleCount(courseID),

      clearAllData: async () => {
        Storage.clearAllData();
        return { ok: true as const };
      },

      geminiHasKey: () => Gemini.hasAPIKey(),

      geminiSetKey: async ({ key }) => {
        Gemini.setAPIKey(key);
        return { ok: true as const };
      },

      geminiAsk: async ({ question, context }) => {
        const response = await Gemini.askGemini(question, context);
        return response;
      },

      logSession: async ({ courseID, moduleID, durationMinutes, type, score, total }) => {
        Storage.addStudySession({ courseID, moduleID, durationMinutes, type, score, total });
        return { ok: true as const };
      },

      getCourseStats: ({ courseId }) => Stats.getCourseStats(courseId),

      getGlobalStats: () => Stats.getGlobalStats(),

      getSyncStatus: () => {
        const config = Storage.getSyncConfig();
        return {
          lastSyncTime: config.lastSyncTime,
          lastSyncedCommit: config.lastSyncedCommit,
          isSyncing: Sync.isSyncing(),
          remoteRepoURL: config.remoteRepoURL,
        };
      },

      syncStart: async () => Sync.syncCourses(),

      syncSetURL: async ({ remoteRepoURL }) => {
        Storage.saveSyncConfig({ remoteRepoURL });
        return { ok: true as const };
      },

      getUserCards: ({ courseId, moduleId }) => Storage.getUserCards(courseId, moduleId),

      addUserCard: ({ courseId, moduleId, front, back }) =>
        Storage.addUserCard(courseId, moduleId, front, back),

      deleteUserCard: async ({ id }) => {
        Storage.deleteUserCard(id);
        return { ok: true as const };
      },

      reviewUserCard: ({ id, correct }) => Storage.reviewUserCard(id, correct),

      toggleUserCardStar: ({ id }) => Storage.toggleUserCardStar(id),
    },
  },
});

async function getMainViewUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === 'dev') {
    try {
      await fetch(DEV_SERVER_URL, { method: 'HEAD' });
      logger.info(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
      return DEV_SERVER_URL;
    } catch {
      logger.warn("Vite dev server not running. Run 'bun run dev:hmr' for HMR.");
    }
  }
  return 'views://mainview/index.html';
}

const channel = await Updater.localInfo.channel();
if (channel === 'dev') {
  const syncConfig = Storage.getSyncConfig();
  if (syncConfig.remoteRepoURL) {
    Sync.syncCourses()
      .then((result) => {
        if (!result.unchanged) logger.info({ message: result.message }, 'Auto-sync');
      })
      .catch((err) => logger.error({ err }, 'Auto-sync failed'));
  }
}

try {
  const mainViewUrl = await getMainViewUrl();
  new BrowserWindow({
    title: 'CourseReader',
    url: mainViewUrl,
    rpc,
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
