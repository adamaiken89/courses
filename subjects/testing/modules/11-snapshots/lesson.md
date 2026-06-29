# Module 11: Snapshot Strategy

Est. study time: 1.5h
Language: en
Description: Use snapshots effectively — page layout verification, not component detail. Know when to use, when to delete.

## Learning Objectives
- Use page snapshots for structural regression detection
- Distinguish between snapshot-worthy and snapshot-harmful tests
- Maintain snapshots with intentional updates
- Avoid snapshot anti-patterns

---

## Core Content

### 11.1 When Snapshots Help

Snapshots excel at catching **unexpected structural changes** in stable layouts.

```typescript
// ✅ Good snapshot target — page layout
test('matches snapshot — course page with data', async () => {
  render(<CoursePage courseId="1" />)
  await waitFor(() => {
    expect(screen.getByText('Course 1')).toBeInTheDocument()
  })
  expect(container).toMatchSnapshot()
})
```

What snapshots catch:
- Missing section rendered conditionally (e.g., admin panel only visible to admins)
- Layout shift (header moved inside/outside a wrapper)
- Component accidentally removed during refactor
- Wrong order of elements

What snapshots DON'T replace:
- Behavior tests (user interactions)
- State transition tests
- Accessibility tests

Reader project pattern: page snapshot tests in `<Name>.page.test.tsx` files. Component behavior in `<Name>.component.test.tsx`. Separate concerns.

> **Think**: What makes a good snapshot target compared to a bad one?
>
> *Answer: Good snapshots catch regressions (stable page layout, known structure). Bad snapshots capture dynamic content (dates, random IDs, API response text that changes per test run).*

### 11.2 When Snapshots Hurt

```typescript
// ❌ Bad — component snapshot with dynamic content
test('matches snapshot', () => {
  render(<UserCard user={{ id: crypto.randomUUID(), name: 'Alice', joinedAt: new Date() }} />)
  expect(container).toMatchSnapshot()
})
// Every test run generates new UUID and date → snapshot always fails → auto-update → meaningless

// ❌ Bad — huge snapshot (500+ lines)
test('matches snapshot', () => {
  render(<DataGrid rows={200} />)
  expect(container).toMatchSnapshot()
})
// Any minor change updates 200 rows → diff is noise → incentives to auto-update without review

// ❌ Bad — snapshot-only test (no behavior assertion)
test('renders course list', () => {
  render(<CourseList />)
  expect(container).toMatchSnapshot()
})
// Doesn't verify anything specific. Refactors pass as long as output looks similar.
```

**Snapshot anti-patterns:**
- Snapshot-only tests (no behavior assertions)
- Dynamic content (dates, IDs, random values)
- Large outputs (100+ line snapshots)
- Component-level snapshots that duplicate storybook

> **Think**: What's the maintenance cost of a 300-line snapshot that changes every sprint?
>
> *Answer: Developers auto-accept snapshot updates without reviewing. Real regressions get merged alongside intended changes. The snapshot provides no protection.*

### 11.3 Page Snapshot Pattern (Reader Project Style)

```typescript
// CoursePage.page.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import { setupRPC, mockResponse, clearMocks } from '../test-utils'
import { beforeEach, describe, expect, mock, test } from 'bun:test'

setupRPC()

// Mock leaf layouts only — safe because they're used by this test file only
void mock.module('../layouts/PageLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="page-layout">{children}</div>
  ),
}))

import CoursePage from './CoursePage'

describe('CoursePage', () => {
  beforeEach(() => {
    clearMocks()
  })

  test('matches snapshot — loading state', () => {
    mockResponse('getCourse', new Promise(() => {})) // never resolves
    const { container } = render(<CoursePage courseId="1" />)
    expect(container).toMatchSnapshot()
  })

  test('matches snapshot — data loaded', async () => {
    mockResponse('getCourse', { id: '1', title: 'Course 1', modules: [] })
    const { container } = render(<CoursePage courseId="1" />)
    await waitFor(() => {
      expect(screen.getByText('Course 1')).toBeInTheDocument()
    })
    expect(container).toMatchSnapshot()
  })

  test('matches snapshot — error state', async () => {
    mockResponse('getCourse', null)
    const { container } = render(<CoursePage courseId="1" />)
    await waitFor(() => {
      expect(container.querySelector('[data-testid="error-state"]')).toBeTruthy()
    })
    expect(container).toMatchSnapshot()
  })
})
```

