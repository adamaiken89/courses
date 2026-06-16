# Module 14: Solve Weakness 1 — Atomic Stores, Selector Stability

Est. study time: 2h
Language: en

## Learning Objectives
- Decompose a monolithic Zustand store into atomic stores by domain concern
- Stabilize selectors with `createSelectors` utility to prevent reference instability
- Apply `useShallow` and custom equality functions for object selectors
- Combine atomic stores with slices for maintainable multi-store architecture
- Measure performance before and after atomic store migration

---

## Core Content

### The Problem: One Store Contains Everything

Monolithic store starts clean, degrades over time:

```typescript
interface AppStore {
  // Auth
  user: User | null
  token: string | null
  login: (email: string, pw: string) => Promise<void>
  logout: () => void
  // Products
  products: Product[]
  loading: boolean
  fetchProducts: () => Promise<void>
  // Cart
  cart: CartItem[]
  addToCart: (item: CartItem) => void
  // UI
  theme: 'light' | 'dark'
  sidebar: boolean
  // Notifications
  notifications: Notification[]
  markRead: (id: string) => void
  // Analytics
  events: AnalyticsEvent[]
  track: (event: AnalyticsEvent) => void
}
```

Every subscriber pays cost of full store size. Selectors must be precise or component re-renders on unrelated domain changes. As store grows, selector discipline erodes — devs take shortcuts like `useStore((s) => s)` or `(s) => s.user`.

Two weakness categories this module solves:

| Weakness | Effect | Fix |
|----------|--------|-----|
| **Coarse granularity** | Component reading auth re-renders on cart update | Atomic stores per domain |
| **Selector instability** | Inline objects/arrays create new refs every render | `createSelectors`, `useShallow`, equality fns |

> **Think**: Your store has 8 domains, 60 properties, 40 subscribers. How many selector re-evaluations happen on a single `theme` toggle?
>
> *Answer: All 40. Each subscriber's selector runs, even if selector only reads an unrelated field like `user.name`. Zustand cannot skip selector evaluation — it must compute to know whether value changed. Atomic stores reduce this: only subscribers to `uiStore` re-evaluate on theme change.*

### Atomic Store Pattern — One Store Per Domain Concern

Atomic store: each store holds state for exactly one domain concern. Store is small (3-10 properties), focused, independently testable.

```typescript
// stores/authStore.ts
import { create } from 'zustand'

interface AuthState {
  user: User | null
  token: string | null
  login: (email: string, pw: string) => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  login: async (email, pw) => {
    const res = await api.login(email, pw)
    set({ user: res.user, token: res.token })
  },
  logout: () => set({ user: null, token: null }),
}))
```

```typescript
// stores/cartStore.ts
import { create } from 'zustand'

interface CartState {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (id: string) => void
  clearCart: () => void
}

export const useCartStore = create<CartState>((set) => ({
  items: [],
  addItem: (item) => set((s) => ({ items: [...s.items, item] })),
  removeItem: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
  clearCart: () => set({ items: [] }),
}))
```

Each store is < 50 lines. No cross-domain coupling. Testing uses only the relevant store.

**Benefits:**

| Concern | Monolithic | Atomic |
|---------|-----------|--------|
| Subscriber count per update | All 40 | ~5 (only domain subscribers) |
| Selector complexity | Must avoid parent extraction | Trivial — store is small |
| Merge conflicts | Any domain change touches same file | Own file per domain |
| Code splitting | Must import entire store | Import per domain |
| Cognitive load | Know entire store to modify | Know one domain |

> **Think**: Auth store has 3 properties + 2 actions. Cart store has 2 properties + 3 actions. How many subscribers does each store have?
>
> *Answer: Auth store has subscribers from components that read auth. Cart store has subscribers from components that read cart. Zero overlap. Auth update never re-evaluates cart selectors. Atomic isolation makes subscription count proportional to domain popularity, not total app size.*

### Breaking a Large Store into Atomic Stores

Step-by-step decomposition:

**Step 1: Domain audit**. List every state property, group by domain:

```typescript
// Monolithic store — 20 properties
const monolithic = {
  // Auth (4)
  user, token, login, logout,
  // Products (5)
  products, loading, error, fetchProducts, setCategory,
  // Cart (4)
  cartItems, addToCart, removeFromCart, clearCart,
  // UI (4)
  theme, sidebar, modalOpen, toggleSidebar,
  // Notifications (3)
  notifications, markRead, clearNotifications,
}
```

5 domains → 5 atomic stores. Each store interface is subset of original.

**Step 2: Create store files**. One file per domain under `stores/`:

```
stores/
├── authStore.ts
├── productsStore.ts
├── cartStore.ts
├── uiStore.ts
└── notificationsStore.ts
```

**Step 3: Migrate component imports one at a time**:

```typescript
// Before
import { useStore } from './store'
const user = useStore((s) => s.user)
const cartItems = useStore((s) => s.cartItems)

// After
import { useAuthStore } from './stores/authStore'
import { useCartStore } from './stores/cartStore'
const user = useAuthStore((s) => s.user)
const cartItems = useCartStore((s) => s.items)
```

**Step 4: Handle cross-store communication**. When auth logout must clear cart, use subscribers or a coordination layer:

```typescript
// stores/authStore.ts
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  login: async (email, pw) => {
    const res = await api.login(email, pw)
    set({ user: res.user, token: res.token })
  },
  logout: () => {
    set({ user: null, token: null })
    // Notify cart to clear (subscriber handles this)
  },
}))
```

```typescript
// stores/subscribers.ts
import { useAuthStore } from './authStore'
import { useCartStore } from './cartStore'

// Clear cart on logout
useAuthStore.subscribe((state, prevState) => {
  if (state.user === null && prevState.user !== null) {
    useCartStore.getState().clearCart()
  }
})
```

> **Think**: Why subscriber pattern instead of importing `useCartStore` directly into `useAuthStore`?
>
> *Answer: Avoids circular imports and direct coupling. Auth store should not import cart store — that ties two domains at creation time. Subscriber decouples: auth store emits "user changed" signal; subscriber reacts. Cart can be removed, renamed, or replaced without touching auth. Domain independence is whole point of atomic stores.*

### Selector Stability — The Reference Problem

Selectors returning new references cause unnecessary re-renders even with atomic stores:

```typescript
// UNSTABLE — creates new object every time store changes
const { name, email } = useAuthStore((s) => ({
  name: s.user?.name,
  email: s.user?.email,
}))

// UNSTABLE — creates new array every time
const productNames = useProductsStore((s) =>
  s.products.map((p) => p.name)
)
```

Each state change re-runs selector. If selector returns new reference, `Object.is` says "changed" → re-render. Even if values unchanged.

**Atomic stores reduce the problem but do not eliminate it.** A 5-property atomic store can still have unstable selectors.

> **Think**: `useAuthStore((s) => ({ name: s.user?.name }))` — auth store has 3 properties. Any of the 3 change → re-render even though only name matters?
>
> *Answer: Yes. Although store is small, selector still creates new object every call. `Object.is` sees two different `{ name: "Alice" }` objects. Fix: extract scalar or use shallow equality. Atomic store makes the problem smaller but selector hygiene still required.*

### createSelectors Utility — Auto-Generating Stable Selectors

`createSelectors` wraps a store and generates type-safe, stable selector functions for every property:

```typescript
import { create } from 'zustand'

// Utility
type StoreApi<T> = {
  use: { [K in keyof T]: () => T[K] }
  get: { [K in keyof T]: () => T[K] }
}

export function createSelectors<TStore extends object>(
  store: any
): StoreApi<TStore> {
  const selectors: Record<string, () => any> = {}

  // Generate selectors from store's state keys
  const stateKeys = Object.keys(store.getState())
  for (const key of stateKeys) {
    selectors[key] = () => store((s: any) => s[key])
  }

  return {
    use: selectors as StoreApi<TStore>['use'],
    get: new Proxy({} as any, {
      get: (_, key: string) => () => store.getState()[key],
    }),
  }
}
```

Usage:

```typescript
// stores/authStore.ts
import { create } from 'zustand'

interface AuthState {
  user: User | null
  token: string | null
  login: (email: string, pw: string) => Promise<void>
  logout: () => void
}

const useAuthStoreBase = create<AuthState>((set) => ({
  user: null,
  token: null,
  login: async (email, pw) => { /* ... */ },
  logout: () => set({ user: null, token: null }),
}))

export const useAuthStore = createSelectors<AuthState>(useAuthStoreBase)

// Component — stable selectors auto-generated
function UserName() {
  const user = useAuthStore.use.user()  // type-safe, stable selector
  return <span>{user?.name}</span>
}

function TokenDisplay() {
  const token = useAuthStore.use.token()  // subscribes only to token
  return <code>{token}</code>
}
```

Each generated selector extracts a single property by key. Returns primitive or direct reference — no object creation, no array allocation. `Object.is` works correctly.

**What `createSelectors` solves:**

| Problem | Without | With |
|---------|---------|------|
| Typing selector inline | `(s) => s.user` — easy to get wrong | `useAuthStore.use.user()` — auto-complete |
| Object creation | `(s) => ({ name: s.name })` creates new ref | Single property extraction |
| Array creation | `(s) => s.items` returns same array ref | Same array ref |
| Selector memoization | Manual `useMemo` or external memo | Not needed — returns identity |

> **Think**: `useAuthStore.use.user()` returns `User | null`. If user object reference changes but contents same, does component re-render?
>
> *Answer: Yes — the user object reference changed. createSelectors guarantees stable selector fn but cannot control whether upstream creates new object references. If `login` returns a new user object, component re-renders because User object is new. Fix: shallow compare at component level or normalize user objects by ID.*

### useShallow for Object Selectors

