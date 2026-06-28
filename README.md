<p align="center">
  <img src="assets/icon.svg" alt="CourseReader logo" width="128" />
</p>

<h1 align="center">CourseReader</h1>

<p align="center">
  Desktop study app for structured curricula with quizzes, spaced repetition, AI-powered Q&A, and persistent annotations.
</p>

<p align="center">
  <a href="https://github.com/adamaiken89/courses/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://bun.sh"><img src="https://img.shields.io/badge/bun-1.0+-orange.svg" alt="Bun" /></a>
  <a href="https://github.com/adamaiken89/courses/pulls"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome" /></a>
</p>

## Features

- **Course browser** — course list → module list → lesson, with course/module switchers
- **Quizzes** — MCQ per module, instant scoring
- **Spaced repetition** — SM-2 algorithm via SRS deck (JSON), star cards, filter by due/starred/all
- **User card review** — create and review custom flashcards
- **AI assistant** — ask Gemini 2.0 Flash about lesson content in sidebar
- **Annotations** — highlights, notes, and bookmarks per module via JSON persistence
- **Syntax highlighting** — code blocks rendered via highlight.js (custom dark theme)
- **Reader navigation** — prev/next module and section buttons, font size controls (10–28px)
- **Book-like reading** — 8 themes (Dark, OLED, Nord, Sepia, Gruvbox, Light, Solarized, Catppuccin), decorative headers, blockquotes, wide mode toggle
- **Search** — ⌘K global search across lessons, notes, and highlights
- **Pomodoro timer** — focus/break timer with session tracking
- **Dashboard** — per-course and global study stats
- **Bookmarks page** — browse and jump to saved bookmarks
- **i18n** — multi-language support (English US/UK/CA/AU, 繁體中文)
- **Focus mode** — distraction-free reading view

## Requirements

- [Bun](https://bun.sh/) 1.0+
- macOS (Electrobun desktop app)

## Quick start

```sh
bun install            # install dependencies
bun run start          # build + launch desktop app
```

## Development

```sh
bun run dev            # dev mode (HMR via Vite)
bun run dev:hmr        # Vite HMR + Electrobun concurrently
bun run build          # production build
bun test               # run all tests (bun:test + happy-dom)
bun run check          # tsc + eslint + prettier
bun run knip           # find unused code/exports/dependencies
```

## Project structure

```bash
src/
├── mainview/           # React frontend (Vite)
│   ├── layouts/        # PageLayout, PageHeader, PageContent
│   ├── pages/          # One *Page per View union variant
│   ├── sections/       # Lesson, Quiz, Review, UserCardReview
│   ├── components/     # Leaf-level UI (lesson/, study-tools/, ui/)
│   ├── hooks/          # Domain hooks (useLesson, useBookmarks, etc.)
│   └── stores/         # Zustand stores (view, settings, course, etc.)
└── bun/                # Backend (Electrobun RPC handlers)
    ├── index.ts        # RPC router + all handlers
    ├── course-loader.ts
    ├── lesson-markdown.ts
    ├── gemini.ts
    └── storage.ts
```

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

## Course content

Default course content: <https://github.com/adamaiken89/course-content>

Paste or copy link in Settings → Remote Content input box.

## Tech stack

| Purpose            | Library                                  |
| ------------------ | ---------------------------------------- |
| Desktop shell      | Electrobun                               |
| UI                 | React 19 + TypeScript                    |
| State management   | Zustand                                  |
| Styling            | Tailwind CSS                             |
| Markdown           | react-markdown + remark-gfm + rehype-highlight |
| i18n               | i18next + react-i18next                  |
| Diagrams           | Mermaid                                  |
| Build              | Vite + Bun                               |

## License

MIT
