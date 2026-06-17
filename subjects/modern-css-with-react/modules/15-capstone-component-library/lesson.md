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
