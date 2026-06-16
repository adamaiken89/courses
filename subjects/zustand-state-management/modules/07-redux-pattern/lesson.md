# Module 7: Redux Pattern in Zustand — Reducers, Dispatch, Actions

Est. study time: 2.5h
Language: en

## Learning Objectives
- Implement reducer pattern inside Zustand store for complex state transitions
- Compare and contrast action-creator functions vs string-constant action types
- Integrate Redux DevTools middleware for debugging Zustand stores
- Decide when reducer pattern benefits vs direct `set()` mutations
- Test reducer logic in isolation and store integration

---

## Core Content

### Zustand's `set()` Is Already a Dispatch

Every Zustand store uses `set()` to update state. This is conceptually identical to Redux's `dispatch`:

```typescript
// Redux
dispatch({ type: 'todos/add', payload: { text: 'Learn Zustand' } })

// Zustand
set({ todos: [...state.todos, { text: 'Learn Zustand', done: false }] })
```

The difference: Redux enforces action objects pass through a reducer. Zustand lets you mutate state directly inside `set()` — or pass a reducer function. Both achieve same result. Zustand chooses freedom over ceremony.

The Redux pattern in Zustand means you voluntarily introduce action objects and reducer functions. You gain predictability, undo/redo, and DevTools tracing. You lose simplicity.

> **Think**: You have a form with 3 fields and a submit button. Should you use the Redux pattern or direct set()? What criterion decides?
>
> *Answer: Direct set(). Three fields do not need action types and a reducer — unnecessary ceremony. Criterion: if state transition logic fits in one `set()` call without conditionals, direct mutation wins. Reducer pattern adds value when multiple action types produce different state shapes from the same store slice.*

### Reducer Pattern Inside Zustand

A reducer is a pure function `(state, action) => state`. Zustand lets you inline it:

```typescript
import { create } from 'zustand'

type Action =
  | { type: 'todo/add'; text: string }
  | { type: 'todo/toggle'; id: number }
  | { type: 'todo/remove'; id: number }

interface TodoState {
  todos: Array<{ id: number; text: string; done: boolean }>
  dispatch: (action: Action) => void
}

function todoReducer(state: TodoState['todos'], action: Action) {
  switch (action.type) {
    case 'todo/add':
      return [...state, { id: Date.now(), text: action.text, done: false }]
    case 'todo/toggle':
      return state.map(t =>
        t.id === action.id ? { ...t, done: !t.done } : t
      )
    case 'todo/remove':
      return state.filter(t => t.id !== action.id)
    default:
      return state
  }
}

const useStore = create<TodoState>((set) => ({
  todos: [],
  dispatch: (action: Action) =>
    set((state) => ({ todos: todoReducer(state.todos, action) })),
}))
```

Key points:
- `dispatch` is a function on the store that calls `set()` with reducer result
- `todoReducer` is a pure function — testable without React
- Action types: string constants (`'todo/add'`) follow Redux convention. Not required. Any string or Symbol works.

> **Think**: The reducer mutates `todos` array, not the whole store. What if you needed to update `todos` and a `notification` count in one action? Does the pattern break?
>
> *Answer: The reducer operates on one slice (`todos`). For cross-slice updates, either: (1) pass the full store state to the reducer, (2) run two reducers sequentially, or (3) use a thunk-like pattern. Zustand has no strict single-reducer rule. You can call `dispatch(action)` which calls multiple `set()` calls, or compose reducers manually.*

### Action Types: String Constants vs Function-Based Actions

Two styles for defining actions:

**String constants** (Redux-style):
```typescript
const ADD_TODO = 'todo/add'
const TOGGLE_TODO = 'todo/toggle'
// Reducer switches on action.type
```

**Function-based actions** (Zustand-native):
```typescript
const useStore = create<State>((set) => ({
  todos: [],
  addTodo: (text: string) =>
    set((s) => ({ todos: [...s.todos, { id: Date.now(), text, done: false }] })),
  toggleTodo: (id: number) =>
    set((s) => ({
      todos: s.todos.map(t => t.id === id ? { ...t, done: !t.done } : t),
    })),
}))

// Usage
useStore.getState().addTodo('Learn Zustand')
```

