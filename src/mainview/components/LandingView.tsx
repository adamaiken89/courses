import { useViewStore } from "../stores/viewStore";

export default function LandingView() {
  const push = useViewStore((s) => s.push);

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-gray-100">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between shrink-0">
        <h1 className="text-2xl font-bold text-indigo-400">CourseReader</h1>
        <div className="flex gap-2">
          <button
            onClick={() => push({ type: "settings" })}
            className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            Settings
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-xl text-center space-y-8">
          <div className="space-y-3">
            <h2 className="text-4xl font-bold text-white">
              Welcome to <span className="text-indigo-400">CourseReader</span>
            </h2>
            <p className="text-gray-400 text-lg leading-relaxed">
              A desktop study app for structured learning. Read lessons, take quizzes, and track your progress with spaced repetition.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-2">
              <div className="text-2xl">📖</div>
              <h3 className="font-medium text-white">Lessons</h3>
              <p className="text-gray-500 text-xs">Read through structured markdown content at your own pace</p>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-2">
              <div className="text-2xl">📝</div>
              <h3 className="font-medium text-white">Quizzes</h3>
              <p className="text-gray-500 text-xs">Test your knowledge with module-level multiple choice questions</p>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-2">
              <div className="text-2xl">🔄</div>
              <h3 className="font-medium text-white">Review</h3>
              <p className="text-gray-500 text-xs">Spaced repetition to reinforce what you've learned</p>
            </div>
          </div>

          <button
            onClick={() => push({ type: "subjectList" })}
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-colors shadow-lg shadow-indigo-900/50"
          >
            Browse Courses →
          </button>
        </div>
      </main>
    </div>
  );
}
