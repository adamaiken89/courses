# Module 16: Solve Weaknesses 2 and 3 — Middleware Orchestration, Logging

Est. study time: 2h
Language: en

## Learning Objectives
- Orchestrate 5+ middleware layers in production-grade pipeline — serialize, version, validate, log, error-boundary
- Build custom middleware for non-JSON types (Map, Set, Date, BigInt) and version migration
- Implement logging middleware with action tracing, state diffing, and performance tracking
- Apply conditional middleware patterns — dev-only logging, prod-only validation

---

## Core Content

### Beyond Built-in Middleware — The Orchestration Problem

Module 10 covered middleware basics: immer, persist, devtools, simple logging. Real production stores need more. Common gaps:

| Gap | Problem | Solution |
|-----|---------|----------|
| Non-JSON types | `persist` uses JSON.stringify — chokes on `Map`, `Set`, `Date` | Custom serialize middleware |
| Schema drift | State shape changes between deploys — old persisted data corrupts store | Version migration middleware |
| Silent corruption | Invalid state propagates — user sees blank UI with no error | Validation middleware |
| Debugging blind | You see wrong state but don't know which action caused it | Action logging + state diff middleware |
| Unhandled exceptions | Store action throws — whole store crashes | Error boundary middleware |

> **Think**: Why can't Module 10's single `persist` middleware handle Maps, Sets, and Dates out of the box?
>
> *Answer: persist uses `JSON.parse(JSON.stringify(state))` internally. JSON format has no native representation for Map, Set, Date, BigInt, or custom class instances. JSON.stringify converts Date to ISO string, Map to `{}`, Set to `[]`, but JSON.parse does not reverse these — you get strings and plain objects back. Custom serialization must intercept the stringify/parse cycle.*

### Custom Serialize Middleware — Maps, Sets, Dates, Custom Types

Core serialize middleware that handles non-JSON types:

```typescript
interface SerializeConfig {
  types: Record<string, {
    test: (val: unknown) => boolean
    serialize: (val: unknown) => unknown
    deserialize: (val: unknown) => unknown
  }>
}

const serialize = (config: SerializeConfig) =>
  (storeConfig: StateCreator<any>) =>
    (set, get, api: StoreApi<any>) => {
      const serializeState = (state: Record<string, unknown>) => {
        const result: Record<string, unknown> = {}
        for (const [key, val] of Object.entries(state)) {
          let serialized = false
          for (const [, handler] of Object.entries(config.types)) {
            if (handler.test(val)) {
              result[key] = { __type: key, __value: handler.serialize(val) }
              serialized = true
              break
            }
          }
          if (!serialized) result[key] = val
        }
        return result
      }

      const deserializeState = (state: Record<string, unknown>) => {
        const result: Record<string, unknown> = {}
        for (const [key, val] of Object.entries(state)) {
          if (val && typeof val === 'object' && '__type' in (val as object)) {
            const v = val as { __type: string; __value: unknown }
            const handler = config.types[v.__type]
            if (handler) {
              result[key] = handler.deserialize(v.__value)
              continue
            }
          }
          result[key] = val
        }
        return result
      }

      return storeConfig(
        (...args) => {
          set(...args)
        },
        () => deserializeState(get()),
        api
      )
    }
```

But this approach has a problem: persist middleware needs to see the serialized form, not the deserialized form. The correct architecture places serialize *inside* persist, as a transform on the stored value, not on the runtime state.

Better approach — custom storage engine for persist:

```typescript
import { createJSONStorage, persist } from 'zustand/middleware'

interface TypedStorage {
  getItem: (name: string) => string | null
  setItem: (name: string, value: string) => void
  removeItem: (name: string) => void
}

function createTypedStorage(handlers: Record<string, {
  test: (v: unknown) => boolean
  toJSON: (v: unknown) => unknown
  fromJSON: (v: unknown) => unknown
}>): TypedStorage {
  return {
    getItem: (name) => {
      const raw = localStorage.getItem(name)
      if (!raw) return null
      return raw // already JSON string
    },
    setItem: (name, value) => {
      const parsed = JSON.parse(value)
      const transformed = transformValues(parsed, handlers, 'toJSON')
      localStorage.setItem(name, JSON.stringify(transformed))
    },
    removeItem: (name) => localStorage.removeItem(name),
  }
}

// Usage
const useStore = create(
  persist(
    (set) => ({
      visited: new Set<string>(),
      lastLogin: new Date(),
      metadata: new Map<string, string>(),
    }),
    {
      name: 'typed-store',
      storage: createTypedStorage({
        Set: {
          test: (v) => v instanceof Set,
          toJSON: (v: Set<unknown>) => [...v],
          fromJSON: (v: unknown[]) => new Set(v),
        },
        Date: {
          test: (v) => v instanceof Date,
          toJSON: (v: Date) => v.toISOString(),
          fromJSON: (v: string) => new Date(v),
        },
        Map: {
          test: (v) => v instanceof Map,
          toJSON: (v: Map<string, unknown>) => Object.fromEntries(v),
          fromJSON: (v: Record<string, unknown>) => new Map(Object.entries(v)),
        },
      }),
    }
  )
)
```

