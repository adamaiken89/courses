# Module 8: Slices Pattern — Scalable Store Composition

Est. study time: 2h
Language: en

## Learning Objectives
- Split a monolithic Zustand store into domain-specific slices with TypeScript
- Combine multiple slices into a single store using Zustand's slice pattern
- Implement cross-slice actions that read and write state across slice boundaries
- Apply folder-by-slice organization for stores exceeding 500 lines
- Refactor existing flat stores into slice architecture

---

## Core Content

### The Problem: Monolithic Store Does Not Scale

Single `create()` block works for small stores (3-5 properties). Beyond ~10 properties or ~5 actions, monolithic store creates problems:

```typescript
// Monolithic — fine at 50 lines, painful at 500
const useStore = create<AppState>((set, get) => ({
  // auth
  user: null,
  token: null,
  login: () => { /* 20 lines */ },
  logout: () => { /* 15 lines */ },
  // cart
  items: [],
  coupon: null,
  addItem: () => { /* 20 lines */ },
  removeItem: () => { /* 15 lines */ },
  applyCoupon: () => { /* 10 lines */ },
  // products
  products: [],
  loading: false,
  fetchProducts: () => { /* 25 lines */ },
  // ui
  theme: 'light',
  sidebarOpen: false,
  toggleSidebar: () => { /* 3 lines */ },
  setTheme: () => { /* 5 lines */ },
}))
```

Problems:
- No domain boundaries — auth logic mixed with cart logic
- Collision risk: two features adding `loading` with different meanings
- Hard to parallelize work: one developer touches auth, another touches cart — both edit same `create()` block
- Testing requires importing the entire store even for one slice
- Bundle splitting impossible — all logic in one closure

> **Think**: Your store has 30 properties across 6 domains. Three developers work on it concurrently. What merge conflicts do you predict?
>
> *Answer: Every action function, state property, and TypeScript interface lives in one file. Two developers adding features cause merge conflicts on the `create()` call signature, the state interface, and the `set` closure. Slices let each developer own their file with zero cross-edits.*

### Slices Pattern Defined

A slice is a self-contained unit of store logic: state properties + actions. Each slice is a function that receives `set` and `get` and returns a partial state object.

```typescript
import { StateCreator } from 'zustand'

// Slice: auth
interface AuthSlice {
  user: string | null
  token: string | null
  login: (email: string, password: string) => void
  logout: () => void
}

const createAuthSlice: StateCreator<AuthSlice, [], [], AuthSlice> = (set) => ({
  user: null,
  token: null,
  login: (email, password) => {
    // API call
    set({ user: email, token: 'mock-token' })
  },
  logout: () => set({ user: null, token: null }),
})

// Slice: cart
interface CartSlice {
  items: Array<{ id: string; name: string; price: number }>
  addItem: (item: CartSlice['items'][0]) => void
  removeItem: (id: string) => void
}

const createCartSlice: StateCreator<CartSlice, [], [], CartSlice> = (set) => ({
  items: [],
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  removeItem: (id) => set((state) => ({ items: state.items.filter(i => i.id !== id) })),
})
```

Each slice function is independent — testable, tree-shakeable, ownable by one developer.

> **Think**: Can two slices define the same property name `loading`? What happens?
>
> *Answer: Yes. Zustand merges slice objects. Later slice overwrites earlier slice's property. Risk: two slices use `loading` for different meanings (auth loading vs products loading). Prevent with prefix convention: `authLoading`, `productsLoading` or nest by domain: `auth: { loading, user }`, `products: { loading, items }`.*

### Combining Slices into One Store

`create()` accepts multiple slice creators by intersecting their types:

```typescript
import { create } from 'zustand'

type AppState = AuthSlice & CartSlice

const useStore = create<AppState>()((...a) => ({
  ...createAuthSlice(...a),
  ...createCartSlice(...a),
}))
```

Each slice creator receives the same `set` and `get` — they operate on the shared store. The spread merge works because each slice returns a disjoint set of property names.

TypeScript intersection `AuthSlice & CartSlice` ensures the store exposes all properties and actions with correct types.

> **Think**: What if two slices both return a `reset` function? Which one wins? How do you fix?
>
> *Answer: Spread order decides. Last spread wins. Fix: namespace reset functions: `resetAuth`, `resetCart`, or create a separate `createRootActions` slice that calls slice-specific resets.*

### Slice Typing: TypeScript Per-Slice + Combined

Each slice has its own interface. The combined store type is the intersection of all slice interfaces:

