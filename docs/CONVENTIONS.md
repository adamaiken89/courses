# CourseReader Conventions

Conventions that apply to every PR and code change. Extracted from the agent-oriented `AGENTS.md` for human readability.

## Architecture

- **Frontend → RPC → Backend handlers** — no direct file I/O from UI.
- **Desktop-only** — all I/O local. No lazy loading, code splitting, chunking, or network optimizations. Import eagerly, bundle once.
- **React 19 + TypeScript strict mode** — frontend via Vite (`src/mainview/`).
- **Bun backend** — Electrobu RPC handlers (`src/bun/`).

## Navigation

React state-driven view stack (no React Router). Pages are mounted/unmounted by `App.tsx` based on a `View` union type.

## Pages

Every page uses three layout wrappers — never inline your own:

```
<PageLayout>
  <PageHeader title={t('key')} />
  <PageContent>
    {...page content}
  </PageContent>
</PageLayout>
```

## State management

| Scope | Mechanism | When |
|-------|-----------|------|
| Cross-cutting | Zustand stores (`src/mainview/stores/`) | Shared state: view, settings, course, bookmarks, highlights, etc. |
| Page-specific | Domain hooks (`src/mainview/hooks/`) | Orchestrate 2-4 stores + page logic |
| State machines | `useReducer` | Complex state flows |
| Trivial UI | `useState` | Local toggle, form input, etc. |

### Store isolation rule

Zustand stores must **never import other stores**. Cross-store orchestration lives in custom hooks:

- `hooks/useCourseListPage` → composes `courseStore` + `viewStore`
- `hooks/useLessonSection` → composes `lessonUIStore` + `notesStore` + `highlightsStore`
- `hooks/useSettingsPage` → composes `settingsStore` + `courseStore`

Consumers call **one hook** instead of 2-4 stores inline.

### Selector granularity

Each `useXxxStore((s) => s.field)` triggers re-render only on that field. Keep selectors atomic — don't return large objects.

## Subcomponents

Receive data via props. Never fetch directly from a subcomponent.

## i18n first

- All user-visible text, emoji, and icons go through `t('key')`
- Locale files at `src/mainview/locales/*.json` — 5 locales: en-US, en-GB, en-AU, en-CA, zh-TW
- Adding UI text requires:
  1. Key in all 5 locale files
  2. Snapshot update (`bun test -u`)

## Keyboard shortcuts

Single source of truth at `src/mainview/shortcuts.ts`:

- Each shortcut has: `{ id, key, scope }`
- Components import `shortcutKey(id)` to display the key binding
- Handlers live in components (switch statements)
- Same key can do same action in different scopes (intentional overlap)
- Adding a shortcut requires:
  1. Entry in `shortcuts.ts`
  2. Handler in the relevant component
- Duplicate detection runs at module load (prevents conflicts)

## Markdown rendering

- `react-markdown` + `remarkGfm` + `rehypeHighlight` (highlight.js)
- Code blocks get syntax highlighting via a custom dark theme

## Styling

- Tailwind CSS utility classes
- `.book-content` CSS class for prose reading styles
- See `src/mainview/index.css`

## Markdown source files

Course content is written in Markdown with frontmatter. Processed by `src/bun/lesson-markdown.ts` which handles Mermaid diagram extraction, image processing, and heading detection.

## Course data model

```
subjects/<dir>/                    # Dir name → Subject.id
├── syllabus.yaml                  # Subject metadata + module list
├── modules/<NN-name>/
│   ├── lesson.md                  # Course content (Markdown)
│   └── quiz.yaml                  # MCQ questions
└── srs/deck.json                  # SM-2 SRS deck
```

Module dir matching: `findModuleDir` scans `modules/<id>/` for `NN-` prefix.

## Data persistence

| Data | Location |
|------|----------|
| Subjects/lessons/quizzes | `subjects/<id>/` (file I/O) |
| SRS decks | `subjects/<id>/srs/deck.json` |
| Highlights, notes, bookmarks | `~/.coursereader/data.json` |
| Gemini API key, prefs | `~/.coursereader/prefs.json` |

## Tooling

- **Bun** — runtime, package manager, test runner
- **Vite** — build (root = `src/mainview/`, output = `dist/`)
- **bun:test** + **happy-dom** — test framework + DOM environment
- **@testing-library/react** — component rendering
- **Zustand** — state management
- **Tailwind CSS** — styling
- **i18next** — internationalization
