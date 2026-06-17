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
