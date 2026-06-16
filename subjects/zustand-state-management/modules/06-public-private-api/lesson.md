# Module 6: Public API vs Internal API — Store Encapsulation

Est. study time: 2h
Language: en

## Learning Objectives
- Distinguish public API (selectors + actions) from internal API (derived state, intermediates, private fields) in Zustand stores
- Apply encapsulation patterns: `_` prefix convention, barrel exports, module-scoped state
- Design selector composition that exposes only what components need and hides internal shape
- Version internal state changes without breaking consumers by maintaining a stable public API contract

---

## Core Content

### The Encapsulation Problem in Zustand

Zustand stores are plain objects. Every property returned from `create()` is readable by any consumer. There is no `private` keyword, no `#` private fields enforced by the framework — only convention.

```typescript
const useStore = create<Store>((set, get) => ({
  user: null,
  token: null,
  _refreshTimer: null,       // Internal — but still accessible
  _lastFetchTime: 0,         // Internal — but still accessible
  login: async (email, pw) => {
    const { user, token } = await api.login(email, pw)
    set({ user, token, _lastFetchTime: Date.now() })
  },
}))
```

Component can read `_refreshTimer` and `_lastFetchTime` directly:
```typescript
function BadComponent() {
  const lastFetch = useStore((s) => s._lastFetchTime)  // Works, but breaks encapsulation
  return <div>Last fetch: {lastFetch}</div>
}
```

Problem: component now depends on internal implementation detail. If you rename `_lastFetchTime` to `_lastSyncTime`, component breaks. If you remove `_refreshTimer`, component breaks.

> **Think**: A team uses `useStore.getState()` in a component to read `_pendingRequests` (an internal counter). They refactor the store to use a queue instead of a counter. What happens?
>
> *Answer: Component breaks at runtime — `_pendingRequests` is undefined. No TypeScript error because the property still exists in the type but returns undefined. This is the cost of coupling components to internal implementation.*

### Public API vs Internal API — The Boundary

| Aspect | Public API | Internal API |
|--------|------------|--------------|
| Purpose | What components need | What the store needs internally |
| Consumers | Components, hooks, other stores | Store actions, middleware |
| Stability | Stable across refactors | Changes freely |
| Examples | `useUser()`, `useLogin()`, `useCartItems()` | `_cache`, `_timerId`, `_rawData`, `_normalize()` |
| Exposure | Barrel exports (`index.ts`) | Store file only |
| Test scope | Integration tests via hook | Unit tests on pure functions |

**Public API** = selector hooks + action hooks that components import. These are the contract.

**Internal API** = private fields, derived computation intermediates, raw data before normalization, timer IDs, cached values. These are implementation details.

```typescript
// Public API (exported from index.ts)
export const useUser = () => useAuthStore((s) => s.user)
export const useLoginAction = () => useAuthStore((s) => s.login)

// Internal API (never exported — accessed only inside store actions)
// _refreshTimer: number | null
// _tokenExpiresAt: number
// _retryCount: number
```

> **Think**: A computed value `fullName` is derived from `firstName + lastName`. Is `fullName` public or internal API?
>
> *Answer: Public API if components consume it. The store computes it internally but exposes the result. The key is: component sees the value, not the derivation. You can change from eager computation to memoized getter without changing the public API.*

### The `_` Prefix Convention

Zustand's standard convention: prefix private fields with `_`. This signals "do not use outside the store."

```typescript
interface SearchStore {
  // Public
  query: string
  results: SearchResult[]
  isSearching: boolean
  search: (q: string) => Promise<void>
  clearResults: () => void

  // Private (internal)
  _cache: Map<string, SearchResult[]>
  _debounceTimer: ReturnType<typeof setTimeout> | null
  _abortController: AbortController | null
  _lastQuery: string
}
```

```typescript
const useSearch = create<SearchStore>((set, get) => ({
  query: '',
  results: [],
  isSearching: false,
  _cache: new Map(),
  _debounceTimer: null,
  _abortController: null,
  _lastQuery: '',

  search: async (q: string) => {
    // Cancel previous request
    get()._abortController?.abort()
    const controller = new AbortController()
    set({ _abortController: controller, _debounceTimer: null })

    // Check cache
    const cached = get()._cache.get(q)
    if (cached) {
      set({ query: q, results: cached, isSearching: false })
      return
    }

    set({ query: q, isSearching: true })
    try {
      const results = await api.search(q, controller.signal)
      set((s) => ({
        results,
        isSearching: false,
        _cache: new Map(s._cache).set(q, results),
        _lastQuery: q,
      }))
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        set({ isSearching: false })
      }
    }
  },

  clearResults: () => set({
    results: [], query: '', _lastQuery: '',
  }),
}))
```

Convention works but is not enforced. Combine with barrel exports for stronger encapsulation.

