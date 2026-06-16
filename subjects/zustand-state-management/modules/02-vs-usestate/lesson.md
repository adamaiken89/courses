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
