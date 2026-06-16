# Module 14: Render Pipeline Internals — Fiber, Reconciliation, Bailout

Est. study time: 2.5h
Language: en

## Learning Objectives
- Trace React render pipeline from trigger to paint: trigger → render phase → commit phase → effects
- Explain Fiber node structure and how it enables concurrent rendering
- Determine when React bails out of a subtree vs re-renders
- Diagnose unnecessary re-renders using DevTools flamegraph

---

## Core Content

### Fiber Architecture — What Fiber Nodes Represent

React 16+ replaced stack reconciler with Fiber. Fiber node = unit of work. Each component instance gets fiber object containing:

```typescript
interface Fiber {
  tag: WorkTag           // HostComponent, FunctionComponent, etc.
  key: string | null     // key prop for list reconciliation
  type: any              // component function, class, element string
  stateNode: any         // DOM node, class instance, or null for function
  child: Fiber | null    // first child fiber
  sibling: Fiber | null  // next sibling (sibling linked list)
  return: Fiber | null   // parent fiber
  pendingProps: any      // new props incoming
  memoizedProps: any     // props from last render
  memoizedState: any     // hooks state from last render
  updateQueue: any       // effect list, state updates
  flags: Flags           // side effects to perform during commit
  lanes: Lanes           // priority level for this work
  alternate: Fiber | null // previous version (double buffering)
}
```

Tree structure = linked list of fibers. `child` goes down, `sibling` goes across, `return` goes up. This flattened structure lets React pause/resume work without call stack.

```
div (host)
└── App (function component)
    └── child → sibling → sibling
        (sibling linked list across component tree)
```

> **Think**: Why does React use a linked list instead of recursive tree traversal? What feature does linked list enable that recursion blocks?
>
> *Answer: Recursion uses call stack — cannot pause mid-traversal. Linked list stores work-in-progress pointer. React can pause after processing one fiber, check if urgent work arrived (user input, animation frame), resume later. This is foundation of concurrent rendering.*

**Double buffering**: React builds `workInProgress` tree from `current` tree via `alternate` pointers. On commit, `workInProgress` becomes `current`. Enables aborting partial work without tearing what user sees.

### Render Phase vs Commit Phase

**Render phase** (can be async/interrupted):
1. Walk fiber tree, collect work
2. Call component functions
3. Diff children (reconciliation)
4. Tag fibers with flags (Insert, Update, Delete, Ref, Passive, etc.)
5. Pure computation — no DOM mutations
6. Can be interleaved: Fiber A processed → urgent update → Fiber B processed later

**Commit phase** (synchronous, cannot be interrupted):
1. Walk effect list (fibers with non-zero flags)
2. Mutate DOM (appendChild, removeChild, setAttribute)
3. Process refs (detach old, attach new)
4. Schedule passive effects (useEffect)
5. Synchronously fire layout effects (useLayoutEffect)
6. Paint

> **Think**: You see a React component that reads `getBoundingClientRect` during render. Is this safe? What could break?
>
> *Answer: Unsafe. Render phase may be paused, resumed, or discarded during concurrent rendering. Reading layout forces synchronous layout. Use `useLayoutEffect` for DOM measurements — runs after commit, guaranteed finished DOM.*
>
> React DevTools marks render phase in flamegraph. Commit phase is visible as thin bar. Wide commit bar = expensive DOM mutations.

### Reconciliation — Diffing Algorithm

Reconciliation = React's algorithm to determine what changed between `current` tree and `workInProgress` tree.

**Rules**:
1. **Type-based matching**: Same position, same type = update existing DOM node. Different type = destroy + rebuild.
2. **Key-based matching**: Same key = reuse DOM node even if position changed.
3. **Position fallback**: No key = match by index in children array.

```typescript
// Type mismatch — destroys <Counter>, mounts <Display>
// Before:
<div>
  <Counter count={5} />
</div>
// After:
<div>
  <Display count={5} />
</div>
// Result: Counter unmounted, Display mounted from scratch
```

```typescript
// Key-based — reorders without destroying
// Before:
<ul>
  <li key="a">A</li>
  <li key="b">B</li>
</ul>
// After:
<ul>
  <li key="b">B</li>
  <li key="a">A</li>
</ul>
// Result: same DOM nodes, just reordered
```

