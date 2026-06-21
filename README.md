# CourseReader

macOS SwiftUI study app for structured curricula with quizzes, spaced repetition, and AI-powered Q&A.

## Features

- **Course browser** — subjects split into modules, each with markdown lessons
- **Quizzes** — MCQ per module, instant scoring
- **Spaced repetition** — SM-2 algorithm via SRS deck (JSON)
- **AI assistant** — select text in lesson → ask Gemini 2.0 Flash in sidebar
- **Glassmorphism UI** — `NSVisualEffectView` + design tokens

## Subjects

| Subject | Modules |
|---------|---------|
| Advanced React 19 | — |
| External Library Patterns | 40 |
| Fixed Income | 20 |
| GraphQL Deep Dive | 20 |
| Modern CSS with React | — |
| Zustand State Management | — |

Subjects live in `subjects/<id>/` with syllabus, modules, and SRS deck.

## Architecture

```
View → ViewModel (@Observable @MainActor singleton) → Service
```

- **MVVM** + Swift 6 strict concurrency
- **macOS 15+** only
- **No external dependencies** — manual YAML parser, no frameworks

## Quick start

```sh
make build          # debug build
make run            # build + bundle .app + launch
make test           # run tests
make format         # format sources
make check          # format-check → build → test
```

## Project layout

```
Sources/CourseReader/
├── App/               # @main entry
├── Helpers/           # DesignConstants, AppColors, ButtonStyles, …
├── Models/            # Subject, QuizQuestion, SRSCard/SRSDeck
├── Services/          # CourseLoader, GeminiService, QuizEngine
├── ViewModels/        # CourseViewModel
└── Views/             # ContentView, SubjectListView, ReaderView, …
```

## License

MIT
