# Module 5: Zero-Runtime CSS-in-JS (Vanilla Extract)

Est. study time: 2h
Language: en

## Learning Objectives
- Understand build-time extraction mechanism
- Create typed styles with Vanilla Extract recipes and sprinkles
- Use zero-runtime CSS-in-JS for RSC components and design systems

---

## Core Content

### Build-Time Extraction

Zero-runtime CSS-in-JS (Vanilla Extract, Linaria, PandaCSS, StyleX) reads CSS-in-JS files during build and outputs static `.css` files. No style injection at runtime.

```typescript
// Button.css.ts — Vanilla Extract
import { style } from '@vanilla-extract/css';

export const button = style({
  display: 'inline-flex',
  padding: '8px 16px',
  borderRadius: '6px',
  backgroundColor: '#0366d6',
  color: 'white',
});
```

At build time, Vanilla Extract reads every `.css.ts` file:
1. Executes the module in Node.js (build-time context)
2. Collects style objects
3. Generates scoped class names
4. Writes static CSS file
5. Replaces imports with generated class names

```css
/* Generated output */
.Button_button_1a2b3c {
  display: inline-flex;
  padding: 8px 16px;
  border-radius: 6px;
  background-color: #0366d6;
  color: white;
}
```

**Result**: Browser receives CSS file + JS without any CSS strings. Same zero-cost as CSS Modules, with CSS-in-JS syntax.

> **Think**: If the .css.ts file runs at build time in Node.js, what can't you use inside it?
>
> *Answer: Browser APIs, React runtime, hooks, context, props. Build-time execution means you only have access to Node.js APIs and static values. Dynamic values via CSS custom properties only.*

### TypeScript-First Design

Vanilla Extract's key advantage over CSS Modules: **styles are typed**.

```typescript
// CSS Modules — styles[key] typed as string, not validated
import styles from './Button.module.css';
styles.primary // OK at TS level even if primary doesn't exist

// Vanilla Extract — style returns typed string
import { button, primary } from './Button.css.ts';
button // typed as string, but must exist in source file
primary // TS error if not exported from .css.ts
```

No manual `.d.ts` generation needed — types flow from the export.

**Recipes** — type-safe variant system:

```typescript
import { recipe } from '@vanilla-extract/recipes';

export const button = recipe({
  base: { display: 'inline-flex', padding: '8px 16px' },
  variants: {
    variant: {
      primary: { background: '#0366d6', color: 'white' },
      danger: { background: '#d73a49', color: 'white' },
      ghost: { background: 'transparent' },
    },
    size: {
      small: { padding: '4px 8px', fontSize: '14px' },
      large: { padding: '12px 24px', fontSize: '18px' },
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'small',
  },
});
```

In React:

```tsx
import { button } from './Button.css.ts';

function Button({ variant, size }: ButtonProps) {
  return (
    <button className={button({ variant, size })}>
      Click
    </button>
  );
  // result: button() returns combined class string based on variant/size
  // button({ variant: 'primary', size: 'large' }) → "Button_button_1a2b3 primary_large_4d5e6"
}
```

Recipes give type-safe variants — invalid variant name = TypeScript error.

### RSC Compatibility

Zero-runtime CSS-in-JS is fully RSC-compatible:

```tsx
// Server Component — no 'use client' needed
import { card } from './Card.css.ts';

export default function Card({ title, children }) {
  return (
    <div className={card}>
      <h2>{title}</h2>
      {children}
    </div>
  );
}
```

Why it works: `.css.ts` files execute at build time, not at request time. The output is a className string — same as CSS Modules. No runtime, no hooks, no Context.

### Sprinkles — Atomic CSS Generation

Vanilla Extract Sprinkles generates type-safe atomic utility classes (like Tailwind but typed):

```typescript
// sprinkles.css.ts
import { defineProperties, createSprinkles } from '@vanilla-extract/sprinkles';

const space = { none: 0, sm: '8px', md: '16px', lg: '24px' };
const colors = { primary: '#0366d6', danger: '#d73a49', surface: '#f6f8fa' };

const responsiveProperties = defineProperties({
  conditions: {
    mobile: {},
    tablet: { '@media': '(min-width: 768px)' },
    desktop: { '@media': '(min-width: 1024px)' },
  },
  defaultCondition: 'mobile',
  properties: {
    padding: space,
    margin: space,
    backgroundColor: colors,
    color: colors,
    gap: space,
  },
});

export const sprinkles = createSprinkles(responsiveProperties);
```

```tsx
// Usage — typed responsive utilities
function Card() {
  return (
    <div className={sprinkles({
      padding: { mobile: 'sm', tablet: 'md', desktop: 'lg' },
      backgroundColor: 'surface',
    })}>
      ...
    </div>
  );
}
// Generates atomic classes for each property+breakpoint combination
// Only classes actually used are generated (build-time)
```

### Vanilla Extract vs PandaCSS vs StyleX

