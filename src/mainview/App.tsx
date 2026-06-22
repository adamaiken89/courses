import { useState, useEffect } from "react";
import LandingView from "./components/LandingView";
import SubjectListView from "./components/SubjectListView";
import LessonView from "./components/LessonView";
import QuizView from "./components/QuizView";
import ReviewView from "./components/ReviewView";
import SettingsView from "./components/SettingsView";
import ModuleListView from "./components/ModuleListView";
import CourseSwitcher from "./components/CourseSwitcher";
import ModuleSwitcher from "./components/ModuleSwitcher";
import { api } from "./api";
import { useViewStore } from "./stores/viewStore";
import type { Subject, ModuleMeta } from "../bun/types";

interface Bookmark {
  id: string;
  subjectID: string;
  moduleID: number;
  sectionID: string | null;
  title: string;
  createdAt: string;
}

export default function App() {
  const views = useViewStore((s) => s.views);
  const push = useViewStore((s) => s.push);
  const pop = useViewStore((s) => s.pop);
  const replace = useViewStore((s) => s.replace);
  const currentView = views[views.length - 1];

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentView) {
      setLoading(false);
      return;
    }
    replace({ type: "landing" });
    setLoading(false);
  }, [currentView]);

  const handleSelectModule = (subject: Subject, module: ModuleMeta) => {
    push({ type: "lesson", subject, module });
  };

  const handleStartQuiz = (subject: Subject, module: ModuleMeta) => {
    push({ type: "quiz", subject, module });
  };

  const handleStartReview = (subject: Subject) => {
    push({ type: "review", subject });
  };

  const handleSwitchCourse = (subject: Subject) => {
    replace({ type: "lesson", subject, module: subject.modules[0] });
  };

  const handleSelectSubject = (subject: Subject) => {
    push({ type: "moduleList", subject });
  };

  if (loading || !currentView) {
    return <div className="min-h-screen bg-gray-900 text-gray-400 flex items-center justify-center">Loading...</div>;
  }

  switch (currentView.type) {
    case "landing":
      return <LandingView />;

    case "subjectList":
      return (
        <SubjectListView
          onSelectSubject={handleSelectSubject}
          onOpenSettings={() => push({ type: "settings" })}
          onOpenBookmarks={() => push({ type: "bookmarks" })}
        />
      );

    case "moduleList":
      return (
        <ModuleListView
          subject={currentView.subject}
          onSelectModule={(m) => handleSelectModule(currentView.subject, m)}
          onBack={pop}
          onOpenSettings={() => push({ type: "settings" })}
          onOpenBookmarks={() => push({ type: "bookmarks" })}
        />
      );

    case "lesson":
      return (
        <LessonPage
          subject={currentView.subject}
          module={currentView.module}
          initialSectionID={currentView.sectionID}
          onBack={() => replace({ type: "moduleList", subject: currentView.subject })}
          onSelectModule={(m) => handleSelectModule(currentView.subject, m)}
          onStartQuiz={() => handleStartQuiz(currentView.subject, currentView.module)}
          onStartReview={() => handleStartReview(currentView.subject)}
          onOpenBookmarks={() => push({ type: "bookmarks" })}
          onSwitchCourse={handleSwitchCourse}
        />
      );

    case "quiz":
      return (
        <QuizPage
          subjectId={currentView.subject.id}
          moduleId={currentView.module.id}
          onBack={pop}
          onSwitchCourse={handleSwitchCourse}
        />
      );

    case "review":
      return (
        <ReviewPage
          subjectId={currentView.subject.id}
          onBack={pop}
          onSwitchCourse={handleSwitchCourse}
        />
      );

    case "settings":
      return <SettingsView onBack={pop} onSwitchCourse={handleSwitchCourse} />;

    case "bookmarks":
      return (
        <BookmarksView
          onBack={pop}
          onSwitchCourse={handleSwitchCourse}
          onOpen={(subjectID, moduleID, sectionID, subjects) => {
            const subject = subjects.find((s: Subject) => s.id === subjectID);
            const module = subject?.modules.find((m) => m.id === moduleID);
            if (subject && module) {
              replace({ type: "lesson", subject, module, sectionID: sectionID || undefined });
            }
          }}
        />
      );
  }
}

