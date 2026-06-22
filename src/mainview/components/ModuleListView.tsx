import type { Subject, ModuleMeta } from "../../bun/types";

interface Props {
  subject: Subject;
  onSelectModule: (module: ModuleMeta) => void;
  onBack: () => void;
  onOpenSettings: () => void;
  onOpenBookmarks: () => void;
}

export default function ModuleListView({
  subject, onSelectModule, onBack, onOpenSettings, onOpenBookmarks,
}: Props) {
  return (
    <div className="h-screen flex flex-col bg-gray-900 text-gray-100">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="text-gray-400 hover:text-white transition-colors text-sm"
          >
            ← All Courses
          </button>
          <div className="h-4 w-px bg-gray-600" />
          <div>
            <h1 className="text-xl font-bold text-indigo-400">{subject.displayName}</h1>
            <p className="text-xs text-gray-400 mt-0.5">{subject.modules.length} modules</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onOpenBookmarks}
            className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            Bookmarks
          </button>
          <button
            onClick={onOpenSettings}
            className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            Settings
          </button>
        </div>
      </header>

      <main className="px-6 py-8 overflow-y-auto flex-1">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subject.modules.map((mod, i) => (
            <button
              key={mod.id}
              onClick={() => onSelectModule(mod)}
              className="text-left bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded-xl p-5 transition-colors group cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <span className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-900/50 text-indigo-400 text-sm font-bold">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold text-white group-hover:text-indigo-400 transition-colors">
                    {mod.name}
                  </h2>
                  {mod.timeHours > 0 && (
                    <p className="text-xs text-gray-500 mt-1">{mod.timeHours}h</p>
                  )}
                  {mod.topics && mod.topics.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {mod.topics.map((t, ti) => (
                        <span
                          key={ti}
                          className="text-[10px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-gray-600 group-hover:text-indigo-400 shrink-0 mt-1">→</span>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
