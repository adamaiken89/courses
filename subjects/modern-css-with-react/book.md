# Module 1: CSS Landscape 2026 — React Edition

Est. study time: 2.5h
Language: en

## Learning Objectives
- Map every major CSS approach in React and its 2026 status
- Evaluate approaches along 6 decision axes
- Select appropriate approach for a given React project context

---

## Core Content

### The 2026 CSS Approaches in React

Six major approaches exist. Each takes a different stance on where CSS lives, how it scopes, and what runs at runtime.

| Approach | Runtime cost | RSC compatible | Scoping | Popular in 2026 |
|----------|-------------|----------------|---------|-----------------|
| Plain CSS / Sass | None | Yes | Global / BEM | Mature codebases |
| CSS Modules | None | Yes | File-scoped | Next.js, Vite defaults |
| Tailwind CSS | Minimal (JIT) | Yes | Utility classes | Dominant new projects |
| Runtime CSS-in-JS | High | Partial | Component-scoped | Declining for new apps |
| Zero-runtime CSS-in-JS | None | Yes | Component-scoped | Rising (Vanilla Extract) |
| CSS with `@scope` | None | Yes | Scoped (native) | Emerging (Chrome 118+) |

> **Think**: A teammate proposes "let's use styled-components for our new Next.js app". What 3 questions should you ask before agreeing?
>
> *Answer: (1) Do we use RSC? styled-components needs client components. (2) What's our SSR story? styled-components has known hydration mismatch issues. (3) Team familiarity — is CSS-in-JS worth the bundle cost vs CSS Modules or Tailwind?*

### Decision Axes Framework

Every CSS approach decision reduces to tradeoffs along 6 axes:

**1. Runtime cost**

Runtime CSS-in-JS injects style tags at runtime. Each styled component call parses template literal → generates class → inserts into DOM. For an app with 200+ styled components, this means re-parsing CSS string on every client render.

Zero-runtime alternatives extract styles at build time. Vanilla Extract reads `.css.ts` files during build, outputs static `.css` files. RSC can stream these without JS.

> Example bundle impact:
> ```
> Runtime CSS-in-JS lib: ~12-15 kB gzip (styled-components/emotion runtime)
> Vanilla Extract: 0 kB runtime
> Tailwind: ~0.5 kB runtime (resets only)
> CSS Modules: 0 kB runtime
> ```

**2. RSC / Server Component compatibility**

React Server Components separate server-rendered components from client bundles. Any CSS approach that requires JavaScript to resolve styles is incompatible with RSC.
- CSS Modules, Tailwind, plain CSS: fully compatible — styles are static, resolved at build
- Runtime CSS-in-JS: requires `"use client"` — style injection only happens in browser
- Zero-runtime CSS-in-JS: compatible because no JS needed for styles

> **Think**: RSC-first app (Next.js App Router) — which approaches are eliminated?
>
> *Answer: Runtime CSS-in-JS (styled-components, Emotion) requires client boundary for every styled component, defeating RSC benefits. Tailwind, CSS Modules, Vanilla Extract work seamlessly.*

**3. Developer experience**

- Tailwind: fast iteration once class names memorized. No context-switching between files.
- CSS Modules: familiar CSS syntax, TypeScript autocomplete via `.module.css.d.ts`
- Runtime CSS-in-JS: dynamic styling via props natural (`color: ${p => p.$variant === 'danger' ? 'red' : 'blue'}`)
- Zero-runtime: TypeScript-first, typed styles, but requires `.css.ts` file per component

**4. Scoping & isolation**

- Plain CSS: global namespace — naming conventions needed (BEM, etc.)
- CSS Modules: automatically scoped — `styles.button` becomes unique `.Button_button_abc123`
- CSS-in-JS: automatic scoping via generated class names
- Tailwind: scoped to utility classes applied directly; no cascade conflicts
- `@scope`: native CSS scoping (`@scope(.card) { ... }`)

**5. Dynamic styling**

| Approach | Dynamic styles | Mechanism |
|----------|---------------|-----------|
| Plain CSS | Limited | Class toggling, inline styles |
| CSS Modules | Via class composition | `clsx(styles.base, isActive && styles.active)` |
| Tailwind | Via class composition | `clsx('text-base', isLarge && 'text-lg')` |
| Runtime CSS-in-JS | Native | Props → CSS template interpolation |
| Zero-runtime CSS-in-JS | Via vars/recipes | CSS custom properties + recipe variants |

**6. Bundle footprint**

- Plain CSS / CSS Modules: as authored
- Tailwind: purge unused utilities — typically 5-15 kB gzip
- Runtime CSS-in-JS: library runtime + all style strings in JS bundle
- Zero-runtime CSS-in-JS: extracted to CSS files, not in JS bundle

> **Think**: Your team ships a moderate React app (50 components). How would bundle sizes differ between (a) Tailwind, (b) CSS Modules, (c) styled-components?
>
> *Answer: (a) Tailwind: ~10 kB compressed CSS, <1 kB runtime. (b) CSS Modules: ~5-8 kB CSS, 0 kB runtime. (c) styled-components: ~14 kB runtime lib + authored CSS strings in JS bundle (~15-25 kB total gzip). For 50 components, runtime CSS-in-JS adds ~10-15 kB of library overhead beyond the styles themselves.*

### When Each Approach Wins

- **Plain CSS / Sass**: legacy project, strict design system already in CSS, team knows Sass well, no React-specific CSS needs
- **CSS Modules**: framework default (Next.js, Vite), zero-runtime, TypeScript support, team prefers standard CSS syntax
- **Tailwind**: rapid prototyping, team consistency via constraint system, design tokens built-in, utility-first
- **Runtime CSS-in-JS**: heavy dynamic styling, design system with hundreds of variants, team already uses and accepts tradeoffs. **Declining** for greenfield
- **Zero-runtime CSS-in-JS**: type-safe styles, design system needing build-time extraction, RSC-compatible, want CSS-in-JS syntax without runtime cost
- **`@scope`**: native scoping without tooling, new Chrome-only projects, supplement to other approaches

> **Think**: When would runtime CSS-in-JS still be the right choice in 2026?
>
> *Answer: Greenfield? Rare. But existing large styled-components/Emotion codebase: migration cost outweighs runtime cost. Also: electron apps with heavy dynamic theming where RSC compatibility irrelevant.*

---

### Why This Matters

Choosing wrong CSS approach costs months in refactoring. styled-components in an RSC app means you can't use server components with those components. Tailwind in a design system means consumers inherit utility-first DX. Plain CSS in a 50-component app cascades into specificity hell.

React in 2026 has moved toward RSC and server-first rendering. CSS decisions that don't account for this produce either runtime bloat or broken SSR.

---

### Common Questions

**Q: Can I mix approaches in one React app?**
A: Yes, and many do. Example: Tailwind for page layouts, CSS Modules for complex component states, small amount of global CSS for reset/fonts. Each serves a scope. Key rule: one approach per component — don't use styled-components + CSS Modules + inline styles in one file.

**Q: Is `@scope` the future that kills all other approaches?**
A: `@scope` gives native CSS scoping but doesn't solve dynamic styling, bundle optimization, or design token enforcement. It replaces naming conventions like BEM but not CSS Modules or CSS-in-JS entirely. More likely: `@scope` + Tailwind or `@scope` + Vanilla Extract becomes common.

**Q: Does Next.js or Vite recommend anything?**
A: Next.js defaults to CSS Modules (global CSS only in `layout.tsx`). Tailwind integration is first-class. Vite has built-in CSS Modules support. Both support plain CSS. Neither recommends runtime CSS-in-JS — it requires client components.

---

## Examples

### Example 1: Choosing for a SaaS dashboard

**Context**: New Next.js App Router app. 3 developers. 6-month timeline. Team knows React but not deep CSS.

Decision process:
1. RSC-first → eliminate runtime CSS-in-JS
2. Team speed → Tailwind gives fast iteration without CSS file management
3. Need custom design later → Tailwind config extensible

**Choice**: Tailwind + small CSS Modules for complex interactive widgets.

### Example 2: Choosing for a component library

**Context**: Shared component library consumed by 5 apps. TypeScript required. Explicit API surface.

Decision process:
1. No runtime — consumers have different app architectures
2. Type safety — typed style contracts
3. Theming — CSS custom properties for consumer customization

**Choice**: Vanilla Extract (zero-runtime, typed, themes as CSS variables).

### Example 3: Choosing for a legacy migration

**Context**: 200-page React SPA using Sass + BEM. Migrating to Next.js gradually.

Decision process:
1. Existing investment in Sass → reuse design tokens
2. Incremental migration → don't rewrite every component
3. New pages use RSC → need compatible approach

**Choice**: Keep Sass for migrated pages, use CSS Modules for new RSC components. Phase out Sass over 1 year.

---

## Key Takeaways
- Six main approaches: plain CSS, CSS Modules, Tailwind, runtime CSS-in-JS, zero-runtime CSS-in-JS, `@scope`
- Six decision axes: runtime cost, RSC compat, DX, scoping, dynamic styling, bundle
- Runtime CSS-in-JS declining for greenfield; RSC compatibility is the main driver
- Tailwind dominates new projects; Vanilla Extract rising for design systems
- Mixing approaches is fine if per-component consistent
- `@scope` (native scoping) is emerging but not yet replacing tooling

---

## Common Misconception

**"I need CSS-in-JS to do dynamic styles in React."**

Not true. Dynamic styles in React are just class toggles or inline styles, regardless of CSS approach.

```tsx
// No CSS-in-JS needed — just class composition
function Button({ variant }) {
  return (
    <button className={clsx(
      styles.base,
      styles[variant as keyof typeof styles]
    )}>
      Click
    </button>
  );
}
```

CSS Modules + `clsx` achieves identical result to `styled('button')` with zero runtime cost. CSS-in-JS adds convenience (auto-prop-typing, theme access) but not capability.

---

