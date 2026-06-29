# Module 3: Test Boundaries — Unit vs Integration

Est. study time: 1.5h
Language: en
Description: Decide what to unit-test vs integration-test using dependency tiers and mock cost heuristic.

## Learning Objectives
- Place code on the test spectrum (pure function → store → hook → component → page → E2E)
- Apply the decision tree to determine test nature
- Calculate mock cost using dependency tier heuristic
- Recognize Tier 3 code that needs refactoring

---

## Core Content

### 3.1 The Test Spectrum

Tests exist on a spectrum, not binary unit/integration:

```
Pure fn ── Store ── Hook ── Component ── Page ── E2E
  │         │         │          │          │      │
Zero      API       RPC+     store+API   snap+   Play-
mocks     mock      store    mock-heavy  API     wright
Fastest   Medium    Medium   Slower      Fast    Slowest
```

**Goal:** push tests **left** where possible. Each step right adds:
- More setup code
- More mock maintenance
- More runtime (except snapshots)
- More fragility (tests breaking from unrelated changes)

The reader project SKILL.md defines this with Dependency Tiers:

| Tier | Description | Mock Cost | Examples |
|---|---|---|---|
| 1 | Pure state, no API | Zero mocks | viewStore, useSelection, pure utils |
| 2 | API only, no cross-store | Mock RPC methods | bookmarksStore, useQuizEngine |
| 3 | API + cross-store | Mock RPC + cross-store state | courseStore (completionStore cascade) |

> **Think**: Why is "push left" good advice but dangerous as a hard rule?
>
> *Answer: Over-zealous pushing left leads to testing implementation instead of behavior. Example: testing that `store.setState({ loading: true })` was called (implementation) instead of testing that a loading spinner appears in DOM (behavior). Use leftward push for business logic, not for component internals.*

### 3.2 Decision Tree

```
Code needs a test?
│
├─ Pure logic (format, parse, sort, validate, math)
│  └→ UNIT. Zero mocks. test.each for input matrix.
│
├─ Zustand store action
│  ├─ Calls API? → UNIT. Mock API (MSW). Test state transitions.
│  └─ Pure state only → UNIT. Zero mocks. setState + assert.
│
├─ Custom hook
│  ├─ Single store, no cross-deps? → UNIT. renderHook. Mock API only.
│  └─ 3+ store dependencies?
│     └→ REFACTOR FIRST (Module 6-7). Then UNIT extracted pieces.
│
├─ Component
│  ├─ Receives props, renders content → INTEGRATION. Minimal mocks.
│  ├─ Has user interaction → INTEGRATION. userEvent. Test behavior.
│  └─ Page-level (layout + data flow)
│     ├─ Structural → PAGE SNAPSHOT. Mock API + leaf layouts.
│     └─ User flow → INTEGRATION. Full context.
│
└─ Cross-page flow (login → dashboard → settings)
   └→ E2E. Playwright or Cypress. 5-10 critical flows max.
```

**Think**: Where does "snapshot test" fit in this tree?

*Answer: At two leaves: (1) page snapshot for structural verification (low mock cost, catches layout regressions), (2) optional component snapshot for complex UI alongside behavior tests. Never snapshot-only a component — behavior tests are primary.*

### 3.3 Unit Test Anatomy — Tier 1

Pure functions and store actions. Zero mocks. Factory helpers for test data.

```typescript
// srs.ts → srs.test.ts — Tier 1, zero mocks
describe('getDueCards', () => {
  describe('given deck with mixed cards', () => {
    it('returns due cards sorted by priority (starred first)', () => {
      const deck = makeDeck([
        makeCard({ id: 'a', nextReviewDate: yesterday, isStarred: false }),
        makeCard({ id: 'b', nextReviewDate: tomorrow, isStarred: false }),
        makeCard({ id: 'c', nextReviewDate: yesterday, isStarred: true }),
      ])
      const result = getDueCards(deck)
      expect(result).toEqual([deck.cards.c, deck.cards.a])
    })
  })

  describe('given empty deck', () => {
    it('returns empty array', () => {
      expect(getDueCards(makeDeck([]))).toEqual([])
    })
  })

  describe('given all cards future-dated', () => {
    it('returns empty array', () => {
      const deck = makeDeck([
        makeCard({ id: 'a', nextReviewDate: tomorrow }),
      ])
      expect(getDueCards(deck)).toEqual([])
    })
  })
})
```

