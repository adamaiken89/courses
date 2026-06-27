import type { SearchResult } from '../bun/search';
import type { CourseStats, GlobalStats } from '../bun/stats';
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
} from '../bun/types';
import { logger } from './logger';
import { showToast } from './toast';

const API_PORT = new URLSearchParams(window.location.search).get('apiPort') ?? '50001';
const BASE = `http://localhost:${API_PORT}/api`;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const method = options?.method ?? 'GET';
  logger.debug({ method, path }, 'API request');
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const message = err.error || `HTTP ${res.status}`;
    logger.error({ status: res.status, path, method }, `API error: ${message}`);
    showToast.error('toast.apiError', { values: { message } });
    throw new Error(message);
  }
  logger.debug({ status: res.status, path }, 'API response');
  return res.json();
}

import type { MetaField } from '../bun/lesson-markdown';

interface LessonResponse {
  content: string;
  h1: string;
  meta: MetaField[];
  sections: Section[];
  bodyContent: string;
}

interface OkResponse {
  ok: true;
}

interface QuizState {
  currentIndex: number;
  selectedAnswers: Record<string, string>;
  isCompleted: boolean;
  currentQuestion: QuizQuestion | null;
  score: { correct: number; total: number };
  percentage: number;
}

export const api = {
  search: (q: string, courseID?: string) =>
    request<SearchResult[]>(
      `/search?q=${encodeURIComponent(q)}${courseID ? `&courseID=${encodeURIComponent(courseID)}` : ''}`,
    ),
  stats: {
    course: (courseID: string) => request<CourseStats>(`/stats/${courseID}`),
    global: () => request<GlobalStats>('/stats/global'),
    logSession: (data: {
      courseID: string;
      moduleID: string;
      durationMinutes: number;
      type: 'reading' | 'quiz' | 'review';
      score?: number;
      total?: number;
    }) => request<{ ok: true }>('/stats/session', { method: 'POST', body: JSON.stringify(data) }),
  },
  courses: {
    list: () => request<Course[]>('/courses'),
    modules: (courseId: string) => request<ModuleMeta[]>(`/courses/${courseId}/modules`),
    lesson: (courseId: string, moduleId: string) =>
      request<LessonResponse>(`/courses/${courseId}/modules/${moduleId}/lesson`),
    quiz: (courseId: string, moduleId: string) =>
      request<QuizQuestion[]>(`/courses/${courseId}/modules/${moduleId}/quiz`),
    sections: (courseId: string, moduleId: string) =>
      request<Section[]>(`/courses/${courseId}/modules/${moduleId}/sections`),
    srs: {
      get: (courseId: string) => request<SRSDeck>(`/courses/${courseId}/srs`),
      filter: (courseId: string, filter: string) =>
        request<SRSCard[]>(`/courses/${courseId}/srs/filter/${filter}`),
      toggleStar: (courseId: string, cardId: string) =>
        request<SRSDeck>(`/courses/${courseId}/srs`, {
          method: 'POST',
          body: JSON.stringify({ cardId }),
        }),
      review: (courseId: string, cardId: string, correct: boolean, deck: SRSDeck) =>
        request<SRSCard>(`/courses/${courseId}/srs/review`, {
          method: 'POST',
          body: JSON.stringify({ cardId, correct, deck }),
        }),
      create: (courseId: string, question: QuizQuestion, moduleId: string) =>
        request<SRSCard>(`/courses/${courseId}/srs/create`, {
          method: 'POST',
          body: JSON.stringify({ question, moduleId }),
        }),
    },
  },
  quiz: {
    start: (courseId: string, moduleId: string) =>
      request<QuizQuestion[]>('/quiz/start', {
        method: 'POST',
        body: JSON.stringify({ courseId, moduleId }),
      }),
    state: () => request<QuizState>('/quiz/state'),
    select: (answer: string) =>
      request<OkResponse>('/quiz/select', {
        method: 'POST',
        body: JSON.stringify({ answer }),
      }),
    next: () => request<OkResponse>('/quiz/next', { method: 'POST' }),
    reset: () => request<OkResponse>('/quiz/reset', { method: 'POST' }),
  },
  storage: {
    highlights: (courseID: string, moduleID: string) =>
      request<Highlight[]>(
        `/storage/highlights?courseID=${encodeURIComponent(courseID)}&moduleID=${moduleID}`,
      ),
    addHighlight: (data: {
      courseID: string;
      moduleID: string;
      selectedText: string;
      startOffset: number;
      endOffset: number;
      color?: string;
    }) => request<Highlight>('/storage/highlights', { method: 'POST', body: JSON.stringify(data) }),
    addAnnotation: (data: {
      courseID: string;
      moduleID: string;
      selectedText: string;
      startOffset: number;
      endOffset: number;
      color: string;
      noteContent: string;
    }) =>
      request<{ highlight: Highlight; note: Note }>('/storage/annotations', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    deleteHighlight: (id: string) =>
      request<OkResponse>(`/storage/highlights/${id}`, { method: 'DELETE' }),
    notes: (courseID: string, moduleID: string) =>
      request<Note[]>(
        `/storage/notes?courseID=${encodeURIComponent(courseID)}&moduleID=${moduleID}`,
      ),
    addNote: (data: {
      courseID: string;
      moduleID: string;
      content: string;
      highlightID?: string;
      sectionID?: string;
    }) => request<Note>('/storage/notes', { method: 'POST', body: JSON.stringify(data) }),
    updateNote: (id: string, content: string) =>
      request<OkResponse>(`/storage/notes/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      }),
    deleteNote: (id: string) => request<OkResponse>(`/storage/notes/${id}`, { method: 'DELETE' }),
    bookmarks: () => request<Bookmark[]>('/storage/bookmarks'),
    courseBookmarks: (courseID: string) =>
      request<Bookmark[]>(`/storage/bookmarks/course/${courseID}`),
    moduleBookmarks: (courseID: string, moduleID: string) =>
      request<Bookmark[]>(`/storage/bookmarks/module/${courseID}/${moduleID}`),
    addBookmark: (data: {
      courseID: string;
      moduleID: string;
      title: string;
      sectionID?: string;
      scrollPosition?: number;
    }) => request<Bookmark>('/storage/bookmarks', { method: 'POST', body: JSON.stringify(data) }),
    deleteBookmark: (id: string) =>
      request<OkResponse>(`/storage/bookmarks/${id}`, { method: 'DELETE' }),
    checkBookmark: (courseID: string, moduleID: string) =>
      request<boolean>(
        `/storage/check-bookmark?courseID=${encodeURIComponent(courseID)}&moduleID=${moduleID}`,
      ),
    completedModules: (courseID: string) =>
      request<{ moduleIDs: string[] }>(
        `/storage/completed/modules?courseID=${encodeURIComponent(courseID)}`,
      ),
    isCompleted: (courseID: string, moduleID: string) =>
      request<{ completed: boolean }>(
        `/storage/completed?courseID=${encodeURIComponent(courseID)}&moduleID=${moduleID}`,
      ),
    toggleCompleted: (courseID: string, moduleID: string) =>
      request<{ completed: boolean }>('/storage/completed', {
        method: 'POST',
        body: JSON.stringify({ courseID, moduleID }),
      }),
    completedCount: (courseID: string) =>
      request<{ count: number }>(
        `/storage/completed/count?courseID=${encodeURIComponent(courseID)}`,
      ),
    clearAll: () => request<OkResponse>('/storage/clear', { method: 'POST' }),
  },
  usercards: {
    list: (courseId?: string, moduleId?: string) => {
      const params = new URLSearchParams();
      if (courseId) params.set('courseId', courseId);
      if (moduleId !== undefined) params.set('moduleId', moduleId);
      return request<UserCard[]>(`/usercards?${params.toString()}`);
    },
    create: (courseId: string, moduleId: string, front: string, back: string) =>
      request<UserCard>('/usercards', {
        method: 'POST',
        body: JSON.stringify({ courseId, moduleId, front, back }),
      }),
    delete: (id: string) =>
      request<OkResponse>(`/usercards/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    review: (id: string, correct: boolean) =>
      request<UserCard>(`/usercards/${encodeURIComponent(id)}/review`, {
        method: 'POST',
        body: JSON.stringify({ correct }),
      }),
    toggleStar: (id: string) =>
      request<UserCard>(`/usercards/${encodeURIComponent(id)}/star`, { method: 'POST' }),
  },
  gemini: {
    hasKey: () => request<{ hasKey: boolean }>('/gemini/key'),
    setKey: (key: string) =>
      request<OkResponse>('/gemini/key', { method: 'POST', body: JSON.stringify({ key }) }),
    ask: (question: string, context: string) =>
      request<{ response: string }>('/gemini/ask', {
        method: 'POST',
        body: JSON.stringify({ question, context }),
      }),
  },
  sync: {
    status: () =>
      request<{
        lastSyncTime: string | null;
        lastSyncedCommit: string | null;
        isSyncing: boolean;
        remoteRepoURL: string;
      }>('/sync/status'),
    start: () =>
      request<{
        success: boolean;
        commitHash: string;
        message: string;
        unchanged?: boolean;
      }>('/sync/start', { method: 'POST' }),
    setURL: (url: string) =>
      request<OkResponse>('/sync/config', {
        method: 'POST',
        body: JSON.stringify({ remoteRepoURL: url }),
      }),
  },
};