## Feynman Explain
(Explain the six CSS approaches to a teammate who "just writes CSS in a file". Use simple terms. Say when you'd pick each. Don't use "runtime" or "RSC" until you explain what they mean.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain` — AI will probe your explanation for gaps.*

---

## Reframe
(Pause. Judge the decision framework: is "RSC compatibility" really the most important axis? For which apps would bundle size matter more? For which would team speed dominate?)

---

## Drill
Take the quiz. MCQs test approach recognition and tradeoff analysis.

## Quiz: 01-css-landscape-2026


### Which CSS approach for React has ZERO runtime cost in the browser?

- [ ] A: styled-components

- [ ] B: Emotion

- [✓] C: CSS Modules

- [ ] D: Runtime CSS-in-JS


**Answer:** C

CSS Modules are compiled at build time. Generated CSS file is loaded as static asset — no JavaScript runtime executes to apply styles.


### Your Next.js App Router app uses React Server Components. Which approach requires `'use client'` for every styled component?

- [ ] A: CSS Modules

- [ ] B: Tailwind CSS

- [✓] C: styled-components

- [ ] D: Vanilla Extract


**Answer:** C

Runtime CSS-in-JS (styled-components, Emotion) injects styles via JavaScript in browser — incompatible with RSC's server-only execution. Must use 'use client'.


### A teammate says 'I need CSS-in-JS to make styles dynamic based on props.' What's the correct response?

- [ ] A: True — only CSS-in-JS can read React props

- [✓] B: False — class composition with clsx achieves the same

- [ ] C: True — but only styled-components supports this

- [ ] D: False — inline styles are the only alternative


**Answer:** B

Dynamic styles in React = conditional class toggling. clsx(styles.base, props.variant &amp;&amp; styles[props.variant]) works with any CSS approach and costs zero runtime.


### A team has 50 React components, Sass + BEM, migrating to Next.js App Router. They want to keep existing investment. Which approach fits best?

- [ ] A: Rewrite everything in Tailwind

- [✓] B: Keep Sass for migrated pages, CSS Modules for new RSC components

- [ ] C: Switch to styled-components for SSR

- [ ] D: Convert all Sass to Vanilla Extract


**Answer:** B

Incremental migration preserves existing Sass work. New RSC components use CSS Modules (zero-cost, RSC-compatible). Avoids full rewrite risk.


### Which approach is seeing growth in 2026 because it gives CSS-in-JJ syntax with zero runtime?

- [ ] A: Styled-components

- [ ] B: Plain CSS

- [✓] C: Vanilla Extract

- [ ] D: Sass


**Answer:** C

Vanilla Extract reads .css.ts files at build time and outputs static CSS. TypeScript-first, zero runtime, RSC-compatible.


### What problem does the native `@scope` CSS rule solve?

- [ ] A: Variable scoping in CSS

- [✓] B: Component-level CSS scoping without tooling

- [ ] C: Scoped animations

- [ ] D: Scoped font loading


**Answer:** B

@scope(.card) { ... } limits CSS rules to elements matching the scope root and its descendants — native scoping without CSS Modules or naming conventions.


### Approach A: 0 kB runtime, RSC-compatible, no auto-scoping. Approach B: 0 kB runtime, RSC-compatible, auto-scoped. Identify A and B.

- [ ] A: A = Plain CSS, B = Tailwind

- [✓] B: A = Plain CSS, B = CSS Modules

- [ ] C: A = CSS Modules, B = Plain CSS

- [ ] D: A = Tailwind, B = Plain CSS


**Answer:** B

Both have zero runtime. Plain CSS lacks auto-scoping (global by default). CSS Modules auto-generate unique class names. Tailwind has ~0.5 kB runtime for resets.


### Which decision axis matters MOST for choosing a CSS approach in 2026 React apps?

- [ ] A: Syntax preference

- [✓] B: RSC / Server Component compatibility

- [ ] C: Number of colors available

- [ ] D: File extension


**Answer:** B

RSC compatibility cascades into runtime cost, bundle strategy, and component architecture. 2026 React is server-first; approaches that require client JS for styling lose most RSC benefits.


### How does zero-runtime CSS-in-JS differ from runtime CSS-in-JS in bundle impact?

- [ ] A: Both add the same runtime

- [✓] B: Zero-runtime extracts styles to separate CSS files at build time; runtime injects via JS

- [ ] C: Runtime is smaller because it compresses styles

- [ ] D: Zero-runtime only works in development


**Answer:** B

Runtime CSS-in-JS keeps style strings in JS bundle and injects via script. Zero-runtime generates static .css files during build, loaded separately — styles never touch JS bundle.


### You're building a React component library consumed by 5 internal apps. Which approach is most appropriate?

- [ ] A: styled-components (ThemeProvider for all apps)

- [ ] B: Tailwind (each app uses same config)

- [✓] C: Vanilla Extract (zero runtime, typed, CSS custom properties for theming)

- [ ] D: Global Sass (single stylesheet for all)


**Answer:** C

Component libraries should impose zero runtime cost on consumers. Vanilla Extract extracts at build time, enforces type safety, and CSS custom properties let consumers theme without dependency on a specific JS library.


---

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

## Quiz: 02-plain-css-sass-react


### In React, importing a CSS file in ComponentA.tsx affects:

- [ ] A: Only ComponentA

- [ ] B: ComponentA and its children

- [✓] C: The entire page/document

- [ ] D: Only sibling components


**Answer:** C

CSS in React is globally scoped regardless of which import triggers the load. Any CSS import affects the entire document.


### What does BEM's double underscore (__) represent?

- [ ] A: A modifier variant

- [✓] B: An element (child of block)

- [ ] C: A nested block

- [ ] D: A CSS pseudo-class


**Answer:** B

BEM convention: block__element. Example: button__icon means 'icon element inside button block'. block--modifier for variants.


### Which Sass feature creates invisible cross-component coupling in React?

- [ ] A: Mixins

- [ ] B: Variables

- [✓] C: @extend

- [ ] D: Nesting


**Answer:** C

@extend moves selectors to the extended rule's location. If Component A extends a placeholder from Component B's stylesheet, removing B breaks A. Styles become non-local.


### A Sass variable $color-primary: #0366d6 is defined. How does it appear in the browser's final CSS?

- [ ] A: As $color-primary preserved in CSS

- [ ] B: As var(--color-primary)

- [✓] C: As the compiled value #0366d6

- [ ] D: Undefined — Sass doesn't compile


**Answer:** C

Sass variables are compile-time only. They get replaced with their literal value during build. Browser sees #0366d6, not $color-primary.


### In Next.js App Router, where should global CSS be imported?

- [ ] A: Any page.tsx

- [ ] B: Any component.tsx

- [✓] C: Only root layout.tsx

- [ ] D: Only app/global.css


**Answer:** C

App Router restricts global CSS imports to the root layout. Per-page global CSS is not supported — component CSS must be scoped (CSS Modules) or utility-based (Tailwind).


### Which scenario is a GOOD fit for plain CSS/Sass in React?

- [ ] A: Component library consumed by 10 external apps

- [ ] B: Large team (30 devs) building new features daily

- [✓] C: Legacy codebase with existing Sass design tokens

- [ ] D: RSC-first greenfield Next.js app


**Answer:** C

Legacy codebases with Sass investment benefit from incremental migration. New apps, large teams, library distribution, and RSC apps benefit from scoped CSS approaches.


### CSS specificity: .card .header .title .icon { color: blue; }. What specificity value is this?

- [ ] A: 0,1,0,0

- [ ] B: 0,4,0,0

- [✓] C: 0,0,4,0

- [ ] D: 0,1,4,0


**Answer:** C

Four classes = 0,0,4,0 (0 inline, 0 IDs, 4 classes, 0 elements). Deep nesting generates high specificity that later rules struggle to override without !important.


### You need runtime theme switching (light/dark). Can Sass variables handle this alone?

- [ ] A: Yes — Sass compiles to CSS, browser reads variables

- [✓] B: No — Sass compiles away, cannot change at runtime

- [ ] C: Yes — use @media prefers-color-scheme

- [ ] D: No — Sass only works in development


**Answer:** B

Sass variables are replaced with static values at build time. Runtime theme switching needs CSS custom properties (var(--color-bg)) which browser evaluates live.


### A dev writes button { padding: 8px 16px; } in a global stylesheet. Which problem occurs first at scale?

- [ ] A: Performance — selector is too specific

- [✓] B: Naming collision — another .button rule overrides unexpectedly

- [ ] C: Syntax error — padding shorthand not supported

- [ ] D: React re-renders on every style change


**Answer:** B

Global .button class affects every component rendering a button. Another component's .button style overrides via cascade order. No isolation means collisions are inevitable with scale.


### What's the recommended nesting depth limit for Sass in React components?

- [ ] A: No limit — use as many levels as component tree

- [✓] B: Maximum 1 level per component

- [ ] C: Maximum 3 levels per component

- [ ] D: Maximum 5 levels per component


**Answer:** B

Sass nesting reflects CSS specificity, not component hierarchy. One level per component keeps specificity low. Exceeding 3 levels indicates you need a child component, not deeper nesting.


---

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

## Quiz: 03-css-modules-react


### What does importing a CSS Module file produce?

- [ ] A: A string of CSS

- [✓] B: An object mapping original class names to unique generated names

- [ ] C: A StyleSheet object

- [ ] D: Nothing — CSS Modules have no import value


**Answer:** B

CSS Modules compile each file to an exports object: { originalName: 'File_originalName_hash' }. React uses this object for scoped class references.


### How do you apply a conditional variant in CSS Modules?

- [ ] A: Inline style — style={{ variant: 'primary' }}

- [✓] B: clsx(styles.base, isPrimary &amp;&amp; styles.primary)

- [ ] C: styles['variant-primary']

- [ ] D: CSS Module object spread


**Answer:** B

CSS Modules export strings. Combine with clsx for conditional class composition — same pattern as plain CSS but using scoped class names.


### In Next.js App Router, where can you import a CSS Module?

- [ ] A: Only in layout.tsx

- [✓] B: Any Server or Client component

- [ ] C: Only Client components

- [ ] D: Only page.tsx files


**Answer:** B

CSS Modules work in both Server and Client components because they are build-time only — no JavaScript runtime needed, no 'use client' required.


### Two files — Button.module.css and Card.module.css — both define class .base. What happens?

- [ ] A: Build error — duplicate class names

- [ ] B: Last imported wins (cascade)

- [✓] C: No conflict — each gets unique hashed name

- [ ] D: Runtime error when both render


**Answer:** C

CSS Modules generate unique class names per file. .base in Button → .Button_base_hash1. .base in Card → .Card_base_hash2. No cascade conflict.


### How do you apply a truly dynamic value (e.g., progress bar width from API) with CSS Modules?

- [ ] A: Generate CSS Module at runtime

- [✓] B: Use inline style prop: style={{ width: `${percent}%` }}

- [ ] C: Use composes with dynamic value

- [ ] D: CSS Modules cannot handle this — switch to CSS-in-JS


**Answer:** B

CSS Modules are build-time static. Dynamic runtime values (position, size, color from data) belong in inline style prop. CSS Modules for structural/static classes.


### What does CSS Modules `composes` do?

- [ ] A: Compiles multiple CSS files into one

- [✓] B: Applies another class from the same file alongside the current one

- [ ] C: Combines two components' styles

- [ ] D: Creates a CSS variable reference


**Answer:** B

composes: heading; in .headingLarge adds .heading class alongside .headingLarge in the DOM. In-file reuse only — avoid cross-file composes.


### What's the difference between `import './styles.css'` and `import styles from './Component.module.css'`?

- [✓] A: First imports globally, second imports scoped with object mapping

- [ ] B: Both import the same — just different file extension

- [ ] C: First is for CSS Modules, second for plain CSS

- [ ] D: No difference — both are global


**Answer:** A

Plain CSS import adds global rules. CSS Module import returns scoped class mapping object. Different syntax, different scoping behavior.


### You need to style a child that's rendered by a different component. Which CSS Modules approach works?

- [ ] A: Parent targets child's CSS Module class via :global

- [ ] B: Parent passes className prop to child

- [ ] C: Use composes from parent's module

- [✓] D: All of the above are valid approaches


**Answer:** D

(A) :global(.child-class) targets child's class globally. (B) Passing className as prop is the React-recommended composition approach. (C) composes only works within same file. A and B are practical.


### A large app uses CSS Modules. Team finds .module.css files growing repetitive. Which solution aligns with CSS Modules philosophy?

- [ ] A: Switch to styled-components

- [✓] B: Extract shared styles into base CSS Module files and use composes

- [ ] C: Use Sass @mixin across modules

- [ ] D: Inline all styles


**Answer:** B

Shared CSS Module base files with composes for reuse — keeps zero runtime, stays within CSS Modules paradigm. Avoids dependency on CSS-in-JS runtime.


### True or False: CSS Modules cannot be used with React Server Components because they need client-side JavaScript.

- [ ] A: True — CSS Modules require JS to resolve

- [✓] B: False — CSS Modules are build-time only, work in RSC

- [ ] C: True — only Tailwind works in RSC

- [ ] D: False — but only in Next.js


**Answer:** B

CSS Modules compile to static CSS at build time. No JavaScript executes for style resolution. Fully compatible with RSC in any framework.


---

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

## Quiz: 04-runtime-css-in-js-react


### How does runtime CSS-in-JS apply styles to the DOM?

- [ ] A: Generates inline styles on each element

- [✓] B: Injects &lt;style&gt; tags at runtime with generated class names

- [ ] C: Modifies external stylesheet files

- [ ] D: Uses CSS Shadow DOM


**Answer:** B

Runtime CSS-in-JS parses template literals, generates unique class names, and injects corresponding &lt;style&gt; rules into the document head.


### Approximately how large is the styled-components runtime library (gzip)?

- [ ] A: 1-2 kB

- [ ] B: 5-8 kB

- [✓] C: 12-15 kB

- [ ] D: 50+ kB


**Answer:** C

styled-components runtime is ~14 kB gzip. This is the style injection engine — not styles themselves. Ships with the app regardless of how many styled components exist.


### In Next.js App Router, a styled-components component needs:

- [ ] A: Nothing special — works automatically

- [✓] B: 'use client' directive at the top

- [ ] C: A babel plugin only

- [ ] D: Custom webpack config only


**Answer:** B

Runtime CSS-in-JS uses createContext, hooks, and DOM APIs — unavailable in RSC. Every styled component requires 'use client', forcing it into the client bundle.


### What problem occurs when runtime CSS-in-JS is used without SSR configuration?

- [ ] A: Styles fail to render entirely

- [✓] B: FOUC — Flash of Unstyled Content

- [ ] C: Server crashes

- [ ] D: Reduced TypeScript type checking


**Answer:** B

Server generates different class names than client (no StyleSheetManager). Initial HTML has no styles → flash until client JS injects them.


### How does ThemeProvider pass theme to components?

- [ ] A: CSS custom properties on root

- [✓] B: React Context

- [ ] C: Global singleton

- [ ] D: Prop drilling


**Answer:** B

ThemeProvider wraps React Context. Theme object accessible via props.theme in styled components. Changing theme re-renders all consumers via Context.


### Why does runtime CSS-in-JS's style tag grow unbounded with prop combinations?

- [ ] A: Each unique props combination generates a new CSS rule

- [ ] B: Old rules are never garbage collected

- [ ] C: Styles are duplicated on every render

- [✓] D: A and B


**Answer:** D

styled-components creates new classes per unique prop combination. Old classes remain in the style tag — never removed or deduplicated. Accumulates over session.


### A team uses styled-components for 200 components. Approximately how much of their JS bundle is the CSS runtime?

- [ ] A: 0 kB — all styles are extracted

- [✓] B: ~14 kB (library) + CSS strings in JS

- [ ] C: ~200 kB (2 kB per component)

- [ ] D: CSS is never in the JS bundle


**Answer:** B

~14 kB for runtime library. CSS strings per component add more. With CSS Modules, those strings would be in separate CSS files at zero JS cost.


### When would runtime CSS-in-JS still be the right choice in 2026?

- [ ] A: Greenfield RSC-first Next.js app

- [✓] B: Existing 500-component codebase with styled-components

- [ ] C: New component library for 10 external apps

- [ ] D: Static site with no dynamic theming


**Answer:** B

Migration cost of rewriting 500 components outweighs runtime tax. New projects (A, C, D) benefit from zero-cost approaches (CSS Modules, Tailwind, Vanilla Extract).


### What is the RUNTIME bundle cost of Emotion vs styled-components?

- [ ] A: Identical

- [✓] B: Emotion ~11 kB, styled-components ~14 kB

- [ ] C: styled-components ~7 kB, Emotion ~20 kB

- [ ] D: Both ~5 kB


**Answer:** B

Emotion is slightly smaller (~11 kB gzip) than styled-components (~14 kB). Both face same fundamental runtime cost and RSC incompatibility.


### Can a React component library built with styled-components be used without styled-components as a dependency?

- [ ] A: Yes — styles are self-contained

- [✓] B: No — ThemeProvider and styled runtime required

- [ ] C: Yes — but only in development

- [ ] D: No — but Emotion can substitute


**Answer:** B

Library consumers must install styled-components as a peer dependency. ThemeProvider must wrap their app. This is the main argument against runtime CSS-in-JS for shared libraries.


---

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

## Quiz: 05-zero-runtime-css-in-js


### When does Vanilla Extract process .css.ts files?

- [ ] A: At runtime in the browser

- [✓] B: At build time during compilation

- [ ] C: On every React render

- [ ] D: During SSR only


**Answer:** B

Vanilla Extract reads .css.ts files at build time in Node.js, extracts style objects, and generates static CSS files. No processing happens in the browser.


### Can Vanilla Extract components be used in React Server Components?

- [ ] A: No — needs client-side JS

- [✓] B: Yes — styles extracted at build, no runtime needed

- [ ] C: Yes — but only with 'use client'

- [ ] D: No — only works with Pages Router


**Answer:** B

Vanilla Extract class names are static strings at build time. No hooks, no context, no runtime — fully compatible with RSC without 'use client'.


### How does Vanilla Extract handle dynamic variant props vs styled-components?

- [ ] A: Cannot handle variants — use inline styles

- [✓] B: Uses recipe() which returns class names based on variant object

- [ ] C: Same API as styled-components — template literals with prop interpolation

- [ ] D: Generates a separate CSS file per variant at runtime


**Answer:** B

recipe() defines variants as static style objects. At build time, it generates class names for each variant combination. Runtime: recipe({ variant: 'primary' }) returns the pre-generated class string.


### How do you apply truly dynamic runtime values (e.g., progress percentage) in Vanilla Extract?

- [✓] A: Inline style prop — style={{ width: `${percent}%` }}

- [ ] B: Dynamic recipe variant

- [ ] C: Runtime .css.ts re-execution

- [ ] D: Cannot — Vanilla Extract is static only


**Answer:** A

Build-time CSS handles static styles. Runtime-dynamic values (position, dimensions from API) use inline style prop. Same pattern as CSS Modules.


### What is Vanilla Extract Sprinkles?

- [ ] A: A CSS framework like Bootstrap

- [ ] B: A runtime animation library

- [✓] C: A type-safe atomic CSS generation system

- [ ] D: A CSS reset tool


**Answer:** C

Sprinkles generates typed utility classes for properties like padding, margin, colors — like Tailwind utilities but with TypeScript validation and custom design tokens.


### What advantage does Vanilla Extract have over CSS Modules for TypeScript codebases?

- [ ] A: Smaller bundle size

- [✓] B: Typed exports — invalid class names are compile errors

- [ ] C: Faster build times

- [ ] D: No advantage — they are identical


**Answer:** B

CSS Modules export { [key: string]: string } — any key is valid at TS level. Vanilla Extract exports typed class name strings — missing export = compile error.


### What happens at build time when Vanilla Extract encounters recipe({ variants: { color: { red: { background: 'red' }, blue: { background: 'blue' } } } })?

- [ ] A: Nothing — recipes are runtime-only

- [✓] B: Generates two CSS classes: red/blue variants

- [ ] C: Generates one class with CSS variable

- [ ] D: Throws error — recipes not supported


**Answer:** B

Build time: Vanilla Extract reads recipe definition, generates one unique class per variant value ({ red → .recipe_red_hash, blue → .recipe_blue_hash }). Runtime: recipe({ color: 'red' }) returns combined class string.


### Which zero-runtime CSS-in-JS library was created by Meta (Facebook)?

- [ ] A: Vanilla Extract

- [ ] B: PandaCSS

- [✓] C: StyleX

- [ ] D: Linaria


**Answer:** C

StyleX was created by Meta (Facebook) for their own use. It uses a Babel plugin for build-time extraction. Less community adoption than Vanilla Extract or PandaCSS.


### What is the bundle size impact of Vanilla Extract at runtime?

- [ ] A: ~14 kB (same as styled-components)

- [ ] B: ~5 kB (minimal runtime)

- [✓] C: 0 kB — all styles extracted to CSS files

- [ ] D: Depends on number of components


**Answer:** C

Zero runtime. All styles are extracted to static .css files at build time. No JavaScript executes for style resolution in the browser.


### A team building a shared React component library needs: type safety, zero dependency, RSC compatibility, and multi-theme support. Which approach fits?

- [ ] A: styled-components (ThemeProvider)

- [ ] B: Plain CSS (BEM)

- [✓] C: Vanilla Extract (theme contracts + recipes)

- [ ] D: Inline styles everywhere


**Answer:** C

Vanilla Extract meets all requirements: typed (TS files), zero runtime (consumers install no JS), RSC-compatible (static class names), and theme contracts with createThemeContract/createTheme.


---

# Module 6: Tailwind CSS with React

Est. study time: 3h
Language: en

## Learning Objectives
- Configure Tailwind with Next.js and Vite
- Apply conditional Tailwind classes in JSX with clsx/tailwind-merge
- Abstract Tailwind into reusable React component patterns
- Understand Tailwind's tradeoffs at scale

---

## Core Content

### Tailwind JIT Engine

Tailwind v4 (2025+) uses a JIT (Just-In-Time) engine that scans source files and generates only the classes actually used.

```
Input: className="flex items-center gap-4 p-4 bg-blue-500"
Output CSS: only .flex, .items-center, .gap-4, .p-4, .bg-blue-500 (and their variants)
```

No unused CSS purge configuration needed — JIT is the default in v4.

**Key config file** (`tailwind.config.ts` or `app.css` in v4):

```css
/* app.css — Tailwind v4 */
@import "tailwindcss";

@theme {
  --color-primary: #0366d6;
  --color-danger: #d73a49;
}
```

This defines custom design tokens that become Tailwind utility classes: `bg-primary`, `text-primary`, `border-danger`.

```tsx
function Button() {
  return (
    <button className="bg-primary text-white px-4 py-2 rounded-md">
      Click
    </button>
  );
}
```

> **Think**: How does Tailwind JIT know which classes to generate?
>
> *Answer: It scans all source files for className strings matching utility patterns. If you construct class names dynamically (className={`bg-${color}`}), JIT can't see the full string → class may be missing. Use `safeList` or full class names.*

### Conditional Classes in JSX

In React, Tailwind classes are just strings in `className`. Conditionals use standard JavaScript:

```tsx
// Ternary
<button className={`px-4 py-2 ${isActive ? 'bg-blue-500' : 'bg-gray-200'}`}>
  Click
</button>

// clsx (preferred for readability)
<button className={clsx(
  'px-4 py-2 rounded-md',
  variant === 'primary' && 'bg-blue-500 text-white',
  variant === 'outline' && 'border border-blue-500 text-blue-500',
  disabled && 'opacity-50 cursor-not-allowed'
)}>
  Click
</button>
```

**Problem**: Tailwind classes conflict when combined. `px-4` and `px-6` both define `padding-left`/`padding-right`. The last one in the CSS file wins, which may not match your intent.

**Solution**: `tailwind-merge` resolves conflicting Tailwind classes:

```tsx
import { twMerge } from 'tailwind-merge';

function Button({ className, variant }) {
  return (
    <button className={twMerge(
      'px-4 py-2 rounded-md',
      variant === 'primary' && 'bg-blue-500 text-white',
      className  // Consumer's overrides win correctly
    )}>
      Click
    </button>
  );
}
```

Without `twMerge`: `className="px-4 px-6"` → whichever CSS rule appears last in the stylesheet wins (unpredictable).
With `twMerge`: `px-6` replaces `px-4` predictably.

> **Think**: Why can't CSS cascade handle conflicting Tailwind classes like it does in plain CSS?
>
> *Answer: Because all Tailwind utilities have equal specificity (each is one class). `px-4` and `px-6` have identical specificity → whichever appears later in the CSS file wins. CSS source order depends on JIT generation order, not your className string order.*

### Component Abstraction Patterns

Raw Tailwind in every JSX creates repetition. Three patterns extract reusable components:

**1. Simple wrapper (no abstraction)**

```tsx
function Button({ children }) {
  return (
    <button className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">
      {children}
    </button>
  );
}
```

Pro: explicit, easy to see all styles. Con: duplicates for every variant.

**2. Variant map**

```tsx
const variants = {
  primary: 'bg-blue-500 text-white hover:bg-blue-600',
  danger: 'bg-red-500 text-white hover:bg-red-600',
  ghost: 'bg-transparent text-blue-500 hover:bg-gray-100',
};

const sizes = {
  sm: 'px-3 py-1 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
};

function Button({ variant = 'primary', size = 'md', className, children }) {
  return (
    <button className={twMerge(
      'rounded-md font-medium transition-colors',
      variants[variant],
      sizes[size],
      className
    )}>
      {children}
    </button>
  );
}
```

**3. cva (class-variance-authority)** — variant factory:

```tsx
import { cva } from 'class-variance-authority';

const button = cva('rounded-md font-medium transition-colors', {
  variants: {
    variant: {
      primary: 'bg-blue-500 text-white hover:bg-blue-600',
      danger: 'bg-red-500 text-white hover:bg-red-600',
      ghost: 'bg-transparent text-blue-500 hover:bg-gray-100',
    },
    size: {
      sm: 'px-3 py-1 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    },
  },
  defaultVariants: { variant: 'primary', size: 'md' },
});

function Button({ variant, size, className, children }) {
  return (
    <button className={twMerge(button({ variant, size }), className)}>
      {children}
    </button>
  );
}
```

`cva` gives type-safe variant props automatically.

### Custom Design Tokens

Tailwind's `@theme` directive (v4) maps to CSS custom properties internally:

```css
/* app.css */
@import "tailwindcss";
@theme {
  --color-brand: #6366f1;
  --color-brand-hover: #4f46e5;
  --font-display: "Inter", sans-serif;
  --radius-card: 12px;
}
```

These become: `bg-brand`, `text-brand`, `hover:bg-brand-hover`, `font-display`, `rounded-card`.

To extend rather than replace, use `--default-*`:

```css
@theme {
  --color-brand: #6366f1;
  --color-gray-50: #f8fafc;  /* Override default gray */
}
```

### RSC Compatibility

Tailwind is fully RSC-compatible. Class name strings are static — no runtime, no hooks.

```tsx
// Server component — works natively
export default function ProductList({ products }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {products.map(p => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
```

Next.js App Router has first-class Tailwind integration. Vite requires the Tailwind plugin.

### Tradeoffs at Scale

**Pro:**
- Zero runtime, RSC-compatible, small bundle (purged)
- Design consistency via constraint system
- Fast prototyping — no file switching
- Largest ecosystem (plugins, components, templates)

**Con:**
- Long `className` strings — readability suffers beyond ~5 utilities
- HTML/CSS coupling — separating concerns is impossible
- Custom designs limited to config-defined tokens
- Debugging: which utility causes this style? Check each in order
- Team must memorize utility names (or use autocomplete)

> **Think**: At what team size or component count does Tailwind become a readability problem?
>
> *Answer: Not team size — component complexity. A `<header>` with 15 utility classes is readable. A `<TableHeader>` with conditional sorting, resizing, sticky columns, and 8 interactive states in a single className string is not. Extract sub-components or use cva for complex states.*

---

### Why This Matters

Tailwind is the dominant CSS approach for new React projects in 2026. Understanding its patterns (conditional classes, abstraction, twMerge, cva) is essential for working on modern React codebases. Its tradeoffs — readability at scale, debugging difficulty, coupling — determine whether it stays productive as the app grows.

---

### Common Questions

**Q: Can I mix Tailwind with CSS Modules?**
A: Yes. Tailwind for layout/utilities, CSS Modules for complex component states (animations, pseudo-elements). Next.js and Vite support both.

**Q: Does Tailwind work with Vanilla Extract or styled-components?**
A: Mixing approaches per-component. Not per-file. A component uses Tailwind OR Vanilla Extract, not both.

**Q: How do I handle responsive design in Tailwind?**
A: Prefix utilities: `md:flex`, `lg:grid-cols-3`, `xl:p-8`. Tailwind's breakpoints work via media queries, same as CSS Modules but inline.

---

## Examples

### Example 1: Responsive Card Grid

```tsx
function Dashboard() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
      {cards.map(card => (
        <div key={card.id} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{card.title}</h3>
          <p className="mt-2 text-sm text-gray-600">{card.description}</p>
        </div>
      ))}
    </div>
  );
}
```

### Example 2: Themed Button with cva

```tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { twMerge } from 'tailwind-merge';

const button = cva(
  'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-slate-900 text-white hover:bg-slate-800',
        destructive: 'bg-red-500 text-white hover:bg-red-600',
        outline: 'border border-slate-200 bg-white hover:bg-slate-100',
        ghost: 'hover:bg-slate-100',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-10 px-4 py-2',
        lg: 'h-11 px-8 text-lg',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  }
);

type ButtonProps = VariantProps<typeof button> & {
  className?: string;
  children: React.ReactNode;
};

function Button({ variant, size, className, children, ...props }: ButtonProps) {
  return (
    <button className={twMerge(button({ variant, size }), className)} {...props}>
      {children}
    </button>
  );
}
```

---

## Key Takeaways
- Tailwind JIT generates only used classes — minimal CSS bundle
- Conditional classes via clsx; conflict resolution via tailwind-merge
- Abstract reusable components with variant maps or cva
- Custom tokens via `@theme` directive map to Tailwind utilities
- Fully RSC-compatible — class strings, zero runtime
- Scale challenge: long className strings reduce readability; extract sub-components

---

## Common Misconception

**"Tailwind produces bloated HTML with lots of class names."**

The HTML is larger, but the CSS is much smaller. A Tailwind site's CSS is typically 5-15 kB gzip vs 50-100 kB for hand-written CSS with similar coverage. The HTML size increase is negligible compared to the CSS reduction. Total page weight (HTML + CSS) is usually lower.

---

## Feynman Explain
(Explain Tailwind JIT to a traditional CSS developer. Why "writing styles in className" is different from inline styles. How purging works. Why utility classes produce smaller CSS.)

---

## Reframe
(Pause. Judge: Tailwind dominates new projects. Is this because it's genuinely better, or because of network effects? When does it fail?)

---

## Drill
Take the quiz. Questions cover JIT, conditional classes, cva, and tradeoffs.

## Quiz: 06-tailwind-css-react


### How does Tailwind JIT engine decide which CSS classes to generate?

- [ ] A: Generates all possible Tailwind utilities

- [✓] B: Scans source files for complete utility class name strings

- [ ] C: User manually lists classes in config

- [ ] D: Generates classes on every HTTP request


**Answer:** B

JIT scans source files for full class name strings (e.g., 'bg-blue-500 px-4'). Dynamically constructed strings (bg-${color}) may miss detection.


### What problem does tailwind-merge solve?

- [ ] A: Merges Tailwind configs from multiple files

- [✓] B: Resolves conflicting Tailwind utility classes predictably

- [ ] C: Combines Tailwind with CSS Modules

- [ ] D: Minifies Tailwind class names


**Answer:** B

Tailwind utilities have equal specificity. 'px-4 px-6' — CSS source order determines winner. twMerge intelligently resolves conflicts: later explicit override wins.


### What is the bundle size impact of Tailwind CSS (gzip, typical app)?

- [ ] A: 50-100 kB

- [✓] B: 5-15 kB (purged, JIT-generated)

- [ ] C: 0 kB — Tailwind has no output

- [ ] D: Depends on Tailwind version only


**Answer:** B

JIT generates only used utilities. Typical Tailwind app outputs 5-15 kB gzip CSS. Plus ~0.5 kB for reset/base styles.


### Which library provides type-safe variant definitions for Tailwind components?

- [ ] A: clsx

- [ ] B: tailwind-merge

- [✓] C: cva (class-variance-authority)

- [ ] D: tailwind-variants


**Answer:** C

cva defines variants with TypeScript types. button({ variant: 'primary', size: 'lg' }) returns class string. Invalid variant name = TS error.


### How do you add custom brand colors in Tailwind v4?

- [ ] A: tailwind.config.ts → colors

- [✓] B: app.css → @theme { --color-brand: #6366f1; }

- [ ] C: Inline style prop

- [ ] D: Cannot add custom colors — Tailwind only has defaults


**Answer:** B

Tailwind v4 uses @theme directive in CSS. --color-brand: #6366f1 becomes bg-brand, text-brand, border-brand utilities.


### Tailwind classes: 'px-4 py-2 bg-blue-500 text-white rounded-md'. How many CSS rules does JIT generate?

- [ ] A: 1 combined rule

- [✓] B: 5 separate utility rules (padding-x, padding-y, background, color, border-radius)

- [ ] C: Generated per component instance

- [ ] D: At least 10 rules


**Answer:** B

Each Tailwind utility is a separate CSS rule with a single declaration. px-4 = .px-4 { padding-left: 1rem; padding-right: 1rem; }. They compose via multiple classes on one element.


### What's the main readability concern with Tailwind at scale?

- [ ] A: File size too large

- [✓] B: className strings exceeding 10+ utilities become hard to scan

- [ ] C: Tailwind has no CSS equivalent

- [ ] D: Cannot write media queries


**Answer:** B

A className string with 15+ utilities (including responsive variants, states, dark mode) becomes visually noisy. Pattern: extract into sub-components or use cva for complex states.


### Can Tailwind be used in React Server Components?

- [ ] A: No — requires client-side JS

- [✓] B: Yes — class strings are static, zero runtime needed

- [ ] C: Yes — but only with 'use client'

- [ ] D: No — only works with Pages Router


**Answer:** B

Tailwind classes are string literals — no runtime, no hooks, no JavaScript execution needed. Fully RSC-compatible in any framework.


### A component has 20+ Tailwind classes with responsive prefixes, dark mode, and hover states. Best refactoring approach?

- [ ] A: Switch to CSS Modules

- [✓] B: Extract sub-components for each section

- [ ] C: Add more Tailwind classes

- [ ] D: Use inline styles


**Answer:** B

Extract logical sub-components. Each gets its own className with fewer classes. Also consider cva for variant-heavy components. Not an either/or with Tailwind.


### What happens when you dynamically construct a class name: className={`bg-${color}-500`}?

- [ ] A: Always works — Tailwind supports dynamic classes

- [✓] B: May fail — JIT can't scan dynamic expressions, class may not be generated

- [ ] C: Throws compile error

- [ ] D: Generates all possible color variants


**Answer:** B

JIT scans source files as strings. It reads className='bg-blue-500' but can't evaluate bg-${color}-500. If color='blue' at runtime, the class may not exist. Use full class names or safelist.


---

# Module 7: Anti-Patterns — Override in React Component Model

Est. study time: 2.5h
Language: en

## Learning Objectives
- Identify specificity wars and cascade anti-patterns in React
- Replace override-driven styling with composition patterns
- Use prop-based styling and `styled(Component)` correctly

---

## Core Content

### The Override Problem

React component model is composable — components wrap other components, props pass down, styles cascade.

CSS cascade + React composition = conflict.

```tsx
// Parent tries to customize child:
function Page() {
  return (
    <div className="page">
      <Button className="page__submit" />  {/* Intent: override Button styles */}
    </div>
  );
}
```

**Problem**: How does `page__submit` override Button's internal styles?

**Three approaches, all problematic:**
1. **High-specificity selector** (`.page .page__submit`) — specificity arms race
2. **`!important`** — breaks all cascade rules, impossible to override further
3. **Deep nesting / `:where()` hacks** — fragile, tooling-dependent

> **Think**: Why does "override the button's padding" seem simple but cascade into problems?
>
> *Answer: Because each override adds specificity or !important. Next dev needs to override your override. Three components deep, you have .parent .child .grandchild .button.submit.with-special-margin. One CSS change cascades through 10+ files.*

### Specificity Wars

CSS specificity determines which rule wins when multiple target the same element.

```css
/* Specificity: 0,1,0,0 (one class) */
.button { padding: 8px; }

/* Specificity: 0,2,0,0 (two classes) */
.parent .button { padding: 12px; }

/* Specificity: 0,3,0,0 */
.grandparent .parent .button { padding: 16px; }

/* Eventually: !important */
.button { padding: 8px !important; }

/* Counter-!important... */
.parent .button { padding: 12px !important; }
```

With CSS Modules or Tailwind, specificity is always equal (one class per rule). With plain CSS/Sass, specificity stacking is inevitable.

**When specificity wars happen in React:**
1. Parent imports a component's CSS module and tries `:global(.button)`
2. Sass nesting creates `.card .header .title` — override needs `.something .card .header .title`
3. Multiple theme layers (base → app → feature → component) each add specificity

> **Think**: A developer adds .page .button to override Button padding. Later, another dev can't override it. Who's at fault?
>
> *Answer: The first dev. Override via specificity is borrowing from the cascade — it doesn't compose. The component should expose a `size` prop or accept `className` that merges correctly.*

### `!important` — Last Resort That Becomes First Resort

`!important` should be extremely rare in component CSS. When it appears:
- It overrides specificity by fiat
- It cannot be overridden except by another `!important` with same/higher specificity
- It breaks the cascade contract

```css
/* Somewhere in component library: */
.button { padding: 8px !important; }

/* Consumer: */
// Can't override — className="p-4" has no effect
// Need: !important in consumer too, or style prop
```

**The only valid uses of `!important`:**
- Utility classes that MUST win (Tailwind's `!` prefix)
- User preference overrides (accessibility: forced colors)
- Third-party widget styles where you lack control

In component CSS: never. Use props or composition.

### Composition Over Inheritance

React's component model already has the right pattern: **props over override**.

**Bad** — override by targeting internal elements:
```tsx
// Button.tsx
function Button({ className }) {
  return <button className={`btn ${className}`}>Click</button>;
}

// Page.tsx — overrides via specificity
<Button className="page-submit" />
/* CSS: .page-submit { padding: 20px !important; } */
```

**Good** — explicit prop API:
```tsx
// Button.tsx
function Button({ size = 'md', className }) {
  return <button className={twMerge(btn({ size }), className)}>Click</button>;
}

// Page.tsx — uses prop, not CSS override
<Button size="lg" />
```

**Best** — compound components:
```tsx
// Button exposes styled sub-components
const Button = { Root, Icon, Label };

function Page() {
  return (
    <Button.Root size="lg">
      <Button.Icon name="check" />
      <Button.Label>Submit</Button.Label>
    </Button.Root>
  );
}
```

> **Think**: What's the difference between "override via CSS" and "override via prop" in terms of maintenance?
>
> *Answer: CSS override is invisible in the component API — it lives in a stylesheet file, not in the component signature. Prop override is explicit — the component declares "I accept a size prop" and TypeScript validates it.*

### styled(Component) — The Right Way to Extend

styled-components and Emotion have `styled(ExistingComponent)` which generates a new component with merged styles:

```tsx
const BaseButton = styled.button`
  padding: 8px 16px;
  background: blue;
  color: white;
`;

const LargeButton = styled(BaseButton)`
  padding: 16px 32px;
  font-size: 18px;
`;
```

**How this works**: `styled(BaseButton)` creates a new component that renders `BaseButton` and passes a generated class name to it. `BaseButton` must pass `className` to its DOM element.

```tsx
// BaseButton must forward className:
function BaseButton({ className, children }) {
  return <button className={className}>{children}</button>;
}

const LargeButton = styled(BaseButton)`
  padding: 16px;
`;
```

**This pattern is composition, not override.** The new component doesn't fight specificity — it adds its own class, and the CSS cascade within generated classes is controlled by build tools, not by selector specificity.

### Override Patterns by CSS Approach

| Approach | Override mechanism | Correct pattern |
|----------|-------------------|-----------------|
| Plain CSS | Specificity, `!important` | Avoid. Use composition or BEM modifier |
| CSS Modules | `:global` or `composes` | Avoid. Accept `className` prop, merge with clsx |
| Tailwind | `className` prop with twMerge | Accept className, twMerge with defaults |
| styled-components | `styled(Component)` | Use styled composition or variant props |
| Vanilla Extract | Recipe variant override | Props that select recipe variants |
| Inline styles | Direct assignment | `style` prop merge |

**Universal rule**: A component should never require CSS knowledge to customize. Every visual dimension the consumer might change should be a prop.

### CSS Override vs Prop-Based Design

| Aspect | CSS Override | Prop-based |
|--------|-------------|------------|
| API surface | Implicit (class names) | Explicit (prop types) |
| TypeScript validation | None | Full |
| Discoverability | Check CSS file | Autocomplete on component |
| Specificity | Accumulates | None (prop = value) |
| Testability | Visual regression only | Unit test prop values |
| Maintenance | "Where does this style come from?" | "Change the prop" |

---

### Why This Matters

CSS override in React is the #1 source of style bugs in component systems. It creates invisible coupling between components, accumulates specificity that makes later changes expensive, and produces "where is this style coming from?" debugging sessions. Understanding prop-based composition over CSS override is the difference between a maintainable design system and a css-specificity nightmare.

---

### Common Questions

**Q: How do I change a child component's color from parent without override?**
A: Add a `color` prop to the child. `Button color="danger"` — not `.parent .button { color: red; }`.

**Q: What if I need to override a third-party component that doesn't accept props?**
A: Wrap it. Your wrapper adds the missing prop API:

```tsx
function ThemedDatePicker(props) {
  return (
    <ThirdPartyDatePicker
      className="themed-datepicker"
      {...props}
    />
  );
}
// CSS: .themed-datepicker { ... } — one override, centrally managed
```

**Q: Is it OK to use className prop for occasional overrides?**
A: Yes, with twMerge. The component controls defaults; className provides escape hatch. It's when className becomes the primary customization mechanism that problems arise.

---

## Examples

### Example 1: Refactoring Override to Props

**Before** — parent overrides child via CSS:
```tsx
// Card.tsx
function Card({ children }) {
  return <div className="card">{children}</div>;
}

// Page.tsx
<Card>
  <p className="card-text">...</p>  {/* CSS: .card-text overrides card's p styles */}
</Card>
```

**After** — Card accepts props for visual variants:
```tsx
function Card({ variant = 'default', padding = 'md', children }) {
  return (
    <div className={clsx(
      'card',
      `card--${variant}`,
      `card--pad-${padding}`
    )}>
      {children}
    </div>
  );
}

// Page.tsx
<Card variant="elevated" padding="lg">...</Card>
```

### Example 2: Specificity Meltdown

```scss
// Base component
.button { padding: 8px; }

// Feature override
.feature-page .button { padding: 12px; }

// Dashboard override within feature
.feature-page .dashboard-panel .button { padding: 16px; }

// Now a new section needs its own padding:
.admin-section .feature-page .dashboard-panel .button {
  padding: 20px !important;  // Breaking point reached
}
```

Each override adds specificity. At 4+ levels, the cascade is unmanageable.

**Fix**: Prop-based. Each context passes `size` prop to Button.

---

## Key Takeaways
- CSS override in React creates specificity wars and invisible coupling
- `!important` breaks cascade — never use in component CSS
- Props over CSS overrides — every visual dimension should be a prop
- `styled(Component)` is composition, not override — works correctly
- `twMerge` resolves conflicting utility classes predictably
- Universal rule: consumer should not need CSS to customize a component

---

## Common Misconception

**"I need to override component styles because the component doesn't support my use case."**

Correct response: extend the component's prop API or create a variant. If the component is third-party, wrap it. Override via CSS means the component's styling contract is broken — fix the contract, not the CSS.

---

## Feynman Explain
(Explain to a junior: "Why is overriding CSS in a component library bad? I just want to change the padding.")

---

## Reframe
(Pause. Judge: Are there cases where CSS override is acceptable? Utility-first CSS (Tailwind) is all about composing classes in className — is that "override" too?)

---

## Drill
Take the quiz. Questions identify override anti-patterns and propose prop-based alternatives.

## Quiz: 07-anti-patterns-override

(quiz parse error: while parsing a block mapping
  in "/Users/tszyeungwan/Desktop/courses/subjects/modern-css-with-react/modules/07-anti-patterns-override/quiz.yaml", line 37, column 3
expected <block end>, but found '<scalar>'
  in "/Users/tszyeungwan/Desktop/courses/subjects/modern-css-with-react/modules/07-anti-patterns-override/quiz.yaml", line 45, column 142)


---

# Module 8: Theming React Components with CSS

Est. study time: 3h
Language: en

## Learning Objectives
- Design CSS custom property architecture for multi-theme React apps
- Implement theme propagation via React Context + CSS custom properties
- Apply `@scope` for isolated component theming
- Build theme system without runtime CSS-in-JS

---

## Core Content

### CSS Custom Properties — The Runtime Theme Engine

CSS custom properties (`var(--name)`) are the foundation of runtime theming in React. Unlike Sass variables (compile-time), custom properties resolve in the browser:

```css
:root {
  --color-primary: #0366d6;
  --color-surface: #ffffff;
  --color-text: #24292f;
}

.button {
  background: var(--color-primary);
  color: white;
}
```

Change the property value at a higher DOM level → all descendants re-resolve instantly. No re-render, no JavaScript:

```css
.theme-dark {
  --color-primary: #58a6ff;
  --color-surface: #0d1117;
  --color-text: #c9d1d9;
}
```

```tsx
function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  return (
    <div className={theme === 'dark' ? 'theme-dark' : ''}>
      <Button /> {/* automatically re-themes */}
    </div>
  );
}
```

> **Think**: How does `var(--color-primary)` resolve when `.theme-dark` sets `--color-primary` to a different value?
>
> *Answer: CSS custom properties cascade like inherited properties. `.theme-dark` sets a new value on that element. All children see the new value because they inherit from the parent. No JavaScript mutation needed — pure CSS cascade.*

### Theme Architecture Layers

A scalable theme system has 4 layers:

**Layer 1: Base definitions** (CSS custom properties on `:root`)

```css
:root {
  --color-primary: #0366d6;
  --color-primary-hover: #0256b3;
  --color-surface: #ffffff;
  --color-surface-secondary: #f6f8fa;
  --color-text: #24292f;
  --color-text-secondary: #57606a;
  --color-border: #d0d7de;

  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;

  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 16px;

  --font-body: 16px;
  --font-heading: 24px;
}
```

**Layer 2: Theme variants**

```css
.theme-dark {
  --color-primary: #58a6ff;
  --color-primary-hover: #79c0ff;
  --color-surface: #0d1117;
  --color-surface-secondary: #161b22;
  --color-text: #c9d1d9;
  --color-text-secondary: #8b949e;
  --color-border: #30363d;
}

.theme-high-contrast {
  --color-primary: #0044cc;
  --color-surface: #ffffff;
  --color-text: #000000;
  /* Increased contrast ratios */
}
```

**Layer 3: Component tokens** (optional — map semantic tokens to concrete values)

```css
:root {
  --button-bg: var(--color-primary);
  --button-text: white;
  --button-border-color: transparent;
  --card-bg: var(--color-surface);
  --card-border-color: var(--color-border);
}
```

**Layer 4: Component implementation**

```css
/* Button.module.css */
.button {
  background: var(--button-bg);
  color: var(--button-text);
  border: 1px solid var(--button-border-color, transparent);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
}
```

This architecture means you can re-theme an entire app by changing one CSS class — no component code changes.

### Theme Propagation via React Context

React Context + CSS custom properties = theming without runtime CSS-in-JS:

```tsx
// ThemeContext.tsx
type Theme = 'light' | 'dark' | 'high-contrast';

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (t: Theme) => void;
}>({
  theme: 'light',
  setTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState<Theme>('light');
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <div className={`theme-${theme}`}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
```

```tsx
// App.tsx
function App() {
  return (
    <ThemeProvider>
      <Header />
      <Dashboard />
    </ThemeProvider>
  );
}

// Header.tsx — toggle button
function Header() {
  const { theme, setTheme } = useTheme();
  return (
    <header>
      <span>App</span>
      <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
        Toggle theme
      </button>
    </header>
  );
}
```

**Contrast with styled-components ThemeProvider**: Same Context-based API, but without the runtime JS library. CSS custom properties handle the actual value resolution.

> **Think**: When React state changes theme, what actually re-renders vs re-styles?
>
> *Answer: Only the ThemeProvider's div className changes (re-render). Every component using var(--color-*) does NOT re-render — CSS custom properties cascade natively. This is the performance advantage over runtime CSS-in-JS theme injection.*

### `@scope` — Native CSS Scoping for Components

`@scope` (Chrome 118+, Safari 17.4+, Firefox 128+) limits CSS rules to a DOM subtree:

```css
@scope(.card) {
  :scope { border: 1px solid var(--color-border); padding: 16px; }
  .title { font-size: 18px; font-weight: 600; }
  .body { font-size: 14px; color: var(--color-text-secondary); }
}
```

Rules inside `@scope(.card)` only match elements inside `class="card"`. No BEM, no CSS Modules needed for basic scoping.

**In React**:

```tsx
function Card({ title, children }) {
  return (
    <div className="card">
      <h2 className="title">{title}</h2>
      <div className="body">{children}</div>
    </div>
  );
}
```

`.title` inside a `@scope(.card)` won't affect `<h2 class="title">` outside `.card`.

**Comparison**:

| Feature | CSS Modules | @scope |
|---------|-------------|--------|
| Browser support | All | Modern browsers only |
| Scoping mechanism | Build-time class rename | Runtime cascade boundary |
| Dynamic scoping | Not possible | `@scope(.card.highlighted)` |
| Tooling required | Build plugin | None |
| Conflicts with other libs | None | None |
| SSR | Yes | Yes |

`@scope` is not a CSS Modules replacement (different guarantee model — runtime vs build-time) but reduces the need for it in simple components.

### Theme Switching Without Re-Render

CSS custom properties cascade without triggering React re-renders. This is critical for performance:

```tsx
// BAD — causes re-render of entire tree:
function BadThemeToggle({ theme }) {
  return (
    <div style={{ backgroundColor: theme === 'dark' ? '#000' : '#fff' }}>
      {/* Every child re-renders when theme changes */}
      <ExpensiveComponent />
    </div>
  );
}

// GOOD — only className changes, CSS handles rest:
function GoodThemeToggle({ theme }) {
  return (
    <div className={`theme-${theme}`}>
      {/* No re-render cascade — CSS custom properties update natively */}
      <ExpensiveComponent />
    </div>
  );
}
```

With CSS custom properties, `ExpensiveComponent` doesn't re-render. The browser's style engine updates colors without JavaScript involvement.

### Multi-Theme Architecture for Component Libraries

Component libraries should provide theme variables, not enforce a theme engine:

```css
/* Library provides CSS custom properties with defaults */
:root {
  --lib-button-bg: #0366d6;
  --lib-button-text: white;
  --lib-button-radius: 6px;
}

.lib-button {
  background: var(--lib-button-bg);
  color: var(--lib-button-text);
  border-radius: var(--lib-button-radius);
}
```

Consumers customize by overriding at their root:

```css
/* Consumer app */
:root {
  --lib-button-bg: #7c3aed;
  --lib-button-radius: 9999px;
}
```

**No React Context, no ThemeProvider, no runtime library required.** Pure CSS contract.

> **Think**: How does this compare to styled-components ThemeProvider for a shared component library?
>
> *Answer: ThemeProvider requires all consumers to wrap their app in a Context provider from the library. CSS custom properties require nothing — just standard CSS. Zero dependency, zero runtime. This is why CSS variables are the standard for library theming in 2026.*

### Theme Breakpoints and Media Queries

```css
:root {
  --color-primary: #0366d6;
}

.theme-dark {
  --color-primary: #58a6ff;
}

/* OS preference as default (no JS) */
@media (prefers-color-scheme: dark) {
  :root {
    --color-primary: #58a6ff;
  }
}
```

Combine media queries with class-based themes:

```css
/* Respect OS preference unless user explicitly chose */
:root:not(.theme-light):not(.theme-dark) {
  --color-primary: #0366d6;
}

@media (prefers-color-scheme: dark) {
  :root:not(.theme-light):not(.theme-dark) {
    --color-primary: #58a6ff;
  }
}
```

---

### Why This Matters

Theming is where most React CSS approaches fail. Runtime CSS-in-JS couples theme to a JS library. Plain CSS has no scoping. CSS Modules can't switch variables at runtime. Combining CSS custom properties (for runtime values) with CSS Modules/`@scope` (for scoping) gives the best of all approaches: zero-runtime, natively themed, scoped styles.

---

### Common Questions

**Q: Can I animate theme transitions with CSS custom properties?**
A: Yes. `transition: background-color 0.3s, color 0.3s;` on components will animate between theme values since the browser sees actual color changes.

**Q: How many CSS custom properties is too many?**
A: Design token scale. 50-100 tokens for colors, spacing, typography is normal. 500+ suggests over-engineering. Each token should map to a design decision element.

**Q: Can CSS custom properties do dynamic calculations?**
A: Yes, with `calc()`: `padding: calc(var(--space-md) * 1.5);`. Complex logic (if/else) is not possible — use JavaScript for that.

---

## Examples

### Example 1: Complete Theme System

```css
/* tokens.css */
:root {
  --color-primary: #6366f1;
  --color-primary-hover: #4f46e5;
  --color-surface: #ffffff;
  --color-surface-hover: #f8fafc;
  --color-text: #0f172a;
  --color-text-muted: #64748b;
  --color-border: #e2e8f0;
  --color-danger: #ef4444;
  --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px rgb(0 0 0 / 0.1);
}

.theme-dark {
  --color-primary: #818cf8;
  --color-primary-hover: #6366f1;
  --color-surface: #0f172a;
  --color-surface-hover: #1e293b;
  --color-text: #f1f5f9;
  --color-text-muted: #94a3b8;
  --color-border: #334155;
  --color-danger: #f87171;
  --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.3);
  --shadow-md: 0 4px 6px rgb(0 0 0 / 0.4);
}
```

```tsx
// ThemeToggle.tsx
function ThemeToggle() {
  const [dark, setDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    document.documentElement.className = dark ? 'theme-dark' : '';
  }, [dark]);

  return (
    <button onClick={() => setDark(d => !d)}>
      {dark ? 'Light' : 'Dark'} mode
    </button>
  );
}
```

### Example 2: Component with Theme-Breakpoint Awareness

```css
/* ProductCard.module.css */
.card {
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  transition: background 0.2s, box-shadow 0.2s;
}
.card:hover {
  background: var(--color-surface-hover);
  box-shadow: var(--shadow-md);
}
.title {
  font-size: var(--font-heading);
  color: var(--color-text);
  margin-bottom: var(--space-xs);
}
.price {
  color: var(--color-primary);
  font-weight: 600;
}
```

```tsx
function ProductCard({ product }) {
  return (
    <div className={styles.card}>
      <h3 className={styles.title}>{product.name}</h3>
      <p className={styles.price}>${product.price}</p>
    </div>
  );
}
```

Themes work automatically — no prop drilling, no Context reading in ProductCard.

---

## Key Takeaways
- CSS custom properties (`var(--name)`) enable runtime theming without JS libraries
- Theme architecture: base values → theme variants → component tokens → components
- React Context manages theme state; CSS custom properties handle style propagation
- `@scope` provides native CSS scoping — no tooling needed (modern browsers)
- Theme switching via CSS class change does NOT re-render child components
- Component libraries should expose CSS custom properties, not React Context
- Combine: CSS custom properties (runtime values) + CSS Modules/`@scope` (scoping)

---

## Common Misconception

**"CSS custom properties are slow compared to hardcoded values."**

Negligible difference. CSS custom properties are resolved during the browser's style calculation phase. The performance cost is a single property lookup per `var()` — microseconds. Hardware-accelerated compositing (transforms, opacity) is unaffected. The real performance cost comes from unnecessary React re-renders (avoided by CSS custom properties).

---

## Feynman Explain
(Explain CSS custom properties as "theme variables that the browser understands." Why they cascade like font-size. Why changing one variable re-colors hundreds of components without JavaScript.)

---

## Reframe
(Pause. Judge: Is the CSS custom property + Context pattern better than styled-components ThemeProvider? For which apps would the difference matter?)

---

## Drill
Take the quiz. Questions test theme architecture, custom property cascade, and implementation.

## Quiz: 08-theming-react-components


### CSS custom property var(--color-primary) resolves at:

- [ ] A: Build time (same as Sass)

- [ ] B: Component mount time

- [✓] C: Browser runtime — resolves per element via cascade

- [ ] D: JavaScript evaluation time


**Answer:** C

CSS custom properties resolve in the browser via cascade. The value depends on the nearest ancestor that sets the property. No build step or JS needed.


### When ThemeProvider changes theme state, what actually re-renders?

- [ ] A: Every component consuming CSS custom properties

- [✓] B: Only the element whose className changes (wrapping div)

- [ ] C: All components in the app

- [ ] D: Nothing — CSS custom properties cannot re-theme


**Answer:** B

Only the wrapping div's className re-renders. CSS custom properties cascade natively — child components see new values without re-rendering. This is the performance advantage over runtime CSS-in-JS.


### What is the recommended theme architecture for a React component library consumed by external apps?

- [ ] A: ThemeProvider from styled-components

- [ ] B: A React Context provider from the library

- [✓] C: CSS custom properties documented in README

- [ ] D: Inline styles with JavaScript objects


**Answer:** C

CSS custom properties impose zero dependencies. Consumers override them in their own CSS. No Context wrapping, no library import — just CSS. Standard for library theming in 2026.


### What does `@scope(.card) { .title { font-size: 18px; } }` do?

- [ ] A: Creates a CSS Module scoped to .card

- [✓] B: Limits .title rule to elements within .card

- [ ] C: Makes .title inherit from .card global scope

- [ ] D: Restricts .title to first child only


**Answer:** B

`@scope(.card)` creates a cascade boundary. `.title` inside only matches elements descendant from an element with class `card`. No tooling involved — native CSS feature.


### Which CSS custom property layer should change when applying a dark theme?

- [ ] A: Component implementation layer

- [✓] B: Theme variant layer (--color-*)

- [ ] C: Base definition layer (:root)

- [ ] D: Space token layer


**Answer:** B

Theme variant (.theme-dark) overrides base color variables. Component styles reference var(--color-*) and update automatically. Don't change component CSS per theme.


### .card { background: var(--card-bg, var(--color-surface, white)); } What does this resolve to?

- [✓] A: First tries --card-bg, then --color-surface, then white

- [ ] B: Always white

- [ ] C: --card-bg if set, else the browser default

- [ ] D: Only --card-bg — fallbacks not supported


**Answer:** A

var(--card-bg, var(--color-surface, white)) uses nested fallbacks. If --card-bg is not set, tries --color-surface. If neither is set, uses white.


### A button's background uses var(--button-bg). Toggling .theme-dark on root changes it instantly. Why no React re-render?

- [ ] A: React batch-updates style changes

- [✓] B: CSS custom properties are inherited — browser recalculates without JS

- [ ] C: JavaScript is not involved in style resolution

- [ ] D: theme-dark forces a full page reflow but not re-render


**Answer:** B

CSS variables cascade: .theme-dark sets --button-bg on root, all children inherit the new value. Browser's style engine updates without React reconciliation.


### How should a design system expose theme tokens to consumers?

- [ ] A: Export theme as JS object and provide merge function

- [✓] B: Document CSS custom property names and expected values

- [ ] C: Provide ThemeProvider wrapper component

- [ ] D: Publish an npm package with variable injection


**Answer:** B

CSS custom properties are the API. Consumers override --ds-color-primary: #purple; in their CSS. No import, no Context, no build step.


### What is `@scope`'s main limitation in 2026?

- [ ] A: Doesn't work with any CSS framework

- [✓] B: Browser support — requires modern Chrome/Safari/Firefox

- [ ] C: Cannot be combined with CSS custom properties

- [ ] D: Not compatible with React SSR


**Answer:** B

@scope was added in Chrome 118, Safari 17.4, Firefox 128 (2024). Widely supported in modern browsers but not in older versions. Safe for internal tools or consumer-facing apps targeting modern browsers.


### A design system uses CSS custom properties for theming. Consumer wants brand-specific border-radius. What do they do?

- [✓] A: Write: :root { --ds-radius-md: 4px; }

- [ ] B: Wrap components in ThemeProvider border-radius prop

- [ ] C: Pass className prop with border-radius override

- [ ] D: Modify design system source code


**Answer:** A

Override the CSS custom property. If design system uses --ds-radius-md: 8px, consumer sets :root { --ds-radius-md: 4px; } in their CSS. No component code changes.


---

# Module 9: Layout Components with Flexbox & Grid

Est. study time: 2h
Language: en

## Learning Objectives
- Build reusable React layout primitives (Stack, Flex, Grid)
- Decide when Flexbox vs CSS Grid per layout pattern
- Implement responsive layout props

---

## Core Content

### Layout Primitives vs Ad-Hoc Layout

Most apps repeat the same layout patterns: vertical stack, horizontal row, grid of items. Layout primitives encapsulate these:

```tsx
// Without primitive — repeated flex classes:
<section className="flex flex-col gap-4">
  <div className="flex items-center gap-2">
    <span>Label</span>
    <input />
  </div>
