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