When component needs multiple fields from same store, `useShallow` prevents object-creation instability:

```typescript
import { useShallow } from 'zustand/react'

function UserProfile() {
  const { name, email, avatar } = useAuthStore(
    useShallow((s) => ({
      name: s.user?.name,
      email: s.user?.email,
      avatar: s.user?.avatar,
    }))
  )
  // Re-renders only when name, email, or avatar change
  // Not when token changes (same auth store)
}
```

`useShallow` wraps the selector with `useMemo` (stabilizes selector reference) and applies shallow comparison on the returned object.

Before `useShallow`:

```
Store updates token → selector re-runs → new {name, email, avatar} → Object.is fails → re-render
```

After `useShallow`:

```
Store updates token → selector re-runs → new {name, email, avatar} → shallow compares key/values → same values → skip re-render
```

**When to use `useShallow`:**

| Scenario | Recommendation |
|---------|---------------|
| 2-3 fields from same store, updated infrequently | `useShallow` — concise, one hook call |
| 1 field from a store | Scalar selector — no wrapper needed |
| 5+ fields from same store | Extract each as scalar — more subscriptions but zero object allocation |
| Derived state combining fields | Memoized selector or `useMemo` after scalar selectors |

> **Think**: Component calls `useAuthStore(useShallow((s) => ({ name: s.user?.name, email: s.user?.email })))`. Auth store updates `token`. Does component re-render?
>
> *Answer: No. Selector runs, returns `{ name: "Alice", email: "alice@x.com" }`. useShallow compares with previous object: name and email unchanged (Object.is on strings). Shallow says equal → skip re-render. Token update only affects components subscribed to token.*

### Equality Functions — Custom Comparison Logic

Zustand's second argument to `useStore` is equality function:

```typescript
type EqualityFn = (a: SelectedValue, b: SelectedValue) => boolean
// Return true = values equal → no re-render
// Return false = values differ → re-render
```

Built-in options:

```typescript
import { shallow } from 'zustand/shallow'

// Object.is (default): reference equality
useStore((s) => s.user)

// Shallow: top-level key/value comparison
useStore((s) => ({ name: s.name }), shallow)
```

Custom equality functions for specific needs:

```typescript
// Deep equality — for nested data
import { isEqual } from 'lodash-es'

function deepEquality<T>(a: T, b: T): boolean {
  return isEqual(a, b)
}

function SettingsPanel() {
  const settings = useSettingsStore(
    (s) => s.config,
    deepEquality  // deep compare config object
  )
  // Re-renders only when nested config actually changes
}
```

```typescript
// Custom — compare specific fields
function lazyCompare(a: User, b: User) {
  if (!a || !b) return a === b
  return a.id === b.id  // same user ID = same enough
}

function UserAvatar() {
  const user = useAuthStore((s) => s.user, lazyCompare)
  // Re-renders only when user ID changes, not when email/name updates
  return <img src={user?.avatar} />
}
```

```typescript
// Array length comparison — re-render only when count changes
function CartBadge() {
  const count = useCartStore(
    (s) => s.items.length,
    Object.is  // default — primitive, no custom needed
  )
  return <Badge count={count} />
}
```

**Performance characteristics:**

| Equality fn | Cost | Use case |
|-------------|------|----------|
| `Object.is` | 1 comparison | Primitives, reference-stable objects |
| `shallow` | O(n) on keys | Object/array selectors, 2-10 keys |
| Deep equality | O(n) on depth | Deeply nested config, infrequent updates |
| Custom key compare | O(1)-O(k) | Specific field matters, rest ignored |

> **Think**: Deep equality on every store update — when is this harmful?
>
> *Answer: Large nested objects (1000+ keys, 5+ levels) compared on every mutation. Store updates 60fps (animation) → deep equality runs 60 times/sec on potentially heavy data. Fix: use custom shallow equality that compares only the keys component needs, not the entire structure.*

### Atomic Stores + Slices — Combined Pattern

Atomic stores give domain isolation. Slices give cross-domain coordination within a single store. Combine them when domains need to share state or actions frequently.

**Pattern: Single store with slices per domain, but selectors enforce atomic-like granularity.**

```typescript
// store/types.ts
export interface AuthSlice {
  user: User | null
  token: string | null
  login: (email: string, pw: string) => Promise<void>
  logout: () => void
}

export interface CartSlice {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (id: string) => void
  clearCart: () => void
}

export type AppStore = AuthSlice & CartSlice
```

```typescript
// store/slices/auth.ts
import { StateCreator } from 'zustand'
import type { AppStore } from '../types'

export const createAuthSlice: StateCreator<AppStore, [], [], AuthSlice> = (set) => ({
  user: null,
  token: null,
  login: async (email, pw) => {
    const res = await api.login(email, pw)
    set({ user: res.user, token: res.token })
  },
  logout: () => {
    set({ user: null, token: null })
    // Cross-slice via subscriber
  },
})
```