</section>

// With primitive — intent clear:
<Stack gap="md">
  <Flex gap="sm" align="center">
    <Label>Name</Label>
    <Input />
  </Flex>
</Stack>
```

> **Think**: What's the difference between `className="flex gap-4"` and `<Stack gap="md">`?
>
> *Answer: Same CSS output. The difference is API intent. `<Stack>` communicates "children arranged vertically." `flex gap-4` communicates implementation details. Primitives make layout choices visible in component name.*

### Stack Component

Vertical layout. The most common layout primitive.

```tsx
// Stack.tsx
type StackProps = {
  gap?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  align?: 'start' | 'center' | 'end' | 'stretch';
  as?: 'div' | 'section' | 'main' | 'form';
  children: React.ReactNode;
};

function Stack({ gap = 'md', align = 'stretch', as: Tag = 'div', children }: StackProps) {
  return (
    <Tag className={clsx('stack', `stack--gap-${gap}`, `stack--align-${align}`)}>
      {children}
    </Tag>
  );
}
```

```css
/* Stack.module.css */
.stack { display: flex; flex-direction: column; }
.stack--gap-xs { gap: var(--space-xs); }
.stack--gap-sm { gap: var(--space-sm); }
.stack--gap-md { gap: var(--space-md); }
.stack--gap-lg { gap: var(--space-lg); }
.stack--gap-xl { gap: var(--space-xl); }
.stack--align-start { align-items: flex-start; }
.stack--align-center { align-items: center; }
.stack--align-end { align-items: flex-end; }
.stack--align-stretch { align-items: stretch; }
```

### Flex Component (Horizontal Row)

```tsx
type FlexProps = {
  gap?: Spacing;
  align?: 'start' | 'center' | 'end' | 'baseline' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  wrap?: boolean;
  as?: ElementType;
  children: React.ReactNode;
};

