# Module 3: Zustand vs useReducer: Reducers Without Boilerplate

Est. study time: 2h
Language: en

## Learning Objectives
- Compare useReducer + Context vs Zustand shared store across boilerplate, DX, and performance
- Implement store-based equivalent of action/reducer pattern using Zustand set()
- Apply Immer middleware to replace manual immutable update chains
- Decide when useReducer is correct tool vs when Zustand is better fit

---

## Core Content

### The useReducer Pattern — What It Costs

`useReducer` solves useState limitation: complex state logic with multiple sub-values and transitions. Pattern:

```typescript
// Action types (boilerplate start)
type Action =
  | { type: 'INCREMENT'; payload: number }
  | { type: 'DECREMENT'; payload: number }
  | { type: 'RESET' }
  | { type: 'SET_STEP'; payload: number }

// Reducer (pure function, tests well)
function counterReducer(state: CounterState, action: Action): CounterState {
  switch (action.type) {
    case 'INCREMENT':
      return { ...state, count: state.count + action.payload }
    case 'DECREMENT':
      return { ...state, count: state.count - action.payload }
    case 'RESET':
      return { ...state, count: 0 }
    case 'SET_STEP':
      return { ...state, step: action.payload }
    default:
      return state
  }
}

// Component
function Counter() {
  const [state, dispatch] = useReducer(counterReducer, initialState)
  return <button onClick={() => dispatch({ type: 'INCREMENT', payload: 1 })}>
    {state.count}
  </button>
}
```

Cost per action: union member in Action type, case in switch, spread for immutable update. For 4 actions this is manageable. For 15+ actions (real-world feature), boilerplate grows linearly while comprehension degrades.

Action type constants, reducer function, dispatch calls — three places to update per new action. Violates DRY.

> **Think**: Count the touch points to add a new action. How many files change?
>
> *Answer: Minimum 2 (type definition file + reducer switch). If action constants in separate file, 3. Each dispatch call site is additional touch point. Zustand: add one method to store. One file.*

### Zustand as Reducer Replacement

Zustand `set()` replaces both reducer and dispatch. Same logic:

```typescript
import { create } from 'zustand'

interface CounterStore {
  count: number
  step: number
  increment: (by?: number) => void
  decrement: (by?: number) => void
  reset: () => void
  setStep: (step: number) => void
}

const useCounterStore = create<CounterStore>((set) => ({
  count: 0,
  step: 1,
  increment: (by) => set((state) => ({ count: state.count + (by ?? state.step) })),
  decrement: (by) => set((state) => ({ count: state.count - (by ?? state.step) })),
  reset: () => set({ count: 0 }),
  setStep: (step) => set({ step }),
}))
```

No action types. No reducer function. No switch statement. Each mutation is a function on store that calls `set()` directly.

Key insight: actions are methods not payloads. In useReducer, component dispatches a description of change (action object). In Zustand, component calls a function that performs the change. This inverts control — logic lives in store, not in component.

State updates can use functional form `set(state => result)` for dependent updates (same as useState setter with function).

> **Think**: `set((state) => ({ count: state.count + state.step }))` vs `set((state) => ({ count: state.count + 1 }))`. Why prefer reading from state argument instead of closing over external variable?
>
> *Answer: Functional set reads current state at update time, not at render time. Prevents stale closure bugs when multiple updates batch or when updates happen in async callbacks. Same pattern as React's useState functional updater.*

### Immutability in Zustand

Zustand enforces immutable updates via `set()` — spread operator or Immer.

**Manual spread** (no extra deps):
```typescript
set((state) => ({
  user: {
    ...state.user,
    name: newName,
    settings: {
      ...state.user.settings,
      theme: newTheme,
    }
  }
}))
```

Nested updates produce deeply nested spreads — error-prone and hard to read.

