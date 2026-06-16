# Module 5: Store Architecture — Separating Logic from Hooks

Est. study time: 2.5h
Language: en

## Learning Objectives
- Apply separation of concerns: actions defined inside `create()`, not in components
- Design store-as-class pattern and hook-based access layer (useBoundStore)
- Compose multiple small stores vs one large store by domain boundary
- Encapsulate private internal state behind a public API surface with TypeScript

---

## Core Content

### Separation of Concerns: Store vs Component

Zustand's `create()` is a single function — easy to cram everything into one file. Discipline required.

**Wrong way — logic in component:**

```typescript
const useCart = create<{ items: CartItem[] }>(() => ({ items: [] }))

function AddToCartButton({ productId }: { productId: string }) {
  const items = useCart((s) => s.items)

  // Business logic leaks into component
  const handleAdd = () => {
    const existing = items.find((i) => i.id === productId)
    if (existing) {
      // Mutating items requires full replace — easy to get wrong
      useCart.setState({
        items: items.map((i) =>
          i.id === productId ? { ...i, quantity: i.quantity + 1 } : i
        ),
      })
    }
  }

  return <button onClick={handleAdd}>Add to cart</button>
}
```

Violation: component knows cart structure, item dedup logic, and quantity increment rules. Test cart logic through component integration tests.

**Right way — logic in store:**

```typescript
interface CartStore {
  items: CartItem[]
  addItem: (productId: string) => void
  removeItem: (productId: string) => void
}

const useCart = create<CartStore>((set, get) => ({
  items: [],
  addItem: (productId) => {
    const existing = get().items.find((i) => i.id === productId)
    if (existing) {
      set({ items: get().items.map((i) =>
        i.id === productId ? { ...i, quantity: i.quantity + 1 } : i
      )})
    } else {
      set({ items: [...get().items, { id: productId, quantity: 1 }] })
    }
  },
  removeItem: (productId) =>
    set({ items: get().items.filter((i) => i.id !== productId) }),
}))

// Component — thin, testable in isolation
function AddToCartButton({ productId }: { productId: string }) {
  const addItem = useCart((s) => s.addItem)
  return <button onClick={() => addItem(productId)}>Add to cart</button>
}
```

Component only knows "there is an `addItem` action." It does not know dedup rules, quantity logic, or data structure.

> **Think**: You extract a function `addItemLogic(items, productId)` outside the store for testability. Where does this function live — in the store file, in a `utils/cart.ts`, or in the component? Why?
>
> *Answer: `utils/cart.ts` — pure functions that operate on plain data are the most testable. Store actions call the pure function, then `set()` the result. This decouples state mutation logic from Zustand's `set`/`get` entirely. Component still knows nothing.*

### Store-as-Class Pattern

Zustand stores can be organized like classes — state + methods that operate on state. The `create()` callback is the constructor, and returned object is instance.

```typescript
interface CounterStore {
  // State
  count: number
  max: number
  min: number

  // Methods (actions)
  increment: () => void
  decrement: () => void
  reset: () => void
}

const useCounter = create<CounterStore>((set, get) => ({
  count: 0,
  max: 100,
  min: 0,

  increment: () => {
    const next = get().count + 1
    if (next <= get().max) set({ count: next })
  },
  decrement: () => {
    const next = get().count - 1
    if (next >= get().min) set({ count: next })
  },
  reset: () => set({ count: 0 }),
}))
```

Store owns all behavior. Component reads state, calls methods. No `setState` calls in components.

Alternative: **standalone action functions** that receive `set` and `get`:

```typescript
// actions/counter.ts
import type { StateCreator } from 'zustand'

export const createCounterActions: StateCreator<CounterStore> = (set, get) => ({
  increment: () => {
    const next = get().count + 1
    if (next <= get().max) set({ count: next })
  },
  decrement: () => { /* ... */ },
  reset: () => set({ count: 0 }),
})

// store.ts
import { create } from 'zustand'
import { createCounterActions } from './actions/counter'

export const useCounter = create<CounterStore>((...a) => ({
  count: 0,
  max: 100,
  min: 0,
  ...createCounterActions(...a),
}))
```