**When to use atomic stores vs slices:**

| Factor | Atomic Stores | Slices Pattern |
|--------|-------------|----------------|
| Cross-domain state sharing | Subscriber/event bus | Direct `get().otherSliceAction()` |
| Bundle splitting | Dynamic import per store | Harder — single combined store |
| Individual store testing | Import single store | Need combined store or mock other slices |
| Merge conflicts | None across stores | Possible if slices share file |
| Subscriber isolation | Perfect — own store per domain | Selectors must be precise |
| Cross-store coordination complexity | Low per store, medium overall | Centralized in orchestrator |

**Hybrid approach:** Atomic stores for loosely related domains (auth, notifications, analytics). Slices for tightly coupled domains (cart + checkout + orders).

> **Think**: Notifications and auth are unrelated domains. Cart and checkout share order state. Which pattern for each?
>
> *Answer: Notifications + auth → atomic stores (no shared state, no cross-calls). Cart + checkout → slices in single store (shared order state, sequential actions). Hybrid: useAuthStore, useNotificationsStore, and useOrderStore (slices for cart+checkout+orders in one file).*

### Store Factory Pattern — Creating Similar Atomic Stores

When multiple domains share identical structure (CRUD entities, toggle sets, paginated lists), write a factory:

```typescript
// stores/createEntityStore.ts
import { create } from 'zustand'

interface EntityState<T extends { id: string }> {
  items: T[]
  loading: boolean
  error: string | null
  fetchItems: () => Promise<void>
  addItem: (item: T) => void
  updateItem: (id: string, data: Partial<T>) => void
  removeItem: (id: string) => void
}

export function createEntityStore<T extends { id: string }>(
  name: string,
  apiBase: string
) {
  return create<EntityState<T>>((set, get) => ({
    items: [],
    loading: false,
    error: null,
    fetchItems: async () => {
      set({ loading: true, error: null })
      try {
        const res = await fetch(apiBase)
        const data = await res.json()
        set({ items: data, loading: false })
      } catch (e) {
        set({ error: (e as Error).message, loading: false })
      }
    },
    addItem: (item) => set((s) => ({ items: [...s.items, item] })),
    updateItem: (id, data) =>
      set((s) => ({
        items: s.items.map((i) => (i.id === id ? { ...i, ...data } : i)),
      })),
    removeItem: (id) =>
      set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
  }))
}
```

Usage:

```typescript
// stores/productsStore.ts
interface Product extends EntityState<ProductItem> {
  // products-specific additions
  category: string | null
  setCategory: (cat: string | null) => void
}

export const useProductsStore = create<Product>((set) => ({
  ...createEntityStore<ProductItem>('products', '/api/products').getState(),
  // Re-attach actions since getState returns plain state
  ...Object.fromEntries(
    Object.entries(createEntityStore<ProductItem>('products', '/api/products'))
      .filter(([k]) => ['fetchItems', 'addItem', 'updateItem', 'removeItem'].includes(k))
  ),
  category: null,
  setCategory: (cat) => set({ category: cat }),
}))
```

**Better approach — factory returns store hook directly:**

```typescript
// stores/factories.ts
export function createCrudStore<T extends { id: string }>(name: string, apiBase: string) {
  const useStore = create<EntityState<T>>((set, get) => ({
    items: [],
    loading: false,
    error: null,
    fetchItems: async () => { /* ... */ },
    addItem: (item) => set((s) => ({ items: [...s.items, item] })),
    updateItem: (id, data) => set((s) => ({
      items: s.items.map(i => i.id === id ? { ...i, ...data } : i),
    })),
    removeItem: (id) => set((s) => ({
      items: s.items.filter(i => i.id !== id),
    })),
  }))

  const selectors = createSelectors<EntityState<T>>(useStore)
  return { useStore, selectors }
}

// Usage
export const { useStore: useProductsStore, selectors: productsSelectors } =
  createCrudStore<ProductItem>('products', '/api/products')

export const { useStore: useCategoriesStore, selectors: categoriesSelectors } =
  createCrudStore<CategoryItem>('categories', '/api/categories')
```

> **Think**: Three entity stores (products, categories, tags) all use the same factory. Add a new action `bulkDelete` to only products store. How?
>
> *Answer: Factory returns base store. Extend with `useProductsStore.setState` to inject new actions after creation. Or wrap factory output in a custom hook that composes base actions + domain-specific actions. Best: factory accepts `extensions` callback: `createCrudStore<Product>('products', '/api/products', (set, get) => ({ bulkDelete: (ids) => ... }))`.*

### Performance Measurement — Before and After Migration

Quantify atomic store migration impact:

```typescript
// measurement.ts
import { useAuthStore } from './stores/authStore'
import { useCartStore } from './stores/cartStore'
import { useProductsStore } from './stores/productsStore'
import { useUIStore } from './stores/uiStore'

// Count subscribers per store
let totalSubs = 0
;[useAuthStore, useCartStore, useProductsStore, useUIStore].forEach((store, i) => {
  const subCount = (store as any).listeners?.size ?? 0
  totalSubs += subCount
  console.log(`Store ${i}: ${subCount} subscribers`)
})
console.log(`Total: ${totalSubs}`)
```

