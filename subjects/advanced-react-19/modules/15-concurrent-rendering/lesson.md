# Module 15: Concurrent Rendering — Priorities, Interrupts, Suspense Transitions

Est. study time: 2h
Language: en

## Learning Objectives
- Explain React's interruptible rendering model and lane-based priority system
- Apply `useTransition` and `useDeferredValue` to prevent UI jank from low-priority updates
- Implement Suspense boundaries with transition-aware fallback suppression
- Debug concurrent rendering behavior using DevTools lane indicators and `useSyncExternalStore`

---

## Core Content

### Interruptible Rendering — The Core Mental Model

React 18+ renders are interruptible. Before concurrent mode, a render was a single synchronous transaction:

```
setState → reconcile entire tree → commit → paint
```

If render took 500ms, browser froze 500ms. No input, no animation, no paint.

Concurrent rendering breaks work into fiber units:

```
setState → reconcile fiber A → yield → paint keyboard → reconcile fiber B → yield → ...
```

React schedules fiber work across multiple frames using `requestIdleCallback` and `requestAnimationFrame`. Each time React yields, browser can process input, paint, and service animations.

> **Think**: A search input triggers 200ms render of results list. In sync mode, what happens to keystrokes during those 200ms? In concurrent mode?
>
> *Answer: Sync mode — keystrokes queue but browser cannot process them until render completes. User feels lag. Concurrent mode — React yields between fibers, browser processes keystrokes immediately, renders feel instant even if result rendering is slow.*

Interruptibility depends on priority. React assigns every update a **lane** — a binary flag representing urgency. When a higher-priority update arrives during render, React discards current work and restarts from the higher-priority update.

```
lane 0: SyncLane          (immediate — not interruptible)
lane 1: InputContinuous   (user input — urgent)
lane 2: DefaultLane       (normal transitions)
lane 3: TransitionLane    (useTransition / startTransition)
lane 4: RetryLane         (Suspense retries)
lane 5: IdleLane          (useDeferredValue)
```

> **Think**: Why does React use binary lanes instead of a numeric priority (1-5)?
>
> *Answer: Lanes are bitmasks. React can batch multiple lanes, test intersection (did urgent lane appear during render?), and merge without sorting. A numeric priority cannot represent "current batch contains both urgent AND normal updates." Lanes compose: `batchedLanes = urgentLane | transitionLane`.*

### Lane-Based Priority System

React 19 uses 31 lanes (fits in a 32-bit int). Key lane groups:

| Lane Group | Constant | Batched? | Interruptible? | Typical Source |
|------------|----------|----------|----------------|----------------|
| SyncLane | `SyncLane = 0b0001` | No | No | `flushSync`, `useSyncExternalStore` |
| InputContinuousHydrationLane | `0b0010` | No | No | `onClick`, `onKeyDown` |
| DefaultLane | `0b0100` | Yes | Yes | `setState` outside transition |
| TransitionLanes | `0b1000`–`0xFFFF` | Yes | Yes | `startTransition`, `useTransition` |
| RetryLanes | `0x10000`–`0x40000` | Yes | Yes | Suspense fallback retries |
| OffscreenLane | `0x80000` | Yes | Yes | Hidden offscreen content |
| IdleLane | `0x100000` | Yes | Yes | `useDeferredValue` |

React's scheduler picks highest-priority pending lane. When render starts on a TransitionLane and a SyncLane update arrives, React **throws away the transition work** and restarts.

```typescript
// React internals (simplified):
function ensureRootIsScheduled(root: FiberRoot) {
  const nextLanes = getNextLanes(root, NoLanes)
  const existingLane = root.pendingLanes
  if (existingLane !== NoLanes && laneIsHigherPriority(nextLanes, existingLane)) {
    // Interrupt current render, restart with higher priority
    markRootSuspended(root, existingLane)
    scheduleUpdateOnFiber(root, nextLanes)
  }
}
```

> **Think**: An urgent update arrives 3ms into a transition render. React discards partial work. Is this wasted computation? Is it acceptable?
>
> *Answer: Yes, partial work is discarded. Acceptable because: (1) urgent responsiveness outweighs wasted work, (2) React bails out of unchanged subtrees on restart (tree is same, no waste), (3) typical transition renders are under 50ms — restart cost is negligible vs 16ms frame budget.*

