# Module 18: Custom Hooks Patterns — Composition, Refactoring, Testing

Est. study time: 2h
Language: en

## Learning Objectives
- Design custom hooks following naming, typing, and parameter conventions for production use
- Compose hooks from other hooks, managing dependency chains and lifecycle correctly
- Refactor component logic into reusable hooks while keeping render pure
- Test custom hooks with renderHook covering mount, update, unmount, and concurrent behavior

---

## Core Content

### Custom Hook Conventions

Custom hooks are functions that use React hooks. Three conventions govern them:

**1. Naming**: Prefix `use` — enables React's lint rules (exhaustive-deps, rules-of-hooks). Without `use`, lint rules skip the function — dangerous.

**2. Return types**:

| Return style | When to use |
|-------------|-------------|
| Single value `T` | One output — `useTheme()` returns `Theme` |
| Tuple `[T, Dispatch]` | Value + setter — `useLocalStorage<T>(key, initial)` |
| Object `{ value, action }` | Multiple named outputs — `useMediaQuery(query)` |
| Named object with actions | Complex API — `useForm()` returns `{ values, errors, submit, reset }` |

```typescript
// Tuple pattern (state + updater — matches useState)
function useLocalStorage<T>(key: string, initial: T): [T, (value: T) => void] {
  const [stored, setStored] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? (JSON.parse(item) as T) : initial
    } catch {
      return initial
    }
  })

  const setValue = useCallback((value: T) => {
    setStored(value)
    window.localStorage.setItem(key, JSON.stringify(value))
  }, [key])

  return [stored, setValue]
}

// Object pattern (multiple named outputs)
function useMediaQuery(query: string): { matches: boolean; query: string } {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return { matches, query }
}
```

**3. Parameter patterns**:

```typescript
// Single required param
function useDebounce<T>(value: T, delay: number): T { ... }

// Options object (for 3+ params or optional params)
function useIntersectionObserver(
  options: { threshold?: number; root?: Element; rootMargin?: string }
): { entry: IntersectionObserverEntry | null; ref: (node: Element | null) => void } { ... }

// Configurable with defaults
function usePolling<T>(
  fetcher: () => Promise<T>,
  options?: { interval?: number; enabled?: boolean; onError?: (e: Error) => void }
) { ... }
```

> **Think**: A custom hook returns `{ data, loading, error, refetch }`. Should this be a tuple or object? Why?
>
> *Answer: Object. Four named outputs would be illegible as tuple — caller would write `const [data, loading, error, refetch] = useX()` and must remember position order. Objects let callers destructure by name: `const { data, loading } = useX()`. Use tuples only for 2-element state+setter pairs matching useState pattern.*

### Hook Composition: Calling Hooks from Hooks

Custom hooks can call other hooks. This is the primary mechanism for composition:

```typescript
// Composition: useUserPermissions builds on useUser and useRole
function useUserPermissions() {
  const { user, loading } = useUser()
  const role = useRole(user?.id)

  const permissions = useMemo(() => {
    if (!user || !role) return []
    return computePermissions(user, role)
  }, [user, role])

  return { permissions, loading: loading || role === null }
}

// Composition chain: useDashboardData → useUserPermissions → useUser + useRole
function useDashboardData() {
  const { permissions, loading } = useUserPermissions()
  const { data, error } = useDashboardQuery(permissions)

  return { data, error, loading }
}
```

Rules for composition:
- Every hook in the chain must follow Rules of Hooks (same order on every render)
- Dependency chains are implicit — `useDashboardQuery` depends on `permissions`, which depends on `user` and `role`
- Stale closure in any link corrupts the entire chain
- Tests must cover each hook in isolation and combined

Common composition anti-patterns:

```typescript
// Bad: conditional hook call inside composition
function useSearch(query: string) {
  if (!query) return { results: [] }  // Early return — breaks hooks rule!
  const results = useSearchQuery(query) // Hook called conditionally!
  return { results }
}

// Good: guard inside the hook, not around the call
function useSearch(query: string) {
  const results = useSearchQuery(query) // Always called
  if (!query) return { results: [] } // Guard after hooks
  return { results }
}
```