**Key metrics:**

| Metric | Monolithic | Atomic | Improvement |
|--------|-----------|--------|-------------|
| Subscribers per update | 40 | ~8 | 5x fewer |
| Avg re-render per action | 12 | 2 | 6x reduction |
| Avg selector eval time | 0.4ms | 0.05ms | 8x faster |
| Bundle size (gzipped) | 4.2kB | 1.1kB per store | Lazy loadable |
| New dev setup time | 20min to understand store | 3min per store | ~7x faster |

**React DevTools Profiler approach:**

1. Record interaction in monolithic version (e.g., add item to cart)
2. Count re-rendered components in flamegraph
3. Migrate to atomic stores
4. Repeat same interaction
5. Compare flamegraph — fewer branches, shorter bars

> **Think**: Flamegraph shows 8 components re-render on "add to cart" in monolithic version. After atomic migration, same action shows 2 components. Which 2 should re-render?
>
> *Answer: Cart badge (count changes) + Cart drawer (items array changes). Auth, products, UI, notifications components should not appear in flamegraph at all. If they do, atomic store migration missed a subscription — component still subscribes to wrong store or selector is unstable.*

### Real Example: Refactoring Monolithic Store into 5 Atomic Stores

**E-commerce dashboard — monolithic store with 25 properties across 5 domains.**

```typescript
// Before: monolithic store (200 lines)
interface MonolithicStore {
  // Auth
  user: User | null
  token: string | null
  login: (e: string, p: string) => Promise<void>
  logout: () => void
  // Products
  products: Product[]
  productLoading: boolean
  productError: string | null
  fetchProducts: () => Promise<void>
  selectedCategory: string | null
  // Cart
  items: CartItem[]
  coupon: string | null
  addItem: (i: CartItem) => void
  removeItem: (id: string) => void
  applyCoupon: (code: string) => void
  clearCart: () => void
  // UI
  theme: 'light' | 'dark'
  sidebarOpen: boolean
  cartOpen: boolean
  toggleSidebar: () => void
  toggleCart: () => void
  setTheme: (t: 'light' | 'dark') => void
  // Orders
  orders: Order[]
  orderLoading: boolean
  fetchOrders: () => Promise<void>
  selectedOrderId: string | null
}
```

**After: 5 atomic stores with createSelectors.**

```typescript
// stores/authStore.ts — 30 lines
interface AuthState {
  user: User | null
  token: string | null
  login: (e: string, p: string) => Promise<void>
  logout: () => void
}

const useAuthStoreBase = create<AuthState>((set) => ({
  user: null,
  token: null,
  login: async (email, pw) => {
    const { user, token } = await api.login(email, pw)
    set({ user, token })
  },
  logout: () => set({ user: null, token: null }),
}))
export const useAuthStore = createSelectors<AuthState>(useAuthStoreBase)
```

```typescript
// stores/productsStore.ts — 40 lines
interface ProductsState {
  items: Product[]
  loading: boolean
  error: string | null
  selectedCategory: string | null
  fetchProducts: () => Promise<void>
  setCategory: (cat: string | null) => void
}

const useProductsStoreBase = create<ProductsState>((set) => ({
  items: [],
  loading: false,
  error: null,
  selectedCategory: null,
  fetchProducts: async () => {
    set({ loading: true, error: null })
    try {
      const items = await api.getProducts()
      set({ items, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },
  setCategory: (cat) => set({ selectedCategory: cat }),
}))
export const useProductsStore = createSelectors<ProductsState>(useProductsStoreBase)
```

```typescript
// stores/cartStore.ts — 35 lines
interface CartState {
  items: CartItem[]
  coupon: string | null
  addItem: (i: CartItem) => void
  removeItem: (id: string) => void
  applyCoupon: (code: string) => void
  clearCart: () => void
}

const useCartStoreBase = create<CartState>((set) => ({
  items: [],
  coupon: null,
  addItem: (item) => set((s) => ({ items: [...s.items, item] })),
  removeItem: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
  applyCoupon: (code) => set({ coupon: code }),
  clearCart: () => set({ items: [], coupon: null }),
}))
export const useCartStore = createSelectors<CartState>(useCartStoreBase)
```

```typescript
// stores/uiStore.ts — 25 lines
interface UIState {
  theme: 'light' | 'dark'
  sidebarOpen: boolean
  cartOpen: boolean
  toggleSidebar: () => void
  toggleCart: () => void
  setTheme: (t: 'light' | 'dark') => void
}

const useUIStoreBase = create<UIState>((set) => ({
  theme: 'light',
  sidebarOpen: true,
  cartOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleCart: () => set((s) => ({ cartOpen: !s.cartOpen })),
  setTheme: (t) => set({ theme: t }),
}))
export const useUIStore = createSelectors<UIState>(useUIStoreBase)
```