> **Think**: Would TypeScript `private` keyword on store interface fields prevent runtime access? Why or why not?
>
> *Answer: No. TypeScript's `private` is a compile-time check only. At runtime, all properties are accessible. `private` prevents TypeScript compilation errors but does not stop `useStore.getState()._privateField`. The `_` convention combined with barrel exports is the real enforcement mechanism.*

### Barrel Exports as API Contract

Barrel file (`index.ts`) is the public API surface. Only re-export what components should consume.

**Store file** — exports raw store hook (for internal use by selectors, but not meant for components):
```typescript
// stores/search/store.ts
export const useSearchStore = create<SearchStore>(/* ... */)
```

**Selectors file** — wraps store hook with specific selectors:
```typescript
// stores/search/selectors.ts
import { useSearchStore } from './store'

export const useQuery = () => useSearchStore((s) => s.query)
export const useResults = () => useSearchStore((s) => s.results)
export const useIsSearching = () => useSearchStore((s) => s.isSearching)
export const useSearchAction = () => useSearchStore((s) => s.search)
export const useClearResults = () => useSearchStore((s) => s.clearResults)

// Derived selector — component gets stable boolean, not raw state
export const useHasResults = () => useSearchStore((s) => s.results.length > 0)
```

**Barrel file** — re-exports only selector hooks:
```typescript
// stores/search/index.ts
export {
  useQuery,
  useResults,
  useIsSearching,
  useSearchAction,
  useClearResults,
  useHasResults,
} from './selectors'

// Deliberately NOT exporting:
// - useSearchStore (the raw hook)
// - SearchStore interface (internal structure)
// - _cache, _debounceTimer, _abortController (private fields)
```

**Component** — imports from barrel only:
```typescript
// ✅ Correct: imports from barrel
import { useQuery, useResults, useSearchAction } from '../stores/search'

// ❌ Wrong: imports from raw store file
// import { useSearchStore } from '../stores/search/store'
```

> **Think**: A developer on your team imports `useSearchStore` directly and reads `_cache` to display cached results count in a debug panel. How do you prevent this — lint rule, code review, or architectural change?
>
> *Answer: All three, but strongest is `no-restricted-imports` lint rule that forbids importing from `*/store.ts` outside store directory. Code review catches it. Architecture (omitting raw store from barrel) makes it impossible for developers who only look at barrel exports. Layered defense.*

### Selector Composition: Exposing Derived Values

Components should receive derived values directly, not raw data to compute themselves. Selector composition computes derived values inside the store boundary.

**Without composition** — component computes derived value:
```typescript
// Component knows: items structure, discount rules, tax calculation
function OrderSummary() {
  const items = useCartItems()
  const promoCode = usePromoCode()

  // Component contains pricing logic — encapsulation violation
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0)
  const discount = promoCode === 'SAVE10' ? subtotal * 0.1 : 0
  const tax = (subtotal - discount) * 0.08
  const total = subtotal - discount + tax

  return <div>Total: ${total.toFixed(2)}</div>
}
```

Violation: component knows cart item structure (`price`, `qty`), discount rule (`SAVE10` = 10%), tax rate (8%). Changing discount logic requires changing every component that computes totals.

**With composition** — store exposes derived values:
```typescript
// stores/cart/selectors.ts
export const useCartSubtotal = () => useCartStore((s) =>
  s.items.reduce((sum, i) => sum + i.price * i.qty, 0)
)

export const useCartDiscount = () => useCartStore((s) =>
  s.promoCode === 'SAVE10' ? s.items.reduce((sum, i) => sum + i.price * i.qty, 0) * 0.1 : 0
)

export const useCartTax = () => useCartStore((s) => {
  const subtotal = s.items.reduce((sum, i) => sum + i.price * i.qty, 0)
  const discount = s.promoCode === 'SAVE10' ? subtotal * 0.1 : 0
  return (subtotal - discount) * 0.08
})

export const useCartTotal = () => useCartStore((s) => {
  const subtotal = s.items.reduce((sum, i) => sum + i.price * i.qty, 0)
  const discount = s.promoCode === 'SAVE10' ? subtotal * 0.1 : 0
  const tax = (subtotal - discount) * 0.08
  return subtotal - discount + tax
})
```

```typescript
// Component — no computation
function OrderSummary() {
  const total = useCartTotal()
  return <div>Total: ${total.toFixed(2)}</div>
}
```

Component does not know discount rules, tax rates, or item structure. It receives `total` as a stable public API.

**Performance note**: derived selectors recompute on every store change. Use `shallow` or split into smaller selectors to avoid unnecessary re-renders:
```typescript
export const useCartSummary = () => useCartStore((s) => ({
  subtotal: s.items.reduce((sum, i) => sum + i.price * i.qty, 0),
  count: s.items.length,
  total: /* ... */,
}), shallow)  // Object-level comparison
```

> **Think**: A `useCartTotal` selector recomputes on every store update even when items and promo code have not changed. Why? How would you memoize this selector?
>
> *Answer: Zustand selectors are not memoized — they run on every store change. Use Zustand `shallow` comparator for object selectors, or use `useMemo` in the component wrapping the selector result, or use an external memoization library. Better approach: split into selectors that return primitives (useTotal, useCount) so each only re-renders when its specific value changes.*