Trade-offs: class-like pattern keeps everything colocated (simple). Standalone action files scale better when actions grow complex (focused files, easier to test independently).

> **Think**: A store has 15 actions, 5 computed getters, and 3 middleware layers. Would you keep all logic inline in `create()` or split into separate action files? What criteria drive this decision?
>
> *Answer: Split. When a store file exceeds ~150 lines, readability drops. Split by concern: one file per action group (cart-actions.ts, cart-computed.ts, cart-middleware.ts). Keep state types in a separate types.ts. Inline works for stores with ≤5 actions.*

### Hook-Based Access: The useBoundStore Pattern

Zustand's `create()` returns a hook. But you can create additional hooks that wrap the base hook to provide pre-configured selectors or scoped access.

```typescript
const useStore = create<AppStore>(/* ... */)

// Bound selectors — reusable across components
export const useUser = () => useStore((s) => s.user)
export const useTheme = () => useStore((s) => s.theme)
export const useNotifications = () => useStore((s) => s.notifications)
export const useCartItems = () => useStore((s) => s.items)

// Action hooks
export const useAddToCart = () => useStore((s) => s.addItem)
export const useLogin = () => useStore((s) => s.login)
```

Components import named hooks instead of raw store. Two benefits:

1. **Selector logic centralized** — change selector shape in one place
2. **Encapsulation** — components cannot accidentally subscribe to entire store by calling `useStore()` without selector

```typescript
// Before: each component writes selectors
function UserName() {
  const user = useStore((s) => s.user)
  return <div>{user.name}</div>
}

// After: centralized selector
function UserName() {
  const user = useUser()
  return <div>{user.name}</div>
}
```

**Mutative action hooks** — useful when action needs props:

```typescript
export const useAddItemToCart = () => {
  const addItem = useStore((s) => s.addItem)
  const items = useStore((s) => s.items)
  return (productId: string) => {
    addItem(productId)
    // Additional logic: analytics, toast notification
    trackEvent('cart_add', { productId, cartSize: items.length + 1 })
  }
}
```

> **Think**: A team uses `useStore()` without selectors everywhere (entire store subscription). They have 50 components on one store. What happens when any single field updates? How does the useBoundStore pattern prevent this?
>
> *Answer: Every component re-renders on every store change — 50 re-renders per update. useBoundStore with per-field hooks forces selector discipline. Component calling `useUser()` only re-renders when user field changes. Centralized selectors make accidental broad subscriptions impossible.*

### Logic Placement: Business Logic vs UI Logic

Clear boundary:

| Logic type | Location | Example |
|------------|----------|---------|
| Business rules | Store actions | `addItem` validates stock, calculates price |
| Data transformation | Store or pure functions | `formatPrice`, `applyDiscount` |
| Side effects (API calls) | Store actions or middleware | `fetchUser` inside `login` action, then `set` |
| UI state (open/close, selected tab) | Store or local `useState` | Dropdown `isOpen` — keep local unless shared |
| Component formatting | Component file | `toUpperCase`, `date-fns` formatting |
| Event handlers | Component file | `onClick → call store action` |

**Store actions** — business logic:

```typescript
const useAuth = create<AuthStore>((set) => ({
  user: null,
  token: null,
  login: async (email: string, password: string) => {
    set({ loading: true, error: null })
    try {
      const { user, token } = await api.login(email, password)
      set({ user, token, loading: false })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },
  logout: () => set({ user: null, token: null }),
}))
```

**Component** — only wires UI to actions:

```typescript
function LoginForm() {
  const login = useAuth((s) => s.login)
  const loading = useAuth((s) => s.loading)
  const error = useAuth((s) => s.error)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    login(email, password)
  }

  return (
    <form onSubmit={handleSubmit}>
      <input value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p className="error">{error}</p>}
      <button disabled={loading}>{loading ? 'Logging in...' : 'Login'}</button>
    </form>
  )
}
```

Component does not call `fetch`. Component does not set `user` or `token`. Component only calls `login(email, password)` and reads state.

