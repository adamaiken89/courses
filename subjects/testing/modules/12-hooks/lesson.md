# Module 12: Custom Hook Testing Patterns

Est. study time: 2h
Language: en
Description: Test custom hooks with renderHook, state transitions, and async timing.

## Learning Objectives
- Use renderHook to test hooks outside components
- Test state transitions — initial, intermediate, final
- Handle async hooks with act and waitFor
- Test hook cleanup and error states

---

## Core Content

### 12.1 renderHook Basics

`renderHook` creates a minimal React component that calls the hook and captures return values.

```typescript
import { renderHook, act } from '@testing-library/react'

// Simple hook
function useCounter(initial = 0) {
  const [count, setCount] = useState(initial)
  return { count, increment: () => setCount(c => c + 1), reset: () => setCount(initial) }
}

test('returns initial value', () => {
  const { result } = renderHook(() => useCounter(42))
  expect(result.current.count).toBe(42)
})

test('increments count', () => {
  const { result } = renderHook(() => useCounter())

  act(() => { result.current.increment() })

  expect(result.current.count).toBe(1)
})
```

**Key properties of renderHook:**
- Creates a test component that unmounts after the test
- `result.current` — always the latest return value of the hook
- `rerender(props)` — re-renders with new props
- `unmount()` — triggers cleanup effects

> **Think**: Why does `result.current` always reflect the latest hook return value?
>
> *Answer: renderHook re-renders the internal test component whenever React state updates. result.current is a ref that gets reassigned each render cycle.*

### 12.2 Testing State Transitions

Hooks have states. Test each state transition.

```typescript
// Hook with multiple states
function useAsyncData(fetchFn: () => Promise<Data>) {
  const [state, setState] = useState<{
    data: Data | null
    loading: boolean
    error: string | null
  }>({ data: null, loading: false, error: null })

  const load = useCallback(async () => {
    setState({ data: null, loading: true, error: null })
    try {
      const data = await fetchFn()
      setState({ data, loading: false, error: null })
    } catch (err) {
      setState({ data: null, loading: false, error: (err as Error).message })
    }
  }, [fetchFn])

  return { ...state, load }
}

// Tests
describe('useAsyncData', () => {
  test('initial state is idle', () => {
    const { result } = renderHook(() => useAsyncData(() => Promise.resolve({})))
    expect(result.current).toEqual({
      data: null,
      loading: false,
      error: null,
    })
  })

  test('loading state during fetch', async () => {
    const { result } = renderHook(() =>
      useAsyncData(() => new Promise(() => {})) // never resolves
    )

    act(() => { result.current.load() })

    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeNull()
  })

  test('success state after fetch', async () => {
    const { result } = renderHook(() =>
      useAsyncData(() => Promise.resolve({ id: '1', title: 'Test' }))
    )

    await act(async () => { await result.current.load() })

    expect(result.current.data).toEqual({ id: '1', title: 'Test' })
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  test('error state on fetch failure', async () => {
    const { result } = renderHook(() =>
      useAsyncData(() => Promise.reject(new Error('Network error')))
    )

    await act(async () => { await result.current.load() })

    expect(result.current.error).toBe('Network error')
    expect(result.current.loading).toBe(false)
    expect(result.current.data).toBeNull()
  })
})
```

> **Think**: Why test the loading state separately from the success state?
>
> *Answer: The loading state is transient — it exists between calling load() and the fetch resolving. If you only test the final state, a bug where loading never becomes true (UI never shows spinner) goes unnoticed.*

### 12.3 Hooks with Props and Rerender

Some hooks depend on props. Test prop changes trigger correct behavior.

```typescript
function useCourseAccess(courseId: string) {
  const course = useCourseStore((s) => s.courses[courseId])
  const user = useAuthStore((s) => s.user)

  return {
    isEnrolled: course?.studentIds?.includes(user?.id ?? ''),
    isOwner: course?.ownerId === user?.id,
  }
}

test('tracks enrollment across course changes', () => {
  useAuthStore.setState({ user: { id: 'user-1' } })
  useCourseStore.setState({
    courses: {
      'c1': { id: 'c1', ownerId: 'user-2', studentIds: ['user-1'] },
      'c2': { id: 'c2', ownerId: 'user-1', studentIds: [] },
    },
  })

  const { result, rerender } = renderHook(
    (courseId: string) => useCourseAccess(courseId),
    { initialProps: 'c1' }
  )

  expect(result.current.isEnrolled).toBe(true)
  expect(result.current.isOwner).toBe(false)

  rerender('c2')

  expect(result.current.isEnrolled).toBe(false)
  expect(result.current.isOwner).toBe(true)
})
```

