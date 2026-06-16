# Module 4: Transitions Deep — useTransition, startTransition, Batching

Est. study time: 2h
Language: en

## Learning Objectives
- Distinguish urgent vs transition updates and apply correct API
- Use `startTransition` and `useTransition` for non-blocking UI
- Understand React 19 batching model and its impact on re-renders
- Implement `useDeferredValue` for expensive derived computations
- Compose transitions with Suspense and Actions

---

## Core Content

### Urgent vs Transition Updates: The Mental Model

Every state update in React 19 belongs to one of two categories:

| Category | Examples | Priority | API |
|----------|----------|----------|-----|
| Urgent | Typing, clicking, dragging, sliders | High — must respond immediately | Default setState |
| Transition | Filtering list, navigating tabs, fetching search results | Low — can be delayed or interrupted | `startTransition` / `useTransition` |

```typescript
// Urgent — updates immediately
function SearchInput() {
  const [query, setQuery] = useState("")

  return <input value={query} onChange={(e) => setQuery(e.target.value)} />
}

// Transition — can be deferred
function SearchResults({ query }: { query: string }) {
  const [results, setResults] = useState<Result[]>([])
  const [, startTransition] = useTransition()

  useEffect(() => {
    startTransition(async () => {
      const data = await search(query)
      setResults(data)
    })
  }, [query])

  return <ResultList items={results} />
}
```

> **Think**: Why not wrap every setState in startTransition? What happens if you mark typing as a transition?
>
> *Answer: Typing marked as transition would feel sluggish — React may interrupt or delay the character showing. Transitions are for non-urgent work derived from urgent input. The input char is urgent; showing results derived from that input is a transition.*

### useTransition API Deep Dive

```typescript
function TabSwitcher() {
  const [tab, setTab] = useState<"feed" | "dashboard" | "settings">("feed")
  const [isPending, startTransition] = useTransition()

  function switchTab(next: "feed" | "dashboard" | "settings") {
    startTransition(() => {
      setTab(next)
    })
  }

  return (
    <div>
      {isPending && <Spinner />}
      <TabPanel tab={tab} />
    </div>
  )
}
```

`useTransition()` returns `[isPending, startTransition]`:
- `isPending`: boolean — true while transition is in flight. Shows loading feedback without blocking urgent updates.
- `startTransition(callback)`: marks all state updates inside callback as transitions.

**startTransition inside an Action:**
```typescript
const [state, formAction, pending] = useActionState(submitOrder, {})
const [, startTransition] = useTransition()

async function handleSubmit(formData: FormData) {
  startTransition(async () => {
    await formAction(formData)          // transition
    router.push("/confirmation")        // also transition
  })
}
```

> **Think**: `isPending` stays true until all transition-set states commit. What happens if the transition triggers a Suspense boundary?
>
> *Answer: `isPending` stays true while Suspense shows fallback. When content resolves and commits, `isPending` becomes false. This gives you a coordinated loading state without manual Suspense fallback management — show spinner near interactive elements, not just full-page fallbacks.*

### How Transitions Prevent Jank

Without transitions, React processes state updates synchronously to completion:
```
Typing → setQuery("h") → re-render with "h" → search filter 5000 items → paint (blocked during filter)
Typing → setQuery("he") → re-render with "he" → search filter 5000 items → paint (blocked)
```

This blocks the main thread. Each keystroke waits for the filter to finish before the next character appears.

With transitions:
```
Typing → setQuery("h") → render urgent path → paint (instant)
         ↳ startTransition → filter 5000 items → can be interrupted
Typing → setQuery("he") → React interrupts in-progress filter → render urgent path → paint (instant)
         ↳ startTransition → filter 5000 items with "he" → commit results
```

React compares transition outputs: if a newer transition exists, the old one's output is discarded. The DOM only sees the latest transition result.

> **Think**: User types "hello" fast. How many filter executions happen with vs without transitions?
>
> *Answer: Without transitions: 5 filter executions (h, he, hel, hell, hello), each blocking render. With transitions: React may interrupt after each keystroke, discard intermediate results, only commit the final "hello" filter. Likely 1-2 filter executions.*