> **Think**: You have a custom class `UserId` with a `toString()` method. How would you register it with the typed storage pattern above?
>
> *Answer: Add a handler entry: `UserId: { test: (v) => v instanceof UserId, toJSON: (v) => v.toString(), fromJSON: (v) => new UserId(v) }`. Ensure the class constructor accepts the serialized form. For classes without a string-only constructor, serialize to `{ prefix, id }` tuple.*

### Version Migration Middleware — Schema Changes Across Deploys

State shape evolves. Module 10 mentioned `persist`'s built-in `migrate` option. Here we build a standalone migration middleware that works with any storage backend:

```typescript
interface Migration {
  version: number
  migrate: (state: Record<string, unknown>) => Record<string, unknown>
}

const migrations = (migrationList: Migration[]) =>
  (config: StateCreator<any>) => (set, get, api: StoreApi<any>) => {
    const rawState = api.getInitialState()
    const currentVersion = (rawState as Record<string, unknown>).__version ?? 0

    // Apply pending migrations outside persist — runs on store init
    // This is called before persist rehydrates, so we store version independently
    return config(set, get, {
      ...api,
      getInitialState: () => {
        const initial = api.getInitialState()
        let state = { ...initial }
        const storedVersion = Number(localStorage.getItem('store-version') ?? '0')

        const pending = migrationList
          .filter((m) => m.version > storedVersion)
          .sort((a, b) => a.version - b.version)

        for (const m of pending) {
          state = m.migrate(state)
        }

        if (pending.length > 0) {
          localStorage.setItem('store-version', String(migrationList[migrationList.length - 1].version))
        }

        return { ...state, __version: migrationList[migrationList.length - 1]?.version ?? 0 }
      },
    })
  }
```

Real-world migration example — store schema v1 to v2:

```typescript
// v1 state: { user: { name: string, email: string }, theme: string }
// v2: splits user into nested profile, renames theme to appearance

const userMigrations: Migration[] = [
  {
    version: 2,
    migrate: (state) => {
      const s = state as Record<string, unknown>
      if (s.user && typeof s.user === 'object') {
        const u = s.user as Record<string, unknown>
        s.profile = {
          displayName: u.name as string,
          contactEmail: u.email as string,
        }
        delete s.user
      }
      if ('theme' in s) {
        s.appearance = s.theme
        delete s.theme
      }
      return s
    },
  },
  {
    version: 3,
    migrate: (state) => {
      const s = state as Record<string, unknown>
      // Add preferences sub-object
      s.preferences = {
        notifications: true,
        compactMode: false,
      }
      return s
    },
  },
]
```

Better: piggyback on persist's built-in migration. This is simpler and official:

```typescript
const useStore = create(
  persist(
    (set) => ({
      user: null as User | null,
      theme: 'light' as string,
    }),
    {
      name: 'user-store',
      version: 3,
      migrate: (persisted, version) => {
        const state = persisted as Record<string, unknown>
        if (version === 0) {
          state.theme = state.theme || 'light'
        }
        if (version < 2) {
          // v1 → v2: flatten nested user
          if (state.user && typeof state.user === 'object') {
            const u = state.user as Record<string, unknown>
            state.userName = u.name
            state.userEmail = u.email
            delete state.user
          }
        }
        if (version < 3) {
          // v2 → v3: add defaults for new fields
          state.preferences = { notifications: true, compactMode: false }
        }
        return state as Partial<State>
      },
    }
  )
)
```

> **Think**: You deploy migration v3 that renames a field. An older deployment that does not know about v3 reads the old field name. What happens?
>
> *Answer: The old deployment runs its own migration chain, stopping at its highest-known version. If old deploy knows v2 but not v3, it reads the v2-persisted state correctly. But if it reads state written by v3 (with renamed fields), it sees missing data. Rule: never delete fields migrations might need — rename by copying, not moving. Keep old field names as aliases for one version cycle.*

### Logging Middleware — Action Logging, State Diff, Performance

Module 10 built a simple logger that logs before/after state. This section builds a production-grade logging middleware with three features: action tracing, state diffing, and perf tracking.