| Concern | String constants | Function actions |
|---------|-----------------|------------------|
| Discoverability | Searching `'todo/add'` finds usage | `.addTodo` autocompletes in TypeScript |
| Serialization | Action objects serializable over wire | Functions not serializable |
| DevTools trace | Action type appears in devtools panel | Anonymous state updates |
| Reusability | Same action type dispatched from anywhere | Must import store or action function |
| Testing | Reducer testable as `reducer(state, { type: 'todo/add', ... })` | Must mock the store or extract logic |

Zustand convention: use function-based actions by default. Adopt string constants only when you need DevTools tracing or serializable action logs (e.g., undo/redo).

> **Think**: You need undo/redo for a drawing app. Each stroke must be replayable. Which action style works? Why?
>
> *Answer: String constants. Undo/redo requires storing a log of action objects `{ type, payload }` that can be replayed or inverted. Function actions are closures — they capture scope at call time and cannot be replayed later. String constants serialize cleanly into an action history stack.*

### Redux DevTools Integration

Zustand's `devtools` middleware connects to Redux DevTools browser extension:

```typescript
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

const useStore = create(
  devtools(
    (set) => ({
      count: 0,
      increment: () => set((s) => ({ count: s.count + 1 }), false, 'count/increment'),
      decrement: () => set((s) => ({ count: s.count - 1 }), false, 'count/decrement'),
    }),
    { name: 'counter-store', anonymousActionType: 'stateChange' }
  )
)
```

Third argument to `set()` is the action type name that appears in DevTools:
```typescript
set((state) => ({ count: state.count + 1 }), false, 'count/increment')
//                                         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//                                        shows in DevTools action log
```

With reducer pattern, the action type passes through automatically if named:
```typescript
dispatch: (action: Action) =>
  set((state) => ({ todos: todoReducer(state.todos, action) }), false, action.type),
```

The `false` parameter means "replace" (false = shallow merge, which is default). The third param is the DevTools label.

> **Think**: You use devtools middleware but forget the third parameter on every `set()` call. What appears in DevTools?
>
> *Answer: `anonymousActionType` (default: `'stateChange'`). Every mutation shows as `stateChange` — useless for debugging. Always name actions or configure `anonymousActionType` to something meaningful like the store name.*

### Code Comparison: Redux Toolkit vs Zustand (Reducer Pattern)

Same feature — todo list with add/toggle/remove — in both:

**Redux Toolkit:**
```typescript
import { createSlice, configureStore } from '@reduxjs/toolkit'

const todosSlice = createSlice({
  name: 'todos',
  initialState: [] as Todo[],
  reducers: {
    add: (state, action: PayloadAction<string>) => {
      state.push({ id: Date.now(), text: action.payload, done: false })
    },
    toggle: (state, action: PayloadAction<number>) => {
      const t = state.find(t => t.id === action.payload)
      if (t) t.done = !t.done
    },
  },
})

const store = configureStore({ reducer: { todos: todosSlice.reducer } })
// Usage: store.dispatch(todosSlice.actions.add('text'))
// Selector: (state) => state.todos
```

**Zustand (reducer pattern):**
```typescript
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

const useStore = create(
  devtools<State>((set) => ({
    todos: [],
    dispatch: (action: TodoAction) =>
      set((s) => ({ todos: todoReducer(s.todos, action) }), false, action.type),
  })),
  { name: 'todos' }
)
// Usage: useStore.getState().dispatch({ type: 'todo/add', text: 'x' })
// Selector: useStore((s) => s.todos)
```

| Dimension | Redux Toolkit | Zustand reducer |
|-----------|--------------|-----------------|
| Boilerplate | createSlice + configureStore + Provider | One `create()` call |
| Provider needed | Yes | No |
| DevTools | Built-in | Middleware opt-in |
| Bundle size | ~12KB min+gzip | ~1.7KB min+gzip |
| Action creator | Auto-generated `slice.actions.add(...)` | Manual dispatch function |
| Selector performance | `useSelector` with equality | `useStore` with equality fn |

> **Think**: Your app is 50% Redux and you want to migrate one feature to Zustand. Both will coexist. Which factor matters most for gradual migration?
>
> *Answer: Provider independence. Zustand stores are not wrapped in `<Provider>` — they live outside React tree. You can mount a Zustand store alongside Redux store. Features migrate one at a time. Shared state between the two? Use a subscriber bridge: `useStore.subscribe((state) => reduxStore.dispatch(syncAction(state)))`.*

