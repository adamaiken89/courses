# Module 17: Zustand in Microfrontends — Multiple Stores, Shared State

Est. study time: 2h
Language: en

## Learning Objectives
- Design Zustand store architecture for microfrontend ecosystems with shared and isolated state domains
- Implement shared stores via Module Federation and manage cross-app subscriptions
- Build a global event bus that bridges Zustand stores across microfrontend boundaries
- Prevent store duplication, memory leaks, and version conflicts in multi-app environments

---

## Core Content

### The Microfrontend State Challenge

Microfrontends decompose frontend monoliths into independently deployable apps. Each app owns its UI, routing, and state. The challenge: microfrontends must share cross-cutting state (auth, user preferences, notifications) while keeping per-app state isolated.

Three state categories in microfrontend architectures:

| Category | Examples | Ownership | Sharing strategy |
|----------|----------|-----------|------------------|
| **Shared global** | Auth token, user profile, tenant config | Shell/host app | Exposed singleton store |
| **Per-app private** | Form drafts, local UI state, page data | Individual app | Local atomic store |
| **Cross-app coordination** | "User logged out" → clear all apps | Event bus | Pub/sub channel |

Zustand fits microfrontends naturally — each store is a standalone module with zero framework coupling. A store is just a function call: `create()`. No providers, no context, no wrapping. This makes Zustand stores shareable across app boundaries without React dependency.

> **Think**: Three microfrontends — Header (auth), Dashboard (data), Settings (preferences). Header needs user info. Dashboard needs user + data. Preferences needs user + preferences. How many stores do you create?
>
> *Answer: Three atomic stores: `useAuthStore` (shell/host, shared via Module Federation), `useDataStore` (Dashboard-private), `usePreferencesStore` (Preferences-private). Header imports only authStore. Dashboard imports authStore + dataStore. Preferences imports authStore + preferencesStore. No store contains everything.*

### Shared Store via Module Federation

Module Federation (Webpack 5 / Rspack) exposes JavaScript modules across independently built apps. A Zustand store is just a JS module — expose it as a federated remote.

#### Host App — Expose Shared Auth Store

```typescript
// host/store/authStore.ts — host app's shared auth store
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  user: { id: string; name: string; email: string } | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      login: async (email, password) => {
        const res = await api.login(email, password)
        set({ user: res.user, token: res.token })
      },
      logout: () => set({ user: null, token: null }),
    }),
    { name: 'auth-storage' }
  )
)
```

```typescript
// host/webpack.config.js (Module Federation config)
new ModuleFederationPlugin({
  name: 'host',
  exposes: {
    './authStore': './store/authStore.ts',
    './eventBus': './lib/eventBus.ts',
  },
  shared: {
    zustand: { singleton: true, requiredVersion: '^4.5.0' },
    react: { singleton: true },
  },
})
```

#### Remote App — Consume Shared Auth Store

```typescript
// remote/dashboard/src/store/useAuthStore.ts
// Re-export from federated remote — consumers see same store instance
export { useAuthStore } from 'host/authStore'

// Or wrap with lazy import for async loading
import React from 'react'

const useHostAuthStore = React.lazy(() => import('host/authStore').then(m => ({ default: m.useAuthStore })))
```

**Critical: Zustand must be a singleton.** If host and remote each bundle their own Zustand, store instances diverge — state updated in host never reaches remote.

```typescript
// webpack.config.js — enforce singleton
shared: {
  zustand: {
    singleton: true,
    requiredVersion: '^4.5.0',
    eager: false,  // load on demand
  },
}
```

> **Think**: Remote app bundles Zustand v4.5. Host app uses Zustand v5.0. Module Federation shares zustand with `singleton: true` but different versions. What happens?
>
> *Answer: Webpack picks highest version satisfying `requiredVersion`. If host requires `^4.5.0` and remote loads first — host uses remote's Zustand v4.5. If remote requires `^5.0.0` and host loads first — remote uses host's Zustand v5. Potential breaking changes if API differs. Fix: pin same version across all microfrontends, enforce via lint rule or CI check.*

### Multiple Independent Stores Per Microfrontend

Each microfrontend runs its own local stores. Local stores are private — no other app can import them. This prevents accidental coupling.

```typescript
// remote/dashboard/src/store/dataStore.ts — private to dashboard
interface DataState {
  widgets: Widget[]
  filters: FilterConfig
  loading: boolean
  fetchData: () => Promise<void>
  setFilter: (filter: FilterConfig) => void
}

export const useDataStore = create<DataState>((set) => ({
  widgets: [],
  filters: {},
  loading: false,
  fetchData: async () => {
    set({ loading: true })
    const widgets = await api.getWidgets()
    set({ widgets, loading: false })
  },
  setFilter: (filter) => set({ filters: filter }),
}))
```

```typescript
// remote/settings/src/store/preferencesStore.ts — private to settings
interface PreferencesState {
  theme: 'light' | 'dark'
  notifications: boolean
  timezone: string
  setTheme: (t: 'light' | 'dark') => void
  toggleNotifications: () => void
  setTimezone: (tz: string) => void
}

export const usePreferencesStore = create<PreferencesState>((set) => ({
  theme: 'light',
  notifications: true,
  timezone: 'UTC',
  setTheme: (theme) => set({ theme }),
  toggleNotifications: () => set((s) => ({ notifications: !s.notifications })),
  setTimezone: (timezone) => set({ timezone }),
}))
```