**Immer middleware** (`npm install immer`):
```typescript
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

const useStore = create<Store>()(
  immer((set) => ({
    user: { name: 'Alice', settings: { theme: 'dark', fontSize: 14 } },
    updateTheme: (theme: string) =>
      set((state) => {
        // "mutate" state — Immer captures changes as patches
        state.user.settings.theme = theme
      }),
  }))
)
```

Immer middleware wraps state in Proxies. Draft mutations are converted to immutable updates. No spread chains. TypeScript: `set` receives `WritableDraft<T>` so you can mutate.

Key difference: without Immer, `set({ user: { ...state.user, name: newName } })` overrides entire `user` object. With Immer, `state.user.name = newName` applies only nested change. More natural, fewer bugs.

Bundle cost: Immer ~12KB gzipped. Worth it for deeply nested state. Skip for flat state (1-2 levels).

> **Think**: Your state shape is `{ filters: { category: string, tags: string[], priceRange: [number, number] }, sort: string, page: number }`. Immer or manual spread?
>
> *Answer: Moderate depth (2-3 levels). Manual spread requires 3-level spread for filter changes: `set((state) => ({ filters: { ...state.filters, tags: newTags } }))`. Acceptable. Immer justified if filters get deeper or more fields added. Trade: +12KB bundle vs readability. For this shape, either works — manual spread is fine.*

### When useReducer Is Fine

useReducer is correct default when:
- State is local to one component (no sharing)
- State transitions are well-defined and few (<8 action types)
- Testing reducer function as pure function is desirable
- Component unmounts → state destroyed (ephemeral)

Examples: multi-step form wizard, complex animation tween state, undo/redo stack in text editor.

Zustand adds bundle overhead, global store, and persistence layer where none needed. Do not replace useReducer for one-component complex state. Use strength of each tool.

> **Think**: Text editor with undo/redo — 50+ action types, purely local state. useReducer or Zustand?
>
> *Answer: useReducer is better. Undo/redo stacks are reducer-shaped (current state + action → new state, history stack). No shared state. No consumers outside component. useReducer's pure reducer is easy to test and reason about. Zustand adds nothing here.*

### Zustand vs useReducer + Context (Redux-Lite Pattern)

Common pattern: `useReducer` at top level + Context to pass dispatch to children:

```typescript
const CounterContext = createContext<{
  state: CounterState
  dispatch: React.Dispatch<Action>
} | null>(null)

function CounterProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(counterReducer, initialState)
  return (
    <CounterContext.Provider value={{ state, dispatch }}>
      {children}
    </CounterContext.Provider>
  )
}

function useCounter() {
  const ctx = useContext(CounterContext)
  if (!ctx) throw new Error('useCounter must be in CounterProvider')
  return ctx
}
```

Boilerplate: context type, provider component, context creation, custom hook + error guard. One Contex t provider per slice of state.

Zustand alternative:
```typescript
const useCounterStore = create<CounterStore>(/* ... */)
```

No provider. No context. No error guard. No wrapper component. Everything in one file.

Zustand's `set()` function provides same action-dispatch semantic with less ceremony.

> **Think**: A dashboard has 5 independent state slices — auth, filters, sidebar, notifications, data cache. How many Context providers is that? What nesting depth?
>
> *Answer: 5 Context providers, nested 5 deep around entire app tree. Each adds subtree re-render risk. Zustand: 5 store files, zero nesting, zero providers.*

### Performance: Context Re-renders vs Zustand Selectors

useReducer + Context has fundamental perf issue: **Context value change re-renders all consumers**.

```typescript
const ctx = { state, dispatch }
return <CounterContext.Provider value={ctx}>{children}</CounterContext.Provider>
```

Every `dispatch` creates new `ctx` object → every `useContext(CounterContext)` consumer re-renders, even components that only call `dispatch` and never read `state`.

Optimizations:
- Split Context into separate `StateContext` and `DispatchContext`
- `useMemo` to stabilize dispatch (React does this for useReducer dispatch)
- Still: any state change re-renders all state consumers regardless of which slice they read

Zustand: selectors subscribe to specific slices:

```typescript
function CountDisplay() {
  const count = useCounterStore((s) => s.count)  // re-renders ONLY when count changes
  return <div>{count}</div>
}

function StepDisplay() {
  const step = useCounterStore((s) => s.step)  // re-renders ONLY when step changes
  return <div>{step}</div>
}

function IncrementButton() {
  const increment = useCounterStore((s) => s.increment)  // never re-renders on state change
  return <button onClick={increment}>+</button>
}
```

Selector granularity maps to re-render scope. `IncrementButton` subscribes to function reference — stable if store definition stable. Zero re-renders from state changes.

> **Think**: A ProfilePage uses Context for user state. Avatar component reads `user.avatarUrl`, Bio reads `user.bio`. When avatar changes, does Bio re-render?
>
> *Answer: Yes, if both use same Context. Context doesn't track which fields each consumer reads. Zustand: Avatar selects `(s) => s.user.avatarUrl`. Bio selects `(s) => s.user.bio`. Avatar update only re-renders Avatar component.*

### Code Migration: useReducer → Zustand

Step-by-step for equivalent logic:

**Before** (useReducer + Context):
```typescript
// reducer.ts
export function todoReducer(state: TodoState, action: TodoAction): TodoState {
  switch (action.type) {
    case 'ADD_TODO':
      return { ...state, todos: [...state.todos, action.payload] }
    case 'TOGGLE_TODO':
      return { ...state, todos: state.todos.map(t =>
        t.id === action.payload ? { ...t, done: !t.done } : t
      )}
    case 'REMOVE_TODO':
      return { ...state, todos: state.todos.filter(t => t.id !== action.payload) }
  }
}
```

**After** (Zustand):
```typescript
import { create } from 'zustand'

interface TodoStore {
  todos: Todo[]
  addTodo: (todo: Todo) => void
  toggleTodo: (id: string) => void
  removeTodo: (id: string) => void
}

const useTodoStore = create<TodoStore>((set) => ({
  todos: [],
  addTodo: (todo) => set((state) => ({ todos: [...state.todos, todo] })),
  toggleTodo: (id) => set((state) => ({
    todos: state.todos.map(t => t.id === id ? { ...t, done: !t.done } : t)
  })),
  removeTodo: (id) => set((state) => ({
    todos: state.todos.filter(t => t.id !== id)
  })),
}))
```

Migration algorithm:
1. Create store file with same initial state
2. Convert each reducer case into store method using set()
3. Remove action type definitions
4. Remove Context provider + consumer hooks
5. Update component dispatches to direct method calls: `dispatch({ type: 'ADD_TODO', payload: todo })` → `store.addTodo(todo)`

Each step is safe. Can do incrementally.

> **Think**: What if reducer handles 30 action types? Does migration scale linearly per action?
>
> *Answer: Yes. Each case becomes one method. The method is smaller than case (no action type, no switch wrapper). Migration is mechanical — no architectural rethinking. Automation: codemod that reads reducer switch cases and emits Zustand store methods is feasible but niche.*

### Debugging: Devtools

useReducer works with Redux DevTools via third-party library (e.g., `@redux-devtools/extension`). Setup:
```typescript
import { devToolsEnhancer } from '@redux-devtools/extension'
const [state, dispatch] = useReducer(reducer, initialState, devToolsEnhancer({}))
```

Or through Context-based providers with middleware.

Zustand: built-in `devtools` middleware:
```typescript
import { devtools } from 'zustand/middleware'

const useStore = create<Store>()(
  devtools(
    (set) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 }), false, 'increment'),
    }),
    { name: 'counter-store' }
  )
)
```

Third argument to `set()` is action name displayed in DevTools. Without it, DevTools shows `anonymous`. Named actions improve traceability.

`devtools` middleware is 1 import, 1 wrapper. No separate store enhancer wiring.

> **Think**: A bug report says "count jumped from 5 to 12". With devtools, how do you find what caused it?
>
> *Answer: Open Redux DevTools timeline. Filter by store name. Each set() call appears as action entry with previous state, next state, and action name. Trace through to find which action produced unexpected value. Same workflow as Redux debugging — no extra setup.*

