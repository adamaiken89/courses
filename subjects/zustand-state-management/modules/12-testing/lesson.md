# Module 12: Testing Zustand Stores: Pure Logic with useBoundStore

Est. study time: 2h
Language: en

## Learning Objectives
- Write unit tests for Zustand stores using Vitest without React rendering
- Test store actions, selectors, middleware, and async flows in isolation
- Mock persist middleware storage and verify hydrate/rehydrate cycles
- Choose what to test in stores vs what to test in components

---

## Core Content

### Testing the Vanilla Store: getState, setState, subscribe

Zustand stores are vanilla JavaScript objects. The `create` function returns a plain store with three methods — no React dependency.

```typescript
import { createStore } from 'zustand/vanilla'

interface CounterState {
  count: number
  increment: () => void
}

const store = createStore<CounterState>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}))

// Test access
store.getState()       // { count: 0, increment: fn }
store.setState({ count: 5 })
store.subscribe((state) => console.log('changed', state))
```

Key testing insight: you never mount a component to test store logic.

> **Think**: Why does the vanilla store test better than a React component that uses useState? What architectural property makes Zustand easier to test?
>
> *Answer: Zustand separates state logic from rendering. useState couples state and component. You can test getState/setState/subscribe in isolation with zero DOM. This is the same property that makes Redux reducers testable — pure state transitions. Zustand extends this to actions and middleware.*

### Testing Store Actions: Call Action, Assert State Change

Actions are functions on the store. Call them, then assert the resulting state.

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { createStore } from 'zustand/vanilla'

describe('counter store actions', () => {
  let store: ReturnType<typeof createStore<CounterState>>

  beforeEach(() => {
    store = createStore<CounterState>((set) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
      decrement: () => set((state) => ({ count: state.count - 1 })),
      reset: () => set({ count: 0 }),
    }))
  })

  it('starts at 0', () => {
    expect(store.getState().count).toBe(0)
  })

  it('increments count', () => {
    store.getState().increment()
    expect(store.getState().count).toBe(1)
  })

  it('decrements count', () => {
    store.getState().decrement()
    expect(store.getState().count).toBe(-1)
  })

  it('resets count', () => {
    store.getState().increment()
    store.getState().increment()
    store.getState().reset()
    expect(store.getState().count).toBe(0)
  })
})
```

Pattern: **beforeEach rebuilds store to fresh state**. This prevents test pollution.

> **Think**: What happens if you share one store across tests without resetting? What bugs appear?
>
> *Answer: Tests become order-dependent. Test A increments count to 1. Test B expects count === 0 — fails. Worse: tests pass in isolation but fail in CI when run in different order. Always recreate the store per test or call setState to reset.*

### Testing Selectors: Pure Function Testing

Selectors transform state. Test them as pure functions — no store, no React.

```typescript
// store.ts
interface Todo {
  id: string
  text: string
  done: boolean
}

interface TodoState {
  todos: Todo[]
  filter: 'all' | 'done' | 'active'
}

// selectors.ts — extracted for testability
export const selectFilteredTodos = (state: TodoState) => {
  switch (state.filter) {
    case 'done': return state.todos.filter((t) => t.done)
    case 'active': return state.todos.filter((t) => !t.done)
    default: return state.todos
  }
}

export const selectTodoCount = (state: TodoState) => ({
  total: state.todos.length,
  done: state.todos.filter((t) => t.done).length,
  active: state.todos.filter((t) => !t.done).length,
})
```

```typescript
// selectors.test.ts
import { describe, it, expect } from 'vitest'
import { selectFilteredTodos, selectTodoCount } from './selectors'

const sampleState: TodoState = {
  todos: [
    { id: '1', text: 'Learn Zustand', done: true },
    { id: '2', text: 'Write tests', done: false },
  ],
  filter: 'all',
}