**Principle: shared stores in host, private stores in remotes.** No remote exposes its private stores. No host imports remote stores. Communication happens through the event bus.

> **Think**: Dashboard needs to respond when user changes preferences (theme, timezone). Preferences store is private to the settings microfrontend. How does dashboard know when preferences change?
>
> *Answer: Dashboard subscribes to host's event bus channel `preferences:changed`. Settings app publishes to the bus on preference change. Dashboard reads updated preferences from the shared store (if host exposes it) or from the event payload. Dashboard never directly imports settings' private store.*

### Global Event Bus for Microfrontend Coordination

Event bus bridges stores across app boundaries. Stores publish events; other stores subscribe. No direct store-to-store imports.

```typescript
// host/lib/eventBus.ts — shared event bus
type EventHandler = (payload: any) => void

interface BusEvents {
  'auth:login': { user: User; token: string }
  'auth:logout': void
  'preferences:changed': Partial<PreferencesState>
  'data:refresh': { reason: string }
  'notification:show': { message: string; type: 'info' | 'error' }
}

class EventBus {
  private handlers = new Map<string, Set<EventHandler>>()

  on<K extends keyof BusEvents>(event: K, handler: (payload: BusEvents[K]) => void) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set())
    this.handlers.get(event)!.add(handler)
    return () => this.handlers.get(event)?.delete(handler)  // unsubscribe
  }

  emit<K extends keyof BusEvents>(event: K, payload: BusEvents[K]) {
    this.handlers.get(event)?.forEach((handler) => handler(payload))
  }
}

export const bus = new EventBus()
```

**Integrate event bus with Zustand stores:**

```typescript
// host/store/authStore.ts — emit events on state change
import { bus } from '../lib/eventBus'

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      login: async (email, password) => {
        const { user, token } = await api.login(email, password)
        set({ user, token })
        bus.emit('auth:login', { user, token })
      },
      logout: () => {
        set({ user: null, token: null })
        bus.emit('auth:logout', undefined)
      },
    }),
    { name: 'auth-storage' }
  )
)
```

```typescript
// remote/dashboard/src/hooks/useAuthAware.ts — dashboard subscribes to auth events
import { useEffect } from 'react'
import { bus } from 'host/eventBus'
import { useDataStore } from '../store/dataStore'

export function useAuthAware() {
  useEffect(() => {
    const unsubLogout = bus.on('auth:logout', () => {
      // Clear dashboard data on logout
      useDataStore.getState().setFilter({})
    })

    const unsubLogin = bus.on('auth:login', () => {
      useDataStore.getState().fetchData()
    })

    return () => {
      unsubLogout()
      unsubLogin()
    }
  }, [])
}
```

```typescript
// remote/settings/src/hooks/usePublishPreferences.ts — settings publishes changes
import { usePreferencesStore } from '../store/preferencesStore'
import { bus } from 'host/eventBus'

// Subscribe to preference store changes and publish to bus
usePreferencesStore.subscribe((state, prev) => {
  const changed: Record<string, any> = {}
  if (state.theme !== prev.theme) changed.theme = state.theme
  if (state.notifications !== prev.notifications) changed.notifications = state.notifications
  if (state.timezone !== prev.timezone) changed.timezone = state.timezone

  if (Object.keys(changed).length > 0) {
    bus.emit('preferences:changed', changed)
  }
})
```

**Event bus vs direct store import:**

| Aspect | Event Bus | Direct Store Import |
|--------|-----------|-------------------|
| Coupling | Loose — app publishes, others may listen | Tight — importing app depends on remote's module path |
| Version compatibility | Payload schema can version independently | Store API contract is hard-enforced |
| Circular deps | Impossible | Possible if remotes import each other's stores |
| Debugging | Emitted events visible in bus middleware | State changes hidden in individual stores |
| Performance | Serialized payload — no subscription overhead | Direct subscription — runs on every store change |

> **Think**: Three remotes each import `host/authStore` directly. Auth store is updated. How many selector evaluations occur?
>
> *Answer: All subscribers in all three remotes run their selectors. Module Federation ensures the store is a singleton — one store, one subscriber list. Every `useAuthStore(selector)` call registers with the same store instance. Single state update → all selectors evaluate. Event bus alternative: auth publishes `auth:login`, remotes read fresh token from shared store only when they need it, not on every change.*

### Version Compatibility Across App Versions

Microfrontends deploy independently. Remote A may be on v1, Remote B on v2. The shared store must remain backward compatible.

**Strategy 1: Payload schema with version field**

```typescript
// host/store/sharedStore.ts — versioned state
interface SharedState {
  _version: number
  user: { id: string; name: string } | null
  // v2 additions
  roles?: string[]
  permissions?: string[]
}

export const useSharedStore = create<SharedState>((set) => ({
  _version: 2,
  user: null,
  roles: [],
  permissions: [],
}))
```

Remote on v1 reads only `user`. Remote on v2 reads `user` + `roles` + `permissions`.

**Strategy 2: Adapter layer for store consumption**

