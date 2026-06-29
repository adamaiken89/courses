# Module 1: Mock Strategies for Zustand

Est. study time: 2.5h
Language: en
Description: Mock zustand stores without mock.module pollution. Use store.setState as DI mechanism.

## Learning Objectives
- Explain why mock.module is dangerous for shared modules
- Reset zustand store state via store.setState in beforeEach
- Build factory functions for store state defaults
- Test store actions that call APIs via mock layer (not mock.module)
- Handle persist middleware in tests

---

## Core Content

### 1.1 The Pollution Problem

Bun and vitest `mock.module()` is process-global and irrevocable. Once applied, every subsequent test file in the same process sees the mock. There is no cleanup mechanism.

This differs from `jest.mock()` which gets hoisted and auto-unmocked between files with `resetModules`. The reader project learned this the hard way: `mock.module('../api')` in one test file silently broke every other file importing the API module.

Rule from reader project SKILL.md: **Never `mock.module` shared modules.** Modules imported by multiple test files (stores, api layer, hooks) must NOT be mocked via `mock.module`.

> **Think**: Why is `mock.module` worse than `jest.mock()` for shared modules?
>
> *Answer: `jest.mock()` provides hoisting and `resetModules` for isolation. Bun/vitest `mock.module()` has no cleanup mechanism. The mock persists across test files in the same process, causing cascading failures when test execution order changes.*

### 1.2 store.setState() as Reset Mechanism

Zustand stores expose `setState()` as public API. This is the correct mechanism to reset store state in tests.

```typescript
import { useCourseStore } from './courseStore'
import { beforeEach, describe, expect, test } from 'vitest'

const defaults = {
  courses: [],
  loading: false,
  error: null,
  loaded: false,
}

beforeEach(() => {
  useCourseStore.setState(defaults)
})
```

Why this works: zustand stores are singletons. `setState()` merges the provided object into current state. Calling it with defaults resets state without touching module resolution.

This avoids `mock.module` entirely for store mocking.

```typescript
test('starts with empty courses', () => {
  expect(useCourseStore.getState().courses).toEqual([])
})

test('loading state is false by default', () => {
  expect(useCourseStore.getState().loading).toBe(false)
})
```

> **Think**: What happens if `beforeEach` resets but a test forgets to set some state?
>
> *Answer: The missing state falls back to default values from `beforeEach`. This is safe — the test gets a clean slate. Bug appears only if you forget both `beforeEach` defaults AND the test doesn't set required state. Using a factory function (next section) prevents this.*

### 1.3 Factory Function Pattern

Instead of raw object in `beforeEach`, use a factory function. This centralizes defaults and makes overrides explicit.

```typescript
function buildCourseState(overrides: Partial<CourseStoreState> = {}): CourseStoreState {
  return {
    courses: [],
    loading: false,
    error: null,
    loaded: false,
    currentCourseId: null,
    ...overrides,
  }
}

beforeEach(() => {
  useCourseStore.setState(buildCourseState())
})

test('renders loading state', () => {
  useCourseStore.setState(buildCourseState({ loading: true }))
  render(<CourseList />)
  expect(screen.getByText('Loading...')).toBeInTheDocument()
})

test('renders error state', () => {
  useCourseStore.setState(buildCourseState({ error: 'Failed to load' }))
  render(<CourseList />)
  expect(screen.getByText('Failed to load')).toBeInTheDocument()
})
```

Benefits:
- TypeScript catches typos in overrides
- Adding a new store field auto-propagates defaults to all tests
- Each test explicitly shows which state differs from defaults
- No shared mutable state between tests

> **Think**: Why factory over plain object spread in each test?
>
> *Answer: Factory centralizes defaults. Adding a new store field like `lastSync: null` auto-propagates to all tests. Plain object spread per test drifts — some tests get old defaults, some get new, causing inconsistent failures that are hard to debug.*

### 1.4 Testing Store Actions with API Calls

Stores often call API via some client. The correct approach: mock the API layer (not the store) and test store state transitions.

```typescript
// courseStore.ts
export const useCourseStore = create<CourseStore>()((set, get) => ({
  courses: [],
  loading: false,
  error: null,
  loaded: false,

  loadCourses: async () => {
    set({ loading: true, error: null })
    try {
      const res = await fetch('/api/courses')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const courses = await res.json()
      set({ courses, loading: false, loaded: true })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },
}))

// courseStore.test.ts
import { http, HttpResponse } from 'msw'
import { server } from '../mocks/server'

beforeEach(() => {
  useCourseStore.setState(buildCourseState())
})

test('loadCourses fetches and sets state on success', async () => {
  server.use(
    http.get('/api/courses', () =>
      HttpResponse.json([{ id: '1', title: 'Test' }])
    )
  )

  await useCourseStore.getState().loadCourses()
  await flushMicrotasks()

  const state = useCourseStore.getState()
  expect(state.courses).toHaveLength(1)
  expect(state.courses[0].title).toBe('Test')
  expect(state.loading).toBe(false)
  expect(state.loaded).toBe(true)
})

test('loadCourses sets error on API failure', async () => {
  server.use(
    http.get('/api/courses', () =>
      HttpResponse.json({ error: 'Server Error' }, { status: 500 })
    )
  )

  await useCourseStore.getState().loadCourses()
  await flushMicrotasks()

  const state = useCourseStore.getState()
  expect(state.error).toContain('HTTP 500')
  expect(state.loading).toBe(false)
})
```