Pattern: `describe(unit) → describe(situation) → it(expectation)`. One behavior per `it`. Factory helpers for data. `test.each` for edge case matrix.

> **Think**: What's the difference between "one behavior per `it`" and "one assertion per `it`"?
>
> *Answer: One behavior = multiple assertions are fine when verifying same outcome (e.g., checking `title`, `author`, `year` all in one `toEqual`). One assertion per `it` would mean 3 tests for the same function call — noise. Group assertions that verify the same behavior.*

### 3.4 Integration Test Anatomy — Tier 2

Component tests with real store, real component, mocked API only.

```typescript
// CourseList.component.test.tsx — Tier 2, mock API only
describe('CourseList', () => {
  beforeEach(() => {
    useCourseStore.setState(buildCourseState())
    server.resetHandlers()
  })

  test('loads and displays courses', async () => {
    server.use(
      http.get('/api/courses', () =>
        HttpResponse.json([
          { id: '1', title: 'React Testing' },
          { id: '2', title: 'Advanced Patterns' },
        ])
      )
    )

    render(<CourseList />)
    await waitFor(() => {
      expect(screen.getByText('React Testing')).toBeInTheDocument()
    })
    expect(screen.getByText('Advanced Patterns')).toBeInTheDocument()
  })

  test('shows error on failure', async () => {
    server.use(
      http.get('/api/courses', () =>
        HttpResponse.json({ error: 'Server Error' }, { status: 500 })
      )
    )

    render(<CourseList />)
    await waitFor(() => {
      expect(screen.getByText(/failed/i)).toBeInTheDocument()
    })
  })
})
```

Integration test mocks: API only. Everything else real (store, hooks, components, routing). This catches real bugs: type mismatches between API response and store, wrong state paths, missing error handling.

> **Think**: If you mock the API but the real store + component code is used, what bugs can you catch that unit tests can't?
>
> *Answer: Type mismatches between API response shape and store consumption (API returns `{id: string}` but store expects `{id: number}`), missing `.ok` checks in fetch, incorrect error state paths, store actions not dispatching on API success, UI rendering wrong field from store store.*

### 3.5 The Mock Cost Heuristic

```
Mock Cost = (number of mocked modules) + (pollution risk score)

Tier 1:  0 mocks,  0 pollution     → unit test, no hesitation
Tier 2:  1-2 mocks, 0 pollution    → unit or integration, your choice
Tier 3:  3+ mocks, high pollution  → REFACTOR. Do not test this shape.
```

Reader project SKILL.md: "Tip: Prefer testing Tier 1-2 code. Tier 3 code should be split."

**Concrete Tier 3 signal:** The setup block is longer than the test block. If you're writing 15 lines of `mock.module()`, `store.setState()`, and `server.use()` to prepare for 5 lines of assertions, your component is Tier 3.

```typescript
// ☠ Tier 3 — setup longer than assertions
test('loads course', async () => {
  // 10 lines of setup...
  useAuthStore.setState({ user: { id: '1' } })
  useSettingsStore.setState({ locale: 'en' })
  useCourseStore.setState({ loaded: false })
  server.use(http.get('/api/courses/:id', () => HttpResponse.json({ /* ... */ })))

  // 3 lines of test
  render(<CoursePage courseId="1" />)
  await waitFor(() => expect(screen.getByText('Course Title')).toBeInTheDocument())
})
```

The fix: extract the course loading logic from the page. Test the extracted function (Tier 1/2). Then test the page with the extracted module already populated (Tier 2).

> **Think**: What's the concrete signal that a component has crossed into Tier 3?
>
> *Answer: Setup is longer than assertions. Multiple `store.setState()` calls + `server.use()` + mock.module — all just to render a component. The ratio of mock code to test code exceeds 2:1.*

### 3.6 When E2E Is Necessary