### How React Interrupts a Render — The Throw Mechanism

Concurrent rendering uses a **throw-then-catch** pattern:

1. React begins rendering a lane.
2. Higher-priority update is scheduled.
3. React **throws** a special object (`ReactConcurrentError` / `ThrowIfInfiniteLoop`) from the work loop.
4. The scheduler **catches** the throw, discards pending work, schedules new render.
5. Next render starts with both the new update and any unchanged subtrees from the aborted render.

```typescript
function workLoopConcurrent() {
  while (workInProgress !== null && !shouldYield()) {
    performUnitOfWork(workInProgress)
  }
  if (workInProgress !== null && needsInterrupt()) {
    // Throw to abort current render
    throw new ReactConcurrentError(
      workInProgress,
      getNextLanes(root, NoLanes)
    )
  }
}
```

This is why concurrent rendering cannot use generator functions — generators have explicit yield points. Throw unwinds the entire call stack, guaranteeing no stale state leaks.

> **Think**: Can a concurrent render be interrupted by two updates in succession? What happens to work that was 90% complete?
>
> *Answer: Yes. Each interrupt discards current work and restarts. Work 90% complete is discarded entirely. React relies on bailing out — unchanged fibeers produce same output, only changed parts re-execute. React 19's compiler optimization reduces re-execution cost on restart.*

### useTransition — Priority Lowering API

`useTransition` wraps a state update in a lower-priority lane. React can interrupt this update if an urgent update arrives.

```typescript
import { useTransition, useState } from 'react'

function SearchResults() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [isPending, startTransition] = useTransition()

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value
    setQuery(next)  // urgent — updates input immediately

    startTransition(() => {
      // non-urgent — React can interrupt this
      setResults(filterData(next))
    })
  }

  return (
    <div>
      <input onChange={handleChange} />
      {isPending && <Spinner />}
      <ResultsList items={results} />
    </div>
  )
}
```

Key behavior:
- `isPending`: true while transition render is in progress (even if interrupted)
- `startTransition` callback: all `setState` calls inside enter TransitionLane
- React does NOT show a Suspense fallback during a pending transition — stale UI persists
- If a new urgent update arrives, React abandons current transition, restarts with urgent update, then re-attempts transition

> **Think**: What if `startTransition` wraps a `dispatch` to a global store (Zustand, Redux)? Does the priority lowering work?
>
> *Answer: No. Priority lowering only works for React state. External stores bypass React's scheduler. Wrap external store reads in `useSyncExternalStore`; writes to external stores must be wrapped manually using `startTransition` on the React side that triggers the read.*

### useDeferredValue — Deferring Derived Values

`useDeferredValue` lets you defer updating a value to lower priority. Unlike `useTransition` (which wraps the update), `useDeferredValue` wraps the **value**.

```typescript
import { useDeferredValue, useState, useMemo } from 'react'

function HeavyList({ query }: { query: string }) {
  const deferredQuery = useDeferredValue(query)
  const isStale = query !== deferredQuery

  const list = useMemo(() => {
    return expensiveFilter(allItems, deferredQuery)
  }, [deferredQuery])

  return (
    <div>
      {isStale && <div>Updating...</div>}
      <ul>{list.map(item => <li key={item.id}>{item.name}</li>)}</ul>
    </div>
  )
}
```

How it differs from `useTransition`:

| Dimension | useTransition | useDeferredValue |
|-----------|---------------|------------------|
| What it wraps | State setter call | Derived value |
| Who controls | Component that sets state | Component that reads value |
| When defer activates | Immediately on call | On next render cycle |
| Use case | Form submission, navigation | Large list filtering, search results |
| isPending indicator | `isPending` from hook | Manual comparison (`old !== new`) |

`useDeferredValue` uses `IdleLane`. The deferred value stays at old value until urgent work completes. React may skip re-rendering the deferred subtree entirely if urgent work keeps arriving (e.g., rapid keystrokes).

> **Think**: `useDeferredValue` defers a value. Does `deferredQuery` ever skip updates entirely (never reach new value)?
>
> *Answer: Only if user keeps typing before each deferred render completes. As soon as user pauses, deferred value catches up. React eventually commits deferred value. It is not lost — only delayed until React has idle frames.*

