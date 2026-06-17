# Module 4: Runtime CSS-in-JS (styled-components) in React

Est. study time: 2.5h
Language: en

## Learning Objectives
- Understand runtime CSS-in-JS mechanism and bundle cost
- Implement ThemeProvider pattern in React
- Evaluate RSC compatibility and SSR hydration
- Make informed 2026 decision about runtime CSS-in-JS

---

## Core Content

### How Runtime CSS-in-JS Works

Runtime CSS-in-JS (styled-components, Emotion) generates `<style>` elements at runtime. Every component render that changes styles triggers re-parsing.

Flow:
1. `styled.button` called — parses template literal CSS string
2. Generates unique class name (e.g., `sc-bdVaJa`)
3. Creates CSS rule string
4. Injects `<style>` tag into `<head>` (or appends to existing style tag)
5. Returns component with generated class

```tsx
// What you write:
const Button = styled.button`
  padding: 8px 16px;
  color: ${p => p.$variant === 'danger' ? 'red' : 'blue'};
`;

// What runs:
// 1. Parse template string with interpolated values
// 2. Hash to class name: sc-bdVaJa
// 3. Inject: <style>[data-styled="active"] .sc-bdVaJa { padding: 8px 16px; color: red; }</style>
// 4. Render: <button class="sc-bdVaJa">
```

> **Think**: Every time `$variant` changes, what happens to the injected styles?
>
> *Answer: styled-components generates a new class for each unique prop combination. If variant toggles between 'danger' and 'default', two style rules exist in DOM. CSS is never removed — it accumulates. Over many combinations, the style tag grows unbounded.*

### Bundle Cost Breakdown

Runtime CSS-in-JS adds two cost layers:

**1. Library runtime (~12-15 kB gzip)**

This is the JS engine that parses CSS strings, generates classes, and manages injection. Ships with every bundle — even pages with zero styled components pay for it if tree-shaking fails.

**2. Styled component definitions in JS bundle**

Each `styled.button\`...\`` is a JavaScript tagged template expression. The CSS string lives in the JS bundle:

```
Component A: "padding: 8px; color: blue;" → ~10kB source → ~3kB gzip in JS bundle
Component B: "padding: 16px; color: red;" → ~10kB source → ~3kB gzip in JS bundle
```

These strings could be in a `.css` file at zero bundle cost. With runtime CSS-in-JS, they ship as JS.

**Comparison for 100-component app:**
- CSS Modules: 0 kB runtime, ~15 kB CSS (separate file)
- styled-components: ~14 kB runtime + ~30 kB CSS strings in JS = ~44 kB

> **Think**: What happens to CSS bundle if a component is lazy-loaded with React.lazy?
>
> *Answer: styled-components injects into the global style tag — lazy loading doesn't isolate component styles. All styles merge into one growing style element. CSS Modules naturally code-split: lazy component's CSS loads only when the chunk loads.*

### ThemeProvider in React

styled-components uses React Context for theme propagation:

```tsx
import { ThemeProvider } from 'styled-components';

const theme = {
  colors: {
    primary: '#0366d6',
    background: '#ffffff',
  },
  space: { sm: '8px', md: '16px' },
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <Button />
    </ThemeProvider>
  );
}

// Button reads theme via props:
const Button = styled.button`
  background: ${p => p.theme.colors.primary};
  padding: ${p => p.theme.space.sm};
`;
```

Theme object is accessible in every styled component via `props.theme`. Theme changes trigger re-render of all consuming components.

**Tradeoff**: ThemeProvider couples every styled component to React Context. Your design system cannot work without a wrapping `<ThemeProvider>`. Consumers of your component library must install styled-components and wrap their app.

### SSR Hydration and RSC

**SSR problem**: styled-components generates class names differently on server vs client unless server-side rendering is configured with `StyleSheetManager` and server-side sheet extraction.

```tsx
// Next.js Pages Router needs:
import { ServerStyleSheet } from 'styled-components';
// Custom _document.tsx to collect and inject styles
// Without this: FOUC (flash of unstyled content) on every page load
```

**RSC incompatibility**: styled-components uses `createContext`, hooks, and DOM API — all unavailable in Server Components. Every styled component needs `"use client"`.

```tsx
"use client"; // Required for RSC
import styled from 'styled-components';

const Button = styled.button`
  padding: 8px;
`;

// This component cannot be a Server Component
// Its entire JS bundle ships to the client
```

> **Think**: In a Next.js App Router app with 80% RSC and 20% client components, where do styled components end up?
>
> *Answer: Forced into the 20% client bundle. You can't use styled components in your server-rendered product listing (80% of the app). They only work inside the "use client" boundary.*

### When Runtime CSS-in-JS Still Makes Sense in 2026