```typescript
// slices/auth.ts
export interface AuthSlice {
  user: string | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

// slices/cart.ts
export interface CartSlice {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (itemId: string) => void
  total: number
}

// slices/products.ts
export interface ProductsSlice {
  products: Product[]
  loading: boolean
  fetchProducts: (category?: string) => Promise<void>
}

// store.ts
import { create } from 'zustand'
import { createAuthSlice } from './slices/auth'
import { createCartSlice } from './slices/cart'
import { createProductsSlice } from './slices/products'

export type AppStore = AuthSlice & CartSlice & ProductsSlice

export const useStore = create<AppStore>()((...a) => ({
  ...createAuthSlice(...a),
  ...createCartSlice(...a),
  ...createProductsSlice(...a),
}))
```

Three `StateCreator` calls, one store. Each slice interface is exported for testing, for consumers that only need one slice type, and for documentation.

TypeScript catches cross-slice issues at compile time: if `cartSlice` references `user` from `AuthSlice` without the correct type, TS flags the mismatch.

> **Think**: Why export each slice interface separately instead of only exporting `AppStore`?
>
> *Answer: Granular imports. A component that only needs `user` and `login` can type its `useStore` selection as `Pick<AuthSlice, 'user' | 'login'>`. Tests for `AuthSlice` logic import only `AuthSlice`. No need to pull in cart or products types. Also: slice interfaces serve as documentation boundaries — each domain has explicit contract.*

### Cross-Slice Actions: Reading and Writing Across Slices

Cross-slice action = action in one slice reads or writes state owned by another slice. Zustand enables this because all slices share the same `set` and `get`.

```typescript
// slices/auth.ts
import { StateCreator } from 'zustand'

export interface AuthSlice {
  user: { id: string; name: string } | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

// slices/cart.ts
import { StateCreator } from 'zustand'
import type { AuthSlice } from './auth'

export interface CartSlice {
  items: CartItem[]
  addItem: (item: CartItem) => void
  clearCart: () => void
}

// Cross-slice action: clear cart on logout
export const createCartSlice: StateCreator<
  CartSlice & AuthSlice,  // Other slices this slice depends on
  [],
  [],
  CartSlice               // This slice's own shape
> = (set, get) => ({
  items: [],
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  clearCart: () => set({ items: [] }),
})
```

The first generic parameter to `StateCreator` lists all slices this slice depends on. During composition, TypeScript validates the cross-slice access is safe.

In `authSlice`, trigger cross-slice action:

```typescript
// slices/auth.ts
import { StateCreator } from 'zustand'
import type { CartSlice } from './cart'

export const createAuthSlice: StateCreator<
  AuthSlice & CartSlice,
  [],
  [],
  AuthSlice
> = (set, get) => ({
  user: null,
  token: null,
  login: async (email, password) => {
    const res = await api.login(email, password)
    set({ user: res.user, token: res.token })
  },
  logout: () => {
    // Clear own state
    set({ user: null, token: null })
    // Cross-slice: clear cart
    get().clearCart()
    // Cross-slice: reset product loading
    set({ loading: false })
  },
})
```

`get()` returns the entire store — all slices. This is how cross-slice communication works: read any slice's state, call any slice's action.

> **Think**: `logout()` in `authSlice` calls `clearCart()` from `cartSlice`. Is this coupling acceptable? When does it become a problem?
>
> *Answer: Acceptable for domain events (logout → clear cart). Problem when cross-slice calls create circular dependencies: `authSlice.logout → cartSlice.clearCart → authSlice.syncCart → ...`. Prevent: (1) keep cross-slice calls unidirectional, (2) document dependencies in slice interface generics, (3) consider an orchestrator slice for complex cross-cutting flows.*

### Slice Communication Patterns

Four patterns for cross-slice communication:

**1. Direct action call (tight coupling):**
```typescript
// auth slice calls cart slice action directly
get().clearCart()
```
Pro: Simple, type-safe. Con: Creates hard dependency between slices.

**2. Shared event bus (loose coupling):**
```typescript
// store.ts
const eventBus = createEventBus<{ type: 'LOGOUT' | 'CART_UPDATED' }>()

// auth slice
const createAuthSlice: StateCreator<...> = (set, get) => ({
  logout: () => {
    set({ user: null, token: null })
    eventBus.emit({ type: 'LOGOUT' })    // Broadcast, not direct call
  },
})

// cart slice subscribes in its creator
const createCartSlice: StateCreator<...> = (set, get) => {
  eventBus.on({ type: 'LOGOUT' }, () => {
    set({ items: [] })  // Respond independently
  })
  return { items: [], addItem: ..., removeItem: ... }
}
```
Pro: Slices stay independent, no hard imports. Con: Subscription logic in slice creators, harder to trace flows.

**3. Orchestrator slice (centralized coordination):**
```typescript
// slices/orchestrator.ts
export const createOrchestratorSlice: StateCreator<
  AuthSlice & CartSlice & ProductsSlice,
  [],
  [],
  OrchestratorSlice
> = (set, get) => ({
  handleLogout: () => {
    get().logout()       // Delegate to auth
    get().clearCart()    // Delegate to cart
    set({ products: [], loading: false })
  },
})
```
Pro: Cross-slice flows live in one place, not scattered. Con: Extra layer, one more slice to maintain.

