# Module 1: Why Zustand: React State Evolution

Est. study time: 2h
Language: en

## Learning Objectives
- Map React state management evolution: setState → useState → useReducer → Context → Zustand
- Identify Zustand's problem niche: global state without boilerplate, providers, or action types
- Compare Zustand against Redux, Context, Jotai, and Valtio on API surface, re-render behavior, and bundle size
- Decide when Zustand is appropriate vs overkill

---

## Core Content

### The Evolution of React State Management

React's state management has evolved through distinct eras, each solving the previous era's pain points while introducing new trade-offs.

**Era 1: setState (React < 16.8)**

Class components used `this.setState()`. State lived on `this.state`, updates merged shallowly. Cross-component state required lifting state up to common ancestors — prop drilling through intermediate components.

```typescript
class Counter extends React.Component {
  state = { count: 0 }
  increment = () => this.setState({ count: this.state.count + 1 })
  render() { return <button onClick={this.increment}>{this.state.count}</button> }
}
```

Problem: no mechanism for unrelated components to share state without a common parent that holds everything.

**Era 2: useState + useContext (React 16.8)**

Hooks introduced `useState` for local state and `useContext` for consuming context. State colocation improved — logic moved with components instead of being spread across lifecycle methods.

```typescript
function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>
}
```

Context solved prop drilling but introduced a new problem: **re-render cascading**. Any context value change re-renders every consumer, even components that only read unrelated parts of the value.

```typescript
const ThemeContext = createContext({ theme: 'light', user: null })
// Changing `user` re-renders every ThemeContext consumer, not just user-displaying ones
```

**Era 3: useReducer + Context (React 16.8+)**

`useReducer` brought Redux-like reducers to local state. Paired with Context, teams built Redux-like patterns without importing Redux.

```typescript
const reducer = (state: State, action: Action) => {
  switch (action.type) {
    case 'INCREMENT': return { ...state, count: state.count + 1 }
    default: return state
  }
}
```

But Context re-render cascade remained. Splitting contexts into fine-grained providers created provider nesting hell:

```typescript
<ThemeProvider>
  <UserProvider>
    <CartProvider>
      <NotificationsProvider>
        <App />
      </NotificationsProvider>
    </CartProvider>
  </UserProvider>
</ThemeProvider>
```

**Era 4: External Stores (Zustand, Redux Toolkit, Jotai, Valtio)**

External state management libraries decouple state from React's component tree. Components subscribe to slices of state and re-render only when their slice changes.

> **Think**: Why does Context re-render every consumer even when only one field changes? What mechanism prevents this problem in Zustand?
>
> *Answer: Context uses React's reconciliation — when context value changes identity (new object), React marks all consumers for update. Zustand uses explicit selector subscriptions: `useStore(store, s => s.count)` — React only re-renders when selected value changes, not when any part of store changes.*

### What Problem Does Zustand Solve?

Zustand addresses three specific pain points from the Context era:

1. **Provider nesting**: Zustand stores live outside the component tree. No wrapper components needed.
2. **Re-render cascading**: Selector-based subscriptions prevent unnecessary re-renders.
3. **Boilerplate**: No action types, no action creators, no reducers, no dispatch, no providers. A store is a single function call.

```typescript
import { create } from 'zustand'

const useStore = create<{ count: number; increment: () => void }>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}))

// In component:
function Counter() {
  const count = useStore((state) => state.count)
  const increment = useStore((state) => state.increment)
  return <button onClick={increment}>{count}</button>
}
```

No `<Provider>`. No `dispatch({ type: 'INCREMENT' })`. Just `create()` and `useStore()`.

> **Think**: The `set` function merges state shallowly, like `this.setState` from class components. Why does this pattern feel familiar? What does this tell you about Zustand's design philosophy?
>
> *Answer: Zustand deliberately mirrors React's own primitives (setState merging). Design philosophy: minimize new concepts. If you know React's class setState, you know Zustand's set. This is why Zustand feels like "React state, but global" — no paradigm shift.*

### How Zustand Works: create()

`create()` returns a hook. But that hook is connected to a vanilla store underneath. The store exists outside React — it is a plain object with `getState`, `setState`, `subscribe`, and `destroy` methods.

