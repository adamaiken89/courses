# Module 15: Weaknesses 2 and 3 — Serialization, Hydration Gotchas

Est. study time: 2h
Language: en

## Learning Objectives
- Diagnose serialization loss when Zustand stores containing Maps, Sets, Dates, or functions are JSON.stringify'd
- Implement custom replacer/reviver and persist middleware serialize/deserialize options for type-safe persistence
- Prevent hydration mismatch between SSR server render and client rehydrate in Zustand + Next.js apps
- Handle corrupted persisted state, version migration, and async hydration timing in production

---

## Core Content

### Serialization Weakness — JSON's Type Erasure

Zustand stores are plain JavaScript objects. This works well until you `JSON.stringify` the store for persistence (localStorage, sessionStorage, async storage). JSON supports only: strings, numbers, booleans, null, objects, arrays. Everything else is lost or coerced:

```typescript
const store = {
  createdAt: new Date('2025-01-15'),          // → string "2025-01-15T00:00:00.000Z"
  metadata: new Map([['key', 'value']]),       // → {} (empty object)
  tags: new Set(['react', 'zustand']),         // → {} (empty object)
  cleanup: () => console.log('cleanup'),        // → removed entirely
  count: BigInt(9007199254740991),              // → Error: Do not know how to serialize a BigInt
  nested: {  // all fine — plain objects survive
    name: 'test',
    value: 42
  }
}

JSON.stringify(store)
// {
//   "createdAt": "2025-01-15T00:00:00.000Z",
//   "metadata": {},
//   "tags": {},
//   "nested": { "name": "test", "value": 42 }
//   // cleanup is gone
// }
```

Three categories of data loss:

| Type | JSON behavior | Restoration needed |
|------|--------------|-------------------|
| `Date` | Serializes to ISO string | Parse back to `new Date()` |
| `Map`, `Set` | Serializes to `{}` | Custom serialize/deserialize |
| `Function` | Removed entirely | Re-attach from store definition |
| `BigInt`, `RegExp`, `URL` | Error or unexpected coercion | Custom replacer/reviver |
| `undefined` | Becomes `null` in arrays, removed in objects | Track missing keys |

> **Think**: You persist a store with `sessionStart: new Date()`. On rehydrate, `sessionStart` is a string. What happens when your component calls `sessionStart.getTime()`?
>
> *Answer: Runtime error — `getTime` does not exist on string. The string "2025-01-15T00:00:00.000Z" has no Date methods. Every persisted Date must be reconstructed with `new Date(parsed.isoString)`. Failing to reconstruct causes silent NaN propagation through time calculations.*

### Custom Serialization — Replacer and Reviver

`JSON.stringify` accepts a `replacer` function. `JSON.parse` accepts a `reviver` function. Customize both to handle non-JSON types:

```typescript
// Replacer: custom serialization during stringify
function replacer(key: string, value: unknown): unknown {
  if (value instanceof Map) {
    return { __type: 'Map', value: Array.from(value.entries()) }
  }
  if (value instanceof Set) {
    return { __type: 'Set', value: Array.from(value) }
  }
  if (value instanceof Date) {
    return { __type: 'Date', value: value.toISOString() }
  }
  if (typeof value === 'bigint') {
    return { __type: 'BigInt', value: value.toString() }
  }
  return value
}

// Reviver: reconstruct types during parse
function reviver(key: string, value: unknown): unknown {
  if (typeof value === 'object' && value !== null && '__type' in (value as any)) {
    const typed = value as { __type: string; value: unknown }
    switch (typed.__type) {
      case 'Map': return new Map(typed.value as Array<[unknown, unknown]>)
      case 'Set': return new Set(typed.value as Array<unknown>)
      case 'Date': return new Date(typed.value as string)
      case 'BigInt': return BigInt(typed.value as string)
    }
  }
  return value
}

// Usage
const serialized = JSON.stringify(store, replacer)
const deserialized = JSON.parse(serialized, reviver)
// createdAt restored as Date, metadata as Map, tags as Set
```

The `__type` marker convention is safe because `__type` is not a standard JSON field — collisions are rare. For production, use a namespace prefix like `__zustand_type_`.

> **Think**: What happens if the `__type` property appears in legitimate user data (e.g., a user profile has a field named `__type`)?
>
> *Answer: The reviver incorrectly reconstructs it. Fix: use a more specific marker like `__zustand_custom_type` or use a separate metadata key outside the value. Alternatively, check only known keys — if key is `createdAt` and value has `__type: 'Date'`, restore as Date. For unknown keys, pass through unchanged.*

### Persist Middleware — Custom Serialize/Deserialize Options

Zustand's `persist` middleware uses `createJSONStorage` internally, which calls `JSON.stringify`/`JSON.parse`. Override with custom serialization:

