# Module 12: Context Evolution: use(Context), Provider Patterns, Performance

Est. study time: 2h
Language: en
Framework: TypeScript

## Learning Objectives
- Distinguish `use(Context)` from `useContext` — conditional/early-return context reading
- Design provider composition with value memoization to prevent unnecessary re-renders
- Apply split-context pattern for performance in multi-value scenarios
- Evaluate Context + useReducer vs Zustand/Redux for state management needs

---

## Core Content

### use(Context) — Reading Context in React 19

Before React 19, reading context had one path: `useContext(Context)` at top of component. Violation of Rules of Hooks if inside conditional or early return.

React 19 introduces `use(Context)` — a new API from the `use()` family that reads context in render:

```typescript
import { use } from 'react'
import { ThemeContext } from './theme'

function ThemedButton() {
  const theme = use(ThemeContext)
  return <button className={theme} />
}
```

Key difference: `use(Context)` is NOT a hook. It is a render-time function. Rules of Hooks do not apply.

```typescript
function ThemedButton({ variant }: { variant: string }) {
  if (variant === 'default') {
    const theme = use(ThemeContext)  // OK — inside conditional
    return <button className={theme}>Default</button>
  }

  const locale = use(LocaleContext)  // OK — after early return
  return <button>{locale.label}</button>
}
```

`useContext` still works. `use(Context)` is additive, not replacement. Use `use(Context)` when you need conditional context reading. Use `useContext` when you prefer hook semantics.

> **Think**: You have a ListItem component that only needs theme context when `variant === 'featured'`. Why does `use(Context)` inside a conditional improve performance over `useContext` at the top?
>
> *Answer: Conditional reading means context value is only subscribed when needed. When `variant !== 'featured'`, React does not track this component for ThemeContext updates. Fewer subscription = fewer re-renders when theme changes. This matters in long lists where only items with `variant='featured'` re-render.*

### use(Context) with Suspense — Reading Context in Suspended Components

`use()` works with Promises AND Context. This enables context reading inside components that may suspend:

```typescript
function ProfileCard() {
  const user = use(fetchUser())         // can suspend
  const theme = use(ThemeContext)        // reads context in same render
  return <div className={theme}>{user.name}</div>
}
```

Both `use(fetchUser())` and `use(ThemeContext)` are render-time reads. React tracks both dependencies. If the component suspends, React retries it when the Promise resolves AND re-evaluates context subscription.

This unifies data fetching and context consumption in a single render pass — no need for separate components for context access before suspend.

> **Think**: A component calls `use(fetchUser())` (suspends) and `use(ThemeContext)`. If theme changes while the component is suspended, does it re-render when it resumes?
>
> *Answer: Yes. React tracks both as dependencies. When theme changes, the component is marked dirty. On resume (after Promise resolves), it receives latest context value. No stale context reads after suspension.*

### Provider Patterns: Composition, Nesting, Value Memoization

Context providers re-render all consumers whenever their `value` prop changes identity. Object/array literals in JSX create new reference every render.

**Bad — new object every render:**
```typescript
function App() {
  return (
    <UserContext.Provider value={{ name: 'Alice', role: 'admin' }}>
      <Dashboard />
    </UserContext.Provider>
  )
}
```

**Good — memoized value:**
```typescript
function App() {
  const value = useMemo(() => ({ name: 'Alice', role: 'admin' }), [])
  return (
    <UserContext.Provider value={value}>
      <Dashboard />
    </UserContext.Provider>
  )
}
```

**Best — state in provider, value stable:**
```typescript
function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const value = useMemo(() => ({ user, setUser }), [user])

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  )
}
```

Composition pattern — wrap children, not entire app:
```typescript
function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LocaleProvider>
          {children}
        </LocaleProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
```

> **Think**: A parent component re-renders every 100ms due to animation state. It renders `<ThemeContext.Provider value={theme}>`. Without value memoization, what happens to every consumer?
>
> *Answer: Even if `theme` didn't change, `value={theme}` creates same reference for primitive strings. BUT if value were an object `{ theme }`, every animation frame creates new object → all consumers re-render. Solution: lift provider above animation component, or wrap value in useMemo.*

### Context Performance: Split Contexts

Single context with large object causes all consumers to re-render when any field changes.

