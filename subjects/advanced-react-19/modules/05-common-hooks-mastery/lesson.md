# Module 5: Common Hooks Mastery — useCallback, useMemo, useRef, useImperativeHandle

Est. study time: 2h
Language: en

## Learning Objectives
- Profile re-render performance and decide when memoization actually helps
- Apply useCallback and useMemo correctly — reference stability vs computation caching
- Distinguish Compiler-auto-memoizable patterns from manual-required patterns
- Leverage useRef for DOM, mutable instance variables, and callback refs
- Design imperative APIs with useImperativeHandle, understanding forwardRef deprecation

---

## Core Content

### The Memoization Trap: When More Hooks = Slower Code

Every hook call costs something. `useMemo` and `useCallback` are not free:
- Hook call overhead (function call, deps array allocation + comparison)
- Memory retention (memoized values persist across renders)
- Developer confusion (wrong deps → stale closures, missed updates)

Rule: **Measure before memoizing.** The React DevTools Profiler shows:
- Component re-rendered? Why? (props changed, state changed, parent re-rendered)
- How long did render take? (<1ms = skip memoization, >5ms = consider)
- How many descendants re-rendered unnecessarily?

> **Think**: A `<Button>` component renders in 0.3ms. It receives `onClick` from parent. Parent re-renders 50 times during typing. Should you wrap `onClick` in useCallback?
>
> *Answer: Probably not. Button renders in 0.3ms × 50 = 15ms total. useCallback overhead + deps comparison may cost more than it saves. Profile first. If the Button is wrapped in React.memo and has 100 instances, then useCallback matters — otherwise, cheap components don't need memoization.*

### useCallback: What It Actually Does

`useCallback(fn, deps)` returns the same function reference across renders unless deps change. Its sole purpose: **prevent passing a new function reference as props, which triggers re-render in memoized child components**.

```typescript
import { useCallback, useState, memo } from 'react'

interface ExpensiveListProps {
  items: string[]
  onSelect: (id: string) => void
}

const ExpensiveList = memo(function ExpensiveList({
  items,
  onSelect,
}: ExpensiveListProps) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item} onClick={() => onSelect(item)}>
          {item}
        </li>
      ))}
    </ul>
  )
})

function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<string[]>([])

  // Without useCallback: every SearchPage render creates new onSelect
  // ExpensiveList re-renders every time (memo checks prop reference)
  const handleSelect = useCallback((id: string) => {
    console.log('selected', id)
  }, [])

  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <ExpensiveList items={results} onSelect={handleSelect} />
    </div>
  )
}
```

Without `memo` on child, `useCallback` does nothing for render performance. The child re-renders because parent re-rendered, not because `onSelect` changed. `useCallback` only matters when:
1. Child is wrapped in `React.memo`
2. Child is a component that uses the function in a `useEffect` dep
3. Function passed to a custom hook that compares references (e.g., event emitter)

> **Think**: Why does useCallback with empty deps `[]` cause stale closures? When is empty deps correct?
>
> *Answer: Empty deps means the function never changes. If handleSelect reads state (e.g., `setQuery`), it captures initial value. It is correct only when the function truly depends on nothing — like dispatching to an external store or logging. React 19 Compiler handles this automatically by analyzing captured values.*

### useMemo: Computation Cache vs Reference Stability

Two distinct uses of `useMemo`:

**1. Expensive computation:**
```typescript
import { useMemo } from 'react'

interface DashboardProps {
  transactions: Transaction[]
}

function Dashboard({ transactions }: DashboardProps) {
  // Expensive: sort + group by category
  const groupedByCategory = useMemo(
    () => aggregateByCategory(transactions),
    [transactions]
  )

  // Also expensive but NOT cached — see why below
  const filteredAndSorted = useMemo(
    () => sortByDate(
      transactions.filter(t => t.amount > 0)
    ),
    [transactions]
  )

  return <Chart data={groupedByCategory} />
}
```

**2. Reference stability (needed after computation):**
```typescript
function Dashboard({ transactions }: DashboardProps) {
  const categories = useMemo(
    () => ['revenue', 'expenses', 'investments'],
    []
  )
  // Passed to memo child — stable reference means no unnecessary re-render
  return <CategoryFilter categories={categories} />
}
```

