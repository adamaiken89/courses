# Module 19: Migration — useReducer, Context, Redux Toolkit to Zustand

Est. study time: 2.5h
Language: en

## Learning Objectives
- Design incremental migration strategy from legacy state management to Zustand
- Migrate useReducer + Context, Context-only, and Redux Toolkit codebases to Zustand
- Implement coexistence layer for running old and new systems side-by-side
- Apply team adoption patterns: naming conventions, migration checklist, testing strategy

---

## Core Content

### Migration Strategy: Incremental, Not Big Bang

Single largest cause of migration failure: rewriting everything at once. Big bang rewrites create risk surface proportional to codebase size. Testing impossible. Rollback impossible. Teams ship 6 months later with no safety net.

**Incremental migration principles:**

1. **Strangler fig pattern**: new system grows alongside old. Old code routes to new system piece by piece. Old system deleted only when all consumers migrated.
2. **Module boundary**: migrate one feature at a time. Feature A uses Zustand. Feature B still uses Redux. Both coexist.
3. **No shared mutable state** across old/new during migration. Each system owns its state. Synchronize only at boundaries (e.g., auth token changes).
4. **Feature flag**: toggle between old and new implementation per feature. Rollback flips flag.

```typescript
// Feature flag per module during migration
const migrationFlags = {
  auth: 'redux' as 'redux' | 'zustand',
  todos: 'redux',
  cart: 'zustand',
}
```

5. **Parallel run**: both old and new stores process same events. Compare outputs. Detect divergence before users do.

> **Think**: Your team has 1 month to migrate a critical checkout flow. Big bang or incremental? What happens if the 1-month deadline misses?
>
> *Answer: Incremental. Deadline miss with big bang = whole checkout broken, no partial rollback, no deploy. Incremental: pause migration at current module, ship partial. Checkout works with hybrid state — some modules on Zustand, rest on Redux. Deadline miss = acceptable, not catastrophic.*

### Strategy Spectrum

| Strategy | Risk | Speed | Rollback | Best for |
|----------|------|-------|----------|----------|
| Big bang | Very high | Fastest | None | Greenfield (<1k LOC) |
| Module-by-module | Low | Medium | Per module | >10k LOC legacy |
| Strangler fig | Low | Slow | Full | >50k LOC monolith |
| Parallel run | Low | Slowest | Instant | Safety-critical features |
| Feature flag | Medium | Medium | Per flag | Experimentation culture |

> **Think**: A 200k LOC e-commerce app with 100+ reducers. Which strategy? What's the first module you migrate?
>
> *Answer: Strangler fig + module-by-module combination. First module: smallest independent feature (e.g., theme toggle, notification preferences). Low risk, teaches team the pattern, builds confidence. Never start with auth or checkout.*

### useReducer → Zustand: Extract Reducer Logic into Store Actions

Pattern is mechanical. Each reducer case becomes a store method:

**Before (useReducer)**:
```typescript
// reducer.ts
type Action =
  | { type: 'increment'; payload: number }
  | { type: 'decrement'; payload: number }
  | { type: 'reset' }

function counterReducer(state: CounterState, action: Action): CounterState {
  switch (action.type) {
    case 'increment':
      return { ...state, count: state.count + action.payload }
    case 'decrement':
      return { ...state, count: state.count - action.payload }
    case 'reset':
      return { ...state, count: 0 }
    default:
      return state
  }
}

// Component
function Counter() {
  const [state, dispatch] = useReducer(counterReducer, initialState)
  return <button onClick={() => dispatch({ type: 'increment', payload: 1 })}>
    {state.count}
  </button>
}
```

**After (Zustand)**:
```typescript
import { create } from 'zustand'

interface CounterStore {
  count: number
  increment: (by: number) => void
  decrement: (by: number) => void
  reset: () => void
}

const useCounterStore = create<CounterStore>((set) => ({
  count: 0,
  increment: (by) => set((state) => ({ count: state.count + by })),
  decrement: (by) => set((state) => ({ count: state.count - by })),
  reset: () => set({ count: 0 }),
}))

// Component
function Counter() {
  const count = useCounterStore((s) => s.count)
  const increment = useCounterStore((s) => s.increment)
  return <button onClick={() => increment(1)}>{count}</button>
}
```

**Migration steps:**
1. Create Zustand store file with same initial state
2. Convert each reducer case into store method using `set()`
3. Remove action type definitions
4. Update component: `dispatch({ type: 'increment', payload: 1 })` → `store.increment(1)`
5. Remove reducer file and `useReducer` import

**For useReducer + Context** (Redux-lite pattern):
1. Create Zustand store mirroring context state + actions
2. Replace each `useContext(MyContext)` with `useMyStore(selector)` — one component at a time
3. Remove `MyContext.Provider` from tree once no consumers remain
4. Delete context definition file