**Bad — monolithic context:**
```typescript
interface AppState {
  user: User | null
  theme: 'light' | 'dark'
  notifications: Notification[]
  locale: string
}
// ThemeButton re-renders when notifications change — unnecessary
```

**Good — split contexts by change frequency:**
```typescript
// Stable values — rarely change
const ThemeContext = createContext('light')
const LocaleContext = createContext('en')

// Volatile values — change often
const UserContext = createContext<User | null>(null)
const NotificationContext = createContext<Notification[]>([])
```

Split pattern groups values by co-change frequency. Theme and locale change rarely (user action). Notifications change often (server push). Components subscribe only to what they need.

> **Think**: An analytics dashboard has user info (static), date range filter (changes hourly), and real-time chart data (changes every second). How many contexts should you create?
>
> *Answer: Three contexts — UserContext (almost never changes), DateRangeContext (changes rarely), ChartDataContext (changes constantly). Chart components subscribe only to ChartDataContext. DateRange picker subscribes only to DateRangeContext. Profile section subscribes only to UserContext. No unnecessary re-renders.*

### Context and Server Components

Context is client-only. Server Components cannot read or provide context. Error thrown if Server Component tries `use(Context)` or renders `<Context.Provider>`.

**Pattern: Client boundary for context:**
```typescript
// page.tsx — Server Component
export default function Page() {
  return (
    <ThemeWrapper>  // Client Component boundary
      <MainContent />  // can be Server Component inside
    </ThemeWrapper>
  )
}

// ThemeWrapper.tsx — Client Component ("use client")
'use client'
export function ThemeWrapper({ children }: { children: ReactNode }) {
  const theme = use(ThemeContext)
  return <div className={theme}>{children}</div>
}
```

Server Components pass props down to Client Components that consume context. The split is clean: Server Components own data fetching, Client Components own context consumption.

> **Think**: A Server Component fetches user data. A deeply nested Client Component needs user data. Should you use Context or pass props?
>
> *Answer: Pass props through Server Component tree. Context is client-only — you'd need a Client Component boundary to provide it, losing Server Component benefits. Better: fetch in Server Component, pass data as props to Client leaf. Simpler, no context cost, keeps Server Component tree.*

### Context + useReducer vs Zustand/Redux

Context + useReducer provides local state management without external dependencies:

```typescript
type Action =
  | { type: 'SET_USER'; payload: User }
  | { type: 'LOGOUT' }
  | { type: 'SET_THEME'; payload: 'light' | 'dark' }

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload }
    case 'LOGOUT':
      return { ...state, user: null }
    case 'SET_THEME':
      return { ...state, theme: action.payload }
    default:
      return state
  }
}
```

When Context + useReducer is enough:
- State relevant to subtree, not entire app
- Fewer than ~10 action types
- Single state shape (no derived/selectors)
- Low update frequency (not real-time)

When reach for Zustand/Redux:
- State shared across disconnected subtrees
- Derived state with selectors
- Middleware (persistence, undo/redo, logging)
- Performance-sensitive with many subscribers
- DevTools beyond basic React DevTools

> **Think**: A form wizard spans 5 steps, each with its own state slice. All steps visible in single accordion view. Context + useReducer or Zustand?
>
> *Answer: Context + useReducer is fine. State lives in the wizard's subtree. 5 action types (one per step). No middleware needed. No cross-subtree sharing. Adding Zustand would add dependency for no benefit. Reach for Zustand when state tree grows beyond ~10 action types or slices are consumed by unrelated components.*

### use(Context) for Theme, Locale, Auth Patterns

Three canonical context use cases:

**Theme — constant reference, small value:**
```typescript
const ThemeContext = createContext<Theme>('light')

function ThemeToggle() {
  const theme = use(ThemeContext)
  // No useMemo needed — string is primitive, stable reference
  return <button className={theme}>Toggle</button>
}
```

**Locale — constant reference, read-only:**
```typescript
const LocaleContext = createContext<Locale>(enLocale)

function FormatDate({ date }: { date: Date }) {
  const locale = use(LocaleContext)
  return <span>{new Intl.DateTimeFormat(locale.code).format(date)}</span>
}
```