**4. Zustand middleware (`subscribe`):**
```typescript
// Outside store — middleware or subscriber
useStore.subscribe((state, prevState) => {
  if (state.user === null && prevState.user !== null) {
    // User just logged out — clear cart
    useStore.getState().clearCart()
  }
})
```
Pro: Decoupled, reacts to state changes. Con: Implicit, runs on every state change.

| Pattern | Coupling | Traceability | Testability | Best for |
|---------|----------|--------------|-------------|----------|
| Direct call | Tight | High | Medium | Simple 1:1 dependency |
| Event bus | Loose | Medium | High | 1:N reactions |
| Orchestrator | Controlled | Highest | Highest | Complex workflows |
| Subscriber | Loose | Low | Medium | Side effects, not actions |

> **Think**: A checkout flow: validate cart → charge payment → clear cart → show receipt. Which communication pattern fits?
>
> *Answer: Orchestrator slice. Checkout spans auth (payment), cart (clear), and ui (receipt). Orchestrator owns the sequential workflow, calls each slice action in order, handles rollback on failure. Direct calls would scatter checkout logic across slices. Subscriber would make the flow implicit and hard to debug.*

### Calling `set()` Across Slices

Each slice receives the shared `set`. A slice can update properties from any other slice:

```typescript
// products slice updates auth slice's state? Technically possible:
const createProductsSlice: StateCreator<
  ProductsSlice & AuthSlice, ...
> = (set) => ({
  products: [],
  loading: false,
  fetchProducts: async () => {
    set({ loading: true })                    // own state
    try {
      const products = await api.getProducts()
      set({ products })
    } catch {
      set({ token: null } as Partial<AuthSlice>)  // cross-slice set — works but bad practice
    }
  },
})
```

Cross-slice `set()` is technically possible — all `set()` calls merge into the same store — but it is an anti-pattern. It creates invisible dependencies. The owning slice no longer controls its state transitions.

Rule: **A slice should only `set()` its own properties.** Use cross-slice action calls (`get().otherSliceAction()`) instead of cross-slice `set()`.

TypeScript can enforce this with slice-aware type narrowing, but the simplest enforcement is code review convention: inspect `set()` calls to verify they only touch the slice's own interface keys.

> **Think**: A bug: `productsSlice.fetchProducts` sets `error: 'Network error'` that was defined in `uiSlice`. Both slices had an `error` property. What goes wrong?
>
> *Answer: `uiSlice` and `productsSlice` both own `error`. When `fetchProducts` sets `error: 'Network error'`, it overwrites `uiSlice.error` silently. UI components subscribed to `uiSlice.error` see the network error. Fix: namespace errors: `productsError: string | null` in ProductsSlice, `uiError: string | null` in UISlice. Or nest: `products: { error, loading, items }`.*

### Reusable Slice Factories

When multiple domains share the same pattern (CRUD entities, paginated lists, toggle sets), write a slice factory instead of repeating code:

```typescript
// factories/createCrudSlice.ts
import { StateCreator } from 'zustand'

interface CrudSlice<T extends { id: string }> {
  items: T[]
  addItem: (item: T) => void
  updateItem: (id: string, updates: Partial<T>) => void
  removeItem: (id: string) => void
  resetItems: () => void
}

export function createCrudSlice<T extends { id: string }>(
  initialItems: T[] = []
): StateCreator<CrudSlice<T>, [], [], CrudSlice<T>> {
  return (set) => ({
    items: initialItems,
    addItem: (item) => set((state) => ({ items: [...state.items, item] })),
    updateItem: (id, updates) =>
      set((state) => ({
        items: state.items.map((i) =>
          i.id === id ? { ...i, ...updates } : i
        ),
      })),
    removeItem: (id) =>
      set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
    resetItems: () => set({ items: initialItems }),
  })
}
```

Use in multiple slices:

```typescript
// slices/products.ts
interface Product extends CrudSlice<ProductItem> {
  // products-specific state
  filters: ProductFilters
  setFilters: (filters: ProductFilters) => void
}

export const createProductsSlice: StateCreator<ProductSlice, [], [], ProductSlice> = (set) => ({
  ...createCrudSlice<ProductItem>([])(set, () => ({} as ProductSlice), {} as any),
  filters: {},
  setFilters: (filters) => set({ filters }),
})

// slices/categories.ts
export const createCategoriesSlice = (set) => ({
  ...createCrudSlice<Category>([])(set, () => ({} as AppStore), {} as any),
})
```

The slice factory reduces duplicated CRUD logic across `products`, `categories`, `tags`, `users` domains. Each domain calls `createCrudSlice` with its entity type.