> **Think**: A dashboard updates every 3 seconds via WebSocket. The raw socket processing (parsing, dedup, normalization) is 200 lines. Where should this logic live — store action, middleware, or component hook?
>
> *Answer: Middleware or store action. Middleware intercepts `set` calls and processes incoming data. Or store action extracts processing to a pure function. Component should never parse raw websocket messages — component's job is rendering, not data processing.*

### Store Composition: Small Stores vs One Large Store

Zustand does not enforce single store like Redux. You decide granularity.

**Monolithic store:**

```typescript
const useStore = create<AppStore>((set, get) => ({
  // Auth
  user: null, token: null, login: () => {}, logout: () => {},
  // Cart
  items: [], addItem: () => {}, removeItem: () => {},
  // UI
  theme: 'light', sidebar: true, modal: null,
  // Notifications
  notifications: [], pushNotification: () => {}, dismiss: () => {},
}))
```

Problems:
- File grows large
- No clear ownership boundary
- Selectors must slice precisely to avoid re-renders
- State changes in one domain can accidentally affect others (e.g., resetting store clears everything)

**Composed stores:**

```typescript
// stores/authStore.ts
export const useAuth = create<AuthStore>((set) => ({
  user: null, token: null,
  login: async (email, password) => { /* ... */ },
  logout: () => set({ user: null, token: null }),
}))

// stores/cartStore.ts
export const useCart = create<CartStore>((set, get) => ({
  items: [], total: 0,
  addItem: (product) => { /* ... */ },
  removeItem: (id) => { /* ... */ },
}))

// stores/uiStore.ts
export const useUI = create<UIStore>((set) => ({
  theme: 'light', sidebar: true,
  toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
}))
```

Benefits:
- Files are small, focused, independently testable
- Each store has clear domain boundary
- State changes in one store cannot affect another
- Teams can own separate store files

**Cross-store communication** — when one store needs another's state:

```typescript
// cartStore reads auth token for API calls
import { useAuthStore } from './authStore'

const useCart = create<CartStore>((set, get) => ({
  items: [],
  checkout: async () => {
    const token = useAuthStore.getState().token  // Read from another store
    const items = get().items
    await api.checkout(items, token)
    set({ items: [] })
  },
}))
```

Use `.getState()` for cross-store reads inside actions. Never import one store's hook inside another store's create callback — creates circular dependency risk.

> **Think**: You have 8 stores. Two stores need to read each other's state. Is this a sign you should merge them into one store, or keep them separate with cross-store references?
>
> *Answer: First check if stores are truly separate domains. If auth and cart cross-reference frequently, they may be one domain (e-commerce). If they cross-reference once per checkout, keep separate — `.getState()` is fine. Cyclical cross-references (>3 per store) suggest wrong domain boundaries. Merge or extract shared logic into a third store.*

### Encapsulation: Private vs Public API

Zustand stores have no built-in private state. Every property returned from `create()` is accessible to any component. Enforce encapsulation by convention.

**Convention: prefix private state with `_`**:

```typescript
interface AuthStore {
  // Public API
  user: User | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void

  // Private (internal — do not use in components)
  _tokenRefreshTimer: number | null
  _retryCount: number
  _lastRefreshAttempt: number
}
```

**Store definition:**

```typescript
const useAuth = create<AuthStore>((set, get) => ({
  user: null,

  // Public actions
  login: async (email, password) => {
    const { user, token } = await api.login(email, password)
    set({ user, _tokenRefreshTimer: startRefreshTimer(token) })
  },
  logout: () => {
    clearInterval(get()._tokenRefreshTimer!)
    set({ user: null, _tokenRefreshTimer: null })
  },

  // Private — never exposed to components via selectors
  _tokenRefreshTimer: null,
  _retryCount: 0,
  _lastRefreshAttempt: 0,
}))
```

**Bound hooks as public API surface:**

```typescript
// api/useAuth.ts — Public API for components
export const useCurrentUser = () => useAuthStore((s) => s.user)
export const useLoginAction = () => useAuthStore((s) => s.login)
export const useLogoutAction = () => useAuthStore((s) => s.logout)

// Components cannot access private fields via these hooks
// Internal: useAuthStore exists but component never imports it directly
```

