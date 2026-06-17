# Module 2: Plain CSS & Sass in React

Est. study time: 2h
Language: en

## Learning Objectives
- Apply plain CSS and Sass in React while managing global namespace
- Design BEM naming that survives component architecture
- Use Sass mixins for React design tokens without runtime cost
- Evaluate when plain CSS/Sass is the right choice vs alternatives

---

## Core Content

### Global CSS in React — The Problem

React components encapsulate JSX and logic. CSS globals don't encapsulate — every rule targets the document.

```css
/* This affects EVERY button on the page */
button { background: blue; }
.card { padding: 16px; }
```

In a component tree, global CSS creates invisible coupling. Component A's `.card` styles affect Component B's `.card`. Fixing B breaks A.

> **Think**: You import a CSS file in ComponentA.tsx. Does ComponentB (sibling, no import) get those styles?
>
> *Answer: Yes. CSS in React is global by default. Import order matters for cascade but any imported CSS affects entire document regardless of which component imports it.*

### BEM as Namespacing Strategy

BEM (Block Element Modifier) is the primary way to namespace plain CSS:

```
.block {}           /* Component scope */
.block__element {}  /* Child of component */
.block--modifier {} /* Variant of block */
```

In React, BEM block = component name:

```css
/* Button.css */
.button { display: inline-flex; }
.button__icon { margin-right: 8px; }
.button--primary { background: var(--color-primary); }
.button--large { padding: 12px 24px; }
```

```tsx
// Button.tsx
function Button({ variant, size, children }) {
  return (
    <button className={clsx(
      'button',
      variant && `button--${variant}`,
      size && `button--${size}`
    )}>
      {children}
    </button>
  );
}
```

**Tradeoff**: Pure string classes — no TypeScript checking for valid BEM names. Typo in `button--primari` silently applies nothing.

> **Think**: With plain CSS in React, how do you prevent a developer from accidentally using `.card` in a new component?
>
> *Answer: You can't — that's the limitation. Naming conventions (BEM, prefixing) mitigate but don't enforce. Code review catches it. CSS Modules or Tailwind solve this structurally.*

### Sass in React — What Works, What Doesn't

**Sass features that work well in React:**

- **Variables** → design tokens (`$color-primary: #0366d6`)
- **Mixins** → reusable style patterns (`@mixin truncate` → `@include truncate`)
- **Nesting** → component structure (`button { .icon { ... } }`)
- **Functions** → token calculations (`darken($color-primary, 10%)`)

**Sass features that conflict with React component model:**

- `@extend` — creates cross-component coupling. Component A extends B's selector → touching B can break A. Avoid.
- Deep nesting (>3 levels) — generates high-specificity selectors `.header .nav .list .item a`. Component isolation breaks.
- Loop-driven CSS generation — abstracts away what CSS is actually outputted. Debugging becomes guesswork.

> **Think**: Why is Sass `@extend` dangerous in a React component library?
>
> *Answer: @extend moves the selector to wherever the extended rule is defined. If Component A extends Component B's placeholder, now A depends on B's presence in the cascade. Removing B breaks A unexpectedly. Copy-paste the styles instead.*

### Design Tokens as Sass Variables

Sass variables make excellent design tokens because they compile to static values — zero runtime.

```scss
// _tokens.scss
$color-primary: #0366d6;
$color-danger: #d73a49;
$space-xs: 4px;
$space-sm: 8px;
$space-md: 16px;
$radius-sm: 4px;
$radius-md: 8px;
$font-body: 16px;
$font-heading: 24px;
```

```scss
// Button.scss
@use 'tokens' as t;

.button {
  padding: t.$space-sm t.$space-md;
  font-size: t.$font-body;
  border-radius: t.$radius-sm;
}
```

This compiles to static CSS — same as writing `padding: 8px 16px`. No variables in output, no JS needed.

**Limitation**: Tokens are compile-time only. Runtime theme switching requires CSS custom properties (Module 8).

> **Think**: You have Sass variables for colors. User clicks "dark mode". How do you change all `$color-bg` values?
>
> *Answer: You can't — Sass compiles away. Runtime theme switching needs CSS custom properties (`var(--color-bg)`) which are live in the browser. Sass for static tokens + CSS custom properties for dynamic.*

### When Plain CSS/Sass Fits React

**Good fit:**
- Legacy app with established Sass codebase
- Global styles (reset, typography, fonts)
- Animation keyframes (shared across components)
- Print stylesheets
- Single-page app with no SSR concerns
- All team members know Sass, don't know CSS Modules

