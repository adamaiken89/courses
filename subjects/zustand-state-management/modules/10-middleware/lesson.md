# Module 10: Middleware — Immer, Persist, Custom Chains

Est. study time: 2h
Language: en

## Learning Objectives
- Compose Zustand middleware chains — immer, persist, devtools, custom
- Build custom middleware: logging, validation, analytics
- Explain middleware ordering rules — immer before persist for correct serialization
- Persist partial state to localStorage with selective fields

---

## Core Content

### The Zustand Middleware Pattern

Zustand middleware wraps store creation. Signature:

```typescript
const middleware = (config: StateCreator<T>) => (set, get, api) => {
  // intercept set/get
  return config((...args) => {
    // wrap set
    set(...args)
    // side effects
  }, get, api)
}
```

`api` object: `{ setState, getState, subscribe, destroy, getInitialState }`. Middleware reads `api` for store metadata and side channels.

Built-in middleware (zustand/middleware): `immer`, `persist`, `devtools`, `subscribeWithSelector`, `combine`, `redux`.

> **Think**: Why does middleware receive `set` and `get` AND `api`? What does `api` expose that `set`/`get` do not?
>
> *Answer: `api` gives access to store internals — `subscribe`, `destroy`, and `getInitialState`. Middleware like `persist` uses `subscribe` to watch for changes and `getInitialState` for rehydration. Raw `set`/`get` only handle current state reads and writes.*

### Immer Middleware — Mutable-Style Updates

`immer` middleware lets you write state updates as mutations. Proxy translates to immutable updates.

Before (vanilla Zustand):
```typescript
set((state) => ({ todos: [...state.todos, { text, done: false }] }))
set((state) => ({
  todos: state.todos.map(t => t.id === id ? { ...t, done: !t.done } : t)
}))
```

After (with immer):
```typescript
import { immer } from 'zustand/middleware/immer'

const useStore = create(
  immer((set) => ({
    todos: [],
    addTodo: (text) => set((state) => {
      state.todos.push({ text, done: false })
    }),
    toggleTodo: (id) => set((state) => {
      const todo = state.todos.find(t => t.id === id)
      if (todo) todo.done = !todo.done
    })
  }))
)
```

`state` inside `set` is a `Draft` from Immer's `produce`. Direct mutation works. Immer intercepts all mutations and produces new state tree. Nested updates become trivial — no spread operators for deeply nested objects.

> **Think**: What happens if you return a value from `set((state) => ...)` inside immer middleware? Does immer still apply mutations?
>
> *Answer: Immer's produce checks the return value. If set returns a new object, immer uses that instead of the drafted mutations. This lets you mix styles — mutate some fields, return completely new state for others. Consistent: immer respects explicit return over mutations.*

### Persist Middleware — State Persistence

`persist` middleware saves Zustand state to storage and rehydrates on load.

```typescript
import { persist } from 'zustand/middleware'
import { create } from 'zustand'

const useStore = create(
  persist(
    (set) => ({
      theme: 'light',
      fontSize: 14,
      setTheme: (theme) => set({ theme }),
      setFontSize: (size) => set({ fontSize: size }),
    }),
    {
      name: 'app-settings', // storage key
      storage: localStorage, // default: localStorage
    }
  )
)
```

Storage options:
| Storage | When to use |
|---------|-------------|
| `localStorage` | Persistent across tabs, survives browser close |
| `sessionStorage` | Per-tab, cleared on close |
| `createJSONStorage(() => AsyncStorage)` | React Native / Deno |
| Custom | Any `{ getItem, setItem, removeItem }` API |

> **Think**: `persist` rehydrates async. Your component renders before persisted state loads. How do you handle the flash of default state?
>
> *Answer: Check `useStore.persist.hasHydrated()` or subscribe to `onRehydrateStorage`. Show loading/skeleton until hydrated. Zustand provides `useStore.persist.isHydrated` in v5 — use it in a layout wrapper to defer render until state ready.*

### Partial Persist — Selective Fields

Persist only a subset of state. Prevents storing ephemeral or oversized fields.

```typescript
persist(
  (set) => ({
    user: null,
    sessionToken: null,
    searchResults: [],
    currentQuery: '',
    // ...
  }),
  {
    name: 'auth-storage',
    partialize: (state) => ({
      user: state.user,
      sessionToken: state.sessionToken,
      // searchResults and currentQuery NOT persisted
    }),
  }
)
```