```typescript
interface LogConfig {
  actionFilter?: (actionName: string) => boolean
  diff?: boolean
  perf?: boolean
  maxLogEntries?: number
}

const createLogger = (config: LogConfig = {}) =>
  (storeConfig: StateCreator<any>) =>
    (set, get, api: StoreApi<any>) => {
      const log: LogEntry[] = []
      const maxEntries = config.maxLogEntries ?? 100
      let actionCount = 0

      const wrappedSet: typeof set = (...args) => {
        const actionName = args[1] as string || `action-${++actionCount}`
        if (config.actionFilter && !config.actionFilter(actionName)) {
          return set(...args)
        }

        const prev = get()
        const start = config.perf ? performance.now() : 0

        if (config.diff) {
          // Snapshot prev keys for comparison
          const prevKeys = Object.keys(prev)
        }

        set(...args)

        const next = get()
        const elapsed = config.perf ? performance.now() - (start as number) : 0

        const entry: LogEntry = {
          action: actionName,
          timestamp: new Date().toISOString(),
        }

        if (config.diff) {
          entry.diff = computeDiff(prev, next)
        }

        if (config.perf) {
          entry.duration = Math.round(elapsed * 100) / 100
          if (elapsed > 16) {
            console.warn(`[zustand/perf] ${actionName} took ${elapsed.toFixed(2)}ms — exceeds 16ms frame budget`)
          }
        }

        log.push(entry)
        if (log.length > maxEntries) log.shift()
      }

      const store = storeConfig(wrappedSet, get, api)

      return {
        ...store,
        __logger: {
          getLog: () => [...log],
          clearLog: () => { log.length = 0 },
          getRecentActions: (n = 10) => log.slice(-n),
          getSlowActions: (threshold = 16) => log.filter(e => (e.duration ?? 0) > threshold),
        },
      }
    }

function computeDiff(prev: Record<string, unknown>, next: Record<string, unknown>) {
  const changes: Record<string, { from: unknown; to: unknown }> = {}
  const allKeys = new Set([...Object.keys(prev), ...Object.keys(next)])

  for (const key of allKeys) {
    if (!Object.is(prev[key], next[key])) {
      // Deep diff only for JSON-serializable values
      if (JSON.stringify(prev[key]) !== JSON.stringify(next[key])) {
        changes[key] = { from: prev[key], to: next[key] }
      }
    }
  }

  return changes
}
```

Ingame access via `useStore.__logger.getLog()`. Attach to window for debug console access:

```typescript
if (process.env.NODE_ENV === 'development') {
  ;(window as any).__zustandLogs = useStore.__logger
}
```

> **Think**: Logging middleware captures every `set` call. A store dispatches 20 actions on mount (hydration, auth check, route data). How do you prevent log noise during initialization?
>
> *Answer: Add a `skipInitial` option. Use a flag `let hydrated = false`, set true after first async tick. Filter out actions with `skipInitial` until hydrated. Or use `actionFilter` to exclude actions matching `init/*` prefix pattern.*

### Error Boundary Middleware — Catch and Log Store Errors

Actions throw. If uncaught, the store enters an inconsistent state. Error boundary middleware catches exceptions and logs them:

```typescript
interface ErrorBoundaryConfig {
  onError?: (error: Error, actionName: string, state: unknown) => void
  fallbackState?: Record<string, unknown>
  recoverMode?: 'rollback' | 'reset' | 'ignore'
}

const errorBoundary = (config: ErrorBoundaryConfig = {}) =>
  (storeConfig: StateCreator<any>) =>
    (set, get, api: StoreApi<any>) => {
      const prevState = get()

      const wrappedSet: typeof set = (...args) => {
        try {
          prevSnapshot = get()
          set(...args)
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err))
          const actionName = (args[1] as string) ?? 'unknown'

          console.error(`[zustand/error] Action "${actionName}" failed:`, error)

          if (config.onError) {
            config.onError(error, actionName, prevSnapshot ?? get())
          }

          const mode = config.recoverMode ?? 'rollback'
          if (mode === 'rollback' && prevSnapshot) {
            set(prevSnapshot, false, `${actionName}::rollback`)
          } else if (mode === 'reset' && config.fallbackState) {
            set(config.fallbackState, false, `${actionName}::reset`)
          }
          // mode === 'ignore': state unchanged — set did not execute
        }
      }

      return storeConfig(wrappedSet, get, api)
    }
```

Usage:

```typescript
const useStore = create(
  errorBoundary({
    onError: (error, action, state) => {
      reportErrorToSentry(error, { action, state })
    },
    recoverMode: 'rollback',
    fallbackState: { user: null, initialized: false },
  })(
    (set) => ({
      user: null,
      initialized: true,
      fetchUser: async (id: string) => {
        const res = await fetch(`/api/users/${id}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const user = await res.json()
        set({ user })
      },
    })
  )
)
```

> **Think**: Error boundary middleware catches synchronous errors in `set`. But async actions (like `fetchUser` above) throw outside `set`. How does error boundary catch those?
>
> *Answer: It does not — the `async` function catches its own error. For async actions, wrap the async body in try/catch inside the action itself, then call set for error state. Error boundary only catches errors thrown *inside* the wrapped set function. For full coverage, combine error boundary (sync) with action-level try/catch (async).*

### Validation Middleware — Enforce State Shape

Validate state before it is written. Prevents invalid data from propagating to subscribers, persist, or UI.

```typescript
interface ValidationRule {
  key: string
  validate: (value: unknown, state: Record<string, unknown>) => boolean
  message: string
  level?: 'error' | 'warn'
}