Components import from `api/useAuth.ts`, never from `stores/authStore.ts`. This creates the encapsulation boundary.

> **Think**: A junior developer imports `useAuthStore` directly instead of the API hooks. They read `_tokenRefreshTimer` and use it in a component. Who is at fault — the developer or the architecture?
>
> *Answer: Architecture. If raw store import is possible, developers will use it. Enforce encapsulation with a barrel export: `index.ts` re-exports only the API hooks, not the raw store. Or use lint rule: `no-restricted-imports` forbids `stores/authStore` outside store files.*

### TypeScript Patterns: Typed Stores, Typed Actions

**Full typing with interface:**

```typescript
interface TodoStore {
  todos: Todo[]
  filter: 'all' | 'active' | 'completed'
  addTodo: (text: string) => void
  toggleTodo: (id: string) => void
  setFilter: (filter: TodoStore['filter']) => void
  clearCompleted: () => void
  completedCount: () => number
  activeCount: () => number
}

const useTodo = create<TodoStore>()((set, get) => ({
  todos: [],
  filter: 'all',
  addTodo: (text) =>
    set({ todos: [...get().todos, { id: crypto.randomUUID(), text, completed: false }] }),
  toggleTodo: (id) =>
    set({ todos: get().todos.map((t) => t.id === id ? { ...t, completed: !t.completed } : t) }),
  setFilter: (filter) => set({ filter }),
  clearCompleted: () =>
    set({ todos: get().todos.filter((t) => !t.completed) }),
  completedCount: () => get().todos.filter((t) => t.completed).length,
  activeCount: () => get().todos.filter((t) => !t.completed).length,
}))
```

Note `create<TodoStore>()()` — double parentheses. The first `()` passes the type, the second `()` is the actual create call. This syntax enables correct inference for middleware.

**Action types extracted separately:**

```typescript
// types/todo.ts
export interface Todo {
  id: string
  text: string
  completed: boolean
}

export type TodoFilter = 'all' | 'active' | 'completed'

export interface TodoActions {
  addTodo: (text: string) => void
  toggleTodo: (id: string) => void
  setFilter: (filter: TodoFilter) => void
  clearCompleted: () => void
}

export interface TodoComputed {
  completedCount: () => number
  activeCount: () => number
}

export type TodoStore = TodoActions & TodoComputed & {
  todos: Todo[]
  filter: TodoFilter
}
```

Separate type files enable:
- Reuse `Todo`, `TodoFilter`, `TodoActions` across store files, components, tests
- `TodoActions` can be tested independently (mock the store state, call action, check result)
- Docs generated from types

> **Think**: Why does Zustand use `create<T>()()` instead of `create<T>()`? What TypeScript issue does the double-call solve?
>
> *Answer: The double-call enables proper inference when using middleware. `create<T>()(middleware(...))` — the type parameter `T` propagates through middleware types. Single-call loses type info when middleware transforms the store shape. This is a TypeScript design choice, not a Zustand API quirk.*

### Code Organization: Files and Folders

Scale-dependent. Three patterns:

**Pattern A — Single file (≤5 actions, small store):**

```
stores/cartStore.ts
```

Everything in one file.

**Pattern B — Split by type (medium store, 5-15 actions):**

```
stores/cart/
├── types.ts          # CartItem, CartStore interface
├── store.ts          # create() call, middleware
├── actions.ts        # addItem, removeItem, updateQuantity, checkout
├── selectors.ts      # useCartItems, useCartTotal, useCartCount
└── index.ts          # Re-exports public API only
```

**Pattern C — Split by domain (large app, multiple stores):**

```
stores/
├── auth/
│   ├── types.ts
│   ├── store.ts
│   ├── actions.ts
│   ├── selectors.ts
│   ├── middleware.ts
│   └── index.ts
├── cart/
│   ├── types.ts
│   ├── store.ts
│   ├── actions.ts
│   ├── selectors.ts
│   └── index.ts
├── ui/
│   ├── types.ts
│   ├── store.ts
│   ├── selectors.ts
│   └── index.ts
└── index.ts           # Re-exports all public API hooks
```

