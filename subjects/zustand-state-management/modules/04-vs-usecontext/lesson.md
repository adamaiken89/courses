# Module 4: Zustand vs useContext: Re-Renders, Provider Hell

Est. study time: 2h
Language: en

## Learning Objectives
- Diagnose Context re-render cascade: every consumer re-renders when context value reference changes
- Compare Context workarounds (split contexts, useMemo, React.memo) against Zustand selector subscriptions
- Replace Context.Provider + useContext with Zustand store — eliminate provider tree entirely
- Decide when Context is still the right tool vs when Zustand eliminates real performance waste

---

## Core Content

### The Context Re-Render Problem

React's Context API provides dependency injection, not state management. When a provider's `value` prop changes identity (new object/array), React marks **every consumer** of that context for re-render — regardless of whether the consumer reads the changed field.

```typescript
interface AppState {
  theme: 'light' | 'dark'
  user: { name: string; avatar: string } | null
  notifications: number
}

const AppContext = createContext<AppState>({ theme: 'light', user: null, notifications: 0 })

function App() {
  const [state, setState] = useState<AppState>({
    theme: 'light',
    user: { name: 'Alice', avatar: '/alice.png' },
    notifications: 5,
  })

  // Every setState creates new object → every consumer re-renders
  return (
    <AppContext.Provider value={state}>
      <ThemeSwitcher />      {/* re-renders when user changes — unnecessary */}
      <UserProfile />        {/* re-renders when notifications changes — unnecessary */}
      <NotificationBell />   {/* re-renders when theme changes — unnecessary */}
    </AppContext.Provider>
  )
}
```

Root cause: `value={state}` creates new object reference each render. React uses `Object.is` comparison — no match → cascade to all consumers.

> **Think**: A user avatar component reads only `user.avatar` from context. A WebSocket pushes a notification update. How many components re-render unnecessarily? Trace the cascade.
>
> *Answer: Avatar re-renders because context value reference changed, even though `user.avatar` is identical. Every consumer of AppContext re-renders — avatar, sidebar, footer, header — all touch the same context. In a 50-consumer app, 49 re-renders are wasted.*

### Provider Nesting ("Provider Hell")

Multiple contexts require nested providers. Each domain (auth, theme, cart, notifications, i18n, feature flags) adds a wrapper layer:

```typescript
// Typical 6-context app
function Root() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <I18nProvider>
          <CartProvider>
            <NotificationProvider>
              <FeatureFlagProvider>
                <ErrorBoundary>
                  <App />
                </ErrorBoundary>
              </FeatureFlagProvider>
            </NotificationProvider>
          </CartProvider>
        </I18nProvider>
      </ThemeProvider>
    </AuthProvider>
  )
}
```

Problems grow with each layer:
- **Bundle size**: Each provider is a component + closure overhead
- **Test friction**: Wrapping test renders with every provider a component needs
- **Tree-shaking impossible**: Providers exist at root, always mounted
- **Refactoring cost**: Reordering providers requires changing every child consuming affected context
- **Debugging**: React DevTools shows deeply nested tree — hard to trace which provider owns which state

> **Think**: A team has 8 context providers. Two new engineers join. How long until someone puts a provider in the wrong order, causing a bug that takes hours to find?
>
> *Answer: Provider order matters when contexts depend on each other (auth depends on config, cart depends on user). Wrong order produces silent failures — component tries to read undefined context value. Without a type error at compile time, this surfaces as "why is my cart empty?" debugging sessions. Each new provider adds O(n) cognitive load to ordering decisions.*

### Zustand: No Providers, Granular Subscriptions

Zustand stores live outside the component tree. No `<Provider>` wrapper. No nesting. Components subscribe to exact slices:

```typescript
import { create } from 'zustand'

interface AppStore {
  theme: 'light' | 'dark'
  user: { name: string; avatar: string } | null
  notifications: number
  setTheme: (t: 'light' | 'dark') => void
  setUser: (u: AppStore['user']) => void
  addNotification: () => void
}

const useAppStore = create<AppStore>((set) => ({
  theme: 'light',
  user: null,
  notifications: 0,
  setTheme: (theme) => set({ theme }),
  setUser: (user) => set({ user }),
  addNotification: () => set((s) => ({ notifications: s.notifications + 1 })),
}))

// Each component subscribes to exactly what it needs
function ThemeSwitcher() {
  const theme = useAppStore((s) => s.theme)  // re-renders only on theme change
  const setTheme = useAppStore((s) => s.setTheme)
  return <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme}</button>
}

function UserProfile() {
  const user = useAppStore((s) => s.user)  // re-renders only on user change
  return user ? <div><img src={user.avatar} /><span>{user.name}</span></div> : null
}

function NotificationBell() {
  const count = useAppStore((s) => s.notifications)  // re-renders only on notifications change
  return <span>{count > 0 ? count : ''}</span>
}
```

No provider tree. No wrapper components. No ordering constraints. Each component controls its own subscription granularity via the selector function.

> **Think**: A Zustand store has 10 fields. Component A reads field 1, component B reads fields 2-10. Field 1 updates. How many re-renders? What if this were Context?
>
> *Answer: Zustand: 1 re-render (component A only). Context: every consumer of that context re-renders — could be 20+ components depending on tree. The difference is not marginal; it compounds with every state update.*

### Context Workarounds and Their Limits

Teams hit Context's re-render ceiling and try workarounds:

**Workaround 1: Split contexts**

```typescript
// Instead of one AppContext, create one per domain
const ThemeContext = createContext<Theme>({ theme: 'light' })
const UserContext = createContext<User | null>(null)
const NotificationContext = createContext<number>(0)
```

Pros: Consumers of ThemeContext do not re-render when notifications update.
Cons: Each split adds a provider wrapper. 10 domains = 10 nesting levels.

**Workaround 2: Memoized context value**

```typescript
function App({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState('light')
  const [user, setUser] = useState(null)

  const themeValue = useMemo(() => ({ theme, setTheme }), [theme])
  const userValue = useMemo(() => ({ user, setUser }), [user])

  return (
    <ThemeContext.Provider value={themeValue}>
      <UserContext.Provider value={userValue}>
        {children}
      </UserContext.Provider>
    </ThemeContext.Provider>
  )
}
```

Pros: Consumers of ThemeContext do not re-render when user changes.
Cons: verbose. Each piece of context needs manual `useMemo` + dependency array. One mistake (missing dep) = infinite re-renders. Still requires provider tree.

**Workaround 3: React.memo on consumers**

```typescript
const ExpensiveSidebar = React.memo(function ExpensiveSidebar() {
  const { theme } = useContext(ThemeContext)
  return <div className={theme === 'dark' ? 'dark' : 'light'}>...</div>
})
```

Pros: Prevents re-render if props unchanged.
Cons: does not help when context value changes — `React.memo` only checks props, not context. The wrapped component still re-renders on context change.

**Workaround 4: Full state lift to parent with useRef for stable references**

Anti-pattern: storing context value in a ref to keep reference stable, using forceUpdate to trigger re-render.

```typescript
const stateRef = useRef(value)
stateRef.current = value
const [, forceUpdate] = useReducer(x => x + 1, 0)
// Consumers use stateRef.current but this is fragile, non-standard
```

All workarounds have limits. Zustand eliminates the root cause instead of patching symptoms.

> **Think**: A team splits context into 8 micro-contexts. Each has a useMemo wrapper. How many lines of boilerplate? How does this compare to Zustand's create() call?
>
> *Answer: 8 contexts = 8 createContext calls + 8 provider components (each with useMemo) + 8 Custom hook wrappers (useTheme, useUser, etc.) ≈ 80-120 lines of wrapping code. Zustand: one create() call ≈ 20 lines. Each new domain in Context adds ~10-15 lines of infrastructure. In Zustand, each new domain adds 2-3 lines of state.*

### Zustand Selector Subscriptions Internals

