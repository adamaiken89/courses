# Module 13: React Compiler — Forget, Auto Memoization, Migration

Est. study time: 2.5h
Language: en

## Learning Objectives
- Explain how React Compiler auto-memoizes components and hooks at build time
- Identify patterns the compiler can and cannot memoize
- Apply incremental migration strategy: enable per module with `// @reactCompiler`
- Debug compiler output and understand what was memoized

---

## Core Content

### What React Compiler Does — Auto-Memoization at Build Time

React Compiler (code-named Forget) is a build-time Babel/TypeScript plugin that automatically memoizes components, hooks, and derived values. It analyzes JavaScript/TypeScript source and injects memoization calls — you stop writing `useMemo`, `useCallback`, `React.memo` manually.

Before compiler:
```typescript
function Profile({ user, posts }: ProfileProps) {
  const sortedPosts = useMemo(() => sortByDate(posts), [posts])
  const handleClick = useCallback((id: string) => {
    selectUser(id)
  }, [selectUser])
  return <MemoizedPostList items={sortedPosts} onSelect={handleClick} />
}
```

After compiler:
```typescript
function Profile({ user, posts }: ProfileProps) {
  const sortedPosts = sortByDate(posts)          // auto-memoized
  const handleClick = (id: string) => selectUser(id) // auto-memoized
  return <PostList items={sortedPosts} onSelect={handleClick} />
}
```

Compiler transforms at build time, not runtime. Output is standard React with `useMemo`/`useCallback` calls injected. This means zero runtime overhead from the compiler itself — same runtime semantics as hand-written memoization, but you do not write it.

> **Think**: If compiler produces the same `useMemo` calls you would write manually, what is the difference? Why is automatic better than manual?
>
> *Answer: Human error. Manual memoization has three failure modes: missing dependencies (stale closure), over-memoizing (unnecessary deps, wasted GC), under-memoizing (missed optimization). Compiler is precise — it traces the actual data flow through the function, not the deps array you declare. It also adapts: if you refactor and a value is no longer needed, compiler stops memoizing it. Manual deps arrays must be updated by hand.*

### Compiler Analysis — What It Can and Cannot Memoize

Compiler traces data flow through a component or hook. It creates a dependency graph of every variable, prop, and call expression. Then it memoizes any value that:

1. **Is derived from props or state**: `const fullName = `${first} ${last}``
2. **Is an inline function or closure**: `const handleClick = () => onClick(id)`
3. **Is an object/array literal**: `const config = { theme, size }`
4. **Is a JSX expression**: `<UserCard user={user} />` (memoizes the element)

Compiler is conservative — if it cannot prove memoization is safe, it skips rather than risk incorrect behavior.

**Patterns the compiler handles**:
- Inline functions passed as props
- Derived state from primitive calculations
- Object and array literals created in render
- Conditional values (ternary, logical &&)
- Promise results (with `use()` hook)
- Hooks that return stable references

**Patterns the compiler cannot handle**:
- Cross-module values: `import { someValue } from './module'` — compiler cannot track what `someValue` depends on
- Mutable refs: `ref.current` mutation — compiler assumes any ref read is dynamic
- Imperative handles: `useImperativeHandle` exposes methods — compiler cannot trace imperative flows
- Global/module-level mutable state
- `delete` or dynamic property access on objects
- Values that "leak" outside React's component lifecycle (e.g., stored in a singleton)
- Non-React code interop (e.g., imperative chart library calls)

> **Think**: Your component reads `import { transform } from './utils'` where `transform` depends on global config. Will the compiler memoize the result of `transform(data)`?
>
> *Answer: No. Compiler cannot analyze cross-module dependencies. `transform` is imported — its internal dependencies (global config, module state) are opaque. Compiler conservatively skips memoization. If `transform` is pure given same `data`, you still need manual `useMemo` with `[data]` deps.*

### Enabling per Module — The `// @reactCompiler` Directive

Compiler is opt-in at the file level. Add a directive at the top of every component/hook file:

```typescript
// @reactCompiler

import { useState } from 'react'

export function Profile({ user }: { user: User }) {
  const [editing, setEditing] = useState(false)
  // compiler memoizes everything below
  const displayName = `${user.first} ${user.last}`
  return <div>{displayName}</div>
}
```