Even with MSW + testing-library, some things only E2E catches:
- Real browser APIs (localStorage, clipboard, focus management)
- Cross-page navigation (React Router state persistence)
- Third-party script interactions
- Actual pixel rendering (testing-library doesn't render CSS)

Cost ratio: E2E tests are typically 10-100x slower, 5-10x more setup, and inherently flakier.

Use E2E sparingly:
- 5-10 critical user flows
- Auth flows (login → redirect)
- Payment flows
- Cross-page workflows

```typescript
// Playwright — E2E for critical flows
test('complete learning flow', async ({ page }) => {
  await page.goto('/')
  await page.click('text=Course 1')
  await page.waitForURL('**/course/1')
  await page.click('text=Start Lesson')
  await expect(page.locator('text=Question 1')).toBeVisible()
})
```

> **Think**: What's the cost ratio of E2E vs unit tests?
>
> *Answer: 10-100x slower execution, 5-10x more test code, 3-5x more CI minutes, and 2-3x more flakiness. The testing pyramid exists for good reason: many fast unit tests, moderate integration tests, few E2E tests.*

---

## Why This Matters

The biggest waste in testing is testing the wrong thing at the wrong level. Unit-testing a page component (too slow, too fragile) or integration-testing a pure function (too much setup for no benefit) both waste time. The decision tree saves you from this by matching test nature to code nature.

---

## Common Questions

**Q: Can a file have both unit and integration tests?**
A: Yes. The reader project uses naming convention: `<Name>.test.ts` (unit), `<Name>.component.test.tsx` (integration), `<Name>.page.test.tsx` (snapshot). Different natures live in different files.

**Q: What if I'm not sure which tier my code is?**
A: Count the mocks you need. 0 = Tier 1. 1-2 and no shared module mocks = Tier 2. 3+ or any mock.module = Tier 3.

**Q: Should I test internal helper functions used by a component?**
A: No. Test the component's public behavior. If the helper is complex enough to need its own tests, extract it to a separate file and test it as Tier 1.

---

## Examples

### Example 1: Moving a Tier 3 test to Tier 1+2

Before (Tier 3):
```typescript
test('formats date for display', () => {
  // Mock 3 stores and API to render a component that just calls formatDate
  // ... 15 lines setup
  // 1 line assertion
  expect(screen.getByText('Jan 15, 2024')).toBeInTheDocument()
})
```

After (Tier 1):
```typescript
describe('formatDate', () => {
  it('formats ISO string to friendly display', () => {
    expect(formatDate('2024-01-15')).toBe('Jan 15, 2024')
  })
  it('handles null input', () => {
    expect(formatDate(null)).toBe('')
  })
})
```

### Example 2: Decision Tree in Practice

```typescript
// courseStore.ts — has API call, no cross-store deps → Tier 2 → store test
// useCourseProgress.ts — reads courseStore + completionStore → Tier 3 → refactor first
// CourseList.tsx — reads courseStore, renders list → Tier 2 → component test
// CoursePage.tsx — reads 3 stores, API, routing → Tier 3 → refactor page
```

---

## Key Takeaways

- Test spectrum: pure fn → store → hook → component → page → E2E. Push left.
- Decision tree: match test nature to code nature. Zero mocks = unit. API mock only = integration.
- Mock cost heuristic: Tier 1 (0 mocks), Tier 2 (1-2 mocks, safe), Tier 3 (3+ mocks, refactor first)
- Setup > test assertions = Tier 3 signal. Refactor before testing.
- E2E for 5-10 critical flowese. Everything else with unit/integration.
- Naming convention: `.test.ts` (unit), `.component.test.tsx` (integration), `.page.test.tsx` (snapshot)

---

## Common Misconception

**"Integration tests are always better because they test real code paths."**

Integration tests verify component connections but are slower, more complex, and more fragile. Pure functions and store actions have no "integration" to test — they work the same in isolation. Unit testing them is faster and more precise. Integration tests add value at the component/page level where multiple units connect.

---

## Feynman Explain

(Given a zustand store that: (1) calls API, (2) updates local state, (3) another store reads that state — walk through the decision tree. What gets unit-tested? What needs integration? Where would you refactor?)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain testing 3` — AI will probe your explanation for gaps.*

---

## Reframe

(Pause. Judge: is the Tier system always correct? When would it make sense to integration-test a pure function? When would you unit-test a page? Write your evaluation.)

---

## Drill

Take the quiz. MCQs test different angles — recall, application, scenario.

Run: `learn.sh quiz testing 3`