> **Think**: A reducer handles 30 action types for a complex dashboard. Each case has 5-15 lines. Migration scales linearly per action — yes or no?
>
> *Answer: Yes. Each case becomes one store method. Method body is smaller (no action type extraction, no switch wrapper). Migration is mechanical — same logic, different container. Automation: ts-morph codemod can read reducer switch and emit Zustand store methods for 80% of cases.*

### Context → Zustand: Replace Provider + useContext with useStore

Context replacement is the highest-impact migration per line changed. Eliminates provider wrapping and re-render cascades.

**Before (Context)**:
```typescript
const AuthContext = createContext<Auth | null>(null)

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const login = async (email: string, pw: string) => {
    const res = await api.login(email, pw)
    setUser(res.user)
  }
  const logout = () => setUser(null)
  const value = useMemo(() => ({ user, login, logout }), [user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
```

**After (Zustand)**:
```typescript
import { create } from 'zustand'

interface AuthStore {
  user: User | null
  login: (email: string, pw: string) => Promise<void>
  logout: () => void
}

const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  login: async (email, pw) => {
    const res = await api.login(email, pw)
    set({ user: res.user })
  },
  logout: () => set({ user: null }),
}))

// Component
function Avatar() {
  const user = useAuthStore((s) => s.user) // re-renders only on user change
  if (!user) return <LoginButton />
  return <img src={user.avatar} />
}
```

**Migration algorithm:**
1. Create Zustand store with same state + actions as context
2. Replace `useContext + useMemo` with `useStore(selector)` in each consumer — one component at a time
3. Remove `Provider` wrapper from tree once all consumers migrated
4. Delete context definition

**Prevent divergence**: during migration, a component must not use both `useContext(AuthContext)` and `useAuthStore()`. Values diverge. Solution: hydrate Zustand store from context on init, or enforce lint rule banning old context hook.

> **Think**: Context provides 10 values. Component A reads 2, component B reads 8. After migration, how do component tests change?
>
> *Answer: Context tests need `<AuthProvider><ComponentA /></AuthProvider>`. Zustand tests: `useAuthStore.setState({ user: testUser }); render(<ComponentA />)`. No wrapper. Faster setup, less nesting, clearer intent.*

### Redux Toolkit → Zustand: Slice to Store, createAsyncThunk to Async Actions

Redux Toolkit patterns map directly. The reducer cases, actions, and thunks each have Zustand equivalents.

**Slice → Store:**

| Redux Toolkit | Zustand |
|---------------|---------|
| `createSlice({ name, initialState, reducers })` | `create<Store>()((set) => ({ ...state, ...actions }))` |
| `configureStore({ reducer })` | Single `create()` call |
| `<Provider store={store}>` | No provider |
| `useSelector(selector)` | `useStore(selector)` |
| `useDispatch()` | `store.action()` or `getState().action()` |

**Before (RTK slice)**:
```typescript
const todosSlice = createSlice({
  name: 'todos',
  initialState: { items: [] as Todo[], loading: false },
  reducers: {
    addTodo: (state, action: PayloadAction<Todo>) => {
      state.items.push(action.payload)
    },
    removeTodo: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(t => t.id !== action.payload)
    },
  },
})

const store = configureStore({
  reducer: { todos: todosSlice.reducer, auth: authSlice.reducer },
})
```

**After (Zustand)**:
```typescript
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface TodosStore {
  items: Todo[]
  loading: boolean
  addTodo: (todo: Todo) => void
  removeTodo: (id: string) => void
}

const useTodosStore = create<TodosStore>()(
  devtools(
    (set) => ({
      items: [],
      loading: false,
      addTodo: (todo) => set((state) => ({
        items: [...state.items, todo],
      }), false, 'todos/addTodo'),
      removeTodo: (id) => set((state) => ({
        items: state.items.filter(t => t.id !== id),
      }), false, 'todos/removeTodo'),
    }),
    { name: 'todos-store' }
  )
)
```

**createAsyncThunk → async action:**

**Before (RTK thunk)**:
```typescript
const fetchTodos = createAsyncThunk(
  'todos/fetch',
  async (userId: string) => {
    const res = await api.get(`/users/${userId}/todos`)
    return res.data
  }
)

// Handled in extraReducers:
// pending → loading=true
// fulfilled → items=payload, loading=false
// rejected → error=payload, loading=false
```

**After (Zustand async action)**:
```typescript
interface TodosStore {
  items: Todo[]
  loading: boolean
  error: string | null
  fetchTodos: (userId: string) => Promise<void>
}

const useTodosStore = create<TodosStore>()(
  devtools(
    (set) => ({
      items: [],
      loading: false,
      error: null,
      fetchTodos: async (userId) => {
        set({ loading: true, error: null }, false, 'todos/fetch/pending')
        try {
          const res = await api.get(`/users/${userId}/todos`)
          set({ items: res.data, loading: false }, false, 'todos/fetch/fulfilled')
        } catch (err) {
          set({ error: (err as Error).message, loading: false }, false, 'todos/fetch/rejected')
        }
      },
    }),
    { name: 'todos-store' }
  )
)
```

