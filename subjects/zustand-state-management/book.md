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

## Quiz: 01-why-zustand


### Which React state management evolution order is correct?

- [ ] A: useState → setState → useReducer → Context → Zustand

- [✓] B: setState → useState → useReducer → Context → Zustand

- [ ] C: Context → useState → setState → Zustand → useReducer

- [ ] D: useState → Context → setState → useReducer → Zustand


**Answer:** B

Class components used setState first. Hooks introduced useState and useReducer. Context solved prop drilling but had re-render issues. Zustand represents external stores.


### What is the primary re-render problem with React Context?

- [ ] A: Context does not trigger re-renders at all

- [✓] B: Context re-renders every consumer when any part of the context value changes

- [ ] C: Context only re-renders the provider, not consumers

- [ ] D: Context re-renders components in reverse order


**Answer:** B

When the context value's reference changes, React marks all consumers for update regardless of which fields actually changed. This is the cascading re-render problem.


### What does Zustand's create() function return?

- [ ] A: A Redux store

- [ ] B: A React component

- [✓] C: A React hook connected to a vanilla store

- [ ] D: A Context provider


**Answer:** C

create() returns a React hook. Under the hood, the hook subscribes to a vanilla pub/sub store (from zustand/vanilla) and triggers re-renders when subscribed state changes.


### How does Zustand prevent unnecessary re-renders compared to Context?

- [ ] A: It uses React.memo on every component

- [✓] B: It uses selector functions to subscribe to specific slices of state

- [ ] C: It batches all updates synchronously

- [ ] D: It stores state in refs instead of state


**Answer:** B

Zustand's useStore(store, selector) subscribes only to the value returned by the selector. When that value's reference changes, only the subscribing component re-renders — not every consumer.


### A team uses Zustand for a toggle button's on/off state. What is wrong with this choice?

- [ ] A: Zustand cannot handle boolean state

- [✓] B: Zustand is overkill — useState is sufficient for local component state

- [ ] C: Zustand requires a provider to work

- [ ] D: Zustand does not support toggle patterns


**Answer:** B

Local UI state (toggle open/closed, tooltip visible) should use useState. Adding Zustand for trivial state adds indirection, spreads logic globally, and makes testing harder — without benefit.


### Which comparison between Zustand and Redux Toolkit is correct?

- [ ] A: Zustand has a larger bundle than Redux Toolkit

- [ ] B: Zustand requires Provider wrappers; Redux does not

- [✓] C: Zustand has no action types or action creators; Redux Toolkit uses slices with action strings

- [ ] D: Zustand uses Immer by default; Redux Toolkit requires manual immutability


**Answer:** C

Zustand's set() mutates state via function updater — no action types needed. Redux Toolkit creates action types from slice names. Zustand is minimal API; Redux is more structured.


### In Zustand, when would you use the vanilla store (zustand/vanilla) instead of the React hook?

- [ ] A: Never — the vanilla store has no use case

- [✓] B: When you need to share state between a Web Worker and the main thread

- [ ] C: When you want automatic re-renders in React

- [ ] D: When you need Context-based subscriptions


**Answer:** B

zustand/vanilla creates a store without React dependency. Use it in Web Workers, Node.js scripts, micro-frontends, or any non-React context where you need pub/sub state.


### Which library is best suited for managing 20 individual form fields with independent values?

- [ ] A: Zustand — single store with selectors for each field

- [✓] B: Jotai — each field as an independent atom

- [ ] C: Redux Toolkit — single reducer with normalized state

- [ ] D: React Context — one context for form state


**Answer:** B

Jotai's atomic model maps naturally to individual form fields. Each field is an independent atom, avoiding single-store pattern where any field change could trigger broader subscriptions.


### What is Zustand's bundle size?

- [ ] A: 0.5 KB gzipped

- [✓] B: 1.1 KB gzipped

- [ ] C: 4.5 KB gzipped

- [ ] D: 11 KB gzipped


**Answer:** B

Zustand is 1.1KB gzipped. Compare to Redux core at 4.5KB and Redux Toolkit at 11KB. Zustand's small size makes it negligible for bundle-sensitive pages.


### A real-time dashboard has 50 components reading different slices of state. WebSocket pushes 1 update per second. Compared to Context with the same state, what behavior does Zustand produce?

- [ ] A: More re-renders because Zustand adds overhead

- [✓] B: Fewer re-renders because Zustand selectors limit re-renders to subscribed slices

- [ ] C: The same re-render count — both libraries trigger all consumers

- [ ] D: Zustand prevents all re-renders by using immutable state


**Answer:** B

Context re-renders all 50 consumers on any state change. Zustand with fine-grained selectors re-renders only 3-5 components whose subscribed slices actually changed. In a 60-second window this is 3000 vs 300 re-renders.


---

# Module 2: Zustand vs useState — When Local State Isnt Enough

Est. study time: 2h
Language: en

## Learning Objectives
- Identify useState limits: prop drilling, sibling sharing, deep mutation
- Decide when useState suffices vs when Zustand required
- Refactor useState-based shared state to Zustand store
- Apply selective subscription performance pattern

---

## Core Content

### Limits of useState

`useState` ties state to component instance. State lives inside component tree at a specific node. Three problems emerge:

**1. Prop drilling.** State in parent → pass through intermediate components that do not use it.

```typescript
// App holds cart state → passes through Header → Nav → CartIcon
function App() {
  const [cart, setCart] = useState<CartItem[]>([])
  return <Header cart={cart} setCart={setCart} />
}
function Header({ cart, setCart }: { cart: CartItem[], setCart: (c: CartItem[]) => void }) {
  return <Nav cart={cart} setCart={setCart} />
}
function Nav({ cart, setCart }: { cart: CartItem[], setCart: (c: CartItem[]) => void }) {
  return <CartIcon cart={cart} setCart={setCart} />
}
```

Every intermediate component re-renders when cart changes — even if they render no cart data.

**2. Sibling state sharing.** Two siblings need same state. Only option: lift state to common ancestor.

```
      App (state lives here)
     /   \
  ProductList   CartSummary (needs cart state)
```

App re-renders on every cart change → both children re-render. ProductList re-renders even though unrelated.

**3. Deep state mutations.** Objects nested deep require spreading every level.

```typescript
const [config, setConfig] = useState({ ui: { theme: { dark: true } } })
// Toggle dark mode:
setConfig(prev => ({
  ...prev,
  ui: { ...prev.ui, theme: { ...prev.ui.theme, dark: false } }
}))
```

Easy to miss a spread → implicit mutation → stale render.

> **Think**: A profile page has Avatar, BioSection, and SettingsPanel. Avatar reads user name. SettingsPanel updates user name. BioSection reads user bio. Where does useState live? What happens to BioSection when user name updates?
>
> *Answer: useState lives in the closest common ancestor — the Profile page. BioSection re-renders on every name change even though its data (bio) has not changed. This is the sibling-sharing re-render tax.*

### When useState Is Enough

useState is correct choice for:

| Scenario | Example | Why useState wins |
|----------|---------|------------------|
| Local UI state | Accordion open/close, modal visibility, tooltip hover | No other component needs it |
| Form input values | Controlled input value, checkbox checked | State belongs to form component |
| Ephemeral state | Timer countdown, animation frame counter | State dies with component unmount |
| Component-isolated | Pagination page number inside a list | Never shared outside |

Use useState for state that exists only within one component or one parent-child pair. If a second unrelated subtree needs same data, useState becomes wrong tool.

> **Think**: A SearchBar component shows recent searches in a dropdown. Does the search term belong in useState or a store?
>
> *Answer: Search term belongs in useState (local to SearchBar). Recent searches list — if only SearchBar shows it, useState. If a separate AnalyticsWidget tracks search terms too, lift to Zustand.*

### Refactoring useState to Zustand

Pattern: extract shared state into standalone store, replace prop-drilled values with selectors.

**Before (useState — prop drilling):**

```typescript
function App() {
  const [cart, setCart] = useState<CartItem[]>([])
  return (
    <>
      <ProductList cart={cart} setCart={setCart} />
      <CartSummary cart={cart} />   // receives cart via props
    </>
  )
}
```

**After (Zustand — direct access):**

```typescript
import { create } from 'zustand'

interface CartStore {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (id: string) => void
}

const useCartStore = create<CartStore>((set) => ({
  items: [],
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  removeItem: (id) => set((state) => ({ items: state.items.filter(i => i.id !== id) })),
}))

// ProductList: direct access, no props from parent
function ProductList() {
  const addItem = useCartStore((s) => s.addItem)
  return <button onClick={() => addItem({ id: '1', name: 'Hat', price: 20 })}>Add</button>
}

// CartSummary: direct access, no props
function CartSummary() {
  const items = useCartStore((s) => s.items)
  return <div>{items.length} items</div>
}
```

App no longer owns cart state. Intermediate components are unnecessary re-render free.

> **Think**: During refactor, you notice ProductList calls `useCartStore()` without a selector. Is that a problem?
>
> *Answer: Yes. `useCartStore()` without selector subscribes to entire store. Any state change re-renders ProductList. Fix: `useCartStore(s => s.items)` or `useCartStore(s => s.addItem)`. Selective subscriptions prevent over-rendering.*

### Zustand for Cross-Tree State

When components at different tree levels need same state, Zustand eliminates lifting + drilling.

```
Before (useState):
  Page (cart state + toggleSidebar)
    ├─ Header ← cart prop (re-render on cart change)
    │    └─ AccountMenu ← cart prop
    └─ Main
         ├─ Sidebar ← toggleSidebar prop (re-render on cart change!)
         └─ ProductGrid
              └─ ProductCard ← cart prop (re-render on sidebar toggle!)

After (Zustand):
  Page
    ├─ Header → useCartStore(s => s.items)
    ├─ AccountMenu → useCartStore(s => s.items)
    ├─ Sidebar → useSidebarStore(s => s.open)
    └─ ProductCard → useCartStore(s => s.items)
```

Each component subscribes only to slices it needs. Sidebar never re-renders when cart changes. ProductCard never re-renders when sidebar toggles.

> **Think**: Three components read userId. One writes userId. Should they share one Zustand store or each call useState?
>
> *Answer: One Zustand store if userId is same value for all three. Three useState calls create three independent userId values — bug waiting to happen. Zustand ensures single source of truth.*

### Performance: Selective Subscriptions vs Prop Drilling

Prop drilling compounds re-renders:

```
Parent re-renders (state changed)
  └─ ChildA re-renders (got new prop, even if unrelated)
       └─ ChildA1 re-renders
            └─ ChildA1a re-renders
  └─ ChildB re-renders (same)
```

Zustand selective subscriptions prevent this:

```typescript
// Only re-renders when user.name changes
const name = useUserStore((s) => s.user.name)
// Only re-renders when user.avatar changes
const avatar = useUserStore((s) => s.user.avatar)
```

Each component binds to exact path. Zustand uses referential equality (`Object.is`) to skip re-render when selected value unchanged.

**Ripple effect**: With prop drilling, one state change ripples through entire tree. With Zustand, only subscribed components update. In a 200-component tree, a cart badge update re-renders exactly 1 component instead of 50.

> **Think**: A notification bell component subscribes to `store.notifications.count`. A chat sidebar subscribes to `store.chat.messages`. When a new chat message arrives, does the notification bell re-render?
>
> *Answer: No. Notification bell selector reads `notifications.count` — only changes when notifications change. Zustand skips re-render because `notifications.count` reference stayed same. Chat sidebar updates independently.*

### Shopping Cart: useState (Messy) vs Zustand (Clean)

useState version:

```typescript
// App.tsx — owns all cart state
const [cartItems, setCartItems] = useState<CartItem[]>([])
const [coupon, setCoupon] = useState<Coupon | null>(null)

// Every page change: re-pass props
<Header cartCount={cartItems.length} />
<ProductPage cartItems={cartItems} onAddToCart={handleAdd} />
<CartPage cartItems={cartItems} setCartItems={setCartItems} coupon={coupon} setCoupon={setCoupon} />

// handleAdd: spread + push
const handleAdd = (item: CartItem) => {
  setCartItems(prev => [...prev, item])
}
```

Problems: Header re-renders on coupon change. CartPage re-renders when unrelated state triggers App re-render. Testing requires prop injection.

Zustand version:

```typescript
const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  coupon: null,
  total: () => {
    const { items, coupon } = get()
    const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0)
    return coupon ? subtotal * (1 - coupon.discount) : subtotal
  },
  addItem: (item) => set((s) => ({ items: [...s.items, item] })),
  removeItem: (id) => set((s) => ({ items: s.items.filter(i => i.id !== id) })),
  applyCoupon: (coupon) => set({ coupon }),
}))

// Components consume exactly what they need
function Header() {
  const count = useCartStore((s) => s.items.length)
  return <Badge>{count}</Badge>
}
function ProductCard({ product }: { product: Product }) {
  const addItem = useCartStore((s) => s.addItem)
  return <button onClick={() => addItem(product)}>Add</button>
}
function CartPage() {
  const items = useCartStore((s) => s.items)
  const remove = useCartStore((s) => s.removeItem)
  // ...
}
```

Clean: no prop drilling, no unnecessary re-renders, testable independently.

> **Think**: The Zustand version above has a `total()` function on the store. What is a downside of computed values in stores vs using Zustand middleware or external selectors?
>
> *Answer: `get()` inside store creates implicit dependency not tracked by React. If `total()` reads `items` and `coupon`, but component only subscribes to `total()`, it may not re-render when `items` or `coupon` changes. Better: use derived state via selectors or Zustand `subscribeWithSelector` middleware for reactive computed values.*

### Ephemeral vs Persistent/Global State

| Characteristic | Ephemeral (useState) | Persistent/Global (Zustand) |
|----------------|---------------------|---------------------------|
| Lifetime | Component mount → unmount | App lifetime |
| Scope | Single component tree | Entire application |
| Persistence | Loss on refresh | LocalStorage/DB via persist |
| Cross-component | No | Yes |
| Devtools | React DevTools | Zustand DevTools + Redux DevTools |
| Testability | Mount component | Pure function calls |

Use Zustand when state must survive navigation, be shared across routes, persist to storage, or be consumed by non-React code.

> **Think**: A filter panel lets user select date range. When user navigates to detail page and back, filter selection should persist. useState or Zustand?
>
> *Answer: Zustand. useState resets on unmount. Zustand persists across navigation even without persist middleware because store lives outside component tree.*

### Mixing Patterns: useState Inside Components + Zustand Cross-Cutting

Not everything goes in Zustand. Best apps mix both:

```typescript
// Zustand for shared cross-cutting state
const useAppStore = create<AppStore>((set) => ({
  user: null,
  notifications: [],
  theme: 'light',
}))

// Component: useState for ephemeral UI state, Zustand for shared data
function SettingsPanel() {
  const user = useAppStore((s) => s.user)
  const theme = useAppStore((s) => s.theme)

  // Local: form state — no other component needs this
  const [displayName, setDisplayName] = useState(user?.name ?? '')
  const [isDirty, setIsDirty] = useState(false)

  // Local: accordion open/close — UI-only
  const [notifSectionOpen, setNotifSectionOpen] = useState(false)

  // Global: save to store
  const setTheme = useAppStore((s) => s.setTheme)

  return (
    <form>
      <input value={displayName} onChange={e => { setDisplayName(e.target.value); setIsDirty(true) }} />
      <select value={theme} onChange={e => setTheme(e.target.value)}>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
      <button onClick={() => setNotifSectionOpen(o => !o)}>Notifications</button>
      {notifSectionOpen && <NotificationSettings />}
    </form>
  )
}
```

Rule: if only this component cares about the state, useState. If two or more unrelated components care, Zustand.

> **Think**: An input field validates email format and shows error inline. The email value is also used by a sibling component for preview. Which tool for which?
>
> *Answer: useState for input value + validation error (local to field). Zustand for the validated email value (needed by sibling preview component). Write to store on blur or submit, not on every keystroke — avoids re-render storm in sibling.*

### Testing: Component Tests vs Store Tests

useState state tested via component integration tests:

```typescript
// Test: render component, simulate click, assert output
import { render, screen, fireEvent } from '@testing-library/react'
import { Counter } from './Counter'

it('increments count', () => {
  render(<Counter />)
  fireEvent.click(screen.getByText('+'))
  expect(screen.getByTestId('count')).toHaveTextContent('1')
})
```

Zustand store tested independently — no component mount required:

```typescript
import { useCartStore } from './cart-store'

// Reset store between tests
beforeEach(() => {
  useCartStore.setState({ items: [], coupon: null })
})

it('adds item to cart', () => {
  useCartStore.getState().addItem({ id: '1', name: 'Hat', price: 20, qty: 1 })
  expect(useCartStore.getState().items).toHaveLength(1)
})

it('applies coupon discount to total', () => {
  const store = useCartStore.getState()
  store.addItem({ id: '1', name: 'Hat', price: 100, qty: 1 })
  store.applyCoupon({ code: 'SAVE10', discount: 0.1 })
  expect(store.total()).toBe(90)
})
```

Store tests faster, more isolated, catch logic bugs without DOM. Component tests still needed for UI integration.

> **Think**: Your team has slow CI (15 min). Should you prefer store tests or component tests for state logic?
>
> *Answer: Store tests. Store tests are pure function calls — run in milliseconds. Component tests require DOM rendering, take seconds each. Testing state logic at store level catches bugs faster and keeps CI pipeline under 5 minutes. Reserve component tests for UI interactions (click handlers, render output).*

### Decision Tree: useState or Zustand

```
Does any other component need this state?
├─ No → useState (local UI, form input, ephemeral)
└─ Yes → Does the state need to survive navigation/refresh?
        ├─ No → Does lifting to common ancestor cause unnecessary re-renders?
        │     ├─ No → useState lifted to parent
        │     └─ Yes → Zustand
        └─ Yes → Zustand with persist middleware
```

Additional heuristics:

| Heuristic | useState | Zustand |
|-----------|----------|---------|
| State read/written by 1 component | ✓ | Overkill |
| State read at tree level A, written at level D | ✗ Prop drilling | ✓ Direct access |
| State shared across routes | ✗ Lost on nav | ✓ Survives |
| State consumed by non-React code | ✗ | ✓ Store accessible outside React |
| Need time-travel debugging | ✗ | ✓ DevTools |
| Form input value (controlled) | ✓ | Overkill |
| Cart, auth user, notifications, theme | ✗ | ✓ |

> **Think**: A modal component shows a user list fetched from API. Modal open/close state — useState or Zustand? User list data — useState or Zustand?
>
> *Answer: Modal open/close → useState (only modal cares). User list → Zustand or server cache (React Query/SWR). If list is also shown on another page, Zustand shares it. If list is page-specific, server cache handles it without prop drilling.*

---

### Why This Matters

Choosing wrong state tool causes re-render cascades, prop drilling pain, and state sync bugs. useState for global state forces every parent to know about and pass irrelevant data. Zustand for local state adds unnecessary abstraction. This decision appears in every component you write. Engineers who internalize this trade-off produce apps that scale to 100k+ LOC without grinding to a performance halt. Teams that ignore it spend sprint after sprint debugging "why does Sidebar re-render when I type in SearchBox?"

---

### Common Questions

**Q: Does Zustand replace useState entirely?**
A: No. useState handles local, ephemeral, component-isolated state better. Zustand is tool for shared or persistent state. Using Zustand for a checkbox open/close adds unnecessary indirection. Keep useState for what it does best.

**Q: Can I put 100% of state in a single Zustand store like Redux?**
A: You can but should not. Single store grows into bottleneck — every selector re-evaluates on any change. Split stores by domain: user store, cart store, UI store. Each store small, focused, independently testable.

**Q: If I refactor useState to Zustand, do I rewrite all components?**
A: No. Incremental refactor works. Move one piece of shared state at a time. Components that did not consume that state stay unchanged. New components use store directly. Old props left in place but unused — delete gradually.

**Q: Does Zustand work with React Server Components?**
A: Zustand stores are client-side. Do not import server components. Use Zustand inside `'use client'` boundaries. Pass initial server data to store via `setState()` in client component.

**Q: Do I need TypeScript for Zustand?**
A: No but yes. Zustand works with plain JS. TypeScript provides autocomplete and type safety for store shape. Without TS, you risk reading wrong property path silently. Strongly recommended.

---

## Examples

### Example 1: Refactoring a Dashboard with Prop Drilling Pain

**Problem**: Dashboard with 8 top-level widgets. User data, theme, and notification preferences lifted to Dashboard component. Every widget re-renders when theme toggles even though only 2 widgets consume theme.

Dashboard component:
```typescript
function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [prefs, setPrefs] = useState<Preferences>(defaultPrefs)
  // ... passed to 8 children, most receive props they never read
  return (
    <div>
      <Header user={user} theme={theme} />
      <UserCard user={user} />
      <ThemeToggle theme={theme} onToggle={() => setTheme(t => t === 'light' ? 'dark' : 'light')} />
      <NotificationList notifs={notifs} />
      <WidgetA user={user} prefs={prefs} />
      <WidgetB user={user} notifs={notifs} />
      <WidgetC prefs={prefs} />
      <WidgetD theme={theme} />
    </div>
  )
}
```

**Solution**:
1. Create `userStore`, `themeStore`, `notifStore`, `prefsStore` — one per domain
2. Replace prop receives with `use{Name}Store(s => s.xxx)` in each widget
3. Delete prop drilling through Dashboard
4. WidgetC, WidgetD stop re-rendering on theme change (they do not select theme)
5. ThemeToggle re-renders only on theme change, not on notification arrival

**Result**: Widget re-renders drop 62%. Dashboard LOC reduced 40%. Adding new widget — no Dashboard prop changes needed.

### Example 2: Shopping Cart — useState (Messy) to Zustand (Clean)

**Problem**: E-commerce app. Cart state in App component drilled through 5 levels. Adding to cart from ProductCard requires 3 prop hops. Cart page reads from same drilled state. Every component re-renders on every cart change.

**Solution (full refactor shown in Core Content above)**:

Key changes:
- `useCartStore` owns items, coupon, addItem, removeItem, applyCoupon
- `ProductCard` calls `useCartStore(s => s.addItem)` directly — no drill
- `CartPage` calls `useCartStore(s => s.items)` directly
- `Header` calls `useCartStore(s => s.items.length)` — badge updates without re-rendering ProductGrid
- Store testable in isolation: `useCartStore.getState().addItem(...)` → `useCartStore.getState().items`
- persist middleware can save to localStorage in 1 line: `create<CartStore>(persist((set) => ({...}), { name: 'cart' }))`

**Result**: 300 lines of drilling props deleted. Re-renders per add-to-cart: 1 component (badge) instead of 12. Test suite for cart logic: 8ms vs 2.3s (component integration tests).

---

## Key Takeaways
- useState for local, ephemeral, component-isolated state only
- Zustand for state two+ unrelated components need
- Prop drilling causes unnecessary re-renders — Zustand selective subscriptions fix this
- Refactor incrementally: move one shared state slice at a time
- Mix patterns: useState inside components + Zustand for cross-cutting state
- Store testing is faster than component testing for state logic
- Decision tree: single component → useState. Shared → is lifting clean? → useState. Otherwise → Zustand
- Zustand stores survive navigation; useState resets on unmount

## Common Misconception

**"Zustand is just a more complex useState — adding it to a project is over-engineering."**

Zustand does not replace useState. It fills a gap useState cannot cover: shared state across unrelated component subtrees. Without Zustand (or equivalent), developers lift state to highest common ancestor, causing cascading re-renders in components that do not use the state. This is not "engineering" — it is workaround. Zustand is not complexity; it is extraction of shared state into its own domain, which is simpler than drilling props through 5 levels. The over-engineered approach is the one that passes `cartItems` through `Header` → `Nav` → `AccountMenu` → `CartBadge` when only `CartBadge` needs it.

---

## Feynman Explain
(Explain the difference between useState and Zustand to a junior developer who has only built Todo apps. They know React basics but never managed state across multiple components. Use an analogy: a kitchen with one cook (useState) vs a pantry shared by multiple cooks (Zustand). Make them see why sharing food from a single cook's counter does not scale.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain` — AI probes gaps.*

---

## Reframe
(Pause. Critique: Does Zustand encourage putting too much in global state? When does Zustand become the wrong abstraction? Consider maintainability: a team of 20 with Zustand stores everywhere vs a disciplined decision tree. Write your evaluation. Consider trade-offs between prop drilling and store proliferation.)

---

## Drill
Take the quiz. MCQs test recognition of useState limits, decision logic, and refactoring patterns.

Run: `learn.sh quiz zustand-state-management 02-vs-usestate`

## Quiz: 02-vs-usestate


### Three sibling components need read access to the same counter value. One component increments it. What problem does useState create here?

- [ ] A: Each sibling has its own copy of counter — values will diverge

- [✓] B: Counter must be lifted to common ancestor, causing all siblings to re-render on change

- [ ] C: useState cannot store numbers, only strings

- [ ] D: Siblings cannot read state created in another sibling via hooks


**Answer:** B

Lifting state to common ancestor works but forces all siblings to re-render on every change, even siblings that only read, never write. Lösung: Zustand store — each sibling subscribes independently.


### Which of the following is a valid use case for useState?

- [ ] A: Current authenticated user profile

- [ ] B: Shopping cart items shared across routes

- [✓] C: Modal open/close state inside a single component

- [ ] D: Application theme persisted to localStorage


**Answer:** C

Modal open/close is local UI state — only the modal component cares. A, B, D are all cross-cutting or persistent, better suited to Zustand.


### In prop drilling, an intermediate component receives cart prop only to pass it deeper. When cart changes, what happens to the intermediate component?

- [ ] A: It does not re-render because it does not use the prop value

- [✓] B: It re-renders because its props reference changed

- [ ] C: React skips the intermediate component optimizing via bailout

- [ ] D: It re-renders only if it also uses useState


**Answer:** B

React re-renders every component in the parent chain when state changes, regardless of whether the intermediate component uses the prop. Zustand's selective subscriptions avoid this — only subscribed consumers re-render.


### A component calls `useCartStore()` without a selector argument. What is the consequence?

- [ ] A: TypeScript error — selector is required

- [✓] B: Component subscribes to entire store, re-renders on any state change

- [ ] C: Component subscribes to nothing — returns undefined

- [ ] D: Zustand automatically memoizes and prevents unnecessary re-renders


**Answer:** B

`useCartStore()` with no selector returns the entire store state. Any change to any property re-renders the component. Always pass a selector: `useCartStore(s =&gt; s.items)`.


### A search form stores input value in useState. A separate SearchAnalytics component needs to read the search term. What should you do?

- [ ] A: Keep input in useState, pass searchTerm via prop to SearchAnalytics

- [ ] B: Move searchTerm to Zustand store on every keystroke

- [✓] C: Keep input in useState, write validated searchTerm to Zustand store on submit

- [ ] D: Remove useState entirely — put everything in Zustand


**Answer:** C

Input value on every keystroke is local — useState. Sharing the submitted search term with SearchAnalytics is cross-cutting — Zustand. Writing on submit avoids re-render storm in SearchAnalytics on every keystroke.


### During a useState-to-Zustand refactor, which approach is safest?

- [ ] A: Rewrite all components in one branch, deploy together

- [✓] B: Move one state slice at a time, leave unaffected components unchanged

- [ ] C: Create one giant store mirroring the old state shape, then split later

- [ ] D: Delete all useState calls first, then add Zustand equivalents


**Answer:** B

Incremental refactor minimizes risk. Move one piece of shared state → test → deploy. Unaffected components keep working. Giant store creates coupling; deleting first breaks everything simultaneously.


### A Zustand store has `notifications` and `chat.messages`. Component A subscribes to `s =&gt; s.notifications.length`. Component B subscribes to `s =&gt; s.chat.messages`. A new chat message arrives. Does Component A re-render?

- [ ] A: Yes — the store state changed, all subscribers re-render

- [✓] B: No — Component A selected `notifications.length`, which did not change

- [ ] C: Yes — chat.messages.length changed, notifications.length is derived from same root

- [ ] D: No but Component A's parent re-renders, forcing A to re-render anyway


**Answer:** B

Zustand uses referential equality (Object.is) on selected value. `notifications.length` unchanged → Component A skips re-render. Selective subscriptions prevent cascade.


### Which test approach is faster and more isolated for testing cart logic (addItem, removeItem, applyCoupon)?

- [ ] A: Render full App component, simulate button clicks, assert DOM output

- [✓] B: Call `useCartStore.getState().addItem()` directly, assert `useCartStore.getState().items`

- [ ] C: Test via React Testing Library with individual component mount

- [ ] D: Test via Cypress E2E — true user flow


**Answer:** B

Direct store calls are pure function tests — milliseconds, no DOM, catch logic bugs immediately. Component tests add setup overhead. E2E is slowest. Reserve A/C/D for integration, B for state logic.


### A user navigates from Products page to Cart page then back to Products. The cart items persist. The products filter (selected category) resets. Which state tool for which?

- [ ] A: Both in useState

- [✓] B: Cart in Zustand, filter in useState

- [ ] C: Cart in useState, filter in Zustand

- [ ] D: Both in Zustand


**Answer:** B

Cart is cross-cutting and persists across navigation → Zustand. Filter is page-local and should reset on remount → useState. Using decision tree: isolated + ephemeral = useState, shared + persistent = Zustand.


### When should you choose Zustand over lifted useState?

- [ ] A: When state is read by exactly one component

- [✓] B: When state is read by multiple siblings and lifting causes unnecessary re-renders in siblings that do not use the state

- [ ] C: When you want to avoid importing React

- [ ] D: When the state is a string


**Answer:** B

Lifted useState re-renders all children on any change. Zustand selective subscriptions let each child subscribe independently — siblings that do not select the changed slice do not re-render. This is the core advantage of Zustand over lifted state.


---

# Module 3: Zustand vs useReducer: Reducers Without Boilerplate

Est. study time: 2h
Language: en

## Learning Objectives
- Compare useReducer + Context vs Zustand shared store across boilerplate, DX, and performance
- Implement store-based equivalent of action/reducer pattern using Zustand set()
- Apply Immer middleware to replace manual immutable update chains
- Decide when useReducer is correct tool vs when Zustand is better fit

---

## Core Content

### The useReducer Pattern — What It Costs

`useReducer` solves useState limitation: complex state logic with multiple sub-values and transitions. Pattern:

```typescript
// Action types (boilerplate start)
type Action =
  | { type: 'INCREMENT'; payload: number }
  | { type: 'DECREMENT'; payload: number }
  | { type: 'RESET' }
  | { type: 'SET_STEP'; payload: number }

// Reducer (pure function, tests well)
function counterReducer(state: CounterState, action: Action): CounterState {
  switch (action.type) {
    case 'INCREMENT':
      return { ...state, count: state.count + action.payload }
    case 'DECREMENT':
      return { ...state, count: state.count - action.payload }
    case 'RESET':
      return { ...state, count: 0 }
    case 'SET_STEP':
      return { ...state, step: action.payload }
    default:
      return state
  }
}

// Component
function Counter() {
  const [state, dispatch] = useReducer(counterReducer, initialState)
  return <button onClick={() => dispatch({ type: 'INCREMENT', payload: 1 })}>
    {state.count}
  </button>
}
```

Cost per action: union member in Action type, case in switch, spread for immutable update. For 4 actions this is manageable. For 15+ actions (real-world feature), boilerplate grows linearly while comprehension degrades.

Action type constants, reducer function, dispatch calls — three places to update per new action. Violates DRY.

> **Think**: Count the touch points to add a new action. How many files change?
>
> *Answer: Minimum 2 (type definition file + reducer switch). If action constants in separate file, 3. Each dispatch call site is additional touch point. Zustand: add one method to store. One file.*

### Zustand as Reducer Replacement

Zustand `set()` replaces both reducer and dispatch. Same logic:

```typescript
import { create } from 'zustand'

interface CounterStore {
  count: number
  step: number
  increment: (by?: number) => void
  decrement: (by?: number) => void
  reset: () => void
  setStep: (step: number) => void
}

const useCounterStore = create<CounterStore>((set) => ({
  count: 0,
  step: 1,
  increment: (by) => set((state) => ({ count: state.count + (by ?? state.step) })),
  decrement: (by) => set((state) => ({ count: state.count - (by ?? state.step) })),
  reset: () => set({ count: 0 }),
  setStep: (step) => set({ step }),
}))
```

No action types. No reducer function. No switch statement. Each mutation is a function on store that calls `set()` directly.

Key insight: actions are methods not payloads. In useReducer, component dispatches a description of change (action object). In Zustand, component calls a function that performs the change. This inverts control — logic lives in store, not in component.

State updates can use functional form `set(state => result)` for dependent updates (same as useState setter with function).

> **Think**: `set((state) => ({ count: state.count + state.step }))` vs `set((state) => ({ count: state.count + 1 }))`. Why prefer reading from state argument instead of closing over external variable?
>
> *Answer: Functional set reads current state at update time, not at render time. Prevents stale closure bugs when multiple updates batch or when updates happen in async callbacks. Same pattern as React's useState functional updater.*

### Immutability in Zustand

Zustand enforces immutable updates via `set()` — spread operator or Immer.

**Manual spread** (no extra deps):
```typescript
set((state) => ({
  user: {
    ...state.user,
    name: newName,
    settings: {
      ...state.user.settings,
      theme: newTheme,
    }
  }
}))
```

Nested updates produce deeply nested spreads — error-prone and hard to read.

**Immer middleware** (`npm install immer`):
```typescript
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

const useStore = create<Store>()(
  immer((set) => ({
    user: { name: 'Alice', settings: { theme: 'dark', fontSize: 14 } },
    updateTheme: (theme: string) =>
      set((state) => {
        // "mutate" state — Immer captures changes as patches
        state.user.settings.theme = theme
      }),
  }))
)
```

Immer middleware wraps state in Proxies. Draft mutations are converted to immutable updates. No spread chains. TypeScript: `set` receives `WritableDraft<T>` so you can mutate.

Key difference: without Immer, `set({ user: { ...state.user, name: newName } })` overrides entire `user` object. With Immer, `state.user.name = newName` applies only nested change. More natural, fewer bugs.

Bundle cost: Immer ~12KB gzipped. Worth it for deeply nested state. Skip for flat state (1-2 levels).

> **Think**: Your state shape is `{ filters: { category: string, tags: string[], priceRange: [number, number] }, sort: string, page: number }`. Immer or manual spread?
>
> *Answer: Moderate depth (2-3 levels). Manual spread requires 3-level spread for filter changes: `set((state) => ({ filters: { ...state.filters, tags: newTags } }))`. Acceptable. Immer justified if filters get deeper or more fields added. Trade: +12KB bundle vs readability. For this shape, either works — manual spread is fine.*

### When useReducer Is Fine

useReducer is correct default when:
- State is local to one component (no sharing)
- State transitions are well-defined and few (<8 action types)
- Testing reducer function as pure function is desirable
- Component unmounts → state destroyed (ephemeral)

Examples: multi-step form wizard, complex animation tween state, undo/redo stack in text editor.

Zustand adds bundle overhead, global store, and persistence layer where none needed. Do not replace useReducer for one-component complex state. Use strength of each tool.

> **Think**: Text editor with undo/redo — 50+ action types, purely local state. useReducer or Zustand?
>
> *Answer: useReducer is better. Undo/redo stacks are reducer-shaped (current state + action → new state, history stack). No shared state. No consumers outside component. useReducer's pure reducer is easy to test and reason about. Zustand adds nothing here.*

### Zustand vs useReducer + Context (Redux-Lite Pattern)

Common pattern: `useReducer` at top level + Context to pass dispatch to children:

```typescript
const CounterContext = createContext<{
  state: CounterState
  dispatch: React.Dispatch<Action>
} | null>(null)

function CounterProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(counterReducer, initialState)
  return (
    <CounterContext.Provider value={{ state, dispatch }}>
      {children}
    </CounterContext.Provider>
  )
}

function useCounter() {
  const ctx = useContext(CounterContext)
  if (!ctx) throw new Error('useCounter must be in CounterProvider')
  return ctx
}
```

Boilerplate: context type, provider component, context creation, custom hook + error guard. One Contex t provider per slice of state.

Zustand alternative:
```typescript
const useCounterStore = create<CounterStore>(/* ... */)
```

No provider. No context. No error guard. No wrapper component. Everything in one file.

Zustand's `set()` function provides same action-dispatch semantic with less ceremony.

> **Think**: A dashboard has 5 independent state slices — auth, filters, sidebar, notifications, data cache. How many Context providers is that? What nesting depth?
>
> *Answer: 5 Context providers, nested 5 deep around entire app tree. Each adds subtree re-render risk. Zustand: 5 store files, zero nesting, zero providers.*

### Performance: Context Re-renders vs Zustand Selectors

useReducer + Context has fundamental perf issue: **Context value change re-renders all consumers**.

```typescript
const ctx = { state, dispatch }
return <CounterContext.Provider value={ctx}>{children}</CounterContext.Provider>
```

Every `dispatch` creates new `ctx` object → every `useContext(CounterContext)` consumer re-renders, even components that only call `dispatch` and never read `state`.

Optimizations:
- Split Context into separate `StateContext` and `DispatchContext`
- `useMemo` to stabilize dispatch (React does this for useReducer dispatch)
- Still: any state change re-renders all state consumers regardless of which slice they read

Zustand: selectors subscribe to specific slices:

```typescript
function CountDisplay() {
  const count = useCounterStore((s) => s.count)  // re-renders ONLY when count changes
  return <div>{count}</div>
}

function StepDisplay() {
  const step = useCounterStore((s) => s.step)  // re-renders ONLY when step changes
  return <div>{step}</div>
}

function IncrementButton() {
  const increment = useCounterStore((s) => s.increment)  // never re-renders on state change
  return <button onClick={increment}>+</button>
}
```

Selector granularity maps to re-render scope. `IncrementButton` subscribes to function reference — stable if store definition stable. Zero re-renders from state changes.

> **Think**: A ProfilePage uses Context for user state. Avatar component reads `user.avatarUrl`, Bio reads `user.bio`. When avatar changes, does Bio re-render?
>
> *Answer: Yes, if both use same Context. Context doesn't track which fields each consumer reads. Zustand: Avatar selects `(s) => s.user.avatarUrl`. Bio selects `(s) => s.user.bio`. Avatar update only re-renders Avatar component.*

### Code Migration: useReducer → Zustand

Step-by-step for equivalent logic:

**Before** (useReducer + Context):
```typescript
// reducer.ts
export function todoReducer(state: TodoState, action: TodoAction): TodoState {
  switch (action.type) {
    case 'ADD_TODO':
      return { ...state, todos: [...state.todos, action.payload] }
    case 'TOGGLE_TODO':
      return { ...state, todos: state.todos.map(t =>
        t.id === action.payload ? { ...t, done: !t.done } : t
      )}
    case 'REMOVE_TODO':
      return { ...state, todos: state.todos.filter(t => t.id !== action.payload) }
  }
}
```

**After** (Zustand):
```typescript
import { create } from 'zustand'

interface TodoStore {
  todos: Todo[]
  addTodo: (todo: Todo) => void
  toggleTodo: (id: string) => void
  removeTodo: (id: string) => void
}

const useTodoStore = create<TodoStore>((set) => ({
  todos: [],
  addTodo: (todo) => set((state) => ({ todos: [...state.todos, todo] })),
  toggleTodo: (id) => set((state) => ({
    todos: state.todos.map(t => t.id === id ? { ...t, done: !t.done } : t)
  })),
  removeTodo: (id) => set((state) => ({
    todos: state.todos.filter(t => t.id !== id)
  })),
}))
```

Migration algorithm:
1. Create store file with same initial state
2. Convert each reducer case into store method using set()
3. Remove action type definitions
4. Remove Context provider + consumer hooks
5. Update component dispatches to direct method calls: `dispatch({ type: 'ADD_TODO', payload: todo })` → `store.addTodo(todo)`

Each step is safe. Can do incrementally.

> **Think**: What if reducer handles 30 action types? Does migration scale linearly per action?
>
> *Answer: Yes. Each case becomes one method. The method is smaller than case (no action type, no switch wrapper). Migration is mechanical — no architectural rethinking. Automation: codemod that reads reducer switch cases and emits Zustand store methods is feasible but niche.*

### Debugging: Devtools

useReducer works with Redux DevTools via third-party library (e.g., `@redux-devtools/extension`). Setup:
```typescript
import { devToolsEnhancer } from '@redux-devtools/extension'
const [state, dispatch] = useReducer(reducer, initialState, devToolsEnhancer({}))
```

Or through Context-based providers with middleware.

Zustand: built-in `devtools` middleware:
```typescript
import { devtools } from 'zustand/middleware'

const useStore = create<Store>()(
  devtools(
    (set) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 }), false, 'increment'),
    }),
    { name: 'counter-store' }
  )
)
```

Third argument to `set()` is action name displayed in DevTools. Without it, DevTools shows `anonymous`. Named actions improve traceability.

`devtools` middleware is 1 import, 1 wrapper. No separate store enhancer wiring.

> **Think**: A bug report says "count jumped from 5 to 12". With devtools, how do you find what caused it?
>
> *Answer: Open Redux DevTools timeline. Filter by store name. Each set() call appears as action entry with previous state, next state, and action name. Trace through to find which action produced unexpected value. Same workflow as Redux debugging — no extra setup.*

### Testing

useReducer: reducer is pure function. Test directly:
```typescript
describe('counterReducer', () => {
  it('increments count', () => {
    expect(counterReducer({ count: 0, step: 1 }, { type: 'INCREMENT', payload: 1 }))
      .toEqual({ count: 1, step: 1 })
  })
})
```

Zustand: test store directly via `getState()` and `setState()`:
```typescript
import { useCounterStore } from './counter-store'

describe('counterStore', () => {
  beforeEach(() => {
    useCounterStore.setState({ count: 0, step: 1 })
  })

  it('increments count', () => {
    useCounterStore.getState().increment()
    expect(useCounterStore.getState().count).toBe(1)
  })
})
```

Or create fresh store for each test:
```typescript
const createTestStore = () => create<CounterStore>((set) => ({
  count: 0, step: 1,
  increment: () => set((s) => ({ count: s.count + s.step })),
  decrement: () => set((s) => ({ count: s.count - s.step })),
  reset: () => set({ count: 0 }),
  setStep: (step) => set({ step }),
}))
```

Both testable. Zustand store tests exercise more integration (method calls real state changes). useReducer tests are pure unit. Neither is inherently better — difference is test granularity.

Component integration tests: both need render + interact. Zustand benefit: mock store state via `useCounterStore.setState()` without wrapping provider.

> **Think**: How does Zustand reset state between tests without the Context provider reset approach?
>
> *Answer: `useStore.setState(initialState)` directly sets store to baseline. No need to re-mount provider tree. Single line in beforeEach. Faster, less nesting.*

### Decision Guide

| Criterion | useReducer | Zustand |
|-----------|------------|---------|
| State scope | Single component | Any scope (local to global) |
| Consumers | 1 (component + children via props) | Many (any component in app) |
| Action types | < 8 | Any number |
| State depth | Shallow | Any (Immer helps deep) |
| Re-render control | Manual (React.memo, split.Context) | Built-in (selectors) |
| Provider nesting | Required for shared state | None |
| Bundle overhead | 0.3KB (built-in) | ~1.1KB + optional Immer ~12KB |
| DevTools | Third-party setup | Built-in middleware |
| Testing | Pure function unit | Store method integration |

Rule: **useReducer for local complex state. Zustand for shared state.** If state has 1 consumer, prefer useReducer. If state has 2+ consumers at different tree levels, prefer Zustand. If unsure, start with useReducer — extracting to Zustand later is mechanical.

> **Think**: A checkout flow has shipping form (6 fields), payment form (8 fields), and order summary. State is complex but only used during checkout. Single component tree. useReducer or Zustand?
>
> *Answer: useReducer. State is local to checkout page. When user navigates away, state should reset. No other consumers. Context + useReducer inside checkout component is clean. Zustand adds global store where every checkout in different tabs shares state — causes stale data bugs. useReducer correctly scopes state to component lifecycle.*

---

### Why This Matters

useReducer + Context is the most common "mini-Redux" pattern in React codebases. Teams reach for it when useState is insufficient. But Context re-render problem and boilerplate cost accumulate. Zustand solves both problems while preserving the action/mutation mental model. Understanding which tool for which scope — local vs shared — separates clean architecture from tangled state. The Context re-render issue alone causes significant perf regression in production apps. Zustand selectors eliminate entire category of re-render bugs. Every React developer working with anything beyond trivial state needs this comparison.

---

### Common Questions

**Q: Does Zustand replace all useReducer usage?**
A: No. useReducer for local complex state (undo/redo, multi-step form, animation state). Zustand for shared state (cross-component, cross-page). If state resets on unmount, useReducer is likely correct.

**Q: How does Zustand handle side effects that useReducer handles via middleware?**
A: Zustand stores can contain async functions. No middleware needed for side effects. Call API inside store method. For complex orchestration, Zustand has no built-in saga/effect system — use regular async/await or external tool (TanStack Query for server state).

**Q: Can I use useReducer inside a Zustand store?**
A: Yes. Zustand state can include dispatch functions from useReducer. But this is unusual — if you need reducer pattern inside store, convert each case to set() call instead. Mixing both is unnecessary.

**Q: Does Immer middleware affect performance?**
A: Yes, neglibly. Immer uses Proxies to track mutations. For single update, overhead ~0.01ms. For batch updates (1000+ items), manual immutable update may be faster. Premature optimization: write clear code first, profile later.

**Q: How do I type dispatch-style actions for Zustand?**
A: Zustand does not enforce action type pattern. If you prefer dispatched actions, create a single `dispatch` method on store: `dispatch: (action: { type: string, payload?: unknown }) => void`. But this re-introduces boilerplate — not idiomatic Zustand.

---

## Examples

### Example 1: Refactoring Shopping Cart from useReducer + Context to Zustand

**Before** (useReducer + Context):
```typescript
// cart-context.tsx
interface CartState { items: CartItem[], total: number }
type CartAction =
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_QTY'; payload: { id: string; qty: number } }

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM':
      return { ...state, items: [...state.items, action.payload],
        total: state.total + action.payload.price }
    case 'REMOVE_ITEM': {
      const item = state.items.find(i => i.id === action.payload)
      return { ...state, items: state.items.filter(i => i.id !== action.payload),
        total: state.total - (item?.price ?? 0) }
    }
    case 'UPDATE_QTY': {
      const items = state.items.map(i =>
        i.id === action.payload.id ? { ...i, qty: action.payload.qty } : i
      )
      return { ...state, items, total: items.reduce((s, i) => s + i.price * i.qty, 0) }
    }
  }
}

// Provider wraps app, dispatch passed through context
// Every dispatch re-renders all context consumers
```

**After** (Zustand):
```typescript
// cart-store.ts
import { create } from 'zustand'

interface CartStore {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (id: string) => void
  updateQty: (id: string, qty: number) => void
  total: () => number
}

const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  addItem: (item) => set((state) => ({
    items: [...state.items, item],
  })),
  removeItem: (id) => set((state) => ({
    items: state.items.filter(i => i.id !== id),
  })),
  updateQty: (id, qty) => set((state) => ({
    items: state.items.map(i => i.id === id ? { ...i, qty } : i),
  })),
  total: () => get().items.reduce((s, i) => s + i.price * i.qty, 0),
}))

// Components read selectors — ItemsList re-renders only when items change
// AddToCartButton reads only addItem function — never re-renders from state change
// No provider, no context, no action types
```

**Result**: Reducer from 30 lines to 15 lines store. Component code: `dispatch({ type: 'ADD_ITEM', payload: item })` → `useCartStore.getState().addItem(item)`. Or `const { addItem } = useCartStore()` for hook usage.

### Example 2: Multi-Step Form — Keeping useReducer

**Problem**: Checkout wizard with 4 steps (Shipping, Payment, Review, Confirmation). Each step complex, but state is ephemeral — destroyed on successful checkout.

**Architecture**:
```typescript
type Step = 'shipping' | 'payment' | 'review' | 'confirmation'

interface CheckoutFormState {
  currentStep: Step
  shipping: ShippingInfo
  payment: PaymentInfo
  errors: Record<string, string>
}

type CheckoutAction =
  | { type: 'GO_TO_STEP'; payload: Step }
  | { type: 'SET_SHIPPING'; payload: ShippingInfo }
  | { type: 'SET_PAYMENT'; payload: PaymentInfo }
  | { type: 'SET_ERRORS'; payload: Record<string, string> }
  | { type: 'RESET' }

function checkoutReducer(state: CheckoutFormState, action: CheckoutAction) {
  switch (action.type) {
    case 'GO_TO_STEP':
      return { ...state, currentStep: action.payload, errors: {} }
    case 'SET_SHIPPING':
      return { ...state, shipping: action.payload }
    case 'SET_PAYMENT':
      return { ...state, payment: action.payload }
    case 'SET_ERRORS':
      return { ...state, errors: action.payload }
    case 'RESET':
      return initialState
  }
}
```

**Why useReducer stays**: State lives only inside CheckoutPage component. No other component reads it. On successful order, `dispatch({ type: 'RESET' })` clears it. Component unmounts → state garbage collected. Zustand would persist checkout state in global store — risk of stale data across navigation.

**Counterpoint**: If checkout data is needed by order confirmation page (different route), then Zustand is correct. Decision depends on state scope.

### Example 3: Undo/Redo with useReducer

**Problem**: Sketching app — lines, shapes, colors. Undo stack must track every state transition.

useReducer is natural fit because undo is "previous state" replay:
```typescript
function withUndo(reducer: SketchReducer) {
  return (state: UndoableState, action: SketchAction) => {
    const nextPresent = reducer(state.present, action)
    return {
      past: [...state.past, state.present],
      present: nextPresent,
      future: [] as SketchState[],  // clear future on new action
    }
  }
}
```

Zustand can implement undo via `set()` + history array, but useReducer gives undo for free via state history pattern. Zustand advantage disappears when state is purely local.

**Lesson**: Not every pattern needs Zustand. useReducer + Context for single-owner complex state is idiomatic React.

---

### Key Takeaways
- useReducer + Context adds boilerplate: action types, reducer switch, Context provider, consumer hook
- Zustand `set()` replaces reducer + dispatch in <50% lines of code
- Immer middleware eliminates nested spread chains for deep state updates
- Context re-renders all consumers on any change — Zustand selectors prevent this
- useReducer is correct for local complex state with 1 consumer
- Zustand is correct for shared state with 2+ consumers at different tree levels
- Migration from useReducer to Zustand is mechanical (one action → one store method)
- Devtools middleware in Zustand provides same debugging experience as Redux DevTools
- Both are testable: reducer as pure function, store via getState/setState
- Decision heuristic: "does state reset on unmount?" Yes → useReducer. No → Zustand

### Common Misconception

**"Zustand is just a simpler Redux, so it competes with useReducer the same way."**

Zustand competes with useReducer + Context, not useReducer alone. The Context wrapper is where the boilerplate and performance issues live. useReducer without Context — state passed via props — is fine for 1-2 component levels. The moment you reach for Context to share dispatch, Zustand becomes the better choice because it eliminates the provider while keeping the mutation pattern. Also, Zustand's "reducer" is implicit (set() with partial state) vs explicit (switch/case). Both accomplish same thing; Zustand requires fewer files, less typing, and less conceptual overhead. The common error is defaulting to Context + useReducer for any cross-component state because "it's built-in." Built-in does not mean optimal for shared state.

---

### Feynman Explain
(Explain to a colleague who knows Redux Toolkit but has never used Zustand. They understand reducers, actions, dispatch, selectors. Contrast RTK's configureStore/createSlice with Zustand's create/set. Focus on: no action type strings, no createSlice config object, no store configuration, no Provider wrapping. The concept is "Redux Toolkit is a heavy framework; Zustand is a lightweight library that does the same things with 80% less ceremony." Your colleague should walk away thinking "I could migrate a Redux Toolkit slice to Zustand in 10 minutes.")

---

### Reframe
(Pause. Critique: Is the elimination of action types a net positive? Action types serve as documentation — you can grep for 'ADD_TODO' and find every dispatch in codebase. Zustand methods lose this traceability. How do you find all callers of addTodo without type string search? Consider: TypeScript "Find All References" on store method. Does that compensate for lost action type grepability? Write your evaluation. When is explicit action type string actually better than function call? Consider a large team where tracing data flow is critical.)

---

### Drill
Take the quiz. MCQs test boilerplate comparison, migration steps, performance implications, and decision heuristics.

Run: `learn.sh quiz zustand-state-management 03-vs-usecontext`

## Quiz: 03-vs-usereducer


### What touch points are needed to add one new action to a useReducer?

- [ ] A: Add case to reducer switch

- [✓] B: Add union member to Action type + case to reducer switch + update dispatch call sites

- [ ] C: Create new Context provider

- [ ] D: Modify the component's render method only


**Answer:** B

Each action requires: type definition (union member), reducer logic (case in switch), and any dispatch call sites. Minimum 2 files (types + reducer, possibly more if action constants separate). Zustand: add one method to store, update call sites.


### In Zustand, what replaces the useReducer dispatch({ type: 'INCREMENT', payload: 1 }) pattern?

- [ ] A: A switch statement inside the store

- [✓] B: A method on the store that calls set() directly

- [ ] C: An action type constant exported from the store file

- [ ] D: A reducer function passed to create()


**Answer:** B

Zustand stores expose methods that mutate state via set(). `store.increment(1)` replaces `dispatch({ type: 'INCREMENT', payload: 1 })`. No action types, no switch, no reducer.


### A useReducer handles nested state: `state.user.settings.theme`. The equivalent Zustand store without Immer middleware requires what pattern to update the theme?

- [ ] A: state.user.settings.theme = 'dark'

- [✓] B: set((state) =&gt; ({ user: { ...state.user, settings: { ...state.user.settings, theme: 'dark' } } }))

- [ ] C: set({ 'user.settings.theme': 'dark' })

- [ ] D: dispatch({ type: 'SET_THEME', payload: 'dark' })


**Answer:** B

Zustand requires immutable style updates. Without Immer, nested level-3 update needs triple spread. Option A would mutate state directly (invalid). Option C uses dot-path syntax (not supported by default). Option D is useReducer pattern.


### A checkout wizard has 4 steps with complex state used only during checkout. What is the correct tool?

- [ ] A: Zustand — all state belongs in a global store

- [✓] B: useReducer inside the checkout component — state is local and ephemeral

- [ ] C: useReducer + Context — to allow any component to read checkout state

- [ ] D: localStorage — to survive page refreshes


**Answer:** B

Checkout state is local to one component/page and should reset on unmount. useReducer inside the checkout component is correct. Zustand would persist state globally across navigations, risking stale data. Context adds unnecessary provider nesting for single-page state.


### A dashboard uses useReducer + Context for auth state. The Avatar component reads `user.avatarUrl`, the ProfilePanel reads `user.bio`. When avatarUrl changes via dispatch, how many consumer components re-render?

- [ ] A: Only Avatar — React tracks which fields each consumer reads

- [✓] B: All consumers of the Context provider — Context does not track field-level subscriptions

- [ ] C: No components — Context batches re-renders

- [ ] D: Only ProfilePanel — because Context depth affects re-render scope


**Answer:** B

Context re-renders all consumers when value reference changes, regardless of which fields they read. Zustand with selectors would re-render Avatar only when avatarUrl changes, and ProfilePanel only when bio changes. This is the primary performance advantage of Zustand over Context.


### When migrating a useReducer to Zustand, what is the correct first step?

- [ ] A: Delete the reducer function

- [✓] B: Create the Zustand store with equivalent initial state and methods

- [ ] C: Remove the Context provider

- [ ] D: Rewrite all dispatch calls to method calls in components


**Answer:** B

Create the store first — no breaking changes. Then update leaf components one by one to use store selectors instead of dispatch calls. Then remove Context provider and reducer. Incremental migration allows partial adoption without breaking the app at any step.


### A component subscribes to Zustand store via `const count = useStore((s) =&gt; s.count)`. When a store property other than count changes, does this component re-render?

- [ ] A: Yes — every store update re-renders all subscribers

- [✓] B: No — Zustand selector uses Object.is comparison; only re-renders when selector output changes

- [ ] C: Yes — because the selector creates a new reference each call

- [ ] D: No — Zustand uses deep equality by default


**Answer:** B

Zustand compares selector return value using Object.is. If s.count returned same value as previous call, component skips re-render. Only components whose selector output changed re-render. This is the key performance feature — subscribe to minimum state slice.


### A team has useReducer + Context with Redux DevTools. They want equivalent debugging for Zustand. What is needed?

- [ ] A: Install @redux-devtools/extension and wrap useReducer

- [✓] B: Wrap Zustand store with devtools middleware — no additional packages

- [ ] C: Use console.log in every store method

- [ ] D: Zustand cannot integrate with Redux DevTools


**Answer:** B

Zustand includes devtools middleware. Import from `zustand/middleware`, wrap store creator. Third argument to set() provides action name. No additional packages or store enhancer setup required. Same DevTools interface as useReducer + extension.


### A text editor has 30+ actions for formatting, history, selection, and cursor position. State is purely local to the editor component. What is the strongest argument for keeping useReducer over Zustand?

- [ ] A: useReducer is easier to test than Zustand stores

- [✓] B: State is local and ephemeral — useReducer correctly scopes to component lifecycle; Zustand adds global store where none needed

- [ ] C: useReducer handles 30+ actions faster than Zustand

- [ ] D: Zustand cannot handle complex nested state


**Answer:** B

The state should reset when editor unmounts and is not shared elsewhere. useReducer correctly scopes to component lifecycle. Zustand stores are global — state persists across component mounts and would require manual cleanup. Testing argument is neutral (both testable). Performance diff is negligible. Zustand handles complex state fine.


### A notification state is consumed by NavBar, Sidebar, and a floating widget — all at different tree levels. NavBar only reads notification count, Sidebar reads count + list. Using useReducer + Context, what optimization pattern matches Zustand's selector granularity?

- [ ] A: Wrap each consumer in React.memo with custom comparator

- [✓] B: Split into two Context providers: NotificationCountContext and NotificationListContext

- [ ] C: Use useMemo on every context consumer

- [ ] D: Pass individual state values as props from the provider to skip Context


**Answer:** B

Splitting Context by concern approximates Zustand selectors. NavBar subscribes to CountContext, Sidebar subscribes to ListContext. This limits re-render scope but increases provider count. Zustand achieves same with a single store and granular selectors, without multiple providers.


---

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

## Quiz: 04-vs-usecontext


### What triggers a Context consumer to re-render?

- [ ] A: When any component in the tree calls setState

- [✓] B: When the provider's value prop reference changes (new object/array)

- [ ] C: When a sibling context provider updates

- [ ] D: When any component imports the context object


**Answer:** B

React compares provider value with Object.is. If reference changed (new object/array created during render), every consumer re-renders regardless of which fields changed.


### In a Context-based app with 10 consumers and 1 provider, a single field in the context value changes. How many consumers re-render?

- [ ] A: 0 — React batches updates

- [ ] B: 1 — only the consumer reading that field

- [✓] C: 10 — all consumers re-render

- [ ] D: Depends on whether React.memo wraps the consumers


**Answer:** C

Context does not track which fields consumers read. Any value reference change cascades to all consumers. React.memo only checks props, not context value changes.


### What mechanism does Zustand use to subscribe to store changes in React 18+?

- [ ] A: addEventListener on the store

- [✓] B: useSyncExternalStore

- [ ] C: custom setState override in React reconciler

- [ ] D: Proxy-based property tracking


**Answer:** B

useSyncExternalStore is the official React 18+ API for subscribing to external stores. Zustand wraps it internally — it handles subscription, snapshot comparison, and prevents tearing.


### A component calls `useStore()` without a selector argument. How does this affect re-renders?

- [ ] A: It throws a type error — selector is required

- [✓] B: It subscribes to the entire store and re-renders on any state change

- [ ] C: It subscribes to nothing — component never re-renders

- [ ] D: It only re-renders when primitive values in the store change


**Answer:** B

Without a selector, the identity function is used as default — useStore subscribes to the entire state object. Any set() call creates a new state reference, triggering re-render. Always provide a selector for granular subscriptions.


### A team has 8 context providers wrapping the app root. A new feature needs to read auth state inside a cart provider. What must the team verify?

- [ ] A: Nothing — context works regardless of nesting order

- [✓] B: AuthProvider must be outside CartProvider in the nesting order

- [ ] C: CartProvider must be outside AuthProvider

- [ ] D: The team must combine auth and cart into a single context


**Answer:** B

Provider order matters when contexts depend on each other. AuthProvider must be an ancestor of any component that reads auth — including CartProvider. Wrong order means cart cannot access auth context.


### You migrate from Context to Zustand. Which migration order prevents components reading stale state?

- [ ] A: Delete provider first, then migrate all components simultaneously

- [✓] B: Migrate leaf components first, then parent components, delete provider last

- [ ] C: Rename context to store in a single commit

- [ ] D: Rewrite entire app in a feature branch before merging


**Answer:** B

Leaf-to-root migration keeps the provider mounted during transition. As each component switches to useStore(), the provider still exists for unmigrated components. Delete provider only when no component imports it. This prevents stale-state bugs during migration.


### Which state category is still appropriate for React Context rather than Zustand?

- [ ] A: Real-time cursor positions in a collaborative editor

- [✓] B: Theme toggle — user changes it once per session, 20 components read it

- [ ] C: Live stock price feed updating every 100ms

- [ ] D: Form input values in a 50-field survey


**Answer:** B

Theme is low-frequency (changes rarely) with wide fan-out (many consumers). The re-render cost of Context is negligible for rare updates. Zustand is overkill here. Collaborative cursors (A), stock ticks (C), and large forms (D) benefit from Zustand's granular subscriptions.


### Does React 19's use() hook fix the Context re-render cascade?

- [ ] A: Yes — use() subscribes to individual fields like Zustand selectors

- [ ] B: Yes — use() batches all context updates into a single render

- [✓] C: No — use() changes how you read context, not how context propagates changes

- [ ] D: No — use() is deprecated in React 19


**Answer:** C

use() is a read-side mechanism (works in conditionals, early returns). The write-side propagation — provider value change cascading to all consumers — is unchanged. use() does not eliminate re-render cascade.


### A Zustand store has 10 fields. Component A uses `useStore((s) =&gt; ({ a: s.a, b: s.b }))`. What happens to Component A when field c changes?

- [✓] A: Component A re-renders — object selector creates a new reference every time

- [ ] B: Component A does not re-render — selector does not read field c

- [ ] C: Component A re-renders — any store change triggers all subscribers

- [ ] D: Component A throws — selectors must return primitives


**Answer:** A

The selector returns a new object `{ a, b }` every render. Object.is sees a new reference and triggers re-render, even though a and b are unchanged. This is a common pitfall — use shallow equality or primitive selectors for fine-grained subscriptions.


### A test suite has 100 components that read AuthContext. After migrating to Zustand, how does testing change?

- [ ] A: Tests still require AuthProvider wrapper — Zustand is Context underneath

- [✓] B: Tests call useAuthStore.setState() directly — no provider wrappers needed

- [ ] C: Tests require React.StrictMode to work with Zustand

- [ ] D: Zustand stores are read-only in test environments


**Answer:** B

Zustand stores are plain objects with setState. Tests manipulate state directly before rendering, no provider wrappers. This eliminates the boilerplate of wrapping every test in AuthProvider (or multiple providers) and makes test setup declarative.


---

# Module 5: Store Architecture — Separating Logic from Hooks

Est. study time: 2.5h
Language: en

## Learning Objectives
- Apply separation of concerns: actions defined inside `create()`, not in components
- Design store-as-class pattern and hook-based access layer (useBoundStore)
- Compose multiple small stores vs one large store by domain boundary
- Encapsulate private internal state behind a public API surface with TypeScript

---

## Core Content

### Separation of Concerns: Store vs Component

Zustand's `create()` is a single function — easy to cram everything into one file. Discipline required.

**Wrong way — logic in component:**

```typescript
const useCart = create<{ items: CartItem[] }>(() => ({ items: [] }))

function AddToCartButton({ productId }: { productId: string }) {
  const items = useCart((s) => s.items)

  // Business logic leaks into component
  const handleAdd = () => {
    const existing = items.find((i) => i.id === productId)
    if (existing) {
      // Mutating items requires full replace — easy to get wrong
      useCart.setState({
        items: items.map((i) =>
          i.id === productId ? { ...i, quantity: i.quantity + 1 } : i
        ),
      })
    }
  }

  return <button onClick={handleAdd}>Add to cart</button>
}
```

Violation: component knows cart structure, item dedup logic, and quantity increment rules. Test cart logic through component integration tests.

**Right way — logic in store:**

```typescript
interface CartStore {
  items: CartItem[]
  addItem: (productId: string) => void
  removeItem: (productId: string) => void
}

const useCart = create<CartStore>((set, get) => ({
  items: [],
  addItem: (productId) => {
    const existing = get().items.find((i) => i.id === productId)
    if (existing) {
      set({ items: get().items.map((i) =>
        i.id === productId ? { ...i, quantity: i.quantity + 1 } : i
      )})
    } else {
      set({ items: [...get().items, { id: productId, quantity: 1 }] })
    }
  },
  removeItem: (productId) =>
    set({ items: get().items.filter((i) => i.id !== productId) }),
}))

// Component — thin, testable in isolation
function AddToCartButton({ productId }: { productId: string }) {
  const addItem = useCart((s) => s.addItem)
  return <button onClick={() => addItem(productId)}>Add to cart</button>
}
```

Component only knows "there is an `addItem` action." It does not know dedup rules, quantity logic, or data structure.

> **Think**: You extract a function `addItemLogic(items, productId)` outside the store for testability. Where does this function live — in the store file, in a `utils/cart.ts`, or in the component? Why?
>
> *Answer: `utils/cart.ts` — pure functions that operate on plain data are the most testable. Store actions call the pure function, then `set()` the result. This decouples state mutation logic from Zustand's `set`/`get` entirely. Component still knows nothing.*

### Store-as-Class Pattern

Zustand stores can be organized like classes — state + methods that operate on state. The `create()` callback is the constructor, and returned object is instance.

```typescript
interface CounterStore {
  // State
  count: number
  max: number
  min: number

  // Methods (actions)
  increment: () => void
  decrement: () => void
  reset: () => void
}

const useCounter = create<CounterStore>((set, get) => ({
  count: 0,
  max: 100,
  min: 0,

  increment: () => {
    const next = get().count + 1
    if (next <= get().max) set({ count: next })
  },
  decrement: () => {
    const next = get().count - 1
    if (next >= get().min) set({ count: next })
  },
  reset: () => set({ count: 0 }),
}))
```

Store owns all behavior. Component reads state, calls methods. No `setState` calls in components.

Alternative: **standalone action functions** that receive `set` and `get`:

```typescript
// actions/counter.ts
import type { StateCreator } from 'zustand'

export const createCounterActions: StateCreator<CounterStore> = (set, get) => ({
  increment: () => {
    const next = get().count + 1
    if (next <= get().max) set({ count: next })
  },
  decrement: () => { /* ... */ },
  reset: () => set({ count: 0 }),
})

// store.ts
import { create } from 'zustand'
import { createCounterActions } from './actions/counter'

export const useCounter = create<CounterStore>((...a) => ({
  count: 0,
  max: 100,
  min: 0,
  ...createCounterActions(...a),
}))
```

Trade-offs: class-like pattern keeps everything colocated (simple). Standalone action files scale better when actions grow complex (focused files, easier to test independently).

> **Think**: A store has 15 actions, 5 computed getters, and 3 middleware layers. Would you keep all logic inline in `create()` or split into separate action files? What criteria drive this decision?
>
> *Answer: Split. When a store file exceeds ~150 lines, readability drops. Split by concern: one file per action group (cart-actions.ts, cart-computed.ts, cart-middleware.ts). Keep state types in a separate types.ts. Inline works for stores with ≤5 actions.*

### Hook-Based Access: The useBoundStore Pattern

Zustand's `create()` returns a hook. But you can create additional hooks that wrap the base hook to provide pre-configured selectors or scoped access.

```typescript
const useStore = create<AppStore>(/* ... */)

// Bound selectors — reusable across components
export const useUser = () => useStore((s) => s.user)
export const useTheme = () => useStore((s) => s.theme)
export const useNotifications = () => useStore((s) => s.notifications)
export const useCartItems = () => useStore((s) => s.items)

// Action hooks
export const useAddToCart = () => useStore((s) => s.addItem)
export const useLogin = () => useStore((s) => s.login)
```

Components import named hooks instead of raw store. Two benefits:

1. **Selector logic centralized** — change selector shape in one place
2. **Encapsulation** — components cannot accidentally subscribe to entire store by calling `useStore()` without selector

```typescript
// Before: each component writes selectors
function UserName() {
  const user = useStore((s) => s.user)
  return <div>{user.name}</div>
}

// After: centralized selector
function UserName() {
  const user = useUser()
  return <div>{user.name}</div>
}
```

**Mutative action hooks** — useful when action needs props:

```typescript
export const useAddItemToCart = () => {
  const addItem = useStore((s) => s.addItem)
  const items = useStore((s) => s.items)
  return (productId: string) => {
    addItem(productId)
    // Additional logic: analytics, toast notification
    trackEvent('cart_add', { productId, cartSize: items.length + 1 })
  }
}
```

> **Think**: A team uses `useStore()` without selectors everywhere (entire store subscription). They have 50 components on one store. What happens when any single field updates? How does the useBoundStore pattern prevent this?
>
> *Answer: Every component re-renders on every store change — 50 re-renders per update. useBoundStore with per-field hooks forces selector discipline. Component calling `useUser()` only re-renders when user field changes. Centralized selectors make accidental broad subscriptions impossible.*

### Logic Placement: Business Logic vs UI Logic

Clear boundary:

| Logic type | Location | Example |
|------------|----------|---------|
| Business rules | Store actions | `addItem` validates stock, calculates price |
| Data transformation | Store or pure functions | `formatPrice`, `applyDiscount` |
| Side effects (API calls) | Store actions or middleware | `fetchUser` inside `login` action, then `set` |
| UI state (open/close, selected tab) | Store or local `useState` | Dropdown `isOpen` — keep local unless shared |
| Component formatting | Component file | `toUpperCase`, `date-fns` formatting |
| Event handlers | Component file | `onClick → call store action` |

**Store actions** — business logic:

```typescript
const useAuth = create<AuthStore>((set) => ({
  user: null,
  token: null,
  login: async (email: string, password: string) => {
    set({ loading: true, error: null })
    try {
      const { user, token } = await api.login(email, password)
      set({ user, token, loading: false })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },
  logout: () => set({ user: null, token: null }),
}))
```

**Component** — only wires UI to actions:

```typescript
function LoginForm() {
  const login = useAuth((s) => s.login)
  const loading = useAuth((s) => s.loading)
  const error = useAuth((s) => s.error)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    login(email, password)
  }

  return (
    <form onSubmit={handleSubmit}>
      <input value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p className="error">{error}</p>}
      <button disabled={loading}>{loading ? 'Logging in...' : 'Login'}</button>
    </form>
  )
}
```

Component does not call `fetch`. Component does not set `user` or `token`. Component only calls `login(email, password)` and reads state.

> **Think**: A dashboard updates every 3 seconds via WebSocket. The raw socket processing (parsing, dedup, normalization) is 200 lines. Where should this logic live — store action, middleware, or component hook?
>
> *Answer: Middleware or store action. Middleware intercepts `set` calls and processes incoming data. Or store action extracts processing to a pure function. Component should never parse raw websocket messages — component's job is rendering, not data processing.*

### Store Composition: Small Stores vs One Large Store

Zustand does not enforce single store like Redux. You decide granularity.

**Monolithic store:**

```typescript
const useStore = create<AppStore>((set, get) => ({
  // Auth
  user: null, token: null, login: () => {}, logout: () => {},
  // Cart
  items: [], addItem: () => {}, removeItem: () => {},
  // UI
  theme: 'light', sidebar: true, modal: null,
  // Notifications
  notifications: [], pushNotification: () => {}, dismiss: () => {},
}))
```

Problems:
- File grows large
- No clear ownership boundary
- Selectors must slice precisely to avoid re-renders
- State changes in one domain can accidentally affect others (e.g., resetting store clears everything)

**Composed stores:**

```typescript
// stores/authStore.ts
export const useAuth = create<AuthStore>((set) => ({
  user: null, token: null,
  login: async (email, password) => { /* ... */ },
  logout: () => set({ user: null, token: null }),
}))

// stores/cartStore.ts
export const useCart = create<CartStore>((set, get) => ({
  items: [], total: 0,
  addItem: (product) => { /* ... */ },
  removeItem: (id) => { /* ... */ },
}))

// stores/uiStore.ts
export const useUI = create<UIStore>((set) => ({
  theme: 'light', sidebar: true,
  toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
}))
```

Benefits:
- Files are small, focused, independently testable
- Each store has clear domain boundary
- State changes in one store cannot affect another
- Teams can own separate store files

**Cross-store communication** — when one store needs another's state:

```typescript
// cartStore reads auth token for API calls
import { useAuthStore } from './authStore'

const useCart = create<CartStore>((set, get) => ({
  items: [],
  checkout: async () => {
    const token = useAuthStore.getState().token  // Read from another store
    const items = get().items
    await api.checkout(items, token)
    set({ items: [] })
  },
}))
```

Use `.getState()` for cross-store reads inside actions. Never import one store's hook inside another store's create callback — creates circular dependency risk.

> **Think**: You have 8 stores. Two stores need to read each other's state. Is this a sign you should merge them into one store, or keep them separate with cross-store references?
>
> *Answer: First check if stores are truly separate domains. If auth and cart cross-reference frequently, they may be one domain (e-commerce). If they cross-reference once per checkout, keep separate — `.getState()` is fine. Cyclical cross-references (>3 per store) suggest wrong domain boundaries. Merge or extract shared logic into a third store.*

### Encapsulation: Private vs Public API

Zustand stores have no built-in private state. Every property returned from `create()` is accessible to any component. Enforce encapsulation by convention.

**Convention: prefix private state with `_`**:

```typescript
interface AuthStore {
  // Public API
  user: User | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void

  // Private (internal — do not use in components)
  _tokenRefreshTimer: number | null
  _retryCount: number
  _lastRefreshAttempt: number
}
```

**Store definition:**

```typescript
const useAuth = create<AuthStore>((set, get) => ({
  user: null,

  // Public actions
  login: async (email, password) => {
    const { user, token } = await api.login(email, password)
    set({ user, _tokenRefreshTimer: startRefreshTimer(token) })
  },
  logout: () => {
    clearInterval(get()._tokenRefreshTimer!)
    set({ user: null, _tokenRefreshTimer: null })
  },

  // Private — never exposed to components via selectors
  _tokenRefreshTimer: null,
  _retryCount: 0,
  _lastRefreshAttempt: 0,
}))
```

**Bound hooks as public API surface:**

```typescript
// api/useAuth.ts — Public API for components
export const useCurrentUser = () => useAuthStore((s) => s.user)
export const useLoginAction = () => useAuthStore((s) => s.login)
export const useLogoutAction = () => useAuthStore((s) => s.logout)

// Components cannot access private fields via these hooks
// Internal: useAuthStore exists but component never imports it directly
```

Components import from `api/useAuth.ts`, never from `stores/authStore.ts`. This creates the encapsulation boundary.

> **Think**: A junior developer imports `useAuthStore` directly instead of the API hooks. They read `_tokenRefreshTimer` and use it in a component. Who is at fault — the developer or the architecture?
>
> *Answer: Architecture. If raw store import is possible, developers will use it. Enforce encapsulation with a barrel export: `index.ts` re-exports only the API hooks, not the raw store. Or use lint rule: `no-restricted-imports` forbids `stores/authStore` outside store files.*

### TypeScript Patterns: Typed Stores, Typed Actions

**Full typing with interface:**

```typescript
interface TodoStore {
  todos: Todo[]
  filter: 'all' | 'active' | 'completed'
  addTodo: (text: string) => void
  toggleTodo: (id: string) => void
  setFilter: (filter: TodoStore['filter']) => void
  clearCompleted: () => void
  completedCount: () => number
  activeCount: () => number
}

const useTodo = create<TodoStore>()((set, get) => ({
  todos: [],
  filter: 'all',
  addTodo: (text) =>
    set({ todos: [...get().todos, { id: crypto.randomUUID(), text, completed: false }] }),
  toggleTodo: (id) =>
    set({ todos: get().todos.map((t) => t.id === id ? { ...t, completed: !t.completed } : t) }),
  setFilter: (filter) => set({ filter }),
  clearCompleted: () =>
    set({ todos: get().todos.filter((t) => !t.completed) }),
  completedCount: () => get().todos.filter((t) => t.completed).length,
  activeCount: () => get().todos.filter((t) => !t.completed).length,
}))
```

Note `create<TodoStore>()()` — double parentheses. The first `()` passes the type, the second `()` is the actual create call. This syntax enables correct inference for middleware.

**Action types extracted separately:**

```typescript
// types/todo.ts
export interface Todo {
  id: string
  text: string
  completed: boolean
}

export type TodoFilter = 'all' | 'active' | 'completed'

export interface TodoActions {
  addTodo: (text: string) => void
  toggleTodo: (id: string) => void
  setFilter: (filter: TodoFilter) => void
  clearCompleted: () => void
}

export interface TodoComputed {
  completedCount: () => number
  activeCount: () => number
}

export type TodoStore = TodoActions & TodoComputed & {
  todos: Todo[]
  filter: TodoFilter
}
```

Separate type files enable:
- Reuse `Todo`, `TodoFilter`, `TodoActions` across store files, components, tests
- `TodoActions` can be tested independently (mock the store state, call action, check result)
- Docs generated from types

> **Think**: Why does Zustand use `create<T>()()` instead of `create<T>()`? What TypeScript issue does the double-call solve?
>
> *Answer: The double-call enables proper inference when using middleware. `create<T>()(middleware(...))` — the type parameter `T` propagates through middleware types. Single-call loses type info when middleware transforms the store shape. This is a TypeScript design choice, not a Zustand API quirk.*

### Code Organization: Files and Folders

Scale-dependent. Three patterns:

**Pattern A — Single file (≤5 actions, small store):**

```
stores/cartStore.ts
```

Everything in one file.

**Pattern B — Split by type (medium store, 5-15 actions):**

```
stores/cart/
├── types.ts          # CartItem, CartStore interface
├── store.ts          # create() call, middleware
├── actions.ts        # addItem, removeItem, updateQuantity, checkout
├── selectors.ts      # useCartItems, useCartTotal, useCartCount
└── index.ts          # Re-exports public API only
```

**Pattern C — Split by domain (large app, multiple stores):**

```
stores/
├── auth/
│   ├── types.ts
│   ├── store.ts
│   ├── actions.ts
│   ├── selectors.ts
│   ├── middleware.ts
│   └── index.ts
├── cart/
│   ├── types.ts
│   ├── store.ts
│   ├── actions.ts
│   ├── selectors.ts
│   └── index.ts
├── ui/
│   ├── types.ts
│   ├── store.ts
│   ├── selectors.ts
│   └── index.ts
└── index.ts           # Re-exports all public API hooks
```

**Barrel exports for encapsulation:**

```typescript
// stores/cart/index.ts
export { useCartItems, useCartTotal, useCartCount } from './selectors'
export { useCartStore } from './store' // Raw store — exported but discouraged
```

```typescript
// stores/index.ts — app-level public API
export { useAuthUser, useLoginAction, useLogoutAction } from './auth'
export { useCartItems, useCartTotal } from './cart'
export { useTheme, useSidebar } from './ui'
// Intentionally NOT exporting individual stores — components use only selectors
```

Component imports from `stores/index.ts`, never from `stores/auth/store.ts`.

> **Think**: A new developer joins. They open `stores/index.ts` and see 12 named hooks. How does this single import file guide their architecture decisions compared to importing from 8 different store files?
>
> *Answer: The barrel file communicates "these are the approved ways to interact with state." New devs learn the public API in one place. They have no reason to import raw stores. This is the Zustand equivalent of Redux's `mapStateToProps` — a defined contract between state and UI.*

### Real Example: Complex Store with Actions, Computed Values, Middleware

**Problem**: Dashboard store with user data, real-time metrics, theme, and notification state. Must persist theme preference, log actions in dev, and compute derived values.

```typescript
// stores/dashboard/types.ts
export interface Metric {
  id: string
  label: string
  value: number
  change: number // percentage change
  trend: 'up' | 'down' | 'flat'
}

export interface Notification {
  id: string
  message: string
  type: 'info' | 'warning' | 'error'
  read: boolean
  timestamp: number
}

export interface DashboardState {
  user: { name: string; role: 'admin' | 'viewer' }
  metrics: Metric[]
  notifications: Notification[]
  theme: 'light' | 'dark'
  sidebarOpen: boolean
  selectedMetricId: string | null
}

export interface DashboardActions {
  fetchMetrics: () => Promise<void>
  addNotification: (n: Omit<Notification, 'id' | 'timestamp'>) => void
  markNotificationRead: (id: string) => void
  clearNotifications: () => void
  toggleTheme: () => void
  toggleSidebar: () => void
  selectMetric: (id: string) => void
}

export type DashboardStore = DashboardState & DashboardActions
```

```typescript
// stores/dashboard/selectors.ts
import { useDashboardStore } from './store'

// State selectors
export const useMetrics = () => useDashboardStore((s) => s.metrics)
export const useTheme = () => useDashboardStore((s) => s.theme)
export const useNotifications = () => useDashboardStore((s) => s.notifications)
export const useSidebarOpen = () => useDashboardStore((s) => s.sidebarOpen)
export const useSelectedMetric = () => useDashboardStore((s) => {
  const id = s.selectedMetricId
  return id ? s.metrics.find((m) => m.id === id) : null
})

// Computed selectors
export const useMetricsSummary = () => useDashboardStore((s) => {
  const metrics = s.metrics
  return {
    total: metrics.length,
    avgChange: metrics.reduce((sum, m) => sum + m.change, 0) / metrics.length,
    upCount: metrics.filter((m) => m.trend === 'up').length,
    downCount: metrics.filter((m) => m.trend === 'down').length,
  }
})

export const useUnreadCount = () => useDashboardStore((s) =>
  s.notifications.filter((n) => !n.read).length
)

// Action selectors
export const useFetchMetrics = () => useDashboardStore((s) => s.fetchMetrics)
export const useToggleTheme = () => useDashboardStore((s) => s.toggleTheme)
export const useAddNotification = () => useDashboardStore((s) => s.addNotification)
```

```typescript
// stores/dashboard/store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DashboardStore } from './types'
import { createDashboardActions } from './actions'

const initialState: Omit<DashboardStore, keyof DashboardActions> = {
  user: { name: 'Alice', role: 'admin' },
  metrics: [],
  notifications: [],
  theme: 'light',
  sidebarOpen: true,
  selectedMetricId: null,
}

export const useDashboardStore = create<DashboardStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      ...createDashboardActions(set, get),
    }),
    {
      name: 'dashboard-storage',
      partialize: (state) => ({ theme: state.theme }), // Only persist theme
    }
  )
)
```

```typescript
// stores/dashboard/actions.ts
import type { StateCreator } from 'zustand'
import type { DashboardStore, Notification } from './types'

export const createDashboardActions: StateCreator<DashboardStore> = (set, get) => ({
  fetchMetrics: async () => {
    const data = await api.getMetrics()
    set({ metrics: data })
  },
  addNotification: (n) =>
    set({ notifications: [
      { ...n, id: crypto.randomUUID(), timestamp: Date.now() },
      ...get().notifications,
    ]}),
  markNotificationRead: (id) =>
    set({ notifications: get().notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    )}),
  clearNotifications: () => set({ notifications: [] }),
  toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  selectMetric: (id) => set({ selectedMetricId: id }),
})
```

```typescript
// stores/dashboard/index.ts
export {
  useMetrics,
  useTheme,
  useNotifications,
  useSidebarOpen,
  useSelectedMetric,
  useMetricsSummary,
  useUnreadCount,
  useFetchMetrics,
  useToggleTheme,
  useAddNotification,
} from './selectors'
```

**Component usage:**

```typescript
import { useMetrics, useUnreadCount } from '../stores/dashboard'

function DashboardHeader() {
  const metrics = useMetrics()
  const unread = useUnreadCount()
  // ...
}
```

> **Think**: The `useMetricsSummary` selector returns a new object on every store change (because `s.metrics` changes reference). Even if values are the same, the component re-renders. How do you fix this unnecessary re-render?
>
> *Answer: Add equality function: `useDashboardStore((s) => {...}, shallow)` using Zustand's `shallow` comparator. Or use `createSelector`-style memoization. Or split computed values into individual primitives (`useUpCount`, `useDownCount`) so each returns a stable reference (number).*

---

### Why This Matters

Wrong architecture in Zustand leads to stores where actions live in components, state is untyped, selectors are duplicated across files, and refactoring store shape requires changing 30 components. Proper store architecture — actions defined in `create()`, encapsulated behind selector hooks, organized by domain — produces stores that are testable, refactorable, and scalable. The difference between "Zustand as a global useState" and "Zustand as a well-architected state layer" is the difference between a codebase that fights you and one that accelerates you.

---

### Common Questions

**Q: Should I put all state in one big store or split into many small stores?**
A: Split by domain boundary. Auth, cart, UI, notifications are separate concerns — separate stores. Merging them creates a single file that every developer touches and every change risks cross-domain bugs. Use multiple stores by default, merge only when cross-store communication becomes excessive.

**Q: How do I share logic between stores (e.g., logging every state change)?**
A: Middleware. `zustand/middleware` provides built-in middleware (`persist`, `devtools`, `immer`, `subscribeWithSelector`). Custom middleware wraps `set` to intercept all changes. Add once, applies to all stores.

**Q: Can I call a store action from outside React (e.g., a WebSocket handler)?**
A: Yes. Use `useStore.getState().actionName()` — the vanilla store is accessible without React. Import the store and call `getState()` any time, anywhere. This is why Zustand works outside React.

**Q: How do I test store actions in isolation?**
A: Create store in test with `create()` and mock initial state. Call actions directly: `store.getState().addItem('abc')`. Assert state after action. No React needed. For async actions, await the action call. Zustand stores are the most testable state management pattern because they are plain functions.

**Q: When should I extract actions from the store file into separate action files?**
A: When store file exceeds ~150 lines, or when actions have complex logic that would benefit from focused unit tests. Rule: if you are scrolling past action definitions to find state, split. If actions use external services (API, localStorage), extract for mockability.

---

## Examples

### Example 1: Refactoring Logic Out of Components

**Problem**: Two components (`ProductList` and `ProductDetail`) both contain duplicate logic for adding items to cart — same dedup, same quantity increment, same analytics tracking.

**Before** — logic duplicated in both components:

```typescript
function ProductList() {
  const setState = useCartStore.setState
  const items = useCartStore.getState().items

  const handleAdd = (product) => {
    const existing = items.find((i) => i.id === product.id)
    const updated = existing
      ? items.map((i) => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      : [...items, { ...product, quantity: 1 }]
    setState({ items: updated })
    analytics.track('cart_add', { productId: product.id })
  }
  // ...
}
```

**After** — logic extracted to store action, analytics in middleware:

```typescript
const useCart = create<CartStore>((set, get) => ({
  items: [],
  addItem: (product) => {
    const existing = get().items.find((i) => i.id === product.id)
    set({
      items: existing
        ? get().items.map((i) => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
        : [...get().items, { ...product, quantity: 1 }]
    })
  },
}))

// Middleware for analytics
const useCart = create<CartStore>()(
  analyticsMiddleware(/* tracks every set call */)
)(/* store definition */)
```

```typescript
function ProductList() {
  const addItem = useCart((s) => s.addItem)
  const handleAdd = (product) => addItem(product)
  // ...
}
```

**Result**: Logic in one place. Components are thin. Tests verify store, not DOM. Analytics fires automatically via middleware — no manual tracking calls.

### Example 2: Multi-Store Architecture for an E-Commerce App

**Problem**: E-commerce app with auth, product catalog, cart, checkout, and UI state. Need clear separation, cross-store checkout flow, and persisted cart.

```typescript
// stores/authStore.ts — session management
export const useAuth = create<AuthStore>((set) => ({
  user: null, token: null,
  login: async (email, pwd) => { /* API call, set user + token */ },
  logout: () => set({ user: null, token: null }),
}))

// stores/cartStore.ts — persisted, reads auth for API calls
export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (product) => { /* dedup, increment quantity */ },
      removeItem: (id) => { /* filter out */ },
      checkout: async () => {
        const token = useAuth.getState().token
        await api.checkout(get().items, token)
        set({ items: [] })
      },
    }),
    { name: 'cart-storage' }
  )
)

// stores/catalogStore.ts — server-synced, not persisted
export const useCatalog = create<CatalogStore>((set) => ({
  products: [], categories: [], loading: false,
  fetchProducts: async () => { /* API call, set products */ },
  setCategory: (cat) => set({ selectedCategory: cat }),
}))

// stores/uiStore.ts — ephemeral UI state
export const useUI = create<UIStore>((set) => ({
  sidebarOpen: true, modal: null, viewMode: 'grid',
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  openModal: (modal) => set({ modal }),
  closeModal: () => set({ modal: null }),
}))
```

```typescript
// Checkout page — combines multiple stores
function CheckoutPage() {
  const items = useCart((s) => s.items)
  const user = useAuth((s) => s.user)
  const checkout = useCart((s) => s.checkout)
  const closeModal = useUI((s) => s.closeModal)

  const handlePlaceOrder = async () => {
    await checkout()
    closeModal()
    // Cart cleared automatically after checkout
  }

  return (
    <div>
      <OrderSummary items={items} />
      <ShippingInfo user={user} />
      <button onClick={handlePlaceOrder}>Place Order</button>
    </div>
  )
}
```

**Result**: 4 focused stores, each < 100 lines. Checkout page reads from 3 stores — no monolithic store needed. Cart persisted across sessions. Auth token read cross-store for API calls.

### Example 3: TypeScript-Only Encapsulation with Barrel Exports

**Problem**: Team needs to prevent components from reading private store fields. No lint rule available.

```typescript
// stores/timer/types.ts
export interface TimerState {
  elapsed: number
  isRunning: boolean
  _startTime: number | null  // Private — underscore convention
  _intervalId: ReturnType<typeof setInterval> | null  // Private
}

export interface TimerActions {
  start: () => void
  stop: () => void
  reset: () => void
}

export type TimerStore = TimerState & TimerActions
```

```typescript
// stores/timer/store.ts
import { create } from 'zustand'
import type { TimerStore } from './types'

export const useTimerStore = create<TimerStore>((set, get) => ({
  elapsed: 0,
  isRunning: false,
  _startTime: null,
  _intervalId: null,

  start: () => {
    const _startTime = Date.now() - get().elapsed
    const _intervalId = setInterval(() => {
      set({ elapsed: Date.now() - get()._startTime! })
    }, 100)
    set({ isRunning: true, _startTime, _intervalId })
  },
  stop: () => {
    clearInterval(get()._intervalId!)
    set({ isRunning: false, _intervalId: null })
  },
  reset: () => {
    clearInterval(get()._intervalId!)
    set({ elapsed: 0, isRunning: false, _startTime: null, _intervalId: null })
  },
}))
```

```typescript
// stores/timer/selectors.ts
import { useTimerStore } from './store'

// Public API — only these are exported
export const useElapsed = () => useTimerStore((s) => s.elapsed)
export const useIsRunning = () => useTimerStore((s) => s.isRunning)
export const useStart = () => useTimerStore((s) => s.start)
export const useStop = () => useTimerStore((s) => s.stop)
export const useReset = () => useTimerStore((s) => s.reset)
```

```typescript
// stores/timer/index.ts
export {
  useElapsed,
  useIsRunning,
  useStart,
  useStop,
  useReset,
} from './selectors'
// Note: useTimerStore and TimerStore are NOT exported
```

```typescript
// Component — can only access public API
import { useElapsed, useStart, useStop } from '../stores/timer'
// import { useTimerStore } from '../stores/timer/store'  // Works but discouraged
// useTimerStore.getState()._intervalId  // Convention says no
```

**Result**: Encapsulation by convention + barrel exports. Component sees only `useElapsed`, `useStart`, `useStop`. Private `_intervalId` and `_startTime` never appear in autocomplete. Team convention prevents direct store imports.

---

## Key Takeaways
- Actions defined inside `create()`, not in components — component only wires UI
- Store-as-class pattern: state + methods co-located, standalone action files for scale
- useBoundStore pattern centralizes selectors, prevents accidental full subscriptions
- Business logic in store actions, UI logic in components, side effects in middleware
- Prefer many small stores by domain over one monolithic store
- Cross-store reads via `.getState()` for occasional communication
- Enforce encapsulation with `_` prefix convention and barrel exports
- TypeScript interfaces define store contract: state types, action types, computed types
- Barrel files (`index.ts`) expose only public API — raw store import discouraged
- Split store files by type (types.ts, store.ts, actions.ts, selectors.ts) at scale
- `create<T>()()` syntax enables proper middleware type inference
- Computed selectors return new references — use `shallow` or memoize to prevent re-renders

## Common Misconception

**"Zustand replaces component-level state management — put everything in the store."**

Zustand is for cross-component state, not a replacement for local state. UI-only state (dropdown open, form input values, selected tab, tooltip visibility) should stay in `useState` or component-local hooks. Putting UI toggle state into a global store creates unnecessary re-renders across unrelated components and makes the store file grow with one-off flags. Rule: if only one component (and its children) needs a piece of state, keep it local. Only promote to Zustand when two or more unrelated components need to share that state or react to its changes.

---

## Feynman Explain
(Explain store architecture to a junior developer who knows `useState` but has never used Zustand or Redux. They understand: components render UI, state drives rendering, props pass data down. They do NOT know: store, subscriber, selector, middleware. Use only these words in explanation: "global box", "label", "recipe card", "intercom", "public counter window.")

*When ready, say explanation aloud or write it down. Then run `learn.sh explain zustand-state-management` — AI probes gaps.*

---

## Reframe
(Pause. Judge: Is "always split into small stores" universally correct? When does a single large store outperform multiple small stores? Consider: cross-store synchronization overhead, transaction atomicity (reset all state at once), devtools debugging with multiple stores, and performance (single subscriber vs many). Write your evaluation.)

---

## Drill
Take the quiz. MCQs test store architecture decisions, encapsulation patterns, TypeScript typing, and code organization trade-offs.

Run: `learn.sh quiz zustand-state-management 05-public-private-api`

## Quiz: 05-store-architecture


### Where should business logic for adding an item to a cart be defined in a well-architected Zustand store?

- [ ] A: Inside the component's event handler

- [ ] B: In a useEffect hook

- [✓] C: Inside the create() store as an action method

- [ ] D: In a separate utility function called from the component


**Answer:** C

Actions should be defined inside create() so the store owns its mutation logic. Components only call actions — they should not contain dedup, quantity rules, or data transformation.


### What problem does the useBoundStore pattern solve?

- [ ] A: It eliminates the need for TypeScript types

- [✓] B: It centralizes selectors so components cannot accidentally subscribe to the entire store

- [ ] C: It replaces Zustand's create() function

- [ ] D: It automatically persists state to localStorage


**Answer:** B

useBoundStore creates pre-configured selector hooks (useUser, useTheme, etc.). Components import these instead of raw useStore() — preventing accidental full-store subscriptions that cause unnecessary re-renders.


### A Zustand store has private timer state (`_intervalId`, `_startTime`). What is the idiomatic way to prevent components from accessing these private fields?

- [ ] A: Use JavaScript private class fields (#)

- [✓] B: Prefix with underscore (_) by convention and use barrel exports to expose only public selector hooks

- [ ] C: Store private state outside Zustand in a module-level variable

- [ ] D: Store private state in a separate JavaScript file


**Answer:** B

Zustand has no built-in encapsulation. Convention is `_` prefix for private fields + barrel exports (index.ts) that re-export only public selector hooks. Components import from barrel, never from raw store file.


### You have 8 small Zustand stores. Store A needs to read Store B's token for an API call during checkout. How should Store A access Store B's state?

- [ ] A: Import Store B's hook inside Store A's create() callback

- [ ] B: Merge both stores into one monolithic store

- [✓] C: Use useStoreB.getState().token inside Store A's action method

- [ ] D: Pass the token as a prop from the parent component


**Answer:** C

Use .getState() for occasional cross-store reads inside actions. This avoids circular dependencies and keeps stores independent. Merging stores loses domain boundaries. Importing hooks inside create() risks circular deps.


### A store file exceeds 200 lines with 15 actions and complex async logic. What code organization pattern should you adopt?

- [ ] A: Keep everything inline — one file is simpler

- [✓] B: Split into types.ts, store.ts, actions.ts, and selectors.ts files

- [ ] C: Move all actions into a separate npm package

- [ ] D: Convert all actions to React custom hooks


**Answer:** B

At ~150+ lines, split by type: types.ts (interfaces), store.ts (create() call + middleware), actions.ts (standalone action creators), selectors.ts (bound selector hooks). Each file stays focused and testable.


### A `useMetricsSummary` selector computes `{ total, avgChange, upCount, downCount }` from store state. Every store change re-renders the component even when computed values are identical. What is the fix?

- [ ] A: Move the selector into the component

- [✓] B: Use Zustand's `shallow` equality comparator or split into individual primitive selectors

- [ ] C: Add a dependency array to the selector

- [ ] D: Wrap the component in React.memo


**Answer:** B

The selector returns a new object reference each call, causing re-render. Fix: use `useStore(selector, shallow)` to compare values, or split into individual selectors (useUpCount, useDownCount) that return stable primitives.


### Why does Zustand use `create&lt;T&gt;()()` (double parentheses) instead of `create&lt;T&gt;()`?

- [ ] A: It is a syntax error — single call is correct

- [✓] B: The double call enables proper TypeScript inference when middleware transforms the store shape

- [ ] C: It creates two instances of the store

- [ ] D: It is required for the persist middleware only


**Answer:** B

The double-call `create&lt;T&gt;()(middleware(...))` allows the type parameter T to propagate through middleware types. Single-call loses type information when middleware transforms the store shape. It is a TypeScript design pattern, not a runtime behavior.


### A WebSocket handler needs to update a Zustand store when new data arrives. The handler runs outside React. How should it call store actions?

- [ ] A: Wrap the handler in a React component

- [✓] B: Call useStore.getState().actionName() directly from the handler

- [ ] C: Dispatch a custom DOM event that a React listener handles

- [ ] D: Create a second copy of the store for non-React code


**Answer:** B

Zustand's vanilla store works outside React via getState() and setState(). Import the store module and call getState() from any JS context — WebSocket handlers, timers, Node scripts, workers.


### What is the correct type structure for splitting a Zustand store into reusable TypeScript interfaces?

- [ ] A: One monolithic interface for the entire store

- [✓] B: Separate interfaces for state, actions, and computed values, combined with intersection types

- [ ] C: Use `any` to avoid complex typing

- [ ] D: Define actions in the component props only


**Answer:** B

Split into State, Actions, and optionally Computed interfaces. Combine with intersection types (type Store = State &amp; Actions &amp; Computed). This allows reusing action types in tests, generating docs from types, and maintaining clear separation.


### A dashboard has a toggle button for sidebar visibility. Only the sidebar component and its toggle button care about this state. Where should `sidebarOpen` live?

- [ ] A: In the global Zustand store alongside auth and cart state

- [✓] B: In the component's local useState, promoted to Zustand only if another unrelated component needs it

- [ ] C: In a Context provider

- [ ] D: In a Redux store


**Answer:** B

UI-only state (toggle open/close, selected tab, tooltip) should stay local with useState. Only promote to Zustand when two or more unrelated components share the state. Putting every toggle in global store creates unnecessary re-renders and file bloat.


---

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

## Quiz: 06-public-private-api


### What is the primary purpose of store encapsulation in Zustand?

- [ ] A: To reduce the bundle size of the application

- [✓] B: To hide internal implementation details so components depend on a stable public API

- [ ] C: To prevent runtime errors from TypeScript type mismatches

- [ ] D: To enforce immutability of all store state


**Answer:** B

Store encapsulation creates a boundary between internal implementation (private fields, cache, raw data) and the public API (selectors + actions). Components depend on the stable public API, so internal refactors never break consumers.


### What does the underscore prefix (`_`) convention signal in a Zustand store?

- [ ] A: The field is computed asynchronously

- [ ] B: The field is deprecated and will be removed

- [✓] C: The field is internal — components should not read it directly

- [ ] D: The field is only available in development mode


**Answer:** C

Fields prefixed with `_` are internal implementation details. The convention signals that components should not read these fields directly. It is a team convention, not enforced by Zustand or TypeScript at runtime.


### A team has a store file with barrel export (index.ts). A component imports `useSearchStore` from the raw store file instead of using barrel exports. What is the best enforcement mechanism?

- [ ] A: Rename the store file so it is harder to find

- [ ] B: Add a comment in the store file saying 'do not import directly'

- [✓] C: Configure ESLint no-restricted-imports rule to block imports from */store.ts outside store directory

- [ ] D: Move the store definition into the barrel file


**Answer:** C

Convention without enforcement is suggestion. ESLint's no-restricted-imports blocks raw store imports at compile time. Code review and documentation help, but lint rules provide automated enforcement.


### You are refactoring a store: changing `_cache` from a plain object to a `WeakMap`. The public selectors are unchanged. How many components should you modify?

- [ ] A: All components that import the store

- [ ] B: All components that read `_cache` directly

- [✓] C: Zero — if public selectors are unchanged and components only use selectors

- [ ] D: All components that use the `useCache` selector


**Answer:** C

If components only consume public selectors (which return the same shape), the internal refactor is invisible. Zero component changes. This is the value of encapsulation: internal changes decoupled from consumer code.


### A store has a field `isLoading` that both components (for showing spinners) and internal actions (for gating retry logic) read. Where should `isLoading` be categorized?

- [ ] A: Internal — prefix with `_isLoading`

- [✓] B: Public — it serves dual purpose and both consumers read the same value

- [ ] C: Split into `_isLoadingInternal` and `isLoadingPublic`

- [ ] D: Store it in module-scoped state instead


**Answer:** B

Encapsulation means components should not depend on fields that only exist for internal bookkeeping. A field that serves both purposes is correctly public. Components show spinners, actions check retry gates — both read the same boolean.


### Which approach provides the strongest encapsulation for data that must never reach components (e.g., WebSocket connection manager)?

- [ ] A: Store it as a `_` prefixed field in the Zustand store

- [ ] B: Store it in React context

- [✓] C: Store it as a module-scoped variable outside the create() callback

- [ ] D: Store it in a ref inside a component


**Answer:** C

Module-scoped variables are truly private — not part of the store type, invisible in devtools, inaccessible via getState(). The `_` prefix is convention; module scope is enforcement. Use for data that must never leak (connections, batches, secrets).


### An OrderSummary component computes `total = subtotal - discount + tax`. After refactoring, the store exposes `useCartTotal()` selector. What is the benefit?

- [ ] A: Component re-renders fewer times

- [✓] B: Component no longer knows discount rules, tax rates, or item structure — pricing logic is centralized in the store

- [ ] C: TypeScript can infer the total type automatically

- [ ] D: The discount logic runs faster in the store


**Answer:** B

Moving computation to a selector encapsulates pricing logic. If discount rules change, only the selector changes — all consuming components are unaffected. The component's job is rendering, not implementing business rules.


### A test needs to verify that `processRawFeed` correctly filters archived notifications. What is the best testing approach?

- [ ] A: Render a React component with a mock store and check the DOM

- [ ] B: Create a Zustand store with test data and call store.getState().processRawFeed()

- [✓] C: Import the pure function directly and test it with various inputs

- [ ] D: Use end-to-end browser tests


**Answer:** C

Pure functions are the most testable — no store, no React, no mocking. `processRawFeed(raw)` takes input, returns output. Test with different raw data shapes. This is faster, more isolated, and more reliable than testing through the store or DOM.


### A selector `useCartSummary` returns `{ subtotal, tax, total }`. Every store change re-renders the component even when values are identical. What is the fix?

- [ ] A: Move the selector into the component body

- [✓] B: Use Zustand's `shallow` equality comparator on the selector

- [ ] C: Add `useCallback` to the selector

- [ ] D: Split the store into smaller stores


**Answer:** B

The selector returns a new object reference each call, causing re-render. `useStore(selector, shallow)` compares values instead of references. Alternatively, split into individual primitive selectors (useSubtotal, useTax, useTotal) that return stable numbers.


### Store v1 has `_rawApiResponse` as an internal field. Store v2 restructures to use `_normalizedData` and removes `_rawApiResponse`. Components that use the public API (selectors) are unaffected. What principle does this demonstrate?

- [ ] A: Backwards compatibility through type coercion

- [✓] B: Internal state versioning without breaking consumers

- [ ] C: Store migration via middleware

- [ ] D: Lazy initialization of private fields


**Answer:** B

When public selectors remain stable, internal state can be freely restructured — renamed, removed, added. The public API contract (selector return types) is the stability boundary. Internal state versioning is invisible to consumers who only use selectors.


---

# Module 7: Redux Pattern in Zustand — Reducers, Dispatch, Actions

Est. study time: 2.5h
Language: en

## Learning Objectives
- Implement reducer pattern inside Zustand store for complex state transitions
- Compare and contrast action-creator functions vs string-constant action types
- Integrate Redux DevTools middleware for debugging Zustand stores
- Decide when reducer pattern benefits vs direct `set()` mutations
- Test reducer logic in isolation and store integration

---

## Core Content

### Zustand's `set()` Is Already a Dispatch

Every Zustand store uses `set()` to update state. This is conceptually identical to Redux's `dispatch`:

```typescript
// Redux
dispatch({ type: 'todos/add', payload: { text: 'Learn Zustand' } })

// Zustand
set({ todos: [...state.todos, { text: 'Learn Zustand', done: false }] })
```

The difference: Redux enforces action objects pass through a reducer. Zustand lets you mutate state directly inside `set()` — or pass a reducer function. Both achieve same result. Zustand chooses freedom over ceremony.

The Redux pattern in Zustand means you voluntarily introduce action objects and reducer functions. You gain predictability, undo/redo, and DevTools tracing. You lose simplicity.

> **Think**: You have a form with 3 fields and a submit button. Should you use the Redux pattern or direct set()? What criterion decides?
>
> *Answer: Direct set(). Three fields do not need action types and a reducer — unnecessary ceremony. Criterion: if state transition logic fits in one `set()` call without conditionals, direct mutation wins. Reducer pattern adds value when multiple action types produce different state shapes from the same store slice.*

### Reducer Pattern Inside Zustand

A reducer is a pure function `(state, action) => state`. Zustand lets you inline it:

```typescript
import { create } from 'zustand'

type Action =
  | { type: 'todo/add'; text: string }
  | { type: 'todo/toggle'; id: number }
  | { type: 'todo/remove'; id: number }

interface TodoState {
  todos: Array<{ id: number; text: string; done: boolean }>
  dispatch: (action: Action) => void
}

function todoReducer(state: TodoState['todos'], action: Action) {
  switch (action.type) {
    case 'todo/add':
      return [...state, { id: Date.now(), text: action.text, done: false }]
    case 'todo/toggle':
      return state.map(t =>
        t.id === action.id ? { ...t, done: !t.done } : t
      )
    case 'todo/remove':
      return state.filter(t => t.id !== action.id)
    default:
      return state
  }
}

const useStore = create<TodoState>((set) => ({
  todos: [],
  dispatch: (action: Action) =>
    set((state) => ({ todos: todoReducer(state.todos, action) })),
}))
```

Key points:
- `dispatch` is a function on the store that calls `set()` with reducer result
- `todoReducer` is a pure function — testable without React
- Action types: string constants (`'todo/add'`) follow Redux convention. Not required. Any string or Symbol works.

> **Think**: The reducer mutates `todos` array, not the whole store. What if you needed to update `todos` and a `notification` count in one action? Does the pattern break?
>
> *Answer: The reducer operates on one slice (`todos`). For cross-slice updates, either: (1) pass the full store state to the reducer, (2) run two reducers sequentially, or (3) use a thunk-like pattern. Zustand has no strict single-reducer rule. You can call `dispatch(action)` which calls multiple `set()` calls, or compose reducers manually.*

### Action Types: String Constants vs Function-Based Actions

Two styles for defining actions:

**String constants** (Redux-style):
```typescript
const ADD_TODO = 'todo/add'
const TOGGLE_TODO = 'todo/toggle'
// Reducer switches on action.type
```

**Function-based actions** (Zustand-native):
```typescript
const useStore = create<State>((set) => ({
  todos: [],
  addTodo: (text: string) =>
    set((s) => ({ todos: [...s.todos, { id: Date.now(), text, done: false }] })),
  toggleTodo: (id: number) =>
    set((s) => ({
      todos: s.todos.map(t => t.id === id ? { ...t, done: !t.done } : t),
    })),
}))

// Usage
useStore.getState().addTodo('Learn Zustand')
```

| Concern | String constants | Function actions |
|---------|-----------------|------------------|
| Discoverability | Searching `'todo/add'` finds usage | `.addTodo` autocompletes in TypeScript |
| Serialization | Action objects serializable over wire | Functions not serializable |
| DevTools trace | Action type appears in devtools panel | Anonymous state updates |
| Reusability | Same action type dispatched from anywhere | Must import store or action function |
| Testing | Reducer testable as `reducer(state, { type: 'todo/add', ... })` | Must mock the store or extract logic |

Zustand convention: use function-based actions by default. Adopt string constants only when you need DevTools tracing or serializable action logs (e.g., undo/redo).

> **Think**: You need undo/redo for a drawing app. Each stroke must be replayable. Which action style works? Why?
>
> *Answer: String constants. Undo/redo requires storing a log of action objects `{ type, payload }` that can be replayed or inverted. Function actions are closures — they capture scope at call time and cannot be replayed later. String constants serialize cleanly into an action history stack.*

### Redux DevTools Integration

Zustand's `devtools` middleware connects to Redux DevTools browser extension:

```typescript
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

const useStore = create(
  devtools(
    (set) => ({
      count: 0,
      increment: () => set((s) => ({ count: s.count + 1 }), false, 'count/increment'),
      decrement: () => set((s) => ({ count: s.count - 1 }), false, 'count/decrement'),
    }),
    { name: 'counter-store', anonymousActionType: 'stateChange' }
  )
)
```

Third argument to `set()` is the action type name that appears in DevTools:
```typescript
set((state) => ({ count: state.count + 1 }), false, 'count/increment')
//                                         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//                                        shows in DevTools action log
```

With reducer pattern, the action type passes through automatically if named:
```typescript
dispatch: (action: Action) =>
  set((state) => ({ todos: todoReducer(state.todos, action) }), false, action.type),
```

The `false` parameter means "replace" (false = shallow merge, which is default). The third param is the DevTools label.

> **Think**: You use devtools middleware but forget the third parameter on every `set()` call. What appears in DevTools?
>
> *Answer: `anonymousActionType` (default: `'stateChange'`). Every mutation shows as `stateChange` — useless for debugging. Always name actions or configure `anonymousActionType` to something meaningful like the store name.*

### Code Comparison: Redux Toolkit vs Zustand (Reducer Pattern)

Same feature — todo list with add/toggle/remove — in both:

**Redux Toolkit:**
```typescript
import { createSlice, configureStore } from '@reduxjs/toolkit'

const todosSlice = createSlice({
  name: 'todos',
  initialState: [] as Todo[],
  reducers: {
    add: (state, action: PayloadAction<string>) => {
      state.push({ id: Date.now(), text: action.payload, done: false })
    },
    toggle: (state, action: PayloadAction<number>) => {
      const t = state.find(t => t.id === action.payload)
      if (t) t.done = !t.done
    },
  },
})

const store = configureStore({ reducer: { todos: todosSlice.reducer } })
// Usage: store.dispatch(todosSlice.actions.add('text'))
// Selector: (state) => state.todos
```

**Zustand (reducer pattern):**
```typescript
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

const useStore = create(
  devtools<State>((set) => ({
    todos: [],
    dispatch: (action: TodoAction) =>
      set((s) => ({ todos: todoReducer(s.todos, action) }), false, action.type),
  })),
  { name: 'todos' }
)
// Usage: useStore.getState().dispatch({ type: 'todo/add', text: 'x' })
// Selector: useStore((s) => s.todos)
```

| Dimension | Redux Toolkit | Zustand reducer |
|-----------|--------------|-----------------|
| Boilerplate | createSlice + configureStore + Provider | One `create()` call |
| Provider needed | Yes | No |
| DevTools | Built-in | Middleware opt-in |
| Bundle size | ~12KB min+gzip | ~1.7KB min+gzip |
| Action creator | Auto-generated `slice.actions.add(...)` | Manual dispatch function |
| Selector performance | `useSelector` with equality | `useStore` with equality fn |

> **Think**: Your app is 50% Redux and you want to migrate one feature to Zustand. Both will coexist. Which factor matters most for gradual migration?
>
> *Answer: Provider independence. Zustand stores are not wrapped in `<Provider>` — they live outside React tree. You can mount a Zustand store alongside Redux store. Features migrate one at a time. Shared state between the two? Use a subscriber bridge: `useStore.subscribe((state) => reduxStore.dispatch(syncAction(state)))`.*

### When Reducer Pattern Helps — and When It Hurts

**Use reducer pattern when:**
- Complex state transitions with many action types (CRUD on entities)
- Undo/redo required (action log replay)
- Cross-slice updates (one action updates multiple store slices)
- You want to migrate existing Redux code incrementally
- State transition logic exceeds 10 lines per action

**Use direct `set()` when:**
- Simple toggle, counter, form field
- One or two properties change per action
- State transition is obvious from context
- You value Locality of Behavior — the mutation lives where it's consumed

The dividing line: **does the `set()` callback contain a switch statement or if-else chain?** If no, direct mutation. If yes, consider reducer.

> **Think**: A checkout form with 12 fields and 5-step wizard. Multiple field updates, validation state, step tracking. Reducer pattern or direct set()?
>
> *Answer: Reducer pattern. Five action types (NEXT_STEP, PREV_STEP, UPDATE_FIELD, VALIDATE, SUBMIT) produce different state shapes. Without reducer, your `set()` callbacks branch on implicit conditions — harder to read, test, and trace. The reducer gives each action explicit type and transformation logic.*

### Dispatching Actions from Outside React

Zustand stores exist outside React tree. Any action can be dispatched from any context:

```typescript
// In a routing guard
import { useStore } from './store'

router.beforeEach((to, from) => {
  if (to.path === '/logout') {
    useStore.getState().dispatch({ type: 'auth/logout' })
  }
})

// In a WebSocket handler
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data)
  useStore.getState().dispatch({ type: msg.kind, payload: msg.data })
}

// In a service worker message handler
navigator.serviceWorker.addEventListener('message', (event) => {
  useStore.getState().dispatch(event.data.action)
})
```

This is harder in Redux — you must either import the store instance or use `useDispatch` inside React. Zustand's `getState()` returns the latest state + actions at any call time.

> **Think**: A WebSocket pushes real-time price updates. Should you dispatch the Redux-pattern action directly, or wrap it in a Zustand subscriber?
>
> *Answer: Dispatch directly. `ws.onmessage → store.getState().dispatch(priceUpdate)`. No React wrapper needed. The store updates synchronously; all subscribed React components re-render. A subscriber adds indirection with no benefit unless you need to batch multiple WS messages.*

### Testing: Reducer Functions vs Store Integration

**Unit-test the reducer (pure function, no React):**
```typescript
import { todoReducer } from './store'

describe('todoReducer', () => {
  const initial: Todo[] = [{ id: 1, text: 'a', done: false }]

  it('adds a todo', () => {
    const result = todoReducer(initial, { type: 'todo/add', text: 'b' })
    expect(result).toHaveLength(2)
  })

  it('toggles a todo', () => {
    const result = todoReducer(initial, { type: 'todo/toggle', id: 1 })
    expect(result[0].done).toBe(true)
  })

  it('returns same array for unknown action', () => {
    const result = todoReducer(initial, { type: 'unknown' } as any)
    expect(result).toBe(initial)
  })
})
```

**Integration-test the store (includes React):**
```typescript
import { renderHook, act } from '@testing-library/react'
import { useStore } from './store'

describe('todo store', () => {
  it('adds todo via dispatch', () => {
    const { result } = renderHook(() => useStore())

    act(() => {
      result.current.dispatch({ type: 'todo/add', text: 'test' })
    })

    expect(result.current.todos).toHaveLength(1)
    expect(result.current.todos[0].text).toBe('test')
  })
})
```

Rule: reducer logic → unit test (fast, no React environment). Store wiring → integration test (catches middleware issues, devtools configuration, subscriber reactivity).

> **Think**: A bug: dispatching `todo/add` from a WebSocket handler works, but the UI does not update. Where do you look?
>
> *Answer: Integration test covers store → React bridge. Unit test of reducer would pass because reducer returns correct state. Bug likely in: (1) subscriber not set up after WebSocket handler, (2) selector reference prevents re-render, (3) Zustand's `set()` called outside React without `useSyncExternalStore` bridge. Test dispatch → subscribe → assert.*

### Real Example: Todo App with Redux Pattern in Zustand

```typescript
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

// Action types
type TodoAction =
  | { type: 'todo/add'; text: string }
  | { type: 'todo/toggle'; id: number }
  | { type: 'todo/remove'; id: number }
  | { type: 'todo/clear-completed' }
  | { type: 'todo/edit'; id: number; text: string }

interface Todo {
  id: number
  text: string
  done: boolean
  createdAt: number
}

interface TodoStore {
  todos: Todo[]
  dispatch: (action: TodoAction) => void
}

// Pure reducer — testable, serializable
function todoReducer(todos: Todo[], action: TodoAction): Todo[] {
  switch (action.type) {
    case 'todo/add':
      return [...todos, { id: Date.now(), text: action.text, done: false, createdAt: Date.now() }]
    case 'todo/toggle':
      return todos.map(t => (t.id === action.id ? { ...t, done: !t.done } : t))
    case 'todo/remove':
      return todos.filter(t => t.id !== action.id)
    case 'todo/clear-completed':
      return todos.filter(t => !t.done)
    case 'todo/edit':
      return todos.map(t => (t.id === action.id ? { ...t, text: action.text } : t))
    default:
      return todos
  }
}

// Store with devtools + persist middleware
const useTodoStore = create<TodoStore>()(
  devtools(
    persist(
      (set) => ({
        todos: [],
        dispatch: (action) =>
          set((state) => ({ todos: todoReducer(state.todos, action) }), false, action.type),
      }),
      { name: 'todo-storage' }
    ),
    { name: 'todo-store' }
  )
)

// Component usage
function TodoApp() {
  const todos = useTodoStore((s) => s.todos)
  const dispatch = useTodoStore((s) => s.dispatch)

  return (
    <div>
      <button onClick={() => dispatch({ type: 'todo/add', text: prompt('Todo?') || '' })}>
        Add
      </button>
      {todos.map(todo => (
        <div key={todo.id}>
          <span style={{ textDecoration: todo.done ? 'line-through' : 'none' }}
                onClick={() => dispatch({ type: 'todo/toggle', id: todo.id })}>
            {todo.text}
          </span>
          <button onClick={() => dispatch({ type: 'todo/remove', id: todo.id })}>X</button>
        </div>
      ))}
    </div>
  )
}
```

This pattern:
- Separates state shape (Todo), actions (TodoAction), and transformation (todoReducer)
- Persists to localStorage automatically
- Traces every action in Redux DevTools
- Works outside React (dispatch from WebSocket, router guard, etc.)
- All five action types handled in one switch — testable as pure function

> **Think**: The `dispatch` function is recreated on every store update (because it creates a new closure over `set`). Does this cause unnecessary re-renders in subscribed components?
>
> *Answer: No. Zustand's `useStore((s) => s.dispatch)` returns a stable reference — the `dispatch` function is defined once in the store creator. The closure captures the same `set` reference. The arrow function inside `set` argument is created fresh each call, not at subscription. No re-render overhead from `dispatch`.*

---

### Why This Matters

Redux pattern in Zustand is the bridge between Redux and Zustand worlds. Teams migrating from Redux use this pattern to transfer action types, reducers, and mental models without rewriting business logic. Teams new to Zustand need to know when the pattern adds value and when it adds ceremony.

The decision — reducer vs direct mutation — affects testability, DevTools debugging, undo/redo feasibility, and code organization. A team that always uses reducers writes unnecessary boilerplate. A team that never uses reducers hits a wall when state transitions grow complex.

This module gives you the decision framework. After this, you can:
- Port Redux reducers to Zustand in minutes
- Set up DevTools tracing for any Zustand store
- Test state logic without mounting React
- Dispatch actions from outside React (WebSocket, router, service worker)

---

### Common Questions

**Q: Does Zustand's reducer pattern support middleware like Redux thunks or sagas?**
A: Not directly. Zustand has its own middleware system (`immer`, `persist`, `devtools`, `subscribeWithSelector`). For async flows, you write plain functions that call `set()` or `getState()` — no saga runtime needed. If you need full Redux middleware chain, stay on Redux or use Zustand's `redux` middleware (experimental).

**Q: Can I use both reducer pattern and direct mutations in the same store?**
A: Yes. Zustand does not enforce patterns. Common hybrid: complex slice uses dispatch, simple slice uses direct `set()`. Example: `session` state (login/logout → reducer for audit trail) + `theme` state (toggle → direct set). No conflict.

**Q: Does the Redux pattern let me use Redux DevTools time-travel debugging?**
A: Yes. The `devtools` middleware connects to Redux DevTools extension. Named action types (third parameter to `set()`) enable jump-to-action and time-travel. However, Zustand does not implement the full Redux store enhancer API — some advanced DevTools features (diff between state snapshots, action stacks) may differ slightly.

**Q: Is there a performance cost to the reducer pattern?**
A: Negligible. The reducer runs synchronously inside `set()`. For stores <10K entries, the switch statement + array spread completes in <0.1ms. The cost is human, not computational: you write more code per action.

**Q: Can one dispatch trigger multiple state slices?**
A: Yes. Your reducer can return `{ todos: [...], ui: { ... }, notifications: [...] }` — whatever shape `set()` merges. Alternatively, call `set()` multiple times conditionally. Zustand batches multiple synchronous `set()` calls into one re-render.

---

## Examples

### Example 1: Porting Redux Slice to Zustand

**Problem**: Existing Redux `shoppingCart` slice with addItem, removeItem, updateQuantity, applyCoupon, clearCart actions. Team wants to remove Redux dependency for this feature.

**Solution**:

Redux original:
```typescript
const cartSlice = createSlice({
  name: 'cart',
  initialState: { items: [], coupon: null },
  reducers: {
    addItem: (state, action: PayloadAction<Item>) => {
      state.items.push(action.payload)
      state.total = state.items.reduce((s, i) => s + i.price * i.qty, 0)
    },
    applyCoupon: (state, action: PayloadAction<string>) => {
      state.coupon = action.payload
      state.discount = 0.1 // simplified
    },
  },
})
```

Zustand port:
```typescript
type CartAction =
  | { type: 'cart/addItem'; item: Item }
  | { type: 'cart/removeItem'; id: string }
  | { type: 'cart/updateQty'; id: string; qty: number }
  | { type: 'cart/applyCoupon'; code: string }
  | { type: 'cart/clear' }

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'cart/addItem': {
      const items = [...state.items, action.item]
      return { ...state, items, total: items.reduce((s, i) => s + i.price * i.qty, 0) }
    }
    case 'cart/applyCoupon':
      return { ...state, coupon: action.code, discount: 0.1 }
    case 'cart/clear':
      return { items: [], coupon: null, discount: 0, total: 0 }
    case 'cart/removeItem':
      return { ...state, items: state.items.filter(i => i.id !== action.id) }
    default:
      return state
  }
}

const useCartStore = create<CartStore>()(
  devtools(
    (set) => ({
      items: [], coupon: null, discount: 0, total: 0,
      dispatch: (action: CartAction) =>
        set((s) => cartReducer(s, action), false, action.type),
    }),
    { name: 'cart' }
  )
)
```

**Result**: Same action types, same reducer logic, same DevTools. Dropped Provider, createSlice import, and store configuration ceremony. Bundle ~10KB lighter.

### Example 2: Undo/Redo with Action Log

**Problem**: Drawing app needs undo/redo for stroke operations. Each stroke add/delete/modify must be reversible.

**Solution**:
```typescript
interface HistoryStore {
  past: Action[]
  present: State
  future: Action[]
  dispatch: (action: Action) => void
  undo: () => void
  redo: () => void
}

const useHistoryStore = create<HistoryStore>()(
  devtools((set, get) => ({
    past: [],
    present: { strokes: [] },
    future: [],
    dispatch: (action) => {
      set(
        (s) => ({
          past: [...s.past, { type: action.type, payload: action.payload }],
          present: strokeReducer(s.present, action),
          future: [], // clear redo on new action
        }),
        false,
        action.type
      )
    },
    undo: () => {
      const { past, present } = get()
      if (past.length === 0) return
      const previous = past[past.length - 1]
      const undone = strokeReducer(present, invertAction(previous))
      set({ past: past.slice(0, -1), present: undone, future: [...get().future, previous] })
    },
    redo: () => {
      const { future, present } = get()
      if (future.length === 0) return
      const next = future[future.length - 1]
      const redone = strokeReducer(present, next)
      set({ past: [...get().past, next], present: redone, future: future.slice(0, -1) })
    },
  }))
)
```

**Result**: Action log enables time-travel. Each action is stored as `{ type, payload }` — serializable, replayable. `invertAction` function maps each action type to its inverse (add → remove, toggle → toggle). Without Redux pattern (string-constant action types), this approach fails because function closures capture local scope and cannot be replayed.

### Example 3: Outside-React Dispatch with WebSocket

**Problem**: Live auction app receives bid updates via WebSocket. Must update store and show notification.

**Solution**:
```typescript
// store.ts
type AuctionAction =
  | { type: 'auction/bid'; itemId: string; bid: number; userId: string }
  | { type: 'auction/close'; itemId: string }

// websocket.ts
import { useStore } from './store'

const ws = new WebSocket('wss://auctions.example.com/feed')

ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  const store = useStore.getState()

  switch (data.event) {
    case 'new_bid':
      store.dispatch({
        type: 'auction/bid',
        itemId: data.itemId,
        bid: data.amount,
        userId: data.user,
      })
      break
    case 'auction_closed':
      store.dispatch({ type: 'auction/close', itemId: data.itemId })
      break
  }
}
```

**Result**: WebSocket handler drives store directly. No React component needed. The store is the single source of truth; any React component subscribed to `auction/bid` re-renders automatically. The action pattern makes the WS → store contract explicit — each event maps to one action type.

---

## Key Takeaways
- Zustand `set()` is conceptually equivalent to Redux `dispatch` — reducer pattern is optional ceremony
- Reducer pattern: extract pure function `(state, action) => state`, wire through `set()` via a `dispatch` action
- String-constant actions enable DevTools tracing, undo/redo, and serializable action logs
- Function-based actions preserve TypeScript autocomplete and are idiomatic Zustand
- `devtools` middleware connects Zustand to Redux DevTools — always name the third `set()` param
- Use reducer pattern for complex/multi-action state; use direct `set()` for simple/isolated mutations
- Stores exist outside React — dispatch actions from WebSocket, router, service worker without providers
- Test reducers as pure functions (fast, no React); test store integration for middleware/subscriber correctness
- Porting Redux to Zustand: keep action types + reducer, replace createSlice/Provider with `create()` + `devtools`
- Undo/redo requires serializable action log — string-constant actions are mandatory

## Common Misconception

**"Redux pattern in Zustand means I must always use a reducer function."**

Redux pattern is optional. Zustand does not mandate actions, reducers, action types, or switch statements. The pattern exists for developers who want Redux-like predictability without Redux overhead.

The trap: developers porting from Redux sometimes write a reducer for every store, even simple toggles and counters. This adds typing, reading, and maintenance cost without benefit.

Correct framing: treat the reducer pattern as a tool for complex state transitions. Default to direct `set()` mutations. Escalate to reducer pattern when you hit three or more interdependent action types, or when you need undo/redo or DevTools tracing per action. The pattern serves you — you do not serve the pattern.

---

## Feynman Explain
(Explain the Redux pattern in Zustand to a junior developer who knows `useState` but has never used Redux or Zustand. Use no jargon: no "dispatch", "reducer", "action type", "middleware". Describe the problem: "Sometimes you need to update state in many different ways, and you want to see a history of every update." Start from `useState` and build up to why you'd want a switch statement that takes a "command" and returns new state.)

*Pause. Say explanation aloud or write it down. Then run `learn.sh explain zustand-state-management 07-redux-pattern` — AI probes gaps in your explanation.*

---

## Reframe
(Pause. Critique: Redux pattern in Zustand adds ceremony. Does it actually solve a real problem, or does it let Redux veterans feel productive without learning Zustand idioms? When does this pattern become a cargo cult? Write your evaluation. Consider: a team of 5 building a new app from scratch — do they start with reducer pattern or only add it when pain appears?)

---

## Drill
Take the quiz. Questions cover action type design, reducer testing, DevTools integration, and the decision between reducer pattern vs direct set().

Run: `learn.sh quiz zustand-state-management 07-redux-pattern`

## Quiz: 07-redux-pattern


### What must you pass as the third argument to Zustand's `set()` to see meaningful action names in Redux DevTools?

- [ ] A: A unique store ID

- [ ] B: A boolean indicating whether to replace state

- [✓] C: A string label describing the action

- [ ] D: The current state snapshot


**Answer:** C

Third argument to `set()` is the action type name shown in DevTools. Without it, all mutations appear as `anonymousActionType` (default: `'stateChange'`).


### Which of the following is a benefit of function-based actions over string-constant actions in Zustand?

- [ ] A: Actions are serializable over WebSocket

- [✓] B: TypeScript autocomplete on the action method name

- [ ] C: Actions appear as named entries in DevTools action log

- [ ] D: Actions can be logged and replayed for undo/redo


**Answer:** B

Function-based actions like `store.addTodo(text)` give full TypeScript autocomplete. String constants require manual typing of `{ type, payload }` objects.

A and D are benefits of string constants (serializable, replayable). C can work with named third arg regardless of style.


### A Zustand store has 12 action types, undo/redo requirements, and cross-slice updates. Which pattern should you use?

- [ ] A: Direct set() mutations for each action

- [✓] B: Reducer pattern with string-constant action types

- [ ] C: Function-based actions only

- [ ] D: External state management outside Zustand


**Answer:** B

12 action types with undo/redo and cross-slice updates need reducer pattern. String constants enable serializable action log for undo/redo. Direct set() would scatter mutation logic across unrelated functions. Function-based actions are not serializable for replay.


### How do you dispatch an action from a WebSocket handler using Zustand's Redux pattern?

- [ ] A: Wrap the WebSocket handler in a React component and call useDispatch

- [✓] B: Import the store and call store.getState().dispatch({ type, payload })

- [ ] C: Create a new Zustand store inside the WebSocket callback

- [ ] D: Use Redux Toolkit's createAsyncThunk instead


**Answer:** B

Zustand stores exist outside React. `store.getState()` returns the full state object including actions. No Component or Provider wrapper needed — call dispatch directly from any context.


### What is the main reason to unit-test a reducer function separately from the store?

- [ ] A: Reducer tests are slower but more thorough

- [✓] B: Reducers are pure functions — tests run without React environment or store setup

- [ ] C: Zustand stores cannot be tested in isolation

- [ ] D: Reducer tests automatically cover middleware behavior


**Answer:** B

Reducers are pure `(state, action) =&gt; state` functions. They require no React, no store creation, no middleware. Fast to run, easy to reason about. Store integration tests cover the wiring (middleware, subscriptions, devtools) separately.


### A form has 3 fields, a submit button, and 1 API call. Which approach is most appropriate?

- [ ] A: Reducer pattern with 4 action types (UPDATE_FIELD_1, UPDATE_FIELD_2, UPDATE_FIELD_3, SUBMIT)

- [✓] B: Direct set() mutations inside the component

- [ ] C: External Redux store with createSlice

- [ ] D: useRef for all fields to avoid re-renders


**Answer:** B

3 fields + 1 submit = simple state. Reducer pattern would add 4 action types, a switch statement, and a dispatch function — ceremony without benefit. Direct set() is simpler, more readable, and co-located with the component. Rule: if no conditionals in set() callback, direct mutation wins.


### In Zustand's `devtools` middleware, what appears in the DevTools action log if you omit the third parameter to `set()`?

- [ ] A: An empty string

- [ ] B: `undefined`

- [✓] C: The value configured as `anonymousActionType` (default `'stateChange'`)

- [ ] D: The previous state as a string


**Answer:** C

The `anonymousActionType` option in the devtools middleware config sets the fallback label. Default is `'stateChange'`. Every unnamed mutation shows as the same label — useless for debugging multiple action types.


### Which scenario forces the use of string-constant action types over function-based actions?

- [ ] A: You want TypeScript autocomplete on store actions

- [ ] B: You want to export action creators for reuse across modules

- [✓] C: You need to log and replay actions for undo/redo functionality

- [ ] D: You have fewer than 3 action types


**Answer:** C

Undo/redo requires a serializable action log `{ type, payload }` that can be replayed or inverted. Function-based actions are closures — they capture scope at call time and cannot be replayed later.

A and B work with either style. D is irrelevant to the decision.


### What happens when you have both a Redux slice and a Zustand reducer store managing `todos` in the same app?

- [ ] A: React throws an invariant violation

- [✓] B: Both stores coexist independently — no conflict

- [ ] C: Zustand store automatically syncs to Redux store

- [ ] D: Only one store can exist per app


**Answer:** B

Zustand stores do not use React Context or Providers. They are plain JavaScript objects. Multiple stores (Redux + Zustand, or multiple Zustand) coexist without conflict. You can migrate features incrementally.


### A Zustand store uses the reducer pattern. A bug: dispatching an action outside React (from a WebSocket) updates the store state, but the UI does not re-render. What is the most likely cause?

- [ ] A: The reducer function has a bug in the switch statement

- [✓] B: The component's selector returns a stable reference preventing re-render

- [ ] C: Zustand cannot trigger re-renders from outside React

- [ ] D: The WebSocket handler needs to be wrapped in act()


**Answer:** B

Store state is correct (reducer tested, no bug) → selector returns same reference (e.g., `useStore((s) =&gt; s.todos)` returns new array, but the component compares by reference). Most likely: the component uses a selector that returns a derived value that does not change, or a parent stops propagation. Zustand does trigger re-renders from outside React via `useSyncExternalStore`.


---

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

## Quiz: 08-slices


### What does a Zustand slice creator function return?

- [ ] A: A complete Zustand store ready for consumption

- [✓] B: A partial state object with only that slice's properties and actions

- [ ] C: A React component that provides the slice via context

- [ ] D: A reducer function compatible with Redux


**Answer:** B

A slice creator receives `set` and `get` and returns an object containing only that slice's state properties and actions. Multiple slice results are merged via spread into the final store.


### How do you combine multiple slice creators into a single Zustand store?

- [ ] A: Pass each slice creator as separate arguments to create()

- [✓] B: Spread each slice creator result inside create(): `create((...a) =&gt; ({ ...sliceA(...a), ...sliceB(...a) }))`

- [ ] C: Use an array of slice creators and call create() with the array

- [ ] D: Create separate stores and merge them with Object.assign


**Answer:** B

Each slice creator receives the same `set`/`get`. Spreading their results merges all slices into one store object. TypeScript intersection of slice interfaces provides type safety.


### What is the correct way for one slice to read state owned by another slice?

- [ ] A: Import the other slice's creator and call it inside set()

- [✓] B: Call get() inside the slice action — get() returns the entire combined store state

- [ ] C: Use React Context to access the store from another slice

- [ ] D: Pass the other slice's state as a function argument during creation


**Answer:** B

All slices share the same `get()` reference, which returns the full combined store state. Any action can read any property via `get()`. The slice type parameter lists dependencies so TypeScript validates the access.


### What happens if two slices define the same property name (e.g., both define `loading: boolean`)?

- [ ] A: TypeScript throws a compile-time error about duplicate property

- [ ] B: Both slices' values are merged into an array

- [✓] C: The last slice spread wins — one loading property overwrites the other

- [ ] D: Zustand creates two separate loading properties accessible by slice name


**Answer:** C

JavaScript object spread overwrites duplicate keys. The last slice's `loading` replaces the first. This is why prefixed names (`productsLoading`, `authLoading`) or nested objects per slice are safer for common names.


### A slice action needs to trigger state changes in two other slices. Which pattern preserves slice independence best?

- [ ] A: Directly call get().otherSliceAction() from the action

- [✓] B: Use an orchestrator slice that coordinates the cross-slice flow

- [ ] C: Duplicate the logic across all three slices

- [ ] D: Put all three domains into one monolithic slice


**Answer:** B

Orchestrator slice centralizes cross-cutting workflows in one place. Each domain slice stays focused on its own state. Direct calls (A) create hard dependencies. Duplication (C) violates DRY. Monolithic (D) defeats slice purpose.


### What is the recommended migration strategy when refactoring a monolithic store into slices?

- [ ] A: Rewrite all slices in one branch and merge as one PR

- [✓] B: Extract one slice per PR, keeping the store functional at each step

- [ ] C: Create a new store from scratch and cut over with a feature flag

- [ ] D: Delete the monolithic store file and rebuild from memory


**Answer:** B

One-slice-per-PR migration keeps the store working at every step. Each PR extracts a slice, spreads it, and handles cross-slice references. This avoids long-lived branches, large diffs, and regression risk.


### A store has 6 entity types (articles, authors, tags, categories, media, comments), each with identical CRUD operations. What is the best approach?

- [ ] A: Write each CRUD slice manually for full control

- [✓] B: Create a slice factory `createCrudSlice&lt;T&gt;()` and reuse it for each entity

- [ ] C: Put all entities in a single slice with a generic items array

- [ ] D: Use a separate non-Zustand store for entities


**Answer:** B

Slice factory eliminates 90% code repetition while keeping each entity as its own slice. Each entity calls the factory with its type parameter and API base. Custom per-entity logic is added through composition or overrides.


### A store uses slices. Component A subscribes to `useStore((s) =&gt; s.user)`. When CartSlice updates `items`, does Component A re-render?

- [ ] A: Yes — all components subscribed to any part of the store re-render on any change

- [✓] B: No — Zustand's selector equality check skips re-render when s.user reference has not changed

- [ ] C: Yes — but only if CartSlice and UserSlice are in the same store

- [ ] D: No — slices prevent cross-slice re-renders by design


**Answer:** B

Zustand uses `useSyncExternalStore` with reference equality on selector output. If `s.user` is the same reference, the component skips re-render — regardless of which slice triggered the update. This works identically for monolithic and sliced stores.


### What must the first generic parameter of a `StateCreator` include when a slice depends on another slice?

- [ ] A: Only the current slice's interface

- [✓] B: The intersection of the current slice and all slices it depends on

- [ ] C: The full AppStore type

- [ ] D: The other slice's StateCreator type


**Answer:** B

The first generic parameter to `StateCreator` represents the full store type available via `get()`. When a slice reads from another slice, it must include the other slice's interface in the intersection. TypeScript validates cross-slice access at compile time.


### A developer writes an action in ProductsSlice that calls `set({ token: null })`. `token` is owned by AuthSlice. What is the best assessment?

- [ ] A: Correct — all slices share the same set()

- [✓] B: Technically works but is an anti-pattern — one slice should not set another slice's state directly

- [ ] C: Will throw a runtime error because set() validates property ownership

- [ ] D: Works and is recommended for simplicity


**Answer:** B

Cross-slice `set()` is technically possible (set merges into the same store) but is an anti-pattern. It creates invisible dependencies and violates the principle that each slice controls its own state transitions. Preferred approach: call `get().logout()` from AuthSlice, which internally sets `token: null`.


---

# Module 9: Selector Architecture — Granular Subscriptions, Optimization

Est. study time: 2.5h
Language: en

## Learning Objectives
- Design selector functions that extract minimal state slices for optimal re-render isolation
- Implement shallow comparison and memoized selectors to prevent reference instability bugs
- Compose selectors for derived state without creating subscription cascades
- Diagnose and fix selector anti-patterns: object creation in selectors, oversubscription, unstable references

---

## Core Content

### Selector Fundamentals — state => partialState

A selector is a function that receives the full store state and returns a slice:

```typescript
const useStore = create({ count: 0, text: 'hello', user: { name: 'Alice' } })

// selector: state => partialState
const count = useStore((state) => state.count)
```

Every `useStore` call accepts an optional selector. Without selector, component subscribes to entire store — any change triggers re-render. With selector, component subscribes only to returned value.

Zustand tracks selector identity. On every state change, it re-runs the selector and compares result to previous result using `Object.is`. If result changed, component re-renders. If same, component skips.

> **Think**: What happens if two unrelated components call `useStore((s) => s.count)` and you update `s.text`? Do they re-render?
>
> *Answer: No. Both selectors return same `count` value before and after text update. Object.is comparison says "same" → no re-render. Text updates only affect components subscribed to text or to whole store.*

### Granular Subscriptions — Re-render Isolation

Granular subscription means each component subscribes to exactly the state it needs:

```typescript
function UserName() {
  const name = useStore((s) => s.user.name)
  return <span>{name}</span>
}

function UserEmail() {
  const email = useStore((s) => s.user.email)
  return <span>{email}</span>
}

function UserAvatar() {
  const avatar = useStore((s) => s.user.avatar)
  return <img src={avatar} />
}
```

When `email` updates, only `UserEmail` re-renders. `UserName` and `UserAvatar` skip — their selected values did not change.

This is Zustand's key advantage over Context. Context cannot isolate subscriptions; every consumer re-renders whenever any field changes.

> **Think**: A profile page has 12 sections (name, email, avatar, bio, settings, orders, notifications, billing, security, social, activity, delete). One selector per section. When billing updates, how many re-renders happen? Versus Context?
>
> *Answer: Zustand: 1 re-render (billing section). Context: 12 re-renders (all consumers). Difference grows with component count. At 100 components, Context does 100x more work.*

### Shallow Comparison — useStore with Equality Function

`useStore` accepts a second argument: equality function. Default is `Object.is`. Override when selector returns object or array:

```typescript
import { shallow } from 'zustand/shallow'

const useStore = create({ a: 1, b: 2, c: 3 })

// Bad: returns new object every time → always re-renders
const { a, b } = useStore((s) => ({ a: s.a, b: s.b }))

// Good: shallow compare the object
const { a, b } = useStore((s) => ({ a: s.a, b: s.b }), shallow)
```

`shallow` compares object keys/values with `Object.is` per key. If `a` and `b` unchanged, object is considered same — component skips.

Without `shallow`, every state change creates a new object reference → `Object.is` says different → re-render. This is the #1 selector bug.

Equality function signature:

```typescript
type EqualityFn = (a: SelectedValue, b: SelectedValue) => boolean
// return true = values equal → skip re-render
// return false = values differ → re-render
```

> **Think**: `useStore((s) => ({ a: s.a, b: s.b }))` runs every time any state changes. With Object.is default, what happens when s.c changes?
>
> *Answer: Even though c is irrelevant, selector returns `{ a, b }` — a brand new object. Object.is compares references → false → component re-renders. This is wasted work. Fix: add shallow or use multiple useStore calls.*

### Creating Memoized Selectors

Memoized selectors cache computed results across calls. Only recompute when inputs change. Essential for expensive derivations.

**Option 1: useMemo in component**

```typescript
function ExpensiveDerivation() {
  const items = useStore((s) => s.items)
  const filter = useStore((s) => s.filter)

  const filtered = useMemo(
    () => items.filter((i) => i.category === filter),
    [items, filter]
  )

  return <List items={filtered} />
}
```

**Option 2: External reselect-style selector**

```typescript
import { createSelector } from 'reselect'

const selectItems = (s: Store) => s.items
const selectFilter = (s: Store) => s.filter

const selectFilteredItems = createSelector(
  [selectItems, selectFilter],
  (items, filter) => items.filter((i) => i.category === filter)
)

function List() {
  const filtered = useStore(selectFilteredItems)
  return <List items={filtered} />
}
```

**Option 3: Inline createSelector**

```typescript
// zustand/selectors (community) or manual memoization
function createSelector<Store, Result>(
  ...selectors: Array<(s: Store) => any>,
  combiner: (...values: any[]) => Result
) {
  let lastArgs: any[] = []
  let lastResult: Result
  return (state: Store): Result => {
    const args = selectors.map((fn) => fn(state))
    const changed = args.some((arg, i) => !Object.is(arg, lastArgs[i]))
    if (!changed) return lastResult
    lastArgs = args
    lastResult = combiner(...args)
    return lastResult
  }
}
```

Memoized selectors ensure derived state only recalculates when relevant inputs change. Prevents cascading recomputation.

> **Think**: A todo list computes filtered (active/completed), sorted (by date), and grouped (by category). Three derivations. Without memoized selectors, how many array operations per render? With memoization?
>
> *Answer: Without: 3 array operations per render (filter + sort + group) = 6 array passes. With memoization: 0 if todos/filter unchanged, else only changed derivation recomputes. For 10,000 todos, difference is 60,000 vs 10,000-30,000 iterations.*

### Selector Composition

Compose small selectors into larger ones. Building blocks prevent duplication:

```typescript
// Atomic selectors
const selectUser = (s: Store) => s.user
const selectPosts = (s: Store) => s.posts
const selectTheme = (s: Store) => s.theme

// Composed selectors
const selectDisplayName = (s: Store) => {
  const user = selectUser(s)
  return user.displayName ?? user.email.split('@')[0]
}

const selectUserWithPosts = (s: Store) => {
  const user = selectUser(s)
  const posts = selectPosts(s)
  return { ...user, posts: posts.filter((p) => p.authorId === user.id) }
}
```

Composition principle: each atomic selector is a single property access. Composed selectors combine atoms. Components pick composed selectors.

**Important**: Composed selectors run synchronously during state diff. Keep them fast. No side effects, no API calls, no heavy computation (delegate that to memoized selectors).

> **Think**: `const selectUserName = (s) => s.user.name` composes `selectUser`. Does composing selectors create extra re-renders?
>
> *Answer: No. The composed selector is just a function that calls another function. It runs once per state dif. No subscription multiplication. Only the component's final subscription matters — if result reference changes, component re-renders.*

### useShallow — Dev-Only Check for Selector Returns

```typescript
import { useShallow } from 'zustand/react'

function Profile() {
  const { name, email } = useStore(
    useShallow((s) => ({ name: s.user.name, email: s.user.email }))
  )
  return <div>{name} — {email}</div>
}
```

`useShallow` is a dev-time helper. Wraps selector with shallow comparison via React hooks. Equivalent to:

```typescript
const { name, email } = useStore(
  (s) => ({ name: s.user.name, email: s.user.email }),
  shallow
)
```

Key difference: `useShallow` uses `useMemo` internally to stabilize the selector reference between renders. This prevents unnecessary `useStore` re-subscriptions when the selector inline function creates a new reference.

In development, `useShallow` also warns if selector returns a deeply nested object — potential reference instability. In production, it behaves identically to `shallow`.

> **Think**: Why does `useShallow` exist if `shallow` does the same thing? When would you pick one over the other?
>
> *Answer: `useShallow` uses useMemo to stabilize selector reference, preventing extra store subscriptions from inline arrow functions. `shallow` as equality function does not stabilize the selector — same inline issue. Prefer `useShallow` for inline selectors returning objects; use `shallow` when selector is a stable reference (defined outside component).*

### Creating Bound Selectors — Dot Notation Access

Bound selectors use the store hook directly to drill into nested state:

```typescript
const useStore = create({
  user: { name: 'Alice', email: 'alice@example.com', preferences: { theme: 'dark' } }
})

// Bound selector — access deeply nested property
const theme = useStore((s) => s.user.preferences.theme)

// Multiple bound selectors — each subscription is granular
function ThemeToggle() {
  const theme = useStore((s) => s.user.preferences.theme)
  const setTheme = useStore((s) => s.setTheme)
  return <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
    {theme}
  </button>
}
```

Bound selectors drill into nested state without extracting entire parent objects. This is critical — extracting `s.user` just to read `user.preferences.theme` subscribes to the entire `user` object. Any user field change (even unrelated like `user.email`) triggers re-render.

```typescript
// Bad — subscribes to entire user object
const theme = useStore((s) => s.user).preferences.theme

// Good — subscribes only to theme
const theme = useStore((s) => s.user.preferences.theme)
```

> **Think**: Component reads `s.user.preferences.theme`. If `s.user.email` updates, does component re-render in the bad vs good version?
>
> *Answer: Bad version: yes — extracting `s.user` returns new object reference → Object.is fails → re-render. Good version: no — `s.user.preferences.theme` returns same string → Object.is succeeds → skip.*

### Performance — Selector Granularity vs Re-render Cost

Selector granularity is a trade-off:

| Granularity | Selector | Re-renders when | Pros | Cons |
|-------------|----------|----------------|------|------|
| Coarse | `(s) => s` | Any field changes | Simple, single subscription | Wasted renders |
| Medium | `(s) => s.user` | Any user field changes | Balanced | Re-renders on unrelated user fields |
| Fine | `(s) => s.user.name` | Only name changes | Minimal re-renders | Many subscriptions per component |

Guideline: start fine, coarsen if subscription count causes overhead.

**Subscription overhead**: Each `useStore` call adds a listener to the store. 50 fine-grained selectors = 50 listeners. 2 coarse selectors = 2 listeners. Listener overhead is negligible (< 1μs per notification) — fine granularity is almost always worth it.

**The real cost**: Re-render avoidance. One unnecessary re-render of a heavy component (1000 children) costs more than 50 listener checks. Always prefer fine-grained selectors for components with expensive children.

```typescript
// Profile with 5 sub-sections — 5 fine selectors
function Profile() {
  const name = useStore((s) => s.user.name)     // re-renders on name
  const email = useStore((s) => s.user.email)    // re-renders on email
  const bio = useStore((s) => s.user.bio)         // re-renders on bio
  const avatar = useStore((s) => s.user.avatar)   // re-renders on avatar
  const joined = useStore((s) => s.user.joinedAt) // re-renders on joinedAt
  // 5 subscriptions, 0 wasted renders
}
```

Profile section updates independently. Email changes → only email re-renders. Avatar, bio, name, joined skip.

> **Think**: A component reads `s.count` and renders it in a tiny `<span>`. Another component reads `s.items` (1000 items) and renders a massive table. What's the selector guidance?
>
> *Answer: Fine selector for both. count span should never re-render on items change. items table should never re-render on count change. The heavy component needs fine granularity most — its re-render cost is highest. The lightweight component benefits from skipping too, but the savings are smaller.*

### Anti-pattern: Returning New Objects from Selectors

Selector anti-pattern #1: creating new objects/arrays inline:

```typescript
// WRONG — creates new object every time
const user = useStore((s) => ({ name: s.user.name, email: s.user.email }))

// WRONG — creates new array every time
const names = useStore((s) => s.items.map((i) => i.name))

// RIGHT — select scalar values
const name = useStore((s) => s.user.name)
const email = useStore((s) => s.user.email)

// RIGHT — select with shallow equality
const user = useStore((s) => ({ name: s.user.name, email: s.user.email }), shallow)

// RIGHT — memoized derived data
const names = useStore((s) => useMemo(() => s.items.map((i) => i.name), [s.items]))
```

Why object creation is harmful: every state change creates a new reference → `Object.is` says different → re-render. Even when the values inside are identical. This negates Zustand's subscription model.

Shallow comparison fixes object selectors. Memoization fixes array transforms. Scalar selectors bypass the problem entirely.

Anti-pattern #2: selector returns more than component needs:

```typescript
// WRONG — subscribes to entire user for just name
function UserGreeting() {
  const user = useStore((s) => s.user)
  return <h1>Hello, {user.name}</h1>
}

// RIGHT — subscribes to name only
function UserGreeting() {
  const name = useStore((s) => s.user.name)
  return <h1>Hello, {name}</h1>
}
```

> **Think**: You inherit a codebase with 200 `useStore((s) => s)` calls (no selector). Describe the bug pattern. How many re-renders per state change?
>
> *Answer: Every state change triggers 200 re-renders. Each component gets the full store — any field update (even unrelated) re-renders everything. Fix: add selectors incrementally, starting with the heaviest components. 200→0 re-renders possible.*

### Real Example: Optimized Dashboard with Granular Selectors

```typescript
interface DashboardStore {
  // User data
  user: { id: string; name: string; email: string; avatar: string; role: string }
  // Metrics
  metrics: { revenue: number; users: number; sessions: number; conversion: number }
  // Activity feed
  activity: Array<{ id: string; type: string; message: string; timestamp: number }>
  // Notifications
  notifications: Array<{ id: string; text: string; read: boolean; priority: 'high' | 'low' }>
  // UI state
  ui: { sidebar: boolean; theme: 'light' | 'dark'; selectedMetric: string }
  // Actions
  fetchMetrics: () => void
  markRead: (id: string) => void
  toggleSidebar: () => void
  setTheme: (theme: 'light' | 'dark') => void
}

// --- Fine-grained selectors ---
// Header
function UserName() {
  const name = useStore((s) => s.user.name)
  return <span>{name}</span>
}

// Revenue metric card — only re-renders on revenue change
function RevenueCard() {
  const revenue = useStore((s) => s.metrics.revenue)
  return <MetricCard title="Revenue" value={formatCurrency(revenue)} />
}

// Users metric card — independent subscription
function UsersCard() {
  const users = useStore((s) => s.metrics.users)
  return <MetricCard title="Users" value={formatNumber(users)} />
}

// Notification bell — badge count
function NotificationBell() {
  const unread = useStore((s) => s.notifications.filter((n) => !n.read).length)
  return <Badge count={unread} />
}

// Activity feed — list of recent activity
function ActivityFeed() {
  const activity = useStore((s) => s.activity, shallow)
  return <Feed items={activity.slice(0, 10)} />
}

// Sidebar toggle — UI-only state
function Sidebar() {
  const open = useStore((s) => s.ui.sidebar)
  return <aside className={open ? 'open' : 'closed'} />
}

// --- Performance comparison ---
// With coarse selector (s => s):
//   - Revenue update → ALL 7 components re-render
// With fine selectors:
//   - Revenue update → only RevenueCard re-renders
//   - New activity → only ActivityFeed re-renders
//   - Mark read → only NotificationBell re-renders
//   - Sidebar toggle → only Sidebar re-renders
//   - Theme change → theme-dependent components (via separate selectors)
```

Result: dashboard performance independent of state size. Adding more store fields does not degrade existing components. Each component's re-render frequency equals its relevant update frequency — not total update frequency.

---

### Why This Matters

Zustand's selector architecture is its superpower. Used correctly, components re-render only when their data changes. Used incorrectly (new objects, coarse selectors, missing shallow), performance regresses to Context-level — every change re-renders everything. The difference between a well-tuned Zustand app and a poorly-tuned one is 10x re-render count. Real dashboards, editors, and data-heavy apps depend on selector hygiene. This module is the difference between "Zustand is fast" and "why is my Zustand app slow?"

---

### Common Questions

**Q: Should I use one selector per field or one selector with shallow?**
A: Per-field selectors are preferred for hot paths (frequent updates, heavy components). Shallow is fine for cold paths (infrequent updates, simple components). Per-field means zero object allocation; shallow allocates a small object that gets compared. For a component reading 5 fields with infrequent updates, shallow is cleaner. For a component reading 1 field that updates every frame, per-field avoids the allocation entirely.

**Q: Does selector composition cause cascading re-renders?**
A: No. Composition just calls functions during state diff. The component subscribes to the composed selector's return value. If composed result changes, component re-renders. If not, it skips. No cascade. The risk is accidental oversubscription — a composed selector that extracts too much state causes the component to re-render on unrelated changes.

**Q: Can I use `useStore` without a selector?**
A: Yes. `useStore()` without selector subscribes to entire store. Only use for tiny stores (2-3 fields). For any store with > 3 fields, provide a selector. Responsible for accidental performance regression when store grows.

**Q: How does Zustand's selector compare to Redux `useSelector`?**
A: Same concept. Both accept selector function and optional equality function. Both use `Object.is` by default. Redux `useSelector` re-runs on every dispatch; Zustand re-runs on every state mutation. Redux has built-in shallow equality via `shallowEqual`; Zustand provides `shallow` import. The mental model is identical.

**Q: What about selector performance with 10,000 subscribers?**
A: Zustand iterates all subscriber selectors on each state change. 10,000 selectors running simple property access completes in < 5ms. This is rarely the bottleneck. The bottleneck is React reconciliation (re-rendering). Zustand's selector iteration is O(n) on subscriber count with negligible per-selector cost.

---

## Examples

### Example 1: Fixing Selector Anti-patterns — Before and After

**Problem**: Dashboard re-renders 12 components on every state update. 500ms interaction latency.

**Before** (bad selectors):
```typescript
function Dashboard() {
  // All three subscriptions re-render on any state change
  const user = useStore((s) => s.user)
  const metrics = useStore((s) => s.metrics)
  const notifications = useStore((s) => s.notifications)
  // ... renders user info, metrics cards, notification list
}
```

Root cause: extracting `s.user` subscribes to entire user object. For metrics card, extracting `s.metrics` subscribes to all metrics. Notifications list subscribes to entire notifications array.

**After** (fine-grained selectors):
```typescript
function UserName() {
  const name = useStore((s) => s.user.name)
  return <span>{name}</span>
}

function RevenueCard() {
  const revenue = useStore((s) => s.metrics.revenue)
  return <MetricCard title="Revenue" value={revenue} />
}

function UsersCard() {
  const users = useStore((s) => s.metrics.users)
  return <MetricCard title="Users" value={users} />
}

function UnreadBadge() {
  const unreadCount = useStore((s) => s.notifications.filter((n) => !n.read).length, shallow)
  return <Badge count={unreadCount} />
}
```

**Result**: Revenue update re-renders 1 component (RevenueCard). Users update re-renders 1 component (UsersCard). New notification re-renders 1 component (UnreadBadge). User name update re-renders 1 component (UserName). Total re-render count drops from ~12 per change to 1 per change.

### Example 2: Memoized Selector for Expensive Computation

**Problem**: Order book with 50,000 entries. Need to show top 10 bids sorted by price. Every price tick recalculates.

```typescript
interface OrderBookStore {
  bids: Array<{ price: number; size: number }>
  asks: Array<{ price: number; size: number }>
  lastUpdate: number
}

// Memoized selector (manual)
function selectTopBids(state: OrderBookStore) {
  return state.bids
    .slice()
    .sort((a, b) => b.price - a.price)
    .slice(0, 10)
}

function TopBids() {
  // Without memoization: sorts 50k entries on every price tick (50ms)
  // With useMemo: only sorts when bids array reference changes
  const topBids = useStore((s) => {
    // Inline approximation — true memoization needs cached selector
    return s.bids.slice().sort((a, b) => b.price - a.price).slice(0, 10)
  })

  // Better: external memoized selector
  const topBids = useStore(selectTopBidsMemoized)

  return <Table data={topBids} />
}
```

Using an external memoized selector with `createSelector` pattern:

```typescript
// selectors.ts
let lastBids: OrderBookStore['bids'] = []
let lastTopBids: Array<{ price: number; size: number }> = []

export function selectTopBids(state: OrderBookStore) {
  if (state.bids === lastBids) return lastTopBids
  lastBids = state.bids
  lastTopBids = state.bids.slice().sort((a, b) => b.price - a.price).slice(0, 10)
  return lastTopBids
}
```

Without memoization: 50,000 entries sorted on every bid update (potentially 10/sec). With memoization: sort runs only when the `bids` array reference changes.

### Example 3: Composed Selectors for Heirarchical Data

**Problem**: CRM app — selectors for deals grouped by pipeline stage.

```typescript
// Atomic selectors
const selectDeals = (s: Store) => s.deals
const selectPipelineStages = (s: Store) => s.pipelineStages
const selectCurrentUser = (s: Store) => s.user

// Composed selectors
const selectDealsByStage = (s: Store) => {
  const deals = selectDeals(s)
  const stages = selectPipelineStages(s)
  return stages.map((stage) => ({
    ...stage,
    deals: deals.filter((d) => d.stageId === stage.id),
  }))
}

const selectCurrentUserDeals = (s: Store) => {
  const user = selectCurrentUser(s)
  const deals = selectDeals(s)
  return deals.filter((d) => d.ownerId === user.id)
}

// Components
function PipelineView() {
  const stagesWithDeals = useStore(selectDealsByStage, shallow)
  return stagesWithDeals.map((stage) => <StageColumn stage={stage} />)
}

function MyDealsWidget() {
  const myDeals = useStore(selectCurrentUserDeals, shallow)
  return <DealList deals={myDeals} />
}
```

Composition scales. Adding a new composed selector does not affect existing components. Each component subscribes only to its composed value.

---

## Key Takeaways
- Selector maps full state → partial state. Zustand re-renders component only when partial state changes
- Fine granularity always wins for expensive components. Coarse selectors cause wasted renders
- Shallow comparison (`shallow`) prevents object creation anti-pattern. Use when selector returns object/array
- Memoized selectors prevent recomputation of derived data. Essential for expensive transforms
- Selector composition builds complex selectors from atomic ones without subscription cascades
- Bound selectors drill into nested state — extract only the deep property, not the parent
- `useShallow` stabilizes inline selectors returning objects. Dev-mode warnings catch unstable returns
- Returning new objects/arrays from selectors is the #1 performance bug. Every state change creates new reference → re-render
- No selector (`useStore()`) subscribes to entire store — avoid for stores with many fields
- Real-world: optimized dashboard with fine selectors re-renders 1 component per update vs 12+ with coarse selectors

## Common Misconception

**"More selectors means more subscriptions means slower app."**

This is backwards. More selectors means more granular subscriptions — each subscription is cheaper because it runs a smaller selector, and the component re-renders less often. A component with 5 fine-grained selectors (name, email, avatar, role, joined) will re-render 1/5th as often as a component with 1 coarse selector extracting `s.user`. The listener overhead of 5 selectors vs 1 is negligible (~microseconds). The re-render savings from granularity is significant (~milliseconds). Always prefer more selectors that are fine-grained over fewer selectors that are coarse.

---

## Feynman Explain
(Explain selectors and granular subscriptions to a junior developer who knows only `useState`. They understand re-renders happen on setState. Use analogy: mailbox keys. Each selector is a key that opens one drawer. You only get notified when mail arrives in your drawer — not when any mail arrives anywhere in the building. Show simple store with 3 fields, 3 selectors, which update triggers which re-render.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain zustand-state-management` — AI probes gaps.*

---

## Reframe
(Pause. Critique: Is selector granularity always worth it? For a 3-field store, coarse selector + memoized component is simpler. For a 50-field store, granularity is essential. Where is the threshold? Also: selector-based subscription relies on reference equality. Does this make Zustand incompatible with deeply nested immutable updates? Compare to Jotai's atomic model where each atom is naturally granular without selector design. Write evaluation — consider team skill level, state complexity, and debugging cost.)

---

## Drill
Take the quiz. MCQs test selector mechanics, equality functions, anti-patterns, composition, and real-world optimization decisions.

Run: `learn.sh quiz zustand-state-management 09-selectors`

## Quiz: 09-selectors


### What does a Zustand selector function do?

- [ ] A: Modifies store state directly

- [✓] B: Maps full store state to a partial slice for subscription

- [ ] C: Creates a new store instance

- [ ] D: Defines the shape of state for TypeScript


**Answer:** B

A selector receives the full store state and returns a slice. useStore subscribes to that slice — component re-renders only when returned value changes.


### What is the default equality function Zustand uses to compare selector results?

- [ ] A: deepEqual

- [ ] B: shallowEqual

- [✓] C: Object.is

- [ ] D: ===


**Answer:** C

Zustand uses Object.is (same-value-zero equality) by default. Use shallow for object/array selectors.


### Component A uses useStore((s) =&gt; s.user.name). Component B uses useStore((s) =&gt; s.user.email). Store updates user.email. What happens?

- [ ] A: Both A and B re-render

- [ ] B: Only A re-renders

- [✓] C: Only B re-renders

- [ ] D: Neither re-renders


**Answer:** C

A's selector returns name (unchanged) → Object.is passes → skip. B's selector returns email (changed) → Object.is fails → re-render. Each subscription is independent.


### useStore((s) =&gt; ({ a: s.a, b: s.b })) re-renders on every state change. Why?

- [ ] A: Object.is compares strings, not objects

- [✓] B: The selector creates a new object reference each time — Object.is sees different reference

- [ ] C: Zustand cannot handle object selectors

- [ ] D: The store must use immer middleware for objects


**Answer:** B

Every call creates a new {} object. Object.is compares references → always different → always re-render. Fix: add shallow equality as second argument or use per-field selectors.


### Which equality function fixes object selectors in Zustand?

- [ ] A: reactFastCompare

- [✓] B: shallow

- [ ] C: deepEqual

- [ ] D: Object.assign


**Answer:** B

shallow compares each key/value pair with Object.is. If all values equal, returns true → skip re-render. Import from 'zustand/shallow'.


### A component reads s.user.preferences.theme. Which selector is correct?

- [ ] A: const user = useStore((s) =&gt; s.user); const theme = user.preferences.theme

- [✓] B: const theme = useStore((s) =&gt; s.user.preferences.theme)

- [ ] C: const theme = useStore((s) =&gt; s.user).preferences.theme

- [ ] D: const theme = useStore((s) =&gt; ({ theme: s.user.preferences.theme }), shallow)


**Answer:** B

Directly select the deep property. Option A and C subscribe to entire user object — any user field change re-renders. Option D creates unnecessary object. Option B is minimal: subscribes only to theme.


### When should you use useShallow over passing shallow as the equality function?

- [✓] A: When the selector is defined inline and returns an object

- [ ] B: When performance is critical and every microsecond matters

- [ ] C: When the store has more than 10 fields

- [ ] D: When using TypeScript strict mode


**Answer:** A

useShallow wraps selector with useMemo to stabilize selector reference across renders. This prevents unnecessary re-subscriptions when inline arrow functions create new references each render. Both behave identically for stable selector references.


### A dashboard has 50 components using fine-grained selectors. Store updates 10 times per second. How does Zustand handle selector evaluation?

- [✓] A: Runs all 50 selectors on each update, compares results with Object.is

- [ ] B: Runs only selectors for components currently visible

- [ ] C: Batches selectors and runs once per animation frame

- [ ] D: Skips selector eval if component has not mounted yet


**Answer:** A

Zustand iterates all subscribers on each state change, runs each selector, compares result via Object.is. For 50 simple selectors this completes in &lt; 0.05ms. The bottleneck is React re-render, not selector eval.


### Which is the correct way to create a memoized composed selector?

- [ ] A: const select = (s) =&gt; heavyComputation(s.items, s.filter)

- [✓] B: Create a caching wrapper that recomputes only when input selectors return new values

- [ ] C: Use Object.assign to freeze selector results

- [ ] D: Imported memo from React and wrap the component


**Answer:** B

Memoized selectors cache results and recompute only when inputs change. Implement via useMemo in component, createSelector from reselect, or manual caching wrapper. Option A recomputes every state change — defeats memoization.


### A team migrates from Context to Zustand but keeps using coarse selectors (extracting entire state objects). What outcome?

- [✓] A: App performance matches Context — unnecessary re-renders on any store change

- [ ] B: Performance improves dramatically because Zustand is faster than Context

- [ ] C: App breaks because Zustand requires fine selectors

- [ ] D: Selectors auto-optimize via Zustand's internal memoization


**Answer:** A

Coarse selectors (extracting objects) negate Zustand's advantage. Every change creates new object reference → Object.is fails → re-render. Same symptom as Context cascade. Selectors only help when used with fine granularity or shallow equality.


---

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

## Quiz: 10-middleware


### What is the signature of a Zustand middleware function?

- [ ] A: (set, get, api) =&gt; store

- [✓] B: (config) =&gt; (set, get, api) =&gt; store

- [ ] C: (config) =&gt; store

- [ ] D: (set, get) =&gt; (config) =&gt; store


**Answer:** B

Middleware takes a config function, returns a function that receives set/get/api, and returns the wrapped store. This lets middleware intercept set before passing to the next layer.


### Which Zustand middleware allows writing state updates with direct mutation (no spread operators)?

- [ ] A: persist

- [ ] B: devtools

- [✓] C: immer

- [ ] D: subscribeWithSelector


**Answer:** C

Immer wraps set with produce(). Inside set, state is a Draft — direct mutations like state.todos.push() are intercepted by Immer's Proxy and produce immutable state.


### In a middleware chain `devtools(persist(immer(config)))`, which middleware runs `set` first when an action is dispatched?

- [ ] A: devtools — it is outermost

- [ ] B: persist — it serializes state

- [✓] C: immer — it is innermost, so its set runs first

- [ ] D: config — the original store is always first


**Answer:** C

Middleware executes inside-out. `set` flows innermost outward: immer runs first (converts Drafts to plain objects), then persist (serializes), then devtools (logs). Outermost middleware is last to modify set before it reaches your code.


### What happens if you place `persist` outside `immer` in the middleware chain?

- [ ] A: Everything works — order does not matter

- [ ] B: Immer will not apply mutations — errors thrown

- [✓] C: Persist serializes Immer Proxy objects — corrupted JSON in storage

- [ ] D: Persist ignores immer — only stores plain object state


**Answer:** C

Immer produces Draft/Proxy objects inside set. If persist serializes before immer resolves the Draft, it serializes non-serializable Proxy objects. immer must be innermost so its set converts Drafts to plain objects before persist reads the result.


### Which `persist` config option selects only specific fields for storage?

- [ ] A: select

- [ ] B: pick

- [✓] C: partialize

- [ ] D: filter


**Answer:** C

partialize receives full state, returns partial object to persist. Example: partialize: (s) =&gt; ({ user: s.user, token: s.token }) skips ephemeral fields like searchResults.


### Your store uses `devtools` middleware. How do you name an action so it appears clearly in the Redux DevTools timeline?

- [✓] A: Pass a name string as third argument to set()

- [ ] B: Define action name in the devtools config object

- [ ] C: Use a named function in the store definition

- [ ] D: Actions are automatically named by the middleware


**Answer:** A

Third argument to set is the action name: set({ count: 1 }, false, 'increment'). It appears in DevTools as the action type. Without it, the action shows as 'anonymous' or 'set'.


### A custom logging middleware logs every state change. A component calls set 60 times/second on scroll. What is the best fix?

- [ ] A: Remove the logging middleware entirely

- [✓] B: Throttle the log call, not the set — sample at 1s intervals

- [ ] C: Debounce the set call itself

- [ ] D: Wrap the entire store in requestAnimationFrame


**Answer:** B

Throttle only the console.log, not the set. set must execute immediately for responsive UI. Check Date.now() in middleware and only log if &gt; 1000ms since last log. Or gate behind NODE_ENV.


### You persist a Set object via Zustand persist. On rehydrate, it becomes a plain Array. How do you restore it?

- [ ] A: Convert it in the action, not in persistence

- [ ] B: Use partialize to transform on save

- [✓] C: Use merge or onRehydrateStorage to reconstruct on load

- [ ] D: Sets cannot be persisted — use Arrays only


**Answer:** C

JSON loses type information — Set becomes Array. Use merge: (saved, initial) =&gt; ({ ...initial, ...saved, tags: new Set(saved.tags) }) or onRehydrateStorage callback to reconstruct. partialize transforms on save (pre-serialization).


### A custom middleware factory `withAnalytics('eventName')` captures options at store creation. What happens if you need to change the event name at runtime?

- [✓] A: Re-create the store with new options

- [ ] B: Pass options as a getter function to middleware

- [ ] C: Modify the middleware closure directly

- [ ] D: Use a ref to hold mutable event name


**Answer:** A

Middleware closures capture options at creation time. For dynamic options, either pass a function () =&gt; opts, use a shared ref object, or re-create the store. Direct closure modification is unreliable.


### Which middleware should be outermost in a combined devtools + persist + immer chain?

- [ ] A: immer — to resolve Drafts before anything else sees state

- [ ] B: persist — to capture state before devtools modifies it

- [✓] C: devtools — to log the final state after all transforms

- [ ] D: Order does not matter as long as immer is included


**Answer:** C

devtools outermost captures the final state after immer resolves Drafts and persist serializes. This gives accurate diffs in the DevTools panel. devtools also sees persist's rehydration events when outermost.


---

# Module 11: Derived State — Computed Values, Selector Composition

Est. study time: 2h
Language: en

## Learning Objectives
- Distinguish derived state from raw store state — compute instead of store
- Implement memoized selectors with reselect's createSelector for expensive derivations
- Compose raw and derived selectors into reusable selector graphs
- Design normalized stores with derived views for flexible data access

---

## Core Content

### Derived State Concept — Compute, Don't Store

Derived state is data computed from existing store state. You do not store it — you calculate it on demand.

```typescript
// Raw state (stored)
interface Store {
  items: Todo[]
  filter: 'all' | 'active' | 'completed'
}

// Derived state (computed)
// - filteredTodos: s.items.filter(i => matches filter)
// - activeCount: s.items.filter(i => !i.done).length
// - completedCount: s.items.filter(i => i.done).length
```

Principle: store minimum, derive everything else. Raw state is source of truth. Derived state is ephemeral — always consistent because it recomputes from source.

Redundant storage causes bugs:

```typescript
// BAD — storing derived state
interface BadStore {
  items: Todo[]
  filter: 'all' | 'active' | 'completed'
  filteredItems: Todo[]  // ← derived, stored redundantly
  activeCount: number    // ← derived, stored redundantly
  completedCount: number // ← derived, stored redundantly
}

// When addItem runs, must update 4 fields → can desync
const useBadStore = create<BadStore>((set) => ({
  // ...
  addItem: (item) => set((state) => {
    const newItems = [...state.items, item]
    return {
      items: newItems,
      filteredItems: applyFilter(newItems, state.filter), // must keep in sync
      activeCount: newItems.filter((i) => !i.done).length, // must keep in sync
      completedCount: newItems.filter((i) => i.done).length, // must keep in sync
    }
  }),
}))
```

Derived state eliminates sync surface. One source update → all derivations automatically reflect new state.

> **Think**: You have `items: Todo[]` and `totalItems: number` in store. What happens when `items` changes but code forgets to update `totalItems`?
>
> *Answer: totalItems diverges from reality. Component reads stale count. Bug manifests as off-by-one display. Hard to catch because store shape is valid. Fix: derive totalItems as `s.items.length` — always correct.*

### Selector-Based Computation — Pure Functions from State

Derived state lives in selectors, not in store:

```typescript
const useStore = create<Store>((set) => ({
  items: [
    { id: '1', text: 'Learn Zustand', done: true },
    { id: '2', text: 'Build project', done: false },
    { id: '3', text: 'Write tests', done: false },
  ],
  filter: 'active',
  setFilter: (filter) => set({ filter }),
  addItem: (text) => set((s) => ({ items: [...s.items, { id: nanoid(), text, done: false }] })),
  toggleItem: (id) => set((s) => ({ items: s.items.map((i) => i.id === id ? { ...i, done: !i.done } : i) })),
}))

// Derived selectors (pure functions)
const selectFilteredTodos = (s: Store) => {
  if (s.filter === 'all') return s.items
  const done = s.filter === 'completed'
  return s.items.filter((i) => i.done === done)
}

const selectActiveCount = (s: Store) =>
  s.items.filter((i) => !i.done).length

const selectCompletedCount = (s: Store) =>
  s.items.filter((i) => i.done).length

// Components use derived selectors directly
function TodoList() {
  const todos = useStore(selectFilteredTodos)
  return todos.map((t) => <TodoItem key={t.id} todo={t} />)
}

function TodoFooter() {
  const active = useStore(selectActiveCount)
  const completed = useStore(selectCompletedCount)
  return <span>{active} active — {completed} completed</span>
}
```

Derived selectors are pure functions: same state → same result. No side effects. No mutations. They are testable without React.

> **Think**: `selectFilteredTodos` runs on every state change. For 10,000 todos, filter runs 10,000 iterations each time any field updates (even irrelevant fields like `theme`). Why is this okay? When is it not?
>
> *Answer: Acceptable when items rarely change and filter is small. Not okay when items update every frame (animations, real-time data). Solution: memoized selectors — recompute only when `s.items` or `s.filter` reference changes.*

### Memoized Selectors — createSelector from Reselect

Reselect's `createSelector` caches derived results. Only recomputes when input selectors return new values:

```typescript
import { createSelector } from 'reselect'

// Input selectors (atomic, no memoization needed)
const selectItems = (s: Store) => s.items
const selectFilter = (s: Store) => s.filter

// Derived selector (memoized)
const selectFilteredTodos = createSelector(
  [selectItems, selectFilter],
  (items, filter) => {
    if (filter === 'all') return items
    const done = filter === 'completed'
    return items.filter((i) => i.done === done)
  }
)

// Further derived selectors compose from memoized ones
const selectFilteredCount = createSelector(
  [selectFilteredTodos],
  (todos) => todos.length
)

const selectStats = createSelector(
  [selectItems, selectFilteredTodos],
  (items, filtered) => ({
    total: items.length,
    filtered: filtered.length,
    active: items.filter((i) => !i.done).length,
    completed: items.filter((i) => i.done).length,
  })
)
```

`createSelector` creates a new selector each call. Call it once, export the result:

```typescript
// selectors.ts
export const useFilteredTodos = () => useStore(selectFilteredTodos)
export const useStats = () => useStore(selectStats)
// Or pass createSelector result directly to useStore
```

Manual memoization (no library):

```typescript
function createMemoSelector<State, Result>(
  selectors: Array<(s: State) => any>,
  combiner: (...args: any[]) => Result
): (s: State) => Result {
  let lastArgs: any[] = []
  let lastResult: Result
  return (state: State) => {
    const args = selectors.map((fn) => fn(state))
    const changed = args.some((arg, i) => !Object.is(arg, lastArgs[i]))
    if (!changed) return lastResult
    lastArgs = args
    lastResult = combiner(...args)
    return lastResult
  }
}
```

Reselect's default cache size is 1. For selectors with parameterized input, use `createSelectorCreator` with a custom cache:

```typescript
import { createSelectorCreator, lruCache } from 'reselect'

const createCachedSelector = createSelectorCreator({
  memoize: lruCache({ maxSize: 10 }),
  argsMemoize: lruCache({ maxSize: 10 }),
})

const selectTodosByStatus = createCachedSelector(
  [selectItems, (_, status: 'all' | 'active' | 'completed') => status],
  (items, status) => {
    if (status === 'all') return items
    return items.filter((i) => status === 'completed' ? i.done : !i.done)
  }
)

// Component passes parameter
function FilteredView({ status }: { status: 'all' | 'active' | 'completed' }) {
  const todos = useStore((s) => selectTodosByStatus(s, status))
  return <List items={todos} />
}
```

> **Think**: Without memoization, a 10,000-item todo list recomputes filter on every unrelated state change (e.g., app theme toggle). How many operations per toggle? With createSelector?
>
> *Answer: Without: 10,000 iterations per toggle (items.filter). With: 0 iterations — items reference unchanged → memoized result returned. Difference visible at ms scale. At 10 updates/sec, memoization saves 100k array iterations per second.*

### Computed Properties in Store — get() Derivations

Zustand store supports computed properties via `get()` inside state:

```typescript
const useStore = create<Store>((set, get) => ({
  items: [],
  filter: 'all',

  // Computed properties (not stored, re-derived on access)
  get filteredItems() {
    const state = get()
    if (state.filter === 'all') return state.items
    const done = state.filter === 'completed'
    return state.items.filter((i) => i.done === done)
  },
}))

// Access computed value
const filtered = useStore.getState().filteredItems
```

Getters live on store state object. They recompute on every access. No memoization — use for simple derivations called rarely.

For frequently accessed computed values, use derived selectors instead (memoized outside the store).

> **Think**: When would you use `get()` computed property over a selector? When is it harmful?
>
> *Answer: Use get() for one-off access outside React (event handlers, middleware, subscribers). Harmful when called in render — creates new derived value on every render without memoization. Selectors integrate with Zustand's subscription model; get() bypasses it.*

### Selector Composition — Building a Selector Graph

Compose raw and derived selectors into a graph. Each selector is reusable building block:

```typescript
// ---- Raw selectors (atomic) ----
const selectItems = (s: Store) => s.items
const selectFilter = (s: Store) => s.filter
const selectUser = (s: Store) => s.user
const selectTags = (s: Store) => s.tags

// ---- Derived selectors (memoized) ----
const selectFilteredItems = createSelector(
  [selectItems, selectFilter],
  (items, filter) => filter === 'all' ? items : items.filter((i) => i.done === (filter === 'completed'))
)

const selectItemCounts = createSelector(
  [selectItems],
  (items) => ({
    total: items.length,
    active: items.filter((i) => !i.done).length,
    completed: items.filter((i) => i.done).length,
  })
)

// ---- Composed selectors (combine raw + derived) ----
const selectFilteredWithMeta = createSelector(
  [selectFilteredItems, selectItemCounts, selectUser],
  (items, counts, user) => ({
    items,
    counts,
    currentUser: user.name,
  })
)

// ---- Feature-specific selectors (composed for component needs) ----
const selectDashboardData = createSelector(
  [selectItemCounts, selectUser, selectTags],
  (counts, user, tags) => ({
    progress: counts.completed / counts.total || 0,
    userName: user.name,
    popularTags: tags.filter((t) => t.count > 5).map((t) => t.name),
  })
)
```

Selector composition creates a directed acyclic graph (DAG). Changes propagate: raw selector changes → derived selector recomputes → composed selector recomputes.

Advantages over flat selectors:
- Reusable atoms: every composed selector uses same `selectItems`
- Testable: each selector unit-testable in isolation
- Performant: memoization at each level prevents cascade
- Readable: selector names describe what they return

> **Think**: Component uses `selectFilteredWithMeta`. User name updates. Does `selectFilteredItems` re-run?
>
> *Answer: No. selectFilteredWithMeta depends on selectFilteredItems, selectItemCounts, selectUser. Only selectUser recomputes. selectFilteredItems and selectItemCounts hit cache — their inputs (items, filter) unchanged. React component only re-renders once with new user name in meta.*

### Performance — Selector vs Store Computation

| Location | Pros | Cons | Use when |
|----------|------|------|----------|
| Selector (derived) | No storage cost, always fresh, composes naturally | Runs on every state diff, no built-in cache | Frequent reads, infrequent source changes |
| Memoized selector | Cached, runs only on input change | Cache memory, cache invalidation edge cases | Expensive derivation, frequent source changes |
| Store computed (get) | Simple, available in middleware | No memoization, not subscribed by components | One-off access, event handlers |
| Store stored (redundant) | Fastest read (no compute) | Sync bugs, larger store, manual updates | Hot path reads with stable derived values |

Guideline: derive in selector by default. Memoize when recomputation cost exceeds cache overhead. Store computed rarely — only when measurement proves selector cost is bottleneck.

Derived selectors run synchronously during render or subscription diff. Keep them pure and fast. Delegate truly heavy work (search indexing, data transformation) to Web Workers or lazy computation.

> **Think**: A search box filters 100k products by name. Every keystroke recomputes filtered list. Where should derivation live? What makes this different from simple filter?
>
> *Answer: Memoized selector with debounced input. Store searchTerm raw, derive filteredProducts via createSelector. The filter runs on every keystroke (100k iterations). Add debounce: derive from debouncedSearchTerm, not raw searchTerm. If 100k iterations > 16ms (one frame), move filtering to Web Worker or use IndexedDB query.*

### Derived State in Render — useMemo Wrapping Selector Result

When a derived selector returns complex objects, wrap in `useMemo` to stabilize reference between renders:

```typescript
function Dashboard() {
  // Without useMemo: creates new { total, active, completed } on every render
  const stats = useStore(selectItemCounts) // returns { total, active, completed }

  // With useMemo: stabilizes object reference
  const stableStats = useMemo(
    () => useStore.getState().items.filter((i) => !i.done).length,
    []
  )
  // But this pattern misses updates — use derived selector instead
}
```

Correct pattern — selector returns scalar or use `shallow`:

```typescript
import { shallow } from 'zustand/shallow'

function Dashboard() {
  // Object returned by selector — use shallow equality
  const stats = useStore(selectItemCounts, shallow)

  // Or use per-field selectors
  const total = useStore((s) => s.items.length)
  const active = useStore((s) => s.items.filter((i) => !i.done).length)

  return <StatsPanel total={total} active={active} />
}
```

For parameterized derived data inside component:

```typescript
function TodoItem({ id }: { id: string }) {
  const item = useStore((s) => s.items.find((i) => i.id === id))

  // Memoize expensive sub-derivation per item
  const wordCount = useMemo(() => {
    if (!item) return 0
    return item.text.split(/\s+/).length
  }, [item?.text])

  return <div>{item?.text} ({wordCount} words)</div>
}
```

`useMemo` inside component is last resort. Prefer external memoized selectors — they are reusable, testable, and do not couple derivation to component lifecycle.

> **Think**: `useStore(selectItemCounts)` returns `{ total: 3, active: 1, completed: 2 }`. Component destructures and renders. A field unrelated to counts changes. Does component re-render?
>
> *Answer: Yes — if selectItemCounts creates a new object each time (unmemoized), Object.is sees different reference → re-render. Even though values { 3, 1, 2 } are same. Fix: memoize selectItemCounts with createSelector or add shallow equality.*

### Normalized State + Derived Views — Store Flat, Select Shaped

Normalized state stores entities flat (by ID). Derived selectors reshape for views:

```typescript
// ---- Normalized store ----
interface Store {
  todos: Record<string, Todo>  // { [id]: Todo }
  todoIds: string[]           // ordered list of IDs
  projects: Record<string, Project>
  projectIds: string[]
  filter: 'all' | 'active' | 'completed'
}

// ---- Derived views ----

// 1. Array view (most common component need)
const selectTodoArray = createSelector(
  [(s: Store) => s.todos, (s: Store) => s.todoIds],
  (todosMap, ids) => ids.map((id) => todosMap[id]).filter(Boolean)
)

// 2. Filtered + sorted view
const selectVisibleTodos = createSelector(
  [selectTodoArray, (s: Store) => s.filter],
  (todos, filter) => {
    let filtered = filter === 'all' ? todos : todos.filter((t) =>
      filter === 'completed' ? t.done : !t.done
    )
    return filtered.sort((a, b) => b.createdAt - a.createdAt)
  }
)

// 3. Joined view (todo + project name)
const selectTodosWithProject = createSelector(
  [selectVisibleTodos, (s: Store) => s.projects],
  (todos, projects) => todos.map((t) => ({
    ...t,
    projectName: projects[t.projectId]?.name ?? 'No Project',
  }))
)

// 4. Grouped view
const selectTodosByProject = createSelector(
  [selectVisibleTodos],
  (todos) => {
    const grouped: Record<string, Todo[]> = {}
    for (const todo of todos) {
      const key = todo.projectId ?? '__none__'
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(todo)
    }
    return grouped
  }
)

// 5. Aggregate view
const selectProjectProgress = createSelector(
  [(s: Store) => s.todos, (s: Store) => s.projects],
  (todos, projects) => {
    const projectIds = Object.keys(projects)
    return projectIds.map((id) => {
      const projectTodos = Object.values(todos).filter((t) => t.projectId === id)
      return {
        id,
        name: projects[id].name,
        total: projectTodos.length,
        completed: projectTodos.filter((t) => t.done).length,
        progress: projectTodos.length > 0
          ? projectTodos.filter((t) => t.done).length / projectTodos.length
          : 0,
      }
    })
  }
)
```

Normalization enables flexible views. Single source of truth (`todos[id]`) supports unlimited derived views without duplication. Adding new view does not change store shape.

> **Think**: Compare `todos: Todo[]` (array store) to `todos: Record<string, Todo>` + `todoIds: string[]`. When does normalized form matter?
>
> *Answer: Normalized matters when: (1) multiple views need different orderings/filters, (2) entities referenced from multiple parents (todo in project view + user view + date view), (3) frequent updates to individual entities (updating todo by ID in O(1) vs O(n) find). For simple CRUD lists, array is fine.*

### Real Example — Todo List with Derived Views

```typescript
// store.ts
interface Todo {
  id: string; text: string; done: boolean; priority: 'low' | 'medium' | 'high'
  projectId: string; createdAt: number; tags: string[]
}

interface Project {
  id: string; name: string; color: string
}

interface Store {
  todos: Record<string, Todo>
  todoOrder: string[]
  projects: Record<string, Project>
  projectOrder: string[]
  filters: { status: 'all' | 'active' | 'completed'; priority: string | null; projectId: string | null }
  addTodo: (text: string, priority: string, projectId: string) => void
  toggleTodo: (id: string) => void
  setFilter: (filters: Partial<Store['filters']>) => void
}

const useStore = create<Store>((set) => ({
  todos: {},
  todoOrder: [],
  projects: {},
  projectOrder: [],
  filters: { status: 'all', priority: null, projectId: null },
  addTodo: (text, priority, projectId) => set((s) => {
    const id = crypto.randomUUID()
    return {
      todos: { ...s.todos, [id]: { id, text, done: false, priority, projectId, createdAt: Date.now(), tags: [] } },
      todoOrder: [id, ...s.todoOrder],
    }
  }),
  toggleTodo: (id) => set((s) => ({
    todos: { ...s.todos, [id]: { ...s.todos[id], done: !s.todos[id].done } },
  })),
  setFilter: (partial) => set((s) => ({ filters: { ...s.filters, ...partial } })),
}))

// selectors.ts
const selectTodos = createSelector(
  [(s: Store) => s.todos, (s: Store) => s.todoOrder],
  (todos, order) => order.map((id) => todos[id]).filter(Boolean)
)

const selectFilteredTodos = createSelector(
  [selectTodos, (s: Store) => s.filters],
  (todos, filters) => todos.filter((t) => {
    if (filters.status === 'active' && t.done) return false
    if (filters.status === 'completed' && !t.done) return false
    if (filters.priority && t.priority !== filters.priority) return false
    if (filters.projectId && t.projectId !== filters.projectId) return false
    return true
  })
)

// Derived: grouped by project
const selectGroupedByProject = createSelector(
  [selectFilteredTodos, (s: Store) => s.projects],
  (todos, projects) => {
    const groups: Record<string, { project: Project; todos: Todo[] }> = {}
    for (const todo of todos) {
      const pid = todo.projectId
      if (!groups[pid]) groups[pid] = { project: projects[pid], todos: [] }
      groups[pid].todos.push(todo)
    }
    return Object.values(groups).sort((a, b) => a.project.name.localeCompare(b.project.name))
  }
)

// Derived: stats
const selectStats = createSelector(
  [selectTodos],
  (todos) => ({
    total: todos.length,
    active: todos.filter((t) => !t.done).length,
    completed: todos.filter((t) => t.done).length,
    highPriority: todos.filter((t) => t.priority === 'high' && !t.done).length,
    completionRate: todos.length > 0 ? todos.filter((t) => t.done).length / todos.length : 0,
  })
)

// Derived: search results
const selectSearchResults = createSelector(
  [selectFilteredTodos, (_, query: string) => query],
  (todos, query) => {
    if (!query.trim()) return todos
    const lower = query.toLowerCase()
    return todos.filter((t) => t.text.toLowerCase().includes(lower))
  }
)

// Components
function TodoApp() {
  const grouped = useStore(selectGroupedByProject, shallow)
  const stats = useStore(selectStats, shallow)

  return (
    <div>
      <StatsPanel stats={stats} />
      {grouped.map(({ project, todos }) => (
        <ProjectSection key={project.id} project={project} todos={todos} />
      ))}
    </div>
  )
}

function SearchResults({ query }: { query: string }) {
  const results = useStore((s) => selectSearchResults(s, query))
  return <List items={results} />
}
```

Key design: store contains only raw state (`todos: Record`, `filters`). Every view component derives what it needs. Adding "todos due today" view = one new derived selector. No store change.

> **Think**: The stats selector iterates all todos. If a single todo toggles done, does the entire component tree re-render?
>
> *Answer: Only if memoization fails. selectStats uses createSelector — recomputes only when `selectTodos` output changes (new/removed todo) or individual todo done property changes (because done is used inside filter). React re-renders only components subscribed to changed selectors. StatsPanel gets new stats object. Grouped view only re-renders if filtered list changed.*

### Testing Derived State — Unit Test Selectors Directly

Derived selectors are pure functions. Test them without store or React:

```typescript
// selectors.test.ts
import { describe, it, expect } from 'vitest'
import { selectFilteredTodos, selectStats, selectGroupedByProject } from './selectors'

const mockState = {
  todos: {
    '1': { id: '1', text: 'Learn Zustand', done: true, priority: 'high', projectId: 'p1', createdAt: 100, tags: [] },
    '2': { id: '2', text: 'Build project', done: false, priority: 'medium', projectId: 'p1', createdAt: 200, tags: [] },
    '3': { id: '3', text: 'Write docs', done: false, priority: 'low', projectId: 'p2', createdAt: 300, tags: [] },
  },
  todoOrder: ['1', '2', '3'],
  projects: {
    'p1': { id: 'p1', name: 'Core', color: 'blue' },
    'p2': { id: 'p2', name: 'Docs', color: 'green' },
  },
  filters: { status: 'all', priority: null, projectId: null },
  addTodo: () => {},
  toggleTodo: () => {},
  setFilter: () => {},
}

describe('selectFilteredTodos', () => {
  it('returns all todos when filter status is all', () => {
    const result = selectFilteredTodos(mockState)
    expect(result).toHaveLength(3)
  })

  it('filters active todos when status is active', () => {
    const state = { ...mockState, filters: { ...mockState.filters, status: 'active' } }
    const result = selectFilteredTodos(state)
    expect(result).toHaveLength(2)
    expect(result.every((t) => !t.done)).toBe(true)
  })

  it('filters by priority', () => {
    const state = { ...mockState, filters: { ...mockState.filters, priority: 'high' } }
    const result = selectFilteredTodos(state)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })
})

describe('selectStats', () => {
  it('computes correct counts', () => {
    const stats = selectStats(mockState)
    expect(stats.total).toBe(3)
    expect(stats.active).toBe(2)
    expect(stats.completed).toBe(1)
    expect(stats.completionRate).toBeCloseTo(0.333)
  })
})

describe('selectGroupedByProject', () => {
  it('groups todos by project sorted alphabetically', () => {
    const groups = selectGroupedByProject(mockState)
    expect(groups).toHaveLength(2)
    expect(groups[0].project.name).toBe('Core')
    expect(groups[1].project.name).toBe('Docs')
    expect(groups[0].todos).toHaveLength(2)
    expect(groups[1].todos).toHaveLength(1)
  })
})
```

Test characteristics:
- No store creation, no React rendering, no mocking
- Each selector tested with representative state shapes
- Edge cases: empty state, all-completed, no-matching-filter
- Output assertions on both value and structure

For memoized selectors, verify cache behavior:

```typescript
it('memoizes result when inputs unchanged', () => {
  const first = selectFilteredTodos(mockState)
  const second = selectFilteredTodos(mockState) // same state reference
  expect(first).toBe(second) // same reference — cached
})
```

> **Think**: Why test selectors directly instead of through store integration tests?
>
> *Answer: (1) Speed: selector test is microseconds vs store test is milliseconds. (2) Isolation: selector test fails only if selector logic is wrong, not if store setup is wrong. (3) Coverage: direct call with edge case states that are hard to produce through store actions. (4) Debugging: failing selector test pinpoints exact input + expected output.*

---

### Why This Matters

Derived state is the difference between a store that scales and a store that becomes a tangled mess. Raw state-only stores grow monotonically — every new feature adds more fields, more sync logic, more bug surface. Derived state stores let you add features by writing selectors: no store changes, no migrations, no desync bugs. For a team building a real app, mastering derived state means every view is as fast as the rawest selector graph allows. Without it, stores grow to 50+ fields with 15 manual "synchronization" calls that inevitably drift. This module is the foundation for normalized data, search, filtering, and the testing module that follows.

---

### Common Questions

**Q: Should derived state be a selector or a hook?**
A: Selector. Hooks couple derivation to React component lifecycle. Selectors are pure functions — testable, composable, framework-agnostic. Export selector as hook wrapper (`useFilteredTodos = () => useStore(selectFilteredTodos)`) for ergonomics, but keep derivation logic in pure selectors.

**Q: When should I store derived state instead of computing it?**
A: Only when measurement proves selector recomputation is a bottleneck. Storing derived state adds sync surface — every mutation must update both source and derived field. Two exceptions: (1) value is extremely expensive to compute and changes rarely, (2) value must be persisted (e.g., cache of API response shape).

**Q: Reselect createSelector vs zustand middleware for computed state?**
A: createSelector is lighter, more testable, and works outside Zustand. Zustand computed middleware (e.g., `computed` from `zustand-computed`) adds computed fields to store state object — convenient but couples derivation to store shape. Prefer createSelector for most cases; use computed middleware only when you need derived values in middleware or subscribers that access `getState()`.

**Q: Can derived selectors trigger side effects?**
A: No. Selectors are pure functions used during render and subscription diff. Side effects in selectors cause unpredictable behavior: double-firing in StrictMode, stale closures, impossible-to-trace bugs. Side effects belong in store actions, middleware, or subscribe handlers.

**Q: How does normalized + derived compare to using Jotai atoms?**
A: Jotai atoms are inherently derived — each atom computes from other atoms. Zustand + derived selectors achieves same effect: normalized store as root atom, selectors as derived atoms. Zustand gives explicit control over memoization and caching; Jotai gives automatic fine-grained reactivity. Choose Zustand when you want explicit selector graph; choose Jotai when you want automatic dependency tracking.

---

## Examples

### Example 1: E-Commerce Product Catalog with Derived Filters

**Problem**: Product store with 5000 products. Need filtered, sorted, paginated, and aggregated views derived from flat product data.

```typescript
interface ProductStore {
  products: Record<string, Product>
  productIds: string[]
  categories: Record<string, Category>
  cart: Record<string, number>  // productId -> quantity
  filters: {
    category: string | null
    minPrice: number
    maxPrice: number
    inStock: boolean | null
    sortBy: 'price-asc' | 'price-desc' | 'name' | 'rating'
    search: string
  }
  page: number
  pageSize: number
}

// Derived: filtered products
const selectFilteredProducts = createSelector(
  [(s: ProductStore) => s.products, (s: ProductStore) => s.productIds, (s: ProductStore) => s.filters],
  (products, ids, filters) => {
    let result = ids.map((id) => products[id]).filter(Boolean)
    if (filters.category) result = result.filter((p) => p.categoryId === filters.category)
    if (filters.inStock !== null) result = result.filter((p) => p.stock > 0 === filters.inStock)
    if (filters.search) {
      const q = filters.search.toLowerCase()
      result = result.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
    }
    result = result.filter((p) => p.price >= filters.minPrice && p.price <= filters.maxPrice)
    if (filters.sortBy === 'price-asc') result.sort((a, b) => a.price - b.price)
    if (filters.sortBy === 'price-desc') result.sort((a, b) => b.price - a.price)
    if (filters.sortBy === 'rating') result.sort((a, b) => b.rating - a.rating)
    return result
  }
)

// Derived: paginated slice
const selectPage = createSelector(
  [selectFilteredProducts, (s: ProductStore) => s.page, (s: ProductStore) => s.pageSize],
  (products, page, pageSize) => {
    const start = (page - 1) * pageSize
    return products.slice(start, start + pageSize)
  }
)

// Derived: aggregation
const selectCategoryAggregates = createSelector(
  [selectFilteredProducts, (s: ProductStore) => s.categories],
  (products, categories) => {
    const counts: Record<string, { name: string; count: number; avgPrice: number }> = {}
    for (const p of products) {
      const cat = p.categoryId
      if (!counts[cat]) counts[cat] = { name: categories[cat]?.name ?? 'Unknown', count: 0, avgPrice: 0 }
      counts[cat].count++
      counts[cat].avgPrice = (counts[cat].avgPrice * (counts[cat].count - 1) + p.price) / counts[cat].count
    }
    return Object.values(counts)
  }
)

// Derived: cart summary
const selectCartSummary = createSelector(
  [(s: ProductStore) => s.products, (s: ProductStore) => s.cart],
  (products, cart) => {
    const entries = Object.entries(cart).filter(([_, qty]) => qty > 0)
    return {
      itemCount: entries.reduce((sum, [_, qty]) => sum + qty, 0),
      total: entries.reduce((sum, [productId, qty]) => sum + (products[productId]?.price ?? 0) * qty, 0),
      items: entries.map(([productId, qty]) => ({
        product: products[productId],
        quantity: qty,
        subtotal: (products[productId]?.price ?? 0) * qty,
      })),
    }
  }
)
```

Store has 4 raw fields (products, categories, cart, filters). Every view is derived. Adding "filter by rating" requires 0 store changes — one new condition in selectFilteredProducts.

### Example 2: Replacing Stored Derived State with Selectors

**Problem**: Existing store stores derived state redundantly. 3 sync bugs this month.

```typescript
// Before — storing derived state (buggy)
interface BadStore {
  posts: Post[]
  totalLikes: number  // derived
  topPost: Post | null // derived
  sortedPosts: Post[] // derived
  stats: { avgLikes: number; postCount: number; uniqueAuthors: number } // derived

  addPost: (post: Post) => void
  likePost: (postId: string) => void
  // Every action must manually sync all derived fields
}
```

Refactored to derived selectors:

```typescript
// After — compute on demand (no sync surface)
interface GoodStore {
  posts: Post[]
  addPost: (post: Post) => void
  likePost: (postId: string) => void
}

// All derived state lives in selectors
const selectTotalLikes = (s: GoodStore) =>
  s.posts.reduce((sum, p) => sum + p.likes, 0)

const selectTopPost = (s: GoodStore) =>
  s.posts.reduce((best, p) => p.likes > (best?.likes ?? 0) ? p : best, s.posts[0] ?? null)

const selectSortedPosts = (s: GoodStore) =>
  [...s.posts].sort((a, b) => b.createdAt - a.createdAt)

const selectStats = createSelector(
  [(s: GoodStore) => s.posts],
  (posts) => ({
    avgLikes: posts.length > 0 ? posts.reduce((s, p) => s + p.likes, 0) / posts.length : 0,
    postCount: posts.length,
    uniqueAuthors: new Set(posts.map((p) => p.author)).size,
  })
)
```

Result: store shrinks from 7 fields to 2. Zero sync bugs because sync is impossible (nothing to sync). Adding "most commented post" is one new selector — no store migration.

### Example 3: Multi-Level Derived Views for Analytics Dashboard

**Problem**: Dashboard showing team performance. Raw data: time entries. Need per-user, per-project, per-week aggregations.

```typescript
interface TimeStore {
  entries: TimeEntry[]  // { userId, projectId, hours, date }
  users: Record<string, User>
  projects: Record<string, Project>
}

// Level 1: group by user
const selectEntriesByUser = createSelector(
  [(s: TimeStore) => s.entries],
  (entries) => {
    const grouped: Record<string, TimeEntry[]> = {}
    for (const e of entries) {
      if (!grouped[e.userId]) grouped[e.userId] = []
      grouped[e.userId].push(e)
    }
    return grouped
  }
)

// Level 2: per-user totals
const selectUserTotals = createSelector(
  [selectEntriesByUser, (s: TimeStore) => s.users],
  (byUser, users) => Object.entries(byUser).map(([userId, entries]) => ({
    user: users[userId],
    totalHours: entries.reduce((s, e) => s + e.hours, 0),
    entryCount: entries.length,
    projectBreakdown: entries.reduce((b, e) => {
      b[e.projectId] = (b[e.projectId] ?? 0) + e.hours
      return b
    }, {} as Record<string, number>),
  }))
)

// Level 3: team summary
const selectTeamSummary = createSelector(
  [selectUserTotals],
  (userTotals) => ({
    totalHours: userTotals.reduce((s, u) => s + u.totalHours, 0),
    avgHoursPerUser: userTotals.length > 0
      ? userTotals.reduce((s, u) => s + u.totalHours, 0) / userTotals.length
      : 0,
    topPerformer: userTotals.sort((a, b) => b.totalHours - a.totalHours)[0]?.user ?? null,
    busiestProject: Object.entries(
      userTotals.reduce((acc, u) => {
        for (const [pid, hours] of Object.entries(u.projectBreakdown)) {
          acc[pid] = (acc[pid] ?? 0) + hours
        }
        return acc
      }, {} as Record<string, number>)
    ).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
  })
)
```

Three level graph: raw → per-user → team summary. Each level memoized. Adding "per-week view" inserts at level 1.5 without affecting existing selectors.

---

## Key Takeaways
- Derive instead of store: computed values from raw state eliminate sync bugs and reduce store surface
- Pure functions: derived selectors are testable pure functions — test without React or store instance
- createSelector memoization: cache expensive derivations, recompute only when inputs change
- Selector composition graph: raw atoms → derived → composed. Each level independently testable and memoized
- Normalized store + derived views: store flat entities, reshape via selectors for each view
- Performance: derive in selector by default. Memoize when recomputation cost matters. Store only when measured bottleneck
- get() computed: for simple, rarely-accessed derivations outside React
- useMemo in render: stabilize complex selector return values, but prefer memoized selectors or shallow equality
- Testing: direct selector calls with mock state. Fast, isolated, high coverage
- Real pattern: todo list with filter, group, search, stats — 4 derived selectors, 0 stored computed fields

## Common Misconception

**"Derived state in selectors is wasteful because selectors run on every state change."**

This misunderstands memoization. Non-memoized derived selectors do run on every state diff — but the cost of a pure computation is often negligible (microseconds). Memoized selectors (createSelector) run only when their inputs change — for most apps, this means zero recomputation in 99% of state diffs. The alternative — storing derived state — guarantees bugs from desync. Derived selectors trade negligible CPU cost for correctness guarantees. Always prefer derivation over duplication. Only optimize when profiler shows selector recomputation in the hot path.

---

## Feynman Explain
(Explain derived state to a junior developer who understands Excel or SQL. Analogy: store state = raw data table. Derived selectors = spreadsheet formulas (SUMIF, FILTER) or SQL views. You don't store totals in the raw table — you compute them. Why? Because if you update a row, totals auto-update. Same in Zustand: store raw values, compute views via selectors. Draw: raw table → filter → group → aggregate → chart. Each step is a selector. Changes propagate automatically.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain zustand-state-management` — AI probes gaps.*

---

## Reframe
(Pause. Critique: Is "derive everything" always correct? What about state that is expensive to compute and rarely changes — like a full-text search index? Counter-argument: some derived state is worth storing (cache) if compute cost > storage cost and staleness tolerance exists. Where is the line? Also: selector composition graph can become complex — debugging a chain of 10 nested selectors is harder than reading a single function. Does composition always win? Write your evaluation — consider trade-offs between purity, performance, and debuggability.)

---

## Drill
Take the quiz. MCQs test derived state concept, memoization, selector composition, normalized stores, and testing patterns.

Run: `learn.sh quiz zustand-state-management 11-derived-state`

## Quiz: 11-derived-state


### What is derived state in the context of Zustand?

- [ ] A: State that is persisted to localStorage

- [✓] B: Data computed from existing store state rather than stored directly

- [ ] C: State that is shared across multiple stores

- [ ] D: The initial state passed to create()


**Answer:** B

Derived state is computed from raw store state. Store minimum raw data, derive everything else via selectors. This eliminates sync bugs because derivation is always consistent with source.


### What problem occurs when derived state is stored redundantly in the store?

- [ ] A: Store initialization becomes slower

- [✓] B: Derived values can desync from source when mutations forget to update them

- [ ] C: TypeScript cannot infer derived field types

- [ ] D: create() throws an error for computed fields


**Answer:** B

Every mutation must update both raw and derived fields. When code forgets, derived value diverges from reality. Example: updating items without updating totalItems displays stale count. Deriving s.items.length eliminates this.


### Which statement about derived selectors is true?

- [ ] A: They must be defined inside the create() callback

- [✓] B: They are pure functions — same state input always produces same output

- [ ] C: They can trigger side effects like API calls

- [ ] D: They cannot be used with TypeScript


**Answer:** B

Derived selectors are pure functions. Same state in → same result out. No side effects, no mutations. This makes them testable without React or store instance, and composable into selector graphs.


### What does reselect's createSelector do?

- [ ] A: Creates a new Zustand store

- [✓] B: Memoizes derived computation — only recomputes when input selectors return new values

- [ ] C: Deep-clones the store state to prevent mutations

- [ ] D: Generates TypeScript types from store shape


**Answer:** B

createSelector accepts input selectors and a combiner function. It caches the combiner result. On next call, it checks if any input selector returned a new value. If all unchanged, returns cached result. Prevents unnecessary recomputation.


### A selector graph: selectItems → selectFilteredItems → selectStats. User name updates. What recomputes?

- [ ] A: All three selectors recompute

- [ ] B: Only selectStats recomputes

- [✓] C: None recompute because user name is unrelated

- [ ] D: The entire store re-renders all subscribers


**Answer:** C

If selectStats depends only on selectFilteredItems (not on user name nor selectItems directly), and selectFilteredItems is memoized via createSelector, then when only user name changes, selectFilteredItems returns cached result (items reference unchanged). selectStats sees same input → returns cached result. Zero recomputation.


### When should you wrap useStore selector result in useMemo?

- [ ] A: Always — useMemo prevents all unnecessary re-renders

- [✓] B: When the selector returns a newly created object/array and the component passes it to child components as props

- [ ] C: When the store has fewer than 10 fields

- [ ] D: Never — useMemo inside component defeats Zustand's subscription model


**Answer:** B

useMemo stabilizes object/array references between renders. Use when derived selector creates new objects and child components depend on reference equality (React.memo, useEffect deps). Prefer memoized selectors (createSelector) or shallow equality instead — they fix the problem at the source rather than the consumer.


### Normalized store stores entities as Record&lt;string, Entity&gt; + string[]. What is the primary benefit?

- [ ] A: Smaller bundle size

- [✓] B: Single source of truth enables multiple derived views without data duplication

- [ ] C: Faster store creation

- [ ] D: Automatic TypeScript type generation


**Answer:** B

Normalized stores store each entity once by ID. Derived selectors reshape into arrays, groups, joins, or aggregates per view. Adding a new view (e.g., 'todos grouped by priority') does not change store shape. Multiple views derive from same source without duplication.


### How do you test derived selectors?

- [ ] A: Render a React component and assert on DOM output

- [✓] B: Call the selector function directly with mock state and assert on return value

- [ ] C: Dispatch store actions and check derived fields in store

- [ ] D: Snapshot test the entire store


**Answer:** B

Derived selectors are pure functions. Call with mock state → assert return value. No store creation, no React rendering. Fast (microseconds), isolated (fails only when selector logic is wrong), high coverage (test edge cases directly). Example: selectStats(mockState).total.


### A store has items: Todo[] and a computed get filteredItems() using get(). Why is this pattern problematic for React components?

- [ ] A: get() is async and does not work with synchronous component rendering

- [✓] B: get() computed properties recompute on every access without memoization — no subscription integration

- [ ] C: get() cannot access other store state

- [ ] D: get() throws errors in production mode


**Answer:** B

get() reads current state but does not establish a subscription. Component calling getState().filteredItems gets the value but does not re-render when it changes. Additionally, getters recompute on every access without caching. Use derived selectors for component subscriptions — they integrate with Zustand's subscription system.


### A team stores items as Todo[] (array, not normalized). They need: sorted list, grouped-by-project view, and search results. What is the consequence?

- [ ] A: No consequence — array stores work fine for all derived views

- [✓] B: Each derived view requires O(n) iteration. Without memoization, unrelated updates re-run all derivations. Adding entities requires O(n) splice or spread.

- [ ] C: Array stores cannot be used with createSelector

- [ ] D: Derived state only works with normalized stores


**Answer:** B

Array stores work but have trade-offs: adding/removing in middle requires O(n) splice; each derived view iterates full array. Normalized (Record + ID array) gives O(1) lookup/update. For small lists (&lt;100 items), array is fine. For large lists with many views, normalized reduces iteration and gives O(1) updates.


---

# Module 12: Testing Zustand Stores: Pure Logic with useBoundStore

Est. study time: 2h
Language: en

## Learning Objectives
- Write unit tests for Zustand stores using Vitest without React rendering
- Test store actions, selectors, middleware, and async flows in isolation
- Mock persist middleware storage and verify hydrate/rehydrate cycles
- Choose what to test in stores vs what to test in components

---

## Core Content

### Testing the Vanilla Store: getState, setState, subscribe

Zustand stores are vanilla JavaScript objects. The `create` function returns a plain store with three methods — no React dependency.

```typescript
import { createStore } from 'zustand/vanilla'

interface CounterState {
  count: number
  increment: () => void
}

const store = createStore<CounterState>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}))

// Test access
store.getState()       // { count: 0, increment: fn }
store.setState({ count: 5 })
store.subscribe((state) => console.log('changed', state))
```

Key testing insight: you never mount a component to test store logic.

> **Think**: Why does the vanilla store test better than a React component that uses useState? What architectural property makes Zustand easier to test?
>
> *Answer: Zustand separates state logic from rendering. useState couples state and component. You can test getState/setState/subscribe in isolation with zero DOM. This is the same property that makes Redux reducers testable — pure state transitions. Zustand extends this to actions and middleware.*

### Testing Store Actions: Call Action, Assert State Change

Actions are functions on the store. Call them, then assert the resulting state.

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { createStore } from 'zustand/vanilla'

describe('counter store actions', () => {
  let store: ReturnType<typeof createStore<CounterState>>

  beforeEach(() => {
    store = createStore<CounterState>((set) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
      decrement: () => set((state) => ({ count: state.count - 1 })),
      reset: () => set({ count: 0 }),
    }))
  })

  it('starts at 0', () => {
    expect(store.getState().count).toBe(0)
  })

  it('increments count', () => {
    store.getState().increment()
    expect(store.getState().count).toBe(1)
  })

  it('decrements count', () => {
    store.getState().decrement()
    expect(store.getState().count).toBe(-1)
  })

  it('resets count', () => {
    store.getState().increment()
    store.getState().increment()
    store.getState().reset()
    expect(store.getState().count).toBe(0)
  })
})
```

Pattern: **beforeEach rebuilds store to fresh state**. This prevents test pollution.

> **Think**: What happens if you share one store across tests without resetting? What bugs appear?
>
> *Answer: Tests become order-dependent. Test A increments count to 1. Test B expects count === 0 — fails. Worse: tests pass in isolation but fail in CI when run in different order. Always recreate the store per test or call setState to reset.*

### Testing Selectors: Pure Function Testing

Selectors transform state. Test them as pure functions — no store, no React.

```typescript
// store.ts
interface Todo {
  id: string
  text: string
  done: boolean
}

interface TodoState {
  todos: Todo[]
  filter: 'all' | 'done' | 'active'
}

// selectors.ts — extracted for testability
export const selectFilteredTodos = (state: TodoState) => {
  switch (state.filter) {
    case 'done': return state.todos.filter((t) => t.done)
    case 'active': return state.todos.filter((t) => !t.done)
    default: return state.todos
  }
}

export const selectTodoCount = (state: TodoState) => ({
  total: state.todos.length,
  done: state.todos.filter((t) => t.done).length,
  active: state.todos.filter((t) => !t.done).length,
})
```

```typescript
// selectors.test.ts
import { describe, it, expect } from 'vitest'
import { selectFilteredTodos, selectTodoCount } from './selectors'

const sampleState: TodoState = {
  todos: [
    { id: '1', text: 'Learn Zustand', done: true },
    { id: '2', text: 'Write tests', done: false },
  ],
  filter: 'all',
}

describe('selectFilteredTodos', () => {
  it('returns all todos when filter is all', () => {
    expect(selectFilteredTodos(sampleState)).toHaveLength(2)
  })

  it('returns only done todos', () => {
    const state = { ...sampleState, filter: 'done' as const }
    expect(selectFilteredTodos(state)).toHaveLength(1)
    expect(selectFilteredTodos(state)[0].text).toBe('Learn Zustand')
  })
})
```

Vanilla JS testing of selectors: no setup, no mock, no provider.

> **Think**: How would you test a selector that composes multiple selectors with Zustand's `useShallow`? What is the test surface?
>
> *Answer: Test the composed result directly with a state object. useShallow only affects React re-render behavior — it does not change the selector's output. Test the selector's return value for correctness. Test shallow comparison separately if you suspect bugs in reference equality.*

### Testing Middleware: Custom Middleware with Test Config

Middleware wraps `create`. Test middleware behavior by observing how it intercepts setState.

```typescript
// logger.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createStore } from 'zustand/vanilla'

describe('logging middleware', () => {
  it('logs each state change', () => {
    const log = vi.fn()

    const store = createStore<{ count: number }>(
      (set) => ({
        count: 0,
        ...logMiddleware(set, log),
      })
    )

    store.getState().setCount?.(5)
    expect(log).toHaveBeenCalledTimes(1)
  })
})

function logMiddleware(
  set: any,
  log: ReturnType<typeof vi.fn>
) {
  return {
    setCount: (n: number) => {
      log('setCount called', n)
      set({ count: n })
    },
  }
}
```

Vanilla store + vi.fn spy = clean middleware tests. No React rendering.

> **Think**: What edge cases in middleware are hard to catch without testing? Which bugs only appear in production?
>
> *Answer: Middleware order bugs (subscribe before persist logs stale state), error swallowing (middleware catches but never re-throws), and performance issues (redundant setState calls). Only the last requires production profiling. Order and error handling are testable in unit tests.*

### Testing Persist Middleware: Mock Storage, Hydrate/Rehydrate

Persist middleware reads/writes localStorage. Mock the storage backend to test serialization and rehydration.

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { createStore } from 'zustand/vanilla'
import { persist } from 'zustand/middleware'

// Mock storage
const mockStorage: Storage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  get length() { return 0 },
  key: vi.fn(),
}

describe('persist middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('persists state on change', () => {
    const store = createStore(
      persist<{ count: number }>(
        (set) => ({ count: 0, setCount: (n: number) => set({ count: n }) }),
        { name: 'test-storage', storage: () => mockStorage }
      )
    )

    store.getState().setCount?.(5)
    expect(mockStorage.setItem).toHaveBeenCalledWith(
      'test-storage',
      expect.stringContaining('"count":5')
    )
  })

  it('rehydrates state on init', () => {
    mockStorage.getItem = vi.fn(() => JSON.stringify({
      state: { count: 10 },
      version: 0,
    }))

    const store = createStore(
      persist<{ count: number }>(
        (set) => ({ count: 0 }),
        { name: 'test-storage', storage: () => mockStorage }
      )
    )

    // onRehydrateStorage callback runs asynchronously
    // Use waitFor or check after microtask
    setTimeout(() => {
      expect(store.getState().count).toBe(10)
    }, 0)
  })
})
```

Mock storage removes DOM dependency. Tests stay fast and deterministic.

> **Think**: How would you test partial rehydration or migration of persisted state schema? What breaks if the stored schema differs from current?
>
> *Answer: Create mock storage with old schema. Verify migrate function transforms it to new schema. Without a migrate handler, stale schema produces undefined fields or runtime errors. Test both migrate function and the case where migrate is missing.*

### Testing Components with Zustand: Mock Store for Isolated Tests

When testing React components that consume Zustand, mock the store hook to supply controlled state.

```typescript
// Counter.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Counter from './Counter'

// Mock the store hook
const mockUseCounterStore = vi.fn()

vi.mock('./store', () => ({
  useCounterStore: (...args: any[]) => mockUseCounterStore(...args),
}))

beforeEach(() => {
  mockUseCounterStore.mockReturnValue({
    count: 0,
    increment: vi.fn(),
    decrement: vi.fn(),
  })
})

describe('Counter component', () => {
  it('renders current count', () => {
    render(<Counter />)
    expect(screen.getByText('0')).toBeDefined()
  })

  it('calls increment on button click', () => {
    const increment = vi.fn()
    mockUseCounterStore.mockReturnValue({
      count: 0,
      increment,
      decrement: vi.fn(),
    })

    render(<Counter />)
    fireEvent.click(screen.getByText('+'))
    expect(increment).toHaveBeenCalledOnce()
  })
})
```

Alternatively, render with a test store provider:

```typescript
import { create } from 'zustand'

function renderWithStore(ui: React.ReactElement, initial = { count: 0 }) {
  const testStore = create<CounterState>((set) => ({
    ...initial,
    increment: () => set((s) => ({ count: s.count + 1 })),
  }))

  return render(
    <StoreProvider store={testStore}>
      {ui}
    </StoreProvider>
  )
}
```

> **Think**: When should you mock the store vs render with a real store? What trade-off exists between isolation and confidence?
>
> *Answer: Mock store for isolated component tests (unit tests). Real store for integration tests. Mocks isolate rendering logic from state logic — a mock never catches store bugs. Real stores catch regression but require more setup. Rule: unit test store logic + component rendering separately; integration test them together for critical paths.*

### Vitest Patterns: beforeEach Reset, Cleanup

Standard Vitest setup for Zustand tests.

```typescript
// setup.ts — Vitest setup file
import { afterEach, vi } from 'vitest'

afterEach(() => {
  // Clean up all Zustand stores created during test
  vi.restoreAllMocks()
})
```

```typescript
// store.test.ts — preferred patterns
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createStore } from 'zustand/vanilla'

describe('store test patterns', () => {
  // FRESH STORE PER TEST — prevents pollution
  let store: ReturnType<typeof createStore<CounterState>>

  beforeEach(() => {
    store = createStore<CounterState>((set) => ({
      count: 0,
      increment: () => set((s) => ({ count: s.count + 1 })),
    }))
  })

  // MOCK CLEANUP — restore after each test
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('handles concurrent actions', () => {
    const updates = Array.from({ length: 100 }, (_, i) => i)

    updates.forEach(() => {
      store.getState().increment()
    })

    expect(store.getState().count).toBe(100)
  })
})
```

Key patterns:
- `beforeEach`: recreate store (or call `setState` to reset)
- `afterEach`: `vi.restoreAllMocks()`, clear fake timers
- Use `vi.useFakeTimers()` for debounced actions
- Avoid global store singletons in test suites

> **Think**: Why is `vi.restoreAllMocks()` important after each test? What happens without it?
>
> *Answer: Unrestored mocks leak across test files. A mock set in test A affects module-level mocks in test B. This produces flaky failures — tests pass in isolation but fail when run as a suite. Always restore in afterEach or in Vitest setup file.*

### Integration Testing: Store + Component Together

Integration tests exercise the full store-component pipeline.

```typescript
// Counter.integration.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Counter from './Counter'
import { useCounterStore } from './store'

describe('Counter integration', () => {
  beforeEach(() => {
    // Reset store between tests
    useCounterStore.setState({ count: 0 })
    // Clear React testing library
    cleanup()
  })

  it('increments on click — full pipeline', async () => {
    render(<Counter />)
    expect(screen.getByText('0')).toBeDefined()

    await userEvent.click(screen.getByText('+'))

    // Store updated
    expect(useCounterStore.getState().count).toBe(1)
    // Component re-rendered
    expect(screen.getByText('1')).toBeDefined()
  })

  it('multiple components share store state', () => {
    render(
      <>
        <Counter display="Counter A" />
        <Counter display="Counter B" />
      </>
    )

    fireEvent.click(screen.getAllByText('+')[0])

    // Both components reflect same store state
    expect(screen.getByText('1')).toBeDefined()
    // Both HTML elements show new count
    const displays = screen.getAllByText('1')
    expect(displays).toHaveLength(2)
  })
})
```

No mocks. Real store, real state transitions, real component re-renders.

> **Think**: Integration tests catch bugs that unit tests miss. Name a bug that survives unit tests but falls in integration tests for Zustand.
>
> *Answer: Selector transform bug. Unit tests on store pass (state is correct). Unit tests on component pass (render logic correct). But the selector returns a new object each call (no useShallow), causing infinite re-render. Integration test catches the re-render loop because both store + component execute together.*

### Testing Async Actions: Thunk-Style Async Store Actions

Async actions modify state after a promise resolves. Test with real promises or controlled async.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createStore } from 'zustand/vanilla'

interface AsyncState {
  data: string | null
  loading: boolean
  error: string | null
  fetchData: (id: string) => Promise<void>
}

describe('async store actions', () => {
  it('handles successful fetch', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ text: 'hello' })

    const store = createStore<AsyncState>((set) => ({
      data: null,
      loading: false,
      error: null,
      fetchData: async (id: string) => {
        set({ loading: true, error: null })
        try {
          const res = await mockFetch(`/api/${id}`)
          set({ data: res.text, loading: false })
        } catch (err) {
          set({ error: (err as Error).message, loading: false })
        }
      },
    }))

    const promise = store.getState().fetchData('123')
    expect(store.getState().loading).toBe(true)

    await promise
    expect(store.getState().loading).toBe(false)
    expect(store.getState().data).toBe('hello')
  })

  it('handles fetch error', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Not found'))

    const store = createStore<AsyncState>((set) => ({
      data: null,
      loading: false,
      error: null,
      fetchData: async (id: string) => {
        set({ loading: true, error: null })
        try {
          const res = await mockFetch(`/api/${id}`)
          set({ data: res.text, loading: false })
        } catch (err) {
          set({ error: (err as Error).message, loading: false })
        }
      },
    }))

    await store.getState().fetchData('999')
    expect(store.getState().loading).toBe(false)
    expect(store.getState().error).toBe('Not found')
    expect(store.getState().data).toBeNull()
  })
})
```

Test loading state synchronously (before await), then resolved state (after await).

> **Think**: How would you test a race condition where two async actions fire sequentially and the first response arrives after the second? What assertion catches the stale data?
>
> *Answer: Fire action 1 (slow), fire action 2 (fast), await both. Assert final state equals action 2 result — not action 1 result. Use AbortController or a timestamp check in the action. Test the abort path: verify loading resets and stale data is discarded.*

### Coverage: What to Test in Stores vs What to Test in Components

| Layer | Test strategy | Example |
|-------|---------------|---------|
| **Store initial state** | Unit test | `expect(store.getState().count).toBe(0)` |
| **Store actions** | Unit test | Call action, assert state change |
| **Store selectors** | Pure function test | Pass state, assert derived value |
| **Middleware** | Unit test with spies | vi.fn() on setState, assert interception |
| **Persist** | Unit test with mock storage | Mock getItem/setItem, verify serialization |
| **Async actions** | Unit test with mock fetch | Assert loading → success/error transitions |
| **Component rendering** | Unit test with mocked store | Mock useBoundStore, assert DOM output |
| **Component interactions** | Integration test with real store | Click button, assert store + DOM updated |
| **Cross-component sync** | Integration test | Two components, one click, both update |

Do not test:
- Zustand internals (subscribe implementation, batching)
- React's re-render mechanism
- Third-party middleware internals
- Browser storage behavior (test your mock, not localStorage)

> **Think**: If you have 100% store coverage and 0% component coverage, what bugs reach production?
>
> *Answer: Rendering bugs — wrong selector wired to wrong component, missing useEffect sync, styling errors from conditional store values, component fails to subscribe to correct slice. Store tests prove state logic correct but say nothing about the UI layer.*

---

### Why This Matters

Zustand's vanilla core makes store testing trivial — no DOM, no React, no providers. This is a unique advantage over context-based state (useReducer + Context) and library-coupled stores (Redux requires store configuration). Teams that exploit this write faster, more reliable tests. The split between store tests (fast, unit, deterministic) and component tests (integration, slower) mirrors the test pyramid correctly. Wrong approach: test everything through the component. Right approach: test store logic in isolation, test rendering with real stores for critical paths, test edge cases (middleware ordering, persist migration, race conditions) at the store level.

---

### Common Questions

**Q: Should I use `createStore` from `zustand/vanilla` or `create` from `zustand` for tests?**
A: Use `createStore` (vanilla) for pure store logic tests. Use `create` (with React bindings) only when testing hooks or components. Vanilla tests do not require React `act()` and run without a DOM environment.

**Q: How do I test `subscribe` callbacks?**
A: Create a store, call `subscribe` with `vi.fn()`, then call an action. Assert the callback was called with the new state. Subscribe fires synchronously on every `setState` in vanilla Zustand.

**Q: My persist middleware test fails — store does not rehydrate. Why?**
A: Rehydration in Zustand persist is async (uses `Promise.resolve().then`). Wrap the assertion in `waitFor` or flush promises. Use `vi.runAllTimers()` if mocking timers, or check after a microtask.

**Q: Should I test every selector variant or sample patterns?**
A: Test every branch of the selector. If the selector has a switch on `filter` with 3 cases, write 3 tests (all, done, active). Selectors are pure functions with low maintenance cost. Coverage is cheap.

**Q: Can I use Vitest's `vi.mock` with Zustand barrel exports?**
A: Yes, but prefer `zustand/vanilla` imports in tests to avoid mocking React dependencies. If you must mock `useBoundStore`, mock the specific file — not the barrel barrel `zustand` package.

---

## Examples

### Example 1: Testing a Full Todo Store with Persist

```typescript
// store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface TodoState {
  todos: Array<{ id: string; text: string; done: boolean }>
  addTodo: (text: string) => void
  toggleTodo: (id: string) => void
}
```

```typescript
// store.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createStore } from 'zustand/vanilla'
import { persist } from 'zustand/middleware'

const mockStorage: Storage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  get length() { return 0 },
  key: vi.fn(),
}

let store: ReturnType<typeof createStore<TodoState>>

beforeEach(() => {
  vi.clearAllMocks()
  mockStorage.getItem = vi.fn(() => JSON.stringify({
    state: {
      todos: [{ id: '1', text: 'Existing', done: false }],
    },
    version: 0,
  }))
})

describe('Todo store', () => {
  it('rehydrates persisted todos', async () => {
    store = createStore(
      persist<TodoState>(
        (set) => ({
          todos: [],
          addTodo: (text) => set((s) => ({
            todos: [...s.todos, { id: Date.now().toString(), text, done: false }],
          })),
          toggleTodo: (id) => set((s) => ({
            todos: s.todos.map((t) => t.id === id ? { ...t, done: !t.done } : t),
          })),
        }),
        { name: 'todo-storage', storage: () => mockStorage }
      )
    )

    await vi.waitFor(() => {
      expect(store.getState().todos).toHaveLength(1)
    })
  })

  it('persists new todos', () => {
    store = createStore(
      persist<TodoState>(
        (set) => ({
          todos: [],
          addTodo: (text) => set((s) => ({
            todos: [...s.todos, { id: '2', text, done: false }],
          })),
          toggleTodo: (id) => set((s) => ({
            todos: s.todos.map((t) => t.id === id ? { ...t, done: !t.done } : t),
          })),
        }),
        { name: 'todo-storage', storage: () => mockStorage }
      )
    )

    store.getState().addTodo('New task')
    expect(mockStorage.setItem).toHaveBeenCalled()
    expect(mockStorage.setItem.mock.calls[0][1]).toContain('New task')
  })
})
```

### Example 2: Component Integration with Real Store

```typescript
// useCounterStore.ts
import { create } from 'zustand'

export const useCounterStore = create<{
  count: number
  increment: () => void
  double: () => void
}>((set) => ({
  count: 0,
  increment: () => set((s) => ({ count: s.count + 1 })),
  double: () => set((s) => ({ count: s.count * 2 })),
}))
```

```typescript
// CounterPanel.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { useCounterStore } from './useCounterStore'
import CounterPanel from './CounterPanel'

describe('CounterPanel integration', () => {
  beforeEach(() => {
    useCounterStore.setState({ count: 0 })
    cleanup()
  })

  it('increment and double work in sequence', () => {
    render(<CounterPanel />)
    fireEvent.click(screen.getByText('Increment'))
    fireEvent.click(screen.getByText('Double'))

    // After increment: count=1. After double: count=2
    expect(useCounterStore.getState().count).toBe(2)
    expect(screen.getByText('2')).toBeDefined()
  })

  it('reset restores initial state', () => {
    render(<CounterPanel />)
    fireEvent.click(screen.getByText('Increment'))
    fireEvent.click(screen.getByText('Reset'))

    expect(useCounterStore.getState().count).toBe(0)
    expect(screen.getByText('0')).toBeDefined()
  })
})
```

### Example 3: Testing Selector Performance with Reference Stability

```typescript
// selectors.ts
import { createSelectors } from './store'

export const selectItems = (state: ItemState) => state.items
export const selectItemCount = (state: ItemState) => state.items.length

// Selector that creates new reference — potential re-render issue
export const selectActiveItems = (state: ItemState) =>
  state.items.filter((i) => i.active)
```

```typescript
// selectors.test.ts
import { describe, it, expect } from 'vitest'

describe('selector reference stability', () => {
  const state1 = { items: [{ id: '1', active: true }], filter: 'all' }
  const state2 = { ...state1, filter: 'done' } // shallow copy, same items ref

  it('selectItems returns same reference for same items', () => {
    expect(selectItems(state1)).toBe(selectItems(state2))
  })

  it('selectActiveItems creates new reference each call', () => {
    const a = selectActiveItems(state1)
    const b = selectActiveItems(state1)
    // filter creates new array — reference changes!
    expect(a).not.toBe(b)
    // But contents are equal
    expect(a).toEqual(b)
  })
})
```

This test catches the implicit re-render problem: selectors using `.filter`, `.map`, `.reduce` produce new references each call. Components using these selectors without `useShallow` re-render on every store change.

---

## Key Takeaways
- Zustand vanilla store (`createStore`) tests without React — pure getState/setState/subscribe
- beforeEach store reset prevents test pollution and flaky ordering
- Selectors are pure functions — test them standalone with state input
- Middleware testing uses vi.fn() spies on setState
- Persist middleware needs mock Storage — test serialization and rehydration
- Mock store hooks for unit component tests; use real stores for integration
- Test loading/error state transitions synchronously in async action tests
- Stores: test state logic, middleware behavior, selector correctness
- Components: test rendering, interactions, cross-component sync
- Reference stability of selectors is testable — catch re-render bugs before they ship

## Common Misconception

**"Zustand stores need React Testing Library to test."**

Zustand stores are vanilla JavaScript. The core testing pattern — createStore, getState, setState, subscribe — uses zero React. React Testing Library is needed only for component rendering tests. The vanilla testing path is faster (microseconds vs milliseconds), simpler (no act(), no waitFor), and more deterministic. Developers who reach for RTL for every Zustand test waste time and miss the architectural insight: Zustand separates state logic from React, and tests should mirror that separation.

---

## Feynman Explain
(Explain Zustand testing strategy to a developer who knows Redux testing patterns. They are familiar with testing reducers and actions with store.dispatch(). Translate: how does Zustand's testing approach differ? Where is it simpler? Where does it require new patterns like persist mocking and selector reference checks?)

---

## Reframe
(Pause. Critique: Is testing store logic in isolation worth the overhead of maintaining separate vanilla test files? When does the integration test (store + component together) give more confidence than isolated unit tests? Consider a small app (3 stores) vs a large app (50 stores). Where do you draw the line?)

---

## Drill
Take the quiz. MCQs test store testing patterns, middleware mocking, persist hydration, and coverage boundaries.

Run: `learn.sh quiz zustand-state-management 12-testing`

## Quiz: 12-testing


### Which Zustand API is used to test store logic without React?

- [ ] A: create from zustand

- [✓] B: createStore from zustand/vanilla

- [ ] C: useStore hook

- [ ] D: useBoundStore hook


**Answer:** B

createStore (zustand/vanilla) returns a plain store with getState/setState/subscribe. No React dependency. The 'create' from 'zustand' includes React bindings. Hooks require React environment.


### What is the correct pattern to prevent test pollution in Zustand tests?

- [ ] A: Use a global store singleton for all tests

- [✓] B: Recreate the store in beforeEach or call setState to reset

- [ ] C: Import the store fresh every test

- [ ] D: Use vi.resetModules() before each store import


**Answer:** B

Recreate store in beforeEach (or call setState with initial state) to give each test a clean state. Global singletons cause order-dependent failures. vi.resetModules() is heavy-handed and unnecessary.


### How should selectors be tested?

- [ ] A: Render a component that uses the selector, assert DOM output

- [✓] B: Pass a state object to the selector function, assert return value

- [ ] C: Mock the store hook and test the mock return value

- [ ] D: Use Testing Library's renderHook to call the selector


**Answer:** B

Selectors are pure functions (state in, derived value out). Test them directly with a state object — no store, no React, no rendering. This is the simplest and fastest test pattern.


### What must be mocked to test Zustand's persist middleware?

- [ ] A: The entire zustand/middleware module

- [✓] B: localStorage or a custom Storage object

- [ ] C: The create function from zustand/vanilla

- [ ] D: React's useEffect


**Answer:** B

Persist middleware reads from/writes to storage. Mock the Storage object (getItem, setItem) to control serialization and rehydration without browser dependency. Test that setItem is called with correct serialized state and that getItem restores state.


### A selector uses .filter() which creates a new array reference each call. What testing approach catches the resulting re-render bug?

- [ ] A: Snapshot test of the component

- [✓] B: Selector test asserting reference equality (toBe) across calls with same state

- [ ] C: Integration test with act() wrapping the store update

- [ ] D: Mock console.log and count render calls


**Answer:** B

Assert selectItems(storeState) is(selectItems(storeState)) catches reference instability. If the selector returns a new reference each call, components without useShallow re-render on every store change. Reference tests in selector unit tests catch this early.


### What is the recommended approach for testing async store actions?

- [ ] A: Set timeout to wait for the action to complete

- [✓] B: Mock the async operation, assert loading state before await, assert result after await

- [ ] C: Only test synchronous actions — skip async tests

- [ ] D: Use Testing Library's waitFor on the store's getState


**Answer:** B

Mock the async dependency (fetch, API call). Assert loading=true before awaiting the promise. Assert loading=false and the resolved data after await. This tests the full lifecycle: pending → success/error transition.


### When testing persist middleware rehydration, why might the assertion fail even though the mock returns correct data?

- [ ] A: The mock is misconfigured

- [✓] B: Rehydration is asynchronous — assertions need vi.waitFor or microtask flush

- [ ] C: Persist middleware does not hydrate in test mode

- [ ] D: createStore does not support persist middleware


**Answer:** B

Zustand persist rehydration uses Promise.resolve().then(), making it async. Assert immediately after creating the store — the hydrator has not run yet. Use vi.waitFor() or flush promises before asserting rehydrated state.


### Which testing scenario is best served by mocking the Zustand store hook?

- [ ] A: Testing selector correctness

- [ ] B: Testing persist middleware serialization

- [✓] C: Isolated component unit testing with controlled store state

- [ ] D: Integration testing of multiple components sharing the same store


**Answer:** C

Mock the store hook for isolated component unit tests — supply exact state and action stubs. Integration tests (D) should use real stores to catch cross-component bugs. Selector tests (A) and persist tests (B) are pure store tests needing no mock.


### A team has 100% store test coverage and 0% component test coverage. Which bug category reaches production?

- [ ] A: Store action logic errors

- [ ] B: Middleware order bugs

- [✓] C: Component rendering bugs and wrong selector-to-component wiring

- [ ] D: Rehydration failures


**Answer:** C

Store tests prove state logic is correct — actions, selectors, middleware. They do not test which component uses which selector, whether the component renders correctly, or whether conditional UI based on store state is styled properly. Component tests catch rendering bugs.


### Two components subscribe to different slices of the same Zustand store. One component updates store state. What type of test catches whether the second component re-renders correctly?

- [ ] A: Unit test of the store action

- [ ] B: Unit test of the second component in isolation with mocked store

- [✓] C: Integration test with both components rendering and a real store

- [ ] D: Selector unit test


**Answer:** C

Cross-component synchronization requires both components + real store to execute together. Isolated unit tests (B) mock the store and miss re-render interactions. Store tests (A/D) verify individual state transitions but not React's subscription mechanism across components.


---

# Module 13: Zustand Weakness 1 — Over-Subscription and Debugging

Est. study time: 2h
Language: en

## Learning Objectives
- Identify over-subscription: components re-render on unrelated state changes due to coarse selectors
- Diagnose root causes: parent object extraction, inline object creation, missing shallow equality
- Apply fixes: leaf selectors, useShallow, shallow equality function, selector memoization
- Debug subscription chains using DevTools, custom logger, and React DevTools profiler

---

## Core Content

### The Over-Subscription Problem

Over-subscription: component subscribes to more state than it needs. Store updates any field → component re-renders even when its relevant data unchanged.

```typescript
interface Store {
  user: { name: string; email: string; avatar: string }
  settings: { theme: string; locale: string }
  notifications: Array<{ id: string; text: string; read: boolean }>
}
```

Component reads only `user.name` but subscribes to entire `user`:

```typescript
// Over-subscribed: re-renders on any user.email or user.avatar change
function Greeting() {
  const user = useStore((s) => s.user)
  return <h1>Hello, {user.name}</h1>
}
```

Each `user.email` update re-renders Greeting even though name unchanged. Waste grows with store size and subscriber count.

> **Think**: Dashboard with 20 components. Each uses `useStore((s) => s)`. How many re-renders per single-field update?
>
> *Answer: 20 re-renders. Every component subscribed to entire store. Fix: leaf selectors → 1 re-render per relevant update.*

### Root Cause: Selecting Parent Objects

Over-subscription pattern #1: extracting parent object instead of leaf value.

```typescript
// BAD — subscribes to entire user object
const user = useStore((s) => s.user)
// GOOD — subscribes only to name
const name = useStore((s) => s.user.name)
```

Extracting `s.user` creates new object reference each render (unless memoized). Reference change → Object.is fails → re-render. Even if name unchanged.

Root cause: selector returns non-primitive. Objects, arrays, Maps, Sets always get new reference on extraction.

> **Think**: `useStore((s) => s.user)` extracts same-shaped object every call. Why does Object.is say "different"?
>
> *Answer: Object.is compares references, not values. Each selector call creates fresh object reference in JavaScript — even if contents identical. Only primitive values (string, number, boolean, null, undefined) compare correctly across calls.*

### Reference Instability in Selectors

Selectors returning new objects/arrays cause re-render on every state change — even irrelevant ones.

```typescript
// Creates new { name, email } object every call → re-renders on ANY state change
const { name, email } = useStore((s) => ({
  name: s.user.name,
  email: s.user.email
}))

// Creates new filtered array every call → re-renders on ANY state change
const activeNotifications = useStore((s) =>
  s.notifications.filter((n) => !n.read)
)
```

Problem: selector runs on every state mutation. If selector returns new reference, component re-renders regardless of whether actual values changed.

Fix options:
1. Extract scalar values individually
2. Shallow equality via `shallow` or `useShallow`
3. Memoized selector (for derived data)

> **Think**: `useStore((s) => s.items.length)` — does this create reference instability?
>
> *Answer: No. Returns primitive number. Object.is compares 5 === 5 correctly. Only non-primitive returns cause instability.*

### Shallow Equality Fix

`shallow` compares top-level keys/values via `Object.is`. Prevents false-positive re-renders from object creation.

```typescript
import { shallow } from 'zustand/shallow'

// With shallow: compares { name, email } keys + values
const { name, email } = useStore(
  (s) => ({ name: s.user.name, email: s.user.email }),
  shallow
)
```

**Without** shallow: every state change → new object → re-render.
**With** shallow: every state change → new object → shallow compare keys → if name+email unchanged → skip re-render.

`useShallow` wrapper stabilizes selector reference AND applies shallow:

```typescript
import { useShallow } from 'zustand/react'

function Profile() {
  const { name, email } = useStore(
    useShallow((s) => ({ name: s.user.name, email: s.user.email }))
  )
  return <div>{name} | {email}</div>
}
```

> **Think**: Why does `useShallow` exist if `shallow` works the same? What extra does `useShallow` do?
>
> *Answer: `useShallow` wraps selector in useMemo to stabilize closure reference between renders. `shallow` alone does not stabilize the selector fn — inline arrow function creates new reference each render, causing additional store subscription calls. `useShallow` prevents this redundant work.*

### Debugging Store Changes with subscribe

`useStore.subscribe` listens to state changes without triggering re-render. Diagnostic tool.

```typescript
const useStore = create({ count: 0, text: 'hello' })

// Log every state change
const unsub = useStore.subscribe((newState, oldState) => {
  console.log('State changed:', {
    newState,
    oldState,
    diff: Object.keys(newState).filter(
      (k) => newState[k] !== oldState[k]
    )
  })
})
// Later: unsub()
```

Selective subscription — log only specific slice:

```typescript
const logCount = useStore.subscribe(
  (s) => s.count,   // selector
  (count, prevCount) => {
    console.log(`Count: ${prevCount} → ${count}`)
  }
)
```

> **Think**: `subscribe` receives newState then oldState. Why oldState second? What API pattern does this follow?
>
> *Answer: Matches Observable/EventListener convention — most libraries pass event data first, metadata second. Zustand store is observable; first arg = relevant change, second = context. Also matches Redux subscribe pattern where listeners receive the action-first paradigm.*

### Devtools Middleware for Action Tracing

`devtools` middleware connects Zustand to Redux DevTools browser extension. Shows action name, before/after state, time-travel.

```typescript
import { devtools } from 'zustand/middleware'

const useStore = create(
  devtools(
    (set) => ({
      count: 0,
      increment: () =>
        set((state) => ({ count: state.count + 1 }), false, 'increment'),
      decrement: () =>
        set((state) => ({ count: state.count - 1 }), false, 'decrement'),
    }),
    { name: 'CounterStore', enabled: process.env.NODE_ENV === 'development' }
  )
)
```

Third argument to `set` is action name — appears in DevTools timeline. Without it, action shows as "anonymous".

DevTools features:
- Jump between state snapshots (time-travel)
- Diff each action: which fields changed
- Inspect current state tree
- Filter by action name

> **Think**: Team ships devtools to production by accident. What risk? How does `enabled` flag help?
>
> *Answer: Devtools maintains WebSocket connection to extension. In production, this leaks internal state structure and potentially sensitive data. `enabled: process.env.NODE_ENV === 'development'` strips the connection in production builds. Also reduces bundle size when tree-shaken.*

### Custom Logger Middleware

Custom middleware logs every set call — action name, prev state, next state, time elapsed.

```typescript
const logger = (config) => (set, get, api) =>
  config(
    (...args) => {
      const prev = get()
      const start = performance.now()
      set(...args)
      const after = get()
      const actionName = args[2] || 'anonymous'
      console.group(`%c${actionName}`, 'font-weight: bold')
      console.log('%cprev:', 'color: gray', prev)
      console.log('%cnext:', 'color: green', after)
      console.log(`%c${(performance.now() - start).toFixed(2)}ms`, 'color: blue')
      console.groupEnd()
    },
    get,
    api
  )
```

Usage with devtools:

```typescript
const useStore = create(
  devtools(
    logger(
      (set) => ({
        count: 0,
        increment: () => set((s) => ({ count: s.count + 1 }), false, 'increment'),
      })
    ),
    { name: 'AppStore' }
  )
)
```

> **Think**: Logger middleware logs every set. High-frequency updates (animation, websocket) flood console. How to handle?
>
> *Answer: Add sampling — `if (Date.now() - lastLog < 1000) { set(...args); return }` to throttle log but not the set itself. Or gate behind `process.env.NODE_ENV`. Or accept only named actions: `if (!actionName) { set(...args); return }` skips anonymous internal updates.*

### Store Change Tracing — Which Action Caused Re-Render

When component re-renders unexpectedly, trace backwards: which action caused state change that triggered subscription?

Technique 1: Wrap `set` with origin-tracking middleware.

```typescript
const traceable = (config) => (set, get, api) =>
  config(
    (...args) => {
      const stack = new Error().stack?.split('\n').slice(2, 6).join('\n') || 'unknown'
      const actionName = args[2] || 'anonymous'
      console.log(`[set] ${actionName} called from:\n${stack}`)
      set(...args)
    },
    get,
    api
  )
```

Technique 2: React DevTools Profiler — record flamegraph, identify which component re-rendered and what caused it.

Technique 3: `why-did-you-render` — patches React to log unnecessary re-renders. Works with Zustand.

```typescript
import whyDidYouRender from '@welldone-software/why-did-you-render'
whyDidYouRender(React, { trackAllPureComponents: true })
```

> **Think**: You see Dashboard re-renders on every notification. Trace shows action 'addNotification'. What selector patterns cause this?
>
> *Answer: Either (1) Dashboard uses `useStore((s) => s)` — subscribes to everything, (2) Dashboard extracts parent object like `s.user` or `s.notifications`, or (3) Dashboard selector returns new array/object without shallow. Rule: trace subscription chain to find which selector includes notification fields.*

### Over-Subscription in Practice — Large Store Cascades

Large store (50+ fields) with many subscribers: one update cascades through multiple components.

```typescript
interface LargeStore {
  user: User
  products: Product[]
  orders: Order[]
  cart: Cart
  notifications: Notification[]
  ui: UIState
  analytics: Analytics
  theme: ThemeConfig
  i18n: LocaleMessages
  permissions: Permission[]
  // ... more fields
}
```

Components subscribing broadly:

```typescript
// Component A: reads products
const products = useStore((s) => s.products) // subscribes to full array

// Component B: reads orders
const orders = useStore((s) => s.orders) // subscribes to full array

// Component C: reads notifications
const notifications = useStore((s) => s.notifications) // subscribes to full array
```

Problem: adding one product triggers `s.products` update → Component A re-renders (expected). But `s.orders` (Component B) and `s.notifications` (Component C) re-render too because they extract entire arrays — each array is new reference.

Cascade cost: 1 update → 3 re-renders → each re-rendered component may trigger child re-renders → tree-wide propagation.

Fix: leaf selectors for each component. Component B should read only `s.orders.length` or specific order fields.

> **Think**: Order list shows count (5) in sidebar. Currently extracts `s.orders`. When a product updates, sidebar re-renders. Selector fix?
>
> *Answer: `useStore((s) => s.orders.length)` — primitive number. Product updates → selector returns same 5 → Object.is says equal → skip re-render. Count update only re-renders when length actually changes.*

### Profiling Subscription Cost — React DevTools

React DevTools Profiler records component renders, duration, and cause.

Steps to profile over-subscription:
1. Open React DevTools → Profiler tab
2. Click record
3. Trigger store update (e.g., increment count, add item)
4. Stop recording
5. Examine flamegraph — which components re-rendered

What to look for:
- Components that re-rendered but show no visual change (unnecessary re-renders)
- Flamegraph branches that should not appear for this update
- Render duration spikes in components that only read unrelated state

**why-did-you-render** logs:
```
Dashboard re-rendered because: props/state changed
  → store notification.list changed (not read by Dashboard)
  → selector returned new array reference
```

> **Think**: Profiler shows Header re-renders when search results update. Header reads only `s.user.name`. What's happening?
>
> *Answer: Header likely uses `useStore((s) => s)` or extracts `s.user` instead of `s.user.name`. Profiler confirms over-subscription. Fix: leaf selector + check for parent object extraction in Header component.*

### Common Anti-Patterns Causing Over-Subscription

| Anti-pattern | Code | Fallout |
|---|---|---|
| Full store subscription | `useStore()` | Re-renders on ANY state change |
| Parent object extraction | `useStore((s) => s.user)` | Re-renders on any user field change |
| Inline object in selector | `useStore((s) => ({...}))` | New reference each call |
| Inline array transform | `useStore((s) => s.items.map(...))` | New array each call |
| Missing shallow | `useStore((s) => ({a,b}))` w/o shallow | Object reference always differs |
| Deep drill via destructure | `const {name} = useStore((s) => s.user)` | Extracts entire user |

Each anti-pattern has same mechanism: selector returns non-primitive without equality control → Object.is says changed → re-render.

> **Think**: Two components both call `useStore((s) => s.items.filter(i => i.active))`. One uses `shallow`, one does not. How many re-renders per unrelated update?
>
> *Answer: With shallow: 0 (shallow compares arrays — if active items unchanged, skip). Without shallow: always re-renders (new array reference every call). Same selector code, different equality strategy → drastically different performance.*

### Diagnostic Tools Summary

| Tool | Purpose | Setup |
|---|---|---|
| `useStore.subscribe(fn)` | Log raw state diffs | No deps needed |
| `devtools` middleware | Visual timeline, time-travel, action labels | Wrap store creation |
| Custom logger middleware | Action name, prev/next, timing | 10-line middleware |
| React DevTools Profiler | Component render flamegraph | Browser extension |
| `why-did-you-render` | Auto-detect unnecessary re-renders | npm install + init |
| Traceable middleware | Stack trace per set call | Custom middleware |

Best practice: develop with devtools + logger, profile with React DevTools, audit with why-did-you-render.

> **Think**: Production app — user reports slowness. Devtools/loggers disabled. How do you diagnose over-subscription in production?
>
> *Answer: (1) Conditional profiling flag — `window.__DEBUG_ZUSTAND = true` toggles logger middleware on demand. (2) React DevTools profiling works in production builds with `React.Profiler`. (3) Add performance.mark/measure around selectors. (4) Deploy a static snapshot with why-did-you-render to staging, reproduce the user flow.*

---

### Why This Matters

Over-subscription is Zustand's #1 performance pitfall. Store is fast; bad selectors make it slow. A single `useStore((s) => s)` in a shared component can degrade the entire app. Without debugging tools, over-subscription is invisible — app works correctly but wastes frames. Real-world: trading dashboard where 1 field update triggers 40 re-renders → jank on every price tick. Chat app where typing in one channel re-renders all channel lists. Mastering subscription debugging separates "Zustand is fast" from "my app is slow and I don't know why."

---

### Common Questions

**Q: Does over-subscription affect correctness or just performance?**
A: Just performance. App works correctly — components display correct data. But wasted re-renders consume CPU, delay paint, drain battery on mobile. Over-subscription is a performance bug, not a logic bug. This makes it easy to miss — tests pass, but app feels sluggish.

**Q: Can I use `React.memo` to fix over-subscription?**
A: Partial band-aid. React.memo prevents re-render if props unchanged. But if parent re-renders due to over-subscription and passes new prop references, memo still re-renders child. Fix the root cause (selector granularity) rather than patching with memo. React.memo is for legitimate prop changes, not over-subscription.

**Q: How does Zustand over-subscription compare to Redux?**
A: Identical mechanism. Both use selector + reference equality. Both suffer the same anti-patterns (parent object extraction, inline creation). Both offer shallow equality fix. Redux has `shallowEqual` as default in useSelector; Zustand uses `Object.is` as default. Redux ecosystem has more debugging tooling (Redux DevTools more mature). Conceptually same problem, same solutions.

**Q: What is the perf impact of 500 subscriptions vs 50?**
A: Negligible per notification diff. Zustand iterates all subscribers (500) and runs selectors. Simple field access selectors complete in < 0.5ms total. Bottleneck is React reconciliation, not subscription iteration. Fine-grained selectors (500 subscriptions) are faster than coarse selectors (50 subscriptions) because each component re-renders less often.

**Q: When would over-subscription NOT be a problem?**
A: Tiny stores (2-3 fields), low update frequency (once per minute), simple components (plain text render). For these cases, optimizing selectors is premature. Rule of thumb: start optimizing when you have > 10 fields OR > 10 subscribers OR update frequency > 1/sec.

---

## Examples

### Example 1: Chat App — Message Input Causes Channel List Re-Render

**Problem**: Chat app with channel list sidebar and message input. Typing in input re-renders channel list.

Store structure:
```typescript
interface ChatStore {
  channels: Array<{ id: string; name: string; unread: number }>
  messages: Record<string, Message[]>
  currentChannel: string | null
  draft: string  // current input value
  sendMessage: () => void
  setDraft: (text: string) => void
}
```

**Diagnosis**: Channel list component uses broad selector:

```typescript
// BAD — subscribes to entire store
function ChannelList() {
  const state = useStore()
  return state.channels.map((ch) => <ChannelItem key={ch.id} channel={ch} />)
}
```

Typing in input updates `draft` → store change → ChannelList re-renders because selector returns nothing → subscribed to everything.

**Fix**: Leaf selector for channels only:

```typescript
// GOOD — subscribes only to channels array
function ChannelList() {
  const channels = useStore((s) => s.channels, shallow)
  return channels.map((ch) => <ChannelItem key={ch.id} channel={ch} />)
}
```

**Result**: Draft updates → ChannelList skips (channels reference same array, shallow says equal). Only message input component re-renders.

**Verification**: React DevTools Profiler shows ChannelList not in flamegraph after typing. Subscribe log confirms no selector re-run for ChannelList.

### Example 2: E-Commerce Dashboard — Cascading Re-Renders

**Problem**: Admin dashboard shows revenue chart, order table, user list, and notification bell. Each update re-renders all 4 panels.

Store:
```typescript
interface DashboardStore {
  revenue: { current: number; previous: number; trend: number[] }
  orders: Order[]
  users: User[]
  notifications: Notification[]
  filters: { dateRange: string; region: string }
}
```

**Initial code** — each panel extracts parent object:

```typescript
function RevenueChart() {
  const revenue = useStore((s) => s.revenue)  // subscribes to all revenue fields
  return <Chart data={revenue.trend} />
}

function OrderTable() {
  const orders = useStore((s) => s.orders)  // subscribes to entire orders array
  return <Table data={orders} />
}

function UserList() {
  const users = useStore((s) => s.users)  // subscribes to entire users array
  return <List data={users} />
}

function NotificationBell() {
  const notifications = useStore((s) => s.notifications)  // subscribes to entire notifications array
  return <Badge count={notifications.filter(n => !n.read).length} />
}
```

New order arrives → `s.orders` changes → OrderTable re-renders (expected). But RevenueChart, UserList, NotificationBell re-render too — their selectors returned new object/array references.

**Fix**: Granular leaf selectors per component:

```typescript
function RevenueChart() {
  const trend = useStore((s) => s.revenue.trend)  // subscribes only to trend
  return <Chart data={trend} />
}

function OrderTable() {
  const orders = useStore((s) => s.orders, shallow)  // shallow compares array ref
  return <Table data={orders} />
}

function UserList() {
  const count = useStore((s) => s.users.length)  // primitive — no ref issue
  return <List data={useStore((s) => s.users)} />  // or separate selector
}

function NotificationBell() {
  const unreadCount = useStore(
    (s) => s.notifications.filter(n => !n.read).length,
    shallow
  )
  return <Badge count={unreadCount} />
}
```

**Result**: New order → only OrderTable re-renders (1 component). New user → UserList re-renders. New notification → NotificationBell re-renders. Revenue trend update → RevenueChart re-renders. Zero cascade.

**Verification**: DevTools Profiler confirms single-component re-render per update type. `why-did-you-render` shows zero unnecessary renders.

### Example 3: Tracing Mysterious Re-Renders with Custom Logger

**Problem**: Settings page feels sluggish. Unknown which action triggers re-renders in SettingsForm component.

**Diagnosis middleware** — wraps store to log origin:

```typescript
const traceOverSubscriptions = (config) => (set, get, api) =>
  config(
    (...args) => {
      const prev = get()
      const prevEntries = Object.entries(prev)
      set(...args)
      const next = get()
      const changedKeys = prevEntries
        .filter(([k, v]) => next[k] !== v)
        .map(([k]) => k)

      if (changedKeys.length > 0) {
        console.log(`[SettingsStore] Fields changed: ${changedKeys.join(', ')}`)
        console.log(`  Action: ${args[2] || 'anonymous'}`)
        console.trace('  Stack trace:')
      }
    },
    get,
    api
  )
```

Run app, change unrelated setting (theme), observe log:

```
[SettingsStore] Fields changed: theme
  Action: setTheme
  Stack trace: at ThemeToggle.tsx:12
```

SettingsForm re-renders. Check its selector — uses `useStore()` with no selector. Fix: add leaf selector `useStore((s) => s.settings)` + shallow.

**Result**: 15ms frame drops eliminated. SettingsForm only re-renders on settings field changes.

---

## Key Takeaways
- Over-subscription: component re-renders on unrelated state changes. Root cause = coarse selector returns non-primitive
- Leaf selectors (`s.user.name`) prevent over-subscription. Parent extraction (`s.user`) causes unnecessary re-renders
- Reference instability: new objects/arrays every selector call → Object.is always says different
- Shallow equality (`shallow` or `useShallow`) fixes object/array selectors: compares by value not reference
- Debugging tools: `subscribe` for raw diffs, `devtools` for visual timeline, custom logger for action tracing
- React DevTools Profiler + why-did-you-render identify which components re-render unnecessarily
- Cascade: one state update → multiple parent-object subscribers re-render → child tree propagates
- Common anti-patterns: full store sub, parent extraction, inline creation, missing shallow, deep destructure
- Large stores amplify over-subscription. Leaf selectors critical at 50+ fields
- 500 fine selectors outperform 50 coarse selectors — subscription iteration cheap, reconciliation expensive

## Common Misconception

**"Zustand is always fast — it only re-renders what changed."**

Zustand only re-renders what the selector says changed. If selector returns `s.user`, any user field change triggers re-render — even if component reads only `user.name`. Zustand is only as granular as the selector you write. Default selector (`useStore()` without selector) subscribes to everything. `Object.is` comparison treats every new object/array as "changed." Zustand's speed depends entirely on selector quality. Wrong selector → Context-level re-render behavior. Right selector → surgical per-field re-renders. Zustand gives you the tools for speed; you must use them.

---

## Feynman Explain
(Explain over-subscription to a junior dev who knows useState but not Zustand. Analogy: mailbox with slots. Coarse selector = keep door open — any mail triggers alert. Leaf selector = assign each letter type to own slot — only bills trigger "bill arrived." Shallow comparison = peek at envelope before alerting — same bill amount, no alert. Debugging = security camera showing who dropped what in which slot. Walk through: chat app where typing triggers sidebar re-render, then fix with leaf selectors.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain zustand-state-management` — AI probes gaps.*

---

## Reframe
(Pause. Critique: Is over-subscription really Zustand's #1 weakness? Compare to Jotai — Jotai atoms are naturally granular, no selector design. Does Zustand's selector model impose cognitive overhead that Jotai avoids? Consider team onboarding time, debugging complexity, and the "selector discipline" required. Also: React 19 Compiler may mitigate some over-subscription by auto-memoizing. Would the Compiler make over-subscription irrelevant? Write your evaluation — when is selector discipline worth it, and when would you switch to Jotai or another atomic store?)

---

## Drill
Take the quiz. MCQs test over-subscription causes, selector patterns, equality strategies, and debugging toolchain.

Run: `learn.sh quiz zustand-state-management 13-oversubscription`

## Quiz: 13-oversubscription


### What is over-subscription in Zustand?

- [✓] A: A component subscribes to more store fields than it needs, causing unnecessary re-renders

- [ ] B: Multiple components share the same selector function

- [ ] C: The store has more subscribers than React can handle

- [ ] D: A selector returns undefined and crashes the component


**Answer:** A

Over-subscription = component selects more state than it reads. Coarse selectors like `useStore((s) =&gt; s.user)` re-render on any user field change even when only user.name is displayed.


### Which selector causes the most over-subscription?

- [ ] A: useStore((s) =&gt; s.user.name)

- [✓] B: useStore()

- [ ] C: useStore((s) =&gt; s.items.length)

- [ ] D: useStore((s) =&gt; s.settings, shallow)


**Answer:** B

`useStore()` with no selector subscribes to entire store — any field change re-renders the component. Leaf selectors (A, C) or selectors with shallow (D) are more granular.


### Why does `useStore((s) =&gt; ({ name: s.user.name, email: s.user.email }))` re-render on every state change?

- [ ] A: Zustand does not support object returns from selectors

- [✓] B: The selector creates a new object reference each call — Object.is returns false

- [ ] C: The function syntax is invalid in TypeScript strict mode

- [ ] D: useStore only accepts arrow functions that return primitives


**Answer:** B

Selectors returning objects/arrays create new references every call. Object.is compares by reference, always returns false → re-render. Fix: add shallow equality or extract scalar values individually.


### A notification bell reads unread count via `useStore((s) =&gt; s.notifications.filter(n =&gt; !n.read).length)`. Profile shows it re-renders when unrelated user name updates. What's wrong?

- [ ] A: The filter method mutates the notifications array

- [✓] B: The selector returns a non-primitive causing reference instability

- [ ] C: The length property is not reactive in Zustand

- [ ] D: Nothing — this is expected Zustand behavior


**Answer:** B

`.filter()` returns new array each call. length is primitive, but intermediate array creation happens before .length access. The selector runs on every state change → new array → reference changed → Object.is false → re-render. Fix: extract notifications with shallow, compute length in component with useMemo, or use a memoized selector.


### How does `useShallow` differ from passing `shallow` as second argument to `useStore`?

- [ ] A: useShallow is deprecated — always use shallow as second argument

- [✓] B: useShallow wraps the selector with useMemo to stabilize its reference between renders

- [ ] C: useShallow performs deep equality instead of shallow

- [ ] D: They are identical — useShallow is just syntactic sugar


**Answer:** B

useShallow uses useMemo internally to stabilize the selector function reference. Inline arrow functions create new reference each render → extra store subscription calls. useShallow prevents this. Both apply shallow comparison to the selector result.


### A dashboard has RevenueChart, UserTable, and NotificationBell. Revenue trend updates trigger re-renders in all three. Which debugging tool tells you which action caused NotificationBell to re-render?

- [ ] A: console.log(useStore.getState())

- [✓] B: devtools middleware showing action timeline in Redux DevTools

- [ ] C: React.StrictMode

- [ ] D: useStore.subscribe with no arguments


**Answer:** B

Devtools middleware labels each set with action name (third argument). Redux DevTools shows action timeline — you see 'setRevenueTrend' triggered, then see that NotificationBell re-rendered because its selector returned new array (bad selector). Subscribe logging shows state diffs but not action names without manual labeling.


### Component reads `useStore((s) =&gt; s.orders)`. Orders array updates when new order arrives (expected). But it also re-renders when product catalog updates. Why?

- [ ] A: Zustand always re-renders all subscribers on any change

- [✓] B: The selectors return a new array reference each time — re-renders on every state mutation

- [ ] C: Product catalog is nested inside orders in the store shape

- [ ] D: React.memo is not wrapping the component


**Answer:** B

Extracting `s.orders` returns new array reference each selector call. Even when orders array unchanged, the product catalog update triggers a new selector run → new array reference → Object.is false → re-render. Fix: use shallow equality or extract specific order properties.


### Which approach best prevents over-subscription in a store with 50+ fields and 20+ components?

- [ ] A: Wrap every component with React.memo

- [✓] B: Use leaf selectors per component — each component subscribes to exactly the primitive values it displays

- [ ] C: Use a single global selector in a custom hook that returns the full store

- [ ] D: Disable re-renders with useRef and manually update the DOM


**Answer:** B

Leaf selectors (`s.user.name` instead of `s.user`) ensure each component re-renders only when its specific data changes. React.memo (A) is a band-aid that does not fix root cause. Full store (C) makes over-subscription worse. Manual DOM (D) defeats React's purpose.


### You add `why-did-you-render` to a project and see 'Header re-rendered because store.cart.total changed'. Header only reads `s.user.name`. Which selector anti-pattern does Header use?

- [ ] A: useStore((s) =&gt; s.user.name) — still subscribes to cart via closure

- [✓] B: useStore((s) =&gt; s) — subscribes to entire store

- [ ] C: useStore((s) =&gt; s.user) — subscribes to user object but cart total is nested inside user

- [ ] D: useStore((s) =&gt; s, shallow) — shallow comparison fails on deeply nested objects


**Answer:** B

`useStore()` or `useStore((s) =&gt; s)` subscribes to everything. Any store field change (including cart.total) re-renders Header. Fix: `useStore((s) =&gt; s.user.name)` — leaf selector for only the field Header needs.


### A team disables devtools middleware in production. A user reports slowness. Which approach allows on-demand debugging without redeploying?

- [ ] A: Add a global flag `window.__DEBUG_ZUSTAND` that toggles logger middleware dynamically

- [ ] B: Devtools cannot be enabled after the store is created

- [ ] C: Use React DevTools Profiler — it works on production builds without Zustand-specific setup

- [✓] D: Both A and C are valid approaches


**Answer:** D

A conditional flag toggling logger middleware enables on-demand tracing without redeploy. React DevTools Profiler works in production builds — record a session, examine flamegraph for unnecessary re-renders. Both approaches diagnose over-subscription without shipping devtools WebSocket connection to all users.


---

# Module 14: Solve Weakness 1 — Atomic Stores, Selector Stability

Est. study time: 2h
Language: en

## Learning Objectives
- Decompose a monolithic Zustand store into atomic stores by domain concern
- Stabilize selectors with `createSelectors` utility to prevent reference instability
- Apply `useShallow` and custom equality functions for object selectors
- Combine atomic stores with slices for maintainable multi-store architecture
- Measure performance before and after atomic store migration

---

## Core Content

### The Problem: One Store Contains Everything

Monolithic store starts clean, degrades over time:

```typescript
interface AppStore {
  // Auth
  user: User | null
  token: string | null
  login: (email: string, pw: string) => Promise<void>
  logout: () => void
  // Products
  products: Product[]
  loading: boolean
  fetchProducts: () => Promise<void>
  // Cart
  cart: CartItem[]
  addToCart: (item: CartItem) => void
  // UI
  theme: 'light' | 'dark'
  sidebar: boolean
  // Notifications
  notifications: Notification[]
  markRead: (id: string) => void
  // Analytics
  events: AnalyticsEvent[]
  track: (event: AnalyticsEvent) => void
}
```

Every subscriber pays cost of full store size. Selectors must be precise or component re-renders on unrelated domain changes. As store grows, selector discipline erodes — devs take shortcuts like `useStore((s) => s)` or `(s) => s.user`.

Two weakness categories this module solves:

| Weakness | Effect | Fix |
|----------|--------|-----|
| **Coarse granularity** | Component reading auth re-renders on cart update | Atomic stores per domain |
| **Selector instability** | Inline objects/arrays create new refs every render | `createSelectors`, `useShallow`, equality fns |

> **Think**: Your store has 8 domains, 60 properties, 40 subscribers. How many selector re-evaluations happen on a single `theme` toggle?
>
> *Answer: All 40. Each subscriber's selector runs, even if selector only reads an unrelated field like `user.name`. Zustand cannot skip selector evaluation — it must compute to know whether value changed. Atomic stores reduce this: only subscribers to `uiStore` re-evaluate on theme change.*

### Atomic Store Pattern — One Store Per Domain Concern

Atomic store: each store holds state for exactly one domain concern. Store is small (3-10 properties), focused, independently testable.

```typescript
// stores/authStore.ts
import { create } from 'zustand'

interface AuthState {
  user: User | null
  token: string | null
  login: (email: string, pw: string) => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  login: async (email, pw) => {
    const res = await api.login(email, pw)
    set({ user: res.user, token: res.token })
  },
  logout: () => set({ user: null, token: null }),
}))
```

```typescript
// stores/cartStore.ts
import { create } from 'zustand'

interface CartState {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (id: string) => void
  clearCart: () => void
}

export const useCartStore = create<CartState>((set) => ({
  items: [],
  addItem: (item) => set((s) => ({ items: [...s.items, item] })),
  removeItem: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
  clearCart: () => set({ items: [] }),
}))
```

Each store is < 50 lines. No cross-domain coupling. Testing uses only the relevant store.

**Benefits:**

| Concern | Monolithic | Atomic |
|---------|-----------|--------|
| Subscriber count per update | All 40 | ~5 (only domain subscribers) |
| Selector complexity | Must avoid parent extraction | Trivial — store is small |
| Merge conflicts | Any domain change touches same file | Own file per domain |
| Code splitting | Must import entire store | Import per domain |
| Cognitive load | Know entire store to modify | Know one domain |

> **Think**: Auth store has 3 properties + 2 actions. Cart store has 2 properties + 3 actions. How many subscribers does each store have?
>
> *Answer: Auth store has subscribers from components that read auth. Cart store has subscribers from components that read cart. Zero overlap. Auth update never re-evaluates cart selectors. Atomic isolation makes subscription count proportional to domain popularity, not total app size.*

### Breaking a Large Store into Atomic Stores

Step-by-step decomposition:

**Step 1: Domain audit**. List every state property, group by domain:

```typescript
// Monolithic store — 20 properties
const monolithic = {
  // Auth (4)
  user, token, login, logout,
  // Products (5)
  products, loading, error, fetchProducts, setCategory,
  // Cart (4)
  cartItems, addToCart, removeFromCart, clearCart,
  // UI (4)
  theme, sidebar, modalOpen, toggleSidebar,
  // Notifications (3)
  notifications, markRead, clearNotifications,
}
```

5 domains → 5 atomic stores. Each store interface is subset of original.

**Step 2: Create store files**. One file per domain under `stores/`:

```
stores/
├── authStore.ts
├── productsStore.ts
├── cartStore.ts
├── uiStore.ts
└── notificationsStore.ts
```

**Step 3: Migrate component imports one at a time**:

```typescript
// Before
import { useStore } from './store'
const user = useStore((s) => s.user)
const cartItems = useStore((s) => s.cartItems)

// After
import { useAuthStore } from './stores/authStore'
import { useCartStore } from './stores/cartStore'
const user = useAuthStore((s) => s.user)
const cartItems = useCartStore((s) => s.items)
```

**Step 4: Handle cross-store communication**. When auth logout must clear cart, use subscribers or a coordination layer:

```typescript
// stores/authStore.ts
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  login: async (email, pw) => {
    const res = await api.login(email, pw)
    set({ user: res.user, token: res.token })
  },
  logout: () => {
    set({ user: null, token: null })
    // Notify cart to clear (subscriber handles this)
  },
}))
```

```typescript
// stores/subscribers.ts
import { useAuthStore } from './authStore'
import { useCartStore } from './cartStore'

// Clear cart on logout
useAuthStore.subscribe((state, prevState) => {
  if (state.user === null && prevState.user !== null) {
    useCartStore.getState().clearCart()
  }
})
```

> **Think**: Why subscriber pattern instead of importing `useCartStore` directly into `useAuthStore`?
>
> *Answer: Avoids circular imports and direct coupling. Auth store should not import cart store — that ties two domains at creation time. Subscriber decouples: auth store emits "user changed" signal; subscriber reacts. Cart can be removed, renamed, or replaced without touching auth. Domain independence is whole point of atomic stores.*

### Selector Stability — The Reference Problem

Selectors returning new references cause unnecessary re-renders even with atomic stores:

```typescript
// UNSTABLE — creates new object every time store changes
const { name, email } = useAuthStore((s) => ({
  name: s.user?.name,
  email: s.user?.email,
}))

// UNSTABLE — creates new array every time
const productNames = useProductsStore((s) =>
  s.products.map((p) => p.name)
)
```

Each state change re-runs selector. If selector returns new reference, `Object.is` says "changed" → re-render. Even if values unchanged.

**Atomic stores reduce the problem but do not eliminate it.** A 5-property atomic store can still have unstable selectors.

> **Think**: `useAuthStore((s) => ({ name: s.user?.name }))` — auth store has 3 properties. Any of the 3 change → re-render even though only name matters?
>
> *Answer: Yes. Although store is small, selector still creates new object every call. `Object.is` sees two different `{ name: "Alice" }` objects. Fix: extract scalar or use shallow equality. Atomic store makes the problem smaller but selector hygiene still required.*

### createSelectors Utility — Auto-Generating Stable Selectors

`createSelectors` wraps a store and generates type-safe, stable selector functions for every property:

```typescript
import { create } from 'zustand'

// Utility
type StoreApi<T> = {
  use: { [K in keyof T]: () => T[K] }
  get: { [K in keyof T]: () => T[K] }
}

export function createSelectors<TStore extends object>(
  store: any
): StoreApi<TStore> {
  const selectors: Record<string, () => any> = {}

  // Generate selectors from store's state keys
  const stateKeys = Object.keys(store.getState())
  for (const key of stateKeys) {
    selectors[key] = () => store((s: any) => s[key])
  }

  return {
    use: selectors as StoreApi<TStore>['use'],
    get: new Proxy({} as any, {
      get: (_, key: string) => () => store.getState()[key],
    }),
  }
}
```

Usage:

```typescript
// stores/authStore.ts
import { create } from 'zustand'

interface AuthState {
  user: User | null
  token: string | null
  login: (email: string, pw: string) => Promise<void>
  logout: () => void
}

const useAuthStoreBase = create<AuthState>((set) => ({
  user: null,
  token: null,
  login: async (email, pw) => { /* ... */ },
  logout: () => set({ user: null, token: null }),
}))

export const useAuthStore = createSelectors<AuthState>(useAuthStoreBase)

// Component — stable selectors auto-generated
function UserName() {
  const user = useAuthStore.use.user()  // type-safe, stable selector
  return <span>{user?.name}</span>
}

function TokenDisplay() {
  const token = useAuthStore.use.token()  // subscribes only to token
  return <code>{token}</code>
}
```

Each generated selector extracts a single property by key. Returns primitive or direct reference — no object creation, no array allocation. `Object.is` works correctly.

**What `createSelectors` solves:**

| Problem | Without | With |
|---------|---------|------|
| Typing selector inline | `(s) => s.user` — easy to get wrong | `useAuthStore.use.user()` — auto-complete |
| Object creation | `(s) => ({ name: s.name })` creates new ref | Single property extraction |
| Array creation | `(s) => s.items` returns same array ref | Same array ref |
| Selector memoization | Manual `useMemo` or external memo | Not needed — returns identity |

> **Think**: `useAuthStore.use.user()` returns `User | null`. If user object reference changes but contents same, does component re-render?
>
> *Answer: Yes — the user object reference changed. createSelectors guarantees stable selector fn but cannot control whether upstream creates new object references. If `login` returns a new user object, component re-renders because User object is new. Fix: shallow compare at component level or normalize user objects by ID.*

### useShallow for Object Selectors

When component needs multiple fields from same store, `useShallow` prevents object-creation instability:

```typescript
import { useShallow } from 'zustand/react'

function UserProfile() {
  const { name, email, avatar } = useAuthStore(
    useShallow((s) => ({
      name: s.user?.name,
      email: s.user?.email,
      avatar: s.user?.avatar,
    }))
  )
  // Re-renders only when name, email, or avatar change
  // Not when token changes (same auth store)
}
```

`useShallow` wraps the selector with `useMemo` (stabilizes selector reference) and applies shallow comparison on the returned object.

Before `useShallow`:

```
Store updates token → selector re-runs → new {name, email, avatar} → Object.is fails → re-render
```

After `useShallow`:

```
Store updates token → selector re-runs → new {name, email, avatar} → shallow compares key/values → same values → skip re-render
```

**When to use `useShallow`:**

| Scenario | Recommendation |
|---------|---------------|
| 2-3 fields from same store, updated infrequently | `useShallow` — concise, one hook call |
| 1 field from a store | Scalar selector — no wrapper needed |
| 5+ fields from same store | Extract each as scalar — more subscriptions but zero object allocation |
| Derived state combining fields | Memoized selector or `useMemo` after scalar selectors |

> **Think**: Component calls `useAuthStore(useShallow((s) => ({ name: s.user?.name, email: s.user?.email })))`. Auth store updates `token`. Does component re-render?
>
> *Answer: No. Selector runs, returns `{ name: "Alice", email: "alice@x.com" }`. useShallow compares with previous object: name and email unchanged (Object.is on strings). Shallow says equal → skip re-render. Token update only affects components subscribed to token.*

### Equality Functions — Custom Comparison Logic

Zustand's second argument to `useStore` is equality function:

```typescript
type EqualityFn = (a: SelectedValue, b: SelectedValue) => boolean
// Return true = values equal → no re-render
// Return false = values differ → re-render
```

Built-in options:

```typescript
import { shallow } from 'zustand/shallow'

// Object.is (default): reference equality
useStore((s) => s.user)

// Shallow: top-level key/value comparison
useStore((s) => ({ name: s.name }), shallow)
```

Custom equality functions for specific needs:

```typescript
// Deep equality — for nested data
import { isEqual } from 'lodash-es'

function deepEquality<T>(a: T, b: T): boolean {
  return isEqual(a, b)
}

function SettingsPanel() {
  const settings = useSettingsStore(
    (s) => s.config,
    deepEquality  // deep compare config object
  )
  // Re-renders only when nested config actually changes
}
```

```typescript
// Custom — compare specific fields
function lazyCompare(a: User, b: User) {
  if (!a || !b) return a === b
  return a.id === b.id  // same user ID = same enough
}

function UserAvatar() {
  const user = useAuthStore((s) => s.user, lazyCompare)
  // Re-renders only when user ID changes, not when email/name updates
  return <img src={user?.avatar} />
}
```

```typescript
// Array length comparison — re-render only when count changes
function CartBadge() {
  const count = useCartStore(
    (s) => s.items.length,
    Object.is  // default — primitive, no custom needed
  )
  return <Badge count={count} />
}
```

**Performance characteristics:**

| Equality fn | Cost | Use case |
|-------------|------|----------|
| `Object.is` | 1 comparison | Primitives, reference-stable objects |
| `shallow` | O(n) on keys | Object/array selectors, 2-10 keys |
| Deep equality | O(n) on depth | Deeply nested config, infrequent updates |
| Custom key compare | O(1)-O(k) | Specific field matters, rest ignored |

> **Think**: Deep equality on every store update — when is this harmful?
>
> *Answer: Large nested objects (1000+ keys, 5+ levels) compared on every mutation. Store updates 60fps (animation) → deep equality runs 60 times/sec on potentially heavy data. Fix: use custom shallow equality that compares only the keys component needs, not the entire structure.*

### Atomic Stores + Slices — Combined Pattern

Atomic stores give domain isolation. Slices give cross-domain coordination within a single store. Combine them when domains need to share state or actions frequently.

**Pattern: Single store with slices per domain, but selectors enforce atomic-like granularity.**

```typescript
// store/types.ts
export interface AuthSlice {
  user: User | null
  token: string | null
  login: (email: string, pw: string) => Promise<void>
  logout: () => void
}

export interface CartSlice {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (id: string) => void
  clearCart: () => void
}

export type AppStore = AuthSlice & CartSlice
```

```typescript
// store/slices/auth.ts
import { StateCreator } from 'zustand'
import type { AppStore } from '../types'

export const createAuthSlice: StateCreator<AppStore, [], [], AuthSlice> = (set) => ({
  user: null,
  token: null,
  login: async (email, pw) => {
    const res = await api.login(email, pw)
    set({ user: res.user, token: res.token })
  },
  logout: () => {
    set({ user: null, token: null })
    // Cross-slice via subscriber
  },
})
```

**When to use atomic stores vs slices:**

| Factor | Atomic Stores | Slices Pattern |
|--------|-------------|----------------|
| Cross-domain state sharing | Subscriber/event bus | Direct `get().otherSliceAction()` |
| Bundle splitting | Dynamic import per store | Harder — single combined store |
| Individual store testing | Import single store | Need combined store or mock other slices |
| Merge conflicts | None across stores | Possible if slices share file |
| Subscriber isolation | Perfect — own store per domain | Selectors must be precise |
| Cross-store coordination complexity | Low per store, medium overall | Centralized in orchestrator |

**Hybrid approach:** Atomic stores for loosely related domains (auth, notifications, analytics). Slices for tightly coupled domains (cart + checkout + orders).

> **Think**: Notifications and auth are unrelated domains. Cart and checkout share order state. Which pattern for each?
>
> *Answer: Notifications + auth → atomic stores (no shared state, no cross-calls). Cart + checkout → slices in single store (shared order state, sequential actions). Hybrid: useAuthStore, useNotificationsStore, and useOrderStore (slices for cart+checkout+orders in one file).*

### Store Factory Pattern — Creating Similar Atomic Stores

When multiple domains share identical structure (CRUD entities, toggle sets, paginated lists), write a factory:

```typescript
// stores/createEntityStore.ts
import { create } from 'zustand'

interface EntityState<T extends { id: string }> {
  items: T[]
  loading: boolean
  error: string | null
  fetchItems: () => Promise<void>
  addItem: (item: T) => void
  updateItem: (id: string, data: Partial<T>) => void
  removeItem: (id: string) => void
}

export function createEntityStore<T extends { id: string }>(
  name: string,
  apiBase: string
) {
  return create<EntityState<T>>((set, get) => ({
    items: [],
    loading: false,
    error: null,
    fetchItems: async () => {
      set({ loading: true, error: null })
      try {
        const res = await fetch(apiBase)
        const data = await res.json()
        set({ items: data, loading: false })
      } catch (e) {
        set({ error: (e as Error).message, loading: false })
      }
    },
    addItem: (item) => set((s) => ({ items: [...s.items, item] })),
    updateItem: (id, data) =>
      set((s) => ({
        items: s.items.map((i) => (i.id === id ? { ...i, ...data } : i)),
      })),
    removeItem: (id) =>
      set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
  }))
}
```

Usage:

```typescript
// stores/productsStore.ts
interface Product extends EntityState<ProductItem> {
  // products-specific additions
  category: string | null
  setCategory: (cat: string | null) => void
}

export const useProductsStore = create<Product>((set) => ({
  ...createEntityStore<ProductItem>('products', '/api/products').getState(),
  // Re-attach actions since getState returns plain state
  ...Object.fromEntries(
    Object.entries(createEntityStore<ProductItem>('products', '/api/products'))
      .filter(([k]) => ['fetchItems', 'addItem', 'updateItem', 'removeItem'].includes(k))
  ),
  category: null,
  setCategory: (cat) => set({ category: cat }),
}))
```

**Better approach — factory returns store hook directly:**

```typescript
// stores/factories.ts
export function createCrudStore<T extends { id: string }>(name: string, apiBase: string) {
  const useStore = create<EntityState<T>>((set, get) => ({
    items: [],
    loading: false,
    error: null,
    fetchItems: async () => { /* ... */ },
    addItem: (item) => set((s) => ({ items: [...s.items, item] })),
    updateItem: (id, data) => set((s) => ({
      items: s.items.map(i => i.id === id ? { ...i, ...data } : i),
    })),
    removeItem: (id) => set((s) => ({
      items: s.items.filter(i => i.id !== id),
    })),
  }))

  const selectors = createSelectors<EntityState<T>>(useStore)
  return { useStore, selectors }
}

// Usage
export const { useStore: useProductsStore, selectors: productsSelectors } =
  createCrudStore<ProductItem>('products', '/api/products')

export const { useStore: useCategoriesStore, selectors: categoriesSelectors } =
  createCrudStore<CategoryItem>('categories', '/api/categories')
```

> **Think**: Three entity stores (products, categories, tags) all use the same factory. Add a new action `bulkDelete` to only products store. How?
>
> *Answer: Factory returns base store. Extend with `useProductsStore.setState` to inject new actions after creation. Or wrap factory output in a custom hook that composes base actions + domain-specific actions. Best: factory accepts `extensions` callback: `createCrudStore<Product>('products', '/api/products', (set, get) => ({ bulkDelete: (ids) => ... }))`.*

### Performance Measurement — Before and After Migration

Quantify atomic store migration impact:

```typescript
// measurement.ts
import { useAuthStore } from './stores/authStore'
import { useCartStore } from './stores/cartStore'
import { useProductsStore } from './stores/productsStore'
import { useUIStore } from './stores/uiStore'

// Count subscribers per store
let totalSubs = 0
;[useAuthStore, useCartStore, useProductsStore, useUIStore].forEach((store, i) => {
  const subCount = (store as any).listeners?.size ?? 0
  totalSubs += subCount
  console.log(`Store ${i}: ${subCount} subscribers`)
})
console.log(`Total: ${totalSubs}`)
```

**Key metrics:**

| Metric | Monolithic | Atomic | Improvement |
|--------|-----------|--------|-------------|
| Subscribers per update | 40 | ~8 | 5x fewer |
| Avg re-render per action | 12 | 2 | 6x reduction |
| Avg selector eval time | 0.4ms | 0.05ms | 8x faster |
| Bundle size (gzipped) | 4.2kB | 1.1kB per store | Lazy loadable |
| New dev setup time | 20min to understand store | 3min per store | ~7x faster |

**React DevTools Profiler approach:**

1. Record interaction in monolithic version (e.g., add item to cart)
2. Count re-rendered components in flamegraph
3. Migrate to atomic stores
4. Repeat same interaction
5. Compare flamegraph — fewer branches, shorter bars

> **Think**: Flamegraph shows 8 components re-render on "add to cart" in monolithic version. After atomic migration, same action shows 2 components. Which 2 should re-render?
>
> *Answer: Cart badge (count changes) + Cart drawer (items array changes). Auth, products, UI, notifications components should not appear in flamegraph at all. If they do, atomic store migration missed a subscription — component still subscribes to wrong store or selector is unstable.*

### Real Example: Refactoring Monolithic Store into 5 Atomic Stores

**E-commerce dashboard — monolithic store with 25 properties across 5 domains.**

```typescript
// Before: monolithic store (200 lines)
interface MonolithicStore {
  // Auth
  user: User | null
  token: string | null
  login: (e: string, p: string) => Promise<void>
  logout: () => void
  // Products
  products: Product[]
  productLoading: boolean
  productError: string | null
  fetchProducts: () => Promise<void>
  selectedCategory: string | null
  // Cart
  items: CartItem[]
  coupon: string | null
  addItem: (i: CartItem) => void
  removeItem: (id: string) => void
  applyCoupon: (code: string) => void
  clearCart: () => void
  // UI
  theme: 'light' | 'dark'
  sidebarOpen: boolean
  cartOpen: boolean
  toggleSidebar: () => void
  toggleCart: () => void
  setTheme: (t: 'light' | 'dark') => void
  // Orders
  orders: Order[]
  orderLoading: boolean
  fetchOrders: () => Promise<void>
  selectedOrderId: string | null
}
```

**After: 5 atomic stores with createSelectors.**

```typescript
// stores/authStore.ts — 30 lines
interface AuthState {
  user: User | null
  token: string | null
  login: (e: string, p: string) => Promise<void>
  logout: () => void
}

const useAuthStoreBase = create<AuthState>((set) => ({
  user: null,
  token: null,
  login: async (email, pw) => {
    const { user, token } = await api.login(email, pw)
    set({ user, token })
  },
  logout: () => set({ user: null, token: null }),
}))
export const useAuthStore = createSelectors<AuthState>(useAuthStoreBase)
```

```typescript
// stores/productsStore.ts — 40 lines
interface ProductsState {
  items: Product[]
  loading: boolean
  error: string | null
  selectedCategory: string | null
  fetchProducts: () => Promise<void>
  setCategory: (cat: string | null) => void
}

const useProductsStoreBase = create<ProductsState>((set) => ({
  items: [],
  loading: false,
  error: null,
  selectedCategory: null,
  fetchProducts: async () => {
    set({ loading: true, error: null })
    try {
      const items = await api.getProducts()
      set({ items, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },
  setCategory: (cat) => set({ selectedCategory: cat }),
}))
export const useProductsStore = createSelectors<ProductsState>(useProductsStoreBase)
```

```typescript
// stores/cartStore.ts — 35 lines
interface CartState {
  items: CartItem[]
  coupon: string | null
  addItem: (i: CartItem) => void
  removeItem: (id: string) => void
  applyCoupon: (code: string) => void
  clearCart: () => void
}

const useCartStoreBase = create<CartState>((set) => ({
  items: [],
  coupon: null,
  addItem: (item) => set((s) => ({ items: [...s.items, item] })),
  removeItem: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
  applyCoupon: (code) => set({ coupon: code }),
  clearCart: () => set({ items: [], coupon: null }),
}))
export const useCartStore = createSelectors<CartState>(useCartStoreBase)
```

```typescript
// stores/uiStore.ts — 25 lines
interface UIState {
  theme: 'light' | 'dark'
  sidebarOpen: boolean
  cartOpen: boolean
  toggleSidebar: () => void
  toggleCart: () => void
  setTheme: (t: 'light' | 'dark') => void
}

const useUIStoreBase = create<UIState>((set) => ({
  theme: 'light',
  sidebarOpen: true,
  cartOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleCart: () => set((s) => ({ cartOpen: !s.cartOpen })),
  setTheme: (t) => set({ theme: t }),
}))
export const useUIStore = createSelectors<UIState>(useUIStoreBase)
```

```typescript
// stores/ordersStore.ts — 40 lines
interface OrdersState {
  orders: Order[]
  loading: boolean
  selectedOrderId: string | null
  fetchOrders: () => Promise<void>
  selectOrder: (id: string | null) => void
}

const useOrdersStoreBase = create<OrdersState>((set) => ({
  orders: [],
  loading: false,
  selectedOrderId: null,
  fetchOrders: async () => {
    set({ loading: true })
    const orders = await api.getOrders()
    set({ orders, loading: false })
  },
  selectOrder: (id) => set({ selectedOrderId: id }),
}))
export const useOrdersStore = createSelectors<OrdersState>(useOrdersStoreBase)
```

```typescript
// stores/subscribers.ts — cross-store coordination
import { useAuthStore } from './authStore'
import { useCartStore } from './cartStore'
import { useProductsStore } from './productsStore'

// Clear cart + reset products on logout
useAuthStore.subscribe((state, prevState) => {
  if (state.user === null && prevState.user !== null) {
    useCartStore.getState().clearCart()
    useProductsStore.getState().setCategory(null)
  }
})
```

**Component usage — each component imports only its domain store:**

```typescript
function CartBadge() {
  const count = useCartStore.use.items()?.length ?? 0
  return <Badge count={count} />
}

function UserGreeting() {
  const user = useAuthStore.use.user()
  return <h1>Hello, {user?.name}</h1>
}

function Sidebar() {
  const open = useUIStore.use.sidebarOpen()
  return <aside className={open ? 'open' : 'closed'} />
}
```

**Migration result:**

| Metric | Before | After |
|--------|--------|-------|
| Store file size | 200 lines | 30-40 lines per store |
| Subscribers per update | 25-40 | 3-8 |
| Selector eval on unrelated update | Always runs | Never runs (different store) |
| Cross-domain re-renders | Frequent | Zero (subscribers handle coordination) |
| Bundle import cost | Full store | Per-domain |
| Time to understand a domain | Read entire store | Read 1 file |

> **Think**: Dev asks: "5 stores mean 5 imports per component. Before I imported once. Is this worth it?"
>
> *Answer: Yes. Each import is explicit about which domain this component depends on. One line per domain import. Benefit: component only re-renders on its domain's updates. Also: tree-shaking removes unused stores. A page that needs only auth + cart loads 2 stores, not 5. Monolithic store imports all 5 domains even if component uses one.*

---

### Why This Matters

Atomic store migration is the single highest-ROI performance optimization for Zustand apps. Slicing a monolithic store into atomic stores eliminates entire categories of unnecessary re-renders without changing a single component's logic — just which store it imports from.

The combination of atomic stores + stable selectors (`createSelectors`) + shallow equality (`useShallow`) creates a nearly zero-cost subscription model. Components re-render only when their exact data changes. No cascading evaluations, no spurious updates from unrelated domains.

Zustand's weakness #1 — over-subscription and selector instability — is not a framework flaw. It is a pattern choice. Atomic stores are the architectural fix. This module's techniques are the daily tools that make Zustand apps fast at any scale.

---

### Common Questions

**Q: How many atomic stores is too many?**
A: 3-7 atomic stores per app is typical. More than 10 suggests over-splitting. If stores have 1-2 properties, they are probably logical constants or refs, not state. Merge tiny stores back. Rule: if a store has fewer properties than lines of import boilerplate, reconsider.

**Q: How do atomic stores handle cross-cutting state like auth?**
A: Subscriber pattern. Auth store emits changes; other stores subscribe. No direct store-to-store imports. Alternatively, pass auth token as argument to API calls rather than reading from auth store in other stores. This keeps domain isolation.

**Q: Do atomic stores work with Zustand middleware (persist, immer, devtools)?**
A: Yes. Each store gets its own middleware chain. Persist user preferences in uiStore, not authStore. Immer in cartStore for mutable cart updates. Devtools per store — each store has its own devtools timeline, which is actually clearer than one store's timeline.

**Q: Atomic stores vs Jotai atoms — what is the difference?**
A: Jotai atoms are even more granular (one atom per value). Atomic Zustand stores are aggregations of related atoms. Jotai has built-in dependency tracking — reading atom A that depends on atom B triggers only A's subscribers when B changes. Zustand atomic stores require explicit subscriber wiring. Jotai uses more Proxy machinery; Zustand atomic stores are plain objects. Both solve the same problem with different tradeoffs.

**Q: Does createSelectors support nested selectors?**
A: Default implementation supports top-level keys only. For nested selectors, extend: `createSelectors(store, { path: (s) => s.deeply.nested.value })`. Or compose: `useAuthStore.use.user()` returns User object; component selects `.name` from it. Drawback: selecting the whole User object subscribes to any User field change.

**Q: Should I migrate all stores at once or incrementally?**
A: Incrementally. Extract the most independent domain first (UI or notifications — no cross-dependencies). Then extract domains one per PR. Keep a bridge: subscribers from old monolithic store to new atomic stores. Once all consumers migrate, delete monolithic store.

---

## Examples

### Example 1: Chat App — Monolithic to Atomic

**Problem**: Chat app re-renders entire channel list when typing a message. Monolithic store has 18 properties across 4 domains.

```typescript
// Before: monolithic store
interface ChatStore {
  // Auth
  user: User | null
  onlineStatus: 'online' | 'away' | 'offline'
  // Channels
  channels: Channel[]
  currentChannelId: string | null
  unreadCounts: Record<string, number>
  // Messages
  messages: Record<string, Message[]>
  draft: string
  sending: boolean
  // UI
  sidebarOpen: boolean
  pinnedChannels: string[]
  typingUsers: string[]
  notifications: boolean
}
```

**Atomic breakdown:**

| Store | State | Subscribers |
|-------|-------|-------------|
| `useAuthStore` | user, onlineStatus | 2 (UserAvatar, StatusIndicator) |
| `useChannelStore` | channels, currentChannelId, unreadCounts | 3 (ChannelList, ChannelHeader, UnreadBadge) |
| `useMessageStore` | messages, draft, sending | 4 (MessageList, MessageInput, SendButton) |
| `useUIStore` | sidebarOpen, pinnedChannels, typingUsers, notifications | 3 (Sidebar, PinList, TypingIndicator, NotificationToggle) |

**Component migration:**

```typescript
// Before
function MessageInput() {
  const draft = useStore((s) => s.draft)
  const send = useStore((s) => s.sendMessage)
  // Also re-evaluates on channels, user, sidebar, pinned changes
}

// After
function MessageInput() {
  const draft = useMessageStore((s) => s.draft)
  const send = useMessageStore((s) => s.sendMessage)
  // Re-evaluates only on message store changes
}
```

**Result**: Typing updates draft in message store. Only MessageInput re-renders. ChannelList, Sidebar, UserAvatar, UnreadBadge — zero re-renders. Before: 8+ components re-rendered per keystroke. After: 1 component.

### Example 2: Dashboard with createSelectors + useShallow

**Problem**: SaaS dashboard with 4 data panels (revenue, users, sessions, conversion). All 4 re-render on any metric update.

**Solution**: Atomic stores + stable selectors per metric.

```typescript
// stores/metricsStore.ts — atomic store for all metrics
interface MetricsState {
  revenue: number
  users: number
  sessions: number
  conversion: number
  loading: boolean
  lastUpdated: number | null
  fetchMetrics: () => Promise<void>
}

const useMetricsStoreBase = create<MetricsState>((set) => ({
  revenue: 0,
  users: 0,
  sessions: 0,
  conversion: 0,
  loading: false,
  lastUpdated: null,
  fetchMetrics: async () => {
    set({ loading: true })
    const data = await api.getMetrics()
    set({ ...data, loading: false, lastUpdated: Date.now() })
  },
}))

export const useMetricsStore = createSelectors<MetricsState>(useMetricsStoreBase)
```

**Four components, each subscribing to one metric:**

```typescript
function RevenueCard() {
  const revenue = useMetricsStore.use.revenue()
  return <MetricCard title="Revenue" value={formatCurrency(revenue)} />
}

function UsersCard() {
  const users = useMetricsStore.use.users()
  return <MetricCard title="Users" value={formatNumber(users)} />
}

function SessionsCard() {
  const sessions = useMetricsStore.use.sessions()
  return <MetricCard title="Sessions" value={formatNumber(sessions)} />
}

function ConversionCard() {
  const conversion = useMetricsStore.use.conversion()
  return <MetricCard title="Conversion" value={formatPercent(conversion)} />
}
```

**What happens when revenue updates?**

```
Before (monolithic, no createSelectors):
  All 4 panels re-render (each selector extracted a new object or entire store)
  Also: auth header re-renders, sidebar re-renders, notification bell re-renders
  Total: ~10 re-renders

After (atomic store + createSelectors):
  RevenueCard re-renders (revenue changed)
  UsersCard skips (users unchanged — Object.is says equal)
  SessionsCard skips
  ConversionCard skips
  Auth header skips (different store entirely)
  Sidebar skips (different store)
  Total: 1 re-render
```

### Example 3: Store Factory for Multi-Tenant Dashboard

**Problem**: Multi-tenant SaaS — each customer has own products, orders, and analytics. 5 stores with identical shape per customer.

**Solution**: Store factory parameterized by tenant ID.

```typescript
// stores/createTenantStores.ts
interface TenantData {
  products: Product[]
  orders: Order[]
  analytics: Analytics
}

const tenantStores = new Map<string, {
  useProducts: ReturnType<typeof createSelectors>
  useOrders: ReturnType<typeof createSelectors>
  useAnalytics: ReturnType<typeof createSelectors>
}>()

export function getTenantStores(tenantId: string) {
  if (tenantStores.has(tenantId)) return tenantStores.get(tenantId)!

  const useProductsBase = create<ProductState>((set) => ({
    items: [],
    loading: false,
    fetchProducts: async () => {
      const items = await api.getProducts(tenantId)
      set({ items })
    },
  }))

  const useOrdersBase = create<OrderState>((set) => ({
    items: [],
    loading: false,
    fetchOrders: async () => {
      const items = await api.getOrders(tenantId)
      set({ items })
    },
  }))

  const useAnalyticsBase = create<AnalyticsState>((set) => ({
    metrics: { revenue: 0, users: 0 },
    loading: false,
    fetchAnalytics: async () => {
      const metrics = await api.getAnalytics(tenantId)
      set({ metrics })
    },
  }))

  const stores = {
    useProducts: createSelectors<ProductState>(useProductsBase),
    useOrders: createSelectors<OrderState>(useOrdersBase),
    useAnalytics: createSelectors<AnalyticsState>(useAnalyticsBase),
  }

  tenantStores.set(tenantId, stores)
  return stores
}

// Component
function TenantDashboard({ tenantId }: { tenantId: string }) {
  const { useProducts } = getTenantStores(tenantId)
  const products = useProducts.use.items()

  return <ProductTable items={products} />
}
```

Each tenant gets own store instances. No cross-tenant state pollution. Stores created lazily on first access. Memory: negligible — each store is ~1kB of closures.

> **Think**: What leaks if tenants are created and never cleaned up?
>
> *Answer: Map grows unbounded. Fix: implement cleanup on tenant unmount: `tenantStores.delete(tenantId)`. Use WeakMap with component lifecycle if tenants mount/unmount frequently. Or LRU eviction for least-recently-used tenants.*

---

## Key Takeaways
- Atomic stores: one store per domain concern. Components subscribe only to their domain's store
- Breaking monolithic store into atomic stores eliminates cross-domain subscription entirely
- `createSelectors` utility auto-generates stable selectors for every state property — no inline object creation
- `useShallow` prevents re-render from object selectors by comparing key/value pairs
- Custom equality functions handle edge cases: deep comparison, ID-based comparison, length-only comparison
- Atomic stores + slices hybrid: atomic for independent domains, slices for tightly coupled domains
- Store factory pattern creates similar atomic stores without code duplication
- Performance measurement: compare subscriber count, re-render count, and flamegraph depth before/after migration
- Real-world: 5 atomic stores replacing 1 monolithic store — subscriber count per action drops from ~40 to ~8
- Incremental migration: extract most independent store first, use subscribers as bridge, delete monolithic store last

## Common Misconception

**"Atomic stores are just slices with extra steps — same outcome, more boilerplate."**

Atomic stores and slices solve different problems. Slices organize a single store into domain modules within the same `create()` call. All slices share one subscriber list — every state change evaluates every subscriber's selector. Atomic stores create independent subscriber lists — a change in store A never evaluates subscribers in store B.

The difference is architectural isolation vs code organization. Slices give you organized monolith. Atomic stores give you separate state machines. For apps where domains are genuinely independent (auth ≠ notifications ≠ theme), atomic stores provide strict isolation that slices cannot match. For tightly coupled domains (cart + checkout + orders), slices or a combined atomic store are more appropriate.

Choose by coupling: loosely coupled → atomic stores. Tightly coupled → slices (or single atomic store with scoped selectors). Not by preference for boilerplate.

---

## Feynman Explain
(Explain atomic stores to a junior dev who knows only `useState`. They understand "one state per component" but not "one store per domain." Analogy: kitchen drawers. Monolithic store = one giant drawer with forks, knives, plates, pots, and measuring cups all mixed together. To get a fork, you open the drawer and everything shifts. Atomic stores = separate drawers for forks, knives, plates. To get a fork, you open only the fork drawer. Nothing else moves. App drawers = authStore, cartStore, uiStore, productsStore. You only open the drawer you need, and nothing else gets disturbed.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain zustand-state-management` — AI probes gaps.*

---

## Reframe
(Pause. Critique: Atomic stores eliminate cross-domain subscription but add cross-store coordination complexity. Logout must clear cart — with monolithic store this was one `set()` call. With atomic stores, subscriber listens to auth changes. Is the subscription overhead worth the re-render savings? Also: createSelectors hides selector logic behind a utility — does this make debugging harder? When does atomic discipline become over-engineering? Consider: 3-person startup, MVP app, 10 store properties. Would you start atomic or refactor to atomic when performance becomes measurable problem? Write your evaluation — weigh coordination complexity against re-render savings.)

---

## Drill
Take the quiz. MCQs test atomic store decomposition, selectors stability, createSelectors usage, useShallow vs shallow, custom equality functions, and migration strategy.

Run: `learn.sh quiz zustand-state-management 14-atomic-stores`

## Quiz: 14-atomic-stores


### What is the primary benefit of atomic stores over a monolithic store?

- [ ] A: Smaller bundle size — each atomic store is independently tree-shakeable

- [✓] B: Components subscribe only to their domain's store — unrelated updates never trigger selector evaluation

- [ ] C: Atomic stores automatically deduplicate state across domains

- [ ] D: Atomic stores eliminate the need for selectors entirely


**Answer:** B

Atomic stores each have their own subscriber list. A change in store A never evaluates subscribers of store B. Monolithic store evaluates all selectors on every update — even those reading unrelated domains. Tree-shaking (A) is secondary; the primary win is subscription isolation.


### A monolithic store has 50 properties across 6 domains and 40 subscribers. After decomposition into 6 atomic stores, how many subscriber selectors evaluate when a UI theme toggle fires?

- [ ] A: All 40 — selectors still evaluate per update

- [✓] B: Approximately 6-8 — only subscribers of the UI atomic store

- [ ] C: 0 — theme toggles are local state, not store

- [ ] D: 40 divided by 6, so ~7


**Answer:** B

Only the UI atomic store's subscribers evaluate on theme toggle. Other stores (auth, cart, products, orders, notifications) have independent subscriber lists — their selectors never run. This is the core performance win of atomic stores.


### What does the `createSelectors` utility do?

- [ ] A: Creates a new Zustand store with pre-configured middleware

- [✓] B: Auto-generates stable selector functions for every top-level state property

- [ ] C: Validates that all selectors return primitive values

- [ ] D: Wraps the store with devtools and logger middleware


**Answer:** B

createSelectors generates a `useStore.use.propertyName()` for each top-level key in the store's state. Each selector extracts a single property by key, returning a stable reference. This eliminates inline object creation and unstable selectors without manual selector writing.


### A component uses `useAuthStore((s) =&gt; ({ name: s.user?.name, role: s.user?.role }))` without shallow. Auth store updates `token`. What happens?

- [ ] A: Component skips re-render — name and role did not change

- [✓] B: Component re-renders — selector returns new object reference every call, Object.is says different

- [ ] C: Component throws because selector returns object without shallow

- [ ] D: Component re-renders only if name changed — Object.is compares string values


**Answer:** B

The selector creates a new `{ name, role }` object every call. Object.is compares references, not values. Token update → selector re-runs → new object → Object.is: false → re-render. Fix: use `useShallow` or extract scalar values individually.


### Which scenario best fits `useShallow` instead of scalar selectors?

- [ ] A: Component reads a single primitive value (count, boolean flag)

- [✓] B: Component reads 2-3 related fields from the same store with infrequent updates

- [ ] C: Component reads deeply nested data with 5+ levels

- [ ] D: Component reads data from 3 different atomic stores


**Answer:** B

useShallow is ideal for 2-3 related fields from the same store when updates are infrequent. For a single primitive, scalar selector is simpler. For deeply nested data (C), useShallow's shallow comparison is insufficient — need custom equality or deep compare. For multi-store data (D), each store gets its own selector call.


### A component needs only `s.items.length` from a cart store. Selector: `useCartStore((s) =&gt; s.items)`. What is wrong?

- [ ] A: Nothing — reading the array and accessing .length is correct

- [✓] B: Component subscribes to entire items array — re-renders on any item mutation even if length unchanged

- [ ] C: Cannot call .length on store state — must use getState()

- [ ] D: Zustand does not allow array selectors


**Answer:** B

Extracting the entire `items` array subscribes to array reference changes. Adding, removing, or reordering items creates a new array reference → re-render. If component only needs length, use `useCartStore((s) =&gt; s.items.length)` — primitive number, no reference instability.


### When combining atomic stores with the slices pattern, which approach is correct for loosely coupled domains?

- [ ] A: Always use slices — one store with all domains, strict selector discipline

- [✓] B: Atomic stores for independent domains, slices for tightly coupled domains

- [ ] C: Never combine — pick one pattern and stick to it app-wide

- [ ] D: Use atomic stores for read-heavy domains, slices for write-heavy domains


**Answer:** B

Hybrid approach: atomic stores for loosely related domains (auth, notifications, UI) — they share no state and need no cross-calls. Slices for tightly coupled domains (cart + checkout + orders) — they share order state and sequential workflows. This combines isolation benefits with coordination simplicity where needed.


### A store factory creates multiple entity stores (products, categories, tags) with identical shape. Add a `bulkDelete` action only to products store. Best approach?

- [ ] A: Edit the factory to include bulkDelete — all entity stores should be identical

- [✓] B: After factory call, use `useProductsStore.setState` to inject bulkDelete as a new action

- [ ] C: Create products store manually without factory — factories should not have exceptions

- [ ] D: Use a separate utility function outside the store, not an action


**Answer:** B

Factory returns base store. Use `useProductsStore.setState` or extend the factory to accept an `extensions` callback parameter to inject domain-specific actions. Best: factory accepts `(set, get) =&gt; ({ ...base, ...extensions })`. This keeps factory reusable while allowing per-store customization.


### During atomic store migration, a component previously subscribed to `useStore((s) =&gt; s)` in the monolithic store. After migration, it subscribes to `useAuthStore`. What is the effect?

- [ ] A: Component re-renders on any store change — both approaches are equivalent

- [✓] B: Component re-renders only on auth store changes — cart, products, UI, and orders updates skip evaluation

- [ ] C: Component stops receiving updates — must use subscribe instead of selector

- [ ] D: Component re-renders on auth and cart changes — atomic stores share a subscriber list by default


**Answer:** B

Migrating from `useStore()` (no selector — subscribes to entire monolithic store) to `useAuthStore` (subscribes only to auth domain) eliminates re-evaluations from non-auth updates. The component now evaluates its selector only when auth store's state changes. Cart, products, UI, and orders updates are invisible.


### A subscriber pattern clears cart on logout: `useAuthStore.subscribe((s, prev) =&gt; { if (s.user === null &amp;&amp; prev.user !== null) useCartStore.getState().clearCart() })`. What is a potential issue?

- [ ] A: Subscribers cause infinite loops — clearCart triggers auth re-evaluation which triggers subscriber again

- [ ] B: Subscribers cannot call getState() on other stores — only the store they subscribe to

- [✓] C: If cart store has not loaded yet, clearCart throws. Also: subscriber runs on every state change, not just logout

- [ ] D: This pattern is correct — no issues


**Answer:** C

Two issues: (1) if cart store is lazy-loaded and not yet initialized when logout fires, `clearCart` may not exist. (2) Subscriber runs on every auth store change (token update, user profile change), not just on logout. The guard condition `s.user === null &amp;&amp; prev.user !== null` narrows it, but still runs selector on every auth update. Fix: check `useCartStore.getState().clearCart !== undefined` before calling, or use a dedicated event emitter.


---

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

## Quiz: 15-serialization-hydration

(quiz parse error: mapping values are not allowed here
  in "./subjects/zustand-state-management/modules/15-serialization-hydration/quiz.yaml", line 58, column 22)


---

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

## Quiz: 16-middleware-orchestration


### Why does default persist middleware fail to correctly serialize a Map or Set?

- [ ] A: Persist only serializes primitive types — JSON ignores Map and Set entirely

- [✓] B: JSON.stringify converts Map to {} and Set to [], but JSON.parse cannot reconstruct the original types

- [ ] C: Persist uses structuredClone which throws on Map and Set

- [ ] D: Map and Set are not supported in localStorage at all


**Answer:** B

JSON.stringify converts Map entries to {} (empty object) and Set values to []. JSON.parse returns a plain object and plain array — the type information is lost. You need custom reviver/replacer in createJSONStorage or a custom storage engine to restore Map/Set on rehydration.


### In a production middleware pipeline, which middleware layer should be outermost?

- [ ] A: Immer — needs to intercept all state changes first

- [ ] B: Persist — must save state after all transforms

- [✓] C: Error boundary — catches errors from all inner layers

- [ ] D: Devtools — must record every action including errors


**Answer:** C

Error boundary must be outermost because it wraps all other middleware. When an inner layer throws (validation, serialize, persist), the outermost error boundary catches it. Any middleware placed outside the error boundary would not be protected by it.


### You deploy a migration that renames the field 'user' to 'profile'. An older deployment that does not know about the rename reads persisted state written by the newer version. What happens?

- [ ] A: The old deployment migrates forward — it runs all migrations including the rename

- [✓] B: The old deployment sees missing 'user' field and sets it to null — data loss

- [ ] C: Persist throws a version conflict error and resets to default state

- [ ] D: The old deployment ignores unknown fields and works with what it has


**Answer:** B

The old deployment runs its own migration chain up to its highest version. If it only knows v2 but the persisted state is v3 (with renamed fields), it reads 'user' as undefined and may set it to the default (null). Rule: never delete old field names in migrations — rename by copying the value to the new key while preserving the old key for one version cycle.


### A logging middleware captures state diffs on every set. The store dispatches 50 actions on mount. What strategy best prevents log noise and memory pressure?

- [ ] A: Increase maxLogEntries to 1000 to ensure all initialization actions are recorded

- [ ] B: Disable diff logging entirely — only log action names

- [✓] C: Add a skipInitial option that filters actions until a hydrated flag is true, and cap maxLogEntries at 100-200

- [ ] D: Remove logging middleware in production — initialization only happens once


**Answer:** C

A skipInitial flag prevents logging until hydration completes, reducing noise. A cap at 100-200 entries prevents unbounded memory growth. Option A grows memory unnecessarily. Option B loses useful information. Option D does not address the dev-mode noise problem.


### Validation middleware is placed OUTSIDE persist. A user has stale persisted data with an invalid 'todos' value. What happens on page load?

- [✓] A: Persist rehydrates successfully, then validation runs and throws — the user sees an error

- [ ] B: Validation runs during rehydration, catches the invalid value, and prevents the store from initializing

- [ ] C: Persist rehydrates after validation — the invalid state loads before validation can check it

- [ ] D: Persist catches the validation error internally and falls back to default state


**Answer:** A

When validation middleware is outside persist, rehydration runs first (restoring invalid state), then validation sees the invalid value on the next set call, not on rehydration itself. Validation inside persist catches invalid state before it is saved, not after it loads. To validate on rehydration, use onRehydrateStorage or place validation inside persist.


### Error boundary middleware with recoverMode: 'rollback' stores previous state. What is a potential memory issue with this pattern?

- [ ] A: Storing prevSnapshot after every set doubles memory usage per update

- [✓] B: If set is called rapidly (animation, drag), prevSnapshot is captured and discarded on every frame — no memory issue

- [ ] C: Rollback stores a deep clone of state, which can be expensive for large stores

- [ ] D: Both A and C are correct


**Answer:** B

The error boundary stores prevSnapshot before each set, overwriting the previous snapshot. It does not accumulate snapshots — only one exists at a time. No deep clone is performed unless the middleware implementation explicitly clones. The rollback stores the reference, not a clone, so memory overhead is negligible.


### A team uses createProductionStore factory (Module 16 pattern) with 4 stores. One store needs different validation rules. What is the cleanest approach?

- [ ] A: Duplicate the factory function with modified validation for that store

- [✓] B: Pass validation rules via the options parameter — each store supplies its own rules

- [ ] C: Import the base middleware functions and compose manually without the factory

- [ ] D: Remove validation from the factory and add it as a separate middleware call in each store


**Answer:** B

The factory function already accepts options.rules per store. Passing different rules per store is the intended design. Duplication (A) violates DRY. Manual composition (C) defeats the factory's purpose. Removing validation from the factory (D) loses the consistency of having validation in every store.


### Devtools middleware is enabled in production. What is the primary concern?

- [ ] A: Production users cannot open DevTools — the middleware silently fails

- [✓] B: Devtools sends state diffs over WebSocket to the Redux DevTools extension every time set is called, even if no extension is connected

- [ ] C: Devtools in production behaves identically to development — no downside

- [ ] D: Devtools blocks the main thread on serialization of large states


**Answer:** B

Devtools middleware internally calls performance.mark and sends messages via postMessage. Even without an extension connected, the middleware still captures and serializes actions. The overhead is small but unnecessary in production. Set enabled: false or NODE_ENV conditional to eliminate it entirely.


### A logger middleware captures action duration and logs a warning when a set takes &gt; 16ms. Action 'syncTodos' consistently takes 45ms. What does 16ms represent?

- [ ] A: The maximum time React 19 allows for state updates before yielding to the scheduler

- [✓] B: The frame budget at 60fps — 1000ms / 60 frames = ~16.6ms per frame

- [ ] C: Zustand's internal middleware timeout threshold

- [ ] D: JavaScript's event loop minimum resolution


**Answer:** B

16ms is the frame budget for 60fps rendering. If a state update takes longer than 16ms, it can cause a dropped frame (jank). The logger warns when an action exceeds this budget, indicating it might block the render cycle. Useful for identifying expensive state transformations.


### You have middleware order: devtools(persist(logger(immer(store)))). Logger wraps set and calls it with modified args (drops action name). What is the consequence?

- [ ] A: Logger actions are invisible — no impact on other middleware

- [✓] B: Persist receives correct set but devtools loses action names because logger consumed them

- [ ] C: Immer receives the wrong args and produces corrupted drafts

- [ ] D: Persist silently drops the modified args and writes incorrect state


**Answer:** B

Logger wraps set and if it does not pass through the original third argument (action name), devtools (outermost) receives set calls without names. Devtools shows 'anonymous' actions. Persist and immer receive only the state partial and are unaffected — they do not use the action name. Rule: custom middleware wrapping set must pass through all original arguments or explicitly forward them.


---

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

## Quiz: 17-microfrontends


### What is the primary mechanism for sharing a Zustand store across microfrontends?

- [ ] A: Window.__SHARED_STATE__ global variable

- [✓] B: Module Federation exposing the store module as a remote

- [ ] C: Copying the store file into each microfrontend's codebase

- [ ] D: Using React Context at the shell level


**Answer:** B

Module Federation exposes Zustand stores as federated JS modules. Each remote imports the store at runtime from the host, ensuring a single store instance shared across app boundaries. Global variables (A) lack typing and reactivity. Copying files (C) creates duplicate instances. React Context (D) couples stores to React — Zustand stores are framework-agnostic modules.


### Two microfrontends each bundle their own Zustand library despite `shared: { zustand: { singleton: true } }`. What happens to the auth store?

- [ ] A: Nothing — Module Federation deduplicates Zustand instances automatically

- [✓] B: Each microfrontend creates its own auth store instance — state diverges across apps

- [ ] C: The app crashes — Zustand cannot be a singleton

- [ ] D: Only the host's Zustand version is used — remote's version is ignored


**Answer:** B

If Zustand is not shared as a singleton, each remote bundles its own Zustand instance. The `useAuthStore` import creates a new store in each remote's Zustand scope — these are separate closures with separate state. Auth state updated in remote A is invisible to remote B. Fix: ensure `shared: { zustand: { singleton: true } }` is respected and verify no duplicate bundling in remote builds.


### A microfrontend subscribes to the host's auth store with `useAuthStore.subscribe(callback)` but never calls the returned unsubscribe. The microfrontend mounts and unmounts 20 times. What is the result?

- [ ] A: No issue — React garbage collection removes the subscription on unmount

- [✓] B: The host's auth store accumulates 20 stale subscribers — memory leak

- [ ] C: Zustand automatically deduplicates identical subscribers

- [ ] D: Only the most recent subscription survives — earlier ones are overwritten


**Answer:** B

Zustand's `subscribe()` adds a listener to the store's subscriber list. The returned `unsubscribe` function removes it. If never called, the closure persists in the subscriber list. After 20 mount/unmount cycles, 20 stale closures hold references to unmounted components — preventing garbage collection. Fix: always call `unsubscribe()` in `useEffect` cleanup.


### Host exposes `useAuthStore` with field `user.name`. Host v3 renames to `user.displayName`. Remote v1 still reads `user.name`. What happens when remote v1 renders?

- [✓] A: Remote displays undefined — field renamed, old consumer breaks

- [ ] B: Zustand automatically aliases displayName to name

- [ ] C: Module Federation falls back to the previous store version

- [ ] D: Remote throws a TypeScript compilation error


**Answer:** A

Renaming a field in the shared store is a breaking change. Remote v1 expects `user.name`; host v3 only has `user.displayName`. `user.name` is `undefined`, component renders nothing or crashes. Fix: never remove/rename shared store fields. Add new fields only. Provide accessor getters for deprecated names. Use adapter layer in remote to map host schema to legacy expectations.


### Which pattern correctly isolates per-instance widget state in a microfrontend?

- [ ] A: Singleton shared store — all widgets read same data

- [✓] B: createStore from zustand/vanilla stored in useRef — each instance gets own store

- [ ] C: React Context wrapping each widget — Provider per instance

- [ ] D: Atomic store in host — widgets import from host


**Answer:** B

`createStore` from `zustand/vanilla` creates a standalone Zustand store (no hook). Storing it in `useRef` ensures each widget instance gets one independent store that persists across renders but is garbage-collected when the component unmounts. Context (C) adds wrapper nesting. Singleton (A) shares state between all instances. Host store (D) couples widget logic to host.


### Why use an event bus instead of direct store imports for cross-microfrontend communication?

- [ ] A: Event bus is faster than Zustand's subscribe

- [✓] B: Event bus decouples microfrontends — no direct module dependency between remotes

- [ ] C: Zustand cannot subscribe to stores from other microfrontends

- [ ] D: Event bus provides TypeScript type safety that direct imports lack


**Answer:** B

Direct store imports create tight coupling — one remote depends on another remote's module path. Event bus uses string-based channels: any app can publish, any app can listen, without importing each other's modules. This enables independent deployment (remote A can be updated without affecting remote B's store imports) and prevents circular dependencies.


### Dashboard microfrontend calls `useAuthStore.getState().user` inside `fetchMetrics`. Does this create a subscription?

- [ ] A: Yes — getState() registers a one-time subscription

- [✓] B: No — getState() reads current state synchronously without subscribing

- [ ] C: Yes — getState() is equivalent to useAuthStore((s) =&gt; s)

- [ ] D: No — but it throws if user is null


**Answer:** B

`getState()` returns the store's current state snapshot without adding a subscriber. The component does not re-render when auth state changes — it reads auth only at fetch time. This is intentional for dashboard: auth is read on demand, not reactively. For reactive auth-dependent UI, use `useAuthStore(selector)` which creates a subscription.


### Three microfrontends each import the same shared auth store via Module Federation. When auth updates, how many selector evaluations occur?

- [ ] A: Only subscribers in the microfrontend that initiated the change

- [✓] B: All subscribers in all three microfrontends — singleton store has one subscriber list

- [ ] C: None — Module Federation batches cross-app updates

- [ ] D: Only subscribers to the specific field that changed


**Answer:** B

Module Federation ensures one store instance (singleton). All `useAuthStore(selector)` calls from any microfrontend register with the same subscriber list. A single state update triggers all selectors. Remote boundaries do not create separate subscriber lists — the store is one object. Use selectors that extract only needed fields to limit re-renders.


### During migration from monolith to microfrontends, which bridge pattern allows zero consumer code changes?

- [ ] A: Copy the monolith store into each microfrontend

- [✓] B: Re-export the host's store from the monolith's original import path

- [ ] C: Use window.__STORE__ as intermediate bridge

- [ ] D: Rewrite all consumer components to use new import paths


**Answer:** B

In the monolith app, change the store file to `export { useAuthStore } from 'host/authStore'`. All existing consumer imports (`./store/authStore`) still resolve — they just re-export from the host. Consumers need zero changes. The store API is identical. After all consumers verify, remove the bridge file and update imports to point directly to host.


### A microfrontend dashboard has 4 widgets, each with its own vanilla store (createStore + useRef). Widget A updates its state. Which widgets re-render?

- [ ] A: All 4 widgets — they share the same vanilla store

- [✓] B: Only Widget A — each widget has its own independent store instance

- [ ] C: Widget A and any widget subscribed to the same event bus channel

- [ ] D: None — vanilla stores do not trigger React re-renders


**Answer:** B

Each widget creates its own `createStore` instance in `useRef`. These are independent Zustand stores — a state change in Widget A's store does not affect Widget B's store. Only Widget A's `useStore` hooks re-evaluate. This is the isolation benefit: each widget instance manages its own state without cross-widget interference.


---

# Module 18: Zustand with Server Components — Client Store Boundaries

Est. study time: 2h
Language: en

## Learning Objectives
- Design Zustand store boundaries in RSC architecture: `use client` isolation rules
- Implement server-to-client data hydration via serialized props
- Manage per-request store instances vs singleton stores in RSC context
- Build e-commerce cart flow: RSC fetches product data + Zustand manages client cart

---

## Core Content

### Stores Are Client-Only: The `use client` Rule

React Server Components run exclusively on the server. They cannot use hooks, context, or client-side state. Zustand stores depend on React context and subscription — they are client-only.

```typescript
// ❌ WRONG — Server Component cannot use Zustand
// page.tsx (Server Component by default)
import { useCartStore } from './stores/cart'

export default function Page() {
  const items = useCartStore(state => state.items) // TypeError: Cannot read from store
  return <div>{items.length}</div>
}
```

```typescript
// ✅ CORRECT — Isolate store behind `use client`
// CartToggle.tsx — Client Component boundary
'use client'

import { useCartStore } from './stores/cart'

export function CartToggle() {
  const count = useCartStore(state => state.items.length)
  return <button>Cart ({count})</button>
}
```

Rule: Zustand stores and any component calling `useStore` must be in a file with `'use client'` directive. The store file itself does not need `'use client'` — only components that consume it.

> **Think**: Can a Zustand store definition file import from a Server Component? What happens if the store definition contains `useEffect`?
>
> *Answer: Store definition (no hooks, no JSX) can live outside `'use client'`. But if store definition uses `useEffect` — e.g., `persist` middleware subscribing to `localStorage` — it must be client-only. Keep store definitions pure: `create((set) => ({...}))` without lifecycle. Move side effects to client components.*

### Passing Initial State from Server to Client: Hydration Pattern

Server Components fetch data. Client stores need initial state. The bridge: serialize server data as props, hydrate store on mount.

```typescript
// page.tsx — Server Component
import { ProductList } from './ProductList'
import { getProducts } from './api'

export default async function Page() {
  const products = await getProducts() // server-side fetch
  return <ProductList initialProducts={products} />
}
```

```typescript
// ProductList.tsx — Client Component
'use client'

import { useEffect } from 'react'
import { useProductStore } from './stores/product'

interface Props {
  initialProducts: Product[]
}

export function ProductList({ initialProducts }: Props) {
  const setProducts = useProductStore(state => state.setProducts)

  useEffect(() => {
    setProducts(initialProducts)
  }, [setProducts, initialProducts])

  // or: Zustand v5+ supports
  // useProductStore.setState({ items: initialProducts }) directly

  return <div>...</div>
}
```

**Critical**: Hydrate only once. If `initialProducts` changes on re-render (e.g., parent re-fetches), the `useEffect` fires again — but in RSC, server props are stable per render. The `[]` deps are safe because Server Components pass fresh props per navigation, not per parent re-render.

> **Think**: What happens if the client component re-renders before the store hydration `useEffect` runs? Does the UI show stale state?
>
> *Answer: Yes — first render shows empty store (default initial state). This is intentional. The store returns `[]` items until `useEffect` fires. If this causes layout shift or flash, use `create` with server-provided initial state: `create<Store>((set) => ({ items: initialServerData ?? [], ... }))` and skip the `useEffect`. Pass initial state via store creator closure.*

### Server Data Flows: RSC Fetches → Client Consumes with Zustand

Architecture pattern:

```
Server Component
  ├── fetch data (DB, API, file)
  ├── serialize to plain JSON
  └── pass as props
        └── Client Component ('use client')
              ├── hydrate Zustand store on mount
              └── client interactions (add to cart, filter, sort)
                    └── no server roundtrip needed
```

This splits responsibilities cleanly: server owns initial data, client owns interactive state. No API calls from client for data already fetched on server.

> **Think**: You have a product listing page. Server fetches 100 products. Client needs to filter by category. Should you re-fetch filtered data from server? Why?
>
> *Answer: No. Client-side filter is instant — no network latency, no server load. Server re-fetch only if data changes (new products added), not for presentation transforms. Zustand keeps filtered list derived: `const filtered = useProductStore(state => state.products.filter(p => p.category === selected))`.*

### Per-Request Store vs Singleton Store

RSC renders per request. If a Zustand store is a singleton (module-level `create`), all users sharing the server process also share store state. This leaks data between requests.

```typescript
// ❌ WRONG — Singleton store leaks data between users
// stores/cart.ts
import { create } from 'zustand'
export const useCartStore = create<CartStore>(...) // one instance for all users
```

**Correct patterns**:

1. **Client-only store inside `'use client'`**: Singleton is fine here because each browser gets its own JavaScript context. Only the server-side Node process shares singletons — but Zustand stores in `'use client'` components never execute on server.

2. **Server-side rendering / SSG**: If you SSR a page with Zustand (e.g., Next.js Pages Router), create a store per request and serialize initial state to client.

```typescript
// With Next.js App Router — no issue: RSC + client boundary means
// the store exists only in browser memory. Singleton is safe.
```

```typescript
// With Next.js Pages Router (getServerSideProps) — must create per request
// Because store runs on server during SSR
import { createStore } from 'zustand/vanilla'

export function createCartStore(initialItems: Item[]) {
  return createStore<CartStore>((set) => ({
    items: initialItems,
    addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  }))
}
```

> **Think**: Your app uses Next.js App Router (RSC) exclusively. Is a singleton Zustand store safe? What if you also use middleware that runs on the edge?
>
> *Answer: Safe for App Router. Zustand store never executes on server because the consuming component is `'use client'`. Edge middleware does not import the store — it transforms request/response, not component state. Singleton across browser tabs is the real concern: each tab has its own store instance (browser isolates module execution per tab).*

### Zustand with Next.js App Router: Layout vs Page Store Boundaries

Next.js layouts persist across navigations. Pages unmount and remount. Store lifecycle must match.

| Boundary | Store lifecycle | Use case |
|----------|----------------|----------|
| **Root layout** | Mounts once, persists across all pages | Auth state, theme, global UI |
| **Nested layout** | Persists within route segment | Sidebar filters, tab state |
| **Page** | Mounts/unmounts per navigation | Product detail, search results |
| **Modal / parallel route** | Independent lifecycle | Cart drawer, quick view |

```typescript
// RootLayout shares one store instance across all child pages
// app/layout.tsx
'use client'

import { useAuthStore } from '@/stores/auth'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(state => state.user)
  return (
    <html>
      <body>
        <header>{user?.name}</header>
        {children}
      </body>
    </html>
  )
}
```

```typescript
// Page component gets fresh store state via props from server
// app/products/page.tsx — Server Component
import { ProductGrid } from './ProductGrid'

export default async function ProductsPage() {
  const products = await fetchProducts()
  return <ProductGrid serverProducts={products} />
}
```

Page stores should initialize from server data. Layout stores persist — they hold session-level state, not page-level.

> **Think**: A cart store lives in the root layout. User navigates from `/products` to `/checkout`. Does the cart state survive? What triggers a reset?
>
> *Answer: Cart survives because root layout does not unmount. Cart reset happens on explicit action (checkout complete, clear cart). Layout-level stores are stable across navigation — this is intentional for cart, auth, notifications.*

### Streaming + Zustand: Client Store Hydration After SSR

React 19 streams SSR content progressively. Parts of the page arrive at different times. Zustand hydration must account for partial rendering.

Problem: A server component streams product data. The client cart store does not know about products until hydration completes.

```typescript
// ProductCard.tsx — streams as part of Suspense boundary
'use client'

import { useCartStore } from '@/stores/cart'
import type { Product } from '@/types'

// Product arrives with stream — not available at initial render
export function AddToCartButton({ product }: { product: Product }) {
  const addItem = useCartStore(state => state.addItem)
  return <button onClick={() => addItem(product)}>Add to Cart</button>
}
```

Key insight: Each product card streams independently. The Zustand store accumulates items as user interacts. No hydration race — store is client-only, browser-ready before first streamed content arrives.

**Watch for**: If store initial state depends on all streamed data (e.g., aggregated count), collect at layout level and pass down. Do not rely on all streamed components hydrating before store interaction.

> **Think**: Your page streams 50 product cards over 3 seconds. User clicks "Add to Cart" on card #3 before cards #4-50 arrive. Does the store accept the item? What about card #3's data — was it available?
>
> *Answer: Yes — card #3 arrived and hydrated before user clicked (it rendered). The store is independent of streaming. User can add items as each card streams. Items from unstreamed cards simply don't exist in the store yet. This is correct behavior: you cannot add what has not rendered.*

### Server Actions + Zustand: Mutations That Update Client Store

Server Actions run on the server. Zustand lives on the client. How do server mutations update client state?

```typescript
// actions.ts — Server Action (runs on server)
'use server'

import { revalidatePath } from 'next/cache'

export async function removeFromServerCart(productId: string) {
  const db = await connectDB()
  await db.cart.delete({ productId })
  revalidatePath('/cart')
}
```

```typescript
// CartPage.tsx — Client Component
'use client'

import { useCartStore } from '@/stores/cart'
import { removeFromServerCart } from './actions'

export function CartPage({ initialItems }: { initialItems: Item[] }) {
  const { items, removeItem } = useCartStore()

  const handleRemove = async (id: string) => {
    // Optimistic: update client store immediately
    removeItem(id)

    // Server: persist deletion
    const result = await removeFromServerCart(id)

    if (result.error) {
      // Revert optimistic update on failure
      // Re-fetch from server or restore item
    }
  }

  return <div>...</div>
}
```

**Two concerns**: (1) Client store for instant UI feedback. (2) Server action for persistence. They stay in sync via:
- Optimistic update: update store first, fire server action
- On success: do nothing (already correct)
- On failure: revert store, re-fetch server data via RSC revalidation

> **Think**: What happen if user goes offline after clicking "Remove" — store removes item optimistically, server action fails. User reloads page. Does RSC re-fetch show the item still in server cart?
>
> *Answer: Yes. Server action never reached server. `revalidatePath` never ran. On reload, RSC re-renders from server data — item still present. Client store re-hydrates from server props, showing correct server state. Offline optimistic update is discarded. This is the correct safety net: server is source of truth, client store is UI acceleration layer.*

### Cache Invalidation: Reconciling Server Data with Client Zustand Store

Multiple sources of truth create sync problems. Strategy:

| Source | Role | Refresh trigger |
|--------|------|-----------------|
| Server (RSC) | Source of truth for initial data | Navigation, mutation, interval |
| Zustand store | Client acceleration layer | User interaction, optimistic update |
| Server Action result | Mutation confirmation | After action completes |

Reconciliation rules:
1. Zustand store initializes from server props — never from a separate client fetch
2. After server mutation, revalidate RSC path, then re-hydrate store from new server props
3. Do not maintain duplicate state: server data that never changes (product details) should not go into Zustand at all — render from server props directly
4. Only store mutable client state in Zustand: cart, filters, UI state

```typescript
// Pattern: after RSC revalidation, re-hydrate store
export function SyncStoreWithRSC({ serverCart }: { serverCart: CartItem[] }) {
  const setItems = useCartStore(state => state.setItems)

  // Server props are always the latest server state after revalidation
  useEffect(() => {
    setItems(serverCart)
  }, [serverCart, setItems])

  return null // invisible sync component
}
```

> **Think**: You sync server cart to Zustand every time server props change. A server action removes item X. RSC revalidates. `serverCart` no longer has X. Zustand syncer runs and removes X from local store. Rate this approach.
>
> *Answer: This is correct — server is source of truth. But if user had pending optimistic changes (item Y not yet submitted), sync overwrites them. Solution: track pending operations in a separate store slice. Sync only data that has no pending server operation.*

### Avoiding Hydration Mismatch: Server State + Client Store Alignment

React hydration mismatch occurs when server-rendered HTML differs from client render. With Zustand, this happens when store initial state differs from server props.

```typescript
// store/cart.ts
import { create } from 'zustand'

interface CartState {
  items: string[]
  addItem: (item: string) => void
}

export const useCartStore = create<CartState>((set) => ({
  items: [], // default — likely empty
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
}))
```

```typescript
// page.tsx
export default async function Page() {
  const serverItems = await getCartItems() // maybe ["item1", "item2"]
  return <CartPage initialItems={serverItems} />
}
```

```typescript
// CartPage.tsx
'use client'

import { useCartStore } from '@/stores/cart'

export function CartPage({ initialItems }: { initialItems: string[] }) {
  const items = useCartStore(state => state.items)

  // Problem: server rendered HTML shows initialItems, client hydration
  // renders [] from store — mismatch!

  return <div>{items.length} items</div>
}
```

**Fix**: Initialize store with server data before first render, not in `useEffect`.

```typescript
// ✅ CORRECT — Initialize store synchronously on mount
'use client'

import { useCartStore } from '@/stores/cart'

export function CartPage({ initialItems }: { initialItems: string[] }) {
  // Store initializer hook
  useStoreHydration(initialItems)
  const items = useCartStore(state => state.items)

  return <div>{items.length} items</div>
}
```

```typescript
// hooks/useStoreHydration.ts
'use client'

import { useEffect, useRef } from 'react'
import { useCartStore } from '@/stores/cart'

export function useStoreHydration(initialItems: string[]) {
  const hydrated = useRef(false)

  useEffect(() => {
    if (!hydrated.current) {
      useCartStore.setState({ items: initialItems })
      hydrated.current = true
    }
  }, [initialItems])
}
```

**Server render output**: React renders once on server with store default state. If server render path uses Zustand (Pages Router SSR), create per-request store with correct initial state. In App Router, server render never touches Zustand — the client component receives props and renders with empty store, then re-renders immediately after hydration `useEffect`. This double-render is normal and does not cause visible mismatch because the `useEffect` runs after paint.

> **Think**: Next.js App Router renders a Client Component that uses Zustand. Server sends HTML. Client hydrates. Does React warn about hydration mismatch?
>
> *Answer: No — as long as server-rendered HTML matches client initial render (both use empty store). The `useEffect` hydration runs after hydration completes. React compares server HTML to first client render, not to post-effect state. This is safe by design. Mismatch only occurs if client first render produces different HTML than server — which happens only if store default state is accessed during render with non-empty initial state.*

### Real Example: E-Commerce Page with RSC Product Data + Zustand Cart Store

Complete architecture:

```
app/products/page.tsx (Server)
  ├── fetch products from DB
  ├── fetch user's server cart
  └── render:
        ├── ProductList client component
        │     └── receives serverProducts, serverCart
        └── CartDrawer client component
              └── receives serverCart
```

```typescript
// app/products/page.tsx — Server Component
import { getProducts, getUserCart } from '@/lib/db'
import { ProductList } from './ProductList'
import { CartDrawer } from './CartDrawer'
import { auth } from '@/lib/auth'

export default async function ProductsPage() {
  const session = await auth()
  const [products, cart] = await Promise.all([
    getProducts(),
    getUserCart(session.userId),
  ])

  return (
    <div>
      <ProductList serverProducts={products} serverCart={cart} />
      <CartDrawer serverCart={cart} />
    </div>
  )
}
```

```typescript
// app/products/ProductList.tsx — Client Component
'use client'

import { useCartStore } from '@/stores/cart'
import { useHydrateStore } from '@/hooks/useHydrateStore'
import type { Product, CartItem } from '@/types'

interface Props {
  serverProducts: Product[]
  serverCart: CartItem[]
}

export function ProductList({ serverProducts, serverCart }: Props) {
  useHydrateStore(serverCart)

  const addItem = useCartStore(state => state.addItem)
  const cartItems = useCartStore(state => state.items)

  return (
    <div>
      <h2>Products ({serverProducts.length})</h2>
      {serverProducts.map(product => (
        <div key={product.id}>
          <h3>{product.name}</h3>
          <p>${product.price}</p>
          <button
            onClick={() => addItem({
              productId: product.id,
              name: product.name,
              price: product.price,
              quantity: 1,
            })}
          >
            {cartItems.some(i => i.productId === product.id)
              ? 'In Cart'
              : 'Add to Cart'}
          </button>
        </div>
      ))}
    </div>
  )
}
```

```typescript
// stores/cart.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem } from '@/types'

interface CartState {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (productId: string) => void
  clearCart: () => void
  setItems: (items: CartItem[]) => void
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) =>
        set((state) => {
          const existing = state.items.find(i => i.productId === item.productId)
          if (existing) {
            return {
              items: state.items.map(i =>
                i.productId === item.productId
                  ? { ...i, quantity: i.quantity + 1 }
                  : i
              ),
            }
          }
          return { items: [...state.items, item] }
        }),
      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter(i => i.productId !== productId),
        })),
      clearCart: () => set({ items: [] }),
      setItems: (items) => set({ items }),
    }),
    { name: 'cart-storage' }
  )
)
```

```typescript
// hooks/useHydrateStore.ts
'use client'

import { useEffect, useRef } from 'react'
import { useCartStore } from '@/stores/cart'

export function useHydrateStore(serverCart: CartItem[]) {
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current && serverCart.length > 0) {
      useCartStore.setState({ items: serverCart })
      initialized.current = true
    }
  }, [serverCart])
}
```

Flow:
1. Server fetches products + cart
2. Client receives both as props
3. Store hydrates from serverCart on first render (via useEffect)
4. User adds items — store updates instantly, persist middleware saves to localStorage
5. Server Actions run on add/remove — revalidate RSC path, fresh props arrive
6. Hydration sync updates store with latest server state
7. On reload: persist middleware loads from localStorage first, then server props overwrite if different

> **Think**: persist middleware saves cart to localStorage. Server props arrive after hydration. Which wins — localStorage or server?
>
> *Answer: Server wins, because hydration useEffect runs after persist middleware has already restored from localStorage. The `setItems(serverCart)` overwrites localStorage data. Rationale: server is authoritative. User might have checked out on another device, clearing server cart — localStorage would show stale data. Server props reflect truth.*

---

### Why This Matters

RSC architecture is the default in Next.js App Router and becoming standard in React. Zustand stores that ignore RSC boundaries leak data, cause hydration mismatches, or break entirely. Every Zustand user building modern React apps must understand `use client` boundaries, server-to-client data flow, and store lifecycle per RSC render. Wrong approach: duplicate server fetches in client stores, singleton stores shared across requests, hydration race conditions. Right approach: server fetches data, passes as props, Zustand hydrates once and takes over interactivity.

---

### Common Questions

**Q: Does every Zustand store file need `'use client'`?**
A: No. Only components that import and call `useStore` need `'use client'`. The store definition (`create(...)`) is pure JS — it can live anywhere. But if the store uses browser-only APIs (localStorage in persist middleware), it must be in a module only imported by client components. Next.js will not execute it on server, but the import itself could trigger server errors if it accesses `window`.

**Q: What about Zustand with React Server Components in a non-Next.js framework?**
A: Same rules apply. RSC is a React feature, not Next.js-specific. The `'use client'` boundary, server-to-client prop passing, and hydration patterns are identical. Framework-specific differences: Remix uses loader data instead of async components; Gatsby uses SSR or SSG. The Zustand pattern remains: server data → serialized props → client store hydration.

**Q: Can I use `create` from `zustand/vanilla` on the server?**
A: Yes — vanilla store is just an event emitter with `setState`/`getState`. Useful for server-side preloading or background jobs. But do not import it into a Server Component that renders it to JSX. Use vanilla stores in server utilities, API routes, or middleware. Keep the `useStore` React binding strictly client-side.

**Q: What is the performance cost of the hydration useEffect pattern?**
A: Negligible. One `useEffect` call per page load that sets state. The double-render (empty → hydrated) is invisible to users because both renders produce the same HTML (empty store renders "0 items"). The hydration fills the store for subsequent interactions. For large stores (10k+ items), batch update: `useCartStore.setState({ items: serverCart })` is O(1) — Zustand uses immutable updates, not diffing.

**Q: How do I test Zustand stores that depend on RSC data?**
A: Mock the server data layer. Create store with initial test data. Test the store in isolation (no RSC context needed). For integration tests (e.g., Playwright), seed the server response with fixtures. The store behavior is identical in test — it receives `setItems` from test code just as it would from server props.

---

## Examples

### Example 1: Migrating a Zustand Cart from Client-Only to RSC

**Problem**: Existing Zustand cart store fetches its own data via `useEffect` on the client. After migrating to App Router, the initial cart fetch happens twice — once on server (for the page component) and once in the store's `useEffect`.

Before:
```typescript
const useCartStore = create<CartState>((set) => ({
  items: [],
  fetchCart: async () => {
    const res = await fetch('/api/cart')
    const data = await res.json()
    set({ items: data })
  },
}))

// Cart.tsx — client component fetches its own data
function Cart() {
  const { items, fetchCart } = useCartStore()

  useEffect(() => {
    fetchCart() // duplicate fetch — also fetched by server
  }, [fetchCart])

  return <div>{items.length}</div>
}
```

**Solution**:
1. Remove `fetchCart` from store (server owns data fetching)
2. Server Component fetches cart data
3. Pass `initialCart` as prop to client component
4. Hydrate store from prop

After:
```typescript
// page.tsx — Server Component
export default async function Page() {
  const cart = await getServerCart()
  return <Cart initialCart={cart} />
}

// Cart.tsx — Client Component
'use client'

function Cart({ initialCart }: { initialCart: Item[] }) {
  useHydrateStore(initialCart) // sync, no duplicate fetch
  const items = useCartStore(state => state.items)
  return <div>{items.length}</div>
}
```

**Result**: Single fetch (server). No client waterfall. Store hydrates once. Zero duplicate API calls.

### Example 2: Multi-Tenant Dashboard with Store Boundaries

**Problem**: SaaS dashboard. Server fetches tenant-specific data. Each tenant has unique layout, settings, and user list. Layout store (sidebar collapse) persists across tenants. Settings store resets per tenant.

```typescript
// app/[tenant]/layout.tsx — Server Component
export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { tenant: string }
}) {
  const tenant = await getTenant(params.tenant)
  return <TenantShell tenantName={tenant.name} config={tenant.config} />
}

// app/[tenant]/TenantShell.tsx — Client Component
'use client'

export function TenantShell({
  tenantName,
  config,
  children,
}: {
  tenantName: string
  config: TenantConfig
}) {
  useLayoutStore.setState({ tenant: tenantName })
  useSettingsStore.setState({ config }) // resets per tenant

  return (
    <div>
      <h1>{tenantName}</h1>
      {children}
    </div>
  )
}
```

**Boundary rules**:
- `useLayoutStore`: subscription in root layout — persists across tenant switches (sidebar state)
- `useSettingsStore`: re-initialized per tenant layout mount — each tenant gets fresh config
- Server data: fetched once per tenant navigation, passed as props
- Result: no cross-tenant data leak, no duplicate fetches, correct lifecycle

### Example 3: Real-Time Collaborative Cart with RSC Base Data

**Problem**: E-commerce app with real-time cart sync (WebSocket) but initial SSR from RSC. Server fetches initial cart. WebSocket keeps it current. Zustand on client merges both.

```typescript
// page.tsx — Server Component
export default async function Page() {
  const initialCart = await getCart()
  return <RealtimeCart initialCart={initialCart} />
}

// RealtimeCart.tsx — Client Component
'use client'

import { useEffect } from 'react'
import { useCartStore } from '@/stores/cart'

function RealtimeCart({ initialCart }: { initialCart: Item[] }) {
  const { items, addItem, removeItem, setItems } = useCartStore()

  // Step 1: Hydrate from server
  useEffect(() => {
    setItems(initialCart)
  }, [initialCart, setItems])

  // Step 2: Subscribe to WebSocket for real-time updates
  useEffect(() => {
    const ws = new WebSocket('wss://cart.example.com/live')
    ws.onmessage = (event) => {
      const update = JSON.parse(event.data)
      // update.type: 'add' | 'remove' | 'sync'
      if (update.type === 'sync') {
        setItems(update.items) // full sync from server
      }
    }
    return () => ws.close()
  }, [setItems])

  return <div>{items.length} items (live)</div>
}
```

**Result**: Initial cart renders immediately from RSC. WebSocket keeps store up-to-date for multi-device sync. No conflict: RSC is the initial snapshot, WebSocket is the live stream. Both converge to same store.

---

## Key Takeaways
- Zustand stores are client-only — `'use client'` boundary protects against RSC errors
- Server data flows via serialized props → client `useEffect` hydration
- Singleton store is safe in App Router (store never runs on server)
- Per-request store only needed in SSR frameworks (Pages Router)
- Layout stores persist across navigations; page stores re-initialize per route
- Streaming SSR works with Zustand — each streamed component can interact independently
- Server Actions + Zustand: optimistic update in store → server mutation → revalidate → re-hydrate
- Server is source of truth; Zustand is UI acceleration layer
- Hydration mismatch avoided by matching first server render to client initial render (empty store)
- Persist middleware + server hydration: server props override localStorage

## Common Misconception

**"Zustand stores in RSC apps should be server-side singletons."**

Zustand store definitions are pure JS that can run anywhere. But the React binding (`useStore`) requires React context, which does not exist on the server in RSC architecture. Developers see "Zustand works on server" (vanilla API) and incorrectly wire stores into Server Components, causing cross-request data leaks or runtime errors. The store definition may be server-safe; the store consumer is not. Keep the boundary clear: store definition in shared module, store consumption behind `'use client'`. When in doubt, put `'use client'` on any file importing from `zustand` (not `zustand/vanilla`).

---

## Feynman Explain
(Explain Zustand + RSC architecture to a junior developer who knows React but not Server Components. Use the restaurant analogy: server = kitchen that prepares your order, client = your table. Why can't the table touch the kitchen prep? How does the waiter (serialized props) bring food (data) from kitchen to table?)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain zustand-state-management` — AI probes gaps.*

---

## Reframe
(Pause. Judge: Are RSC + Zustand worth the complexity for a simple blog? When does the `'use client'` boundary + hydration pattern tax outweigh benefits? Where would Server Actions + React context be simpler than Zustand? Write your evaluation. Consider trade-offs between bundle size, fetch patterns, and team velocity.)

---

## Drill
Take the quiz. MCQs test store boundaries, hydration patterns, server data flow, and RSC architecture.

Run: `learn.sh quiz zustand-state-management 18-rsc-server-components`

## Quiz: 18-rsc-server-components


### What directive must a React file include to use Zustand's useStore hook inside Next.js App Router?

- [ ] A: 'use server'

- [✓] B: 'use client'

- [ ] C: 'use store'

- [ ] D: 'use zustand'


**Answer:** B

useStore depends on React context and subscription, which only exist in client components. 'use client' marks the file as a Client Component, granting access to hooks.


### Where should a Zustand store definition file be placed relative to the 'use client' boundary?

- [ ] A: Must be in a file with 'use client'

- [✓] B: Can be in any file, but only imported by client components that call useStore

- [ ] C: Must be in a file with 'use server'

- [ ] D: Must be in a separate package


**Answer:** B

The store definition (create(...)) is pure JS and needs no directive. Only components calling useStore need 'use client'. If store uses browser APIs (localStorage), it must only be imported by client components.


### A Server Component fetches product data and wants a Client Component to have it in a Zustand store. What is the correct data flow?

- [ ] A: Server Component calls useStore.setState directly

- [✓] B: Server Component passes data as props to Client Component, which hydrates store via useEffect

- [ ] C: Client Component fetches the same data from a client-side API route

- [ ] D: Store is defined in a Server Component module and imported by the Client Component


**Answer:** B

Server Component cannot access Zustand stores (no hooks). Data flows down as serialized props. Client Component accepts props and hydrates the store, typically via useEffect on mount.


### In Next.js App Router, is a singleton Zustand store (created at module level with create) safe from cross-request data leaks?

- [ ] A: No — all users share the same Node process, so singleton leaks data

- [✓] B: Yes — the store executes only in the browser (behind 'use client'), so each browser gets its own instance

- [ ] C: Only if wrapped in createStore from zustand/vanilla

- [ ] D: Only if persist middleware is not used


**Answer:** B

The store is only imported by 'use client' components, which never execute on the server in App Router. Each browser tab gets its own module execution context, so the singleton is scoped per tab.


### A product page streams 20 cards over 3 seconds via Suspense. A user clicks 'Add to Cart' on card #5 before cards #6-20 have streamed. What happens?

- [ ] A: Nothing — store waits for all cards to finish streaming

- [ ] B: The store rejects the click because card data is incomplete

- [✓] C: The store adds the item immediately — card #5 already hydrated

- [ ] D: The store throws an error


**Answer:** C

Card #5 arrived and hydrated before the click. The store is independent of streaming progress. Unstreamed cards simply do not exist in the store yet.


### A Server Action removes item X from the cart. RSC revalidates. The client Zustand store should:

- [ ] A: Keep item X in the store until user manually refreshes

- [✓] B: Re-hydrate from the new server props, removing item X

- [ ] C: Ignore the server change and maintain optimistic state

- [ ] D: Emit a warning about server/client mismatch


**Answer:** B

Server is source of truth. After revalidation, new server props reflect the mutated state. The client store re-hydrates from those props, matching the server state.


### What causes a React hydration mismatch with Zustand in App Router?

- [ ] A: Server renders HTML with empty store, client renders with empty store — then useEffect hydrates

- [✓] B: Server renders HTML with empty store, client first render also uses empty store — no mismatch

- [ ] C: useEffect hydration runs before React hydration completes

- [ ] D: persist middleware loads from localStorage during server render


**Answer:** B

Mismatch occurs only when server HTML differs from client first render. Both render empty store. The useEffect hydration runs after hydration completes, so React does not flag a difference.


### User clicks 'Remove Item' — store optimistically removes it. Server Action fails (network error). User refreshes page. What state does the cart show?

- [ ] A: Item still removed because store saves to localStorage

- [✓] B: Item reappears because RSC re-fetches from server (source of truth)

- [ ] C: Blank page — error boundary catches the failed action

- [ ] D: Item removed, but with a warning badge


**Answer:** B

Server action never reached server — cart in DB still has the item. RSC re-renders from server data. Client store re-hydrates from server props. The optimistic deletion is discarded. Server is always source of truth.


### Which state belongs in a root layout-level Zustand store vs a page-level store?

- [✓] A: Theme toggle → root layout; search results → page-level

- [ ] B: Cart items → root layout; user theme → page-level

- [ ] C: Both belong in root layout to avoid prop drilling

- [ ] D: All state should be fetched from server per navigation


**Answer:** A

Root layout persists across pages — suitable for global UI state (theme, sidebar). Page-level state (search results, product filters) should re-initialize per navigation. Cart straddles both — typically layout-level because it persists across pages.


### An e-commerce page has server-fetched product data and a client Zustand cart store. A product's price is static (never changes after creation). Where should the price data live?

- [ ] A: In the Zustand cart store, duplicated per cart item

- [✓] B: Rendered from server props directly — not stored in Zustand

- [ ] C: Fetched again from the client via API

- [ ] D: Stored in a separate Zustand 'product' store


**Answer:** B

Static server data that never changes should not go into Zustand. Render directly from server props. Only mutable client state belongs in Zustand: cart quantities, applied filters, UI toggles. Duplicating static data wastes memory and creates sync risk.


---

# Module 19: Migration — useReducer, Context, Redux Toolkit to Zustand

Est. study time: 2.5h
Language: en

## Learning Objectives
- Design incremental migration strategy from legacy state management to Zustand
- Migrate useReducer + Context, Context-only, and Redux Toolkit codebases to Zustand
- Implement coexistence layer for running old and new systems side-by-side
- Apply team adoption patterns: naming conventions, migration checklist, testing strategy

---

## Core Content

### Migration Strategy: Incremental, Not Big Bang

Single largest cause of migration failure: rewriting everything at once. Big bang rewrites create risk surface proportional to codebase size. Testing impossible. Rollback impossible. Teams ship 6 months later with no safety net.

**Incremental migration principles:**

1. **Strangler fig pattern**: new system grows alongside old. Old code routes to new system piece by piece. Old system deleted only when all consumers migrated.
2. **Module boundary**: migrate one feature at a time. Feature A uses Zustand. Feature B still uses Redux. Both coexist.
3. **No shared mutable state** across old/new during migration. Each system owns its state. Synchronize only at boundaries (e.g., auth token changes).
4. **Feature flag**: toggle between old and new implementation per feature. Rollback flips flag.

```typescript
// Feature flag per module during migration
const migrationFlags = {
  auth: 'redux' as 'redux' | 'zustand',
  todos: 'redux',
  cart: 'zustand',
}
```

5. **Parallel run**: both old and new stores process same events. Compare outputs. Detect divergence before users do.

> **Think**: Your team has 1 month to migrate a critical checkout flow. Big bang or incremental? What happens if the 1-month deadline misses?
>
> *Answer: Incremental. Deadline miss with big bang = whole checkout broken, no partial rollback, no deploy. Incremental: pause migration at current module, ship partial. Checkout works with hybrid state — some modules on Zustand, rest on Redux. Deadline miss = acceptable, not catastrophic.*

### Strategy Spectrum

| Strategy | Risk | Speed | Rollback | Best for |
|----------|------|-------|----------|----------|
| Big bang | Very high | Fastest | None | Greenfield (<1k LOC) |
| Module-by-module | Low | Medium | Per module | >10k LOC legacy |
| Strangler fig | Low | Slow | Full | >50k LOC monolith |
| Parallel run | Low | Slowest | Instant | Safety-critical features |
| Feature flag | Medium | Medium | Per flag | Experimentation culture |

> **Think**: A 200k LOC e-commerce app with 100+ reducers. Which strategy? What's the first module you migrate?
>
> *Answer: Strangler fig + module-by-module combination. First module: smallest independent feature (e.g., theme toggle, notification preferences). Low risk, teaches team the pattern, builds confidence. Never start with auth or checkout.*

### useReducer → Zustand: Extract Reducer Logic into Store Actions

Pattern is mechanical. Each reducer case becomes a store method:

**Before (useReducer)**:
```typescript
// reducer.ts
type Action =
  | { type: 'increment'; payload: number }
  | { type: 'decrement'; payload: number }
  | { type: 'reset' }

function counterReducer(state: CounterState, action: Action): CounterState {
  switch (action.type) {
    case 'increment':
      return { ...state, count: state.count + action.payload }
    case 'decrement':
      return { ...state, count: state.count - action.payload }
    case 'reset':
      return { ...state, count: 0 }
    default:
      return state
  }
}

// Component
function Counter() {
  const [state, dispatch] = useReducer(counterReducer, initialState)
  return <button onClick={() => dispatch({ type: 'increment', payload: 1 })}>
    {state.count}
  </button>
}
```

**After (Zustand)**:
```typescript
import { create } from 'zustand'

interface CounterStore {
  count: number
  increment: (by: number) => void
  decrement: (by: number) => void
  reset: () => void
}

const useCounterStore = create<CounterStore>((set) => ({
  count: 0,
  increment: (by) => set((state) => ({ count: state.count + by })),
  decrement: (by) => set((state) => ({ count: state.count - by })),
  reset: () => set({ count: 0 }),
}))

// Component
function Counter() {
  const count = useCounterStore((s) => s.count)
  const increment = useCounterStore((s) => s.increment)
  return <button onClick={() => increment(1)}>{count}</button>
}
```

**Migration steps:**
1. Create Zustand store file with same initial state
2. Convert each reducer case into store method using `set()`
3. Remove action type definitions
4. Update component: `dispatch({ type: 'increment', payload: 1 })` → `store.increment(1)`
5. Remove reducer file and `useReducer` import

**For useReducer + Context** (Redux-lite pattern):
1. Create Zustand store mirroring context state + actions
2. Replace each `useContext(MyContext)` with `useMyStore(selector)` — one component at a time
3. Remove `MyContext.Provider` from tree once no consumers remain
4. Delete context definition file

> **Think**: A reducer handles 30 action types for a complex dashboard. Each case has 5-15 lines. Migration scales linearly per action — yes or no?
>
> *Answer: Yes. Each case becomes one store method. Method body is smaller (no action type extraction, no switch wrapper). Migration is mechanical — same logic, different container. Automation: ts-morph codemod can read reducer switch and emit Zustand store methods for 80% of cases.*

### Context → Zustand: Replace Provider + useContext with useStore

Context replacement is the highest-impact migration per line changed. Eliminates provider wrapping and re-render cascades.

**Before (Context)**:
```typescript
const AuthContext = createContext<Auth | null>(null)

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const login = async (email: string, pw: string) => {
    const res = await api.login(email, pw)
    setUser(res.user)
  }
  const logout = () => setUser(null)
  const value = useMemo(() => ({ user, login, logout }), [user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
```

**After (Zustand)**:
```typescript
import { create } from 'zustand'

interface AuthStore {
  user: User | null
  login: (email: string, pw: string) => Promise<void>
  logout: () => void
}

const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  login: async (email, pw) => {
    const res = await api.login(email, pw)
    set({ user: res.user })
  },
  logout: () => set({ user: null }),
}))

// Component
function Avatar() {
  const user = useAuthStore((s) => s.user) // re-renders only on user change
  if (!user) return <LoginButton />
  return <img src={user.avatar} />
}
```

**Migration algorithm:**
1. Create Zustand store with same state + actions as context
2. Replace `useContext + useMemo` with `useStore(selector)` in each consumer — one component at a time
3. Remove `Provider` wrapper from tree once all consumers migrated
4. Delete context definition

**Prevent divergence**: during migration, a component must not use both `useContext(AuthContext)` and `useAuthStore()`. Values diverge. Solution: hydrate Zustand store from context on init, or enforce lint rule banning old context hook.

> **Think**: Context provides 10 values. Component A reads 2, component B reads 8. After migration, how do component tests change?
>
> *Answer: Context tests need `<AuthProvider><ComponentA /></AuthProvider>`. Zustand tests: `useAuthStore.setState({ user: testUser }); render(<ComponentA />)`. No wrapper. Faster setup, less nesting, clearer intent.*

### Redux Toolkit → Zustand: Slice to Store, createAsyncThunk to Async Actions

Redux Toolkit patterns map directly. The reducer cases, actions, and thunks each have Zustand equivalents.

**Slice → Store:**

| Redux Toolkit | Zustand |
|---------------|---------|
| `createSlice({ name, initialState, reducers })` | `create<Store>()((set) => ({ ...state, ...actions }))` |
| `configureStore({ reducer })` | Single `create()` call |
| `<Provider store={store}>` | No provider |
| `useSelector(selector)` | `useStore(selector)` |
| `useDispatch()` | `store.action()` or `getState().action()` |

**Before (RTK slice)**:
```typescript
const todosSlice = createSlice({
  name: 'todos',
  initialState: { items: [] as Todo[], loading: false },
  reducers: {
    addTodo: (state, action: PayloadAction<Todo>) => {
      state.items.push(action.payload)
    },
    removeTodo: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(t => t.id !== action.payload)
    },
  },
})

const store = configureStore({
  reducer: { todos: todosSlice.reducer, auth: authSlice.reducer },
})
```

**After (Zustand)**:
```typescript
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface TodosStore {
  items: Todo[]
  loading: boolean
  addTodo: (todo: Todo) => void
  removeTodo: (id: string) => void
}

const useTodosStore = create<TodosStore>()(
  devtools(
    (set) => ({
      items: [],
      loading: false,
      addTodo: (todo) => set((state) => ({
        items: [...state.items, todo],
      }), false, 'todos/addTodo'),
      removeTodo: (id) => set((state) => ({
        items: state.items.filter(t => t.id !== id),
      }), false, 'todos/removeTodo'),
    }),
    { name: 'todos-store' }
  )
)
```

**createAsyncThunk → async action:**

**Before (RTK thunk)**:
```typescript
const fetchTodos = createAsyncThunk(
  'todos/fetch',
  async (userId: string) => {
    const res = await api.get(`/users/${userId}/todos`)
    return res.data
  }
)

// Handled in extraReducers:
// pending → loading=true
// fulfilled → items=payload, loading=false
// rejected → error=payload, loading=false
```

**After (Zustand async action)**:
```typescript
interface TodosStore {
  items: Todo[]
  loading: boolean
  error: string | null
  fetchTodos: (userId: string) => Promise<void>
}

const useTodosStore = create<TodosStore>()(
  devtools(
    (set) => ({
      items: [],
      loading: false,
      error: null,
      fetchTodos: async (userId) => {
        set({ loading: true, error: null }, false, 'todos/fetch/pending')
        try {
          const res = await api.get(`/users/${userId}/todos`)
          set({ items: res.data, loading: false }, false, 'todos/fetch/fulfilled')
        } catch (err) {
          set({ error: (err as Error).message, loading: false }, false, 'todos/fetch/rejected')
        }
      },
    }),
    { name: 'todos-store' }
  )
)
```

The thunk lifecycle (pending/fulfilled/rejected) is explicit in the action body. Redux Toolkit's `createAsyncThunk` auto-generates these states; Zustand requires manual `set()` calls. The tradeoff: less magic, more control.

**Multi-slice store**:
```typescript
// RTK: configureStore({ reducer: { todos, auth, cart } })
// Zustand: separate stores, or one store with slice pattern
const useTodosStore = create<TodosStore>(...)
const useAuthStore = create<AuthStore>(...)
const useCartStore = create<CartStore>(...)
```

Separate stores are idiomatic Zustand. No `combineReducers`. No root reducer. Each store is independent module.

> **Think**: RTK slice has 4 reducers and 2 createAsyncThunks. What is the LOC reduction migrating to Zustand?
>
> *Answer: RTK: ~80 lines (slice + thunks + types). Zustand: ~45 lines (store + types). Reduction: ~44%. No configureStore. No Provider. No slice. No extraReducers thunk wiring.*

### Coexistence: Running Old + New During Migration

Two systems operate alongside each other for weeks or months. Coexistence must be explicit, not accidental.

**Strategy 1: Separate domains, no overlap**

Clear boundary: Feature A → Zustand. Feature B → Redux. Both never touch same state slice. Simplest approach. Works when domain decomposition is clean.

**Strategy 2: Shared state bridge**

One state slice must be read by both systems (e.g., auth token). Bridge via subscription:

```typescript
// Zustand store subscribes to Redux store changes
import { store as reduxStore } from './redux-store'
import { useAuthStore } from './zustand-auth-store'

reduxStore.subscribe(() => {
  const reduxAuth = reduxStore.getState().auth
  const zustandAuth = useAuthStore.getState()
  if (reduxAuth.token !== zustandAuth.token) {
    useAuthStore.setState({ token: reduxAuth.token })
  }
})
```

**Strategy 3: Facade layer**

Abstraction over state management implementation. Components talk to facade, not to Redux or Zustand directly:

```typescript
// Before: components import Redux hooks directly
// After: components import from facade
class AuthGateway {
  async login(email: string, pw: string): Promise<User> {
    if (migrationFlags.auth === 'redux') {
      return reduxLogin(email, pw)
    }
    return useAuthStore.getState().login(email, pw)
  }
}
```

Facade pattern lets you flip the switch per module without changing component code.

**Strategy 4: Dual-write with compare**

Both stores process every action. Compare outputs. Log divergence:

```typescript
function dualWrite(action: TodoAction) {
  reduxStore.dispatch(action)
  useTodosStore.getState().dispatch(action)

  const reduxTodos = reduxStore.getState().todos.items
  const zustandTodos = useTodosStore.getState().items
  if (JSON.stringify(reduxTodos) !== JSON.stringify(zustandTodos)) {
    console.error('DIVERGENCE:', { action, reduxTodos, zustandTodos })
  }
}
```

Dual-write builds confidence before cutting over. Use in staging environment.

> **Think**: Dual-write detects divergence. What causes it? How do you fix?
>
> *Answer: Divergence sources: (1) reducer logic difference — RTK Immer mutations vs Zustand manual spreads produce different results for edge cases (nested undefined, array mutations). (2) Timing — async thunk vs async action resolve order differs. (3) Middleware — Redux middleware transforms actions before reducer; Zustand has no middleware pipeline. Fix: unit-test both reducers with same inputs, align implementation.*

### Wrapping Legacy Patterns in Zustand: Adapter Layer

Some patterns are deeply embedded: redux-saga watchers, reselect memoized selectors, normalized state via `createEntityAdapter`. Adapter layer preserves these while living inside Zustand.

**Saga-like effect in Zustand**:
```typescript
// Old: saga watches 'todos/add', then triggers notification saga
// New: effect function called after action
interface TodosStore {
  items: Todo[]
  addTodo: (todo: Todo) => void
}

const useTodosStore = create<TodosStore>((set, get) => ({
  items: [],
  addTodo: (todo) => {
    set((state) => ({ items: [...state.items, todo] }))
    // Effect orchestration — side effect after state update
    if (todo.priority === 'high') {
      notificationService.sendAlert(todo)
    }
  },
}))
```

**Reselect → derived value**:
```typescript
// Old: createSelector([selectTodos, selectFilter], (todos, filter) => ...)
// New: computed value inside store or via useMemo in component

// Option 1: Store-level derived value
interface TodosStore {
  items: Todo[]
  filter: string
  visibleTodos: () => Todo[]
}

const useTodosStore = create<TodosStore>((set, get) => ({
  items: [],
  filter: 'all',
  visibleTodos: () => {
    const { items, filter } = get()
    if (filter === 'done') return items.filter(t => t.done)
    if (filter === 'active') return items.filter(t => !t.done)
    return items
  },
}))

// Option 2: useMemo in component
function TodoList() {
  const items = useTodosStore((s) => s.items)
  const filter = useTodosStore((s) => s.filter)
  const visible = useMemo(() => {
    if (filter === 'done') return items.filter(t => t.done)
    return items
  }, [items, filter])
  return <ul>{visible.map(t => <li key={t.id}>{t.text}</li>)}</ul>
}
```

**createEntityAdapter → indexed store**:
```typescript
// Old: normalized state with ids + entities + CRUD selectors
// New: Zustand with manual normalized shape

interface NormalizedStore {
  entities: Record<string, Todo>
  ids: string[]
  addOne: (entity: Todo) => void
  updateOne: (id: string, changes: Partial<Todo>) => void
  removeOne: (id: string) => void
  selectById: (id: string) => Todo | undefined
  selectIds: () => string[]
}

const useTodosStore = create<NormalizedStore>((set, get) => ({
  entities: {},
  ids: [],
  addOne: (entity) => set((state) => ({
    entities: { ...state.entities, [entity.id]: entity },
    ids: state.ids.includes(entity.id) ? state.ids : [...state.ids, entity.id],
  })),
  updateOne: (id, changes) => set((state) => ({
    entities: {
      ...state.entities,
      [id]: { ...state.entities[id], ...changes },
    },
  })),
  removeOne: (id) => {
    const { [id]: _, ...rest } = get().entities
    set({ entities: rest, ids: get().ids.filter(i => i !== id) })
  },
  selectById: (id) => get().entities[id],
  selectIds: () => get().ids,
}))
```

No built-in entity adapter in Zustand. The pattern is 20 lines — less than importing `@reduxjs/toolkit` + `createEntityAdapter` + selectors.

> **Think**: A sagas-heavy codebase with 10 watchers. How do you migrate sagas to Zustand without rewriting business logic?
>
> *Answer: Extract saga business logic into standalone async functions. Sagas call these functions after taking actions. Zustand action methods call these functions directly. The saga orchestrator (take, fork, cancel) is replaced with function calls inside store methods. Saga cancellation (takeLatest) becomes abort controller pattern. Saga race becomes Promise.race.*

### Testing During Migration: Dual Tests for Old and New

Migration requires two test strategies: (1) unit tests for migrated stores to verify logic parity, and (2) integration tests to ensure old + new systems coexist without interference.

**Parity test: same inputs, same outputs**:
```typescript
describe('migration parity: todos', () => {
  it('addTodo produces same state in Redux and Zustand', () => {
    // Redux
    const reduxStore = configureStore({ reducer: { todos: todosReducer } })
    reduxStore.dispatch(todosSlice.actions.addTodo({ id: '1', text: 'test', done: false }))
    const reduxState = reduxStore.getState().todos

    // Zustand
    useTodosStore.setState({ items: [], loading: false })
    useTodosStore.getState().addTodo({ id: '1', text: 'test', done: false })
    const zustandState = useTodosStore.getState()

    expect(zustandState.items).toEqual(reduxState.items)
  })
})
```

**Coexistence test: no cross-contamination**:
```typescript
describe('coexistence', () => {
  it('Zustand auth store does not affect Redux todos', () => {
    useAuthStore.setState({ user: { name: 'Alice' } })
    const reduxTodos = reduxStore.getState().todos
    expect(reduxTodos).toBeDefined()
    // Verify Zustand mutation did not accidentally touch Redux state
    // (This would fail if stores are incorrectly bridged)
  })
})
```

**Performance regression test: re-render count**:
```typescript
// Measure re-render count before and after migration
// Use React profiler or custom tracking
test('component re-renders not increased after migration', () => {
  const renderCount = { current: 0 }
  const Original = renderCount => {
    renderCount.current++
    // ...
  }
  // ... measure before migration (Context) vs after (Zustand)
})
```

**Test migration safety rule**: every test from old system must have equivalent in new system before cutover. Use test matrix:

| Test type | Old system | New system | Parity required |
|-----------|------------|------------|-----------------|
| Reducer unit | ✓ | ✓ | Same test inputs, same outputs |
| Store integration | ✓ | ✓ | Same action sequence, same state |
| Component render | ✓ | ✓ | Same output for same state |
| Performance | ✓ | ✓ | Re-render count ≤ old system |
| Coexistence | - | ✓ | No cross-contamination |

> **Think**: You have 200 reducer tests in Redux. How many should you write for Zustand?
>
> *Answer: 200 parity tests — one per existing test. But these are mechanical: same input, different API call (reduxStore.dispatch → zustandStore.getState().action). Can be generated by iterating over action fixtures. After parity confirmed, reduce to 50 meaningful integration tests. The rest are redundant when logic is identical.*

### Performance Comparison: Before and After Migration

Migration should improve performance, not regress it. Measure before starting.

**Metrics to track**:

| Metric | How to measure | Migration target |
|--------|----------------|------------------|
| Re-render count | React DevTools Profiler | ≤50% of old system |
| Render time | `performance.mark()` | ≤80% of old system |
| Provider mount cost | `<Profiler>` on root | Eliminated (0) |
| Memory usage | Chrome heap snapshot | Equal or better |
| Bundle size | `npx source-map-explorer` | -10KB+ (Redux 12KB) |

**Before migration baseline**:
```typescript
// Use React Profiler to record
// <Profiler id="app" onRender={(id, phase, actualDuration) => {}}>
// Measure: component re-renders on single state update
```

**After migration measurement**:
```typescript
// Same Profiler setup, same scenario
// Expected: re-renders drop from N to M (N=all context consumers, M=only subscribed selectors)
```

**Typical results**:

| Scenario | Context (re-renders) | Zustand (re-renders) | Improvement |
|----------|----------------------|----------------------|-------------|
| Single field change, 5 consumers | 5 | 1 | 5x |
| Dashboard update, 50 consumers | 50 | 8 | 6.25x |
| Theme toggle (1 consumer) | All consumers | 1 | N consumers |
| Form field update (20 fields) | 20 | 1 | 20x |

**Bundle size comparison**:

| Package | Size (min+gzip) |
|---------|-----------------|
| Redux | 2.5KB |
| React-Redux | 4.5KB |
| @reduxjs/toolkit | 11.5KB |
| **Total RTK** | ~18.5KB |
| Zustand | 1.1KB |
| Zustand + Immer | ~13KB (optional) |

Removing Redux saves ~17KB minimum. For mobile web, this is meaningful (10% of typical JS bundle).

> **Think**: A team says "migration is not worth it — re-renders are not our bottleneck." How do you validate?
>
> *Answer: Profile before arguing. If re-render count is low (<5 per user interaction) and frame rate is 60fps, migration priority is low. But also measure: (1) provider nesting depth — is developer experience suffering? (2) new feature velocity — are context limitations slowing devs? (3) bundle size — is Redux consuming meaningful mobile budget? Performance alone is rarely the only driver.*

### Team Adoption: Naming Conventions, Patterns Guide, Code Review Checklist

Migration fails without team alignment. Technical migration is easy; human migration is hard.

**Naming conventions**:

```
// Store files
stores/auth-store.ts          // PascalCase, -store suffix
stores/todos-store.ts
stores/cart-store.ts

// Store hooks (exported)
useAuthStore                  // use + PascalCase + Store
useTodosStore
useCartStore

// Store methods (actions)
login, logout                 // verbs, not dispatch({ type: 'auth/login' })
addTodo, removeTodo           // verb + noun, no action type strings
fetchTodos                    // async prefix for API calls

// Selectors (custom, non-trivial)
useAuthStore((s) => s.user)   // inline for simple selectors
createSelector for memoized   // only if computation-heavy
```

**Patterns guide** (one-pager for team reference):

```
ZUSTAND PATTERNS GUIDE
======================

1. One store per domain (auth, todos, cart, settings)
   NOT: one giant store

2. Actions are methods, not dispatched objects
   CORRECT: store.addTodo(todo)
   WRONG: store.dispatch({ type: 'ADD_TODO', payload: todo })

3. Selectors for granular subscriptions
   CORRECT: useStore((s) => s.user.name)
   WRONG: const { user } = useStore()  // full store subscription

4. Async actions are async methods
   CORRECT: store.fetchTodos()
   WRONG: custom middleware, thunks, sagas

5. Middleware used explicitly
   devtools for development
   persist for localStorage
   immer for deep state

6. Reset state on test setup
   beforeEach: useStore.setState(initialState)
```

**Code review checklist**:

```
MIGRATION CODE REVIEW
=====================
□ Store does not import from old state management
□ Actions are methods, not dispatch payloads
□ Selectors use granular subscription, not full store
□ Async actions handle pending/fulfilled/rejected explicitly
□ Devtools middleware present (development only)
□ No mixed patterns: old and new state not accessed in same component
□ Tests for parity (old → new)
□ Performance baseline recorded before migration
□ Feature flag or migration switch available
□ Old provider/reducer removed after all consumers migrated
```

> **Think**: A senior dev insists on keeping Redux action types inside Zustand (dispatch method with switch). How do you handle this in code review?
>
> *Answer: Discuss tradeoff. Action types inside Zustand add ceremony but may be bridge for Redux veterans. Accept for first module, but document as transitional pattern. After team is comfortable, refactor to method-based actions. Pragmatic compromise: "Keep dispatch pattern for now. In 2 weeks, we ship a refactor sprint to convert to methods."*

### Real Case Study: Migrating 50k LOC App from Redux to Zustand

Based on real migration of a SaaS dashboard application.

**Background**: B2B analytics dashboard. 50k LOC TypeScript. 35 Redux slices. 12 sagas. 8 Context providers. 4-person frontend team. Growing performance complaints (re-renders on data refresh). Feature velocity declining (every new feature requires slice + saga + selector).

**Decision to migrate**: Not for performance alone. Primary driver: developer experience. Secondary: bundle size (targeting mobile web). Third: context re-renders visible on slower machines.

**Strategy**: Strangler fig + module-by-module. One store per domain. No shared bridge — domains are independent.

**Timeline**:

| Phase | Duration | Work |
|-------|----------|------|
| 0 | 1 week | Setup: stores structure, patterns guide, test utilities, performance baseline |
| 1 | 3 weeks | Low-risk modules: theme, sidebar, notifications settings |
| 2 | 4 weeks | Medium complexity: user preferences, dashboard layout, filtering |
| 3 | 6 weeks | High complexity: auth (picked last because every component reads auth) |
| 4 | 2 weeks | Cleanup: remove Redux deps, delete old code, final performance measurement |

**Migration per module** (example: notifications):

```
Day 1:  Create stores/notifications-store.ts → 30 LOC
Day 1:  Add parity tests → 3 test cases
Day 2:  Replace useContext in 5 components → 1 component per PR
Day 3:  Add feature flag (old/new toggle)
Day 4:  Dual-write in staging — monitor for 48 hours
Day 5:  Cut over: flip flag to "zustand" for 10% → 50% → 100% over 3 days
Day 6:  Remove old Context provider + reducer
Day 7:  Delete parity tests (redundant), clean up flag
```

**Problems encountered**:

1. **Auth was not independent**: every Redux slice imported root state for auth token. Solution: Zustand auth store exposed token via `getState()`. Other stores read it as needed. No provider wrapping — just `useAuthStore((s) => s.token)`.

2. **Saga orchestration**: 12 sagas for side effects (notification after todo add, analytics on page change, WebSocket reconnect). Solution: extracted saga logic into standalone functions. Store methods call these functions directly. Saga cancellation (takeLatest on debounced search): converted to `AbortController` inside search action.

3. **Inconsistent state shape**: Redux normalized entities via `createEntityAdapter`. Zustand used flat arrays. Phase 3 migration required data migration from normalized to denormalized. Solution: adapter function that transforms Redux slice state to Zustand store initial state. Run once at migration cutover.

4. **Testing overhead**: 200 Redux reducer tests. Migration created 200 parity tests. After parity confirmed, team realized 150 tests were redundant — same logic, different API. Solution: delete parity tests after confidence threshold (2 weeks without divergence).

**Results after 16 weeks**:

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Bundle size | 285KB JS | 268KB JS | -17KB |
| Re-renders on data refresh | 47 components | 9 components | -81% |
| Provider nesting | 8 levels | 0 levels | -100% |
| New feature LOC | ~200 avg | ~120 avg | -40% |
| Test setup time (Context wrapping) | 30s per test file | 0s | Eliminated |
| P95 render time (data refresh) | 120ms | 45ms | -62.5% |

**Team feedback**: "Migration was painful in weeks 1-2 while learning Zustand patterns. By week 3, velocity increased. By week 8, no one misses Redux. New features ship faster because we write less code."

> **Think**: The case study shows 16 weeks for 50k LOC. Your app is 25k LOC. How long should you budget?
>
> *Answer: Not linear. ~8 weeks baseline + 2 weeks per complexity factor (if sagas + entity adapter + deep Context nesting). Budget 10-12 weeks. First module takes 2x longer than estimated. Schedule buffer: 30%. Aggregate: ~14 weeks for 25k LOC with moderate complexity.*

---

### Why This Matters

Migration from legacy state management to Zustand is not an academic exercise. Teams spend months wrestling with Context re-renders, Redux boilerplate, and sagas that obscure data flow. The cost is not just performance — it is developer velocity, onboarding time, and bug rates tied to complex state patterns. Incremental migration is the only safe path. The patterns in this module (coexistence, adapter layer, parity testing, feature flags) apply to any state management migration, not just Zustand. Teams that master incremental migration can upgrade state management without freezing feature development. This skill separates teams that are stuck on old patterns from teams that evolve their architecture continuously.

---

### Common Questions

**Q: What if we fail halfway through migration? Can we revert?**
A: Yes, if you use feature flags and module-by-module strategy. Flip flag to "redux" — old system resumes. Divergence risk: if Zustand store mutated state that Redux also manages, flipping back may leave dangling Zustand state. Solution: scope migration so each flag covers one independent domain. Reverting auth flag does not affect todos store.

**Q: Should we migrate tests first or store first?**
A: Store first, then parity tests, then component tests. Store migration is mechanical (reducer case → method). Parity tests validate correctness. Component tests confirm the UI works with new store. If you write component tests first, they depend on old API and you rewrite them anyway.

**Q: Does Zustand work with Next.js App Router?**
A: Yes, with caution. Zustand stores must be declared inside `'use client'` boundaries. Each page request on server creates fresh store. Pattern: `createStore` from `zustand/vanilla` for SSR-safe stores, wrap in client component. Do not use Zustand stores in Server Components — they are client-only.

**Q: How do we migrate normalized state (createEntityAdapter) to Zustand?**
A: Manual normalized store (entities + ids + CRUD methods) or use `valtio`/`proxy` for path-based mutations. Zustand has no built-in entity adapter. Write ~30 LOC of helper functions for addOne, updateOne, removeOne. The lack of built-in adapter is intentional — most apps do not need normalized state after moving to Zustand because selector granularity reduces the performance motivation for normalization.

**Q: What about Redux DevTools — do we lose time-travel debugging?**
A: No. Zustand's `devtools` middleware integrates with Redux DevTools extension. Named `set()` calls appear in timeline. Jump-to-state works. Time-travel rewind works. The only missing feature is action stack dispatch — Redux DevTools can re-dispatch a sequence of past actions; Zustand devtools replays snapshot, not action sequence. Practical difference: minimal.

---

## Examples

### Example 1: Migrating useReducer + Context (Todo App)

**Problem**: 30-component todo app using useReducer + Context. Performance complaints: toggling one todo re-renders entire list + sidebar (count summary).

**Migration**:

Step 1: Create Zustand store
```typescript
interface TodoStore {
  todos: Todo[]
  addTodo: (text: string) => void
  toggleTodo: (id: string) => void
  removeTodo: (id: string) => void
}

const useTodoStore = create<TodoStore>((set) => ({
  todos: [],
  addTodo: (text) => set((state) => ({
    todos: [...state.todos, { id: crypto.randomUUID(), text, done: false }],
  })),
  toggleTodo: (id) => set((state) => ({
    todos: state.todos.map(t => t.id === id ? { ...t, done: !t.done } : t),
  })),
  removeTodo: (id) => set((state) => ({
    todos: state.todos.filter(t => t.id !== id),
  })),
}))
```

Step 2: Migrate components one by one
```typescript
// Before
function TodoItem({ id }: { id: string }) {
  const { state, dispatch } = useTodoContext()
  const todo = state.todos.find(t => t.id === id)
  return (
    <li onClick={() => dispatch({ type: 'TOGGLE_TODO', payload: id })}>
      {todo?.text}
    </li>
  )
}

// After
function TodoItem({ id }: { id: string }) {
  const todo = useTodoStore((s) => s.todos.find(t => t.id === id))
  const toggleTodo = useTodoStore((s) => s.toggleTodo)
  return <li onClick={() => toggleTodo(id)}>{todo?.text}</li>
}
```

Step 3: Remove Context provider after last consumer migrated.

**Result**: Toggling todo re-renders only the toggled `<li>` + count display (subscribes to `(s) => s.todos.length`). Previously 30+ components re-rendered. User-visible jank eliminated.

### Example 2: Migrating Redux Toolkit (Dashboard with Async Thunks)

**Problem**: Dashboard with 10 RTK slices, 5 async thunks. Data refresh re-renders entire dashboard. Team wants to remove Redux dependency.

**Migration plan**:

```typescript
// Step 1: Create Zustand store per domain
// dashboard-store.ts
interface DashboardStore {
  metrics: MetricsData
  loading: boolean
  error: string | null
  fetchMetrics: (userId: string) => Promise<void>
  updateFilter: (filter: Filter) => void
}

const useDashboardStore = create<DashboardStore>()(
  devtools(
    (set) => ({
      metrics: { revenue: 0, users: 0, sessions: 0 },
      loading: false,
      error: null,
      fetchMetrics: async (userId) => {
        set({ loading: true, error: null }, false, 'dashboard/fetch/pending')
        try {
          const res = await api.get(`/dashboard/${userId}`)
          set({ metrics: res.data, loading: false }, false, 'dashboard/fetch/fulfilled')
        } catch (err) {
          set({ error: (err as Error).message, loading: false }, false, 'dashboard/fetch/rejected')
        }
      },
      updateFilter: (filter) => set({ filter }, false, 'dashboard/updateFilter'),
    }),
    { name: 'dashboard' }
  )
)

// Step 2: Add feature flag
const useDashboard = () => {
  if (featureFlags.dashboard === 'zustand') {
    return useDashboardStore()
  }
  return useReduxDashboard() // existing useSelector hooks
}

// Step 3: Migrate each dashboard widget component
function RevenueChart() {
  const metrics = useDashboardStore((s) => s.metrics) // only re-renders on metrics change
  const loading = useDashboardStore((s) => s.loading)
  // ...
}

function FilterPanel() {
  const updateFilter = useDashboardStore((s) => s.updateFilter)
  // never re-renders when metrics update
  // because updateFilter reference is stable
}
```

**Result**: Data refresh re-renders RevenueChart and widgets that read metrics. FilterPanel (reads only updateFilter) does not re-render. Previously: data refresh → re-render all components. Now: targeted re-renders per selector.

### Example 3: Adapter Layer for Third-Party Integration

**Problem**: App uses `react-query` for server state + Redux for client state. Migrating Redux to Zustand, but react-query integration remains.

**Solution**: Adapter store that bridges react-query cache to Zustand:

```typescript
// bridge-store.ts
import { useQueryClient } from '@tanstack/react-query'
import { create } from 'zustand'

interface BridgeStore {
  syncQueryToStore: (queryKey: string[], store: any, selector: string) => void
}

const useBridgeStore = create<BridgeStore>(() => ({
  syncQueryToStore: (queryKey, store, selector) => {
    const queryClient = useQueryClient()
    const data = queryClient.getQueryData(queryKey)
    if (data) {
      store.setState({ [selector]: data })
    }
    // Optionally subscribe to query changes
  },
}))

// Usage in component:
function UserProfile() {
  const { data } = useQuery(['user', userId])
  // data is in react-query cache
  // If another component needs user data via Zustand, bridge it
  // But prefer: read from react-query directly, skip Zustand bridge
}
```

**Rule**: Do not bridge state unless two systems genuinely need to share it. Bridge creates coupling between two state management systems. Prefer: each system owns its domain. Bridge only cross-cutting concerns (auth tokens, user session).

---

## Key Takeaways
- Incremental migration beats big bang: strangler fig pattern, one module at a time, feature flags for rollback
- useReducer → Zustand: each reducer case becomes a store method, dispatch call becomes method call
- Context → Zustand: eliminate provider tree, replace useContext with useStore(selector)
- Redux Toolkit → Zustand: slice to store, createAsyncThunk to async action with explicit pending/fulfilled/rejected
- Coexistence during migration: separate domains no overlap, optional bridge for shared state via subscription
- Adapter layer for legacy patterns: saga orchestration → async actions, reselect → derived values, entity adapter → manual normalized store
- Dual test strategy: parity tests (same inputs, same outputs) + coexistence tests (no cross-contamination)
- Performance baseline before migration: re-render count, render time, provider mount cost, bundle size
- Team adoption: naming conventions, one-page patterns guide, code review checklist, accept transitional patterns
- Real case study: 50k LOC, 16 weeks, -81% re-renders, -17KB bundle, -40% new feature LOC, +100% developer velocity

## Common Misconception

**"Migration to Zustand means rewriting all state logic from scratch."**

Zustand is not a different paradigm. It is the same state management concepts (state, actions, selectors, subscriptions) with less ceremony. Reducer logic ports directly: each reducer case becomes one store method. Action dispatch becomes method call. createAsyncThunk becomes async action with explicit lifecycle states. Provider nesting becomes provider-free store access. The logic — what state changes when — stays identical. Only the scaffolding changes. A team that understands this can migrate a production Redux slice in 15 minutes, not 15 days. The common mistake is treating migration as an opportunity to redesign state architecture. Do not do this. Migrate the logic as-is. Improve architecture after migration is complete.

---

## Feynman Explain
(Explain incremental migration to a junior developer who knows Redux but has never planned a migration. Use a building renovation analogy: you do not demolish the whole house to add a new kitchen. You build the new kitchen alongside the old one. When it is ready, you cut over. If the new kitchen has problems, you still have the old kitchen. The house never becomes uninhabitable. The same principle applies to state management migration — never leave the building uninhabitable.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain zustand-state-management` — AI probes gaps.*

---

## Reframe
(Pause. Critique: Is incremental migration always the right choice? When does the friction of maintaining two state management systems outweigh the risk of a big bang? Consider: small codebase (<5k LOC), 2-person team, tight deadline. Is incremental migration worth the overhead of coexistence code, parity tests, and feature flags? Write your evaluation. Also consider: what if the team plans to migrate away from Redux in 6 months anyway — does that change the calculus?)

---

## Drill
Take the quiz. MCQs test migration strategies, pattern mapping (useReducer → Zustand, Context → Zustand, RTK → Zustand), coexistence mechanisms, parity testing approach, and team adoption decisions.

Run: `learn.sh quiz zustand-state-management 19-migration`

## Quiz: 19-migration


### What is the single largest cause of state management migration failure?

- [ ] A: Wrong choice of state management library

- [✓] B: Big bang rewrite

- [ ] C: Insufficient test coverage

- [ ] D: Team resistance to change


**Answer:** B

Big bang rewrites create risk proportional to codebase size. Testing impossible. Rollback impossible. Incremental migration (strangler fig, module-by-module) limits risk per step.


### Which migration strategy lets you toggle between old and new implementation per feature?

- [ ] A: Module-by-module

- [ ] B: Strangler fig

- [✓] C: Feature flag

- [ ] D: Parallel run


**Answer:** C

Feature flags wrap old and new implementations behind a boolean. Flip flag to switch per feature. Rollback flips flag back. Replaces code at runtime, not at deployment.


### When migrating useReducer to Zustand, what does each reducer case become?

- [ ] A: A switch statement in a dispatch method

- [ ] B: A separate store

- [✓] C: A store method that calls set()

- [ ] D: An action type constant


**Answer:** C

Each reducer case becomes a store method. The switch statement and action types are replaced by individual functions like addTodo, toggleTodo, removeTodo. The logic stays identical, only the container changes.


### During migration from Context to Zustand, a component accidentally uses both useContext(AuthContext) and useAuthStore(). What problem occurs?

- [ ] A: TypeScript compilation error

- [ ] B: Infinite re-render loop

- [✓] C: State values diverge between the two systems

- [ ] D: Bundle size doubles


**Answer:** C

Context and Zustand store are independent copies. Mutating one does not update the other. A component reading both may see stale data from one system. Prevent with lint rules or by hydrating Zustand store from context on init.


### What is the Zustand equivalent of Redux Toolkit's createAsyncThunk lifecycle (pending/fulfilled/rejected)?

- [ ] A: Extra reducers in createSlice

- [✓] B: Explicit set() calls inside the async action method

- [ ] C: Zustand middleware pipeline

- [ ] D: Auto-generated by the devtools middleware


**Answer:** B

Zustand has no createAsyncThunk. The lifecycle is explicit: set({ loading: true }) before API call, set({ loading: false, data }) on success, set({ loading: false, error }) on failure. More code but more control. Named third parameter to set() enables DevTools tracing per lifecycle phase.


### A team migrates a 50k LOC Redux app module-by-module. What is the recommended first module to migrate?

- [ ] A: Auth — because every component reads it

- [ ] B: Checkout — because it generates revenue

- [✓] C: Smallest independent feature (e.g., theme toggle, notifications)

- [ ] D: The most complex reducer with 30 action types


**Answer:** C

Start small. First module: low risk, teaches team the pattern, builds confidence. Auth is high-risk (every component depends on it). Complex reducers increase migration surface. Theme toggle or notification preferences are independent and safe.


### Dual-write during migration means:

- [ ] A: Writing both unit and integration tests for each store

- [ ] B: Maintaining both old and new documentation

- [✓] C: Processing every action in both old and new stores and comparing outputs

- [ ] D: Assigning two developers to each migration task


**Answer:** C

Dual-write sends the same action to both Redux and Zustand stores, then compares resulting state. Divergence indicates logic mismatch. Used in staging to build confidence before cutover. Not suitable for production due to double-processing overhead.


### A migration currently has both old Redux store and new Zustand store active. Both need to read the user's auth token. What is the recommended approach?

- [ ] A: Duplicate token in both stores, keep them in sync manually

- [✓] B: Create a bridge via Redux store subscription that updates Zustand store

- [ ] C: Make Zustand the single source of truth and deprecate Redux auth immediately

- [ ] D: Wrap all components in a provider that passes token via props


**Answer:** B

Bridge via subscription: Redux store subscribes to changes, Zustand store.setState() on auth token change. This prevents divergence without requiring immediate full migration of auth. Redux remains owner during migration; Zustand is read-only replica.


### After migrating a Redux slice with 200 reducer tests, what is the recommended test strategy?

- [ ] A: Delete all 200 tests — they are covered by the new store

- [✓] B: Write 200 parity tests, confirm logic matches, then reduce to meaningful subset

- [ ] C: Only test components, not stores

- [ ] D: Keep all 200 tests running against both old and new stores permanently


**Answer:** B

Parity tests confirm old and new produce same outputs for same inputs. After confidence builds (2 weeks without divergence), reduce to ~50 meaningful integration tests. Redundant tests are maintenance burden. Deleting without parity validation risks undiscovered logic differences.


### A team maintains two state management systems during migration. Which risk is the code review checklist primarily designed to prevent?

- [ ] A: Performance regression in the new Zustand store

- [✓] B: Mixed patterns — same component accessing both old and new state management

- [ ] C: Missing TypeScript types for the new store

- [ ] D: Inadequate test coverage for new features


**Answer:** B

Mixed patterns (a component using both useContext and useStore) cause state divergence, bugs, and confused developers. Code review checklist explicitly catches this. Other concerns (performance, types, tests) are important but secondary. Mixed access is the most common and dangerous migration bug.


---

# Module 20: Capstone — Architecture Decision Record

Est. study time: 2.5h
Language: en

## Learning Objectives
- Author Architecture Decision Records (ADRs) for state management decisions
- Evaluate state solutions systematically using a decision matrix
- Document store architecture: boundaries, slice ownership, selector API commitments
- Apply ADR review criteria: tradeoff analysis, rollback plan, success metrics

---

## Core Content

### What Is an Architecture Decision Record — Why State Management Needs ADRs

Architecture Decision Record (ADR) is a lightweight document capturing a decision, its context, tradeoffs, and consequences. Originated by Michael Nygard for capturing architecture decisions rather than rediscovering them every 6 months.

State management decisions are prime ADR candidates because:
- **Irreversible**: choosing Context means restructuring component tree. Choosing Zustand means installing dependency. Reversing both costs weeks.
- **Cross-cutting**: store serves 50 components. Wrong boundary infects 50 files.
- **Tribal knowledge dilutes**: team grows, original reasons vanish. Next engineer re-litigates "why Zustand not Context?"
- **Tradeoff heavy**: no universal best. Every choice depends on team size, app type, performance requirements.

```
ADR: State Management Selection
Status: Accepted
Date: 2024-06-15
Deciders: Frontend team (5 engineers)

Context: App needs shared auth state, cart state, UI preferences.
  20 components read each domain.

Decision: Zustand for all three domains (separate stores).

Tradeoffs:
  - Pro: No provider tree. Smaller bundle than Redux.
  - Con: No middleware ecosystem (no saga/thunk).
  - Pro: Simpler mental model — actions are methods.
  - Con: Team must learn new API.

Consequences:
  - Positive: re-renders scoped per selector.
  - Positive: bundle -17KB vs RTK.
  - Negative: team ramp-up ~1 week.
  - Risk: Zustand ecosystem smaller — no entity adapter.
```

> **Think**: A new engineer joins 6 months after Zustand selection. No ADR exists. What happens when they evaluate "should we switch to Redux?"?
>
> *Answer: They spend 2 days re-evaluating tradeoffs your team already worked through. They might reach different conclusion because context changed (team grew, app grew, etc.). Without ADR, they cannot distinguish "we chose this for reasons that still hold" from "we chose this by accident." ADR answers "why" so new context triggers valid re-evaluation, not accidental replay.*

### Evaluating State Solutions: Decision Matrix

Systematic evaluation prevents recency bias ("Jotai is popular, use Jotai"). Matrix across dimensions:

| Criteria | useState | Context | Redux Toolkit | Zustand | Jotai |
|----------|----------|---------|---------------|---------|-------|
| Bundle size | 0KB | 0KB | 18.5KB | 1.1KB | 3.4KB |
| Provider needed | No | Yes | Yes | No | No |
| Re-render control | Manual | All consumers | Selectors | Selectors | Atomic |
| Boilerplate per feature | None | Low | Medium | Low | Low |
| SSR support | Native | Native | With provider | Vanilla API | SSR adapter |
| DevTools | React DevTools | React DevTools | Redux DevTools | Redux DevTools | Custom |
| Middleware ecosystem | None | None | Rich (saga/thunk) | Basic | Minimal |
| Learning curve | None | Low | Medium | Low | Medium |
| Best for | Local state | Low-frequency global | Large teams, complex state | Medium apps, cross-cutting | Atomic derived state |

Criteria weights depend on project. Example weighting:

```
Project: E-commerce dashboard
Weighted score (1-5 each, criteria weighted):
- Bundle size: 4 (mobile users) → Zustand 5, Redux 1
- Re-render control: 5 (performance critical) → Zustand/Redux 4, Context 2
- Learning curve: 4 (team of juniors) → Zustand/Context 5, Redux 2
- Middleware: 2 (simple API calls) → Redux 5, Zustand 3
- DevTools: 3 (debugging helpful) → Redux/Zustand 5

Total: Zustand wins for this project profile.
```

> **Think**: A team of 2 building a prototype with 3 global state values. Redux wins on middleware score (5) but loses on every other dimension. What evaluation mistake happened?
>
> *Answer: No context weighting. Middleware scored high but team of 2 building prototype does not need sagas or thunks. Over-weighting irrelevant criteria skewed result. Score must be multiplied by importance weight derived from project constraints. Without weights, decision matrix is misleading precision.*

### Store Architecture Documentation: Boundaries, Ownership, API

ADR must define **store boundaries** (what goes in which store), **ownership** (which team/module owns each slice), and **selector API** (what external consumers depend on).

**Store boundaries template:**
```
## Store Map
| Store | Domain | Owned by | Consumer count | Data lifetime |
|-------|--------|----------|----------------|---------------|
| auth | Auth, session | Platform team | 45 components | Session |
| cart | Shopping cart | Cart team | 12 components | Browser tab |
| ui | Theme, sidebar, modals | Platform team | 30 components | Device |
| product-filter | Filter, sort, search | Catalog team | 8 components | Page view |
```

**Ownership rules:**
- Single owner per store: one team writes mutations, all teams read
- No cross-store transactions: if Auth store + Cart store must update atomically, architects mixed boundary
- Store file lives in owning team's directory: `src/platform/stores/auth-store.ts`, `src/cart/stores/cart-store.ts`

**Selector API commitment:**
- Public selectors: documented, versioned, tested. Breaking changes require ADR update.
- Private selectors: internal to owning team, may change without notice.
- Shape contract: `useAuthStore((s) => s.user)` — consumer reads `user` shape. If shape changes, all consumers break.

```typescript
// Public API — documented, tested, semver
export const selectUser = (s: AuthStore) => s.user
export const selectIsLoggedIn = (s: AuthStore) => s.user !== null

// Private — internal to auth store, may change
const selectSessionToken = (s: AuthStore) => s.session.token
```

> **Think**: A cart team stores `items: CartItem[]` in their store. Platform team wants to read cart count for a badge. Should Platform team import `selectCartItems` from cart store?
>
> *Answer: Yes, if Cart store exports a public selector `selectCartCount`. No, if Platform team reaches into Cart store's internal `items` shape. The store owner exports only what external consumers need. If Cart team renames `items` to `entries`, Platform teams using `selectCartCount` do not break. Those importing `items` directly do.*

### Performance Decision: Atomic Stores vs Monolithic Store

Central tension: one big store vs many small stores.

**Monolithic store:**
```typescript
// One store for everything
const useAppStore = create<AppStore>((set) => ({
  user: null,
  items: [],
  cart: [],
  theme: 'light',
  sidebarOpen: true,
  notifications: [],
  settings: {},
  // ... grows as app grows
}))
```

- Pros: single `getState()` call, simple import, easy cross-slice reads
- Cons: selector granularity must be precise or whole app re-renders on any change; one Zustand "context" shared implicitly

**Atomic stores (recommended):**
```typescript
// Separate stores per domain
const useAuthStore = create<AuthStore>(...)
const useCartStore = create<CartStore>(...)
const useUIStore = create<UIStore>(...)
```

- Pros: isolated re-renders, clear ownership, independent testing, no accidental cross-slice coupling
- Cons: cross-store reads require importing multiple stores; more files

**Decision matrix:**

| Factor | Monolithic | Atomic |
|--------|-----------|--------|
| Cross-slice reads | Trivial | Multi-import |
| Re-render isolation | Must use fine selectors | Natural per-store boundary |
| Testing | Single store setup | Per-store setup |
| Team ownership | Unclear | Clear per store |
| Refactoring risk | High (touching shared shape) | Low (per-store) |
| Bundle splitting | Hard (single chunk) | Natural (lazy-load stores) |

> **Think**: E-commerce app: auth, cart, product catalog, search, notifications. How many stores? Where is the boundary between "atomic" and "too many stores"?
>
> *Answer: 5 stores — one per domain. Not "too many." Each has clear ownership, independent lifecycle, separate consumers. Too many stores = 50 stores for 50 small pieces where cross-reads are constant. Rule of thumb: if you import 5+ stores in every component, they might be one domain split too thin. Consolidate stores that always read together.*

### Testing Strategy Documentation: What to Test at Store vs Component Level

ADR documents testing boundaries — what each test level validates.

**Store-level tests (unit):**
```typescript
describe('AuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState(initialAuthState)
  })

  it('login sets user', async () => {
    mockApi.login.mockResolvedValue({ user: { id: '1', name: 'Alice' } })
    await useAuthStore.getState().login('alice@example.com', 'pw')
    expect(useAuthStore.getState().user?.name).toBe('Alice')
  })

  it('login sets error on failure', async () => {
    mockApi.login.mockRejectedValue(new Error('Invalid credentials'))
    await useAuthStore.getState().login('bad@example.com', 'pw')
    expect(useAuthStore.getState().error).toBe('Invalid credentials')
  })

  it('logout clears user', () => {
    useAuthStore.setState({ user: { id: '1', name: 'Alice' } })
    useAuthStore.getState().logout()
    expect(useAuthStore.getState().user).toBeNull()
  })
})
```

**What to test at store level:**
- Action logic: does state change correctly?
- Async lifecycle: loading → success/error transitions
- Edge cases: empty state, concurrent actions, error recovery
- Selector output: derived values from store state

**Component-level tests (integration):**
```typescript
it('renders user name from store', () => {
  useAuthStore.setState({ user: { id: '1', name: 'Alice' } })
  render(<UserProfile />)
  expect(screen.getByText('Alice')).toBeInTheDocument()
})

it('dispatches login on button click', async () => {
  render(<LoginForm />)
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } })
  fireEvent.click(screen.getByText('Login'))
  await waitFor(() => {
    expect(mockApi.login).toHaveBeenCalledWith('a@b.com')
  })
})
```

**What to test at component level:**
- Rendering: correct UI for given store state
- Interaction: user action triggers correct store method
- Error display: store error state → error UI
- NOT: store logic itself (tested at store level)

**ADR testing section template:**
```
## Testing Strategy
| Test level | Scope | Files | Run frequency | Owner |
|------------|-------|-------|---------------|-------|
| Store unit | State mutations, action logic | stores/*.test.ts | CI per commit | Store owner |
| Component integration | UI renders from store state | components/*.test.tsx | CI per PR | Component owner |
| E2E | Full user flow (login → cart → checkout) | e2e/*.spec.ts | CI per deployment | QA |
```

> **Think**: A login form test fails. Logout test fails too. Both call `useAuthStore.getState().login()` and `logout()`. Is the bug in the store or the component?
>
> *Answer: Bug is likely in store — both failures involve store actions. If store tests also fail, confirm store logic. If store tests pass but component tests fail, component uses store incorrectly (wrong selector, wrong action called, missing await). Store-level tests isolate the root cause before debugging component interaction.*

### Migration ADR: Documenting Migration Plan, Rollback Criteria, Success Metrics

Migration ADR is specialized template for state management migrations. Structure:

```
ADR: Migrate Cart from Context to Zustand
Status: Draft → Proposed → Accepted → Implemented → Closed

## Context
Cart uses Context with useReducer. 15 components consume cart context.
Re-renders: any cart change re-renders all 15 + parents up to provider.
Performance: cart interaction adds 35ms to frame time.

## Decision
Migrate cart to Zustand. Incremental: one store, module-by-module component migration.

## Migration Plan
| Step | Description | Duration | Risk |
|------|-------------|----------|------|
| 1 | Create Zustand cart store (mirror reducer logic) | 1 day | Low |
| 2 | Add parity tests (same inputs, same outputs) | 1 day | Low |
| 3 | Migrate CartBadge component (reads count) | 2 hours | Low |
| 4 | Migrate CartPage (reads full state) | 4 hours | Medium |
| 5 | Migrate CheckoutButton (writes checkout action) | 2 hours | Medium |
| 6 | Remove Context provider after all consumers migrated | 1 hour | Low |
| 7 | Delete old reducer, context definition, tests | 30 min | None |

## Rollback Criteria
- Re-render count not reduced by 50% after migration of first 3 components
- Any production regression in cart functionality
- Bundle size increases (should decrease by ~2KB)
- Rollback: revert PRs per component, restore Context provider

## Success Metrics
| Metric | Before | Target | Measured after migration |
|--------|--------|--------|--------------------------|
| Re-renders on cart update | 15 components | ≤3 components | 2 components |
| Cart interaction frame time | 35ms | ≤10ms | 8ms |
| Bundle size (cart deps) | ~15KB (Context) | ~1KB (Zustand) | 1.2KB |
| Lines of code (cart state) | 145 LOC | ~70 LOC | 68 LOC |

## Review Notes
- Approved by: Senior frontend engineer, Tech lead
- Concerns addressed: No provider nesting change needed; selector granularity handles re-renders
- Date: 2024-07-10
```

**Rollback criteria** must be objective and pre-agreed. If migration passes metrics, keep. If fails, revert. No "we spent 2 weeks, let's keep it" — that is sunk cost fallacy.

> **Think**: Migration passes 3 of 4 success metrics but misses "re-renders ≤3" (actual: 5). Do you revert?
>
> *Answer: Depends on rollback criteria written in ADR. If criteria says "re-render count not reduced by 50%" — actual is 87% reduction (15 → 5), so criteria passes. If criteria says "≤3" — fails, revert. Ambiguous criteria cause arguments. Write measurable thresholds in ADR before migration starts.*

### Team Conventions ADR: Store Patterns, Naming, File Organization

Team conventions ADR documents shared patterns for consistency across all stores.

```
ADR: Zustand Team Conventions
Status: Accepted

## Store Organization
src/
  stores/
    auth-store.ts
    cart-store.ts
    ui-store.ts
    product-filter-store.ts

File naming: {domain}-store.ts (kebab-case, -store suffix)
One file per store. Max 200 lines per store file.

## Store Definition Pattern
interface AuthStore {
  // State (nouns)
  user: User | null
  loading: boolean
  error: string | null

  // Actions (verbs)
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  clearError: () => void
}

export const useAuthStore = create<AuthStore>()(
  devtools(
    (set) => ({
      user: null,
      loading: false,
      error: null,
      login: async (email, password) => {
        set({ loading: true, error: null })
        try {
          const user = await api.login(email, password)
          set({ user, loading: false })
        } catch (err) {
          set({ error: (err as Error).message, loading: false })
        }
      },
      logout: () => set({ user: null }),
      clearError: () => set({ error: null }),
    }),
    { name: 'auth-store' }
  )
)
```

**Convention rules:**
1. Store files in `src/stores/` directory, one per domain
2. State declared as interface with state fields (nouns) and actions (verbs)
3. Export `use{Name}Store` hook as default consumer API
4. Use `devtools` middleware in development
5. Actions are async methods, not dispatched objects
6. Selectors inline for simple reads, exported for reused logic
7. No cross-store imports inside store files (store reads other store via `get()` from outside)
8. Max 200 lines per store — if exceeds, split domain

> **Think**: A store reaches 250 lines. Developer argues "splitting adds complexity." When do you enforce the 200-line rule?
>
> *Answer: When the store mixes two domains. 250 lines for auth + user preferences: split. 250 lines for complex auth with 5 API endpoints, 3 role types, session management: auth alone is one domain. Consider increasing limit to 300 before split. The line limit exists to force domain decomposition questions, not as rigid cap.*

### Reviewing ADRs: Criteria for Accepting or Rejecting State Architecture Decisions

ADR review process prevents bad decisions from shipping. Standard review criteria:

**Accept criteria (all must pass):**
1. **Context clear**: reader understands problem without prior knowledge
2. **Alternatives considered**: at least 2 alternatives evaluated (not strawman)
3. **Tradeoffs explicit**: both pros and cons listed for chosen option
4. **Consequences stated**: positive and negative outcomes of decision
5. **Rollback plan exists**: conditions under which decision should be reversed
6. **Success metrics defined**: measurable, time-bound
7. **Stakeholders listed**: who was involved, who approves

**Reject reasons (any triggers rejection):**
- Missing alternative: "we chose X because it's what we know" — no comparison
- One-sided tradeoffs: only pros listed, no cons
- Vague metrics: "better performance" without baseline or target
- No rollback: decision treated as permanent with no reversal criteria
- Misunderstood constraint: "bundle size critical" but chosen solution has larger bundle
- Team not consulted: store affects 3 teams, only 1 team wrote decision

**Review template:**
```
ADR Review: [Title]
Reviewer: [Name]
Date: [Date]

□ Context adequate for uninformed reader?
□ Alternatives evaluated (≥2)?
□ Tradeoffs balanced (pros and cons)?
□ Consequences documented?
□ Rollback plan specified?
□ Success metrics measurable?
□ Affected stakeholders reviewed?

Comments:
________________________________________

Verdict: [Accept / Revise / Reject]
```

> **Think**: A junior dev submits ADR choosing Zustand over Redux. ADR has good tradeoffs but mentions no alternatives. Do you reject?
>
> *Answer: Revise, not reject. Ask for Context + Jotai evaluation. ADR framework is teaching tool too. Rejection punishes good effort. Revise instruction: "Add Context and Jotai comparison, even briefly. Helps future readers understand why Zustand, not just that Zustand was chosen."*

### Real Example: ADR for Migrating E-Commerce App from Context to Zustand

Complete ADR for a real scenario:

```
ADR: 007 — Migrate Cart State from React Context to Zustand
Status: Implemented
Date: 2024-08-01
Deciders: Alice (FE lead), Bob (cart team), Carol (platform team)

## Context
Cart feature uses React Context + useReducer. 15 components consume cart context
across header (badge), page (list), and modal (quick add).

Performance problem: adding item to cart re-renders all 15 consumers +
any parent up to provider boundary. Profiler shows 45ms frame time on "add to cart."

Developer experience problem: adding new cart feature requires:
1. New context value + useMemo wrapping
2. New Context.Provider wrapping
3. All consumers re-render regardless of which value changed

## Considered Alternatives

### A. Context + useReducer (current) — Status quo
- Pros: No new dependency, team knows pattern
- Cons: Provider nesting, unnecessary re-renders, new feature overhead
- Cost: $0

### B. Zustand (selected)
- Pros: No provider, granular selectors, 1.1KB bundle, devtools middleware
- Cons: New dependency, team ramp-up
- Cost: 1 week for first store, then per-feature savings

### C. Redux Toolkit
- Pros: Rich ecosystem, sagas for side effects
- Cons: 18.5KB bundle, Provider required, ceremony for small cart domain
- Cost: Overkill for 15-component domain

## Tradeoffs
| Concern | Context | Zustand |
|---------|---------|---------|
| Re-renders per cart action | 15+ | N (subscribed selectors) |
| Bundle impact | 0KB | +1.1KB |
| Team learning | 0 days | ~3 days |
| New cart feature LOC | ~50 lines | ~15 lines |
| Test setup | Provider wrapper | Store.setStore() |

## Consequences
Positive:
- Re-renders drop from 15+ to 1-3 per cart action
- No Provider in component tree
- Cart feature code reduces ~60%
- DevTools timeline visible

Negative:
- Cart team learns new API
- No built-in entity adapter (manual CRUD)

Risks:
- Zustand ecosystem smaller than Redux
- Mitigation: cart is small domain, unlikely to need complex middleware

## Migration Plan
Week 1:
- Create Zustand cart store (mirror reducer)
- Parity tests: 10 test cases comparing old → new outputs
- Feature flag: toggle cart between Context and Zustand

Week 2:
- Migrate CartBadge (1 component, reads count)
- Migrate AddToCartButton (3 components, writes)
- Dual-write in staging for 48h

Week 3:
- Migrate CartPage (full state read/write)
- Cut over: 10% → 50% → 100% over 3 days
- Remove Context provider and reducer

## Rollback Criteria
- Re-renders not reduced by at least 60%
- Any user-facing cart regression
- Bundle size increases more than 2KB
- Rollback: revert PRs, restore Context provider

## Success Metrics
| Metric | Before | Target | Actual (2 weeks post) |
|--------|--------|--------|----------------------|
| Re-renders on add to cart | 15+ components | ≤3 | 2 |
| Frame time (add to cart) | 45ms | ≤15ms | 12ms |
| Bundle size (cart deps) | ~0KB (Context) | ≤2KB | 1.1KB |
| Cart feature LOC | 210 | ≤120 | 85 |
| Test setup time per test | 15s (wrap provider) | ≤1s | 0s |

## Review
- Alice (FE lead): Approved. Selector granularity directly addresses re-render pain.
- Bob (cart team): Approved. Concern about learning curve. Mitigation: pair programming for week 1.
- Carol (platform): Approved. Ensure cart store does not import other stores.

## Lessons Learned
1. Migration took 2.5 weeks vs estimated 3 — easier than expected
2. Parity testing caught 2 edge cases where Context initializer differed from Zustand initial state
3. Team prefers Zustand pattern after first week — no desire to revert
```

> **Think**: ADR was written 3 months ago. Cart team adds "save for later" feature. Should they update the ADR?
>
> *Answer: Not necessary. ADR documents the migration decision, not every feature addition. Update ADR only if: (1) a new alternative would have changed the original decision, (2) success metrics no longer hold, (3) consequences not predicted occurred. "Save for later" is normal feature work within existing Zustand architecture. Write a new ADR if save-for-later requires a separate store or new middleware.*

### ADR Template for State Management Decisions

Reusable template:

```
ADR: [Number] — [Title]
Status: [Draft / Proposed / Accepted / Deprecated / Superseded]
Date: [YYYY-MM-DD]
Deciders: [Names / Roles]

## Context
[Why decision needed? What problem? Current state? Constraints? 2-5 sentences.]

## Decision
[What was decided? One sentence.]

## Considered Alternatives
### A. [Option 1] — [Current / Status quo]
- Pros: [List 2-3]
- Cons: [List 2-3]

### B. [Option 2] — [Selected / Runner up]
- Pros:
- Cons:

### C. [Option 3]
- Pros:
- Cons:

## Tradeoffs
| Dimension | Option A | Option B | Option C |
|-----------|----------|----------|----------|

## Consequences
Positive:
- [List expected benefits]

Negative:
- [List expected costs]

Risks:
- [Risk] → Mitigation: [Plan]

## Rollback Plan
[Conditions under which decision reverses. Concrete criteria.]

## Success Metrics
| Metric | Baseline | Target | Measured |
|--------|----------|--------|----------|
| [Metric] | [Current value] | [Target value] | [Actual] |

## Review
- [Reviewer]: [Approved/Reject + reason]
```

**Usage rules:**
- One ADR per decision. If two decisions linked, write two ADRs referencing each other.
- Status follows lifecycle: Draft → Proposed → Accepted → Implemented → Closed (or Deprecated/Superseded)
- Keep ADR under 1 page. If longer, split — decision is too complex for single ADR.
- Store in repository: `docs/adrs/` directory. Filename: `NNNN-title.md` (zero-padded number + kebab-title).

> **Think**: A team has 50 ADRs in `docs/adrs`. How does a new engineer find the one about why Zustand was chosen?
>
> *Answer: ADR index file (`docs/adrs/README.md` or `INDEX.md`) lists all ADRs with title, status, and one-line summary. Search by keyword (`grep -ri 'zustand' docs/adrs/`). ADRs that supersede older ones should reference them: "Supersedes ADR-0012 (Context selection)." New engineer reads index, picks relevant ADR, follows reference chain if superseded.*

---

### Why This Matters

State architecture decisions are the most expensive decisions in frontend development. Wrong choice costs months in refactoring, re-render bugs, and dev velocity. ADRs make these decisions explicit, reviewable, and reversible. Teams that document state architecture decisions spend less time re-litigating "why did we pick this?" and more time shipping features. The ADR discipline separates engineering organizations that make deliberate architecture choices from those that drift into accidental architecture. This capstone module synthesizes every previous module — store boundaries, slices, selectors, atomic stores, persistence, migration, testing — into one documented, reviewable, measurable architecture decision.

---

### Common Questions

**Q: How is an ADR different from a design doc?**
A: ADR focuses on one decision, not full design. Design doc explores problem space, ADR captures single decision outcome. ADRs are lighter (1 page), machine-searchable, and version-controlled. Write design doc for exploration, ADR for decision capture.

**Q: Who writes ADRs? Who reviews?**
A: Anyone can write. Tech lead + affected team members review. For state management ADRs, include at least one engineer from each team whose components consume the store. ADR review is lighter than RFC — 2-3 reviewers, 1-2 day review cycle.

**Q: When should an ADR be updated vs deprecated?**
A: Update when decision still holds but context changed (e.g., success metric target adjusted). Deprecate when decision is reversed (e.g., migrating away from Zustand). Superseded when replaced by new ADR (e.g., ADR-007 supersedes ADR-003). Never delete ADRs — history matters.

**Q: What if no one reads ADRs?**
A: Make ADRs part of the review process. PR that touches store architecture must reference relevant ADR. CI check: if store changes without ADR number in PR description, flag for review. Cultural adoption takes time — start with one ADR per quarter, increase as team sees value.

**Q: Can ADRs be used for non-state decisions?**
A: Yes. ADR format generalizes to any architecture decision: library selection, build tool choice, API design pattern, deployment strategy. State management ADR is this module's focus, but the template and review criteria apply universally.

---

## Examples

### Example 1: Choosing Zustand vs Redux for a Fintech Dashboard

**Problem**: Fintech dashboard needs real-time trade data, complex derived metrics, multiple data sources. Team of 8. Performance critical — re-render lag costs users money.

**ADR summary**:
- **Context**: Dashboard aggregates real-time trade data, portfolio metrics, risk calculations. 40 components. Re-render latency currently 80ms on data refresh (Context).
- **Alternatives**: Zustand (selected), Redux Toolkit, Jotai
- **Decision**: Zustand + atomic stores per domain (trades, portfolio, risk, UI)

**Key tradeoffs driving decision**:
| Concern | Zustand | Redux Toolkit |
|---------|---------|---------------|
| Re-render control | Granular selectors | Granular selectors (equal) |
| Bundle (mobile web) | 1.1KB | 18.5KB |
| Real-time data (WebSocket) | Async action | Thunk/saga (more mature) |
| Complex derived state | External (reselect or manual) | createSelector |
| Team learning | 1 week (new) | Already know (existing) |

**Why Zustand won**: Redux knowledge exists but bundle + re-render concerns outweighed. Derived state handled by custom `useMemo` in selectors. Real-time WebSocket lives in action method, not saga — simpler.

**Result**: Bundle -17KB, re-renders 40 → 6 per data refresh, team productive after 1 week.

### Example 2: ADR for Adding Persistence to Cart Store

```
ADR: 012 — Cart Store Persistence with localStorage
Status: Accepted
Date: 2024-10-01

Context: Cart store lives in memory. User refreshes page, cart lost.
  Customer complaints about re-adding items each visit.

Decision: Add Zustand persist middleware to cart store.

Alternatives considered:
  A. persist middleware (selected) — 2 lines added, works out of box
  B. Manual localStorage sync — more control, more boilerplate
  C. Server-side cart persistence — requires backend changes, not scoped

Tradeoffs:
  - persist middleware is scoped to browser — no SSR
  - Cart store init reads from localStorage before server data arrives
  - Migration: existing cart data must be compatible with persisted shape

Consequences:
  - Cart survives page refresh (+ user satisfaction)
  - Bundle +0.5KB (persist middleware)
  - Must handle mismatch between persisted localStorage shape and new store shape (version migration)

Success metrics:
  - Cart retention on refresh: 0% → 100%
  - Customer complaints: reduced by estimated 30%
```

**Result**: persist middleware added in 15 minutes. Cart survives refresh. 2 weeks later, no regressions. Customer complaints about cart loss dropped 90%.

### Example 3: ADR for Splitting Monolithic Store

```
ADR: 015 — Split AppStore into Domain Stores
Status: Accepted
Date: 2024-11-15

Context: AppStore holds auth, cart, UI, notifications, settings.
  400 lines. 5 teams own different slices. PR conflicts weekly on
  the same file. Testing setup loads entire app state for single-domain tests.

Decision: Split into 5 stores: auth, cart, ui, notifications, settings.

Migration: New stores created alongside AppStore. Each team migrates
  own domain over 2 weeks. AppStore deleted after all migrated.

Results: PR conflicts reduced 80%. Test setup simplified. Each store
  testable in isolation. Bundle unchanged (same total state).
```

> **Think**: Team splits monolithic store into 5. After 1 month, a new employee asks "why is this app using 5 stores instead of 1?" What do you point them to?
>
> *Answer: ADR-015. They read context (PR conflicts, test overhead, ownership ambiguity), alternatives considered (keep monolithic, split by team, split by data lifetime), and results. No need to re-litigate. If new context arises (e.g., 5 stores now cause cross-store query overhead), they open new ADR to re-evaluate.*

---

## Key Takeaways
- ADR captures one architecture decision: context, alternatives, tradeoffs, consequences, success metrics
- Decision matrix evaluates state solutions across weighted criteria — avoid recency bias
- Store architecture ADR defines boundaries (one per domain), ownership (one team per store), selector API (public vs private)
- Monolithic vs atomic stores: atomic wins for ownership + re-render isolation; monolithic for cross-slice read simplicity
- Testing strategy ADR documents store-level (logic, actions) vs component-level (UI from store state) boundaries
- Migration ADR includes plan, rollback criteria, and success metrics — avoid sunk cost fallacy
- Team conventions ADR standardizes naming, file structure, store patterns across all stores
- ADR review criteria: context clear, ≥2 alternatives, balanced tradeoffs, measurable metrics, rollback plan
- Real example: migration from Context to Zustand reduced re-renders from 15+ to 2, LOC 210 to 85, frame time 45ms to 12ms
- Reusable ADR template: one decision per ADR, 1-page max, stored in `docs/adrs/`, lifecycle from Draft to Closed

## Common Misconception

**"ADR is bureaucracy — writing docs slows us down."**

ADR format is 1 page. Writing takes 30 minutes. What costs time: re-litigating the same decision 6 months later with different team members, discovering migration breaks another team's store because no ownership was documented, or debugging re-render issues because store boundaries were never explicit. An ADR is insurance against tribal knowledge loss. Teams that "move fast without documentation" spend 2x time rediscovering decisions. The ADR is not the overhead. Hidden overhead is undocumenting decisions and paying the tax every time context changes.

---

## Feynman Explain
(Explain ADR to a product manager who knows "state management" exists but not details. Use a real estate analogy: ADR is the deed for a property decision. It records who owns which piece of the frontend, why they chose that plot, what it cost, and when they might need to move to a different plot. The deed does not build the house — it prevents neighbors from fighting over the same land.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain zustand-state-management` — AI probes gaps.*

---

## Reframe
(Pause. Judge: When is ADR overkill? For a solo developer building a prototype, does ADR-001 on state management choice add value? For a 2-person startup, what is the minimum viable ADR — one sentence in a README? For a 20-person team, is 1-page ADR too light? Write your evaluation. Consider the spectrum from "no documentation" to "formal ADR" and where each team size falls on that spectrum.)

---

## Drill
Take the quiz. MCQs test ADR structure, decision matrix weighting, store boundary documentation, migration criteria, review process, and the real e-commerce migration example.

Run: `learn.sh quiz zustand-state-management 20-adr-capstone`

## Quiz: 20-adr-capstone


### What is the primary purpose of an Architecture Decision Record (ADR)?

- [ ] A: To provide a step-by-step implementation guide for code

- [✓] B: To capture a single architecture decision with context, tradeoffs, and consequences

- [ ] C: To replace all other documentation in the repository

- [ ] D: To serve as a project roadmap with timeline and milestones


**Answer:** B

ADR focuses on one decision — context, alternatives evaluated, tradeoffs, consequences. It is not implementation guide, not all documentation, not project roadmap. Length: 1 page max.


### A team evaluates Zustand vs Redux for a mobile-first app. Which criteria should receive the highest weight?

- [ ] A: Middleware ecosystem richness

- [✓] B: Bundle size

- [ ] C: Number of GitHub stars

- [ ] D: Action type convention


**Answer:** B

Mobile-first prioritizes bundle size. Zustand = 1.1KB. Redux + RTK = ~18.5KB. Bundle size directly impacts mobile load time. Stars and convention are low-weight criteria. Middleware ecosystem matters only if app needs complex orchestration.


### In store architecture documentation, what is the difference between a public selector and a private selector?

- [ ] A: Public selectors are exported; private selectors are inlined in components

- [✓] B: Public selectors are documented and versioned; private selectors may change without notice

- [ ] C: Public selectors use React hooks; private selectors use vanilla API

- [ ] D: Public selectors are slower; private selectors are optimized


**Answer:** B

Public selectors are part of store's external API — documented, tested, breaking changes require ADR. Private selectors are internal to store owner's team, may change without notice. External consumers rely on public selectors for stability.


### An e-commerce app has auth, cart, search, and notifications state. Which store architecture follows best practice?

- [ ] A: Single monolithic store for all four domains

- [✓] B: Four atomic stores — one per domain

- [ ] C: Two stores: auth+cart combined, search+notifications combined

- [ ] D: One store per component


**Answer:** B

One store per domain is idiomatic Zustand. Auth, cart, search, notifications have independent lifecycles, different teams, different consumer sets. Monolithic store creates PR conflicts and cross-domain coupling. Two-store hybrid is arbitrary grouping.


### A migration ADR documents rollback criteria. Which of the following is a well-defined rollback criterion?

- [ ] A: If users complain, we revert

- [✓] B: If re-render count is not reduced by at least 60% compared to baseline

- [ ] C: If the team feels uncomfortable with the new solution

- [ ] D: We roll back if any issues arise


**Answer:** B

Well-defined criterion is measurable (60% reduction) and objective. 'Users complain' is subjective — which users? what complaints? 'Team feels uncomfortable' is emotional. 'Any issues' is too broad — some issues are acceptable tradeoffs. Measurable thresholds prevent sunk cost fallacy.


### During ADR review, which finding would justify rejection?

- [✓] A: Only one alternative evaluated — the chosen solution

- [ ] B: Rollback plan exists but is vague

- [ ] C: Success metrics are aspirational but not yet measured

- [ ] D: The ADR is three pages long


**Answer:** A

Only evaluating chosen solution with no comparison is automatic reject. Reader cannot assess whether alternatives were fairly considered. Vague rollback (B) triggers revision, not rejection. Aspirational metrics (C) are normal before migration. Length (D) is preference, not rejection criterion.


### In the real e-commerce ADR example (Context → Zustand for cart), what was the actual re-render reduction achieved?

- [ ] A: 15+ components to 15 components

- [✓] B: 15+ components to 2 components

- [ ] C: 15+ components to 0 components

- [ ] D: 15+ components to 5 components


**Answer:** B

Baseline: 15+ components re-rendered on any cart change. After Zustand migration: 2 components re-rendered (subscribed selectors). Target was ≤3. Result exceeded target. 0 components (C) is impossible — at least the component with the button re-renders.


### A new engineer joins and asks why the app uses 5 Zustand stores instead of 1. What should the team answer?

- [ ] A: We have always done it this way

- [✓] B: Refer to ADR-015 which documents the monolithic store split decision

- [ ] C: 5 stores is standard Zustand practice

- [ ] D: Because Redux uses one store so we wanted to be different


**Answer:** B

ADR-015 captures the exact context (PR conflicts, test overhead, ownership ambiguity), alternatives considered, and results. 'Always done this way' is dogma. 'Standard practice' ignores project-specific context. 'Be different from Redux' is arbitrary. ADR provides reasoned, reviewable rationale.


### A migration achieves 3 of 4 success metrics but misses one. Rollback criteria says 're-renders not reduced by 60%.' Actual reduction is 55%. What action?

- [ ] A: Keep the migration — 55% is close enough

- [✓] B: Revert per rollback criteria — criteria exists to prevent subjective judgment

- [ ] C: Extend the trial period by 2 weeks and re-measure

- [ ] D: Lower the threshold to 50% retroactively


**Answer:** B

Criteria exist to prevent sunk cost and subjective judgment. 55% misses 60% threshold. Revert per plan. If migration is still desirable, write new ADR with adjusted criteria based on learnings. Retroactively lowering threshold (D) defeats purpose of objective criteria.


### According to the ADR template, what must happen when an ADR supersedes a previous ADR?

- [ ] A: Delete the old ADR from the repository

- [✓] B: Update the new ADR with 'Supersedes ADR-NNN' reference

- [ ] C: Move both ADRs to an archive directory

- [ ] D: Rewrite the old ADR with a deprecation notice


**Answer:** B

New ADR references superseded ADR: 'Supersedes ADR-012.' Old ADR remains in repository (history matters) but its Status updates to 'Superseded by ADR-015.' Never delete ADRs — future engineers need the context chain. Moving to archive is alternative but must preserve reference chain.


---