### Versioning Internal State Without Breaking Consumers

Internal state shape changes over time. Renaming fields, restructuring data, adding new private state — none should affect components that use the public API.

**Bad — component coupled to internal structure:**
```typescript
// Store v1
interface Store {
  user: { firstName: string; lastName: string }
  _rawApiResponse: ApiResponse
}

// Store v2 — renamed firstName/lastName to givenName/familyName
interface Store {
  user: { givenName: string; familyName: string }
  _rawApiResponse: TransformedResponse
}

// Component breaks — `firstName` no longer exists
function Greeting() {
  const user = useStore((s) => s.user)
  return <div>Hello {user.firstName}</div>  // ❌ undefined
}
```

**Good — public selector insulates consumers:**
```typescript
// Store v1 — public selector
export const useDisplayName = () => useUserStore((s) =>
  `${s.firstName} ${s.lastName}`
)

// Store v2 — internal fields renamed, public selector unchanged
export const useDisplayName = () => useUserStore((s) =>
  `${s.givenName} ${s.familyName}`  // Only selector changes
)

// Component — never changes
function Greeting() {
  const name = useDisplayName()
  return <div>Hello {name}</div>  // ✅ Still works
}
```

**Internal state restructuring**:
```typescript
// Store v1 — flat internal state
interface StoreV1 {
  items: Item[]
  _normalizedItems: Map<string, Item>
  _categoryIndex: Map<string, string[]>
}

// Store v2 — extracted into internal cache object
interface StoreV2 {
  items: Item[]
  _internal: {
    byId: Map<string, Item>
    byCategory: Map<string, string[]>
  }
}

// Public selectors unchanged — consumers never see _internal
export const useItemById = (id: string) => useStore((s) =>
  s.items.find((i) => i.id === id)  // Could use _internal.byId internally
)
```

> **Think**: You change internal caching from a plain object to a WeakMap for memory efficiency. No public selectors change. How do you verify components are not broken?
>
> *Answer: Run your selector test suite — tests that call useDisplayName() and assert output should pass unchanged. If no components import raw store, you have zero consumer changes. This is the value of encapsulation: internal refactors are invisible to consumers.*

### Pattern: createStore with Internal + External Slices

Explicitly separate internal and external state at the store definition level.

```typescript
interface ExternalState {
  notifications: Notification[]
  unreadCount: number
  markRead: (id: string) => void
  dismissAll: () => void
}

interface InternalState {
  _rawFeed: Notification[]
  _pollTimer: ReturnType<typeof setInterval> | null
  _lastPollTime: number
  _dedupSet: Set<string>
}

type NotificationStore = ExternalState & InternalState
```

**Store definition** — internal and external explicitly labeled:
```typescript
const useNotifications = create<NotificationStore>((set, get) => ({
  // --- External (public API) ---
  notifications: [],
  unreadCount: 0,

  markRead: (id) => {
    const updated = get().notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    )
    set({
      notifications: updated,
      unreadCount: updated.filter((n) => !n.read).length,
    })
  },

  dismissAll: () => set({
    notifications: [],
    unreadCount: 0,
    _rawFeed: [],
    _dedupSet: new Set(),
  }),

  // --- Internal (private) ---
  _rawFeed: [],
  _pollTimer: null,
  _lastPollTime: 0,
  _dedupSet: new Set(),
}))
```

**Selectors** — expose only external state:
```typescript
export const useNotifications = () => useNotificationStore((s) => s.notifications)
export const useUnreadCount = () => useNotificationStore((s) => s.unreadCount)
export const useMarkRead = () => useNotificationStore((s) => s.markRead)
export const useDismissAll = () => useNotificationStore((s) => s.dismissAll)

// Derived — component never sees _rawFeed or _dedupSet
export const useHasUnread = () => useNotificationStore((s) => s.unreadCount > 0)
```

> **Think**: Why separate internal and external into explicit sections rather than mixing them? What happens when a new team member adds a field — where do they put it?
>
> *Answer: Explicit sections communicate intent. New team member sees `--- Internal ---` and knows to prefix with `_` and not expose via selectors. Without structure, internal fields scatter and some accidentally become de facto public API. Explicit boundaries prevent drift.*

### Module-Scoped State for Truly Private Data

For data that must never reach components, store it outside Zustand entirely — in module scope.

```typescript
// stores/analytics/store.ts

// Module-scoped — truly private, not part of store state at all
let pendingBatch: AnalyticsEvent[] = []
let flushTimer: ReturnType<typeof setInterval> | null = null
const FLUSH_INTERVAL = 5000

interface AnalyticsStore {
  // Public API only — no internal state exposed
  track: (event: AnalyticsEvent) => void
  flushNow: () => void
}

export const useAnalytics = create<AnalyticsStore>((set) => ({
  track: (event) => {
    pendingBatch.push(event)
    if (!flushTimer) {
      flushTimer = setInterval(() => {
        if (pendingBatch.length > 0) {
          api.sendBatch(pendingBatch)
          pendingBatch = []
        }
      }, FLUSH_INTERVAL)
    }
  },

  flushNow: () => {
    if (pendingBatch.length > 0) {
      api.sendBatch(pendingBatch)
      pendingBatch = []
    }
    if (flushTimer) {
      clearInterval(flushTimer)
      flushTimer = null
    }
  },
}))
```

