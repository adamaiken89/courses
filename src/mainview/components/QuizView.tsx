import { useState, useEffect, useCallback } from "react";
import { api } from "../api";
import { answerVariants } from "./ui";
import type { QuizQuestion } from "../../../bun/types";
import clsx from "clsx";

interface Props {
  subjectId: string;
  moduleId: number;
  onBack: () => void;
}

export default function QuizView({ subjectId, moduleId, onBack }: Props) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    api.quiz.start(subjectId, moduleId).then((qs) => {
      setQuestions(qs);
      setLoading(false);
    });
  }, [subjectId, moduleId]);

  const selectAnswer = useCallback((answer: string) => {
    const q = questions[currentIndex];
    if (!q) return;
    const updated = { ...selectedAnswers, [q.id]: answer };
    setSelectedAnswers(updated);
  }, [currentIndex, questions, selectedAnswers]);

  const nextQuestion = useCallback(() => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setCompleted(true);
    }
  }, [currentIndex, questions.length]);

  const skipQuestion = useCallback(() => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setCompleted(true);
    }
  }, [currentIndex, questions.length]);

  const handleFinishOrRetry = () => {
    setCurrentIndex(0);
    setSelectedAnswers({});
    setCompleted(false);
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Loading quiz...</div>;
  if (questions.length === 0) return (
    <div className="p-8 text-center">
      <p className="text-gray-400 mb-4">No quiz questions for this module.</p>
      <button onClick={onBack} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg">Back</button>
    </div>
  );

  const score = questions.filter((q) => selectedAnswers[q.id] === q.answer).length;

  if (completed) {
    const percentage = Math.round((score / questions.length) * 100);
    return (
      <div className="h-screen flex flex-col bg-gray-900 text-gray-100">
        <header className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between shrink-0">
          <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors">← Back</button>
          <div className="text-sm text-gray-400">Quiz Complete</div>
          <div className="w-16" />
        </header>
        <main className="overflow-y-auto flex-1 px-6 py-8">
            <div className="bg-gray-800 rounded-xl p-8 w-full text-center">
              <h2 className="text-2xl font-bold mb-2">Quiz Complete!</h2>
              <div className="text-5xl font-bold text-indigo-400 mb-2">{percentage}%</div>
              <p className="text-gray-400 mb-6">{score} / {questions.length} correct</p>
              <div className="space-y-3">
                {questions.map((q) => {
                  const correct = selectedAnswers[q.id] === q.answer;
                  return (
                    <div key={q.id} className={clsx("text-left p-3 rounded-lg text-sm", correct ? "bg-emerald-900/30 border border-emerald-700" : "bg-red-900/30 border border-red-700")}>
                      <p className="font-medium mb-1">{q.question}</p>
                      <p className="text-gray-400 text-xs">Your answer: {selectedAnswers[q.id]}. Correct: {q.answer}</p>
                      <p className="text-gray-500 text-xs mt-1">{q.explanation}</p>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-3 mt-6 justify-center">
                <button onClick={handleFinishOrRetry} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg">Retry</button>
                <button onClick={onBack} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg">Back to Lesson</button>
              </div>
            </div>
        </main>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const hasAnswer = selectedAnswers[currentQuestion.id] !== undefined;

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-gray-100">
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between shrink-0">
        <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors">← Back</button>
        <div className="text-sm text-gray-400">Question {currentIndex + 1} of {questions.length}</div>
        <div className="w-16" />
      </header>

      <main className="overflow-y-auto flex-1 px-6 py-8">
        <div className="bg-gray-800 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs bg-indigo-600 px-2 py-0.5 rounded">Q{currentQuestion.id}</span>
            <span className="text-xs text-gray-400">Difficulty: {currentQuestion.difficulty}</span>
          </div>
          <h2 className="text-lg font-medium mb-6">{currentQuestion.question}</h2>

          <div className="space-y-3">
            {Object.entries(currentQuestion.options).map(([key, value]) => {
              const isSelected = selectedAnswers[currentQuestion.id] === key;
              const showCorrect = hasAnswer && key === currentQuestion.answer;
              const showWrong = hasAnswer && isSelected && key !== currentQuestion.answer;
              return (
                <button
                  key={key}
                  onClick={() => !hasAnswer && selectAnswer(key)}
                  disabled={hasAnswer}
                  className={clsx(
                    answerVariants({
                      state: showCorrect ? "correct" : showWrong ? "wrong" : isSelected ? "selected" : "neutral",
                    }),
                    !hasAnswer ? "cursor-pointer" : "cursor-default"
                  )}
                >
                  <span className="font-mono text-indigo-400 mr-2">{key}.</span>
                  {value}
                </button>
              );
            })}
          </div>

          {hasAnswer && (
            <div className="mt-4 p-3 bg-gray-750 rounded-lg">
              <p className="text-sm text-gray-300">{currentQuestion.explanation}</p>
            </div>
          )}
        </div>

        <div className="flex justify-center gap-3">
          <button
            onClick={skipQuestion}
            className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            Skip
          </button>
          <button
            onClick={nextQuestion}
            disabled={!hasAnswer}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors disabled:opacity-50"
          >
            {currentIndex < questions.length - 1 ? "Next Question" : "Finish Quiz"}
          </button>
        </div>
      </main>
    </div>
  );
}