Files without the directive compile normally — no auto-memoization. This enables incremental adoption across a large codebase.

Configuration in `babel.config.js` or `vite.config.ts`:
```typescript
// vite.config.ts
import reactCompiler from 'babel-plugin-react-compiler'

export default defineConfig({
  plugins: [
    reactCompiler({
      compilationMode: 'infer',  // or 'annotation' for strict mode
    }),
  ],
})
```

Options:
- `compilationMode: 'infer'` — uses `// @reactCompiler` directive
- `compilationMode: 'annotation'` — stricter, requires explicit opt-in per scope
- `runInCI: true` — fails build on compiler errors

> **Think**: Why opt-in per file instead of global enable? What risk does this mitigate?
>
> *Answer: Incremental rollback. If compiler produces incorrect behavior (infinite re-render, stale closure) in one module, you disable it for just that file — not the whole app. Also eases migration: enable on low-risk utility components first, validate with StrictMode, then expand to critical paths.*
<!-- textlint-disable -->
### Migration Strategy — Enable Incrementally, Test with StrictMode
<!-- textlint-enable -->
Best practices for adopting the compiler in an existing codebase:

1. **Prerequisite**: Upgrade to React 19 stable. Compiler is framework-agnostic but designed for React 19 semantics.
2. **Enable on non-critical files**: Start with leaf components (buttons, inputs, labels). These have simple data flow — compiler success rate is high.
3. **Run StrictMode**: React 19 StrictMode double-invokes components. Compiler-wrapped code must handle double-invoke correctly. Fix any issues before expanding.
4. **Run test suite**: Compiler should not change behavior — only performance. Regressions indicate compiler mis-analysis.
5. **Monitor re-renders**: Use React DevTools profiler. Compiler-memoized components should show fewer re-renders than before. If a component re-renders more after compiler, investigate.
6. **Expand to containers**: After leaf components validated, enable compiler on container/page components.
7. **Remove manual `useMemo`/`useCallback`**: Optional cleanup. Compiler ignores manual memoization — it re-memoizes based on its own analysis. Redundant `useMemo` calls add GC pressure. Remove them for cleaner code.

```typescript
// Phase 1: Leaf components
// @reactCompiler  // Button.tsx
function Button({ onClick, children }) { ... }

// Phase 2: Containers (after validation)
// @reactCompiler  // UserDashboard.tsx
function UserDashboard() { ... }

// Phase 3: Remove redundant memo
// Before: manual + compiler (wasted)
const sorted = useMemo(() => sort(items), [items])
// After: no manual memo (compiler handles it)
const sorted = sort(items)
```

> **Think**: You migrate a 500-file codebase. After enabling compiler on 50 leaf components, one breaks — infinite re-render. What is the fastest recovery?
>
> *Answer: Remove `// @reactCompiler` from that one file. The rest stay compiler-enabled. Fix the affected component's data flow (likely a ref mutation or cross-module value causing compiler to mis-memoize), then re-enable. Incremental design makes recovery single-file.*

### Compiler + Existing useMemo/useCallback — Overlap and Removal

When compiler is enabled on a file that already has manual `useMemo`/`useCallback`, both apply. The compiler re-wraps values in its own memoization — you get nested memoization: `useMemo(() => ...)` inside another `useMemo`. This is wasteful but not incorrect.

Manual memoization removal strategy:
- **Unnecessary**: `useMemo`/`useCallback` with prop-derived values — compiler handles these better
- **Keep temporarily**: `useMemo` for expensive computations where compiler skips (cross-module, ref-dependent)
- **Keep permanently**: `useMemo` for non-React interop, imperative handles, values passed to third-party libraries that need stable references

```typescript
// @reactCompiler

// This manual memo is redundant — compiler does it
const fullName = useMemo(() => `${first} ${last}`, [first, last])
// Remove: const fullName = `${first} ${last}`

// This manual memo is necessary — cross-module value
const config = useMemo(() => buildConfig(importedDefaults), [theme])
// Keep: compiler cannot analyze importedDefaults internals

// This useCallback is redundant — compiler handles inline functions
const onSubmit = useCallback((data: FormData) => {
  handleSubmit(data)
}, [handleSubmit])
// Remove: const onSubmit = (data: FormData) => handleSubmit(data)
```