**Auth — frequent updates, needs split:**
```typescript
// Split by change frequency
const AuthUserContext = createContext<User | null>(null)
const AuthActionsContext = createContext<AuthActions | null>(null)

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const login = useCallback(async (creds: Credentials) => {
    const u = await api.login(creds)
    setUser(u)
  }, [])
  const logout = useCallback(async () => {
    await api.logout()
    setUser(null)
  }, [])

  const actions = useMemo(() => ({ login, logout }), [login, logout])

  return (
    <AuthUserContext.Provider value={user}>
      <AuthActionsContext.Provider value={actions}>
        {children}
      </AuthActionsContext.Provider>
    </AuthUserContext.Provider>
  )
}
```

Split pattern: components that only call `login`/`logout` subscribe to `AuthActionsContext` — stable reference, never re-renders. Components that show user info subscribe to `AuthUserContext` — re-renders only on login/logout.

> **Think**: In the auth split pattern, why does `AuthActionsContext` never cause re-renders even though `login`/`logout` are wrapped in `useCallback`?
>
> *Answer: `useCallback` with empty deps creates stable function reference for entire lifecycle. The provider itself re-renders when `setUser` is called (state update). But `AuthActionsContext.Provider value={actions}` passes same reference — `actions` is `useMemo`'d with `[login, logout]` as deps, which are stable. Result: actions consumers never re-render due to context changes.*

### Nested Providers: Ordering, Value Overrides, Merging

Multiple providers of same context type — innermost wins:

```typescript
function FeatureA() {
  return (
    <ThemeContext.Provider value="dark">
      <Section>Content in dark theme</Section>
    </ThemeContext.Provider>
  )
}

function FeatureB() {
  return (
    <ThemeContext.Provider value="light">
      <Section>Content in light theme</Section>
    </ThemeContext.Provider>
  )
}
```

Provider ordering matters for cross-cutting concerns:
```typescript
function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>          // outermost — no dependencies
      <LocaleProvider>      // depends on auth (user locale pref)
        <ThemeProvider>     // depends on auth (user theme pref)
          {children}
        </ThemeProvider>
      </LocaleProvider>
    </AuthProvider>
  )
}
```

General rule: providers depending on outer providers go inside. Providers with no dependencies go outermost.

Value merging — when multiple providers share state shape:
```typescript
const UserContext = createContext<UserState>({ user: null, setUser: () => {} })

function AdminSection() {
  return (
    <UserContext.Provider value={overrideUserState}>
      <AdminPanel />
    </UserContext.Provider>
  )
}
```

Nesting allows scoped overrides — useful for testing, sub-apps, and feature flags.

> **Think**: You have an app with 10 context providers. What is the performance cost of deep nesting? When should you flatten?
>
> *Answer: Each provider adds ~1 object allocation per render (the value wrapper). For 10 providers, cost is ~10 object allocations per render. Negligible. BUT: if any provider's value changes, all children re-render. Deep nesting increases false-positive re-renders. Flatten providers that don't depend on each other. Pre-compose independent providers into a single component to avoid nesting explosion.*

### Testing Components with Context Providers

Three testing patterns:

**1. Direct provider wrapper — integration tests:**
```typescript
import { render, screen } from '@testing-library/react'

test('renders user name', () => {
  render(
    <UserContext.Provider value={{ name: 'Alice', role: 'admin' }}>
      <UserProfile />
    </UserContext.Provider>
  )
  expect(screen.getByText('Alice')).toBeInTheDocument()
})
```

**2. Custom render utility — DRY wrapper:**
```typescript
interface WrapperProps {
  user?: User
  theme?: Theme
  locale?: Locale
}

function renderWithProviders(
  ui: ReactElement,
  { user = defaultUser, theme = 'light', locale = 'en' }: WrapperProps = {}
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <UserContext.Provider value={user}>
        <ThemeContext.Provider value={theme}>
          <LocaleContext.Provider value={locale}>
            {children}
          </LocaleContext.Provider>
        </ThemeContext.Provider>
      </UserContext.Provider>
    )
  }

  return { ...render(ui, { wrapper: Wrapper }) }
}
```

**3. Test provider for action contexts — verify dispatch:**
```typescript
const mockSetUser = vi.fn()

test('login button calls setUser', () => {
  render(
    <AuthActionsContext.Provider value={{ login: mockSetUser, logout: vi.fn() }}>
      <LoginButton />
    </AuthActionsContext.Provider>
  )

  fireEvent.click(screen.getByText('Login'))
  expect(mockSetUser).toHaveBeenCalledWith({ username: 'alice' })
})
```