const validate = (rules: ValidationRule[]) =>
  (storeConfig: StateCreator<any>) =>
    (set, get, api: StoreApi<any>) => {
      const wrappedSet: typeof set = (...args) => {
        // Compute next state without applying
        const updater = args[0]
        const nextState = typeof updater === 'function'
          ? updater(get())
          : updater

        // Ensure next state is an object
        const partial = nextState as Record<string, unknown>

        for (const rule of rules) {
          if (rule.key in partial) {
            const valid = rule.validate(partial[rule.key], { ...get(), ...partial })
            if (!valid) {
              const level = rule.level ?? 'error'
              const msg = `[zustand/validation] ${rule.message} (key: ${rule.key})`

              if (level === 'error') {
                if (process.env.NODE_ENV === 'development') {
                  throw new Error(msg)
                }
                // Production: skip the invalid set
                console.error(msg)
                return
              }

              console.warn(msg)
            }
          }
        }

        set(...args)
      }

      return storeConfig(wrappedSet, get, api)
    }
```

Usage:

```typescript
const useStore = create(
  validate([
    {
      key: 'age',
      validate: (v) => typeof v === 'number' && v >= 0 && v < 150,
      message: 'Age must be a number between 0 and 150',
      level: 'error',
    },
    {
      key: 'email',
      validate: (v) => typeof v === 'string' && v.includes('@'),
      message: 'Email must contain @',
      level: 'warn', // log but allow
    },
    {
      key: 'todos',
      validate: (v) => Array.isArray(v),
      message: 'Todos must be an array',
    },
  ])(
    (set) => ({
      age: 0,
      email: '',
      todos: [],
    })
  )
)
```

> **Think**: How does validation middleware interact with `partialize` in persist? If validation errors on a field excluded from persist, does the error still fire?
>
> *Answer: Validation middleware wraps `set`, which runs before persist serializes. If you set a field that triggers validation, it fires regardless of partialize. To skip validation for non-persisted fields, add a condition in the validate function or pass a `skipKeys` list. Better: validate only fields that are in the validation rules, ignore unknown keys.*

### Middleware Ordering — The Production Grid

Module 10 gave basic ordering rules. Production stores need a refined grid:

| Layer | Position | Why |
|-------|----------|-----|
| Error boundary | Outermost | Catches errors from all inner layers |
| Logging | Second outermost | Captures every action including validation errors |
| Devtools | Middle-outer | Debugging sees pre-validated state |
| Persist | Middle | Saves state after validation, before devtools sends to extension |
| Serialize | Inside persist | Custom storage engine transforms non-JSON types |
| Version migration | Inside persist/piggyback | Runs on rehydrated state before store logic |
| Validation | Inner-middle | Catches invalid state before persist saves it |
| Immer | Innermost | Draft → plain objects before validation reads them |

Implementation:

```typescript
const useStore = create(
  errorBoundary({ recoverMode: 'rollback', onError: reportToSentry })(
    createLogger({ diff: true, perf: true, actionFilter: (a) => !a.startsWith('__') })(
      devtools(
        persist(
          immer(
            validate([
              { key: 'todos', validate: (v) => Array.isArray(v), message: 'todos must be array' },
              { key: 'filter', validate: (v) => ['all', 'active', 'done'].includes(v as string), message: 'invalid filter' },
            ])(
              (set) => ({
                todos: [],
                filter: 'all' as const,
                addTodo: (text: string) => set((state) => { state.todos.push({ id: crypto.randomUUID(), text, done: false }) }),
                setFilter: (filter: 'all' | 'active' | 'done') => set({ filter }),
              })
            )
          ),
          {
            name: 'todo-store',
            storage: createTypedStorage({ /* custom type handlers */ }),
            version: 1,
            migrate: (persisted, version) => { /* ... */ },
            partialize: (state) => ({ todos: state.todos, filter: state.filter }),
          }
        ),
        { name: 'TodoStore', enabled: process.env.NODE_ENV === 'development' }
      )
    )
  )
)
```

Simplification through middleware factory composition:

```typescript
function createProductionStore<T>(
  config: StateCreator<T, [], []>,
  options: {
    name: string
    rules?: ValidationRule[]
    typedHandlers?: Record<string, TypeHandler>
    version?: number
    migrate?: (state: unknown, version: number) => T
    partialize?: (state: T) => Partial<T>
    errorConfig?: ErrorBoundaryConfig
    logConfig?: LogConfig
  }
) {
  const middlewares: any[] = []

  // Innermost
  let composed: StateCreator<T, [], []> = immer(config)

  if (options.rules && options.rules.length > 0) {
    composed = validate(options.rules)(composed)
  }

  const persistConfig: any = { name: options.name }
  if (options.version) persistConfig.version = options.version
  if (options.migrate) persistConfig.migrate = options.migrate
  if (options.partialize) persistConfig.partialize = options.partialize
  if (options.typedHandlers) {
    persistConfig.storage = createTypedStorage(options.typedHandlers)
  }

  composed = persist(composed, persistConfig)

  composed = devtools(composed, {
    name: options.name,
    enabled: process.env.NODE_ENV === 'development',
  })

  if (options.logConfig) {
    composed = createLogger(options.logConfig)(composed)
  }

  if (options.errorConfig) {
    composed = errorBoundary(options.errorConfig)(composed)
  }

  return create(composed)
}
```

> **Think**: The middleware order above puts logging outside devtools. What happens to DevTools action names if logging middleware wraps set differently?
>
> *Answer: Logging middleware wraps `set` and must pass through the action name (third arg). If logging discards or transforms args before calling `set(...args)`, devtools receives modified args. Ensure logging calls `set(...args)` with original arguments to preserve action names for outer layers.*

### Conditional Middleware — Dev vs Prod

Not all middleware belongs in production. Devtools sends state over WebSocket. Logging accumulates memory. Validation can be expensive.

Pattern — environment gating:

```typescript
const createConditionalStore = <T>(
  config: StateCreator<T, [], []>,
  name: string
) => {
  const isDev = process.env.NODE_ENV === 'development'

  let composed: StateCreator<T, [], []> = immer(config)

  // Validation: always — prevents data corruption even in prod
  composed = validate([
    { key: 'items', validate: (v) => Array.isArray(v), message: 'items must be array', level: 'error' },
  ])(composed)

  composed = persist(composed, { name, partialize: (s) => ({ items: (s as any).items }) })

  // Devtools: dev only
  if (isDev) {
    composed = devtools(composed, { name, enabled: true })
  }

  // Logger: dev only with full diff, prod with perf only
  if (isDev) {
    composed = createLogger({ diff: true, perf: true })(composed)
  } else {
    composed = createLogger({ diff: false, perf: true, actionFilter: () => false })(composed)
    // perf-only in prod: track slow actions silently
  }

  // Error boundary: always
  composed = errorBoundary({
    recoverMode: 'rollback',
    onError: (err, action) => reportToSentry(err, { action, store: name }),
  })(composed)

  return create(composed)
}
```

> **Think**: Validation middleware runs in both dev and prod. If a validation error fires in prod, the middleware throws. In dev, the error helps debugging. In prod, the user sees a blank screen. Is that acceptable?
>
> *Answer: No — in prod, validation should soft-fail: log the error, skip the invalid state update, keep previous state. Only throw in dev. The validation middleware example above already does this via the `level` check (error level throws in dev, logs in prod). Adjust behavior per environment for production robustness.*

### Real Example: Production Store with 6 Middleware Layers

Full production todo store with validation, typed storage, persist, devtools, logging, error boundary:

```typescript
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist, devtools, createJSONStorage } from 'zustand/middleware'