The thunk lifecycle (pending/fulfilled/rejected) is explicit in the action body. Redux Toolkit's `createAsyncThunk` auto-generates these states; Zustand requires manual `set()` calls. The tradeoff: less magic, more control.

**Multi-slice store**:
```typescript
// RTK: configureStore({ reducer: { todos, auth, cart } })
// Zustand: separate stores, or one store with slice pattern
const useTodosStore = create<TodosStore>(...)
const useAuthStore = create<AuthStore>(...)
const useCartStore = create<CartStore>(...)
```

Separate stores are idiomatic Zustand. No `combineReducers`. No root reducer. Each store is independent module.

> **Think**: RTK slice has 4 reducers and 2 createAsyncThunks. What is the LOC reduction migrating to Zustand?
>
> *Answer: RTK: ~80 lines (slice + thunks + types). Zustand: ~45 lines (store + types). Reduction: ~44%. No configureStore. No Provider. No slice. No extraReducers thunk wiring.*

### Coexistence: Running Old + New During Migration

Two systems operate alongside each other for weeks or months. Coexistence must be explicit, not accidental.

**Strategy 1: Separate domains, no overlap**

Clear boundary: Feature A → Zustand. Feature B → Redux. Both never touch same state slice. Simplest approach. Works when domain decomposition is clean.

**Strategy 2: Shared state bridge**

One state slice must be read by both systems (e.g., auth token). Bridge via subscription:

```typescript
// Zustand store subscribes to Redux store changes
import { store as reduxStore } from './redux-store'
import { useAuthStore } from './zustand-auth-store'

reduxStore.subscribe(() => {
  const reduxAuth = reduxStore.getState().auth
  const zustandAuth = useAuthStore.getState()
  if (reduxAuth.token !== zustandAuth.token) {
    useAuthStore.setState({ token: reduxAuth.token })
  }
})
```

**Strategy 3: Facade layer**

Abstraction over state management implementation. Components talk to facade, not to Redux or Zustand directly:

```typescript
// Before: components import Redux hooks directly
// After: components import from facade
class AuthGateway {
  async login(email: string, pw: string): Promise<User> {
    if (migrationFlags.auth === 'redux') {
      return reduxLogin(email, pw)
    }
    return useAuthStore.getState().login(email, pw)
  }
}
```

Facade pattern lets you flip the switch per module without changing component code.

**Strategy 4: Dual-write with compare**

Both stores process every action. Compare outputs. Log divergence:

```typescript
function dualWrite(action: TodoAction) {
  reduxStore.dispatch(action)
  useTodosStore.getState().dispatch(action)

  const reduxTodos = reduxStore.getState().todos.items
  const zustandTodos = useTodosStore.getState().items
  if (JSON.stringify(reduxTodos) !== JSON.stringify(zustandTodos)) {
    console.error('DIVERGENCE:', { action, reduxTodos, zustandTodos })
  }
}
```

Dual-write builds confidence before cutting over. Use in staging environment.

> **Think**: Dual-write detects divergence. What causes it? How do you fix?
>
> *Answer: Divergence sources: (1) reducer logic difference — RTK Immer mutations vs Zustand manual spreads produce different results for edge cases (nested undefined, array mutations). (2) Timing — async thunk vs async action resolve order differs. (3) Middleware — Redux middleware transforms actions before reducer; Zustand has no middleware pipeline. Fix: unit-test both reducers with same inputs, align implementation.*

### Wrapping Legacy Patterns in Zustand: Adapter Layer

Some patterns are deeply embedded: redux-saga watchers, reselect memoized selectors, normalized state via `createEntityAdapter`. Adapter layer preserves these while living inside Zustand.

**Saga-like effect in Zustand**:
```typescript
// Old: saga watches 'todos/add', then triggers notification saga
// New: effect function called after action
interface TodosStore {
  items: Todo[]
  addTodo: (todo: Todo) => void
}

const useTodosStore = create<TodosStore>((set, get) => ({
  items: [],
  addTodo: (todo) => {
    set((state) => ({ items: [...state.items, todo] }))
    // Effect orchestration — side effect after state update
    if (todo.priority === 'high') {
      notificationService.sendAlert(todo)
    }
  },
}))
```

