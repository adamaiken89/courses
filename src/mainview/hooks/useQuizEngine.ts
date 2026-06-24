import { useReducer, useEffect, useCallback } from 'react';
import { api } from '../api';
import { logger } from '../logger';
import { showToast } from '../toast';
import type { QuizQuestion } from '../../bun/types';

type QuizStatus = 'loading' | 'ready' | 'completed';

interface QuizState {
  status: QuizStatus;
  questions: QuizQuestion[];
  currentIndex: number;
  selectedAnswers: Record<string, string>;
}

type QuizAction =
  | { type: 'LOADED'; questions: QuizQuestion[] }
  | { type: 'LOAD_FAILED' }
  | { type: 'SELECT_ANSWER'; answer: string }
  | { type: 'NEXT' }
  | { type: 'SKIP' }
  | { type: 'RETRY' };

function quizReducer(state: QuizState, action: QuizAction): QuizState {
  switch (action.type) {
    case 'LOADED':
      return { ...state, status: 'ready', questions: action.questions };
    case 'LOAD_FAILED':
      return { ...state, status: 'ready', questions: [] };
    case 'SELECT_ANSWER': {
      const q = state.questions[state.currentIndex];
      if (!q) return state;
      return {
        ...state,
        selectedAnswers: { ...state.selectedAnswers, [q.id]: action.answer },
      };
    }
    case 'NEXT': {
      if (state.currentIndex < state.questions.length - 1) {
        return { ...state, currentIndex: state.currentIndex + 1 };
      }
      return { ...state, status: 'completed' };
    }
    case 'SKIP': {
      if (state.currentIndex < state.questions.length - 1) {
        return { ...state, currentIndex: state.currentIndex + 1 };
      }
      return { ...state, status: 'completed' };
    }
    case 'RETRY':
      return { ...state, status: 'ready', currentIndex: 0, selectedAnswers: {} };
    default:
      return state;
  }
}

const INITIAL: QuizState = {
  status: 'loading',
  questions: [],
  currentIndex: 0,
  selectedAnswers: {},
};

interface UseQuizEngineReturn {
  status: QuizStatus;
  questions: QuizQuestion[];
  currentIndex: number;
  selectedAnswers: Record<string, string>;
  currentQuestion: QuizQuestion | undefined;
  hasAnswer: boolean;
  score: number;
  percentage: number;
  selectAnswer: (answer: string) => void;
  nextQuestion: () => void;
  skipQuestion: () => void;
  retry: () => void;
}

export function useQuizEngine(courseId: string, moduleId: number): UseQuizEngineReturn {
  const [state, dispatch] = useReducer(quizReducer, INITIAL);

  useEffect(() => {
    api.quiz
      .start(courseId, moduleId)
      .then((qs) => {
        dispatch({ type: 'LOADED', questions: qs });
      })
      .catch((err) => {
        logger.warn({ err }, 'Quiz load failed');
        showToast.error('toast.loadFailed');
        dispatch({ type: 'LOAD_FAILED' });
      });
  }, [courseId, moduleId]);

  useEffect(() => {
    if (state.status === 'completed' && state.questions.length > 0) {
      const score = state.questions.filter((q) => state.selectedAnswers[q.id] === q.answer).length;
      api.stats
        .logSession({
          courseID: courseId,
          moduleID: moduleId,
          durationMinutes: Math.ceil(state.questions.length * 1.5),
          type: 'quiz',
          score,
          total: state.questions.length,
        })
        .catch((err) => {
          logger.warn({ err }, 'Failed to log quiz session');
        });
    }
  }, [state.status, courseId, moduleId, state.questions, state.selectedAnswers]);

  const selectAnswer = useCallback((answer: string) => {
    dispatch({ type: 'SELECT_ANSWER', answer });
  }, []);

  const nextQuestion = useCallback(() => {
    dispatch({ type: 'NEXT' });
  }, []);

  const skipQuestion = useCallback(() => {
    dispatch({ type: 'SKIP' });
  }, []);

  const retry = useCallback(() => {
    dispatch({ type: 'RETRY' });
  }, []);

  const currentQuestion = state.questions[state.currentIndex];
  const hasAnswer = currentQuestion
    ? state.selectedAnswers[currentQuestion.id] !== undefined
    : false;
  const score = state.questions.filter((q) => state.selectedAnswers[q.id] === q.answer).length;
  const percentage =
    state.questions.length > 0 ? Math.round((score / state.questions.length) * 100) : 0;

  return {
    status: state.status,
    questions: state.questions,
    currentIndex: state.currentIndex,
    selectedAnswers: state.selectedAnswers,
    currentQuestion,
    hasAnswer,
    score,
    percentage,
    selectAnswer,
    nextQuestion,
    skipQuestion,
    retry,
  };
}