> **Think**: List with 100 items re-renders every keystroke in search input. No key prop. What happens? Why?
>
> *Answer: React matches by index. Every keystroke creates 100 new `<li>` elements. Old elements destroyed, new mounted. All state, DOM, and effects reset per item. In a real app this causes input focus loss, flicker, and performance collapse. Index-as-key has same effect if items can reorder.*

**Key rules**:
- Use stable, unique IDs. Not index. Not random.
- Keys must be consistent across renders for same item.
- Only meaningful inside arrays. Single child does not need key.

### Bailout — When React Skips Subtrees

Bailout = React decides a subtree does not need re-rendering. Happens when all conditions met:

1. **Same props** (old props shallow-equal new props)
2. **Same state** (no state update queued for this fiber)
3. **Same context** (context value unchanged for consumed context)
4. **No forced update** (`forceUpdate` or `this.forceUpdate` not called)
5. **Parent did not bail out** (if parent bails, children auto-bail)

```typescript
function ExpensiveTree({ items }: { items: string[] }) {
  return items.map(item => <Leaf key={item} item={item} />)
}
// ExpensiveTree re-renders even if items array is same reference?
// Yes — unless wrapped in React.memo.
```

`React.memo` adds shallow prop comparison. Without it, component re-renders whenever parent re-renders. Bailout check happens at fiber level before rendering component function.

> **Think**: Parent re-renders with same props for child. `React.memo` wrapped. Does React still call the child's component function? How does Performance tab show this?
>
> *Answer: No. Bailout check runs before calling function. React compares `pendingProps` vs `memoizedProps` (shallow equal). If props unchanged, no state updates, no context change, child fiber marked bailed-out. In DevTools flamegraph, bailed-out components appear as greyed-out or invisible — no render time allocated.*

**Context and bailout**: Context consumers cannot bail out if context value changed (even if component wrapped in `React.memo`). State update in provider changes `.value` → all consumers re-render. Mitigations:
- Split context into separate providers (auth vs theme vs locale)
- `useMemo` for context value to avoid unnecessary consumer re-renders
- Selector patterns: `useContextSelector` (third-party)

### Work Loop — How React Processes Fiber Tree

React's work loop = `workLoopConcurrent` / `workLoopSync`. Responsible for processing fiber tree in units of work.

```typescript
function workLoopConcurrent() {
  while (workInProgress !== null && !shouldYield()) {
    performUnitOfWork(workInProgress)
  }
}
```

**Per-unit-of-work**:
1. `beginWork`: evaluate fiber, diff children, return child to process
2. If child exists → `workInProgress = child` (depth-first)
3. If no child → `completeUnitOfWork`: move up sibling chain
4. Repeat until root reached or deadline expires

**`shouldYield`**: checks `yieldInterval` or `requestIdleCallback` analog. If browser needs to paint or urgent input pending, React yields control.

> **Think**: Component tree renders in 35ms. Browser frame budget = 16.6ms. What happens?
>
> *Answer: React splits work across multiple frames. `shouldYield` returns true after ~5ms of work. React yields, browser paints, then resumes next fiber. Each frame processes part of tree. User sees no jank. Without concurrent mode, entire 35ms blocks paint — visible frame drop.*

React schedules resumption via `scheduleCallback` (Scheduler). Priority levels:

| Priority | Used for |
|----------|----------|
| Immediate | Click, keydown |
| UserBlocking | scroll, mouseover |
| Normal | Transition updates |
| Low | Data prefetch |
| Idle | Pre-render off-screen |

### Child Reconciliation — Single Child, Array, Keyed Lists

React's `reconcileChildren` handles three patterns:

**Single child**: direct comparison. New child same type & key as old child → update in place. Different → delete old, create new.

```typescript
// Single child — simple update
// Old: <Card title="old" />
// New: <Card title="new" />
// React: same type, same position → update props on existing DOM
```

**Array children (no keys)**: position-based matching. Old[0] vs New[0], Old[1] vs New[1]. Insertion at start shifts all positions → all DOM nodes mismatched → re-creation.

