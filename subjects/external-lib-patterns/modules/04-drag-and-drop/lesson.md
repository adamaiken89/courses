# Module 4: Drag & Drop — dnd-kit

Est. study time: 2h
Language: en

## Learning Objectives
- Design DnD abstraction compatible with dnd-kit, react-beautiful-dnd, and Pragmatic DnD
- Implement sortable lists, multi-container DnD, and drag overlays with clean separation
- Manage DnD state (order, placement) external to library
- Architect accessible DnD with keyboard navigation and screen reader support

---

## Core Content

### DnD Library Landscape

| Library | Bundle | API Style | Key Feature |
|---------|--------|-----------|-------------|
| dnd-kit | ~15KB | Hooks + Providers | Modular, accessible, tree DnD |
| @hello-pangea/dnd | ~12KB | Component | Fork of react-beautiful-dnd, simpler API |
| Pragmatic DnD (Atlassian) | ~20KB | Hooks + Inspector | First-class table DnD, cross-frame |
| react-beautiful-dnd | ~11KB | Component | Deprecated — no longer maintained |

dnd-kit is current best choice: active maintenance, flexible API, accessibility built-in.

### Core dnd-kit Architecture

dnd-kit uses three primitives:

- `DndContext`: Provider that manages drag state
- `useDraggable`: Makes element draggable
- `useDroppable`: Makes element droppable
- `useSortable`: Combines draggable + droppable for sortable lists (most common)

```typescript
// Direct usage (before abstraction)
function SortableList() {
  const [items, setItems] = useState(['A', 'B', 'C'])
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setItems(items => arrayMove(items, items.indexOf(active.id), items.indexOf(over.id)))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        {items.map(id => <SortableItem key={id} id={id} />)}
      </SortableContext>
      <DragOverlay />
    </DndContext>
  )
}
```

### Wrapper Abstraction

app-level DnD abstraction:

```typescript
type DnDItem = { id: string; [key: string]: unknown }

interface DnDState {
  items: DnDItem[]
  activeId: string | null
  overId: string | null
}

interface DnDActions {
  onDragStart: (id: string) => void
  onDragEnd: (result: { source: { index: number; container: string }; destination: { index: number; container: string } | null }) => void
  onDragCancel: () => void
}
```

Wrapper maps dnd-kit events to app-level DnDState:

```typescript
function useAppDnD(items: DnDItem[], onReorder: (items: DnDItem[]) => void) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex(i => i.id === active.id)
    const newIndex = items.findIndex(i => i.id === over.id)
    onReorder(arrayMove(items, oldIndex, newIndex))
  }, [items, onReorder])

  return { activeId, handleDragStart, handleDragEnd }
}
```

Consumer: `const { activeId, handleDragStart, handleDragEnd } = useAppDnD(items, setItems)`. Library detail hidden.

> **Think**: `useAppDnD` returns dnd-kit's `DragStartEvent` and `DragEndEvent` types. Is this a leaky abstraction?
>
> *Answer: Yes — but pragmatically necessary. Wrapping every event property would create mirror interface that adds no value. Better: expose minimal normalized event shape (`{ id, overId, activatorEvent }`) inside wrapper.*

### Multi-Container DnD (Kanban)

Kanban boards have multiple containers. dnd-kit handles via multiple `SortableContext`s + collision detection:

```typescript
interface KanbanState {
  containers: Record<string, DnDItem[]>
  containerOrder: string[]
}

function KanbanBoard() {
  const [state, setState] = useState<KanbanState>({ containers: { backlog: [], progress: [], done: [] }, containerOrder: ['backlog', 'progress', 'done'] })

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const overContainer = over.data.current?.container ?? state.containerOrder[0]
    // Move item between or within containers
    setState(/* reorder logic */)
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      {state.containerOrder.map(id => (
        <SortableContext key={id} items={state.containers[id]} strategy={verticalListSortingStrategy}>
          {state.containers[id].map(item => <SortableItem key={item.id} id={item.id} />)}
        </SortableContext>
      ))}
    </DndContext>
  )
}
```

Abstraction: `useKanbanDnD(containers, onContainerMove, onItemMove, onContainerReorder)`.

### Accessibility

dnd-kit has built-in keyboard sensor. Screen reader announcements via `DndContext.announcements`.

Abstraction should not regress accessibility:

```typescript
<DndContext
  sensors={sensors}
  announcements={{
    onDragStart: (id) => `Started dragging item ${id}`,
    onDragOver: (id) => `Item ${id} was dragged over a droppable area`,
    onDragEnd: (id, over) => over
      ? `Item ${id} was dropped in position ${over.id}`
      : `Item ${id} was dropped. No destination`,
    onDragCancel: (id) => `Dragging was cancelled. Item ${id} returned to starting position`
  }}
  screenReaderInstructions={{
    draggable: 'Press space to start dragging. Use arrow keys to move. Press escape to cancel.'
  }}
>
```

Wrapper defaults sensible announcements. Consumers override if needed.

> **Think**: Screen reader support for DnD is often afterthought. Does DnD abstraction help or hurt accessibility by default?
>
> *Answer: Helps — if wrapper defaults to accessible configuration (keyboard sensor enabled, announcements set). Hurts — if wrapper strips dnd-kit's accessible defaults for simplicity. Always include accessibility in wrapper API.*

### Drag Overlay and Custom Feedback

Drag overlay shows item while dragging. dnd-kit's `DragOverlay` renders on top of everything via portal.