`partialize` receives full state, returns what to persist. Also supports `merge` and `onRehydrateStorage` for transforming rehydrated data.

> **Think**: You persist a `Date` object. On rehydrate, it becomes a string (JSON serialization). How do you restore the Date?
>
> *Answer: Use `merge` function or `onRehydrateStorage`. In `merge`, check if field is string → convert to `new Date()`. Or use reviver in `createJSONStorage`. JSON loses types — Dates, Maps, Sets require manual reconstruction.*

### Devtools Middleware — Redux DevTools

`devtools` connects Zustand to Redux DevTools browser extension.

```typescript
import { devtools } from 'zustand/middleware'

const useStore = create(
  devtools(
    (set) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 }), false, 'increment'),
      reset: () => set({ count: 0 }, false, 'reset'),
    }),
    { name: 'CounterStore', enabled: process.env.NODE_ENV === 'development' }
  )
)
```

Third argument to `set` is action name — appears in DevTools timeline. `enabled` flag prevents production overhead. DevTools shows every state change, action name, diff, and time-travel.

> **Think**: What happens if you omit the action name (third argument to set)? Do DevTools still work?
>
> *Answer: DevTools still record the action — it shows as "anonymous" or "set". Action names improve debugging but are optional. For serious debugging, name every action. Zustand v5 can auto-generate names from function names via `devtools(fn, { serialize: { options: true } })`.*

### Custom Middleware — Logging

Simple logging middleware:

```typescript
const logger = (config) => (set, get, api) =>
  config(
    (...args) => {
      console.log('prev state:', get())
      set(...args)
      console.log('next state:', get())
    },
    get,
    api
  )

const useStore = create(
  logger((set) => ({
    count: 0,
    increment: () => set((state) => ({ count: state.count + 1 })),
  }))
)
```

Extend for validation, analytics, or performance monitoring. Each middleware wraps `set`, runs side effects, then calls the original.

> **Think**: Your logger middleware logs every state change. A high-frequency update (mousemove, scroll) fires set 60 times/second. How do you prevent console spam?
>
> *Answer: Add throttling in middleware: `throttle` or sample every N calls. Check `Date.now() - lastLog > 1000` before logging. Or gate behind `process.env.NODE_ENV === 'development'`. Don't throttle the actual set — only the log call.*

### Middleware Composition — Chaining

Middleware wraps progressively outward. Order matters.

```typescript
const useStore = create(
  devtools(        // outermost — wraps persist
    persist(       // wraps immer
      immer(       // wraps actual store
        (set) => ({ ... })
      ),
      { name: 'store' }
    ),
    { name: 'MyStore' }
  )
)
```

Evaluation: `devtools(persist(immer(config)))`. Each middleware transforms the config function for the next outer layer. `set` flows inward → `devtools` wraps `persist`'s set → `persist` wraps `immer`'s set → actual set.

> **Think**: Why must `immer` be inside `persist`, not outside?
>
> *Answer: Immer produces Proxies/Draft objects. If persist serializes before immer resolves, it serializes Proxy objects → invalid JSON. immer must run first (innermost), converting mutations to plain objects, then persist serializes the plain output. Rule: transform middleware (immer) inside, persistence middleware outside.*

### Middleware Order Rules

| Rule | Why |
|------|-----|
| `immer` innermost | Draft objects → plain objects before serialization |
| `persist` after immer | Serializes plain state, not Immer proxies |
| `devtools` outermost | Captures final state after all transforms |
| Custom analytics outside persist | Fires on every set, including rehydration |
| Custom validation inside persist | Validates fresh state before it persists |

> **Think**: You place a validation middleware outside `persist`. What happens when persisted state loads?
>
> *Answer: Validation runs on rehydrated state too. If old persisted state violates new rules, validation rejects it. Might brick the store. Rule: validation inside persist (pre-save) or in onRehydrateStorage (post-load with fixup).*

### Reusable Middleware Factories

Parameterize custom middleware with options:

```typescript
const withAnalytics = (eventName: string) => (config) => (set, get, api) =>
  config(
    (...args) => {
      set(...args)
      window.analytics.track(eventName, get())
    },
    get,
    api
  )

const useStore = create(
  withAnalytics('TaskStore')((set) => ({
    tasks: [],
    addTask: (t) => set((s) => ({ tasks: [...s.tasks, t] })),
  }))
)
```