Benefits:
- Components cannot access `pendingBatch` or `flushTimer` — not in store types, not at runtime
- Internal state persists across store resets (module state is not cleared by `set({})`)
- Testing: import store, call `track()`, assert `pendingBatch` contents via exported test helper or by asserting API call

Trade-off: module-scoped state survives hot module replacement. On HMR, the old module's pending data persists. Clear module state on HMR:
```typescript
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    pendingBatch = []
    if (flushTimer) clearInterval(flushTimer)
  })
}
```

> **Think**: When would you choose module-scoped state over `_`-prefixed store fields? Compare testability, HMR behavior, and access control.
>
> *Answer: Module-scoped for: truly private implementation (batching, caching, WebSocket connections), state that must survive store resets, secrets that must never appear in store type. `_`-prefixed for: state that actions need but components should not use, state that resets with store, state that needs to be serialized for debugging. Module-scoped is harder to test (cannot set initial state) but gives true encapsulation.*

### Testing: Internal Logic vs Public API

**Test internal logic** — pure functions that operate on data:
```typescript
// stores/notifications/utils.ts — pure, no Zustand dependency
export function processRawFeed(raw: RawNotification[]): Notification[] {
  return raw
    .filter((n) => !n.isArchived)
    .map((n) => ({
      id: n.id,
      message: n.body,
      read: n.status === 'read',
      timestamp: new Date(n.createdAt).getTime(),
    }))
    .sort((a, b) => b.timestamp - a.timestamp)
}

// Test — no store needed
test('processRawFeed filters archived and maps fields', () => {
  const raw = [
    { id: '1', body: 'Hello', status: 'unread', createdAt: '2025-01-01', isArchived: false },
    { id: '2', body: 'Old', status: 'read', createdAt: '2024-12-01', isArchived: true },
  ]
  expect(processRawFeed(raw)).toEqual([
    { id: '1', message: 'Hello', read: false, timestamp: 1735689600000 },
  ])
})
```

**Test public API** — create store, call actions, assert selectors:
```typescript
// stores/notifications/__tests__/store.test.ts
import { create } from 'zustand'
import type { NotificationStore } from '../types'

function createTestStore(overrides?: Partial<NotificationStore>) {
  return create<NotificationStore>((set, get) => ({
    notifications: [],
    unreadCount: 0,
    markRead: (id) => {
      const updated = get().notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      )
      set({ notifications: updated, unreadCount: updated.filter((n) => !n.read).length })
    },
    dismissAll: () => set({ notifications: [], unreadCount: 0 }),
    _rawFeed: [],
    _pollTimer: null,
    _lastPollTime: 0,
    _dedupSet: new Set(),
    ...overrides,
  }))
}

test('markRead sets notification as read and decrements unreadCount', () => {
  const store = createTestStore({
    notifications: [
      { id: '1', message: 'Test', read: false, timestamp: 1000 },
      { id: '2', message: 'Test 2', read: true, timestamp: 2000 },
    ],
    unreadCount: 1,
  })

  store.getState().markRead('1')
  const state = store.getState()

  expect(state.notifications.find((n) => n.id === '1')?.read).toBe(true)
  expect(state.unreadCount).toBe(0)
})

test('dismissAll clears all notifications', () => {
  const store = createTestStore({
    notifications: [{ id: '1', message: 'Test', read: false, timestamp: 1000 }],
    unreadCount: 1,
  })

  store.getState().dismissAll()
  expect(store.getState().notifications).toEqual([])
  expect(store.getState().unreadCount).toBe(0)
})
```

**Test public API via hooks** — using `renderHook` from testing library:
```typescript
// stores/notifications/__tests__/selectors.test.tsx
import { renderHook } from '@testing-library/react'
import { useUnreadCount } from '../selectors'

// Requires wrapping with store provider or mocking the store
test('useUnreadCount returns 0 when all notifications read', () => {
  // Set initial store state via getState/setState
  const store = useNotificationStore
  store.setState({
    notifications: [
      { id: '1', message: 'Test', read: true, timestamp: 1000 },
    ],
    unreadCount: 0,
  })

  const { result } = renderHook(() => useUnreadCount())
  expect(result.current).toBe(0)
})
```

> **Think**: Store action tests create a new store with `create()` in each test. Is this fast enough for a CI suite with 200 tests? What alternative approach reduces overhead?
>
> *Answer: Creating Zustand stores is cheap — `create()` is a function call, not a React component mount. 200 tests run in < 50ms. For very large stores, create once per describe block and reset state between tests with `store.setState(initialState)`. Avoid re-creating if store uses heavy middleware (persist, devtools).*