describe('selectFilteredTodos', () => {
  it('returns all todos when filter is all', () => {
    expect(selectFilteredTodos(sampleState)).toHaveLength(2)
  })

  it('returns only done todos', () => {
    const state = { ...sampleState, filter: 'done' as const }
    expect(selectFilteredTodos(state)).toHaveLength(1)
    expect(selectFilteredTodos(state)[0].text).toBe('Learn Zustand')
  })
})
```

Vanilla JS testing of selectors: no setup, no mock, no provider.

> **Think**: How would you test a selector that composes multiple selectors with Zustand's `useShallow`? What is the test surface?
>
> *Answer: Test the composed result directly with a state object. useShallow only affects React re-render behavior — it does not change the selector's output. Test the selector's return value for correctness. Test shallow comparison separately if you suspect bugs in reference equality.*

### Testing Middleware: Custom Middleware with Test Config

Middleware wraps `create`. Test middleware behavior by observing how it intercepts setState.

```typescript
// logger.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createStore } from 'zustand/vanilla'

describe('logging middleware', () => {
  it('logs each state change', () => {
    const log = vi.fn()

    const store = createStore<{ count: number }>(
      (set) => ({
        count: 0,
        ...logMiddleware(set, log),
      })
    )

    store.getState().setCount?.(5)
    expect(log).toHaveBeenCalledTimes(1)
  })
})

function logMiddleware(
  set: any,
  log: ReturnType<typeof vi.fn>
) {
  return {
    setCount: (n: number) => {
      log('setCount called', n)
      set({ count: n })
    },
  }
}
```

Vanilla store + vi.fn spy = clean middleware tests. No React rendering.

> **Think**: What edge cases in middleware are hard to catch without testing? Which bugs only appear in production?
>
> *Answer: Middleware order bugs (subscribe before persist logs stale state), error swallowing (middleware catches but never re-throws), and performance issues (redundant setState calls). Only the last requires production profiling. Order and error handling are testable in unit tests.*

### Testing Persist Middleware: Mock Storage, Hydrate/Rehydrate

Persist middleware reads/writes localStorage. Mock the storage backend to test serialization and rehydration.

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { createStore } from 'zustand/vanilla'
import { persist } from 'zustand/middleware'

// Mock storage
const mockStorage: Storage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  get length() { return 0 },
  key: vi.fn(),
}

describe('persist middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('persists state on change', () => {
    const store = createStore(
      persist<{ count: number }>(
        (set) => ({ count: 0, setCount: (n: number) => set({ count: n }) }),
        { name: 'test-storage', storage: () => mockStorage }
      )
    )

    store.getState().setCount?.(5)
    expect(mockStorage.setItem).toHaveBeenCalledWith(
      'test-storage',
      expect.stringContaining('"count":5')
    )
  })

  it('rehydrates state on init', () => {
    mockStorage.getItem = vi.fn(() => JSON.stringify({
      state: { count: 10 },
      version: 0,
    }))

    const store = createStore(
      persist<{ count: number }>(
        (set) => ({ count: 0 }),
        { name: 'test-storage', storage: () => mockStorage }
      )
    )

    // onRehydrateStorage callback runs asynchronously
    // Use waitFor or check after microtask
    setTimeout(() => {
      expect(store.getState().count).toBe(10)
    }, 0)
  })
})
```

Mock storage removes DOM dependency. Tests stay fast and deterministic.

> **Think**: How would you test partial rehydration or migration of persisted state schema? What breaks if the stored schema differs from current?
>
> *Answer: Create mock storage with old schema. Verify migrate function transforms it to new schema. Without a migrate handler, stale schema produces undefined fields or runtime errors. Test both migrate function and the case where migrate is missing.*

### Testing Components with Zustand: Mock Store for Isolated Tests

When testing React components that consume Zustand, mock the store hook to supply controlled state.