**Bad fit:**
- RSC-first app (import order unpredictable in RSC)
- Large team (20+ devs) — naming collisions inevitable
- Component library consumed externally — consumers get global styles
- Any app where "this CSS affects that component" happens monthly

> **Think**: How would you import a global CSS file in a Next.js App Router app?
>
> *Answer: Only in `layout.tsx` or `app/globals.css`. Next.js App Router restricts global CSS to root layout — no per-page global CSS. Component-level CSS must use CSS Modules or Tailwind.*

---

### Why This Matters

Plain CSS is the simplest setup but doesn't scale in component architecture. Most developers start here and migrate when naming collisions surface. Understanding BEM and Sass integration means you can work in legacy codebases and make deliberate migration decisions rather than fighting the cascade.

---

### Common Questions

**Q: Can I use Sass with Next.js or Vite?**
A: Yes. Next.js has built-in Sass support (`npm install sass`). Vite supports `.scss` files with `sass` dependency. Both compile to CSS at build.

**Q: Should I use Sass in a new React project in 2026?**
A: If team loves Sass and has no RSC concerns, yes. But Tailwind or CSS Modules are more common for new projects. Sass is increasingly a "mature codebase" choice.

**Q: Does CSS custom properties replace Sass variables entirely?**
A: No. Sass variables compile to static values — they ensure final CSS has no variable indirection. Custom properties are dynamic (runtime-evaluated). Use Sass for build-time constants, custom properties for runtime theme values.

---

## Examples

### Example 1: BEM + Sass in a Button Component

```scss
// styles/buttons.scss
@use '../tokens' as *;

.button {
  display: inline-flex;
  align-items: center;
  gap: $space-sm;
  padding: $space-sm $space-md;
  border: 1px solid transparent;
  border-radius: $radius-sm;
  cursor: pointer;

  &__icon {
    width: 16px;
    height: 16px;
  }

  &--primary {
    background: $color-primary;
    color: white;
  }

  &--outline {
    background: transparent;
    border-color: $color-primary;
    color: $color-primary;
  }

  &--large {
    padding: $space-md $space-lg;
    font-size: 18px;
  }
}
```

```tsx
// Button.tsx
import './styles/buttons.scss';

type Variant = 'primary' | 'outline';
type Size = 'default' | 'large';

function Button({ variant = 'primary', size = 'default', children }) {
  const className = clsx(
    'button',
    `button--${variant}`,
    size !== 'default' && `button--${size}`
  );
  return <button className={className}>{children}</button>;
}
```

### Example 2: Global Stylesheet Layout

```scss
// styles/global.scss
@use 'tokens' as *;

*, *::before, *::after { box-sizing: border-box; }

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: $font-body;
  color: $color-text;
  background: $color-bg;
}

h1, h2, h3 { margin: 0; line-height: 1.2; }
```

```tsx
// app/layout.tsx (Next.js App Router)
import './styles/global.scss';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>{children}</body>
    </html>
  );
}
```

---

## Key Takeaways
- Plain CSS in React is globally scoped — naming collisions are the main scaling problem
- BEM provides namespacing but no enforcement — typos produce silent failures
- Sass mixins and variables are good for static design tokens
- Avoid Sass `@extend` in React — creates invisible cross-component coupling
- Import global CSS only in root layout (Next.js App Router) or `index.tsx`
- Plain CSS/Sass best for: legacy codebases, global styles, animation keyframes
- Worst for: RSC apps, large teams, external component libraries

---

## Common Misconception

**"Sass nesting mirrors React component nesting, so it's fine to nest deeply."**

```scss
// Bad — 5 levels deep, high specificity
.card {
  .header {
    .title {
      .icon {
        ...  // specificity: .card .header .title .icon
      }
    }
  }
}
```

React component structure should flatten CSS. A `CardHeader` component gets its own styles. Deep nesting creates specificity arms race — later components need `!important` to override.

**Correct approach**: One level of nesting per component. If nesting exceeds 3 levels, extract a child component.

---

## Feynman Explain
(Explain to a junior developer: "Why can't I just write CSS in one big file and import it in React?")

*When ready, run `learn.sh explain` for gap probe.*

---

## Reframe
(Pause. Judge: Is BEM worth the effort in 2026? CSS Modules and Tailwind solve the same problem structurally. For which apps is BEM still the best answer?)

---

## Drill
Take the quiz to test BEM naming and Sass tradeoffs.