function Flex({ gap = 'sm', align = 'center', justify = 'start', wrap, as: Tag = 'div', children }: FlexProps) {
  return (
    <Tag className={clsx(
      'flex',
      `flex--gap-${gap}`,
      `flex--align-${align}`,
      `flex--justify-${justify}`,
      wrap && 'flex--wrap'
    )}>
      {children}
    </Tag>
  );
}
```

```css
.flex { display: flex; }
.flex--wrap { flex-wrap: wrap; }
.flex--align-start { align-items: flex-start; }
.flex--align-center { align-items: center; }
.flex--justify-between { justify-content: space-between; }
```

> **Think**: Should Flex and Stack be separate components or one component with a `direction` prop?
>
> *Answer: Tradeoff. Separate components are more explicit (`direction` can't be wrong). One component is fewer imports. In practice, most uses are vertical (Stack) or horizontal (Flex) — separate reads clearer.*

### Grid Component

```tsx
type GridProps = {
  columns: number | { base?: number; sm?: number; md?: number; lg?: number };
  gap?: Spacing;
  children: React.ReactNode;
};

function Grid({ columns = 1, gap = 'md', children }: GridProps) {
  return (
    <div className={clsx(
      'grid',
      `grid--gap-${gap}`,
      typeof columns === 'number' && `grid--cols-${columns}`
    )}>
      {children}
    </div>
  );
}
```

```css
.grid { display: grid; }
.grid--cols-1 { grid-template-columns: repeat(1, 1fr); }
.grid--cols-2 { grid-template-columns: repeat(2, 1fr); }
.grid--cols-3 { grid-template-columns: repeat(3, 1fr); }
.grid--cols-4 { grid-template-columns: repeat(4, 1fr); }
.grid--gap-sm { gap: var(--space-sm); }
.grid--gap-md { gap: var(--space-md); }
```

### When Flexbox vs Grid

| Pattern | Use | Example |
|---------|-----|---------|
| 1D row/column alignment | Flexbox | Nav bar, toolbar, form field + label |
| 2D grid of equal cells | Grid | Product grid, photo gallery, card layout |
| Content-first (size by content) | Flexbox | Button groups, badge clusters |
| Layout-first (fill available) | Grid | Page layout (sidebar + main), dashboard panels |
| Wrapping items | Flexbox (wrap) | Tag list, filter chips |
| Complex spanning | Grid | Magazine layout, heterogeneous cards |

**Rule of thumb**: If you need alignment in one direction, use Flexbox. If you need both rows and columns simultaneously, use Grid.

> **Think**: Dashboard layout with sidebar, header, main content, and footer — Flexbox or Grid?
>
> *Answer: Grid. Two-dimensional layout (sidebar spans full height, header spans full width, main fills remaining). Grid's template areas make this explicit. Flexbox would need nested containers.*

### Responsive Layout Props

Responsive layout = different column counts or gaps at breakpoints:

```tsx
type ResponsiveValue<T> = T | { base: T; sm?: T; md?: T; lg?: T };