// --- Types ---
interface Todo {
  id: string
  text: string
  done: boolean
  createdAt: Date
  tags: Set<string>
}

interface TodoState {
  todos: Todo[]
  filter: 'all' | 'active' | 'done'
  ui: { sidebarOpen: boolean }
  lastSync: Date | null

  addTodo: (text: string, tags?: string[]) => void
  toggleTodo: (id: string) => void
  setFilter: (f: TodoState['filter']) => void
  toggleSidebar: () => void
  syncFromServer: (todos: Todo[]) => void
}

// --- Custom type handlers for persist ---
const typeHandlers = {
  Date: {
    test: (v: unknown): v is Date => v instanceof Date,
    toJSON: (v: Date) => v.toISOString(),
    fromJSON: (v: string) => new Date(v),
  },
  Set: {
    test: (v: unknown): v is Set<unknown> => v instanceof Set,
    toJSON: (v: Set<unknown>) => [...v],
    fromJSON: (v: unknown[]) => new Set(v),
  },
}

// --- Validation rules ---
const todoRules: ValidationRule[] = [
  {
    key: 'todos',
    validate: (v) => Array.isArray(v),
    message: 'todos must be an array',
    level: 'error',
  },
  {
    key: 'filter',
    validate: (v) => ['all', 'active', 'done'].includes(v as string),
    message: 'filter must be all, active, or done',
    level: 'error',
  },
  {
    key: 'lastSync',
    validate: (v) => v === null || v instanceof Date,
    message: 'lastSync must be a Date or null',
    level: 'warn',
  },
]