> **Think**: A slice factory creates `addItem`, `updateItem`, `removeItem`. Each domain needs a slightly different `addItem` — products validate uniqueness, categories do not. How do you handle variation?
>
> *Answer: Two options: (1) factory accepts an `onBeforeAdd` callback: `createCrudSlice({ onBeforeAdd: (item) => validateUnique(item) })`. (2) Factory returns base actions, domain overrides: `addItem: (item) => { if (isUnique(item)) factoryAddItem(item) }`. Prefer callback option — keeps override logic inside factory, not scattered across domains.*

### Large Store Organization: Folder Per Slice

Store beyond ~500 lines benefits from folder structure:

```
store/
├── index.ts              # create() combining all slices
├── types.ts              # shared types (AppStore, slice intersections)
├── slices/
│   ├── auth.ts           # AuthSlice creation + interface
│   ├── cart.ts           # CartSlice creation + interface
│   ├── products.ts       # ProductsSlice creation + interface
│   ├── ui.ts             # UISlice creation + interface
│   └── orchestrator.ts   # cross-slice flows
├── factories/
│   ├── createCrudSlice.ts
│   ├── createPaginatedSlice.ts
│   └── createToggleSlice.ts
└── middleware/
    ├── logging.ts
    └── analytics.ts
```

File responsibilities:
- `store/types.ts` — exports `AppStore = AuthSlice & CartSlice & ProductsSlice & UISlice`. Used by components, tests, middleware.
- `store/index.ts` — imports slices, calls `create<AppStore>()`, exports `useStore`.
- `store/slices/*.ts` — each exports slice interface + creator function. Slice creators import only zustand `StateCreator` and shared types.
- `store/factories/*.ts` — generic slice creators parameterized by entity type.

This structure:
- Each slice is < 100 lines
- No merge conflicts between developers working on different slices
- Factories extracted when pattern repeats 3+ times
- Orchestrator slice acts as the "application service" layer

> **Think**: A store reaches 2000 lines. Without slices, what happens to maintainability?
>
> *Answer: Single file exceeds editor comfort zone. Finding state properties requires scrolling or searching entire file. Every developer touching any feature works in the same file — git conflicts daily. Adding a single property means understanding the entire store. Testing any slice requires loading all dependencies. Slices decompose the monolith into domain modules with clear boundaries.*

### Performance: Why Slices Prevent Monolithic Re-renders

Monolithic stores cause unnecessary re-renders because every subscription to any property binds to the same store. When one slice updates, all subscribers re-evaluate — even if their slice did not change.

```typescript
// Monolithic: one store, every subscriber checks every update
const user = useStore((s) => s.user)         // re-evaluates on cart change
const items = useStore((s) => s.items)       // re-evaluates on auth change
```

With slices, selectors naturally limit scope:

```typescript
// Combined store — still single store, but selectors limit scope
const user = useStore((s) => s.user)   // only re-renders when s.user changes
const items = useStore((s) => s.items) // only re-renders when s.items changes
```

This is actually Zustand's selector-based granularity — same performance whether monolithic or sliced. The real performance win from slices is:

1. **Tree-shaking dead slices**: If you only use `AuthSlice`, the module bundler can tree-shake unused slices (with ESM and side-effect-free imports).
2. **Lazy slice loading**: Code-split slices by route. Dashboard loads `ProductsSlice` only when user visits products page.
3. **Parallel subscriptions**: Each slice's selectors reference different memory addresses — React bails out of re-render when selector output is reference-equal.

The false concern: "slices make store bigger, causing more re-renders." Store size (number of properties) does not affect re-render count. What matters is the number of subscribers and whether their selector returns new reference on unrelated updates. Slices do not worsen this — they improve maintainability without performance cost.

> **Think**: A component subscribes to `useStore((s) => s.user)`. A cart action adds an item. Does the component re-render?
>
> *Answer: No. Zustand's `useSyncExternalStore` checks selector output reference equality. `s.user` did not change — same value, same reference. Component skips re-render. This is true regardless of monolithic or sliced store. Slices do not change selector behavior.*

### Migration: Refactoring Flat Store into Slices

Step-by-step refactor of existing monolithic store:

**Before:**
```typescript
const useStore = create<AppState>((set, get) => ({
  user: null,
  token: null,
  items: [],
  products: [],
  theme: 'light',
  login: (email, pw) => { /* ... */ },
  logout: () => { /* ... */ },
  addItem: (item) => { /* ... */ },
  fetchProducts: () => { /* ... */ },
  toggleTheme: () => { /* ... */ },
}))
```

**Step 1: Extract slice interfaces**
```typescript
// types.ts
export interface AuthSlice {
  user: string | null
  token: string | null
  login: (email: string, pw: string) => void
  logout: () => void
}
export interface CartSlice { /* ... */ }
export interface ProductsSlice { /* ... */ }
export interface UISlice { /* ... */ }
```

