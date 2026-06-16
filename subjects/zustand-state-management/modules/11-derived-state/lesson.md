# Module 11: Derived State — Computed Values, Selector Composition

Est. study time: 2h
Language: en

## Learning Objectives
- Distinguish derived state from raw store state — compute instead of store
- Implement memoized selectors with reselect's createSelector for expensive derivations
- Compose raw and derived selectors into reusable selector graphs
- Design normalized stores with derived views for flexible data access

---

## Core Content

### Derived State Concept — Compute, Don't Store

Derived state is data computed from existing store state. You do not store it — you calculate it on demand.

```typescript
// Raw state (stored)
interface Store {
  items: Todo[]
  filter: 'all' | 'active' | 'completed'
}

// Derived state (computed)
// - filteredTodos: s.items.filter(i => matches filter)
// - activeCount: s.items.filter(i => !i.done).length
// - completedCount: s.items.filter(i => i.done).length
```

Principle: store minimum, derive everything else. Raw state is source of truth. Derived state is ephemeral — always consistent because it recomputes from source.

Redundant storage causes bugs:

```typescript
// BAD — storing derived state
interface BadStore {
  items: Todo[]
  filter: 'all' | 'active' | 'completed'
  filteredItems: Todo[]  // ← derived, stored redundantly
  activeCount: number    // ← derived, stored redundantly
  completedCount: number // ← derived, stored redundantly
}

// When addItem runs, must update 4 fields → can desync
const useBadStore = create<BadStore>((set) => ({
  // ...
  addItem: (item) => set((state) => {
    const newItems = [...state.items, item]
    return {
      items: newItems,
      filteredItems: applyFilter(newItems, state.filter), // must keep in sync
      activeCount: newItems.filter((i) => !i.done).length, // must keep in sync
      completedCount: newItems.filter((i) => i.done).length, // must keep in sync
    }
  }),
}))
```

Derived state eliminates sync surface. One source update → all derivations automatically reflect new state.

> **Think**: You have `items: Todo[]` and `totalItems: number` in store. What happens when `items` changes but code forgets to update `totalItems`?
>
> *Answer: totalItems diverges from reality. Component reads stale count. Bug manifests as off-by-one display. Hard to catch because store shape is valid. Fix: derive totalItems as `s.items.length` — always correct.*

### Selector-Based Computation — Pure Functions from State

Derived state lives in selectors, not in store:

```typescript
const useStore = create<Store>((set) => ({
  items: [
    { id: '1', text: 'Learn Zustand', done: true },
    { id: '2', text: 'Build project', done: false },
    { id: '3', text: 'Write tests', done: false },
  ],
  filter: 'active',
  setFilter: (filter) => set({ filter }),
  addItem: (text) => set((s) => ({ items: [...s.items, { id: nanoid(), text, done: false }] })),
  toggleItem: (id) => set((s) => ({ items: s.items.map((i) => i.id === id ? { ...i, done: !i.done } : i) })),
}))

// Derived selectors (pure functions)
const selectFilteredTodos = (s: Store) => {
  if (s.filter === 'all') return s.items
  const done = s.filter === 'completed'
  return s.items.filter((i) => i.done === done)
}

const selectActiveCount = (s: Store) =>
  s.items.filter((i) => !i.done).length

const selectCompletedCount = (s: Store) =>
  s.items.filter((i) => i.done).length

// Components use derived selectors directly
function TodoList() {
  const todos = useStore(selectFilteredTodos)
  return todos.map((t) => <TodoItem key={t.id} todo={t} />)
}

function TodoFooter() {
  const active = useStore(selectActiveCount)
  const completed = useStore(selectCompletedCount)
  return <span>{active} active — {completed} completed</span>
}
```

Derived selectors are pure functions: same state → same result. No side effects. No mutations. They are testable without React.

> **Think**: `selectFilteredTodos` runs on every state change. For 10,000 todos, filter runs 10,000 iterations each time any field updates (even irrelevant fields like `theme`). Why is this okay? When is it not?
>
> *Answer: Acceptable when items rarely change and filter is small. Not okay when items update every frame (animations, real-time data). Solution: memoized selectors — recompute only when `s.items` or `s.filter` reference changes.*

### Memoized Selectors — createSelector from Reselect

Reselect's `createSelector` caches derived results. Only recomputes when input selectors return new values:

```typescript
import { createSelector } from 'reselect'

// Input selectors (atomic, no memoization needed)
const selectItems = (s: Store) => s.items
const selectFilter = (s: Store) => s.filter

// Derived selector (memoized)
const selectFilteredTodos = createSelector(
  [selectItems, selectFilter],
  (items, filter) => {
    if (filter === 'all') return items
    const done = filter === 'completed'
    return items.filter((i) => i.done === done)
  }
)

// Further derived selectors compose from memoized ones
const selectFilteredCount = createSelector(
  [selectFilteredTodos],
  (todos) => todos.length
)

const selectStats = createSelector(
  [selectItems, selectFilteredTodos],
  (items, filtered) => ({
    total: items.length,
    filtered: filtered.length,
    active: items.filter((i) => !i.done).length,
    completed: items.filter((i) => i.done).length,
  })
)
```

`createSelector` creates a new selector each call. Call it once, export the result:

```typescript
// selectors.ts
export const useFilteredTodos = () => useStore(selectFilteredTodos)
export const useStats = () => useStore(selectStats)
// Or pass createSelector result directly to useStore
```

Manual memoization (no library):

```typescript
function createMemoSelector<State, Result>(
  selectors: Array<(s: State) => any>,
  combiner: (...args: any[]) => Result
): (s: State) => Result {
  let lastArgs: any[] = []
  let lastResult: Result
  return (state: State) => {
    const args = selectors.map((fn) => fn(state))
    const changed = args.some((arg, i) => !Object.is(arg, lastArgs[i]))
    if (!changed) return lastResult
    lastArgs = args
    lastResult = combiner(...args)
    return lastResult
  }
}
```

Reselect's default cache size is 1. For selectors with parameterized input, use `createSelectorCreator` with a custom cache:

```typescript
import { createSelectorCreator, lruCache } from 'reselect'

const createCachedSelector = createSelectorCreator({
  memoize: lruCache({ maxSize: 10 }),
  argsMemoize: lruCache({ maxSize: 10 }),
})

const selectTodosByStatus = createCachedSelector(
  [selectItems, (_, status: 'all' | 'active' | 'completed') => status],
  (items, status) => {
    if (status === 'all') return items
    return items.filter((i) => status === 'completed' ? i.done : !i.done)
  }
)

// Component passes parameter
function FilteredView({ status }: { status: 'all' | 'active' | 'completed' }) {
  const todos = useStore((s) => selectTodosByStatus(s, status))
  return <List items={todos} />
}
```

> **Think**: Without memoization, a 10,000-item todo list recomputes filter on every unrelated state change (e.g., app theme toggle). How many operations per toggle? With createSelector?
>
> *Answer: Without: 10,000 iterations per toggle (items.filter). With: 0 iterations — items reference unchanged → memoized result returned. Difference visible at ms scale. At 10 updates/sec, memoization saves 100k array iterations per second.*

### Computed Properties in Store — get() Derivations

Zustand store supports computed properties via `get()` inside state:

```typescript
const useStore = create<Store>((set, get) => ({
  items: [],
  filter: 'all',

  // Computed properties (not stored, re-derived on access)
  get filteredItems() {
    const state = get()
    if (state.filter === 'all') return state.items
    const done = state.filter === 'completed'
    return state.items.filter((i) => i.done === done)
  },
}))

// Access computed value
const filtered = useStore.getState().filteredItems
```

Getters live on store state object. They recompute on every access. No memoization — use for simple derivations called rarely.

For frequently accessed computed values, use derived selectors instead (memoized outside the store).

> **Think**: When would you use `get()` computed property over a selector? When is it harmful?
>
> *Answer: Use get() for one-off access outside React (event handlers, middleware, subscribers). Harmful when called in render — creates new derived value on every render without memoization. Selectors integrate with Zustand's subscription model; get() bypasses it.*

### Selector Composition — Building a Selector Graph

Compose raw and derived selectors into a graph. Each selector is reusable building block:

```typescript
// ---- Raw selectors (atomic) ----
const selectItems = (s: Store) => s.items
const selectFilter = (s: Store) => s.filter
const selectUser = (s: Store) => s.user
const selectTags = (s: Store) => s.tags

// ---- Derived selectors (memoized) ----
const selectFilteredItems = createSelector(
  [selectItems, selectFilter],
  (items, filter) => filter === 'all' ? items : items.filter((i) => i.done === (filter === 'completed'))
)

const selectItemCounts = createSelector(
  [selectItems],
  (items) => ({
    total: items.length,
    active: items.filter((i) => !i.done).length,
    completed: items.filter((i) => i.done).length,
  })
)

// ---- Composed selectors (combine raw + derived) ----
const selectFilteredWithMeta = createSelector(
  [selectFilteredItems, selectItemCounts, selectUser],
  (items, counts, user) => ({
    items,
    counts,
    currentUser: user.name,
  })
)

// ---- Feature-specific selectors (composed for component needs) ----
const selectDashboardData = createSelector(
  [selectItemCounts, selectUser, selectTags],
  (counts, user, tags) => ({
    progress: counts.completed / counts.total || 0,
    userName: user.name,
    popularTags: tags.filter((t) => t.count > 5).map((t) => t.name),
  })
)
```