// --- Migration schema v1 → v2 ---
const migrateV1toV2 = (persisted: unknown, version: number) => {
  const state = persisted as Record<string, unknown>
  if (version < 1) {
    // v0 → v1: add tags default
    if (Array.isArray(state.todos)) {
      state.todos = (state.todos as any[]).map((t: any) => ({
        ...t,
        tags: t.tags ?? [],
        createdAt: t.createdAt ?? new Date().toISOString(),
      }))
    }
  }
  if (version < 2) {
    // v1 → v2: add ui sub-object
    state.ui = state.ui ?? { sidebarOpen: true }
  }
  return state as Partial<TodoState>
}

// --- Build store with middleware orchestration ---
const useTodoStore = create<TodoState>()(
  errorBoundary({
    recoverMode: 'rollback',
    onError: (err, action) => {
      console.error(`[TodoStore] Error in ${action}:`, err)
      // reportToSentry(err, { action, store: 'TodoStore' })
    },
  })(
    createLogger({
      diff: true,
      perf: true,
      actionFilter: (name) => !name.startsWith('__'),
      maxLogEntries: 200,
    })(
      devtools(
        persist(
          immer(
            validate(todoRules)(
              (set) => ({
                todos: [],
                filter: 'all' as const,
                ui: { sidebarOpen: true },
                lastSync: null,

                addTodo: (text, tags = []) =>
                  set((state) => {
                    state.todos.push({
                      id: crypto.randomUUID(),
                      text,
                      done: false,
                      createdAt: new Date(),
                      tags: new Set(tags),
                    })
                  }),

                toggleTodo: (id) =>
                  set((state) => {
                    const todo = state.todos.find((t) => t.id === id)
                    if (todo) todo.done = !todo.done
                  }),

                setFilter: (filter) =>
                  set((state) => { state.filter = filter }),

                toggleSidebar: () =>
                  set((state) => { state.ui.sidebarOpen = !state.ui.sidebarOpen }),

                syncFromServer: (todos) =>
                  set((state) => {
                    state.todos = todos
                    state.lastSync = new Date()
                  }),
              })
            )
          ),
          {
            name: 'todo-store',
            storage: createJSONStorage(() => localStorage, {
              reviver: (key, value) => {
                // Deserialize custom types during JSON.parse
                if (key === 'createdAt' || key === 'lastSync') return new Date(value as string)
                if (key === 'tags' && Array.isArray(value)) return new Set(value)
                return value
              },
              replacer: (key, value) => {
                // Serialize custom types during JSON.stringify
                if (value instanceof Set) return [...value]
                if (value instanceof Date) return value.toISOString()
                return value
              },
            }),
            version: 2,
            migrate: migrateV1toV2,
            partialize: (state) => ({
              todos: state.todos,
              filter: state.filter,
              ui: state.ui,
              lastSync: state.lastSync,
            }),
          }
        ),
        { name: 'TodoStore', enabled: process.env.NODE_ENV === 'development' }
      )
    )
  )
)
```

The production store pipeline (inner → outer):

1. **Immer** — mutable updates for todos, no spread operators
2. **Validation** — enforces todos shape, filter values, Date types
3. **Persist** — saves/loads via localStorage with typed serialization (reviver/replacer), migration v1→v2, partialize
4. **Devtools** — action tracing in dev mode only
5. **Logger** — diff + perf tracking, skips internal actions
6. **Error boundary** — rollback on any synchronous error, Sentry reporting

---

### Why This Matters

Module 10 gave you middleware basics. This module gives you production middleware orchestration. The difference: basic middleware handles happy path (persist + devtools). Production middleware handles edge cases — corrupt data (validation), schema drift (migration), non-JSON types (custom serialize), silent crashes (error boundary), and debugging blind spots (action logging + state diff). Without these six layers, a production Zustand store silently corrupts data on schema migration, crashes on malformed API responses, and hides action causality from developers. Every major Zustand codebase (500+ stores on GitHub) uses 4+ middleware layers. This module teaches you to compose, order, and conditionally gate them for reliability.

---

### Common Questions

**Q: Does error boundary middleware catch async action errors?**
A: No — it catches errors thrown *inside* the `set` call. Async errors happen outside set, in the action function body. Wrap async actions in try/catch manually. Error boundary handles synchronous validation failures, serialization errors, and accidental state mutations.

**Q: How many middleware layers are too many?**
A: 6-7 is typical (immer, validation, persist, devtools, logging, error boundary). Beyond 8, measure overhead — each `set` call traverses every layer. If a store has 1000+ sets/sec (rare), consider merging validate+serialize into one middleware. For normal apps (< 10 sets/sec), overhead is negligible (~0.01ms per layer).

**Q: Can I use persist's built-in migration instead of custom migration middleware?**
A: Yes — prefer persist's `migrate` option. It is simpler, handles async rehydration, and is tested by the Zustand team. Custom migration middleware is only needed if you migrate non-persisted state or use multiple storage backends.

**Q: Validation middleware throws in dev but logs in prod. How do I test validation in CI?**
A: Set `NODE_ENV=test` and treat validation errors as thrown errors. In tests, wrap store actions in try/catch and assert on validation errors. Run the same tests in CI with `NODE_ENV=development` to catch regressions.

**Q: What happens if a migration function throws?**
A: Persist catches the error and falls back to un-migrated state. The store initializes with default state. Log the error and alert the developer — user sees fresh state instead of corrupted data. Under "how likely": migrations failing is rare (~1 in 10,000 deploys) but catastrophic when it happens.

**Q: Does logging middleware cause memory leaks?**
A: It can, if you never clear the log buffer. Cap `maxLogEntries` (100-200 is safe). In prod, disable logging entirely. Logger stored on `__logger` getter — if you attach to `window` for debugging, clear on route change or session end.

---

## Examples

### Example 1: E-commerce Cart with Validation, Typed Storage, Migration

**Problem**: Cart store needs to persist across sessions. State includes `Map<productId, CartItem>` for O(1) lookups, `Date` timestamps, and a `Set<appliedPromoIds>`. Schema changed from v1 (array-based) to v2 (Map-based). Must handle old persisted data.

**Solution**:

```typescript
interface CartItem {
  productId: string
  name: string
  price: number
  qty: number
  addedAt: Date
}