```typescript
// Counter.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Counter from './Counter'

// Mock the store hook
const mockUseCounterStore = vi.fn()

vi.mock('./store', () => ({
  useCounterStore: (...args: any[]) => mockUseCounterStore(...args),
}))

beforeEach(() => {
  mockUseCounterStore.mockReturnValue({
    count: 0,
    increment: vi.fn(),
    decrement: vi.fn(),
  })
})

describe('Counter component', () => {
  it('renders current count', () => {
    render(<Counter />)
    expect(screen.getByText('0')).toBeDefined()
  })

  it('calls increment on button click', () => {
    const increment = vi.fn()
    mockUseCounterStore.mockReturnValue({
      count: 0,
      increment,
      decrement: vi.fn(),
    })

    render(<Counter />)
    fireEvent.click(screen.getByText('+'))
    expect(increment).toHaveBeenCalledOnce()
  })
})
```

Alternatively, render with a test store provider:

```typescript
import { create } from 'zustand'

function renderWithStore(ui: React.ReactElement, initial = { count: 0 }) {
  const testStore = create<CounterState>((set) => ({
    ...initial,
    increment: () => set((s) => ({ count: s.count + 1 })),
  }))

  return render(
    <StoreProvider store={testStore}>
      {ui}
    </StoreProvider>
  )
}
```

> **Think**: When should you mock the store vs render with a real store? What trade-off exists between isolation and confidence?
>
> *Answer: Mock store for isolated component tests (unit tests). Real store for integration tests. Mocks isolate rendering logic from state logic — a mock never catches store bugs. Real stores catch regression but require more setup. Rule: unit test store logic + component rendering separately; integration test them together for critical paths.*

### Vitest Patterns: beforeEach Reset, Cleanup

Standard Vitest setup for Zustand tests.

```typescript
// setup.ts — Vitest setup file
import { afterEach, vi } from 'vitest'

afterEach(() => {
  // Clean up all Zustand stores created during test
  vi.restoreAllMocks()
})
```

```typescript
// store.test.ts — preferred patterns
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createStore } from 'zustand/vanilla'

describe('store test patterns', () => {
  // FRESH STORE PER TEST — prevents pollution
  let store: ReturnType<typeof createStore<CounterState>>

  beforeEach(() => {
    store = createStore<CounterState>((set) => ({
      count: 0,
      increment: () => set((s) => ({ count: s.count + 1 })),
    }))
  })

  // MOCK CLEANUP — restore after each test
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('handles concurrent actions', () => {
    const updates = Array.from({ length: 100 }, (_, i) => i)

    updates.forEach(() => {
      store.getState().increment()
    })

    expect(store.getState().count).toBe(100)
  })
})
```

Key patterns:
- `beforeEach`: recreate store (or call `setState` to reset)
- `afterEach`: `vi.restoreAllMocks()`, clear fake timers
- Use `vi.useFakeTimers()` for debounced actions
- Avoid global store singletons in test suites

> **Think**: Why is `vi.restoreAllMocks()` important after each test? What happens without it?
>
> *Answer: Unrestored mocks leak across test files. A mock set in test A affects module-level mocks in test B. This produces flaky failures — tests pass in isolation but fail when run as a suite. Always restore in afterEach or in Vitest setup file.*

### Integration Testing: Store + Component Together

Integration tests exercise the full store-component pipeline.

```typescript
// Counter.integration.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Counter from './Counter'
import { useCounterStore } from './store'

describe('Counter integration', () => {
  beforeEach(() => {
    // Reset store between tests
    useCounterStore.setState({ count: 0 })
    // Clear React testing library
    cleanup()
  })

  it('increments on click — full pipeline', async () => {
    render(<Counter />)
    expect(screen.getByText('0')).toBeDefined()

    await userEvent.click(screen.getByText('+'))

    // Store updated
    expect(useCounterStore.getState().count).toBe(1)
    // Component re-rendered
    expect(screen.getByText('1')).toBeDefined()
  })

  it('multiple components share store state', () => {
    render(
      <>
        <Counter display="Counter A" />
        <Counter display="Counter B" />
      </>
    )

    fireEvent.click(screen.getAllByText('+')[0])

    // Both components reflect same store state
    expect(screen.getByText('1')).toBeDefined()
    // Both HTML elements show new count
    const displays = screen.getAllByText('1')
    expect(displays).toHaveLength(2)
  })
})
```