The API mock is injected via MSW — never via `mock.module`. This is Tier 2 testing: mock API only, everything else real.

Note: `flushMicrotasks` is a helper that awaits one microtask tick. For pure store tests without React rendering, this resolves zustand's async thunks.

```typescript
// test-utils.ts
export function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
```

> **Think**: Why `flushMicrotasks()` instead of `waitFor` in pure store tests?
>
> *Answer: `waitFor` is from testing-library, designed for React render cycles. Pure store tests without `renderHook` don't run in React's async context. A single microtask flush (one `setTimeout(0)`) resolves zustand's async thunks deterministically.*

### 1.5 Testing Zustand Persist Middleware

The `persist` middleware reads from `localStorage` on store creation. This creates a testing challenge: test order dependence on localStorage state.

```typescript
export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      theme: 'light' as const,
      fontSize: 16,
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'settings-storage' }
  )
)
```

Two approaches:

**Approach A: Simulate via store.setState (recommended)**

```typescript
beforeEach(() => {
  localStorage.clear()
  useSettingsStore.setState({
    theme: 'light',
    fontSize: 16,
  })
})

test('can toggle theme', () => {
  useSettingsStore.getState().setTheme('dark')
  expect(useSettingsStore.getState().theme).toBe('dark')
})
```

**Approach B: Pre-populate localStorage (for rehydration tests)**

```typescript
test('rehydrates from localStorage', () => {
  localStorage.setItem('settings-storage', JSON.stringify({
    state: { theme: 'dark', fontSize: 18 },
    version: 0,
  }))

  // Re-create store or trigger rehydration
  useSettingsStore.persist.rehydrate()

  expect(useSettingsStore.getState().theme).toBe('dark')
  expect(useSettingsStore.getState().fontSize).toBe(18)
})
```

> **Think**: What testing problem does Zustand's `persist` middleware create?
>
> *Answer: Persist reads from `localStorage` on store creation. Tests must either set localStorage before store import (leads to test ordering issues) or use `store.setState()` after creation to simulate loaded state. Option B (store.setState) is simpler — avoids test order dependency on localStorage state.*

---

## Why This Matters

Mock pollution is the #1 cause of flaky test suites in medium-to-large React projects. A single `mock.module` on a shared store silently breaks unrelated tests. Using `store.setState()` as DI gives you clean, isolated store tests that never pollute other files. This patterns scales from 10 to 1000+ tests.

---

## Common Questions

**Q: What if my store action calls another store's action?**
A: This is Tier 3 code. Refactor first (see Module 7). The action should accept the dependency as parameter or you should test via integration where both stores are real and only API is mocked.

**Q: Does store.setState work with zustand's `createSelectors` wrapper?**
A: Yes. `setState` is a property of the underlying store, not the selector wrapper. `useStore.setState(...)` works regardless of selector wrappers.

**Q: Can I test that a component re-renders when store state changes?**
A: Yes. Use `store.setState()` between render and assertion. testing-library's `waitFor` will poll until the DOM reflects the new state. No need for `act()` wrapping.

---

## Examples

### Example 1: Store with computed selectors

```typescript
const useTodoStore = create<TodoStore>()((set, get) => ({
  todos: [],
  filter: 'all',
  addTodo: (text) => set((s) => ({ todos: [...s.todos, { text, done: false }] })),
  toggleTodo: (index) => set((s) => ({
    todos: s.todos.map((t, i) => i === index ? { ...t, done: !t.done } : t),
  })),
}))

// Test
test('addTodo adds item to list', () => {
  useTodoStore.setState({ todos: [] })
  useTodoStore.getState().addTodo('Buy milk')
  expect(useTodoStore.getState().todos).toEqual([
    { text: 'Buy milk', done: false },
  ])
})
```

### Example 2: Store with async initializer

```typescript
test('initialize loads data from API', async () => {
  server.use(
    http.get('/api/init', () => HttpResponse.json({ user: 'Alice' }))
  )

  await useAppStore.getState().initialize()
  await flushMicrotasks()

  expect(useAppStore.getState().user).toBe('Alice')
  expect(useAppStore.getState().initialized).toBe(true)
})
```

---

## Key Takeaways

- Never use `mock.module` for shared modules (stores, api, hooks) — pollution is permanent
- Reset zustand stores via `store.setState()` in `beforeEach`
- Build factory functions to centralize default state
- Mock API layer (MSW), not the store, when testing store actions
- Use `flushMicrotasks()` (one setTimeout) for async store tests without React
- Handle persist middleware via `store.setState()` simulation

---

## Common Misconception

**"I should mock the store to control what my component sees."**

Wrong. Mocking the store breaks the component's integration with real store selectors, actions, and subscription behavior. Instead, use `store.setState()` to set the store to the exact state your component needs to render. This tests the real store + component connection, catching selector bugs and subscription timing issues.

---

## Feynman Explain

(Explain why `mock.module` is dangerous for stores and what to use instead. Use simplest words. Give concrete example from daily work.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain testing 1` — AI will probe your explanation for gaps.*

---

## Reframe

(Pause. Judge: is `store.setState()` always the right approach? When would this logic break? What's the counterargument for using `mock.module` anyway? Write your evaluation.)

---

## Drill

Take the quiz. MCQs test different angles — recall, application, scenario.

Run: `learn.sh quiz testing 1`