### Suspense + Concurrent: Fallback Suppression During Transitions

In concurrent mode, Suspense boundaries behave differently during transitions:

**Before transition completes**: React does NOT show the Suspense fallback when content suspends inside a transition. Instead, React commits the **previous** UI (stale state). This prevents loading spinner flashes.

**After transition completes**: Normal Suspense behavior — show fallback, trigger retry, show content.

```typescript
function TabSwitcher() {
  const [tab, setTab] = useState('home')
  const [isPending, startTransition] = useTransition()

  function switchTab(next: string) {
    startTransition(() => {
      setTab(next)
    })
  }

  return (
    <div>
      <button onClick={() => switchTab('home')}>Home</button>
      <button onClick={() => switchTab('profile')}>Profile</button>
      <Suspense fallback={<BigSpinner />}>
        {isPending ? <StaleTab /> : <CurrentTab tab={tab} />}
      </Suspense>
    </div>
  )
}
```

Without `useTransition`, switching tabs triggers Suspense fallback (BigSpinner flashes). With `useTransition`, React keeps showing current tab until new tab data arrives. This is **transition-based fallback suppression** — built into React 19's default concurrent mode.

> **Think**: A slow data fetch inside a transition suspends for 5 seconds. No fallback shows. User sees stale UI. Is this good UX?
>
> *Answer: Depends on context. For navigation, stale UI is better than spinner. For dashboards where stale data is misleading (stock prices), add a timeout: if transition takes > 2s, show a subtle "refreshing" indicator. Use `isPending` to render a non-blocking loading hint.*

### Time Slicing — Yielding to Main Thread

React splits rendering into chunks. Each chunk processes one or more fiber units, then checks `shouldYield()`:

```typescript
function shouldYieldToRenderer(): boolean {
  const timeElapsed = performance.now() - startTime
  if (timeElapsed >= YIELD_INTERVAL) {
    // Yield control to browser
    return true
  }
  // Check if urgent input is pending (message channel heartbeat)
  if (hasUrgentInput()) {
    return true
  }
  return false
}
```

Default yield interval: **5ms** (one third of a 16ms frame). This leaves ~11ms for browser paint, layout, and input processing.

React integrates with scheduler via:
- **MessageChannel**: React posts a message to itself to yield. Browser processes pending input between message events.
- **`requestAnimationFrame`** (raf): For animation-bound work.
- **`requestIdleCallback`**: For truly idle work (not all browsers — React polyfills via MessageChannel).

```typescript
// Simplified yield mechanism
function scheduleWork( callback: () => void ) {
  const channel = new MessageChannel()
  channel.port1.onmessage = callback
  channel.port2.postMessage(undefined)
  // Browser processes queued microtasks and events between
  // postMessage and onmessage callback
}
```

> **Think**: Why MessageChannel instead of `setTimeout(fn, 0)`?
>
> *Answer: MessageChannel fires before setTimeout in task priority. setTimeout(0) is throttled to 4ms in nested calls. MessageChannel provides ~0-1ms delay and is not throttled. React needs consistent micro-frame yields.*

### Concurrent Features in React 19 — Default Concurrent Mode

React 19 makes concurrent rendering the **default**. No more `createRoot(container, { concurrent: true })`.

```typescript
// React 18 — explicit
const root = createRoot(container)  // concurrent default in 18
// React 19 — always
const root = createRoot(container)  // concurrent, no opt-in needed
```

React 19 removes legacy `ReactDOM.render`. All roots are concurrent. This changes:
- `componentWillMount` / `componentWillReceiveProps` / `componentWillUpdate` — all deprecated and removed (use `UNSAFE_` prefix stripped too)
- **Automatic batching**: Multiple `setState` calls in event handlers batch into one render
- **Transitions everywhere**: `startTransition` available without import in supported patterns

> **Think**: If concurrent mode is default, can any component call synchronous APIs that break in concurrent mode?
>
> *Answer: Yes. `ReactDOM.flushSync(...)` forces sync render (blocks concurrent interruption). Libraries that read DOM synchronously after setState (e.g., measure layout) will get stale values. Ref callbacks during concurrent renders fire per fiber — not once per commit.*