### When Reducer Pattern Helps — and When It Hurts

**Use reducer pattern when:**
- Complex state transitions with many action types (CRUD on entities)
- Undo/redo required (action log replay)
- Cross-slice updates (one action updates multiple store slices)
- You want to migrate existing Redux code incrementally
- State transition logic exceeds 10 lines per action

**Use direct `set()` when:**
- Simple toggle, counter, form field
- One or two properties change per action
- State transition is obvious from context
- You value Locality of Behavior — the mutation lives where it's consumed

The dividing line: **does the `set()` callback contain a switch statement or if-else chain?** If no, direct mutation. If yes, consider reducer.

> **Think**: A checkout form with 12 fields and 5-step wizard. Multiple field updates, validation state, step tracking. Reducer pattern or direct set()?
>
> *Answer: Reducer pattern. Five action types (NEXT_STEP, PREV_STEP, UPDATE_FIELD, VALIDATE, SUBMIT) produce different state shapes. Without reducer, your `set()` callbacks branch on implicit conditions — harder to read, test, and trace. The reducer gives each action explicit type and transformation logic.*

### Dispatching Actions from Outside React

Zustand stores exist outside React tree. Any action can be dispatched from any context:

```typescript
// In a routing guard
import { useStore } from './store'

router.beforeEach((to, from) => {
  if (to.path === '/logout') {
    useStore.getState().dispatch({ type: 'auth/logout' })
  }
})

// In a WebSocket handler
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data)
  useStore.getState().dispatch({ type: msg.kind, payload: msg.data })
}

// In a service worker message handler
navigator.serviceWorker.addEventListener('message', (event) => {
  useStore.getState().dispatch(event.data.action)
})
```

This is harder in Redux — you must either import the store instance or use `useDispatch` inside React. Zustand's `getState()` returns the latest state + actions at any call time.

> **Think**: A WebSocket pushes real-time price updates. Should you dispatch the Redux-pattern action directly, or wrap it in a Zustand subscriber?
>
> *Answer: Dispatch directly. `ws.onmessage → store.getState().dispatch(priceUpdate)`. No React wrapper needed. The store updates synchronously; all subscribed React components re-render. A subscriber adds indirection with no benefit unless you need to batch multiple WS messages.*

### Testing: Reducer Functions vs Store Integration

**Unit-test the reducer (pure function, no React):**
```typescript
import { todoReducer } from './store'

describe('todoReducer', () => {
  const initial: Todo[] = [{ id: 1, text: 'a', done: false }]

  it('adds a todo', () => {
    const result = todoReducer(initial, { type: 'todo/add', text: 'b' })
    expect(result).toHaveLength(2)
  })

  it('toggles a todo', () => {
    const result = todoReducer(initial, { type: 'todo/toggle', id: 1 })
    expect(result[0].done).toBe(true)
  })

  it('returns same array for unknown action', () => {
    const result = todoReducer(initial, { type: 'unknown' } as any)
    expect(result).toBe(initial)
  })
})
```

**Integration-test the store (includes React):**
```typescript
import { renderHook, act } from '@testing-library/react'
import { useStore } from './store'

describe('todo store', () => {
  it('adds todo via dispatch', () => {
    const { result } = renderHook(() => useStore())

    act(() => {
      result.current.dispatch({ type: 'todo/add', text: 'test' })
    })

    expect(result.current.todos).toHaveLength(1)
    expect(result.current.todos[0].text).toBe('test')
  })
})
```

Rule: reducer logic → unit test (fast, no React environment). Store wiring → integration test (catches middleware issues, devtools configuration, subscriber reactivity).

> **Think**: A bug: dispatching `todo/add` from a WebSocket handler works, but the UI does not update. Where do you look?
>
> *Answer: Integration test covers store → React bridge. Unit test of reducer would pass because reducer returns correct state. Bug likely in: (1) subscriber not set up after WebSocket handler, (2) selector reference prevents re-render, (3) Zustand's `set()` called outside React without `useSyncExternalStore` bridge. Test dispatch → subscribe → assert.*