Selector composition creates a directed acyclic graph (DAG). Changes propagate: raw selector changes → derived selector recomputes → composed selector recomputes.

Advantages over flat selectors:
- Reusable atoms: every composed selector uses same `selectItems`
- Testable: each selector unit-testable in isolation
- Performant: memoization at each level prevents cascade
- Readable: selector names describe what they return

> **Think**: Component uses `selectFilteredWithMeta`. User name updates. Does `selectFilteredItems` re-run?
>
> *Answer: No. selectFilteredWithMeta depends on selectFilteredItems, selectItemCounts, selectUser. Only selectUser recomputes. selectFilteredItems and selectItemCounts hit cache — their inputs (items, filter) unchanged. React component only re-renders once with new user name in meta.*

### Performance — Selector vs Store Computation

| Location | Pros | Cons | Use when |
|----------|------|------|----------|
| Selector (derived) | No storage cost, always fresh, composes naturally | Runs on every state diff, no built-in cache | Frequent reads, infrequent source changes |
| Memoized selector | Cached, runs only on input change | Cache memory, cache invalidation edge cases | Expensive derivation, frequent source changes |
| Store computed (get) | Simple, available in middleware | No memoization, not subscribed by components | One-off access, event handlers |
| Store stored (redundant) | Fastest read (no compute) | Sync bugs, larger store, manual updates | Hot path reads with stable derived values |

Guideline: derive in selector by default. Memoize when recomputation cost exceeds cache overhead. Store computed rarely — only when measurement proves selector cost is bottleneck.

Derived selectors run synchronously during render or subscription diff. Keep them pure and fast. Delegate truly heavy work (search indexing, data transformation) to Web Workers or lazy computation.

> **Think**: A search box filters 100k products by name. Every keystroke recomputes filtered list. Where should derivation live? What makes this different from simple filter?
>
> *Answer: Memoized selector with debounced input. Store searchTerm raw, derive filteredProducts via createSelector. The filter runs on every keystroke (100k iterations). Add debounce: derive from debouncedSearchTerm, not raw searchTerm. If 100k iterations > 16ms (one frame), move filtering to Web Worker or use IndexedDB query.*

### Derived State in Render — useMemo Wrapping Selector Result

When a derived selector returns complex objects, wrap in `useMemo` to stabilize reference between renders:

```typescript
function Dashboard() {
  // Without useMemo: creates new { total, active, completed } on every render
  const stats = useStore(selectItemCounts) // returns { total, active, completed }

  // With useMemo: stabilizes object reference
  const stableStats = useMemo(
    () => useStore.getState().items.filter((i) => !i.done).length,
    []
  )
  // But this pattern misses updates — use derived selector instead
}
```

Correct pattern — selector returns scalar or use `shallow`:

```typescript
import { shallow } from 'zustand/shallow'

function Dashboard() {
  // Object returned by selector — use shallow equality
  const stats = useStore(selectItemCounts, shallow)

  // Or use per-field selectors
  const total = useStore((s) => s.items.length)
  const active = useStore((s) => s.items.filter((i) => !i.done).length)

  return <StatsPanel total={total} active={active} />
}
```

For parameterized derived data inside component:

```typescript
function TodoItem({ id }: { id: string }) {
  const item = useStore((s) => s.items.find((i) => i.id === id))

  // Memoize expensive sub-derivation per item
  const wordCount = useMemo(() => {
    if (!item) return 0
    return item.text.split(/\s+/).length
  }, [item?.text])

  return <div>{item?.text} ({wordCount} words)</div>
}
```

`useMemo` inside component is last resort. Prefer external memoized selectors — they are reusable, testable, and do not couple derivation to component lifecycle.

> **Think**: `useStore(selectItemCounts)` returns `{ total: 3, active: 1, completed: 2 }`. Component destructures and renders. A field unrelated to counts changes. Does component re-render?
>
> *Answer: Yes — if selectItemCounts creates a new object each time (unmemoized), Object.is sees different reference → re-render. Even though values { 3, 1, 2 } are same. Fix: memoize selectItemCounts with createSelector or add shallow equality.*

