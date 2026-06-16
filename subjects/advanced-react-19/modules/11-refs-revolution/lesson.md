# Module 11: Refs Revolution — forwardRef Deprecated, ref as Prop

Est. study time: 1.5h
Language: en

## Learning Objectives
- Migrate components from `forwardRef` to `ref` as prop in React 19
- TypeScript type refs without `ForwardRefRenderFunction` using `React.Ref<>`
- Implement ref cleanup patterns: callback refs returning cleanup functions
- Compose multiple refs using callback ref patterns

---

## Core Content

### forwardRef Deprecated — ref Is Now a Regular Prop

Before React 19, `ref` was special. It did not flow through props like `onClick` or `className`. To expose a DOM node to a parent, you wrapped your component in `forwardRef`:

React 18:
```typescript
const MyInput = forwardRef<HTMLInputElement, MyInputProps>(
  (props, ref) => <input ref={ref} {...props} />
)
```

React 19:
```typescript
function MyInput({ ref, ...props }: MyInputProps & { ref?: React.Ref<HTMLInputElement> }) {
  return <input ref={ref} {...props} />
}
```

`ref` behaves like `key` — always accessible, never part of `props` enumeration. Remove `forwardRef`, destructure `ref` directly.

> **Think**: Why did React make `ref` a prop instead of keeping `forwardRef`? What problem does this solve?
>
> *Answer: forwardRef created unnecessary wrapping. Every component that forwarded ref required an extra HOC layer. Trees with 50+ forwarded components each had 50 extra HOC calls. Ref-as-prop eliminates this overhead. Server Components could not use forwardRef (hooks not allowed). Ref-as-prop enables refs in server components that render client children.*

### Migration: Codemod and Manual Approaches

**Codemod** (recommended for bulk migration):
```bash
npx react-codemod update-ref-as-prop
```

Handles: removes `forwardRef` calls, moves `ref` to destructured props, adjusts TypeScript types.

**Manual migration** (single component):
1. Remove `forwardRef` wrapper
2. Add `ref` to destructured props
3. Replace `ForwardRefRenderFunction` / `ForwardedRef` types with `React.Ref<>`
4. Update any `displayName` assignments

Before:
```typescript
interface InputProps { label: string }
const Input = forwardRef<HTMLInputElement, InputProps>(
  (props, ref) => <input ref={ref} {...props} />
)
Input.displayName = 'Input'
```

After:
```typescript
interface InputProps { label: string; ref?: React.Ref<HTMLInputElement> }
function Input({ label, ref, ...props }: InputProps) {
  return <input ref={ref} {...props} />
}
Input.displayName = 'Input'
```

> **Think**: A team has 300 `forwardRef` uses across 80 files. Codemod or manual — which is safer?
>
> *Answer: Codemod first, then manual review. Run codemod, run type checker, fix type errors manually. Codemod handles 90% of cases. Remaining 10% are components doing custom ref forwarding or combining forwardRef with other HOCs.*

### TypeScript Changes: React.Ref<> Type

React 18 types for forwarded refs:
```typescript
// Component type
const Comp: ForwardRefRenderFunction<HTMLDivElement, Props>

// Ref type in props
props: Props & { ref?: ForwardedRef<HTMLDivElement> }
```

React 19 types — simplified:
```typescript
interface Props {
  ref?: React.Ref<HTMLDivElement>
}

function Comp({ ref }: Props) { ... }
```

`React.Ref<T>` is shorthand for `RefCallback<T> | RefObject<T> | null`. No more `ForwardRefRenderFunction`, no more `ForwardedRef`.

Custom component refs using `useImperativeHandle`:
```typescript
interface CounterHandle {
  reset: () => void
  getValue: () => number
}

interface CounterProps {
  ref?: React.Ref<CounterHandle>
}

function Counter({ ref }: CounterProps) {
  const internalRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(ref, () => ({
    reset() { /* ... */ },
    getValue() { return 42 }
  }))

  return <div ref={internalRef}>...</div>
}
```