```typescript
import { create } from 'zustand'

// create returns a React hook
const useStore = create((set, get) => ({
  bears: 0,
  increase: () => set((state) => ({ bears: state.bears + 1 })),
  reset: () => set({ bears: 0 }),
}))

// But the vanilla store is accessible too:
const { getState, setState, subscribe, destroy } = useStore
// getState() → { bears: 0, increase: fn, reset: fn }
```

Two layers:
- **Vanilla store** (`zustand/vanilla`): Pub/sub state container. Subscribe to changes. No React dependency.
- **React bindings** (`zustand`): Hook that subscribes to vanilla store, triggers re-render on change, cleans up on unmount.

This separation means Zustand works outside React too — use `createStore` from `zustand/vanilla` in Node scripts, Web Workers, or non-React frameworks.

> **Think**: The vanilla store has no React dependency. When would you use the vanilla store directly instead of the React hook?
>
> *Answer: Non-React contexts: Web Worker (sync state between worker and main thread), micro-frontends (share store across frameworks), middleware layers (log state changes to console or file), or scripting (automation that reads/writes state without a UI).*

### Zustand vs Redux

| Dimension | Zustand | Redux Toolkit |
|-----------|---------|---------------|
| Boilerplate | `create()` — 1 function | `createSlice` + `configureStore` + `Provider` |
| Providers | None | `<Provider store={store}>` wraps entire tree |
| Action types | None (mutations are direct) | String action types + action creators |
| Immutability | Manual (or Immer middleware) | Immer built-in (mutate in reducers) |
| DevTools | Middleware | Built-in |
| Bundle | ~1.1KB gzipped | ~11KB gzipped (RTK) |
| Learning curve | 5 minutes | 30 minutes (actions, reducers, slices, selectors, thunks) |

Zustand does not replace Redux for large-scale apps with complex middleware chains. Redux Toolkit's ecosystem (Redux Saga, Redux Observable, serializability checks, normalized cache) serves enterprise needs. Zustand serves small-to-medium state needs with minimal ceremony.

```typescript
// Redux example for comparison
const counterSlice = createSlice({
  name: 'counter',
  initialState: { value: 0 },
  reducers: { increment: (state) => { state.value += 1 } },
})
const store = configureStore({ reducer: counterSlice.reducer })
// App.tsx: <Provider store={store}><App /></Provider>
// Counter.tsx: const value = useSelector((s) => s.counter.value)
//             dispatch(counterSlice.actions.increment())
```

```typescript
// Zustand equivalent
const useCounter = create<{ value: number; increment: () => void }>((set) => ({
  value: 0,
  increment: () => set((s) => ({ value: s.value + 1 })),
}))
// App.tsx: <Counter />
// Counter.tsx: const value = useCounter((s) => s.value)
//             const increment = useCounter((s) => s.increment)
```

> **Think**: You have a 5-person team building an e-commerce checkout flow. Which is the right choice — Redux or Zustand? What criteria drive your decision?
>
> *Answer: Depends on state complexity. Checkout has form state (local), cart (cross-component), order submission (async). If cart logic requires undo/redo, middleware, or normalized cache → Redux. If cart is simple CRUD with no complex async → Zustand. Also consider team familiarity: Redux-experienced team may prefer RTK despite more boilerplate.*

### Zustand vs Context

Context re-render problem visualized:

```typescript
const AppContext = createContext({ theme: 'dark', user: { name: 'Alice' }, notifications: 5 })

function App() {
  const [state, setState] = useState({ theme: 'dark', user: { name: 'Alice' }, notifications: 5 })
  return (
    <AppContext.Provider value={state}>
      <Sidebar />  {/* re-renders when notifications changes — unnecessary */}
      <MainPanel /> {/* re-renders when theme changes — unnecessary */}
      <NotificationsBadge /> {/* should re-render on notifications change */}
    </AppContext.Provider>
  )
}
```

With Zustand, each selector controls its subscription:

```typescript
const useAppStore = create((set) => ({
  theme: 'dark',
  user: { name: 'Alice' },
  notifications: 5,
  setTheme: (theme: string) => set({ theme }),
}))

function Sidebar() {
  const theme = useAppStore((s) => s.theme) // only re-renders on theme change
  return <div className={theme}>...</div>
}

function NotificationsBadge() {
  const count = useAppStore((s) => s.notifications) // only re-renders on notification change
  return <span>{count}</span>
}
```