**Reselect → derived value**:
```typescript
// Old: createSelector([selectTodos, selectFilter], (todos, filter) => ...)
// New: computed value inside store or via useMemo in component

// Option 1: Store-level derived value
interface TodosStore {
  items: Todo[]
  filter: string
  visibleTodos: () => Todo[]
}

const useTodosStore = create<TodosStore>((set, get) => ({
  items: [],
  filter: 'all',
  visibleTodos: () => {
    const { items, filter } = get()
    if (filter === 'done') return items.filter(t => t.done)
    if (filter === 'active') return items.filter(t => !t.done)
    return items
  },
}))

// Option 2: useMemo in component
function TodoList() {
  const items = useTodosStore((s) => s.items)
  const filter = useTodosStore((s) => s.filter)
  const visible = useMemo(() => {
    if (filter === 'done') return items.filter(t => t.done)
    return items
  }, [items, filter])
  return <ul>{visible.map(t => <li key={t.id}>{t.text}</li>)}</ul>
}
```

**createEntityAdapter → indexed store**:
```typescript
// Old: normalized state with ids + entities + CRUD selectors
// New: Zustand with manual normalized shape

interface NormalizedStore {
  entities: Record<string, Todo>
  ids: string[]
  addOne: (entity: Todo) => void
  updateOne: (id: string, changes: Partial<Todo>) => void
  removeOne: (id: string) => void
  selectById: (id: string) => Todo | undefined
  selectIds: () => string[]
}

const useTodosStore = create<NormalizedStore>((set, get) => ({
  entities: {},
  ids: [],
  addOne: (entity) => set((state) => ({
    entities: { ...state.entities, [entity.id]: entity },
    ids: state.ids.includes(entity.id) ? state.ids : [...state.ids, entity.id],
  })),
  updateOne: (id, changes) => set((state) => ({
    entities: {
      ...state.entities,
      [id]: { ...state.entities[id], ...changes },
    },
  })),
  removeOne: (id) => {
    const { [id]: _, ...rest } = get().entities
    set({ entities: rest, ids: get().ids.filter(i => i !== id) })
  },
  selectById: (id) => get().entities[id],
  selectIds: () => get().ids,
}))
```

No built-in entity adapter in Zustand. The pattern is 20 lines — less than importing `@reduxjs/toolkit` + `createEntityAdapter` + selectors.

> **Think**: A sagas-heavy codebase with 10 watchers. How do you migrate sagas to Zustand without rewriting business logic?
>
> *Answer: Extract saga business logic into standalone async functions. Sagas call these functions after taking actions. Zustand action methods call these functions directly. The saga orchestrator (take, fork, cancel) is replaced with function calls inside store methods. Saga cancellation (takeLatest) becomes abort controller pattern. Saga race becomes Promise.race.*

### Testing During Migration: Dual Tests for Old and New

Migration requires two test strategies: (1) unit tests for migrated stores to verify logic parity, and (2) integration tests to ensure old + new systems coexist without interference.

**Parity test: same inputs, same outputs**:
```typescript
describe('migration parity: todos', () => {
  it('addTodo produces same state in Redux and Zustand', () => {
    // Redux
    const reduxStore = configureStore({ reducer: { todos: todosReducer } })
    reduxStore.dispatch(todosSlice.actions.addTodo({ id: '1', text: 'test', done: false }))
    const reduxState = reduxStore.getState().todos

    // Zustand
    useTodosStore.setState({ items: [], loading: false })
    useTodosStore.getState().addTodo({ id: '1', text: 'test', done: false })
    const zustandState = useTodosStore.getState()

    expect(zustandState.items).toEqual(reduxState.items)
  })
})
```

**Coexistence test: no cross-contamination**:
```typescript
describe('coexistence', () => {
  it('Zustand auth store does not affect Redux todos', () => {
    useAuthStore.setState({ user: { name: 'Alice' } })
    const reduxTodos = reduxStore.getState().todos
    expect(reduxTodos).toBeDefined()
    // Verify Zustand mutation did not accidentally touch Redux state
    // (This would fail if stores are incorrectly bridged)
  })
})
```

**Performance regression test: re-render count**:
```typescript
// Measure re-render count before and after migration
// Use React profiler or custom tracking
test('component re-renders not increased after migration', () => {
  const renderCount = { current: 0 }
  const Original = renderCount => {
    renderCount.current++
    // ...
  }
  // ... measure before migration (Context) vs after (Zustand)
})
```

**Test migration safety rule**: every test from old system must have equivalent in new system before cutover. Use test matrix:

| Test type | Old system | New system | Parity required |
|-----------|------------|------------|-----------------|
| Reducer unit | ✓ | ✓ | Same test inputs, same outputs |
| Store integration | ✓ | ✓ | Same action sequence, same state |
| Component render | ✓ | ✓ | Same output for same state |
| Performance | ✓ | ✓ | Re-render count ≤ old system |
| Coexistence | - | ✓ | No cross-contamination |