The second pattern is what the React Compiler handles. If you only need reference stability (not computation caching), the Compiler injects the memoization. If you have an expensive computation, manual `useMemo` is still needed until the compiler can prove the computation is idempotent.

> **Think**: What happens if you use useMemo with a computation that runs in 0.01ms? Is it worth wrapping?
>
> *Answer: No. useMemo overhead (deps comparison + memory) exceeds the computation cost. Only use useMemo when computation cost > hook overhead + deps comparison cost. Rule of thumb: >1ms or O(n²+) complexity.*

### React Compiler: What It Auto-Memoizes and What It Doesn't

React 19 Compiler (Forget) analyzes JavaScript at build time and injects memoization. What it handles:

| Pattern | Compiler handles? | Manual still needed? |
|---------|-------------------|---------------------|
| Inline function in JSX | Yes | No |
| Local variable derived from props/state | Yes | No |
| Object/array literals passed as props | Yes | No |
| `React.memo` wrapping | Yes (auto-wraps) | No |
| Cross-module value | No | Manual `useMemo`/`useCallback` |
| Value stored in ref | No | Manual |
| Values from non-React libraries | No | Manual |
| Computation with side effects | No | Manual (fix side effects first) |
| Conditional hook calls | No | Restructure to unconditional |

```typescript
// React 19 Compiler handles this automatically:
function Profile({ user }: { user: User }) {
  const displayName = formatName(user) // auto-memoized
  const handleClick = () => updateProfile(user.id) // auto-memoized
  return <Button onClick={handleClick}>{displayName}</Button>
}

// But NOT this (cross-module reference):
import { expensiveSort } from './utils'

function DataGrid({ rows }: { rows: Row[] }) {
  // Compiler cannot analyze expensiveSort internals
  // Manual useMemo required:
  const sorted = useMemo(() => expensiveSort(rows), [rows])
  return <Table data={sorted} />
}
```

> **Think**: Should you stop writing useCallback/useMemo today if you use React 19 Smart Compiler? What about code shared with React 18?
>
> *Answer: Yes for React-19-only code with Compiler enabled per module. No for code that must work on React 18 too. No for cross-module boundaries the compiler can't analyze. The Compiler is safe to enable incrementally — remove manual hooks as you verify the Compiler handles them.*

### useRef: DOM Refs, Mutable Instance Variables, Callback Refs

Three patterns for `useRef`:

**1. DOM refs:**
```typescript
import { useRef, useEffect } from 'react'

function AutoFocusInput() {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return <input ref={inputRef} />
}
```

**2. Mutable instance variable (survives renders, does not cause re-render):**
```typescript
function Timer() {
  const startTime = useRef(Date.now())
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    intervalRef.current = window.setInterval(() => {
      console.log('elapsed:', Date.now() - startTime.current)
    }, 1000)
    return () => clearInterval(intervalRef.current!)
  }, [])

  return <div>Timer running...</div>
}
```

**3. Callback refs (React 19 recommendation for dynamic ref assignment):**
```typescript
import { useState } from 'react'

function MeasureWidth() {
  const [width, setWidth] = useState(0)

  const measureRef = (node: HTMLDivElement | null) => {
    if (node !== null) {
      setWidth(node.getBoundingClientRect().width)
    }
  }

  return (
    <div>
      <div ref={measureRef}>Measured element</div>
      <p>Width: {width}px</p>
    </div>
  )
}
```

React 19 treats `ref` as a regular prop. This means callback refs work directly without `forwardRef`. The callback is called when:
- Element mounts → called with element
- Element unmounts → called with null
- Callback changes → called with null (cleanup), then new callback with element

> **Think**: You need a stable timer ID that doesn't cause re-render when set. useRef vs useState vs global variable outside component — which and why?
>
> *Answer: useRef. useState causes re-render on every set. Global variable persists across components but breaks encapsulation and testing. useRef gives per-component-instance mutable storage that survives renders without re-render.*

### useImperativeHandle: When to Expose Imperative API

`useImperativeHandle` customizes the instance value exposed when parent uses `ref`. In React 19, `ref` is a prop — `forwardRef` is deprecated but still works.