```typescript
import { persist, createJSONStorage } from 'zustand/middleware'

interface CartState {
  items: Array<{ id: string; addedAt: Date; name: string }>
  promoCode: string | null
  addItem: (item: { id: string; name: string }) => void
  clearCart: () => void
}

const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      promoCode: null,
      addItem: (item) =>
        set((state) => ({
          items: [...state.items, { ...item, addedAt: new Date() }],
        })),
      clearCart: () => set({ items: [], promoCode: null }),
    }),
    {
      name: 'cart-storage',
      storage: createJSONStorage(() => localStorage, {
        reviver: (key, value) => {
          if (key === 'addedAt' && typeof value === 'string') {
            return new Date(value)
          }
          return value
        },
        replacer: (key, value) => {
          if (key === 'addedAt' && value instanceof Date) {
            return value.toISOString()
          }
          return value
        },
      }),
    }
  )
)
```

`createJSONStorage` accepts a second argument — `{ replacer, reviver }`. These pass through to `JSON.stringify` and `JSON.parse` internally.

**For full control, use a custom storage object:**

```typescript
import { persist } from 'zustand/middleware'

const customStorage = {
  getItem: (name: string) => {
    const raw = localStorage.getItem(name)
    if (!raw) return null
    return JSON.parse(raw, reviver)  // custom reviver
  },
  setItem: (name: string, value: string) => {
    const serialized = JSON.stringify(JSON.parse(value), replacer)  // double parse + custom replacer
    localStorage.setItem(name, serialized)
  },
  removeItem: (name: string) => localStorage.removeItem(name),
}

const useStore = create(
  persist(config, { name: 'my-store', storage: customStorage })
)
```

Note: `persist` middleware calls `JSON.stringify` internally before passing to `storage.setItem`. The value argument to `setItem` is already a JSON string. If you use `createJSONStorage`'s `replacer`/`reviver` option, it integrates cleanly. If you write raw `storage`, you must handle the double-stringify dance.

> **Think**: You use custom `storage` object but forget that `setItem` receives a JSON string, not a plain object. What serialization bug occurs?
>
> *Answer: `JSON.stringify(JSON.parse(value), replacer)` runs. If you accidentally call `JSON.stringify` on the value again without parsing first, you double-stringify. The stored value becomes `"\"escaped string\""` instead of `"plain string"`. On read, `JSON.parse` returns the escaped string, not the original value. Fix: parse once, apply replacer, stringify once. Or use `createJSONStorage` with `replacer` option which handles this correctly.*

### Hydration Mismatch — SSR vs Client Divergence

Hydration mismatch occurs when the HTML rendered on the server differs from the HTML the client produces on first render. Zustand contributes to this when:

1. **Server renders with initial state, client rehydrates from persisted storage**
2. **Server has no access to client-only data** (localStorage, sessionStorage, cookies)
3. **Server and client compute different derived state** (e.g., `new Date()` for "today")

```typescript
// Problem: server and client see different default dates
const useStore = create<{
  today: Date
  setToday: (d: Date) => void
}>((set) => ({
  today: new Date(),   // Server: 2025-06-17T12:00:00.000Z (server timezone)
                       // Client: 2025-06-17T12:00:05.000Z (5 seconds later)
                       // Hydration mismatch!
  setToday: (d) => set({ today: d }),
}))
```

**Three categories of SSR hydration issues:**

| Issue | Cause | Severity |
|-------|-------|----------|
| Timestamp drift | `new Date()` on server vs client | Warning (React 18+), Error (React 19 strict) |
| Random values | `crypto.randomUUID()`, `Math.random()` in initial state | Mismatch + wasted renders |
| Persisted state flash | Default state renders, then persisted state rehydrates | Visual flash, layout shift |
| Missing client APIs | `localStorage`, `navigator`, `window` on server | Runtime error (ReferenceError) |

React 18 uses `hydrateRoot` which suppresses mismatch warnings for single-pass. React 19's stricter hydration surfaces these as errors in development.

> **Think**: A store initializes `userId: crypto.randomUUID()` as default. Server renders `<div data-user-id="abc">`, client hydrates with `"def"`. What happens in React 18 vs React 19?
>
> *Answer: React 18: warning "Text content did not match" but still hydrates (client wins). React 19 with StrictMode: behaves same as 18 for mismatch but surfaces all mismatches in console. In both cases, the DOM is client-correct but every SSR user sees a flash of wrong ID. Fix: generate server-stable defaults and override client-side after hydration via useEffect.*

### Hydration Timing — Async Rehydration and Initial Render Flash

`persist` middleware rehydrates asynchronously. The store's initial render uses default state, then once storage is read, the store updates with persisted values. This causes a flash of default state:

```
Time 0ms:   Store created with default state → Component renders defaults
Time 5ms:   localStorage.getItem('my-store') starts
Time 10ms:  Storage read completes → Store updates with persisted state → Component re-renders
```

For visible UI (theme toggle, sidebar open/close), this flash is jarring. Three strategies:

**Strategy 1: `skipHydration` (Zustand v4.4+)**
```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useStore = create(
  persist(
    (set) => ({
      theme: 'light' as 'light' | 'dark',
      fontSize: 14,
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'settings' }
  )
)

// Skip first render until hydration completes
useStore.persist.skipHydration()

// In component
function App() {
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    // Manually trigger hydration
    useStore.persist.rehydrate().then(() => {
      setHydrated(true)
    })
  }, [])

  if (!hydrated) return <LoadingSkeleton />
  return <MainContent />
}
```

**Strategy 2: `onRehydrateStorage` callback**
```typescript
const useStore = create(
  persist(
    (set) => ({ /* ... */ }),
    {
      name: 'settings',
      onRehydrateStorage: (state) => {
        // Called after each rehydration attempt
        console.log('hydration completed:', state)
        // Return a function called if error
        return (state, error) => {
          if (error) console.error('hydration failed:', error)
        }
      },
    }
  )
)
```

**Strategy 3: Zustand v5 `hasHydrated` method**
```typescript
// Zustand v5
function HydrationGate({ children }: { children: React.ReactNode }) {
  const hydrated = useStore.persist.hasHydrated()

  if (!hydrated) return <LoadingSkeleton />
  return <>{children}</>
}
```

> **Think**: You use `skipHydration` but forget to call `rehydrate()`. What happens?
>
> *Answer: Store never hydrates. Component shows default state forever. The persisted data in localStorage is never read. `skipHydration` pauses the automatic hydration — you must manually trigger `rehydrate()`. Always pair `skipHydration` with a `useEffect` that calls `rehydrate()` and tracks hydration status.*

### SSR with Zustand — Per-Request Store Creation

On the server, a single Zustand store instance persists across all requests. This causes **cross-request state leaks** — user A's data appears in user B's response:

```typescript
// ❌ Wrong: module-level store shared across requests
const useStore = create<{ user: User | null }>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}))

// Request 1: user A logs in → store.user = { id: 1, name: 'Alice' }
// Request 2: user B (no auth yet) → store.user is still Alice's data — LEAK!
```

**Fix: create store per request:**

```typescript
// stores/createServerStore.ts
import { createStore } from 'zustand'
import type { StoreApi } from 'zustand'

interface AuthState {
  user: User | null
  token: string | null
  setAuth: (user: User, token: string) => void
  clearAuth: () => void
}

export function createServerStore() {
  return createStore<AuthState>()((set) => ({
    user: null,
    token: null,
    setAuth: (user, token) => set({ user, token }),
    clearAuth: () => set({ user: null, token: null }),
  }))
}

// In request handler:
// const store = createServerStore()
// // Populate store with request-specific data
// // Render React tree with store in context
// // Store dies when request ends
```

**Server component pattern (Next.js App Router):**
```typescript
// app/layout.tsx
import { createServerStore } from '@/stores/createServerStore'

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const store = createServerStore()
  const session = await getServerSession()

  if (session) {
    store.getState().setAuth(session.user, session.token)
  }

  return (
    <html>
      <body>
        <StoreProvider store={store}>
          {children}
        </StoreProvider>
      </body>
    </html>
  )
}
```

The store lives only for the duration of the request. No shared mutable state between users.

> **Think**: You forget to create store per request and deploy to production. User A visits `/dashboard` (admin), then User B visits `/` (public). What does User B see?
>
> *Answer: If User A's request set store to admin data and User B's request arrives before garbage collection, User B renders User A's dashboard. This is a security vulnerability, not just a rendering bug. Server-rendered stores must be request-scoped. Use React.cache() in Next.js or per-request WeakMap patterns.*

### Zustand + Next.js — Client Store vs Server Store Patterns

Next.js App Router blurs server/client boundaries. Zustand stores must be explicitly scoped:

**Client-Only Stores (persisted, browser APIs):**

```typescript
'use client'

// stores/client/themeStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useThemeStore = create(
  persist(
    (set) => ({
      theme: 'system' as 'light' | 'dark' | 'system',
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'theme-preference' }
  )
)
```

This file has `'use client'` directive. It never runs on the server. Import it only in client components.

**Server-Compatible Stores (no browser APIs):**

```typescript
// stores/shared/counterStore.ts
import { create } from 'zustand'

interface CounterState {
  count: number
  increment: () => void
}

export const useCounterStore = create<CounterState>((set) => ({
  count: 0,
  increment: () => set((s) => ({ count: s.count + 1 })),
}))
```

This store avoids `localStorage`, `window`, `document`. It is safe to import on server and client. The state resets on each request anyway (server creates fresh module scope).

