# Module 16: Profiling and Performance: Flamegraphs, Re-Render Analysis

Est. study time: 2h
Language: en

## Learning Objectives
- Interpret React DevTools flamegraphs to identify unnecessary re-renders and render cost
- Apply `<Profiler>` API onRender callback to measure component commit times programmatically
- Diagnose common performance antipatterns: large lists, deep trees, unstable keys
- Set performance budgets for component render time and detect regressions in CI

---

## Core Content

### React DevTools Profiler: Recording, Flamegraph, Ranked Timeline

React DevTools Profiler records commit-by-commit snapshots of render activity. Each commit is a single synchronous render+commit cycle.

Three visualization modes:

**Flamegraph**: Stacked bar chart. Each bar = component render time (self + children). Wider bar = more time. Color intensity = relative cost within commit. Click a component to see `why did this render?` — lists changed props, state, or context.

**Ranked timeline**: Components sorted by total render time, descending. Answers "what is slowest component this commit?" directly. Does not show parent-child nesting.

**Interactions timeline** (React 19): Tracks traced interactions (`Scheduler.unstable_trace`) through async work. Shows which user action triggered which commits.

> **Think**: Flamegraph shows Component A at 12ms and Component B at 3ms. Component A has 6 children totaling 10ms of that 12ms. Is A itself expensive, or its children?
>
> *Answer: Component A self-time = 12ms - 10ms = 2ms. Component A itself is cheap. Children are the problem. Flamegraph does not show self-time directly — you compute it by subtracting children. Ranked timeline shows total time but not the breakdown. For self-time, use `<Profiler>` API with `actualDuration` vs `interactionActualDuration`.*

### Interpreting Flamegraphs: Component Render Time, Why Did This Render?

Flamegraph color key:
- Gray: no re-render (bailed out via memo/React.memo)
- Teal/blue: re-rendered, low cost
- Yellow/orange: re-rendered, moderate cost
- Red: re-rendered, high cost

Click component → **Why did this render?** panel shows:

| Reason | Meaning | Fix |
|--------|---------|-----|
| Props changed | Shallow diff found difference | Stabilize references, memo |
| State changed | `setState` in component or hook | Reduce state update scope |
| Parent rendered | No bailout on parent re-render | `React.memo`, Compiler |
| Context changed | Context value updated | Split context, narrow scope |
| Hook changed | Hook deps array diff | Memoize hook deps |

> **Think**: Component re-renders with "Parent rendered" reason. Parent is a list container. Container uses `React.memo`. Why did container render?
>
> *Answer: `React.memo` only protects if props are stable. If parent passes inline props (e.g., `<Item onClick={() => ...} />`) or new object/array references each render, memo check fails. Container rendered because its own props changed, cascading to children.*

### Identifying Unnecessary Re-Renders: Props Change vs State Change vs Parent Render

Three sources of re-render, three distinct fixes:

**Props change**: Parent passes new reference every render.
```typescript
// Bad — new object each render
function Parent() {
  return <Child config={{ theme: 'dark' }} />
}

// Good — stable reference
function Parent() {
  const config = useMemo(() => ({ theme: 'dark' }), [])
  return <Child config={config} />
}
```

**State change**: Component calls `setState`. Fix: lift state down, colocate state closer to consumer.

**Parent render**: Parent re-renders → child re-renders (unless bailed out). Fix: `React.memo` or Compiler.

Pre-React 19 fix chain:
1. `React.memo` wraps child
2. `useMemo`/`useCallback` stabilizes child props
3. Compiler eliminates steps 1-2

> **Think**: A `useState` setter is called with the same value: `setCount(5)` when count is already 5. Does React re-render?
>
> *Answer: React 18: yes (no bailout on setState with same value unless `useState` initial is object and same reference). React 19: React automatically bails out when new state equals old state via `Object.is`. No re-render. This is a React 19 improvement over manual checks.*

### Using `<Profiler>` API: onRender Callback

`<Profiler>` measures actual vs base duration per commit:

```typescript
import { Profiler, type ProfilerOnRenderCallback } from 'react'

const onRender: ProfilerOnRenderCallback = (
  id: string,           // profile id prop
  phase: 'mount' | 'update' | 'nested-update',
  actualDuration: number,    // ms: time spent rendering this subtree
  baseDuration: number,      // ms: estimated time without memoization
  startTime: number,
  commitTime: number,
  interactions: Set<{ name: string; timestamp: number }>
) => {
  if (actualDuration > 16) {  // exceeds 60fps threshold
    console.warn(`[Profiler] ${id} took ${actualDuration.toFixed(2)}ms`)
    reportToAnalytics({ id, phase, actualDuration, commitTime })
  }
}

function Dashboard() {
  return (
    <Profiler id="Dashboard" onRender={onRender}>
      <ExpensiveComponent />
    </Profiler>
  )
}
```

Key metrics:
- `actualDuration`: what users experience. Includes re-render cascades.
- `baseDuration`: hypothetical no-memo time. If `actualDuration ≈ baseDuration`, memoization not helping.
- `phase`: `'mount'` vs `'update'`. Mount is one-time; update repeats.

> **Think**: `actualDuration` = 40ms, `baseDuration` = 12ms. What does this tell you about memoization effectiveness?
>
> *Answer: `actualDuration` > `baseDuration` by 3x. Memoization is effective here — without memo, estimated time is 12ms. Actual is 40ms because memo overhead or because some children do not memo correctly and re-render. Ratio > 2 suggests investigation: either memo not working, or memo itself is costly.*

### Measuring Render Cost: Commit Time, Phase, actualDuration

React 19 commit lifecycle:

1. **Render phase**: Call components, diff virtual tree. Can be interrupted (concurrent features).
2. **Commit phase**: Apply DOM mutations. Synchronous, cannot be interrupted.
3. **Browser paint**: Browser renders pixels.

Profiler captures both phases as one `actualDuration`. To isolate:
- Render time: `<Profiler>` `actualDuration`
- Commit time: difference between consecutive `commitTime` values
- Paint time: `requestAnimationFrame` timestamp - `commitTime`

```typescript
let lastCommit = 0
const onRender: ProfilerOnRenderCallback = (id, phase, actual, base, start, commit) => {
  const commitGap = lastCommit ? commit - lastCommit : 0
  console.log(`Commit gap: ${commitGap.toFixed(2)}ms — indicates JS main thread blocking`)
  lastCommit = commit
}
```

> **Think**: Commit gap is consistently 50ms. User reports "app feels sluggish." Where is the bottleneck?
>
> *Answer: 50ms commit gap means React is spending 50ms between commits doing non-React work (event handlers, network callbacks, other JS). `<Profiler>` shows component render is fast. Fix: reduce expensive JS outside React — debounce handlers, move heavy computation to Web Workers, verify no `useEffect` chains causing synchronous re-render cycles.*

### Bundle Size Analysis: React 19 Production Builds vs Development

DevTools profiling must run against **production** builds for accurate timings. Development build includes:
- PropTypes validation (React 19: removed, but custom checks)
- Component stack traces
- Double-invocation warnings (StrictMode)
- Extra warning checks

These inflate render time 2-5x in dev.

| Bundle | Size (min+gzip) | Profiling accuracy |
|--------|-----------------|-------------------|
| Development | ~150KB | Distorted timings |
| Production | ~45KB | Accurate timings |
| Production + Profiler | ~47KB | Accurate + Profiler API active |

React 19 warning: `react-dom/client` and `react-dom/server` are separate entry points. Ensure production build uses `react-dom/profiling` if using `<Profiler>` in production (rare — typically dev-only).

> **Think**: You profile in dev mode and see 30ms render times. Production build under load shows 120ms frame times. What explains the gap?
>
> *Answer: Dev mode inflates render time (2-5x). But production being *slower* under load means the bottleneck is not React rendering — it's GC pauses (development has less object allocation because some dev checks skip work) or network/API contention. Profile production with React Profiler, not dev. The 120ms includes browser layout/paint, async work, and GC. `<Profiler>` actualDuration shows only React render time, which is likely < 16ms in prod.*

### Lighthouse Metrics: FCP, LCP, TTI, TBT with React 19

Lighthouse audits real user experience. React 19 specific considerations:

| Metric | React 19 Impact |
|--------|-----------------|
| **First Contentful Paint (FCP)** | Server Components stream initial HTML. No client JS needed for first text/image. FCP improves 15-40% over CSR baseline. |
| **Largest Contentful Paint (LCP)** | Streaming SSR + Suspense boundaries let main content paint without waiting for sidebar/footer. Key: `<Suspense>` around non-critical sections. |
| **Total Blocking Time (TBT)** | Transitions and `useDeferredValue` prevent expensive re-renders from blocking main thread. TBT drops because React yields to browser between transitions. |
| **Time to Interactive (TTI)** | `hydrateRoot` with selective hydration: React hydrates visible content first. Hidden content hydrates post-interaction. TTI improves ~30%. |