### Real Example: Store with Private Cache, Exposed Computed Values

**Problem**: Product catalog store with 10,000+ products. Must cache normalized data internally, expose filtered/search results to components, and support multiple view modes.

```typescript
// stores/catalog/types.ts
export interface Product {
  id: string
  name: string
  price: number
  category: string
  tags: string[]
  inStock: boolean
}

export interface CatalogExternal {
  // Public — components use these
  products: Product[]
  totalCount: number
  isLoading: boolean
  error: string | null
  viewMode: 'grid' | 'list'
  sortBy: 'name' | 'price' | 'popularity'

  // Public actions
  fetchProducts: () => Promise<void>
  setViewMode: (mode: 'grid' | 'list') => void
  setSortBy: (sort: 'name' | 'price' | 'popularity') => void
  search: (query: string) => void
  filterByCategory: (category: string | null) => void
}

export interface CatalogInternal {
  // Private — implementation details
  _allProducts: Product[]           // Full dataset before filtering
  _normalized: Map<string, Product> // O(1) lookup by id
  _categoryIndex: Map<string, string[]>  // category → product ids
  _tagIndex: Map<string, string[]>       // tag → product ids
  _searchCache: Map<string, Product[]>   // query → results
  _abortController: AbortController | null
  _lastFetchTime: number
}

export type CatalogStore = CatalogExternal & CatalogInternal
```

```typescript
// stores/catalog/store.ts
import { create } from 'zustand'
import type { CatalogStore, Product } from './types'

// Module-scoped — completely private, not in store
let normalizationTimer: ReturnType<typeof setTimeout> | null = null
const BATCH_INTERVAL = 100

export const useCatalog = create<CatalogStore>((set, get) => ({
  // --- External ---
  products: [],
  totalCount: 0,
  isLoading: false,
  error: null,
  viewMode: 'grid',
  sortBy: 'name',

  fetchProducts: async () => {
    set({ isLoading: true, error: null })
    try {
      const data = await api.getProducts()

      // Build internal indexes
      const normalized = new Map<string, Product>()
      const byCategory = new Map<string, string[]>()
      const byTag = new Map<string, string[]>()

      for (const product of data) {
        normalized.set(product.id, product)
        // Build category index
        const catIds = byCategory.get(product.category) || []
        catIds.push(product.id)
        byCategory.set(product.category, catIds)
        // Build tag index
        for (const tag of product.tags) {
          const tagIds = byTag.get(tag) || []
          tagIds.push(product.id)
          byTag.set(tag, tagIds)
        }
      }

      set({
        _allProducts: data,
        _normalized: normalized,
        _categoryIndex: byCategory,
        _tagIndex: byTag,
        products: data, // Initial view — all products
        totalCount: data.length,
        isLoading: false,
        _lastFetchTime: Date.now(),
      })
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false })
    }
  },

  setViewMode: (mode) => set({ viewMode: mode }),
  setSortBy: (sort) => set({ sortBy: sort }),

  search: (query) => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) {
      set({ products: get()._allProducts, totalCount: get()._allProducts.length })
      return
    }

    // Check cache
    const cached = get()._searchCache.get(trimmed)
    if (cached) {
      set({ products: cached, totalCount: cached.length })
      return
    }

    // Search across name, category, tags using indexes
    const results = get()._allProducts.filter((p) =>
      p.name.toLowerCase().includes(trimmed) ||
      p.category.toLowerCase().includes(trimmed) ||
      p.tags.some((t) => t.toLowerCase().includes(trimmed))
    )

    // Cache result
    const newCache = new Map(get()._searchCache)
    newCache.set(trimmed, results)

    set({
      products: results,
      totalCount: results.length,
      _searchCache: newCache,
    })
  },

  filterByCategory: (category) => {
    if (!category) {
      set({ products: get()._allProducts, totalCount: get()._allProducts.length })
      return
    }

    const ids = get()._categoryIndex.get(category) || []
    const filtered = ids.map((id) => get()._normalized.get(id)!).filter(Boolean)
    set({ products: filtered, totalCount: filtered.length })
  },

  // --- Internal ---
  _allProducts: [],
  _normalized: new Map(),
  _categoryIndex: new Map(),
  _tagIndex: new Map(),
  _searchCache: new Map(),
  _abortController: null,
  _lastFetchTime: 0,
}))
```

