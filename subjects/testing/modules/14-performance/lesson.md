# Module 14: Performance Testing in React

Est. study time: 2h
Language: en
Description: Test rendering performance, large list handling, timer mocking, and prevent regressions.

## Learning Objectives
- Assert render count to detect unnecessary re-renders
- Test large list rendering without performance degradation
- Mock timers for interval/timeout-based components
- Profile component rendering in test environments

---

## Core Content

### 14.1 Render Count Assertions

Detect unnecessary re-renders by counting how many times a component renders.

```typescript
import { render } from '@testing-library/react'

function TrackRenders({ name }: { name: string }) {
  const renderCount = useRef(0)
  renderCount.current++

  return (
    <div>
      {name} rendered {renderCount.current} times
    </div>
  )
}

test('renders once on mount', () => {
  render(<TrackRenders name="test" />)
  expect(screen.getByText(/rendered 1 times/)).toBeInTheDocument()
})
```

**Using wrapper to count renders:**

```typescript
// test-utils/render-tracker.ts
export function createRenderTracker() {
  const counts = new Map<string, number>()

  function Tracked({ id, children }: { id: string; children: React.ReactNode }) {
    counts.set(id, (counts.get(id) || 0) + 1)
    return <>{children}</>
  }

  return { counts, Tracked }
}

// test
test('list items do not re-render on unrelated store update', () => {
  const { counts, Tracked } = createRenderTracker()

  useCourseStore.setState({ courses: { '1': { id: '1', title: 'Course' } } })
  render(
    <div>
      {Object.values(useCourseStore.getState().courses).map(c => (
        <Tracked key={c.id} id={c.id}>
          <div>{c.title}</div>
        </Tracked>
      ))}
    </div>
  )

  // Trigger unrelated store update
  act(() => { useSettingsStore.setState({ theme: 'dark' }) })

  expect(counts.get('1')).toBe(1) // Should NOT have re-rendered
})
```

> **Think**: When would you use render count assertions in practice?
>
> *Answer: When optimizing components with useMemo/React.memo/Callback. Before: count renders. After optimization: assert count decreased. Also useful for detecting missing key props in lists.*

### 14.2 React.memo and useMemo Testing

Test that memoization prevents unnecessary re-renders.

```typescript
const ExpensiveList = React.memo(function ExpensiveList({ items }: { items: string[] }) {
  return (
    <ul>
      {items.map(item => <li key={item}>{item}</li>)}
    </ul>
  )
})

test('memo prevents re-render when props are unchanged', () => {
  const renderSpy = vi.fn()
  const TrackedList = React.memo(function Tracked({ items }: { items: string[] }) {
    renderSpy()
    return <ExpensiveList items={items} />
  })

  const { rerender } = render(<TrackedList items={['a', 'b']} />)
  expect(renderSpy).toHaveBeenCalledTimes(1)

  rerender(<TrackedList items={['a', 'b']} />) // Same props reference
  expect(renderSpy).toHaveBeenCalledTimes(1) // No re-render — memo works!
})

test('memo re-renders when props change', () => {
  const renderSpy = vi.fn()
  const TrackedList = React.memo(function Tracked({ items }: { items: string[] }) {
    renderSpy()
    return <ExpensiveList items={items} />
  })

  const { rerender } = render(<TrackedList items={['a']} />)
  rerender(<TrackedList items={['b']} />) // Different props

  expect(renderSpy).toHaveBeenCalledTimes(2)
})
```

**Testing useMemo:**

```typescript
function useFilteredCourses(courses: Course[], filter: string) {
  const filtered = useMemo(
    () => courses.filter(c => filter === 'all' || c.status === filter),
    [courses, filter]
  )
  return filtered
}

test('useMemo returns same reference when deps unchanged', () => {
  const courses = [
    { id: '1', status: 'published' },
    { id: '2', status: 'draft' },
  ] as Course[]

  const { result, rerender } = renderHook(
    ({ courses, filter }) => useFilteredCourses(courses, filter),
    { initialProps: { courses, filter: 'all' } }
  )

  const firstResult = result.current

  rerender({ courses, filter: 'all' }) // Same deps

  expect(result.current).toBe(firstResult) // Same reference — memoized!
})
```

> **Think**: What's more important — testing that memo works or testing that the component renders correctly with different data?
>
> *Answer: Render correctness is primary. Memo optimization is secondary — test it only when you've identified re-renders as a performance bottleneck.*

### 14.3 Large List Performance

Test that large lists render efficiently.

```typescript
function generateItems(count: number): Item[] {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i),
    title: `Item ${i}`,
    description: `Description for item ${i}`,
  }))
}

test('renders 1000 items without crashing', () => {
  const items = generateItems(1000)
  render(<List items={items} />)

  const listItems = screen.getAllByRole('listitem')
  expect(listItems).toHaveLength(1000)
})

test('renders 10000 items within 2 seconds', () => {
  const items = generateItems(10000)

  const start = performance.now()
  render(<List items={items} />)
  const duration = performance.now() - start

  expect(duration).toBeLessThan(2000)
  expect(screen.getAllByRole('listitem')).toHaveLength(10000)
})
```

**Testing virtualization (windowed lists):**