> **Think**: You have 200 reducer tests in Redux. How many should you write for Zustand?
>
> *Answer: 200 parity tests — one per existing test. But these are mechanical: same input, different API call (reduxStore.dispatch → zustandStore.getState().action). Can be generated by iterating over action fixtures. After parity confirmed, reduce to 50 meaningful integration tests. The rest are redundant when logic is identical.*

### Performance Comparison: Before and After Migration

Migration should improve performance, not regress it. Measure before starting.

**Metrics to track**:

| Metric | How to measure | Migration target |
|--------|----------------|------------------|
| Re-render count | React DevTools Profiler | ≤50% of old system |
| Render time | `performance.mark()` | ≤80% of old system |
| Provider mount cost | `<Profiler>` on root | Eliminated (0) |
| Memory usage | Chrome heap snapshot | Equal or better |
| Bundle size | `npx source-map-explorer` | -10KB+ (Redux 12KB) |

**Before migration baseline**:
```typescript
// Use React Profiler to record
// <Profiler id="app" onRender={(id, phase, actualDuration) => {}}>
// Measure: component re-renders on single state update
```

**After migration measurement**:
```typescript
// Same Profiler setup, same scenario
// Expected: re-renders drop from N to M (N=all context consumers, M=only subscribed selectors)
```

**Typical results**:

| Scenario | Context (re-renders) | Zustand (re-renders) | Improvement |
|----------|----------------------|----------------------|-------------|
| Single field change, 5 consumers | 5 | 1 | 5x |
| Dashboard update, 50 consumers | 50 | 8 | 6.25x |
| Theme toggle (1 consumer) | All consumers | 1 | N consumers |
| Form field update (20 fields) | 20 | 1 | 20x |

**Bundle size comparison**:

| Package | Size (min+gzip) |
|---------|-----------------|
| Redux | 2.5KB |
| React-Redux | 4.5KB |
| @reduxjs/toolkit | 11.5KB |
| **Total RTK** | ~18.5KB |
| Zustand | 1.1KB |
| Zustand + Immer | ~13KB (optional) |

Removing Redux saves ~17KB minimum. For mobile web, this is meaningful (10% of typical JS bundle).

> **Think**: A team says "migration is not worth it — re-renders are not our bottleneck." How do you validate?
>
> *Answer: Profile before arguing. If re-render count is low (<5 per user interaction) and frame rate is 60fps, migration priority is low. But also measure: (1) provider nesting depth — is developer experience suffering? (2) new feature velocity — are context limitations slowing devs? (3) bundle size — is Redux consuming meaningful mobile budget? Performance alone is rarely the only driver.*

### Team Adoption: Naming Conventions, Patterns Guide, Code Review Checklist

Migration fails without team alignment. Technical migration is easy; human migration is hard.

**Naming conventions**:

```
// Store files
stores/auth-store.ts          // PascalCase, -store suffix
stores/todos-store.ts
stores/cart-store.ts

// Store hooks (exported)
useAuthStore                  // use + PascalCase + Store
useTodosStore
useCartStore

// Store methods (actions)
login, logout                 // verbs, not dispatch({ type: 'auth/login' })
addTodo, removeTodo           // verb + noun, no action type strings
fetchTodos                    // async prefix for API calls

// Selectors (custom, non-trivial)
useAuthStore((s) => s.user)   // inline for simple selectors
createSelector for memoized   // only if computation-heavy
```

**Patterns guide** (one-pager for team reference):

```
ZUSTAND PATTERNS GUIDE
======================

1. One store per domain (auth, todos, cart, settings)
   NOT: one giant store

2. Actions are methods, not dispatched objects
   CORRECT: store.addTodo(todo)
   WRONG: store.dispatch({ type: 'ADD_TODO', payload: todo })

3. Selectors for granular subscriptions
   CORRECT: useStore((s) => s.user.name)
   WRONG: const { user } = useStore()  // full store subscription

4. Async actions are async methods
   CORRECT: store.fetchTodos()
   WRONG: custom middleware, thunks, sagas

5. Middleware used explicitly
   devtools for development
   persist for localStorage
   immer for deep state

6. Reset state on test setup
   beforeEach: useStore.setState(initialState)
```

**Code review checklist**:

```
MIGRATION CODE REVIEW
=====================
□ Store does not import from old state management
□ Actions are methods, not dispatch payloads
□ Selectors use granular subscription, not full store
□ Async actions handle pending/fulfilled/rejected explicitly
□ Devtools middleware present (development only)
□ No mixed patterns: old and new state not accessed in same component
□ Tests for parity (old → new)
□ Performance baseline recorded before migration
□ Feature flag or migration switch available
□ Old provider/reducer removed after all consumers migrated
```

> **Think**: A senior dev insists on keeping Redux action types inside Zustand (dispatch method with switch). How do you handle this in code review?
>
> *Answer: Discuss tradeoff. Action types inside Zustand add ceremony but may be bridge for Redux veterans. Accept for first module, but document as transitional pattern. After team is comfortable, refactor to method-based actions. Pragmatic compromise: "Keep dispatch pattern for now. In 2 weeks, we ship a refactor sprint to convert to methods."*