**Selectors** — expose only what components need:
```typescript
// stores/catalog/selectors.ts
import { useCatalog } from './store'
import { shallow } from 'zustand/shallow'

export const useProducts = () => useCatalog((s) => s.products)
export const useTotalCount = () => useCatalog((s) => s.totalCount)
export const useIsLoading = () => useCatalog((s) => s.isLoading)
export const useCatalogError = () => useCatalog((s) => s.error)
export const useViewMode = () => useCatalog((s) => s.viewMode)
export const useSortBy = () => useCatalog((s) => s.sortBy)

// Derived selectors
export const useInStockProducts = () => useCatalog((s) =>
  s.products.filter((p) => p.inStock)
)

export const usePriceRange = () => useCatalog((s) => {
  if (s.products.length === 0) return { min: 0, max: 0 }
  const prices = s.products.map((p) => p.price)
  return { min: Math.min(...prices), max: Math.max(...prices) }
})

// Action selectors
export const useFetchProducts = () => useCatalog((s) => s.fetchProducts)
export const useSetViewMode = () => useCatalog((s) => s.setViewMode)
export const useSearch = () => useCatalog((s) => s.search)
export const useFilterByCategory = () => useCatalog((s) => s.filterByCategory)

// Composed — combines multiple selectors with shallow comparison
export const useCatalogSummary = () => useCatalog((s) => ({
  count: s.products.length,
  loading: s.isLoading,
  error: s.error,
  viewMode: s.viewMode,
}), shallow)
```

**Barrel** — only selectors:
```typescript
// stores/catalog/index.ts
export {
  useProducts,
  useTotalCount,
  useIsLoading,
  useCatalogError,
  useViewMode,
  useSortBy,
  useInStockProducts,
  usePriceRange,
  useCatalogSummary,
  useFetchProducts,
  useSetViewMode,
  useSearch,
  useFilterByCategory,
} from './selectors'
```

**Component** — thin, no internal knowledge:
```typescript
import { useProducts, useIsLoading, useSearch, useCatalogSummary } from '../stores/catalog'

function CatalogPage() {
  const { count, loading } = useCatalogSummary()
  const products = useProducts()
  const search = useSearch()

  if (loading) return <Spinner />
  return (
    <div>
      <SearchInput onChange={search} />
      <p>{count} products</p>
      <ProductGrid products={products} />
    </div>
  )
}
```

Internal refactors (change index structure, rename `_normalized` to `_byId`, switch from `Map` to `Record`) never touch this component.

> **Think**: The `_categoryIndex` and `_tagIndex` are rebuilt on every `fetchProducts` call. For a catalog with 50k products, this takes ~50ms. Should the component worry about this? What if the index build time grows to 500ms?
>
> *Answer: Component should never worry about index build time — it is an internal implementation detail. If index build becomes slow, optimize internally (web worker, incremental indexing, batch processing) without changing the public API. The component still calls `fetchProducts()` and receives `products`.*

---

### Why This Matters

Without encapsulation, every internal store change becomes a breaking change. Renaming a private field breaks 10 components. Restructuring internal cache breaks 5 more. Components become coupled to implementation details they should never know about. Barrel exports, the `_` prefix convention, selector composition, and module-scoped state create a wall between "how the store works" and "what components see." Teams that enforce this boundary refactor stores fearlessly. Teams that skip it treat store refactors as high-risk operations requiring full regression testing. Store encapsulation is not ceremony — it is the difference between a store that is easy to change and one that is frozen by technical debt.

---

### Common Questions

**Q: What is the difference between a private field (`_cache`) and module-scoped state (`let cache` outside create)?**
A: Private field in the store: accessible to actions via `get()`, visible in devtools, serialized if you persist, resets when store resets. Module-scoped state: truly private (not in type), invisible in devtools, not serialized, survives store reset. Use module-scoped for data that must never leak (batches, timers, connections). Use `_` fields for data that actions need but components should not see.

**Q: Does TypeScript `Pick` or `Omit` help enforce public vs private API at the type level?**
A: Yes. You can define a `PublicStore` type that exposes only the public fields:
```typescript
type PublicStore = Pick<Store, 'user' | 'login' | 'logout'>
type InternalStore = Omit<Store, keyof PublicStore>
```
Then export `PublicStore` for components, keep full `Store` internal. Components type-check against the public type and cannot reference private fields without a cast.

**Q: How do I handle store state that is both public and internal (e.g., `isLoading` is public, but internally it also gates retry logic)?**
A: `isLoading` is public — components show spinners. The retry logic reads the same field internally. This is fine. Encapsulation does not mean "every field has one consumer." It means components should not depend on fields that only exist for internal bookkeeping. A field that serves both purposes is correctly public.

**Q: What if two stores share internal state (e.g., auth token needed by cart store)?**
A: Cross-store reads via `.getState()` access the public API of the other store. If the auth store exposes `useToken()` selector, the cart store reads `useAuthStore.getState().token`. The token is public API of auth store, consumed as public API by cart store. No internal state leaks.

**Q: Does the `_` prefix convention work in a team that does not enforce it?**
A: No. Convention without enforcement is suggestion. Add `no-restricted-imports` ESLint rule blocking raw store imports. Add code review checklist item: "Does this component import from barrel or raw store?" Add barrel export as the only export path. Architecture is stronger than convention.

---

## Examples

### Example 1: Refactoring Internal State Without Breaking Consumers