> **Think**: A team enables the compiler everywhere but keeps all existing useMemo calls. What are the consequences?
>
> *Answer: No correctness bugs, but wasted GC overhead from nested memoization. Each manual useMemo creates a closure — the compiler wraps it in another closure. Double allocation per render. Remove redundant useMemo/useCallback after compiler enable to clean up. Automated codemod available: `npx react-compiler-remove-redundant-memo`.*

### Patterns the Compiler Handles

**Inline functions**: Most common case. Any inline arrow/function expression gets auto-memoized:
```typescript
// Compiler sees: onClick depends on [userId, navigate]
function User({ userId }: { userId: string }) {
  const navigate = useNavigate()
  return <button onClick={() => navigate(`/users/${userId}`)} />
}
```

**Derived values**: Any value computed from props or state:
```typescript
function Invoice({ lineItems, taxRate }: Props) {
  const subtotal = lineItems.reduce((sum, item) => sum + item.price * item.qty, 0)
  const tax = subtotal * taxRate
  const total = subtotal + tax
  // compiler memoizes each derivation independently
  return <Summary subtotal={subtotal} tax={tax} total={total} />
}
```

**Object/array literals**: New references each render — compiler stabilizes them:
```typescript
function Chart({ data, color }: Props) {
  const options = { color, responsive: true, animation: false }
  // Before: new object each render → <Chart> re-renders every time
  // After: memoized — stable ref when color unchanged
  return <ChartComponent options={options} data={data} />
}
```

**Conditional values**:
```typescript
function Alert({ type }: { type: 'success' | 'error' }) {
  const className = type === 'success' ? 'bg-green-100' : 'bg-red-100'
  const icon = type === 'success' ? <CheckIcon /> : <XIcon />
  // Both memoized. className changes with type. icon element stable per type.
  return <div className={className}>{icon}</div>
}
```

> **Think**: A derived value uses `Array.reduce` inside the component. Will the compiler memoize the result?
>
> *Answer: Yes — if the input array comes from props or state. Compiler traces `lineItems` back to props, creates dependency edge. If `lineItems` reference unchanged, reduce result is reused. No need for manual `useMemo`.*

### Patterns the Compiler Cannot Handle

**Cross-module values**: Compiler analyzes one module at a time. Imported values are opaque — their internal dependencies are invisible:
```typescript
import { config } from './appConfig'

function ThemeSwitcher() {
  return <div className={config.theme === 'dark' ? 'dark' : 'light'} />
  // NOT memoized — compiler cannot track config.theme
}
```

**Refs and imperative handles**: Mutable refs break the data-flow analysis:
```typescript
function Timer({ callback }: { callback: () => void }) {
  const cbRef = useRef(callback)
  useEffect(() => { cbRef.current = callback }, [callback])
  // ref.current read is opaque — compiler skips anything involving ref.current
}
```

**Dynamic property access**: `obj[key]` where `key` is dynamic:
```typescript
function Dynamic({ data, field }: Props) {
  const value = data[field as keyof Data]
  // NOT memoized — compiler cannot prove `field` doesn't mutate data
}
```

**Leaking React values**: Storing a React-derived value outside React's lifecycle:
```typescript
let externalState: Data

function DataLoader({ data }: { data: Data }) {
  externalState = data  // leaks to module scope
  // compiler detects the leak — skips memoization (safety first)
}
```

> **Think**: You use a `useDebounce` hook that returns a debounced value. Will the compiler memoize the debounced return?
>
> *Answer: Depends. If `useDebounce` is a custom hook — yes, compiler traces through hook calls. If `useDebounce` is from a third-party library without source — compiler cannot analyze cross-module hook internals. Compiler relies on hook signatures and types. For opaque hooks, it assumes values returned are inherently unstable and skips memoization.*

### Compiler + Suspense/Transitions Interaction