function LessonPage({
  subject, module, initialSectionID, onBack, onSelectModule, onStartQuiz, onStartReview, onOpenBookmarks, onSwitchCourse,
}: {
  subject: Subject;
  module: ModuleMeta;
  initialSectionID?: string;
  onBack: () => void;
  onSelectModule: (m: ModuleMeta) => void;
  onStartQuiz: () => void;
  onStartReview: () => void;
  onOpenBookmarks: () => void;
  onSwitchCourse: (subject: Subject) => void;
}) {
  const push = useViewStore((s) => s.push);
  const currentIdx = subject.modules.findIndex((m) => m.id === module.id);
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < subject.modules.length - 1;

  return (
    <div className="flex h-screen bg-gray-900">
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center gap-3 shrink-0">
          <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors text-sm shrink-0 min-w-0 mr-2">
            ← {subject.displayName}
          </button>
          <div className="flex-1 flex justify-center">
            <ModuleSwitcher
              modules={subject.modules}
              currentModuleId={module.id}
              onSelect={onSelectModule}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-4 w-px bg-gray-600" />
            <button onClick={onStartQuiz} className="px-2 py-1 text-xs bg-emerald-700 hover:bg-emerald-600 rounded">
              Quiz
            </button>
            <button onClick={onStartReview} className="px-2 py-1 text-xs bg-amber-700 hover:bg-amber-600 rounded">
              Review
            </button>
            <button onClick={() => push({ type: "settings" })} className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded" title="Settings">
              ⚙
            </button>
          </div>
        </header>

        <LessonView
          subjectId={subject.id}
          module={module}
          initialSectionID={initialSectionID}
          onStartQuiz={onStartQuiz}
          hasPrevModule={hasPrev}
          hasNextModule={hasNext}
          onPrevModule={hasPrev ? () => onSelectModule(subject.modules[currentIdx - 1]) : undefined}
          onNextModule={hasNext ? () => onSelectModule(subject.modules[currentIdx + 1]) : undefined}
          prevModuleName={hasPrev ? subject.modules[currentIdx - 1].name : undefined}
          nextModuleName={hasNext ? subject.modules[currentIdx + 1].name : undefined}
        />
      </div>
    </div>
  );
}

function QuizPage({
  subjectId, moduleId, onBack, onSwitchCourse,
}: {
  subjectId: string;
  moduleId: number;
  onBack: () => void;
  onSwitchCourse: (subject: Subject) => void;
}) {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors">← Back</button>
          <div className="h-4 w-px bg-gray-600" />
          <span className="text-sm font-medium">Quiz</span>
        </div>
        <div className="flex-1 flex justify-center">
          <CourseSwitcher currentSubjectId={subjectId} onSelect={onSwitchCourse} />
        </div>
        <div className="w-16" />
      </header>
      <div className="p-6">
        <QuizView subjectId={subjectId} moduleId={moduleId} onBack={onBack} />
      </div>
    </div>
  );
}

function ReviewPage({
  subjectId, onBack, onSwitchCourse,
}: {
  subjectId: string;
  onBack: () => void;
  onSwitchCourse: (subject: Subject) => void;
}) {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors">← Back</button>
          <div className="h-4 w-px bg-gray-600" />
          <span className="text-sm font-medium">Review</span>
        </div>
        <div className="flex-1 flex justify-center">
          <CourseSwitcher currentSubjectId={subjectId} onSelect={onSwitchCourse} />
        </div>
        <div className="w-16" />
      </header>
      <div className="p-6">
        <ReviewView subjectId={subjectId} onBack={onBack} />
      </div>
    </div>
  );
}

function BookmarksView({ onBack, onOpen, onSwitchCourse }: {
  onBack: () => void;
  onOpen: (subjectID: string, moduleID: number, sectionID: string | null, subjects: Subject[]) => void;
  onSwitchCourse: (subject: Subject) => void;
}) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.storage.bookmarks(),
      api.subjects.list(),
    ]).then(([bks, subs]) => {
      setBookmarks(bks);
      setSubjects(subs);
      setLoading(false);
    });
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await api.storage.deleteBookmark(id);
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Loading bookmarks...</div>;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors">← Back</button>
          <div className="h-4 w-px bg-gray-600" />
          <h2 className="text-sm font-medium">Bookmarks ({bookmarks.length})</h2>
        </div>
        <CourseSwitcher onSelect={onSwitchCourse} />
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {bookmarks.length === 0 ? (
          <p className="text-center text-gray-500 py-12">No bookmarks yet. Bookmark lessons while reading.</p>
        ) : (
          <div className="space-y-3">
            {bookmarks.map((b) => {
              const subject = subjects.find((s: Subject) => s.id === b.subjectID);
              return (
                <div
                  key={b.id}
                  className="bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded-xl transition-colors group relative"
                >
                  <button
                    onClick={() => onOpen(b.subjectID, b.moduleID, b.sectionID, subjects)}
                    className="w-full text-left p-4 pr-10"
                  >
                    <h3 className="text-sm font-medium text-indigo-300">{b.title}</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {subject?.displayName || b.subjectID}
                      {b.sectionID ? " — Section" : " — Module"}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">{new Date(b.createdAt).toLocaleDateString()}</p>
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, b.id)}
                    className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 px-2 py-0.5 text-xs bg-red-800 hover:bg-red-700 rounded transition-all"
                    title="Delete bookmark"
                  >
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