### Testing

useReducer: reducer is pure function. Test directly:
```typescript
describe('counterReducer', () => {
  it('increments count', () => {
    expect(counterReducer({ count: 0, step: 1 }, { type: 'INCREMENT', payload: 1 }))
      .toEqual({ count: 1, step: 1 })
  })
})
```

Zustand: test store directly via `getState()` and `setState()`:
```typescript
import { useCounterStore } from './counter-store'

describe('counterStore', () => {
  beforeEach(() => {
    useCounterStore.setState({ count: 0, step: 1 })
  })

  it('increments count', () => {
    useCounterStore.getState().increment()
    expect(useCounterStore.getState().count).toBe(1)
  })
})
```

Or create fresh store for each test:
```typescript
const createTestStore = () => create<CounterStore>((set) => ({
  count: 0, step: 1,
  increment: () => set((s) => ({ count: s.count + s.step })),
  decrement: () => set((s) => ({ count: s.count - s.step })),
  reset: () => set({ count: 0 }),
  setStep: (step) => set({ step }),
}))
```

Both testable. Zustand store tests exercise more integration (method calls real state changes). useReducer tests are pure unit. Neither is inherently better — difference is test granularity.

Component integration tests: both need render + interact. Zustand benefit: mock store state via `useCounterStore.setState()` without wrapping provider.

> **Think**: How does Zustand reset state between tests without the Context provider reset approach?
>
> *Answer: `useStore.setState(initialState)` directly sets store to baseline. No need to re-mount provider tree. Single line in beforeEach. Faster, less nesting.*

### Decision Guide

| Criterion | useReducer | Zustand |
|-----------|------------|---------|
| State scope | Single component | Any scope (local to global) |
| Consumers | 1 (component + children via props) | Many (any component in app) |
| Action types | < 8 | Any number |
| State depth | Shallow | Any (Immer helps deep) |
| Re-render control | Manual (React.memo, split.Context) | Built-in (selectors) |
| Provider nesting | Required for shared state | None |
| Bundle overhead | 0.3KB (built-in) | ~1.1KB + optional Immer ~12KB |
| DevTools | Third-party setup | Built-in middleware |
| Testing | Pure function unit | Store method integration |

Rule: **useReducer for local complex state. Zustand for shared state.** If state has 1 consumer, prefer useReducer. If state has 2+ consumers at different tree levels, prefer Zustand. If unsure, start with useReducer — extracting to Zustand later is mechanical.

> **Think**: A checkout flow has shipping form (6 fields), payment form (8 fields), and order summary. State is complex but only used during checkout. Single component tree. useReducer or Zustand?
>
> *Answer: useReducer. State is local to checkout page. When user navigates away, state should reset. No other consumers. Context + useReducer inside checkout component is clean. Zustand adds global store where every checkout in different tabs shares state — causes stale data bugs. useReducer correctly scopes state to component lifecycle.*

---

### Why This Matters

useReducer + Context is the most common "mini-Redux" pattern in React codebases. Teams reach for it when useState is insufficient. But Context re-render problem and boilerplate cost accumulate. Zustand solves both problems while preserving the action/mutation mental model. Understanding which tool for which scope — local vs shared — separates clean architecture from tangled state. The Context re-render issue alone causes significant perf regression in production apps. Zustand selectors eliminate entire category of re-render bugs. Every React developer working with anything beyond trivial state needs this comparison.

---

### Common Questions

**Q: Does Zustand replace all useReducer usage?**
A: No. useReducer for local complex state (undo/redo, multi-step form, animation state). Zustand for shared state (cross-component, cross-page). If state resets on unmount, useReducer is likely correct.

**Q: How does Zustand handle side effects that useReducer handles via middleware?**
A: Zustand stores can contain async functions. No middleware needed for side effects. Call API inside store method. For complex orchestration, Zustand has no built-in saga/effect system — use regular async/await or external tool (TanStack Query for server state).