**Hydration mismatch prevention with Next.js:**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useThemeStore } from '@/stores/client/themeStore'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const theme = useThemeStore((s) => s.theme)

  useEffect(() => {
    setMounted(true)  // Client-only: skip SSR render, show after hydration
  }, [])

  if (!mounted) {
    // Return server-safe default — must match what server rendered
    return <div className="theme-system">{children}</div>
  }

  return <div className={`theme-${theme}`}>{children}</div>
}
```

The `mounted` guard ensures the client-rendered DOM matches server-rendered DOM. After hydration, the persisted theme loads and the component re-renders with correct value.

> **Think**: You forget `mounted` guard. Server renders `theme="system"`. Client hydrates — localStorage has `theme="dark"`. What happens?
>
> *Answer: React hydration mismatch warning. Server HTML has `className="theme-system"`. Client first render produces `className="theme-system"` (default state). Then persisted state loads → re-render to `className="theme-dark"`. Result: correct final state but hydration warning + extra re-render. The `mounted` guard eliminates the warning by suppressing client render until both hydration and rehydration complete.*

### Partial Hydration — Selectively Rehydrating Slices

Full rehydration loads all persisted fields at once. Partial hydration loads specific slices on demand — useful for large stores where some data is expensive to fetch or rarely used:

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AppState {
  // Always hydrated
  theme: 'light' | 'dark'
  locale: string

  // Lazily hydrated
  searchHistory: string[]
  draftPosts: DraftPost[]

  setTheme: (t: 'light' | 'dark') => void
  setLocale: (l: string) => void
  addSearch: (q: string) => void
  loadDrafts: () => Promise<void>
}

const useStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'light',
      locale: 'en',
      searchHistory: [],
      draftPosts: [],
      setTheme: (theme) => set({ theme }),
      setLocale: (locale) => set({ locale }),
      addSearch: (q) =>
        set((s) => ({ searchHistory: [...s.searchHistory.slice(-49), q] })),
      loadDrafts: async () => {
        // Fetch from server instead of persisted storage
        const drafts = await api.getDrafts()
        set({ draftPosts: drafts })
      },
    }),
    {
      name: 'app-state',
      partialize: (state) => ({
        theme: state.theme,
        locale: state.locale,
        searchHistory: state.searchHistory,
        // draftPosts NOT persisted — loaded from server
      }),
      // Merge only persisted fields, leave draftPosts default
      merge: (persisted, current) => ({
        ...current,
        ...persisted,
      }),
    }
  )
)
```

`partialize` controls what gets saved. `merge` controls how saved state merges with defaults. For lazy-loaded data, exclude from `partialize` and fetch on demand.

**Selective rehydration on demand:**

```typescript
// zustand v5: rehydrate() accepts partial state
async function rehydrateSearchHistory() {
  const raw = localStorage.getItem('app-state')
  if (!raw) return

  const parsed = JSON.parse(raw)
  if (parsed?.state?.searchHistory) {
    useStore.setState({ searchHistory: parsed.state.searchHistory })
  }
}
```

For granular control, split into multiple persisted stores and hydrate independently:

```typescript
// Small, always-hydrated store
const useSettingsStore = create(persist(/* theme, locale */, { name: 'settings' }))

// Large, lazily-hydrated store
const useSearchStore = create(persist(/* searchHistory */, { name: 'search-history' }))

// Lazy hydrate search only when user opens search panel
function SearchPanel() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    useSearchStore.persist.rehydrate().then(() => setReady(true))
  }, [])

  if (!ready) return <SearchSkeleton />
  return <SearchUI />
}
```

**When lazy hydration makes sense:**

| Scenario | Eager | Lazy |
|----------|-------|------|
| User settings, theme | ✓ | ✗ |
| Search history (1000+ entries) | ✗ | ✓ |
| Draft posts with images | ✗ | ✓ |
| Recently viewed items | ✓ (last 10) | ✓ (full history) |
| Auth token | ✓ | ✗ |

> **Think**: You partialize out `draftPosts` but the merge function spreads `persisted` over `current`. A bug corrupts localStorage — `draftPosts` becomes `null`. What happens on next load?
>
> *Answer: `partialize` excludes draftPosts from persist. But if merge spreads every persisted field, and something writes `{ state: { draftPosts: null } }` to localStorage, the merge applies `draftPosts: null` — overwriting the default `[]`. Fix merge: `merge: (persisted, current) => ({ ...current, ...persisted, draftPosts: current.draftPosts })` to always preserve default.*
>
> *Better: `merge` function should be defensive. If `draftPosts` is not in `persisted`, the spread from `current` handles it. But if corrupted data includes `draftPosts: null`, spread wins. Explicitly guard fields that should always come from current.*

### Error Handling — Corrupted State and Version Migration

Persisted state is not guaranteed to be valid. Users clear localStorage manually, browser extensions corrupt data, or schema changes between deploys break old persisted state.

**Detecting corrupted state:**