> **Think**: Hook A calls Hook B. Hook B calls setState internally. When Hook A reads that state, is it stale?
>
> *Answer: Not if both hooks are in the same component. setState in Hook B triggers a re-render of the component, which re-runs both Hook A and Hook B. The state read by Hook A on the next render is the updated value. React guarantees that all hooks in a component see consistent state from the same render.*

### Refactoring Components into Custom Hooks

Extracting logic into custom hooks follows a pattern: identify pure-computation logic, lifecycle logic, and event handlers — then extract.

**Step 1: Identify extractable logic**

```typescript
// Before — everything in component
function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchUser(userId)
      .then(data => { if (!cancelled) setUser(data) })
      .catch(err => { if (!cancelled) setError(err) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [userId])

  const handleRetry = useCallback(() => {
    setError(null)
    setUser(null)
    // Re-trigger effect by toggling... awkward
  }, [])

  if (loading) return <Spinner />
  if (error) return <ErrorDisplay error={error} onRetry={handleRetry} />
  return <ProfileDisplay user={user} />
}
```

**Step 2: Extract into hook**

```typescript
function useUser(userId: string) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchUser(userId)
      .then(data => { if (!cancelled) setUser(data) })
      .catch(err => { if (!cancelled) setError(err) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [userId, retryCount])  // retryCount triggers refetch

  const refetch = useCallback(() => {
    setRetryCount(c => c + 1)
  }, [])

  return { user, loading, error, refetch }
}

// After — component is thin
function UserProfile({ userId }: { userId: string }) {
  const { user, loading, error, refetch } = useUser(userId)

  if (loading) return <Spinner />
  if (error) return <ErrorDisplay error={error} onRetry={refetch} />
  return <ProfileDisplay user={user} />
}
```

Guidelines:
- Extract when logic is reused across components
- Extract when logic makes a component hard to read (>50 lines of state/effect code)
- Keep render pure — the hook manages side effects; the component manages JSX
- Do not extract prematurely — one-off logic in a hook is indirection without benefit

> **Think**: A component has a single useEffect that fetches data and a handler for one button click. Should you extract into a custom hook?
>
> *Answer: Probably not. Extraction adds indirection (import, call, destructure) without reuse benefit. Wait until a second component needs the same logic. Exception: the hook makes testing easier — hooks tested with renderHook are simpler than component integration tests.*

### Testing Custom Hooks with renderHook

`@testing-library/react-hooks` provides `renderHook` for testing hooks outside components:

```typescript
import { renderHook, act } from '@testing-library/react'
import { useCounter } from './useCounter'

test('increments counter', () => {
  const { result } = renderHook(() => useCounter())

  act(() => {
    result.current.increment()
  })

  expect(result.current.count).toBe(1)
})

test('accepts initial value', () => {
  const { result } = renderHook(() => useCounter(10))

  expect(result.current.count).toBe(10)
})

test('resets counter', () => {
  const { result } = renderHook(() => useCounter(5))

  act(() => {
    result.current.increment()
    result.current.reset()
  })

  expect(result.current.count).toBe(5)
})
```

Key testing concerns:

**Mount/unmount behavior**:
```typescript
test('cleans up on unmount', () => {
  const cleanup = vi.fn()
  const { unmount } = renderHook(() => useInterval(cleanup, 1000))

  unmount()

  expect(cleanup).toHaveBeenCalled()
})
```

**Updating props**:
```typescript
test('updates when props change', () => {
  const { rerender, result } = renderHook(
    ({ id }) => useUser(id),
    { initialProps: { id: '1' } }
  )

  expect(result.current.user?.id).toBe('1')

  rerender({ id: '2' })

  expect(result.current.user?.id).toBe('2')
})
```

**Testing concurrent behavior**: React 18+ with `act` wraps state updates from concurrent features:
```typescript
test('handles concurrent state updates', async () => {
  const { result, waitForNextUpdate } = renderHook(() => useAsyncData())

  act(() => {
    result.current.fetch()
  })

  // Wait for async resolution
  await waitForNextUpdate()

  expect(result.current.data).toBeDefined()
})
```