Profiling Lighthouse in React 19:
- Test with production build (use `lighthouse-ci` or PageSpeed Insights)
- Disable DevTools if testing locally
- Focus on TBT and LCP — these are the metrics React 19 most affects

> **Think**: Lighthouse reports TBT of 350ms on a React 19 app. Profiler shows individual renders under 5ms. What causes the blocking time?
>
> *Answer: TBT includes all main thread work, not just React rendering. 350ms TBT with fast renders suggests: large JS bundles (parse/compile), aggressive analytics scripts, or third-party embeds. Profile "Long Tasks" in Performance tab (Chrome DevTools). React renders fast — but it runs alongside heavyweight non-React work.*

### Performance Budgeting: Setting Render Time Budgets per Component

Set budgets using `<Profiler>` or runtime assertions:

```typescript
const BUDGETS: Record<string, number> = {
  'DataTable': 16,     // 60fps frame budget
  'ChartView': 32,     // 30fps — acceptable for heavy charts
  'SearchInput': 8,    // must respond to keystroke latency
  'Sidebar': Infinity, // not performance-sensitive
}

const onRender: ProfilerOnRenderCallback = (id, phase, actualDuration) => {
  const budget = BUDGETS[id]
  if (budget !== undefined && actualDuration > budget) {
    console.error(`[Budget] ${id} exceeded ${budget}ms (${actualDuration.toFixed(2)}ms)`)
    // Send to monitoring
  }
}
```

Budget guidelines:
- **16ms**: Interactive components (buttons, inputs, toggles)
- **32ms**: Content display (lists, cards, tables with moderate data)
- **50ms**: Heavy visualizations (charts, graphs with <1000 data points)
- **100ms**: Background work (offscreen prefetch, analytics)
- **50ms total commit budget** for 60fps rendering

> **Think**: Component consistently takes 45ms. Budget is 16ms. What are three options besides refactoring?
>
> *Answer: (1) Increase budget to 50ms if component is genuinely expensive and non-interactive. Budgets are guidance, not dogma. (2) Defer component via `<Suspense>` so it renders off-screen. (3) De-prioritize rendering with `useDeferredValue` — renders happen during idle time, not keystroke.*

### Common Performance Antipatterns

**1. Large flat lists without virtualization.**
Fix: `react-window`, `@tanstack/react-virtual`. Virtualize any list > 100 items.

**2. Deep component trees re-rendering on every keystroke.**
Fix: Split input and display into separate components. Input updates itself; display reads from debounced/ deferred value.

**3. Unstable keys.**
```typescript
// Bad — index as key. Reorder = full remount.
{items.map((item, i) => <Item key={i} />)}

// Bad — random key causes full remount every render
{items.map(item => <Item key={Math.random()} />)}

// Good — stable unique id
{items.map(item => <Item key={item.id} />)}
```

**4. State at wrong level.**
State in root, consumed two levels deep. Every update re-renders entire tree. Fix: colocate state in the consumer component or use context splitting.

**5. Unmemoized callbacks in list items.**
Parent renders → creates new function → `React.memo` child re-renders. Fix: `useCallback` or Compiler.

> **Think**: A list of 1000 items re-renders when one item changes. Each item is `React.memo` wrapped. The list uses `key={item.id}`. Profiler shows all 1000 items re-rendering. What went wrong?
>
> *Answer: `React.memo` only prevents re-render if props are stable. If the list container creates new props (or if item component reads context that changed), every item re-renders. Check: does item receive a new `onToggle` prop each render? Is the item reading a context value that updates? The key diff is correct — problem is prop stability or context.*

### Automation: Profiling in CI, Regression Detection

Automate performance regression detection:

**Approach 1: Lighthouse CI**
```yaml
# .lighthouserc.json
{
  "ci": {
    "collect": {
      "url": ["http://localhost:3000/dashboard"],
      "settings": { "throttlingMethod": "devtools" }
    },
    "assert": {
      "assertions": {
        "total-blocking-time": ["error", { "maxNumericValue": 200 }],
        "largest-contentful-paint": ["warn", { "maxNumericValue": 2500 }]
      }
    }
  }
}
```