interface CartState {
  items: Map<string, CartItem>
  appliedPromos: Set<string>
  lastUpdated: Date | null
  addItem: (item: CartItem) => void
  removeItem: (productId: string) => void
  applyPromo: (code: string) => void
  clearExpiredPromos: () => void
}

const useCartStore = create<CartState>()(
  errorBoundary({ recoverMode: 'rollback', onError: reportToSentry })(
    createLogger({ diff: true, maxLogEntries: 100 })(
      devtools(
        persist(
          immer(
            validate([
              { key: 'items', validate: (v) => v instanceof Map, message: 'items must be Map', level: 'error' },
              { key: 'appliedPromos', validate: (v) => v instanceof Set, message: 'promos must be Set', level: 'warn' },
            ])(
              (set) => ({
                items: new Map(),
                appliedPromos: new Set(),
                lastUpdated: null,

                addItem: (item) => set((state) => {
                  state.items.set(item.productId, item)
                  state.lastUpdated = new Date()
                }),

                removeItem: (productId) => set((state) => {
                  state.items.delete(productId)
                  state.lastUpdated = new Date()
                }),

                applyPromo: (code) => set((state) => {
                  state.appliedPromos.add(code)
                }),

                clearExpiredPromos: () => set((state) => {
                  state.appliedPromos.clear()
                }),
              })
            )
          ),
          {
            name: 'cart-store',
            storage: createJSONStorage(() => localStorage, {
              reviver: (key, value) => {
                if (key === 'lastUpdated' || key === 'addedAt') return new Date(value as string)
                if (key === 'appliedPromos' && Array.isArray(value)) return new Set(value)
                if (key === 'items' && Array.isArray(value)) return new Map(value.map(
                  (e: any) => [e[0], { ...e[1], addedAt: new Date(e[1].addedAt) }]
                ))
                return value
              },
              replacer: (key, value) => {
                if (value instanceof Set) return [...value]
                if (value instanceof Map) return [...value]
                if (value instanceof Date) return value.toISOString()
                return value
              },
            }),
            version: 2,
            migrate: (persisted, version) => {
              const state = persisted as Record<string, unknown>
              if (version < 1) {
                // v0 (array-based) → v1 (Map-based)
                if (Array.isArray(state.items)) {
                  state.items = new Map(
                    (state.items as any[]).map((item: any) => [item.productId, item])
                  )
                }
              }
              if (version < 2) {
                state.appliedPromos = state.appliedPromos ?? new Set()
              }
              return state as Partial<CartState>
            },
            partialize: (state) => ({
              items: state.items,
              appliedPromos: state.appliedPromos,
              lastUpdated: state.lastUpdated,
            }),
          }
        ),
        { name: 'CartStore' }
      )
    )
  )
)
```

**Result**: Cart survives page refresh. Old array-based data auto-migrates to Map. Invalid sets (null items) caught by validation. Promo code errors rollback to previous valid state. Logger provides last 100 actions for debugging.

### Example 2: Form Wizard with Conditional Middleware

**Problem**: Multi-step form store in a Next.js app. Dev mode: full logging, devtools, state validation logging. Prod mode: error boundary only, minimal logging, validation silenty corrects.

**Solution — environment-conditional middleware factory**:

```typescript
function createFormStore<T extends Record<string, unknown>>(
  config: StateCreator<T, [], []>,
  name: string,
  schema: ValidationRule[],
) {
  const isDev = process.env.NODE_ENV === 'development'
  const isServer = typeof window === 'undefined'

  let composed: StateCreator<T, [], []> = immer(config)

  // Validation always — prevents corrupt form data
  composed = validate(schema)(composed)

  if (!isServer) {
    composed = persist(composed, {
      name: `form-${name}`,
      partialize: (s) => {
        // Only persist form data, not UI state
        const partial = { ...s } as any
        delete partial.ui // remove UI-only fields
        return partial
      },
    })

    if (isDev) {
      composed = devtools(composed, { name, enabled: true })
      composed = createLogger({
        diff: true,
        perf: true,
        actionFilter: (a) => !a.includes('CHANGE'), // filter high-frequency input changes
      })(composed)
    }

    composed = errorBoundary({
      recoverMode: isDev ? 'rollback' : 'reset',
      fallbackState: isDev ? undefined : ({ currentStep: 0, data: {} } as T),
      onError: (err, action) => {
        if (isDev) console.error(`[${name}] ${action}:`, err)
        else reportToSentry(err, { action, store: name })
      },
    })(composed)
  }

  return create(composed)
}