No mocks. Real store, real state transitions, real component re-renders.

> **Think**: Integration tests catch bugs that unit tests miss. Name a bug that survives unit tests but falls in integration tests for Zustand.
>
> *Answer: Selector transform bug. Unit tests on store pass (state is correct). Unit tests on component pass (render logic correct). But the selector returns a new object each call (no useShallow), causing infinite re-render. Integration test catches the re-render loop because both store + component execute together.*

### Testing Async Actions: Thunk-Style Async Store Actions

Async actions modify state after a promise resolves. Test with real promises or controlled async.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createStore } from 'zustand/vanilla'

interface AsyncState {
  data: string | null
  loading: boolean
  error: string | null
  fetchData: (id: string) => Promise<void>
}

describe('async store actions', () => {
  it('handles successful fetch', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ text: 'hello' })

    const store = createStore<AsyncState>((set) => ({
      data: null,
      loading: false,
      error: null,
      fetchData: async (id: string) => {
        set({ loading: true, error: null })
        try {
          const res = await mockFetch(`/api/${id}`)
          set({ data: res.text, loading: false })
        } catch (err) {
          set({ error: (err as Error).message, loading: false })
        }
      },
    }))

    const promise = store.getState().fetchData('123')
    expect(store.getState().loading).toBe(true)

    await promise
    expect(store.getState().loading).toBe(false)
    expect(store.getState().data).toBe('hello')
  })

  it('handles fetch error', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Not found'))

    const store = createStore<AsyncState>((set) => ({
      data: null,
      loading: false,
      error: null,
      fetchData: async (id: string) => {
        set({ loading: true, error: null })
        try {
          const res = await mockFetch(`/api/${id}`)
          set({ data: res.text, loading: false })
        } catch (err) {
          set({ error: (err as Error).message, loading: false })
        }
      },
    }))

    await store.getState().fetchData('999')
    expect(store.getState().loading).toBe(false)
    expect(store.getState().error).toBe('Not found')
    expect(store.getState().data).toBeNull()
  })
})
```

Test loading state synchronously (before await), then resolved state (after await).

> **Think**: How would you test a race condition where two async actions fire sequentially and the first response arrives after the second? What assertion catches the stale data?
>
> *Answer: Fire action 1 (slow), fire action 2 (fast), await both. Assert final state equals action 2 result — not action 1 result. Use AbortController or a timestamp check in the action. Test the abort path: verify loading resets and stale data is discarded.*

### Coverage: What to Test in Stores vs What to Test in Components

| Layer | Test strategy | Example |
|-------|---------------|---------|
| **Store initial state** | Unit test | `expect(store.getState().count).toBe(0)` |
| **Store actions** | Unit test | Call action, assert state change |
| **Store selectors** | Pure function test | Pass state, assert derived value |
| **Middleware** | Unit test with spies | vi.fn() on setState, assert interception |
| **Persist** | Unit test with mock storage | Mock getItem/setItem, verify serialization |
| **Async actions** | Unit test with mock fetch | Assert loading → success/error transitions |
| **Component rendering** | Unit test with mocked store | Mock useBoundStore, assert DOM output |
| **Component interactions** | Integration test with real store | Click button, assert store + DOM updated |
| **Cross-component sync** | Integration test | Two components, one click, both update |

Do not test:
- Zustand internals (subscribe implementation, batching)
- React's re-render mechanism
- Third-party middleware internals
- Browser storage behavior (test your mock, not localStorage)

> **Think**: If you have 100% store coverage and 0% component coverage, what bugs reach production?
>
> *Answer: Rendering bugs — wrong selector wired to wrong component, missing useEffect sync, styling errors from conditional store values, component fails to subscribe to correct slice. Store tests prove state logic correct but say nothing about the UI layer.*

---

### Why This Matters

Zustand's vanilla core makes store testing trivial — no DOM, no React, no providers. This is a unique advantage over context-based state (useReducer + Context) and library-coupled stores (Redux requires store configuration). Teams that exploit this write faster, more reliable tests. The split between store tests (fast, unit, deterministic) and component tests (integration, slower) mirrors the test pyramid correctly. Wrong approach: test everything through the component. Right approach: test store logic in isolation, test rendering with real stores for critical paths, test edge cases (middleware ordering, persist migration, race conditions) at the store level.

---

### Common Questions

**Q: Should I use `createStore` from `zustand/vanilla` or `create` from `zustand` for tests?**
A: Use `createStore` (vanilla) for pure store logic tests. Use `create` (with React bindings) only when testing hooks or components. Vanilla tests do not require React `act()` and run without a DOM environment.

**Q: How do I test `subscribe` callbacks?**
A: Create a store, call `subscribe` with `vi.fn()`, then call an action. Assert the callback was called with the new state. Subscribe fires synchronously on every `setState` in vanilla Zustand.

**Q: My persist middleware test fails — store does not rehydrate. Why?**
A: Rehydration in Zustand persist is async (uses `Promise.resolve().then`). Wrap the assertion in `waitFor` or flush promises. Use `vi.runAllTimers()` if mocking timers, or check after a microtask.

**Q: Should I test every selector variant or sample patterns?**
A: Test every branch of the selector. If the selector has a switch on `filter` with 3 cases, write 3 tests (all, done, active). Selectors are pure functions with low maintenance cost. Coverage is cheap.

**Q: Can I use Vitest's `vi.mock` with Zustand barrel exports?**
A: Yes, but prefer `zustand/vanilla` imports in tests to avoid mocking React dependencies. If you must mock `useBoundStore`, mock the specific file — not the barrel barrel `zustand` package.

---

## Examples

### Example 1: Testing a Full Todo Store with Persist

```typescript
// store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface TodoState {
  todos: Array<{ id: string; text: string; done: boolean }>
  addTodo: (text: string) => void
  toggleTodo: (id: string) => void
}
```

```typescript
// store.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createStore } from 'zustand/vanilla'
import { persist } from 'zustand/middleware'

