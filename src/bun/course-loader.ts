import { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import * as yaml from "js-yaml";
import type { Subject, ModuleMeta, QuizQuestion, SRSDeck } from "./types";

const POSSIBLE_PATHS = [
  join(import.meta.dir, "..", "..", "subjects"),
  join(import.meta.dir, "..", "..", "..", "subjects"),
  join(process.env.HOME || "", "Desktop", "courses", "subjects"),
];

function findSubjectsDir(): string | null {
  for (const p of POSSIBLE_PATHS) {
    if (existsSync(p)) return p;
  }
  return null;
}

export function parseSubject(yamlStr: string, directory: string): Subject | null {
  const raw = yaml.load(yamlStr) as Record<string, unknown>;
  if (!raw || typeof raw.subject !== "string" || !raw.subject) return null;

  const moduleList: ModuleMeta[] = [];
  if (Array.isArray(raw.modules)) {
    for (const m of raw.modules) {
      const mod = m as Record<string, unknown>;
      moduleList.push({
        id: Number(mod.id) || 0,
        name: String(mod.name || ""),
        timeHours: Number(mod.time_hours) || 0,
        prerequisites: Array.isArray(mod.prerequisites) ? mod.prerequisites.map(Number) : [],
        topics: Array.isArray(mod.topics) ? mod.topics.map(String) : [],
      });
    }
  }

  return {
    id: directory,
    subject: String(raw.subject),
    timeBudgetHours: Number(raw.time_budget_hours) || 40,
    targetLevel: String(raw.target_level || "intermediate"),
    domain: String(raw.domain || ""),
    prerequisites: Array.isArray(raw.prerequisites) ? raw.prerequisites.map(String) : [],
    learningObjectives: Array.isArray(raw.learning_objectives) ? raw.learning_objectives.map(String) : [],
    modules: moduleList,
    displayName: String(raw.subject),
  };
}

export function parseQuiz(yamlStr: string): QuizQuestion[] {
  const raw = yaml.load(yamlStr) as Record<string, unknown>[];
  if (!Array.isArray(raw)) return [];

  return raw.map((q) => ({
    id: String(q.id || ""),
    question: String(q.question || ""),
    options: (q.options as Record<string, string>) || {},
    answer: String(q.answer || ""),
    explanation: String(q.explanation || ""),
    difficulty: Number(q.difficulty) || 1,
    tags: Array.isArray(q.tags) ? q.tags.map(String) : [],
  }));
}

export function findModuleDir(subjectsDir: string, subjectId: string, moduleId: number): string | null {
  const modulesDir = join(subjectsDir, subjectId, "modules");
  if (!existsSync(modulesDir)) return null;
  const padded = String(moduleId).padStart(2, "0");
  const entries = readdirSync(modulesDir, { withFileTypes: true });
  const match = entries.find((e) => e.isDirectory() && e.name.startsWith(padded));
  return match ? join(modulesDir, match.name) : null;
}

export function loadSubjects(): Subject[] {
  const subjectsDir = findSubjectsDir();
  if (!subjectsDir) return [];

  const entries = readdirSync(subjectsDir, { withFileTypes: true });
  const subjects: Subject[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === "srs") continue;
    const syllabusPath = join(subjectsDir, entry.name, "syllabus.yaml");
    if (!existsSync(syllabusPath)) continue;
    try {
      const content = readFileSync(syllabusPath, "utf-8");
      const subject = parseSubject(content, entry.name);
      if (subject) subjects.push(subject);
    } catch { /* skip invalid */ }
  }

  return subjects.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function loadLesson(subjectId: string, moduleId: number): string {
  const subjectsDir = findSubjectsDir();
  if (!subjectsDir) throw new Error("Subjects directory not found");
  const modDir = findModuleDir(subjectsDir, subjectId, moduleId);
  if (!modDir) throw new Error(`Module ${moduleId} not found for subject ${subjectId}`);
  const lessonPath = join(modDir, "lesson.md");
  if (!existsSync(lessonPath)) throw new Error(`Lesson not found for module ${moduleId}`);
  return readFileSync(lessonPath, "utf-8");
}

export function loadQuiz(subjectId: string, moduleId: number): QuizQuestion[] {
  const subjectsDir = findSubjectsDir();
  if (!subjectsDir) throw new Error("Subjects directory not found");
  const modDir = findModuleDir(subjectsDir, subjectId, moduleId);
  if (!modDir) throw new Error(`Module ${moduleId} not found for subject ${subjectId}`);
  const quizPath = join(modDir, "quiz.yaml");
  if (!existsSync(quizPath)) return [];
  const content = readFileSync(quizPath, "utf-8");
  return parseQuiz(content);
}

export function loadSRSDeck(subjectId: string): SRSDeck {
  const subjectsDir = findSubjectsDir();
  if (!subjectsDir) return { cards: {} };
  const deckPath = join(subjectsDir, subjectId, "srs", "deck.json");
  if (!existsSync(deckPath)) return { cards: {} };
  try {
    return JSON.parse(readFileSync(deckPath, "utf-8")) as SRSDeck;
  } catch {
    return { cards: {} };
  }
}

export function saveSRSDeck(deck: SRSDeck, subjectId: string): void {
  const subjectsDir = findSubjectsDir();
  if (!subjectsDir) return;
  const srsDir = join(subjectsDir, subjectId, "srs");
  mkdirSync(srsDir, { recursive: true });
  writeFileSync(join(srsDir, "deck.json"), JSON.stringify(deck, null, 2));
}

export function parseSections(markdown: string): { id: string; heading: string; level: number; parentID: string | null }[] {
  const sections: { id: string; heading: string; level: number; parentID: string | null }[] = [];
  const levelStack: number[] = [];
  const idStack: string[] = [];

  for (const line of markdown.split("\n")) {
    const trimmed = line.trim();
    let level = 0;
    if (trimmed.startsWith("###### ")) level = 6;
    else if (trimmed.startsWith("##### ")) level = 5;
    else if (trimmed.startsWith("#### ")) level = 4;
    else if (trimmed.startsWith("### ")) level = 3;
    else if (trimmed.startsWith("## ")) level = 2;
    else if (trimmed.startsWith("# ")) level = 1;
    else continue;

    const heading = trimmed.slice(level + 1);
    const id = heading.toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[:,\(\)]/g, "")
      .replace(/[^a-z0-9\-]/g, "");

    while (levelStack.length && levelStack[levelStack.length - 1] >= level) {
      levelStack.pop();
      idStack.pop();
    }
    const parentID = idStack.length > 0 ? idStack[idStack.length - 1] : null;
    levelStack.push(level);
    idStack.push(id);
    sections.push({ id, heading, level, parentID });
  }

  return sections;
}
