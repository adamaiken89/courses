# Module 6: Refactoring for Testability — Extract Pure Logic

Est. study time: 2h
Language: en
Description: Identify testable units in React code by extracting pure business logic from components and stores.

## Learning Objectives
- Identify pure logic hidden inside components and effects
- Extract utility functions into testable Tier 1 units
- Apply extract-parameter pattern to break hard dependencies
- Recognize when extraction is worth the overhead vs when it's not

---

## Core Content

### 6.1 What Makes Code Hard to Test?

Hard-to-test code has these characteristics:

```
Component / Hook / Store
  │
  ├── Business logic mixed with:
  │   ├── State subscription (useStore, useState)
  │   ├── Side effects (fetch, localStorage, timers)
  │   ├── DOM queries (getElementById, refs)
  │   └── Routing (useNavigate, useParams)
  │
  └── Result: must mock everything to test anything
```

This is Tier 3 — the mock setup cost exceeds the test value.

**Tier 3 signal checklist:**
- Function uses both `useStore` and `fetch`
- Function reads from multiple stores
- A pure calculation sits inside a useEffect
- Component contains inline data transformation
- Same calculation is duplicated across files

> **Think**: Why does mixing business logic with React hooks make testing hard?
>
> *Answer: Testing the logic requires rendering the component, which requires mocking stores, API, routing, and layout. If the logic were a pure function, you'd call it directly with input → assert output.*

### 6.2 The Extract Pattern

Move business logic out of components/stores into pure functions. Test the pure function (Tier 1). The component becomes a thin wrapper.

```typescript
// ❌ Before — logic mixed in component
function CourseList() {
  const courses = useCourseStore((s) => s.courses)
  const filter = useCourseStore((s) => s.filter)

  const filtered = courses
    .filter((c) => filter === 'all' || c.status === filter)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  return <List items={filtered} />
}

// ✅ After — logic extracted
export function filterAndSortCourses(
  courses: Course[],
  filter: string
): Course[] {
  return courses
    .filter((c) => filter === 'all' || c.status === filter)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
}

function CourseList() {
  const courses = useCourseStore((s) => s.courses)
  const filter = useCourseStore((s) => s.filter)
  const filtered = filterAndSortCourses(courses, filter)

  return <List items={filtered} />
}
```

Now `filterAndSortCourses` is Tier 1 — test it directly:

```typescript
// filterAndSortCourses.test.ts — Tier 1, zero mocks
describe('filterAndSortCourses', () => {
  const courses = [
    { id: '1', status: 'published', updatedAt: new Date('2024-03-01') },
    { id: '2', status: 'draft', updatedAt: new Date('2024-01-01') },
    { id: '3', status: 'published', updatedAt: new Date('2024-02-01') },
  ]

  it('filters by status', () => {
    expect(filterAndSortCourses(courses, 'draft')).toHaveLength(1)
  })

  it('shows all when filter is "all"', () => {
    expect(filterAndSortCourses(courses, 'all')).toHaveLength(3)
  })

  it('sorts by updatedAt descending', () => {
    const result = filterAndSortCourses(courses, 'all')
    expect(result[0].id).toBe('1') // March
    expect(result[1].id).toBe('3') // February
    expect(result[2].id).toBe('2') // January
  })

  it('handles empty list', () => {
    expect(filterAndSortCourses([], 'all')).toEqual([])
  })
})
```

**Cost/benefit:** This extraction took 5 minutes. Now: faster tests, no mocks, full input coverage, and the component is simpler.

> **Think**: When is this extraction NOT worth it?
>
> *Answer: When the logic is trivial (single line, no branching) and unlikely to change. E.g., `items.map(i => i.name)` doesn't need extraction. When it's complex or duplicated, extract.*

### 6.3 Extraction Targets — Where Logic Hides

**Target 1: useEffect with data transformation**

```typescript
// ❌ Logic in effect
useEffect(() => {
  const result = data.map(transform).filter(onlyValid)
  setProcessed(result)
}, [data])

// ✅ Extract transform pipeline
function processData(data: RawData[]): ProcessedData[] {
  return data.map(transform).filter(onlyValid)
}
```

**Target 2: Store actions with conditional logic**

