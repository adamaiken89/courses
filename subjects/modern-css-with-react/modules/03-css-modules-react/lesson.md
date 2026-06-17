# Module 3: CSS Modules in React

Est. study time: 2.5h
Language: en

## Learning Objectives
- Use CSS Modules in React with TypeScript integration
- Compose classes and handle dynamic variants
- Apply CSS Modules in Next.js and Vite

---

## Core Content

### How CSS Modules Work

CSS Modules transform class names at build time. Each file `*.module.css` produces an export object mapping original names to unique generated names.

```css
/* Button.module.css */
.base { padding: 8px 16px; }
.primary { background: blue; }
```

Compiles to:

```css
/* Output */
.Button_base_1a2b3 { padding: 8px 16px; }
.Button_primary_4d5e6 { background: blue; }
```

React imports use the mapping object:

```tsx
import styles from './Button.module.css';

function Button() {
  return <button className={styles.base}>Click</button>;
  // Renders: <button class="Button_base_1a2b3">Click</button>
}
```

> **Think**: What happens if two CSS Module files both define `.base`?
>
> *Answer: No conflict. Each generates unique class names scoped to its file. `.base` in Button.module.css → `.Button_base_1a2b3`. `.base` in Card.module.css → `.Card_base_7f8g9`.*

### TypeScript Integration

CSS Modules aren't TypeScript-aware by default — `styles.base` is typed as `string`, not `'base' | 'primary'`. Enable typed class names:

**Next.js**: built-in. No config.

**Vite**: `vite-plugin-lsc` or TypeScript plugin.

**Manual**: declare module:

```typescript
// src/types/css-modules.d.ts
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
```

For strict typed modules per file, use `typed-scss-modules` or generate `.module.css.d.ts`:

```typescript
// Button.module.css.d.ts (auto-generated)
export const base: string;
export const primary: string;
export const disabled: string;
```

Then `styles.base` is typed as `string`, but if the key doesn't exist, TypeScript errors.

> **Think**: Why would you want strict typing on CSS Module imports?
>
> *Answer: Catch typos at compile time instead of runtime. `styles.primari` → TypeScript error. Without typing, it's `undefined` → no class applied → silent visual bug.*

### Dynamic Classes with CSS Modules

CSS Modules return strings. Dynamic variants use class composition:

```tsx
import styles from './Button.module.css';
import clsx from 'clsx';

function Button({ variant, disabled }) {
  return (
    <button className={clsx(
      styles.base,
      variant === 'primary' && styles.primary,
      variant === 'outline' && styles.outline,
      disabled && styles.disabled
    )}>
      Click
    </button>
  );
}
```

Pattern: base class always present + conditional variant classes.

**Inline styles for truly dynamic values**:

```tsx
function ProgressBar({ percent }) {
  return (
    <div className={styles.track}>
      <div
        className={styles.fill}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
```

Static styles → CSS Module. Dynamic runtime values (position, dimension, color from data) → inline `style` prop.

> **Think**: When should you NOT use CSS Modules for dynamic styles?
>
> *Answer: When the value is runtime-computed (API response, user input, animation progress). CSS Modules are build-time static. For truly dynamic values, inline `style` prop or CSS custom properties are correct.*

### Composition Pattern

CSS Modules support `composes` to reuse styles within the same file:

```css
/* Typography.module.css */
.heading {
  font-weight: 700;
  line-height: 1.2;
}
.headingLarge {
  composes: heading;
  font-size: 24px;
}
```

In React, `composes` is transparent — both class names appear in the DOM:

```tsx
<h1 className={styles.headingLarge}>
  {/* Renders: class="Typography_headingLarge_abc Typography_heading_123" */}
</h1>
```

**When to use `composes`**: Shared base styles within a component file. Avoid cross-file `composes` — it creates coupling similar to Sass `@extend`.

### CSS Modules in Next.js

Next.js App Router uses CSS Modules by default:

```tsx
// app/page.tsx
import styles from './page.module.css';

export default function Page() {
  return <main className={styles.main}>...</main>;
}
```

**Rules:**
- Global CSS only in `app/globals.css` (imported via `layout.tsx`)
- Component CSS always `*.module.css`
- `app/page.module.css` is scoped to `app/page.tsx`
- CSS Modules work in both Server and Client components

```tsx
// Works in RSC — no JavaScript dependency
import styles from './Card.module.css';

export default function Card({ title }) {
  return <div className={styles.card}>{title}</div>;
}
```

### CSS Modules in Vite

Vite supports CSS Modules natively — file naming `*.module.css` triggers module mode.

```tsx
// Vite — same API as Next.js
import styles from './Button.module.css';

// Vite-specific: CSS Modules + PostCSS
// postcss.config.js works with CSS Modules for nesting, autoprefixer
```