```typescript
// remote/legacy-dashboard/src/adapters/authAdapter.ts
// Bridge between host store (v2) and legacy dashboard (expects v1 shape)
import { useAuthStore } from 'host/authStore'

export function useLegacyAuth() {
  const auth = useAuthStore()
  // Map v2 store to v1 expected shape
  return {
    user: auth.user,
    isLoggedIn: auth.user !== null,
    // v1 expected a string token; v2 stores token in nested object
    token: typeof auth.token === 'string' ? auth.token : auth.token?.accessToken,
  }
}
```

**Strategy 3: Feature-flag store fields behind capabilities**

```typescript
// host/store/capabilities.ts
export const capabilities = {
  roles: '__cap_roles' in document.documentElement.dataset,
  permissions: 'permissionsStore' in (window as any).__FEDERATION__,
}

// Component
function UserBadge() {
  const user = useAuthStore((s) => s.user)
  const roles = capabilities.roles ? useAuthStore((s) => s.roles) : []
  // Always renders. roles array empty on older remotes that lack capability.
}
```

> **Think**: You deploy host with shared auth store v3. Remote X (v1) reads `user.name`. Remote Y (v2) reads `user.name` + `user.avatar`. Host v3 renames `user.name` to `user.displayName`. What breaks?
>
> *Answer: Both remotes break. Remote X expects `.name`. Remote Y expects `.name`. Host renamed field → undefined on both. Fix: never remove or rename fields in shared store. Only add new fields. Deprecate old fields with getter: `get name() { return this.displayName }` for migration window. Use `_version` + adapter pattern to support multiple schema versions simultaneously.*

### React Context Isolation — Own Store Instance Per Microfrontend

Each microfrontend runs in its own React tree. Without isolation, two microfrontends mounting the same store instance share state accidentally.

