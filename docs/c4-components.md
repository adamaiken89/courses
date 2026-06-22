# C4 Component Diagram — CourseReader (Level 3)

```mermaid
C4Component
  title Component Diagram — CourseReader

  Person(student, "Student", "Uses the app to study")

  Container_Boundary(fe, "Frontend (React 18 + TypeScript + Vite)") {

    Boundary(views, "View Layer (src/mainview/components/)") {
      Component(landing, "LandingView", "React component", "Welcome screen → pushes subjectList")
      Component(subjectList, "SubjectListView", "React component", "Grid of subject cards from GET /api/subjects")
      Component(moduleList, "ModuleListView", "React component", "Module cards + ← All Courses navigates to subjectList")
      Component(lessonPage, "LessonPage", "React component (App.tsx inline)", "Header + ModuleSwitcher + LessonView")
      Component(lessonView, "LessonView", "React component", "react-markdown renderer, section nav, AI sidebar, notes")
      Component(quizView, "QuizView", "React component", "MCQ quiz flow via API: load, select answer, score")
      Component(reviewView, "ReviewView", "React component", "SRS spaced repetition review via API")
      Component(settingsView, "SettingsView", "React component", "Gemini API key, theme grid, font size slider")
      Component(bookmarksView, "BookmarksView", "React component (App.tsx inline)", "Bookmark list, navigate/delete")
      Component(sidebar, "Sidebar", "React component", "Section nav, notes, highlights, AI side panel")
    }

    Boundary(routing, "Routing Layer") {
      Component(app, "App", "React component (src/mainview/App.tsx)", "View stack router (switch on View type). No React Router")
      Component(viewStore, "useViewStore", "Zustand store (src/mainview/stores/viewStore.ts)", "View stack: push, pop, replace, popToRoot")
      Component(settingsStore, "useSettingsStore", "Zustand store (src/mainview/stores/settingsStore.ts)", "Font size, theme (8 themes), cycleTheme")
    }

    Boundary(hooks, "Hooks (src/mainview/hooks/)") {
      Component(useBookmarks, "useBookmarks", "React hook", "Bookmark CRUD via API")
      Component(useHighlights, "useHighlights", "React hook", "Highlight CRUD via API")
    }

    Boundary(api, "API Client") {
      Component(apiClient, "api.ts", "HTTP client module", "fetch() wrapper → localhost:50001")
    }

    Boundary(styles, "Styles") {
      Component(tailwind, "Tailwind CSS", "Utility framework", "All layout and component styles")
      Component(bookContent, "book-content CSS", "Custom CSS (index.css)", "8 themes (Dark/OLED/Nord/Sepia/Gruvbox/Light/Solarized/Catppuccin), prose styles, highlight.js")
    }
  }

  Container_Boundary(be, "Backend (Bun HTTP server, port 50001)") {

    Boundary(handlers, "API Handlers (src/bun/index.ts)") {
      Component(router, "Router", "Bun.serve + switch on path", "Routes: /api/subjects, /api/lessons, /api/quizzes, /api/srs, /api/storage, /api/gemini")
    }

    Boundary(services, "Backend Services") {
      Component(courseLoader, "course-loader.ts", "Bun module", "loadSubjects(), loadLesson(), loadQuiz(), parseYAML, findModuleDir")
      Component(quizEngine, "quiz-engine.ts", "Bun class (QuizEngine)", "State machine: questions, currentIndex, selectedAnswers, score")
      Component(srs, "srs.ts", "Bun module", "SM-2 filter helpers: getDue, getStarred, toggleStar")
      Component(storage, "storage.ts", "Bun module", "JSON persistence: ~/.coursereader/data.json (highlights, notes, bookmarks)")
      Component(gemini, "gemini.ts", "Bun class (GeminiService)", "HTTP client for gemini-2.0-flash. API key from ~/.coursereader/prefs.json")
    }

    Boundary(types, "Shared Types (src/bun/types.ts)") {
      Component(models, "Subject, ModuleMeta, QuizQuestion, SRSCard, SRSDeck, ModuleSection, Highlight, Note, Bookmark", "TypeScript interfaces", "Shared between backend and frontend")
    }
  }

  System_Ext(fs, "File System", "subjects/ directory tree + ~/.coursereader/")
  System_Ext(geminiExt, "Google Gemini API", "generativelanguage.googleapis.com")

  Rel(student, landing, "First screen on launch")
  Rel(student, subjectList, "Browses subjects")
  Rel(student, moduleList, "Selects module from subject")
  Rel(student, lessonView, "Reads lesson content")
  Rel(student, quizView, "Takes MCQ quizzes")
  Rel(student, reviewView, "Reviews SRS cards")
  Rel(student, settingsView, "Configures API key, theme, font")
  Rel(student, bookmarksView, "Views saved bookmarks")

  Rel(landing, viewStore, "push(subjectList)")
  Rel(subjectList, viewStore, "push(moduleList) on subject select")
  Rel(moduleList, viewStore, "replace(subjectList) on ← All Courses")
  Rel(moduleList, viewStore, "push(lesson) on module select")
  Rel(lessonPage, viewStore, "push(quiz/review/settings/bookmarks), replace(moduleList) on back")
  Rel(quizView, viewStore, "pop on back")
  Rel(reviewView, viewStore, "pop on back")
  Rel(settingsView, viewStore, "pop on back")
  Rel(bookmarksView, viewStore, "replace(lesson) on open, pop on back")

  Rel(subjectList, apiClient, "GET /api/subjects")
  Rel(moduleList, apiClient, "reads subject data (passed via viewStore)")
  Rel(lessonView, apiClient, "GET /api/lessons/:subject/:module, POST /api/gemini/ask, bookmark/highlight CRUD")
  Rel(quizView, apiClient, "GET /api/quizzes/:subject/:module, POST /api/quiz/select, GET /api/quiz/score")
  Rel(reviewView, apiClient, "GET /api/srs/:subject, POST /api/srs/review")
  Rel(settingsView, apiClient, "POST /api/gemini/key, GET prefs")
  Rel(bookmarksView, apiClient, "GET /api/storage/bookmarks, DELETE /api/storage/bookmark/:id")

  Rel(apiClient, router, "HTTP requests")
  Rel(router, courseLoader, "loadSubjects, loadLesson, loadQuiz")
  Rel(router, quizEngine, "createQuiz, selectAnswer, getScore")
  Rel(router, srs, "getDueCards, reviewCard")
  Rel(router, storage, "saveHighlight, getNotes, bookmark ops")
  Rel(router, gemini, "askAboutHighlight")

  Rel(courseLoader, fs, "Reads subjects/<id>/syllabus.yaml, modules/<NN-*>/lesson.md, modules/<NN-*>/quiz.yaml, subjects/<id>/srs/deck.json")
  Rel(storage, fs, "Reads/writes ~/.coursereader/data.json, ~/.coursereader/prefs.json")
  Rel(gemini, geminiExt, "POST /v1beta/models/gemini-2.0-flash:generateContent")

  Rel(courseLoader, settingsStore, "provides subject list → modules → lesson content")
  Rel(lessonView, bookContent, "Applies .book-content.book-<theme> CSS class")
```