**Keyed lists**: `reconcileChildrenArray` builds key-to-fiber map. Steps:
1. Iterate new children, match by key from map
2. If key found → reuse fiber, move if position changed
3. If key not found → create new fiber
4. Remaining old fibers without match → delete
5. Optimized for appending: matching suffix detected, only new ones created

> **Think**: List of 10 items. You insert one at index 0. Compare: no key vs stable keys. How many DOM operations each?
>
> *Answer: No key: 10 destroy + 11 create = 21 ops. Stable key: 10 move + 1 create = 11 ops. Key diff is cheaper than destroy/recreate. Move only updates parent's appendChild order — no layout recomputation.*

### Effects — Passive vs Layout, Order, Cleanup

Effects processed in commit phase. Two categories:

**Layout effects** (`useLayoutEffect`):
- Fire synchronously after DOM mutations, before paint
- Read layout, measure DOM, coordinate animations
- Block paint if expensive
- Order: parent → child (depth-first with `runLayoutEffects`)

**Passive effects** (`useEffect`):
- Fire asynchronously after paint
- Do not block visual update
- For side effects: subscriptions, network, logging
- Scheduled via Scheduler as Normal priority

```typescript
function Parent() {
  useLayoutEffect(() => console.log('parent layout'), [])
  useEffect(() => console.log('parent passive'), [])
  return <Child />
}
function Child() {
  useLayoutEffect(() => console.log('child layout'), [])
  useEffect(() => console.log('child passive'), [])
}
// Console:
// parent layout
// child layout
// paint
// parent passive
// child passive
```

**Cleanup order**: React runs unmount effects parent → child (top-down). This is reverse of mount order (child → parent).

> **Think**: Widget mounts `useEffect` subscription. User navigates away. Does React fire cleanup before or after next component's effects? What if cleanup is sync and new effect is async?
>
> *Answer: Cleanup runs before new effects. React processes cleanup for unmounting fibers, then mount effects for new fibers. Cleanup is synchronous within the same commit. Passive effect cleanup runs before next passive effects — in older concurrent mode, cleanup may fire separately from paint. In React 19, passive effect cleanup is scheduled after paint but before next passive effects.*

### Ref Processing During Commit Phase

Refs processed in three stages during commit:

1. **Detach old refs** (before mutation):
   - Set `current` to null for `useRef`
   - Call callback ref with null
2. **DOM mutations** (during mutation):
   - appendChild, removeChild, setTextContent, etc.
3. **Attach new refs** (after mutation, before layout effects):
   - Set `current` to DOM node for `useRef`
   - Call callback ref with DOM node

```typescript
function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // During commit:
  // 1. canvasRef.current = null (detach old)
  // 2. DOM: mount <canvas> to document
  // 3. canvasRef.current = <HTMLCanvasElement> (attach new)
  return <canvas ref={canvasRef} />
}
```

**Callback ref timing**: React 19 detaches old callback ref (null argument) before mutation, attaches new callback ref after mutation. If callback ref triggers re-render — React schedules synchronous re-render within commit.

> **Think**: Callback ref calls `setState` inside. What render behavior does this cause in React 19?
>
> *Answer: Synchronous re-render within commit phase. `setState` in callback ref schedules sync commit. This is considered legacy behavior. React 19 flushes these synchronously, meaning parent sees stale state until next frame. Avoid `setState` in callback refs — use `useLayoutEffect` instead.*

### React 19 Pipeline Changes — Concurrent Features in Fiber

React 19 integrates concurrent features deeper into fiber pipeline:

1. **`use()` hook during render**: calls `use(promise)` or `use(context)` in render phase. Suspends fiber if promise pending. No separate `useEffect` needed.

2. **Actions in fiber**: `useActionState` creates dedicated fiber state for pending/error/success. Commit phase checks action status for optimistic updates.

3. **Compiler-generated fiber flags**: React Compiler annotates fibers with `NeedsMemoization` flag. Commit phase skips memoized subtrees faster — no runtime prop comparison.

4. **`ref` as prop**: No `forwardRef` wrapper → Fiber `tag` no longer `ForwardRef`. Simpler fiber tree. `ref` appears in `pendingProps` of FunctionComponent fiber directly.

5. **Enhanced bailout detection**: React 19 context bailout checks more granular — only consumers of changed context re-render, not entire subtree below provider.