**Problem**: Timer store stores `elapsed` as a number. Internal refactor changes to store `startTime` + `now()` function compute elapsed on read. Components must not change.

**Before** — public API and internal state mixed:
```typescript
interface TimerStore {
  elapsed: number
  isRunning: boolean
  start: () => void
  stop: () => void
  reset: () => void
}

const useTimer = create<TimerStore>((set, get) => ({
  elapsed: 0,
  isRunning: false,
  start: () => {
    const id = setInterval(() => {
      set({ elapsed: get().elapsed + 1 })
    }, 1000)
    set({ isRunning: true, _intervalId: id })
  },
  stop: () => {
    clearInterval(get()._intervalId!)
    set({ isRunning: false })
  },
  reset: () => {
    clearInterval(get()._intervalId!)
    set({ elapsed: 0, isRunning: false })
  },
  _intervalId: null,  // Already internal but leaks into type
}))
```

**After** — internal representation changes, public API stable:
```typescript
interface TimerStore {
  // Public — unchanged
  elapsed: number
  isRunning: boolean
  start: () => void
  stop: () => void
  reset: () => void

  // Internal — completely different shape
  _startTime: number | null
}

const useTimer = create<TimerStore>((set, get) => ({
  elapsed: 0,
  isRunning: false,

  start: () => {
    set({
      isRunning: true,
      _startTime: Date.now() - get().elapsed,
    })
  },

  stop: () => {
    // Compute final elapsed from startTime
    const finalElapsed = Date.now() - get()._startTime!
    set({
      elapsed: finalElapsed,
      isRunning: false,
      _startTime: null,
    })
  },

  reset: () => set({
    elapsed: 0, isRunning: false, _startTime: null,
  }),

  _startTime: null,
}))
```

**Selectors** — unchanged:
```typescript
export const useElapsed = () => useTimer((s) => s.elapsed)
export const useIsRunning = () => useTimer((s) => s.isRunning)
export const useStart = () => useTimer((s) => s.start)
export const useStop = () => useTimer((s) => s.stop)
export const useReset = () => useTimer((s) => s.reset)
```

**Result**: Internal switched from polling `setInterval` to computing from `_startTime`. Public API (`useElapsed`, `useStart`) unchanged. Zero component changes. The `_intervalId` field was removed entirely — no consumer knew it existed.

### Example 2: Composing Selectors from Multiple Internal Sources

**Problem**: Dashboard displays user's rank, percentile, and badge level computed from raw score data. Raw data structure is complex (per-question scores, time breakdowns). Components should receive computed values only.

```typescript
interface DashboardStore {
  // Internal — raw, detailed
  _rawScores: RawScore[]
  _questionDetails: QuestionDetail[]
  _timeLog: TimeEntry[]

  // Public — computed, stable
  totalScore: number
  rank: number
  percentile: number
  badgeLevel: 'bronze' | 'silver' | 'gold' | 'platinum'
  categoryBreakdown: CategoryBreakdown[]

  // Actions
  fetchScores: () => Promise<void>
}

// Selectors — derive from raw data internally
const useDashboard = create<DashboardStore>((set, get) => ({
  _rawScores: [],
  _questionDetails: [],
  _timeLog: [],
  totalScore: 0,
  rank: 0,
  percentile: 0,
  badgeLevel: 'bronze',
  categoryBreakdown: [],

  fetchScores: async () => {
    const data = await api.getDashboard()
    const totalScore = data.scores.reduce((s: number, q: RawScore) => s + q.points, 0)
    const rank = calculateRank(totalScore, data.leaderboard)
    const percentile = calculatePercentile(totalScore, data.leaderboard)
    const badgeLevel = getBadgeLevel(totalScore)
    const categoryBreakdown = buildCategoryBreakdown(data.scores)

    set({
      _rawScores: data.scores,
      _questionDetails: data.details,
      _timeLog: data.timeLog,
      totalScore,
      rank,
      percentile,
      badgeLevel,
      categoryBreakdown,
    })
  },
}))

// Selectors — expose stable public API
export const useTotalScore = () => useDashboard((s) => s.totalScore)
export const useRank = () => useDashboard((s) => s.rank)
export const usePercentile = () => useDashboard((s) => s.percentile)
export const useBadgeLevel = () => useDashboard((s) => s.badgeLevel)
export const useCategoryBreakdown = () => useDashboard((s) => s.categoryBreakdown)
export const useFetchScores = () => useDashboard((s) => s.fetchScores)
```

```typescript
// Component — no knowledge of _rawScores, _questionDetails, _timeLog
function Dashboard() {
  const totalScore = useTotalScore()
  const badge = useBadgeLevel()
  const fetchScores = useFetchScores()

  useEffect(() => { fetchScores() }, [fetchScores])

  return (
    <div>
      <ScoreBadge level={badge} score={totalScore} />
      <RankDisplay />
    </div>
  )
}
```

**Result**: Raw score data, question details, time logs are internal. Component only sees computed values. To add a new computed metric (e.g., `averageTimePerQuestion`), add a new field in the store and expose a new selector. Existing selectors unchanged.