**Problem:** Both Dashboard and Settings render a `<UserButton>` component that uses `useAuthStore`. If both mount in the same React tree (e.g., shell's layout), they share the same store instance — correct. But if Dashboard renders its own `<UserButton>` internally *and* shell renders `<UserButton>`, both use the same singleton store — still correct because auth is truly global.

The isolation problem appears when microfrontends need *separate instances* of the same store. Example: two dashboard widgets that manage their own independent state but use the same store shape.

```typescript
// host/components/WidgetContainer.tsx
import { createStore } from 'zustand/vanilla'
import { useStore } from 'zustand'
import React from 'react'

interface WidgetState {
  data: unknown[]
  loading: boolean
  error: string | null
  fetchData: () => Promise<void>
}

// Each widget instance gets its own vanilla store
export function WidgetContainer({ widgetId }: { widgetId: string }) {
  const storeRef = React.useRef<ReturnType<typeof createStore<WidgetState>>>()

  if (!storeRef.current) {
    storeRef.current = createStore<WidgetState>((set) => ({
      data: [],
      loading: false,
      error: null,
      fetchData: async () => {
        set({ loading: true, error: null })
        try {
          const data = await api.getWidgetData(widgetId)
          set({ data, loading: false })
        } catch (e) {
          set({ error: (e as Error).message, loading: false })
        }
      },
    }))
  }

  const store = storeRef.current
  const data = useStore(store, (s) => s.data)
  const loading = useStore(store, (s) => s.loading)
  const error = useStore(store, (s) => s.error)
  const fetchData = useStore(store, (s) => s.fetchData)

  React.useEffect(() => { fetchData() }, [fetchData, widgetId])

  if (loading) return <Spinner />
  if (error) return <Error message={error} />
  return <WidgetDisplay data={data} />
}
```

**Shared context for host-provided stores:**

```typescript
// host/components/StoreProvider.tsx
import React, { createContext, useContext } from 'react'
import { useAuthStore } from '../store/authStore'

type AuthStore = ReturnType<typeof useAuthStore>

const AuthStoreContext = createContext<AuthStore | null>(null)

export function AuthStoreProvider({ children }: { children: React.ReactNode }) {
  // Derived store API — same shape but could be scoped
  const auth = useAuthStore()
  return (
    <AuthStoreContext.Provider value={auth}>
      {children}
    </AuthStoreContext.Provider>
  )
}

export function useScopedAuth() {
  const ctx = useContext(AuthStoreContext)
  if (!ctx) {
    // Fallback to direct store access if outside provider
    return useAuthStore()
  }
  return ctx
}
```

**When to use context isolation vs singleton:**

| Scenario | Pattern | Why |
|----------|---------|-----|
| Global auth, tenant config | Singleton exposed via Federation | One user, one session |
| Per-widget private data | Context-isolated vanilla store each instance | Each widget independent |
| Microfrontend-scoped preferences | Context with local store | Preferences scoped to one app |
| Cross-cutting analytics | Singleton + event bus | Collect events from all apps |

> **Think**: Two widgets both use `WidgetContainer`. Widget A fetches data for 'widget-1', Widget B fetches for 'widget-2'. If they shared a singleton store, what happens when 'widget-2' loads data?
>
> *Answer: Widget A re-renders with Widget B's data. Singleton store holds one `data` array. Both widgets read the same value. Widget A renders 'widget-2' data until its own fetch completes and overwrites. Context isolation: each `useRef`-based vanilla store is independent. No cross-widget data leakage.*

### Cross-App State Sync — Subscribing Across App Boundaries

Microfrontends that subscribe to shared stores must handle lifecycle edges:

| Scenario | Problem | Solution |
|----------|---------|----------|
| Remote mounts after store already initialized | Misses current state | Read state synchronously on mount: `useAuthStore.getState()` |
| Store updated while remote is unmounted | Queued updates cause stale reads | Check subscription still valid before action dispatch |
| Multiple remotes subscribe to same store | All re-render on every change | Batch state changes, use selectors that return primitives |
| Remote unmounts without unsubscribing | Memory leak — stale closure references | Auto-cleanup via Zustand's `unsubscribe` return value |

**Safe subscription pattern:**

```typescript
// shared/lib/useCrossAppStore.ts
import { useEffect, useSyncExternalStore } from 'react'
import type { StoreApi } from 'zustand/vanilla'

export function useCrossAppStore<T>(
  store: StoreApi<T>,
  selector: (state: T) => any = (s: any) => s
) {
  return useSyncExternalStore(
    (onStoreChange) => {
      const unsub = store.subscribe(onStoreChange)
      return unsub  // React 18+ cleanup on unmount
    },
    () => selector(store.getState()),
    () => selector(store.getState())  // SSR: same as client
  )
}
```

```typescript
// remote/dashboard/components/UserBadge.tsx
import { useAuthStore } from 'host/authStore'
import { useCrossAppStore } from 'shared/lib/useCrossAppStore'

export function UserBadge() {
  // Safe cross-app subscription — auto-cleanup on unmount
  const user = useCrossAppStore(useAuthStore, (s) => s.user)

  if (!user) return <LoginButton />
  return <span>{user.name}</span>
}
```

**Sync strategy: poll vs push vs event-driven:**

| Strategy | Latency | Bandwidth | Complexity | Use case |
|----------|---------|-----------|------------|----------|
| Poll (setInterval) | Configurable | High — runs regardless of changes | Low | Non-critical, rarely changed data |
| Zustand subscribe (push) | Instant | Low — only on change | Medium | Cross-app store subscriptions |
| Event bus (event-driven) | Instant | Low — only on relevant event | Medium | Coordination without store import |
| BroadcastChannel API | ~10ms | Low — cross-tab | High | Multi-tab microfrontend shell |

> **Think**: Host exposes auth store. Remote subscribes with `useAuthStore.subscribe()`. Remote is lazy-loaded, mounted, used, then unmounted. Subscriber function holds closure reference to remote's component state. What happens to the subscription?
>
> *Answer: Memory leak. Zustand's subscribe returns an `unsubscribe` function. If remote never calls it on unmount, the subscriber closure persists in host's subscriber list. Remote's component state cannot be garbage collected. Fix: call `unsubscribe()` in `useEffect` cleanup. Or use `useSyncExternalStore` which handles cleanup automatically.*

### Performance — Preventing Store Duplication and Memory Leaks

**Store duplication:** Two remotes each bundle Zustand → two store instances → state divergence. Fix: `shared: { zustand: { singleton: true } }` in Module Federation config.

**Memory leak from stale subscriptions:** Subscribe in remote, forget to unsubscribe on unmount.

```typescript
// ANTI-PATTERN — memory leak
export function UserBadge() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    useAuthStore.subscribe((state) => {
      setUser(state.user)  // closure never released
    })
    // No cleanup!
  }, [])
}
```

```typescript
// CORRECT — cleanup on unmount
export function UserBadge() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    const unsub = useAuthStore.subscribe((state) => {
      setUser(state.user)
    })
    return () => unsub()  // cleanup on unmount
  }, [])
}
```

**Unnecessary re-renders across app boundaries:**

```typescript
// ANTI-PATTERN — re-renders remote on ANY auth change
const user = useAuthStore()  // subscribes to entire store

// BETTER — subscribe only to needed field
const user = useAuthStore((s) => s.user)

// BEST — use primitive selector
const userName = useAuthStore((s) => s.user?.name)
```

**Lazy store initialization — avoid creating stores before first use:**

```typescript
// host/store/lazyStores.ts
const storeRegistry = new Map<string, StoreApi<any>>()

export function getWidgetStore(widgetId: string) {
  if (!storeRegistry.has(widgetId)) {
    const store = createStore<WidgetState>((set) => ({
      data: [],
      loading: false,
      error: null,
      fetchData: async () => { /* ... */ },
    }))
    storeRegistry.set(widgetId, store)
  }
  return storeRegistry.get(widgetId)!
}
```

**Memory leak detection:**

```typescript
// devtools/checkLeaks.ts
if (process.env.NODE_ENV === 'development') {
  const originalSubscribe = useAuthStore.subscribe.bind(useAuthStore)
  let subscriberCount = 0

  useAuthStore.subscribe = ((listener: any) => {
    subscriberCount++
    const unsub = originalSubscribe(listener)
    return () => {
      subscriberCount--
      unsub()
    }
  }) as any

  setInterval(() => {
    if (subscriberCount > EXPECTED_MAX) {
      console.warn(`Auth store has ${subscriberCount} subscribers — possible leak`)
    }
  }, 30000)
}
```

> **Think**: Host exposes `useAuthStore` as singleton. 4 remotes each subscribe. Each remote mounts/unmounts multiple times over session. After 30 minutes, host's auth store has 200 subscribers. What is the likely cause?
>
> *Answer: Each remote mount creates a new subscriber that never gets cleaned up. After 50 mount/unmount cycles × 4 remotes = 200 leaked subscribers. Each subscriber closure holds reference to remote's component tree — prevents GC of entire remote app if unmounted. Fix: ensure every `subscribe()` call has matching `unsubscribe()` in `useEffect` cleanup.*

### Testing Microfrontend Stores — Isolated Test Environments

Each microfrontend's stores must be testable in isolation. Shared stores from host are mocked or stubbed.

```typescript
// remote/dashboard/__tests__/dataStore.test.ts
import { act, renderHook } from '@testing-library/react'
import { create } from 'zustand/vanilla'

// Mock host's shared store
const mockAuthStore = create(() => ({
  user: { id: '1', name: 'Test', email: 'test@x.com' },
  token: 'mock-token',
  login: vi.fn(),
  logout: vi.fn(),
}))

vi.mock('host/authStore', () => ({
  useAuthStore: mockAuthStore,
}))

// Test dashboard's private store
import { useDataStore } from '../store/dataStore'

describe('DataStore (isolated)', () => {
  beforeEach(() => {
    useDataStore.setState({ widgets: [], loading: false })
  })

  it('sets loading true when fetchData starts', async () => {
    const { result } = renderHook(() => useDataStore())

    const fetchPromise = result.current.fetchData()

    expect(useDataStore.getState().loading).toBe(true)

    await act(async () => await fetchPromise)

    expect(useDataStore.getState().loading).toBe(false)
  })

  it('stores fetched widgets', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve([{ id: '1', name: 'Revenue' }]),
    })

    await act(async () => {
      await useDataStore.getState().fetchData()
    })

    expect(useDataStore.getState().widgets).toHaveLength(1)
    expect(useDataStore.getState().widgets[0].name).toBe('Revenue')
  })
})
```

**Testing cross-app event bus integration:**

```typescript
// remote/dashboard/__tests__/authAware.test.ts
import { renderHook } from '@testing-library/react'
import { bus } from 'host/eventBus'
import { useDataStore } from '../store/dataStore'

describe('Auth-aware hooks', () => {
  beforeEach(() => {
    useDataStore.setState({ widgets: [], loading: false })
  })

  it('clears filters on logout', () => {
    useDataStore.getState().setFilter({ category: 'sales' })

    bus.emit('auth:logout', undefined)

    expect(useDataStore.getState().filters).toEqual({})
  })

  it('fetches data on login', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve([{ id: '1', name: 'Revenue' }]),
    })

    bus.emit('auth:login', {
      user: { id: '1', name: 'Test', email: 'test@x.com' },
      token: 'mock',
    })

    // fetchData is async — wait for flush
    await vi.waitFor(() => {
      expect(useDataStore.getState().widgets.length).toBeGreaterThan(0)
    })
  })
})
```

**Testing store isolation (context-based per-instance stores):**

```typescript
// __tests__/widgetContainer.test.tsx
import { render, screen } from '@testing-library/react'
import { WidgetContainer } from '../components/WidgetContainer'

describe('WidgetContainer isolation', () => {
  it('two widget instances maintain separate state', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve([{ id: 'w1' }]) })
      .mockResolvedValueOnce({ json: () => Promise.resolve([{ id: 'w2' }]) })

    render(
      <>
        <WidgetContainer widgetId="widget-1" />
        <WidgetContainer widgetId="widget-2" />
      </>
    )

    await vi.waitFor(() => {
      expect(screen.getByTestId('widget-1')).toHaveTextContent('w1')
      expect(screen.getByTestId('widget-2')).toHaveTextContent('w2')
    })
  })
})
```

> **Think**: Dashboard test mocks `host/authStore` as a plain zustand store. But the real `host/authStore` uses `persist` middleware with `localStorage`. What test behavior differs?
>
> *Answer: Mock store has no persist — state resets on each test. Real store persists to localStorage, which persists across tests. Mock never writes to localStorage — cleaner test isolation but misses bugs related to hydration timing. Fix: test both — mock for unit tests, integration test against real store with `beforeEach(() => localStorage.clear())`.*

### Example: Dashboard with Independent Widgets Sharing User/Auth Store

**Architecture:**

```
host (shell)
├── exposes: authStore, eventBus
├── syncs auth state to localStorage (persist)
└── renders shell layout

remote/dashboard
├── consumes: authStore (from host)
├── owns: dataStore (private)
├── widgets: RevenueWidget, UsersWidget, LogsWidget
└── each widget: own vanilla store instance (isolation)

remote/settings
├── consumes: authStore (from host)
├── owns: preferencesStore (private)
├── publishes: preferences:changed via eventBus
└── reads: authStore for user info

remote/notifications
├── consumes: authStore (from host)
├── subscribes: eventBus (auth:login, auth:logout, preferences:changed)
└── owns: notificationStore (private)
```

```typescript
// host/store/authStore.ts — singleton shared store
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { bus } from '../lib/eventBus'

interface AuthState {
  user: { id: string; name: string; email: string; avatar?: string } | null
  token: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  updateProfile: (data: Partial<AuthState['user']>) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (email, password) => {
        const res = await api.login(email, password)
        set({
          user: res.user,
          token: res.token,
          isAuthenticated: true,
        })
        bus.emit('auth:login', { user: res.user, token: res.token })
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false })
        bus.emit('auth:logout', undefined)
      },

      updateProfile: (data) => {
        const current = get().user
        if (current) {
          set({ user: { ...current, ...data } })
        }
      },
    }),
    {
      name: 'host-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
```

```typescript
// remote/dashboard/store/dataStore.ts — private per-app store
import { create } from 'zustand'

interface DashboardDataState {
  widgets: WidgetConfig[]
  metrics: Record<string, Metric>
  dateRange: { start: string; end: string }
  loading: boolean
  error: string | null
  fetchMetrics: () => Promise<void>
  setDateRange: (range: { start: string; end: string }) => void
}

export const useDashboardStore = create<DashboardDataState>((set, get) => ({
  widgets: [],
  metrics: {},
  dateRange: { start: '', end: '' },
  loading: false,
  error: null,

  fetchMetrics: async () => {
    set({ loading: true, error: null })
    try {
      const { user } = useAuthStore.getState()  // read shared auth
      const { dateRange } = get()
      const metrics = await api.getDashboardMetrics(user!.id, dateRange)
      set({ metrics, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  setDateRange: (dateRange) => {
    set({ dateRange })
    get().fetchMetrics()
  },
}))
```

```typescript
// remote/dashboard/components/WidgetBase.tsx — isolated per-instance store
import React from 'react'
import { createStore } from 'zustand/vanilla'
import { useStore } from 'zustand'

interface WidgetState {
  data: any[]
  loading: boolean
  error: string | null
  expanded: boolean
  fetchData: () => Promise<void>
  toggleExpand: () => void
}

interface WidgetConfig {
  id: string
  title: string
  type: 'revenue' | 'users' | 'logs'
  apiEndpoint: string
}

export function WidgetBase({ config }: { config: WidgetConfig }) {
  const storeRef = React.useRef<ReturnType<typeof createStore<WidgetState>>>()

  if (!storeRef.current) {
    storeRef.current = createStore<WidgetState>((set, get) => ({
      data: [],
      loading: false,
      error: null,
      expanded: false,
      fetchData: async () => {
        set({ loading: true, error: null })
        try {
          const res = await fetch(config.apiEndpoint)
          const data = await res.json()
          set({ data, loading: false })
        } catch (e) {
          set({ error: (e as Error).message, loading: false })
        }
      },
      toggleExpand: () => set((s) => ({ expanded: !s.expanded })),
    }))
  }

  const store = storeRef.current
  const data = useStore(store, (s) => s.data)
  const loading = useStore(store, (s) => s.loading)
  const expanded = useStore(store, (s) => s.expanded)
  const fetchData = useStore(store, (s) => s.fetchData)
  const toggleExpand = useStore(store, (s) => s.toggleExpand)

  React.useEffect(() => { fetchData() }, [fetchData])

  return (
    <div data-testid={`widget-${config.id}`}>
      <h3 onClick={toggleExpand}>{config.title}</h3>
      {loading && <Spinner />}
      {expanded && <WidgetContent data={data} type={config.type} />}
    </div>
  )
}
```

```typescript
// remote/dashboard/components/Dashboard.tsx — composes all widgets
import { useDashboardStore } from '../store/dataStore'
import { WidgetBase } from './WidgetBase'

export function Dashboard() {
  const widgets = useDashboardStore((s) => s.widgets)
  const user = useAuthStore((s) => s.user)  // from host

  return (
    <div>
      <h1>Welcome, {user?.name}</h1>
      <DateRangePicker />
      <div className="widget-grid">
        {widgets.map((w) => (
          <WidgetBase key={w.id} config={w} />
        ))}
      </div>
    </div>
  )
}
```

**Cross-app event flow — logout scenario:**

```
User clicks Logout in Header (host)
→ authStore.logout()
  → set({ user: null, token: null })
  → bus.emit('auth:logout')

remote/dashboard:
  useAuthAware hook: bus.on('auth:logout')
    → useDashboardStore.getState().setDateRange({ start: '', end: '' })

remote/settings:
  useAuthAware hook: bus.on('auth:logout')
    → usePreferencesStore.getState().setTheme('light')

remote/notifications:
  subscription: useAuthStore.subscribe((state) => {
    if (!state.isAuthenticated) {
      clearNotifications()
    }
  })

All three remotes react to single logout event. Each uses its own mechanism
(event bus listener vs store subscription) appropriate to its coupling level.
```

> **Think**: Dashboard calls `useAuthStore.getState()` inside `fetchMetrics`. Does this create a subscription?
>
> *Answer: No. `getState()` reads current state synchronously without subscribing. The component does not re-render when auth changes. This is intentional — dashboard only reads auth at fetch time, not reactively. If dashboard needs to react to auth changes (e.g., logout clears metrics), it uses event bus listener, not direct store subscription.*

---

### Why This Matters

Zustand in microfrontends solves the fundamental tension between shared global state and per-app autonomy. Without this architecture, teams either duplicate stores (auth state desync, multiple login tokens) or force all apps into one monolithic store (re-deploy all apps on any state change). Zustand's store-as-module pattern is uniquely suited to microfrontends because stores are framework-agnostic JS modules that can be exposed, shared, and isolated without React context or provider wrapping.

Wrong architecture: each microfrontend bundles its own auth store → user logs in on App A but App B still shows guest view. Right architecture: singleton auth store exposed via Module Federation, private per-app stores for local state, event bus for coordination. This pattern keeps deployment independence while maintaining consistent user experience across apps. Without version compatibility strategy, a host store rename breaks every remote silently.

---

### Common Questions

**Q: Why use Module Federation for store sharing instead of window.__SHARED_STATE__?**
A: `window.__SHARED_STATE__` is untyped, has no reactivity, and creates global namespace pollution. Module Federation gives TypeScript typing, tree-shaking, and version management. Zustand stores exposed as federated modules retain all Zustand features (selectors, subscriptions, middleware). Global variable is a quick hack; Module Federation is production architecture.

**Q: Can two remotes write to the same shared store?**
A: Yes, but design carefully. Both Settings and Dashboard can call `useAuthStore.getState().login()`. This is correct for shared actions. For shared data, decide which remote owns each field. Convention: host owns auth/user, each remote may read but only their own fields should they write. Use event bus for cross-app writes rather than direct store mutation — event bus gives audit trail and version compatibility layer.

**Q: What happens when a remote cannot load the host's store (network failure)?**
A: Implement fallback. Host exposes store as async remote — if resolution fails, remote uses a local fallback store (default guest state). Module Federation supports `fallback` config. Monitor with error boundary: if host store fails to load, show degraded UI, retry on reconnect.

**Q: How do you debug a shared store when state appears wrong in one remote but correct in another?**
A: Three possibilities: (1) Zustand singleton failed — each remote loaded its own Zustand instance and stores diverged. Check `__FEDERATION__` shared module graph. (2) Version mismatch — remote reads field name that does not exist in host's store schema. Check adapter layer. (3) React render timing — remote mounted before store hydrated from localStorage. Add `onRehydrateStorage` callback before rendering.

**Q: Is Zustand better than Redux Toolkit for microfrontends?**
A: Zustand's zero-provider architecture is natural for microfrontends — store is a module import, not a Provider wrapper. Redux Toolkit requires a single `<Provider>` at the shell root and one store per app, which complicates module federation (shared store vs separate stores). Zustand also has smaller bundle (1.1kB vs 11kB), which matters when multiple remotes load the shared store module.

---

## Examples

### Example 1: E-Commerce Microfrontend Suite

**Problem**: E-commerce platform with 3 microfrontends (ProductListing, Cart, Checkout) + shell (Auth, Nav). Cart and Checkout need shared cart state. ProductListing needs auth for personalized recommendations. Each team deploys independently.

**State architecture:**

| Microfrontend | Stores | Shared via | Notes |
|---------------|--------|-----------|-------|
| Shell (host) | `useAuthStore` | Module Federation | Singleton, persist to localStorage |
| Shell (host) | `useEventBus` | Module Federation | In-memory, no persist |
| ProductListing (remote) | `useProductStore` (private) | None | Local data fetching, pagination |
| Cart (remote) | `useCartStore` (private) | None (but reads shared) | Reads auth for user ID |
| Checkout (remote) | `useCheckoutStore` (private) | None | Reads cart from event bus payload |

**Shared auth store exposed by host:**

```typescript
// host/store/authStore.ts
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({ /* standard auth implementation */ }),
    { name: 'ecommerce-auth' }
  )
)
```

**Cart reads auth but owns its state:**

```typescript
// remote/cart/store/cartStore.ts
export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  addItem: (product) => {
    const user = useAuthStore.getState().user  // read, not subscribe
    if (!user) throw new Error('Must be logged in')
    set((s) => ({ items: [...s.items, { ...product, userId: user.id }] }))
  },
}))
```

**Checkout receives cart snapshot via event bus:**

```typescript
// remote/checkout/hooks/useCartSync.ts
import { bus } from 'host/eventBus'
import { useCheckoutStore } from '../store/checkoutStore'

export function useCartSync() {
  useEffect(() => {
    const unsub = bus.on('cart:checkout', (payload) => {
      useCheckoutStore.getState().setCartItems(payload.items)
    })
    return unsub
  }, [])

  const initiateCheckout = () => {
    const items = useCartStore.getState().items
    // Navigate to checkout route
    bus.emit('cart:checkout', { items })
  }

  return { initiateCheckout }
}
```

**Deployment independence:**

```
Version 1:
  Shell: v2.1 (auth store has user.name)
  Cart: v1.3 (reads user.name — works)
  Checkout: v1.0 (reads user.name — works)

Version 2 (host adds user.avatar):
  Shell: v2.2 (auth store adds avatar field)
  Cart: v1.4 (reads user.name + user.avatar — works, adapter handles optional)
  Checkout: v1.1 (reads user.name — works, ignores avatar)

No coordinated deploy needed. Old remotes work with new host store.
```

### Example 2: Multi-Tab Microfrontend with BroadcastChannel

**Problem**: Microfrontend shell runs in separate browser tabs. User logs in on Tab 1 → Tab 2 should reflect authenticated state without full reload.

```typescript
// host/lib/crossTabSync.ts
import { useAuthStore } from '../store/authStore'

const channel = new BroadcastChannel('auth-sync')

// Emit state changes to other tabs
useAuthStore.subscribe((state) => {
  if (state.token) {
    channel.postMessage({
      type: 'AUTH_CHANGED',
      payload: { user: state.user, token: state.token },
    })
  }
})

// Listen for changes from other tabs
channel.onmessage = (event) => {
  if (event.data.type === 'AUTH_CHANGED') {
    useAuthStore.setState({
      user: event.data.payload.user,
      token: event.data.payload.token,
      isAuthenticated: true,
    })
  }
}
```

**Cross-tab sync ensures microfrontends in different tabs share single auth session.** Combine with Zustand's `persist` + `storage` option for multi-tab synchronization:

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({ /* ... */ }),
    {
      name: 'auth-storage',
      // BroadcastChannel-like sync built into persist
      // Zustand v5+ supports multi-tab sync
    }
  )
)
```

### Example 3: Gradual Migration from Monolith to Microfrontends

**Problem**: Monolithic app with 50 Zustand stores. Team migrates to microfrontends incrementally — one domain at a time. Existing stores must work alongside new federated stores during migration.

**Migration strategy:**

```
Phase 1: Extract auth into host shell
  ├── Move useAuthStore to host app
  ├── Expose via Module Federation
  ├── Monolith remaps import: './store/authStore' → 'host/authStore'
  └── Monolith continues owning other stores