### Normalized State + Derived Views — Store Flat, Select Shaped

Normalized state stores entities flat (by ID). Derived selectors reshape for views:

```typescript
// ---- Normalized store ----
interface Store {
  todos: Record<string, Todo>  // { [id]: Todo }
  todoIds: string[]           // ordered list of IDs
  projects: Record<string, Project>
  projectIds: string[]
  filter: 'all' | 'active' | 'completed'
}

// ---- Derived views ----

// 1. Array view (most common component need)
const selectTodoArray = createSelector(
  [(s: Store) => s.todos, (s: Store) => s.todoIds],
  (todosMap, ids) => ids.map((id) => todosMap[id]).filter(Boolean)
)

// 2. Filtered + sorted view
const selectVisibleTodos = createSelector(
  [selectTodoArray, (s: Store) => s.filter],
  (todos, filter) => {
    let filtered = filter === 'all' ? todos : todos.filter((t) =>
      filter === 'completed' ? t.done : !t.done
    )
    return filtered.sort((a, b) => b.createdAt - a.createdAt)
  }
)

// 3. Joined view (todo + project name)
const selectTodosWithProject = createSelector(
  [selectVisibleTodos, (s: Store) => s.projects],
  (todos, projects) => todos.map((t) => ({
    ...t,
    projectName: projects[t.projectId]?.name ?? 'No Project',
  }))
)

// 4. Grouped view
const selectTodosByProject = createSelector(
  [selectVisibleTodos],
  (todos) => {
    const grouped: Record<string, Todo[]> = {}
    for (const todo of todos) {
      const key = todo.projectId ?? '__none__'
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(todo)
    }
    return grouped
  }
)

// 5. Aggregate view
const selectProjectProgress = createSelector(
  [(s: Store) => s.todos, (s: Store) => s.projects],
  (todos, projects) => {
    const projectIds = Object.keys(projects)
    return projectIds.map((id) => {
      const projectTodos = Object.values(todos).filter((t) => t.projectId === id)
      return {
        id,
        name: projects[id].name,
        total: projectTodos.length,
        completed: projectTodos.filter((t) => t.done).length,
        progress: projectTodos.length > 0
          ? projectTodos.filter((t) => t.done).length / projectTodos.length
          : 0,
      }
    })
  }
)
```

Normalization enables flexible views. Single source of truth (`todos[id]`) supports unlimited derived views without duplication. Adding new view does not change store shape.

> **Think**: Compare `todos: Todo[]` (array store) to `todos: Record<string, Todo>` + `todoIds: string[]`. When does normalized form matter?
>
> *Answer: Normalized matters when: (1) multiple views need different orderings/filters, (2) entities referenced from multiple parents (todo in project view + user view + date view), (3) frequent updates to individual entities (updating todo by ID in O(1) vs O(n) find). For simple CRUD lists, array is fine.*

### Real Example — Todo List with Derived Views