**Step 2: Extract first slice creator (easiest, fewest cross-dependencies)**
```typescript
// slices/auth.ts
export const createAuthSlice: StateCreator<AuthSlice, [], [], AuthSlice> = (set) => ({
  user: null,
  token: null,
  login: (email, pw) => {
    set({ user: email, token: pw }) // simplified
  },
  logout: () => set({ user: null, token: null }),
})
```

**Step 3: Replace inline logic with slice spread**
```typescript
const useStore = create<AppState>()((...a) => ({
  ...createAuthSlice(...a),
  // ... other slices as extracted
}))
```

**Step 4: Handle cross-slice dependencies**

If `logout` also calls `clearCart`, update `AuthSlice` creator to depend on `CartSlice`:

```typescript
export const createAuthSlice: StateCreator<
  AuthSlice & CartSlice,  // depends on cart
  [],
  [],
  AuthSlice
> = (set, get) => ({
  user: null,
  token: null,
  login: (email, pw) => set({ user: email, token: pw }),
  logout: () => {
    set({ user: null, token: null })
    get().clearCart()  // cross-slice call
  },
})
```

**Step 5: Repeat for remaining slices. Extract factories on 3rd repetition.**

Migration rule: **Extract one slice per PR.** No big bang. Each PR extracts a slice, updates the store composition, and fixes any broken imports. The store keeps working after each step.

> **Think**: You extract `AuthSlice` but `logout` references `clearCart` which still lives in the monolithic `create()`. How do you handle the intermediate state?
>
> *Answer: Temporary adapter. In `createAuthSlice`, call `get().clearCart()` — it exists on the store because the rest of the monolith still injects it. After extracting `CartSlice`, the call still works. The adapter is the spread merge of both slice results. No intermediate breakage.*

### Real Example: E-Commerce Store with User/Cart/Products Slices

```typescript
// store/types.ts
export interface UserSlice {
  user: { id: string; name: string; email: string } | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  updateProfile: (data: Partial<User>) => Promise<void>
}

export interface CartSlice {
  items: CartItem[]
  coupon: string | null
  total: number
  addItem: (product: Product, quantity: number) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, qty: number) => void
  applyCoupon: (code: string) => void
  clearCart: () => void
}

export interface ProductsSlice {
  items: Product[]
  categories: string[]
  selectedCategory: string | null
  loading: boolean
  error: string | null
  fetchProducts: (category?: string) => Promise<void>
  fetchCategories: () => Promise<void>
  setSelectedCategory: (category: string | null) => void
}

export interface UISlice {
  sidebarOpen: boolean
  cartDrawerOpen: boolean
  theme: 'light' | 'dark'
  toggleSidebar: () => void
  toggleCartDrawer: () => void
  setTheme: (theme: 'light' | 'dark') => void
}

export type AppStore = UserSlice & CartSlice & ProductsSlice & UISlice
```

```typescript
// store/slices/cart.ts
import { StateCreator } from 'zustand'
import type { AppStore } from '../types'

export const createCartSlice: StateCreator<
  AppStore, [], [], CartSlice
> = (set, get) => ({
  items: [],
  coupon: null,
  total: 0,
  addItem: (product, quantity) => {
    const existing = get().items.find(i => i.productId === product.id)
    if (existing) {
      set({
        items: get().items.map(i =>
          i.productId === product.id
            ? { ...i, quantity: i.quantity + quantity }
            : i
        ),
      })
    } else {
      set({
        items: [...get().items, {
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity,
        }],
      })
    }
    // Recalculate total
    const items = get().items
    set({ total: items.reduce((sum, i) => sum + i.price * i.quantity, 0) })
  },
  removeItem: (productId) => {
    set({ items: get().items.filter(i => i.productId !== productId) })
    set({ total: get().items.reduce((sum, i) => sum + i.price * i.quantity, 0) })
  },
  updateQuantity: (productId, qty) => {
    set({
      items: get().items.map(i =>
        i.productId === productId ? { ...i, quantity: qty } : i
      ),
    })
  },
  applyCoupon: (code) => {
    set({ coupon: code })
    // Recalculate with discount
    const discount = code === 'SAVE10' ? 0.9 : 1
    const items = get().items
    set({ total: items.reduce((sum, i) => sum + i.price * i.quantity, 0) * discount })
  },
  clearCart: () => set({ items: [], coupon: null, total: 0 }),
})
```