> **Think**: A profile page displays user name, avatar, and recent orders. Three pieces of state from different domains. With Context, what happens when orders update? With Zustand selectors, what happens?
>
> *Answer: Context: full provider re-render cascades to all consumers. Profile avatar re-renders for an orders update. Zustand: each selector isolates subscription. Orders update only re-renders the orders section. Avatar and user name components skip render entirely.*

### Zustand vs Jotai / Valtio

Jotai and Valtio belong to the same "external store" family but with different primitives:

| Library | Primitive | Mental model | Re-render control |
|---------|-----------|--------------|-------------------|
| Zustand | One store, selector functions | Single global state object | Manual selectors |
| Jotai | Atomic atoms, compose with `useAtom` | Granular state atoms | Automatic — per atom |
| Valtio | Proxy-based, mutate directly | Mutate like a plain object | Automatic proxy tracking |

```typescript
// Jotai — atomic
import { atom, useAtom } from 'jotai'
const countAtom = atom(0)
function Counter() {
  const [count, setCount] = useAtom(countAtom)
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>
}
```

```typescript
// Valtio — proxy
import { proxy, useSnapshot } from 'valtio'
const state = proxy({ count: 0 })
function Counter() {
  const snap = useSnapshot(state)
  return <button onClick={() => ++state.count}>{snap.count}</button>
}
```

Zustand's niche: best for teams who want a single store with minimal API. Jotai excels when state is truly atomic (form fields, individual preferences). Valtio shines when the team prefers mutation syntax (feels like Vue/MobX). Zustand is the most straightforward migration path from a Redux/Context background.

> **Think**: A form has 20 fields. Would you use Zustand, Jotai, or Valtio? What trade-off drives your choice?
>
> *Answer: Jotai is best for forms — each field can be an independent atom, avoiding large single-store re-renders. Zustand would require fine-grained selectors for each field (manual). Valtio proxy works but mutation in render is error-prone. Jotai's atoms map naturally to form fields.*

### Zustand's Bundle Size Impact

Zustand is 1.1KB gzipped. For comparison:

| Library | Size (gzipped) |
|---------|---------------|
| Zustand | 1.1 KB |
| Jotai | 3.2 KB |
| Valtio | 3.9 KB |
| Redux (core only) | 4.5 KB |
| Redux Toolkit | 11 KB |
| React Context | 0 KB (built-in) |

At 1.1KB, Zustand is negligibly small. Its cost is not bundle size but architectural complexity: adding a global store means state lives outside React's natural data flow. This is a cognitive cost, not a byte cost.

> **Think**: You are optimizing a page that ships 200KB of JS. Adding Zustand adds ~0.5% to bundle. Adding Redux adds ~5.5%. When does bundle size difference matter?
>
> *Answer: Bundle size matters when every kilobyte affects load time — landing pages, e-commerce product pages, mobile web, SEO-critical routes. For dashboard apps behind authentication, bundle has less impact because users already waited for login page JS. Rule of thumb: if initial load time is critical, reach for Zustand over Redux.*

### When Zustand Is Overkill

Zustand is a tool. Wrong tool for:

1. **Local state**: `useState` is sufficient for component-scoped state. Adding Zustand for a single toggle is over-engineering.
2. **Simple prop drilling**: One or two layers of props is fine. Zustand adds indirection without benefit.
3. **Form state**: React Hook Form or Jotai atoms handle form fields better. Zustand's single-store model causes unnecessary re-renders on individual field changes.
4. **Server state**: Use TanStack Query, SWR, or RTK Query. Zustand manages client state; server state libraries handle caching, background refetch, and stale-while-revalidate.
5. **Tiny apps**: A three-component app does not need global state. Props work fine.

```typescript
// Overkill — useState is fine
const useToggle = create<{ on: boolean; toggle: () => void }>((set) => ({
  on: false,
  toggle: () => set((s) => ({ on: !s.on })),
}))

function Toggle() {
  const { on, toggle } = useToggle()
  return <button onClick={toggle}>{on ? 'ON' : 'OFF'}</button>
}

// Better
function Toggle() {
  const [on, toggle] = useReducer((v) => !v, false)
  return <button onClick={toggle}>{on ? 'ON' : 'OFF'}</button>
}
```