```typescript
import { persist } from 'zustand/middleware'

interface SettingsState {
  theme: 'light' | 'dark'
  fontSize: number
  setTheme: (t: 'light' | 'dark') => void
  setFontSize: (s: number) => void
}

const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'light',
      fontSize: 14,
      setTheme: (theme) => set({ theme }),
      setFontSize: (size) => set({ fontSize: size }),
    }),
    {
      name: 'settings',
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.warn('Persisted state corrupted, resetting to defaults')
          // Reset store to defaults
          useSettingsStore.setState({
            theme: 'light',
            fontSize: 14,
          })
          // Clear corrupted storage
          localStorage.removeItem('settings')
        }
      },
      // Schema validation via merge
      merge: (persisted, current) => {
        const p = persisted as Partial<SettingsState>

        // Validate theme
        if (!['light', 'dark'].includes(String(p.theme ?? ''))) {
          p.theme = 'light'
        }

        // Validate fontSize
        if (typeof p.fontSize !== 'number' || p.fontSize < 8 || p.fontSize > 72) {
          p.fontSize = 14
        }

        return { ...current, ...p }
      },
    }
  )
)
```

**Version migration — schema changes over time:**

```typescript
const useStore = create(
  persist(
    (set) => ({ /* current schema */ }),
    {
      name: 'my-store',
      version: 3,  // Current schema version
      migrate: (persistedState: unknown, version: number) => {
        switch (version) {
          case 0:
            // Initial schema: single `user` object
            // Migrate to v1: split into `user` + `profile`
            const v0 = persistedState as { user: { name: string; email: string; avatar: string } }
            persistedState = {
              user: { name: v0.user.name, email: v0.user.email },
              profile: { avatar: v0.user.avatar },
            }
          // falls through
          case 1:
            // v1→v2: rename `profile.avatar` → `profile.avatarUrl`
            const v1 = persistedState as { user: any; profile: { avatar: string } }
            persistedState = {
              ...v1,
              profile: { avatarUrl: v1.profile.avatar },
            }
            // falls through
          case 2:
            // v2→v3: add `preferences` object
            const v2 = persistedState as { user: any; profile: any }
            persistedState = {
              ...v2,
              preferences: { notifications: true, language: 'en' },
            }
          // falls through to current
          default:
            return persistedState as CurrentState
        }
      },
    }
  )
)
```

**Migration checklist:**

1. Increment `version` field
2. Add `case` with old version → transform to new shape
3. Always `// falls through` — migrations chain sequentially
4. Test migration by seeding localStorage with old schema, running app, verifying new schema
5. Handle field renames, type changes, value constraints, removed fields

> **Think**: `version: 3` but user has never opened app before (no persisted state). Does migration run?
>
> *Answer: No. Migration runs only when persisted state exists and its version is lower than current. Fresh users get default state — `version` field is written on first persist. Migration targets users with existing localStorage from older versions. Always test migration path from version 0 (no version field) to current.*

### Real Example: Persisted Cart Store with Date Handling + SSR Compatibility

**Problem**: E-commerce cart store with item-level timestamps (`addedAt: Date`), server-side cart for logged-in users, and localStorage cart for anonymous users. Must handle SSR hydration and Date serialization.

```typescript
'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  addedAt: Date
}

interface CartState {
  items: CartItem[]
  promoCode: string | null
  lastSyncedAt: Date | null
  addItem: (product: { id: string; name: string; price: number }) => void
  updateQuantity: (id: string, delta: number) => void
  removeItem: (id: string) => void
  setPromo: (code: string | null) => void
  clearCart: () => void
}

const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      promoCode: null,
      lastSyncedAt: null,

      addItem: (product) =>
        set((state) => {
          const existing = state.items.find((i) => i.id === product.id)
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.id === product.id
                  ? { ...i, quantity: i.quantity + 1, addedAt: new Date() }
                  : i
              ),
            }
          }
          return {
            items: [
              ...state.items,
              {
                ...product,
                quantity: 1,
                addedAt: new Date(),
              },
            ],
          }
        }),

      updateQuantity: (id, delta) =>
        set((state) => ({
          items: state.items
            .map((i) =>
              i.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i
            )
            .filter((i) => i.quantity > 0),
        })),

      removeItem: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

      setPromo: (code) => set({ promoCode: code }),

      clearCart: () =>
        set({ items: [], promoCode: null, lastSyncedAt: new Date() }),
    }),
    {
      name: 'shopping-cart',
      version: 1,
      storage: createJSONStorage(() => localStorage, {
        replacer: (key, value) => {
          if (key === 'addedAt' || key === 'lastSyncedAt') {
            return value instanceof Date ? value.toISOString() : value
          }
          return value
        },
        reviver: (key, value) => {
          if (key === 'addedAt' || key === 'lastSyncedAt') {
            return typeof value === 'string' ? new Date(value) : value
          }
          return value
        },
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<CartState>

        // Validate items array
        if (!Array.isArray(p.items)) p.items = []

        // Reconstruct Date fields for each item
        p.items = (p.items as any[]).map((item: any) => ({
          ...item,
          addedAt: item.addedAt instanceof Date
            ? item.addedAt
            : new Date(item.addedAt ?? Date.now()),
        }))

        // Reconstruct lastSyncedAt
        if (p.lastSyncedAt && typeof p.lastSyncedAt === 'string') {
          p.lastSyncedAt = new Date(p.lastSyncedAt)
        }

        return { ...current, ...p }
      },
      // Migration for future schema changes
      migrate: (state, version) => {
        if (version === 0) {
          // v0 used string timestamps, v1 uses Date
          // reviver already handles this, but ensure shape
          const v0 = state as any
          return {
            ...v0,
            items: (v0.items ?? []).map((i: any) => ({
              ...i,
              addedAt: typeof i.addedAt === 'string' ? new Date(i.addedAt) : i.addedAt,
            })),
            lastSyncedAt: typeof v0.lastSyncedAt === 'string'
              ? new Date(v0.lastSyncedAt)
              : v0.lastSyncedAt,
          }
        }
        return state as CartState
      },
    }
  )
)
```