### Example 3: Testing Internal Logic and Public API Separately

**Problem**: Notification store with internal dedup logic and public `useNotifications` selector. Need unit tests for both.

**Internal logic** — pure function, no store:
```typescript
// stores/notifications/dedup.ts
export function dedupNotifications(
  existing: Notification[],
  incoming: Notification[]
): Notification[] {
  const existingIds = new Set(existing.map((n) => n.id))
  const newOnes = incoming.filter((n) => !existingIds.has(n.id))
  return [...newOnes, ...existing].slice(0, 100) // Max 100
}
```

**Test internal logic**:
```typescript
test('dedupNotifications filters duplicates and caps at 100', () => {
  const existing = Array.from({ length: 95 }, (_, i) => ({
    id: String(i), message: `n${i}`, read: false, timestamp: i,
  }))
  const incoming = [
    { id: '0', message: 'duplicate', read: false, timestamp: 200 },
    { id: '96', message: 'new', read: false, timestamp: 300 },
  ]

  const result = dedupNotifications(existing, incoming)
  expect(result).toHaveLength(96)
  expect(result[0].id).toBe('96') // Newest first
  expect(result.filter((n) => n.id === '0')).toHaveLength(1) // No duplicate
})
```

**Test public API** — store actions and state:
```typescript
test('addNotification dedups and maintains public API shape', () => {
  const store = createTestStore({
    notifications: [
      { id: '1', message: 'Existing', read: false, timestamp: 100 },
    ],
    unreadCount: 1,
  })

  store.getState().addNotification({
    id: '1', message: 'Duplicate', read: false, timestamp: 200,
  })

  const state = store.getState()
  expect(state.notifications).toHaveLength(1) // Deduped
  expect(state.notifications[0].timestamp).toBe(200) // Updated timestamp
  expect(state.unreadCount).toBe(1) // Unread count stable
})
```

**Test public API via hook** — integration test:
```typescript
test('useUnreadCount reflects real-time updates', async () => {
  const { result } = renderHook(() => useUnreadCount())
  expect(result.current).toBe(0)

  act(() => {
    useNotificationStore.getState().addNotification({
      id: '1', message: 'New', read: false, timestamp: Date.now(),
    })
  })

  expect(result.current).toBe(1)
})
```

**Result**: Internal dedup logic tested independently (no store overhead). Store actions tested against initial state (no React). Hook selectors tested with `renderHook` (integration). Each layer tests at appropriate granularity.

---

## Key Takeaways
- Encapsulation in Zustand is by convention — no runtime `private` enforcement
- Prefix internal fields with `_` to signal "do not use outside store"
- Barrel exports (`index.ts`) define the public API — only re-export selector hooks
- Selector composition computes derived values in the store, not in components
- Internal state can be restructured freely if public selectors remain stable
- Module-scoped state provides true encapsulation for data that must never reach components
- Cross-store reads use `.getState()` on the other store's public API
- Test internal logic as pure functions, test store actions with `create()` in test, test selectors via `renderHook`
- Explicit `--- External ---` / `--- Internal ---` sections in store definition prevent boundary drift
- `no-restricted-imports` lint rule enforces barrel-only imports

## Common Misconception

**"Encapsulation in Zustand is unnecessary because the store is already the single source of truth."**

Single source of truth does not mean every consumer should see every field. The store is a single source of truth for the application — but components should see a subset tailored to their needs. Exposing `_timerId`, `_rawApiResponse`, or `_normalizedCache` to components couples them to internal implementation. When you rename `_cache` to `_memoizedStore`, 12 components break. When you replace polling with WebSockets, every component reading `_pollInterval` breaks. Encapsulation is not about hiding data — it is about controlling dependencies so internal changes do not propagate. A store without encapsulation is not a clean single source of truth; it is a global variable bucket that everyone depends on.

---

## Feynman Explain
(Explain store encapsulation to a junior developer who knows Zustand basics (create, set, get, selectors) but has never worked on a large codebase. They think "more state exposed = more flexible." They need to understand: why hiding state makes the codebase easier to change, not harder. Use the analogy of a restaurant kitchen: the menu (public API) lists what customers can order. The kitchen (internal state) has ingredient inventory, prep stations, and recipe cards — customers never see these. The menu stays stable even when the kitchen reorganizes.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain zustand-state-management` — AI probes gaps.*

---

## Reframe
(Pause. Judge: Is barrel-only export always the right approach? What about small apps with 2-3 stores where the overhead of maintainng selectors + barrel + types files outweighs encapsulation benefits? When does the cost of abstraction exceed the cost of coupling? Write your evaluation. Consider: team size, codebase lifetime, refactor frequency, and the cost of a breaking change.)

---

## Drill
Take the quiz. MCQs test encapsulation patterns, barrel export design, selector composition, internal state versioning, and testing strategies.

Run: `learn.sh quiz zustand-state-management 06-public-private-api`