Zustand's hook uses `useSyncExternalStore` (React 18+) under the hood:

```typescript
// Simplified internal behavior
function useStore(api, selector = identity) {
  const slice = useSyncExternalStore(
    api.subscribe,           // subscribe to store changes
    () => selector(api.getState()),  // get current snapshot
    () => selector(api.getInitialState())  // getServerSnapshot for SSR
  )
  return slice
}
```

`useSyncExternalStore` is the official React API for external stores. It:
1. Subscribes to the store on mount
2. Compares selector output using `Object.is`
3. Only triggers re-render when selected value changes
4. Handles tearing (external store changes mid-render) — React re-runs the render with consistent state

Context does not use `useSyncExternalStore`. Context uses the provider component's setState → re-render → propagate to children. This is the fundamental architectural difference.

> **Think**: Why does `useSyncExternalStore` prevent tearing? What would happen if Zustand used subscribe + setState directly?
>
> *Answer: Tearing = external store changes between React's render phases, producing inconsistent UI. useSyncExternalStore forces React to re-read the store during commit phase, ensuring all components see the same snapshot. Direct setState from a subscription could miss mid-render updates — some components see old state, some see new. This is a class of race condition Context avoids (same tree, same render) but Zustand's useSyncExternalStore handles correctly.*

### Migration: Replacing Context with Zustand

Step-by-step migration without breaking the app:

```typescript
// Before: Context-based auth
const AuthContext = createContext<AuthState | null>(null)

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const login = async (email: string, password: string) => {
    const res = await api.login(email, password)
    setUser(res.user)
    setToken(res.token)
  }
  const logout = () => { setUser(null); setToken(null) }
  const value = useMemo(() => ({ user, token, login, logout }), [user, token])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
```

```typescript
// After: Zustand auth store
import { create } from 'zustand'

interface AuthStore {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  login: async (email, password) => {
    const res = await api.login(email, password)
    set({ user: res.user, token: res.token })
  },
  logout: () => set({ user: null, token: null }),
}))

// Components switch from:
// const { user } = useAuth()
// To:
// const user = useAuthStore((s) => s.user)
```

Migration steps:
1. Create Zustand store mirroring context state + actions
2. Replace each `useContext(AuthContext)` with `useAuthStore(selector)` in each component — one component at a time
3. Remove `AuthProvider` from component tree once no components use it
4. Delete `AuthContext` definition

Safe to do incrementally because Context and Zustand can coexist during migration.

> **Think**: During migration, a component accidentally uses both useAuth() from Context and useAuthStore() from Zustand. Values diverge. How do you prevent this?
>
> *Answer: Write the Zustand store to hydrate from Context's current value on first read. Or use a codemod/lint rule that bans useAuth() after migration starts. Simplest: migrate leaf components first, then parent components, then remove provider last — no divergence because provider stays mounted during transition.*

### Performance Comparison: Context Cascade vs Zustand Selectors