### Real Case Study: Migrating 50k LOC App from Redux to Zustand

Based on real migration of a SaaS dashboard application.

**Background**: B2B analytics dashboard. 50k LOC TypeScript. 35 Redux slices. 12 sagas. 8 Context providers. 4-person frontend team. Growing performance complaints (re-renders on data refresh). Feature velocity declining (every new feature requires slice + saga + selector).

**Decision to migrate**: Not for performance alone. Primary driver: developer experience. Secondary: bundle size (targeting mobile web). Third: context re-renders visible on slower machines.

**Strategy**: Strangler fig + module-by-module. One store per domain. No shared bridge — domains are independent.

**Timeline**:

| Phase | Duration | Work |
|-------|----------|------|
| 0 | 1 week | Setup: stores structure, patterns guide, test utilities, performance baseline |
| 1 | 3 weeks | Low-risk modules: theme, sidebar, notifications settings |
| 2 | 4 weeks | Medium complexity: user preferences, dashboard layout, filtering |
| 3 | 6 weeks | High complexity: auth (picked last because every component reads auth) |
| 4 | 2 weeks | Cleanup: remove Redux deps, delete old code, final performance measurement |

**Migration per module** (example: notifications):

```
Day 1:  Create stores/notifications-store.ts → 30 LOC
Day 1:  Add parity tests → 3 test cases
Day 2:  Replace useContext in 5 components → 1 component per PR
Day 3:  Add feature flag (old/new toggle)
Day 4:  Dual-write in staging — monitor for 48 hours
Day 5:  Cut over: flip flag to "zustand" for 10% → 50% → 100% over 3 days
Day 6:  Remove old Context provider + reducer
Day 7:  Delete parity tests (redundant), clean up flag
```

**Problems encountered**:

1. **Auth was not independent**: every Redux slice imported root state for auth token. Solution: Zustand auth store exposed token via `getState()`. Other stores read it as needed. No provider wrapping — just `useAuthStore((s) => s.token)`.

2. **Saga orchestration**: 12 sagas for side effects (notification after todo add, analytics on page change, WebSocket reconnect). Solution: extracted saga logic into standalone functions. Store methods call these functions directly. Saga cancellation (takeLatest on debounced search): converted to `AbortController` inside search action.

3. **Inconsistent state shape**: Redux normalized entities via `createEntityAdapter`. Zustand used flat arrays. Phase 3 migration required data migration from normalized to denormalized. Solution: adapter function that transforms Redux slice state to Zustand store initial state. Run once at migration cutover.

4. **Testing overhead**: 200 Redux reducer tests. Migration created 200 parity tests. After parity confirmed, team realized 150 tests were redundant — same logic, different API. Solution: delete parity tests after confidence threshold (2 weeks without divergence).

**Results after 16 weeks**:

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Bundle size | 285KB JS | 268KB JS | -17KB |
| Re-renders on data refresh | 47 components | 9 components | -81% |
| Provider nesting | 8 levels | 0 levels | -100% |
| New feature LOC | ~200 avg | ~120 avg | -40% |
| Test setup time (Context wrapping) | 30s per test file | 0s | Eliminated |
| P95 render time (data refresh) | 120ms | 45ms | -62.5% |

**Team feedback**: "Migration was painful in weeks 1-2 while learning Zustand patterns. By week 3, velocity increased. By week 8, no one misses Redux. New features ship faster because we write less code."

> **Think**: The case study shows 16 weeks for 50k LOC. Your app is 25k LOC. How long should you budget?
>
> *Answer: Not linear. ~8 weeks baseline + 2 weeks per complexity factor (if sagas + entity adapter + deep Context nesting). Budget 10-12 weeks. First module takes 2x longer than estimated. Schedule buffer: 30%. Aggregate: ~14 weeks for 25k LOC with moderate complexity.*

---

### Why This Matters

Migration from legacy state management to Zustand is not an academic exercise. Teams spend months wrestling with Context re-renders, Redux boilerplate, and sagas that obscure data flow. The cost is not just performance — it is developer velocity, onboarding time, and bug rates tied to complex state patterns. Incremental migration is the only safe path. The patterns in this module (coexistence, adapter layer, parity testing, feature flags) apply to any state management migration, not just Zustand. Teams that master incremental migration can upgrade state management without freezing feature development. This skill separates teams that are stuck on old patterns from teams that evolve their architecture continuously.

---

### Common Questions

**Q: What if we fail halfway through migration? Can we revert?**
A: Yes, if you use feature flags and module-by-module strategy. Flip flag to "redux" — old system resumes. Divergence risk: if Zustand store mutated state that Redux also manages, flipping back may leave dangling Zustand state. Solution: scope migration so each flag covers one independent domain. Reverting auth flag does not affect todos store.