> **Think**: Why is testing with a custom render wrapper better than wrapping each test individually?
>
> *Answer: Single source of truth for provider configuration. Adding a new context requires updating one wrapper function, not 50 tests. Reduces boilerplate, ensures consistent defaults, and makes test setup declarative. Pattern similar to `testing-library`'s `render` with `wrapper` option.*

---

### Why This Matters

Context is React's native dependency injection. In React 19, `use(Context)` makes it more flexible — conditional reading, Suspense compatibility. But flexibility without performance discipline creates apps that re-render everything on every state change. Split contexts, memoized values, and proper provider composition are not optional. They are the difference between a 60fps app and one where typing lags because every keystroke re-renders the navigation bar's theme consumer. Context + useReducer can replace Zustand/Redux for 80% of state management needs — but only when applied with the split pattern. Server Components enforce a clean boundary: Server owns data, Client owns context. Understanding context evolution in React 19 means knowing when to use `use()`, when to split, and when context is not the answer.

---

### Common Questions

**Q: Can `use(Context)` be called outside a component?**
A: No. `use()` is render-time only — called inside a component or custom hook's render path. Not in event handlers, effects, or module scope. For event handlers, use `useContext` in render and close over value, or use refs.

**Q: Does `use(Context)` replace `useContext` completely?**
A: No. `useContext` still works and follows hook semantics. `use(Context)` is additive — use it when you need conditional/early-return reading, or when combining with `use(Promise)` in same component. `useContext` is fine for top-of-component reading.

**Q: How many contexts is too many contexts?**
A: No hard limit. Practical signals: if you create contexts for single boolean values that rarely change, you have too many. If you have one context with 20 fields that update independently, you have too few. Split by change frequency and domain boundary. 5-10 contexts per app is typical for medium apps.

**Q: Does context + useReducer replace Redux?**
A: For subtree-local state, yes. For app-global state with many consumers, complex selectors, or middleware needs (persistence, undo), Redux still wins. Context lacks selector memoization — every consumer re-renders on any state change, even if consumed value slice did not change.

**Q: Can Server Components receive context values as props?**
A: Yes, indirectly. Server Components render before Client Components. Client Components read context and pass values as props down to Server Component slots (children). The Server Component never reads context, but renders children that do.

---

## Examples

### Example 1: Refactoring Monolithic Context to Split Pattern

**Problem**: App with single `AppContext` containing user, theme, notifications, and locale. Every component subscribes to everything. Switching theme re-renders notification list.

**Before:**
```typescript
const AppContext = createContext<AppState>({} as AppState)

function App() {
  const [state, dispatch] = useReducer(appReducer, initialState)
  const value = useMemo(() => ({ state, dispatch }), [state])

  return (
    <AppContext.Provider value={value}>
      <Dashboard />
    </AppContext.Provider>
  )
}

// NotificationList re-renders when theme changes — wasteful
```

**After — split by change frequency:**
```typescript
// Stable context (rare changes)
const ThemeContext = createContext<Theme>('light')
const LocaleContext = createContext<Locale>('en')

// Volatile context (frequent changes)
const UserContext = createContext<UserState>({} as UserState)
const NotificationContext = createContext<Notification[]>([])

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [theme, setTheme] = useState<Theme>('light')
  const [locale, setLocale] = useState<Locale>('en')

  return (
    <ThemeContext.Provider value={theme}>
      <LocaleContext.Provider value={locale}>
        <UserContext.Provider value={user}>
          <NotificationContext.Provider value={notifications}>
            <Dashboard />
          </NotificationContext.Provider>
        </UserContext.Provider>
      </LocaleContext.Provider>
    </ThemeContext.Provider>
  )
}

// ThemeToggle only subscribes to ThemeContext
// NotificationBell only subscribes to NotificationContext
// No false-positive re-renders
```

**Result**: 60% fewer re-renders on theme change. Notification list stays mounted without unnecessary work.

### Example 2: use(Context) for Conditional Theme Reading in a List