| Scenario | Context re-renders | Zustand re-renders | Ratio |
|----------|-------------------|-------------------|-------|
| 1 field updates, 5 consumers read different fields | 5 (all consumers) | 1 (only field's consumer) | 5x |
| 10 fields, 50 consumers, broadcast event updates all | 50 | ~10-15 (depending on overlap) | 3-5x |
| Theme toggle (1 consumer) | All context consumers | 1 | N consumers |
| Real-time dashboard, 1s updates | All consumers per update | Only subscribed slices | 5-20x depending on granularity |

Context's cost scales linearly with consumer count per provider. Zustand's cost scales with number of changed slices — regardless of how many other subscribers exist.

```typescript
// Performance comparison setup
function ContextApp() {
  const [data, setData] = useState(largeDataset)
  // Every consumer of DataContext re-renders on any update
  return (
    <DataContext.Provider value={data}>
      <ExpensiveChart />     {/* re-renders every time */}
      <DataTable />          {/* re-renders every time */}
      <SummaryStats />       {/* re-renders every time */}
      <FilterPanel />        {/* re-renders every time */}
    </DataContext.Provider>
  )
}

function ZustandApp() {
  const chartData = useDataStore((s) => s.chartData)  // only on chart data change
  const tableData = useDataStore((s) => s.tableData)   // only on table data change
  const stats = useDataStore((s) => s.stats)           // only on stats change
  return <>{/* each component isolated */}</>
}
```

> **Think**: A dashboard has a refresh button that fetches all data. Context triggers 50 re-renders. Zustand triggers 5. Does the user notice the difference?
>
> *Answer: User notices if re-renders cause frame drops. 50 components re-rendering simultaneously can cause layout thrashing, especially with heavy DOM (charts, tables). Zustand's 5 targeted re-renders spread work across frames. At 60fps (16ms budget), 50 re-renders can exceed budget; 5 stays under.*
> *But: if re-renders are fast (no heavy computation), Context's cost may be imperceptible. The question is not "fewer re-renders better" but "does Context's re-render cost cause jank?" Profile before optimizing.*

### When Context Is Still the Right Tool

Context is not universally worse than Zustand. Context excels at:

**Low-frequency, high-fan-out state**: Values that rarely change but many components read.
- Theme (light/dark toggle, changes rarely)
- Locale (user changes language infrequently)
- Auth user session (login/logout events)
- Feature flags (load on app start, rarely change)

```typescript
// Good Context use case — theme changes rarely, consumed by many
const ThemeContext = createContext<Theme>('light')

// When theme changes, all consumers re-render, but this happens once per user action
// Every few minutes at most — the re-render cost is negligible
```

**Scaffold/wiring**: Values every component needs and never changes.
- `version`, `buildId`, `appName`
- These never change → reference is stable → no unwanted re-renders

**Third-party library requirements**: Some libraries expect Context for configuration.
- React Router's `<Router>`
- TanStack Query's `<QueryClientProvider>`

**Server Components + Client Components boundary**: Context bridges Server Component data into the client tree. Zustand cannot read RSC data directly (Zustand is client-only).

```typescript
// Server Component feeds client Context tree
// Zustand would require manual hydration at the boundary
```

> **Think**: An app has theme (toggled once per session), auth user (set on login), and a websocket data feed (updates 10x/second). Which uses Context? Which uses Zustand?
>
> *Answer: Theme and auth → Context (low frequency, wide fan-out). Websocket data → Zustand (high frequency, narrow subscribers). This hybrid architecture is common and correct. The debate is not "Context vs Zustand everywhere" but "Context for low-frequency, Zustand for high-frequency state."*

### React 19: use(Context) and Context Changes

React 19 introduces `use()` hook that accepts Context directly:

```typescript
// React 19 — use() works in early returns, conditionals, inside loops
function Sidebar() {
  const theme = use(ThemeContext) // works anywhere in component
  if (theme === 'dark') return <DarkSidebar />
  return <LightSidebar />
}
```

`use(Context)` reads context value mid-render. Unlike `useContext`, `use()` can be called conditionally and after early returns.

**Does `use()` fix the re-render cascade?** No. `use()` is a read mechanism, not a subscription mechanism. The re-render cascade is a **write-side problem**: when context value changes, React marks all consumers. `use()` changes how you **read** context but does not change how context **propagates** changes.

**Does React 19 improve Context performance?** Minor improvements to batching — React 19 batches context updates more aggressively. But the fundamental cascade remains: one provider value change → all consumers re-render.

```typescript
// React 19 — still cascades
function App() {
  const [state, setState] = useState({ theme: 'dark', count: 0 })
  // Changing `count` still re-renders every consumer of MyContext
  return (
    <MyContext value={state}>
      <AllConsumers /> {/* all re-render */}
    </MyContext>
  )
}
```

**React 19 + Context split still requires providers**. `use()` does not eliminate provider nesting. The provider hell problem persists.

> **Think**: Your team adopts React 19. You learn `use()` and replace all `useContext` calls. Does this fix the re-render issue? Why or why not?
>
> *Answer: No. The re-render problem is on the write side (provider value changes cascade), not the read side (useContext vs use). Changing the reading mechanism does not change React's reconciliation behavior. Zustand's advantage — external store with granular subscriptions — is orthogonal to React 19 changes. Zustand works identically in React 18 and 19.*

### Provider-Free Testing

Zustand stores are pure functions — test them without provider wrappers:

```typescript
// Context testing — requires provider wrapping
import { render, screen } from '@testing-library/react'

test('profile renders user name', () => {
  render(
    <AuthContext.Provider value={{ user: { name: 'Alice' }, token: 'abc' }}>
      <Profile />
    </AuthContext.Provider>
  )
  expect(screen.getByText('Alice')).toBeInTheDocument()
})
```

```typescript
// Zustand testing — no provider, direct store manipulation
import { useAuthStore } from './auth-store'

beforeEach(() => {
  useAuthStore.setState({ user: { name: 'Alice' }, token: 'abc' })
})

test('profile renders user name', () => {
  render(<Profile />)  // reads from store directly
  expect(screen.getByText('Alice')).toBeInTheDocument()
})

test('profile hides when logged out', () => {
  useAuthStore.setState({ user: null, token: null })
  render(<Profile />)
  expect(screen.queryByText('Alice')).not.toBeInTheDocument()
})
```

Benefits:
- No wrapper components in test renders
- Easy to set up state variations (just `setState`)
- Customizing context per test is as simple as calling `setState`
- Cleanup: `afterEach(() => useAuthStore.setState(initialState))`
- Integration tests: multiple components share the same store without provider wrapping

```typescript
// Can also replace entire store state for edge cases
test('handles corrupt store gracefully', () => {
  useAuthStore.setState({ user: { name: 'Alice' } }) // missing token — test edge case
  render(<Profile />)  // Zustand components react to whatever state they have
  // No type error at runtime — Zustand is unopinionated about shape
})
```

> **Think**: A test suite has 200 Context-dependent component tests. Each needs 3-5 providers wrapped. Migrating to Zustand eliminates how many lines of test boilerplate? What else improves?
>
> *Answer: ~200 tests × 3 providers × 2 lines each ≈ 1200 lines of provider wrapping eliminated. More important: tests become declarative ("set state → render → assert") instead of imperative ("wrap in providers → render → assert"). State manipulation is direct. Debugging is easier — one store `getState()` shows all state at any point, vs tracing through provider stack.*

---

### Why This Matters

Context re-render cascading is the #1 performance complaint in React apps past a certain size. Teams spend weeks splitting contexts, adding `useMemo` wrappers, and debugging "why does X re-render when Y changes?" — all fighting Context's fundamental architecture. Zustand eliminates the root cause: external store + granular subscriptions = no cascade, no providers, no workarounds. But Context is not evil — low-frequency state (theme, locale) works fine with Context. Learning the distinction between "Context-suitable" and "Context-dangerous" state prevents over-engineering with Zustand where simpler solutions work. This module gives you the diagnostic framework to decide which tool belongs where.

---

### Common Questions

**Q: Does React.memo fix Context re-renders?**
A: No. React.memo only blocks re-render when props are unchanged. Context value change triggers re-render from the provider downward, bypassing memo. React.memo on a consumer of a changed context does not prevent the re-render — the consumer's context value changed, so it re-renders regardless of memo.

**Q: How many contexts is "too many"?**
A: Beyond 5-7 nested providers, the tree becomes hard to read, tests require heavy wrapping, and reordering becomes risky. At this point, Zustand eliminates provider nesting entirely. The limit is not technical but ergonomic and cognitive.

**Q: Can I use Zustand inside a Context provider?**
A: Yes. Zustand stores are independent of the React tree. You can use `useStore` inside a Context provider to read Zustand state and pass it through Context. This is occasionally useful for third-party libraries that require Context. But generally, skip the middleman — read Zustand directly.

**Q: Does SSR affect Context vs Zustand?**
A: Context works in SSR natively (it is part of React). Zustand requires `useSyncExternalStore`'s `getServerSnapshot` parameter for SSR. Zustand's `create()` handles this automatically — your store is created once on server, and each request can create a fresh store if you use `createStore` from `zustand/vanilla`. For Next.js App Router, wrap Zustand in a client component boundary.

**Q: What about React 19's `use()` — does it make Context faster?**
A: `use()` is a read-side convenience (works in conditionals, early returns). It does not change write-side propagation (provider → consumers cascade). Context performance in React 19 is identical to React 18 for the re-render cascade issue. Zustand's advantage is unchanged.

---

## Examples

### Example 1: Real-Time Dashboard — Context vs Zustand Performance

**Problem**: Dashboard displays live stock prices via WebSocket. 15 components display different fields (current price, change %, volume, high/low, chart). Context approach: every price update re-renders all 15.

**Context with split workaround**:
```typescript
// Split to reduce cascade, but still 3 providers
<PriceContext.Provider value={priceState}>
  <VolumeContext.Provider value={volumeState}>
    <ChartContext.Provider value={chartState}>
      <StockDashboard />
    </ChartContext.Provider>
  </VolumeContext.Provider>
</PriceContext.Provider>

// Price update at 100ms interval
// PriceContext consumers re-render: 5 components
// VolumeContext consumers: unchanged
// ChartContext consumers: unchanged
// Total: 5 re-renders per update = 50 re-renders/second
```

**Zustand version**:
```typescript
const useStockStore = create<StockStore>((set) => ({
  price: 0,
  change: 0,
  volume: 0,
  high: 0,
  low: 0,
  chartData: [],
  updatePrice: (price, change) => set({ price, change }),
  updateVolume: (volume) => set({ volume }),
  appendChart: (point) => set((s) => ({ chartData: [...s.chartData.slice(-100), point] })),
}))

// Each component subscribes to its slice
function PriceDisplay() {
  const price = useStockStore((s) => s.price)       // re-renders only on price change
  const change = useStockStore((s) => s.change)
  return <span>{price} ({change}%)</span>
}

function VolumeDisplay() {
  const volume = useStockStore((s) => s.volume)     // does NOT re-render on price change
  return <span>Vol: {volume.toLocaleString()}</span>
}
```

**Result**: Price updates at 100ms → 1 component re-renders (PriceDisplay). Volume updates at 1s → 1 component re-renders (VolumeDisplay). Chart updates at 500ms → 1 component re-renders (Chart). Total: ~30 re-renders/second vs Context's ~50/second — but more importantly, **each re-render is isolated, not cascading**. No jank from chart re-rendering when price changes.

### Example 2: Migrating a Settings Panel from Context to Zustand

**Problem**: Settings page with 20+ fields (theme, notifications, privacy, language, timezone, etc.). Wrapped in a single `SettingsContext`. Toggling one setting re-renders every settings field component — causing visible flicker on checkboxes.

**Migration plan**:
```typescript
// Step 1: Create Zustand store mirroring settings
interface SettingsStore {
  theme: 'light' | 'dark'
  notifications: { email: boolean; push: boolean; sms: boolean }
  privacy: { profileVisibility: 'public' | 'private'; showOnline: boolean }
  language: string
  timezone: string
  // ... more fields
  setTheme: (theme: 'light' | 'dark') => void
  setNotification: (key: 'email' | 'push' | 'sms', value: boolean) => void
  setPrivacy: (key: string, value: boolean) => void
}

// Step 2: Replace useContext one component at a time
// Before:
function ThemeSelector() {
  const { theme, setTheme } = useContext(SettingsContext)
  // re-renders when ANY setting changes, even privacy
}

// After:
function ThemeSelector() {
  const theme = useSettingsStore((s) => s.theme)
  const setTheme = useSettingsStore((s) => s.setTheme)
  // re-renders only on theme change
}

// Step 3: Remove SettingsProvider after all components migrated
```

**Result**: Toggling email notifications (1 field change) now re-renders just the email checkbox instead of all 20+ setting components. Perceived responsiveness improves even though the actual state update is the same speed.

### Example 3: Auth + Theme Hybrid (Context + Zustand)

**Problem**: App needs auth (low frequency — login/logout) and real-time collaboration state (high frequency — cursor positions, document edits, presence). Auth is read by many components. Collaboration state changes 20x/second and is read by 3 components.

**Hybrid architecture**:
```typescript
// Context for auth — low frequency, wide fan-out
const AuthContext = createContext<Auth | null>(null)

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<Auth | null>(null)
  const value = useMemo(() => ({ auth, setAuth, login, logout }), [auth])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Zustand for collaboration — high frequency, narrow subscribers
const useCollabStore = create<CollabStore>((set) => ({
  cursors: new Map<string, Position>(),
  presence: new Map<string, Presence>(),
  document: '',
  updateCursor: (id, pos) => set((s) => {
    const cursors = new Map(s.cursors)
    cursors.set(id, pos)
    return { cursors }
  }),
  // ...
}))

// AuthContext.Provider wraps entire app (1 layer only)
// Zustand stores are provider-less
// Collaboration components do not contribute to provider nesting
```

**Result**: 1 provider instead of 3+. Auth re-renders hit all consumers but happen once per session. Collaboration updates hit only the 3 relevant components.

---

## Key Takeaways
- Context re-renders every consumer when value reference changes — root cause is React's identity comparison on provider value
- Provider hell grows O(n) providers: each domain adds a wrapping layer, increasing cognitive load and test friction
- Context workarounds (split contexts, useMemo, React.memo) reduce but do not eliminate the cascade; each adds boilerplate and failure modes
- Zustand uses `useSyncExternalStore` for granular selector subscriptions — re-render only on selected value change
- Performance gap widens with consumer count: Context cascades linearly, Zustand isolates per subscription
- Migration is incremental: create Zustand store next to existing context, migrate one consumer at a time, delete provider last
- Context is still correct for low-frequency wide-fan-out state: theme, locale, feature flags, auth session
- React 19's `use()` does not fix re-render cascade — write-side propagation unchanged
- Zustand testing is provider-free: `setState()` directly manipulates store, no wrapper components in tests
- Hybrid architecture is common and optimal: Context for low-frequency, Zustand for high-frequency state

## Common Misconception

**"Context is a state management solution."**

Context is dependency injection, not state management. The provider component manages state with `useState`/`useReducer` and passes it through context. The re-render cascade is not a Context bug — it is a consequence of React's reconciliation model applied to injected values. "Bad Context performance" usually means "bad provider state management" (storing everything in one context value). Splitting contexts fixes the symptom but keeps the architectural issue: state lives inside React's rendering tree. Zustand moves state outside the tree, decoupling state updates from component re-renders at the architectural level. Understanding this distinction — "state in the tree" vs "state outside the tree" — is the difference between applying band-aids and fixing the architecture.

---

## Feynman Explain
(Explain to a non-React developer why "everyone re-renders" is a problem. Use a real-world analogy: a shared whiteboard in an office. When someone erases one number, everyone looks up and checks if they need to react — even people who do not care about that number. Zustand is like giving each person a personal clipboard with only the numbers they care about — the erasure does not interrupt anyone else.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain zustand-state-management` — AI probes gaps.*

---

## Reframe
(Pause. Critique: Is Zustand really a "simpler" solution, or does it add an external dependency that Context users avoid? A well-structured Context splitting pattern (one context per domain, memoized values, strict consumer boundaries) can match Zustand's re-render behavior without a library. When is Context's zero-dependency advantage worth the boilerplate? Write your evaluation — consider bundle cost, team training, and the risk of premature optimization replacing Context with Zustand where context consumers are few and re-renders cheap.)

---

## Drill
Take the quiz. MCQs test re-render cascade mechanics, provider hell patterns, Zustand selectors, migration strategy, and Context-vs-Zustand decision boundaries.

Run: `learn.sh quiz zustand-state-management 04-vs-usecontext`