function Grid({ columns, gap, children }: { columns: ResponsiveValue<number> }) {
  const breakpoints = ['sm', 'md', 'lg'] as const;
  return (
    <div className={clsx(
      'grid',
      typeof columns === 'number' && `grid--cols-${columns}`,
      typeof columns === 'object' && breakpoints.map(bp =>
        columns[bp] && `grid--${bp}--cols-${columns[bp]}`
      )
    )}>
      {children}
    </div>
  );
}
```

```css
/* Base */
.grid--cols-2 { grid-template-columns: repeat(2, 1fr); }
/* Responsive */
@media (min-width: 640px) { .grid--sm--cols-3 { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 768px) { .grid--md--cols-4 { grid-template-columns: repeat(4, 1fr); } }
```

Usage:

```tsx
<Grid columns={{ base: 1, sm: 2, md: 3, lg: 4 }}>
  {products.map(p => <ProductCard key={p.id} product={p} />)}
</Grid>
```

> **Think**: How does Tailwind handle this vs CSS Modules?
>
> *Answer: Tailwind: className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4". Same CSS, different DX. Tailwind puts breakpoint logic in className; CSS Modules put it in CSS file.*

---

### Why This Matters

Layout primitives eliminate repetitive flex/grid patterns and make layout intent explicit. A `<Stack gap="lg">` communicates vertical arrangement. `className="flex flex-col gap-4"` communicates implementation. In large codebases, primitives reduce layout bugs and make responsive changes centralized.

---

### Common Questions

**Q: Should I use a layout primitive library like Radix UI or build my own?**
A: Build if layout needs are simple (Stack, Flex, Grid). Use library if you need advanced features (auto-grid, aspect-ratio containers, masonry).

**Q: Do layout primitives cause performance issues?**
A: No. They render a single DOM element with classes. No state, no effects, no context.

---

## Examples

### Example: Dashboard Layout

```tsx
function Dashboard() {
  return (
    <Grid columns={{ base: 1, lg: 4 }} gap="lg" className="p-6">
      <Sidebar className="lg:col-span-1" /> {/* CSS: grid-column: span 1 on lg */}
      <Stack gap="md" className="lg:col-span-3">
        <Flex justify="between" align="center">
          <h1>Dashboard</h1>
          <Button>Export</Button>
        </Flex>
        <Grid columns={{ base: 1, sm: 2, md: 3 }} gap="md">
          {stats.map(s => <StatCard key={s.label} stat={s} />)}
        </Grid>
        <Chart />
      </Stack>
    </Grid>
  );
}
```

---

## Key Takeaways
- Layout primitives (Stack, Flex, Grid) encapsulate repeated flex/grid patterns
- Flexbox: 1D alignment. Grid: 2D layout. Choose accordingly
- Responsive props with breakpoint objects give explicit control
- Primitives reduce layout bugs and make intent clear

---

## Common Misconception

**"I don't need layout components — I just use flex/grid classes inline."**

Both work. Layout components add: named intent (Stack vs flex-col), prop validation (gap values restricted to tokens), and centralized responsive logic. Tradeoff is abstraction layer to learn.

---

## Feynman Explain
(Explain difference between Flexbox and Grid to a junior dev. When would you use each for a React app?)

---

## Drill
Take the quiz.

## Quiz: 09-layout-components-flexbox-grid


### What is a layout primitive component?

- [ ] A: A CSS framework like Tailwind

- [✓] B: A reusable component that encapsulates flex/grid layout patterns

- [ ] C: A React hook for responsive design

- [ ] D: A build tool for CSS


**Answer:** B

Layout primitives (Stack, Flex, Grid) encapsulate repeated CSS layout patterns into explicit component APIs.


### Which layout approach for: a nav bar with logo left, links center, profile right?

- [ ] A: CSS Grid (3-column template)

- [✓] B: Flexbox (justify-content: space-between)

- [ ] C: Float layout

- [ ] D: Table layout


**Answer:** B

One-dimensional alignment across main axis. Flexbox with space-between handles this naturally. Grid would also work but overkill.


### Which layout approach for: sidebar (fixed width) + main content + header spanning both?

- [ ] A: Flexbox wrapping

- [✓] B: CSS Grid (template areas)

- [ ] C: Inline-block elements

- [ ] D: Position absolute


**Answer:** B

Two-dimensional layout needing both rows and columns. Grid template areas map regions explicitly. Flexbox would need nested containers.


### What does a responsive Grid columns prop look like?

- [ ] A: columns="responsive"

- [✓] B: columns={{ base: 1, md: 2, lg: 3 }}

- [ ] C: columns={[1, 2, 3]}

- [ ] D: columns="auto"


**Answer:** B

Responsive prop maps breakpoints to column count. Base = mobile default, md = tablet, lg = desktop. Generated CSS uses media queries.


### Stack component vs div with className='flex flex-col gap-4' — key advantage?

- [ ] A: Stack is faster to render

- [✓] B: Stack communicates intent (vertical layout) at component level

- [ ] C: Stack supports more CSS properties

- [ ] D: Stack works without CSS


**Answer:** B

Both produce same HTML. Stack makes layout intent explicit in component name. `flex flex-col gap-4` communicates implementation, not intent.


### How should layout primitives handle spacing?

- [ ] A: Accept any CSS value string

- [✓] B: Accept only predefined spacing tokens (sm, md, lg)

- [ ] C: Never accept gap — use wrapper components

- [ ] D: Always use 16px default


**Answer:** B

Restricted token values enforce design system consistency. 'gap-12px' bypasses tokens. 'gap-lg' references design system spacing.


### Grid component with 12 items: columns={3} renders how many rows?

- [ ] A: 3

- [✓] B: 4

- [ ] C: 12

- [ ] D: Depends on content height


**Answer:** B

12 items ÷ 3 columns = 4 rows (assuming grid auto-flow row). The component sets grid-template-columns: repeat(3, 1fr).


### A filter chip list wraps when screen narrows. Which component?

- [ ] A: Grid with columns={1}

- [✓] B: Flex with wrap={true}

- [ ] C: Stack

- [ ] D: Absolute positioned divs


**Answer:** B

Flex with flex-wrap: wrap lets items naturally flow to next line when container narrows. Grid requires explicit breakpoint column changes.


---

# Module 10: Container Queries & Responsive React Components

Est. study time: 2h
Language: en

## Learning Objectives
- Apply container queries for component-level responsiveness
- Distinguish container queries from viewport media queries
- Build responsive React components independent of page layout

---

## Core Content

### Viewport vs Container Queries

Media queries respond to viewport size. Container queries respond to parent element size.

```css
/* Media query — responds to viewport */
@media (max-width: 768px) {
  .card { flex-direction: column; }
}

/* Container query — responds to parent container */
@container (max-width: 400px) {
  .card { flex-direction: column; }
}
```

**Why container queries matter in React**: A `<ProductCard>` might render in a 4-column grid (wide) or a sidebar (narrow). Media queries can't distinguish these contexts — they only know viewport width. Container queries let the component adapt to its actual available space.

> **Think**: A ProductCard appears in a 4-column grid on desktop AND in a slide-out panel. With media queries, how do you style both contexts?
>
> *Answer: You can't with viewport alone. You'd add a modifier class or prop— `<ProductCard variant="compact" />`. Container queries eliminate the prop: the card detects its own container width.*

### Setting Up Containers

```css
/* Parent establishes a containment context */
.card-grid {
  container-type: inline-size;
  container-name: card-container;
}

.sidebar {
  container-type: inline-size;
  container-name: sidebar;
}
```

`container-type: inline-size` creates a containment context based on inline (width) size. `container-name` optional — names the context for `@container` references.

**In React**:

```tsx
function ProductGrid({ products }) {
  return (
    <div className="card-grid"> {/* container established here */}
      {products.map(p => <ProductCard key={p.id} product={p} />)}
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="sidebar"> {/* different container context */}
      <ProductCard product={featured} />
    </aside>
  );
}
```

### Component Responds to Its Container

```css
/* ProductCard.module.css */
.card {
  container-type: inline-size;
  display: flex;
  flex-direction: row;
  gap: 16px;
}

@container (max-width: 300px) {
  .card { flex-direction: column; }
  .image { width: 100%; }
}

@container (min-width: 301px) and (max-width: 500px) {
  .card { flex-direction: row; gap: 12px; }
  .image { width: 120px; }
}

@container (min-width: 501px) {
  .card { flex-direction: row; gap: 24px; }
  .image { width: 200px; }
}
```

**Key**: Container queries use the container's width, not viewport. Same component renders differently in ProductGrid (wide) vs Sidebar (narrow) without props.

### Container Query Units

Container queries also provide units relative to container size:

- `cqw` — 1% of container width
- `cqh` — 1% of container height
- `cqi` — 1% of container inline size
- `cqb` — 1% of container block size
- `cqmin` — smaller of cqi/cqb
- `cqmax` — larger of cqi/cqb

```css
.card {
  container-type: inline-size;
}
.title {
  font-size: clamp(1rem, 5cqi, 2rem);
}
/* Title scales from 1rem to 2rem based on container width */
```

### Container Queries + Media Queries Combined

```css
/* Outer layout responds to viewport */
@media (max-width: 768px) {
  .grid { grid-template-columns: 1fr; }
}

/* Inner component responds to its container */
.product-card { container-type: inline-size; }

@container (max-width: 350px) {
  .product-card { flex-direction: column; }
}
```

Layers: media queries → page layout. Container queries → component adaptation.

### When Not to Use Container Queries

- Simple responsive: media queries suffice
- Container query performance: containment affects layout — not all elements need it
- If component always renders in one context (e.g., main content only) — media query is simpler

> **Think**: You have a Card component always rendered in a grid that is always 3 columns. Does this need container queries?
>
> *Answer: No. Card always has the same available width. Container query adds complexity without benefit. Use media query to switch grid columns, regular CSS for Card.*

### Browser Support (2026)

Container queries supported in all modern browsers: Chrome 105+, Safari 16+, Firefox 110+. No polyfill needed. Safe for production.

---

### Why This Matters

Container queries are the biggest CSS advancement for component-based architectures since flexbox. They make components truly self-responsive — a `<ProfileCard>` knows how to render based on its actual space, not page context. This eliminates a whole category of "responsive variant" props.

---

### Common Questions

**Q: Can I nest container queries?**
A: Yes. A container inside a container. Each `@container` query responds to its nearest named or anonymous container ancestor.

**Q: Do container queries affect performance?**
A: Minimal. Containment creates a layout boundary — browser recalculates only the container's subtree when its size changes. Performance improvement for large pages.

---

## Examples

### Example: Responsive Dashboard Widget

```tsx
// Widget — adapts to its grid cell size automatically
function Widget({ title, children }) {
  return (
    <div className={styles.widget}>
      <h3 className={styles.title}>{title}</h3>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
```

```css
.widget { container-type: inline-size; }
.title { font-size: clamp(14px, 4cqi, 24px); }
.content { 
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
@container (max-width: 300px) {
  .content { flex-direction: column; }
}
```

---

## Key Takeaways
- Container queries respond to parent element size, not viewport
- `container-type: inline-size` creates containment context
- Container query units (cqw, cqi, cqmin) size elements to container
- Combine: media queries for page layout, container queries for components
- Eliminates responsive variant props — components adapt automatically

---

## Common Misconception

**"Container queries replace media queries."**

Not replace — complement. Media queries handle page-level layout (grid columns, sidebar visibility). Container queries handle component-level adaptation (card layout, font size). Both needed.

---

## Feynman Explain
(Explain: "A card should look different in a 4-column grid vs a sidebar." Why can't media queries handle this? How do container queries fix it?)

---

## Drill
Take the quiz.

## Quiz: 10-container-queries-responsive


### Container query vs media query — what does each respond to?

- [✓] A: Media = viewport, Container = parent element size

- [ ] B: Media = element size, Container = viewport

- [ ] C: Both respond to viewport but container queries are faster

- [ ] D: Container queries need JavaScript


**Answer:** A

Media queries check viewport dimensions. Container queries check the nearest container element's size.


### Which CSS property creates a containment context?

- [ ] A: display: contain

- [✓] B: container-type: inline-size

- [ ] C: contain: layout

- [ ] D: isolation: isolate


**Answer:** B

container-type: inline-size creates a containment context on inline (width) size. Children can use @container queries against this context.


### A ProductCard renders in a 4-column grid and a sidebar. How do container queries help?

- [✓] A: Card adapts to available width without media query props

- [ ] B: Card automatically switches to a different component

- [ ] C: Nothing — use media queries instead

- [ ] D: Container queries only work on images


**Answer:** A

Card uses @container to detect its own width. In the grid (wide), it renders row layout. In sidebar (narrow), column layout. No variant props needed.


### What does 50cqi represent?

- [✓] A: 50% of container width

- [ ] B: 50 characters of container text

- [ ] C: 50% of viewport

- [ ] D: 50px container inset


**Answer:** A

cqi = container query inline unit. 50cqi = 50% of the container's inline size (width in horizontal writing mode).


### Should container queries replace media queries entirely?

- [ ] A: Yes — container queries are superior

- [✓] B: No — media queries for page layout, container for component adaptation

- [ ] C: No — media queries are faster

- [ ] D: Yes — browser vendors recommend this


**Answer:** B

Media queries handle page-level layout (sidebar collapse, grid columns). Container queries handle component-level adaptation. Both needed.


### When would container queries add no value?

- [ ] A: Component renders in multiple layout contexts

- [✓] B: Component always renders at same width

- [ ] C: Component uses flexbox internally

- [ ] D: Component is a button


**Answer:** B

If component always has the same container width, container query is unnecessary. Media query or static CSS suffices.


---

# Module 11: Animations in React with CSS

Est. study time: 2h
Language: en

## Learning Objectives
- Coordinate CSS animations with React lifecycle
- Use CSS transitions for state-driven UI motion
- Apply View Transitions API in React

---

## Core Content

### CSS Transitions in React

CSS transitions animate between property states. In React, state changes toggle class names → transitions fire:

```css
/* Button.module.css */
.button {
  background: var(--color-primary);
  transition: background 0.2s ease;
}
.button:hover {
  background: var(--color-primary-hover);
}
```

```tsx
// Transition triggered by CSS pseudo-class (hover) — no React state needed
function Button() {
  return <button className={styles.button}>Click</button>;
}
```

**State-driven transitions** toggle via className:

```css
.panel {
  max-height: 0;
  opacity: 0;
  overflow: hidden;
  transition: max-height 0.3s ease, opacity 0.2s ease;
}
.panel.open {
  max-height: 500px;  /* Must be known or use auto — see note */
  opacity: 1;
}
```

```tsx
function Accordion() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(o => !o)}>Toggle</button>
      <div className={clsx(styles.panel, open && styles.open)}>
        Content
      </div>
    </div>
  );
}
```

> **Think**: What's the problem with transitioning max-height from 0 to auto?
>
> *Answer: CSS can't transition to auto. You must use a specific max-height value (larger than actual content). Alternative: use grid-template-rows transition (row 0 → 1fr) which works in modern browsers.*

### Keyframe Animations

For multi-step or repeating animations, use `@keyframes`:

```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.enter { animation: fadeIn 0.3s ease-out; }
.spinner { animation: spin 1s linear infinite; }
```

```tsx
function Toast({ message, onClose }) {
  return (
    <div className={styles.enter}>
      {message}
      <button onClick={onClose}>×</button>
    </div>
  );
}
```

### React Lifecycle + Animation

Mount → enter animation. Unmount → exit animation (needs coordination).

**Problem**: React removes elements immediately. CSS animation on unmount never plays.

**Solution**: Track "closing" state, delay removal:

```tsx
function ToastContainer({ toasts, removeToast }) {
  return (
    <div className={styles.container}>
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onRemove={removeToast} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (exiting) {
      const timer = setTimeout(() => onRemove(toast.id), 300); // match CSS animation duration
      return () => clearTimeout(timer);
    }
  }, [exiting]);

  return (
    <div className={clsx(styles.toast, exiting && styles.exit)}>
      <span>{toast.message}</span>
      <button onClick={() => setExiting(true)}>×</button>
    </div>
  );
}
```

```css
.toast {
  animation: slideIn 0.3s ease-out;
}
.exit {
  animation: slideOut 0.3s ease-in forwards;
}
@keyframes slideIn {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
@keyframes slideOut {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(100%); opacity: 0; }
}
```

**Pattern**: `exiting` state → apply exit animation class → after animation duration, actually remove.

> **Think**: What happens if the animation duration is 500ms but setTimeout uses 300ms?
>
> *Answer: Component unmounts before animation finishes — visible cut. Always match setTimeout to the CSS animation duration. Better: use onAnimationEnd event.*

### onAnimationEnd Event

```tsx
function ToastItem({ toast, onRemove }) {
  const [exiting, setExiting] = useState(false);

  return (
    <div
      className={clsx(styles.toast, exiting && styles.exit)}
      onAnimationEnd={() => exiting && onRemove(toast.id)}
    >
      ...
    </div>
  );
}
```

No timer needed. Browser fires `onAnimationEnd` when CSS animation completes.

### View Transitions API

View Transitions API (2024+) provides smooth transitions between page/document states:

```tsx
function TabView() {
  const [tab, setTab] = useState('list');

  const switchTab = (newTab: string) => {
    if (document.startViewTransition) {
      document.startViewTransition(() => setTab(newTab));
    } else {
      setTab(newTab); // fallback
    }
  };

  return (
    <div>
      <button onClick={() => switchTab('list')}>List</button>
      <button onClick={() => switchTab('grid')}>Grid</button>
      <div className="view-transition-main">
        {tab === 'list' ? <ListView /> : <GridView />}
      </div>
    </div>
  );
}
```

```css
::view-transition-old(view-transition-main) {
  animation: fadeOut 0.2s ease;
}
::view-transition-new(view-transition-main) {
  animation: fadeIn 0.2s ease;
}
```

React 19+ has built-in support via `<ViewTransition>` component (experimental).

### Performance Considerations

- **`transform` and `opacity` only**: These are composited on GPU. Animating `width`, `height`, `top`, `left` triggers layout reflow.
- **`will-change`**: Hint browser about animating properties. Use sparingly — overuse consumes GPU memory.

```css
.animated-element {
  will-change: transform, opacity;
}
```

- **`content-visibility: auto`**: Skip rendering for off-screen elements. Improves initial render performance.

---

### Why This Matters

CSS animations in React require coordinating two systems: React's component lifecycle and CSS's animation lifecycle. Mount = easy (class applies on render). Unmount = requires exiting state + delayed removal. View Transitions API is the future of page transition in React.

---

### Common Questions

**Q: Should I use Framer Motion instead of CSS animations?**
A: CSS for simple transitions/keyframes. Framer Motion for complex gesture-driven animations (drag, spring physics, layout animations). CSS is zero-dependency, Framer Motion is ~30 kB.

**Q: Can I animate CSS custom properties?**
A: Yes, with `@property` for registered custom properties (tells browser how to interpolate). Otherwise, animate a wrapper property (e.g., opacity), not the variable itself.

---

## Key Takeaways
- CSS transitions for state-driven (class toggle). Keyframes for multi-step/repeating.
- Unmount animations need exiting state + timer or onAnimationEnd
- Transition only `transform` and `opacity` for GPU-composited performance
- View Transitions API for page-level transitions (newer, React 19+)
- CSS animations are zero-dependency, Framer Motion for complex motion

---

## Common Misconception

**"CSS animations are always better than JS animations."**

Not true. CSS animations are better for simple declarative motion. JS animation libraries (Framer Motion, GSAP) handle: spring physics, gesture-driven drag, sequencing, shared layout animations, SVG morphing. Choose by complexity.

---

## Feynman Explain
(Explain: why does a toast need "exiting" state? Why doesn't React handle unmount animations automatically?)

---

## Drill
Take the quiz.

## Quiz: 11-animations-react-css


### How do you trigger a CSS transition in React when state changes?

- [ ] A: Call animate() function in useEffect

- [✓] B: Toggle a CSS class based on state

- [ ] C: CSS transitions fire automatically on state change

- [ ] D: Use setTimeout to apply styles


**Answer:** B

State change → conditional className → element gets new class → CSS transition interpolates between old/new property values.


### Why can't CSS animate max-height from 0 to auto?

- [✓] A: auto is not a numeric value — CSS can't interpolate

- [ ] B: Transitions don't work with max-height

- [ ] C: CSS only animates opacity

- [ ] D: It works — statement is false


**Answer:** A

CSS transitions require numeric start/end values. auto is not numeric. Use max-height: 500px (larger than actual content) or grid-template-rows transition.


### What's needed for unmount animation in React?

- [ ] A: Nothing — CSS handles all animations

- [✓] B: Exiting state to apply exit animation class, then remove after animation

- [ ] C: Use setTimeout only

- [ ] D: Use React's onUnmount prop


**Answer:** B

React removes elements immediately — exit animation never plays. Pattern: set 'exiting' state → apply exit className → onAnimationEnd/delayed cleanup removes element.


### Which event fires when a CSS keyframe animation completes?

- [✓] A: onAnimationEnd

- [ ] B: onTransitionEnd

- [ ] C: onAnimationComplete

- [ ] D: onFinish


**Answer:** A

onAnimationEnd fires when a CSS animation (@keyframes) finishes. onTransitionEnd fires for CSS transitions. Don't confuse them.


### Which CSS properties are GPU-composited (safe to animate)?

- [ ] A: width, height

- [✓] B: transform, opacity

- [ ] C: margin, padding

- [ ] D: font-size, line-height


**Answer:** B

transform and opacity are composited on GPU — no layout recalc. Width/height/margin/padding trigger layout reflow every frame.


### When should you use Framer Motion over CSS animations?

- [ ] A: For simple enter/exit transitions

- [✓] B: For gesture-driven animations (drag, spring physics)

- [ ] C: For hover effects

- [ ] D: Never — CSS is always better


**Answer:** B

CSS for declarative motion (transitions, keyframes). Framer Motion for gesture-driven, physics-based, or shared layout animations that need JavaScript coordination.


---

# Module 12: CSS Testing in React Apps

Est. study time: 2.5h
Language: en

## Learning Objectives
- Implement visual regression testing for React components
- Write unit tests for CSS-in-JS and CSS Modules
- Audit CSS for accessibility and layout breakpoints
- Decide what to test vs trust

---

## Core Content

### Testing Pyramid for CSS

CSS testing has distinct layers:

```
       ┌──────────┐
       │  Visual  │  ← Catch visual bugs humans miss
       │  Regr.   │
      ┌┴──────────┴┐
      │  Layout    │  ← Responsive breakpoints, overflow
      │  Tests     │
     ┌┴────────────┴┐
     │  A11y       │  ← Color contrast, focus indicators
     │  Audit      │
    ┌┴──────────────┴┐
    │  Unit Tests   │  ← Class merging, variant output
    │  (CSS-in-JS)  │
   ┌┴────────────────┴┐
   │ TypeScript/Lint  │  ← Typo prevention at compile time
   └──────────────────┘
