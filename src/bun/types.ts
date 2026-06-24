export interface ModuleMeta {
  id: number;
  name: string;
  timeHours: number;
  prerequisites: number[];
  topics: string[];
}

export interface Course {
  id: string;
  course: string;
  timeBudgetHours: number;
  targetLevel: string;
  domain: string;
  prerequisites: string[];
  learningObjectives: string[];
  modules: ModuleMeta[];
  displayName: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: Record<string, string>;
  answer: string;
  explanation: string;
  difficulty: number;
  tags: string[];
}

export interface SRSCard {
  id: string;
  questionId: string;
  moduleId: number;
  courseId: string;
  question: string;
  answer: string;
  explanation: string;
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewDate: string;
  lastReviewed: string | null;
  isStarred: boolean;
}

export interface SRSDeck {
  cards: Record<string, SRSCard>;
}

export interface ModuleSection {
  id: string;
  heading: string;
  level: number;
  parentID: string | null;
}

export interface Highlight {
  id: string;
  courseID: string;
  moduleID: number;
  selectedText: string;
  startOffset: number;
  endOffset: number;
  color: string;
  createdAt: string;
}

export interface Note {
  id: string;
  courseID: string;
  moduleID: number;
  highlightID: string | null;
  sectionID: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserCard {
  id: string;
  courseId: string;
  moduleId: number;
  front: string;
  back: string;
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewDate: string;
  lastReviewed: string | null;
  isStarred: boolean;
  createdAt: string;
}

export interface Bookmark {
  id: string;
  courseID: string;
  moduleID: number;
  sectionID: string | null;
  title: string;
  scrollPosition: number;
  createdAt: string;
}

export interface CompletedModule {
  courseID: string;
  moduleID: number;
  completedAt: string;
}

export interface StudySession {
  date: string;
  courseID: string;
  moduleID: number;
  durationMinutes: number;
  type: 'reading' | 'quiz' | 'review';
  score?: number;
  total?: number;
}