Key patterns:
- Mock API + leaf layouts (safe mock targets)
- Assert data appeared before snapshot (prevent empty snapshot)
- Separate snapshots per state (loading, loaded, error)
- `container` snapshot (includes wrapper mock divs)

> **Think**: Why use data-testid on mock layouts?
>
> *Answer: Allows waitFor assertion without relying on mock content. You're asserting the layout mock rendered, not testing the mock itself. This is a structural check, not a behavior test.*

### 11.4 Inline vs External Snapshots

vitest supports two modes:

**Inline snapshots** (in test file):
```typescript
expect(container).toMatchInlineSnapshot()
// After first run, vitest inserts:
expect(container).toMatchInlineSnapshot(`
  <div>
    <h1>Course 1</h1>
  </div>
`)
```

**External snapshots** (in `__snapshots__/` directory):
```typescript
expect(container).toMatchSnapshot()
// Creates: __snapshots__/CoursePage.page.test.tsx.snap
```

| Aspect | Inline | External |
|---|---|---|
| Visibility | Visible in test file | Hidden in __snapshots__/ |
| Review in PR | Yes — shows in diff | Yes — shows in diff |
| Update | Press `u` key | Press `u` key |
| Noise in test file | Increases line count | Kept separate |
| Best for | Small, focused snapshots | Page-level, medium snapshots |

Reader project uses external snapshots (page snapshots are too large for inline).

> **Think**: When would you choose inline over external snapshots?
>
> *Answer: For very small snapshots (5-10 lines) where seeing the expected output near the assertion improves readability. For page layouts (50+ lines), external keeps the test file focused.*

### 11.5 Snapshot Update Discipline

```bash
# Update all snapshots
npx vitest --update

# Update specific file snapshots
npx vitest run CoursePage.page.test.tsx --update
```

**When to update snapshots:**
- Intentional UI change (new section, different layout)
- Component refactor that preserves behavior

**When NOT to update:**
- Before reviewing the diff — always inspect the snapshot diff first
- When snapshot changed unexpectedly (may be a real regression)
- Without understanding what changed

**Snapshot diff reveals:**
```
- <h1>Old Course Title</h1>
+ <h1>New Course Title</h1>
  → Intentional: title changed
  → Bug: wrong course loaded (should catch this)
```

### 11.6 Snapshot + Behavior Balance

A snapshot test should always have at least one behavior assertion before it.

```typescript
// ✅ Correct — behavior assertion + snapshot
test('renders course page with data', async () => {
  render(<CoursePage courseId="1" />)
  await screen.findByText('Course 1') // behavior assertion — data loaded
  expect(container).toMatchSnapshot() // structural check
})

// ❌ Wrong — snapshot only
test('renders course page', () => {
  const { container } = render(<CoursePage courseId="1" />)
  expect(container).toMatchSnapshot()
  // Snapshot could be empty loading state — no behavior verified
})
```

---

## Why This Matters

Snapshots are the most misused testing feature. Used correctly (page-level, after behavior assertion), they catch regressions cheaply. Used incorrectly (component-level, snapshot-only), they create noise and false confidence.

---

## Common Questions

**Q: Should I delete old snapshots?**
A: Yes. When a snapshot becomes noise (frequently changes, large, always auto-updated), delete it. The behavior test remains.

**Q: How do I handle dynamic content in snapshots?**
A: Mock dynamic values (dates, IDs) to deterministic values in test setup. Use factories that override defaults.

**Q: Can I use snapshots for visual regression?**
A: DOM snapshots catch structural changes, not visual ones. For visual regression, use storybook + chromatic or Playwright screenshot tests.

---

## Key Takeaways

- Use page-level snapshots for structural regression detection
- Always pair snapshots with behavior assertions (assert data appeared first)
- Separate snapshots per state (loading, loaded, error)
- Avoid snapshot-only tests, dynamic content snapshots, and large snapshots
- External snapshots for page layouts, inline for small focused output
- Review snapshot diffs carefully — never auto-update without understanding

---

## Common Misconception

**"Snapshots replace behavior tests — if the snapshot matches, the component works."**

Snapshots verify structure (layout, element order). They don't verify behavior (click handler works, correct data shown in all states, error messages display). Always pair snapshots with behavior assertions.

---

## Feynman Explain

(Explain when you'd use a snapshot vs when you'd use a behavior assertion. Give a real example of how a snapshot caught a bug that behavior tests missed, and an example where snapshot-only tests created noise.)

---

## Drill

Run: `learn.sh quiz testing 11`