### Real Example: Todo App with Redux Pattern in Zustand

```typescript
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

// Action types
type TodoAction =
  | { type: 'todo/add'; text: string }
  | { type: 'todo/toggle'; id: number }
  | { type: 'todo/remove'; id: number }
  | { type: 'todo/clear-completed' }
  | { type: 'todo/edit'; id: number; text: string }

interface Todo {
  id: number
  text: string
  done: boolean
  createdAt: number
}

interface TodoStore {
  todos: Todo[]
  dispatch: (action: TodoAction) => void
}

// Pure reducer — testable, serializable
function todoReducer(todos: Todo[], action: TodoAction): Todo[] {
  switch (action.type) {
    case 'todo/add':
      return [...todos, { id: Date.now(), text: action.text, done: false, createdAt: Date.now() }]
    case 'todo/toggle':
      return todos.map(t => (t.id === action.id ? { ...t, done: !t.done } : t))
    case 'todo/remove':
      return todos.filter(t => t.id !== action.id)
    case 'todo/clear-completed':
      return todos.filter(t => !t.done)
    case 'todo/edit':
      return todos.map(t => (t.id === action.id ? { ...t, text: action.text } : t))
    default:
      return todos
  }
}

// Store with devtools + persist middleware
const useTodoStore = create<TodoStore>()(
  devtools(
    persist(
      (set) => ({
        todos: [],
        dispatch: (action) =>
          set((state) => ({ todos: todoReducer(state.todos, action) }), false, action.type),
      }),
      { name: 'todo-storage' }
    ),
    { name: 'todo-store' }
  )
)

// Component usage
function TodoApp() {
  const todos = useTodoStore((s) => s.todos)
  const dispatch = useTodoStore((s) => s.dispatch)

  return (
    <div>
      <button onClick={() => dispatch({ type: 'todo/add', text: prompt('Todo?') || '' })}>
        Add
      </button>
      {todos.map(todo => (
        <div key={todo.id}>
          <span style={{ textDecoration: todo.done ? 'line-through' : 'none' }}
                onClick={() => dispatch({ type: 'todo/toggle', id: todo.id })}>
            {todo.text}
          </span>
          <button onClick={() => dispatch({ type: 'todo/remove', id: todo.id })}>X</button>
        </div>
      ))}
    </div>
  )
}
```

This pattern:
- Separates state shape (Todo), actions (TodoAction), and transformation (todoReducer)
- Persists to localStorage automatically
- Traces every action in Redux DevTools
- Works outside React (dispatch from WebSocket, router guard, etc.)
- All five action types handled in one switch — testable as pure function

> **Think**: The `dispatch` function is recreated on every store update (because it creates a new closure over `set`). Does this cause unnecessary re-renders in subscribed components?
>
> *Answer: No. Zustand's `useStore((s) => s.dispatch)` returns a stable reference — the `dispatch` function is defined once in the store creator. The closure captures the same `set` reference. The arrow function inside `set` argument is created fresh each call, not at subscription. No re-render overhead from `dispatch`.*

---

### Why This Matters

Redux pattern in Zustand is the bridge between Redux and Zustand worlds. Teams migrating from Redux use this pattern to transfer action types, reducers, and mental models without rewriting business logic. Teams new to Zustand need to know when the pattern adds value and when it adds ceremony.

The decision — reducer vs direct mutation — affects testability, DevTools debugging, undo/redo feasibility, and code organization. A team that always uses reducers writes unnecessary boilerplate. A team that never uses reducers hits a wall when state transitions grow complex.

This module gives you the decision framework. After this, you can:
- Port Redux reducers to Zustand in minutes
- Set up DevTools tracing for any Zustand store
- Test state logic without mounting React
- Dispatch actions from outside React (WebSocket, router, service worker)

---

### Common Questions

**Q: Does Zustand's reducer pattern support middleware like Redux thunks or sagas?**
A: Not directly. Zustand has its own middleware system (`immer`, `persist`, `devtools`, `subscribeWithSelector`). For async flows, you write plain functions that call `set()` or `getState()` — no saga runtime needed. If you need full Redux middleware chain, stay on Redux or use Zustand's `redux` middleware (experimental).