**SSR-safe hydration component:**

```typescript
'use client'

import { useEffect, useState, useRef } from 'react'
import { useCartStore } from './stores/cartStore'

function CartProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false)
  const initRef = useRef(false)

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    // Wait for persist rehydration
    const unsub = useCartStore.persist.onFinishHydration(() => {
      setHydrated(true)
    })

    // If already hydrated (e.g., slow render), check synchronously
    if (useCartStore.persist.hasHydrated()) {
      setHydrated(true)
    }

    return () => unsub()
  }, [])

  // SSR: render children with default cart state (no mismatch)
  // Client: wait for hydration then render with persisted cart
  if (!hydrated) {
    return <div style={{ visibility: 'hidden' }}>{children}</div>
  }

  return <>{children}</>
}
```

**Server-side cart (Next.js App Router):**

```typescript
// app/cart/page.tsx — Server Component
import { getServerSession } from 'next-auth'
import { CartClient } from './CartClient'

export default async function CartPage() {
  const session = await getServerSession()

  let serverCart: CartItem[] = []
  if (session?.user) {
    // Fetch cart from database — not from localStorage
    serverCart = await db.cart.findMany({
      where: { userId: session.user.id },
    })
  }

  return <CartClient initialCart={serverCart} />
}
```

```typescript
'use client'
// app/cart/CartClient.tsx
import { useEffect } from 'react'
import { useCartStore } from '@/stores/client/cartStore'

export function CartClient({ initialCart }: { initialCart: CartItem[] }) {
  const { items, addItem, removeItem, clearCart } = useCartStore()

  // Sync server cart into client store on mount
  useEffect(() => {
    if (initialCart.length > 0) {
      // Merge server cart with any locally-added items
      const localItems = useCartStore.getState().items
      if (localItems.length === 0) {
        // No local items → use server cart
        initialCart.forEach((item) => addItem(item))
      }
      // If local items exist, they were added after last server sync
      // Keep local items, sync strategy is separate concern
    }
  }, [initialCart])

  return <CartUI items={items} onRemove={removeItem} onClear={clearCart} />
}
```

**What this covers:**

| Concern | Solution |
|---------|----------|
| `addedAt` as Date | Custom reviver/replacer in `createJSONStorage` |
| Version schema changes | `migrate` function with fallthrough cases |
| Corrupted storage | `merge` validates items array, reconstructs dates |
| SSR hydration flash | `CartProvider` hides children until hydrated |
| Server cart + client cart | Server Component fetches DB cart → Client Component hydrates Zustand |
| Cross-request isolation | `'use client'` store never runs in server context |
| Anonymous + logged-in | localStorage for anonymous, DB for logged-in, merge on login |

> **Think**: User adds items to cart anonymously (localStorage). Then logs in. Server cart has different items. What merge strategy is correct?
>
> *Answer: Three common strategies: (1) localStorage wins — merge into server cart, overwrite server. (2) Server wins — discard localStorage, load server cart. (3) Merge — combine both, deduplicate by ID. Correct strategy depends on business logic. For e-commerce: merge (strategy 3) is safest. Prevent data loss by keeping both and showing union. On checkout, let user review combined cart.*
>
> *Implementation: on login, read localStorage, combine with server cart items, write to server, clear localStorage, rehydrate Zustand from server response.*

---

### Why This Matters

Serialization and hydration bugs are silent data corrupters. A Date becomes a string without error — your app shows NaN or "Invalid Date" days later. Hydration mismatch causes React warnings, layout shifts, and in React 19 with StrictMode, visible console errors that confuse developers. SSR state leaks are security vulnerabilities — one user sees another user's data. These are not edge cases. Every Zustand app that persists state or renders on the server encounters these issues. The fixes are mechanical but non-obvious. Master custom serialization, hydration gating, and per-request stores to ship production-grade Zustand apps.

---

### Common Questions

**Q: Can I use `structuredClone` instead of custom replacer/reviver?**
A: `structuredClone` handles Date, Map, Set, RegExp, BigInt natively. However, `persist` middleware uses `JSON.stringify` under the hood — `structuredClone` is not a drop-in replacement. You would need a completely custom storage backend. For most apps, custom replacer/reviver on `createJSONStorage` is simpler. `structuredClone` is useful if you write a custom storage adapter.