> **Think**: Why did `ForwardedRef<T>` exist in React 18 but not React 19? What was that type hiding?
>
> *Answer: ForwardedRef<T> was `RefCallback<T> | RefObject<T> | null` — identical to React.Ref<T>. It existed only to signal "this ref came through forwardRef." React 19 removes the distinction: all refs are just refs. Same type, fewer names to learn.*

### Ref Cleanup in React 19 — Callback Refs Return Cleanup Functions

React 19 introduces ref cleanup. Callback refs can return a cleanup function:

```typescript
<div
  ref={(el) => {
    if (el) {
      const observer = new ResizeObserver(() => { /* ... */ })
      observer.observe(el)
      return () => observer.disconnect()  // cleanup on unmount
    }
  }}
/>
```

Before React 19, ref callbacks could not clean up. You needed `useEffect` for observer cleanup. Now cleanup ties directly to the ref lifecycle — runs when ref changes target or component unmounts.

> **Think**: What happens if you return a cleanup from a ref callback but the component re-renders without changing the ref target?
>
> *Answer: Cleanup does not run. Ref callback cleanup runs only when: (1) ref target changes, or (2) component unmounts. Stable refs during re-renders do not trigger cleanup.*

### Composing Refs: Forwarding to DOM Elements, Multiple Refs

**Single ref forwarding** (most common):
```typescript
function Input({ ref, ...props }: InputProps) {
  return <input ref={ref} {...props} />
}
```

**Multiple refs on same element** — use callback ref composition:
```typescript
function mergeRefs<T>(
  ...refs: (React.Ref<T> | undefined)[]
): React.RefCallback<T> {
  return (value: T | null) => {
    refs.forEach(ref => {
      if (typeof ref === 'function') {
        ref(value)
      } else if (ref && 'current' in ref) {
        (ref as React.MutableRefObject<T | null>).current = value
      }
    })
  }
}

function Input({ ref, ...props }: InputProps) {
  const internalRef = useRef<HTMLInputElement>(null)

  return <input ref={mergeRefs(ref, internalRef)} {...props} />
}
```

`mergeRefs` utility is common enough that many libraries provide it (e.g., `@radix-ui/react-compose-refs`).

> **Think**: Why not just pass multiple ref props? Why need mergeRefs?
>
> *Answer: DOM elements accept only one `ref` prop. Last one wins. To attach multiple ref handlers (parent ref + local ref + observer ref), compose them into a single callback.*

### useImperativeHandle with Ref-as-Prop Pattern

React 19 `useImperativeHandle` works identically — the ref comes from props, not `forwardRef`:

```typescript
interface VideoPlayerHandle {
  play: () => void
  pause: () => void
  jumpTo: (time: number) => void
}

interface VideoPlayerProps {
  ref?: React.Ref<VideoPlayerHandle>
  src: string
}

function VideoPlayer({ ref, src }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useImperativeHandle(ref, () => ({
    play() { videoRef.current?.play() },
    pause() { videoRef.current?.pause() },
    jumpTo(time) { if (videoRef.current) videoRef.current.currentTime = time }
  }), [])

  return <video ref={videoRef} src={src} />
}
```

The imperative handle pattern did not change. Only how ref reaches the component changed.

> **Think**: When should you expose imperative handles vs let parent control via props?
>
> *Answer: Imperative handles for imperative actions (focus, scroll, play media, measure DOM). Props for declarative control (disabled, value, open). If parent must call .focus(), that is imperative. If parent sets autofocus prop, that is declarative. Prefer declarative when possible — React handles it automatically.*

### Ref Callback Patterns: ResizeObserver, IntersectionObserver with Cleanup

**IntersectionObserver with ref cleanup**:
```typescript
function LazyImage({ ref, src, alt }: LazyImageProps) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div
      ref={(el) => {
        if (el) {
          const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
              setIsVisible(true)
              observer.disconnect()
            }
          })
          observer.observe(el)
          return () => observer.disconnect()
        }
      }}
      style={{ minHeight: 200 }}
    >
      {isVisible ? <img src={src} alt={alt} /> : <Placeholder />}
    </div>
  )
}
```