```typescript
// ❌ Logic in store action
loadCourses: async () => {
  const res = await fetch('/api/courses')
  const data = await res.json()
  const valid = data.filter(c => c.status !== 'archived')
  const sorted = valid.sort((a, b) => a.order - b.order)
  set({ courses: sorted })
}

// ✅ Extract filtering/sorting
function prepareCourses(data: RawCourse[]): Course[] {
  return data.filter(c => c.status !== 'archived')
    .sort((a, b) => a.order - b.order)
}

loadCourses: async () => {
  const res = await fetch('/api/courses')
  const data = await res.json()
  set({ courses: prepareCourses(data) })
}
```

**Target 3: Complex validators**

```typescript
// ❌ Inline in form component
const errors = {}
if (!values.email.includes('@')) errors.email = 'Invalid email'
if (values.password.length < 8) errors.password = 'Too short'

// ✅ Extract validator
function validateSignup(values: SignupForm): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!values.email.includes('@')) errors.email = 'Invalid email'
  if (values.password.length < 8) errors.password = 'Too short'
  return errors
}
```

> **Think**: What's the common characteristic of all three extraction targets?
>
> *Answer: They all take input and produce output with no side effects. Pure data transformation. If it can be expressed as `result = fn(input)`, it can be extracted and tested as Tier 1.*

### 6.4 Extract-Parameter Pattern

When a function needs an external dependency (API, localStorage, Date.now), pass it as a parameter instead of importing directly.

```typescript
// ❌ Hard to test — uses global directly
function getDaysUntilReview(nextReviewDate: string): number {
  const now = new Date() // Non-deterministic!
  const review = new Date(nextReviewDate)
  return Math.ceil((review.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

// ✅ Testable — inject the time
function getDaysUntilReview(
  nextReviewDate: string,
  now: Date = new Date() // Default for production, inject for tests
): number {
  const review = new Date(nextReviewDate)
  return Math.ceil((review.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

// test
it('returns positive days for future date', () => {
  const result = getDaysUntilReview('2024-12-01', new Date('2024-11-01'))
  expect(result).toBe(30)
})
```

The reader project SKILL.md calls this out: "Don't test Date.now(), Math.random(), or crypto.randomUUID() directly — tests will be flaky. Refactor to inject the non-deterministic value as a parameter."

> **Think**: What other globals should be injected as parameters instead of imported?
>
> *Answer: localStorage, fetch, Math.random, crypto.randomUUID, window.location, performance.now. Anything non-deterministic or that changes between test environments.*

### 6.5 When Not to Extract

Extraction has cost: new files, new imports, more indirection. Don't extract when:

1. **Logic is trivial and stable** — single line, no branches, no changes expected
2. **Extraction creates complexity** — extracting just to test adds more code than it saves
3. **Logic is framework-specific** — JSX rendering logic belongs in components
4. **Extraction reduces readability** — a clear inline calculation is better than a hunt across files

```typescript
// ❌ Don't extract this:
const fullName = `${user.firstName} ${user.lastName}`

// ✅ Extract this:
function calculateSM2Interval(repetitions: number, easeFactor: number): number {
  if (repetitions === 0) return 1
  if (repetitions === 1) return 6
  return Math.round((repetitions - 1) * easeFactor)
}
```

Rule of thumb: if the function can be named and has at least 3-5 lines of logic, extract it.

---

## Why This Matters

Extracting pure logic is the highest-leverage testing improvement. Each extraction moves code from Tier 3 (slow, fragile, high mock cost) to Tier 1 (fast, stable, zero mocks). The component gets simpler too.

---

## Common Questions

**Q: Where do extracted functions live?**
A: Near the component that uses them. If shared across components, move to `src/utils/` or `src/lib/`.

**Q: Do I create a test file per extracted function?**
A: Yes. `utils.ts` → `utils.test.ts`. One `describe` per exported function.

**Q: Can I extract from a store action?**
A: Yes. Store actions are function bodies — extract pure logic into helper functions called by the action.

---

## Key Takeaways

- Extract business logic from components/stores into pure functions
- Pass non-deterministic values (Date.now, fetch) as parameters
- Test extracted functions as Tier 1 — zero mocks
- Extract when logic is 3+ lines, complex, or duplicated
- Don't extract trivial one-liners or framework-specific code

---

## Common Misconception

**"All logic should be extracted from components. Components should be dumb."**

Components own rendering logic (JSX, layout, event handlers). Extract data transformation and business rules. Don't extract conditional JSX — test that with integration tests.

---

## Feynman Explain

(Given a component that filters, sorts, and formats course data before display — walk through the extraction. Which parts become pure functions? What parameters do they take? How do you test them?)

---

## Drill

Run: `learn.sh quiz testing 6`