**Barrel exports for encapsulation:**

```typescript
// stores/cart/index.ts
export { useCartItems, useCartTotal, useCartCount } from './selectors'
export { useCartStore } from './store' // Raw store — exported but discouraged
```

```typescript
// stores/index.ts — app-level public API
export { useAuthUser, useLoginAction, useLogoutAction } from './auth'
export { useCartItems, useCartTotal } from './cart'
export { useTheme, useSidebar } from './ui'
// Intentionally NOT exporting individual stores — components use only selectors
```

Component imports from `stores/index.ts`, never from `stores/auth/store.ts`.

> **Think**: A new developer joins. They open `stores/index.ts` and see 12 named hooks. How does this single import file guide their architecture decisions compared to importing from 8 different store files?
>
> *Answer: The barrel file communicates "these are the approved ways to interact with state." New devs learn the public API in one place. They have no reason to import raw stores. This is the Zustand equivalent of Redux's `mapStateToProps` — a defined contract between state and UI.*

### Real Example: Complex Store with Actions, Computed Values, Middleware

**Problem**: Dashboard store with user data, real-time metrics, theme, and notification state. Must persist theme preference, log actions in dev, and compute derived values.

```typescript
// stores/dashboard/types.ts
export interface Metric {
  id: string
  label: string
  value: number
  change: number // percentage change
  trend: 'up' | 'down' | 'flat'
}

export interface Notification {
  id: string
  message: string
  type: 'info' | 'warning' | 'error'
  read: boolean
  timestamp: number
}

export interface DashboardState {
  user: { name: string; role: 'admin' | 'viewer' }
  metrics: Metric[]
  notifications: Notification[]
  theme: 'light' | 'dark'
  sidebarOpen: boolean
  selectedMetricId: string | null
}

export interface DashboardActions {
  fetchMetrics: () => Promise<void>
  addNotification: (n: Omit<Notification, 'id' | 'timestamp'>) => void
  markNotificationRead: (id: string) => void
  clearNotifications: () => void
  toggleTheme: () => void
  toggleSidebar: () => void
  selectMetric: (id: string) => void
}

export type DashboardStore = DashboardState & DashboardActions
```

```typescript
// stores/dashboard/selectors.ts
import { useDashboardStore } from './store'

// State selectors
export const useMetrics = () => useDashboardStore((s) => s.metrics)
export const useTheme = () => useDashboardStore((s) => s.theme)
export const useNotifications = () => useDashboardStore((s) => s.notifications)
export const useSidebarOpen = () => useDashboardStore((s) => s.sidebarOpen)
export const useSelectedMetric = () => useDashboardStore((s) => {
  const id = s.selectedMetricId
  return id ? s.metrics.find((m) => m.id === id) : null
})

// Computed selectors
export const useMetricsSummary = () => useDashboardStore((s) => {
  const metrics = s.metrics
  return {
    total: metrics.length,
    avgChange: metrics.reduce((sum, m) => sum + m.change, 0) / metrics.length,
    upCount: metrics.filter((m) => m.trend === 'up').length,
    downCount: metrics.filter((m) => m.trend === 'down').length,
  }
})

export const useUnreadCount = () => useDashboardStore((s) =>
  s.notifications.filter((n) => !n.read).length
)

// Action selectors
export const useFetchMetrics = () => useDashboardStore((s) => s.fetchMetrics)
export const useToggleTheme = () => useDashboardStore((s) => s.toggleTheme)
export const useAddNotification = () => useDashboardStore((s) => s.addNotification)
```

```typescript
// stores/dashboard/store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DashboardStore } from './types'
import { createDashboardActions } from './actions'

const initialState: Omit<DashboardStore, keyof DashboardActions> = {
  user: { name: 'Alice', role: 'admin' },
  metrics: [],
  notifications: [],
  theme: 'light',
  sidebarOpen: true,
  selectedMetricId: null,
}

export const useDashboardStore = create<DashboardStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      ...createDashboardActions(set, get),
    }),
    {
      name: 'dashboard-storage',
      partialize: (state) => ({ theme: state.theme }), // Only persist theme
    }
  )
)
```

