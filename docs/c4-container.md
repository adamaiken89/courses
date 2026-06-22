# C4 Container Diagram — CourseReader (Level 2)

```mermaid
C4Container
  title Container Diagram — CourseReader

  Person(student, "Student", "Person using CourseReader")

  System_Boundary(cr, "CourseReader") {
    Container(frontend, "Frontend", "React 18 + TypeScript + Vite", "Renders UI, manages view stack via Zustand, communicates with backend via HTTP")
    Container(backend, "Backend", "Bun HTTP server (port 50001)", "Serves course data, quiz engine, SRS logic, Gemini proxy, persistence")
  }

  Rel(student, frontend, "Uses")

  System_Ext(fs, "File System", "subjects/ directory + ~/.coursereader/")
  System_Ext(gemini, "Google Gemini API", "REST API")

  Rel(frontend, backend, "fetch()", "JSON/HTTP, port 50001")
  Rel(backend, fs, "Reads subjects YAML/MD/JSON, writes SRS deck + data.json")
  Rel(backend, gemini, "POST /v1beta/models/gemini-2.0-flash:generateContent", "HTTPS")
```

## Elements

| Element | Type | Technology | Description |
|---------|------|------------|-------------|
| Frontend | Container | React 18, TypeScript, Vite, Zustand | Renders UI in Electrobun webview. View stack routing, Tailwind CSS, react-markdown |
| Backend | Container | Bun HTTP server, port 50001 | All API handlers: subjects, lessons, quizzes, SRS, storage. Gemini proxy |
| File System | External | Local disk | Course data in `subjects/<id>/`, prefs in `~/.coursereader/` |
| Google Gemini API | External | REST/HTTPS | AI-powered Q&A on course content |

## Notes

- Two-container architecture: frontend (Electrobun webview) + backend (Bun HTTP server)
- All data is local file I/O on backend side. Frontend has no direct file access.
- Only external dependency is Gemini API (optional, only when AI feature used).