> **Think**: A hook uses useSyncExternalStore. How does renderHook test changes from the external store?
>
> *Answer: Use act to trigger store mutation, then assert result.current reflects the change. For Zustand: `act(() => useStore.getState().update(...))`. For Redux: `act(() => store.dispatch(...))`. renderHook re-renders when the external store notifies subscribers via useSyncExternalStore.*

### Custom Hooks for React 19: use(), useOptimistic, useActionState Wrappers

React 19 hooks can be wrapped in custom hooks for ergonomic APIs:

```typescript
// Wrapping use() for promise-based data fetching
function usePromise<T>(promise: Promise<T>): T {
  return use(promise)
}

// Wrapping useActionState with typed action
function useFormSubmit<T>(
  action: (prev: T, formData: FormData) => Promise<T>,
  initial: T
): [T, (formData: FormData) => void, boolean] {
  return useActionState(action, initial)
}

// Wrapping useOptimistic with rollback
function useOptimisticUpdate<T>(
  key: string,
  initial: T,
  reducer: (state: T, optimistic: T) => T
): [T, (value: T) => void, () => void] {
  const [optimisticState, setOptimisticState] = useOptimistic(
    initial,
    (state, optimistic: T) => reducer(state, optimistic)
  )

  const rollback = useCallback(() => {
    setOptimisticState(initial)  // Revert to server-confirmed state
  }, [initial, setOptimisticState])

  return [optimisticState, setOptimisticState, rollback]
}
```

Key insight: `use()` is particularly useful inside custom hooks because it reads promises/context mid-render without useEffect:

```typescript
function useUserWithPosts(userId: string) {
  const userPromise = fetchUser(userId)
  const user = use(userPromise)
  const postsPromise = fetchPosts(user.id)
  const posts = use(postsPromise)
  return { user, posts }
}
```

> **Think**: Can a custom hook calling use() be used inside Server Components? Why or why not?
>
> *Answer: Only if the custom hook does not use client-only APIs (useState, useEffect, event handlers). use() itself works in both Server and Client Components. But if the hook wraps use() alongside any client hooks, it becomes a Client Component hook and requires 'use client' directive. Server Components can only call hooks that are entirely server-compatible.*

### Custom Hooks + Server Components: Client-Only Hooks, RSC for Server

Server Components cannot use hooks that depend on client state (useState, useEffect, useRef, event handlers). Hooks that only use `use()` (promise/context reading) are Server Component compatible:

```typescript
// Server-compatible hook: only use()
function useData<T>(promise: Promise<T>): T {
  return use(promise)
}

// NOT server-compatible: uses useState
function useLocalStorage<T>(key: string, initial: T): [T, (v: T) => void] {
  // Requires 'use client'
}

// Solution: split into server and client hooks
// useData.server.ts — Server Component compatible
// useLocalStorage.client.ts — Client Component only
```

Naming convention for clarity:
- `use*` — may be server-compatible if it only calls use()
- `use*` — client-only if it uses useState, useEffect, useRef, etc.

Document explicitly:
```typescript
/**
 * Client-only hook. Requires `'use client'` directive.
 * Reads localStorage and synchronizes across tabs.
 */
function useLocalStorage<T>(...): [T, (v: T) => void] {
  // ...
}
```

> **Think**: You have a custom hook that reads from a Zustand store (useSyncExternalStore internally) and formats the data. Can this run in a Server Component?
>
> *Answer: No. useSyncExternalStore subscribes to a mutable external store, which is inherently client-side. Server Components have no store subscriptions, no mutation, no event loop. The hook must be marked 'use client'. The data formatting logic (pure function) could be extracted to a utility function shared by both server and client.*

### Custom Hooks with External Stores: useSyncExternalStore

`useSyncExternalStore` is the bridge between React and external state (Zustand, Redux, Jotai, global caches):

```typescript
// Generic hook for subscribing to any external store
function useExternalStore<T>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => T
): T {
  return useSyncExternalStore(subscribe, getSnapshot)
}
```