**Q: Can I use both reducer pattern and direct mutations in the same store?**
A: Yes. Zustand does not enforce patterns. Common hybrid: complex slice uses dispatch, simple slice uses direct `set()`. Example: `session` state (login/logout → reducer for audit trail) + `theme` state (toggle → direct set). No conflict.

**Q: Does the Redux pattern let me use Redux DevTools time-travel debugging?**
A: Yes. The `devtools` middleware connects to Redux DevTools extension. Named action types (third parameter to `set()`) enable jump-to-action and time-travel. However, Zustand does not implement the full Redux store enhancer API — some advanced DevTools features (diff between state snapshots, action stacks) may differ slightly.

**Q: Is there a performance cost to the reducer pattern?**
A: Negligible. The reducer runs synchronously inside `set()`. For stores <10K entries, the switch statement + array spread completes in <0.1ms. The cost is human, not computational: you write more code per action.

**Q: Can one dispatch trigger multiple state slices?**
A: Yes. Your reducer can return `{ todos: [...], ui: { ... }, notifications: [...] }` — whatever shape `set()` merges. Alternatively, call `set()` multiple times conditionally. Zustand batches multiple synchronous `set()` calls into one re-render.

---

## Examples

### Example 1: Porting Redux Slice to Zustand

**Problem**: Existing Redux `shoppingCart` slice with addItem, removeItem, updateQuantity, applyCoupon, clearCart actions. Team wants to remove Redux dependency for this feature.

**Solution**:

Redux original:
```typescript
const cartSlice = createSlice({
  name: 'cart',
  initialState: { items: [], coupon: null },
  reducers: {
    addItem: (state, action: PayloadAction<Item>) => {
      state.items.push(action.payload)
      state.total = state.items.reduce((s, i) => s + i.price * i.qty, 0)
    },
    applyCoupon: (state, action: PayloadAction<string>) => {
      state.coupon = action.payload
      state.discount = 0.1 // simplified
    },
  },
})
```

Zustand port:
```typescript
type CartAction =
  | { type: 'cart/addItem'; item: Item }
  | { type: 'cart/removeItem'; id: string }
  | { type: 'cart/updateQty'; id: string; qty: number }
  | { type: 'cart/applyCoupon'; code: string }
  | { type: 'cart/clear' }

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'cart/addItem': {
      const items = [...state.items, action.item]
      return { ...state, items, total: items.reduce((s, i) => s + i.price * i.qty, 0) }
    }
    case 'cart/applyCoupon':
      return { ...state, coupon: action.code, discount: 0.1 }
    case 'cart/clear':
      return { items: [], coupon: null, discount: 0, total: 0 }
    case 'cart/removeItem':
      return { ...state, items: state.items.filter(i => i.id !== action.id) }
    default:
      return state
  }
}

const useCartStore = create<CartStore>()(
  devtools(
    (set) => ({
      items: [], coupon: null, discount: 0, total: 0,
      dispatch: (action: CartAction) =>
        set((s) => cartReducer(s, action), false, action.type),
    }),
    { name: 'cart' }
  )
)
```

**Result**: Same action types, same reducer logic, same DevTools. Dropped Provider, createSlice import, and store configuration ceremony. Bundle ~10KB lighter.

### Example 2: Undo/Redo with Action Log

**Problem**: Drawing app needs undo/redo for stroke operations. Each stroke add/delete/modify must be reversible.

**Solution**:
```typescript
interface HistoryStore {
  past: Action[]
  present: State
  future: Action[]
  dispatch: (action: Action) => void
  undo: () => void
  redo: () => void
}

const useHistoryStore = create<HistoryStore>()(
  devtools((set, get) => ({
    past: [],
    present: { strokes: [] },
    future: [],
    dispatch: (action) => {
      set(
        (s) => ({
          past: [...s.past, { type: action.type, payload: action.payload }],
          present: strokeReducer(s.present, action),
          future: [], // clear redo on new action
        }),
        false,
        action.type
      )
    },
    undo: () => {
      const { past, present } = get()
      if (past.length === 0) return
      const previous = past[past.length - 1]
      const undone = strokeReducer(present, invertAction(previous))
      set({ past: past.slice(0, -1), present: undone, future: [...get().future, previous] })
    },
    redo: () => {
      const { future, present } = get()
      if (future.length === 0) return
      const next = future[future.length - 1]
      const redone = strokeReducer(present, next)
      set({ past: [...get().past, next], present: redone, future: future.slice(0, -1) })
    },
  }))
)
```