```typescript
// store/slices/user.ts
import { StateCreator } from 'zustand'
import type { AppStore } from '../types'

export const createUserSlice: StateCreator<
  AppStore, [], [], UserSlice
> = (set, get) => ({
  user: null,
  login: async (email, password) => {
    const res = await fetch('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    set({ user: data.user })
  },
  logout: () => {
    set({ user: null })
    // Cross-slice: clear cart and reset UI
    get().clearCart()
    get().setSelectedCategory(null)
  },
  updateProfile: async (data) => {
    const user = get().user
    if (!user) return
    const res = await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
    const updated = await res.json()
    set({ user: { ...user, ...updated } })
  },
})
```

```typescript
// store/index.ts
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { AppStore } from './types'
import { createUserSlice } from './slices/user'
import { createCartSlice } from './slices/cart'
import { createProductsSlice } from './slices/products'
import { createUISlice } from './slices/ui'

export const useStore = create<AppStore>()(
  devtools(
    (...a) => ({
      ...createUserSlice(...a),
      ...createCartSlice(...a),
      ...createProductsSlice(...a),
      ...createUISlice(...a),
    }),
    { name: 'ecommerce-store' }
  )
)
```

Component usage:

```typescript
function CartDrawer() {
  const items = useStore((s) => s.items)
  const total = useStore((s) => s.total)
  const removeItem = useStore((s) => s.removeItem)
  const user = useStore((s) => s.user)

  if (!user) return <p>Login to view cart</p>

  return (
    <div>
      {items.map(item => (
        <div key={item.productId}>
          <span>{item.name} x{item.quantity}</span>
          <button onClick={() => removeItem(item.productId)}>Remove</button>
        </div>
      ))}
      <p>Total: ${total.toFixed(2)}</p>
    </div>
  )
}
```

Each component subscribes to only the selectors it needs. Zustand's equality check prevents re-renders when unrelated slice updates.

> **Think**: The `CartDrawer` reads `s.user` from `UserSlice` and `s.items` from `CartSlice`. Is this cross-slice access in a component acceptable?
>
> *Answer: Yes. Components naturally consume state from multiple domains. The slice boundary is a creation-time concern, not a consumption-time constraint. Components freely select properties from any slice. The slice pattern organizes store creation, not store consumption.*

---

### Why This Matters

Slices are the primary scaling mechanism for Zustand stores. Teams that skip slices hit a maintainability wall around 15-20 store properties: merge conflicts, untestable actions, logic sprawl, developer dependency bottlenecks.

The slice pattern maps directly to domain-driven design: each slice is a bounded context. The orchestrator slice is an application service. Factories are generic domain components. This structure scales to 100+ properties across 10+ developers without architectural refactoring.

Without slices, you either: (a) keep a monolithic store that grows until it hurts, or (b) create multiple independent Zustand stores that cannot share state or actions. Slices give you the best of both: a single store for cross-cutting state, with domain boundaries for maintainability.

---

### Common Questions

**Q: How many slices should a store have?**
A: 3-7 slices per store. Fewer than 3: slices may be premature (monolithic works fine). More than 7: the orchestration complexity outweighs slice benefits. If you need 10+ slices, consider splitting into multiple stores connected by subscribers or events.

**Q: Do slices prevent me from using Zustand middleware (persist, immer, devtools)?**
A: No. Middleware wraps the entire `create()` call, not individual slices. The combined store gets middleware applied to all slices. Example: `devtools(persist(create<AppStore>()(...)))` wraps all slices with devtools and persistence.

**Q: Can I use slices with `immer` middleware?**
A: Yes. Each slice's `set()` call receives the immer proxy state. Slice creators write mutable-style updates to their own properties: `state.items.push(newItem)`. Cross-slice `set()` follows the same rule: immer proxy works across all slices.

**Q: What about circular dependencies between slices?**
A: Circular dependency: `authSlice` imports `cartSlice`, `cartSlice` imports `authSlice`. Fix: (1) extract shared events to orchestrator slice, (2) use subscriber pattern outside slice creators, (3) pass shared dependencies as arguments to slice creators. Do not let slices import each other's creator functions — only import the type.

**Q: Do slices work with `React.memo` or are there re-render issues?**
A: No special interactions. Zustand's selector equality (default `Object.is`) ensures components re-render only when selected value changes. Whether that value comes from one slice or the intersection of slices does not matter. `React.memo` works as expected with sliced stores.

**Q: Should I test each slice in isolation?**
A: Yes. Create the slice with a mock `set` and `get`, test its actions produce correct state. For cross-slice actions, stub the depended-upon slice state. Integration test the combined store for cross-slice flows. Pure slice tests: fast, no React, no store setup.

---

## Examples

### Example 1: Refactoring a Monolithic Dashboard Store into Slices

**Problem**: 40-property monolithic store for a SaaS dashboard. Auth, analytics, notifications, user preferences, billing, team management — all in one `create()` block. Six developers, daily merge conflicts.

**Step 1**: Profile current store by domain. Count properties per domain:
- Auth (4 props, 2 actions)
- Analytics (8 props, 5 actions)
- Notifications (5 props, 3 actions)
- Billing (6 props, 4 actions)
- Team (5 props, 4 actions)
- UI (4 props, 2 actions)

