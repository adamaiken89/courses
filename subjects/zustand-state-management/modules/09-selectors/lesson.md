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