> **Think**: You open a codebase. Every component uses Zustand even for local UI state (dropdown open, tooltip visible). What problems will this team encounter?
>
> *Answer: Debugging difficulty — state is scattered across global stores instead of colocated with components. Re-renders — a global store change for one dropdown can affect unrelated components if selectors are broad. Testing — must set up store per test instead of just mounting component. Over-abstraction — simple code becomes indirect.*

### Demo: Creating Your First Store

```typescript
// 1. Install
// npm install zustand

// 2. Create store
import { create } from 'zustand'

interface BearStore {
  bears: number
  increase: () => void
  decrease: () => void
  reset: () => void
}

const useBearStore = create<BearStore>((set) => ({
  bears: 0,
  increase: () => set((state) => ({ bears: state.bears + 1 })),
  decrease: () => set((state) => ({ bears: state.bears - 1 })),
  reset: () => set({ bears: 0 }),
}))

// 3. Use in component
function BearCounter() {
  const bears = useBearStore((state) => state.bears)
  return <h1>{bears} bears 🐻</h1>
}

function Controls() {
  const increase = useBearStore((state) => state.increase)
  const decrease = useBearStore((state) => state.decrease)
  const reset = useBearStore((state) => state.reset)
  return (
    <div>
      <button onClick={increase}>+</button>
      <button onClick={decrease}>-</button>
      <button onClick={reset}>Reset</button>
    </div>
  )
}

// 4. No Provider needed — just render components
function App() {
  return (
    <div>
      <BearCounter />
      <Controls />
    </div>
  )
}
```

> **Think**: Why does `increase` use `set((state) => ({ bears: state.bears + 1 }))` with a function instead of `set({ bears: bears + 1 })` with a partial object?
>
> *Answer: Function form guarantees correct value when multiple updates batch. If two `increase()` calls happen in same event loop tick, the function form reads the latest state each time. Object form would use stale `bears` value from closure for both calls — both would increment from same base, resulting in +1 instead of +2.*

---

### Why This Matters

Every React developer hits Context's re-render ceiling around 5-10 shared values. The provider tree grows, components re-render for unrelated changes, and the team reaches for Redux by default. Zustand fills the gap between "props are fine" and "full Redux app" — it handles 80% of cross-component state needs with 1.1KB and zero boilerplate. Understanding when to reach for Zustand vs Context vs Redux vs server state is the difference between a maintainable codebase and slow, tangled state management.

---

### Common Questions

**Q: Can Zustand work with React Server Components?**
A: Zustand is client-side. Server Components cannot use hooks. However, you can preload Zustand store on the server and hydrate on client using `hydrate()` — useful for SSR frameworks like Next.js. For truly server state, prefer TanStack Query or Server Actions.

**Q: Does Zustand cause unnecessary re-renders like Context?**
A: No — if you use selectors correctly. `useStore(store, (s) => s.count)` re-renders only when `count` changes. But `useStore()` without selector subscribes to the entire store and re-renders on any change. Always provide a selector for fine-grained subscriptions.

**Q: Can I have multiple Zustand stores?**
A: Yes. Multiple stores are encouraged — one store per domain (auth store, cart store, UI store). Unlike Redux's single store convention, Zustand scales horizontally by splitting concerns across stores.

**Q: How do I persist Zustand state?**
A: Built-in `persist` middleware. Wrap `create()` with `persist` and provide a storage key. It serializes to localStorage (or any storage) automatically. On mount, it hydrates from storage before anyone reads the store.

**Q: Does Zustand work with React Native?**
A: Yes. Zustand has zero DOM dependencies. The vanilla store runs on any JS runtime. React bindings use React's `useSyncExternalStore`, which React Native supports.

---

## Examples

### Example 1: Migrating from Context to Zustand

**Problem**: Auth context holding user, token, and permissions. Theme context holding theme and accent color. Both re-render too many components.

**Context version**:
```typescript
// Three providers, all re-rendering on any change
<AuthProvider>
  <ThemeProvider>
    <App />
  </ThemeProvider>
</AuthProvider>
```