**Approach 2: Profiler-based regression test**
```typescript
// __tests__/render-times.e2e.ts
import { render } from '@testing-library/react'
import { Profiler, type ProfilerOnRenderCallback } from 'react'

test('DataTable render time < 32ms', async () => {
  const durations: number[] = []
  const onRender: ProfilerOnRenderCallback = (id, phase, actualDuration) => {
    if (phase === 'update') durations.push(actualDuration)
  }

  const { rerender } = render(
    <Profiler id="DataTable" onRender={onRender}>
      <DataTable data={testData} />
    </Profiler>
  )

  rerender(<Profiler id="DataTable" onRender={onRender}>
    <DataTable data={updatedData} />
  </Profiler>)

  expect(Math.max(...durations)).toBeLessThan(32)
})
```

**Approach 3: Bundle size tracking**
```bash
# Add to CI pipeline
npx size-limit
# or
npx react-native bundle --platform web --dev false --entry-file index.js --bundle-output dist/bundle.js
stat -f%z dist/bundle.js | xargs -I{} echo "Bundle size: {} bytes"
```

> **Think**: A CI performance test fails from 28ms to 35ms after a PR. The change is a new feature adding a small component. What do you do?
>
> *Answer: Investigate before rejecting. 28→35ms may be noise (check variance across runs). If consistent, profile the flamegraph to find regression. If the new feature justifies the cost, update the budget. CI performance tests catch regressions; they should block merges only when regression is confirmed not noise.*

---

### Why This Matters

Unnecessary re-renders are the #1 performance bug in React apps. Flamegraphs and Profiler API are the only reliable tools to find them. Teams that profile in CI catch regressions before they ship. Teams that rely on "feeling slow" miss the gradual degradation that compounds over 6 months. A single component leaking re-renders can waste 20% of render time on every interaction. Profiling is not optional — it is how React apps stay fast under real load.

---

### Common Questions

**Q: Profiler shows 60ms for one component. Is that bad?**
A: Depends. 60ms on mount is fine. 60ms on every keystroke update is janky. Measure phase. Mount cost is paid once; update cost is paid every interaction.

**Q: Flamegraph shows red everywhere. Is my app slow?**
A: Not necessarily. Flamegraph color scales relative to the *most expensive component in that commit*. If everything is 0.5ms but the slowest is 1ms, everything looks red. Check actual numbers, not colors.

**Q: Should I use `<Profiler>` in production?**
A: Generally no. Profiler adds overhead (≈2KB + callback execution). Use it in development and staging. React 19 includes `react-dom/profiling` entry for production profiling, but use sparingly.

**Q: Does the React 19 Compiler eliminate the need for profiling?**
A: No. Compiler automates memoization, but not all performance problems are memoization problems. Large lists, deep trees, and expensive computations still need profiling. Compiler fixes re-renders; it does not fix algorithmic inefficiency.

**Q: How do I profile a specific user interaction, not all commits?**
A: Use `Scheduler.unstable_trace` to label interactions, then filter Profiler commits by `interactions` set. Or use Chrome DevTools Performance tab: start recording, perform interaction, stop, filter to React events.

---

## Examples

### Example 1: Diagnosing a 200ms Commit on Dashboard Load

**Problem**: Dashboard takes 200ms to render. Users see blank screen for visible delay. Profiler shows one large commit.

**Flamegraph analysis**:
- `Dashboard`: 200ms (root)
  - `Header`: 2ms
  - `DataGrid`: 180ms
    - `Row` × 500: 150ms (0.3ms each)
    - `Pagination`: 20ms
    - `FilterBar`: 10ms
  - `Sidebar`: 18ms

**Diagnosis**: `DataGrid` is 90% of commit. 500 rows at 0.3ms each = 150ms. `Row` is cheap, but 500× adds up. Table is not virtualized.

**Fix**:
```typescript
// Before: all 500 rows render in DOM
<tbody>
  {data.map(row => <tr key={row.id}>{/* ... */}</tr>)}
</tbody>

// After: virtualize with 40 visible rows
import { useVirtualizer } from '@tanstack/react-virtual'

const virtualizer = useVirtualizer({
  count: data.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => 40, // row height in px
})

return (
  <tbody ref={scrollRef} style={{ height: 400, overflow: 'auto' }}>
    <tr style={{ height: virtualizer.getTotalSize() }} />
    {virtualizer.getVirtualItems().map(virtualRow => (
      <tr key={data[virtualRow.index].id}>
        {/* render visible row only */}
      </tr>
    ))}
  </tbody>
)
```

