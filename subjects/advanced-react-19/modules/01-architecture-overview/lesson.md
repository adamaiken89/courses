# Module 1: React 19 Architecture Overview

Est. study time: 2h
Language: en

## Learning Objectives
- Identify all major React 19 features and their architectural implications
- Evaluate migration paths from React 18 to 19 per codebase profile
- Apply the new mental model: Actions, Transitions, Compiler

---

## Core Content

### What Changed in React 19 — Major Features at a Glance

React 19 is not a feature drop — it is a paradigm shift. Three pillars define the release:

**1. Actions**: `useActionState`, `useFormStatus`, Server Actions unify data mutation. Before React 19, forms required manual `onSubmit` handlers, loading states, error states. Actions bake all three into the framework.

**2. Transitions**: `useTransition`, `startTransition` let you mark non-urgent state updates. React can interrupt them for urgent updates (typing, clicks). This is the foundation of concurrent UI without jank.

**3. The Compiler (Forget)**: Auto-memoizes components and hooks. You stop writing `useMemo`, `useCallback`, `memo` manually. React analyzes your code at build time and injects memoization. This is the biggest React change since hooks.

Supporting features: `use()` hook (read promise/context mid-render), `ref` as prop (no more `forwardRef`), `useOptimistic`, enhanced Server Components, improved `useContext`.

> **Think**: You are evaluating React 19 for a team of 10 engineers. Which pillar — Actions, Transitions, or Compiler — will save the most code deletion? Why?
>
> *Answer: Compiler. It eliminates entire categories of hooks (useMemo, useCallback, memo) that teams write defensively. A typical component has 3-5 useMemo calls for reference stability. The compiler does this automatically. Actions and Transitions change how you write new code; the Compiler rewrites existing code retroactively.*

### The Migration Path from React 18

React 19 is largely backwards compatible. Breaking changes target edge cases:

| Concern | React 18 | React 19 | Migration |
|---------|----------|----------|-----------|
| Refs | `forwardRef` wrapper | `ref` as regular prop | Drop `forwardRef`, pass `ref` directly |
| Context | `useContext(MyContext)` | `use(Context)` or `useContext` | `use(ctx)` reads context in render — works inside early returns, conditionals |
| `useMemo` | Manual | Optional (Compiler) | Incremental: enable compiler module by module |
| String refs | Legacy warning | Removed | Already deprecated since 16 |
| `concurrent` | Optional root | Default | `<React.StrictMode>` prepares |

> **Think**: Your team has 200 components wrapping `forwardRef`. React 19 warns about `forwardRef` but does not remove it. Do you batch-update or migrate incrementally?
>
> *Answer: Incrementally. forwardRef still works. Migrate file by file when you touch a component. Pair with codemod: `npx react-codemod update-ref-as-prop` handles the mechanical rename. No reason to block shipping React 19 on forwardRef migration.*

Migration checklist:
1. `npm install react@19 react-dom@19`
2. Enable `<StrictMode>` if not already
3. Replace legacy root `ReactDOM.render` with `createRoot`
4. Address removed APIs: `propTypes`, `defaultProps` for functions, string refs
5. Opt-in to Compiler per module: `// @reactCompiler`
6. Ship. Then incrementally adopt Actions and use().

> **Think**: Why does React recommend StrictMode before migration? What bugs does it reveal?
>
> *Answer: StrictMode double-invokes reducers, initializers, and effects. This surfaces impure code, incorrect cleanup, and stale closures before they cause production bugs. In React 19, double-invocation catches issues with actions and transitions that would otherwise produce silent data loss.*

### React 19's New Mental Model

React 19 shifts from "render based on state" to "state drives render with priority awareness."

**Old model** (React 18 synchronous):
```
User clicks → setState → re-render → paint
User types → setState → re-render → paint (blocked if heavy)
```

**New model** (React 19 concurrent):
```
User types (urgent) → transition marks as urgent → render immediately → paint
Data sync (normal) → transition marks as transition → may be interrupted → delayed render
```

This requires a new mental classification of every state update:

| Update type | Priority | API |
|-------------|----------|-----|
| User input (typing, slider) | Urgent | Default (no wrapper) |
| Navigation, tab switch | Normal | `startTransition` |
| Data submission, optimistic update | Transition | `useActionState`, `useOptimistic` |
| Background data sync | Low | `startTransition` |
| Prefetching, prefetch render | Lowest | `useDeferredValue` |

> **Think**: A search input fetches results while user types. Urgent or transition? What happens if results take 100ms vs 500ms?
>
> *Answer: Typing is urgent. Results fetch is transition. Wrap setResults in startTransition. Benefit: if results take 500ms, keystrokes never lag. React can discard stale results when newer keystroke arrives and restart.*

### How React 19 Changes Architecture Decisions

Pre-React 19 architecture patterns that change:

**Old: State management library for everything.** Zustand, Redux, Jotai for all cross-component state. React 19 actions handle form state natively. Only use external stores for genuinely cross-cutting or complex derived state.

**Old: Custom hooks for data fetching.** `useQuery`, `useSWR`, custom `useEffect` + fetch. React 19 Server Components + `use()` make this optional for initial data. Streaming SSR reduces need for client-side loading spinners.

**Old: Manual memoization.** `React.memo`, `useMemo`, `useCallback` everywhere. React Compiler eliminates this. Architecture shifts from "where to memoize" to "how to structure for compiler analysis."

Old:
```typescript
interface ExpensiveProps {
  items: string[]
  onSelect: (id: string) => void
}

function Expensive({ items, onSelect }: ExpensiveProps) {
  const sorted = useMemo(() => sort(items), [items])
  const handleSelect = useCallback((id: string) => {
    onSelect(id)
  }, [onSelect])
  return <List items={sorted} onSelect={handleSelect} />
}
```