## Component Groups

### React Views (10 components)

| Component | File | Responsibility |
|-----------|------|----------------|
| LandingView | `src/mainview/components/LandingView.tsx` | Welcome screen, pushes subjectList |
| SubjectListView | `src/mainview/components/SubjectListView.tsx` | Subject grid with module stats |
| ModuleListView | `src/mainview/components/ModuleListView.tsx` | Module cards, ← All Courses → subjectList |
| LessonPage | `src/mainview/App.tsx` (inline) | Header + ModuleSwitcher + LessonView layout |
| LessonView | `src/mainview/components/LessonView.tsx` | Markdown reader, section nav, AI sidebar, notes |
| QuizView | `src/mainview/components/QuizView.tsx` | MCQ quiz with scoring, API-backed |
| ReviewView | `src/mainview/components/ReviewView.tsx` | SRS spaced repetition review |
| SettingsView | `src/mainview/components/SettingsView.tsx` | Gemini API key, theme grid, font size |
| BookmarksView | `src/mainview/App.tsx` (inline) | Bookmark list with open/delete |
| Sidebar | `src/mainview/components/Sidebar.tsx` | Section nav, notes, highlights, AI panel |

### State Management (2 stores)

| Component | File | Responsibility |
|-----------|------|----------------|
| useViewStore | `src/mainview/stores/viewStore.ts` | View stack: push/pop/replace/popToRoot |
| useSettingsStore | `src/mainview/stores/settingsStore.ts` | Font size (10-28px), theme (8 options) |

### API & Hooks

| Component | File | Responsibility |
|-----------|------|----------------|
| api.ts | `src/mainview/api.ts` | fetch() wrapper for all backend endpoints |
| useBookmarks | `src/mainview/hooks/useBookmarks.ts` | Bookmark CRUD hook |
| useHighlights | `src/mainview/hooks/useHighlights.ts` | Highlights CRUD hook |

### Backend Services (6 modules)

| Component | File | Responsibility |
|-----------|------|----------------|
| index.ts (Router) | `src/bun/index.ts` | Bun.serve, all API route handlers, window creation |
| course-loader.ts | `src/bun/course-loader.ts` | File I/O: load subjects, lessons, quizzes; YAML parse |
| quiz-engine.ts | `src/bun/quiz-engine.ts` | QuizEngine class: state machine for MCQ flow |
| srs.ts | `src/bun/srs.ts` | SM-2 filter: getDue, getStarred, toggleStar |
| storage.ts | `src/bun/storage.ts` | JSON persistence: ~/.coursereader/data.json |
| gemini.ts | `src/bun/gemini.ts` | Gemini 2.0 Flash API client |

### Models (src/bun/types.ts)

| Interface | Description |
|-----------|-------------|
| Subject | Subject metadata + modules array |
| ModuleMeta | Module name, time, prerequisites, topics |
| QuizQuestion | MCQ question with options + answer |
| SRSCard | SM-2 card: easeFactor, interval, repetitions |
| SRSDeck | Card collection (Record<string, SRSCard>) |
| ModuleSection | Heading-based section (id, heading, level) |
| Highlight | Selected text highlight with color |
| Note | User note attached to highlight/section |
| Bookmark | Bookmarked position in lesson |

## Navigation Flow

```
landing → subjectList
subjectList → moduleList (select subject)
moduleList → lesson (select module)
moduleList → subjectList (← All Courses, replace)
lesson → moduleList (← back, replace)
lesson → lesson (switch module via ModuleSwitcher)
lesson → quiz (push)
lesson → review (push)
lesson → settings (push)
lesson → bookmarks (push)
quiz → previous view (pop)
review → previous view (pop)
settings → previous view (pop)
bookmarks → lesson (replace, on open), previous view (pop, on back)
```

## Data Flow

```
Student → View Component → api.ts (fetch) → Bun HTTP server → Services → File System / Gemini API
                              ↑                                            ↓
                              └──────────── JSON response ────────────────┘
```

- **View → Store**: Read/write Zustand state (view stack, settings)
- **View → API**: fetch() to localhost:50001 for all data operations
- **Backend → Services**: Route handler calls course-loader, quiz-engine, srs, storage, gemini
- **Services → File System**: read/write subjects/ directory tree, ~/.coursereader/
- **Response → View**: JSON returned, React re-renders