Compiler works alongside Suspense boundaries and transitions without special configuration. When a component suspends, compiler-memoized values are discarded and recomputed on resume — same as manual memoization behavior.

Key interaction points:

```typescript
// @reactCompiler
function UserProfile({ userId }: Props) {
  const user = use(fetchUser(userId))  // component suspends
  const displayName = `${user.name} (${user.role})`
  // compiler memoizes displayName with dependency on user
  // When component suspends (fetch pending), displayName not computed
  // When resumed (data arrives), displayName computed and memoized
  return <div>{displayName}</div>
}
```

Transitions and compiler:
```typescript
function SearchPage() {
  const [query, setQuery] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    startTransition(() => {
      setQuery(e.target.value)
    })
  }

  const results = searchCache.get(query)  // where searchCache is Map<string, Result[]>
  // Compiler skips memoization — searchCache is cross-module mutable store
  // Manual optimization still needed for such cases
  return <ResultsList results={results ?? []} />
}
```

Compiler does not affect transition semantics — it only memoizes value computation. The transition layer (interruptibility, priority) works independently.

> **Think**: A suspended component re-renders with new context value. Does the compiler re-memoize or reuse cached values?
>
> *Answer: Re-memoizes. Suspense discards the previous render output. On resume, component runs fresh — compiler recomputes all derived values, creates new memoization cache for this render. No value carryover across suspend boundaries.*

### Debugging Compiler Output — Understanding What Was Memoized

Use the compiler playground or `__DEBUG__` option to inspect generated output:

```bash
# CLI inspection
npx react-compiler --inspect src/App.tsx
```

Enable debug mode in config:
```typescript
reactCompiler({
  environment: {
    __DEBUG__: true,    // logs memoization decisions per scope
  },
})
```

What the compiler logs:
```
[React Compiler] App.tsx:3:0 — Profile
  ✓ memoized: displayName (derived from user.first, user.last)
  ✓ memoized: handleClick (inline function, deps: [onClick])
  ✗ skipped: results (cross-module value: searchCache)
  ✓ memoized: <ProfileCard /> (JSX, deps: [user, handleClick])
```

Use React DevTools to see consumer re-renders:
- Components with compiler should show fewer re-renders
- If a component still re-renders when props do not change, check compiler output for skipped scopes

Debugging checklist:
1. Is `// @reactCompiler` directive present and at file top?
2. Does the component use patterns compiler cannot handle? (refs, cross-module, dynamic keys)
3. Are imports wrapping React-derived values? (e.g., `import { formatDate } from 'date-lib'` wrapping a date object)
4. Is there a higher-order component or wrapper that breaks the compiler's hook-ordering analysis?
5. Does the value leak to external scope? (module variable, global store outside React)

> **Think**: After enabling the compiler, a component still re-renders every time its parent re-renders. Debug output shows no skipped scopes. What do you check next?
>
> *Answer: Check props reference equality. The parent may be passing a new object/array/function each render without memoization. Compiler memoizes inside a component — it cannot control what the parent passes in. The child receives new props each render and must re-render regardless. Fix: enable compiler on the parent too, or stabilize props manually.*

### Compiler in CI — Linting, Compilation Errors, Rollback

Integrate compiler into CI pipeline with proper escalation paths:

**Linting**: Use `eslint-plugin-react-compiler` to catch unsupported patterns before broken build:
```bash
npm install eslint-plugin-react-compiler --save-dev
```

```typescript
// eslint.config.js
import reactCompiler from 'eslint-plugin-react-compiler'

export default [
  {
    plugins: { 'react-compiler': reactCompiler },
    rules: {
      'react-compiler/react-compiler': 'warn',  // warn first, error later
    },
  },
]
```

**Compilation errors**: When compiler encounters unrecoverable pattern, it errors:
```bash
Error: [React Compiler] Unsupported pattern in ComponentX
  > const value = data[key]
    Cannot memoize dynamic property access at line 42
  Suggestion: Use manual useMemo or refactor to enumerated keys.
```

