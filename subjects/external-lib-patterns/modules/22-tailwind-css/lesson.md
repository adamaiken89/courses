# Module 22: CSS Frameworks — Tailwind CSS

Est. study time: 2h
Language: en

## Learning Objectives
- Understand Tailwind utility-first architecture vs CSS-in-JS
- Use cn() helper (clsx + twMerge) for class composition
- Implement component patterns with className prop
- Map design tokens with CSS variables + tailwind.config
- Understand React 19 Compiler compatibility with Tailwind
- Apply responsive variants and dark mode strategy
- Integrate Tailwind with Radix UI components
---

## Core Content

### Utility-First Architecture

Tailwind provides low-level utility classes instead of pre-built components:

```html
<!-- Traditional CSS approach -->
<div class="card">
  <h2 class="card-title">Hello</h2>
  <p class="card-body">World</p>
</div>

<!-- Tailwind utility approach -->
<div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
  <h2 className="text-lg font-semibold text-gray-900">Hello</h2>
  <p className="text-sm text-gray-600">World</p>
</div>
```

Utility-first reduces CSS bundle size (only used utilities are generated), eliminates naming collisions, and keeps styles co-located with markup.

CSS-in-JS (styled-components, Emotion) generates styles at runtime or build time via JS. Tailwind generates CSS at build time via PostCSS — no runtime overhead.

### cn() Helper: clsx + twMerge

`clsx` merges class names conditionally. `twMerge` resolves Tailwind specificity conflicts:

```typescript
// lib/utils.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

Usage:

```typescript
cn('px-4 py-2 rounded', isPrimary && 'bg-blue-600 text-white', isLarge && 'px-6 py-3 text-lg')
// Result: 'px-6 py-3 rounded text-lg bg-blue-600 text-white'
// twMerge resolves px-4 vs px-6 conflict
```

### Component Patterns with className Prop

Accept `className` prop and merge with internal styles:

```typescript
// ui/button.tsx
import { forwardRef } from 'react'
import { cn } from '../lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

const variantStyles = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
  ghost: 'bg-transparent text-gray-600 hover:bg-gray-100',
}

const sizeStyles = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'
```

Consumers can override without breaking internal styles:

```tsx
<Button className="w-full md:w-auto">Submit</Button>
```

### Design Token Mapping

Use CSS variables for design tokens, reference in tailwind.config:

```css
/* styles/tokens.css */
:root {
  --color-primary: #2563eb;
  --color-primary-hover: #1d4ed8;
  --color-surface: #ffffff;
  --color-surface-secondary: #f8fafc;
  --spacing-grid: 1rem;
  --radius-default: 0.5rem;
  --shadow-card: 0 1px 3px 0 rgb(0 0 0 / 0.1);
}
```

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
        },
        surface: {
          DEFAULT: 'var(--color-surface)',
          secondary: 'var(--color-surface-secondary)',
        },
      },
      spacing: {
        grid: 'var(--spacing-grid)',
      },
      borderRadius: {
        DEFAULT: 'var(--radius-default)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
      },
    },
  },
  plugins: [],
}

export default config
```

### React 19 Compiler Compatibility

React 19 Compiler (React Forget) memoizes components automatically. Tailwind has zero runtime CSS-in-JS — all styles are static class names. This makes Tailwind fully compiler-compatible with no migration effort.

CSS-in-JS libraries that use dynamic style injection face challenges with the compiler:

```typescript
// styled-components: runtime style injection — compiler can't optimize
const StyledButton = styled.button`
  background: ${props => props.$primary ? 'blue' : 'gray'};
`

// Tailwind: static classes — compiler-friendly
<button className={cn('bg-blue-600', isPrimary && 'bg-blue-600')}>
```

### Responsive Variants

Tailwind uses breakpoint prefixes: `sm:`, `md:`, `lg:`, `xl:`, `2xl:`:

```tsx
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
  {items.map(item => (
    <Card
      key={item.id}
      className="p-4 sm:p-6 lg:p-8"
    />
  ))}
</div>
```

Custom breakpoints in config:

```typescript
theme: {
  extend: {
    screens: {
      tablet: '768px',
      desktop: '1024px',
    },
  },
}
```

### Dark Mode Strategy

Configure dark mode variant:

```typescript
// tailwind.config.ts
const config: Config = {
  darkMode: 'class', // or 'media' for system preference
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: 'var(--color-background)',
        },
      },
    },
  },
}
```

Usage:

```tsx
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
  <h1 className="text-gray-900 dark:text-white">Title</h1>
  <p className="text-gray-600 dark:text-gray-400">Description</p>
</div>
```