Real-world usage — Zustand adapter:
```typescript
import { create } from 'zustand'

interface BearStore {
  bears: number
  increase: () => void
}

const useBearStore = create<BearStore>((set) => ({
  bears: 0,
  increase: () => set((state) => ({ bears: state.bears + 1 })),
}))

// Custom hook wrapping Zustand selector for type-safe access
function useBears(): number {
  return useBearStore((state) => state.bears)
}

// Custom hook with derived data from external store
function useBearSummary(): { total: number; label: string } {
  const bears = useBearStore((state) => state.bears)
  return useMemo(() => ({
    total: bears,
    label: `We have ${bears} bear${bears === 1 ? '' : 's'}`,
  }), [bears])
}
```

Redux adapter pattern:
```typescript
import { useSelector, useDispatch } from 'react-redux'

function useUserFromStore(userId: string): User | undefined {
  return useSelector((state: RootState) =>
    state.users.entities[userId]
  )
}
```

The key constraint: `getSnapshot` must return the same reference if data has not changed. If it creates a new object every call, React re-renders infinitely:

```typescript
// Bad: new object every render
function useBadStoreData() {
  return useSyncExternalStore(subscribe, () => ({
    value: store.getValue(),
  }))
}

// Good: memoized snapshot or primitive
function useGoodStoreData() {
  return useSyncExternalStore(subscribe, () => store.getValue())
}
```

> **Think**: A Zustand store has 50 slices. A component only needs one slice. What happens if the hook reads the entire store?
>
> *Answer: Every store change triggers re-render of the component, even changes to unrelated slices. Always use selectors to read minimal data: `const bears = useBearStore(s => s.bears)`. Zustand's `useStore` with selector only triggers re-render when the selected value changes.*

### Hook Lifecycle: Mount, Update, Unmount in Concurrent Mode

In React 18+ concurrent mode, hooks may mount and unmount multiple times before committing (StrictMode double-invoke). Custom hooks must handle this:

```typescript
function useSubscription<T>(subscribe: (value: T) => () => void, initial: T) {
  const [value, setValue] = useState(initial)

  useEffect(() => {
    // In StrictMode + concurrent, this runs twice (mount → cleanup → mount)
    // Each subscription/unsubscription pair must be idempotent
    const cleanup = subscribe((newValue) => {
      // setValue may be interrupted if a higher-priority update comes in
      // React discards the render if interrupted — no problem
      setValue(newValue)
    })
    return cleanup
  }, [subscribe])

  return value
}
```

Safe patterns for concurrent mode:

```typescript
// Pattern 1: Cleanup in effect
useEffect(() => {
  const sub = source.subscribe(handler)
  return () => sub.unsubscribe()
}, [dep])

// Pattern 2: useRef for mutable state (survives re-render, no re-subscribe)
const handlerRef = useRef<Handler>()
handlerRef.current = handler  // Always latest handler, no re-subscribe needed

useEffect(() => {
  const sub = source.subscribe((v) => handlerRef.current?.(v))
  return () => sub.unsubscribe()
}, [])  // Subscribe once, handler always fresh via ref

// Pattern 3: useSyncExternalStore (handles tearing correctly in concurrent mode)
function useExternalValue<T>(store: { getValue: () => T; subscribe: (cb: () => void) => () => void }) {
  return useSyncExternalStore(store.subscribe, store.getValue)
}
```

> **Think**: A custom hook creates a WebSocket connection in useEffect. In concurrent mode, the component mounts, the hook connects WebSocket, then a higher-priority update causes React to discard the render. What happens to the WebSocket?
>
> *Answer: React runs the cleanup function (disconnect WebSocket) on the discarded render. Then remounts and re-connects. The WebSocket sees connect → disconnect → connect sequence. The hook must handle this: clean up old connection, tolerate brief disconnect, and re-establish. This is why connection management in effects must be idempotent.*

### Avoiding Stale Closures in Custom Hooks

Stale closures occur when a callback captures a value from an older render:

```typescript
// Stale closure: onClick captures initial count forever
function useCounter() {
  const [count, setCount] = useState(0)

  const onClick = useCallback(() => {
    console.log(count)  // Always logs 0 if deps missing
  }, [])  // Bug: count missing from deps

  return { count, onClick }
}
```

Solutions:

```typescript
// Solution 1: Correct deps
function useCounter() {
  const [count, setCount] = useState(0)
  const onClick = useCallback(() => {
    console.log(count)
  }, [count])
  return { count, onClick }
}

// Solution 2: Functional update (if callback only needs to set state)
function useCounter() {
  const [count, setCount] = useState(0)
  const increment = useCallback(() => {
    setCount(c => c + 1)  // No closure over count
  }, [])
  return { count, increment }
}

// Solution 3: Ref for latest value (callback never changes)
function useCounter() {
  const [count, setCount] = useState(0)
  const countRef = useRef(count)
  countRef.current = count  // Always up-to-date

  const onClick = useCallback(() => {
    console.log(countRef.current)  // Reads latest, no re-subscribe
  }, [])

  return { count, onClick }
}

// Solution 4: useEvent (React 19 — stable callback with latest values)
// Not yet stable, but the pattern exists: callback always gets fresh values
// without appearing in deps array
```

Pattern 3 (ref) is essential for callbacks passed to external systems (subscriptions, event listeners) where you cannot change the subscription on every render.

> **Think**: A custom hook receives an onChange callback prop and calls it from an internal useEffect. Should onChange be in the useEffect deps?
>
> *Answer: Yes, if onChange is used inside the effect. Missing it causes stale closure — the effect captures the first onChange and never calls the latest. If performance is a concern (onChange changes every render), wrap onChange in a ref inside the hook: `const onChangeRef = useRef(onChange); onChangeRef.current = onChange;`. Then the effect deps can be empty, always calling the latest onChange via ref.*

### Publishing Custom Hooks as Libraries

Publishing custom hooks requires attention to typing, documentation, and versioning:

**Typing**:
```typescript
// Publish ESM + CJS. Export types explicitly.
export interface UseDebounceOptions {
  leading?: boolean
  trailing?: boolean
  maxWait?: number
}

export function useDebounce<T>(
  value: T,
  delay: number,
  options?: UseDebounceOptions
): T

// Generic hooks should infer types where possible
export function useLocalStorage<T>(
  key: string,
  initial: T
): [T, (value: T | ((prev: T) => T)) => void]
```

**Package structure**:
```
use-custom-hooks/
├── package.json          # name, version, types, exports
├── src/
│   ├── index.ts          # Re-export all hooks
│   ├── useDebounce.ts    # Single hook per file
│   ├── useLocalStorage.ts
│   └── __tests__/
│       ├── useDebounce.test.ts
│       └── useLocalStorage.test.ts
├── tsconfig.json
└── README.md
```

**Documentation per hook**:
```typescript
/**
 * Debounces a value by `delay` ms.
 *
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds
 * @param options.leading - Call on leading edge (default: false)
 * @param options.trailing - Call on trailing edge (default: true)
 *
 * @example
 * ```typescript
 * const debouncedSearch = useDebounce(searchTerm, 300)
 * ```
 */
```

**Backward compatibility rules**:
- Never change return type between major versions — tuple → object is breaking
- Adding optional parameters is non-breaking (minor)
- Removing a parameter is breaking (major)
- Renaming a hook is breaking — deprecate with JSDoc `@deprecated` for one major version before removal

**Testing requirements for published hooks**:
- Node.js + jsdom or happy-dom environment
- Tests must not depend on browser APIs without polyfill (localStorage, matchMedia)
- Coverage: mount, unmount, prop change, concurrent mode, edge cases (empty arrays, null values)
- Document peer dependencies (React 18+/React 19+)

> **Think**: Your hook uses useSyncExternalStore internally. What React version peer dependency should you set?
>
> *Answer: React 18+. useSyncExternalStore shipped in React 18. For React 17 compatibility, you would need a shim (use-sync-external-store package). In a React-19-focused library, set `"peerDependencies": { "react": "^18.0.0 || ^19.0.0" }` to support both.*

---

### Why This Matters

Custom hooks are React's primary abstraction for reusable stateful logic. Every React team builds them. Poor hook design creates stale closures, impossible-to-trace re-render cascades, and duplicated logic scattered across components. Hook composition connects smaller hooks into powerful APIs — but each link in the chain must be correct. Testing hooks with renderHook catches lifecycle bugs before they reach production. React 19's new hooks (use(), useOptimistic, useActionState) extend the custom hook pattern: wrapping these in ergonomic custom hooks is how you build team-level abstractions. Publishing hooks as libraries scales your patterns across projects — but poor typing and breaking changes destroy trust in your library. Master custom hooks to master React architecture.