```typescript
// store.ts
interface Todo {
  id: string; text: string; done: boolean; priority: 'low' | 'medium' | 'high'
  projectId: string; createdAt: number; tags: string[]
}

interface Project {
  id: string; name: string; color: string
}

interface Store {
  todos: Record<string, Todo>
  todoOrder: string[]
  projects: Record<string, Project>
  projectOrder: string[]
  filters: { status: 'all' | 'active' | 'completed'; priority: string | null; projectId: string | null }
  addTodo: (text: string, priority: string, projectId: string) => void
  toggleTodo: (id: string) => void
  setFilter: (filters: Partial<Store['filters']>) => void
}

const useStore = create<Store>((set) => ({
  todos: {},
  todoOrder: [],
  projects: {},
  projectOrder: [],
  filters: { status: 'all', priority: null, projectId: null },
  addTodo: (text, priority, projectId) => set((s) => {
    const id = crypto.randomUUID()
    return {
      todos: { ...s.todos, [id]: { id, text, done: false, priority, projectId, createdAt: Date.now(), tags: [] } },
      todoOrder: [id, ...s.todoOrder],
    }
  }),
  toggleTodo: (id) => set((s) => ({
    todos: { ...s.todos, [id]: { ...s.todos[id], done: !s.todos[id].done } },
  })),
  setFilter: (partial) => set((s) => ({ filters: { ...s.filters, ...partial } })),
}))

// selectors.ts
const selectTodos = createSelector(
  [(s: Store) => s.todos, (s: Store) => s.todoOrder],
  (todos, order) => order.map((id) => todos[id]).filter(Boolean)
)

const selectFilteredTodos = createSelector(
  [selectTodos, (s: Store) => s.filters],
  (todos, filters) => todos.filter((t) => {
    if (filters.status === 'active' && t.done) return false
    if (filters.status === 'completed' && !t.done) return false
    if (filters.priority && t.priority !== filters.priority) return false
    if (filters.projectId && t.projectId !== filters.projectId) return false
    return true
  })
)

// Derived: grouped by project
const selectGroupedByProject = createSelector(
  [selectFilteredTodos, (s: Store) => s.projects],
  (todos, projects) => {
    const groups: Record<string, { project: Project; todos: Todo[] }> = {}
    for (const todo of todos) {
      const pid = todo.projectId
      if (!groups[pid]) groups[pid] = { project: projects[pid], todos: [] }
      groups[pid].todos.push(todo)
    }
    return Object.values(groups).sort((a, b) => a.project.name.localeCompare(b.project.name))
  }
)

// Derived: stats
const selectStats = createSelector(
  [selectTodos],
  (todos) => ({
    total: todos.length,
    active: todos.filter((t) => !t.done).length,
    completed: todos.filter((t) => t.done).length,
    highPriority: todos.filter((t) => t.priority === 'high' && !t.done).length,
    completionRate: todos.length > 0 ? todos.filter((t) => t.done).length / todos.length : 0,
  })
)

// Derived: search results
const selectSearchResults = createSelector(
  [selectFilteredTodos, (_, query: string) => query],
  (todos, query) => {
    if (!query.trim()) return todos
    const lower = query.toLowerCase()
    return todos.filter((t) => t.text.toLowerCase().includes(lower))
  }
)

// Components
function TodoApp() {
  const grouped = useStore(selectGroupedByProject, shallow)
  const stats = useStore(selectStats, shallow)

  return (
    <div>
      <StatsPanel stats={stats} />
      {grouped.map(({ project, todos }) => (
        <ProjectSection key={project.id} project={project} todos={todos} />
      ))}
    </div>
  )
}

function SearchResults({ query }: { query: string }) {
  const results = useStore((s) => selectSearchResults(s, query))
  return <List items={results} />
}
```

Key design: store contains only raw state (`todos: Record`, `filters`). Every view component derives what it needs. Adding "todos due today" view = one new derived selector. No store change.

> **Think**: The stats selector iterates all todos. If a single todo toggles done, does the entire component tree re-render?
>
> *Answer: Only if memoization fails. selectStats uses createSelector — recomputes only when `selectTodos` output changes (new/removed todo) or individual todo done property changes (because done is used inside filter). React re-renders only components subscribed to changed selectors. StatsPanel gets new stats object. Grouped view only re-renders if filtered list changed.*

### Testing Derived State — Unit Test Selectors Directly

Derived selectors are pure functions. Test them without store or React:

```typescript
// selectors.test.ts
import { describe, it, expect } from 'vitest'
import { selectFilteredTodos, selectStats, selectGroupedByProject } from './selectors'

const mockState = {
  todos: {
    '1': { id: '1', text: 'Learn Zustand', done: true, priority: 'high', projectId: 'p1', createdAt: 100, tags: [] },
    '2': { id: '2', text: 'Build project', done: false, priority: 'medium', projectId: 'p1', createdAt: 200, tags: [] },
    '3': { id: '3', text: 'Write docs', done: false, priority: 'low', projectId: 'p2', createdAt: 300, tags: [] },
  },
  todoOrder: ['1', '2', '3'],
  projects: {
    'p1': { id: 'p1', name: 'Core', color: 'blue' },
    'p2': { id: 'p2', name: 'Docs', color: 'green' },
  },
  filters: { status: 'all', priority: null, projectId: null },
  addTodo: () => {},
  toggleTodo: () => {},
  setFilter: () => {},
}

describe('selectFilteredTodos', () => {
  it('returns all todos when filter status is all', () => {
    const result = selectFilteredTodos(mockState)
    expect(result).toHaveLength(3)
  })

  it('filters active todos when status is active', () => {
    const state = { ...mockState, filters: { ...mockState.filters, status: 'active' } }
    const result = selectFilteredTodos(state)
    expect(result).toHaveLength(2)
    expect(result.every((t) => !t.done)).toBe(true)
  })

  it('filters by priority', () => {
    const state = { ...mockState, filters: { ...mockState.filters, priority: 'high' } }
    const result = selectFilteredTodos(state)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })
})

describe('selectStats', () => {
  it('computes correct counts', () => {
    const stats = selectStats(mockState)
    expect(stats.total).toBe(3)
    expect(stats.active).toBe(2)
    expect(stats.completed).toBe(1)
    expect(stats.completionRate).toBeCloseTo(0.333)
  })
})

describe('selectGroupedByProject', () => {
  it('groups todos by project sorted alphabetically', () => {
    const groups = selectGroupedByProject(mockState)
    expect(groups).toHaveLength(2)
    expect(groups[0].project.name).toBe('Core')
    expect(groups[1].project.name).toBe('Docs')
    expect(groups[0].todos).toHaveLength(2)
    expect(groups[1].todos).toHaveLength(1)
  })
})
```