> **Think**: React 19 `use()` reads context inside component body. Fiber now needs to associate a `use()` call with context consumer. How does this affect bailout logic?
>
> *Answer: `use(Context)` registers same context dependency as `useContext(Context)`. If context value changes, fiber cannot bail out even if props and state unchanged. Fiber dependency list now includes `use()` context reads alongside `useContext`. Bailout check iterates both lists.*

### Profiling Render Pipeline with DevTools

React DevTools Profiler records per-fiber render duration and commit metadata.

**Flamegraph interpretation**:
- Each bar = one component render (render phase)
- Bar width = time spent in that component + its children
- Gray bars = committed components (visible in UI)
- Colored segments in bar = self time vs child time
- Commit bar at bottom = all DOM mutations

**Profiling tips**:
1. Record interaction (click, input) to isolate one render
2. Look for wide bars in non-leaf components — unnecessary sub-renders
3. Bailed-out components do not appear (render time = 0)
4. Check "Why did this render?" — shows changed props/state/context
5. Flamegraph with "Flamegraph" view (not "Ranked") shows component tree structure

```typescript
// Profiling workflow
// 1. Open DevTools → Profiler → Record
// 2. Interact with app
// 3. Stop recording
// 4. Click commit bar in timeline
// 5. Examine flamegraph: wide bars = optimization targets
// 6. Click component → "Why did this render?" panel
```

> **Think**: Flamegraph shows `<ExpensiveList>` took 40ms render time but it had same props. Why?
>
> *Answer: One of: (a) parent re-renders passed new object/array reference each time, (b) context value changed, (c) `useState` setter called with same value but React 19 still re-renders (use `React.memo` + stable props), (d) `useSyncExternalStore` triggered update. Check "Why did this render?" panel — it lists exact changed prop.*

---

### Why This Matters

Fiber is not theoretical — every render goes through reconciliation, every performance problem traces back to bailout failure, every async interaction depends on work loop yielding. Engineers who understand the pipeline diagnose re-render bugs in minutes. Engineers without this knowledge add random `React.memo` calls hoping something sticks. Render pipeline knowledge turns profiler output from mysterious colored bars into actionable optimization targets.

---

### Common Questions

**Q: Does React call component function if it bails out?**
A: No. Bailout check happens before function call. React compares `pendingProps` vs `memoizedProps`. If equal and no state/context change, React skips function entirely. DevTools shows these as no render time.

**Q: Does `useEffect` run in render phase or commit phase?**
A: Commit phase. `useEffect` fires asynchronously after paint. `useLayoutEffect` fires synchronously after DOM mutations but before paint. Both run after commit — never during render.

**Q: What happens if reconciliation removes a fiber mid-tree?**
A: React marks the fiber and its subtree for deletion (`ChildDeletion` flag). During commit phase, React unmounts in top-down order: runs cleanup effects, detaches refs, removes DOM. Unmounting is synchronous within the same commit.

**Q: Does `React.memo` prevent reconciliation of children?**
A: Yes — if wrapped component bails out (same props), React skips reconciling its children too. Whole subtree bails out. Only exception: context value changed for a consumer inside subtree.

**Q: Why does React need double-buffering (current + workInProgress)?**
A: So user always sees consistent UI. If React renders partially and then gets interrupted, current tree is still what user sees. Only when whole render completes and commits does current tree update. Without double buffering, partial renders would show incomplete UI.

---

## Examples

### Example 1: Diagnosing List Re-render with DevTools

**Problem**: Todo list app. Typing in search input causes entire `<TodoList>` to re-render. 500 items. Each keystroke lag.

**Diagnosis**:
1. Open Profiler, record typing interaction
2. Flamegraph shows wide `<TodoList>` bar
3. Click `<TodoList>` → "Why did this render?" shows: `filteredTodos` changed (new array reference)
4. Root cause: `filterTodos` creates new array each render — passed as prop