```typescript
// stores/ordersStore.ts — 40 lines
interface OrdersState {
  orders: Order[]
  loading: boolean
  selectedOrderId: string | null
  fetchOrders: () => Promise<void>
  selectOrder: (id: string | null) => void
}

const useOrdersStoreBase = create<OrdersState>((set) => ({
  orders: [],
  loading: false,
  selectedOrderId: null,
  fetchOrders: async () => {
    set({ loading: true })
    const orders = await api.getOrders()
    set({ orders, loading: false })
  },
  selectOrder: (id) => set({ selectedOrderId: id }),
}))
export const useOrdersStore = createSelectors<OrdersState>(useOrdersStoreBase)
```

```typescript
// stores/subscribers.ts — cross-store coordination
import { useAuthStore } from './authStore'
import { useCartStore } from './cartStore'
import { useProductsStore } from './productsStore'

// Clear cart + reset products on logout
useAuthStore.subscribe((state, prevState) => {
  if (state.user === null && prevState.user !== null) {
    useCartStore.getState().clearCart()
    useProductsStore.getState().setCategory(null)
  }
})
```

**Component usage — each component imports only its domain store:**

```typescript
function CartBadge() {
  const count = useCartStore.use.items()?.length ?? 0
  return <Badge count={count} />
}

function UserGreeting() {
  const user = useAuthStore.use.user()
  return <h1>Hello, {user?.name}</h1>
}

function Sidebar() {
  const open = useUIStore.use.sidebarOpen()
  return <aside className={open ? 'open' : 'closed'} />
}
```

**Migration result:**

| Metric | Before | After |
|--------|--------|-------|
| Store file size | 200 lines | 30-40 lines per store |
| Subscribers per update | 25-40 | 3-8 |
| Selector eval on unrelated update | Always runs | Never runs (different store) |
| Cross-domain re-renders | Frequent | Zero (subscribers handle coordination) |
| Bundle import cost | Full store | Per-domain |
| Time to understand a domain | Read entire store | Read 1 file |

> **Think**: Dev asks: "5 stores mean 5 imports per component. Before I imported once. Is this worth it?"
>
> *Answer: Yes. Each import is explicit about which domain this component depends on. One line per domain import. Benefit: component only re-renders on its domain's updates. Also: tree-shaking removes unused stores. A page that needs only auth + cart loads 2 stores, not 5. Monolithic store imports all 5 domains even if component uses one.*

---

### Why This Matters

Atomic store migration is the single highest-ROI performance optimization for Zustand apps. Slicing a monolithic store into atomic stores eliminates entire categories of unnecessary re-renders without changing a single component's logic — just which store it imports from.

The combination of atomic stores + stable selectors (`createSelectors`) + shallow equality (`useShallow`) creates a nearly zero-cost subscription model. Components re-render only when their exact data changes. No cascading evaluations, no spurious updates from unrelated domains.

Zustand's weakness #1 — over-subscription and selector instability — is not a framework flaw. It is a pattern choice. Atomic stores are the architectural fix. This module's techniques are the daily tools that make Zustand apps fast at any scale.

---

### Common Questions

**Q: How many atomic stores is too many?**
A: 3-7 atomic stores per app is typical. More than 10 suggests over-splitting. If stores have 1-2 properties, they are probably logical constants or refs, not state. Merge tiny stores back. Rule: if a store has fewer properties than lines of import boilerplate, reconsider.

**Q: How do atomic stores handle cross-cutting state like auth?**
A: Subscriber pattern. Auth store emits changes; other stores subscribe. No direct store-to-store imports. Alternatively, pass auth token as argument to API calls rather than reading from auth store in other stores. This keeps domain isolation.

**Q: Do atomic stores work with Zustand middleware (persist, immer, devtools)?**
A: Yes. Each store gets its own middleware chain. Persist user preferences in uiStore, not authStore. Immer in cartStore for mutable cart updates. Devtools per store — each store has its own devtools timeline, which is actually clearer than one store's timeline.

**Q: Atomic stores vs Jotai atoms — what is the difference?**
A: Jotai atoms are even more granular (one atom per value). Atomic Zustand stores are aggregations of related atoms. Jotai has built-in dependency tracking — reading atom A that depends on atom B triggers only A's subscribers when B changes. Zustand atomic stores require explicit subscriber wiring. Jotai uses more Proxy machinery; Zustand atomic stores are plain objects. Both solve the same problem with different tradeoffs.

**Q: Does createSelectors support nested selectors?**
A: Default implementation supports top-level keys only. For nested selectors, extend: `createSelectors(store, { path: (s) => s.deeply.nested.value })`. Or compose: `useAuthStore.use.user()` returns User object; component selects `.name` from it. Drawback: selecting the whole User object subscribes to any User field change.