**CI failure strategy**:
- Phase 1: Compiler warnings as non-blocking. Team addresses over 2-week sprint.
- Phase 2: New files require compiler directive. CI checks `git diff --new-files` for `// @reactCompiler`.
- Phase 3: All files require compiler. CI blocks if directive missing or compiler errors found.

**Rollback plan**:
```bash
# Per-file rollback: remove the directive
// @reactCompiler  →  (remove)

# Per-branch rollback: revert compiler-enable commits
git revert HEAD~3..HEAD  # revert last 3 commits adding directive

# Global rollback: disable plugin in build config
# vite.config.ts
plugins: [
  // reactCompiler({ compilationMode: 'infer' })  // comment out
]
```

> **Think**: Your CI pipeline fails because a third-party dependency's types trigger a compiler error. You cannot modify node_modules. How do you proceed?
>
> *Answer: Three options: (1) Use `compilationMode: 'annotation'` — only compile files with explicit annotation; (2) Use the compiler's `skipFiles` option to exclude node_modules; (3) Update eslint rule to `'warn'` and suppress the specific error with `// eslint-disable-next-line react-compiler/react-compiler` on the import line. The compiler team recommends option (2) for third-party code.*

---

### Why This Matters

React Compiler is the largest React change since Hooks (2018). It eliminates an entire class of manual work — memoization — that has been the #1 source of React performance bugs and boilerplate for 6 years. Teams spend countless hours debugging stale closures, missing deps, and unnecessary re-renders. The compiler automates this perfectly when it can, and explicitly tells you when it cannot (instead of silently producing wrong behavior). Adopting the compiler is not optional for competitive React performance — it is the expected baseline in React 19+. Teams that skip the compiler will write more code, ship slower, and debug more re-render issues than teams that adopt it, regardless of team size or app complexity.

---

### Common Questions

**Q: Does the compiler work with TypeScript?**
A: Yes. Compiler natively understands TypeScript types and uses them for analysis. TypeScript-specific patterns (generics, unions, conditional types) are supported.

**Q: Does the compiler work with class components?**
A: No. Compiler targets function components and hooks only. Class components are not analyzed. Migrate class to function to benefit from compiler.

**Q: What happens if the compiler produces wrong memoization?**
A: Compiler is conservative — it skips rather than risks correctness. In rare cases, it produces incorrect memoization (stale closure, infinite loop). This is a bug in the compiler. Remove the directive from that file, report to React team, and use manual memoization until fix releases.

**Q: Does compiler work with React Native?**
A: Yes. Compiler is framework-agnostic. It works with React Native for Web and React Native's renderer. Test on emulator first — React Native's bridge may expose patterns the compiler cannot handle.

**Q: Can I use the compiler with Zustand/Redux/Jotai?**
A: Yes — with awareness. If your component reads store state via a hook (`useStore(selector)`), compiler treats the returned value as a hook result — it is stable per hook's guarantees. If you read `store.getState()` directly (outside hook), compiler sees a cross-module value and skips memoization.

---

## Examples

### Example 1: Migrating a Data Grid Component

**Problem**: A `DataGrid` component with 50 rows, each row having inline event handlers and derived cell values. Currently uses `useMemo` for sorted data, `useCallback` for row click handlers, `React.memo` on Row sub-component. 200 lines of boilerplate for memoization.

**Solution**:
1. Enable compiler on `DataGrid.tsx`:
```typescript
// @reactCompiler
function DataGrid({ rows, columns, onRowClick }: DataGridProps) {
  const sortedRows = sortRows(rows, columns)  // was: useMemo
  const handleRowClick = (rowId: string) => onRowClick(rowId) // was: useCallback
  return (
    <div>
      {sortedRows.map(row => (
        <Row key={row.id} data={row} onClick={handleRowClick} />
      ))}
    </div>
  )
}
```

2. Remove `React.memo(Row)` — compiler memoizes the Row elements inside map.
3. Remove manual `useMemo`/`useCallback` imports.
4. Validate with StrictMode — no regressions.

**Result**: 40 lines removed. Render performance unchanged (compiler output equivalent to hand-optimized version). No manual dependency arrays to maintain.

### Example 2: Debugging a Compiler Skip

**Problem**: A `SearchResults` component re-renders on every keystroke despite enabling the compiler. Debug output shows skipped scopes.

