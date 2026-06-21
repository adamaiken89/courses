# CourseReader — C4 Architecture Diagrams

## Levels

| Level | File | What it shows |
|-------|------|---------------|
| 1 — Context | `c4-context.md` | CourseReader system boundary, external dependencies (File System, Gemini API) |
| 2 — Container | `c4-container.md` | Single macOS app container with external systems |
| 3 — Component | `c4-components.md` | All internal components: Views, ViewModel, Services, Models, Helpers, App entry |

## Rendering

Diagrams use [Mermaid C4](https://mermaid.js.org/syntax/c4.html) syntax. Render with:

- **VS Code**: [Markdown Preview Mermaid Support](https://marketplace.visualstudio.com/items?itemName=bierner.markdown-mermaid)
- **GitHub**: Native renderer — .md files with mermaid code blocks render automatically
- **CLI**: `npx @mermaid-js/mermaid-cli mmdc -i c4-components.md -o c4-components.png`

## Key

```
Person[Student] → System[CourseReader] → External[File System, Gemini API]
                                        → Container[macOS App]
                                            → Component[View] → Component[ViewModel] → Component[Service] → Model/External
```