**Q: Should we migrate tests first or store first?**
A: Store first, then parity tests, then component tests. Store migration is mechanical (reducer case → method). Parity tests validate correctness. Component tests confirm the UI works with new store. If you write component tests first, they depend on old API and you rewrite them anyway.

**Q: Does Zustand work with Next.js App Router?**
A: Yes, with caution. Zustand stores must be declared inside `'use client'` boundaries. Each page request on server creates fresh store. Pattern: `createStore` from `zustand/vanilla` for SSR-safe stores, wrap in client component. Do not use Zustand stores in Server Components — they are client-only.

**Q: How do we migrate normalized state (createEntityAdapter) to Zustand?**
A: Manual normalized store (entities + ids + CRUD methods) or use `valtio`/`proxy` for path-based mutations. Zustand has no built-in entity adapter. Write ~30 LOC of helper functions for addOne, updateOne, removeOne. The lack of built-in adapter is intentional — most apps do not need normalized state after moving to Zustand because selector granularity reduces the performance motivation for normalization.

**Q: What about Redux DevTools — do we lose time-travel debugging?**
A: No. Zustand's `devtools` middleware integrates with Redux DevTools extension. Named `set()` calls appear in timeline. Jump-to-state works. Time-travel rewind works. The only missing feature is action stack dispatch — Redux DevTools can re-dispatch a sequence of past actions; Zustand devtools replays snapshot, not action sequence. Practical difference: minimal.

---

## Examples

### Example 1: Migrating useReducer + Context (Todo App)

**Problem**: 30-component todo app using useReducer + Context. Performance complaints: toggling one todo re-renders entire list + sidebar (count summary).

**Migration**:

Step 1: Create Zustand store
```typescript
interface TodoStore {
  todos: Todo[]
  addTodo: (text: string) => void
  toggleTodo: (id: string) => void
  removeTodo: (id: string) => void
}

const useTodoStore = create<TodoStore>((set) => ({
  todos: [],
  addTodo: (text) => set((state) => ({
    todos: [...state.todos, { id: crypto.randomUUID(), text, done: false }],
  })),
  toggleTodo: (id) => set((state) => ({
    todos: state.todos.map(t => t.id === id ? { ...t, done: !t.done } : t),
  })),
  removeTodo: (id) => set((state) => ({
    todos: state.todos.filter(t => t.id !== id),
  })),
}))
```

Step 2: Migrate components one by one
```typescript
// Before
function TodoItem({ id }: { id: string }) {
  const { state, dispatch } = useTodoContext()
  const todo = state.todos.find(t => t.id === id)
  return (
    <li onClick={() => dispatch({ type: 'TOGGLE_TODO', payload: id })}>
      {todo?.text}
    </li>
  )
}

// After
function TodoItem({ id }: { id: string }) {
  const todo = useTodoStore((s) => s.todos.find(t => t.id === id))
  const toggleTodo = useTodoStore((s) => s.toggleTodo)
  return <li onClick={() => toggleTodo(id)}>{todo?.text}</li>
}
```

Step 3: Remove Context provider after last consumer migrated.

**Result**: Toggling todo re-renders only the toggled `<li>` + count display (subscribes to `(s) => s.todos.length`). Previously 30+ components re-rendered. User-visible jank eliminated.

### Example 2: Migrating Redux Toolkit (Dashboard with Async Thunks)

**Problem**: Dashboard with 10 RTK slices, 5 async thunks. Data refresh re-renders entire dashboard. Team wants to remove Redux dependency.

**Migration plan**:

```typescript
// Step 1: Create Zustand store per domain
// dashboard-store.ts
interface DashboardStore {
  metrics: MetricsData
  loading: boolean
  error: string | null
  fetchMetrics: (userId: string) => Promise<void>
  updateFilter: (filter: Filter) => void
}

const useDashboardStore = create<DashboardStore>()(
  devtools(
    (set) => ({
      metrics: { revenue: 0, users: 0, sessions: 0 },
      loading: false,
      error: null,
      fetchMetrics: async (userId) => {
        set({ loading: true, error: null }, false, 'dashboard/fetch/pending')
        try {
          const res = await api.get(`/dashboard/${userId}`)
          set({ metrics: res.data, loading: false }, false, 'dashboard/fetch/fulfilled')
        } catch (err) {
          set({ error: (err as Error).message, loading: false }, false, 'dashboard/fetch/rejected')
        }
      },
      updateFilter: (filter) => set({ filter }, false, 'dashboard/updateFilter'),
    }),
    { name: 'dashboard' }
  )
)

// Step 2: Add feature flag
const useDashboard = () => {
  if (featureFlags.dashboard === 'zustand') {
    return useDashboardStore()
  }
  return useReduxDashboard() // existing useSelector hooks
}

// Step 3: Migrate each dashboard widget component
function RevenueChart() {
  const metrics = useDashboardStore((s) => s.metrics) // only re-renders on metrics change
  const loading = useDashboardStore((s) => s.loading)
  // ...
}

function FilterPanel() {
  const updateFilter = useDashboardStore((s) => s.updateFilter)
  // never re-renders when metrics update
  // because updateFilter reference is stable
}
```

