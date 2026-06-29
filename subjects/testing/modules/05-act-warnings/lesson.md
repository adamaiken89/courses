# Module 5: Random act() Warnings — Cause and Fix

Est. study time: 1.5h
Language: en
Description: Understand why "An update to Component inside a test was not wrapped in act()" happens and how to fix it.

## Learning Objectives
- Identify root cause of act() warnings (async updates outside act scope)
- Fix act() warnings with waitFor, act, or flushMicrotasks
- Understand React batching and how it relates to act()
- Prevent warning regressions with linting

---

## Core Content

### 5.1 The Warning

```
Warning: An update to CourseList inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
```

This warning means a React state update happened outside of React's `act()` scope. The test might still pass, but the DOM may not be fully committed when assertions run.

**Common causes:**
1. Async store update after API call completes
2. `setTimeout` callback that updates state
3. `useEffect` that runs after render
4. Zustand store `setState` called outside `act()`

**The warning exists because:** without `act()`, React can't guarantee the DOM has been updated before your assertions run. This leads to flaky tests that pass locally but fail in CI.

> **Think**: Why does this warning appear sometimes but not always for the same code?
>
> *Answer: Timing. If the async update completes before the assertion runs (fast machine), no warning. If it completes after (slower machine, CI), warning + potential test failure. This is why the warning exists — to catch non-determinism.*

### 5.2 Root Cause: React Batching and act

React 18+ batches state updates by default. `act()` tells React to flush this batch and commit the DOM synchronously.

```
Without act():
render() → [React queues effects] → test assertion runs → [effects fire] → DOM updated AFTER assertion

With act():
act(() => render()) → [React flushes effects] → DOM committed → test assertion runs → ✅
```

Testing-library's `render()`, `userEvent`, and `waitFor()` all register act scopes automatically. The warning appears when a state update originates **outside** these scopes.

**Common scenario leading to warning:**

```typescript
test('loads courses', async () => {
  render(<CourseList />) // React effects fire inside act scope

  // API call starts in useEffect
  // Inside effect: store.loadCourses() called
  // The store action calls fetch, which completes...
  // ... and calls store.setState({ courses, loading: false })
  // This setState triggers a React re-render

  // BUT: the API response arrives AFTER render's act scope closed
  // So the setState → re-render happens outside act scope
  // Warning!
})
```

The fix: use `waitFor` to assert the async result, which polls inside its own act scope.

```typescript
// ✅ Fix — waitFor polls inside act scope
await waitFor(() => {
  expect(screen.getByText('Loaded Data')).toBeInTheDocument()
})
```

> **Think**: What happens if you ignore the act() warning and the test still passes?
>
> *Answer: The test is flaky. It passes when the async update coincidentally completes before the assertion runs, and fails when it doesn't. CI machines are typically slower than dev machines, so this pattern causes "works on my machine" failures.*

### 5.3 Fix Patterns by Scenario

**Scenario 1: API response triggers store update after render**

```typescript
// ❌ Warning — API response arrives outside act scope
test('loads courses', () => {
  render(<CourseList />)
  expect(screen.getByText('Course 1')).toBeInTheDocument()
})

// ✅ Fix 1 — waitFor for assertion
test('loads courses', async () => {
  render(<CourseList />)
  await waitFor(() => {
    expect(screen.getByText('Course 1')).toBeInTheDocument()
  })
})

// ✅ Fix 2 — await a known async operation
test('loads courses', async () => {
  render(<CourseList />)
  await screen.findByText('Course 1')
})
```

**Scenario 2: Store.setState in test body triggers re-render**

```typescript
test('shows error state', () => {
  render(<CourseList />)

  // ❌ Direct setState outside act scope
  useCourseStore.setState({ error: 'Failed' })

  // ✅ Fix — wrap in act()
  act(() => {
    useCourseStore.setState({ error: 'Failed' })
  })

  expect(screen.getByText('Failed')).toBeInTheDocument()
})
```

**Scenario 3: setTimeout/interval in component**

```typescript
function AutoSave({ onSave }: { onSave: () => void }) {
  useEffect(() => {
    const id = setInterval(() => onSave(), 5000)
    return () => clearInterval(id)
  }, [onSave])
  return null
}

test('auto-saves periodically', () => {
  vi.useFakeTimers()
  const onSave = vi.fn()
  render(<AutoSave onSave={onSave} />)

  // ❌ Timer fires outside act scope
  vi.advanceTimersByTime(5000)

  // ✅ Fix — advance inside act
  act(() => { vi.advanceTimersByTime(5000) })

  expect(onSave).toHaveBeenCalledTimes(1)
  vi.useRealTimers()
})
```

> **Think**: Why does act() fix the fake timer warning?
>
> *Answer: vi.advanceTimersByTime hasn't changed React's state — but the timer callback calls setState/onSave which triggers a React re-render. act() wraps that re-render so React commits the DOM and assertions see the updated state.*

### 5.4 Store Updates Without React Component

If no React component is rendered (pure store test), act warnings should not appear. If they do, something is triggering a React state update.

```typescript
// ✅ Pure store test — no act warning
test('store action works', async () => {
  await useCourseStore.getState().loadCourses()
  await flushMicrotasks()
  expect(useCourseStore.getState().courses).toEqual([])
})

// If warning appears here, something in the store action
// is triggering a React-specific subscription (rare).
```

### 5.5 Preventing act Warnings

**Lint rule:** `@testing-library/no-unnecessary-act` prevents unnecessary act wrappers. `@testing-library/no-wait-for-side-effects` prevents side effects inside waitFor.

```typescript
// eslint-plugin-testing-library rules:
// 'testing-library/no-unnecessary-act': 'error'
```

**General prevention checklist:**
1. Always `await` async operations (userEvent, findBy, waitFor)
2. Use `waitFor` for assertions after async updates
3. Wrap direct store mutations in `act()` when subscribed components are rendered
4. Use `vi.useFakeTimers` + `act` for timer-based components
5. Never use `Bun.sleep` or `setTimeout` as wait mechanism

---

## Why This Matters

act() warnings are the most common React testing frustration. Understanding the root cause (async updates outside React's batch scope) lets you fix them systematically instead of randomly wrapping things in act().

---

## Common Questions

**Q: Can I suppress act() warnings?**
A: Don't. They exist to catch real flakiness. Suppressing them makes tests less reliable.

**Q: What's the difference between act() and waitFor?**
A: act() flushes React state updates synchronously. waitFor() polls an assertion inside act() scope. Use act for direct state mutations, waitFor for asserting async results.

**Q: Why does the warning mention specific line numbers but they don't match my code?**
A: The stack trace points to the component that updated, not the line that triggered the update. Look for async operations (fetch, setTimeout, store subscription) in that component.

---

## Key Takeaways

- act() warnings mean a React state update happened outside act scope
- Always await async operations: userEvent, findBy, waitFor
- Wrap direct store mutations in act() when React components are rendered
- Fake timers need act() wrapping for advanceTimersByTime
- Pure store tests (no React) should never show act warnings
- Never suppress act warnings — they catch real flakiness

---

## Common Misconception

**"Wrap everything in act() to make warnings go away."**

act() is not a silencing mechanism. It tells React to flush state synchronously. Randomly wrapping code in act() hides the underlying timing issue. The correct fix is always to understand why the update happens outside act scope and fix the root cause.

---

## Feynman Explain

(Explain what causes "not wrapped in act()" warning. Use a real example: component fetches data in useEffect, store updates when fetch completes, test renders and asserts synchronously. Walk through why the warning appears.)

---

## Drill

Run: `learn.sh quiz testing 5`
