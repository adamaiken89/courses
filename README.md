# CourseReader

Desktop study app for structured curricula with quizzes, spaced repetition, AI-powered Q&A, syntax-highlighted code, and persistent annotations.

Built with **Electrobun** + **React 18** + **TypeScript** + **Bun**.

## Features

- **Course browser** — subjects split into modules, each with markdown lessons (h1–h6 headings)
- **Quizzes** — MCQ per module, instant scoring
- **Spaced repetition** — SM-2 algorithm via SRS deck (JSON), star cards, filter by due/starred/all
- **AI assistant** — ask Gemini 2.0 Flash about lesson content in sidebar
- **Annotations** — highlights, notes, and bookmarks per module via JSON persistence
- **Syntax highlighting** — code blocks rendered via highlight.js (custom dark theme)
- **Reader navigation** — prev/next module and section buttons, font size controls (10–28px)
- **Book-like reading** — serif font, warm dark theme, decorative headers, beautiful blockquotes

## Subjects

| Subject                   | Modules |
| ------------------------- | ------- |
| Advanced React 19         | —       |
| External Library Patterns | 40      |
| Fixed Income              | 20      |
| GraphQL Deep Dive         | 20      |
| Modern CSS with React     | —       |
| Zustand State Management  | —       |

Subjects live in `subjects/<id>/` with syllabus, modules, and SRS deck.

## Architecture

```
React Frontend (Vite) ──HTTP→ Bun Backend (port 50001) ──I/O→ subjects/ + ~/.coursereader/
```

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Bun HTTP server (Bun.serve) with embedded API router
- **Packaging**: Electrobun (desktop app shell, like Electron but lighter)
- **Dependencies**: `react-markdown`, `remark-gfm`, `rehype-highlight`, `js-yaml`
- **No Swift**, no SwiftData, no SwiftUI, no React Router

## Quick start

```sh
bun install            # install dependencies
bun run start          # build + launch desktop app
bun run dev:hmr        # dev mode with Vite HMR
bun run build          # production build
bun test               # run all tests (bun:test + happy-dom)
```

## Project layout

```bash
src/
├── mainview/              # React frontend
│   ├── main.tsx           # Entry point
│   ├── App.tsx            # View stack + layout
│   ├── api.ts             # HTTP client
│   ├── index.css          # Tailwind + book prose styles
│   └── components/
│       ├── LessonView.tsx       # Markdown reader
│       ├── SubjectListView.tsx  # Subject grid
│       ├── QuizView.tsx         # MCQ quiz
│       ├── ReviewView.tsx       # SRS review
│       └── SettingsView.tsx     # Gemini config
└── bun/                   # Bun backend
    ├── index.ts           # Server + router + window
    ├── types.ts           # Shared types
    ├── course-loader.ts   # File I/O + YAML
    ├── quiz-engine.ts     # Quiz state machine
    ├── srs.ts             # SM-2 filters
    ├── storage.ts         # JSON persistence
    └── gemini.ts          # Gemini API client
    └── __tests__/         # Test suite (bun:test + happy-dom)
subjects/                  # Course data
├── <id>/syllabus.yaml     # Subject metadata
├── <id>/modules/<NN->/    # Modules with lesson.md + quiz.yaml
└── <id>/srs/deck.json     # SRS deck
```

## License

MIT