**Q: Should I migrate all stores at once or incrementally?**
A: Incrementally. Extract the most independent domain first (UI or notifications — no cross-dependencies). Then extract domains one per PR. Keep a bridge: subscribers from old monolithic store to new atomic stores. Once all consumers migrate, delete monolithic store.

---

## Examples

### Example 1: Chat App — Monolithic to Atomic

**Problem**: Chat app re-renders entire channel list when typing a message. Monolithic store has 18 properties across 4 domains.

```typescript
// Before: monolithic store
interface ChatStore {
  // Auth
  user: User | null
  onlineStatus: 'online' | 'away' | 'offline'
  // Channels
  channels: Channel[]
  currentChannelId: string | null
  unreadCounts: Record<string, number>
  // Messages
  messages: Record<string, Message[]>
  draft: string
  sending: boolean
  // UI
  sidebarOpen: boolean
  pinnedChannels: string[]
  typingUsers: string[]
  notifications: boolean
}
```

**Atomic breakdown:**

| Store | State | Subscribers |
|-------|-------|-------------|
| `useAuthStore` | user, onlineStatus | 2 (UserAvatar, StatusIndicator) |
| `useChannelStore` | channels, currentChannelId, unreadCounts | 3 (ChannelList, ChannelHeader, UnreadBadge) |
| `useMessageStore` | messages, draft, sending | 4 (MessageList, MessageInput, SendButton) |
| `useUIStore` | sidebarOpen, pinnedChannels, typingUsers, notifications | 3 (Sidebar, PinList, TypingIndicator, NotificationToggle) |

**Component migration:**

```typescript
// Before
function MessageInput() {
  const draft = useStore((s) => s.draft)
  const send = useStore((s) => s.sendMessage)
  // Also re-evaluates on channels, user, sidebar, pinned changes
}

// After
function MessageInput() {
  const draft = useMessageStore((s) => s.draft)
  const send = useMessageStore((s) => s.sendMessage)
  // Re-evaluates only on message store changes
}
```

**Result**: Typing updates draft in message store. Only MessageInput re-renders. ChannelList, Sidebar, UserAvatar, UnreadBadge — zero re-renders. Before: 8+ components re-rendered per keystroke. After: 1 component.

### Example 2: Dashboard with createSelectors + useShallow

**Problem**: SaaS dashboard with 4 data panels (revenue, users, sessions, conversion). All 4 re-render on any metric update.

**Solution**: Atomic stores + stable selectors per metric.

```typescript
// stores/metricsStore.ts — atomic store for all metrics
interface MetricsState {
  revenue: number
  users: number
  sessions: number
  conversion: number
  loading: boolean
  lastUpdated: number | null
  fetchMetrics: () => Promise<void>
}

const useMetricsStoreBase = create<MetricsState>((set) => ({
  revenue: 0,
  users: 0,
  sessions: 0,
  conversion: 0,
  loading: false,
  lastUpdated: null,
  fetchMetrics: async () => {
    set({ loading: true })
    const data = await api.getMetrics()
    set({ ...data, loading: false, lastUpdated: Date.now() })
  },
}))

export const useMetricsStore = createSelectors<MetricsState>(useMetricsStoreBase)
```

**Four components, each subscribing to one metric:**

```typescript
function RevenueCard() {
  const revenue = useMetricsStore.use.revenue()
  return <MetricCard title="Revenue" value={formatCurrency(revenue)} />
}

function UsersCard() {
  const users = useMetricsStore.use.users()
  return <MetricCard title="Users" value={formatNumber(users)} />
}

function SessionsCard() {
  const sessions = useMetricsStore.use.sessions()
  return <MetricCard title="Sessions" value={formatNumber(sessions)} />
}

function ConversionCard() {
  const conversion = useMetricsStore.use.conversion()
  return <MetricCard title="Conversion" value={formatPercent(conversion)} />
}
```

**What happens when revenue updates?**

```
Before (monolithic, no createSelectors):
  All 4 panels re-render (each selector extracted a new object or entire store)
  Also: auth header re-renders, sidebar re-renders, notification bell re-renders
  Total: ~10 re-renders

After (atomic store + createSelectors):
  RevenueCard re-renders (revenue changed)
  UsersCard skips (users unchanged — Object.is says equal)
  SessionsCard skips
  ConversionCard skips
  Auth header skips (different store entirely)
  Sidebar skips (different store)
  Total: 1 re-render
```

### Example 3: Store Factory for Multi-Tenant Dashboard

**Problem**: Multi-tenant SaaS — each customer has own products, orders, and analytics. 5 stores with identical shape per customer.

**Solution**: Store factory parameterized by tenant ID.