**Result**: Data refresh re-renders RevenueChart and widgets that read metrics. FilterPanel (reads only updateFilter) does not re-render. Previously: data refresh → re-render all components. Now: targeted re-renders per selector.

### Example 3: Adapter Layer for Third-Party Integration

**Problem**: App uses `react-query` for server state + Redux for client state. Migrating Redux to Zustand, but react-query integration remains.

**Solution**: Adapter store that bridges react-query cache to Zustand:

```typescript
// bridge-store.ts
import { useQueryClient } from '@tanstack/react-query'
import { create } from 'zustand'

interface BridgeStore {
  syncQueryToStore: (queryKey: string[], store: any, selector: string) => void
}

const useBridgeStore = create<BridgeStore>(() => ({
  syncQueryToStore: (queryKey, store, selector) => {
    const queryClient = useQueryClient()
    const data = queryClient.getQueryData(queryKey)
    if (data) {
      store.setState({ [selector]: data })
    }
    // Optionally subscribe to query changes
  },
}))

// Usage in component:
function UserProfile() {
  const { data } = useQuery(['user', userId])
  // data is in react-query cache
  // If another component needs user data via Zustand, bridge it
  // But prefer: read from react-query directly, skip Zustand bridge
}
```

**Rule**: Do not bridge state unless two systems genuinely need to share it. Bridge creates coupling between two state management systems. Prefer: each system owns its domain. Bridge only cross-cutting concerns (auth tokens, user session).

---

## Key Takeaways
- Incremental migration beats big bang: strangler fig pattern, one module at a time, feature flags for rollback
- useReducer → Zustand: each reducer case becomes a store method, dispatch call becomes method call
- Context → Zustand: eliminate provider tree, replace useContext with useStore(selector)
- Redux Toolkit → Zustand: slice to store, createAsyncThunk to async action with explicit pending/fulfilled/rejected
- Coexistence during migration: separate domains no overlap, optional bridge for shared state via subscription
- Adapter layer for legacy patterns: saga orchestration → async actions, reselect → derived values, entity adapter → manual normalized store
- Dual test strategy: parity tests (same inputs, same outputs) + coexistence tests (no cross-contamination)
- Performance baseline before migration: re-render count, render time, provider mount cost, bundle size
- Team adoption: naming conventions, one-page patterns guide, code review checklist, accept transitional patterns
- Real case study: 50k LOC, 16 weeks, -81% re-renders, -17KB bundle, -40% new feature LOC, +100% developer velocity

## Common Misconception

**"Migration to Zustand means rewriting all state logic from scratch."**

Zustand is not a different paradigm. It is the same state management concepts (state, actions, selectors, subscriptions) with less ceremony. Reducer logic ports directly: each reducer case becomes one store method. Action dispatch becomes method call. createAsyncThunk becomes async action with explicit lifecycle states. Provider nesting becomes provider-free store access. The logic — what state changes when — stays identical. Only the scaffolding changes. A team that understands this can migrate a production Redux slice in 15 minutes, not 15 days. The common mistake is treating migration as an opportunity to redesign state architecture. Do not do this. Migrate the logic as-is. Improve architecture after migration is complete.

---

## Feynman Explain
(Explain incremental migration to a junior developer who knows Redux but has never planned a migration. Use a building renovation analogy: you do not demolish the whole house to add a new kitchen. You build the new kitchen alongside the old one. When it is ready, you cut over. If the new kitchen has problems, you still have the old kitchen. The house never becomes uninhabitable. The same principle applies to state management migration — never leave the building uninhabitable.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain zustand-state-management` — AI probes gaps.*

---

## Reframe
(Pause. Critique: Is incremental migration always the right choice? When does the friction of maintaining two state management systems outweigh the risk of a big bang? Consider: small codebase (<5k LOC), 2-person team, tight deadline. Is incremental migration worth the overhead of coexistence code, parity tests, and feature flags? Write your evaluation. Also consider: what if the team plans to migrate away from Redux in 6 months anyway — does that change the calculus?)

---

## Drill
Take the quiz. MCQs test migration strategies, pattern mapping (useReducer → Zustand, Context → Zustand, RTK → Zustand), coexistence mechanisms, parity testing approach, and team adoption decisions.

Run: `learn.sh quiz zustand-state-management 19-migration`