```typescript
import { useRef, useImperativeHandle } from 'react'

interface VideoPlayerHandle {
  play: () => void
  pause: () => void
  jumpTo: (time: number) => void
}

// React 19: ref as prop, no forwardRef needed
function VideoPlayer(
  { src }: { src: string },
  ref: React.Ref<VideoPlayerHandle>
) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useImperativeHandle(ref, () => ({
    play() {
      videoRef.current?.play()
    },
    pause() {
      videoRef.current?.pause()
    },
    jumpTo(time: number) {
      if (videoRef.current) {
        videoRef.current.currentTime = time
      }
    },
  }), [])

  return <video ref={videoRef} src={src} controls />
}

// Usage
function Parent() {
  const playerRef = useRef<VideoPlayerHandle>(null)

  return (
    <div>
      <VideoPlayer ref={playerRef} src="intro.mp4" />
      <button onClick={() => playerRef.current?.play()}>Play</button>
    </div>
  )
}
```

When to use imperative handles:
- **Animations**: `play()`, `pause()`, `reset()` — imperative by nature
- **Media players**: video/audio playback control
- **Third-party widget interop**: must expose methods to non-React code
- **Focus management**: complex focus sequences across multiple elements

When NOT to use:
- **Declarative alternatives exist**: props + state should be default
- **Data flow**: never expose getters for state (use callbacks instead)
- **Cross-component coordination**: use lifting state or context, not imperative ref chains

> **Think**: Should a `<Form>` component expose `submit()`, `validate()`, `reset()` via useImperativeHandle? What are the downsides?
>
> *Answer: Common pattern but has downsides. Imperative ref breaks declarative data flow — parent must call methods instead of reacting to state. Prefer `useActionState` in React 19 (handles submit + validation declaratively). Use imperative only for reset (clear all fields) which has no native React 19 equivalent yet.*

### React 19 Ref Changes

| Concern | React 18 | React 19 |
|---------|----------|----------|
| Passing ref | `forwardRef` wrapper | `ref` is regular prop |
| Cleanup functions | Not supported | Ref callbacks can return cleanup fn |
| Component name in DevTools | `ForwardRef(Comp)` | `Comp` directly |
| TypeScript | `React.PropsWithRef` | `React.Ref` as prop |
| Server Components | N/A | refs not supported in RSC |

Cleanup in ref callbacks (React 19):
```typescript
function ResizablePanel() {
  const panelRef = (node: HTMLDivElement | null) => {
    if (node) {
      const observer = new ResizeObserver((entries) => {
        console.log('resized:', entries[0].contentRect)
      })
      observer.observe(node)
      // Return cleanup function:
      return () => observer.disconnect()
    }
  }

  return <div ref={panelRef}>Resizable content</div>
}
```

> **Think**: Why does React 19 remove forwardRef? What migration issues might arise?
>
> *Answer: `ref` as a regular prop simplifies the mental model — no special wrapper needed. Migration issues: TypeScript types may still use `React.PropsWithRef` or `React.ForwardRefRenderFunction`; third-party HOCs that inject props may conflict with `ref` as regular prop. `forwardRef` still works in React 19 — migrate incrementally.*

### Common Anti-Patterns

**1. Memoizing everything:**
```typescript
// Bad: every prop wrapped defensively
const handleClick = useCallback(() => doSomething(), [])
const styles = useMemo(() => ({ color: 'blue' }), [])
const label = useMemo(() => 'Submit', [])

// Better: let compiler handle it, or measure first
```

**2. Missing deps leading to stale closures:**
```typescript
// Bad: stale count inside the callback
function Counter() {
  const [count, setCount] = useState(0)
  const logCount = useCallback(() => {
    console.log(count) // Always logs the initial count
  }, [])  // Missing count dependency!
  return <button onClick={logCount}>Log count</button>
}
```

**3. useRef as state replacement:**
```typescript
// Bad: ref mutation doesn't trigger re-render
function Counter() {
  const count = useRef(0)
  const increment = () => {
    count.current += 1 // UI never updates!
  }
  return <div>{count.current}</div>
}
```

**4. useImperativeHandle for data flow:**
```typescript
// Bad: imperative getter breaks React data flow
useImperativeHandle(ref, () => ({
  getValue: () => formState,
}))
// Better: lift formState to parent or use useActionState
```

---

### Why This Matters