```typescript
// Component using react-window or similar
test('only renders visible items', () => {
  const items = generateItems(10000)
  const { container } = render(
    <FixedSizeList
      height={400}
      itemCount={items.length}
      itemSize={50}
      width={300}
    >
      {({ index, style }) => (
        <div style={style}>{items[index].title}</div>
      )}
    </FixedSizeList>
  )

  // Should render ~8-10 items (400px / 50px per item)
  const renderedItems = container.querySelectorAll('[style]')
  expect(renderedItems.length).toBeLessThan(20)
  expect(renderedItems.length).toBeGreaterThan(5)
})
```

> **Think**: Why is render timing assertion (renders within 2s) useful but potentially flaky?
>
> *Answer: Timing depends on test machine speed. Useful as a performance regression guard (if it was <500ms and now >2000ms, something changed). Flaky when CI is slower — use generous thresholds or only test locally.*

### 14.4 Timer Mocking

Components using setTimeout, setInterval, or requestAnimationFrame need fake timers.

```typescript
function AutoSave({ onSave }: { onSave: () => void }) {
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!dirty) return
    const id = setTimeout(() => {
      onSave()
      setDirty(false)
    }, 3000)

    return () => clearTimeout(id)
  }, [dirty, onSave])

  return (
    <button onClick={() => setDirty(true)}>Edit</button>
  )
}

describe('AutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('saves after 3 seconds of no edits', async () => {
    const onSave = vi.fn()

    render(<AutoSave onSave={onSave} />)
    await user.click(screen.getByText('Edit'))

    act(() => { vi.advanceTimersByTime(3000) })

    expect(onSave).toHaveBeenCalledTimes(1)
  })

  test('does not save if user continues editing', async () => {
    const onSave = vi.fn()

    render(<AutoSave onSave={onSave} />)
    await user.click(screen.getByText('Edit'))

    // Advance 2s, then edit again (resets timer)
    act(() => { vi.advanceTimersByTime(2000) })
    await user.click(screen.getByText('Edit'))

    // Advance 4s — the 2nd timer should fire, not the 1st
    act(() => { vi.advanceTimersByTime(4000) })

    expect(onSave).toHaveBeenCalledTimes(1) // Only the 2nd timer
  })
})
```

**Testing polling patterns:**

```typescript
function usePolling(fetchFn: () => Promise<void>, intervalMs = 5000) {
  useEffect(() => {
    const id = setInterval(fetchFn, intervalMs)
    fetchFn() // Initial fetch
    return () => clearInterval(id)
  }, [fetchFn, intervalMs])
}

test('polls at specified interval', () => {
  vi.useFakeTimers()
  const fetchFn = vi.fn().mockResolvedValue(undefined)

  renderHook(() => usePolling(fetchFn, 5000))
  expect(fetchFn).toHaveBeenCalledTimes(1) // Initial fetch

  act(() => { vi.advanceTimersByTime(5000) })
  expect(fetchFn).toHaveBeenCalledTimes(2) // After one interval

  act(() => { vi.advanceTimersByTime(10000) })
  expect(fetchFn).toHaveBeenCalledTimes(4) // Two more intervals

  vi.useRealTimers()
})
```

> **Think**: What happens if you forget to call vi.useRealTimers() in afterEach?
>
> *Answer: Fake timers leak to subsequent tests. Those tests' setTimeout/setInterval never fire, causing timeouts. Always restore real timers after each test block.*

### 14.5 Profiling in Test Environment

Vitest can profile component rendering.

```typescript
import { Profiler } from 'react'

test('profile component render time', () => {
  const onRender = vi.fn()
  const items = generateItems(100)

  render(
    <Profiler id="list" onRender={onRender}>
      <List items={items} />
    </Profiler>
  )

  expect(onRender).toHaveBeenCalledTimes(1)
  const [, phase, actualDuration] = onRender.mock.calls[0]
  // Profiler callback: (id, phase, actualDuration, baseDuration, startTime, commitTime, interactions)
  // actualDuration: time spent rendering this component and its children (ms)
  // baseDuration: estimated time if no memoization
  expect(phase).toBe('mount')
  // actualDuration should be reasonable (e.g., < 100ms)
})
```

---

## Why This Matters

Performance tests catch regressions before users notice them. Render count assertions, timer mocking, and large list testing ensure your app stays fast as it grows.

---

## Common Questions

**Q: When should I add performance tests?**
A: After identifying a performance bottleneck. Don't add performance tests preemptively — they add maintenance cost for marginal benefit.

**Q: Are render count assertions flaky?**
A: They can be if your test setup triggers unexpected re-renders (strict mode double-render, store subscriber callbacks). Isolate the component being measured.

**Q: Can I test FPS in vitest?**
A: No — vitest uses jsdom which doesn't render pixels. Use Playwright for visual/FPS testing.

---

## Key Takeaways

- Assert render count to verify memoization works
- Test large lists render without crash (1000+ items)
- Test virtualized lists render only visible items
- Mock timers with vi.useFakeTimers for setTimeout/setInterval tests
- Always restore real timers in afterEach
- Use React Profiler for rendering time assertions

---

## Common Misconception

**"If tests pass, the component is performant enough."**

Tests verify correctness, not performance. A component that renders 200 times and still shows correct data will pass behavioral tests. Performance tests are separate concerns.

---

## Feynman Explain

(Explain how you'd test that a search component debounces input. What timing pattern do you use? How do you verify the API is called only once after typing stops?)

---

## Drill

Run: `learn.sh quiz testing 14`