```

**What to test:**
- Visual output (screenshot comparisons)
- Responsive behavior at breakpoints
- Color contrast ratios
- CSS-in-JS variant logic (conditional class merging)

**What NOT to test:**
- Fundamental CSS property behavior (does `display: flex` work? — trust the browser)
- Exact pixel values (test visual diff tolerance, not pixel numbers)
- Third-party CSS (reset, Tailwind utilities — trust the library)

> **Think**: You write a unit test: `expect(styles.button).toBe('Button_button_abc123')`. Is this useful?
>
> *Answer: No. The class name is an implementation detail. Test the visual output or behavior, not generated class names.*

### Visual Regression Testing

Compare screenshots of components across commits. If component renders differently, test fails.

**Playwright** (most common 2026):

```tsx
// Button.spec.tsx
import { test, expect } from '@playwright/experimental-ct-react';
import Button from './Button';

test('renders primary variant', async ({ mount }) => {
  const component = await mount(<Button variant="primary">Submit</Button>);
  await expect(component).toHaveScreenshot('button-primary.png');
});

test('renders disabled state', async ({ mount }) => {
  const component = await mount(<Button disabled>Submit</Button>);
  await expect(component).toHaveScreenshot('button-disabled.png');
});
```

**Chromatic** (Storybook-based):

```tsx
// Button.stories.tsx
export default { component: Button };

export const Primary = { args: { variant: 'primary', children: 'Submit' } };
export const Disabled = { args: { disabled: true, children: 'Submit' } };
// Chromatic auto-captures screenshots per story
```

**Setup considerations:**
- Use deterministic font loading (system fonts vary per OS)
- Mock random values (colors, dimensions from data)
- Set viewport size explicitly per test
- Use `--update-snapshots` to update baselines after intentional changes

> **Think**: A button's box-shadow changes from 2px to 4px intentionally. What happens to visual regression tests?
>
> *Answer: They fail. Dev reviews the diff, confirms it's intentional, and updates the golden screenshots. This is correct behavior — VRT should fail on ANY visual change, intentional or not.*

### Layout Breakpoint Tests

Test that components respond correctly at breakpoints:

```tsx
import { test, expect } from '@playwright/test';

test('card grid switches to single column on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/products');
  const grid = page.locator('.product-grid');
  await expect(grid).toHaveCSS('grid-template-columns', '1fr');
});

test('card grid shows 3 columns on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/products');
  const grid = page.locator('.product-grid');
  await expect(grid).toHaveCSS('grid-template-columns', 'repeat(3, 1fr)');
});
```

**What to assert**: `grid-template-columns`, `flex-direction`, `display`, `visibility`. Not exact pixel values.

### Accessibility Audit

```tsx
import { test, expect } from '@playwright/test';