const mockStorage: Storage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  get length() { return 0 },
  key: vi.fn(),
}

let store: ReturnType<typeof createStore<TodoState>>

beforeEach(() => {
  vi.clearAllMocks()
  mockStorage.getItem = vi.fn(() => JSON.stringify({
    state: {
      todos: [{ id: '1', text: 'Existing', done: false }],
    },
    version: 0,
  }))
})

describe('Todo store', () => {
  it('rehydrates persisted todos', async () => {
    store = createStore(
      persist<TodoState>(
        (set) => ({
          todos: [],
          addTodo: (text) => set((s) => ({
            todos: [...s.todos, { id: Date.now().toString(), text, done: false }],
          })),
          toggleTodo: (id) => set((s) => ({
            todos: s.todos.map((t) => t.id === id ? { ...t, done: !t.done } : t),
          })),
        }),
        { name: 'todo-storage', storage: () => mockStorage }
      )
    )

    await vi.waitFor(() => {
      expect(store.getState().todos).toHaveLength(1)
    })
  })

  it('persists new todos', () => {
    store = createStore(
      persist<TodoState>(
        (set) => ({
          todos: [],
          addTodo: (text) => set((s) => ({
            todos: [...s.todos, { id: '2', text, done: false }],
          })),
          toggleTodo: (id) => set((s) => ({
            todos: s.todos.map((t) => t.id === id ? { ...t, done: !t.done } : t),
          })),
        }),
        { name: 'todo-storage', storage: () => mockStorage }
      )
    )

    store.getState().addTodo('New task')
    expect(mockStorage.setItem).toHaveBeenCalled()
    expect(mockStorage.setItem.mock.calls[0][1]).toContain('New task')
  })
})
```

### Example 2: Component Integration with Real Store

```typescript
// useCounterStore.ts
import { create } from 'zustand'

export const useCounterStore = create<{
  count: number
  increment: () => void
  double: () => void
}>((set) => ({
  count: 0,
  increment: () => set((s) => ({ count: s.count + 1 })),
  double: () => set((s) => ({ count: s.count * 2 })),
}))
```

```typescript
// CounterPanel.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { useCounterStore } from './useCounterStore'
import CounterPanel from './CounterPanel'

