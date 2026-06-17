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
