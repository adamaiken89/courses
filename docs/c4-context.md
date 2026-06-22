# C4 Context Diagram — CourseReader (Level 1)

```mermaid
C4Context
  title System Context — CourseReader

  Person(student, "Student", "Person using CourseReader to study courses")

  System_Boundary(cr, "CourseReader") {
    System(courseReader, "CourseReader", "Electrobun + React 18 + TypeScript + Bun desktop study app")
  }

  Rel(student, courseReader, "Reads lessons, takes quizzes, reviews with SRS, asks AI questions")

  System_Ext(fs, "File System", "subjects/ directory with YAML/MD/JSON course data")
  System_Ext(gemini, "Google Gemini API", "gemini-2.0-flash for AI Q&A")

  Rel(courseReader, fs, "Loads subjects, modules, lessons, quizzes, SRS decks")
  Rel(courseReader, gemini, "Sends highlighted text + questions for AI explanation")
```

## Elements

| Element | Type | Description |
|---------|------|-------------|
| Student | Person | End user who studies course material |
| CourseReader | System | Electrobun desktop app: React 18 + TypeScript frontend, Bun backend |
| File System | External System | Local `subjects/` directory tree |
| Google Gemini API | External System | `generativelanguage.googleapis.com` |

## Relationships

- Student → CourseReader: reads lessons, takes quizzes, reviews SRS cards, asks AI
- CourseReader → File System: reads syllabus YAML, lesson MD, quiz YAML, SRS JSON
- CourseReader → Gemini API: POST requests with course context + student question