**Q: Does `immer` middleware affect serialization?**
A: Immer produces Draft objects (Proxies). If `persist` wraps outside `immer`, JSON.stringify serializes the Proxies, producing empty objects. Rule: `immer` innermost, `persist` outside. Immer resolves Drafts to plain objects before persist serializes them.

**Q: How do I test hydration and serialization?**
A: Unit test custom replacer/reviver in isolation: `expect(reviver('', replacer('', new Date()))).toBeInstanceOf(Date)`. Integration test: seed localStorage with JSON, create store, verify state shape. E2E: load page, verify no React hydration warnings, verify persisted state after reload.

**Q: What happens if migrate function throws?**
A: Zustand catches migration errors and logs a warning. The store falls back to default state. Corrupted old state is not applied. This is safe — better defaults than broken state. The old state is still in localStorage until overwritten by the next successful persist.

**Q: Can I conditionally use persist only on the client?**
A: Yes. Wrap persist in a function that checks `typeof window !== 'undefined'`. On server, return plain store. On client, return persisted store. Pattern: `const useStore = create(typeof window !== 'undefined' ? persist(config, opts) : config)`.

---

## Examples

### Example 1: Fixing a Broken Date Serialization in Production

**Problem**: Production bug report — user's dashboard shows "NaN years since registration" after page refresh. Store persisted `registeredAt: Date` but rehydrated as string.

```typescript
// Bug: persist without custom serialization
const useUserStore = create(
  persist(
    (set) => ({
      registeredAt: new Date('2023-05-10'),
      lastLogin: new Date('2025-06-01'),
      name: 'Alice',
    }),
    { name: 'user-data' }
  )
)

// Component
function Profile() {
  const registeredAt = useUserStore((s) => s.registeredAt)
  const yearsSince = Math.floor(
    (Date.now() - registeredAt.getTime()) / (365 * 24 * 60 * 60 * 1000)
  )
  // After refresh: registeredAt is string "2023-05-10T00:00:00.000Z"
  // .getTime() on string → NaN → yearsSince = NaN
  return <div>Member for {yearsSince} years</div>
}
```

**Fix**: Custom reviver in `createJSONStorage`:
```typescript
const useUserStore = create(
  persist(
    (set) => ({
      registeredAt: new Date('2023-05-10'),
      lastLogin: new Date('2025-06-01'),
      name: 'Alice',
    }),
    {
      name: 'user-data',
      storage: createJSONStorage(() => localStorage, {
        reviver: (key, value) => {
          if ((key === 'registeredAt' || key === 'lastLogin') && typeof value === 'string') {
            return new Date(value)
          }
          return value
        },
        replacer: (key, value) => {
          if (value instanceof Date) return value.toISOString()
          return value
        },
      }),
    }
  )
)
```

**Result**: After refresh, `registeredAt` is a `Date` object. `.getTime()` works. `yearsSince` computes correctly. No NaN.

**Bonus**: Add `merge` validation for defense-in-depth:
```typescript
merge: (persisted, current) => {
  const p = persisted as Partial<typeof current>
  if (p.registeredAt && typeof p.registeredAt === 'string') {
    p.registeredAt = new Date(p.registeredAt)
  }
  return { ...current, ...p }
}
```

### Example 2: Next.js App — SSR Hydration Mismatch with Persisted Theme

**Problem**: Next.js App Router renders theme from localStorage. Server has no localStorage. Client first render uses default state. Then persisted theme loads. Hydration mismatch.

```
Server render:   <div class="theme-light">   (default)
Client render:   <div class="theme-light">   (default, matches server)
                  ↓ 100ms later
localStorage:     <div class="theme-dark">    (rehydrate, causes flash + mismatch if client rendered)
```

**Solution 1: `suppressHydrationWarning` (quick fix):**
```typescript
'use client'

function ThemeLayout({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme)

  return (
    <div className={`theme-${theme}`} suppressHydrationWarning>
      {children}
    </div>
  )
}
```

This suppresses React's mismatch check for this element. The server-rendered class is `theme-light`. Client first render is also `theme-light`. After rehydration, it becomes `theme-dark`. The DOM patch happens without warning. No mismatch because `suppressHydrationWarning` tells React to skip diff.

**Solution 2: `useMounted` pattern (clean, no suppression):**
```typescript
'use client'

function ThemeLayout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const theme = useThemeStore((s) => s.theme)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Server and first client render: match exactly
  if (!mounted) {
    return <div className="theme-light">{children}</div>
  }

  // After hydration: use real theme from localStorage
  return <div className={`theme-${theme}`}>{children}</div>
}
```

**Result**: No hydration warning. Server and first client render both output `theme-light`. After rehydration, `mounted` becomes `true`, component re-renders with real theme.