Test characteristics:
- No store creation, no React rendering, no mocking
- Each selector tested with representative state shapes
- Edge cases: empty state, all-completed, no-matching-filter
- Output assertions on both value and structure

For memoized selectors, verify cache behavior:

```typescript
it('memoizes result when inputs unchanged', () => {
  const first = selectFilteredTodos(mockState)
  const second = selectFilteredTodos(mockState) // same state reference
  expect(first).toBe(second) // same reference — cached
})
```

> **Think**: Why test selectors directly instead of through store integration tests?
>
> *Answer: (1) Speed: selector test is microseconds vs store test is milliseconds. (2) Isolation: selector test fails only if selector logic is wrong, not if store setup is wrong. (3) Coverage: direct call with edge case states that are hard to produce through store actions. (4) Debugging: failing selector test pinpoints exact input + expected output.*

---

### Why This Matters

Derived state is the difference between a store that scales and a store that becomes a tangled mess. Raw state-only stores grow monotonically — every new feature adds more fields, more sync logic, more bug surface. Derived state stores let you add features by writing selectors: no store changes, no migrations, no desync bugs. For a team building a real app, mastering derived state means every view is as fast as the rawest selector graph allows. Without it, stores grow to 50+ fields with 15 manual "synchronization" calls that inevitably drift. This module is the foundation for normalized data, search, filtering, and the testing module that follows.

---

### Common Questions

**Q: Should derived state be a selector or a hook?**
A: Selector. Hooks couple derivation to React component lifecycle. Selectors are pure functions — testable, composable, framework-agnostic. Export selector as hook wrapper (`useFilteredTodos = () => useStore(selectFilteredTodos)`) for ergonomics, but keep derivation logic in pure selectors.

**Q: When should I store derived state instead of computing it?**
A: Only when measurement proves selector recomputation is a bottleneck. Storing derived state adds sync surface — every mutation must update both source and derived field. Two exceptions: (1) value is extremely expensive to compute and changes rarely, (2) value must be persisted (e.g., cache of API response shape).

**Q: Reselect createSelector vs zustand middleware for computed state?**
A: createSelector is lighter, more testable, and works outside Zustand. Zustand computed middleware (e.g., `computed` from `zustand-computed`) adds computed fields to store state object — convenient but couples derivation to store shape. Prefer createSelector for most cases; use computed middleware only when you need derived values in middleware or subscribers that access `getState()`.

**Q: Can derived selectors trigger side effects?**
A: No. Selectors are pure functions used during render and subscription diff. Side effects in selectors cause unpredictable behavior: double-firing in StrictMode, stale closures, impossible-to-trace bugs. Side effects belong in store actions, middleware, or subscribe handlers.

**Q: How does normalized + derived compare to using Jotai atoms?**
A: Jotai atoms are inherently derived — each atom computes from other atoms. Zustand + derived selectors achieves same effect: normalized store as root atom, selectors as derived atoms. Zustand gives explicit control over memoization and caching; Jotai gives automatic fine-grained reactivity. Choose Zustand when you want explicit selector graph; choose Jotai when you want automatic dependency tracking.

---

## Examples

### Example 1: E-Commerce Product Catalog with Derived Filters

**Problem**: Product store with 5000 products. Need filtered, sorted, paginated, and aggregated views derived from flat product data.