```typescript
// stores/dashboard/actions.ts
import type { StateCreator } from 'zustand'
import type { DashboardStore, Notification } from './types'

export const createDashboardActions: StateCreator<DashboardStore> = (set, get) => ({
  fetchMetrics: async () => {
    const data = await api.getMetrics()
    set({ metrics: data })
  },
  addNotification: (n) =>
    set({ notifications: [
      { ...n, id: crypto.randomUUID(), timestamp: Date.now() },
      ...get().notifications,
    ]}),
  markNotificationRead: (id) =>
    set({ notifications: get().notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    )}),
  clearNotifications: () => set({ notifications: [] }),
  toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  selectMetric: (id) => set({ selectedMetricId: id }),
})
```

```typescript
// stores/dashboard/index.ts
export {
  useMetrics,
  useTheme,
  useNotifications,
  useSidebarOpen,
  useSelectedMetric,
  useMetricsSummary,
  useUnreadCount,
  useFetchMetrics,
  useToggleTheme,
  useAddNotification,
} from './selectors'
```

**Component usage:**

```typescript
import { useMetrics, useUnreadCount } from '../stores/dashboard'

function DashboardHeader() {
  const metrics = useMetrics()
  const unread = useUnreadCount()
  // ...
}
```

> **Think**: The `useMetricsSummary` selector returns a new object on every store change (because `s.metrics` changes reference). Even if values are the same, the component re-renders. How do you fix this unnecessary re-render?
>
> *Answer: Add equality function: `useDashboardStore((s) => {...}, shallow)` using Zustand's `shallow` comparator. Or use `createSelector`-style memoization. Or split computed values into individual primitives (`useUpCount`, `useDownCount`) so each returns a stable reference (number).*

---

### Why This Matters

Wrong architecture in Zustand leads to stores where actions live in components, state is untyped, selectors are duplicated across files, and refactoring store shape requires changing 30 components. Proper store architecture — actions defined in `create()`, encapsulated behind selector hooks, organized by domain — produces stores that are testable, refactorable, and scalable. The difference between "Zustand as a global useState" and "Zustand as a well-architected state layer" is the difference between a codebase that fights you and one that accelerates you.

---

### Common Questions

**Q: Should I put all state in one big store or split into many small stores?**
A: Split by domain boundary. Auth, cart, UI, notifications are separate concerns — separate stores. Merging them creates a single file that every developer touches and every change risks cross-domain bugs. Use multiple stores by default, merge only when cross-store communication becomes excessive.

**Q: How do I share logic between stores (e.g., logging every state change)?**
A: Middleware. `zustand/middleware` provides built-in middleware (`persist`, `devtools`, `immer`, `subscribeWithSelector`). Custom middleware wraps `set` to intercept all changes. Add once, applies to all stores.

**Q: Can I call a store action from outside React (e.g., a WebSocket handler)?**
A: Yes. Use `useStore.getState().actionName()` — the vanilla store is accessible without React. Import the store and call `getState()` any time, anywhere. This is why Zustand works outside React.

**Q: How do I test store actions in isolation?**
A: Create store in test with `create()` and mock initial state. Call actions directly: `store.getState().addItem('abc')`. Assert state after action. No React needed. For async actions, await the action call. Zustand stores are the most testable state management pattern because they are plain functions.

**Q: When should I extract actions from the store file into separate action files?**
A: When store file exceeds ~150 lines, or when actions have complex logic that would benefit from focused unit tests. Rule: if you are scrolling past action definitions to find state, split. If actions use external services (API, localStorage), extract for mockability.

---

## Examples

### Example 1: Refactoring Logic Out of Components

**Problem**: Two components (`ProductList` and `ProductDetail`) both contain duplicate logic for adding items to cart — same dedup, same quantity increment, same analytics tracking.