### React 19 Batching Model

React 18 batches updates inside event handlers and effects:
```typescript
// React 18 — batched inside event handler
onClick={() => {
  setCount(c => c + 1)   // queued
  setFlag(f => !f)        // queued
  // single re-render for both
}}
```

React 19 extends batching everywhere — including timeouts, promises, native events:
```typescript
// React 19 — all batching, even async
fetch("/data").then(() => {
  setCount(c => c + 1)   // queued (was 2 renders in 18)
  setFlag(f => !f)        // queued
  // single re-render for both (React 18 did 2 renders here)
})
```

This reduces unnecessary renders. However, batching can delay state-dependent side effects:
```typescript
setCount(c => c + 1)
console.log(count)        // still old value — batched, not committed yet
```

> **Think**: Batching means setState inside a fetch .then() produces one render instead of two. Does this affect you if you read state immediately after setState?
>
> *Answer: Yes — if you read state synchronously after setState expecting the new value (anti-pattern), batching breaks this. Solution: use the updater function argument `setCount(prev => prev + 1)` or read from the source of truth.*

### useDeferredValue: Deferring Expensive Computations

`useDeferredValue` is the declarative version of transitions — it defers a value, not an update:

```typescript
function SearchPage({ query: urgentQuery }: { query: string }) {
  const deferredQuery = useDeferredValue(urgentQuery)
  const isStale = urgentQuery !== deferredQuery

  // Expensive filter runs on deferred value — not on every keystroke
  const results = useMemo(
    () => expensiveFilter(allItems, deferredQuery),
    [deferredQuery]
  )

  return (
    <div>
      <input defaultValue={urgentQuery} />  // immediate feel
      {isStale && <p>Updating results...</p>}
      <ResultsList items={results} />
    </div>
  )
}
```

| Mechanism | When to use | How it works |
|-----------|-------------|--------------|
| `startTransition` | You control the state update | Wrap setState in callback |
| `useDeferredValue` | You receive value from parent | Hook wraps the incoming value |

> **Think**: `useDeferredValue` causes the component to render twice — once with urgent value, once with deferred. Is this a performance problem?
>
> *Answer: The first render is synchronous (urgent). The second is deferred — React can interrupt and skip it if newer urgent input arrives. React double-renders intentionally: first shows urgent UI, second catches up deferred work. Not a bottleneck — React prioritizes correctly.*

### Transitions + Suspense: Coordinated Loading

Transitions interact with Suspense: a transition wrapping a Suspense-triggering state update keeps showing the **old UI** until new content resolves — no flash of fallback:

```typescript
function TabNavigator() {
  const [tab, setTab] = useState<"profile" | "dashboard">("profile")
  const [, startTransition] = useTransition()

  return (
    <div>
      <button onClick={() => startTransition(() => setTab("profile"))}>Profile</button>
      <button onClick={() => startTransition(() => setTab("dashboard"))}>Dashboard</button>

      <Suspense fallback={<FullPageSpinner />}>
        {tab === "profile" ? <Profile /> : <Dashboard />}
      </Suspense>
    </div>
  )
}
```

Without transition: switch tab → old content unmounts → Suspense fallback shows → new content loads. Fallback flash.

With transition: switch tab → old content stays visible → new content loads in background → old content swaps to new. No fallback flash.

> **Think**: Why does a transition suppress the Suspense fallback? Is this always desirable?
>
> *Answer: Because the transition signals "non-urgent navigation" — React prioritizes keeping old UI interactive over showing a loading spinner. This is desirable for tab switches, navigation, filter changes. It is NOT desirable for initial page load — you DO want the fallback then.*

---

### Why This Matters

Transitions are the most impactful React 19 feature for perceived performance. Before transitions, any heavy computation or data fetch blocked the main thread. Developers worked around this with debouncing (laggy), throttling (choppy), or web workers (complex). Transitions let React itself manage priority — no configuration, no arbitrary delays. Combined with Suspense, transitions eliminate the "loading spinner flash" that plagues single-page apps. Every interactive app should classify state updates into urgent vs transition; this single mental model reduces jank more than any manual optimization.