Memoization is the most misunderstood React performance tool. Adding `useCallback` and `useMemo` everywhere is cargo-cult optimization — it costs memory and complexity without measurable benefit. React 19's Compiler eliminates ~80% of manual memoization, but the remaining 20% requires deep understanding: cross-boundary values, refs, imperative handles, and third-party interop. `useRef` is essential for DOM access, animation, and instance variables. `useImperativeHandle` is the escape hatch for when declarative approaches don't fit — but it is an escape hatch, not a default. Master these hooks to write performant, maintainable React 19.

Wrong approach: wrap everything in useMemo/useCallback 'just in case'. Right approach: profile, identify bottlenecks, memoize precisely where it matters. Let the Compiler handle the rest.

---

### Common Questions

**Q: Does React 19 eliminate useMemo for expensive computations?**
A: Not automatically. The Compiler auto-memoizes for reference stability (objects, arrays, functions derived from props/state). For genuinely expensive computations (sort 10k items, complex math), manual `useMemo` is still needed because the compiler cannot know the computation cost. Profile to confirm the computation is actually expensive.

**Q: When would I use useRef vs useState for a value that changes over time?**
A: useState when the change should trigger re-render (UI update). useRef when the value should change without re-render (timer ID, animation frame, previous value for comparison, DOM measurements). If you accidentally use useRef for display values, the UI will be stale.

**Q: Can I use useImperativeHandle in Server Components?**
A: No. Server Components don't support refs (no DOM, no interactivity). useImperativeHandle only works in Client Components. Mark the component with `'use client'` if it uses refs.

**Q: How does the React Compiler handle hooks like useRef?**
A: The compiler knows about React's built-in hooks. It understands that `useRef` returns a stable object and `current` is mutable. It will not memoize values derived from `ref.current` because those can change outside the render cycle. The compiler treats refs as a "mutable source" boundary.

**Q: What is the React 19 equivalent of forwardRef + useImperativeHandle?**
A: Same pattern, minus `forwardRef`. In React 19, define `ref` as a regular prop on your component. Everything else — `useRef`, `useImperativeHandle` — works identically. TypeScript: `ref: React.Ref<HandleType>` as a prop.

---

## Examples

### Example 1: Optimizing a Data Grid with Conditional Memoization

**Problem**: Virtualized data grid with 500 rows. Each row shows formatted data and handles click. Rows are `memo`-wrapped. Grid re-renders on scroll (position state changes).

```typescript
import { useMemo, useCallback, memo } from 'react'

interface RowProps {
  item: DataItem
  formatCurrency: (value: number) => string
  onRowClick: (id: string) => void
}

const Row = memo(function Row({ item, formatCurrency, onRowClick }: RowProps) {
  return (
    <tr onClick={() => onRowClick(item.id)}>
      <td>{item.name}</td>
      <td>{formatCurrency(item.value)}</td>
    </tr>
  )
})

function DataGrid({ items }: { items: DataItem[] }) {
  // Virtual list manages visible indices, causes frequent re-renders
  const [scrollTop, setScrollTop] = useState(0)

  // Memoize: expensive computation
  const visibleItems = useMemo(
    () => getVisibleItems(items, scrollTop, ROW_HEIGHT, containerHeight),
    [items, scrollTop]
  )

  // Memoize: prevent 500 Row re-renders on every scroll
  const formatCurrency = useCallback(
    (value: number) => new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value),
    []
  )

  const handleRowClick = useCallback((id: string) => {
    // navigate to detail page
  }, [])

  return (
    <div onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}>
      {visibleItems.map((item) => (
        <Row
          key={item.id}
          item={item}
          formatCurrency={formatCurrency}
          onRowClick={handleRowClick}
        />
      ))}
    </div>
  )
}
```

**Result**: Without memoization, every scroll event re-renders all 500 rows. With `memo` + `useCallback`, only the `visibleItems` computation runs. Rows re-render only if their specific item data changes (e.g., after data update, not on scroll).

### Example 2: Imperative Video Player with useImperativeHandle

**Problem**: Build a reusable video player component. Parent needs play/pause/seek/jumpTo and must know when video ends.

