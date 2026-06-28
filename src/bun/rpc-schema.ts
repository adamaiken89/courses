import type { RPCSchema } from 'electrobun/bun';
import type { MetaField } from './lesson-markdown';
import type { CourseStats, GlobalStats } from './stats';
import type { SearchResult } from './search';
import type {
  Bookmark,
  Course,
  Highlight,
  ModuleMeta,
  Note,
  QuizQuestion,
  Section,
  SRSCard,
  SRSDeck,
  UserCard,
} from './types';

export interface QuizState {
  currentIndex: number;
  selectedAnswers: Record<string, string>;
  isCompleted: boolean;
  currentQuestion: QuizQuestion | null;
  score: { correct: number; total: number };
  percentage: number;
}

export interface LessonResponse {
  content: string;
  h1: string;
  meta: MetaField[];
  sections: Section[];
  bodyContent: string;
}

export interface SyncStatus {
  lastSyncTime: string | null;
  lastSyncedCommit: string | null;
  isSyncing: boolean;
  remoteRepoURL: string;
}

export interface SyncResult {
  success: boolean;
  commitHash: string;
  message: string;
  unchanged?: boolean;
}

export interface SemesterInfo {
  name: string;
  courses: string[];
}

export type CourseRequests = {
  coursesList: { params: void; response: Course[] };
  modulesList: { params: { courseId: string }; response: ModuleMeta[] };
  loadLesson: { params: { courseId: string; moduleId: string }; response: LessonResponse };
  loadQuiz: { params: { courseId: string; moduleId: string }; response: QuizQuestion[] };
  getSections: { params: { courseId: string; moduleId: string }; response: Section[] };
  search: { params: { query: string; courseID?: string }; response: SearchResult[] };
  quizStart: { params: { courseId: string; moduleId: string }; response: QuizQuestion[] };
};

export type SRSRequests = {
  getSRSDeck: { params: { courseId: string }; response: SRSDeck };
  filterSRSCards: { params: { courseId: string; filter: string }; response: SRSCard[] };
  toggleSRSStar: { params: { courseId: string; cardId: string }; response: SRSDeck };
  reviewSRSCard: {
    params: { courseId: string; cardId: string; correct: boolean; deck: SRSDeck };
    response: SRSCard;
  };
  createSRSCard: {
    params: { courseId: string; question: QuizQuestion; moduleId: string };
    response: SRSCard;
  };
};

export type AnnotationRequests = {
  getHighlights: { params: { courseID: string; moduleID: string }; response: Highlight[] };
  addHighlight: {
    params: {
      courseID: string;
      moduleID: string;
      selectedText: string;
      startOffset: number;
      endOffset: number;
      color?: string;
    };
    response: Highlight;
  };
  deleteHighlight: { params: { id: string }; response: { ok: true } };
  addAnnotation: {
    params: {
      courseID: string;
      moduleID: string;
      selectedText: string;
      startOffset: number;
      endOffset: number;
      color: string;
      noteContent: string;
    };
    response: { highlight: Highlight; note: Note };
  };
  getNotes: { params: { courseID: string; moduleID: string }; response: Note[] };
  addNote: {
    params: {
      courseID: string;
      moduleID: string;
      content: string;
      highlightID?: string;
      sectionID?: string;
    };
    response: Note;
  };
  updateNote: { params: { id: string; content: string }; response: { ok: true } };
  deleteNote: { params: { id: string }; response: { ok: true } };
  getAllBookmarks: { params: void; response: Bookmark[] };
  getCourseBookmarks: { params: { courseID: string }; response: Bookmark[] };
  getModuleBookmarks: { params: { courseID: string; moduleID: string }; response: Bookmark[] };
  addBookmark: {
    params: {
      courseID: string;
      moduleID: string;
      title: string;
      sectionID?: string;
      scrollPosition?: number;
    };
    response: Bookmark;
  };
  deleteBookmark: { params: { id: string }; response: { ok: true } };
  checkBookmark: { params: { courseID: string; moduleID: string }; response: boolean };
};

export type ProgressRequests = {
  isModuleCompleted: { params: { courseID: string; moduleID: string }; response: boolean };
  toggleModuleCompleted: { params: { courseID: string; moduleID: string }; response: boolean };
  getCompletedModuleIDs: { params: { courseID: string }; response: string[] };
  getCompletedModuleCount: { params: { courseID: string }; response: number };
  logSession: {
    params: {
      courseID: string;
      moduleID: string;
      durationMinutes: number;
      type: 'reading' | 'quiz' | 'review';
      score?: number;
      total?: number;
    };
    response: { ok: true };
  };
  getCourseStats: { params: { courseId: string }; response: CourseStats };
  getGlobalStats: { params: void; response: GlobalStats };
  geminiHasKey: { params: void; response: boolean };
  geminiSetKey: { params: { key: string }; response: { ok: true } };
  geminiAsk: { params: { question: string; context: string }; response: string };
};

export type SyncRequests = {
  getSyncStatus: { params: void; response: SyncStatus };
  syncStart: { params: void; response: SyncResult };
  syncSetURL: { params: { remoteRepoURL: string }; response: { ok: true } };
};

export type UserCardRequests = {
  getUserCards: { params: { courseId?: string; moduleId?: string }; response: UserCard[] };
  addUserCard: {
    params: { courseId: string; moduleId: string; front: string; back: string };
    response: UserCard;
  };
  deleteUserCard: { params: { id: string }; response: { ok: true } };
  reviewUserCard: { params: { id: string; correct: boolean }; response: UserCard | null };
  toggleUserCardStar: { params: { id: string }; response: UserCard | null };
};

export type AppRequests = CourseRequests &
  SRSRequests &
  AnnotationRequests &
  ProgressRequests &
  SyncRequests &
  UserCardRequests & {
    clearAllData: { params: void; response: { ok: true } };
  };

export type AppSchema = {
  bun: RPCSchema<{ requests: AppRequests }>;
  webview: RPCSchema;
};