New (Compiler enabled):
```typescript
interface ExpensiveProps {
  items: string[]
  onSelect: (id: string) => void
}

function Expensive({ items, onSelect }: ExpensiveProps) {
  const sorted = sort(items)  // auto-memoized by compiler
  const handleSelect = (id: string) => onSelect(id)  // auto-memoized
  return <List items={sorted} onSelect={handleSelect} />
}
```

> **Think**: Can the Compiler memoize everything? What patterns force manual memoization?
>
> *Answer: No. Compiler cannot memoize across module boundaries (imported values), non-primitive props from uncontrolled parents, or values that escape React's analysis (e.g., stored in refs). You still need manual useMemo for: large computations that genuinely change rarely, values passed to imperative handles, and interop with non-React code.*

---

### Why This Matters

React 19 rewrites the rules of React architecture. Teams that understand the new mental model ship faster with fewer bugs. Teams that treat React 19 as "just an upgrade" keep writing defensive memoization, fighting re-renders, and wrestling with forms. The Compiler alone saves ~30% of boilerplate in typical components. Actions eliminate entire categories of form-related bugs (stale closures, lost submissions, double-submits). Transitions eliminate jank without explicit debouncing or throttling.

Wrong mental model = write React 18 code in React 19. Right mental model = rethink component structure, data flow, and state ownership. This module is the foundation for every decision in subsequent modules.

---

### Common Questions

**Q: Can I use React 19 without the Compiler?**
A: Yes. React 19 works without the Compiler. You keep writing `useMemo`, `useCallback` manually. However, adopting the Compiler is the primary performance win — you pay build-time cost once for runtime gains everywhere. Start without, add Compiler module by module.

**Q: Does React 19 replace all state management?**
A: No. Actions handle form submission state. Server Components handle initial data. Transitions handle UI prioritization. Cross-component state, complex derived state, and client-only data still benefit from Zustand, Redux, or Jotai. React 19 reduces the scope of external stores, not eliminates them.

**Q: What is the risk of the Compiler?**
A: Compiler errors produce infinite re-renders or stale closures. The compiler is conservative — it skips memoization when uncertain rather than risk correctness. Run compiler over StrictMode + your test suite. Roll back per module if issues appear.

**Q: When should I NOT upgrade to React 19?**
A: If you depend on `propTypes` validation in production, `defaultProps` for function components, or third-party libraries that reference removed APIs. Check `npm ls react` for peer dependency conflicts. If major UI libs (MUI, Antd, Radix) have not shipped React 19 support, wait.

---

## Examples

### Example 1: Migration Decision for a Dashboard App

**Problem**: Dashboard app with 50k LOC, 500 components, heavy use of `forwardRef`, `useMemo`, `useCallback`, and form validation library. Team of 5.

**Solution**: 
1. Upgrade React deps (1 hour)
2. Enable StrictMode, fix any double-invoke issues (2 hours)
3. Codemod forwardRef: `npx react-codemod update-ref-as-prop` (30 min)
4. Enable Compiler on least-critical module, test, enable broadly (2 days)
5. Replace form validation with `useActionState` + Zod (3 days — new forms only)
6. Incremental: remove `useMemo`/`useCallback` as code touched

**Result**: 15% LOC reduction, no regressions, form-related bugs down 60%.

### Example 2: Choosing Architecture for a New Product

**Problem**: Greenfield SaaS app, Next.js App Router, needs real-time collaboration, complex forms, optimistic updates.

**Decisions**:
- **Server Components**: Default for page-level data. Reduces client bundle 40%.
- **Actions**: All form submissions. `useActionState` for inline errors.
- **Transitions**: Navigation between tabs. Dashboard filtering.
- **Compiler**: On from day 1. No manual memoization.
- **Zustand**: Only for real-time collaboration state (WebSocket-driven). Not for form state, not for page data, not for UI state.
- **Suspense**: Boundary per page section (sidebar, main, chat). Streaming SSR for slow queries.

**Result**: 3-person team ships MVP in 6 weeks. Bundle 30% smaller than comparable React 18 app.

---

## Key Takeaways
- React 19 rests on three pillars: Actions, Transitions, Compiler
- Migration is incremental — no forced rewrite
- Compiler eliminates manual memoization but is not fully automatic
- Actions replace form boilerplate — `useActionState` bundles pending/error/success states
- Transitions prevent jank by marking non-urgent updates as interruptible
- State management scope shrinks: actions handle forms, Server Components handle initial data, external stores only for cross-cutting state
- `forwardRef` is deprecated but still works — migrate incrementally
- Concurrent rendering requires new mental classification of every state update priority

## Common Misconception

**"React 19 is just React 18 with minor additions."**

React 19 is the first version where concurrency is default, not opt-in. This changes how React prioritizes work. The Compiler is the largest React change since hooks — it changes how every component manages memoization. Actions unify form logic that previously required 3+ libraries. Developers who treat React 19 as "React 18 + extras" will miss fundamental architecture shifts and write suboptimal code. React 19 is not React 18 with add-ons. It is a new baseline.

---

## Feynman Explain
(Explain React 19's three pillars to a senior developer who has been using Vue for 3 years. They know framework architecture but not React specifics. Use no React jargon — talk about the problems Actions, Transitions, and Compiler solve in framework-agnostic terms.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain` — AI probes gaps.*

---

## Reframe
(Pause. Critique: Are Actions and Server Components over-engineering for a simple CRUD app? When does the Compiler's build-time cost outweigh runtime benefit? Write your evaluation. Consider trade-offs between simplicity, bundle size, and DX.)

---

## Drill
Take the quiz. MCQs test architecture decisions, migration strategy, and mental model.

Run: `learn.sh quiz advanced-react-19 01-architecture-overview`