---

### Common Questions

**Q: Can I call a hook conditionally? What about inside a callback?**
A: No and no. Rules of Hooks are absolute: call hooks at the top level of the component or custom hook, never inside conditions, loops, or callbacks. React relies on hook call order being identical across renders. If you need conditional behavior, move the condition inside the hook or use the hook's return value to conditionally render.

**Q: When should I extract logic into a custom hook vs keeping it in the component?**
A: Extract when: (1) the same logic appears in 2+ components, (2) the component is >50 lines of state/effect logic, (3) you need to test the logic in isolation (renderHook is simpler than component integration tests). Do not extract prematurely — one-off logic in a hook is indirection without benefit.

**Q: How do I test a hook that uses useRef for DOM access?**
A: Create a wrapper component that renders a DOM element with ref, pass the ref to the hook via initial props or a setup function. Alternatively, renderHook with a wrapper component that provides the DOM structure. Example: `renderHook(() => useMeasure(), { wrapper: MeasureWrapper })`.

**Q: What happens to custom hooks during React 19's StrictMode double-invoke?**
A: Effects run twice (mount → cleanup → mount). State is preserved between renders because the double-invoke happens during render phase before the state is committed. Custom hooks must handle: cleanup functions running twice, subscriptions being created/removed/created. If your effect is not idempotent, StrictMode exposes the bug.

**Q: Can a custom hook return JSX?**
A: Technically yes (hooks can return ReactNode). But this is an anti-pattern — hooks should return data/actions, not markup. JSX belongs in components. If you need to render something, create a component that uses the hook. The separation keeps hooks testable and components composable.

---

## Examples

### Example 1: Composing Hooks for a Collaborative Dashboard

**Problem**: Build a real-time dashboard hook that combines WebSocket subscriptions, user permissions, and data transformation. Must handle concurrent mode, reconnect on disconnect, and respect permission changes without stale data.

```typescript
interface DashboardState {
  widgets: Widget[]
  connected: boolean
  error: Error | null
}

// Hook 1: WebSocket connection (base)
function useWebSocket(url: string): {
  lastMessage: MessageEvent | null
  send: (data: unknown) => void
  connected: boolean
} {
  const [lastMessage, setLastMessage] = useState<MessageEvent | null>(null)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const messageHandlerRef = useRef<(e: MessageEvent) => void>()

  // Always update ref with latest handler — avoids re-subscribe
  messageHandlerRef.current = (e: MessageEvent) => {
    setLastMessage(e)
  }

  useEffect(() => {
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onmessage = (e) => messageHandlerRef.current?.(e)

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [url])

  const send = useCallback((data: unknown) => {
    wsRef.current?.send(JSON.stringify(data))
  }, [])

  return { lastMessage, send, connected }
}

// Hook 2: User permissions (composes on useWebSocket + data)
function useDashboardData(workspaceId: string): DashboardState {
  const { lastMessage, connected, send } = useWebSocket(
    `wss://api.example.com/workspaces/${workspaceId}`
  )

  const [widgets, setWidgets] = useState<Widget[]>([])
  const [error, setError] = useState<Error | null>(null)

  // Process incoming messages
  useEffect(() => {
    if (!lastMessage) return

    try {
      const data = JSON.parse(lastMessage.data)
      switch (data.type) {
        case 'widgets:update':
          setWidgets(data.payload)
          setError(null)
          break
        case 'widgets:error':
          setError(new Error(data.payload.message))
          break
      }
    } catch {
      setError(new Error('Failed to parse message'))
    }
  }, [lastMessage])

  // Request initial data once connected
  useEffect(() => {
    if (connected) {
      send({ type: 'widgets:subscribe', workspaceId })
    }
    return () => {
      send({ type: 'widgets:unsubscribe', workspaceId })
    }
  }, [connected, workspaceId, send])

  return { widgets, connected, error }
}