**Q: Can I use useReducer inside a Zustand store?**
A: Yes. Zustand state can include dispatch functions from useReducer. But this is unusual — if you need reducer pattern inside store, convert each case to set() call instead. Mixing both is unnecessary.

**Q: Does Immer middleware affect performance?**
A: Yes, neglibly. Immer uses Proxies to track mutations. For single update, overhead ~0.01ms. For batch updates (1000+ items), manual immutable update may be faster. Premature optimization: write clear code first, profile later.

**Q: How do I type dispatch-style actions for Zustand?**
A: Zustand does not enforce action type pattern. If you prefer dispatched actions, create a single `dispatch` method on store: `dispatch: (action: { type: string, payload?: unknown }) => void`. But this re-introduces boilerplate — not idiomatic Zustand.

---

## Examples

### Example 1: Refactoring Shopping Cart from useReducer + Context to Zustand

**Before** (useReducer + Context):
```typescript
// cart-context.tsx
interface CartState { items: CartItem[], total: number }
type CartAction =
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_QTY'; payload: { id: string; qty: number } }

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM':
      return { ...state, items: [...state.items, action.payload],
        total: state.total + action.payload.price }
    case 'REMOVE_ITEM': {
      const item = state.items.find(i => i.id === action.payload)
      return { ...state, items: state.items.filter(i => i.id !== action.payload),
        total: state.total - (item?.price ?? 0) }
    }
    case 'UPDATE_QTY': {
      const items = state.items.map(i =>
        i.id === action.payload.id ? { ...i, qty: action.payload.qty } : i
      )
      return { ...state, items, total: items.reduce((s, i) => s + i.price * i.qty, 0) }
    }
  }
}

// Provider wraps app, dispatch passed through context
// Every dispatch re-renders all context consumers
```

**After** (Zustand):
```typescript
// cart-store.ts
import { create } from 'zustand'

interface CartStore {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (id: string) => void
  updateQty: (id: string, qty: number) => void
  total: () => number
}

const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  addItem: (item) => set((state) => ({
    items: [...state.items, item],
  })),
  removeItem: (id) => set((state) => ({
    items: state.items.filter(i => i.id !== id),
  })),
  updateQty: (id, qty) => set((state) => ({
    items: state.items.map(i => i.id === id ? { ...i, qty } : i),
  })),
  total: () => get().items.reduce((s, i) => s + i.price * i.qty, 0),
}))

// Components read selectors — ItemsList re-renders only when items change
// AddToCartButton reads only addItem function — never re-renders from state change
// No provider, no context, no action types
```

**Result**: Reducer from 30 lines to 15 lines store. Component code: `dispatch({ type: 'ADD_ITEM', payload: item })` → `useCartStore.getState().addItem(item)`. Or `const { addItem } = useCartStore()` for hook usage.

### Example 2: Multi-Step Form — Keeping useReducer

**Problem**: Checkout wizard with 4 steps (Shipping, Payment, Review, Confirmation). Each step complex, but state is ephemeral — destroyed on successful checkout.

**Architecture**:
```typescript
type Step = 'shipping' | 'payment' | 'review' | 'confirmation'

interface CheckoutFormState {
  currentStep: Step
  shipping: ShippingInfo
  payment: PaymentInfo
  errors: Record<string, string>
}

type CheckoutAction =
  | { type: 'GO_TO_STEP'; payload: Step }
  | { type: 'SET_SHIPPING'; payload: ShippingInfo }
  | { type: 'SET_PAYMENT'; payload: PaymentInfo }
  | { type: 'SET_ERRORS'; payload: Record<string, string> }
  | { type: 'RESET' }

function checkoutReducer(state: CheckoutFormState, action: CheckoutAction) {
  switch (action.type) {
    case 'GO_TO_STEP':
      return { ...state, currentStep: action.payload, errors: {} }
    case 'SET_SHIPPING':
      return { ...state, shipping: action.payload }
    case 'SET_PAYMENT':
      return { ...state, payment: action.payload }
    case 'SET_ERRORS':
      return { ...state, errors: action.payload }
    case 'RESET':
      return initialState
  }
}
```