Pattern: outer function returns middleware. Use for logging, timing, A/B test assignment, permission checks.

> **Think**: A middleware factory receives options, returns middleware. What closure/gotcha issues arise when middleware factories reference stale options?
>
> *Answer: Options object captured once when store created. If you need dynamic options, pass a function `() => opts` or re-create store. Middleware closures stable after creation — no stale closure risk if options used only at creation time.*

### Real Example: Persist + Immer + Devtools Combined

```typescript
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist, devtools } from 'zustand/middleware'

interface TaskState {
  tasks: Array<{ id: string; text: string; done: boolean }>
  filter: 'all' | 'active' | 'done'
  addTask: (text: string) => void
  toggleTask: (id: string) => void
  setFilter: (filter: TaskState['filter']) => void
}

const useTaskStore = create<TaskState>()(
  devtools(
    persist(
      immer((set) => ({
        tasks: [],
        filter: 'all' as const,
        addTask: (text) =>
          set((state) => {
            state.tasks.push({ id: crypto.randomUUID(), text, done: false })
          }),
        toggleTask: (id) =>
          set((state) => {
            const task = state.tasks.find((t) => t.id === id)
            if (task) task.done = !task.done
          }),
        setFilter: (filter) => set((state) => { state.filter = filter }),
      })),
      {
        name: 'task-store',
        partialize: (state) => ({ tasks: state.tasks, filter: state.filter }),
      }
    ),
    { name: 'TaskStore', enabled: process.env.NODE_ENV === 'development' }
  )
)
```

Order: devtools (debug) → persist (serialization) → immer (mutable updates) → store logic. Each layer adds capability without polluting the layer below.

---

### Why This Matters

Real Zustand stores need more than bare state. Persist saves user progress across sessions — without it, refresh loses all data. Immer eliminates hundreds of spread operators in complex nested state. Devtools makes debugging state changes visual instead of dump-to-console. Custom middleware enforces cross-cutting concerns (logging, validation, analytics) without coupling to store logic. Wrong middleware order corrupts serialization. Master middleware composition = build production-grade stores that survive refresh, are debuggable, and stay maintainable at scale.

---

### Common Questions

**Q: Does immer middleware add bundle size? Is it worth it for small stores?**
A: Immer adds ~5KB min+gzip. For flat stores (2-3 fields), plain set is fine. For deeply nested state (draft editor, form wizard, tree structures), immer saves 10x spread operators. Cost-benefit: if store has nesting depth >= 2, immer pays for itself in readability.

**Q: Can I use multiple persist middleware in one store?**
A: Not directly. Each persist wraps the entire store. Instead, use `partialize` to route fields to different storage keys. Or create separate stores for independent persisted slices and compose them in a hook.

**Q: How do I migrate persisted state shape (e.g., v1 → v2 schema)?**
A: Use `migrate` option in persist config: `{ name: 'store', version: 2, migrate: (persistedState, version) => { if (version === 1) return migrateV1ToV2(persistedState); return persistedState } }`. Zustand runs migration before first render.

**Q: Does persist block the initial render?**
A: Async rehydration yields default state on first render, then updates once storage loaded. Use `skipHydration` option to render nothing until hydrated. Or use `onRehydrateStorage` callback for loading state. Zustand v5 adds `Promise`-based hydration control.

**Q: Devtools middleware in production — does it hurt performance?**
A: Devtools sends state diffs over a WebSocket to the browser extension. In production, set `enabled: false` or remove entirely. The middleware wrapper itself is negligible overhead (~0.01ms per set) — the extension communication costs are the concern.

---

## Examples

### Example 1: Shopping Cart with Immer + Persist

**Problem**: Shopping cart store with nested items, quantities, and applied promotions. Need persistence across sessions for authenticated users. Deep spread operators make addItem/updateQuantity/removeItem error-prone.

**Solution**:
```typescript
interface CartState {
  items: Array<{ productId: string; name: string; price: number; qty: number }>
  promo: { code: string; discount: number } | null
  addItem: (product: CartItem) => void
  updateQty: (productId: string, delta: number) => void
  applyPromo: (code: string, discount: number) => void
  clearCart: () => void
}

const useCartStore = create<CartState>()(
  persist(
    immer((set) => ({
      items: [],
      promo: null,
      addItem: (product) =>
        set((state) => {
          const existing = state.items.find(i => i.productId === product.productId)
          if (existing) {
            existing.qty += product.qty
          } else {
            state.items.push(product)
          }
        }),
      updateQty: (productId, delta) =>
        set((state) => {
          const item = state.items.find(i => i.productId === productId)
          if (item) item.qty = Math.max(0, item.qty + delta)
        }),
      applyPromo: (code, discount) =>
        set((state) => { state.promo = { code, discount } }),
      clearCart: () =>
        set((state) => {
          state.items = []
          state.promo = null
        }),
    })),
    {
      name: 'shopping-cart',
      partialize: (state) => ({ items: state.items, promo: state.promo }),
    }
  )
)
```