function Dashboard({ workspaceId }: { workspaceId: string }) {
  const { widgets, connected, error } = useDashboardData(workspaceId)

  if (error) return <ErrorBanner message={error.message} />
  if (!connected) return <div>Connecting...</div>
  return <WidgetGrid widgets={widgets} />
}
```

**Result**: Three-hook composition chain cleanly separates concerns. WebSocket management is reusable across other features. Permission-aware data fetching composes on top. Concurrent mode safe — each effect cleans up properly. Component stays thin.

### Example 2: Refactoring a Heavy Component into Testable Hooks

**Problem**: Filterable, searchable data table with pagination. Component is 300 lines mixing data fetching, filtering logic, pagination state, and UI. Hard to test, hard to change.

**Refactoring**:

```typescript
// Hook 1: Pagination
function usePagination<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(0)
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const pageItems = useMemo(
    () => items.slice(page * pageSize, (page + 1) * pageSize),
    [items, page, pageSize]
  )

  const nextPage = useCallback(() => {
    setPage(p => Math.min(p + 1, totalPages - 1))
  }, [totalPages])

  const prevPage = useCallback(() => {
    setPage(p => Math.max(p - 1, 0))
  }, [])

  return { page, totalPages, pageItems, nextPage, prevPage }
}

// Hook 2: Search + filter
function useSearchFilter<T>(
  items: T[],
  searchFields: (keyof T)[]
): { filtered: T[]; search: string; setSearch: (s: string) => void } {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return items
    const query = search.toLowerCase()
    return items.filter(item =>
      searchFields.some(field => {
        const val = item[field]
        return String(val).toLowerCase().includes(query)
      })
    )
  }, [items, search, searchFields])

  return { filtered, search, setSearch }
}

// Hook 3: Data fetching
function useDataTable<T>(endpoint: string) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(endpoint)
      .then(r => r.json())
      .then(d => { if (!cancelled) setData(d) })
      .catch(e => { if (!cancelled) setError(e) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [endpoint])

  return { data, loading, error }
}

// Composed component
function DataTablePage({ endpoint }: { endpoint: string }) {
  const { data, loading, error } = useDataTable<Record<string, unknown>>(endpoint)
  const { filtered, search, setSearch } = useSearchFilter(data, ['name', 'email'])
  const { page, totalPages, pageItems, nextPage, prevPage } = usePagination(filtered, 20)

  if (loading) return <Spinner />
  if (error) return <ErrorBanner error={error} />

  return (
    <div>
      <SearchInput value={search} onChange={setSearch} />
      <Table data={pageItems} />
      <Pagination page={page} total={totalPages} onNext={nextPage} onPrev={prevPage} />
    </div>
  )
}
```

**Testing** (each hook in isolation):

```typescript
// Test usePagination
test('usePagination advances pages', () => {
  const items = Array.from({ length: 50 }, (_, i) => i)
  const { result } = renderHook(() => usePagination(items, 10))

  expect(result.current.page).toBe(0)
  expect(result.current.pageItems).toHaveLength(10)

  act(() => result.current.nextPage())
  expect(result.current.page).toBe(1)
  expect(result.current.pageItems[0]).toBe(10)
})

// Test useSearchFilter
test('useSearchFilter filters by field', () => {
  const items = [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' },
  ]

  const { result } = renderHook(() => useSearchFilter(items, ['name', 'email']))

  act(() => result.current.setSearch('bob'))
  expect(result.current.filtered).toHaveLength(1)
  expect(result.current.filtered[0].id).toBe(2)
})
```

**Result**: 300-line component → 3 testable hooks + 30-line component. Each hook tested in isolation. Search/filter logic tested without DOM. Pagination boundary conditions tested. DataTablePage only composes and renders.

### Example 3: Publishing a useDebounce Hook as a Library

**Problem**: Your team uses `useDebounce` across 5 projects. Extract into a published npm package with proper typing, tests, and documentation.

```typescript
// src/useDebounce.ts
export interface UseDebounceOptions {
  leading?: boolean
  trailing?: boolean
  maxWait?: number
}

const defaultOptions: UseDebounceOptions = {
  leading: false,
  trailing: true,
}