// Usage
const formSchema = [
  { key: 'currentStep', validate: (v) => typeof v === 'number' && v >= 0, message: 'step must be number', level: 'error' },
  { key: 'data', validate: (v) => typeof v === 'object' && v !== null, message: 'data must be object', level: 'error' },
]

const useCheckoutForm = createFormStore(
  (set) => ({
    currentStep: 0,
    data: {} as Record<string, unknown>,
    ui: { showSummary: false },
    nextStep: () => set((state) => ({ currentStep: state.currentStep + 1 })),
    updateField: (key: string, value: unknown) =>
      set((state) => { (state.data as any)[key] = value }),
    toggleSummary: () => set((state) => { state.ui.showSummary = !state.ui.showSummary }),
    reset: () => set({ currentStep: 0, data: {}, ui: { showSummary: false } }),
  }),
  'checkout-form',
  formSchema
)
```

**Result**: Dev mode catches all issues with full debugging tools. Prod mode omits devtools entirely (no WebSocket overhead), disables diff logging (memory savings), and resets to step 0 on unrecoverable error instead of rolling back to potentially corrupted state. Server-side rendering skips persist entirely.

---

## Key Takeaways
- Production Zustand stores need 6 middleware layers: immer → validation → persist (with serialize + migration) → devtools → logging → error boundary
- Custom types (Map, Set, Date) require custom storage engine with reviver/replacer — never rely on default JSON serialization for non-JSON types
- Version migration goes inside persist's `migrate` option — never delete fields, always copy-then-rename across version boundaries
- Error boundary catches synchronous set errors — async errors need action-level try/catch
- Validation middleware prevents corrupt state from propagating — throw in dev, soft-fail in prod
- Logging middleware tracks actions, diffs, and performance — cap log buffer at 100-200 entries, filter high-frequency actions
- Devtools and full logging are dev-only — conditional middleware gates them via `process.env.NODE_ENV`
- Middleware ordering matters: immer resolves drafts first, validation checks before save, persist serializes, devtools captures, logging records, error boundary protects
- Middleware factory composition (`createProductionStore`) reduces boilerplate when the same pipeline applies to multiple stores
- Attach `__logger` getter to window in dev for console-based debugging without Redux DevTools

## Common Misconception

**"More middleware = more reliability automatically."**

Middleware adds reliability only when correctly ordered and environment-gated. Adding validation after persist means validated state is still saved. Adding error boundary inside logging means logged errors crash the store before the boundary catches them. Adding devtools in production adds WebSocket overhead for no benefit. The wrong middleware layer in the wrong position actively hurts — validation inside persist bricks the store, logging outside error boundary does not capture error events. Each middleware layer must earn its position: what does it protect, what is its cost, and does it need to run in production. The production middleware grid above is a starting point, not a universal solution. Measure, then add.

---

## Feynman Explain
(Explain middleware orchestration to a junior developer who knows only basic Zustand `create`. Use conveyor belt analogy: each middleware is a station on an assembly line. The raw material (state change) enters the belt at the innermost station (immer — prepares the part), passes through quality check (validation), gets packaged for storage (persist), labeled for tracking (devtools), recorded for logs (logging), and wrapped in protective foam (error boundary). The belt goes one direction: inner → outer. Each station can reject the part (error boundary catches), tag it (logging adds info), or repackage it (persist serializes). If a station rejects, stations that already processed it have already done work — error boundary outermost ensures it catches failures from *all* stations.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain` — AI probes gaps.*

---

## Reframe
(Pause. Critique: 6 middleware layers add 6 levels of function wrapping. Stack traces become deep. A simple `set({ todos: [...] })` traverses 6 wrappers. Is this complexity justified, or is it over-engineering? Consider: a 3-person startup building a todo app vs a 50-person team building a compliance dashboard. Where is the cutoff? Write your evaluation. When would you strip down to 3 layers (immer + persist + one custom) and what protections do you lose?)

---

## Drill
Take the quiz. MCQs test middleware orchestration, type serialization, migration strategies, logging patterns, error boundary behavior, validation trade-offs, and environment gating.

Run: `learn.sh quiz zustand-state-management 16-middleware-orchestration`