```typescript
interface ProductStore {
  products: Record<string, Product>
  productIds: string[]
  categories: Record<string, Category>
  cart: Record<string, number>  // productId -> quantity
  filters: {
    category: string | null
    minPrice: number
    maxPrice: number
    inStock: boolean | null
    sortBy: 'price-asc' | 'price-desc' | 'name' | 'rating'
    search: string
  }
  page: number
  pageSize: number
}

// Derived: filtered products
const selectFilteredProducts = createSelector(
  [(s: ProductStore) => s.products, (s: ProductStore) => s.productIds, (s: ProductStore) => s.filters],
  (products, ids, filters) => {
    let result = ids.map((id) => products[id]).filter(Boolean)
    if (filters.category) result = result.filter((p) => p.categoryId === filters.category)
    if (filters.inStock !== null) result = result.filter((p) => p.stock > 0 === filters.inStock)
    if (filters.search) {
      const q = filters.search.toLowerCase()
      result = result.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
    }
    result = result.filter((p) => p.price >= filters.minPrice && p.price <= filters.maxPrice)
    if (filters.sortBy === 'price-asc') result.sort((a, b) => a.price - b.price)
    if (filters.sortBy === 'price-desc') result.sort((a, b) => b.price - a.price)
    if (filters.sortBy === 'rating') result.sort((a, b) => b.rating - a.rating)
    return result
  }
)

// Derived: paginated slice
const selectPage = createSelector(
  [selectFilteredProducts, (s: ProductStore) => s.page, (s: ProductStore) => s.pageSize],
  (products, page, pageSize) => {
    const start = (page - 1) * pageSize
    return products.slice(start, start + pageSize)
  }
)

// Derived: aggregation
const selectCategoryAggregates = createSelector(
  [selectFilteredProducts, (s: ProductStore) => s.categories],
  (products, categories) => {
    const counts: Record<string, { name: string; count: number; avgPrice: number }> = {}
    for (const p of products) {
      const cat = p.categoryId
      if (!counts[cat]) counts[cat] = { name: categories[cat]?.name ?? 'Unknown', count: 0, avgPrice: 0 }
      counts[cat].count++
      counts[cat].avgPrice = (counts[cat].avgPrice * (counts[cat].count - 1) + p.price) / counts[cat].count
    }
    return Object.values(counts)
  }
)

// Derived: cart summary
const selectCartSummary = createSelector(
  [(s: ProductStore) => s.products, (s: ProductStore) => s.cart],
  (products, cart) => {
    const entries = Object.entries(cart).filter(([_, qty]) => qty > 0)
    return {
      itemCount: entries.reduce((sum, [_, qty]) => sum + qty, 0),
      total: entries.reduce((sum, [productId, qty]) => sum + (products[productId]?.price ?? 0) * qty, 0),
      items: entries.map(([productId, qty]) => ({
        product: products[productId],
        quantity: qty,
        subtotal: (products[productId]?.price ?? 0) * qty,
      })),
    }
  }
)
```

Store has 4 raw fields (products, categories, cart, filters). Every view is derived. Adding "filter by rating" requires 0 store changes — one new condition in selectFilteredProducts.

### Example 2: Replacing Stored Derived State with Selectors

**Problem**: Existing store stores derived state redundantly. 3 sync bugs this month.

```typescript
// Before — storing derived state (buggy)
interface BadStore {
  posts: Post[]
  totalLikes: number  // derived
  topPost: Post | null // derived
  sortedPosts: Post[] // derived
  stats: { avgLikes: number; postCount: number; uniqueAuthors: number } // derived

  addPost: (post: Post) => void
  likePost: (postId: string) => void
  // Every action must manually sync all derived fields
}
```

Refactored to derived selectors:

```typescript
// After — compute on demand (no sync surface)
interface GoodStore {
  posts: Post[]
  addPost: (post: Post) => void
  likePost: (postId: string) => void
}

// All derived state lives in selectors
const selectTotalLikes = (s: GoodStore) =>
  s.posts.reduce((sum, p) => sum + p.likes, 0)

const selectTopPost = (s: GoodStore) =>
  s.posts.reduce((best, p) => p.likes > (best?.likes ?? 0) ? p : best, s.posts[0] ?? null)

const selectSortedPosts = (s: GoodStore) =>
  [...s.posts].sort((a, b) => b.createdAt - a.createdAt)

const selectStats = createSelector(
  [(s: GoodStore) => s.posts],
  (posts) => ({
    avgLikes: posts.length > 0 ? posts.reduce((s, p) => s + p.likes, 0) / posts.length : 0,
    postCount: posts.length,
    uniqueAuthors: new Set(posts.map((p) => p.author)).size,
  })
)
```

Result: store shrinks from 7 fields to 2. Zero sync bugs because sync is impossible (nothing to sync). Adding "most commented post" is one new selector — no store migration.

### Example 3: Multi-Level Derived Views for Analytics Dashboard

**Problem**: Dashboard showing team performance. Raw data: time entries. Need per-user, per-project, per-week aggregations.