Vite also supports `.module.scss` and `.module.less` (Out of the box for Sass). Same scoping mechanism.

### Limitations

1. **Dynamic style computation** — requires inline styles or CSS custom properties
2. **No runtime theme access** — can't read `props.theme` like styled-components
3. **File per component** — 1 CSS file per React component (convention, not requirement)
4. **No prop-driven style logic** — conditions handled via `clsx` in JSX
5. **Global class interop** — third-party CSS (e.g., animation library) requires `:global` directive

```css
/* Apply global class from animation library */
.card {
  composes: animate__fadeIn from global;
}
```

> **Think**: CSS Modules are often called "the boring choice" for React styling. Why is boring a strength?
>
> *Answer: Zero runtime, zero dependencies, works with every React paradigm (RSC, SSR, SPA), standard CSS syntax, no vendor lock-in. Boring = stable, well-understood, always works.*

---

### Why This Matters

CSS Modules are the default in both Next.js and Vite — the two dominant React frameworks. Understanding them means understanding the default styling mechanism for most React apps in 2026. They're also the foundation that Tailwind and zero-runtime CSS-in-JS build on (both generate CSS Modules under the hood in many setups).

---

### Common Questions

**Q: Can I use Sass syntax with CSS Modules?**
A: Yes. `.module.scss` files work identically — compile Sass with scoped class names.

**Q: How do I style a child component from a parent?**
A: Pass the class name as a prop or use `:global`:

```tsx
// Parent passes class
<Child className={styles.childOverride} />

// Or in CSS Module: target child class globally
.parent :global(.child-class) { ... }
```

**Q: Do CSS Modules affect SSR or hydration?**
A: No. Class names are deterministic based on build. Server and client generate identical class names.

---

## Examples

### Example 1: Multi-Variant Button

```css
/* Button.module.css */
.button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}
.primary { background: #0366d6; color: white; }
.outline { background: transparent; border-color: #0366d6; color: #0366d6; }
.small { padding: 4px 8px; font-size: 14px; }
.large { padding: 12px 24px; font-size: 18px; }
.disabled { opacity: 0.5; pointer-events: none; }
```

```tsx
// Button.tsx
import styles from './Button.module.css';
import clsx from 'clsx';

type ButtonProps = {
  variant?: 'primary' | 'outline';
  size?: 'small' | 'default' | 'large';
  disabled?: boolean;
};

function Button({ variant = 'primary', size = 'default', disabled, children }: ButtonProps) {
  return (
    <button className={clsx(
      styles.button,
      styles[variant],
      size !== 'default' && styles[size],
      disabled && styles.disabled
    )}>
      {children}
    </button>
  );
}
```

### Example 2: Themed Card via CSS Custom Properties

```css
/* Card.module.css */
.card {
  background: var(--card-bg, white);
  border: 1px solid var(--card-border, #e1e4e8);
  border-radius: 8px;
  padding: 16px;
}
.title {
  font-size: 18px;
  color: var(--card-title, #24292f);
}
```

```tsx
// Card.tsx
import styles from './Card.module.css';

function Card({ title, children, themeClass }) {
  return (
    <div className={clsx(styles.card, themeClass)}>
      <h3 className={styles.title}>{title}</h3>
      {children}
    </div>
  );
}

// Consumer:
<div className="dark-theme">
  <Card title="Hello" />
</div>
```

---

## Key Takeaways
- CSS Modules generate unique class names per file — zero specificity conflicts
- Import as object: `import styles from './Component.module.css'`
- Dynamic variants via `clsx(styles.base, condition && styles.variant)`
- TypeScript typing available via `.d.ts` generation
- Build-time only — no runtime cost, RSC-compatible
- CSS Modules are the default styling mechanism in Next.js and Vite
- Limitations: no dynamic style computation, no prop-driven theming (use CSS custom properties)

---

## Common Misconception

**"CSS Modules are just like plain CSS with extra build steps."**

They look like plain CSS but behave differently:
- Class names are local by default, not global
- `:global(.selector)` explicitly escapes to global scope
- `composes` provides style reuse without Sass `@extend`
- File naming convention (`*.module.css`) activates module behavior
- Build tools generate unique hashes per class

They feel like plain CSS but provide component isolation.

---

## Feynman Explain
(Explain CSS Modules to someone who only knows global CSS. Focus on: why class names get hashed, how imports map, why this prevents conflicts.)

---

## Reframe
(Pause. Judge: CSS Modules are the "default path" in 2026. When would you deliberately NOT use them? What gaps force you to reach for another approach?)

---

## Drill
Take the quiz. Questions cover imports, composition, dynamic classes, and integration.
