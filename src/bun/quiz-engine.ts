import type { QuizQuestion } from "./types";

export class QuizEngine {
  questions: QuizQuestion[] = [];
  currentIndex = 0;
  selectedAnswers: Record<string, string> = {};
  isCompleted = false;
  subjectId?: string;
  moduleId?: number;

  get currentQuestion(): QuizQuestion | null {
    return this.currentIndex < this.questions.length ? this.questions[this.currentIndex] : null;
  }

  get score(): { correct: number; total: number } {
    const total = this.questions.length;
    const correct = this.questions.filter((q) => this.selectedAnswers[q.id] === q.answer).length;
    return { correct, total };
  }

  get percentage(): number {
    return this.score.total > 0 ? (this.score.correct / this.score.total) * 100 : 0;
  }

  load(qs: QuizQuestion[], subjectId?: string, moduleId?: number): void {
    this.questions = qs;
    this.currentIndex = 0;
    this.selectedAnswers = {};
    this.isCompleted = false;
    this.subjectId = subjectId;
    this.moduleId = moduleId;
  }

  selectAnswer(answer: string): void {
    const q = this.currentQuestion;
    if (!q) return;
    this.selectedAnswers[q.id] = answer;
  }

  nextQuestion(): void {
    if (this.currentIndex < this.questions.length - 1) {
      this.currentIndex += 1;
    } else {
      this.isCompleted = true;
    }
  }

  isCorrect(questionId: string): boolean | null {
    const selected = this.selectedAnswers[questionId];
    const q = this.questions.find((q) => q.id === questionId);
    if (!selected || !q) return null;
    return selected === q.answer;
  }

  reset(): void {
    this.questions = [];
    this.currentIndex = 0;
    this.selectedAnswers = {};
    this.isCompleted = false;
  }
}