**Before** — logic duplicated in both components:

```typescript
function ProductList() {
  const setState = useCartStore.setState
  const items = useCartStore.getState().items

  const handleAdd = (product) => {
    const existing = items.find((i) => i.id === product.id)
    const updated = existing
      ? items.map((i) => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      : [...items, { ...product, quantity: 1 }]
    setState({ items: updated })
    analytics.track('cart_add', { productId: product.id })
  }
  // ...
}
```

**After** — logic extracted to store action, analytics in middleware:

```typescript
const useCart = create<CartStore>((set, get) => ({
  items: [],
  addItem: (product) => {
    const existing = get().items.find((i) => i.id === product.id)
    set({
      items: existing
        ? get().items.map((i) => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
        : [...get().items, { ...product, quantity: 1 }]
    })
  },
}))

// Middleware for analytics
const useCart = create<CartStore>()(
  analyticsMiddleware(/* tracks every set call */)
)(/* store definition */)
```

```typescript
function ProductList() {
  const addItem = useCart((s) => s.addItem)
  const handleAdd = (product) => addItem(product)
  // ...
}
```

**Result**: Logic in one place. Components are thin. Tests verify store, not DOM. Analytics fires automatically via middleware — no manual tracking calls.

### Example 2: Multi-Store Architecture for an E-Commerce App

**Problem**: E-commerce app with auth, product catalog, cart, checkout, and UI state. Need clear separation, cross-store checkout flow, and persisted cart.

```typescript
// stores/authStore.ts — session management
export const useAuth = create<AuthStore>((set) => ({
  user: null, token: null,
  login: async (email, pwd) => { /* API call, set user + token */ },
  logout: () => set({ user: null, token: null }),
}))

// stores/cartStore.ts — persisted, reads auth for API calls
export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (product) => { /* dedup, increment quantity */ },
      removeItem: (id) => { /* filter out */ },
      checkout: async () => {
        const token = useAuth.getState().token
        await api.checkout(get().items, token)
        set({ items: [] })
      },
    }),
    { name: 'cart-storage' }
  )
)

// stores/catalogStore.ts — server-synced, not persisted
export const useCatalog = create<CatalogStore>((set) => ({
  products: [], categories: [], loading: false,
  fetchProducts: async () => { /* API call, set products */ },
  setCategory: (cat) => set({ selectedCategory: cat }),
}))

// stores/uiStore.ts — ephemeral UI state
export const useUI = create<UIStore>((set) => ({
  sidebarOpen: true, modal: null, viewMode: 'grid',
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  openModal: (modal) => set({ modal }),
  closeModal: () => set({ modal: null }),
}))
```

```typescript
// Checkout page — combines multiple stores
function CheckoutPage() {
  const items = useCart((s) => s.items)
  const user = useAuth((s) => s.user)
  const checkout = useCart((s) => s.checkout)
  const closeModal = useUI((s) => s.closeModal)

  const handlePlaceOrder = async () => {
    await checkout()
    closeModal()
    // Cart cleared automatically after checkout
  }

  return (
    <div>
      <OrderSummary items={items} />
      <ShippingInfo user={user} />
      <button onClick={handlePlaceOrder}>Place Order</button>
    </div>
  )
}
```

**Result**: 4 focused stores, each < 100 lines. Checkout page reads from 3 stores — no monolithic store needed. Cart persisted across sessions. Auth token read cross-store for API calls.

### Example 3: TypeScript-Only Encapsulation with Barrel Exports

**Problem**: Team needs to prevent components from reading private store fields. No lint rule available.

```typescript
// stores/timer/types.ts
export interface TimerState {
  elapsed: number
  isRunning: boolean
  _startTime: number | null  // Private — underscore convention
  _intervalId: ReturnType<typeof setInterval> | null  // Private
}

export interface TimerActions {
  start: () => void
  stop: () => void
  reset: () => void
}

export type TimerStore = TimerState & TimerActions
```