Phase 2: Extract dashboard as first remote
  ├── Create remote/dashboard with its own useDashboardStore
  ├── Dashboard imports authStore from host
  ├── Host renders Dashboard via Federation
  └── Monolith's dashboard routes redirect to remote

Phase 3: Repeat for each domain
  └── Each extraction: move private stores to remote, keep shared stores in host
```

```typescript
// Phase 1 bridge — monolith app
// Before migration:
// import { useAuthStore } from './store/authStore'

// During migration — redirect to host:
export { useAuthStore } from 'host/authStore'

// Monolith's local auth store removed
// All existing consumer imports still work — only import path changed
```

**Bridge pattern ensures zero code changes in consumers during migration.** Store API identical. Only module resolution changes.

> **Think**: Monolith's `useAuthStore` also controlled `sidebarCollapsed` — a UI concern. Host's auth store does not include sidebar state. How do you handle this during migration?
>
> *Answer: Extract UI state into separate store before migration. Split monolith store into `authStore` (moves to host) + `uiStore` (stays in monolith). Consumers update imports accordingly. Migration clean-up: after all consumers migrate to host's authStore, delete monolith's authStore entirely.*

---

## Key Takeaways
- Microfrontend state has three categories: shared global (exposed singleton), per-app private (local atomic stores), cross-app coordination (event bus)
- Module Federation exposes Zustand stores as federated remotes — stores are just JS modules
- Zustand must be a singleton across microfrontends; use `shared: { zustand: { singleton: true } }`
- Event bus decouples microfrontends — stores publish events, other apps subscribe without direct imports
- Version compatibility: never remove/rename shared store fields, use adapters for legacy consumers
- Context isolation: use `createStore` from `zustand/vanilla` with `useRef` for per-instance stores
- Cross-app subscriptions must cleanup on unmount or cause memory leaks
- Use `useSyncExternalStore` for safe cross-app store subscriptions with automatic cleanup
- Store duplication, stale subscriptions, and state divergence are the three main failure modes
- Testing: mock shared stores, test private stores in isolation, verify event bus integrations
- Gradual migration: bridge pattern redirects imports without consumer code changes

## Common Misconception

**"Microfrontends should each have their own copy of every store — that's what independent deployment means."**

Independent deployment means independent build and release cycles, not independent state. Auth state must be shared — each microfrontend holding its own auth token creates UX disasters (user logs in on one app, second app shows unauthorized). Zustand singletons via Module Federation give each microfrontend its own build artifact while sharing a single store instance at runtime.

The confusion stems from equating "independently deployable" with "independently stateful." Shared global stores (auth, tenant config, feature flags) must be singletons. Private local stores (form state, page data, UI toggles) belong in each microfrontend. The distinction is domain coupling, not deployment boundary.

---

## Feynman Explain
(Explain microfrontend state sharing with Zustand to a developer who knows Zustand in single-page apps but has never touched Module Federation. Analogy: separate kitchens sharing one refrigerator. Each kitchen (microfrontend) has its own cabinets and counter (private stores) but opens the same refrigerator (shared auth store). When someone takes milk from the refrigerator, all kitchens see the milk is gone — singleton state. Each kitchen's cabinets are private — you cannot access another kitchen's spice rack (no direct imports of private stores). The event bus is the kitchen phone — you call "hey, I'm baking cookies" and other kitchens respond without needing to see your recipe.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain zustand-state-management` — AI probes gaps.*

---

## Reframe
(Pause. Critique: Event bus adds indirection — where did that state change originate? Debugging becomes following breadcrumbs across multiple apps. Direct store imports are simpler: one subscriber, one traceable call stack. Is the event bus worth the debugging cost for teams with 2-3 remotes? Also: Module Federation locks you into Webpack 5. What if you use Vite or Turbopack? Consider also: microfrontends via iframes — each iframe has its own JS context. Zustand stores cannot be shared across iframes without postMessage. When does the singleton+event-bus pattern break down for iframe-based microfrontends? Write your evaluation — weigh architectural purity against debugging simplicity. When is direct store import the better choice despite tight coupling?)

---

## Drill
Take the quiz. MCQs test store architecture for microfrontends, Module Federation configuration, event bus patterns, version compatibility, context isolation, cross-app subscription safety, and migration strategy.

Run: `learn.sh quiz zustand-state-management 17-microfrontends`