```typescript
interface TimeStore {
  entries: TimeEntry[]  // { userId, projectId, hours, date }
  users: Record<string, User>
  projects: Record<string, Project>
}

// Level 1: group by user
const selectEntriesByUser = createSelector(
  [(s: TimeStore) => s.entries],
  (entries) => {
    const grouped: Record<string, TimeEntry[]> = {}
    for (const e of entries) {
      if (!grouped[e.userId]) grouped[e.userId] = []
      grouped[e.userId].push(e)
    }
    return grouped
  }
)

// Level 2: per-user totals
const selectUserTotals = createSelector(
  [selectEntriesByUser, (s: TimeStore) => s.users],
  (byUser, users) => Object.entries(byUser).map(([userId, entries]) => ({
    user: users[userId],
    totalHours: entries.reduce((s, e) => s + e.hours, 0),
    entryCount: entries.length,
    projectBreakdown: entries.reduce((b, e) => {
      b[e.projectId] = (b[e.projectId] ?? 0) + e.hours
      return b
    }, {} as Record<string, number>),
  }))
)

// Level 3: team summary
const selectTeamSummary = createSelector(
  [selectUserTotals],
  (userTotals) => ({
    totalHours: userTotals.reduce((s, u) => s + u.totalHours, 0),
    avgHoursPerUser: userTotals.length > 0
      ? userTotals.reduce((s, u) => s + u.totalHours, 0) / userTotals.length
      : 0,
    topPerformer: userTotals.sort((a, b) => b.totalHours - a.totalHours)[0]?.user ?? null,
    busiestProject: Object.entries(
      userTotals.reduce((acc, u) => {
        for (const [pid, hours] of Object.entries(u.projectBreakdown)) {
          acc[pid] = (acc[pid] ?? 0) + hours
        }
        return acc
      }, {} as Record<string, number>)
    ).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
  })
)
```

Three level graph: raw → per-user → team summary. Each level memoized. Adding "per-week view" inserts at level 1.5 without affecting existing selectors.

---

## Key Takeaways
- Derive instead of store: computed values from raw state eliminate sync bugs and reduce store surface
- Pure functions: derived selectors are testable pure functions — test without React or store instance
- createSelector memoization: cache expensive derivations, recompute only when inputs change
- Selector composition graph: raw atoms → derived → composed. Each level independently testable and memoized
- Normalized store + derived views: store flat entities, reshape via selectors for each view
- Performance: derive in selector by default. Memoize when recomputation cost matters. Store only when measured bottleneck
- get() computed: for simple, rarely-accessed derivations outside React
- useMemo in render: stabilize complex selector return values, but prefer memoized selectors or shallow equality
- Testing: direct selector calls with mock state. Fast, isolated, high coverage
- Real pattern: todo list with filter, group, search, stats — 4 derived selectors, 0 stored computed fields

## Common Misconception

**"Derived state in selectors is wasteful because selectors run on every state change."**

This misunderstands memoization. Non-memoized derived selectors do run on every state diff — but the cost of a pure computation is often negligible (microseconds). Memoized selectors (createSelector) run only when their inputs change — for most apps, this means zero recomputation in 99% of state diffs. The alternative — storing derived state — guarantees bugs from desync. Derived selectors trade negligible CPU cost for correctness guarantees. Always prefer derivation over duplication. Only optimize when profiler shows selector recomputation in the hot path.

---

## Feynman Explain
(Explain derived state to a junior developer who understands Excel or SQL. Analogy: store state = raw data table. Derived selectors = spreadsheet formulas (SUMIF, FILTER) or SQL views. You don't store totals in the raw table — you compute them. Why? Because if you update a row, totals auto-update. Same in Zustand: store raw values, compute views via selectors. Draw: raw table → filter → group → aggregate → chart. Each step is a selector. Changes propagate automatically.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain zustand-state-management` — AI probes gaps.*

---

## Reframe
(Pause. Critique: Is "derive everything" always correct? What about state that is expensive to compute and rarely changes — like a full-text search index? Counter-argument: some derived state is worth storing (cache) if compute cost > storage cost and staleness tolerance exists. Where is the line? Also: selector composition graph can become complex — debugging a chain of 10 nested selectors is harder than reading a single function. Does composition always win? Write your evaluation — consider trade-offs between purity, performance, and debuggability.)

---

## Drill
Take the quiz. MCQs test derived state concept, memoization, selector composition, normalized stores, and testing patterns.

Run: `learn.sh quiz zustand-state-management 11-derived-state`
