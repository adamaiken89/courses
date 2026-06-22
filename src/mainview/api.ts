import type { Subject, ModuleMeta, QuizQuestion, ModuleSection, SRSDeck, SRSCard, Highlight, Note, Bookmark } from "../../bun/types";

const API_PORT = new URLSearchParams(window.location.search).get("apiPort") || "50001";
const BASE = `http://localhost:${API_PORT}/api`;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
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
  subjects: {
    list: () => request<Subject[]>("/subjects"),
    modules: (subjectId: string) => request<ModuleMeta[]>(`/subjects/${subjectId}/modules`),
    lesson: (subjectId: string, moduleId: number) =>
      request<{ content: string }>(`/subjects/${subjectId}/modules/${moduleId}/lesson`),
    quiz: (subjectId: string, moduleId: number) =>
      request<QuizQuestion[]>(`/subjects/${subjectId}/modules/${moduleId}/quiz`),
    sections: (subjectId: string, moduleId: number) =>
      request<ModuleSection[]>(`/subjects/${subjectId}/modules/${moduleId}/sections`),
    srs: {
      get: (subjectId: string) => request<SRSDeck>(`/subjects/${subjectId}/srs`),
      filter: (subjectId: string, filter: string) =>
        request<SRSCard[]>(`/subjects/${subjectId}/srs/filter/${filter}`),
      toggleStar: (subjectId: string, cardId: string) =>
        request<SRSDeck>(`/subjects/${subjectId}/srs`, {
          method: "POST",
          body: JSON.stringify({ cardId }),
        }),
      review: (subjectId: string, cardId: string, correct: boolean, deck: SRSDeck) =>
        request<SRSCard>(`/subjects/${subjectId}/srs/review`, {
          method: "POST",
          body: JSON.stringify({ cardId, correct, deck }),
        }),
      create: (subjectId: string, question: QuizQuestion, moduleId: number) =>
        request<SRSCard>(`/subjects/${subjectId}/srs/create`, {
          method: "POST",
          body: JSON.stringify({ question, moduleId }),
        }),
    },
  },
  quiz: {
    start: (subjectId: string, moduleId: number) =>
      request<QuizQuestion[]>("/quiz/start", {
        method: "POST",
        body: JSON.stringify({ subjectId, moduleId }),
      }),
    state: () => request<QuizState>("/quiz/state"),
    select: (answer: string) =>
      request<OkResponse>("/quiz/select", {
        method: "POST",
        body: JSON.stringify({ answer }),
      }),
    next: () => request<OkResponse>("/quiz/next", { method: "POST" }),
    reset: () => request<OkResponse>("/quiz/reset", { method: "POST" }),
  },
  storage: {
    highlights: (subjectID: string, moduleID: number) =>
      request<Highlight[]>(`/storage/highlights?subjectID=${encodeURIComponent(subjectID)}&moduleID=${moduleID}`),
    addHighlight: (data: { subjectID: string; moduleID: number; selectedText: string; startOffset: number; endOffset: number; color?: string }) =>
      request<Highlight>("/storage/highlights", { method: "POST", body: JSON.stringify(data) }),
    deleteHighlight: (id: string) =>
      request<OkResponse>(`/storage/highlights/${id}`, { method: "DELETE" }),
    notes: (subjectID: string, moduleID: number) =>
      request<Note[]>(`/storage/notes?subjectID=${encodeURIComponent(subjectID)}&moduleID=${moduleID}`),
    addNote: (data: { subjectID: string; moduleID: number; content: string; highlightID?: string; sectionID?: string }) =>
      request<Note>("/storage/notes", { method: "POST", body: JSON.stringify(data) }),
    updateNote: (id: string, content: string) =>
      request<OkResponse>(`/storage/notes/${id}`, { method: "PUT", body: JSON.stringify({ content }) }),
    deleteNote: (id: string) =>
      request<OkResponse>(`/storage/notes/${id}`, { method: "DELETE" }),
    bookmarks: () => request<Bookmark[]>("/storage/bookmarks"),
    subjectBookmarks: (subjectID: string) =>
      request<Bookmark[]>(`/storage/bookmarks/subject/${subjectID}`),
    moduleBookmarks: (subjectID: string, moduleID: number) =>
      request<Bookmark[]>(`/storage/bookmarks/module/${subjectID}/${moduleID}`),
    addBookmark: (data: { subjectID: string; moduleID: number; title: string; sectionID?: string; scrollPosition?: number }) =>
      request<Bookmark>("/storage/bookmarks", { method: "POST", body: JSON.stringify(data) }),
    deleteBookmark: (id: string) =>
      request<OkResponse>(`/storage/bookmarks/${id}`, { method: "DELETE" }),
    checkBookmark: (subjectID: string, moduleID: number) =>
      request<boolean>(`/storage/check-bookmark?subjectID=${encodeURIComponent(subjectID)}&moduleID=${moduleID}`),
  },
  gemini: {
    hasKey: () => request<{ hasKey: boolean }>("/gemini/key"),
    setKey: (key: string) =>
      request<OkResponse>("/gemini/key", { method: "POST", body: JSON.stringify({ key }) }),
    ask: (question: string, context: string) =>
      request<{ response: string }>("/gemini/ask", {
        method: "POST",
        body: JSON.stringify({ question, context }),
      }),
  },
};