**Result**: Commit drops from 200ms to 25ms. 40 visible rows × 0.3ms = 12ms + virtualizer overhead.

### Example 2: Profiling in CI for a Search Component

**Problem**: Search results component regresses from 8ms to 40ms after refactor. Team needs automated guard.

**Test setup**:
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { Profiler, type ProfilerOnRenderCallback } from 'react'
import SearchPage from './SearchPage'

test('SearchPage results render under 16ms', () => {
  const durations: number[] = []
  const onRender: ProfilerOnRenderCallback = (id, phase, actual) => {
    if (id === 'SearchResults') durations.push(actual)
  }

  render(
    <Profiler id="SearchPage" onRender={onRender}>
      <SearchPage />
    </Profiler>
  )

  const input = screen.getByPlaceholderText('Search...')
  fireEvent.change(input, { target: { value: 'react' } })

  // Wait for debounced render
  const resultDuration = durations[durations.length - 1]
  expect(resultDuration).toBeLessThan(16)
})
```

**Regression found**: Refactor moved search state up two levels, causing parent re-render cascade. Fix by colocating search state in the SearchResults component.

### Example 3: Using Flamegraph to Fix a "Janky Filter"

**Problem**: Category filter dropdown causes 300ms frame drops. Users report jank.

**Profiler approach**:
1. Record interaction in Profiler
2. Click "CategoryFilter" in flamegraph
3. "Why did this render?" → "Parent rendered"
4. Check parent: App component re-renders on filter change because filter state is in Redux store consumed by App's `useSelector`

**Root cause**: Redux selector on App level. Filter change dispatches action → App re-renders → CategoryFilter re-renders (even though filter state is not used by App).

**Fix**: Move redux `useSelector` from App to CategoryFilter directly. App no longer subscribes to filter state. Filter change updates only CategoryFilter component.

**Result**: 300ms → 12ms.

---

## Key Takeaways
- React DevTools Profiler has three modes: flamegraph (hierarchy), ranked timeline (sorted by cost), interactions (user action mapping)
- "Why did this render?" lists five reasons: props changed, state changed, parent rendered, context changed, hook deps changed
- `<Profiler>` `onRender` callback gives `actualDuration`, `baseDuration`, `phase`, `startTime`, `commitTime`
- Budget components: interactive (16ms), display (32ms), heavy viz (50ms), background (100ms)
- React 19 improves TBT via transitions and TTI via selective hydration
- Common antipatterns: unvirtualized lists, deep trees, bad keys, wrong state location, unmemoized callbacks
- CI can catch performance regressions via Lighthouse CI, Profiler-based jest tests, or bundle size checks
- React Compiler fixes re-render cascades but does not fix algorithmic inefficiency — profile first, optimize second

## Common Misconception

**"A component that looks fast in dev will be fast in production."**

Dev mode inflates render times 2-5x. Conversely, production can be slower due to GC, minification overhead, or third-party scripts absent in dev. Always profile production builds. Use `react-dom/profiling` entry for accurate `<Profiler>` measurements. Dev profiling finds *structural* problems (which component re-renders unnecessarily); production profiling finds *timing* problems (how long does each render actually cost the user).

---

## Feynman Explain
(Explain flamegraphs to a junior developer who knows React basics but has never opened the Profiler. Use a restaurant kitchen analogy: orders as state updates, chefs as components, time as render duration. Explain why one chef doing unnecessary work (re-render) slows down the whole kitchen. No DevTools API names — just the concept of visualizing where time goes.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain advanced-react-19` — AI probes gaps.*

---

## Reframe
(Pause. Evaluate: Is per-component render budget an anti-pattern? When does optimizing for 16ms per component become premature optimization? The real bottleneck is often network, third-party scripts, or layout thrashing — not React rendering. Write cases where profiling React components misleads you into optimizing the wrong layer of the stack.)

---

## Drill
Take the quiz. MCQs test Profiler interpretation, budget decisions, and regression detection.

Run: `learn.sh quiz advanced-react-19 16-profiling`
