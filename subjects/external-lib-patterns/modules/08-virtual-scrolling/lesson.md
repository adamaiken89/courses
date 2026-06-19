# Module 8: Virtual Scrolling — TanStack Virtual

Est. study time: 2h
Language: en

## Learning Objectives
- Design virtualizer abstraction supporting fixed, variable, and dynamic item sizes
- Integrate virtualizer with data fetching patterns (infinite scroll, cursor pagination)
- Implement sticky headers, RTL, and grid/table virtual scrolling
- Handle measurement, overscan, and scroll restoration with clean abstraction

---

## Core Content

### Problem: DOM Overload

Rendering 10k+ items as DOM nodes causes: long initial render (10k divs), scroll jank (reflow on every frame), high memory usage (10k DOM nodes ~5-20MB).

Virtual scrolling renders only visible items (typically 10-30 DOM nodes). Container has scrollbar sized to total content height. Visible items positioned absolutely.

### TanStack Virtual Architecture

```typescript
const virtualizer = useVirtualizer({
  count: items.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => 50,  // estimated item height in px
  overscan: 5  // extra items above/below viewport
})
```

Returns: `getVirtualItems()` — `VirtualItem[]` with `{ key, index, start, size, end }`.

Rendering:

```typescript
function VirtualList<T>({ items, renderItem, estimateSize }: Props<T>) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize
  })

  return (
    <div ref={scrollRef} style={{ height: 600, overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize() }}>
        <div style={{ transform: `translateY(${virtualizer.getVirtualItems()[0]?.start ?? 0}px)` }}>
          {virtualizer.getVirtualItems().map(item => (
            <div key={item.key} data-index={item.index} ref={virtualizer.measureElement}>
              {renderItem(items[item.index], item.index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

### Wrapper Abstraction

Consumer should not touch virtualizer API:

```typescript
interface VirtualListProps<T> {
  data: T[]
  renderItem: (item: T, index: number) => ReactNode
  itemSize?: number | ((index: number) => number)  // fixed or variable
  overscan?: number
  gap?: number
  scrollRef?: RefObject<HTMLDivElement>  // external scroll container
  onScroll?: (state: ScrollState) => void
  endReached?: () => void  // infinite scroll trigger
  endReachedThreshold?: number  // px from bottom
  stickyIndices?: number[]  // indices of sticky items
  rtl?: boolean
}