> **Think**: What happens if you don't pass updated props to rerender?
>
> *Answer: The hook still reads the same props. rerender without arguments re-renders with initialProps. The hook doesn't update unless props actually change.*

### 12.4 Testing Hook Cleanup

Hooks with `useEffect` cleanups (subscriptions, intervals, event listeners).

```typescript
function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}

test('cleans up event listeners on unmount', () => {
  const addSpy = vi.spyOn(window, 'addEventListener')
  const removeSpy = vi.spyOn(window, 'removeEventListener')

  const { unmount } = renderHook(() => useOnlineStatus())
  expect(addSpy).toHaveBeenCalledTimes(2)

  unmount()
  expect(removeSpy).toHaveBeenCalledTimes(2)

  addSpy.mockRestore()
  removeSpy.mockRestore()
})
```

**Testing that cleanup prevents memory leaks:**

```typescript
test('interval does not fire after unmount', () => {
  vi.useFakeTimers()
  const onTick = vi.fn()

  const { unmount } = renderHook(() => {
    useEffect(() => {
      const id = setInterval(onTick, 1000)
      return () => clearInterval(id)
    }, [])
  })

  unmount()
  vi.advanceTimersByTime(5000)

  expect(onTick).not.toHaveBeenCalled()
  vi.useRealTimers()
})
```

> **Think**: Why does unmount() not trigger act warnings for the interval test?
>
> *Answer: The interval cleanup runs synchronously in unmount. Since vi.advanceTimersByTime after unmount triggers only due timers, but the cleanup removed the interval, no state updates happen outside act.*

### 12.5 Hooks with Store Subscriptions

```typescript
function useCourseCount() {
  const count = useCourseStore((s) => Object.keys(s.courses).length)
  return count
}

test('reacts to store changes', () => {
  useCourseStore.setState({ courses: {} })
  const { result } = renderHook(() => useCourseCount())
  expect(result.current).toBe(0)

  act(() => {
    useCourseStore.setState({
      courses: { '1': { id: '1', title: 'New' } }
    })
  })

  expect(result.current).toBe(1)
})
```

Key: store changes via `act()` trigger React re-render → hook re-evaluates → `result.current` updates.

> **Think**: Why does store.setState need act() wrapping in hook tests but not in pure store tests?
>
> *Answer: renderHook creates a React component. store.setState triggers a React re-render of that component. React requires state updates to happen inside act(). Pure store tests have no React component to re-render.*

### 12.6 Hooks Using Other Hooks

Hooks that compose other hooks.

```typescript
function useCourseDisplay(courseId: string) {
  const course = useCourseStore((s) => s.courses[courseId])
  const count = useCourseCount() // uses same store

  if (!course) return null
  return { title: course.title, totalCourses: count }
}

test('returns null for non-existent course', () => {
  useCourseStore.setState({ courses: {} })
  const { result } = renderHook(() => useCourseDisplay('nonexistent'))
  expect(result.current).toBeNull()
})
```

No need to mock useCourseCount — it reads the same store you set up.

---

## Why This Matters

Hook tests are the most efficient way to test state logic. They're faster than component tests (no JSX rendering) and more integrated than pure function tests (real React effects, store subscriptions).

---

## Common Questions

**Q: Should I test every custom hook?**
A: Test hooks with 3+ lines of logic, side effects, or store subscriptions. Skip trivial getter hooks (useCount just returning `store.x.length`).

**Q: What about hooks that use React Router?**
A: Wrap in MemoryRouter with renderHook wrapper option: `renderHook(() => useParams(), { wrapper: MemoryRouter })`.

**Q: Can I use waitFor in hook tests?**
A: Yes. waitFor works inside renderHook tests. Use it to poll result.current until a condition is met.

---

## Key Takeaways

- renderHook creates a test component — test hooks directly without rendering
- Test each state transition: initial, loading, success, error
- Use act() around state mutations that trigger React re-renders
- Rerender with new props to test prop change reactions
- Test cleanup via unmount() — verify listeners/intervals removed
- Store-subscribed hooks react to store.setState inside act()

---

## Common Misconception

**"renderHook tests are less realistic than component tests."**

renderHook still runs the hook in a real React component with real effects, state, and lifecycle. The only difference is no JSX rendering. For hooks that manage state without DOM interaction, renderHook is perfectly realistic.

---

## Feynman Explain

(Explain how you'd test a hook that: (1) fetches data on mount, (2) sets loading state, (3) sets data/error on completion. Walk through the three state tests: initial, loading, success/error.)

---

## Drill

Run: `learn.sh quiz testing 12`