export function useDebounce<T>(
  value: T,
  delay: number,
  options: UseDebounceOptions = {}
): T {
  const [debouncedValue, setDebouncedValue] = useState(value)
  const { leading = false, trailing = true, maxWait } = {
    ...defaultOptions,
    ...options,
  }

  // Ref for maxWait
  const maxWaitRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastCallRef = useRef(Date.now())

  useEffect(() => {
    if (leading && !trailing) {
      setDebouncedValue(value)
    }

    const timer = setTimeout(() => {
      if (trailing) {
        setDebouncedValue(value)
      }
      if (maxWaitRef.current) {
        clearTimeout(maxWaitRef.current)
        maxWaitRef.current = null
      }
    }, delay)

    // Max wait enforcement
    if (maxWait && trailing) {
      const elapsed = Date.now() - lastCallRef.current
      if (!maxWaitRef.current && elapsed >= maxWait) {
        setDebouncedValue(value)
      }
      if (!maxWaitRef.current) {
        maxWaitRef.current = setTimeout(() => {
          setDebouncedValue(value)
          maxWaitRef.current = null
        }, maxWait)
      }
    }

    lastCallRef.current = Date.now()

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay, leading, trailing, maxWait])

  return debouncedValue
}
```

Package.json:
```json
{
  "name": "@acme/use-debounce",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "lint": "eslint src/"
  }
}
```

**Result**: Published hook with typed API, dual ESM/CJS, tested across React 18/19. Teams install and use without understanding internals.

---

## Key Takeaways
- Custom hooks must follow naming (`use*`), return type conventions (tuple for 2-value state+setter, object for 3+), and parameters pattern (options object for optional params)
- Hook composition chains dependencies — stale closures in any link corrupt the entire chain
- Refactoring: identify state + effects + handlers, extract into hook, keep component thin and pure
- renderHook tests hooks in isolation: mount, update props, unmount, async behavior via act
- React 19 hooks (use(), useOptimistic, useActionState) can be wrapped in custom hooks for ergonomic team APIs
- Server Components can only use hooks restricted to use() — client hooks need `'use client'`
- useSyncExternalStore bridges React and external stores — snapshot must be referentially stable
- Concurrent mode double-invokes effects — hooks must handle mount → cleanup → mount idempotently
- Stale closure solutions: correct deps, functional updates, refs for latest values, useEvent pattern
- Published hooks need typed exports, dual CJS/ESM, peer deps, comprehensive tests, and semver discipline

## Common Misconception

**"Custom hooks re-run all their internal state when the component re-renders."**

Custom hooks do not "reset" state on re-render. State (useState) persists across renders — the hook function re-executes, but existing state is preserved until explicitly set. The component and its hooks share a single render cycle: the component calls `useCounter()`, which calls `useState(0)` — on first render, initial value is 0; on subsequent renders, useState returns the persisted state value. Each re-render calls the hook function again, recomputing useMemo, useCallback values, and evaluating effects — but state survives. This is why Rules of Hooks matter: React pairs hook calls with persisted state by call order. Breaking call order (conditional hook) breaks the pairing and corrupts state.

---

## Feynman Explain
(Explain custom hooks to a developer who knows functions and useState but has never created a custom hook. Use no jargon about composition, render lifecycle, or closures. Describe the problem: "You wrote the same data-fetching logic in 3 components." Explain how extracting it into a function that uses other hooks works. Show that the function is just a function — React tracks hook state by call order, not by the function that calls them.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain` — AI probes gaps.*

---

## Reframe
(Pause. Critique: Custom hooks are powerful but composability has a cost — debugging a chain of 5 composed hooks requires tracing through each one, and a stale closure in any link corrupts the entire chain. Server Components restrict hooks severely — do custom hooks have a future in an RSC-dominant architecture? Write your evaluation. Consider: when does composition become obfuscation, whether hooks are the right abstraction for server-compatible logic, and what alternatives (shared utilities, context, render props) compete with hooks.)

---

## Drill
Take the quiz. MCQs test hook conventions, composition patterns, testing strategies, React 19 hook wrappers, and stale closure prevention.

Run: `learn.sh quiz advanced-react-19 18-custom-hooks`