```typescript
// stores/createTenantStores.ts
interface TenantData {
  products: Product[]
  orders: Order[]
  analytics: Analytics
}

const tenantStores = new Map<string, {
  useProducts: ReturnType<typeof createSelectors>
  useOrders: ReturnType<typeof createSelectors>
  useAnalytics: ReturnType<typeof createSelectors>
}>()

export function getTenantStores(tenantId: string) {
  if (tenantStores.has(tenantId)) return tenantStores.get(tenantId)!

  const useProductsBase = create<ProductState>((set) => ({
    items: [],
    loading: false,
    fetchProducts: async () => {
      const items = await api.getProducts(tenantId)
      set({ items })
    },
  }))

  const useOrdersBase = create<OrderState>((set) => ({
    items: [],
    loading: false,
    fetchOrders: async () => {
      const items = await api.getOrders(tenantId)
      set({ items })
    },
  }))

  const useAnalyticsBase = create<AnalyticsState>((set) => ({
    metrics: { revenue: 0, users: 0 },
    loading: false,
    fetchAnalytics: async () => {
      const metrics = await api.getAnalytics(tenantId)
      set({ metrics })
    },
  }))

  const stores = {
    useProducts: createSelectors<ProductState>(useProductsBase),
    useOrders: createSelectors<OrderState>(useOrdersBase),
    useAnalytics: createSelectors<AnalyticsState>(useAnalyticsBase),
  }

  tenantStores.set(tenantId, stores)
  return stores
}

// Component
function TenantDashboard({ tenantId }: { tenantId: string }) {
  const { useProducts } = getTenantStores(tenantId)
  const products = useProducts.use.items()

  return <ProductTable items={products} />
}
```

Each tenant gets own store instances. No cross-tenant state pollution. Stores created lazily on first access. Memory: negligible — each store is ~1kB of closures.

> **Think**: What leaks if tenants are created and never cleaned up?
>
> *Answer: Map grows unbounded. Fix: implement cleanup on tenant unmount: `tenantStores.delete(tenantId)`. Use WeakMap with component lifecycle if tenants mount/unmount frequently. Or LRU eviction for least-recently-used tenants.*

---

## Key Takeaways
- Atomic stores: one store per domain concern. Components subscribe only to their domain's store
- Breaking monolithic store into atomic stores eliminates cross-domain subscription entirely
- `createSelectors` utility auto-generates stable selectors for every state property — no inline object creation
- `useShallow` prevents re-render from object selectors by comparing key/value pairs
- Custom equality functions handle edge cases: deep comparison, ID-based comparison, length-only comparison
- Atomic stores + slices hybrid: atomic for independent domains, slices for tightly coupled domains
- Store factory pattern creates similar atomic stores without code duplication
- Performance measurement: compare subscriber count, re-render count, and flamegraph depth before/after migration
- Real-world: 5 atomic stores replacing 1 monolithic store — subscriber count per action drops from ~40 to ~8
- Incremental migration: extract most independent store first, use subscribers as bridge, delete monolithic store last

## Common Misconception

**"Atomic stores are just slices with extra steps — same outcome, more boilerplate."**

Atomic stores and slices solve different problems. Slices organize a single store into domain modules within the same `create()` call. All slices share one subscriber list — every state change evaluates every subscriber's selector. Atomic stores create independent subscriber lists — a change in store A never evaluates subscribers in store B.

The difference is architectural isolation vs code organization. Slices give you organized monolith. Atomic stores give you separate state machines. For apps where domains are genuinely independent (auth ≠ notifications ≠ theme), atomic stores provide strict isolation that slices cannot match. For tightly coupled domains (cart + checkout + orders), slices or a combined atomic store are more appropriate.

Choose by coupling: loosely coupled → atomic stores. Tightly coupled → slices (or single atomic store with scoped selectors). Not by preference for boilerplate.

---

## Feynman Explain
(Explain atomic stores to a junior dev who knows only `useState`. They understand "one state per component" but not "one store per domain." Analogy: kitchen drawers. Monolithic store = one giant drawer with forks, knives, plates, pots, and measuring cups all mixed together. To get a fork, you open the drawer and everything shifts. Atomic stores = separate drawers for forks, knives, plates. To get a fork, you open only the fork drawer. Nothing else moves. App drawers = authStore, cartStore, uiStore, productsStore. You only open the drawer you need, and nothing else gets disturbed.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain zustand-state-management` — AI probes gaps.*

---

## Reframe
(Pause. Critique: Atomic stores eliminate cross-domain subscription but add cross-store coordination complexity. Logout must clear cart — with monolithic store this was one `set()` call. With atomic stores, subscriber listens to auth changes. Is the subscription overhead worth the re-render savings? Also: createSelectors hides selector logic behind a utility — does this make debugging harder? When does atomic discipline become over-engineering? Consider: 3-person startup, MVP app, 10 store properties. Would you start atomic or refactor to atomic when performance becomes measurable problem? Write your evaluation — weigh coordination complexity against re-render savings.)

---

## Drill
Take the quiz. MCQs test atomic store decomposition, selectors stability, createSelectors usage, useShallow vs shallow, custom equality functions, and migration strategy.

Run: `learn.sh quiz zustand-state-management 14-atomic-stores`
