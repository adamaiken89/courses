# Module 4: Integration Test Tools — userEvent, waitFor, act

Est. study time: 2h
Language: en
Description: Master testing-library user interactions, async waiting patterns, and React act() mechanics.

## Learning Objectives
- Use userEvent for realistic user interactions over fireEvent
- Write async assertions with waitFor without flakiness
- Understand when act() is needed and when it's automatic
- Avoid Bun.sleep and setTimeout as wait mechanisms

---

## Core Content

### 4.1 userEvent vs fireEvent

`fireEvent` dispatches a single DOM event. `userEvent` simulates the full interaction chain a real user triggers.

```typescript
// fireEvent — dispatches click only
import { fireEvent } from '@testing-library/react'
fireEvent.click(button)
// Button's onClick fires. No hover, no focus, no keyboard events.

// userEvent — dispatches full interaction chain
import userEvent from '@testing-library/user-event'
const user = userEvent.setup()
await user.click(button)
// mousedown → mouseup → click → focus chain. Realistic.
```

Key difference: `userEvent` is async. Always `await` it. `fireEvent` is sync and misses real-world event ordering.

**What userEvent provides that fireEvent doesn't:**
- Hover/focus/blur chains
- Keyboard navigation (Tab, Enter, Escape)
- Type events with individual keystrokes
- Clipboard operations (copy/paste)
- Double-click context
- Async timing between events

> **Think**: When would fireEvent still be the right choice?
>
> *Answer: Performance testing (thousands of rapid events), testing event handler internals in isolation, or testing non-interactive elements where the event chain doesn't matter. For any test that simulates user behavior, userEvent is correct.*

### 4.2 userEvent.setup() — Why a New Instance Per Test

`userEvent.setup()` creates an instance with its own keyboard state, clipboard, and pointer state.

```typescript
// ✅ Correct — new instance per test
test('types in input', async () => {
  const user = userEvent.setup()
  render(<input />)
  await user.type(screen.getByRole('textbox'), 'Hello')
  expect(screen.getByRole('textbox')).toHaveValue('Hello')
})

// ⚠️ Shared instance between tests
const user = userEvent.setup() // outside test — shared state!

test('first interaction', async () => {
  await user.click(screen.getByText('Open'))
})

test('second interaction', async () => {
  // user still has state from previous test (keyboard, clipboard)
  await user.click(screen.getByText('Save'))
})
```

Shared instances cause test pollution: keyboard state, clipboard contents, and pointer position leak between tests. Create a new instance per test or per `describe`.

> **Think**: What userEvent state leaks between tests with a shared instance?
>
> *Answer: Keyboard state (modifier keys like Shift), clipboard contents, pointer position, and timing delays from previous async interactions.*

### 4.3 waitFor — Deterministic Async Waiting

`waitFor` polls a callback until it passes or times out. Never use `Bun.sleep()` or `setTimeout()` as wait.

```typescript
// ❌ Flaky — fixed delay
test('loads data', async () => {
  render(<CourseList />)
  await Bun.sleep(500) // Might pass locally, fail in CI
  expect(screen.getByText('Course 1')).toBeInTheDocument()
})

// ✅ Deterministic — polls assertion
test('loads data', async () => {
  render(<CourseList />)
  await waitFor(() => {
    expect(screen.getByText('Course 1')).toBeInTheDocument()
  })
})
```

`waitFor` internals:
- Runs callback every 50ms
- Stops when callback passes (no error thrown)
- Default timeout 1000ms (configurable: `waitFor(..., { timeout: 5000 })`)
- Throws with callback output if timeout reached

**MutationObserver fallback:** `waitFor` uses MutationObserver to detect DOM changes, then re-runs the callback. This is more efficient than polling.

```typescript
// Custom timeout for slow operations
await waitFor(
  () => expect(screen.getByText('Data loaded')).toBeInTheDocument(),
  { timeout: 5000, interval: 100 }
)
```

> **Think**: What goes wrong when you use Bun.sleep(N) as async wait?
>
> *Answer: React renders are async and batched. setTimeout races against React's commit phase — the test might see state before React commits, or the timeout might be too short in slow CI. waitFor polls deterministically until the assertion passes or times out.*

### 4.4 waitFor vs findBy

`findBy*` queries are shorthand for `waitFor + getBy*`.

```typescript
// These are equivalent:
const el = await screen.findByText('Course 1')
const el = await waitFor(() => screen.getByText('Course 1'))

// findBy with options:
await screen.findByText('Course 1', {}, { timeout: 3000 })
```