test('button has sufficient color contrast', async ({ page }) => {
  await page.goto('/');
  const button = page.locator('button.submit');
  const bg = await button.evaluate(el => getComputedStyle(el).backgroundColor);
  const color = await button.evaluate(el => getComputedStyle(el).color);
  // contrast ratio > 4.5:1 for normal text (AA)
  const ratio = getContrastRatio(bg, color);
  expect(ratio).toBeGreaterThanOrEqual(4.5);
});

test('focus indicator is visible', async ({ page }) => {
  await page.goto('/');
  const button = page.locator('button.submit');
  await button.focus();
  const outline = await button.evaluate(el => getComputedStyle(el).outline);
  expect(outline).not.toBe('none');
});
```

Use `axe-core` for automated a11y audit:

```tsx
import { injectAxe, checkA11y } from 'axe-playwright';

test('page has no a11y violations', async ({ page }) => {
  await page.goto('/');
  await injectAxe(page);
  await checkA11y(page, {
    includedImpacts: ['critical', 'serious'],
  });
});
```

### CSS-in-JS Unit Tests

For styled-components, Emotion, Vanilla Extract recipes — test the variant logic, not the CSS output:

```tsx
// Button.tsx — recipe-based
const button = recipe({
  base: { /* ... */ },
  variants: {
    variant: {
      primary: { background: 'blue' },
      danger: { background: 'red' },
    },
  },
});

// Test variant class resolution (unit test):
test('button recipe returns correct variant classes', () => {
  expect(button({ variant: 'primary' })).toContain('primary');
  expect(button({ variant: 'danger' })).toContain('danger');
});
```

**Do NOT test:**
- That `background: blue` renders as blue (browser renders it)
- That CSS property works (trust the spec)
- Exact class names (they change with hash)

**DO test:**
- Conditional class merging (does `isActive && styles.active` apply correctly?)
- twMerge conflict resolution
- cva variant selection

### Testing Tailwind Components

```tsx
import { render, screen } from '@testing-library/react';
import Button from './Button';

test('applies correct classes for primary variant', () => {
  render(<Button variant="primary">Submit</Button>);
  const btn = screen.getByRole('button');
  // Check rendered className string
  expect(btn.className).toContain('bg-blue-500');
});

test('merges consumer className with twMerge', () => {
  render(<Button className="bg-red-500">Submit</Button>);
  const btn = screen.getByRole('button');
  // bg-red-500 should override — NOT both present
  expect(btn.className).not.toMatch(/bg-blue-500/);
});
```

### What to Skip Testing

| Don't test | Reason |
|-----------|--------|
| Browser rendering of CSS properties | Trust the spec |
| Class name hashes | Implementation detail |
| Tailwind utility behavior | Trust framework |
| Third-party CSS | Out of scope |
| Exact font rendering | OS/device dependent |

---

### Why This Matters

CSS bugs are uniquely hard to debug — they manifest visually, cascade unpredictably, and often don't crash. Testing CSS prevents: "it worked in my browser" regressions, accessibility failures, and responsive breakpoint issues that reach production.

---

### Common Questions

**Q: Do I need visual regression tests for every component?**
A: Critical path components (buttons, inputs, layout) yes. Utility components (Stack, Flex) — less value. Prioritize visual impact.

**Q: How often do visual regression tests break from changes?**
A: Frequently at first. As the baseline stabilizes, most failures are intentional changes that need snapshot updates. The value is catching the UNINTENTIONAL diff.

---

## Key Takeaways
- VRT captures visual regressions — use Playwright or Chromatic
- Layout tests assert grid/flex behavior at breakpoints
- a11y audit with axe-core for automated contrast/role checks
- Unit test variant logic, not CSS property output
- Skip: browser rendering, hash values, third-party CSS

---

## Common Misconception

**"I need to test every CSS property my component uses."**

No. Test behavior, not implementation. "Does the button change color when disabled?" is a test. "Does this CSS class have `opacity: 0.5`?" is brittle. The first catches real bugs; the second breaks on every refactor.

---

## Feynman Explain
(Explain: "CSS testing" sounds like testing the browser. What are we actually testing? The component's visual contract.)

---

## Drill
Take the quiz.

## Quiz: 12-css-testing-react


### What do visual regression tests compare?

- [ ] A: CSS property values

- [✓] B: Component screenshots against golden baselines

- [ ] C: Class name strings

- [ ] D: Bundle size


**Answer:** B

VRT captures screenshots of components and compares to stored baselines. Any pixel difference fails the test.


### When a visual regression test fails, what's the correct response?

- [✓] A: Update golden snapshot if the visual change is intentional

- [ ] B: Revert the code change

- [ ] C: Ignore — tests are flaky

- [ ] D: Delete the snapshot


**Answer:** A

Review the diff. If intentional (design change), update baseline. If unintentional (bug caused visual change), fix the code.


### What should you NOT test in CSS unit tests?

- [ ] A: Conditional class merging logic

- [ ] B: Variant selection (correct class for variant)

- [✓] C: Browser rendering of display: flex

- [ ] D: twMerge conflict resolution


**Answer:** C

Trust the browser's CSS engine. Testing that display: flex works is testing the browser, not your code. Test your component's variant logic and class merging.


### Which tool provides automated accessibility audits?

- [ ] A: Playwright only

- [✓] B: axe-core

- [ ] C: Tailwind CSS

- [ ] D: clsx


**Answer:** B

axe-core automates accessibility checks: contrast ratios, ARIA roles, keyboard navigation, focus indicators. Integrates with Playwright or Cypress.


### How do you test responsive breakpoint behavior?

- [✓] A: Assert grid-template-columns at different viewport sizes

- [ ] B: Take screenshots at every breakpoint

- [ ] C: Mock window.innerWidth

- [ ] D: Responsive behavior is untestable


**Answer:** A

Set viewport size with page.setViewportSize(), assert CSS property values like grid-template-columns or flex-direction at each breakpoint.


### A Button changes primary bg from blue to green. What tests catch this?

- [ ] A: Unit test — expect(BUTTON.bg).toBe('green')

- [✓] B: Visual regression — screenshot comparison shows diff

- [ ] C: TypeScript — color type changed

- [ ] D: Bundle analysis — CSS file size changed


**Answer:** B

VRT catches the visual change automatically. Unit test testing specific color values would need manual update — VRT surfaces ALL visual diffs regardless of which property changed.


### Why should you NOT test generated CSS Module class names?

- [✓] A: Class names are hashed — change with every build

- [ ] B: They are never visible to users

- [ ] C: CSS Modules don't generate class names

- [ ] D: They are not strings


**Answer:** A

CSS Module class names include content hashes that change when CSS changes. Testing the exact hash is brittle. Test behavior or visual output instead.


---

# Module 13: Utility Libraries for React CSS

Est. study time: 2h
Language: en

## Learning Objectives
- Choose between clsx, classnames, tailwind-merge, and cva
- Apply conditional class merging correctly
- Assess bundle cost vs ergonomics per library

---

## Core Content

### The Problem Utility Libraries Solve

React JSX builds className strings from conditions:

```tsx
// Without utility — manual string construction:
className={[
  'btn',
  variant === 'primary' && 'btn-primary',
  size === 'lg' && 'btn-lg',
  disabled && 'btn-disabled',
].filter(Boolean).join(' ')}
```

Each utility library simplifies this differently.

### clsx (Most Popular 2026)

Tiny (~228 B gzip). Handles strings, arrays, objects, booleans:

```tsx
import clsx from 'clsx';

clsx('btn', variant === 'primary' && 'btn-primary', disabled && 'btn-disabled');
// → "btn btn-primary btn-disabled"

clsx(['btn', 'btn-lg'], { 'btn-disabled': disabled });
// → "btn btn-lg btn-disabled" (if disabled true)
```

**When to use**: Any React app. It's the universal conditional class utility. No Tailwind dependency needed.

**Bundle**: ~228 B gzip. Effectively free.

### classnames (Legacy, Still Used)

Older API, slightly larger (~428 B gzip):

```tsx
import classnames from 'classnames';

classnames('btn', { 'btn-primary': variant === 'primary' });
```

**Tradeoff**: Same functionality as clsx, but larger. clsx is the modern replacement. Only use if existing codebase already uses classnames.

### tailwind-merge (Tailwind Conflict Resolution)

Resolves conflicting Tailwind classes:

```tsx
import { twMerge } from 'tailwind-merge';

twMerge('px-4 py-2', 'px-6'); // → "py-2 px-6"
// px-6 overrides px-4 intelligently
```

Without twMerge: `className="px-4 px-6"` → CSS source order determines which padding wins (unpredictable).
With twMerge: later className overrides earlier predictably.

**When to use**: Any app using Tailwind where className overrides happen.

**Bundle**: ~6 kB gzip. Not free, but small relative to Tailwind's CSS output.

### cva (class-variance-authority)

Defines type-safe component variants:

```tsx
import { cva, type VariantProps } from 'class-variance-authority';

const button = cva('rounded-md font-medium', {
  variants: {
    variant: {
      primary: 'bg-blue-500 text-white',
      danger: 'bg-red-500 text-white',
    },
    size: {
      sm: 'px-3 py-1 text-sm',
      lg: 'px-6 py-3 text-lg',
    },
  },
  defaultVariants: { variant: 'primary', size: 'sm' },
});

// VariantProps<typeof button> → TypeScript type for props
type ButtonProps = VariantProps<typeof button> & { children: React.ReactNode };
```

**When to use**: Components with multiple variant dimensions. Co-locates variant definitions with component.

**Bundle**: ~1.3 kB gzip.

### Bundle Cost Summary

| Library | gzip | Purpose | When |
|---------|------|---------|------|
| clsx | 228 B | Conditional class merging | Always |
| classnames | 428 B | Same as clsx | Legacy only |
| tailwind-merge | 6 kB | Tailwind conflict resolution | Tailwind apps with overrides |
| cva | 1.3 kB | Type-safe variant definitions | Multi-variant components |

### Composition Pattern

Combine them:

```tsx
import { twMerge } from 'tailwind-merge';
import { cva, type VariantProps } from 'class-variance-authority';
import clsx from 'clsx';

const button = cva('rounded-md font-medium', {
  variants: {
    variant: {
      primary: 'bg-blue-500 text-white hover:bg-blue-600',
      danger: 'bg-red-500 text-white hover:bg-red-600',
    },
  },
});

function Button({ variant, className, children }: ButtonProps) {
  return (
    <button className={twMerge(button({ variant }), className)}>
      {children}
    </button>
  );
}
```

`cva` handles variant logic. `twMerge` handles consumer overrides. `clsx` handles any additional conditions.

### Condition Merging Pitfalls

```tsx
// BAD — clsx doesn't resolve Tailwind conflicts:
clsx('px-4', 'px-6') // → "px-4 px-6" — both present, browser decides

// GOOD — twMerge resolves:
twMerge('px-4', 'px-6') // → "px-6"
```

```tsx
// BAD — clsx includes false values:
clsx(false && 'hidden') // → "" — but '' is still a class attribute

// GOOD — clsx handles booleans correctly:
clsx(disabled && 'disabled') // → "disabled" or ""
```

> **Think**: When would you NOT use twMerge for Tailwind components?
>
> *Answer: When there's no possibility of conflicting classes. Simple components with one variant dimension don't need twMerge. It adds 6 kB for no benefit.*

---

### Why This Matters

Utility libraries are small but impactful. clsx saves 2 lines of filter/join boilerplate per component. twMerge prevents a class of subtle CSS bugs. cva makes variant props type-safe. The small costs (228 B to 6 kB) are among the best ergonomics-per-byte investments in a React app.

---

### Common Questions

**Q: Should I use clsx or twMerge everywhere?**
A: clsx everywhere. twMerge only in component APIs that accept consumer className overrides (i.e., the component that calls twMerge). Internal components don't need it.

**Q: Is cva only for Tailwind?**
A: No. cva returns class strings — works with CSS Modules, Vanilla Extract, plain CSS. Any approach that uses className.

---

## Key Takeaways
- clsx: universal conditional class merging (228 B). Use everywhere.
- twMerge: Tailwind conflict resolution (6 kB). Use at component API boundary.
- cva: type-safe variant definitions (1.3 kB). Use for multi-variant components.
- classnames: legacy alternative to clsx. Don't choose for new projects.
- Combine: cva(def) → twMerge(cva(), consumerClass)

---

## Common Misconception

**"twMerge replaces clsx."**

Not replacement — different purpose. clsx handles "should this class be in the string?" twMerge handles "which of these conflicting classes wins?" Use both. clsx for conditional logic, twMerge for conflict resolution.

---

## Feynman Explain
(Explain: clsx is for building class strings from conditions. twMerge is for resolving conflicts when multiple classes set the same property. Different tools.)

---

## Drill
Take the quiz.

## Quiz: 13-utility-libraries-react-css


### What does clsx do?

- [ ] A: Resolves conflicting Tailwind classes

- [✓] B: Builds class strings from conditional values

- [ ] C: Generates CSS Module types

- [ ] D: Minifies CSS class names


**Answer:** B

clsx takes strings, arrays, objects, and boolean conditions, returning a single className string. 'btn' &amp;&amp; 'active' → 'btn active' or 'btn'.


### clsx vs classnames — which is preferred for new projects?

- [ ] A: classnames — it's older and more stable

- [✓] B: clsx — smaller (~228 B vs ~428 B), same functionality

- [ ] C: Both — use interchangeably

- [ ] D: Neither — always use twMerge


**Answer:** B

clsx is ~200 B smaller with the same API. classnames is legacy. For new projects, clsx is the standard.


### What problem does twMerge solve that clsx doesn't?

- [ ] A: Merging objects

- [✓] B: Resolving conflicting Tailwind utility classes

- [ ] C: Booleans in class strings

- [ ] D: Array class inputs


**Answer:** B

clsx concatenates — 'px-4 px-6' remains both classes. twMerge detects conflicts and keeps only the last (intended) value. Different purposes.


### When should twMerge be used?

- [ ] A: Every className in the app

- [✓] B: Component APIs that accept consumer className overrides

- [ ] C: Only with styled-components

- [ ] D: Never — clsx is sufficient


**Answer:** B

twMerge at the component boundary where consumer className merges with defaults. Internal components don't need it. Adds 6 kB — don't use without need.


### cva provides what feature?

- [ ] A: CSS variable management

- [✓] B: Type-safe component variant definitions

- [ ] C: CSS Module compilation

- [ ] D: Tailwind config generation


**Answer:** B

cva defines variants with TypeScript types. Invalid variant name → compile error. Useful for multi-variant components.


### A component needs: variant prop (3 values) + size prop (3 values) + consumer className override. What's the tool stack?

- [✓] A: cva + twMerge

- [ ] B: clsx only

- [ ] C: classnames + twMerge

- [ ] D: Inline conditional operators


**Answer:** A

cva defines variants (type-safe). twMerge merges variant class string with consumer className. clsx could also be needed for additional runtime conditions.


### Bundle cost of clsx + twMerge + cva together?

- [✓] A: ~7.5 kB gzip

- [ ] B: ~30 kB gzip

- [ ] C: ~1 kB gzip

- [ ] D: ~15 kB gzip


**Answer:** A

clsx (228 B) + twMerge (6 kB) + cva (1.3 kB) = ~7.5 kB gzip total. Modest cost for significant DX improvement.


---

# Module 14: Performance & CSS Bundle in React

Est. study time: 2h
Language: en

## Learning Objectives
- Implement critical CSS extraction in SSR
- Code-split CSS per lazy-loaded route
- Eliminate unused CSS with tools
- Apply CSS containment for rendering performance

---

## Core Content

### Critical CSS

CSS blocks rendering. Browser must download and parse CSS before painting. For large apps, this delays first paint.

**Critical CSS**: Inline styles needed for above-the-fold content in `<head>`. Defer the rest.

```html
<!-- Inlined critical CSS (first paint) -->
<style>
  header { display: flex; ... }
  .hero { font-size: 2rem; ... }