**Zustand version**:
```typescript
// authStore.ts
export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  permissions: [],
  login: (user, token) => set({ user, token }),
  logout: () => set({ user: null, token: null, permissions: [] }),
}))

// themeStore.ts
export const useThemeStore = create<ThemeStore>((set) => ({
  theme: 'light',
  accent: 'blue',
  setTheme: (theme) => set({ theme }),
}))

// Components read only what they need
function Avatar() {
  const user = useAuthStore((s) => s.user) // Only re-renders on user change
  // Token or permissions changes do not re-render Avatar
}
```

**Result**: Provider tree gone. Components re-render on precise slices only.

### Example 2: Shopping Cart with Zustand

**Problem**: Cart shared across product list, cart drawer, and checkout page.

```typescript
interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
}

interface CartStore {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'quantity'>) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, qty: number) => void
  total: () => number
  clear: () => void
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  addItem: (item) =>
    set((state) => {
      const existing = state.items.find((i) => i.id === item.id)
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
          ),
        }
      }
      return { items: [...state.items, { ...item, quantity: 1 }] }
    }),
  removeItem: (id) =>
    set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
  updateQuantity: (id, qty) =>
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, quantity: qty } : i)),
    })),
  total: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
  clear: () => set({ items: [] }),
}))

// CartDrawer component only reads items
function CartDrawer() {
  const items = useCartStore((s) => s.items)
  return <div>{items.length} items in cart</div>
}

// Checkout reads total
function CheckoutButton() {
  const total = useCartStore((s) => s.total())
  return <button>Pay ${total}</button>
}
```

**Result**: Cart state shared across routes, no provider needed, components isolate subscriptions.

### Example 3: Comparing Context vs Zustand Performance

**Problem**: Real-time dashboard with 50 components reading various slices of state. Context causes 5x more re-renders than necessary.

```
Scenario: WebSocket pushes 1 update per second
- Context approach: ~50 re-renders per second (every component checks value)
- Zustand with selectors: ~3-5 re-renders per second (only subscribed slices)

Over 60 seconds:
- Context: 3000 re-renders
- Zustand: 180-300 re-renders
- FPS impact: Context drops to 30fps on large dashboards; Zustand maintains 60fps
```

---

## Key Takeaways
- React state management evolved: setState → useState → useReducer+Context → external stores
- Zustand solves: provider nesting, re-render cascading, and boilerplate from Context/Redux
- `create()` returns a React hook connected to a vanilla pub/sub store
- Selector-based subscriptions prevent unnecessary re-renders — always provide a selector
- Zustand < Redux: 1.1KB vs 11KB, zero boilerplate, but fewer ecosystem tools
- Zustand > Context: no provider wrapping, no cascading re-renders
- Zustand vs Jotai/Valtio: single-store vs atoms vs proxy — pick by mental model preference
- Zustand is overkill for local state, simple props, or server state
- Multiple stores are idiomatic — one per domain
- Vanilla store (`zustand/vanilla`) works outside React: Workers, Node, micro-frontends

## Common Misconception

**"Zustand replaces Redux for everything."**

Zustand replaces Redux for small-to-medium state needs. It does not replace Redux Toolkit's ecosystem: Redux DevTools with time-travel debugging, Redux Saga for complex async workflows, normalized entity caches with `createEntityAdapter`, or middleware chains (logging, crash reporting, serializability checks). If your app needs five+ middleware layers or normalized relational state, reach for Redux Toolkit. If you just need global state without ceremony, reach for Zustand. They serve different complexity tiers.

---

## Feynman Explain
(Explain Zustand to a junior developer who knows only `useState`. They have never used Context, Redux, or any state library. Use no jargon beyond "state" and "subscribe." Show them why a global store exists, what problem it solves, and write the simplest bear store together.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain zustand-state-management` — AI probes gaps.*

---

## Reframe
(Pause. Critique: Does Zustand solve a real problem, or does it add unnecessary abstraction that React's built-in tools already handle? When do Context's limitations justify a library dependency? Would a well-structured Context splitting pattern (one context per domain) match Zustand's DX without the dependency? Write your evaluation — consider bundle size, testing, and team onboarding costs.)

---

## Drill
Take the quiz. MCQs test evolution timeline, comparison trade-offs, selector behavior, and when-to-use decisions.

Run: `learn.sh quiz zustand-state-management 01-why-zustand`