```typescript
import { useRef, useImperativeHandle, useState, useCallback } from 'react'

interface VideoHandle {
  play: () => Promise<void>
  pause: () => void
  seek: (time: number) => void
  isPlaying: boolean
}

function Player(
  { src, onEnded }: { src: string; onEnded?: () => void },
  ref: React.Ref<VideoHandle>
) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  useImperativeHandle(ref, () => ({
    async play() {
      await videoRef.current?.play()
      setIsPlaying(true)
    },
    pause() {
      videoRef.current?.pause()
      setIsPlaying(false)
    },
    seek(time: number) {
      if (videoRef.current) {
        videoRef.current.currentTime = time
      }
    },
    isPlaying,
  }), [isPlaying])

  const handleEnded = useCallback(() => {
    setIsPlaying(false)
    onEnded?.()
  }, [onEnded])

  return (
    <video
      ref={videoRef}
      src={src}
      onEnded={handleEnded}
      controls
    />
  )
}
```

**Result**: Parent controls video imperatively (useful for custom controls outside component tree). `isPlaying` is exposed so parent can show different UIs based on state. The imperative API is minimal — just what can't be done declaratively.

### Example 3: Profiling Before Memoizing

**Problem**: A dashboard with 10 chart components, each computing aggregates from 10k+ data points. Charts are wrapped in `memo`. Clicking a filter triggers re-render. Which hooks need memoization?

**Diagnosis**:
1. Profile in React DevTools: filter click → 800ms total render time
2. Flame graph: `BigChart` takes 300ms (sort + aggregate 10k rows)
3. `SmallChart` takes 5ms each (filtered subset)
4. Memory: 8MB retained between renders

**Decision**:
- `BigChart`: Wrap aggregation in `useMemo` (saves 300ms per render) — HIGH impact
- `SmallChart`: Skip memoization (5ms × 9 charts = 45ms — not worth complexity) — SKIP
- Filter click handler: `useCallback` (prevents BigChart re-render if filter hasn't changed) — MEDIUM impact
- `colorPalette` array: remove `useMemo` (created once, no computation) — REMOVE

**Result**: 800ms → 350ms. 56% reduction with three targeted changes. No wrapping of cheap operations.

---

## Key Takeaways
- Measure before memoizing. DevTools Profiler is your guide — data, not instinct.
- `useCallback` prevents child re-render only when child is wrapped in `memo`.
- `useMemo` serves two distinct purposes: expensive computation caching and reference stability.
- React 19 Compiler auto-memoizes ~80% of patterns. Manual memoization still needed for cross-boundary values, expensive computations, and refs.
- `useRef` is for mutable values that should not trigger re-render: DOM refs, interval IDs, animation frames, previous values.
- `useImperativeHandle` is for imperative APIs that cannot be expressed declaratively — animations, media, third-party interop.
- React 19 makes `ref` a regular prop. `forwardRef` is deprecated but still works. Migrate incrementally.
- Callback refs in React 19 support cleanup functions (return a function from the ref callback).
- Ref cleanup: callback refs can return a cleanup function for observers, event listeners, etc.
- Common anti-pattern: memoizing everything defensively. This is optimization by superstition, not evidence.

## Common Misconception

**"useCallback and useMemo always improve performance."**

False. Every hook call has overhead. `useCallback` creates a function, allocates a deps array, compares deps — each step costs time and memory. If the child component is not memoized, `useCallback` is entirely wasted — the child re-renders from the parent render anyway. The React Compiler eliminates unnecessary manual hooks, but even the compiler does not memoize everything. The only correct approach: profile, identify the real bottleneck, apply targeted memoization. Default to code clarity, not defensive hooks.

---

## Feynman Explain
(Explain useCallback and useMemo to a junior developer who knows only `useState` and `useEffect`. Use no React jargon in your explanation. Describe the problem: "Sometimes React re-renders parts of the screen that didn't change." Explain how useCallback and useMemo help, where they don't, and why measuring is better than guessing.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain` — AI probes gaps.*

---

## Reframe
(Pause. Consider: React 19's Compiler makes manual useCallback/useMemo mostly unnecessary. Is it worth teaching these hooks deeply when they may become legacy within 2 years? Or is deep understanding of memoization essential for the cases the compiler cannot handle? Write your evaluation. Consider the trade-off between future-proofing vs mastering fundamentals.)

---

## Drill
Take the quiz. MCQs test memoization decisions, useRef patterns, and React 19 ref changes.

Run: `learn.sh quiz advanced-react-19 05-common-hooks-mastery`
