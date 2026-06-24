# Reading Experience

Book-like prose styles defined in `.book-content` CSS class in `index.css`.

## Themes

8 themes: Dark, OLED, Nord, Sepia, Gruvbox, Light, Solarized, Catppuccin

- Theme enum in `settingsStore.ts` type `Theme`
- `cycleTheme()` for LessonSection toolbar, `setTheme(t)` for SettingsPage grid
- Each theme: `.book-content.book-<theme>` block in `index.css` (text, headings, code highlighting, blockquotes, tables)

## Typography

- Decorative headers with clear h1-h6 hierarchy
- Custom dark syntax highlighting theme (highlight.js)
- Blockquotes with indigo accent
- Nested list styling
- GFM table support via `remarkGfm`
- Adjustable font size (10–28px)

## Navigation

- Section-based navigation with scroll tracking
- Module switch (`onNextModule`/`onPrevModule`) scrolls content to top
- Section panel star color: bookmarked → yellow, active section → white, inactive → grey

## Module declarations

`src/types/` holds ambient `.d.ts` files for packages lacking `@types`:
- `js-yaml.d.ts` — `load`/`dump` signatures
- `three.d.ts` — bare `declare module "three"` (electrobun dependency)