**Root cause inspection**:
```typescript
// @reactCompiler  // directive present
import { searchIndex } from './searchIndex'  // module-level large index

function SearchResults({ query }: { query: string }) {
  const results = searchIndex.search(query)  // COMPILER SKIP — cross-module
  const resultCount = results.length  // COMPILER SKIP — depends on skipped value
  return <div>{resultCount} results</div>
}
```

**Fix**: Keep manual `useMemo` for the cross-module computation:
```typescript
function SearchResults({ query }: { query: string }) {
  const results = useMemo(
    () => searchIndex.search(query),
    [query]
  )
  // compiler still memoizes everything else
  const resultCount = results.length  // now memoized (depends on useMemo)
  return <div>{resultCount} results</div>
}
```

**Takeaway**: Compiler handles ~90% of memoization. For the remaining 10% (cross-module, refs), manual `useMemo` is still needed. The compiler and manual memoization coexist — compiler handles what it can, you handle what it cannot.

### Example 3: Transition + Compiler for Search Autocomplete

**Problem**: Search autocomplete shows results while user types. Without compiler, results array recreates every render causing input lag.

**Solution**: Combine transition for priority management + compiler for memoization:
```typescript
// @reactCompiler
function Autocomplete() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [isPending, startTransition] = useTransition()

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setQuery(value)
    startTransition(() => {
      setResults(fetchFromCache(value))
    })
  }

  const hasResults = results.length > 0  // compiler memoizes derived boolean
  const placeholder = query ? results.length > 0
    ? `${results.length} matches`
    : 'No results'
    : 'Type to search'
  // compiler memoizes placeholder string — stable while isPending

  return (
    <div style={{ opacity: isPending ? 0.8 : 1 }}>
      <input value={query} onChange={handleInput} />
      {placeholder}
    </div>
  )
}
```

**Result**: Typing never lags (transition). Placeholder string does not recreate on every render (compiler). No manual memoization needed.

---

## Key Takeaways
- React Compiler auto-memoizes components and hooks at build time — no runtime overhead
- Opt-in per file via `// @reactCompiler` — incremental migration with single-file rollback
- Compiler handles: inline functions, derived values, object/array literals, conditional values
- Compiler skips: cross-module values, refs, dynamic property access, leaked values
- Compiler + manual memoization coexist — remove redundant useMemo/useCallback after enabling
- Debug with `__DEBUG__` config flag or React DevTools profiler
- CI integration: eslint-plugin, compilation errors, phased rollout
- Compiler is conservative — skip is safe; incorrect memoization is a compiler bug, not your code

## Common Misconception

**"The React Compiler makes useMemo and useCallback obsolete — you never need them."**

Not accurate. The compiler eliminates *the majority* of manual memoization, but some patterns remain outside its reach. Cross-module values (imported utility functions, module-level objects), ref-dependent values, imperative handles, and non-React interop still need manual `useMemo`/`useCallback`. Think of the compiler as handling 90% — the remaining 10% requires judgment. The difference is: before the compiler, you manually memoized everything defensively (90% waste). After the compiler, you manually memoize only what the compiler explicitly tells you it cannot handle (0% waste). The compiler reduces the *surface area* of manual memoization but does not eliminate it entirely.

---

## Feynman Explain
(Explain React Compiler to a junior developer who writes React but has never used useMemo. They think React is "fast enough" without memoization. Use zero jargon about closures, dependency arrays, or reference equality. Explain the problem — unnecessary re-computation — and how the compiler fixes it, using a cooking analogy.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain advanced-react-19` — AI probes gaps.*

---

## Reframe
(Pause. Critique: Does the compiler make React simpler or more complex? Teams now need to understand compiler internals to debug performance issues. Build times increase. CI pipelines need new rules. Is the trade-off of "write less useMemo but understand compiler" a net positive? Compare with Svelte's compile-time approach and Solid.js's signals. Write your evaluation.)

---

## Drill
Take the quiz. MCQs test compiler analysis, migration strategy, and pattern recognition.

Run: `learn.sh quiz advanced-react-19 13-react-compiler`