describe('CounterPanel integration', () => {
  beforeEach(() => {
    useCounterStore.setState({ count: 0 })
    cleanup()
  })

  it('increment and double work in sequence', () => {
    render(<CounterPanel />)
    fireEvent.click(screen.getByText('Increment'))
    fireEvent.click(screen.getByText('Double'))

    // After increment: count=1. After double: count=2
    expect(useCounterStore.getState().count).toBe(2)
    expect(screen.getByText('2')).toBeDefined()
  })

  it('reset restores initial state', () => {
    render(<CounterPanel />)
    fireEvent.click(screen.getByText('Increment'))
    fireEvent.click(screen.getByText('Reset'))

    expect(useCounterStore.getState().count).toBe(0)
    expect(screen.getByText('0')).toBeDefined()
  })
})
```

### Example 3: Testing Selector Performance with Reference Stability

```typescript
// selectors.ts
import { createSelectors } from './store'

export const selectItems = (state: ItemState) => state.items
export const selectItemCount = (state: ItemState) => state.items.length

// Selector that creates new reference — potential re-render issue
export const selectActiveItems = (state: ItemState) =>
  state.items.filter((i) => i.active)
```

```typescript
// selectors.test.ts
import { describe, it, expect } from 'vitest'

describe('selector reference stability', () => {
  const state1 = { items: [{ id: '1', active: true }], filter: 'all' }
  const state2 = { ...state1, filter: 'done' } // shallow copy, same items ref

  it('selectItems returns same reference for same items', () => {
    expect(selectItems(state1)).toBe(selectItems(state2))
  })

  it('selectActiveItems creates new reference each call', () => {
    const a = selectActiveItems(state1)
    const b = selectActiveItems(state1)
    // filter creates new array — reference changes!
    expect(a).not.toBe(b)
    // But contents are equal
    expect(a).toEqual(b)
  })
})
```

This test catches the implicit re-render problem: selectors using `.filter`, `.map`, `.reduce` produce new references each call. Components using these selectors without `useShallow` re-render on every store change.

---

## Key Takeaways
- Zustand vanilla store (`createStore`) tests without React — pure getState/setState/subscribe
- beforeEach store reset prevents test pollution and flaky ordering
- Selectors are pure functions — test them standalone with state input
- Middleware testing uses vi.fn() spies on setState
- Persist middleware needs mock Storage — test serialization and rehydration
- Mock store hooks for unit component tests; use real stores for integration
- Test loading/error state transitions synchronously in async action tests
- Stores: test state logic, middleware behavior, selector correctness
- Components: test rendering, interactions, cross-component sync
- Reference stability of selectors is testable — catch re-render bugs before they ship

## Common Misconception

**"Zustand stores need React Testing Library to test."**

Zustand stores are vanilla JavaScript. The core testing pattern — createStore, getState, setState, subscribe — uses zero React. React Testing Library is needed only for component rendering tests. The vanilla testing path is faster (microseconds vs milliseconds), simpler (no act(), no waitFor), and more deterministic. Developers who reach for RTL for every Zustand test waste time and miss the architectural insight: Zustand separates state logic from React, and tests should mirror that separation.

---

## Feynman Explain
(Explain Zustand testing strategy to a developer who knows Redux testing patterns. They are familiar with testing reducers and actions with store.dispatch(). Translate: how does Zustand's testing approach differ? Where is it simpler? Where does it require new patterns like persist mocking and selector reference checks?)

---

## Reframe
(Pause. Critique: Is testing store logic in isolation worth the overhead of maintaining separate vanilla test files? When does the integration test (store + component together) give more confidence than isolated unit tests? Consider a small app (3 stores) vs a large app (50 stores). Where do you draw the line?)

---

## Drill
Take the quiz. MCQs test store testing patterns, middleware mocking, persist hydration, and coverage boundaries.

Run: `learn.sh quiz zustand-state-management 12-testing`