**Problem**: 500-item list. Each item renders with default style. Only items with `isFeatured=true` need theme-aware styling. Using `useContext` at component top forces all 500 items to subscribe to ThemeContext.

**Solution with use(Context) conditional:**
```typescript
function ListItem({ isFeatured, title }: { isFeatured: boolean; title: string }) {
  // Only subscribe to theme when featured
  const theme = isFeatured ? use(ThemeContext) : 'default'

  return (
    <div className={isFeatured ? `featured-${theme}` : 'item-default'}>
      {title}
    </div>
  )
}

// Only featured items re-render when theme changes
// 495 non-featured items never subscribe — zero re-render cost
```

**Result**: Theme changes re-render 5 items instead of 500. No subscription overhead for majority of components.

### Example 3: Context + useReducer for Feature-Local State

**Problem**: Multi-step checkout wizard. Steps: cart review, shipping, payment, confirmation. Each step has its own state slice. State lives in wizard component subtree.

**Solution:**
```typescript
type WizardAction =
  | { type: 'SET_SHIPPING'; payload: ShippingInfo }
  | { type: 'SET_PAYMENT'; payload: PaymentInfo }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'CONFIRM' }

const WizardContext = createContext<WizardState>({} as WizardState)
const WizardDispatchContext = createContext<React.Dispatch<WizardAction>>(() => {})

function CheckoutWizard() {
  const [state, dispatch] = useReducer(wizardReducer, initialState)
  const stateValue = useMemo(() => state, [state])

  return (
    <WizardDispatchContext.Provider value={dispatch}>
      <WizardContext.Provider value={stateValue}>
        {renderStep(state.currentStep)}
      </WizardContext.Provider>
    </WizardDispatchContext.Provider>
  )
}

// ShippingForm calls use(WizardDispatchContext) — never re-renders from state changes
// ConfirmationPage calls use(WizardContext) — re-renders only when relevant state changes
```

**Result**: Zero external dependencies. State scoped to wizard subtree. Dispatch is stable — action-triggering components never re-render from state changes. Easy to extract to Zustand if wizard becomes cross-app.

---

## Key Takeaways
- `use(Context)` reads context in render — NOT a hook, works in conditionals and early returns
- `use(Context)` works inside Suspended components alongside `use(Promise)`
- Provider value must be memoized — object literals in JSX create new references every render
- Split contexts by change frequency: stable values (theme, locale) separate from volatile values (notifications, real-time data)
- Context + useReducer replaces Zustand/Redux for subtree-local state with <10 action types
- Auth split pattern: user state and user actions in separate contexts — actions never cause re-renders
- Context is client-only — Server Components cannot read or provide context
- Provider nesting order: outer = no dependencies, inner = depends on outer
- Test context components with custom render wrapper — DRY, single source of truth
- use(Context) conditional reading reduces subscription count — only subscribing components re-render

## Common Misconception

**"Context re-renders everything — avoid it."**

This conflates two things: (1) default context behavior (all consumers re-render when value changes), and (2) the fixable cause (unstable references, monolithic objects). With value memoization (`useMemo`) and split contexts (group by change frequency), context causes ZERO unnecessary re-renders. The "context is slow" myth comes from putting unstable object references in provider value and putting everything in one context. Fix the pattern, not the tool. Context + useReducer is the correct default for state management. Reach for Redux when you need selectors, middleware, or cross-app sharing — not because "context is slow."

---

## Feynman Explain
(Explain React's context evolution — from `useContext` to `use(Context)`, split contexts, and provider performance — to a colleague who used `React.createContext` in class components and hasn't touched React since 2018. Make no assumptions about hooks. Use pre-React 16 vocabulary. Show how render-time context reading (`use()`) enables patterns that were impossible with `getChildContext`.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain` — AI probes gaps.*

---

## Reframe
(Pause. Critique: Context + useReducer is recommended as default for subtree state. But it requires manual split-context setup, value memoization, and discipline about what goes where. Does this overhead exceed the cost of adding Zustand? When does the "zero dependencies" benefit of context outweigh the DX of a purpose-built state library? Consider: team size, project lifespan, performance requirements. Write your evaluation.)

---

## Drill
Take the quiz. MCQs test `use()` semantics, split-context patterns, provider performance, and context-vs-store decision.

Run: `learn.sh quiz advanced-react-19 12-context-evolution`