Toggle strategy:

```typescript
function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false
    return document.documentElement.classList.contains('dark')
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])

  return [isDark, setIsDark] as const
}
```

### Integration with Radix UI

Radix provides headless UI primitives. Tailwind provides styles. Composition pattern:

```tsx
import * as Dialog from '@radix-ui/react-dialog'
import { cn } from '../lib/utils'

export function Modal({ open, onOpenChange, title, children }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out" />
        <Dialog.Content className={cn(
          'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg',
          'data-[state=open]:animate-in data-[state=closed]:animate-out'
        )}>
          <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

Radix provides `data-state` attributes for styling. Tailwind's `data-*` variant handles transitions.

---

### Why This Matters

Tailwind dominates the CSS framework landscape. Its utility-first approach eliminates CSS maintenance burden, enforces design system consistency, and pairs naturally with React 19 Compiler. Integration pattern with cn() and className prop is the standard for React component libraries in 2026.

---

### Common Questions

**Q: When should I extract repeated utility patterns into a component vs keep inline?**

A: Extract when the same pattern appears 3+ times. Use component composition (className prop) instead of hardcoding class strings in consumers.

**Q: Does Tailwind work with React 19 Server Components?**

A: Yes. Tailwind generates static CSS at build time. Server Components render class names to HTML. No runtime dependency needed.

---

## Examples

### Example 1: Card Component with Composition

```typescript
// ui/card.tsx
import { cn } from '../lib/utils'

interface CardProps {
  className?: string
  children: React.ReactNode
}

export function Card({ className, children }: CardProps) {
  return (
    <div className={cn(
      'rounded-xl border border-gray-200 bg-white shadow-sm',
      className
    )}>
      {children}
    </div>
  )
}

export function CardHeader({ className, children }: CardProps) {
  return (
    <div className={cn('border-b border-gray-100 px-6 py-4', className)}>
      {children}
    </div>
  )
}

export function CardContent({ className, children }: CardProps) {
  return (
    <div className={cn('px-6 py-4', className)}>
      {children}
    </div>
  )
}
```

Usage:

```tsx
<Card className="max-w-md">
  <CardHeader>
    <h2 className="text-xl font-semibold">Analytics</h2>
  </CardHeader>
  <CardContent>
    <p className="text-gray-600">Dashboard content here</p>
  </CardContent>
</Card>
```

### Example 2: Responsive Data Grid with Tailwind

```tsx
function ResponsiveGrid({ items }: { items: Item[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {items.map(item => (
        <div
          key={item.id}
          className="rounded-lg border p-3 text-center transition-shadow hover:shadow-md"
        >
          <span className="block text-sm font-medium truncate">{item.name}</span>
          <span className="text-xs text-gray-500">{item.category}</span>
        </div>
      ))}
    </div>
  )
}
```

### Example 3: Design Token Plugin

```typescript
// tailwind.config.ts
import plugin from 'tailwindcss/plugin'

const designTokenPlugin = plugin(({ addBase, theme }) => {
  addBase({
    ':root': {
      '--color-primary': theme('colors.blue.600'),
      '--color-surface': theme('colors.white'),
      '--color-text': theme('colors.gray.900'),
      '--shadow-card': theme('boxShadow.DEFAULT'),
    },
  })
})

const config: Config = {
  plugins: [designTokenPlugin],
}
export default config
```

---

## Key Takeaways
- Utility-first eliminates naming collisions and reduces CSS bundle size
- cn() helper (clsx + twMerge) handles conditional classes and conflict resolution
- Accept className prop on all components for consumer customization
- CSS variables in tailwind.config bridge design tokens to utility classes
- Tailwind has zero runtime cost, making it fully compatible with React 19 Compiler

## Common Misconception

"**Utility classes make HTML messy and unmaintainable.**"

Extraction into components with className prop patterns keeps consumers clean. The component is the abstraction; utilities are the implementation detail.

## Feynman Explain

Tailwind gives you Lego bricks (utility classes) instead of pre-built houses (Bootstrap components). You build components by composing bricks, then reuse those components across your app. The cn() helper prevents brick conflicts. className prop lets consumers customize without breaking internal structure.

## Reframe

CSS maintenance cost grows quadratically with team size. Tailwind eliminates the mental overhead of naming things, cascade debugging, and specificity wars. Every class name is a single-purpose constraint that composes predictably.

## Drill
Take the quiz. Run: `learn.sh quiz external-lib-patterns 22-tailwind-css`