---

### Common Questions

**Q: Can I use startTransition outside of React components?**
A: No. `startTransition` is a hook or imported directly from React — but it only works in a React rendering context. For non-React contexts, use `useDeferredValue`.

**Q: What is the difference between startTransition and setTimeout?**
A: `setTimeout` queues work at the end of the macrotask queue — it always waits. `startTransition` is synchronous — React marks the update as low priority but processes it immediately if nothing else is pending. setTimeout always adds latency; startTransition adds latency only when React needs to prioritize urgent work.

**Q: How many transitions can run concurrently?**
A: Only one transition is active at a time. Starting a new transition interrupts and discards the previous in-progress transition.

**Q: Does useDeferredValue work with primitive values?**
A: Yes. `useDeferredValue` compares via `Object.is`. For primitives (string, number), if the new value is identical to the deferred value, no deferred re-render happens.

---

## Examples

### Example 1: Search with useDeferredValue

```typescript
interface Item {
  id: string
  title: string
  category: string
}

function Catalog({ items, query }: { items: Item[]; query: string }) {
  const deferredQuery = useDeferredValue(query)
  const isStale = query !== deferredQuery

  const filtered = useMemo(
    () => items.filter(
      (item) => item.title.toLowerCase().includes(deferredQuery.toLowerCase())
    ),
    [items, deferredQuery]
  )

  return (
    <div style={{ opacity: isStale ? 0.5 : 1 }}>
      {filtered.map((item) => (
        <CatalogCard key={item.id} item={item} />
      ))}
    </div>
  )
}
```

### Example 2: Tab Navigation with Transition + Suspense

```typescript
type Tab = "feed" | "analytics" | "settings"

function App() {
  const [tab, setTab] = useState<Tab>("feed")
  const [, startTransition] = useTransition()

  const tabs: Tab[] = ["feed", "analytics", "settings"]

  return (
    <div>
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => startTransition(() => setTab(t))}
        >
          {t}
        </button>
      ))}

      <Suspense fallback={<LayoutSkeleton />}>
        {tab === "feed" && <Feed />}
        {tab === "analytics" && lazy(() => import("./Analytics"))}
        {tab === "settings" && lazy(() => import("./Settings"))}
      </Suspense>
    </div>
  )
}
```

---

## Key Takeaways
- Every state update is urgent (default) or transition (startTransition)
- `useTransition()` returns `[isPending, startTransition]` — isPending shows UI feedback during transition
- Transitions prevent jank by making non-urgent work interruptible
- React 19 batches all state updates — async boundaries included
- `useDeferredValue` defers a value (declarative), `startTransition` defers an update (imperative)
- Transition + Suspense suppresses fallback flash: keeps old UI until new content resolves
- Only one transition active at a time — newer interrupts older
- Transition outputs are discardable — DOM only sees the latest committed result

## Common Misconception

**"Transitions are the same as debouncing."**

Debouncing introduces a fixed delay before any work starts. Transitions start immediately but can be interrupted. A debounced search waits 300ms before fetching; a transition starts fetching immediately but discards the result if the user types again within 50ms. Transitions feel faster because they optimistically start work — debouncing pessimistically delays work. React also manages the lifecycle (interrupt, discard, commit) automatically — debouncing requires manual cancel/restart logic.

---

## Feynman Explain
(Explain transitions to a designer who cares about UX. Use the analogy of a restaurant kitchen: urgent orders go immediately to the chef. Less urgent orders (table cleanup, prep work) are queued but can be paused if a new urgent order arrives. The customer never waits for cleanup to finish before their food is cooked.)

---

## Reframe
(Critique: transitions are invisible to the developer — no explicit priority declaration beyond "wrap in startTransition." Could more granular priority levels (lowest, background, interactive) improve control? Or would they just add complexity? Write your position.)

---

## Drill
Take the quiz. MCQs test urgent vs transition classification, batching behavior, Suspense interaction.

Run: `learn.sh quiz advanced-react-19 04-transitions`