### Legacy Sync vs Concurrent Rendering

| Behavior | Legacy (React 17) | Concurrent (React 19) |
|----------|-------------------|----------------------|
| Render duration | Blocking — entire tree | Yielding — fiber by fiber |
| State batching | Only in event handlers | Always (automatic) |
| Interruption | Never | On higher-priority update |
| Suspense fallback | Immediate on suspend | Suppressed during transitions |
| `setState` priority | Uniform | Lane-based |
| `useEffect` timing | After paint (async) | After paint (async — same) |
| `useLayoutEffect` | Sync after commit | Sync after commit (same) |
| Ref callbacks | Once per mount | Per fiber during render + commit |

Key migration issue: **Ref callback timing**. In legacy mode, ref callbacks fire once per mount. In concurrent mode, ref callbacks may fire multiple times per mount because React renders and discards fibers during interleaved updates.

```typescript
// Legacy: ref callback fires once
<div ref={(el) => { measure(el) }}>
  {/* measure() called exactly once */}
</div>

// Concurrent: ref callback may fire for discarded fibers
<div ref={(el) => { measure(el) }}>
  {/* measure() may be called with null (cleanup) and el (setup) multiple times */}
  {/* Safeguard: check el !== null before measuring */}
</div>
```

> **Think**: A library calls `getBoundingClientRect` in a ref callback. Does it break under concurrent rendering?
>
> *Answer: Not directly. But ref callback may fire for fibers that are never committed (interrupted render). Measure only when el is final: use `useEffect` + `useRef` pattern instead. Or call measure in `useLayoutEffect` which runs only after commit.*

### useSyncExternalStore — Concurrent-Safe External Store Reads

External stores (Zustand, Redux, RxJS) read state outside React's scheduling. During concurrent rendering, an external store may change between render and commit, causing **tearing** (UI shows inconsistent state from two different store snapshots).

`useSyncExternalStore` guarantees external store reads are consistent across concurrent renders:

```typescript
import { useSyncExternalStore } from 'react'

function subscribe(store: Store) {
  return store.subscribe(() => {
    // Force re-render when store changes
    store.getSnapshot()
  })
}

function useStoreSnapshot(store: Store) {
  return useSyncExternalStore(
    store.subscribe,
    () => store.getSnapshot(),   // getSnapshot — called during render
    () => store.getServerSnapshot()  // optional: for SSR hydration
  )
}
```

If store changes during a concurrent render, React detects the snapshot changed and re-renders synchronously to prevent tearing. If snapshot changes between render and commit, React re-executes the render synchronously.

Without `useSyncExternalStore`, external store reads produce **tearing**:

```
Frame 1: React reads store snapshot A → render starts (snapshot A)
Frame 2: Store updates to snapshot B → React commits (commit expects A)
Frame 3: UI shows mix of A-based and B-based state → TEAR
```

`useSyncExternalStore` prevents this by forcing `getSnapshot` to run synchronously at commit time, ensuring render and commit use same snapshot.

> **Think**: A Zustand store reads `store.getState().count` in a component. Does it cause tearing?
>
> *Answer: Yes, if concurrent rendering interleaves between store write and React render. Zustand 5+ uses `useSyncExternalStore` internally. Zustand 4 and Redux require explicit `useSyncExternalStore` or the official bindings (`react-redux` 8+ already wraps it).*

### Debugging Concurrent Rendering — DevTools Lane Indicators

React DevTools (included with React 19) show lane information for every fiber:

- **Lane badge**: Colored dot next to fiber in Component tree
- **Red**: SyncLane — immediate, blocking
- **Yellow**: InputContinuous — user input
- **Blue**: Default — normal state update
- **Green**: Transition — wrapped in startTransition
- **Gray**: Idle — deferred value

- **"Committed by" trace**: In Profiler tab, each commit shows which lane triggered it
- **"Interrupted" badge**: Fibers that were rendered but not committed (discarded work)

Enable: React DevTools → Settings → Debugging → "Show lane labels"

```typescript
// Programmatic lane check (development only):
import { __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED } from 'react'

function debugLane() {
  if (process.env.NODE_ENV === 'development') {
    const currentLane = 
      __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner.current?.lane
    console.log(`Rendering on lane: ${currentLane}`)
  }
}
```

