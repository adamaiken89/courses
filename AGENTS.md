# CourseReader — desktop study app (Electrobun + React)

## Build & run

```sh
bun install              # install dependencies
bun run start            # build + launch desktop app
bun run dev              # launch dev mode (HMR via Vite)
bun run dev:hmr          # Vite HMR + electobun concurrently
bun run build            # production build
bun test                 # run all tests (bun:test + happy-dom)
```

## Architecture

React 18 + TypeScript frontend, Bun backend, packaged as desktop app via Electrobun.

```
src/
├── mainview/            # React frontend (Vite, root=src/mainview)
│   ├── main.tsx         # React entry point
│   ├── App.tsx          # View stack router + layout
│   ├── api.ts           # HTTP client → localhost:50001
│   ├── index.css        # Tailwind + book prose styles
│   ├── components/
│   │   ├── LessonView.tsx     # Markdown reader w/ section nav, AI sidebar, notes
│   │   ├── SubjectListView.tsx# Subject grid with module stats
│   │   ├── QuizView.tsx       # MCQ quiz with scoring
│   │   ├── ReviewView.tsx     # SRS spaced repetition review
│   │   ├── SettingsView.tsx   # Gemini API key config
│   │   ├── Sidebar.tsx        # Section nav, notes, highlights, AI sidebar
│   │   └── ui.tsx             # Shared CVA variants (button, toggle, tab, etc.)
│   ├── hooks/
│   │   ├── useBookmarks.ts    # Bookmark CRUD hook
│   │   └── useHighlights.ts   # Highlights CRUD hook
│   └── stores/
│       ├── viewStore.ts       # Zustand view stack (Subject, ModuleMeta, View union)
│       └── settingsStore.ts   # Font size, theme settings
├── types/               # Ambient module declarations
│   ├── js-yaml.d.ts     # Declaration for js-yaml (no @types package)
│   └── three.d.ts       # Declaration for three (electrobun dependency)
└── bun/                 # Bun backend (HTTP server, port 50001)
    ├── index.ts         # Router (Bun.serve), window creation, all API handlers
    ├── types.ts         # Shared types: Subject, ModuleMeta, QuizQuestion, SRSCard, etc.
    ├── course-loader.ts # File I/O: load subjects, lessons, quizzes; YAML parse, SRS ops
    ├── quiz-engine.ts   # QuizEngine class (state machine for MCQ flow)
    ├── srs.ts           # SM-2 filter helpers (getDue, getStarred, toggleStar)
    ├── storage.ts       # JSON file persistence (~/.coursereader/data.json)
    │   └── __tests__/   # Test files (bun:test + happy-dom)
    └── gemini.ts        # Gemini 2.0 Flash API client
```

## Key conventions

- **Frontend → API (port 50001) → Backend handlers**. No direct file I/O from UI.
- **Navigation**: React state-driven view stack in App.tsx (type `View` union). No React Router.
- **Markdown rendering**: `react-markdown` + `remarkGfm` + `rehypeHighlight` (highlight.js).
- **Styling**: Tailwind CSS utility classes + custom `.book-content` CSS for lesson prose.
- **No CSS preprocessors**, no CSS modules — all custom styles in `index.css`.
- **No Makefile** — all commands via `package.json` scripts + `bun`.
- **Tests**: `bun test` runs `src/bun/__tests__/` via bun:test + happy-dom (DOM mocks) + @testing-library/react (component tests). Run before every commit.
- **TypeScript strict mode** enabled.
- **2-space indent** in tsx, 2-space in ts, tab in json (existing convention).

## Course data model

Subjects live in `subjects/<dir>/`. Each subject has:
- `syllabus.yaml` — parsed by `parseSubject()` via `js-yaml`
- `modules/<NN-name>/lesson.md` — rendered by `react-markdown`
- `modules/<NN-name>/quiz.yaml` — parsed by `parseQuiz()` via `js-yaml`
- `srs/deck.json` — SM-2 SRS deck (JSON)

Subject directory name becomes `Subject.id`.

**Module directory matching**: `findModuleDir` scans `modules/<id>/` for entries starting with zero-padded module ID (`NN-`).

## YAML parsing

Uses `js-yaml` library (not hand-written). `parseSubject` and `parseQuiz` in `src/bun/course-loader.ts`.

## Data persistence

- **Subjects/lessons/quizzes**: file I/O from `subjects/` directory tree
- **SRS decks**: `subjects/<id>/srs/deck.json`
- **Highlights, notes, bookmarks**: `~/.coursereader/data.json` (single JSON file)
- **Gemini API key**: `~/.coursereader/prefs.json`

## Quiz engine

`QuizEngine` class on backend (Bun). State: `questions`, `currentIndex`, `selectedAnswers`, `isCompleted`. Score computed from `selectedAnswers` match against `answer`. Frontend manages quiz state via API calls.

## AI / Gemini

`GeminiService` hits `gemini-2.0-flash` via REST API. API key stored in `~/.coursereader/prefs.json`. Settings view sets key via `POST /api/gemini/key`.

## Reading experience

Book-like prose styles defined in `.book-content` CSS class in `index.css`:
- Warm dark theme with serif body font for reading
- Decorative headers with clear h1-h6 hierarchy
- Custom dark syntax highlighting theme (highlight.js)
- Beautiful blockquotes with indigo accent
- Properly nested list styling
- GFM table support via `remarkGfm`
- Section-based navigation with scroll tracking
- Adjustable font size (10-28px)

## Module declarations

`src/types/` holds ambient `.d.ts` files for packages lacking `@types`:
- `js-yaml.d.ts` — `load`/`dump` signatures
- `three.d.ts` — bare `declare module "three"` (electrobun dependency)

## Project structure quirks

- `vite.config.ts` sets `root: "src/mainview"`, output to `dist/`
- `electrobun.config.ts` copies `dist/` to `views/mainview/` in app bundle
- API server runs on port 50001 (passed as `?apiPort=` query param)
- HMR: Vite dev server on port 5173, auto-detected by electrobun in dev channel
- No React Router — simple state-based view stack in `App.tsx`
- `index.css` uses Tailwind directives + custom `.book-content` and highlight.js styles