| | Vanilla Extract | PandaCSS | StyleX (Meta) |
|--|----------------|----------|--------------|
| Maker | Seek | Chakra UI team | Meta (Facebook) |
| Approach | `.css.ts` files | `.css.ts` or config-based | Babel plugin |
| Recipes | Built-in | Built-in (sva) | Pattern-based |
| Sprinkles | Built-in (separate) | Built-in (patterns) | N/A |
| RSC | Yes | Yes | Yes |
| Bundle | 0 kB runtime | 0 kB runtime | 0 kB runtime |
| Community | Largest 2026 | Growing | Niche (Meta ecosystem) |

> **Think**: PandaCSS and Vanilla Extract both claim "zero runtime." What's the meaningful difference?
>
> *Answer: API style. Vanilla Extract forces `.css.ts` files (explicit file per style). PandaCSS supports `.css.ts` AND a config-based approach via panda.config.ts with design token definitions and generated JSX patterns. Vanilla Extract is more TypeScript-native; PandaCSS is more config-driven with codegen.*

### Tradeoffs vs CSS Modules

| Aspect | CSS Modules | Vanilla Extract |
|--------|-------------|-----------------|
| Syntax | Standard CSS | JS/TS objects |
| Typing | Manual `.d.ts` | Built-in (TS files) |
| Variant system | clsx in JSX | recipe() |
| Theming | CSS custom properties | CSS custom properties + theme contracts |
| Learning curve | Low (standard CSS) | Medium (new API) |
| Build tool | Any bundler | Requires Vite/Webpack plugin |
| Error messages | Raw CSS parser | TypeScript errors |

---

### Why This Matters

Zero-runtime CSS-in-JS is the fastest-growing React CSS approach in 2026. It combines the developer experience of CSS-in-JS (type safety, component colocation, dynamic variants) with the zero-cost output of CSS Modules. For design systems and type-safe styling, it's the most complete option.

---

### Common Questions

**Q: Can I use Vanilla Extract with Next.js?**
A: Yes. Next.js plugin (`@vanilla-extract/next-plugin`) integrates with both Pages Router and App Router.

**Q: Does zero-runtime CSS-in-JS support dynamic styles?**
A: Via CSS custom properties. Compile-time styles in `.css.ts`, runtime-dynamic values via `var(--prop)` or inline `style`.

**Q: Is zero-runtime CSS-in-JS overkill for a simple app?**
A: Yes. For a 5-page marketing site, CSS Modules or Tailwind suffice. Zero-runtime shines in design systems, multi-theme apps, and TypeScript-heavy codebases.

---

## Examples

### Example 1: Button with Recipes

See recipe example above. Type-safe, zero runtime, RSC-compatible button in ~20 lines.

### Example 2: Themed Design System Contract

```typescript
// theme.css.ts
import { createThemeContract, createTheme } from '@vanilla-extract/css';

export const themeVars = createThemeContract({
  color: { primary: null, surface: null, text: null },
  space: { sm: null, md: null, lg: null },
  radius: { sm: null, md: null },
});

export const lightTheme = createTheme(themeVars, {
  color: { primary: '#0366d6', surface: '#ffffff', text: '#24292f' },
  space: { sm: '8px', md: '16px', lg: '24px' },
  radius: { sm: '4px', md: '8px' },
});

export const darkTheme = createTheme(themeVars, {
  color: { primary: '#58a6ff', surface: '#0d1117', text: '#c9d1d9' },
  space: { sm: '8px', md: '16px', lg: '24px' },
  radius: { sm: '4px', md: '8px' },
});
```

```tsx
// App.tsx
import { lightTheme, darkTheme } from './theme.css.ts';

function App() {
  const [theme, setTheme] = useState(lightTheme);
  return (
    <div className={theme}>
      <Button>...</Button>
    </div>
  );
}

// Button.css.ts uses themeVars — same variables, different values per theme
export const button = style({
  backgroundColor: themeVars.color.primary,
  padding: themeVars.space.md,
});
```

---

## Key Takeaways
- Zero-runtime CSS-in-JS extracts styles at build time — 0 kB runtime, RSC-compatible
- TypeScript-native — no `.d.ts` generation needed
- Recipes for type-safe variants, Sprinkles for typed atomic CSS
- Vanilla Extract, PandaCSS, StyleX — different APIs, same zero-cost principle
- Best for: design systems, typed styling, RSC apps, multi-theme
- Overkill for: simple marketing sites, small teams, rapid prototypes

---

## Common Misconception

**"Zero-runtime CSS-in-JS is just CSS Modules with extra steps."**

Similar output (static CSS files, scoped classes), different DX:
- Type safety: CSS Modules = string map; Vanilla Extract = typed exports
- Variants: CSS Modules = clsx; Vanilla Extract = recipe()
- Theming: CSS Modules = manual CSS vars; Vanilla Extract = typed theme contracts
- Atomic CSS: CSS Modules = none; Vanilla Extract = Sprinkles

Same result layer (scoped CSS), different authoring layer (typed JS objects vs CSS syntax).

---

## Feynman Explain
(Explain how Vanilla Extract differs from styled-components. Key: "build time vs runtime." Why does "running at build time" matter for bundle size and RSC?)

---

## Reframe
(Pause. Judge: would you use Vanilla Extract for your next React project? Which team factors make it a good or bad fit?)

---

## Drill
Take the quiz. Questions contrast zero-runtime with runtime CSS-in-JS and CSS Modules.