Common debugging patterns:
- **Transition not working?** Check DevTools lane badge — should show green (TransitionLane), not blue (DefaultLane)
- **Too many re-renders?** Check if updates are landing on SyncLane instead of DefaultLane — unwrap from `flushSync`
- **Suspense fallback flashing?** Confirm `startTransition` wraps the setState that triggers suspense — fallback suppression only works inside transitions

> **Think**: A component shows a blue lane badge but is wrapped in `startTransition`. What went wrong?
>
> *Answer: `startTransition` only affects setState calls executed inside its callback. If a setState outside the callback triggers the re-render, it uses DefaultLane. or `startTransition` may be called but the callback contains an async function — transition ends when callback returns, not when async completes. Use `async` transition: `startTransition(async () => { await submit(); setDone() })`.*

---

### Why This Matters

Concurrent rendering is the most consequential React change since the fiber architecture. Without understanding lanes, `useTransition`, and time slicing, developers write code that works in development but janks in production. External stores tear silently. Suspense boundaries flash spinners unnecessarily. Urgent input lags behind background data sync. React 19 makes concurrent mode default — every app runs this model. Debugging concurrent issues requires lane awareness, not just re-render counting.

---

### Common Questions

**Q: Does concurrent rendering make my app faster?**
A: Not automatically. Concurrent rendering prevents jank by yielding to urgent work. Throughput (total work completed per second) may decrease slightly — React spends time yielding and restarting. The benefit is responsiveness, not raw speed.

**Q: Can two transitions run simultaneously?**
A: No. React processes one lane at a time per root. A new transition interrupts an existing transition. React coalesces multiple transition updates into one batch and renders once.

**Q: Does `useDeferredValue` always defer?**
A: No. If no urgent work is pending when deferred value changes, React commits it immediately. Deferral only activates when concurrent scheduler detects higher-priority pending lanes.

**Q: Do all `setState` calls inside `startTransition` automatically batch?**
A: Yes. All setState calls inside a transition callback coalesce into one render. This is true even for setState outside event handlers (setTimeout, Promise, requestAnimationFrame) — React's automatic batching covers all scopes in React 19.

**Q: Is `flushSync` dangerous in concurrent mode?**
A: It forces sync render, bypassing interruption. Use sparingly: only for third-party integrations that require synchronous DOM measurement. Overusing `flushSync` eliminates concurrency benefits.

---

## Examples

### Example 1: Transition-Based Search with Deferred Filtering

**Problem**: Product listing page with 10,000 items. Each keystroke filters by name + category + price range. Filtering takes 50-200ms. Users complain about janky typing.

**Solution**: Two-layer priority strategy:
- `useTransition`: Mark filter as low priority
- `useDeferredValue`: Defer the derived list rendering

```typescript
function ProductSearch() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [isPending, startTransition] = useTransition()

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)  // urgent — input update
    startTransition(() => {
      setCategory(e.target.value.includes('electronics') ? 'electronics' : 'all')
    })
  }

  return (
    <FilterableList
      query={query}
      category={category}
      isPending={isPending}
    />
  )
}

function FilterableList({ query, category, isPending }: FilterableListProps) {
  const deferredQuery = useDeferredValue(query)
  const isStale = query !== deferredQuery

  const filtered = useMemo(
    () => products.filter(
      p => p.name.includes(deferredQuery)
        && (category === 'all' || p.category === category)
    ),
    [deferredQuery, category]
  )

  return (
    <div style={{ opacity: isStale ? 0.8 : 1 }}>
      {isPending && <div>Refining...</div>}
      <VirtualList items={filtered} itemHeight={40} />
    </div>
  )
}
```

**Result**: Typing remains responsive (60fps). Filtered list updates 50-200ms after keystroke stops. No jank, no spinner flash.

### Example 2: Tab Navigation with Suspense Transitions

**Problem**: Dashboard app with 4 tabs. Each tab fetches heavy data. Switching tabs shows a loading spinner for 1-3 seconds. Users find spinner jarring when switching back and forth.

**Solution**: Wrap tab switch in `useTransition` to suppress Suspense fallback:

```typescript
function DashboardTabs() {
  const [tab, setTab] = useState<'overview' | 'analytics' | 'reports' | 'settings'>('overview')
  const [isPending, startTransition] = useTransition()

  function goToTab(next: typeof tab) {
    startTransition(() => {
      setTab(next)
    })
  }

  return (
    <div>
      <TabBar current={tab} onSwitch={goToTab} />
      <div style={{ opacity: isPending ? 0.85 : 1 }}>
        <Suspense fallback={<Skeleton />}>
          <CurrentTabContent tab={tab} />
        </Suspense>
      </div>
      {isPending && <TransitionIndicator />}
    </div>
  )
}
```

**Result**: Tab switch shows previous tab content immediately. New tab content loads in background. `isPending` drives a subtle "refreshing" indicator instead of full-screen spinner. If data loads fast (<500ms), user sees no loading state at all.

### Example 3: Debugging Lane Mismatch

**Problem**: Developer wraps `setState` in `startTransition` but DevTools shows blue (DefaultLane) badge. Component re-renders on every keystroke with full list computation.

**Root cause**: `startTransition` wraps setState call, but the component also reads `useSyncExternalStore` which forces SyncLane on every store read.

```typescript
// Bug: store read outside transition forces SyncLane
function Search() {
  const user = useUserStore(s => s.user)  // SyncLane — tears to SyncLane always
  const [query, setQuery] = useState('')

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)  // urgent
    startTransition(() => {
      setResults(filter(user, query))  // expected: TransitionLane
      // But: reading `user` from external store inside transition
      // forces render at SyncLane because store hasn't changed
    })
  }
  // ...
}
```

**Fix**: Move store read outside transition or wrap store state in `useDeferredValue`:

```typescript
function Search() {
  const user = useUserStore(s => s.user)
  const deferredUser = useDeferredValue(user)  // IdleLane
  // ...
}
```

**Result**: DevTools shows green (TransitionLane) or gray (IdleLane) badge. Urgent input renders independently of store-driven updates.

---

## Key Takeaways
- Concurrent rendering splits work into fiber units, yielding to browser every ~5ms
- Lanes (bitmasks) assign priority: SyncLane → InputContinuous → Default → Transition → Idle
- When higher-priority update arrives, React throws away current render and restarts
- `useTransition` lowers setState to TransitionLane — interruptible by urgent updates
- `useDeferredValue` defers a derived value to IdleLane — useful for large lists
- Suspense fallback is suppressed during transitions — prevents spinner flash
- Time slicing uses MessageChannel to yield control to browser between fiber chunks
- React 19 makes concurrent mode default — no opt-in, no legacy root
- `useSyncExternalStore` prevents tearing by forcing snapshot consistency at commit time
- DevTools lane badges (red/yellow/blue/green/gray) show which priority triggered each render

## Common Misconception

**"Concurrent rendering means React renders multiple things simultaneously (in parallel)."**

Concurrent rendering is NOT parallelism. React runs on a single thread. "Concurrent" means React can **interrupt** one render to start another, then resume the first. This is cooperative multitasking, not parallel execution. Web Workers or SharedArrayBuffer are not involved. React interleaves work on the main thread by yielding control to the browser scheduler. The term "concurrent" refers to React's ability to handle multiple pending updates without blocking — it processes them in priority order, not simultaneously.

---

## Feynman Explain
(Explain React's concurrent rendering to a junior developer who understands event loops and setTimeout. Use no React jargon — talk about task prioritization, yielding, and interruption in plain terms. Compare React's scheduler to how a restaurant prioritizes orders: urgent (burnt food) over non-urgent (refill water).)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain` — AI probes gaps.*

---

## Reframe
(Pause. Critique: Does every app need concurrent rendering? When does time slicing hurt performance (e.g., render throughput)? Are there cases where `flushSync` is the correct default despite losing concurrency? Write your evaluation. Consider: animation-heavy UIs, real-time data streams, server-rendered static pages.)

---

## Drill
Take the quiz. MCQs test priority classification, useTransition vs useDeferredValue, tearing prevention, and debugging.

Run: `learn.sh quiz advanced-react-19 15-concurrent-rendering`