### Example 3: Per-Request Store in Next.js App Router

**Problem**: Cross-request state leak in Next.js server components using module-level Zustand store.

```typescript
// ❌ Module-level store — SHARED across requests
const useDataStore = create<{ data: any; loading: boolean }>((set) => ({
  data: null,
  loading: false,
}))

export async function Page() {
  // Request 1 starts: sets data = 'result A'
  // Request 2 starts before Request 1 finishes: overwrites data = 'result B'
  // Request 1 finishes: data is 'result B' — WRONG!
  useDataStore.setState({ data: await fetchData() })
  // Render with wrong data
}
```

**Fix**: Use `React.cache()` to create store per-request:

```typescript
import { createStore } from 'zustand'
import { cache } from 'react'

interface DataState {
  data: any
  setData: (data: any) => void
}

export const getDataStore = cache(() => {
  return createStore<DataState>((set) => ({
    data: null,
    setData: (data) => set({ data }),
  }))
})

// In page component
export async function Page() {
  const store = getDataStore()  // Unique per request due to React.cache()
  const result = await fetchData()
  store.getState().setData(result)

  return <DataComponent store={store} />
}
```

`React.cache()` returns a new store for each request context. React manages the lifetime — the store is garbage collected when the request completes.

**Alternative: manual per-request context:**

```typescript
import { createServerStore } from '@/stores/createServerStore'

export default async function Page() {
  const store = createServerStore()  // Fresh store per invocation
  const data = await fetchData()
  store.getState().setData(data)

  // Pass store to client via props or context
  return <ClientBoundary storeState={store.getState()} />
}
```

The store lives only within the async function scope. No shared state between concurrent requests. Simpler than `React.cache()` for Server Components that do not need cross-component store sharing within the same request.

---

## Key Takeaways
- JSON.stringify loses Dates (becomes string), Maps/Sets (becomes {}), Functions (removed), BigInts (error)
- Fix serialization with custom replacer/reviver in `createJSONStorage(() => localStorage, { replacer, reviver })`
- Zustand persist middleware rehydrates async — initial render gets default state, causing flash
- Skip hydration flash with `skipHydration` + manual `rehydrate()` or `onRehydrateStorage` callback
- SSR + Zustand requires per-request store creation — module-level stores leak state between users
- Next.js: `'use client'` stores for persisted/browser state; server-compatible stores avoid localStorage/window
- Hydration mismatch in Next.js: use `mounted` guard or `suppressHydrationWarning` to handle async rehydration
- version + migrate in persist handles schema changes — use fallthrough pattern for sequential migrations
- Corrupted persisted state: validate in `merge`, reset on error via `onRehydrateStorage`
- Partial hydration: split stores by load priority or use `partialize` + manual `rehydrate()` for lazy data

## Common Misconception

**"JSON.stringify handles everything JavaScript has — if it compiles, it serializes."**

JSON's type support is limited to: string, number, boolean, null, object, array. Date becomes string silently. Map becomes empty object silently. Function disappears silently. BigInt throws. RegExp becomes empty object. These are not bugs — they are JSON's specified behavior. JavaScript developers forget this because they rarely call `JSON.stringify` on their own data. Zustand's `persist` middleware calls JSON.stringify internally for every write. Every non-JSON-safe type in your store is silently corrupted the moment you persist. The corruption only surfaces later when a component tries to call `date.getTime()` and gets NaN. Defensive serialization is not optional — it is a requirement for any Zustand store using persist with non-primitive types.

---

## Feynman Explain
(Explain JSON's type erasure to a junior developer who thinks localStorage stores "anything." Use toy box analogy: JSON.stringify is like a toy box that only accepts Lego blocks (string, number, boolean). You try to put in a teddy bear (Date), slinky (Map), or action figure with accessories (Set). The toy box crushes them into flat shapes. The teddy bear becomes a piece of paper with its name written on it. The slinky becomes an empty box. The action figure's accessories disappear entirely. When you open the box later, you get paper, not a teddy bear. Custom replacer/reviver = instructions written on the side of the box: "If you see a paper labeled teddy bear, fluff it back into a teddy bear.")

*When ready, say explanation aloud or write it down. Then run `learn.sh explain` — AI probes gaps.*

---

## Reframe
(Pause. Critique: Custom serialization adds complexity — replacer, reviver, merge, migrate, version fields. The alternative: avoid non-JSON types entirely. Store Dates as ISO strings throughout the app. Store Maps as plain objects. Use arrays instead of Sets. Is the added complexity worth keeping JS-native types? Consider: team velocity, onboarding new developers, serialization bugs in production. When would you accept "just use strings" vs "invest in custom serialization"? Write your evaluation — weigh type purity against operational simplicity.)

---

## Drill
Take the quiz. MCQs test serialization behavior, custom replacer/reviver, persist middleware options, SSR hydration strategies, and error handling patterns.

Run: `learn.sh quiz zustand-state-management 15-serialization-hydration`
