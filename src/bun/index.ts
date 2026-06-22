import { BrowserWindow, Updater } from "electrobun/bun";
import * as CourseLoader from "./course-loader";
import * as Storage from "./storage";
import * as Gemini from "./gemini";
import { QuizEngine } from "./quiz-engine";
import { getDueCardsForSubject, getStarredCardsForSubject, getCardsForSubject, toggleStar } from "./srs";
import { createSRSCard, performReview } from "./srs";
import type { QuizQuestion, SRSDeck } from "./types";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

const API_PORT = 50001;

let _quizEngine: QuizEngine | null = null;

function getQuizEngine(): QuizEngine {
  if (!_quizEngine) _quizEngine = new QuizEngine();
  return _quizEngine;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

const router = {
  "GET /api/subjects": () => jsonResponse(CourseLoader.loadSubjects()),
  "GET /api/subjects/:subjectId/modules": (_params: Record<string, string>) => {
    const subjects = CourseLoader.loadSubjects();
    const subject = subjects.find((s) => s.id === _params.subjectId);
    return jsonResponse(subject?.modules || []);
  },
  "GET /api/subjects/:subjectId/modules/:moduleId/lesson": (params: Record<string, string>) => {
    return jsonResponse({ content: CourseLoader.loadLesson(params.subjectId, Number(params.moduleId)) });
  },
  "GET /api/subjects/:subjectId/modules/:moduleId/quiz": (params: Record<string, string>) => {
    return jsonResponse(CourseLoader.loadQuiz(params.subjectId, Number(params.moduleId)));
  },
  "GET /api/subjects/:subjectId/modules/:moduleId/sections": (params: Record<string, string>) => {
    const content = CourseLoader.loadLesson(params.subjectId, Number(params.moduleId));
    return jsonResponse(CourseLoader.parseSections(content));
  },
  "GET /api/subjects/:subjectId/srs": (params: Record<string, string>) => {
    const deck = CourseLoader.loadSRSDeck(params.subjectId);
    return jsonResponse(deck);
  },
  "POST /api/subjects/:subjectId/srs": async (params: Record<string, string>, req: Request) => {
    const body = (await req.json()) as { cardId: string };
    const deck = CourseLoader.loadSRSDeck(params.subjectId);
    const updated = toggleStar(deck, body.cardId);
    CourseLoader.saveSRSDeck(updated, params.subjectId);
    return jsonResponse(updated);
  },
  "POST /api/subjects/:subjectId/srs/review": async (params: Record<string, string>, req: Request) => {
    const body = (await req.json()) as { cardId: string; correct: boolean; deck: SRSDeck };
    const deck = body.deck || CourseLoader.loadSRSDeck(params.subjectId);
    const card = deck.cards[body.cardId];
    if (!card) return jsonResponse({ error: "Card not found" }, 404);
    const updatedCard = performReview(card, body.correct);
    deck.cards[body.cardId] = updatedCard;
    CourseLoader.saveSRSDeck(deck, params.subjectId);
    return jsonResponse(updatedCard);
  },
  "POST /api/subjects/:subjectId/srs/create": async (params: Record<string, string>, req: Request) => {
    const body = (await req.json()) as { question: QuizQuestion; moduleId: number };
    const card = createSRSCard(body.question, body.moduleId, params.subjectId);
    const deck = CourseLoader.loadSRSDeck(params.subjectId);
    deck.cards[card.id] = card;
    CourseLoader.saveSRSDeck(deck, params.subjectId);
    return jsonResponse(card);
  },
  "GET /api/subjects/:subjectId/srs/filter/:filter": (params: Record<string, string>) => {
    const deck = CourseLoader.loadSRSDeck(params.subjectId);
    switch (params.filter) {
      case "due":
        return jsonResponse(getDueCardsForSubject(deck, params.subjectId));
      case "starred":
        return jsonResponse(getStarredCardsForSubject(deck, params.subjectId));
      default:
        return jsonResponse(getCardsForSubject(deck, params.subjectId));
    }
  },
  "GET /api/storage/highlights": (_params: Record<string, string>, req: Request) => {
    const url = new URL(req.url);
    const subjectID = url.searchParams.get("subjectID")!;
    const moduleID = Number(url.searchParams.get("moduleID"));
    return jsonResponse(Storage.getHighlightsForModule(subjectID, moduleID));
  },
  "POST /api/storage/highlights": async (_params: Record<string, string>, req: Request) => {
    const body = (await req.json()) as { subjectID: string; moduleID: number; selectedText: string; startOffset: number; endOffset: number; color?: string };
    const highlight = Storage.addHighlight(body.subjectID, body.moduleID, body.selectedText, body.startOffset, body.endOffset, body.color);
    return jsonResponse(highlight, 201);
  },
  "DELETE /api/storage/highlights/:id": (params: Record<string, string>) => {
    Storage.deleteHighlight(params.id);
    return jsonResponse({ ok: true });
  },
  "GET /api/storage/notes": (_params: Record<string, string>, req: Request) => {
    const url = new URL(req.url);
    const subjectID = url.searchParams.get("subjectID")!;
    const moduleID = Number(url.searchParams.get("moduleID"));
    return jsonResponse(Storage.getNotesForModule(subjectID, moduleID));
  },
  "POST /api/storage/notes": async (_params: Record<string, string>, req: Request) => {
    const body = (await req.json()) as { subjectID: string; moduleID: number; content: string; highlightID?: string; sectionID?: string };
    const note = Storage.addNote(body.subjectID, body.moduleID, body.content, body.highlightID, body.sectionID);
    return jsonResponse(note, 201);
  },
  "PUT /api/storage/notes/:id": async (params: Record<string, string>, req: Request) => {
    const body = (await req.json()) as { content: string };
    Storage.updateNote(params.id, body.content);
    return jsonResponse({ ok: true });
  },
  "DELETE /api/storage/notes/:id": (params: Record<string, string>) => {
    Storage.deleteNote(params.id);
    return jsonResponse({ ok: true });
  },
  "GET /api/storage/bookmarks": () => jsonResponse(Storage.getAllBookmarks()),
  "GET /api/storage/bookmarks/subject/:subjectID": (params: Record<string, string>) =>
    jsonResponse(Storage.getBookmarksForSubject(params.subjectID)),
  "POST /api/storage/bookmarks": async (_params: Record<string, string>, req: Request) => {
    const body = (await req.json()) as { subjectID: string; moduleID: number; title: string; sectionID?: string; scrollPosition?: number };
    const bookmark = Storage.addBookmark(body.subjectID, body.moduleID, body.title, body.sectionID, body.scrollPosition);
    return jsonResponse(bookmark, 201);
  },
  "DELETE /api/storage/bookmarks/:id": (params: Record<string, string>) => {
    Storage.deleteBookmark(params.id);
    return jsonResponse({ ok: true });
  },
  "GET /api/storage/bookmarks/module/:subjectID/:moduleID": (params: Record<string, string>) =>
    jsonResponse(Storage.getBookmarksForModule(params.subjectID, Number(params.moduleID))),
  "GET /api/storage/check-bookmark": (_params: Record<string, string>, req: Request) => {
    const url = new URL(req.url);
    const subjectID = url.searchParams.get("subjectID")!;
    const moduleID = Number(url.searchParams.get("moduleID"));
    return jsonResponse(Storage.isBookmarked(subjectID, moduleID));
  },
  "GET /api/gemini/key": () => jsonResponse({ hasKey: Gemini.hasAPIKey() }),
  "POST /api/gemini/key": async (_params: Record<string, string>, req: Request) => {
    const body = (await req.json()) as { key: string };
    Gemini.setAPIKey(body.key);
    return jsonResponse({ ok: true });
  },
  "POST /api/gemini/ask": async (_params: Record<string, string>, req: Request) => {
    const body = (await req.json()) as { question: string; context: string };
    try {
      const response = await Gemini.askGemini(body.question, body.context);
      return jsonResponse({ response });
    } catch (err) {
      return jsonResponse({ error: (err as Error).message }, 400);
    }
  },
  "POST /api/quiz/start": async (_params: Record<string, string>, req: Request) => {
    const body = (await req.json()) as { subjectId: string; moduleId: number };
    const questions = CourseLoader.loadQuiz(body.subjectId, body.moduleId);
    const engine = new QuizEngine();
    engine.load(questions, body.subjectId, body.moduleId);
    _quizEngine = engine;
    return jsonResponse(questions);
  },
  "GET /api/quiz/state": () => {
    const engine = getQuizEngine();
    return jsonResponse({
      currentIndex: engine.currentIndex,
      selectedAnswers: engine.selectedAnswers,
      isCompleted: engine.isCompleted,
      currentQuestion: engine.currentQuestion,
      score: engine.score,
      percentage: engine.percentage,
    });
  },
  "POST /api/quiz/select": async (_params: Record<string, string>, req: Request) => {
    const body = (await req.json()) as { answer: string };
    getQuizEngine().selectAnswer(body.answer);
    return jsonResponse({ ok: true });
  },
  "POST /api/quiz/next": () => {
    getQuizEngine().nextQuestion();
    return jsonResponse({ ok: true });
  },
  "POST /api/quiz/reset": () => {
    getQuizEngine().reset();
    return jsonResponse({ ok: true });
  },
};

function matchRoute(method: string, urlPath: string): { handler: Function; params: Record<string, string> } | null {
  for (const [routePattern, handler] of Object.entries(router)) {
    const [routeMethod, routePath] = routePattern.split(" ");
    if (routeMethod !== method) continue;

    const routeParts = routePath.split("/");
    const urlParts = urlPath.split("?").shift()!.split("/");

    if (routeParts.length !== urlParts.length) continue;

    const params: Record<string, string> = {};
    let match = true;

    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(":")) {
        params[routeParts[i].slice(1)] = urlParts[i];
      } else if (routeParts[i] !== urlParts[i]) {
        match = false;
        break;
      }
    }

    if (match) return { handler: handler as Function, params };
  }
  return null;
}

async function getMainViewUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    try {
      await fetch(DEV_SERVER_URL, { method: "HEAD" });
      console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
      return `${DEV_SERVER_URL}?apiPort=${API_PORT}`;
    } catch {
      console.log("Vite dev server not running. Run 'bun run dev:hmr' for HMR.");
    }
  }
  return `views://mainview/index.html?apiPort=${API_PORT}`;
}

const server = Bun.serve({
  port: API_PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const route = matchRoute(req.method, url.pathname);
    if (route) {
      try {
        return await route.handler(route.params, req);
      } catch (err) {
        return jsonResponse({ error: (err as Error).message }, 500);
      }
    }

    return jsonResponse({ error: "Not found" }, 404);
  },
});

console.log(`API server running at http://localhost:${API_PORT}`);

try {
  const mainViewUrl = await getMainViewUrl();
  new BrowserWindow({
    title: "CourseReader",
    url: mainViewUrl,
    frame: {
      width: 1100,
      height: 800,
      x: 200,
      y: 200,
    },
  });
  console.log("CourseReader started!");
} catch (err) {
  console.log("BrowserWindow not available (running standalone API server).");
}

process.on("beforeExit", () => {
  server.stop();
});
