import type { AppRequests } from '../bun/rpc-schema';
import type { QuizQuestion, SRSDeck } from '../bun/types';
import { logger } from './logger';
import { rpc as defaultRpc } from './rpc';
import { showToast } from './toast';

type TypedRPCRequest = {
  [K in keyof AppRequests]: (
    params: AppRequests[K]['params'],
  ) => Promise<AppRequests[K]['response']>;
};

let _rpcRequest = defaultRpc.request as TypedRPCRequest;

export type MockRPC = { request: Record<string, (...args: unknown[]) => Promise<unknown>> };

export function __setRPC(mock: typeof defaultRpc | MockRPC): void {
  _rpcRequest = mock.request as TypedRPCRequest;
}

async function request<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const message = (e as Error).message;
    logger.error({ err: message }, 'RPC error');
    showToast.error('toast.apiError', { values: { message } });
    throw e;
  }
}

export type ApiClient = typeof api;

export const api = {
  search: (q: string, courseID?: string) =>
    request(() => _rpcRequest.search({ query: q, courseID })),
  stats: {
    course: (courseId: string) => request(() => _rpcRequest.getCourseStats({ courseId })),
    global: () => request(() => _rpcRequest.getGlobalStats()),
    logSession: (data: {
      courseID: string;
      moduleID: string;
      durationMinutes: number;
      type: 'reading' | 'quiz' | 'review';
      score?: number;
      total?: number;
    }) => request(() => _rpcRequest.logSession(data)),
  },
  courses: {
    list: () => request(() => _rpcRequest.coursesList()),
    modules: (courseId: string) => request(() => _rpcRequest.modulesList({ courseId })),
    lesson: (courseId: string, moduleId: string) =>
      request(() => _rpcRequest.loadLesson({ courseId, moduleId })),
    quiz: (courseId: string, moduleId: string) =>
      request(() => _rpcRequest.loadQuiz({ courseId, moduleId })),
    sections: (courseId: string, moduleId: string) =>
      request(() => _rpcRequest.getSections({ courseId, moduleId })),
    srs: {
      get: (courseId: string) => request(() => _rpcRequest.getSRSDeck({ courseId })),
      filter: (courseId: string, filter: string) =>
        request(() => _rpcRequest.filterSRSCards({ courseId, filter })),
      toggleStar: (courseId: string, cardId: string) =>
        request(() => _rpcRequest.toggleSRSStar({ courseId, cardId })),
      review: (courseId: string, cardId: string, correct: boolean, deck: SRSDeck) =>
        request(() => _rpcRequest.reviewSRSCard({ courseId, cardId, correct, deck })),
      create: (courseId: string, question: QuizQuestion, moduleId: string) =>
        request(() => _rpcRequest.createSRSCard({ courseId, question, moduleId })),
    },
  },
  quiz: {
    start: (courseId: string, moduleId: string) =>
      request(() => _rpcRequest.quizStart({ courseId, moduleId })),
  },
  storage: {
    highlights: (courseID: string, moduleID: string) =>
      request(() => _rpcRequest.getHighlights({ courseID, moduleID })),
    addHighlight: (data: {
      courseID: string;
      moduleID: string;
      selectedText: string;
      startOffset: number;
      endOffset: number;
      color?: string;
    }) => request(() => _rpcRequest.addHighlight(data)),
    addAnnotation: (data: {
      courseID: string;
      moduleID: string;
      selectedText: string;
      startOffset: number;
      endOffset: number;
      color: string;
      noteContent: string;
    }) => request(() => _rpcRequest.addAnnotation(data)),
    deleteHighlight: (id: string) => request(() => _rpcRequest.deleteHighlight({ id })),
    notes: (courseID: string, moduleID: string) =>
      request(() => _rpcRequest.getNotes({ courseID, moduleID })),
    addNote: (data: {
      courseID: string;
      moduleID: string;
      content: string;
      highlightID?: string;
      sectionID?: string;
    }) => request(() => _rpcRequest.addNote(data)),
    updateNote: (id: string, content: string) =>
      request(() => _rpcRequest.updateNote({ id, content })),
    deleteNote: (id: string) => request(() => _rpcRequest.deleteNote({ id })),
    bookmarks: () => request(() => _rpcRequest.getAllBookmarks()),
    courseBookmarks: (courseID: string) =>
      request(() => _rpcRequest.getCourseBookmarks({ courseID })),
    moduleBookmarks: (courseID: string, moduleID: string) =>
      request(() => _rpcRequest.getModuleBookmarks({ courseID, moduleID })),
    addBookmark: (data: {
      courseID: string;
      moduleID: string;
      title: string;
      sectionID?: string;
      scrollPosition?: number;
    }) => request(() => _rpcRequest.addBookmark(data)),
    deleteBookmark: (id: string) => request(() => _rpcRequest.deleteBookmark({ id })),
    checkBookmark: (courseID: string, moduleID: string) =>
      request(() => _rpcRequest.checkBookmark({ courseID, moduleID })),
    completedModules: (courseID: string) =>
      request(() =>
        _rpcRequest.getCompletedModuleIDs({ courseID }).then((ids) => ({ moduleIDs: ids })),
      ),
    isCompleted: (courseID: string, moduleID: string) =>
      request(() =>
        _rpcRequest.isModuleCompleted({ courseID, moduleID }).then((v) => ({ completed: v })),
      ),
    toggleCompleted: (courseID: string, moduleID: string) =>
      request(() =>
        _rpcRequest.toggleModuleCompleted({ courseID, moduleID }).then((v) => ({ completed: v })),
      ),
    completedCount: (courseID: string) =>
      request(() => _rpcRequest.getCompletedModuleCount({ courseID }).then((v) => ({ count: v }))),
    clearAll: () => request(() => _rpcRequest.clearAllData()),
  },
  usercards: {
    list: (courseId?: string, moduleId?: string) =>
      request(() => _rpcRequest.getUserCards({ courseId, moduleId })),
    create: (courseId: string, moduleId: string, front: string, back: string) =>
      request(() => _rpcRequest.addUserCard({ courseId, moduleId, front, back })),
    delete: (id: string) => request(() => _rpcRequest.deleteUserCard({ id })),
    review: (id: string, correct: boolean) =>
      request(() => _rpcRequest.reviewUserCard({ id, correct })),
    toggleStar: (id: string) => request(() => _rpcRequest.toggleUserCardStar({ id })),
  },
  gemini: {
    hasKey: () => request(() => _rpcRequest.geminiHasKey().then((v) => ({ hasKey: v }))),
    setKey: (key: string) => request(() => _rpcRequest.geminiSetKey({ key })),
    ask: (question: string, context: string) =>
      request(() => _rpcRequest.geminiAsk({ question, context }).then((v) => ({ response: v }))),
  },
  sync: {
    status: () => request(() => _rpcRequest.getSyncStatus()),
    start: () => request(() => _rpcRequest.syncStart()),
    setURL: (url: string) => request(() => _rpcRequest.syncSetURL({ remoteRepoURL: url })),
  },
};
