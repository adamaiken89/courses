# CourseReader — desktop study app (Electrobun + React)

## Build & run

```sh
bun install              # install dependencies
bun run start            # build + launch desktop app
bun run dev              # launch dev mode (HMR via Vite)
bun run dev:hmr          # Vite HMR + electobun concurrently
bun run build            # production build
bun test                 # run all tests (bun:test + happy-dom)
bun run check            # tsc + eslint + prettier (run after every change)
bun run knip             # find unused code/exports/dependencies
```

## Architecture

React 18 + TypeScript frontend, Bun backend, packaged as desktop app via Electrobun.

```
src/
├── mainview/             # React frontend (Vite, root=src/mainview)
│   ├── main.tsx          # React entry point
│   ├── App.tsx           # View stack router
│   ├── api.ts            # HTTP client → localhost:50001
│   ├── index.css         # Tailwind + book prose styles
│   ├── layouts/          # PageLayout, PageHeader, PageContent
│   ├── pages/            # One *Page per View union variant
│   ├── sections/         # Complex content (Lesson, Quiz, Review, UserCardReview)
│   ├── components/       # Leaf-level reusable UI. No routing awareness.
│   │   ├── lesson/       # LessonToolbar, SectionsPanel, SelectionToolbar, NoteEditor, CardEditor
│   │   ├── study-tools/  # NotesTab, HighlightsTab, BookmarksTab, CardsTab, AITab
│   │   └── ...           # CourseSwitcher, ModuleSwitcher, SearchOverlay, StudyTools, PomodoroTimer, ui
│   ├── hooks/            # useBookmarks, useHighlights, useLesson, useHighlightPicker, useQuizEngine, useReviewState
│   └── stores/           # Zustand: viewStore, courseStore, settingsStore, pomodoroStore
├── types/                # Ambient declarations (js-yaml, three)
└── bun/                  # Backend HTTP server (port 50001)
    ├── index.ts          # Router + all API handlers
    ├── types.ts          # Shared types
    ├── course-loader.ts  # File I/O: subjects, lessons, quizzes; YAML parse
    ├── quiz-engine.ts    # MCQ state machine
    ├── srs.ts            # SM-2 filter helpers
    ├── storage.ts        # JSON persistence (~/.coursereader/data.json)
    └── gemini.ts         # Gemini API client
```

## Key conventions

- **Frontend → API (port 50001) → Backend handlers**. No direct file I/O from UI.
- **Navigation**: React state-driven view stack. No React Router.
- **Pages**: use `PageLayout` + `PageHeader` + `PageContent`. No inline wrappers.
- **State management**: Zustand stores (cross-cutting), domain hooks (page-specific), useReducer (state machines), local useState (trivial UI only).
- **Subcomponents** receive data via props, never fetch directly.
- **Markdown**: react-markdown + remarkGfm + rehypeHighlight (highlight.js).
- **Styling**: Tailwind + `.book-content` CSS.
- **TypeScript strict mode**.
- **i18n first**: all text/emoji/icons via `t('key')`. Locale files at `src/mainview/locales/*.json`. Adding UI text requires keys in all 5 locales + snapshot update.

## Course data model

Subjects in `subjects/<dir>/`. Dir name → `Subject.id`. Each subject:
- `syllabus.yaml`
- `modules/<NN-name>/lesson.md`
- `modules/<NN-name>/quiz.yaml`
- `srs/deck.json` (SM-2 SRS)

Module dir matching: `findModuleDir` scans `modules/<id>/` for `NN-` prefix.

## Data persistence

- Subjects/lessons/quizzes: file I/O from `subjects/` tree
- SRS decks: `subjects/<id>/srs/deck.json`
- Highlights, notes, bookmarks: `~/.coursereader/data.json`
- Gemini API key: `~/.coursereader/prefs.json`

## Code quality

- Run `bun run knip` to find and remove unused code, exports, types, and dependencies.

## Quirks

- `vite.config.ts` root=`src/mainview`, output=`dist/`
- API port 50001 (passed as `?apiPort=` query param)
- `index.css`: Tailwind directives + `.book-content` + highlight.js styles