```typescript
function AppDragOverlay({ activeId, renderItem }: { activeId: string | null; renderItem: (id: string) => ReactNode }) {
  if (!activeId) return null
  return createPortal(
    <DragOverlay dropAnimation={dropAnimationConfig}>
      {renderItem(activeId)}
    </DragOverlay>,
    document.body
  )
}
```

Abstraction: wrapper includes `DragOverlay` with default drop animation. Consumer passes `renderItem`.

### React 19 Integration

React 19's ref as prop (forwardRef deprecated) simplifies accessing DnD sensor refs and imperative handles. Drag handlers previously wrapped in `useCallback` can benefit from React Compiler's auto-memoization — callbacks are memoized automatically, reducing unnecessary re-renders in drag-heavy UIs:

```typescript
function SortableList({ items }: { items: Item[] }) {
  const [ordered, setOrdered] = useState(items)

  // React Compiler auto-memoizes — no useCallback needed
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = ordered.findIndex(i => i.id === active.id)
    const newIndex = ordered.findIndex(i => i.id === over.id)
    setOrdered(arrayMove(ordered, oldIndex, newIndex))
  }

  return (
    <div ref={ref}>
      <DndContext onDragEnd={handleDragEnd}>
        ...
      </DndContext>
    </div>
  )
}
```

`useTransition` wraps drag-end state updates as low-priority, keeping drag interactions responsive during expensive re-renders:

```typescript
function KanbanBoard() {
  const [isPending, startTransition] = useTransition()

  function handleDragEnd(event: DragEndEvent) {
    startTransition(() => {
      // Reorder items — deferred until drag animation completes
      setItems(computeNewOrder(event, items))
    })
  }

  return (
    <div style={{ opacity: isPending ? 0.8 : 1 }}>
      <DndContext onDragEnd={handleDragEnd}>...</DndContext>
    </div>
  )
}
```

For sortable lists backed by async data (e.g., fetched from API), wrap the list in a `Suspense` boundary so loading state does not cascade into drag operations:

```typescript
function AsyncSortablePage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <SortableList items={use(fetchItems())} />
    </Suspense>
  )
}
```

---

### Why This Matters

DnD libraries change faster than most UI libraries. react-beautiful-dnd (most popular) is deprecated. dnd-kit has breaking API changes between majors. Pragmatic DnD is new and evolving. Good DnD abstraction lets you migrate between libraries in days, not weeks.

---

### Common Questions

**Q: dnd-kit vs @hello-pangea/dnd — which to wrap?**
A: dnd-kit is more flexible (tree DnD, multiple containers, custom collision detection). @hello-pangea/dnd is simpler (one pattern: sortable list). Wrap dnd-kit — if you need simpler API, build convenience layer on top.

**Q: How to handle DnD within a virtualized list?**
A: dnd-kit + TanStack Virtual: measure item sizes, use `MeasuringStrategy.Always` for dynamic heights. dnd-kit's `LayoutMeasuring` strategy must match virtualizer's measurement.

---

## Examples

### Example 1: Settings Panel with Reorderable Rows

**Problem**: App settings list of rules. User reorders by drag. Must save order to backend.

**Solution**:
```typescript
function RuleList() {
  const [rules, setRules] = useState<Rule[]>([])
  const { activeId, handleDragStart, handleDragEnd } = useAppDnD(rules, setRules)

  useEffect(() => {
    if (reorderMutation.isSuccess) { /* optimistic update done */ }
  }, [reorderMutation.isSuccess])

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} sensors={sensors}>
      <SortableContext items={rules} strategy={verticalListSortingStrategy}>
        {rules.map(rule => <SortableRule key={rule.id} rule={rule} />)}
      </SortableContext>
      <AppDragOverlay activeId={activeId} renderItem={id => <RulePreview rule={rules.find(r => r.id === id)} />} />
    </DndContext>
  )
}
```

### Example 2: Kanban Board with Persistence

**Problem**: Task board. Drag tasks between columns. Reorder columns. Persist to backend.

**Solution**: `useKanbanDnD` manages kanban state. Save on debounce: `useEffect(() => { const t = setTimeout(() => api.saveBoard(state), 1000); return () => clearTimeout(t) }, [state])`.

---

## Key Takeaways
- dnd-kit is current best choice — modular, accessible, active maintenance
- Abstract DnD state (activeId, overId, items) outside library internals
- Multi-container DnD (kanban): separate SortableContext per container, manage item movement in DragEnd handler
- Accessibility: enable keyboard sensor, set announcements, provide screen reader instructions
- Drag Overlay: portal-based, wrapper defaults drop animation, consumer provides renderItem

## Common Misconception

**"DnD is only about reordering lists."**

DnD covers: sortable lists, kanban boards, resizable panels, draggable elements between containers, file drop zones, tree reordering, and cross-window DnD. dnd-kit's modular sensor system and collision detection handle all these. Your abstraction should not assume list-only use cases.

---

## Feynman Explain
(Explain dnd-kit's sensor system and collision detection to a colleague who only knows react-beautiful-dnd. How is modularity better than single-component API?)

---

## Reframe
(Pause. DnD adds complexity — drag overlays, sensor configuration, collision detection. When should a sortable list use simple up/down buttons instead of drag? Consider: mobile support, accessibility compliance, development timeline.)

---

## Drill
Take the quiz. MCQs test library selection, wrapper design, multi-container DnD, and accessibility.

Run: `learn.sh quiz external-lib-patterns 04-drag-and-drop`