Use `findBy*` for simple queries (single element, appears after async). Use `waitFor` for complex assertions (multiple elements, computed properties, side effects).

```typescript
// findBy — simple
const course = await screen.findByText('Course 1')

// waitFor — complex assertion
await waitFor(() => {
  expect(screen.getAllByRole('listitem')).toHaveLength(3)
  expect(screen.getByText('Loading')).not.toBeInTheDocument()
})
```

> **Think**: When should you use waitFor instead of findBy?
>
> *Answer: When you need to assert multiple conditions after an async update, or when the element doesn't have a specific query role/text. findBy is for "find one element when it appears." waitFor is for "assert something about the DOM after async work."*

### 4.5 act() — When It's Needed

React wraps state updates and effects in `act()` to ensure the DOM is committed before assertions.

Testing-library's `render()`, `userEvent`, `waitFor()`, and `fireEvent` all call `act()` internally:

```typescript
// ✅ render calls act internally
render(<MyComponent />)

// ✅ userEvent calls act for each event
await user.click(button)

// ✅ waitFor calls act each time it polls
await waitFor(() => { /* ... */ })

// ❌ Direct setState outside act — missing act warning
store.setState({ loading: true }) // If component subscribed, warning!

// ✅ Correct — wrap in act
act(() => { store.setState({ loading: true }) })
```

**When you need manual act():**
- Direct store mutations that trigger React re-renders
- Manual timer advancing (`jest.advanceTimersByTime`)
- Manual `setState` outside of testing-library's render context

**When you DON'T need act():**
- Inside `waitFor` callback (already in act)
- Inside `userEvent` interactions (already in act)
- Inside `render()` (already in act)
- Pure store tests without React (no React context)

> **Think**: Why does store.setState sometimes trigger act warnings but sometimes not?
>
> *Answer: If a component is subscribed to the store (via useStore hook), calling setState triggers a React re-render. If that re-render happens outside of any act scope, React warns. If no component is rendered that uses the store, no warning.*

### 4.6 Common Wait Anti-Patterns

```typescript
// ❌ Bun.sleep N — flaky, slow
await Bun.sleep(1000)
expect(screen.getByText('Data')).toBeInTheDocument()

// ❌ setTimeout wrapped in Promise — same problem
await new Promise(r => setTimeout(r, 1000))
expect(screen.getByText('Data')).toBeInTheDocument()

// ❌ await act with no assertion — waits nothing useful
await act(async () => { /* nothing */ })

// ✅ waitFor with assertion — correct
await waitFor(() => {
  expect(screen.getByText('Data')).toBeInTheDocument()
})

// ✅ findBy — shorter for simple cases
expect(await screen.findByText('Data')).toBeInTheDocument()
```

---

## Why This Matters

Incorrect use of fireEvent, act, and waitFor is the #1 cause of flaky React tests. userEvent gives reliable interaction simulation. waitFor gives deterministic waiting. Understanding act boundaries prevents warning noise.

---

## Common Questions

**Q: Can I configure default waitFor timeout?**
A: Yes, configure in vitest setup: `configure({ asyncUtilTimeout: 3000 })` from `@testing-library/react`.

**Q: Do I need userEvent.setup() in every test?**
A: Yes. It's cheap (no DOM overhead) and prevents shared state pollution.

**Q: What's the difference between waitFor and waitForElementToBeRemoved?**
A: `waitForElementToBeRemoved` is optimized for waiting until an element disappears. It uses MutationObserver directly and fails fast if the element doesn't exist.

---

## Key Takeaways

- Always use `userEvent` (async) over `fireEvent` (sync) for interaction tests
- `userEvent.setup()` per test — no shared state
- `waitFor` for async assertions — never `Bun.sleep` or setTimeout
- `findBy*` as shorthand for `waitFor + getBy*`
- `act()` is automatic in render, userEvent, waitFor — manual only for direct store/state mutations
- `fireEvent` is for performance testing or non-interactive elements only

---

## Common Misconception

**"userEvent is just fireEvent with async wrapping."**

userEvent simulates the full event chain (mouse down → focus → mouse up → click) with realistic timing between events. fireEvent dispatches a single event type. userEvent also manages keyboard state (Shift, Tab, etc.) and clipboard.

---

## Feynman Explain

(Explain the difference between userEvent and fireEvent. When would each fail silently? Give a concrete example of a bug userEvent catches that fireEvent misses.)

---

## Drill

Run: `learn.sh quiz testing 4`