interface ScrollState {
  scrollTop: number
  scrollLeft: number
  isScrolling: boolean
  visibleRange: [number, number]  // start, end index
  totalSize: number
}
```

Wrapper implements all virtualizer configuration. Consumer provides data + render function.

> **Think**: Wrapper hides TanStack Virtual entirely. Consumer cannot access virtualizer instance for measurements. Good or bad?
>
> *Answer: Good for 80% use cases. Provide optional `onVirtualizerReady?: (virtualizer: Virtualizer) => void` callback for advanced use (scrollToIndex, getTotalSize custom logic).*

### Dynamic Item Sizes

Fixed sizes are simple. Variable sizes need measurement after render.

TanStack Virtual: `measureElement` ref callback + `measure()` after content load:

```typescript
function DynamicSizeList<T>({ data, renderItem }: VirtualListProps<T>) {
  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 100,  // initial estimate
    measureElement: (el) => el.getBoundingClientRect().height  // measure after render
  })

  // Re-measure after data loads (images, async content)
  useEffect(() => {
    virtualizer.measure()
  }, [data])
}
```

Abstraction: `itemSize` prop accepts `'auto'` (measure after render), number (fixed), or `(index) => number` (known variable).

> **Think**: Measuring after render causes layout shift. How to minimize?
>
> *Answer: Provide accurate estimateSize (average item height). Measure only once (cache measured sizes). Re-measure only when item content changes detectably (key change).*

### Infinite Scroll

Infinite scroll = virtual scroll + data fetching on reaching end:

```typescript
function useInfiniteVirtualScroll<T>(fetchMore: () => Promise<T[]>, options: { pageSize: number; threshold?: number }) {
  const [items, setItems] = useState<T[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)

  const endReached = useCallback(async () => {
    if (loading || !hasMore) return
    setLoading(true)
    const newItems = await fetchMore()
    setItems(prev => [...prev, ...newItems])
    setHasMore(newItems.length === options.pageSize)
    setLoading(false)
  }, [loading, hasMore, fetchMore, options.pageSize])

  return { items, hasMore, loading, endReached }
}
```

Combined: `VirtualList` with `endReached` trigger. Data loading decoupled from virtual scroll concerns.

> **Think**: Infinite scroll and virtual scroll together create edge cases: scroll position jumps when new items prepended (chat), items removed from middle (real-time list). How to handle?
>
> *Answer: For prepended items: calculate offset adjustment = sum of new item heights, apply to scroll position via scrollRef. For removed items: virtualizer handles automatically — it re-indexes on count change. Cache scroll position before data mutation.*

### Table Virtualization

TanStack Virtual works with tables too:

```typescript
function VirtualTable<T>({ columns, data }: TableProps<T>) {
  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => tableRef.current,
    estimateSize: () => 40
  })

  return (
    <div ref={tableRef} style={{ height: 600, overflow: 'auto' }}>
      <table>
        <thead style={{ position: 'sticky', top: 0 }}>{/* header */}</thead>
        <tbody style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map(item => (
            <tr key={item.key} style={{ transform: `translateY(${item.start}px)`, position: 'absolute', width: '100%' }}>
              {/* cells */}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

### Scroll Restoration

When navigating back, restore scroll position:

```typescript
function useScrollRestoration(key: string, scrollRef: RefObject<HTMLDivElement>, itemCount: number) {
  const restored = useRef(false)

  useEffect(() => {
    if (restored.current) return
    const saved = sessionStorage.getItem(`scroll-${key}`)
    if (saved && scrollRef.current) {
      scrollRef.current.scrollTop = parseInt(saved, 10)
    }
    restored.current = true
  }, [key])

  useEffect(() => {
    return () => {
      if (scrollRef.current) {
        sessionStorage.setItem(`scroll-${key}`, String(scrollRef.current.scrollTop))
      }
    }
  }, [key, scrollRef])

  // Alternative: scroll to specific item index
  const scrollToIndex = useCallback((index: number, align: 'start' | 'center' | 'end' = 'start') => {
    virtualizerRef.current?.scrollToIndex(index, { align })
  }, [])
}

### React 19: Virtual Scrolling & Concurrent Rendering

React 19 ref as prop simplifies virtualizer instance access — pass virtualizerRef directly instead of `forwardRef`. Use `useTransition` for scroll-to-index navigation to keep UI responsive during programmatic scroll:

```typescript
function useScrollToIndex(virtualizer: Virtualizer) {
  const [isPending, startTransition] = useTransition()

  const scrollTo = useCallback((index: number) => {
    startTransition(() => {
      virtualizer.scrollToIndex(index, { align: 'start' })
    })
  }, [virtualizer])

  return { scrollTo, isPending }
}
```

React Compiler auto-memoizes row renderers — no manual `useMemo` for row components. Suspense boundaries enable lazy-loaded row content: combine `IntersectionObserver` with `React.lazy` for above-fold prioritization. Concurrent rendering improves scroll performance with large lists by splitting work across frames.

---

### Why This Matters

Virtual scrolling is the difference between "app works with 100 items" and "app works with 100k items." Every app with lists should use virtual scrolling from the start — adding it later requires rewriting list rendering. Clean abstraction means lists are virtual-by-default.

---

### Common Questions

**Q: When should I NOT use virtual scrolling?**
A: When list has <100 items and rendering all is fine. When items have highly variable heights and measuring is unreliable (rich text previews). When list is inside scrollable parent that cannot be controlled.

**Q: How to handle animated item enter/exit?**
A: Use `animatePresence` (Framer Motion) with virtual scrolling requires care. Solution: overlay animations on top of virtualized container using absolute positioning and portal. Virtualizer items should not animate layout.

**Q: How does React 19 improve virtual scrolling performance?**
A: useTransition keeps scroll-to-index responsive during heavy renders. React Compiler auto-memoizes row renderers — no manual React.memo needed. Suspense boundaries for lazy row content reduce initial render cost. Concurrent rendering splits large list work across animation frames, reducing jank.

**Q: Should virtualizer instance use ref as prop in React 19?**
A: Yes. React 19 ref as prop eliminates forwardRef wrapper. Pass virtualizerRef directly to VirtualList. `function VirtualList({ virtualizerRef, ...props })`. Virtualizer instance accessible on `virtualizerRef.current` after mount.

---

## Examples

### Example 1: Chat Message List

**Problem**: Chat app with 50k messages. New messages prepended on scroll-to-top (older messages loaded). Must maintain scroll position.

**Solution**: VirtualList with `onScrollToTop` callback. On prepend: `scrollRef.current.scrollTop += newMessagesHeight`. Virtualizer re-measures. Scroll position stable.

### Example 2: Analytics Data Table

**Problem**: Table with 100k rows, 20 columns, inline editing, row selection.

**Solution**: TanStack Table + TanStack Virtual. VirtualList wrapper renders rows. Table header sticky. Row selection data external. Edit state per row managed by grid wrapper.

---

## Key Takeaways
- Virtual scrolling renders only visible items — essential for 1k+ items
- TanStack Virtual: `useVirtualizer` with count, scroll element, estimate size
- Wrapper hides virtualizer API — consumer provides data + render function
- Dynamic sizes: measure after render via `measureElement`, provide good estimate
- Infinite scroll: `endReached` callback, data fetching separate from virtual scroll
- Scroll restoration: save position before unmount, restore on mount

## Common Misconception

**"Virtual scrolling works automatically with any list."**

Virtual scrolling requires: fixed container height, scrollable element you control, consistent item size (or measurement). Lists inside flex/grid layouts, height: auto containers, or items with collapsible sections need configuration. Not all lists can be virtualized — test early.

---

## Feynman Explain
(Explain virtual scrolling to a junior developer. Use analogy: movie theater marquee — only the visible poster is lit; others are just names on a roll behind it.)

---

## Reframe
(Pause. Virtual scrolling adds complexity: measurement, overscan, scroll restoration. For an app with 500 items max, does virtual scrolling pay off? When is pagination simpler and better UX?)

---

## Drill
Take the quiz. MCQs test virtualizer concepts, dynamic sizing, infinite scroll integration, scroll restoration, and table virtualization.

Run: `learn.sh quiz external-lib-patterns 08-virtual-scrolling`