```typescript
// stores/timer/store.ts
import { create } from 'zustand'
import type { TimerStore } from './types'

export const useTimerStore = create<TimerStore>((set, get) => ({
  elapsed: 0,
  isRunning: false,
  _startTime: null,
  _intervalId: null,

  start: () => {
    const _startTime = Date.now() - get().elapsed
    const _intervalId = setInterval(() => {
      set({ elapsed: Date.now() - get()._startTime! })
    }, 100)
    set({ isRunning: true, _startTime, _intervalId })
  },
  stop: () => {
    clearInterval(get()._intervalId!)
    set({ isRunning: false, _intervalId: null })
  },
  reset: () => {
    clearInterval(get()._intervalId!)
    set({ elapsed: 0, isRunning: false, _startTime: null, _intervalId: null })
  },
}))
```

```typescript
// stores/timer/selectors.ts
import { useTimerStore } from './store'

// Public API — only these are exported
export const useElapsed = () => useTimerStore((s) => s.elapsed)
export const useIsRunning = () => useTimerStore((s) => s.isRunning)
export const useStart = () => useTimerStore((s) => s.start)
export const useStop = () => useTimerStore((s) => s.stop)
export const useReset = () => useTimerStore((s) => s.reset)
```

```typescript
// stores/timer/index.ts
export {
  useElapsed,
  useIsRunning,
  useStart,
  useStop,
  useReset,
} from './selectors'
// Note: useTimerStore and TimerStore are NOT exported
```

```typescript
// Component — can only access public API
import { useElapsed, useStart, useStop } from '../stores/timer'
// import { useTimerStore } from '../stores/timer/store'  // Works but discouraged
// useTimerStore.getState()._intervalId  // Convention says no
```

**Result**: Encapsulation by convention + barrel exports. Component sees only `useElapsed`, `useStart`, `useStop`. Private `_intervalId` and `_startTime` never appear in autocomplete. Team convention prevents direct store imports.

---

## Key Takeaways
- Actions defined inside `create()`, not in components — component only wires UI
- Store-as-class pattern: state + methods co-located, standalone action files for scale
- useBoundStore pattern centralizes selectors, prevents accidental full subscriptions
- Business logic in store actions, UI logic in components, side effects in middleware
- Prefer many small stores by domain over one monolithic store
- Cross-store reads via `.getState()` for occasional communication
- Enforce encapsulation with `_` prefix convention and barrel exports
- TypeScript interfaces define store contract: state types, action types, computed types
- Barrel files (`index.ts`) expose only public API — raw store import discouraged
- Split store files by type (types.ts, store.ts, actions.ts, selectors.ts) at scale
- `create<T>()()` syntax enables proper middleware type inference
- Computed selectors return new references — use `shallow` or memoize to prevent re-renders

## Common Misconception

**"Zustand replaces component-level state management — put everything in the store."**

Zustand is for cross-component state, not a replacement for local state. UI-only state (dropdown open, form input values, selected tab, tooltip visibility) should stay in `useState` or component-local hooks. Putting UI toggle state into a global store creates unnecessary re-renders across unrelated components and makes the store file grow with one-off flags. Rule: if only one component (and its children) needs a piece of state, keep it local. Only promote to Zustand when two or more unrelated components need to share that state or react to its changes.

---

## Feynman Explain
(Explain store architecture to a junior developer who knows `useState` but has never used Zustand or Redux. They understand: components render UI, state drives rendering, props pass data down. They do NOT know: store, subscriber, selector, middleware. Use only these words in explanation: "global box", "label", "recipe card", "intercom", "public counter window.")

*When ready, say explanation aloud or write it down. Then run `learn.sh explain zustand-state-management` — AI probes gaps.*

---

## Reframe
(Pause. Judge: Is "always split into small stores" universally correct? When does a single large store outperform multiple small stores? Consider: cross-store synchronization overhead, transaction atomicity (reset all state at once), devtools debugging with multiple stores, and performance (single subscriber vs many). Write your evaluation.)

---

## Drill
Take the quiz. MCQs test store architecture decisions, encapsulation patterns, TypeScript typing, and code organization trade-offs.

Run: `learn.sh quiz zustand-state-management 05-public-private-api`