Cleanup ensures observer does not leak when component unmounts mid-observation.

**ResizeObserver with responsive state**:
```typescript
function ResponsivePanel({ ref }: PanelProps) {
  const [size, setSize] = useState({ width: 0, height: 0 })

  return (
    <div
      ref={(el) => {
        if (!el) return
        const observer = new ResizeObserver(([entry]) => {
          setSize({
            width: entry.contentRect.width,
            height: entry.contentRect.height
          })
        })
        observer.observe(el)
        return () => observer.disconnect()
      }}
    >
      Width: {size.width}px, Height: {size.height}px
    </div>
  )
}
```

> **Think**: Ref callback cleanup vs useEffect cleanup — when should you prefer each for observers?
>
> *Answer: Ref callback cleanup when observer lifecycle matches element lifecycle (observe on mount, disconnect on unmount). useEffect cleanup when you need extra dependencies beyond the element reference (e.g., re-observe when a prop changes). Ref callbacks are cleaner for element-bound observers.*

### Merging Refs: Callback Refs vs Ref Prop

**Pattern 1: Inline merge function** (re-creates on every render — fine for refs):
```typescript
function Input({ ref, ...props }: InputProps) {
  return (
    <input
      ref={(el) => {
        setRef(ref, el)  // sets parent ref
        localRef.current = el  // sets local ref
        observerRef.current?.observe(el)  // triggers observation
      }}
      {...props}
    />
  )
}
```

**Pattern 2: Stable merge with useCallback** (optional optimization):
```typescript
function Input({ ref, ...props }: InputProps) {
  const handleRef = useCallback((el: HTMLInputElement | null) => {
    setRef(ref, el)
    localRef.current = el
  }, [ref])

  return <input ref={handleRef} {...props} />
}
```

`useCallback` prevents ref callback re-creation on every render. Useful when ref callback itself has side effects beyond setting `.current`.

> **Think**: Does a re-created ref callback cause React to run cleanup and re-attach?
>
> *Answer: Yes. If you pass inline arrow function as ref, React treats it as new ref callback every render — runs previous cleanup, calls new callback with `null`, then with element. Inline functions work but cause extra cycles. Use `useCallback` or stable ref to avoid unnecessary re-attachment.*

### Server Components and Refs — Not Supported in RSC

Server Components render on the server. They never have DOM nodes. Therefore, refs are not supported:

```typescript
// ❌ Server Component — ref will not work
async function ServerCard({ ref }: { ref?: React.Ref<HTMLDivElement> }) {
  const data = await fetchData()
  return <div ref={ref}>{data.title}</div>
  // ref is silently ignored — no DOM on server
}
```

```typescript
// ✅ Client Component — ref works
'use client'
function ClientCard({ ref }: { ref?: React.Ref<HTMLDivElement> }) {
  return <div ref={ref}>Client rendered</div>
}
```

If you need a Server Component to expose a DOM node, wrap it with a Client Component:
```typescript
// Server Component
async function Page() {
  return <ServerContent />
}

// Client wrapper
'use client'
function ServerContent({ ref }: { ref?: React.Ref<HTMLDivElement> }) {
  return <div ref={ref}>...</div>
}
```

> **Think**: Why can't Server Components pass refs to child Client Components? What prevents this?
>
> *Answer: Server Components cannot pass refs because ref is a special prop that requires runtime reconciliation. Server Components serialize as JSON — refs are non-serializable (they reference DOM nodes). Even passing a ref callback from a Server Component to a Client Component fails because the callback was created on server and cannot execute on client.*

### Third-Party Library Compatibility

React 19 does not remove `forwardRef`. It deprecates it with a warning. Third-party libraries can ship React 18-style forwardsRef components and they work. Migration timeline:

| Library | Status |
|---------|--------|
| MUI v6 | forwardRef deprecated, ref-as-prop in migration |
| Radix UI | Some primitives already use ref-as-prop |
| Headless UI | Plans ref-as-prop for next major |
| react-hook-form | Passes ref via `ref` prop — works with both patterns |

```typescript
// Third-party lib still using forwardRef — works in React 19
import { Button } from 'third-party-lib'
// <Button ref={myRef}>Click</Button> — still works
```

The forwardRef deprecation is additive. No breakage. Libraries that remove forwardRef in their source code still export components compatible with React 18 consumers because `ref` as prop also works in React 18 (React ignores unknown props — ref was always accessible on the props object, just not documented).

> **Think**: Can you use a React 19 library (ref-as-prop) in a React 18 app?
>
> *Answer: Yes, usually. React 18 ignores unknown DOM props (ref is known but not forwarded without forwardRef). For custom components, the `ref` prop appears in props object — you can destructure and use it. The only issue is TypeScript types: React 18's type definitions do not include `ref` in default props. Use `React.ComponentPropsWithoutRef` or explicit typing.*

---

## Why This Matters

The `forwardRef` pattern was a pain point for every React developer. It forced HOC wrapping, added TypeScript boilerplate, and confused newcomers (why can't I pass ref like every other prop?). React 19 eliminates this. Ref becomes a first-class prop. Combined with ref cleanup, the refs API is simpler, more powerful, and aligned with how developers intuitively expect refs to work. This is not just DX polish — it removes the largest remaining barrier to Server Component adoption (forwardRef could not work in RSC). Understanding the new refs model is essential for writing idiomatic React 19 components and migrating existing codebases.

---

## Common Questions

**Q: Does every component need to accept ref now?**
A: No. Only components that expose a DOM node or imperative handle. Internal components keep refs private via `useRef`.

**Q: What happens to `useImperativeHandle` in React 19?**
A: Unchanged. It still accepts a ref and factory function. The only difference: ref comes from props instead of forwardRef's second argument.

**Q: Can I use both forwardRef and ref-as-prop together?**
A: Yes, during migration. forwardRef components can pass ref to child components that expect ref-as-prop. Both patterns coexist.

**Q: Does ref cleanup work with ref objects (useRef)?**
A: No. Ref cleanup works with callback refs only. Ref objects (React.RefObject) do not support cleanup. Use callback refs when you need setup/teardown.

**Q: Can I pass ref to a native HTML element without a wrapper component?**
A: Yes, always could. `<input ref={myRef} />` works in React 19 the same as React 18. The change is for custom components.

---

## Examples

### Example 1: Migrating a Component Library from forwardRef to Ref-as-Prop

**Problem**: A UI library exports 50 components using `forwardRef`. Library targets both React 18 and 19 consumers.

**Before**:
```typescript
export interface ButtonProps {
  variant: 'primary' | 'secondary'
  children: React.ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, children }, ref) => (
    <button ref={ref} className={`btn btn-${variant}`}>
      {children}
    </button>
  )
)
Button.displayName = 'Button'
```

**After** (React 19-first, React 18-compatible):
```typescript
export interface ButtonProps {
  variant: 'primary' | 'secondary'
  children: React.ReactNode
  ref?: React.Ref<HTMLButtonElement>
}

export function Button({ variant, children, ref }: ButtonProps) {
  return (
    <button ref={ref} className={`btn btn-${variant}`}>
      {children}
    </button>
  )
}
Button.displayName = 'Button'
```

**Result**: Same consumer API (`<Button ref={myRef}>`). No HOC wrapper. TypeScript types are simpler. Works in React 18 (ref destructures from props, gets assigned by React 19's automatic forwarding or manually passed by parent).

### Example 2: Conditional Observer with Ref Cleanup

**Problem**: A dashboard component needs to track element visibility only when `tracking` prop is true. Observer must clean up properly.

```typescript
'use client'

interface TrackedSectionProps {
  ref?: React.Ref<HTMLDivElement>
  tracking: boolean
  onVisible: () => void
}

function TrackedSection({ ref, tracking, onVisible }: TrackedSectionProps) {
  const internalRef = useRef<HTMLDivElement>(null)

  const handleRef = useCallback((el: HTMLDivElement | null) => {
    // Forward to parent ref
    if (typeof ref === 'function') ref(el)
    else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = el

    // Set internal ref
    internalRef.current = el

    // Observer setup only when tracking enabled
    if (el && tracking) {
      const observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          onVisible()
          observer.disconnect()
        }
      })
      observer.observe(el)
      return () => observer.disconnect()
    }
  }, [ref, tracking, onVisible])

  return <div ref={handleRef}>Tracked content</div>
}
```

**Result**: Observer active only during tracking. Cleanup runs when `tracking` becomes false, component unmounts, or `ref` target changes. No observer leaks.

### Example 3: Composing Refs for Third-Party Integration

**Problem**: Component needs to expose DOM node to parent, measure its size for internal logic, and integrate with a charting library that requires a ref.

```typescript
'use client'

interface MeasuredChartProps {
  ref?: React.Ref<HTMLDivElement>
  data: number[]
}

function MeasuredChart({ ref, data }: MeasuredChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  const composedRef = useCallback((el: HTMLDivElement | null) => {
    // Parent ref
    if (typeof ref === 'function') ref(el)
    else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = el

    // Internal ref
    chartRef.current = el

    // Resize tracking
    if (el) {
      const ro = new ResizeObserver(([entry]) => {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        })
      })
      ro.observe(el)
      return () => ro.disconnect()
    }
  }, [ref])

  useEffect(() => {
    if (chartRef.current) {
      initChart(chartRef.current, data)
    }
  }, [data])

  return <div ref={composedRef} />
}
```

**Result**: Single callback manages parent ref, internal ref, and ResizeObserver — all with correct cleanup.

---

## Key Takeaways
- `forwardRef` deprecated in React 19 — destructure `ref` as regular prop
- Codemod `npx react-codemod update-ref-as-prop` handles bulk migration
- TypeScript: use `React.Ref<T>` instead of `ForwardedRef<T>` or `ForwardRefRenderFunction<T>`
- Ref cleanup: callback refs can return cleanup function — runs on target change or unmount
- Compose multiple refs with callback ref merging pattern
- `useImperativeHandle` unchanged — ref comes from props instead of forwardRef
- Server Components cannot use refs — wrap with Client Component
- `forwardRef` still works in React 19 — no breaking change for third-party libs

## Common Misconception

**"Ref cleanup replaces useEffect cleanup."**

Ref cleanup replaces only observer setup/teardown tied to element lifecycle. It does not replace the broader `useEffect` — data fetching, subscriptions to external stores, document-level event listeners, and timer setup still belong in `useEffect`. Ref cleanup is a specialized tool for element-bound side effects (ResizeObserver, IntersectionObserver, MutationObserver, DOM measurements). Reach for `useEffect` first. Use ref cleanup only when the side effect's lifecycle exactly matches the element's lifecycle.

---

## Feynman Explain
(Explain React 19's ref system to a developer who learned React before hooks existed. They only know class components with `createRef` and string refs. Compare: class `ref="input"` → React 18 `forwardRef` + `useRef` → React 19 ref-as-prop + cleanup. Show how each iteration removed ceremony.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain` — AI probes gaps.*

---

## Reframe
(Pause. Critique: Does ref cleanup introduce new mental overhead? A developer must now decide: callback ref with cleanup, callback ref without cleanup, ref object, or useEffect. Is more choice better? Compare against the simplicity of React 18 where refs had exactly one pattern (ref object + useEffect for side effects). Write your evaluation. Consider: when does ref cleanup reduce bugs vs increase confusion?)

---

## Drill

Take the quiz. MCQs test migration patterns, TypeScript types, cleanup behavior, and composition strategies.

Run: `learn.sh quiz advanced-react-19 11-refs-revolution`