**Result**: 0 spread operators. AddItem checks existing in 3 lines instead of 8. Persist survives page refresh. Devtools debugs promo application. Promo and items persisted; ephemeral data (UI selections) excluded via partialize.

### Example 2: Custom Middleware for Optimistic Updates

**Problem**: Todo app syncs with server. Need optimistic updates — show change instantly, rollback on server error. Want to avoid coupling rollback logic into each action.

**Solution — optimistic middleware factory**:
```typescript
const optimistic = <T>() => (config: StateCreator<T>) => (set, get, api: StoreApi<T>) => {
  const rollbacks: Array<() => void> = []

  return config(
    (...args) => {
      const prev = get()
      set(...args)
      rollbacks.push(() => set(prev))
    },
    get,
    {
      ...api,
      commit: () => { rollbacks.length = 0 },
      rollback: () => {
        const fn = rollbacks.pop()
        if (fn) fn()
      },
    }
  )
}

// Usage
const useTodoStore = create(
  devtools(
    optimistic<State>()(
      immer((set, get, api) => ({
        todos: [],
        addTodo: async (text) => {
          const tempId = crypto.randomUUID()
          set((state) => { state.todos.push({ id: tempId, text, synced: false }) })

          try {
            const saved = await api.postTodo(text)
            set((state) => {
              const todo = state.todos.find(t => t.id === tempId)
              if (todo) { todo.id = saved.id; todo.synced = true }
            })
            api.commit!()
          } catch {
            api.rollback!()
          }
        },
      }))
    )
  )
)
```

**Result**: Rollback logic lives in middleware, not in each action. Every set before `commit` is cancellable. New actions get automatic optimistic support.

---

## Key Takeaways
- Zustand middleware pattern: `(config) => (set, get, api) => store`
- Immer lets you mutate state directly inside `set` — no spread operators for nested updates
- Persist saves/restores state via storage — use `partialize` to select fields, `migrate` for schema changes
- Devtools connects to Redux DevTools — name actions via third arg to `set` for clear timeline
- Middleware order: immer innermost → persist → devtools outermost. Transform before serialize
- Custom middleware wraps `set` for cross-cutting concerns — logging, validation, analytics, optimistic updates
- Middleware factories take options, return middleware — reuse pattern across stores
- `api` object exposes `subscribe`, `destroy`, `getInitialState` — used by persist, useful in custom middleware
- Throttle high-frequency logs in custom middleware — don't throttle `set` itself

## Common Misconception

**"Middleware order does not matter — Zustand chains them automatically."**

Order matters critically. Immer produces Proxies that are not JSON-serializable. If `persist` wraps outside `immer`, it serializes Proxy objects → corrupted persistence. If `devtools` wraps inside `persist`, DevTools may miss rehydration events. Rule: immer innermost (resolves Drafts → plain objects), persist next (serializes plain objects), devtools outermost (captures final state). Every middleware layer transforms the `set` function for the next outer layer — wrong order produces wrong transformations.

---

## Feynman Explain
(Explain Zustand middleware to a developer who knows what a store is but has never used middleware. Use kitchen analogy: middleware is like a food prep station — ingredients go through washing (logging), cutting (validation), cooking (immer), boxing (persist), and labeling (devtools). Each station wraps the previous one. Order matters: you can't box ingredients before cooking.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain` — AI probes gaps.*

---

## Reframe
(Pause. Criticize: middleware composition adds indirection — stacktraces become deep, debugging gets harder. When is plain Zustand without middleware the right call? Consider: small project, 2 developers, no persistence needed. Does middleware increase or decrease cognitive load? Write your trade-off analysis.)

---

## Drill
Take the quiz. MCQs test middleware ordering, immer mutation semantics, persist configuration, and custom middleware patterns.

Run: `learn.sh quiz zustand-state-management 10-middleware`