**Why useReducer stays**: State lives only inside CheckoutPage component. No other component reads it. On successful order, `dispatch({ type: 'RESET' })` clears it. Component unmounts → state garbage collected. Zustand would persist checkout state in global store — risk of stale data across navigation.

**Counterpoint**: If checkout data is needed by order confirmation page (different route), then Zustand is correct. Decision depends on state scope.

### Example 3: Undo/Redo with useReducer

**Problem**: Sketching app — lines, shapes, colors. Undo stack must track every state transition.

useReducer is natural fit because undo is "previous state" replay:
```typescript
function withUndo(reducer: SketchReducer) {
  return (state: UndoableState, action: SketchAction) => {
    const nextPresent = reducer(state.present, action)
    return {
      past: [...state.past, state.present],
      present: nextPresent,
      future: [] as SketchState[],  // clear future on new action
    }
  }
}
```

Zustand can implement undo via `set()` + history array, but useReducer gives undo for free via state history pattern. Zustand advantage disappears when state is purely local.

**Lesson**: Not every pattern needs Zustand. useReducer + Context for single-owner complex state is idiomatic React.

---

### Key Takeaways
- useReducer + Context adds boilerplate: action types, reducer switch, Context provider, consumer hook
- Zustand `set()` replaces reducer + dispatch in <50% lines of code
- Immer middleware eliminates nested spread chains for deep state updates
- Context re-renders all consumers on any change — Zustand selectors prevent this
- useReducer is correct for local complex state with 1 consumer
- Zustand is correct for shared state with 2+ consumers at different tree levels
- Migration from useReducer to Zustand is mechanical (one action → one store method)
- Devtools middleware in Zustand provides same debugging experience as Redux DevTools
- Both are testable: reducer as pure function, store via getState/setState
- Decision heuristic: "does state reset on unmount?" Yes → useReducer. No → Zustand

### Common Misconception

**"Zustand is just a simpler Redux, so it competes with useReducer the same way."**

Zustand competes with useReducer + Context, not useReducer alone. The Context wrapper is where the boilerplate and performance issues live. useReducer without Context — state passed via props — is fine for 1-2 component levels. The moment you reach for Context to share dispatch, Zustand becomes the better choice because it eliminates the provider while keeping the mutation pattern. Also, Zustand's "reducer" is implicit (set() with partial state) vs explicit (switch/case). Both accomplish same thing; Zustand requires fewer files, less typing, and less conceptual overhead. The common error is defaulting to Context + useReducer for any cross-component state because "it's built-in." Built-in does not mean optimal for shared state.

---

### Feynman Explain
(Explain to a colleague who knows Redux Toolkit but has never used Zustand. They understand reducers, actions, dispatch, selectors. Contrast RTK's configureStore/createSlice with Zustand's create/set. Focus on: no action type strings, no createSlice config object, no store configuration, no Provider wrapping. The concept is "Redux Toolkit is a heavy framework; Zustand is a lightweight library that does the same things with 80% less ceremony." Your colleague should walk away thinking "I could migrate a Redux Toolkit slice to Zustand in 10 minutes.")

---

### Reframe
(Pause. Critique: Is the elimination of action types a net positive? Action types serve as documentation — you can grep for 'ADD_TODO' and find every dispatch in codebase. Zustand methods lose this traceability. How do you find all callers of addTodo without type string search? Consider: TypeScript "Find All References" on store method. Does that compensate for lost action type grepability? Write your evaluation. When is explicit action type string actually better than function call? Consider a large team where tracing data flow is critical.)

---

### Drill
Take the quiz. MCQs test boilerplate comparison, migration steps, performance implications, and decision heuristics.

Run: `learn.sh quiz zustand-state-management 03-vs-usecontext`
