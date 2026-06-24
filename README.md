# CourseReader

Desktop study app for structured curricula with quizzes, spaced repetition, AI-powered Q&A, syntax-highlighted code, and persistent annotations.

Built with **Electrobun** + **React 18** + **TypeScript** + **Bun**.

## Features

- **Course browser** — landing page → course list → module list → lesson, with course/module switchers
- **Quizzes** — MCQ per module, instant scoring
- **Spaced repetition** — SM-2 algorithm via SRS deck (JSON), star cards, filter by due/starred/all
- **AI assistant** — ask Gemini 2.0 Flash about lesson content in sidebar
- **Annotations** — highlights, notes, and bookmarks per module via JSON persistence
- **Syntax highlighting** — code blocks rendered via highlight.js (custom dark theme)
- **Reader navigation** — prev/next module and section buttons, font size controls (10–28px)
- **Book-like reading** — 8 themes (Dark, OLED, Nord, Sepia, Gruvbox, Light, Solarized, Catppuccin), decorative headers, blockquotes, wide mode toggle

## Subjects

| Subject                   | Modules |
| ------------------------- | ------- |
| Advanced React 19         | 20      |
| External Library Patterns | 40      |
| Fixed Income              | 22      |
| GraphQL Deep Dive         | 20      |
| Modern CSS with React     | 17      |
| Zustand State Management  | 21      |

Subjects live in `subjects/<id>/` with syllabus, modules, and SRS deck.

## Architecture

```
React Frontend (Vite) ──HTTP→ Bun Backend (port 50001) ──I/O→ subjects/ + ~/.coursereader/
```

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + Zustand (stores)
- **Backend**: Bun HTTP server (Bun.serve) with embedded API router
- **Packaging**: Electrobun (desktop app shell, like Electron but lighter)
- **Dependencies**: `react-markdown`, `remark-gfm`, `rehype-highlight`, `js-yaml`, `class-variance-authority`

```
src/mainview/
├── layouts/         # PageLayout, PageHeader, PageContent
├── pages/           # One *Page per View union variant (self-contained or wrapper)
├── sections/        # Complex content areas (LessonSection, QuizSection, ReviewSection)
├── components/      # Leaf-level UI (lesson/, study-tools/, ui.tsx, etc.)
├── hooks/           # Domain hooks (useLesson, useBookmarks, useQuizEngine, etc.)
└── stores/          # Zustand stores (view, settings, course, pomodoro)
```

## Quick start

```sh
bun install            # install dependencies
bun run start          # build + launch desktop app
bun run dev            # dev mode (HMR via Vite)
bun run dev:hmr        # Vite HMR + Electrobun concurrently
bun run build          # production build
bun test               # run all tests (bun:test + happy-dom)
```

## Course content

Default course content: https://github.com/adamaiken89/course-content

Paste or copy link in Settings → Remote Content input box.

## License

MIT