**Step 2**: Extract `UISlice` first (no cross-slice dependencies — safest).

```typescript
// slices/ui.ts
export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
  sidebarOpen: true,
  activeTab: 'overview',
  theme: 'light',
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setTheme: (theme) => set({ theme }),
})
```

**Step 3**: Extract `BillingSlice` (depends on UI for loading states).

```typescript
export const createBillingSlice: StateCreator<
  BillingSlice & UISlice, [], [], BillingSlice
> = (set, get) => ({
  plan: 'free',
  invoices: [],
  loading: false,
  upgradePlan: async (plan) => {
    set({ loading: true })
    try {
      await api.upgrade(plan)
      set({ plan, loading: false })
      get().setActiveTab('billing')  // cross-slice: update UI
    } catch {
      set({ loading: false })
    }
  },
  // ...
})
```

**Step 4**: Extract remaining slices one per PR. Over 2 weeks, monolith decomposes into 6 slice files + 1 orchestrator for cross-slice workflows (logout clears everything, new subscription shows onboarding).

**Result**: Zero merge conflicts in week 3. Each developer owns 1-2 slice files. CI tests run slice-specific tests in parallel. Store comprehension: open one file, understand one domain.

### Example 2: CRUD Slice Factory for a CMS

**Problem**: CMS with 5 entity types (articles, authors, tags, categories, media). Each needs identical CRUD + pagination + search. Building each as a separate slice repeats 90% of code.

**Factory approach**:

```typescript
// factories/createPaginatedCrudSlice.ts
interface PaginatedCrudSlice<T extends { id: string }> {
  items: T[]
  selectedId: string | null
  loading: boolean
  error: string | null
  searchQuery: string
  page: number
  totalPages: number
  fetchItems: (params?: Record<string, string>) => Promise<void>
  createItem: (data: Omit<T, 'id'>) => Promise<void>
  updateItem: (id: string, data: Partial<T>) => Promise<void>
  deleteItem: (id: string) => Promise<void>
  setSearchQuery: (q: string) => void
  setPage: (page: number) => void
  selectItem: (id: string | null) => void
}

export function createPaginatedCrudSlice<T extends { id: string }>(
  entityName: string,
  apiBase: string
): StateCreator<PaginatedCrudSlice<T>, [], [], PaginatedCrudSlice<T>> {
  return (set, get) => ({
    items: [],
    selectedId: null,
    loading: false,
    error: null,
    searchQuery: '',
    page: 1,
    totalPages: 1,

    fetchItems: async (params) => {
      set({ loading: true, error: null })
      try {
        const query = new URLSearchParams({ ...params, page: String(get().page), q: get().searchQuery })
        const res = await fetch(`${apiBase}?${query}`)
        const data = await res.json()
        set({ items: data.items, totalPages: data.totalPages, loading: false })
      } catch (e) {
        set({ error: (e as Error).message, loading: false })
      }
    },

    createItem: async (data) => {
      const res = await fetch(apiBase, { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } })
      const created = await res.json()
      set({ items: [...get().items, created] })
    },

    updateItem: async (id, data) => {
      const res = await fetch(`${apiBase}/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
      const updated = await res.json()
      set({ items: get().items.map(i => i.id === id ? { ...i, ...updated } : i) })
    },

    deleteItem: async (id) => {
      await fetch(`${apiBase}/${id}`, { method: 'DELETE' })
      set({ items: get().items.filter(i => i.id !== id) })
    },

    setSearchQuery: (q) => set({ searchQuery: q, page: 1 }),
    setPage: (page) => set({ page }),
    selectItem: (id) => set({ selectedId: id }),
  })
}
```

Usage for each CMS entity:

```typescript
// slices/articles.ts
type ArticleSlice = PaginatedCrudSlice<Article> & {
  publishArticle: (id: string) => Promise<void>
}

export const createArticlesSlice: StateCreator<ArticleSlice, [], [], ArticleSlice> =
  (set, get) => ({
    ...createPaginatedCrudSlice<Article>('articles', '/api/articles')(set, get),
    publishArticle: async (id) => {
      await fetch(`/api/articles/${id}/publish`, { method: 'POST' })
      // Refresh list
      get().fetchItems()
    },
  })

// slices/authors.ts — identical, just different entity name and API base
type AuthorSlice = PaginatedCrudSlice<Author>
export const createAuthorsSlice = createPaginatedCrudSlice<Author>('authors', '/api/authors')
```

**Result**: 5 entity domains, 1 factory, ~200 lines total vs ~500 lines repeating. Each entity inherits consistent pagination, search, loading/error states, and CRUD behavior.

### Example 3: Lazy Loading Slices Per Route

**Problem**: Enterprise app with 10 domains. Loading all slices on initial page load wastes bandwidth for 80% of users who only use 2-3 domains.

**Solution**: Dynamic slice injection using Zustand's `setState`:

```typescript
// store/index.ts
import { create } from 'zustand'