**Fix**: `useMemo` + stable reference:
```typescript
function TodoApp() {
  const [search, setSearch] = useState('')
  const todos = useQuery('/todos')
  const filteredTodos = useMemo(
    () => filterTodos(todos, search),
    [todos, search]
  )
  // filteredTodos is stable when search unchanged
  return (
    <>
      <input onChange={e => setSearch(e.target.value)} />
      <TodoList items={filteredTodos} />
    </>
  )
}
// Optionally wrap TodoList with React.memo for full bailout
const TodoList = React.memo(function TodoList({ items }: { items: Todo[] }) {
  return items.map(item => <TodoItem key={item.id} item={item} />)
})
```

**Result**: No re-render on keystroke. `TodoList` bails out because `items` reference unchanged until search changes.

### Example 2: Context Consumer Over-rendering

**Problem**: `useTheme` context provides dark mode boolean. 50 components consume it. Any state update anywhere causes all 50 to re-render even if theme unchanged.

**Root cause**: Context provider state update creates new object reference each time:
```typescript
function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState('light')
  // BUG: every render creates new value → ALL consumers re-render
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
```

**Fix**: `useMemo` for context value. Split read value vs setter into separate providers.
```typescript
function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState('light')
  const value = useMemo(() => ({ theme, setTheme }), [theme])
  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}
// Now consumers re-render only when theme actually changes (rare)
```

### Example 3: Concurrent Work Loop in Action

**Problem**: Heavy component tree renders in 50ms. User clicks button during render. In React 18 sync mode, click is queued until render finishes — 50ms lag. In React 19 concurrent, click interrupt is possible.

**Walkthrough**:
1. User types in input
2. Work loop processes fiber tree, yields after ~5ms (shouldYield → true)
3. Browser processes input event, schedules high-priority update
4. React switches to work-in-progress tree, processes input update
5. Input renders immediately (priority: Immediate)
6. Original render resumes as low-priority

**Code**: No manual code change needed. `startTransition` marks non-urgent updates as interruptible. React 19's `useTransition` and `flushSync` give explicit control.

---

## Key Takeaways
- Fiber is linked-list tree enabling pause/resume — foundation of concurrent rendering
- Render phase = pure computation, can be interrupted. Commit phase = DOM mutations, synchronous
- Reconciliation diffs by type, then key, then position. Keys enable stable identity across re-renders
- Bailout = skip subtree when props, state, and context unchanged. `React.memo` enables bailout
- Work loop processes fiber-by-fiber, yields via `shouldYield` to avoid blocking paint
- `reconcileChildren` handles single child (type match), array (position or key match), keyed lists (map lookup)
- Effects run after commit: layout effects block paint, passive effects do not. Cleanup runs before re-mount
- Refs detached before DOM mutations, attached after mutations, before layout effects
- React 19 integrates `use()`, actions, compiler flags, and ref-as-prop into fiber pipeline
- DevTools Profiler flamegraph shows per-fiber render time — use to identify unnecessary re-renders

## Common Misconception

**"Fiber is virtual DOM."**

Fiber is not the virtual DOM. Virtual DOM is the tree of React elements returned by `createElement` / JSX — plain objects, re-created every render. Fiber is the persisted data structure that holds component state, hooks queue, DOM references, and reconciliation flags. Virtual DOM is ephemeral (created and discarded per render). Fiber is persistent (lives across renders, updated in-place). Think: virtual DOM = snapshot of what UI should look like. Fiber = engine that computes diffs against previous snapshot and applies mutations.

---

## Feynman Explain
(Explain React render pipeline to a backend engineer who writes Django. They understand request → database query → JSON response. Use Django concepts: render phase = "query planning" (build execution plan), commit phase = "running the query" (mutate database). Fiber tree = query plan tree. Reconciliation = comparing two query plans. Work loop = database query scheduler that yields between rows.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain advanced-react-19` — AI will probe your explanation for gaps.*

---

## Reframe
(Pause. Critique: Is Fiber's linked-list walking inherently slower than recursive traversal? React added 20% overhead for concurrency — was it worth it? When would you prefer synchronous rendering even in React 19? Write your evaluation. Consider: animation-heavy UIs, real-time data visualizations, and server-side rendering where concurrency provides no benefit.)

---

## Drill
Take the quiz. MCQs test fiber structure, reconciliation rules, bailout conditions, work loop behavior, and commit phase ordering.

Run: `learn.sh quiz advanced-react-19 14-render-pipeline`