**Result**: Action log enables time-travel. Each action is stored as `{ type, payload }` — serializable, replayable. `invertAction` function maps each action type to its inverse (add → remove, toggle → toggle). Without Redux pattern (string-constant action types), this approach fails because function closures capture local scope and cannot be replayed.

### Example 3: Outside-React Dispatch with WebSocket

**Problem**: Live auction app receives bid updates via WebSocket. Must update store and show notification.

**Solution**:
```typescript
// store.ts
type AuctionAction =
  | { type: 'auction/bid'; itemId: string; bid: number; userId: string }
  | { type: 'auction/close'; itemId: string }

// websocket.ts
import { useStore } from './store'

const ws = new WebSocket('wss://auctions.example.com/feed')

ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  const store = useStore.getState()

  switch (data.event) {
    case 'new_bid':
      store.dispatch({
        type: 'auction/bid',
        itemId: data.itemId,
        bid: data.amount,
        userId: data.user,
      })
      break
    case 'auction_closed':
      store.dispatch({ type: 'auction/close', itemId: data.itemId })
      break
  }
}
```

**Result**: WebSocket handler drives store directly. No React component needed. The store is the single source of truth; any React component subscribed to `auction/bid` re-renders automatically. The action pattern makes the WS → store contract explicit — each event maps to one action type.

---

## Key Takeaways
- Zustand `set()` is conceptually equivalent to Redux `dispatch` — reducer pattern is optional ceremony
- Reducer pattern: extract pure function `(state, action) => state`, wire through `set()` via a `dispatch` action
- String-constant actions enable DevTools tracing, undo/redo, and serializable action logs
- Function-based actions preserve TypeScript autocomplete and are idiomatic Zustand
- `devtools` middleware connects Zustand to Redux DevTools — always name the third `set()` param
- Use reducer pattern for complex/multi-action state; use direct `set()` for simple/isolated mutations
- Stores exist outside React — dispatch actions from WebSocket, router, service worker without providers
- Test reducers as pure functions (fast, no React); test store integration for middleware/subscriber correctness
- Porting Redux to Zustand: keep action types + reducer, replace createSlice/Provider with `create()` + `devtools`
- Undo/redo requires serializable action log — string-constant actions are mandatory

## Common Misconception

**"Redux pattern in Zustand means I must always use a reducer function."**

Redux pattern is optional. Zustand does not mandate actions, reducers, action types, or switch statements. The pattern exists for developers who want Redux-like predictability without Redux overhead.

The trap: developers porting from Redux sometimes write a reducer for every store, even simple toggles and counters. This adds typing, reading, and maintenance cost without benefit.

Correct framing: treat the reducer pattern as a tool for complex state transitions. Default to direct `set()` mutations. Escalate to reducer pattern when you hit three or more interdependent action types, or when you need undo/redo or DevTools tracing per action. The pattern serves you — you do not serve the pattern.

---

## Feynman Explain
(Explain the Redux pattern in Zustand to a junior developer who knows `useState` but has never used Redux or Zustand. Use no jargon: no "dispatch", "reducer", "action type", "middleware". Describe the problem: "Sometimes you need to update state in many different ways, and you want to see a history of every update." Start from `useState` and build up to why you'd want a switch statement that takes a "command" and returns new state.)

*Pause. Say explanation aloud or write it down. Then run `learn.sh explain zustand-state-management 07-redux-pattern` — AI probes gaps in your explanation.*

---

## Reframe
(Pause. Critique: Redux pattern in Zustand adds ceremony. Does it actually solve a real problem, or does it let Redux veterans feel productive without learning Zustand idioms? When does this pattern become a cargo cult? Write your evaluation. Consider: a team of 5 building a new app from scratch — do they start with reducer pattern or only add it when pain appears?)

---

## Drill
Take the quiz. Questions cover action type design, reducer testing, DevTools integration, and the decision between reducer pattern vs direct set().

Run: `learn.sh quiz zustand-state-management 07-redux-pattern`