// Core store — only essential slices
type CoreStore = UISlice & AuthSlice
const useCoreStore = create<CoreStore>()((...a) => ({
  ...createUISlice(...a),
  ...createAuthSlice(...a),
}))

// Registry for lazy slices
const sliceRegistry = new Map<string, () => void>()

export function registerSlice<T>(name: string, sliceCreator: (...args: any[]) => T) {
  const inject = () => {
    const set = useCoreStore.setState
    const get = useCoreStore.getState as () => any
    set(sliceCreator(set, get))
  }
  sliceRegistry.set(name, inject)
}

// Route-level slice loading
export function loadSliceForRoute(route: string) {
  switch (route) {
    case '/products':
      import('./slices/products').then(() => sliceRegistry.get('products')?.())
      break
    case '/billing':
      import('./slices/billing').then(() => sliceRegistry.get('billing')?.())
      break
    case '/team':
      import('./slices/team').then(() => sliceRegistry.get('team')?.())
      break
  }
}

// Router integration
router.afterEach((to) => loadSliceForRoute(to.path))
```

**Result**: Initial bundle loads only `UISlice` + `AuthSlice`. Products, billing, team slices load on demand. Each lazy slice injects its state into the existing store via `useCoreStore.setState`. Existing subscriptions pick up new properties immediately.

Note: This pattern requires the store to accept arbitrary new properties at any time. TypeScript must use `any` or a looser type for the registry. Trade-off: bundle size vs type safety.

---

## Key Takeaways
- Slices decompose a monolithic store into domain modules — each slice is a `StateCreator` returning its own state + actions
- Slices combine via spread syntax: `create<AppStore>()((...a) => ({ ...sliceA(...a), ...sliceB(...a) }))`
- TypeScript intersection (`AuthSlice & CartSlice`) provides full type safety for combined store and cross-slice access
- Cross-slice actions use `get().otherSliceAction()` — direct calls with shared `set`/`get`
- Cross-slice `set()` is possible but an anti-pattern — a slice should only set its own properties
- Four communication patterns: direct call (tight), event bus (loose), orchestrator (controlled), subscriber (implicit)
- Slice factories (`createCrudSlice<T>`) eliminate CRUD duplication across entity domains
- Folder-per-slice organization scales to 100+ properties across 10+ developers without conflict
- Slices do not affect re-render performance — Zustand's selector equality is granular regardless of store structure
- Migrate one slice per PR: extract interface → create slice creator → spread in store → fix cross-slice references
- Lazy slice loading can code-split stores by route, reducing initial bundle size

## Common Misconception

**"Slices are just organizing code — they don't improve performance or testability enough to matter."**

Slices improve maintainability, not raw execution speed. The performance benefit is indirect: each slice is independently testable (faster CI), independently ownable (fewer merge conflicts), and independently reviewable (smaller PRs). The testing improvement is direct: a slice creator accepts mock `set`/`get` — you test the slice without creating the full store.

The misconception conflates "the store works fine without slices" with "slices provide no value." A 20-property store works fine flat. A 100-property store with 10k LOC and 6 developers needs slices. Slices are not for the store — they are for the team maintaining it.

Correct framing: slices are a developer scaling tool. The store does not care about slices. Your team does. If you work alone on a small store, slices are optional. If you work on a team on a growing codebase, slices are essential for parallel work, testing, and code comprehension.

---

## Feynman Explain
(Explain the slices pattern to a junior developer who knows `useState` and has seen a Zustand store with 5 properties. Use an analogy: "Imagine your state is a house. Monolithic store is one giant room where everything — kitchen, bedroom, bathroom — shares the same space. Slices are walls and doors between rooms. Each room has its own furniture (state) and appliances (actions). You can still walk between rooms (cross-slice actions), but you do not trip over the kitchen stove when you are in the bedroom.")

*Pause. Say explanation aloud or write it down. Then run `learn.sh explain zustand-state-management 08-slices` — AI probes gaps in your explanation.*

---

## Reframe
(Pause. Critique: Slices add indirection. Every action now lives in a separate file — finding "where does addItem live" requires navigating the slice folder. The spread merge can shadow properties silently. Factories hide behavior behind generic abstractions. When does the slice pattern become over-engineering for a small team? Write your evaluation. Consider: a startup with 2 developers building an MVP — should they start with slices or refactor into slices when pain hits?)

---

## Drill
Take the quiz. Questions cover slice creation, cross-slice communication, TypeScript typing, factory patterns, store organization, and migration strategy.

Run: `learn.sh quiz zustand-state-management 08-slices`