</style>
<!-- Deferred non-critical CSS -->
<link rel="preload" href="/styles.css" as="style" onload="this.rel='stylesheet'">
```

**In Next.js**: Built-in. Automatic critical CSS extraction. No manual setup.

**In Vite**: Use `vite-plugin-critical` or manual extraction.

**Manual extraction**: Tools like `critical` (Node.js) analyze a page at a viewport, extract used styles, inline them.

> **Think**: A 200 kB CSS file blocks rendering. Critical CSS inlines 15 kB for first viewport. What's the improvement?
>
> *Answer: First paint happens after 15 kB instead of 200 kB. On 3G (2 Mbps), that's ~60ms vs ~800ms. Remaining CSS loads non-blocking (preload → switch).*

### CSS Code Splitting

Route-based CSS splitting: each lazy-loaded page/component loads its CSS only when needed.

**CSS Modules naturally code-split** — each component's CSS is a separate file. Bundlers (Next.js, Vite) extract component CSS into per-chunk files.

```tsx
// Lazy component — its .module.css loads only when this chunk loads
const Dashboard = lazy(() => import('./Dashboard'));
```

**With Tailwind**: JIT generates one CSS file containing all used utilities. No per-component splitting. Solution: split into separate entry points or use multiple CSS files per route.

**With styled-components**: All styles merge into one `<style>` tag. No code-splitting — all styles load with first JS bundle.

### Unused CSS Elimination

- **Tailwind JIT**: Only generates used classes — effectively zero unused CSS
- **PurgeCSS**: For hand-written CSS, scans files and removes unused selectors

```js
// postcss.config.js — manual PurgeCSS
module.exports = {
  plugins: [
    require('@fullhuman/postcss-purgecss')({
      content: ['./src/**/*.{tsx,ts}'],
      defaultExtractor: content => content.match(/[\w-/:]+(?<!:)/g) || [],
    }),
  ],
};
```

**Gains**: Hand-written CSS can be 50-80% unused. PurgeCSS drops unused selectors — typically reduces 100 kB → 20 kB.

### CSS Containment

`content-visibility: auto` skips rendering of off-screen elements:

```css
.product-card {
  content-visibility: auto;
  contain-intrinsic-size: 200px; /* placeholder size before rendering */
}
```

Browser renders only visible cards + a few off-screen. Scrolling triggers progressive rendering.

**In React list**:

```tsx
function ProductList({ products }) {
  return (
    <div className="product-grid">
      {products.map(p => (
        <div key={p.id} className="product-card">
          <ProductCard product={p} />
        </div>
      ))}
    </div>
  );
}
```

For 500 products, content-visibility reduces initial render cost from 500 cards to ~20 (viewport + buffer).

### Bundle Impact by CSS Approach

| Approach | CSS in JS bundle | CSS file size | Code-split |
|----------|-----------------|---------------|------------|
| Plain CSS | 0 kB | Full authored | Manual |
| CSS Modules | 0 kB | Per component | Automatic |
| Tailwind | 0 kB | 5-15 kB total | Manual per page |
| Runtime CSS-in-JS | Library + CSS strings | N/A | No (global style tag) |
| Vanilla Extract | 0 kB | Per component | Automatic |

> **Think**: An app loads 10 screens. Total authored CSS: 200 kB. With CSS Modules/Vite, what loads on first page?
>
> *Answer: Only the CSS for components rendered on the first page (~20-30 kB). Other screens' CSS loads with their JS chunks. Tailwind would load all 10 pages' utilities (~10-15 kB because purged). Runtime CSS-in-JS loads all CSS strings with the initial JS bundle.*

### Avoiding Layout Shifts (CLS)

- Set explicit dimensions on images: `<img width="400" height="300" />`
- Use `aspect-ratio` CSS property for dynamic content
- Avoid injecting dynamic content above static content without placeholder dimensions

### Animation Performance

- **`transform` and `opacity` only**: GPU composited, no layout/reflow
- **Avoid animating**: `width`, `height`, `top`, `left`, `margin`, `padding`
- **`will-change`**: Use sparingly — only for elements that DO animate

```css
.toast {
  transform: translateX(100%);
  transition: transform 0.3s ease; /* GPU composited */
}
```

---

### Why This Matters

CSS performance is often the last optimization. But CSS is a render-blocking resource — a slow CSS load directly delays every user interaction. In React, CSS bundle strategy is determined by your styling approach choice (Module 1). You can't optimize CSS in isolation from architecture.

---

### Key Takeaways
- Critical CSS inlines first-viewport styles — built into Next.js, manual in Vite
- CSS Modules/Vanilla Extract code-split automatically per component/route
- Tailwind JIT eliminates unused CSS by construction
- content-visibility: auto skips off-screen rendering (big gains for long lists)
- Avoid animating layout-triggering properties — use transform/opacity

---

## Common Misconception

**"CSS performance doesn't matter because CSS is small."**

CSS file size is only part. CSS is render-blocking — every kB delays first paint. On slow networks, large CSS files directly increase Time to First Contentful Paint (FCP). An app with 200 kB CSS loads text in ~800ms on 3G vs ~150ms for a critical-CSS-optimized app.

---

## Drill
Take the quiz.

## Quiz: 14-performance-css-bundle


### Why is CSS render-blocking a performance concern?

- [ ] A: CSS files are always large

- [✓] B: Browser delays first paint until CSS is downloaded and parsed

- [ ] C: CSS blocks JavaScript execution

- [ ] D: CSS can't be cached


**Answer:** B

CSS is a render-blocking resource. Browser won't paint until all CSS is loaded and parsed. Delaying first paint directly increases FCP.


### What does critical CSS inlining do?

- [ ] A: Puts all CSS in a single file

- [✓] B: Inlines only above-the-fold styles in &lt;head&gt;, defers the rest

- [ ] C: Removes all CSS from the page

- [ ] D: Converts CSS to inline styles


**Answer:** B

Extracts styles needed for initial viewport content, inlines them in &lt;head&gt; for immediate paint. Remaining CSS loads asynchronously.


### Which CSS approach automatically code-splits per lazy-loaded component?

- [ ] A: Runtime CSS-in-JS

- [✓] B: CSS Modules

- [ ] C: Tailwind (single file)

- [ ] D: Sass (single file)


**Answer:** B

CSS Modules bundle tools generate separate CSS per component/lazy chunk. Loads only when component loads. Runtime CSS-in-JS and Tailwind single file load all at once.


### What does content-visibility: auto do?

- [ ] A: Makes content invisible

- [✓] B: Skips rendering of off-screen elements

- [ ] C: Hides content for search engines

- [ ] D: Automatically generates CSS


**Answer:** B

Browser only renders elements near viewport. Off-screen elements skip rendering until scrolled near. contain-intrinsic-size reserves placeholder space.


### Which CSS approaches contribute ZERO CSS to the JavaScript bundle?

- [✓] A: Plain CSS, CSS Modules, Tailwind, Vanilla Extract

- [ ] B: Runtime CSS-in-JS only

- [ ] C: All approaches include CSS in JS bundle

- [ ] D: Only plain CSS has zero JS bundle


**Answer:** A

Plain CSS, CSS Modules, Tailwind, and Vanilla Extract all output separate .css files. Runtime CSS-in-JS keeps CSS strings in the JS bundle.


### How do you avoid layout shift (CLS) when images load?

- [✓] A: Set explicit width/height attributes on &lt;img&gt;

- [ ] B: Use CSS display: none initially

- [ ] C: Load images with JavaScript after paint

- [ ] D: CLS is unavoidable


**Answer:** A

Set width and height attributes or CSS aspect-ratio. Browser reserves the space before image loads, preventing layout shift when image arrives.


### Tailwind JIT output for a 10-page app is typically:

- [ ] A: 50-100 kB — all utilities ever generated

- [✓] B: 5-15 kB gzip — only used utilities

- [ ] C: 0 kB — Tailwind has no CSS output

- [ ] D: Same as authored Tailwind classes size


**Answer:** B

JIT generates only utilities found in source files. 5-15 kB gzip is typical for most apps. Much smaller than hand-written CSS with similar coverage.


---

# Module 15: Capstone — Production React Component Library

Est. study time: 3h
Language: en

## Learning Objectives
- Integrate CSS approach, theming, testing, and performance decisions
- Build a themed, tested, performant component library
- Document tradeoff decisions made across modules

---

## Core Content

### Capstone Overview

Build a React component library (Button + Card + Layout primitives) that demonstrates:
- CSS approach decision based on tradeoff analysis
- CSS custom property theming
- Container query responsiveness
- Visual regression + a11y testing
- Utility library integration (clsx, twMerge, cva)

You'll make deliberate choices at each step, then justify them.

### Step 1: Choose CSS Approach

**Context**: Shared library consumed by 3 apps (React SPA, Next.js RSC, Vite Vue app — via wrapper). Need: zero dependency, theming, type safety.

**Decision**: CSS Modules + CSS custom properties.
- Rationale: Zero runtime, RSC-compatible, no library dependency for consumers
- CSS Custom properties for theming (override at consumer level)
- `cva` for variant definitions (build + runtime = type-safe variants)

### Step 2: Design Token Architecture

```css
/* tokens.css — published as part of library */
:root {
  --ds-color-primary: #6366f1;
  --ds-color-primary-hover: #4f46e5;
  --ds-color-danger: #ef4444;
  --ds-color-surface: #ffffff;
  --ds-color-text: #0f172a;
  --ds-space-xs: 4px;
  --ds-space-sm: 8px;
  --ds-space-md: 16px;
  --ds-space-lg: 24px;
  --ds-radius-sm: 4px;
  --ds-radius-md: 8px;
  --ds-font-body: 16px;
}
```

Consumers override any token:

```css
/* Consumer app */
:root { --ds-color-primary: #7c3aed; }
```

### Step 3: Button Component

```tsx
// Button.tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { twMerge } from 'tailwind-merge';
import styles from './Button.module.css';

const buttonVariants = cva(styles.base, {
  variants: {
    variant: {
      primary: styles.primary,
      danger: styles.danger,
      outline: styles.outline,
    },
    size: {
      sm: styles.sm,
      md: styles.md,
      lg: styles.lg,
    },
  },
  defaultVariants: { variant: 'primary', size: 'md' },
});

type ButtonProps = VariantProps<typeof buttonVariants> & {
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
};

export function Button({ variant, size, className, disabled, children }: ButtonProps) {
  return (
    <button
      className={twMerge(buttonVariants({ variant, size }), disabled && styles.disabled, className)}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
```

```css
/* Button.module.css */
.base {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--ds-space-sm);
  border-radius: var(--ds-radius-md);
  font-size: var(--ds-font-body);
  border: 1px solid transparent;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
}
.primary { background: var(--ds-color-primary); color: white; }
.primary:hover { background: var(--ds-color-primary-hover); }
.danger { background: var(--ds-color-danger); color: white; }
.outline { background: transparent; border-color: var(--ds-color-primary); color: var(--ds-color-primary); }
.sm { padding: var(--ds-space-xs) var(--ds-space-sm); font-size: 14px; }
.md { padding: var(--ds-space-sm) var(--ds-space-md); }
.lg { padding: var(--ds-space-md) var(--ds-space-lg); font-size: 18px; }
.disabled { opacity: 0.5; pointer-events: none; }
```

### Step 4: Card with Container Query

```tsx
// Card.tsx
import styles from './Card.module.css';

type CardProps = {
  variant?: 'default' | 'elevated';
  children: React.ReactNode;
  className?: string;
};

export function Card({ variant = 'default', children, className }: CardProps) {
  return (
    <div className={twMerge(styles.card, variant === 'elevated' && styles.elevated, className)}>
      {children}
    </div>
  );
}
```

```css
/* Card.module.css */
.card {
  container-type: inline-size;
  background: var(--ds-color-surface);
  border: 1px solid var(--ds-color-border, #e2e8f0);
  border-radius: var(--ds-radius-md);
  padding: var(--ds-space-md);
  color: var(--ds-color-text);
}
.elevated { box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
@container (max-width: 300px) {
  .card { padding: var(--ds-space-sm); }
}
```

### Step 5: Layout Primitives

```tsx
// Stack.tsx — ${\text{see Module 9}}$
// Flex.tsx
// Grid.tsx
```

Import from a `primitives/` directory. Each uses CSS Modules + CSS custom properties for spacing.

### Step 6: Testing

```tsx
// Button.spec.tsx — Playwright
test('renders primary variant', async ({ mount }) => {
  const component = await mount(<Button>Click</Button>);
  await expect(component).toHaveScreenshot();
});

test('renders disabled state', async ({ mount }) => {
  const component = await mount(<Button disabled>Click</Button>);
  await expect(component).toHaveScreenshot();
});

test('applies consumer className correctly', async ({ mount }) => {
  const component = await mount(<Button className="custom-class">Click</Button>);
  await expect(component).toHaveClass(/custom-class/);
});

// A11y
test('has no a11y violations', async ({ mount }) => {
  const component = await mount(<Button>Click</Button>);
  await expect(component).toPassAxe();
});
```

```tsx
// Card.spec.tsx — responsive
test('adapts padding at narrow container', async ({ mount }) => {
  // Mount inside 200px container
  const component = await mount(
    <div style={{ width: '200px' }}>
      <Card>Content</Card>
    </div>
  );
  await expect(component).toHaveScreenshot('card-narrow.png');
});

test('adapts padding at wide container', async ({ mount }) => {
  const component = await mount(
    <div style={{ width: '500px' }}>
      <Card>Content</Card>
    </div>
  );
  await expect(component).toHaveScreenshot('card-wide.png');
});
```

### Step 7: Performance Verification

```tsx
test('Button component CSS is not render-blocking', async ({ page }) => {
  const metrics = await page.goto('/test-page');
  // Verify CSS is loaded in render-blocking resources
  const criticalCSS = metrics.renderBlockingCSS;
  expect(criticalCSS).toBeLessThan(1024); // < 1 kB critical
});
```

### Step 8: Bundle Analysis

Check build output:
- `dist/Button.module.css` — scoped, per component
- `dist/tokens.css` — theme variables (loaded once)
- No runtime library in JS bundle

Target: each component's CSS < 2 kB gzip (including tokens references).

---

### Why This Matters

The capstone ties every module together. You don't just write a component — you make deliberate architectural decisions: approach choice (CSS Modules + custom properties), variant mechanism (cva), conflict resolution (twMerge), theming (custom properties), responsiveness (container queries), testing (VRT + a11y).

Each decision is a tradeoff. The capstone surfaces those tradeoffs and forces you to justify them.

---

### Key Takeaways
- CSS Modules + CSS custom properties = zero-runtime, themable, RSC-compatible library
- cva + twMerge gives type-safe variants with consumer override
- Container queries make components context-responsive without props
- VRT catches visual regressions in theme variants and responsive states
- Performance: check critical CSS size, per-component CSS file sizes, JS bundle CSS contribution

---

## Feynman Explain
(Explain the architecture decisions for the component library to a teammate. Why CSS Modules and not Tailwind? Why CSS custom properties and not ThemeProvider? Why cva + twMerge?)

---

## Reframe
(Pause. Judge: What would change if the library needed to support Vue AND React? What if it was an internal-only library for one team? How do those contexts change approach decisions?)

---

## Drill
Take the quiz to verify understanding of the integrated architecture.

## Quiz: 15-capstone-component-library


### Which CSS approach is best for a shared component library consumed by apps with different frameworks?

- [ ] A: styled-components (ThemeProvider)

- [✓] B: CSS Modules + CSS custom properties

- [ ] C: Tailwind (requires consumer to use Tailwind)

- [ ] D: Global Sass


**Answer:** B

CSS Modules scope styles, CSS custom properties enable theming. Zero dependencies on consumer. Works with React, Vue, Angular — any framework that supports CSS.


### In the capstone architecture, how do consumers customize component colors?

- [ ] A: Pass theme object to ThemeProvider

- [✓] B: Override CSS custom properties in their stylesheet

- [ ] C: Pass color prop to every component

- [ ] D: Modify library source code


**Answer:** B

Library exposes --ds-color-* variables. Consumer overrides: :root { --ds-color-primary: #purple; }. No React code changes.


### Why does the capstone use cva + twMerge instead of just cva?

- [ ] A: cva doesn't work without twMerge

- [✓] B: twMerge lets consumers override variant classes via className prop

- [ ] C: cva generates conflicting classes

- [ ] D: twMerge replaces cva entirely


**Answer:** B

cva handles variant selection. twMerge merges variant class string with consumer's className, resolving conflicts predictably.


### How does the capstone Card component respond to narrow containers?

- [ ] A: Accepts a variant prop

- [✓] B: Uses @container query to detect width

- [ ] C: Uses React Context for width

- [ ] D: ResizeObserver hook


**Answer:** B

container-type: inline-size on .card + @container (max-width: 300px) reduces padding. No JavaScript, no prop — native CSS responsiveness.


### What would change if the library targeted internal use only (one team, one framework)?

- [ ] A: Nothing — same architecture

- [✓] B: Could use Tailwind — no cross-framework concern

- [ ] C: Must still avoid all dependencies

- [ ] D: Switch to inline styles


**Answer:** B

Internal single-framework library removes cross-compatibility constraint. Tailwind, Vanilla Extract, or styled-components all viable.


### Capstone testing approach includes:

- [ ] A: Unit tests for variant logic only

- [✓] B: VRT for visual regression + a11y audit

- [ ] C: No tests — trust the CSS

- [ ] D: Only TypeScript compilation checks


**Answer:** B

VRT (Playwright/Chromatic) for visual diffs. axe-core for a11y. Unit tests for variant/class merging. Integration tests for responsive behavior.


### What makes the capstone's CSS approach 'RSC-compatible'?

- [ ] A: It uses 'use client' on every component

- [✓] B: CSS Modules are build-time — no JavaScript for styles

- [ ] C: It avoids CSS entirely

- [ ] D: Components are server-only


**Answer:** B

CSS Modules produce static CSS files. No runtime style injection, no hooks, no context. Components can be Server or Client components freely.


### If you needed Vue AND React support for the library, which approach becomes problematic?

- [ ] A: CSS Modules

- [ ] B: CSS custom properties

- [✓] C: cva (class-variance-authority)

- [ ] D: Container queries


**Answer:** C

cva is a JavaScript library — only available in JS/TS projects. CSS Modules and custom properties work universally. Container queries are CSS-native.