- **Existing codebase** — migrating thousands of styled components costs more than the runtime tax
- **Electron / desktop apps** — no SSR, no RSC, bundle size less critical
- **Heavy dynamic theming** — runtime prop interpolation genuinely simpler than CSS custom properties + clsx for some teams
- **Rapid prototyping** — no file switching, no CSS file management

But for greenfield React apps in 2026, the trend away from runtime CSS-in-JS is clear.

> **Think**: The CTO says "we use styled-components company-wide." You're starting a new product. Do you use it?
>
> *Answer: Depends. If the product uses App Router / RSC: push back — runtime CSS-in-JS forces client components, defeating RSC benefits. If SPA with no SSR: acceptable, bundle cost is the main concern.*

### Emotion vs styled-components

| Aspect | styled-components | Emotion |
|--------|------------------|---------|
| Bundle | ~14 kB gzip | ~11 kB gzip |
| API | `styled.tag` only | `styled.tag` + `css` prop |
| SSR | Requires config | Better out-of-box |
| RSC | Incompatible | Incompatible |
| Community | Larger, more resources | Smaller, but actively maintained |
| 2026 trend | Declining new usage | Declining new usage |

Both face same fundamental limitation: runtime style injection is antithetical to React's RSC direction.

---

### Why This Matters

Runtime CSS-in-JS was the dominant approach from 2018-2022. Many existing codebases use it. Understanding its internals and costs helps you maintain legacy apps, evaluate migration, and defend decisions against "but styled-components is what we've always used."

---

### Common Questions

**Q: Does styled-components tree-shake unused components?**
A: Partially. The runtime library (~14 kB) tree-shakes poorly because it's a single module. Individual styled components tree-shake if not imported — but the runtime stays.

**Q: Can I use styled-components with Tailwind?**
A: You *can*, but mixing patterns is confusing. Each component uses one approach. Don't combine within one file.

**Q: What's the migration path from styled-components to zero-cost CSS?**
A: Incremental: new components use CSS Modules or Tailwind. Extract shared design tokens as CSS custom properties. Replace one component at a time. No rewrite.

---

## Examples

### Example 1: Themed Button

```tsx
import styled, { css } from 'styled-components';

const variants = {
  primary: css`background: #0366d6; color: white;`,
  danger: css`background: #d73a49; color: white;`,
  ghost: css`background: transparent; color: #0366d6;`,
};

const sizes = {
  small: css`padding: 4px 8px; font-size: 14px;`,
  large: css`padding: 12px 24px; font-size: 18px;`,
};

const Button = styled.button<{
  $variant?: keyof typeof variants;
  $size?: keyof typeof sizes;
}>`
  display: inline-flex;
  align-items: center;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  ${p => p.$variant && variants[p.$variant]}
  ${p => p.$size && sizes[p.$size]}
`;

function App() {
  return (
    <ThemeProvider theme={appTheme}>
      <Button $variant="primary" $size="large">Submit</Button>
      <Button $variant="ghost">Cancel</Button>
    </ThemeProvider>
  );
}
```

### Example 2: Migration Pattern (styled → CSS Module)

**Before:**
```tsx
const Card = styled.div`
  padding: 16px;
  background: ${p => p.theme.colors.surface};
  border-radius: 8px;
`;
```

**After:**
```tsx
import styles from './Card.module.css';

// Theme tokens → CSS custom properties on root (handled once)
function Card({ children }) {
  return <div className={styles.card}>{children}</div>;
}
```

Theming moves from ThemeProvider to CSS custom properties — same runtime cost, zero library dependency.

---

## Key Takeaways
- Runtime CSS-in-JS injects `<style>` at runtime — ~12-15 kB library + CSS strings in JS bundle
- ThemeProvider uses React Context — couples library to consumers
- RSC incompatible — every styled component needs `"use client"`
- SSR requires extra configuration to prevent FOUC
- Declining for greenfield 2026 — replaced by zero-runtime, CSS Modules, Tailwind
- Valid for legacy codebases, electron apps, rapid prototypes

---

## Common Misconception

**"styled-components has zero runtime cost because it generates static CSS at build."**

False. styled-components and Emotion are runtime engines.
- Tagged template literal `styled.button\`...\`` executes in browser
- CSS string parsing happens on every mount
- Style injection manipulates DOM
- Library runtime ships to every client

Zero-runtime CSS-in-JS (Vanilla Extract, Linaria) is the build-time approach. The names are confusing — distinguish by "does it execute in the browser?"

---

## Feynman Explain
(Explain why runtime CSS-in-JS costs more than it seems. Include: bundle size, SSR setup, RSC restriction, DOM injection.)

---

## Reframe
(Pause. Judge: would you start a new React project with styled-components in 2026? What would convince you otherwise?)

---

## Drill
Take the quiz to test runtime cost and compatibility understanding.
