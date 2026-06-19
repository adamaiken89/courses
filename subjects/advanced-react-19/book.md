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

## Quiz: 01-architecture-overview


### Which React 19 pillar eliminates the need for useMemo and useCallback in most components?

- [ ] A: Actions

- [ ] B: Transitions

- [✓] C: The Compiler (Forget)

- [ ] D: Server Components


**Answer:** C

React Compiler auto-memoizes components and hooks at build time. Actions handle mutations, Transitions handle priority, Server Components handle rendering location. Only the Compiler eliminates memoization boilerplate.


### A user types into a search field. Results fetch on each keystroke. Which priority classification is correct?

- [ ] A: Typing is transition, results fetch is urgent

- [✓] B: Typing is urgent, results fetch is transition

- [ ] C: Both are urgent

- [ ] D: Both are transition


**Answer:** B

User input (typing) is urgent — must respond immediately. Results fetch is a transition — can be interrupted by next keystroke. Wrapping setResults in startTransition prevents jank.


### Which API combines pending state, form data, and error handling into a single hook?

- [ ] A: useTransition

- [ ] B: useOptimistic

- [✓] C: useActionState

- [ ] D: useFormStatus


**Answer:** C

useActionState merges pending/error/success states into one hook. useFormStatus reads parent form state. useTransition marks non-urgent updates. useOptimistic handles instant UI updates before server confirms.


### Your team has 200 components wrapped in forwardRef. What is the recommended migration approach?

- [ ] A: Rewrite all at once before upgrading to React 19

- [ ] B: Stay on React 18 until all components are migrated

- [✓] C: Upgrade to React 19, then migrate incrementally using codemod

- [ ] D: Use a polyfill to avoid the forwardRef deprecation


**Answer:** C

forwardRef still works in React 19. Upgrade first, then incrementally migrate with npx react-codemod update-ref-as-prop. No need to block the React 19 upgrade on forwardRef migration.


### Why does React recommend enabling StrictMode before upgrading to React 19?

- [ ] A: StrictMode improves bundle size

- [✓] B: StrictMode double-invokes code to surface impure logic and stale closures

- [ ] C: StrictMode enables the Compiler

- [ ] D: StrictMode is required for Actions to work


**Answer:** B

StrictMode double-invokes reducers, initializers, and effects. This catches bugs from impure code and incorrect cleanup before they reach production. In React 19, double-invocation catches Action and Transition bugs that could cause silent data loss.


### In React 18, state management libraries were used for most cross-component state. In React 19, which pieces are now handled by built-in APIs?

- [✓] A: Form submission state, initial data loading, UI rendering priorities

- [ ] B: All global state is now built-in

- [ ] C: Only form state is built-in

- [ ] D: No changes — external stores are still needed for everything


**Answer:** A

Actions (useActionState) handle form submission. Server Components + use() handle initial data loading. Transitions handle rendering priorities. External stores still needed for cross-cutting client-only state, complex derived state, and real-time data.


### What happens when the React Compiler cannot safely analyze a component?

- [ ] A: It throws a build error

- [✓] B: It skips memoization for that component — conservative fallback

- [ ] C: It applies memoization anyway with a runtime safety check

- [ ] D: It inlines the component into the parent


**Answer:** B

The Compiler is conservative. When uncertain (cross-module boundaries, escaped values, non-primitive props from uncontrolled parents), it skips memoization rather than risk incorrect behavior. You keep manual useMemo/useCallback for those cases.


### A team wants to adopt React 19 Compiler. What is the best rollout strategy?

- [ ] A: Enable Compiler globally on day one

- [✓] B: Enable per module with // @reactCompiler, test each, expand

- [ ] C: Only use Compiler on new components, never refactor existing

- [ ] D: Wait for Compiler to reach stable before adopting React 19


**Answer:** B

Enable Compiler module by module with the directive comment. Test each module under StrictMode. This isolates any Compiler-related issues and allows rollback per module. The Compiler is safe, but incremental rollout reduces risk surface.


### What distinguishes React 19 Transitions from debouncing or throttling?

- [ ] A: Transitions are synchronous, debouncing is async

- [✓] B: Transitions are state-driven and interruptible by urgent updates; debouncing delays execution

- [ ] C: Transitions only work with Server Components

- [ ] D: Debouncing and Transitions are functionally identical


**Answer:** B

Debouncing delays execution regardless of urgency. Transitions let React prioritize: urgent updates (typing) proceed immediately, transition updates can be interrupted and discarded. React manages the timeline, not a fixed delay.


### Which scenario would prevent the Compiler from correctly memoizing a function?

- [ ] A: Function defined inside a component that only uses props

- [✓] B: Function assigned to a ref and called from an effect

- [ ] C: Function defined with const handleClick = () =&gt; setState(...)

- [ ] D: Function passed as prop to an HTML element


**Answer:** B

Values that escape React's analysis — stored in refs, passed to imperative handles, or used with non-React interop — cannot be safely memoized by the Compiler. Functions using only props and state inside a component are analyzable. The Compiler understands setState, props, and component scope.


---

# Module 2: Actions Defined — useActionState, Server Actions

Est. study time: 2.5h
Language: en

## Learning Objectives
- Implement useActionState for form submissions with pending/error/success states
- Design Server Actions with progressive enhancement
- Orchestrate mutation sequences with Action composition
- Handle errors and stale submissions with Action lifecycle

---

## Core Content

### The Action Pattern: Before and After

Before React 19, every form required:
```typescript
const [pending, setPending] = useState<boolean>(false)
const [error, setError] = useState<string | null>(null)
const [data, setData] = useState<SubmitResult | null>(null)

async function handleSubmit(e: FormEvent<HTMLFormElement>) {
  e.preventDefault()
  setPending(true)
  setError(null)
  try {
    const formData = new FormData(e.currentTarget)
    const result = await submitForm(formData)
    setData(result)
  } catch (err) {
    setError((err as Error).message)
  } finally {
    setPending(false)
  }
}
```

Three state variables, try/catch/finally, manual pending management. Every form duplicates this. Bug surface: forgotten `setPending(false)` in early return, stale closure on `error`, race condition from double-submit.

React 19 collapses this into one hook:
```typescript
const [data, formAction, pending] = useActionState(
  async (prevState: SubmitResult | null, formData: FormData) => {
    const result = await submitForm(formData)
    return result
  },
  null
)
```

`useActionState` returns `[data, action, pending]`. The action becomes the `formAction` on `<form>` or `<button>`. React manages pending state, error extraction, and form reset automatically.

> **Think**: The `useActionState` callback receives `prevState` — the previous return value. Why? What pattern does this enable?
>
> *Answer: `prevState` enables accumulator patterns: append to a list rather than replace, merge with previous data, or implement undo (previous state is always available). Server Actions use this for progressive enhancement — browser JS disabled? Form still works via native submission, and response replaces state.*

### Server Actions: The Network Boundary

Server Actions are async functions that run on the server but are callable from the client. Defined with `"use server"` directive:
```typescript
// app/actions.ts
"use server"

interface CreateUserResult {
  error?: string
  success?: boolean
  user?: { name: string; email: string }
}

export async function createUser(
  prevState: CreateUserResult | null,
  formData: FormData
): Promise<CreateUserResult> {
  const name = formData.get("name") as string
  const email = formData.get("email") as string

  const { error } = await db.insert(users).values({ name, email })
  if (error) return { error: error.message }

  revalidatePath("/users")
  return { success: true, user: { name, email } }
}
```

On the client:
```typescript
"use client"
import { createUser, type CreateUserResult } from "./actions"

function UserForm() {
  const [state, action, pending] = useActionState<CreateUserResult>(
    createUser,
    {}
  )
  return (
    <form action={action}>
      <input name="name" />
      <input name="email" />
      <button disabled={pending}>Submit</button>
      {state?.error && <p role="alert">{state.error}</p>}
    </form>
  )
}
```

Key: **no `use client` boundary needed for the action itself**. The `"use server"` directive creates a POST endpoint automatically. The client imports it like a function — React compiles it into a fetch call during build.

> **Think**: What security boundary does `"use server"` enforce? Can a client import any server function?
>
> *Answer: Only functions explicitly marked `"use server"` are exposed. The directive is a security boundary. React's compiler strips non-action code from the bundle. Actions only accept FormData or serializable arguments — no closures, no React state references. This prevents accidental server code leakage.*

### Progressive Enhancement Without Effort

Actions degrade gracefully without JavaScript:

- JS enabled: React intercepts form submit, calls action as async function, manages pending state, performs targeted UI updates.
- JS disabled: Form submits natively to the POST endpoint created by the Server Action. Server returns response or redirects. Page renders with server state.

```typescript
<form action={action}>  // ← same code works both ways
```

> **Think**: Your action calls `revalidatePath("/users")`. In JS-disabled mode, does this still work?
>
> *Answer: Yes. `revalidatePath` in a Server Action signals the server to re-render the cached page. In JS-disabled mode, the server re-renders the page with fresh data and sends HTML. The result is identical — fresh data — delivered differently depending on JS availability.*

### Action Lifecycle and Composition

Actions have a defined lifecycle:

1. **Submit**: Form submitted → pending = true
2. **Flight**: Action executes (client or server)
3. **Settle**: Action returns → pending = false, state updated
4. **Error**: Action throws → pending = false, error accessible via catch or returned state
5. **Reset**: Form resets after successful submission (default behavior)

Compose actions with `useActionState` + `useTransition`:
```typescript
const [state, formAction, pending] = useActionState(submitOrder, {})
const [, startTransition] = useTransition()

function handleSubmit(formData: FormData) {
  startTransition(async () => {
    await formAction(formData)
    router.push("/orders/confirmation")
  })
}
```

> **Think**: Why wrap formAction in startTransition? What happens without it?
>
> *Answer: Without startTransition, navigation blocks pending state update — user sees flash from pending=true to confirmation page. startTransition batches the navigation into a non-urgent update, letting pending state settle first. User sees brief pending state → redirect, no flash.*

### Error Handling in Actions

Actions have two error surfaces:

1. **Returned errors** (expected): Validate input, return `{ error: "message" }`. Display inline.
2. **Thrown errors** (unexpected): Network failure, server crash. Caught by error boundary or `try/catch` wrapper.

Best practice: return errors for validation, throw for unexpected failures.
```typescript
async function submitForm(
  prevState: FormResult,
  formData: FormData
): Promise<FormResult> {
  const raw = Object.fromEntries(formData)
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }  // expected
  }
  // db insert may throw — unexpected, let boundary handle
  await db.insert(...)
  return { success: true }
}
```

> **Think**: A Server Action throws a database connection error. What does the user see?
>
> *Answer: The nearest error boundary catches it. If none exists, the form stays in pending state — dangerous. Always wrap Server Actions in an error boundary. Use `error.js` in Next.js or a `<form>`-level boundary that resets pending state on error.*

### When to useActionState vs useTransition

| Criteria | useActionState | useTransition |
|----------|---------------|---------------|
| Form with native `<form>` | Yes | No |
| Server Actions | Yes | No |
| Pending state auto-managed | Yes | Manual |
| Error state integrated | Yes (return value) | Manual (try/catch) |
| Arbitrary async mutations | No | Yes |
| Progressive enhancement | Yes | No |

> **Think**: Your app has a "Delete" button that calls an API but is not inside a form. Which hook?
>
> *Answer: useTransition. There is no form. useActionState requires a `<form action>` or button `formAction`. useTransition wraps any async work. Delete button pattern: startTransition(async () => { await api.delete(id) }).*

---

### Why This Matters

Actions are the biggest React form improvement since controlled components. Before Actions, every form had 3-6 state variables for pending/error/success. Actions reduce this to 1 hook. Server Actions eliminate the API layer entirely for mutation endpoints — no REST route, no fetch call, no loading states to wire up. Progressive enhancement comes free. Teams adopting Actions report 40-50% reduction in form-related code and proportionally fewer bugs (stale closures, double-submit, forgotten error states).

---

### Common Questions

**Q: Can I use useActionState without Server Components?**
A: Yes. useActionState works entirely client-side. The action function runs on the client. You lose progressive enhancement and server-side revalidation but keep the pending/error/success state management.

**Q: How do I reset a form after successful submission?**
A: React 19 auto-resets controlled inputs after `useActionState` returns a non-error state. For manual reset, call `formRef.current.reset()` inside a `useEffect` that watches state.

**Q: Can actions call other actions?**
A: Yes. Compose actions: one action validates input, calls another that writes to DB. Keep each action focused on one concern. Avoid actions that both validate and send email and log analytics — split into `validateAction`, `submitAction`, `notifyAction`.

**Q: How do I handle file uploads with Actions?**
A: FormData handles files natively. Server Action reads `formData.get("file")` as a File/Blob. For large files, consider streaming upload with a dedicated endpoint — Actions are not optimized for large payloads.

---

## Examples

### Example 1: Signup Form with Validation

**Problem**: Signup with name, email, password. Validate server-side. Show field-level errors.

```typescript
// app/actions.ts
"use server"

interface SignupResult {
  errors?: Record<string, string[]>
  success?: boolean
}

export async function signup(
  prevState: SignupResult | null,
  formData: FormData
): Promise<SignupResult> {
  const raw = Object.fromEntries(formData)
  const parsed = signupSchema.safeParse(raw)
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }
  const exists = await db
    .select()
    .from(users)
    .where(eq(users.email, raw.email as string))
    .get()
  if (exists) return { errors: { email: ["Email already registered"] } }
  await db.insert(users).values(parsed.data)
  redirect("/dashboard")
}
```

Client:
```typescript
"use client"
import { signup, type SignupResult } from "./actions"

function SignupForm() {
  const [state, action, pending] = useActionState<SignupResult>(signup, {})
  return (
    <form action={action}>
      <input name="email" />
      {state?.errors?.email && <p>{state.errors.email[0]}</p>}
      <input name="password" type="password" />
      <button disabled={pending}>Sign Up</button>
    </form>
  )
}
```

### Example 2: Todo List with Optimistic Removal

**Problem**: Todo list with instant delete via form action per item.

```typescript
interface Todo {
  id: string
  text: string
}

function TodoList({ todos: initial }: { todos: Todo[] }) {
  const [state, removeAction, pending] = useActionState(
    async (prev: Todo[], formData: FormData) => {
      const id = formData.get("id") as string
      await api.delete(id)
      return prev.filter((t) => t.id !== id)
    },
    initial
  )

  return state.map((todo) => (
    <form key={todo.id} action={removeAction}>
      <span>{todo.text}</span>
      <input type="hidden" name="id" value={todo.id} />
      <button type="submit" disabled={pending}>Delete</button>
    </form>
  ))
}
```

---

## Key Takeaways
- `useActionState` collapses pending/error/success into one hook
- `"use server"` directive creates a server endpoint from a function
- Server Actions enable progressive enhancement with zero extra code
- Actions compose — validation action → data action → notification action
- `revalidatePath` / `revalidateTag` refresh server data after mutation
- Form auto-resets on successful action return
- Error boundaries catch unexpected action failures; returned errors handle expected validation
- useActionState for forms; useTransition for non-form async mutations
- Security boundary: only `"use server"` marked functions are exposed to client

## Common Misconception

**"Actions are just syntax sugar over API calls."**

Actions are not sugar. Actions integrate with React's concurrent rendering: they participate in transition priority, enable progressive enhancement, and auto-manage pending state across component tree via `useFormStatus`. A plain API call lacks all of this. The equivalent of a Server Action in React 18 was: API route + fetch + useState x3 + error boundary + loading spinner + form reset logic. Actions replace 5+ concerns with one primitive.

---

## Feynman Explain
(Explain Actions to a backend developer who has never used React. Focus on the problem: every form needs pending/error/success states, and why that's hard to get right. Use analogies: "two doors open simultaneously" for race conditions, "tripwire" for stale closures.)

---

## Reframe
(Critique: Server Actions couple frontend and backend logic in one file. Is this a good separation of concerns? When would you avoid Server Actions in favor of explicit API routes? Consider: testing, team boundaries, API reuse by mobile clients, rate limiting, monitoring.)

---

## Drill
Take the quiz. MCQs test action lifecycle, Server Action security, error surfaces.

Run: `learn.sh quiz advanced-react-19 02-actions`

## Quiz: 02-actions


### What does useActionState return?

- [✓] A: [state, action, pending]

- [ ] B: [state, dispatch]

- [ ] C: [action, pending, error]

- [ ] D: [state, action, error]


**Answer:** A

useActionState returns [data, formAction, isPending]. Unlike useState or useReducer which return [state, setter], useActionState includes the pending state that React manages automatically.


### What directive marks a function as a Server Action callable from the client?

- [ ] A: use client

- [✓] B: use server

- [ ] C: use action

- [ ] D: use endpoint


**Answer:** B

"use server" marks functions callable from client code. React's build step compiles these into POST endpoints. "use client" marks the client boundary — opposite direction.


### A Server Action throws an unexpected database error. What should handle this?

- [ ] A: The action's own try/catch returning error state

- [✓] B: The nearest React error boundary

- [ ] C: A global window.onerror handler

- [ ] D: The form's onSubmit event


**Answer:** B

Unexpected errors (DB down, network failure) should propagate to an error boundary. The action's catch is for expected validation errors. Without an error boundary, the form stays in pending state permanently.


### What happens when a user submits a form with a Server Action and JavaScript is disabled?

- [ ] A: Nothing — form requires JS

- [✓] B: Form submits natively to the POST endpoint; server returns HTML response

- [ ] C: React falls back to client-side rendering

- [ ] D: Form submission is queued until JS loads


**Answer:** B

Server Actions compile to POST endpoints during build. With JS disabled, the browser submits the form natively to that endpoint. The server processes the action and returns HTML. This is progressive enhancement.


### When should you use useTransition instead of useActionState for a mutation?

- [ ] A: Always — useTransition is more general

- [✓] B: When the mutation does not involve a form element

- [ ] C: When the mutation needs error handling

- [ ] D: useActionState and useTransition are interchangeable


**Answer:** B

useActionState requires a &lt;form action&gt; or formAction prop. useTransition wraps any async work. Use useActionState for forms, useTransition for buttons, links, or programmatic mutations outside forms.


### How does React prevent stale closure bugs in useActionState?

- [✓] A: The action only receives FormData, not enclosing scope variables

- [ ] B: React freezes action scope at submission time

- [ ] C: useActionState uses refs internally to avoid closure capture

- [ ] D: It does not — you must use useCallback


**Answer:** A

Server Actions accept only FormData or serializable arguments. Client actions that use setState or props will capture closures. Solution: read current state via useActionState's prevState parameter instead of capturing from enclosing scope.


### What does the prevState parameter in useActionState enable?

- [✓] A: Undo functionality and accumulator patterns

- [ ] B: Access to previous component props

- [ ] C: Synchronous state updates

- [ ] D: Cross-component state sharing


**Answer:** A

prevState returns the previous action result. This enables accumulators (append to list), undo (swap with previous), and optimistic UI rollback (revert to previous value on error).


### After a successful Server Action, how do you refresh displayed data?

- [ ] A: Call window.location.reload()

- [✓] B: Use revalidatePath() or revalidateTag() inside the action

- [ ] C: Set a local state flag to trigger useEffect

- [ ] D: The action auto-refreshes the view


**Answer:** B

revalidatePath('/path') purges the server cache for a route. revalidateTag('tag') purges cached data fetches tagged with that key. React re-renders affected components with fresh data.


### Can a Server Action read React state or props from the client component?

- [ ] A: Yes — Server Actions have full access to component scope

- [✓] B: No — Server Actions accept only FormData or serializable args

- [ ] C: Yes, but only through useActionState's prevState

- [ ] D: Yes, but only if wrapped in use client


**Answer:** B

Server Actions compile to POST endpoints — they have no access to client React state, props, or closures. Data must be passed via FormData or serializable arguments (strings, numbers, plain objects).


### A search form fetches results on each keystroke via Server Action. What is the risk?

- [ ] A: Server Actions cannot handle frequent calls

- [✓] B: Each keystroke triggers a server round-trip; use debounce or client-side filtering

- [ ] C: Server Actions automatically batch keystrokes

- [ ] D: useActionState limits to one request at a time


**Answer:** B

Server Actions are designed for form submission, not real-time input. Each keystroke fires a server request. Use client-side filtering, debounced API calls, or a dedicated search endpoint — not a Server Action wrapped in useActionState.


---

# Module 3: use() Hook — Reading Promises and Context in Render

Est. study time: 2h
Language: en

## Learning Objectives
- Use `use(promise)` to suspend components declaratively with Suspense
- Use `use(context)` to read context outside normal hook ordering rules
- Choose between `use()` and traditional hooks per use case
- Handle errors and loading states with `use()` + Suspense boundaries

---

## Core Content

### use() — The Unconditional Conditional Hook

Every React hook before React 19 follows the Rules of Hooks: call at top level, never inside conditions or loops. `use()` breaks this rule:

```typescript
function Comment({ id, isEditable }: { id: string; isEditable: boolean }) {
  const theme = use(ThemeContext)
  const comment = use(fetchComment(id))
  return <div style={{ color: theme.text }}>{comment.body}</div>
}
```

`use()` reads **any** thenable (Promise-like) or Context. It is called during render. If the Promise is pending, `use()` suspends — the component unwinds and React shows the nearest `<Suspense>` fallback.

> **Think**: `use()` does not follow Rules of Hooks. Can you call it inside `if`? Inside `useEffect`? Inside a callback?
>
> *Answer: `use()` must be called during render — same phase as other hooks. It works inside conditionals and switches (unlike hooks) but NOT inside `useEffect`, event handlers, or callbacks. It is a render-phase primitive, like `React.createElement`.*

### use(promise): Suspense-Driven Data Fetching

Before `use()`, data fetching in render required:
```typescript
function Profile({ userId }: { userId: string }) {
  const [user, setUser] = useState<User | null>(null)
  useEffect(() => {
    fetchUser(userId).then(setUser)
  }, [userId])
  if (!user) return <Spinner />
  return <div>{user.name}</div>
}
```

Problems: waterfall effect (fetch → render → fetch child → render), loading state per component, no coordination.

With `use()`:
```typescript
function Profile({ userId }: { userId: string }) {
  const user = use(fetchUser(userId))
  return <div>{user.name}</div>
}
```

The promise starts **before** render and resolves during Suspense. The component never sees loading state — it sees data or not-at-all (suspended).

```typescript
function Page({ userId }: { userId: string }) {
  return (
    <Suspense fallback={<Skeleton />}>
      <Profile userId={userId} />
    </Suspense>
  )
}
```

> **Think**: Where does `fetchUser(userId)` execute? Before `use()` is called or when?
>
> *Answer: `fetchUser(userId)` executes as the argument to `use()` — during render, before `use()` suspends. In practice, create the promise near the component or use a fetch-on-render pattern. The promise must exist before `use()` can consume it.*

### Promise Caching and Deduplication

`use()` does not cache promises. If `Profile` re-renders and `fetchUser(userId)` creates a new promise, `use()` suspends again — every render becomes a loading state. Solution: **cache promises by key**:

```typescript
const userCache = new Map<string, Promise<User>>()

function fetchCachedUser(id: string): Promise<User> {
  if (!userCache.has(id)) {
    userCache.set(id, fetchUser(id))
  }
  return userCache.get(id)!
}

function Profile({ userId }: { userId: string }) {
  const user = use(fetchCachedUser(userId))
  return <div>{user.name}</div>
}
```

React's cache() utility:
```typescript
import { cache } from "react"

const fetchUserCached = cache((id: string) => fetchUser(id))

function Profile({ userId }: { userId: string }) {
  const user = use(fetchUserCached(userId))
  return <div>{user.name}</div>
}
```

`cache()` deduplicates: same arguments → same promise reference. Use it for Server Components and shared data fetching.

> **Think**: What happens if a cached promise rejects? Does the cache hold the rejected promise forever?
>
> *Answer: Yes — cache stores the rejection. Subsequent `use()` on same args re-throws the error. Solution: retry mechanism clears cache on error: `cache((id) => fetchUser(id).catch(e => { userCache.clear(); throw e }))`.*

### use(context): Context Without Limitations

`use(Context)` replaces `useContext(Context)` with one difference: `use()` works anywhere in render, including conditionals:
```typescript
function Sidebar() {
  const auth = use(AuthContext)
  if (auth.role !== "admin") return null  // early return after use()
  const dashboard = use(DashboardContext)  // conditional use()
  return <Dashboard data={dashboard} />
}
```

This is impossible with `useContext` — hooks must not follow early returns. `use()` enables context-dependent composition.

```typescript
interface Auth {
  role: "admin" | "user"
  userId: string
}

function AdminPanel() {
  const auth = use<Auth>(AuthContext)
  const prefs = use(auth.role === "admin" ? fetchAdminPrefs(auth.userId) : fetchUserPrefs(auth.userId))
  return <Settings data={prefs} />
}
```

> **Think**: If `use(context)` can read context conditionally, does it still trigger re-render when context changes?
>
> *Answer: Yes. `use()` subscribes to the same context propagation as `useContext`. When context value changes, the component re-renders. Conditional placement does not affect reactivity.*

### use() vs Traditional Patterns

| Aspect | use() | useEffect + useState | useQuery (TanStack) |
|--------|------|---------------------|---------------------|
| Loading state | Suspense fallback | Manual boolean | `isLoading` field |
| Error state | Error boundary | Manual catch/setError | `isError` field |
| Re-fetch | Promise re-creation | Deps array change | `refetch()` / stale-while-revalidate |
| Caching | Manual (cache/Map) | Manual | Built-in cache + GC |
| SSR | Streams with Suspense | No streaming | SSR support |
| Code | 1 line | 8-15 lines | 3-5 lines |

```typescript
// useEffect pattern (18 lines)
function User({ id }: { id: string }) {
  const [data, setData] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchUser(id).then(d => { if (!cancelled) setData(d); setLoading(false) }).catch(e => { if (!cancelled) setError(e); setLoading(false) })
    return () => { cancelled = true }
  }, [id])
  if (loading) return <Skeleton />
  if (error) return <Error msg={error.message} />
  return <div>{data!.name}</div>
}

// use() pattern (6 lines with cache)
const fetchCached = cache((id: string) => fetchUser(id))
function User({ id }: { id: string }) {
  const data = use(fetchCached(id))
  return <div>{data.name}</div>
}
```

> **Think**: When would you still use useEffect + fetch instead of use()?
>
> *Answer: When you need side-effects after data loads (e.g., analytics tracking, WebSocket connection, timer start). `use()` is render-only — no side effect phase. Combine: `use()` for data, `useEffect` for side effects that react to that data.*

### Nested Suspense and Streaming

`use()` enables streaming SSR with Suspense. Each `use(promise)` is a potential suspension point:
```typescript
function Dashboard({ userId }: { userId: string }) {
  return (
    <Suspense fallback={<SidebarSkeleton />}>
      <Sidebar userId={userId} />
      <Suspense fallback={<MainSkeleton />}>
        <MainContent userId={userId} />
      </Suspense>
    </Suspense>
  )
}

function Sidebar({ userId }: { userId: string }) {
  const stats = use(fetchStats(userId))
  return <StatsPanel data={stats} />
}

function MainContent({ userId }: { userId: string }) {
  const posts = use(fetchPosts(userId))
  return <PostList posts={posts} />
}
```

Server streams: Sidebar renders first (fast), MainContent streams later (slow). Client sees Sidebar → MainContent appears without page reload.

> **Think**: Two sibling Suspense boundaries. Does one slow fetch block the other?
>
> *Answer: No. Each `<Suspense>` boundary is independent. Sidebar suspends → fallback shown, MainContent renders independently. When Sidebar resolves, it replaces fallback. Streaming SSR uses this for progressive HTML delivery.*

---

### Why This Matters

`use()` eliminates the most common React anti-pattern: `useEffect` for data fetching. It integrates with Suspense natively, enabling streaming SSR, parallel data loading, and coordinated loading states. Combined with `cache()`, it provides a primitive that replaces `useQuery` for initial data loading. Teams that adopt `use()` + Suspense reduce component complexity by 40-60% — no loading booleans, no error states, no effect cleanup for fetch cancellation. The mental shift from "fetch + setState" to "read with Suspense" is the foundation of the React 19 data architecture.

---

### Common Questions

**Q: Does use() prevent race conditions like useEffect does with the cancelled flag?**
A: Yes. `use()` suspends during render. If props change while suspended, React discards the suspended render and starts fresh. No stale closure risk — the promise is re-created with new args.

**Q: Can I use use() in Server Components?**
A: Yes. In Server Components, `use()` works with async contexts and promises. Server Components already have native async/await — `use()` is primarily for Client Components and streaming boundaries.

**Q: What happens if I call use() outside a component or hook?**
A: React throws: "use is not callable outside a component or hook." `use()` must be called during render of a component or custom hook.

**Q: Does use() support React 18?**
A: No. `use()` is React 19 only. Backport is not planned.

---

## Examples

### Example 1: User Profile with Cache

```typescript
import { cache, use } from "react"
import { Suspense } from "react"

interface User {
  id: string
  name: string
  avatar: string
}

const getUser = cache(async (id: string): Promise<User> => {
  const res = await fetch(`/api/users/${id}`)
  if (!res.ok) throw new Error("Failed to fetch user")
  return res.json()
})

function Avatar({ userId }: { userId: string }) {
  const user = use(getUser(userId))
  return (
    <Suspense fallback={<div>Loading avatar...</div>}>
      <img src={user.avatar} alt={user.name} />
    </Suspense>
  )
}

function ProfilePage({ userId }: { userId: string }) {
  return (
    <Suspense fallback={<div>Loading profile...</div>}>
      <Avatar userId={userId} />
    </Suspense>
  )
}
```

### Example 2: Conditional Context + Data

```typescript
interface UserContext {
  role: "admin" | "viewer"
  region: string
}

function AnalyticsPanel() {
  const { role, region } = use<UserContext>(UserContext)

  // Only admins see global analytics
  const data = use(
    role === "admin"
      ? fetchGlobalAnalytics(region)
      : fetchTeamAnalytics(region)
  )

  return <Dashboard data={data} />
}
```

---

## Key Takeaways
- `use()` reads Promises and Context during render, suspending via Suspense
- No Rules of Hooks restrictions — works in conditionals, loops, early returns
- `use(promise)` requires promise caching (`cache()` or Map) to avoid re-fetch on every render
- `use(context)` replaces `useContext` with conditional placement support
- Error handling via Error Boundary, not catch blocks
- Nested Suspense enables streaming and progressive rendering
- `use()` + `cache()` replaces useEffect + fetch for initial data

## Common Misconception

**"use() is just a wrapper around useEffect + useState."**

`use()` uses a fundamentally different mechanism. `useEffect` runs after render — the component mounts, shows loading state, then fetch resolves, re-render with data. `use()` suspends during render — the component never mounts until data is ready. This enables Suspense coordination, streaming SSR, and eliminates loading state logic entirely. The two are not interchangeable.

---

## Feynman Explain
(Explain `use()` to a React beginner. Use analogy: imagine ordering coffee — you don't sit at the table until the coffee is ready (Suspense). `use()` is like telling the waiter "I'll wait at the counter until my order is ready" instead of "bring it to me when it's done.")

---

## Reframe
(Critique: `use()` couples data fetching to the render tree. For deeply nested components, this hides data dependencies. Compare with colocation principle: should data requirements be visible at the route level or the component level? Write your opinion.)

---

## Drill
Take the quiz. MCQs test suspension behavior, caching, context reading, and error handling with `use()`.

Run: `learn.sh quiz advanced-react-19 03-use-hook`

## Quiz: 03-use-hook


### Where can use() be called in a React component?

- [ ] A: Inside useEffect, event handlers, and render

- [✓] B: Only during render — same phase as other hooks

- [ ] C: Anywhere in the component including callbacks

- [ ] D: Only at the top level, like other hooks


**Answer:** B

use() must be called during render. Unlike other hooks, it works in conditionals and loops — but still only in the render phase, not in effects, handlers, or callbacks.


### What does use(ThemeContext) return?

- [ ] A: A Promise that resolves to the context value

- [✓] B: The current context value, same as useContext

- [ ] C: A tuple of [value, setter]

- [ ] D: undefined — use() does not work with Context


**Answer:** B

use(Context) returns the current context value, identical to useContext(Context). The difference is placement: use() works in conditionals and early returns.


### What happens when use(promise) is called and the promise is pending?

- [ ] A: React returns undefined and logs a warning

- [✓] B: Component suspends — nearest Suspense fallback is shown

- [ ] C: The promise is ignored and render continues

- [ ] D: React throws an error


**Answer:** B

use(promise) suspends when the promise is pending. React unwinds the component and renders the nearest &lt;Suspense&gt; fallback. When the promise resolves, React retries the render.


### Why must promises passed to use() be cached or memoized?

- [ ] A: To reduce memory usage

- [✓] B: Because use() creates a new fetch for every render otherwise

- [ ] C: use() requires stable references for Suspense to work

- [ ] D: Caching is optional — use() deduplicates automatically


**Answer:** B

Each render creates a new promise argument. Without caching, every re-render suspends again because use() receives a new (different) promise. cache() or a Map ensures the same args produce the same promise reference.


### Which pattern correctly handles errors from use(promise)?

- [ ] A: try/catch around the use() call

- [✓] B: An Error Boundary wrapping the Suspense boundary

- [ ] C: A .catch() on the promise before passing to use()

- [ ] D: Error callback in the promise cache


**Answer:** B

use() throws rejected promises during render. Error Boundaries catch render-phase errors. try/catch does not work because use() suspends before throwing. Error Boundary is the correct surface for use() errors.


### use() can read context conditionally. What does useContext lack that enables this?

- [ ] A: Context type inference

- [✓] B: The ability to call after early returns or inside if blocks

- [ ] C: Re-render subscription

- [ ] D: Server Component support


**Answer:** B

useContext follows Rules of Hooks: must be at top level, never after early return. use() removes this restriction. You can read context mid-component, after guards and conditions.


### Two sibling components use use(promise). One has a fast fetch, the other slow. What renders first?

- [ ] A: Both wait for the slowest

- [✓] B: Each Suspense boundary is independent — fast renders first

- [ ] C: React serializes fetch order

- [ ] D: The parent blocks until both resolve


**Answer:** B

Each &lt;Suspense&gt; boundary manages its own fallback independently. Fast fetch component replaces its fallback first. The slow one remains in fallback until resolved. This enables progressive rendering.


### A cached promise rejects. Subsequent renders with the same args will:

- [ ] A: Retry fetch automatically

- [✓] B: Re-throw the same rejection from cache

- [ ] C: Skip the cache and create a new promise

- [ ] D: Return undefined


**Answer:** B

cache() stores the promise reference, including rejected promises. Next read returns the same rejected promise, which throws. Solution: cache wrapper that clears entry on rejection.


### Which scenario is NOT suitable for use() over useEffect + fetch?

- [ ] A: Initial page data that streams with SSR

- [✓] B: Analytics logging after user data loads

- [ ] C: Parallel data loading for dashboard widgets

- [ ] D: Conditional data fetching based on user role


**Answer:** B

use() is render-only — no side effect phase. Analytics logging after data loads is a side effect that needs useEffect. use() manages data, useEffect manages effects on that data.


### React's cache() deduplicates by:

- [ ] A: Memory reference of the callback

- [✓] B: Arguments passed to the wrapped function

- [ ] C: Component identity where cache() is called

- [ ] D: A random unique key on each invocation


**Answer:** B

cache() creates a memoized function keyed by its arguments. Same args → same promise reference. This is crucial for use() — stable references prevent re-suspension on re-render.


---

# Module 4: Transitions Deep — useTransition, startTransition, Batching

Est. study time: 2h
Language: en

## Learning Objectives
- Distinguish urgent vs transition updates and apply correct API
- Use `startTransition` and `useTransition` for non-blocking UI
- Understand React 19 batching model and its impact on re-renders
- Implement `useDeferredValue` for expensive derived computations
- Compose transitions with Suspense and Actions

---

## Core Content

### Urgent vs Transition Updates: The Mental Model

Every state update in React 19 belongs to one of two categories:

| Category | Examples | Priority | API |
|----------|----------|----------|-----|
| Urgent | Typing, clicking, dragging, sliders | High — must respond immediately | Default setState |
| Transition | Filtering list, navigating tabs, fetching search results | Low — can be delayed or interrupted | `startTransition` / `useTransition` |

```typescript
// Urgent — updates immediately
function SearchInput() {
  const [query, setQuery] = useState("")

  return <input value={query} onChange={(e) => setQuery(e.target.value)} />
}

// Transition — can be deferred
function SearchResults({ query }: { query: string }) {
  const [results, setResults] = useState<Result[]>([])
  const [, startTransition] = useTransition()

  useEffect(() => {
    startTransition(async () => {
      const data = await search(query)
      setResults(data)
    })
  }, [query])

  return <ResultList items={results} />
}
```

> **Think**: Why not wrap every setState in startTransition? What happens if you mark typing as a transition?
>
> *Answer: Typing marked as transition would feel sluggish — React may interrupt or delay the character showing. Transitions are for non-urgent work derived from urgent input. The input char is urgent; showing results derived from that input is a transition.*

### useTransition API Deep Dive

```typescript
function TabSwitcher() {
  const [tab, setTab] = useState<"feed" | "dashboard" | "settings">("feed")
  const [isPending, startTransition] = useTransition()

  function switchTab(next: "feed" | "dashboard" | "settings") {
    startTransition(() => {
      setTab(next)
    })
  }

  return (
    <div>
      {isPending && <Spinner />}
      <TabPanel tab={tab} />
    </div>
  )
}
```

`useTransition()` returns `[isPending, startTransition]`:
- `isPending`: boolean — true while transition is in flight. Shows loading feedback without blocking urgent updates.
- `startTransition(callback)`: marks all state updates inside callback as transitions.

**startTransition inside an Action:**
```typescript
const [state, formAction, pending] = useActionState(submitOrder, {})
const [, startTransition] = useTransition()

async function handleSubmit(formData: FormData) {
  startTransition(async () => {
    await formAction(formData)          // transition
    router.push("/confirmation")        // also transition
  })
}
```

> **Think**: `isPending` stays true until all transition-set states commit. What happens if the transition triggers a Suspense boundary?
>
> *Answer: `isPending` stays true while Suspense shows fallback. When content resolves and commits, `isPending` becomes false. This gives you a coordinated loading state without manual Suspense fallback management — show spinner near interactive elements, not just full-page fallbacks.*

### How Transitions Prevent Jank

Without transitions, React processes state updates synchronously to completion:
```
Typing → setQuery("h") → re-render with "h" → search filter 5000 items → paint (blocked during filter)
Typing → setQuery("he") → re-render with "he" → search filter 5000 items → paint (blocked)
```

This blocks the main thread. Each keystroke waits for the filter to finish before the next character appears.

With transitions:
```
Typing → setQuery("h") → render urgent path → paint (instant)
         ↳ startTransition → filter 5000 items → can be interrupted
Typing → setQuery("he") → React interrupts in-progress filter → render urgent path → paint (instant)
         ↳ startTransition → filter 5000 items with "he" → commit results
```

React compares transition outputs: if a newer transition exists, the old one's output is discarded. The DOM only sees the latest transition result.

> **Think**: User types "hello" fast. How many filter executions happen with vs without transitions?
>
> *Answer: Without transitions: 5 filter executions (h, he, hel, hell, hello), each blocking render. With transitions: React may interrupt after each keystroke, discard intermediate results, only commit the final "hello" filter. Likely 1-2 filter executions.*

### React 19 Batching Model

React 18 batches updates inside event handlers and effects:
```typescript
// React 18 — batched inside event handler
onClick={() => {
  setCount(c => c + 1)   // queued
  setFlag(f => !f)        // queued
  // single re-render for both
}}
```

React 19 extends batching everywhere — including timeouts, promises, native events:
```typescript
// React 19 — all batching, even async
fetch("/data").then(() => {
  setCount(c => c + 1)   // queued (was 2 renders in 18)
  setFlag(f => !f)        // queued
  // single re-render for both (React 18 did 2 renders here)
})
```

This reduces unnecessary renders. However, batching can delay state-dependent side effects:
```typescript
setCount(c => c + 1)
console.log(count)        // still old value — batched, not committed yet
```

> **Think**: Batching means setState inside a fetch .then() produces one render instead of two. Does this affect you if you read state immediately after setState?
>
> *Answer: Yes — if you read state synchronously after setState expecting the new value (anti-pattern), batching breaks this. Solution: use the updater function argument `setCount(prev => prev + 1)` or read from the source of truth.*

### useDeferredValue: Deferring Expensive Computations

`useDeferredValue` is the declarative version of transitions — it defers a value, not an update:

```typescript
function SearchPage({ query: urgentQuery }: { query: string }) {
  const deferredQuery = useDeferredValue(urgentQuery)
  const isStale = urgentQuery !== deferredQuery

  // Expensive filter runs on deferred value — not on every keystroke
  const results = useMemo(
    () => expensiveFilter(allItems, deferredQuery),
    [deferredQuery]
  )

  return (
    <div>
      <input defaultValue={urgentQuery} />  // immediate feel
      {isStale && <p>Updating results...</p>}
      <ResultsList items={results} />
    </div>
  )
}
```

| Mechanism | When to use | How it works |
|-----------|-------------|--------------|
| `startTransition` | You control the state update | Wrap setState in callback |
| `useDeferredValue` | You receive value from parent | Hook wraps the incoming value |

> **Think**: `useDeferredValue` causes the component to render twice — once with urgent value, once with deferred. Is this a performance problem?
>
> *Answer: The first render is synchronous (urgent). The second is deferred — React can interrupt and skip it if newer urgent input arrives. React double-renders intentionally: first shows urgent UI, second catches up deferred work. Not a bottleneck — React prioritizes correctly.*

### Transitions + Suspense: Coordinated Loading

Transitions interact with Suspense: a transition wrapping a Suspense-triggering state update keeps showing the **old UI** until new content resolves — no flash of fallback:

```typescript
function TabNavigator() {
  const [tab, setTab] = useState<"profile" | "dashboard">("profile")
  const [, startTransition] = useTransition()

  return (
    <div>
      <button onClick={() => startTransition(() => setTab("profile"))}>Profile</button>
      <button onClick={() => startTransition(() => setTab("dashboard"))}>Dashboard</button>

      <Suspense fallback={<FullPageSpinner />}>
        {tab === "profile" ? <Profile /> : <Dashboard />}
      </Suspense>
    </div>
  )
}
```

Without transition: switch tab → old content unmounts → Suspense fallback shows → new content loads. Fallback flash.

With transition: switch tab → old content stays visible → new content loads in background → old content swaps to new. No fallback flash.

> **Think**: Why does a transition suppress the Suspense fallback? Is this always desirable?
>
> *Answer: Because the transition signals "non-urgent navigation" — React prioritizes keeping old UI interactive over showing a loading spinner. This is desirable for tab switches, navigation, filter changes. It is NOT desirable for initial page load — you DO want the fallback then.*

---

### Why This Matters

Transitions are the most impactful React 19 feature for perceived performance. Before transitions, any heavy computation or data fetch blocked the main thread. Developers worked around this with debouncing (laggy), throttling (choppy), or web workers (complex). Transitions let React itself manage priority — no configuration, no arbitrary delays. Combined with Suspense, transitions eliminate the "loading spinner flash" that plagues single-page apps. Every interactive app should classify state updates into urgent vs transition; this single mental model reduces jank more than any manual optimization.

---

### Common Questions

**Q: Can I use startTransition outside of React components?**
A: No. `startTransition` is a hook or imported directly from React — but it only works in a React rendering context. For non-React contexts, use `useDeferredValue`.

**Q: What is the difference between startTransition and setTimeout?**
A: `setTimeout` queues work at the end of the macrotask queue — it always waits. `startTransition` is synchronous — React marks the update as low priority but processes it immediately if nothing else is pending. setTimeout always adds latency; startTransition adds latency only when React needs to prioritize urgent work.

**Q: How many transitions can run concurrently?**
A: Only one transition is active at a time. Starting a new transition interrupts and discards the previous in-progress transition.

**Q: Does useDeferredValue work with primitive values?**
A: Yes. `useDeferredValue` compares via `Object.is`. For primitives (string, number), if the new value is identical to the deferred value, no deferred re-render happens.

---

## Examples

### Example 1: Search with useDeferredValue

```typescript
interface Item {
  id: string
  title: string
  category: string
}

function Catalog({ items, query }: { items: Item[]; query: string }) {
  const deferredQuery = useDeferredValue(query)
  const isStale = query !== deferredQuery

  const filtered = useMemo(
    () => items.filter(
      (item) => item.title.toLowerCase().includes(deferredQuery.toLowerCase())
    ),
    [items, deferredQuery]
  )

  return (
    <div style={{ opacity: isStale ? 0.5 : 1 }}>
      {filtered.map((item) => (
        <CatalogCard key={item.id} item={item} />
      ))}
    </div>
  )
}
```

### Example 2: Tab Navigation with Transition + Suspense

```typescript
type Tab = "feed" | "analytics" | "settings"

function App() {
  const [tab, setTab] = useState<Tab>("feed")
  const [, startTransition] = useTransition()

  const tabs: Tab[] = ["feed", "analytics", "settings"]

  return (
    <div>
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => startTransition(() => setTab(t))}
        >
          {t}
        </button>
      ))}

      <Suspense fallback={<LayoutSkeleton />}>
        {tab === "feed" && <Feed />}
        {tab === "analytics" && lazy(() => import("./Analytics"))}
        {tab === "settings" && lazy(() => import("./Settings"))}
      </Suspense>
    </div>
  )
}
```

---

## Key Takeaways
- Every state update is urgent (default) or transition (startTransition)
- `useTransition()` returns `[isPending, startTransition]` — isPending shows UI feedback during transition
- Transitions prevent jank by making non-urgent work interruptible
- React 19 batches all state updates — async boundaries included
- `useDeferredValue` defers a value (declarative), `startTransition` defers an update (imperative)
- Transition + Suspense suppresses fallback flash: keeps old UI until new content resolves
- Only one transition active at a time — newer interrupts older
- Transition outputs are discardable — DOM only sees the latest committed result

## Common Misconception

**"Transitions are the same as debouncing."**

Debouncing introduces a fixed delay before any work starts. Transitions start immediately but can be interrupted. A debounced search waits 300ms before fetching; a transition starts fetching immediately but discards the result if the user types again within 50ms. Transitions feel faster because they optimistically start work — debouncing pessimistically delays work. React also manages the lifecycle (interrupt, discard, commit) automatically — debouncing requires manual cancel/restart logic.

---

## Feynman Explain
(Explain transitions to a designer who cares about UX. Use the analogy of a restaurant kitchen: urgent orders go immediately to the chef. Less urgent orders (table cleanup, prep work) are queued but can be paused if a new urgent order arrives. The customer never waits for cleanup to finish before their food is cooked.)

---

## Reframe
(Critique: transitions are invisible to the developer — no explicit priority declaration beyond "wrap in startTransition." Could more granular priority levels (lowest, background, interactive) improve control? Or would they just add complexity? Write your position.)

---

## Drill
Take the quiz. MCQs test urgent vs transition classification, batching behavior, Suspense interaction.

Run: `learn.sh quiz advanced-react-19 04-transitions`

## Quiz: 04-transitions


### Which state update should be wrapped in startTransition?

- [ ] A: Setting input value on keystroke

- [ ] B: Toggling a dropdown menu

- [✓] C: Setting filtered search results based on query

- [ ] D: Calling preventDefault in a form handler


**Answer:** C

Filtered results are derived data — non-urgent. The input value (keystroke) is urgent. Dropdown toggle is urgent (user expects instant response). Filtering is a transition.


### What does useTransition return?

- [ ] A: A boolean for pending state

- [ ] B: A function to start a transition

- [✓] C: A tuple of [isPending, startTransition]

- [ ] D: A tuple of [startTransition, isPending]


**Answer:** C

useTransition returns [isPending, startTransition]. isPending is boolean, startTransition is a function that marks state updates as non-urgent.


### When a transition-triggered state update causes a Suspense boundary to show a fallback, what does React do?

- [ ] A: Shows the fallback immediately

- [✓] B: Suppresses the fallback — keeps old UI visible until new content resolves

- [ ] C: Throws an error — transitions cannot trigger Suspense

- [ ] D: Shows both old UI and fallback simultaneously


**Answer:** B

Transitions suppress Suspense fallback to avoid flash. Old content stays visible during navigation. When new content resolves, React swaps it in. This only applies during transitions, not initial load.


### How does React 19 batching differ from React 18?

- [✓] A: React 19 batches updates inside async functions and promises; React 18 did not

- [ ] B: React 19 does not batch at all

- [ ] C: React 19 batches only inside event handlers, same as React 18

- [ ] D: React 19 requires explicit batch() calls


**Answer:** A

React 18 batched inside event handlers and effects only. React 19 extends batching to async functions, promises, timeouts, and native events — reducing renders in async flows.


### A user types 'react' in a search box. How many filter executions occur with useDeferredValue?

- [ ] A: 5 — one per character

- [ ] B: 1 — only the final deferred value triggers filter

- [ ] C: 3 — React batches some keystrokes

- [✓] D: Depends — React may interrupt intermediate deferred renders


**Answer:** D

React starts filtering on the first deferred value, but can interrupt when newer keystroke arrives. With fast typing, intermediate deferred renders are discarded. Likely 1-2 executions, not 5.


### What is the key difference between useDeferredValue and startTransition?

- [✓] A: useDeferredValue defers a value, startTransition defers an update

- [ ] B: They are identical — just different syntax

- [ ] C: useDeferredValue works only with Server Components

- [ ] D: startTransition defers a value, useDeferredValue defers an update


**Answer:** A

Use startTransition when you control the state update. Use useDeferredValue when you receive the value from a parent and cannot wrap the setter. Both achieve the same deferral but apply at different control points.


### What happens if a new startTransition is called while a previous transition is still in flight?

- [ ] A: Both run in parallel

- [✓] B: New transition interrupts and discards the previous one

- [ ] C: New transition is queued after the previous completes

- [ ] D: React throws a warning


**Answer:** B

Only one transition active at a time. A new startTransition interrupts the previous in-flight transition. The old transition's pending render output is discarded. DOM only commits the latest transition.


### In React 19, how many re-renders occur from this code? fetch('/data').then(() =&gt; { setA(1); setB(2); })

- [ ] A: 2 — one per setState

- [✓] B: 1 — both are batched

- [ ] C: 0 — fetch does not trigger re-render

- [ ] D: Depends on the component


**Answer:** B

React 19 batches all setState calls, including inside async promise callbacks. Both setA and setB trigger a single render. In React 18, this would be 2 renders (no batching outside event handlers).


### Which tool prevents the 'Suspense fallback flash' on tab navigation?

- [ ] A: useDeferredValue

- [✓] B: startTransition wrapping the tab setState

- [ ] C: React.memo on the tab panel

- [ ] D: useMemo on the tab content


**Answer:** B

Wrapping tab setState in startTransition tells React this is navigation, not initial load. React keeps old UI visible and suppresses the Suspense fallback until new content resolves — no flash.


### Your component receives a large list and a filter query from parent. Filter is expensive. Which optimization?

- [ ] A: Wrap filter in startTransition

- [✓] B: Use useDeferredValue on the query prop and useMemo on filter

- [ ] C: Use useMemo on the query prop

- [ ] D: Throttle the filter with setTimeout


**Answer:** B

You do not control the query setter (parent does). useDeferredValue defers the query value. useMemo skips expensive recalc until deferred query changes. This is the declarative pattern for deferred computation.


---

# Module 5: Common Hooks Mastery — useCallback, useMemo, useRef, useImperativeHandle

Est. study time: 2h
Language: en

## Learning Objectives
- Profile re-render performance and decide when memoization actually helps
- Apply useCallback and useMemo correctly — reference stability vs computation caching
- Distinguish Compiler-auto-memoizable patterns from manual-required patterns
- Leverage useRef for DOM, mutable instance variables, and callback refs
- Design imperative APIs with useImperativeHandle, understanding forwardRef deprecation

---

## Core Content

### The Memoization Trap: When More Hooks = Slower Code

Every hook call costs something. `useMemo` and `useCallback` are not free:
- Hook call overhead (function call, deps array allocation + comparison)
- Memory retention (memoized values persist across renders)
- Developer confusion (wrong deps → stale closures, missed updates)

Rule: **Measure before memoizing.** The React DevTools Profiler shows:
- Component re-rendered? Why? (props changed, state changed, parent re-rendered)
- How long did render take? (<1ms = skip memoization, >5ms = consider)
- How many descendants re-rendered unnecessarily?

> **Think**: A `<Button>` component renders in 0.3ms. It receives `onClick` from parent. Parent re-renders 50 times during typing. Should you wrap `onClick` in useCallback?
>
> *Answer: Probably not. Button renders in 0.3ms × 50 = 15ms total. useCallback overhead + deps comparison may cost more than it saves. Profile first. If the Button is wrapped in React.memo and has 100 instances, then useCallback matters — otherwise, cheap components don't need memoization.*

### useCallback: What It Actually Does

`useCallback(fn, deps)` returns the same function reference across renders unless deps change. Its sole purpose: **prevent passing a new function reference as props, which triggers re-render in memoized child components**.

```typescript
import { useCallback, useState, memo } from 'react'

interface ExpensiveListProps {
  items: string[]
  onSelect: (id: string) => void
}

const ExpensiveList = memo(function ExpensiveList({
  items,
  onSelect,
}: ExpensiveListProps) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item} onClick={() => onSelect(item)}>
          {item}
        </li>
      ))}
    </ul>
  )
})

function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<string[]>([])

  // Without useCallback: every SearchPage render creates new onSelect
  // ExpensiveList re-renders every time (memo checks prop reference)
  const handleSelect = useCallback((id: string) => {
    console.log('selected', id)
  }, [])

  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <ExpensiveList items={results} onSelect={handleSelect} />
    </div>
  )
}
```

Without `memo` on child, `useCallback` does nothing for render performance. The child re-renders because parent re-rendered, not because `onSelect` changed. `useCallback` only matters when:
1. Child is wrapped in `React.memo`
2. Child is a component that uses the function in a `useEffect` dep
3. Function passed to a custom hook that compares references (e.g., event emitter)

> **Think**: Why does useCallback with empty deps `[]` cause stale closures? When is empty deps correct?
>
> *Answer: Empty deps means the function never changes. If handleSelect reads state (e.g., `setQuery`), it captures initial value. It is correct only when the function truly depends on nothing — like dispatching to an external store or logging. React 19 Compiler handles this automatically by analyzing captured values.*

### useMemo: Computation Cache vs Reference Stability

Two distinct uses of `useMemo`:

**1. Expensive computation:**
```typescript
import { useMemo } from 'react'

interface DashboardProps {
  transactions: Transaction[]
}

function Dashboard({ transactions }: DashboardProps) {
  // Expensive: sort + group by category
  const groupedByCategory = useMemo(
    () => aggregateByCategory(transactions),
    [transactions]
  )

  // Also expensive but NOT cached — see why below
  const filteredAndSorted = useMemo(
    () => sortByDate(
      transactions.filter(t => t.amount > 0)
    ),
    [transactions]
  )

  return <Chart data={groupedByCategory} />
}
```

**2. Reference stability (needed after computation):**
```typescript
function Dashboard({ transactions }: DashboardProps) {
  const categories = useMemo(
    () => ['revenue', 'expenses', 'investments'],
    []
  )
  // Passed to memo child — stable reference means no unnecessary re-render
  return <CategoryFilter categories={categories} />
}
```

The second pattern is what the React Compiler handles. If you only need reference stability (not computation caching), the Compiler injects the memoization. If you have an expensive computation, manual `useMemo` is still needed until the compiler can prove the computation is idempotent.

> **Think**: What happens if you use useMemo with a computation that runs in 0.01ms? Is it worth wrapping?
>
> *Answer: No. useMemo overhead (deps comparison + memory) exceeds the computation cost. Only use useMemo when computation cost > hook overhead + deps comparison cost. Rule of thumb: >1ms or O(n²+) complexity.*

### React Compiler: What It Auto-Memoizes and What It Doesn't

React 19 Compiler (Forget) analyzes JavaScript at build time and injects memoization. What it handles:

| Pattern | Compiler handles? | Manual still needed? |
|---------|-------------------|---------------------|
| Inline function in JSX | Yes | No |
| Local variable derived from props/state | Yes | No |
| Object/array literals passed as props | Yes | No |
| `React.memo` wrapping | Yes (auto-wraps) | No |
| Cross-module value | No | Manual `useMemo`/`useCallback` |
| Value stored in ref | No | Manual |
| Values from non-React libraries | No | Manual |
| Computation with side effects | No | Manual (fix side effects first) |
| Conditional hook calls | No | Restructure to unconditional |

```typescript
// React 19 Compiler handles this automatically:
function Profile({ user }: { user: User }) {
  const displayName = formatName(user) // auto-memoized
  const handleClick = () => updateProfile(user.id) // auto-memoized
  return <Button onClick={handleClick}>{displayName}</Button>
}

// But NOT this (cross-module reference):
import { expensiveSort } from './utils'

function DataGrid({ rows }: { rows: Row[] }) {
  // Compiler cannot analyze expensiveSort internals
  // Manual useMemo required:
  const sorted = useMemo(() => expensiveSort(rows), [rows])
  return <Table data={sorted} />
}
```

> **Think**: Should you stop writing useCallback/useMemo today if you use React 19 Smart Compiler? What about code shared with React 18?
>
> *Answer: Yes for React-19-only code with Compiler enabled per module. No for code that must work on React 18 too. No for cross-module boundaries the compiler can't analyze. The Compiler is safe to enable incrementally — remove manual hooks as you verify the Compiler handles them.*

### useRef: DOM Refs, Mutable Instance Variables, Callback Refs

Three patterns for `useRef`:

**1. DOM refs:**
```typescript
import { useRef, useEffect } from 'react'

function AutoFocusInput() {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return <input ref={inputRef} />
}
```

**2. Mutable instance variable (survives renders, does not cause re-render):**
```typescript
function Timer() {
  const startTime = useRef(Date.now())
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    intervalRef.current = window.setInterval(() => {
      console.log('elapsed:', Date.now() - startTime.current)
    }, 1000)
    return () => clearInterval(intervalRef.current!)
  }, [])

  return <div>Timer running...</div>
}
```

**3. Callback refs (React 19 recommendation for dynamic ref assignment):**
```typescript
import { useState } from 'react'

function MeasureWidth() {
  const [width, setWidth] = useState(0)

  const measureRef = (node: HTMLDivElement | null) => {
    if (node !== null) {
      setWidth(node.getBoundingClientRect().width)
    }
  }

  return (
    <div>
      <div ref={measureRef}>Measured element</div>
      <p>Width: {width}px</p>
    </div>
  )
}
```

React 19 treats `ref` as a regular prop. This means callback refs work directly without `forwardRef`. The callback is called when:
- Element mounts → called with element
- Element unmounts → called with null
- Callback changes → called with null (cleanup), then new callback with element

> **Think**: You need a stable timer ID that doesn't cause re-render when set. useRef vs useState vs global variable outside component — which and why?
>
> *Answer: useRef. useState causes re-render on every set. Global variable persists across components but breaks encapsulation and testing. useRef gives per-component-instance mutable storage that survives renders without re-render.*

### useImperativeHandle: When to Expose Imperative API

`useImperativeHandle` customizes the instance value exposed when parent uses `ref`. In React 19, `ref` is a prop — `forwardRef` is deprecated but still works.

```typescript
import { useRef, useImperativeHandle } from 'react'

interface VideoPlayerHandle {
  play: () => void
  pause: () => void
  jumpTo: (time: number) => void
}

// React 19: ref as prop, no forwardRef needed
function VideoPlayer(
  { src }: { src: string },
  ref: React.Ref<VideoPlayerHandle>
) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useImperativeHandle(ref, () => ({
    play() {
      videoRef.current?.play()
    },
    pause() {
      videoRef.current?.pause()
    },
    jumpTo(time: number) {
      if (videoRef.current) {
        videoRef.current.currentTime = time
      }
    },
  }), [])

  return <video ref={videoRef} src={src} controls />
}

// Usage
function Parent() {
  const playerRef = useRef<VideoPlayerHandle>(null)

  return (
    <div>
      <VideoPlayer ref={playerRef} src="intro.mp4" />
      <button onClick={() => playerRef.current?.play()}>Play</button>
    </div>
  )
}
```

When to use imperative handles:
- **Animations**: `play()`, `pause()`, `reset()` — imperative by nature
- **Media players**: video/audio playback control
- **Third-party widget interop**: must expose methods to non-React code
- **Focus management**: complex focus sequences across multiple elements

When NOT to use:
- **Declarative alternatives exist**: props + state should be default
- **Data flow**: never expose getters for state (use callbacks instead)
- **Cross-component coordination**: use lifting state or context, not imperative ref chains

> **Think**: Should a `<Form>` component expose `submit()`, `validate()`, `reset()` via useImperativeHandle? What are the downsides?
>
> *Answer: Common pattern but has downsides. Imperative ref breaks declarative data flow — parent must call methods instead of reacting to state. Prefer `useActionState` in React 19 (handles submit + validation declaratively). Use imperative only for reset (clear all fields) which has no native React 19 equivalent yet.*

### React 19 Ref Changes

| Concern | React 18 | React 19 |
|---------|----------|----------|
| Passing ref | `forwardRef` wrapper | `ref` is regular prop |
| Cleanup functions | Not supported | Ref callbacks can return cleanup fn |
| Component name in DevTools | `ForwardRef(Comp)` | `Comp` directly |
| TypeScript | `React.PropsWithRef` | `React.Ref` as prop |
| Server Components | N/A | refs not supported in RSC |

Cleanup in ref callbacks (React 19):
```typescript
function ResizablePanel() {
  const panelRef = (node: HTMLDivElement | null) => {
    if (node) {
      const observer = new ResizeObserver((entries) => {
        console.log('resized:', entries[0].contentRect)
      })
      observer.observe(node)
      // Return cleanup function:
      return () => observer.disconnect()
    }
  }

  return <div ref={panelRef}>Resizable content</div>
}
```

> **Think**: Why does React 19 remove forwardRef? What migration issues might arise?
>
> *Answer: `ref` as a regular prop simplifies the mental model — no special wrapper needed. Migration issues: TypeScript types may still use `React.PropsWithRef` or `React.ForwardRefRenderFunction`; third-party HOCs that inject props may conflict with `ref` as regular prop. `forwardRef` still works in React 19 — migrate incrementally.*

### Common Anti-Patterns

**1. Memoizing everything:**
```typescript
// Bad: every prop wrapped defensively
const handleClick = useCallback(() => doSomething(), [])
const styles = useMemo(() => ({ color: 'blue' }), [])
const label = useMemo(() => 'Submit', [])

// Better: let compiler handle it, or measure first
```

**2. Missing deps leading to stale closures:**
```typescript
// Bad: stale count inside the callback
function Counter() {
  const [count, setCount] = useState(0)
  const logCount = useCallback(() => {
    console.log(count) // Always logs the initial count
  }, [])  // Missing count dependency!
  return <button onClick={logCount}>Log count</button>
}
```

**3. useRef as state replacement:**
```typescript
// Bad: ref mutation doesn't trigger re-render
function Counter() {
  const count = useRef(0)
  const increment = () => {
    count.current += 1 // UI never updates!
  }
  return <div>{count.current}</div>
}
```

**4. useImperativeHandle for data flow:**
```typescript
// Bad: imperative getter breaks React data flow
useImperativeHandle(ref, () => ({
  getValue: () => formState,
}))
// Better: lift formState to parent or use useActionState
```

---

### Why This Matters

Memoization is the most misunderstood React performance tool. Adding `useCallback` and `useMemo` everywhere is cargo-cult optimization — it costs memory and complexity without measurable benefit. React 19's Compiler eliminates ~80% of manual memoization, but the remaining 20% requires deep understanding: cross-boundary values, refs, imperative handles, and third-party interop. `useRef` is essential for DOM access, animation, and instance variables. `useImperativeHandle` is the escape hatch for when declarative approaches don't fit — but it is an escape hatch, not a default. Master these hooks to write performant, maintainable React 19.

Wrong approach: wrap everything in useMemo/useCallback 'just in case'. Right approach: profile, identify bottlenecks, memoize precisely where it matters. Let the Compiler handle the rest.

---

### Common Questions

**Q: Does React 19 eliminate useMemo for expensive computations?**
A: Not automatically. The Compiler auto-memoizes for reference stability (objects, arrays, functions derived from props/state). For genuinely expensive computations (sort 10k items, complex math), manual `useMemo` is still needed because the compiler cannot know the computation cost. Profile to confirm the computation is actually expensive.

**Q: When would I use useRef vs useState for a value that changes over time?**
A: useState when the change should trigger re-render (UI update). useRef when the value should change without re-render (timer ID, animation frame, previous value for comparison, DOM measurements). If you accidentally use useRef for display values, the UI will be stale.

**Q: Can I use useImperativeHandle in Server Components?**
A: No. Server Components don't support refs (no DOM, no interactivity). useImperativeHandle only works in Client Components. Mark the component with `'use client'` if it uses refs.

**Q: How does the React Compiler handle hooks like useRef?**
A: The compiler knows about React's built-in hooks. It understands that `useRef` returns a stable object and `current` is mutable. It will not memoize values derived from `ref.current` because those can change outside the render cycle. The compiler treats refs as a "mutable source" boundary.

**Q: What is the React 19 equivalent of forwardRef + useImperativeHandle?**
A: Same pattern, minus `forwardRef`. In React 19, define `ref` as a regular prop on your component. Everything else — `useRef`, `useImperativeHandle` — works identically. TypeScript: `ref: React.Ref<HandleType>` as a prop.

---

## Examples

### Example 1: Optimizing a Data Grid with Conditional Memoization

**Problem**: Virtualized data grid with 500 rows. Each row shows formatted data and handles click. Rows are `memo`-wrapped. Grid re-renders on scroll (position state changes).

```typescript
import { useMemo, useCallback, memo } from 'react'

interface RowProps {
  item: DataItem
  formatCurrency: (value: number) => string
  onRowClick: (id: string) => void
}

const Row = memo(function Row({ item, formatCurrency, onRowClick }: RowProps) {
  return (
    <tr onClick={() => onRowClick(item.id)}>
      <td>{item.name}</td>
      <td>{formatCurrency(item.value)}</td>
    </tr>
  )
})

function DataGrid({ items }: { items: DataItem[] }) {
  // Virtual list manages visible indices, causes frequent re-renders
  const [scrollTop, setScrollTop] = useState(0)

  // Memoize: expensive computation
  const visibleItems = useMemo(
    () => getVisibleItems(items, scrollTop, ROW_HEIGHT, containerHeight),
    [items, scrollTop]
  )

  // Memoize: prevent 500 Row re-renders on every scroll
  const formatCurrency = useCallback(
    (value: number) => new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value),
    []
  )

  const handleRowClick = useCallback((id: string) => {
    // navigate to detail page
  }, [])

  return (
    <div onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}>
      {visibleItems.map((item) => (
        <Row
          key={item.id}
          item={item}
          formatCurrency={formatCurrency}
          onRowClick={handleRowClick}
        />
      ))}
    </div>
  )
}
```

**Result**: Without memoization, every scroll event re-renders all 500 rows. With `memo` + `useCallback`, only the `visibleItems` computation runs. Rows re-render only if their specific item data changes (e.g., after data update, not on scroll).

### Example 2: Imperative Video Player with useImperativeHandle

**Problem**: Build a reusable video player component. Parent needs play/pause/seek/jumpTo and must know when video ends.

```typescript
import { useRef, useImperativeHandle, useState, useCallback } from 'react'

interface VideoHandle {
  play: () => Promise<void>
  pause: () => void
  seek: (time: number) => void
  isPlaying: boolean
}

function Player(
  { src, onEnded }: { src: string; onEnded?: () => void },
  ref: React.Ref<VideoHandle>
) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  useImperativeHandle(ref, () => ({
    async play() {
      await videoRef.current?.play()
      setIsPlaying(true)
    },
    pause() {
      videoRef.current?.pause()
      setIsPlaying(false)
    },
    seek(time: number) {
      if (videoRef.current) {
        videoRef.current.currentTime = time
      }
    },
    isPlaying,
  }), [isPlaying])

  const handleEnded = useCallback(() => {
    setIsPlaying(false)
    onEnded?.()
  }, [onEnded])

  return (
    <video
      ref={videoRef}
      src={src}
      onEnded={handleEnded}
      controls
    />
  )
}
```

**Result**: Parent controls video imperatively (useful for custom controls outside component tree). `isPlaying` is exposed so parent can show different UIs based on state. The imperative API is minimal — just what can't be done declaratively.

### Example 3: Profiling Before Memoizing

**Problem**: A dashboard with 10 chart components, each computing aggregates from 10k+ data points. Charts are wrapped in `memo`. Clicking a filter triggers re-render. Which hooks need memoization?

**Diagnosis**:
1. Profile in React DevTools: filter click → 800ms total render time
2. Flame graph: `BigChart` takes 300ms (sort + aggregate 10k rows)
3. `SmallChart` takes 5ms each (filtered subset)
4. Memory: 8MB retained between renders

**Decision**:
- `BigChart`: Wrap aggregation in `useMemo` (saves 300ms per render) — HIGH impact
- `SmallChart`: Skip memoization (5ms × 9 charts = 45ms — not worth complexity) — SKIP
- Filter click handler: `useCallback` (prevents BigChart re-render if filter hasn't changed) — MEDIUM impact
- `colorPalette` array: remove `useMemo` (created once, no computation) — REMOVE

**Result**: 800ms → 350ms. 56% reduction with three targeted changes. No wrapping of cheap operations.

---

## Key Takeaways
- Measure before memoizing. DevTools Profiler is your guide — data, not instinct.
- `useCallback` prevents child re-render only when child is wrapped in `memo`.
- `useMemo` serves two distinct purposes: expensive computation caching and reference stability.
- React 19 Compiler auto-memoizes ~80% of patterns. Manual memoization still needed for cross-boundary values, expensive computations, and refs.
- `useRef` is for mutable values that should not trigger re-render: DOM refs, interval IDs, animation frames, previous values.
- `useImperativeHandle` is for imperative APIs that cannot be expressed declaratively — animations, media, third-party interop.
- React 19 makes `ref` a regular prop. `forwardRef` is deprecated but still works. Migrate incrementally.
- Callback refs in React 19 support cleanup functions (return a function from the ref callback).
- Ref cleanup: callback refs can return a cleanup function for observers, event listeners, etc.
- Common anti-pattern: memoizing everything defensively. This is optimization by superstition, not evidence.

## Common Misconception

**"useCallback and useMemo always improve performance."**

False. Every hook call has overhead. `useCallback` creates a function, allocates a deps array, compares deps — each step costs time and memory. If the child component is not memoized, `useCallback` is entirely wasted — the child re-renders from the parent render anyway. The React Compiler eliminates unnecessary manual hooks, but even the compiler does not memoize everything. The only correct approach: profile, identify the real bottleneck, apply targeted memoization. Default to code clarity, not defensive hooks.

---

## Feynman Explain
(Explain useCallback and useMemo to a junior developer who knows only `useState` and `useEffect`. Use no React jargon in your explanation. Describe the problem: "Sometimes React re-renders parts of the screen that didn't change." Explain how useCallback and useMemo help, where they don't, and why measuring is better than guessing.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain` — AI probes gaps.*

---

## Reframe
(Pause. Consider: React 19's Compiler makes manual useCallback/useMemo mostly unnecessary. Is it worth teaching these hooks deeply when they may become legacy within 2 years? Or is deep understanding of memoization essential for the cases the compiler cannot handle? Write your evaluation. Consider the trade-off between future-proofing vs mastering fundamentals.)

---

## Drill
Take the quiz. MCQs test memoization decisions, useRef patterns, and React 19 ref changes.

Run: `learn.sh quiz advanced-react-19 05-common-hooks-mastery`

## Quiz: 05-common-hooks-mastery


### When does useCallback actually prevent a child component from re-rendering?

- [ ] A: Always — useCallback memoizes the function reference, which always prevents re-render

- [✓] B: Only when the child is wrapped in React.memo — otherwise child re-renders on parent render anyway

- [ ] C: Only when the child is an HTML element

- [ ] D: useCallback never prevents re-renders


**Answer:** B

useCallback returns a stable reference, but that only matters if the child checks for reference changes via memo. Without memo (or PureComponent in class), the child re-renders whenever the parent renders, regardless of prop references.


### Which scenario requires manual useMemo even with React 19 Compiler enabled?

- [ ] A: An object literal created inside a component from props

- [ ] B: An inline arrow function passed as onClick

- [✓] C: An expensive sort (10,000 items) imported from a utility module

- [ ] D: A string concatenated from two state variables


**Answer:** C

The Compiler cannot analyze functions imported from other modules. It cannot prove that expensiveSort is idempotent or determine its cost. For cross-module expensive computations, manual useMemo is still needed.


### What is the purpose of useRef when used as a mutable instance variable?

- [ ] A: To trigger re-render when the value changes

- [✓] B: To store a value that persists across renders without causing re-render

- [ ] C: To bind a variable to the component's props

- [ ] D: To create reactive state that updates the DOM directly


**Answer:** B

useRef returns a { current } object that persists across renders. Mutating current does not trigger re-render. Useful for timer IDs, animation frames, previous values, and other mutable data that should not cause re-rendering.


### What happens when you pass useCallback with empty deps [] to an event handler that calls setState?

- [ ] A: The handler always works correctly because setState is stable

- [✓] B: The handler captures the initial state and causes a stale closure

- [ ] C: React detects the missing dependency and throws a warning

- [ ] D: The handler only works on the first render


**Answer:** B

Empty deps means the function captures the state from the first render. If the handler reads count (state), it will always read the initial value. React DevTools ESLint rule (exhaustive-deps) flags this. Include all captured values in the deps array.


### In React 19, how do you expose imperative methods from a custom component?

- [ ] A: Wrap the component in forwardRef, use useImperativeHandle

- [ ] B: Define ref as a regular prop, use useImperativeHandle

- [ ] C: Export the methods as static class methods

- [✓] D: Both A and B are valid — forwardRef is deprecated but still works


**Answer:** D

React 19 makes ref a regular prop, so forwardRef is no longer required. However, forwardRef still works for backward compatibility. useImperativeHandle is used the same way in both cases. TypeScript: define ref: React.Ref&lt;HandleType&gt; as a prop.


### A component renders in 0.2ms. Parent re-renders 100 times during animation. The component is not wrapped in memo. Should you memoize its callback props?

- [ ] A: Yes — useCallback always improves performance

- [ ] B: Yes — 100 re-renders is significant

- [✓] C: No — without memo on child, useCallback has no effect on render count. Profile before optimizing

- [ ] D: No — animation renders are always fast enough


**Answer:** C

Without memo, the child re-renders on every parent render regardless of prop references. 0.2ms × 100 = 20ms total — trivial. useCallback would add overhead without benefit. The correct approach: profile, identify the actual bottleneck, then optimize.


### What is the React 19 enhancement to ref callbacks?

- [✓] A: Ref callbacks now support returning a cleanup function

- [ ] B: Ref callbacks can be async

- [ ] C: Ref callbacks now receive the previous value as second argument

- [ ] D: Ref callbacks are deprecated in favor of useRef


**Answer:** A

React 19 allows ref callbacks to return a cleanup function, similar to useEffect. This is useful for disconnecting observers, removing event listeners, and cleaning up other side effects when the ref target changes or unmounts.


### Which of the following is a valid reason to use useImperativeHandle?

- [ ] A: Getting form field values from parent component

- [✓] B: Exposing animation control methods (play, pause, reset)

- [ ] C: Sharing state between sibling components

- [ ] D: Fetching data on component mount


**Answer:** B

Imperative handles are appropriate for imperative operations: animations, media control, focus management. Form field values should flow declaratively (useActionState, controlled components). Data fetching belongs in effects or Server Components. Sibling state sharing should use lifting state or context.


### What does the React 19 Compiler automatically memoize?

- [✓] A: All functions, objects, and arrays created within a component

- [ ] B: Only component return JSX expressions

- [ ] C: Only values passed to React.memo components

- [ ] D: Only class component methods


**Answer:** A

The Compiler analyzes React rendering at build time and auto-memoizes values (functions, objects, arrays) derived from props and state within a component. It wraps the component in memo automatically. It does not handle cross-module values, refs, or values that escape React's scope.


### A developer writes: const fn = useCallback(() =&gt; doSomething(), []). doSomething reads an external store (Zustand) directly. Is the closure stale?

- [ ] A: Yes — the callback captures the store state at first render

- [✓] B: No — external store reads are always up-to-date because getState() returns current state, not captured state

- [ ] C: Yes — useCallback with empty deps always produces stale closures

- [ ] D: No — React automatically re-executes callbacks on store changes


**Answer:** B

Zustand's getState() (and similar external store methods accessed directly, not via hooks) returns the current state on every call. The callback captures the getState function reference (stable), but getState() reads the latest store state at call time. This is a valid pattern for useCallback with empty deps when the callback does not capture React state.


---

# Module 6: useOptimistic — Optimistic Updates Architecture

Est. study time: 2h
Language: en

## Learning Objectives
- Implement optimistic updates with `useOptimistic` and reconcile server responses
- Distinguish optimistic mutation from pessimistic mutation and choose per context
- Handle error, rollback, and race conditions in optimistic flows
- Combine `useOptimistic` with Actions and transitions for seamless UX

---

## Core Content

### What Are Optimistic Updates?

Pessimistic: wait for server → show result. Optimistic: show result immediately → reconcile with server.

| Approach | UX feel | Failure handling | API pattern |
|----------|---------|-----------------|-------------|
| Pessimistic | Laggy, loading spinners | Simple — show error, retry | await fetch → update UI |
| Optimistic | Instant, native-like | Complex — rollback UI | update UI → await fetch → reconcile |

Optimistic updates are standard in modern apps: Slack message appears instantly, Twitter like increments before API responds, Google Docs shows keystrokes before sync. React 19's `useOptimistic` makes this pattern first-class.

> **Think**: A payment app processes $10k transfers. Should it use optimistic update? What is the cost of showing "success" then reverting?
>
> *Answer: No. Financial transfers should be pessimistic. The cost of false optimism is trust erosion + user confusion. Optimistic updates are for low-risk, high-frequency actions: likes, messages, comments, toggles. For irreversible operations (payment, delete), use pessimistic or show optimistic with clear pending state.*

### useOptimistic API

```typescript
import { useOptimistic, useActionState } from 'react'

interface Message {
  id: string
  text: string
  status: 'sent' | 'pending' | 'error'
}

function MessageList({ messages }: { messages: Message[] }) {
  // optimisticMessages reflects messages + any pending optimistic adds
  const [optimisticMessages, addOptimisticMessage] = useOptimistic<
    Message[],
    string  // the value you pass when calling addOptimisticMessage
  >(
    messages,  // current state (source of truth from server/props)
    (state, optimisticText) => [
      ...state,
      {
        id: crypto.randomUUID(),
        text: optimisticText,
        status: 'pending',
      },
    ]
  )

  return (
    <ul>
      {optimisticMessages.map((msg) => (
        <li key={msg.id} className={msg.status === 'pending' ? 'opacity-50' : ''}>
          {msg.text}
        </li>
      ))}
    </ul>
  )
}
```

Parameters:
1. **Initial state**: the current real state (from server, parent, or store)
2. **Update function**: `(currentState, optimisticValue) => newState`. Pure function — no side effects. React applies this immediately during the transition.

Returns `[optimisticState, addOptimisticUpdate]`:
- `optimisticState`: the merged state (real + pending optimistics)
- `addOptimisticUpdate(value)`: call to trigger the optimistic update. The value is passed to your update function.

> **Think**: What happens if you call addOptimisticUpdate twice before the first server response arrives?
>
> *Answer: React queues both optimistic updates. The update function runs twice — once for each call — each time receiving the previous optimistic state. The UI shows both pending items. When the server responds, the real state replaces the optimistic state. If the server only confirms one message, a rollback is needed.*

### Combining with Actions

`useOptimistic` pairs naturally with `useActionState` and transitions:

```typescript
import { useOptimistic, useActionState } from 'react'

interface Todo {
  id: string
  title: string
  completed: boolean
}

async function addTodoAction(
  prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const title = formData.get('title') as string
  try {
    const res = await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
    if (!res.ok) throw new Error('Failed to add')
    return { error: null }
  } catch {
    return { error: 'Could not save todo. Try again.' }
  }
}

function TodoList({ todos }: { todos: Todo[] }) {
  const [optimisticTodos, addOptimisticTodo] = useOptimistic(
    todos,
    (state, title: string) => [
      ...state,
      { id: crypto.randomUUID(), title, completed: false },
    ]
  )

  const [state, formAction, isPending] = useActionState(addTodoAction, { error: null })

  async function handleSubmit(formData: FormData) {
    addOptimisticTodo(formData.get('title') as string)
    // formAction is a transition — React batches the optimistic update
    await formAction(formData)
  }

  return (
    <div>
      <form action={handleSubmit}>
        <input name="title" required disabled={isPending} />
        <button type="submit" disabled={isPending}>Add</button>
        {state.error && <p className="error">{state.error}</p>}
      </form>
      <ul>
        {optimisticTodos.map((todo) => (
          <li key={todo.id}>{todo.title}</li>
        ))}
      </ul>
    </div>
  )
}
```

Flow:
1. User submits → `addOptimisticTodo` called → UI instantly shows new todo
2. `formAction` fires → server request begins
3. Server responds:
   - Success: Action returns success → real `todos` prop updates → `useOptimistic` reconciles (uses real data, drops optimistic)
   - Error: Action returns error → real `todos` unchanged → `useOptimistic` reverts to original state (optimistic item disappears)

**Important**: `useOptimistic` is not a state management tool. It is a UI-layer overlay. The source of truth is always `todos` prop. When the prop updates, optimistic state is recalculated.

> **Think**: The optimistic todo disappears after error. Is that good UX? What should you do instead?
>
> *Answer: Hard disappearance is jarring. Better: keep the optimistic item but mark it with status: 'error'. Give user action to retry or dismiss. This requires tracking optimistic items that failed — either store optimistic IDs in ref or extend the state model to include a 'failed' status.*

### Rollback Strategies

Three levels of rollback:

**1. Implicit rollback (default)** — source of truth updates, optimistic state recalculates:
```typescript
// After error: todos prop stays same
// optimisticTodos recalculates — optimistic item gone
// UI returns to pre-submission state
```

**2. Keep-and-retry — mark failed, don't disappear:**
```typescript
import { useRef } from 'react'

interface OptimisticTodo extends Todo {
  _optimistic?: boolean
  _error?: string
}

function TodoListWithRetry({ todos }: { todos: Todo[] }) {
  const pendingMap = useRef<Map<string, string>>(new Map())

  const [optimisticTodos, addOptimistic] = useOptimistic(
    todos,
    (state: Todo[], newTodo: { title: string; tempId: string }) => [
      ...state,
      {
        ...newTodo,
        id: newTodo.tempId,
        completed: false,
        _optimistic: true,
      },
    ]
  )

  async function handleSubmit(formData: FormData) {
    const tempId = crypto.randomUUID()
    addOptimistic({ title: formData.get('title') as string, tempId })
    // Store tempId so we can find it on error
    const result = await addTodoAction(null, formData)
    if (result.error) {
      // tempId persists in pendingMap until retry succeeds or dismissed
      pendingMap.current.set(tempId, result.error)
    }
  }

  // Map source-of-truth todos + errored optimistics to display
  // This keeps errored items visible with retry option
  return (
    <ul>
      {optimisticTodos.map((todo) => {
        const error = pendingMap.current.get(todo.id)
        return (
          <li key={todo.id} className={error ? 'error' : ''}>
            {todo.title}
            {error && <button>Retry</button>}
          </li>
        )
      })}
    </ul>
  )
}
```

**3. Full manual rollback** — replace entire state with pre-mutation snapshot.

> **Think**: When is implicit rollback acceptable? When must you keep the item visible?
>
> *Answer: Implicit rollback works for non-critical items where user doesn't notice (like counts). Keep visible when: the action has high user investment (long message they typed), the error is transient (rate limit, retry button expected), or the optimistic item was visible long enough that its disappearance would be jarring.*

### Race Conditions and Ordering

Optimistic updates must account for **ordering mismatches** between optimistic state and server confirmation:

```typescript
// Problem: optimistic state may arrive before or after server data
// If server responds with new state that doesn't include the pending item yet,
// the optimistic item shows alongside server items — then duplicate appears

function TodoList({ todos }: { todos: Todo[] }) {
  const [optimisticTodos, addOptimistic] = useOptimistic(
    todos,
    (state, title: string) => [
      ...state,
      { id: crypto.randomUUID(), title, completed: false },
    ]
  )

  // Without deduplication logic:
  // 1. Add "Buy milk" (optimistic) → shows "Buy milk" (temp ID)
  // 2. Server returns updated todos including { title: "Buy milk", id: "server-123" }
  // 3. Now we have "Buy milk" (temp) AND "Buy milk" (server) — DUPLICATE
}
```

Solutions:

**Option A: Server returns the created item, client replaces optimistic:**
```typescript
async function addTodo(prev: any, formData: FormData) {
  const res = await fetch('/api/todos', { method: 'POST', body: formData })
  const created = await res.json()  // returns { id: "server-123", title: "Buy milk" }
  return { error: null, created }
}
// Parent component replaces todos with server state
// Optimistic item with temp ID will be dropped when source of truth changes
```

**Option B: Use a stable optimistic ID and let server confirm it (idempotency key):**
```typescript
function generateTempId(): string {
  return `optimistic-${crypto.randomUUID()}`
}

interface TodoFormProps {
  addOptimistic: (value: { title: string; tempId: string }) => void
}

async function handleSubmit(formData: FormData) {
  const tempId = generateTempId()
  addOptimistic({ title: formData.get('title') as string, tempId })

  // Send tempId as idempotency key
  await fetch('/api/todos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: formData.get('title'), tempId }),
  })
  // Server returns the full new list via refetch → replaces todos prop
  // React compares: existing todos + optimistic items with temp IDs
  // Server confirms the todo → it appears in the fetched list
  // Optimistic item with temp ID is now gone from source-of-truth
  // No duplicate because temp ID items are dropped on reconciliation
}
```

> **Think**: Why does automatic reconciliation work most of the time without dedup logic?
>
> *Answer: Because the server returns the authoritative list. When the parent fetches new data, the todos prop replaces the old array entirely. `useOptimistic` computes new state from the new authoritative state. Optimistic items with temp IDs are no longer in source of truth and get dropped. Duplicates only happen if the server list arrives before the optimistic is applied, or if the server list already includes the same logical item that the optimistic also represents.*

### Loading and Error States

Optimistic state is visually distinct from confirmed state:

```typescript
function Message({ message }: { message: Message }) {
  const statusIndicator = {
    confirmed: '✓',
    pending: '◌',
    error: '✗',
    retrying: '↻',
  }[message.status]

  return (
    <div className={`message message--${message.status}`}>
      <p>{message.text}</p>
      <span className="status">{statusIndicator}</span>
      {message.status === 'error' && (
        <button onClick={() => retry(message)}>Retry</button>
      )}
    </div>
  )
}
```

Use CSS transitions for smooth status changes:
```css
.message--pending { opacity: 0.6; }
.message--error { background: #fff0f0; }
.status { transition: opacity 200ms; }
```

> **Think**: Should optimistic items be interactive (e.g., can you click a link in an optimistic message)?
>
> *Answer: Generally no. Optimistic items have provisional IDs. Clicking a link that navigates to /messages/{optimistic-id} will 404 if the server hasn't confirmed yet. Disable non-local interactions (clicks, form submits) on optimistic items. Visual cues (opacity, skeleton) help set the expectation.*

### Performance Considerations

Optimistic updates add complexity. Assess before adopting:

| Factor | Pessimistic | Optimistic |
|--------|-------------|------------|
| Code complexity | Low | Medium-high |
| UX smoothness | Medium | High |
| Server latency tolerance | Low (<200ms ideal) | High (works at any latency) |
| Error handling | Straightforward | Multiple strategies |
| Testing burden | Standard | Edge cases (race, rollback, retry) |
| Cache invalidation | None | Must reconcile with refetch |

Threshold: Optimistic makes sense when server P95 latency > 500ms. Under 200ms, pessimistic feels instant and is simpler. Between 200-500ms, depends on context (form submit: pessimistic fine; like button: optimistic expected).

---

### Why This Matters

Users expect native-app responsiveness. Every millisecond of perceived delay reduces engagement. Optimistic updates eliminate the most common delay — waiting for server confirmation — by showing the result immediately and reconciling in the background. React 19's `useOptimistic` makes this pattern declarative and safe, handling rollback and reconciliation automatically. Combined with Actions and transitions, it enables instant UI without sacrificing data integrity. The cost is complexity: race conditions, error handling, retry logic, and testing. Use optimistic updates where UX impact is highest and risk of reversal is lowest.

---

### Common Questions

**Q: How is useOptimistic different from useOptimistic from third-party libraries (like use-optimistic)?**
A: `useOptimistic` is a built-in React 19 hook. It's integrated with the concurrent rendering pipeline and transitions. Third-party libraries manage their own state. React's version automatically reconciles with the source of truth (the initial state argument). It does not persist state — it is a derived overlay.

**Q: Can I use useOptimistic without an Action or transition?**
A: The hook returns `addOptimisticUpdate` which can be called outside transitions. But without wrapping the mutation in a transition, you lose the ability to manage pending state declaratively. Best practice: `useOptimistic` + `useActionState` together.

**Q: Does useOptimistic work with Server Components?**
A: No. `useOptimistic` is a client-side hook (requires interactivity). The server sends the source-of-truth data. The client applies the optimistic overlay. Mark your component with `'use client'`.

**Q: How is useOptimistic different from just using local state?**
A: Local state manually managed is error-prone. You must remember to reset state on error, handle race conditions, and sync with server. `useOptimistic` ties into React's scheduling — it's automatically removed when the source of truth updates. Local state has no such reconciliation logic.

**Q: Can I use useOptimistic with any async operation, not just fetch?**
A: Yes. The hook is mutation-agnostic. It works with any async function: fetch, GraphQL, WebSocket, IndexedDB, or even simulated delays. The UX layer only cares about the optimistic state overlay — the mutation implementation is separate.

---

## Examples

### Example 1: Like Button with Optimistic Toggle

```typescript
import { useOptimistic, useActionState } from 'react'

interface Post {
  id: string
  liked: boolean
  likeCount: number
}

async function toggleLikeAction(
  prev: { error: string | null },
  formData: FormData
) {
  const postId = formData.get('postId') as string
  const currentLiked = formData.get('liked') === 'true'

  try {
    const res = await fetch(`/api/posts/${postId}/like`, {
      method: 'POST',
      body: JSON.stringify({ liked: !currentLiked }),
    })
    if (!res.ok) throw new Error('Failed to toggle')
    return { error: null }
  } catch {
    return { error: 'Could not update like. Try again.' }
  }
}

function LikeButton({ post: initialPost }: { post: Post }) {
  const [optimisticPost, addOptimistic] = useOptimistic(
    initialPost,
    (state) => ({
      ...state,
      liked: !state.liked,
      likeCount: state.liked
        ? state.likeCount - 1
        : state.likeCount + 1,
    })
  )

  const [, formAction] = useActionState(toggleLikeAction, { error: null })

  async function handleSubmit(formData: FormData) {
    addOptimistic(undefined)  // value ignored, update fn uses previous state
    await formAction(formData)
  }

  return (
    <form action={handleSubmit}>
      <input type="hidden" name="postId" value={optimisticPost.id} />
      <input type="hidden" name="liked" value={String(optimisticPost.liked)} />
      <button type="submit" className="like-btn">
        {optimisticPost.liked ? '❤️' : '🤍'}
        {optimisticPost.likeCount}
      </button>
    </form>
  )
}
```

### Example 2: Comment Thread with Optimistic Replies

```typescript
import { useOptimistic, useRef } from 'react'

interface Comment {
  id: string
  author: string
  text: string
  createdAt: string
  status: 'confirmed' | 'pending' | 'failed'
}

function CommentThread({ comments }: { comments: Comment[] }) {
  const failedComments = useRef<Set<string>>(new Set())
  const formRef = useRef<HTMLFormElement>(null)

  const [optimisticComments, addOptimistic] = useOptimistic(
    comments,
    (state, text: string) => [
      ...state,
      {
        id: crypto.randomUUID(),
        author: 'You',
        text,
        createdAt: new Date().toISOString(),
        status: 'pending' as const,
      },
    ]
  )

  async function handleSubmit(formData: FormData) {
    const text = formData.get('comment') as string
    formRef.current?.reset()

    const tempId = crypto.randomUUID()
    addOptimistic(text)

    const res = await fetch('/api/comments', {
      method: 'POST',
      body: JSON.stringify({ text, tempId }),
    })

    if (!res.ok) {
      failedComments.current.add(tempId)
      // Trigger re-render to show error state
      // In practice, use a callback to source-of-truth updater
    }
  }

  return (
    <div>
      <form ref={formRef} action={handleSubmit}>
        <textarea name="comment" required rows={3} />
        <button type="submit">Post Comment</button>
      </form>
      <div className="comments">
        {optimisticComments.map((comment) => (
          <div key={comment.id} className={`comment comment--${comment.status}`}>
            <strong>{comment.author}</strong>
            <p>{comment.text}</p>
            {comment.status === 'pending' && (
              <small className="sending">Sending...</small>
            )}
            {failedComments.current.has(comment.id) && (
              <div className="error-actions">
                <small>Failed to send.</small>
                <button>Retry</button>
                <button>Dismiss</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

### Example 3: Real-time Collaboration Cursor

```typescript
import { useOptimistic, useCallback } from 'react'

interface CursorPosition {
  userId: string
  x: number
  y: number
  lastUpdated: number
}

function CollaborativeArea({ cursors }: { cursors: CursorPosition[] }) {
  const [optimisticCursors, addLocalCursor] = useOptimistic(
    cursors,
    (state, position: { x: number; y: number }) => [
      ...state.filter(c => c.userId !== 'local'),
      {
        userId: 'local',
        x: position.x,
        y: position.y,
        lastUpdated: Date.now(),
      },
    ]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Throttle to 60fps
      requestAnimationFrame(() => {
        addLocalCursor({ x: e.clientX, y: e.clientY })
      })
      // Also send to server via WebSocket (debounced)
    },
    [addLocalCursor]
  )

  return (
    <div className="canvas" onMouseMove={handleMouseMove}>
      {optimisticCursors.map((cursor) => (
        <div
          key={cursor.userId}
          className="cursor"
          style={{ left: cursor.x, top: cursor.y }}
        />
      ))}
    </div>
  )
}
```

---

## Key Takeaways
- `useOptimistic` provides an optimistic overlay on top of a source-of-truth state. When the source-of-truth updates, optimistic state recalculates.
- Optimistic updates are ideal for high-frequency, low-risk actions (likes, messages, comments). Avoid for irreversible operations (payments, deletes).
- Pair `useOptimistic` with `useActionState` for declarative mutation + optimistic UI + error handling.
- Three rollback strategies: implicit (default — optimistic items disappear on error), keep-and-retry (store failed IDs, show retry buttons), full snapshot restore.
- Race conditions: optimistic items with temp IDs can cause duplicates when server data arrives. Use idempotency keys or dedup logic.
- Optimistic items should be visually distinct (opacity, skeleton) and non-interactive for provisional data.
- Performance threshold: use optimistic when P95 latency > 500ms. Below 200ms, pessimistic is fine.
- `useOptimistic` is client-only. Use `'use client'` directive.

## Common Misconception

**"Optimistic updates just make UI faster — they don't add real complexity."**

Optimistic updates are deceptively complex. Every optimistic path is a speculative fork that must be reconciled. Race conditions, ordering mismatches, retry state, idempotency, error recovery — each adds code and testing surface. A pessimistic update is one path: `fetch → error/success`. An optimistic update is three paths: `optimistic → success confirmation`, `optimistic → error → rollback`, `optimistic → error → keep-and-retry`. Use optimistic only where the UX gain justifies the complexity cost.

---

## Feynman Explain
(Explain optimistic updates to a product manager who doesn't code. Describe what "showing result before server responds" means. Explain when it works well (like button) and when it's dangerous (bank transfer). Use no technical jargon.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain` — AI probes gaps.*

---

## Reframe
(Pause. Critique: `useOptimistic` is a thin wrapper around state management. Would it be better handled by a dedicated state management library (TanStack Query, Zustand, SWR) that already handles optimistic updates + cache invalidation + rollback? Write your evaluation. Consider React 19 integration, bundle size, and team familiarity.)

---

## Drill
Take the quiz. MCQs test optimistic update patterns, rollback strategies, and when to use them.

Run: `learn.sh quiz advanced-react-19 06-optimistic-updates`

## Quiz: 06-optimistic-updates


### What does useOptimistic return?

- [ ] A: [state, setState] — like useState

- [✓] B: [optimisticState, addOptimisticUpdate] — optimistic overlay + trigger

- [ ] C: [optimisticState, rollback] — optimistic overlay + rollback function

- [ ] D: [state, formAction] — like useActionState


**Answer:** B

useOptimistic returns [optimisticState, addOptimisticUpdate]. The optimistic state is the source-of-truth merged with pending optimistic updates. addOptimisticUpdate triggers the optimistic update function. The hook does not return a setState-like setter — the source of truth is the first argument.


### When does useOptimistic automatically roll back an optimistic update?

- [ ] A: When addOptimisticUpdate is called with null

- [✓] B: When the source-of-truth state (first argument) changes — optimistic state recalculates

- [ ] C: When a timeout of 5 seconds expires

- [ ] D: useOptimistic never rolls back automatically


**Answer:** B

useOptimistic is a derived overlay. When the source-of-truth (the first argument) changes, React recalculates the optimistic state by applying pending updates to the new source. If the source didn't change (error case), optimistic items are gone because they were never confirmed.


### Which scenario is appropriate for optimistic updates?

- [ ] A: Credit card payment processing

- [ ] B: Medical record deletion

- [✓] C: Social media like button toggle

- [ ] D: Bank transfer authorization


**Answer:** C

Optimistic updates are for low-risk, high-frequency actions where incorrect optimism has low cost. Social media likes are ideal. Financial transactions, medical records, and irreversible deletes should use pessimistic updates with explicit confirmation.


### What is the recommended pairing for useOptimistic in React 19?

- [ ] A: useOptimistic + useState

- [✓] B: useOptimistic + useActionState (or transition)

- [ ] C: useOptimistic + useReducer

- [ ] D: useOptimistic + useEffect


**Answer:** B

useOptimistic naturally pairs with useActionState or useTransition. The action contains the async mutation. The optimistic update fires immediately, then the action's pending/error states handle the server response. This keeps optimistic + mutation logic co-located.


### A user posts a comment optimistically. Server rejects it. What is the simplest rollback behavior?

- [ ] A: The comment stays but shows an error icon

- [✓] B: The comment disappears from the UI

- [ ] C: The entire page reloads from server

- [ ] D: The user is redirected to an error page


**Answer:** B

Default implicit rollback: the source-of-truth (comments prop) didn't change, so the optimistic item disappears when React recalculates. This is clean but can be jarring. For better UX, keep the item with error state and retry button using explicit error tracking.


### What causes duplicate items in optimistic update flows?

- [ ] A: Calling addOptimisticUpdate twice accidentally

- [✓] B: Server returns new data that includes the same logical item while optimistic item is still pending

- [ ] C: Using useOptimistic without a transition

- [ ] D: Not wrapping the component in React.memo


**Answer:** B

When the server responds and the new source-of-truth includes the item (which now has a server ID), the optimistic item (with temp ID) hasn't been cleared yet. React sees two items: the optimistic temp-ID version and the server-confirmed version. Use dedup or idempotency keys to prevent this.


### Should optimistic items be fully interactive (clickable links, submit buttons)?

- [ ] A: Yes — instant interactivity is the point of optimistic updates

- [✓] B: No — optimistic items have provisional data; navigation to optimistically referenced pages may fail

- [ ] C: Only links are safe; buttons should be disabled

- [ ] D: Only during the first 500ms after submission


**Answer:** B

Optimistic items often use temporary/local IDs. Navigating to /posts/optimistic-temp-id will 404 because the server hasn't confirmed the item yet. Disable non-local interactions (navigation, submission) on optimistic items. Local interactions (edit preview text) are safe.


### What is the update function in useOptimistic(state, updateFn) supposed to be?

- [ ] A: An async function that calls the server

- [✓] B: A pure function that returns new optimistic state given current state and the optimistic value

- [ ] C: A reducer that handles action types

- [ ] D: A transformation that runs once on mount


**Answer:** B

The update function must be pure — no side effects, no async operations. It takes (currentState, optimisticValue) and returns the new optimistic state. React calls it synchronously during the transition to compute the overlay.


### At what server latency threshold does pessimistic UX feel indistinguishable from optimistic?

- [ ] A: &lt; 100ms

- [✓] B: &lt; 200ms

- [ ] C: &lt; 500ms

- [ ] D: &lt; 1000ms


**Answer:** B

Research shows &lt;200ms latency is perceived as instant. Between 200-500ms, users notice the delay but it's tolerable. At &gt;500ms, users perceive lag. Pessimistic is fine below 200ms. Optimistic brings UX benefit above 500ms. Between 200-500ms, use judgment.


### Can useOptimistic be used inside a Server Component?

- [ ] A: Yes — it works anywhere in React 19

- [✓] B: No — useOptimistic requires client-side interactivity ('use client')

- [ ] C: Yes, but only with async Server Components

- [ ] D: Yes, but only when the server has low latency


**Answer:** B

useOptimistic is a client-side hook that manages a UI overlay. Server Components have no interactivity, no state, and no re-renders. Mark the component with 'use client' to use useOptimistic. The server sends the source-of-truth data as props.


---

# Module 7: Suspense Unleashed — Data Fetching, Streaming SSR, Boundaries

Est. study time: 2.5h
Language: en

## Learning Objectives
- Architect Suspense boundaries at correct granularity for streaming SSR and client rendering
- Implement data fetching with Suspense integration using `use()` and Server Components
- Control streaming SSR fallback behavior using Suspense boundaries
- Handle error recovery with Suspense + ErrorBoundary composition

---

## Core Content

### Suspense Mental Model: Not a Loader

Suspense is not a loading spinner API. Suspense is a **rendering orchestration boundary** that tells React: "This part of the tree is not ready yet. Don't commit it. Show fallback. When ready, replace."

Key insight: Suspense decouples **what to show** from **when data is ready**. Without Suspense, a component fetches data and either shows loading (component-managed) or doesn't render at all (parent-managed). With Suspense, React manages the lifecycle:

```
Without Suspense:
  Parent fetches data → checks loading → renders child → child fetches → checks loading
  N waterfall, N loading spinners to manage

With Suspense:
  <Suspense fallback={<Skeleton />}>
    <DataComponent />  {/* throws promise internally */}
  </Suspense>
  DataComponent tells React "I'm loading" → React shows fallback
  Data ready → React replaces fallback with component
```

> **Think**: If Suspense doesn't show a loading spinner, what purpose does the fallback serve? When might you pass null as fallback?
>
> *Answer: Fallback is placeholder content shown during loading. null means "render nothing until ready" — useful when sudden content shift is worse than blank space. Examples: below-fold content, analytics panels, non-critical recommendations. The fallback is a design choice, not a technical requirement.*

### Suspense + use() for Data Fetching

In React 19, `use()` can read a promise directly in render. React suspends the component until the promise resolves.

```typescript
import { Suspense, use } from 'react'

// 1. Define a data source — can be module-level for deduplication
const userPromise = fetch('/api/user').then(res => res.json()) as Promise<User>

function UserProfile() {
  // use() reads the promise in render
  // If pending: React suspends this component (shows nearest Suspense fallback)
  // If resolved: returns the value
  // If rejected: throws the error (caught by nearest ErrorBoundary)
  const user = use(userPromise)

  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  )
}

function App() {
  return (
    <Suspense fallback={<div className="skeleton" />}>
      <UserProfile />
    </Suspense>
  )
}
```

> **Think**: What happens if you use use(promise) inside a useEffect? Inside a click handler?
>
> *Answer: use() only works in render. Inside useEffect or event handlers, use() throws. use() is a Render-as-You-Fetch primitive — it reads data during rendering. For event-driven fetching (click to load), use Actions or transition-based data loading.*

### Cache() for Promise Deduplication

In React 19, `cache()` provides request-scoped promise deduplication:

```typescript
import { cache, use } from 'react'
import { Suspense } from 'react'

// cache() wraps an async function
// Concurrent calls with same arguments share one promise
const getUser = cache(async (id: string): Promise<User> => {
  const res = await fetch(`/api/users/${id}`)
  if (!res.ok) throw new Error('User not found')
  return res.json()
})

function UserProfile({ userId }: { userId: string }) {
  const user = use(getUser(userId))
  return <h2>{user.name}</h2>
}

function UserPosts({ userId }: { userId: string }) {
  const user = use(getUser(userId))  // Same cache hit — no extra fetch
  return <p>{user.posts.length} posts</p>
}

function ProfilePage({ userId }: { userId: string }) {
  return (
    <Suspense fallback={<Skeleton />}>
      <UserProfile userId={userId} />
      <Suspense fallback={<PostsSkeleton />}>
        <UserPosts userId={userId} />
      </Suspense>
    </Suspense>
  )
}
```

`cache()` behavior:
- Keyed by arguments (shallow comparison)
- One promise per unique argument set — concurrent calls share it
- Promise lives for lifetime of the cache entry (until garbage collected)
- In Server Components, scoped to the request — no cross-request leak
- In Client Components, persists across renders — manual invalidation needed

> **Think**: User navigates from /users/1 to /users/2, then back to /users/1. Does getUser('1') cache the result?
>
> *Answer: Yes. cache() returns the cached promise as long as the module lives. For Client Components, this is the page lifetime — navigating back to userId=1 hits the cache without a refetch. To force refetch, invalidate via router refresh or update a key in the cache call. For Server Components, each request has a fresh cache.*

### Streaming SSR with Suspense Boundaries

React 19 Server Components stream HTML incrementally. Each Suspense boundary becomes a streaming chunk:

```html
<!-- Initial HTML includes shell (navigation, header, footer) -->
<main>
  <nav>...</nav>
  <header>...</header>

  <!-- ProductList is a Suspense boundary → placeholder injected -->
  <template id="B:0">Loading products...</template>

  <footer>...</footer>
</main>

<!-- When ProductList data resolves, React streams its HTML -->
<div hidden id="B:0" style="display:none"></div>
<div>
  <div class="product-card">Product 1</div>
  <div class="product-card">Product 2</div>
</div>
```

Streaming means:
- TTFB (Time To First Byte) is fast — shell sent immediately
- Content appears progressively — each Suspense boundary resolves independently
- User sees content as it arrives, not after all data loaded
- SEO-critical content can be in early boundaries

```typescript
import { Suspense } from 'react'

async function ProductList() {
  // This component is a Server Component reading data with async/await
  const products = await db.products.findMany()
  return (
    <div className="product-grid">
      {products.map(p => <ProductCard key={p.id} product={p} />)}
    </div>
  )
}

function Page() {
  return (
    <div>
      {/* Streaming starts with this shell */}
      <Header />
      <Sidebar />

      {/* ProductList is a streaming chunk — rendered when data ready */}
      <Suspense fallback={<ProductGridSkeleton />}>
        <ProductList />
      </Suspense>

      {/* Footer streams with shell since it has no Suspense boundary */}
      <Footer />
    </div>
  )
}
```

> **Think**: Where should you place Suspense boundaries for best perceived performance?
>
> *Answer: Above the fold: no Suspense (render inline) or use minimal fallback. Content below fold: Suspense with skeleton matching final layout size. Critical content: tight boundary (one component per Suspense). Non-critical: wide boundary (group several components) so they stream together. The number of boundaries affects streaming granularity — more boundaries = more chunks but more overhead.*

### Suspense + Transition: Fallback Suppression

React 19 suppresses Suspense fallback during transitions. If data refreshes inside a transition, React keeps old content visible instead of showing a fallback:

```typescript
import { useState, useTransition, Suspense } from 'react'

function SearchPage() {
  const [query, setQuery] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSearch(nextQuery: string) {
    setQuery(nextQuery)  // urgent: update input immediately
    startTransition(() => {
      // Transition: refresh search results
      // If SearchResults suspends, React does NOT show fallback
      // Instead, it keeps showing old results until new ones are ready
    })
  }

  return (
    <div>
      <input
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
      />
      <Suspense fallback={<SearchSkeleton />}>
        <SearchResults query={query} />
      </Suspense>
    </div>
  )
}
```

Without transition: every keystroke would show the fallback (flashing skeleton). With transition: old results stay visible, React swaps them when new results resolve.

> **Think**: What UI cue tells the user that new content is loading during a transition?
>
> *Answer: React doesn't show anything by default. You must use `isPending` from `useTransition` to show a subtle indicator: spinner in search bar, dimmed overlay, progress bar. Without this, the UI appears frozen until new content streams in. Example: Google Search shows a thin loading bar at top during search while keeping old results.*

### ErrorBoundary + Suspense Composition

Errors in Suspense-wrapped components are caught by the nearest `ErrorBoundary`. Combine both for resilient UIs:

```typescript
import { Component, Suspense } from 'react'

class ErrorBoundary extends Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

function ResilientPage() {
  return (
    <div>
      <Header />
      <ErrorBoundary fallback={<ErrorCard message="Failed to load products" />}>
        <Suspense fallback={<ProductGridSkeleton />}>
          <ProductList />
        </Suspense>
      </ErrorBoundary>
      <ErrorBoundary fallback={<p>Failed to load sidebar</p>}>
        <Suspense fallback={<SidebarSkeleton />}>
          <Sidebar />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}
```

Nesting rules:
- **ErrorBoundary outside Suspense**: catches errors from the suspended component and the fallback
- **Suspense outside ErrorBoundary**: Suspense retries after error (component resumes showing fallback)
- **Multiple ErrorBoundaries per Suspense**: each boundary independently recovers

Recovery after error:
```typescript
function RetryOnError({ children }: { children: React.ReactNode }) {
  const [key, setKey] = useState(0)

  return (
    <ErrorBoundary
      fallback={
        <div>
          <p>Something went wrong</p>
          <button onClick={() => setKey(k => k + 1)}>Retry</button>
        </div>
      }
      key={key}
    >
      {children}
    </ErrorBoundary>
  )
}
```

> **Think**: An API endpoint returns 500. Should Suspense catch this error and show the fallback, or should ErrorBoundary handle it?
>
> *Answer: ErrorBoundary handles it. Suspense only handles pending promises. A rejected promise (500 error) propagates as an exception. Suspense does not catch exceptions — ErrorBoundary does. Pattern: ErrorBoundary wraps Suspense. Suspense shows loading; ErrorBoundary shows error.*

### Suspense Boundary Granularity

| Granularity | Pros | Cons | Use case |
|-------------|------|------|----------|
| One boundary for entire page | Simple, one stream chunk | Everything blocks on slowest data | Static pages, mostly cached |
| Boundary per section | Independent loading, perceived perf | More complexity, multiple skeletons | Dashboards, product pages |
| Boundary per component | Maximum streaming granularity | Many small chunks, overhead | Critical data dependencies |
| Nested boundaries | Prioritized loading order | Deep tree complexity | Nested layouts, drill-downs |

Recommendation: start with section-level boundaries. Profile. Add granularity where slow sections block fast ones.

---

### Why This Matters

Suspense in React 19 is the backbone of both streaming SSR and concurrent rendering. It changes how every component handles loading: instead of `isLoading` flags in every component, Suspense boundaries manage the loading lifecycle centrally. This eliminates loading state bugs (forgotten loading check, flickering spinners, race conditions) and enables progressive HTML streaming that cuts TTFB by 40-60%. Without Suspense mastery, React 19 applications will have suboptimal loading UX, waterfall data fetching, and poor streaming performance.

---

### Common Questions

**Q: Can I use Suspense with existing data fetching libraries (React Query, SWR)?**
A: Yes as of React 19. Libraries with Suspense support can throw promises from use hooks. React Query has `suspense: true` option. SWR has `suspense: true`. However, `use()` + `cache()` is the React-19-native approach without library dependencies.

**Q: How many Suspense boundaries is too many?**
A: There is no hard limit. Each boundary adds ~500 bytes to the stream (opening/closing template tags). The practical limit is developer cognitive load — each boundary is a loading state to design. Start with 3-5 per page, profile, add where streaming waterfall is visible.

**Q: Does Suspense work with Server Components without `'use client'`?**
A: Yes. Server Components can use `async/await` directly (no `use()` needed). Wrap them in Suspense boundaries in the parent component (which may be a Server Component too). The client handles the streaming.

**Q: How do I handle optimistic updates with Suspense?**
A: Use `useOptimistic` inside the transition. The transition keeps the old Suspense content visible (no fallback flash). The optimistic update shows instant UI changes. Both together prevent any loading/flickering during data mutations.

**Q: What happens if a Suspense boundary's fallback is null and the data takes 10 seconds?**
A: Nothing renders in that region for 10 seconds. The user sees blank space. This is acceptable for below-fold content but poor UX for primary content. Always provide a meaningful fallback (skeleton, spinner, shimmer) for above-fold content.

---

## Examples

### Example 1: Dashboard with Streaming Sections

```typescript
import { Suspense } from 'react'

async function RevenueChart() {
  const data = await fetchRevenue()  // ~3s
  return <Chart data={data} />
}

async function RecentOrders() {
  const orders = await fetchOrders()  // ~1s
  return <OrderList orders={orders} />
}

async function TopProducts() {
  const products = await fetchTopProducts()  // ~2s
  return <ProductTable products={products} />
}

async function UserMetrics() {
  const metrics = await fetchMetrics()  // ~500ms
  return <MetricsCards metrics={metrics} />
}

function Dashboard() {
  return (
    <div className="dashboard">
      <h1>Dashboard</h1>

      {/* Fastest data streams first — appears in ~500ms */}
      <Suspense fallback={<MetricsSkeleton />}>
        <UserMetrics />
      </Suspense>

      {/* Orders appear next at ~1s */}
      <Suspense fallback={<OrdersSkeleton />}>
        <RecentOrders />
      </Suspense>

      {/* Products at ~2s */}
      <Suspense fallback={<ProductSkeleton />}>
        <TopProducts />
      </Suspense>

      {/* Chart last at ~3s */}
      <Suspense fallback={<ChartSkeleton />}>
        <RevenueChart />
      </Suspense>
    </div>
  )
}
```

**Streaming behavior**: User sees metrics cards at 500ms, orders at 1s, products at 2s, chart at 3s. Without Suspense streaming: blank page until 3s (all data loaded).

### Example 2: Search with Transition + Suspense

```typescript
'use client'

import { useState, useTransition, Suspense, cache, use } from 'react'

const searchProducts = cache(async (query: string): Promise<Product[]> => {
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error('Search failed')
  return res.json()
})

function SearchResults({ query }: { query: string }) {
  const products = use(searchProducts(query))

  return (
    <ul>
      {products.map(p => (
        <li key={p.id}>{p.name} — ${p.price}</li>
      ))}
    </ul>
  )
}

function SearchPage() {
  const [query, setQuery] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value
    setQuery(next)  // urgent: update input immediately

    startTransition(() => {
      // Transition: this updates the query prop passed to SearchResults
      // React will NOT show Suspense fallback — old results stay visible
    })
  }

  return (
    <div>
      <input
        value={query}
        onChange={handleChange}
        placeholder="Search products..."
      />
      {isPending && <div className="search-spinner" />}
      <Suspense fallback={<div>Loading results...</div>}>
        <SearchResults query={query} />
      </Suspense>
    </div>
  )
}
```

### Example 3: Nested Suspense for Progressive Loading

```typescript
async function ProductPage({ id }: { id: string }) {
  const product = await getProduct(id)  // 500ms

  return (
    <div>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      <p className="price">${product.price}</p>

      {/* Reviews load independently — don't block product info */}
      <Suspense fallback={<ReviewsSkeleton />}>
        <Reviews productId={id} />
      </Suspense>

      {/* Recommendations can take even longer */}
      <Suspense fallback={<RecommendationsSkeleton />}>
        <Recommendations productId={id} />
      </Suspense>
    </div>
  )
}
```

Streaming order: product info at 500ms → reviews stream later → recommendations last. Each nested Suspense boundary resolves independently regardless of nesting depth.

---

## Key Takeaways
- Suspense is rendering orchestration, not a loading spinner. It manages component readiness.
- `use()` reads promises and context in render. Component suspends until promise resolves.
- `cache()` deduplicates concurrent promise calls with same arguments.
- Streaming SSR sends Suspense boundaries as independent HTML chunks — fast TTFB, progressive content.
- Transitions suppress Suspense fallback — old content stays visible during data refresh.
- ErrorBoundary catches rejected promises (errors) from Suspense-wrapped components.
- Boundary granularity is a design decision: section-level for simplicity, component-level for fine-grained streaming.
- Nested Suspense boundaries each stream independently.
- Always provide meaningful fallbacks for above-fold content. null fallback OK for below-fold.

## Common Misconception

**"Suspense replaces all data fetching patterns."**

Suspense changes how data fetching integrates with rendering, but it does not replace data fetching itself. You still need to decide: Server Components vs client-side fetch, cache invalidation strategy, optimistic updates, error handling, refetch triggers. Suspense handles the "wait for data" state, not the "get data" part. Server Components + async/await is one approach. Client-side `use()` + `cache()` is another. External libraries (React Query, SWR) add cache management, refetching, and invalidation that Suspense alone does not provide.

---

## Feynman Explain
(Explain Suspense to a designer who understands loading states but not rendering. Describe what "suspending" means, how streaming works like a page loading image by image, and why transitions keep old content visible. Use web-comic analogy: panels load one by one but the first panel showed immediately.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain` — AI probes gaps.*

---

## Reframe
(Pause. Critique: Suspense boundaries add complexity — skeleton components, streaming markup, error boundary nesting. For an internal admin tool with fast API responses (<200ms), is Suspense worth the overhead? Write your evaluation. Consider: developer time, bundle size impact, and actual user-perceived performance gains for a latency-tolerant audience.)

---

## Drill
Take the quiz. MCQs test Suspense principles, streaming behavior, transition suppression, and error handling.

Run: `learn.sh quiz advanced-react-19 07-suspense`

## Quiz: 07-suspense


### What happens when a component calling use(promise) during render has a pending promise?

- [✓] A: The component throws the promise — React catches it and shows the nearest Suspense fallback

- [ ] B: The component returns null until the promise resolves

- [ ] C: use(promise) returns undefined — component must handle loading state

- [ ] D: React blocks the entire render tree until the promise resolves


**Answer:** A

use() throws the pending promise. React's Suspense mechanism catches this thrown promise, 'suspends' the component, and renders the nearest parent Suspense boundary's fallback instead. When the promise resolves, React retries rendering the component.


### What does React's cache() function provide?

- [ ] A: Persistent storage across browser sessions

- [✓] B: Request-scoped deduplication — concurrent calls with same arguments share one promise

- [ ] C: LocalStorage wrapper with type safety

- [ ] D: Automatic cache invalidation on mutation


**Answer:** B

cache() wraps an async function and deduplicates concurrent calls. If two components call getUser('1') simultaneously, they share one promise. In Server Components, the cache is scoped to the request. In Client Components, it persists across renders. cache() does not provide invalidation.


### In React 19 streaming SSR, when does the browser receive HTML for a Suspense-bounded component?

- [ ] A: All at once after all data is fetched

- [✓] B: The shell (outside Suspense) streams first, then each Suspense boundary streams when its data resolves

- [ ] C: Only after JavaScript loads

- [ ] D: In order of component definition in source code


**Answer:** B

Streaming SSR sends the shell HTML immediately (fast TTFB). Each Suspense boundary streams independently when its data resolves. The browser progressively renders content as chunks arrive. Each boundary is wrapped in a template placeholder, then replaced by streamed HTML.


### What happens to Suspense fallback during a transition?

- [ ] A: The fallback is shown immediately

- [✓] B: The fallback is suppressed — React keeps showing old content until new content is ready

- [ ] C: Both old and new content render simultaneously

- [ ] D: The fallback is shown but with lower priority


**Answer:** B

React 19 suppresses Suspense fallback during transitions. Instead of showing a loading skeleton, React keeps existing committed content visible. Once new data resolves, React swaps old content for new. This prevents flashing skeletons during data refresh.


### How should ErrorBoundary and Suspense be composed for error-resilient loading?

- [ ] A: ErrorBoundary inside Suspense — error retries Suspense

- [✓] B: ErrorBoundary wrapping Suspense — errors are caught by ErrorBoundary, loading by Suspense

- [ ] C: They cannot be composed — use one or the other

- [ ] D: Suspense inside ErrorBoundary — Suspense catches both loading and errors


**Answer:** B

ErrorBoundary wrapping Suspense is the recommended pattern. Suspense handles the loading phase (pending promise). ErrorBoundary handles the error phase (rejected promise). Errors thrown from the suspended component or during rendering are caught by the ErrorBoundary.


### A page has three Suspense boundaries fetching data in 500ms, 2s, and 4s. What is the user experience with streaming SSR?

- [ ] A: User sees nothing for 4 seconds, then all content appears

- [✓] B: User sees shell immediately, first section at 500ms, second at 2s, third at 4s

- [ ] C: Content appears in reverse order (slowest first)

- [ ] D: Content appears only after JavaScript hydrates


**Answer:** B

Streaming SSR sends each Suspense chunk as its data resolves. Shell (navigation, header, footer) arrives at TTFB (&lt;100ms typically). First section resolves at 500ms, streams its HTML. Second at 2s. Third at 4s. User sees progressive content without full-page loading.


### What is cache()'s scope in Server Components?

- [ ] A: Persistent across all users and requests

- [✓] B: Scoped to the current request — automatically garbage collected after response

- [ ] C: Scoped to the current module — persists until server restart

- [ ] D: No scope — cache() does not work in Server Components


**Answer:** B

In Server Components, cache() is request-scoped. Each HTTP request gets a fresh cache. This prevents data leakage between users and ensures stale data is not served across requests. The cache lives only as long as the Server Component renders.


### When would you use null as a Suspense fallback?

- [ ] A: Never — null fallback is invalid

- [✓] B: For below-fold or non-critical content where blank space is better than a skeleton

- [ ] C: For the outermost Suspense boundary only

- [ ] D: When the component never suspends


**Answer:** B

null fallback renders nothing during loading. This is appropriate for below-fold content, recommendations, analytics panels — places where showing a skeleton may cause more layout shift than blank space. Above-fold content should always have a meaningful fallback.


### Which of the following is NOT a valid use of Suspense in React 19?

- [ ] A: Wrapping a Server Component that uses async/await

- [ ] B: Wrapping a Client Component that uses use(promise)

- [✓] C: Wrapping an event handler that navigates to a new page

- [ ] D: Wrapping a lazy-loaded component with React.lazy()


**Answer:** C

Suspense only works at the rendering level — it catches thrown promises during render. Event handlers are imperative code, not rendering. Navigation during an event handler is handled by the router, not Suspense. All other options are valid Suspense use cases.


### A product detail page has reviews that take 3s to load. What Suspense strategy provides the best UX?

- [ ] A: One boundary for the entire page — single fallback, everything loads together

- [✓] B: Product info inline (no Suspense), reviews in a separate Suspense boundary with skeleton fallback

- [ ] C: Nested boundaries: product info boundary contains reviews boundary

- [ ] D: No Suspense — manage loading state within the reviews component with useState


**Answer:** B

Product info should render immediately without Suspense (no waiting). Reviews should be in a separate Suspense boundary with a skeleton matching review card dimensions. This gives fast product info display while reviews stream in. Option A blocks everything on reviews. Option C works but adds unnecessary nesting. Option D loses streaming benefits.


---

# Module 8: Server Components: Composition, Client Boundaries, Directives

Est. study time: 2.5h
Language: en

## Learning Objectives
- Distinguish Server Components from Client Components by runtime, bundle impact, and API access
- Apply 'use client' and 'use server' directives to define component boundaries
- Compose Server Components wrapping Client Components with serializable props
- Build and test async Server Components that use server-only APIs directly

---

## Core Content

### Server Components vs Client Components — Mental Model Shift

Before React 19, every component ran in browser. All code shipped to client. All components hydrated. This is **Client Component** model — single environment.

Server Components (RSC) split React into two environments:

| Dimension | Server Component | Client Component |
|-----------|-----------------|-----------------|
| Runs on | Server (render only) | Client (browser) |
| Bundle size | Zero bytes — never ships | Full size shipped |
| State/effects | None — no hooks | useState, useEffect, etc. |
| Data access | Direct: DB, fs, secrets | Via API calls only |
| Async | Native async/await | No — use hooks or libraries |
| Re-renders | Per request only | Per state/prop change |

Mental model: Server Components are **render-time only**. They generate a serialized tree sent to client. Once sent, they die. No state, no interactivity, no hydration. Client Components take over for anything interactive.

> **Think**: You have a page that renders a product list from database and an interactive search bar. Which parts become Server vs Client Components?
>
> *Answer: Product list is Server Component — fetches DB directly, renders HTML-like output, never ships to client. Search bar is Client Component — needs useState for input, onChange handler, interactivity. The layout/container can be Server Component that wraps search bar client component.*

### 'use client' and 'use server' Directives

Directives mark the boundary between environments.

**'use client'** — placed at **top of file** (first line). Every component exported from that file becomes a Client Component. The file and all its dependencies ship to browser. Cannot be used inside Server Components conditionally — once a file has 'use client', all exports are client.

```typescript
// SearchBar.tsx
'use client'

import { useState } from 'react'

interface SearchBarProps {
  onSearch: (query: string) => void
}

export function SearchBar({ onSearch }: SearchBarProps) {
  const [query, setQuery] = useState('')
  return (
    <input
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && onSearch(query)}
    />
  )
}
```

**'use server'** — placed in **function body** (inline) or **top of file** (module-level). Used for Server Actions — functions callable from client but executed on server.

```typescript
// Inline in component:
export function CreatePost() {
  async function createPost(formData: FormData) {
    'use server'
    const title = formData.get('title')
    await db.post.create({ title })  // server-only
    revalidatePath('/posts')
  }
  return <form action={createPost}>...</form>
}
```

```typescript
// Separate file — all exports are Server Actions:
// app/actions.ts
'use server'

import { db } from '@/lib/db'

export async function createPost(formData: FormData) {
  const title = formData.get('title')
  await db.post.create({ title })
  revalidatePath('/posts')
}
```

Key distinction: 'use client' marks **components** (return JSX). 'use server' marks **actions** (return data, accept FormData). Two different boundaries.

> **Think**: What happens if you put 'use server' on a file that exports a component? Can that component be rendered client-side?
>
> *Answer: 'use server' on a file makes all exports Server Actions — they become RPC endpoints. Components exported from a 'use server' file cannot be rendered as React components. They are callable functions only. Common mistake: using 'use server' on a component file thinking it makes the component server-only. Use 'use client' for components, 'use server' for actions.*

### Composition Patterns and Client Boundaries

Server Components render first, producing a tree. When React encounters a 'use client' boundary, it stops Server rendering and inserts a placeholder. Client bundle hydrates from that point downward.

Critical pattern: **Server Components wrap Client Components**. Never the reverse.

```typescript
// CORRECT: Server Component wraps Client Component
// Page.tsx — Server Component (no directive)
import { ProductList } from './ProductList' // Server Component
import { AddToCart } from './AddToCart'     // Client Component ('use client')

export default function Page() {
  const products = await db.product.findAll() // server-only
  return (
    <div>
      <ProductList products={products} />
      <AddToCart productId={products[0].id} />
    </div>
  )
}
```

```typescript
// WRONG: Client Component wraps Server Component
// Page.tsx — Client Component ('use client')
import { ProductList } from './ProductList' // Server Component — CANNOT import here

export default function Page() {
  return <ProductList /> // Runtime error: Server Component in Client Component
}
```

Exception: Server Components can be **passed as children** (props) to Client Components:

```typescript
// Correct: Server content passed as children
// layout.tsx — Server Component
export default function Layout({ children }: { children: React.ReactNode }) {
  return <ClientShell>{children}</ClientShell>
  // children is rendered on server, received as opaque prop by ClientShell
}

// ClientShell.tsx
'use client'
export function ClientShell({ children }: { children: React.ReactNode }) {
  return <div className="shell">{children}</div>
}
```

**Serialization boundary**: Props passed from Server to Client Component must be serializable:
- ✅ Strings, numbers, booleans, null, undefined
- ✅ Plain objects, arrays
- ✅ Date (serialized to ISO string automatically)
- ✅ Map, Set, BigInt (in React 19)
- ❌ Functions — cannot pass callbacks from server to client
- ❌ Class instances with methods
- ❌ Symbols
- ❌ React elements (except as children)

> **Think**: You need to pass a click handler from a Server Component to a Client Component. The handler calls a server action. How do you wire this without passing a function across the boundary?
>
> *Answer: Define server action separately. Pass action reference (string name or import) or use form action. Client component calls the action via `bind` or form — no function crossing boundary. Pattern: action lives in 'use server' file, client component receives action reference as prop, invokes it.*

### Async Server Components

Server Components are **native async**. No useEffect, no useQuery, no loading state boilerplate:

```typescript
// Server Component — direct async/await
export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await db.product.findUnique({
    where: { id: params.id },
    include: { reviews: true }
  })

  if (!product) return <NotFound />

  return (
    <div>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      <ReviewList reviews={product.reviews} />
      <AddReviewForm productId={product.id} />
    </div>
  )
}
```

Rules:
- `async` keyword on component function — works only in Server Components
- No hooks allowed — `await` replaces `useEffect`+fetch pattern
- Each `await` suspends the component, streams via Suspense boundary
- Error handling: wrap in `error.tsx` (Next.js) or `<ErrorBoundary>`

```typescript
// With parallel data fetching — faster than client waterfall
export default async function Dashboard() {
  const [revenue, users, orders] = await Promise.all([
    db.revenue.findMany(),
    db.user.findMany(),
    db.order.findMany(),
  ])
  return <DashboardView revenue={revenue} users={users} orders={orders} />
}
```

> **Think**: Your async Server Component fetches three endpoints sequentially: users, then orders, then revenue. Total time: 900ms. How do you reduce to 300ms?
>
> *Answer: Use Promise.all to parallelize. Server Components can await multiple independent promises concurrently. Unlike client-side waterfalls (fetch in useEffect → state set → re-render → next fetch), server can batch all fetches in one render pass.*

### Server Actions

Server Actions are functions callable from client, executed on server. Two patterns:

**Inline** — action defined in component, 'use server' as first statement:
```typescript
export default function CreateUserForm() {
  async function createUser(formData: FormData) {
    'use server'
    const email = formData.get('email')
    const name = formData.get('name')
    await db.user.create({ data: { email, name } })
    revalidatePath('/users')
  }

  return (
    <form action={createUser}>
      <input name="email" type="email" />
      <input name="name" />
      <button type="submit">Create</button>
    </form>
  )
}
```

**Module-level** — separate file, all exports are actions:
```typescript
// app/users/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
})

export async function createUser(prevState: unknown, formData: FormData) {
  const parsed = schema.parse(Object.fromEntries(formData))
  await db.user.create({ data: parsed })
  revalidatePath('/users')
  return { success: true }
}
```

Used with `useActionState`:
```typescript
'use client'
import { useActionState } from 'react'
import { createUser } from './actions'

export function UserForm() {
  const [state, action, pending] = useActionState(createUser, null)
  return (
    <form action={action}>
      <input name="email" />
      {state?.error && <p>{state.error}</p>}
      <button disabled={pending}>Create</button>
    </form>
  )
}
```

Module-level recommended for: reuse across forms, shared validation, simpler testing.

> **Think**: Inline Server Actions defined inside a Client Component — does this work? What happens to 'use server' directive?
>
> *Answer: Works. 'use server' directive inside function body works regardless of component type. Inline actions in Client Components compile to server-callable RPC endpoints same as module-level. However, they cannot be reused. Prefer module-level for shared mutations.*

### RSC + Streaming

Server Components stream incrementally via Suspense. Each `await` in async component creates a natural streaming boundary:

```typescript
import { Suspense } from 'react'

async function SlowReviews({ productId }: { productId: string }) {
  const reviews = await db.review.findMany({ where: { productId } })
  // This component suspends streaming until reviews fetched
  return <ReviewList reviews={reviews} />
}

async function RelatedProducts({ productId }: { productId: string }) {
  const related = await db.product.findRelated(productId)
  return <RelatedList products={related} />
}

export default function ProductPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <h1>Product Detail</h1>
      <Suspense fallback={<LoadingSkeleton />}>
        <SlowReviews productId={params.id} />
      </Suspense>
      <Suspense fallback={<LoadingSkeleton />}>
        <RelatedProducts productId={params.id} />
      </Suspense>
    </div>
  )
}
```

Key behaviors:
- Each `<Suspense>` boundary streams independently — no blocking
- Client sees HTML immediately, content fills in as promises resolve
- Streaming is default when RSC used with supporting framework (Next.js App Router)
- Does not require configuration — any async component inside Suspense streams

> **Think**: You have a page with three Suspense boundaries wrapping async components. One takes 5s, another takes 100ms, another 50ms. In what order does content arrive?
>
> *Answer: 50ms boundary renders first, then 100ms, then 5s. Each Suspense boundary streams independently. Fast data shows immediately even if slow data in sibling boundary still pending.*

### Testing RSC

Testing Server Components requires environment that supports server primitives:

```typescript
// Unit test for async Server Component — vitest
import { describe, it, expect, vi } from 'vitest'
import { ProductList } from './ProductList'
import { db } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  db: {
    product: {
      findMany: vi.fn(),
    },
  },
}))

describe('ProductList (Server Component)', () => {
  it('renders products from database', async () => {
    vi.mocked(db.product.findMany).mockResolvedValue([
      { id: '1', name: 'Widget', price: 10 },
      { id: '2', name: 'Gadget', price: 20 },
    ])

    const container = await ProductList({ category: 'tools' })
    // Render to string and assert
    const { container: rendered } = render(await container)
    expect(rendered).toHaveTextContent('Widget')
    expect(rendered).toHaveTextContent('Gadget')
  })

  it('handles empty results', async () => {
    vi.mocked(db.product.findMany).mockResolvedValue([])
    const container = await ProductList({ category: 'tools' })
    const { container: rendered } = render(await container)
    expect(rendered).toHaveTextContent('No products found')
  })
})
```

Integration with Client Components: test composition by rendering Server Component output as string, then hydrating with Client boundary in playground/render tests. Use `@testing-library/react` with `renderToString` from `react-dom/server` for Server Components.

> **Think**: Can you test a Server Component that calls 'use server' action directly? What environment setup is needed?
>
> *Answer: Yes, but requires server environment — Node runtime with DB connection. Unit test the async component logic (data fetching + rendering). Test Server Actions separately as regular async functions. Integration tests using e2e (Playwright) verify full server-to-client flow: action submission → revalidation → re-render.*

---

### Why This Matters

Server Components are the most significant React architecture change since hooks. They eliminate entire categories of problems: over-fetching (no REST API calls for initial data), bundle bloat (zero-KB components), data loading waterfalls (parallel awaits), and client-side state for server data. Compositing with Client Components defines every React app's architecture. Get boundaries wrong — bundle explodes. Get serialization wrong — runtime errors. Get composition wrong — infinite re-renders. This module's patterns apply to every feature you build.

---

### Common Questions

**Q: Can I use Server Components without Next.js?**
A: Yes — React 19's RSC is framework-agnostic. But you need a bundler that implements the RSC protocol (Webpack/Rspack with React server plugin, or upcoming Vite support). Next.js App Router is the only production-ready implementation today. Gatsby, Remix adding support.

**Q: Does every component need 'use client' or 'use server'?**
A: No. Default is Server Component — no directive needed. Only add 'use client' when component needs interactivity (hooks, event handlers, browser APIs). Only add 'use server' for Server Actions (functions). Most files stay directive-free.

**Q: What happens if I import a Client Component into a Server Component that uses hooks?**
A: The hooks run client-side — the Server Component just renders the tree. The Client Component's hooks execute after hydration. Safe. But you cannot import Server Components into Client Components (runtime error).

**Q: Can a Server Action update client-side state directly?**
A: No. Server Actions return data, revalidate server cache, or trigger navigation. Client state updates require explicit handling: `useActionState` returns state, or you manually set state after action completes. Server Actions cannot push state updates to client.

**Q: How do I handle authentication in Server Components?**
A: Read session from server-side cookie/header in the component. Do NOT pass auth state from client. Pattern: `getServerSession()` in async Server Component, render conditionally. Auth logic stays server-side, never ships to client.

---

## Examples

### Example 1: Product Page with Optimized Rendering

**Problem**: E-commerce product page loads slowly due to client-side waterfall: fetch product → render → fetch reviews → render → fetch related → render. Total: 2.5s.

**Solution**: Convert to Server Components with parallel data fetching:

```typescript
// app/products/[id]/page.tsx — Server Component (no directive)
import { Suspense } from 'react'
import { db } from '@/lib/db'
import { ProductDetails } from './ProductDetails'
import { ReviewSection } from './ReviewSection'
import { RelatedProducts } from './RelatedProducts'
import { AddToCartButton } from './AddToCartButton' // Client Component

async function ProductData({ id }: { id: string }) {
  const [product, reviews, related] = await Promise.all([
    db.product.findUnique({ where: { id } }),
    db.review.findMany({ where: { productId: id }, orderBy: { date: 'desc' } }),
    db.product.findRelated(id),
  ])
  if (!product) return <NotFound />
  return <ProductDetails product={product} />
}

export default async function Page({ params }: { params: { id: string } }) {
  return (
    <div>
      <Suspense fallback={<ProductSkeleton />}>
        <ProductData id={params.id} />
      </Suspense>
      <Suspense fallback={<ReviewsSkeleton />}>
        <ReviewSection productId={params.id} />
      </Suspense>
      <Suspense fallback={<RelatedSkeleton />}>
        <RelatedProducts productId={params.id} />
      </Suspense>
      <AddToCartButton productId={params.id} />
    </div>
  )
}
```

**Result**: Product detail streams in. Skeleton shows immediately. First content paints in 200ms. Full page renders in 800ms (down from 2.5s). AddToCart button renders immediately since it has no data dependency.

### Example 2: Form with Server Action and Validation

**Problem**: Contact form needs validation, error handling, server-side submission, and redirect on success.

**Solution**: Server Action with Zod validation, Client Component with useActionState:

```typescript
// app/contact/actions.ts
'use server'

import { z } from 'zod'
import { db } from '@/lib/db'

const schema = z.object({
  name: z.string().min(2, 'Name too short'),
  email: z.string().email('Invalid email'),
  message: z.string().min(10, 'Message too short'),
})

export async function submitContact(prevState: unknown, formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }
  await db.contact.create({ data: parsed.data })
  return { success: true }
}
```

```typescript
// app/contact/ContactForm.tsx
'use client'

import { useActionState } from 'react'
import { submitContact } from './actions'

export function ContactForm() {
  const [state, action, pending] = useActionState(submitContact, null)

  if (state?.success) return <p>Thanks! We'll respond within 24h.</p>

  return (
    <form action={action}>
      <input name="name" placeholder="Name" />
      {state?.error?.name && <p className="error">{state.error.name}</p>}
      <input name="email" type="email" placeholder="Email" />
      {state?.error?.email && <p className="error">{state.error.email}</p>}
      <textarea name="message" placeholder="Message" />
      {state?.error?.message && <p className="error">{state.error.message}</p>}
      <button disabled={pending}>{pending ? 'Sending...' : 'Submit'}</button>
    </form>
  )
}
```

**Result**: Client-side pending state without manual loading management. Server-side validation prevents bad data. Action runs on server — no API route needed.

### Example 3: Client Composition with Server Children

**Problem**: Dashboard layout needs sidebar navigation (client state, highlighted active link) wrapping server-fetched content.

**Solution**: Client shell receives Server Component children:

```typescript
// app/dashboard/layout.tsx — Server Component
import { Sidebar } from './Sidebar' // Client Component
import { UserProfile } from './UserProfile' // Server Component

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getServerSession()
  return (
    <div className="dashboard">
      <Sidebar user={user}>
        <UserProfile user={user} />
      </Sidebar>
      <main>{children}</main>
    </div>
  )
}
```

```typescript
// app/dashboard/Sidebar.tsx
'use client'

import { useState } from 'react'

interface SidebarProps {
  user: { name: string; avatar: string }
  children: React.ReactNode
}

export function Sidebar({ user, children }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <aside className={collapsed ? 'collapsed' : ''}>
      <button onClick={() => setCollapsed(!collapsed)}>Toggle</button>
      {children}
      <p>Welcome, {user.name}</p>
    </aside>
  )
}
```

**Result**: Sidebar has client interactivity (toggle collapse). Server-fetched UserProfile embedded as children — no serialization issue. Children prop passes through boundary as opaque tree. Server Component data never touches client bundle.

---

## Key Takeaways
- Server Components run zero JS on client — data fetching moves to server
- 'use client' marks file boundary — all exports become Client Components
- 'use server' marks Server Actions — callable from client, execute on server
- Server Components can wrap Client Components, not vice versa
- Props crossing boundary must be serializable — no functions, no class instances
- Async Server Components use native async/await — no hooks for data fetching
- Each Suspense boundary streams independently — parallel loading
- Server Actions with 'useActionState' replace form handlers, API routes, loading states
- Test async Server Components with mocked DB + renderToString
- Default (no directive) is Server Component — only add directives when needed

## Common Misconception

**"Server Components are the same as SSR (server-side rendering)."**

SSR renders components to HTML on server, ships JS bundle, then hydrates to full interactivity. Every component in SSR runs client-side eventually. Server Components never hydrate — they produce zero JS. SSR still sends component code to browser; Server Components send only rendered output. SSR is a delivery mechanism; Server Components are a component model. They complement each other: SSR can deliver Server Component output as HTML stream, but the Server Component itself never becomes client code. The difference is categorical: SSR is "render on server, hydrate on client"; RSC is "render on server, stay on server."

---

## Feynman Explain
(Explain Server Components vs Client Components to a junior developer who knows React basics but has never heard of RSC. Use an analogy like "restaurant kitchen vs dining table." Explain: what each environment does, where data comes from, what "zero bundle size" means practically, and why directives exist.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain advanced-react-19` — AI probes gaps.*

---

## Reframe
(Pause. Critique: Server Components add complexity — two mental models, serialization rules, framework lock-in. When is the added complexity worth it? When is a single-environment SPA still the better choice? Write your evaluation. Consider: team size, deployment target, interactivity density, SEO needs, build time.)

---

## Drill
Take the quiz. MCQs test directives, composition boundaries, serialization, async patterns, and streaming.

Run: `learn.sh quiz advanced-react-19 08-server-components`

## Quiz: 08-server-components


### What happens when React encounters a 'use client' directive during Server Component rendering?

- [ ] A: It stops server rendering and throws an error

- [✓] B: It inserts a placeholder and the Client Component hydrates from that point downward

- [ ] C: It ships the component as HTML only with no interactivity

- [ ] D: It converts the component to a Server Component silently


**Answer:** B

'use client' marks boundary. Server renders tree until boundary, inserts placeholder. Client bundle hydrates subtree. Component retains all interactivity via client-side hooks.


### Which of these can be passed as a prop from a Server Component to a Client Component?

- [ ] A: A function reference

- [✓] B: A plain object with string values

- [ ] C: A React element created with createElement

- [ ] D: A class instance with methods


**Answer:** B

Only serializable values cross boundary: strings, numbers, booleans, plain objects, arrays, Date, Map, Set, BigInt. Functions, class instances, Symbols, and React elements (except children) cannot serialize.


### Where should the 'use server' directive be placed for a module-level Server Action?

- [ ] A: Above each individual function that needs server execution

- [✓] B: At the top of the file, making all exports Server Actions

- [ ] C: At the top of the calling Client Component

- [ ] D: In a separate configuration file


**Answer:** B

'use server' at file top makes all exports Server Actions. Inline actions use 'use server' as first statement in function body. File-level 'use server' is preferred for reusable actions.


### An async Server Component fetches data from three independent database tables. What is the recommended pattern to minimize response time?

- [ ] A: Use three sequential await statements

- [✓] B: Use Promise.all to fetch in parallel

- [ ] C: Use three separate useEffect calls

- [ ] D: Fetch in a Server Action and return results


**Answer:** B

Promise.all parallelizes independent fetches. Server Component awaits once for all results. Sequential awaits cause waterfall (total = sum). useEffect not available in Server Components. Server Actions for mutations, not data fetching.


### What happens if a Client Component imports and renders a Server Component directly?

- [ ] A: The Server Component renders on server and sends HTML to client

- [ ] B: The Server Component renders on client with full functionality

- [✓] C: React throws a runtime error — Server Component cannot be imported into Client Component

- [ ] D: The import is ignored silently


**Answer:** C

Client Component files ship to browser. Server Component files cannot execute in browser (no server APIs). React throws error. Correct pattern: pass Server Component as children prop to Client Component.


### Which statement about inline Server Actions vs module-level Server Actions is correct?

- [ ] A: Inline actions have lower latency than module-level

- [✓] B: Module-level actions can be reused across multiple forms and components

- [ ] C: Inline actions cannot access the database

- [ ] D: Module-level actions must be async, inline actions can be sync


**Answer:** B

Module-level ('use server' at file level) exports reusable actions importable by any component. Inline actions scoped to one component. Both access server APIs. Both must be async. Latency identical — compile to same RPC mechanism.


### A Server Component page has three Suspense boundaries wrapping async children. One child takes 4s, another 200ms, another 50ms. How does content reach the browser?

- [ ] A: All content arrives after 4s when slowest completes

- [✓] B: 50ms content arrives first, then 200ms, then 4s — each boundary streams independently

- [ ] C: Content arrives in declaration order regardless of speed

- [ ] D: Only the fastest boundary renders; slower ones are discarded


**Answer:** B

Each Suspense boundary streams independently. Fast resolved promises flush immediately. Slow sibling does not block fast ones. Client sees progressive enhancement—skeletons replaced as data arrives.


### What is the correct way to test an async Server Component that queries a database?

- [ ] A: Render the component in a browser test and assert on DOM

- [✓] B: Mock the database module, await the component, and assert on rendered output

- [ ] C: Use only end-to-end tests since Server Components cannot be unit tested

- [ ] D: Test the database query directly and skip component rendering


**Answer:** B

Mock DB module with vitest/jest, call component as async function, use renderToString or Testing Library to assert output. Server Components are deterministic — given same data, produce same output. No browser needed.


### A developer needs a navigation sidebar that tracks active link (client state) wrapping server-fetched user data. What composition pattern should they use?

- [✓] A: Server Component wrapping Client Sidebar, pass user as serialized prop

- [ ] B: Client Sidebar component that imports and renders user Server Component

- [ ] C: Server Component that contains all interactivity inline

- [ ] D: Client Component that fetches user data in a useEffect


**Answer:** A

Correct pattern: Server wrapper page → Server Component fetches user → Client Sidebar receives user as serializable prop. Server content can also be passed as children to Client Component. Option B causes runtime error. Option C impossible (no hooks in Server). Option D regresses to client-side fetch.


### Which statement accurately distinguishes Server Components from traditional SSR?

- [ ] A: Server Components and SSR are the same technology with different names

- [ ] B: SSR components ship zero JS to client; Server Components ship full JS bundle

- [✓] C: Server Components produce zero client JS and never hydrate; SSR renders on server then hydrates fully on client

- [ ] D: SSR is only for initial page load; Server Components work only for client interactions


**Answer:** C

Critical distinction: SSR renders to HTML on server, ships JS bundle, hydrates — every component eventually runs in browser. Server Components never hydrate, never ship code. They produce serialized output consumed by client rendering. They complement SSR but are different architectural models.


---

# Module 9: React 19 Form APIs — useFormStatus, Server Actions in Forms

Est. study time: 2h
Language: en

## Learning Objectives
- Implement useFormStatus to read parent form submission state from child components
- Construct forms with Server Actions using action prop, hidden inputs, and progressive enhancement
- Differentiate useFormStatus from useActionState and select appropriate hook per context
- Orchestrate multi-action forms, file uploads, validation chains, and form reset

---

## Core Content

### useFormStatus: Child Reads Parent Form State

`useFormStatus` lets a child component read the pending state of its nearest parent `<form>`. No prop drilling needed.

```typescript
"use client"

import { useFormStatus } from "react-dom"

function SubmitButton() {
  const { pending, data, method, action } = useFormStatus()
  return (
    <button disabled={pending} type="submit">
      {pending ? "Submitting..." : "Save"}
    </button>
  )
}
```

Return value:
- `pending: boolean` — true while parent form submits
- `data: FormData | null` — form data being submitted (useful for optimistic UI inside child)
- `method: string | null` — form method (get/post)
- `action: string | null` — form action URL

Critical constraint: `useFormStatus` must be called in a component rendered **inside** a `<form>`. It does not work in the same component that renders the `<form>` element — only descendants.

> **Think**: Why does useFormStatus exist at all? Why not pass `pending` as a prop from the parent?
>
> *Answer: Decoupling. A SubmitButton component works in any form across any project without receiving pending state manually. Libraries like UI component kits can ship a generic SubmitButton that reads form state automatically. Without useFormStatus, every form must pass `disabled={pending}` to the button — repetitive and couples button to form logic.*

### Server Actions in Forms: action Prop

React 19 `<form>` accepts an `action` prop — either a URL string or a function (Action):

```typescript
"use client"
import { useActionState } from "react"

interface FormState {
  error?: string
  success?: boolean
}

async function submitFeedback(
  prevState: FormState | null,
  formData: FormData
): Promise<FormState> {
  const message = formData.get("message") as string
  if (message.length < 3) return { error: "Message too short" }
  await new Promise((r) => setTimeout(r, 1000))
  return { success: true }
}

function FeedbackForm() {
  const [state, formAction, pending] = useActionState<FormState | null>(
    submitFeedback,
    null
  )
  return (
    <form action={formAction}>
      <textarea name="message" />
      <SubmitButton />
      {state?.error && <p role="alert">{state.error}</p>}
    </form>
  )
}
```

Progressive enhancement behavior:
- **JS enabled**: React intercepts `submit`, calls action as async function, manages `pending` via `useActionState`, updates DOM with returned state.
- **JS disabled**: `<form action>` defaults to native HTML form submission. The `action` prop resolves to the server endpoint URL. Server handles POST, returns full HTML page.

Server Actions (`"use server"`) auto-create a POST endpoint during build. Without Server Actions, pass a URL string — same progressive enhancement, no server function.

> **Think**: A form uses `action={formAction}` where `formAction` is from `useActionState`. JS fails to load. What happens when user clicks Submit?
>
> *Answer: Form submits natively. The `action` prop value — a function reference — cannot be serialized to HTML. React renders the form with `action="#"` or empty. Native submission may POST to current URL or nothing. Solution: use Server Actions — React replaces the function reference with the server endpoint URL in the compiled output. JS-disabled submission POSTs to the correct server URL.*

### useActionState in Depth

`useActionState` signature: `[state, formAction, isPending] = useActionState(fn, initialState, permalink?)`

State transitions:

```
Mount: initialState → pending=false
Submit → pending=true
  Action succeeds → state = return value, pending=false
  Action throws → error caught by boundary, pending=false  
  Form reset → state = initialState, pending=false
```

`formData` handling:
- Action receives `FormData` object with all named form fields
- Access via `formData.get("name")`, `formData.getAll("tags")`, `formData.entries()`
- Hidden inputs included — use for passing IDs, tokens, metadata

Error state management — two patterns:

```typescript
// Pattern A: Return errors (preferred for validation)
async function actionA(prev: FormResult, fd: FormData): Promise<FormResult> {
  const parsed = schema.safeParse(Object.fromEntries(fd))
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors }
  return await submitToApi(parsed.data)
}

// Pattern B: Throw errors (for unexpected failures)
async function actionB(prev: FormResult, fd: FormData): Promise<FormResult> {
  try {
    return await submitToApi(fd)
  } catch (e) {
    return { error: "Submission failed. Try again." }
  }
}
```

> **Think**: Pattern A returns { errors }. Pattern B returns { error }. What if we need field-level errors AND a general error?
>
> *Answer: Combine them. Return `{ errors: { email: ["Invalid email"] }, formError: "Please fix errors above" }`. The type is application-defined — useActionState does not prescribe shape. Design the state interface to match your UI needs.*

### Hidden Form Inputs for Data Passing

Hidden inputs pass non-user data to Server Actions:

```typescript
function DeleteUserForm({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(deleteUser, {})
  return (
    <form action={action}>
      <input type="hidden" name="userId" value={userId} />
      <button disabled={pending}>Delete Account</button>
    </form>
  )
}
```

Server Action reads hidden input:
```typescript
"use server"
export async function deleteUser(prev: unknown, fd: FormData) {
  const userId = fd.get("userId") as string
  // validate userId belongs to session user! Never trust hidden inputs
  const session = await auth()
  if (session.userId !== userId) throw new Error("Unauthorized")
  await db.delete(users).where(eq(users.id, userId))
  revalidatePath("/users")
}
```

Security warning: hidden inputs are visible in HTML source. Never put sensitive data (auth tokens, passwords, internal IDs) in hidden inputs. Validate authorization server-side regardless of hidden input content.

> **Think**: Hidden input passes `userId`. Could a malicious user modify it before submission? What defense?
>
> *Answer: Yes — DevTools or curl can change `userId`. Always re-verify authorization in the Server Action. Hidden inputs are convenience for legitimate data flow, not security. The Server Action must check session.userId matches the userId in formData.*

### Form Validation: Client-Side + Server-Side

Two-layer validation strategy:

**Client-side** (beforeSubmit via `formAction` wrapper):

```typescript
function validateForm(formData: FormData): Record<string, string[]> | null {
  const name = formData.get("name") as string
  const errors: Record<string, string[]> = {}
  if (!name || name.length < 2) errors.name = ["Name must be at least 2 characters"]
  if (name.length > 100) errors.name = ["Name must be under 100 characters"]
  return Object.keys(errors).length ? errors : null
}

function UserForm() {
  const [state, formAction, pending] = useActionState(submitUser, {})

  function handleSubmit(formData: FormData) {
    const clientErrors = validateForm(formData)
    if (clientErrors) {
      // inject client errors as action state — no server call
      return clientErrors
    }
    return formAction(formData)
  }

  return (
    <form action={handleSubmit}>
      <input name="name" />
      <SubmitButton />
    </form>
  )
}
```

**Server-side** (in the Server Action):

```typescript
"use server"
export async function submitUser(prev: UserResult, fd: FormData): Promise<UserResult> {
  const raw = Object.fromEntries(fd)
  const parsed = userSchema.safeParse(raw)
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }
  // server-only check: duplicate email
  const existing = await db.select().from(users).where(eq(users.email, parsed.data.email)).get()
  if (existing) return { errors: { email: ["Email already registered"] } }
  return await createUser(parsed.data)
}
```

Client-side catches typos instantly. Server-side catches business rule violations. Both return same error shape — UI renders identically.

> **Think**: Client-side validation passes. Server-side fails. User sees error, fixes it, resubmits. Client-side passes again. Server-side succeeds. Where is the inefficiency?
>
> *Answer: No inefficiency — this is correct. Client validation is a UX optimization, not a replacement. Server must always validate because client can be bypassed. The round trip for server validation is inevitable for business rules (duplicate email, credit check). Keep client validation for instant feedback on format rules.*

### File Uploads with Server Actions

FormData handles files natively. Server Action receives `File` objects:

```typescript
"use client"
function AvatarUpload() {
  const [state, action, pending] = useActionState(uploadAvatar, {})

  return (
    <form action={action} encType="multipart/form-data">
      <input type="file" name="avatar" accept="image/*" />
      <SubmitButton />
      <output>{pending ? "Uploading..." : state?.url && <img src={state.url} />}</output>
    </form>
  )
}
```

Server Action:
```typescript
"use server"
import { writeFile } from "fs/promises"
import { join } from "path"

export async function uploadAvatar(
  prev: { url?: string; error?: string } | null,
  fd: FormData
) {
  const file = fd.get("avatar") as File | null
  if (!file) return { error: "No file selected" }
  if (file.size > 5 * 1024 * 1024) return { error: "File too large (max 5MB)" }
  if (!file.type.startsWith("image/")) return { error: "Must be an image" }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const filename = `${Date.now()}-${file.name}`
  await writeFile(join("public/uploads", filename), buffer)

  return { url: `/uploads/${filename}` }
}
```

Important: Server Actions are not optimized for large file uploads (streaming). For files >10MB, use a dedicated upload endpoint with progress tracking. Actions work well for profile images, document attachments under 5MB.

> **Think**: File upload form shows no progress bar. How would you add upload progress with a Server Action?
>
> *Answer: Server Actions do not expose upload progress (they receive the complete FormData). For progress, use XMLHttpRequest with `upload.onprogress` or fetch with `ReadableStream`. Pattern: client-side upload to signed URL with progress, then pass the resulting URL as hidden input to the Server Action for DB recording.*

### Reset Forms After Successful Submission

React 19 auto-resets controlled inputs inside a `<form action={action}>` when the action returns a non-error state. For manual reset:

```typescript
"use client"
import { useRef } from "react"

function ContactForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, action, pending] = useActionState(submitContact, null)

  // Auto-reset on success
  if (state?.success) {
    formRef.current?.reset()
  }

  return (
    <form ref={formRef} action={action}>
      <input name="email" />
      <textarea name="message" />
      <SubmitButton />
      {state?.success && <p>Message sent!</p>}
    </form>
  )
}
```

Auto-reset triggers when:
1. Action returns a defined value (not `null`/`undefined` it received as `prevState`)
2. No error is present in returned state (React cannot distinguish — your app decides)

Custom reset logic for complex forms:
```typescript
const [state, action, pending] = useActionState(submitOrder, {
  items: [] as CartItem[]
})

// If action succeeds with items, reset to empty
if (state.items.length === 0) {
  formRef.current?.reset()
}
```

> **Think**: Auto-reset runs after every successful action return. User submits twice — second submission uses reset form. What if reset happens before second submission completes?
>
> *Answer: `useActionState` is non-interruptible for the same form. While pending=true, submit button is disabled. Second submission cannot happen until first returns. By then, reset has already occurred. No race condition. If button is not disabled, double-submit protection must be custom.*

### Composing Multiple Actions on One Form

Multiple submit buttons with `formAction` attribute:

```typescript
"use client"

interface MultiActionResult {
  action?: string
  error?: string
  success?: boolean
}

function DraftForm({ postId }: { postId: number }) {
  const saveAction = useActionState<MultiActionResult | null>(saveDraft, null)
  const publishAction = useActionState<MultiActionResult | null>(publishPost, null)
  const previewAction = useActionState<MultiActionResult | null>(createPreview, null)

  async function handleSubmit(formData: FormData) {
    const submitter = formData.get("__submitter") as string
    switch (submitter) {
      case "save": return saveAction[1](formData)
      case "publish": return publishAction[1](formData)
      case "preview": return previewAction[1](formData)
      default: return { error: "Unknown action" }
    }
  }

  return (
    <form action={handleSubmit}>
      <input type="text" name="title" />
      <textarea name="content" />
      <input type="hidden" name="postId" value={postId} />
      <SubmitButton name="__submitter" value="save">Save Draft</SubmitButton>
      <button type="submit" name="__submitter" value="publish" formAction={/* server URL */}>
        Publish
      </button>
      <button type="submit" name="__submitter" value="preview" formAction={/* preview URL */}>
        Preview
      </button>
    </form>
  )
}
```

The `formAction` attribute on `<button>` overrides parent `<form action>`. Each button can POST to a different endpoint. Combine with hidden `__submitter` input to distinguish intent in the action handler.

> **Think**: Three buttons, three different formAction URLs. Does progressive enhancement still work when JS is disabled?
>
> *Answer: Yes — `formAction` on buttons is native HTML. Each button POSTs to its specified URL. Server reads the submitted form and knows which button triggered submission. Progressive enhancement works because formaction is an HTML attribute, not a JS behavior. Each Server Action URL maps to a different server handler.*

### Transition-Aware Forms: Showing Pending State

During submission, the form should not freeze. Pending state signals should be visible and responsive:

```typescript
"use client"
import { useTransition } from "react"

function TransitionForm() {
  const [state, action, pending] = useActionState(placeOrder, {})
  const [, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await action(formData)
      // Redirect after action settles — no flash
      startTransition(() => {
        router.push("/orders/confirmation")
      })
    })
  }

  return (
    <form action={handleSubmit}>
      <input name="itemId" />
      <SubmitButton />
      {/* Non-blocking: user can still scroll, click elsewhere */}
      {pending && <progress />}
    </form>
  )
}
```

Why wrap in `startTransition`? Without it, the pending state update and navigation are urgent — React renders both immediately, potentially causing layout shift and jank. With `startTransition`, React prioritizes keeping the UI responsive over completing the transition.

For loading indicators without blocking:

```typescript
function LoadingBar() {
  const { pending } = useFormStatus()
  return pending ? <div className="h-1 bg-blue-500 animate-pulse" /> : null
}
```

Place `<LoadingBar />` inside form — it reads pending from `useFormStatus` without requiring the parent to pass a prop.

> **Think**: `useActionState` returns `isPending`. `useFormStatus` returns `pending`. Same information, different locations. When would you choose useFormStatus over useActionState for pending signals?
>
> *Answer: useFormStatus in deeply nested children (the SubmitButton pattern). useActionState in the form component itself (for disabling all inputs, showing page-level loading, or computing derived state from the action result). They serve different UI layers.*

### useFormStatus vs useActionState: Decision Guide

| Criteria | useFormStatus | useActionState |
|----------|---------------|---------------|
| Call location | Child inside `<form>` | Component rendering `<form>` |
| Reads pending of | Parent `<form>` | Own form action |
| Returns form state | pending, data, method, action | [state, actionFn, pending] |
| Can access action result | No | Yes (state) |
| Can trigger submission | No | Yes (actionFn) |
| Error display | No | Yes (via returned state) |
| Use case | Disabled button, spinner, loading bar | Full form state management |

```typescript
// useFormStatus — leaf component
function SubmitButton() {
  const { pending } = useFormStatus()
  return <button disabled={pending}>{pending ? "Saving..." : "Submit"}</button>
}

// useActionState — form root
function MyForm() {
  const [state, action, pending] = useActionState(submit, null)
  return (
    <form action={action}>
      {/* SubmitButton reads pending from useFormStatus — not from useActionState */}
      <SubmitButton />
      {state?.error && <ErrorBanner message={state.error} />}
    </form>
  )
}
```

Both hooks coexist in the same form tree. `useActionState` manages the async lifecycle. `useFormStatus` propagates the pending signal downward without prop drilling.

> **Think**: A form has 3 submit buttons in different child components. Each button shows pending state when clicked. Do we need 3 useActionState calls?
>
> *Answer: No. One useActionState at form root. Each SubmitButton uses useFormStatus. When any button triggers submission, all child useFormStatus calls see pending=true. All buttons disable simultaneously. Only one action runs at a time — correct behavior for a single form.*

---

## Examples

### Example 1: Profile Editor with Avatar Upload

**Problem**: Edit profile form with text fields + avatar file upload. Show field-level validation errors, manage pending state in submit button, preview avatar after upload.

```typescript
"use client"
import { useActionState, useRef } from "react"
import { useFormStatus } from "react-dom"

interface ProfileResult {
  errors?: Record<string, string[]>
  avatarUrl?: string
  success?: boolean
}

async function updateProfile(
  prev: ProfileResult | null,
  fd: FormData
): Promise<ProfileResult> {
  const name = fd.get("name") as string
  const bio = fd.get("bio") as string
  const avatar = fd.get("avatar") as File | null

  const errors: Record<string, string[]> = {}
  if (!name || name.length < 2) errors.name = ["Name too short"]
  if (bio && bio.length > 500) errors.bio = ["Bio too long"]
  if (avatar && avatar.size > 2 * 1024 * 1024) errors.avatar = ["Max 2MB"]

  if (Object.keys(errors).length) return { errors }

  // Simulate API
  await new Promise(r => setTimeout(r, 1500))
  return { success: true, avatarUrl: avatar ? "/uploads/avatar.jpg" : undefined }
}

function SubmitBtn() {
  const { pending } = useFormStatus()
  return (
    <button disabled={pending}>
      {pending ? "Saving..." : "Save Profile"}
    </button>
  )
}

function ProfileForm() {
  const [state, action, pending] = useActionState<ProfileResult | null>(updateProfile, null)
  const formRef = useRef<HTMLFormElement>(null)

  if (state?.success) formRef.current?.reset()

  return (
    <form ref={formRef} action={action} encType="multipart/form-data">
      <label>Name <input name="name" /></label>
      {state?.errors?.name && <p>{state.errors.name[0]}</p>}

      <label>Bio <textarea name="bio" /></label>
      {state?.errors?.bio && <p>{state.errors.bio[0]}</p>}

      <label>Avatar <input type="file" name="avatar" accept="image/*" /></label>
      {state?.errors?.avatar && <p>{state.errors.avatar[0]}</p>}
      {state?.avatarUrl && <img src={state.avatarUrl} width={100} />}

      <SubmitBtn />
    </form>
  )
}
```

### Example 2: Multi-Step Checkout Form

**Problem**: Checkout with "Save Address", "Apply Coupon", "Place Order" buttons on one form. Each triggers a different action. Shared form state.

```typescript
"use client"
import { useActionState } from "react"

interface CheckoutState {
  savedAddress?: boolean
  couponResult?: { discount: number } | { error: string }
  orderResult?: { orderId: string } | { error: string }
}

async function saveAddress(prev: CheckoutState, fd: FormData): Promise<CheckoutState> {
  const line1 = fd.get("line1") as string
  if (!line1) return { ...prev, savedAddress: false }
  await new Promise(r => setTimeout(r, 500))
  return { ...prev, savedAddress: true }
}

async function applyCoupon(prev: CheckoutState, fd: FormData): Promise<CheckoutState> {
  const code = fd.get("coupon") as string
  if (!code) return { ...prev, couponResult: { error: "Enter coupon code" } }
  if (code !== "SAVE20") return { ...prev, couponResult: { error: "Invalid code" } }
  return { ...prev, couponResult: { discount: 20 } }
}

async function placeOrder(prev: CheckoutState, fd: FormData): Promise<CheckoutState> {
  const itemId = fd.get("itemId") as string
  if (!itemId) return { ...prev, orderResult: { error: "No item" } }
  await new Promise(r => setTimeout(r, 2000))
  return { ...prev, orderResult: { orderId: "ORD-" + Date.now() } }
}

function CheckoutForm() {
  const [state, formAction, pending] = useActionState<CheckoutState>(
    async (prev, fd) => {
      const action = fd.get("__action") as string
      switch (action) {
        case "save-address": return saveAddress(prev, fd)
        case "coupon": return applyCoupon(prev, fd)
        case "order": return placeOrder(prev, fd)
        default: return prev
      }
    },
    {}
  )

  return (
    <form action={formAction}>
      <input name="line1" placeholder="Address line 1" />
      <input name="coupon" placeholder="Coupon code" />
      <input type="hidden" name="itemId" value="item-123" />

      <button type="submit" name="__action" value="save-address" disabled={pending}>
        Save Address
      </button>
      {state.savedAddress && <span>✓ Saved</span>}

      <button type="submit" name="__action" value="coupon" disabled={pending}>
        Apply Coupon
      </button>
      {state.couponResult && "discount" in state.couponResult
        ? <span>{state.couponResult.discount}% off</span>
        : state.couponResult && "error" in state.couponResult
        ? <span>{state.couponResult.error}</span>
        : null}

      <button type="submit" name="__action" value="order" disabled={pending}>
        {pending ? "Processing..." : "Place Order"}
      </button>
      {state.orderResult && "orderId" in state.orderResult
        ? <p>Order placed: {state.orderResult.orderId}</p>
        : state.orderResult && "error" in state.orderResult
        ? <p>{state.orderResult.error}</p>
        : null}
    </form>
  )
}
```

### Example 3: Optimistic Comments with Rollback

**Problem**: Comment form that shows new comment instantly while server processes. Rollback on failure.

```typescript
"use client"
import { useActionState, useOptimistic, useRef } from "react"
import { useFormStatus } from "react-dom"

interface Comment {
  id: string
  text: string
}
interface CommentResult {
  comments: Comment[]
  error?: string
}

async function addComment(prev: CommentResult, fd: FormData): Promise<CommentResult> {
  const text = fd.get("text") as string
  if (!text || text.length < 2) return { ...prev, error: "Comment too short" }
  await new Promise(r => setTimeout(r, 1000))
  return {
    comments: [...prev.comments, { id: `c${Date.now()}`, text }],
    error: undefined
  }
}

function SubmitBtn() {
  const { pending } = useFormStatus()
  return <button disabled={pending}>{pending ? "Posting..." : "Comment"}</button>
}

function CommentSection({ initialComments }: { initialComments: Comment[] }) {
  const [state, action] = useActionState<CommentResult>(
    addComment,
    { comments: initialComments }
  )
  const [optimisticComments, addOptimistic] = useOptimistic(
    state.comments,
    (current, newComment: Comment) => [...current, newComment]
  )
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(formData: FormData) {
    const text = formData.get("text") as string
    addOptimistic({ id: "optimistic", text })
    formRef.current?.reset()
    await action(formData)
  }

  return (
    <div>
      {optimisticComments.map(c => (
        <p key={c.id}>{c.text}{c.id === "optimistic" ? " (sending...)" : ""}</p>
      ))}
      <form ref={formRef} action={handleSubmit}>
        <input name="text" />
        <SubmitBtn />
        {state?.error && <p role="alert">{state.error}</p>}
      </form>
    </div>
  )
}
```

---

## Why This Matters

Forms are the primary user-data touchpoint in most applications. Pre-React 19, form state management was fragmented: useState for loading, useState for errors, try/catch for async, onSubmit for submission, external validation libraries, manual reset logic. Every form had subtle bugs — stale closures in error handlers, forgotten setPending(false), double-submissions on slow networks. React 19's form APIs collapse all of this into two hooks and a form action prop. useFormStatus eliminates the most common prop-drilling pattern (disabled button state). Server Actions remove the fetch call entirely. The result: forms that are correct by default, resilient to network failures, and automatically progressive. Teams adopting React 19 form APIs report 50-70% fewer form-related bugs and 40% less form code.

---

## Common Questions

**Q: Can I use useFormStatus outside a form context?**
A: No. useFormStatus returns `{ pending: false, data: null, method: null, action: null }` if no parent `<form>` exists. It only activates when rendered inside a `<form>` element with a pending submission.

**Q: How do I prevent double-submission on slow networks?**
A: useActionState's `isPending` + useFormStatus's `pending` both return true during submission. Disable the submit button: `<button disabled={pending}>`. For critical payments, add a server-side idempotency key as hidden input — check if key was already processed.

**Q: Can a Server Action redirect to another page after form submission?**
A: Yes. Call `redirect("/path")` at the end of a Server Action. In JS-enabled mode, React handles the client-side redirect. In JS-disabled mode, the server returns a redirect HTTP response. Works both ways.

**Q: What happens if a Server Action throws an error?**
A: The nearest error boundary catches it. Since the error boundary is normally above the form, the form's pending state does not auto-reset — user sees a frozen form. Always wrap form sections in their own error boundary, or catch errors in the action and return them as state.

**Q: Can I use form validation libraries like Zod with Server Actions?**
A: Yes — this is the recommended pattern. Define schema with Zod, validate in the Server Action, return flattened field errors via `safeParse`. Client can optionally use the same schema for instant feedback. Identical validation on both sides.

**Q: Do useActionState and useFormStatus work with React Native?**
A: No. Both hooks are `react-dom` exports. They require a DOM `<form>` element. React Native forms use different primitives. For React Native mutations, use useActionState's underlying principles with plain async functions.

---

## Key Takeaways
- `useFormStatus` reads parent form state from any child — eliminates prop drilling for submit buttons
- `useFormStatus` returns `{ pending, data, method, action }` — not the action result (useActionState for that)
- Server Actions auto-create POST endpoints — JS-disabled submission works natively
- `useActionState` consolidates pending/error/success into one hook with defined lifecycle
- Hidden inputs pass non-user data to Server Actions — never trust them for security
- Two-layer validation: client catches format errors instantly, server enforces business rules
- File uploads via Server Actions work for files under ~5MB — larger files need streaming endpoints
- Form auto-resets on successful action return — custom reset logic via ref for complex state
- Multiple submit buttons with `formAction` or `__action` discriminator enable multi-action forms
- Wrap action calls in `startTransition` for non-blocking navigation after submission
- useFormStatus for child components (spinner, button), useActionState for form root (state, error display)
- Error boundaries protect against unexpected action failures — always wrap forms

## Common Misconception

**"useActionState replaces useState for all form state."**

useActionState handles server-interaction state (pending, submission result, errors). It does not replace useState for client-only form state: selected tab inside a form, unsaved-changes tracking, input focus management, inline editing toggles. Keep useState for local UI concerns, useActionState for mutation lifecycle. They coexist — a form can have 3 useState calls for UI state and 1 useActionState for submission state.

---

## Feynman Explain
(Explain useFormStatus to a junior developer who understands props but not hooks deeply. Use an analogy: the form is a busy kitchen, useFormStatus is a window in the kitchen door that lets the waitstaff see if the chef is still cooking without opening the door.)

---

## Reframe
(Pause. Critique: useFormStatus couples child components to a parent form element. Is this better or worse than passing pending as a prop? Consider testability, component reusability, and library component distribution. When would you avoid useFormStatus and pass pending explicitly?)

---

## Drill
Take the quiz. MCQs test useFormStatus behavior, multi-action composition, validation layers, and hook selection.

Run: `learn.sh quiz advanced-react-19 09-form-apis`

## Quiz: 09-form-apis


### A SubmitButton component uses useFormStatus. Where must it be rendered for pending to reflect the form's submission state?

- [ ] A: Anywhere in the React component tree

- [✓] B: Inside a &lt;form&gt; element with a pending submission

- [ ] C: Inside the same component that calls useActionState

- [ ] D: Only inside a Server Component


**Answer:** B

useFormStatus reads the nearest parent &lt;form&gt;'s pending state. Outside a &lt;form&gt;, it returns default values (pending: false, data: null). It does not need to be in the same component as useActionState — only inside the same &lt;form&gt; element.


### useFormStatus returns pending, data, method, action. Which of these is NOT accessible via useActionState?

- [ ] A: pending/isPending

- [✓] B: data (the FormData being submitted)

- [ ] C: the action return value (state)

- [ ] D: a function to trigger submission


**Answer:** B

useFormStatus exposes data (the FormData object of the current submission). useActionState does not provide this — it gives you [state, actionFn, pending]. Use useFormStatus if your child component needs to read the form data mid-submission for optimistic preview.


### A Server Action receives form data from a hidden input. What security concern applies?

- [ ] A: Hidden inputs are not included in FormData

- [ ] B: Server Actions cannot read hidden inputs

- [✓] C: Hidden inputs are visible in HTML source and can be modified by the client

- [ ] D: Hidden inputs require the 'use server' directive on the input element


**Answer:** C

Hidden inputs are visible in DevTools and can be changed via curl/DevTools. Never put sensitive data (auth tokens, secrets) in hidden inputs. Always validate authorization server-side — the Server Action must verify the session user matches the submitted data.


### A form needs 3 submit buttons: Save Draft, Publish, Preview. Each triggers a different Server Action. Which approach works correctly?

- [ ] A: Use a single useActionState with multiple submit buttons, all pointing to the same action

- [ ] B: Use 3 separate useActionState hooks, each bound to a different button via formAction

- [✓] C: Use 1 useActionState with a discriminator hidden input and a single action that dispatches

- [ ] D: Server Actions cannot be used with multiple submit buttons


**Answer:** C

Use one useActionState at form root. Each button sets a discriminator (name="__action" with different value). The action function reads the discriminator from FormData and delegates. Multiple useActionState hooks on one form create conflicting state. The formAction attribute on buttons works but for different URLs — for different actions on same server, dispatcher pattern is cleanest.


### A form submits via Server Action. JS is disabled in the browser. What happens when the user clicks Submit?

- [ ] A: Nothing — form submission requires JavaScript

- [✓] B: Form submits natively to the Server Action's POST endpoint; server returns HTML

- [ ] C: React throws an error about missing JavaScript

- [ ] D: Server Action falls back to client-side execution


**Answer:** B

Server Actions create a POST endpoint at build time. When JS is disabled, the &lt;form action&gt; resolves to that URL. Native HTML submission sends form data via POST. Server processes the action and returns full HTML (or redirects). Progressive enhancement works because the action prop compiles to a URL string.


### A file upload Server Action accepts a 10MB image. What issue is most likely?

- [ ] A: FormData cannot encode binary files

- [ ] B: Server Actions do not support encType="multipart/form-data"

- [✓] C: Server Actions receive the complete FormData in memory — large files may cause memory pressure

- [ ] D: Files must be converted to base64 before Server Actions can process them


**Answer:** C

Server Actions receive the full FormData as a single payload. For files &gt;5-10MB, this causes memory pressure on the server and no upload progress tracking. Use dedicated upload endpoints with streaming for large files. Server Actions work well for profile images and document attachments under ~5MB.


### A form uses useActionState. After successful submission, the form inputs auto-reset. When does the reset NOT happen?

- [✓] A: When the action returns null

- [ ] B: When the action returns a truthy value

- [ ] C: When the action throws an error

- [ ] D: When the action returns undefined


**Answer:** A

React auto-resets controlled inputs inside &lt;form action={action}&gt; when the action returns a defined value that differs from initialState. Returning null means 'no update' — React does not reset. Thrown errors are caught by error boundaries and do not trigger reset. For explicit control, use formRef.current.reset() in a useEffect watching state.


### Which scenario is useFormStatus the appropriate hook over useActionState?

- [ ] A: Managing the full form lifecycle including error display

- [✓] B: Disabling a deep child submit button during form submission

- [ ] C: Triggering form submission programmatically

- [ ] D: Reading the Server Action's return value in the parent component


**Answer:** B

useFormStatus is for child components that need to read parent form state without prop drilling (disabling button, showing spinner). useActionState is for the form root: managing submission, reading return values, displaying errors. They are complementary — useActionState at root, useFormStatus in children.


### A form validates client-side with inline checks and server-side with Zod in a Server Action. Client passes, server fails with 'Email already exists'. User sees error, fixes email, resubmits. Client passes, server succeeds. How should the error be returned?

- [ ] A: Server Action throws an error — let error boundary handle it

- [✓] B: Server Action returns { errors: { email: ['Email already exists'] } } — same shape as client errors

- [ ] C: Server Action redirects to a different page showing the error

- [ ] D: Server Action modifies the FormData and re-runs client validation


**Answer:** B

Both validation layers should return the same error shape. Server Action returns expected validation errors as return values, not thrown exceptions. Throw only for unexpected failures (DB crash, network error). Same error shape means the UI renders errors identically regardless of which layer caught them.


### A user submits a form wrapped in startTransition. What is the benefit over submitting without startTransition?

- [ ] A: The form data is compressed before sending

- [✓] B: React prioritizes keeping the UI responsive — navigation and state updates are non-urgent

- [ ] C: The Server Action runs on the client instead of the server

- [ ] D: Multiple form submissions are queued and deduplicated


**Answer:** B

startTransition marks the action and subsequent state updates as non-urgent. React can interrupt them for urgent user input (typing, scrolling). Without startTransition, the pending state update and router navigation are urgent — they block the main thread. startTransition prevents jank and layout shift during form submission.


---

# Module 10: React DOM Static APIs — prerender, renderToStaticNodeStream

Est. study time: 1.5h
Language: en

## Learning Objectives
- Distinguish static generation APIs (`prerender`, `renderToStaticMarkup`, `renderToStaticNodeStream`) from SSR APIs (`renderToString`, `renderToNodeStream`)
- Implement `prerender` for async static HTML generation with Suspense
- Select appropriate rendering strategy per page profile (static vs streaming SSR vs CSR)
- Prevent hydration mismatch by eliminating client JS on fully static pages

---

## Core Content

### Static Generation vs SSR vs CSR — The Rendering Spectrum

React 19 offers three rendering strategies. Static generation lives at one extreme — zero client JS, pre-built HTML at build time.

| Strategy | HTML produced | Client JS | Hydration | Data freshness | Use case |
|----------|--------------|-----------|-----------|----------------|----------|
| **Static generation** | Build-time, per URL | None | None | Stale until rebuild | Blog, docs, marketing |
| **Streaming SSR** | Request-time, per URL | Full bundle | Yes | Fresh each request | E-commerce, dashboards |
| **CSR** | Client-side | Full bundle | First render | Fresh each request | Apps behind auth walls |

React 19 adds `prerender` — an async static generation API. Before React 19, static generation was framework-specific (Next.js `getStaticProps` + `renderToStaticMarkup`). Now React owns the primitive.

> **Think**: A marketing site has 5 pages updated weekly. A dashboard shows real-time stock prices. Which rendering strategy does each need?
>
> *Answer: Marketing site → static generation (rebuild weekly, zero client JS, fastest load). Dashboard → streaming SSR (fresh data per request, needs hydration for interactivity).*

### renderToStaticMarkup vs renderToString — Old Static APIs

Pre-React 19, two synchronous APIs served different purposes:

**`renderToString(element)`** — Produces HTML with React-generated markup (`data-reactroot`, data attributes). This HTML is designed for hydration — React can attach event handlers to the server-generated DOM.

**`renderToStaticMarkup(element)`** — Produces clean HTML without React internals. No `data-reactroot`. Not hydratable. Lighter output (~5-10% smaller) but cannot be hydrated.

```typescript
import { renderToString, renderToStaticMarkup } from 'react-dom/server'

const app = <App />

// Hydratable — includes React internal markers
const hydratableHtml = renderToString(app)

// Clean — no React markers, not hydratable
const staticHtml = renderToStaticMarkup(app)
```

Key rule: `renderToStaticMarkup` for fully static pages. `renderToString` for SSR pages that need hydration.

> **Think**: You generate a `/terms-of-service` page. Content never changes, no user interaction. Which API? Why?
>
> *Answer: renderToStaticMarkup. No hydration needed. HTML is smaller, no React runtime needed on page. The page has no interactivity — React's data attributes are dead weight.*

### prerender() — New Async Static Generation (React 19)

`prerender` is the React 19 replacement for `renderToStaticMarkup` in static generation workflows. It supports Suspense — something neither `renderToStaticMarkup` nor `renderToString` can handle.

```typescript
import { prerender } from 'react-dom/static'

async function generatePage() {
  const { html } = await prerender(
    <App />,
    {
      // Optional: custom shell for Suspense fallback
      onError(err) { console.error(err) }
    }
  )
  return html
}
```

Why async matters:
- Suspense boundaries **wait** for their content instead of triggering fallbacks
- Data fetching inside Suspense resolves before final HTML emitted
- Each URL gets fully resolved HTML — no placeholder markup in output

Before React 19, frameworks hacked around this with `renderToString` + manual data loading. `prerender` makes Suspense-aware static generation a first-class React API.

> **Think**: Your blog has a `<ProfileCard>` that fetches user data inside a Suspense boundary. What happens with renderToStaticMarkup vs prerender?
>
> *Answer: renderToStaticMarkup sees the Suspense fallback — it renders the loading spinner HTML. prerender waits for the ProfileCard data, then emits the full card HTML. prerender produces correct final HTML; renderToStaticMarkup produces an incomplete page.*

### renderToStaticNodeStream vs renderToNodeStream

Streaming APIs pair with static generation for large pages:

**`renderToNodeStream`** — Streaming SSR. Emits HTML in chunks as it renders. HTML includes React data attributes — designed for hydration. Suspense boundaries are streamed as they resolve.

**`renderToStaticNodeStream`** — Streaming static generation. Same chunked output but without React internals. Clean HTML, not hydratable. Best for piping static HTML to a file or CDN upload stream.

```typescript
import { renderToStaticNodeStream } from 'react-dom/server.node'
import { createWriteStream } from 'fs'

const stream = renderToStaticNodeStream(<Page />)
stream.pipe(createWriteStream('./dist/page.html'))
```

Use case: Generate hundreds of static pages. Streaming avoids buffering the entire page in memory. Each page chunks through memory-efficiently.

> **Think**: You're building a static site generator for 10,000 docs pages. Each page is ~50KB HTML. How does renderToStaticNodeStream help vs renderToStaticMarkup?
>
> *Answer: renderToStaticMarkup loads entire page into memory before writing. 10,000 × 50KB = 500MB peak memory per generation pass. renderToStaticNodeStream streams each page through 4KB chunks — memory stays flat regardless of page count.*

### When to Use Each Strategy

Decision tree for every route:

```
Is page behind auth?
  ├─ Yes → CSR (useEffect fetch) or streaming SSR if SEO needed
  └─ No → Can content be pre-built?
       ├─ Yes → Does content change per request?
       │    ├─ No → **Static generation** — prerender
       │    └─ Yes → Can stale content be tolerated?
       │         ├─ Yes → Static generation + ISR rebuild
       │         └─ No → **Streaming SSR**
       └─ No → Does page need fast first paint?
            ├─ Yes → **Streaming SSR**
            └─ No → CSR (spa mode)
```

In React 19, this decision is per-component, not per-page. A page shell can be static streamed while a live sidebar uses client-side data fetching.

> **Think**: A pricing page has static content (headline, tiers) and a live chat widget. How do you render each part?
>
> *Answer: Static shell via prerender. Live chat widget client-side loaded after hydration — or better, use streaming SSR for the page and let the chat load as a client component with useEffect. Mixed strategies per component.*

### Static Generation with Suspense Boundaries

`prerender` handles Suspense differently from SSR:

**SSR (renderToPipeableStream)**: Suspense boundaries emit fallback HTML immediately, then stream resolved content. HTML changes over time — progressive enhancement.

**Static generation (prerender)**: Suspense boundaries wait. The entire Suspense tree resolves before HTML emits. HTML is final — no streaming, no progressive loading.

```typescript
function Page() {
  return (
    <div>
      <h1>Documentation</h1>
      <Suspense fallback={<Loading />}>
        <TableOfContents />  {/* fetches data */}
      </Suspense>
      <Suspense fallback={<Loading />}>
        <ArticleContent />   {/* fetches data */}
      </Suspense>
    </div>
  )
}

// prerender waits for BOTH Suspense boundaries to resolve
// Output: complete HTML with TOC and ArticleContent rendered
// No Loading spinner ever appears in final HTML
```

This changes how you build components for static sites. You don't need Suspense boundaries for progressive loading — you use them to contain data-fetching regions that the prerender engine should resolve.

> **Think**: If prerender waits for all Suspense boundaries, what purpose do fallback props serve in static generation?
>
> *Answer: Fallback content appears only during development (fast refresh) or if a Suspense boundary's data fetch fails/times out. In successful static generation, fallbacks never render. Use minimal fallbacks for error/loading resilience, not for UX.*

### Data Fetching in Static Generation

`prerender` works with cached, pre-resolved data. This is the key architectural difference from SSR:

**SSR data flow**: Request → fetch data → render → stream HTML. Fresh data per request.

**Static generation data flow**: Build → fetch + cache all data → prerender all URLs → write HTML files. Zero per-request data fetching.

```typescript
// Build-time script
import { prerender } from 'react-dom/static'
import { getCachedDoc, getAllSlugs } from './data-fetcher'
import { DocPage } from './components'

async function build() {
  const slugs = await getAllSlugs()

  for (const slug of slugs) {
    const data = await getCachedDoc(slug)  // pre-fetched, cached

    const { html } = await prerender(
      <DocPage slug={slug} data={data} />  // data injected as props
    )

    await writeFile(`dist/docs/${slug}.html`, html)
  }
}
```

Data must be resolvable without async I/O during render. Fetch before render, pass as props.

> **Think**: You prerender a docs site. A component calls fetch() inside render. What happens during prerender? What about during SSR?
>
> *Answer: prerender fails — there is no server runtime for fetch during prerender. Data must be pre-fetched and passed as props. SSR handles fetch() via Suspense + streaming — the fetch resolves and HTML streams in. Static generation forces a different data architecture: fetch-then-render, not render-and-fetch.*

### Eliminating Client JS — Fully Static Pages

Static generation's superpower: zero JavaScript shipped to the browser.

```html
<!-- prerender output — no React, no hydration, no JS -->
<!DOCTYPE html>
<html>
<body>
  <h1>Privacy Policy</h1>
  <p>Last updated: 2024-06-01</p>
  <p>We do not sell your data.</p>
</body>
</html>
```

Compare to SSR output:
```html
<!-- renderToString output — needs hydration -->
<div id="root" data-reactroot="">
  <h1>Privacy Policy</h1>
  <!-- ... same content but with React markers -->
</div>
<script src="react-bundle.js"></script>
<script>hydrateRoot(document.getElementById('root'))</script>
```

Static generation eliminates:
- React runtime bundle (~130KB min+gzip for react-dom)
- Hydration time (blocking main thread)
- Hydration mismatch bugs
- JS parsing/execution cost

For content sites, this is decisive. Each page load saves the cost of downloading, parsing, and executing React — before showing any content.

> **Think**: A blog post page has zero interactivity but you build it with Next.js SSR. What cost does the user pay?
>
> *Answer: User pays for React runtime download (~130KB gzip), parse/execute time, and hydration — all for a page with no interactive elements. Static generation eliminates all three. The page loads HTML-only and is interactive immediately (though there is nothing to interact with).*

### Using prerender with SSG Frameworks

Next.js static export (`next export`) and custom SSG frameworks use `prerender` under the hood in React 19.

Framework integration pattern:
```typescript
// Framework-level SSG engine
async function staticGenerate(routes: Route[]) {
  const results = []

  for (const route of routes) {
    const { html, headers } = await prerender(
      <FrameworkRoot route={route}>
        <Layout><Page {...route.props} /></Layout>
      </FrameworkRoot>
    )

    results.push({
      url: route.path,
      html,
      contentType: 'text/html; charset=utf-8',
    })
  }

  return results
}
```

`prerender` returns an object with `html` (string) and optional metadata. Frameworks wrap this with route resolution, data fetching, and output file writing.

> **Think**: You're building a custom SSG. How does prerender's async API affect your build pipeline vs synchronous renderToStaticMarkup?
>
> *Answer: Async enables concurrent page generation. Instead of serial renderToStaticMarkup calls, you can prerender multiple pages with Promise.all. Build time drops from O(n) serial to O(1) parallel (within concurrency limits). Each prerender call independently fetches resolves Suspense.*

### Performance: prerender vs renderToString

| Metric | renderToString (sync) | prerender (async) | Win |
|--------|----------------------|--------------------|-----|
| Suspense support | No — renders fallback | Yes — resolves content | prerender |
| Time-to-first-byte | Immediate (sync) | Async (waits Suspense) | renderToString |
| Final HTML correctness | Missing Suspense content | Complete | prerender |
| Memory per page | Stacks before emit | Await-based, lower peak | prerender |
| Parallel generation | Serial only | Concurrent with Promise.all | prerender |
| Bundle size overhead | None | None (same runtime) | tie |

Where `renderToString` wins: simple pages with no Suspense. The sync call is simpler and has no async overhead.

Where `prerender` wins: pages with any Suspense boundaries, multiple data sources, or parallel generation needs.

```typescript
// Benchmark: 1000 pages with Suspense data fetching
// renderToString: 32.4s (serial, fallback HTML, incorrect output)
// prerender:      4.1s  (parallel, correct output)
```

8x faster for correct output — but only because prerender does the right thing.

> **Think**: Your build generates 5000 product pages, each with a Suspense-wrapped recommendations component. What's the prerender build time likely to be vs renderToString?
>
> *Answer: renderToString produces incorrect HTML (shows loading spinners in final output) so it is not a valid option. prerender with Promise.all(allProducts.map(p => prerender(`<Page p={p} />`))) takes ~5-15s depending on data fetch speed. renderToString would be faster but wrong — speed without correctness is worse than slow.*

### Hydration Mismatch Prevention

Static-generated pages have zero hydration — meaning zero hydration mismatches.

This is the strongest argument for static generation. Hydration mismatches are React's most persistent category of bugs:

```typescript
// Common hydration mismatch sources — ALL eliminated by static generation
// 1. Timestamps/Dates
<div>The time is {new Date().toISOString()}</div>
// Server says 12:00. Client says 12:01. Mismatch.

// 2. Browser-only APIs
<div>{typeof window !== 'undefined' ? 'client' : 'server'}</div>
// Server says "server". Client says "client". Mismatch.

// 3. Random values
<div>{Math.random()}</div>
// Server and client generate different values.

// 4. Data-dependent renders
<Post>{isSSR ? ssrContent : csrContent}</Post>
// Different content. Mismatch.
```

With static generation: no server runtime, no hydration, no mismatch. What you see in HTML is what the user gets. The React runtime never runs on the client — there is nothing to mismatch.

If a page needs interactivity, isolate it in a client component loaded via dynamic import. The static shell remains mismatch-free.

> **Think**: Your marketing site has a newsletter signup form with client-side validation. How do you keep the static shell zero-JS while adding interactivity?
>
> *Answer: Prerender the static shell (hero, copy, layout). Load the form as a dynamic client component: `const NewsletterForm = dynamic(() => import('./NewsletterForm'), { ssr: false })`. The static HTML shows a placeholder; the client-side React hydrates only the form island. The rest of the page remains static with zero mismatches.*

---

### Why This Matters

Choosing wrong rendering strategy costs real money. Over-engineering with SSR for a marketing site wastes bandwidth, battery, and CPU — every visitor pays the React tax for zero interactivity. Under-engineering with CSR for an e-commerce site destroys SEO and first-paint metrics. React 19's `prerender` finally gives developers a first-class static generation primitive — no framework dependency. Understanding the static API family means you can: (1) eliminate hydration mismatches entirely on content pages, (2) cut JS bundle to zero for marketing sites, (3) build custom SSG pipelines without Next.js or Astro, and (4) choose the right rendering strategy per component, not per page. This is the difference between a fast site and a site that feels fast.

---

### Common Questions

**Q: Is `prerender` a replacement for `renderToStaticMarkup`?**
A: Yes and no. `prerender` replaces `renderToStaticMarkup` for static generation workflows that need Suspense support. For trivial pages with zero Suspense boundaries, `renderToStaticMarkup` is still simpler and synchronous. Use `prerender` if you need Suspense resolution, parallel generation, or async data completion — that is most static sites.

**Q: Can `prerender` output be hydrated?**
A: No. Like `renderToStaticMarkup`, `prerender` omits React internal markers. The HTML is not hydratable. If you need hydration, use `renderToString` or `renderToPipeableStream` for SSR. Static generation and hydration are mutually exclusive for a given page.

**Q: Does `prerender` work with Server Components?**
A: Yes — Server Components resolve during prerender. All data fetching completes before HTML output. This is where `prerender` shines: Server Components + Suspense + static generation produce fully resolved HTML with zero client JS for Server Components.

**Q: When would I use `renderToStaticNodeStream` over `prerender`?**
A: When memory efficiency matters at scale (thousands+ pages) or you need pipe-to-file. `prerender` returns a string — the full HTML must fit in memory. `renderToStaticNodeStream` streams chunk-by-chunk. For most sites (pages < 1MB), `prerender` is simpler. For huge content sets, streaming is necessary.

**Q: Does `prerender` replace Next.js static generation?**
A: The primitive. Next.js uses `prerender` internally for static generation in React 19. You can build custom SSG without Next.js, but you lose routing, ISR, image optimization, and other framework features. The choice is: framework-level vs raw `prerender` for your use case.

---

## Examples

### Example 1: Build a Custom Static Site Generator

**Problem**: You need a documentation site with 200 pages. Each page has a sidebar navigation (fetches from a CMS), markdown content, and a table of contents. No interactivity. No framework.

**Solution**: Use `prerender` with pre-fetched data.

```typescript
import { prerender } from 'react-dom/static'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { parseMarkdown } from './md-utils'
import { DocLayout } from './components/DocLayout'
import { getAllDocs } from './cms'

async function build() {
  const docs = await getAllDocs()
  const sidebar = docs.map(d => ({ slug: d.slug, title: d.title }))

  await mkdir('./dist/docs', { recursive: true })

  for (const doc of docs) {
    const content = await parseMarkdown(doc.body)
    const toc = extractHeadings(doc.body)

    const { html } = await prerender(
      <DocLayout sidebar={sidebar} toc={toc}>
        <article dangerouslySetInnerHTML={{ __html: content }} />
      </DocLayout>
    )

    await writeFile(`./dist/docs/${doc.slug}.html`, html)
    console.log(`✅ ${doc.slug}`)
  }

  // Generate sitemap
  const sitemap = docs.map(d => `  <url><loc>/docs/${d.slug}</loc></url>`).join('\n')
  await writeFile('./dist/sitemap.xml', `<?xml version="1.0"?><urlset xmlns="http://...">\n${sitemap}\n</urlset>`)
}

build().catch(console.error)
```

**Key decisions**:
- Data fetched once, passed as props — no fetch inside components
- Sidebar built once, shared across all pages — parallel reuse
- No hydration, no React bundle in output
- Sitemap generated alongside HTML — single pass

**Result**: 200 page static site. Total build time: 12s. Each page loads in <200ms on first visit with zero JS execution on client.

### Example 2: Hybrid Page — Static Shell + Interactive Island

**Problem**: Marketing page needs fast first paint (static) but includes a live product demo that requires React interactivity.

**Solution**: Prerender static shell, dynamically import interactive island.

```typescript
// Page.tsx — used during prerender
import { lazy, Suspense } from 'react'

const ProductDemo = lazy(() => import('./ProductDemo'))

export function MarketingPage() {
  return (
    <div>
      <header>
        <h1>Our Product</h1>
        <p>Amazing features...</p>
      </header>

      <section className="content">
        <h2>How It Works</h2>
        <p>Step-by-step...</p>
      </section>

      <section className="demo-section">
        <Suspense fallback={<DemoSkeleton />}>
          <ProductDemo />  {/* interactive React component */}
        </Suspense>
      </section>

      <footer>
        <p>© 2024 Company</p>
      </footer>
    </div>
  )
}

// Build script
async function build() {
  // Static generation — ProductDemo Suspense boundary waits for
  // its module resolution. Since it's dynamically imported with
  // ssr: false equivalent, prerender sees the fallback.
  const { html } = await prerender(<MarketingPage />)

  // Write static HTML + load client bundle for ProductDemo separately
  await writeFile('./dist/index.html', html)
  // ProductDemo chunk loaded by browser after page mount
}
```

**Key decisions**:
- Static shell: zero JS, instant paint
- Interactive island: loaded lazily, hydrated independently
- Prerender outputs fallback HTML for the demo section (shown instantly)
- When browser loads the React chunk, the demo hydrates

**Result**: Lighthouse 100 on first paint. Interactive demo loads ~2s later without blocking anything.

### Example 3: Migration from renderToString to prerender

**Problem**: Existing blog uses `renderToString` for static pages. Build takes 45s, pages have loading spinners in HTML output due to data-fetching in components.

**Solution**: Replace `renderToString` with `prerender`, move data fetching to build time.

```typescript
// Before (React 18 style)
import { renderToString } from 'react-dom/server'
const html = renderToString(<BlogPage slug={slug} />)
// Problem: BlogPage has Suspense — renders fallback spinner
// HTML contains "<div class='spinner'>Loading...</div>" in final output

// After (React 19 style)
import { prerender } from 'react-dom/static'

// Move data fetch before render
const postData = await fetchPost(slug)
const relatedPosts = await fetchRelated(slug)

const { html } = await prerender(
  <BlogPage post={postData} related={relatedPosts} />
)
// Output: complete HTML with all content, no spinners
```

**Results**: Build time dropped from 45s to 8s (parallel + less output to buffer). HTML size reduced 12% (no React markers). Pages instantly loadable without JS. Spinner bug eliminated.

---

## Key Takeaways
- `prerender` is React 19's async static generation API — Suspense-aware, produces final HTML
- `renderToStaticMarkup` and `renderToString` are synchronous and do not support Suspense — they render fallbacks as actual content
- `renderToStaticNodeStream` streams clean HTML for memory-efficient bulk generation
- Static generation eliminates React runtime, hydration, and hydration mismatch bugs
- Decision tree: auth wall → CSR/SSR; pre-buildable → static; needs fresh data → SSR; per component, not per page
- Data architecture differs: static = fetch-then-render; SSR = render-while-fetch
- `prerender` enables custom SSG pipelines without framework dependency
- Interactive islands via dynamic import + `ssr: false` preserve static shell benefits
- Build time with `prerender` + concurrency can be 8x faster than serial `renderToString` for Suspense-heavy pages
- Hydration mismatch bugs are impossible on static-generated pages because there is no hydration

## Common Misconception

**"Static generation means the page cannot have any interactivity."**

Wrong. Static generation means the initial HTML is pre-built. Interactivity can be added via client-side JavaScript islands (dynamic imports, micro-frontends, web components). The static HTML loads instantly; interactive elements hydrate lazily. Next.js `next export` + `"use client"` components already prove this pattern. The shell is static; the interactive parts are client-loaded. This gives you the best of both: SEO-friendly, instant-loading HTML with rich interactivity where needed. The React runtime is loaded only for components that genuinely need it.

---

## Feynman Explain
(Explain `prerender` vs `renderToString` to a designer who understands HTML and CSS but has never touched server-side rendering. Use an analogy about cooking. Why would you pre-cook a meal vs cook on demand? What goes wrong if you pre-cook something that needs to be fresh? When is pre-cooking better?)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain` — AI probes gaps.*

---

## Reframe
(Pause. Judge: Is static generation over-engineered for most sites? When does the cost of a build step outweigh the benefit of zero-JS pages? Consider a simple landing page that you could serve as a static HTML file from a CDN with no build step at all. When does `prerender` add value vs just writing HTML by hand or using a simple template engine? Write your evaluation.)

---

## Drill
Take the quiz. MCQs test static API selection, prerender behavior with Suspense, and rendering strategy decisions.

Run: `learn.sh quiz advanced-react-19 10-static-apis`

## Quiz: 10-static-apis


### Which React 19 API is designed for async static HTML generation with Suspense support?

- [ ] A: renderToString

- [ ] B: renderToStaticMarkup

- [✓] C: prerender

- [ ] D: renderToPipeableStream


**Answer:** C

prerender is the React 19 async static generation API. It supports Suspense boundaries, waiting for their content to resolve before emitting final HTML. renderToString and renderToStaticMarkup are synchronous and cannot resolve Suspense content.


### What happens to a Suspense boundary's fallback when using prerender?

- [ ] A: The fallback is streamed progressively, then replaced by resolved content

- [ ] B: The fallback is rendered permanently into the HTML

- [✓] C: prerender waits for the Suspense content to resolve — the fallback never appears in final HTML

- [ ] D: Suspense boundaries throw an error during prerender


**Answer:** C

Unlike SSR streaming APIs that emit fallback HTML first, prerender waits for all Suspense content to resolve before producing final HTML. The fallback is only used if the Suspense data fetch errors or times out.


### A team generates a contact page with zero interactivity. Which API produces the smallest HTML output?

- [ ] A: renderToString

- [✓] B: renderToStaticMarkup

- [ ] C: renderToPipeableStream

- [ ] D: createRoot + hydrateRoot


**Answer:** B

renderToStaticMarkup omits React internal markers (data-reactroot, etc.), producing 5-10% smaller HTML than renderToString. For a fully static page with no hydration, renderToStaticMarkup (or prerender in React 19) is correct.


### Which rendering strategy eliminates hydration mismatch bugs entirely?

- [ ] A: Streaming SSR with renderToPipeableStream

- [✓] B: Static generation with prerender or renderToStaticMarkup

- [ ] C: Client-side rendering with createRoot

- [ ] D: Server-side rendering with renderToString


**Answer:** B

Static generation produces HTML with no React runtime on the client — no hydration step, no mismatch. SSR and CSR both involve React running on the client and reconciling with server output, which can produce hydration mismatches.


### You are generating 10,000 static pages from a content API. Which API minimizes peak memory usage?

- [ ] A: renderToStaticMarkup

- [ ] B: prerender

- [✓] C: renderToStaticNodeStream

- [ ] D: renderToString


**Answer:** C

renderToStaticNodeStream streams HTML in chunks without buffering the full page in memory. renderToStaticMarkup and prerender load the complete HTML string into memory. For large-scale generation (10,000+ pages), streaming avoids OOM and keeps memory flat.


### A page uses prerender. A component inside a Suspense boundary calls fetch() during render. What happens?

- [✓] A: The fetch resolves and prerender waits for the data before emitting HTML

- [ ] B: The fetch is ignored — prerender only renders static content

- [ ] C: The Suspense fallback is rendered as the final output

- [ ] D: prerender throws — fetch inside render is not supported in static generation


**Answer:** A

prerender supports Suspense — it waits for async content (including fetch) inside Suspense boundaries to resolve. This is the key advantage over renderToStaticMarkup. However, best practice is to pre-fetch data before rendering and pass it as props.


### Which scenario requires streaming SSR instead of static generation?

- [ ] A: Marketing site with 5 pages updated weekly

- [ ] B: Blog with content fetched from a CMS at build time

- [✓] C: E-commerce product page with per-request inventory checks

- [ ] D: Documentation site with 5000 pages


**Answer:** C

Per-request data (inventory, pricing, user-specific content) requires SSR — content cannot be pre-built. Marketing sites, blogs, and docs are ideal for static generation because content does not change per request.


### What is the data flow difference between static generation and SSR?

- [✓] A: Static: fetch-then-render. SSR: render-while-fetch.

- [ ] B: Static: render-while-fetch. SSR: fetch-then-render.

- [ ] C: Both use the same data flow

- [ ] D: Static generation does not support data fetching


**Answer:** A

Static generation requires data to be pre-fetched and cached before rendering — fetch-then-render. SSR renders immediately and data streams in as it resolves — render-while-fetch. This is a fundamental architectural difference affecting component design.


### A Next.js team migrates from `getStaticProps` + `renderToString` to React 19's prerender. Which improvement do they see?

- [✓] A: Smaller HTML output and Suspense boundary content resolution

- [ ] B: Automatic page hydration

- [ ] C: Faster client-side navigation

- [ ] D: Smaller bundle because React DOM server is no longer needed


**Answer:** A

prerender produces HTML without React internal markers (smaller output) and resolves Suspense content instead of rendering fallbacks. Hydration, client navigation, and server bundle size are unrelated to this migration.


### How can you add interactivity to a prerendered static page without losing static shell benefits?

- [ ] A: Wrap the entire page in hydrateRoot

- [✓] B: Use dynamic import with ssr: false for interactive components only

- [ ] C: Use renderToString instead of prerender for the full page

- [ ] D: Inject inline scripts that modify the DOM directly


**Answer:** B

Loading interactive components via dynamic imports with ssr: false keeps the static shell JS-free. The static HTML loads instantly; React hydrates only the interactive island. hydrating the full page (A) reintroduces the React runtime cost. renderToString (C) loses static benefits entirely. Inline scripts (D) work but lose React's component model.


---

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
> *Answer: `ForwardedRef<T>` was `RefCallback<T> | RefObject<T> | null` — identical to `React.Ref<T>`. It existed only to signal "this ref came through forwardRef." React 19 removes the distinction: all refs are just refs. Same type, fewer names to learn.*

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

## Quiz: 11-refs-revolution


### Which React 19 change replaces forwardRef?

- [✓] A: ref as regular prop accessible via destructuring

- [ ] B: useRef() must now wrap every component

- [ ] C: createRef() replaces forwardRef

- [ ] D: forwardRef renamed to passRef


**Answer:** A

React 19 makes ref a regular prop. Destructure `ref` from props object. No forwardRef HOC needed.


### What is the recommended command to bulk-migrate forwardRef components?

- [✓] A: npx react-codemod update-ref-as-prop

- [ ] B: npm run migrate-forward-ref

- [ ] C: npx react-upgrade ref-migration

- [ ] D: npx @react/codemod remove-forward-ref


**Answer:** A

The official codemod is `npx react-codemod update-ref-as-prop`. It handles ~90% of forwardRef removals automatically.


### What TypeScript type replaces ForwardedRef&lt;T&gt; in React 19?

- [✓] A: React.Ref&lt;T&gt;

- [ ] B: React.RefObject&lt;T&gt;

- [ ] C: React.RefCallback&lt;T&gt;

- [ ] D: React.ForwardedRef&lt;T&gt; (unchanged)


**Answer:** A

React.Ref&lt;T&gt; replaces ForwardedRef&lt;T&gt;. It is the union of RefCallback&lt;T&gt; | RefObject&lt;T&gt; | null. No distinction between forwarded and direct refs.


### When does a ref callback cleanup function run?

- [✓] A: When ref target changes OR component unmounts

- [ ] B: Every render cycle regardless of ref stability

- [ ] C: Only when component unmounts

- [ ] D: Only when ref target changes


**Answer:** A

Ref cleanup runs when ref target changes (new element, different element, null) or component unmounts. Stable refs during re-renders do not trigger cleanup.


### You need a component that exposes both a DOM ref and sets up a ResizeObserver. Which approach is most idiomatic in React 19?

- [✓] A: Callback ref with observer setup and cleanup return

- [ ] B: useEffect with ref object for observer setup

- [ ] C: Two separate ref props: one for parent, one for observer

- [ ] D: forwardRef + useEffect for observer


**Answer:** A

Callback ref with cleanup return ties observer lifecycle to element lifecycle. A single callback handles parent ref forwarding, observer setup, and cleanup. No useEffect needed.


### What happens when you pass an inline arrow function as ref callback every render?

- [✓] A: React treats it as new ref each render, runs cleanup then re-attaches

- [ ] B: React detects identical behavior and skips re-attachment

- [ ] C: Inline functions are not valid ref callbacks

- [ ] D: React caches the function reference automatically


**Answer:** A

Inline arrow functions create new references every render. React runs previous cleanup function, calls ref(null), then calls ref(element). Use useCallback for stable ref to avoid unnecessary re-attachment cycles.


### Can a Server Component accept and use a ref prop?

- [✓] A: No — Server Components have no DOM and refs are non-serializable

- [ ] B: Yes — refs work identically in Server and Client Components

- [ ] C: Yes — but only callback refs, not ref objects

- [ ] D: No — but refs can be passed through to children via props spread


**Answer:** A

Server Components render to JSON on server. They have no DOM nodes. Refs reference DOM nodes and are non-serializable. Server Components silently ignore ref props.


### A library you depend on still uses forwardRef internally. Does it break in React 19?

- [✓] A: No — forwardRef still works in React 19 with deprecation warning

- [ ] B: Yes — forwardRef was removed in React 19, library must update

- [ ] C: Yes — but only in StrictMode

- [ ] D: No — React 19 automatically converts forwardRef to ref-as-prop


**Answer:** A

forwardRef is deprecated, not removed. It still works with a console warning. Libraries can ship React 18-style components and they function correctly in React 19.


### When should you prefer useCallback for a ref callback over an inline function?

- [✓] A: When ref callback performs side effects beyond setting .current

- [ ] B: Always — inline ref callbacks cause infinite re-renders

- [ ] C: Never — inline ref callbacks are always fine

- [ ] D: Only when the ref targets an SVG element


**Answer:** A

Stable useCallback prevents unnecessary cleanup/re-attach cycles when ref callback has side effects (observers, measurements). Inline functions work but React re-runs them every render.


### Which statement correctly describes useImperativeHandle in React 19?

- [✓] A: Works identically to React 18 — ref comes from props instead of forwardRef second argument

- [ ] B: Removed in React 19 — replaced by direct method calls

- [ ] C: Requires forwardRef wrapper to function

- [ ] D: Now accepts a dependency array as third required argument


**Answer:** A

useImperativeHandle API is unchanged. The only difference is the ref source: React 18 received ref as forwardRef's second argument; React 19 destructures it from props.


---

# Module 12: Context Evolution: use(Context), Provider Patterns, Performance

Est. study time: 2h
Language: en
Framework: TypeScript

## Learning Objectives
- Distinguish `use(Context)` from `useContext` — conditional/early-return context reading
- Design provider composition with value memoization to prevent unnecessary re-renders
- Apply split-context pattern for performance in multi-value scenarios
- Evaluate Context + useReducer vs Zustand/Redux for state management needs

---

## Core Content

### use(Context) — Reading Context in React 19

Before React 19, reading context had one path: `useContext(Context)` at top of component. Violation of Rules of Hooks if inside conditional or early return.

React 19 introduces `use(Context)` — a new API from the `use()` family that reads context in render:

```typescript
import { use } from 'react'
import { ThemeContext } from './theme'

function ThemedButton() {
  const theme = use(ThemeContext)
  return <button className={theme} />
}
```

Key difference: `use(Context)` is NOT a hook. It is a render-time function. Rules of Hooks do not apply.

```typescript
function ThemedButton({ variant }: { variant: string }) {
  if (variant === 'default') {
    const theme = use(ThemeContext)  // OK — inside conditional
    return <button className={theme}>Default</button>
  }

  const locale = use(LocaleContext)  // OK — after early return
  return <button>{locale.label}</button>
}
```

`useContext` still works. `use(Context)` is additive, not replacement. Use `use(Context)` when you need conditional context reading. Use `useContext` when you prefer hook semantics.

> **Think**: You have a ListItem component that only needs theme context when `variant === 'featured'`. Why does `use(Context)` inside a conditional improve performance over `useContext` at the top?
>
> *Answer: Conditional reading means context value is only subscribed when needed. When `variant !== 'featured'`, React does not track this component for ThemeContext updates. Fewer subscription = fewer re-renders when theme changes. This matters in long lists where only items with `variant='featured'` re-render.*

### use(Context) with Suspense — Reading Context in Suspended Components

`use()` works with Promises AND Context. This enables context reading inside components that may suspend:

```typescript
function ProfileCard() {
  const user = use(fetchUser())         // can suspend
  const theme = use(ThemeContext)        // reads context in same render
  return <div className={theme}>{user.name}</div>
}
```

Both `use(fetchUser())` and `use(ThemeContext)` are render-time reads. React tracks both dependencies. If the component suspends, React retries it when the Promise resolves AND re-evaluates context subscription.

This unifies data fetching and context consumption in a single render pass — no need for separate components for context access before suspend.

> **Think**: A component calls `use(fetchUser())` (suspends) and `use(ThemeContext)`. If theme changes while the component is suspended, does it re-render when it resumes?
>
> *Answer: Yes. React tracks both as dependencies. When theme changes, the component is marked dirty. On resume (after Promise resolves), it receives latest context value. No stale context reads after suspension.*

### Provider Patterns: Composition, Nesting, Value Memoization

Context providers re-render all consumers whenever their `value` prop changes identity. Object/array literals in JSX create new reference every render.

**Bad — new object every render:**
```typescript
function App() {
  return (
    <UserContext.Provider value={{ name: 'Alice', role: 'admin' }}>
      <Dashboard />
    </UserContext.Provider>
  )
}
```

**Good — memoized value:**
```typescript
function App() {
  const value = useMemo(() => ({ name: 'Alice', role: 'admin' }), [])
  return (
    <UserContext.Provider value={value}>
      <Dashboard />
    </UserContext.Provider>
  )
}
```

**Best — state in provider, value stable:**
```typescript
function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const value = useMemo(() => ({ user, setUser }), [user])

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  )
}
```

Composition pattern — wrap children, not entire app:
```typescript
function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LocaleProvider>
          {children}
        </LocaleProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
```

> **Think**: A parent component re-renders every 100ms due to animation state. It renders `<ThemeContext.Provider value={theme}>`. Without value memoization, what happens to every consumer?
>
> *Answer: Even if `theme` didn't change, `value={theme}` creates same reference for primitive strings. BUT if value were an object `{ theme }`, every animation frame creates new object → all consumers re-render. Solution: lift provider above animation component, or wrap value in useMemo.*

### Context Performance: Split Contexts

Single context with large object causes all consumers to re-render when any field changes.

**Bad — monolithic context:**
```typescript
interface AppState {
  user: User | null
  theme: 'light' | 'dark'
  notifications: Notification[]
  locale: string
}
// ThemeButton re-renders when notifications change — unnecessary
```

**Good — split contexts by change frequency:**
```typescript
// Stable values — rarely change
const ThemeContext = createContext('light')
const LocaleContext = createContext('en')

// Volatile values — change often
const UserContext = createContext<User | null>(null)
const NotificationContext = createContext<Notification[]>([])
```

Split pattern groups values by co-change frequency. Theme and locale change rarely (user action). Notifications change often (server push). Components subscribe only to what they need.

> **Think**: An analytics dashboard has user info (static), date range filter (changes hourly), and real-time chart data (changes every second). How many contexts should you create?
>
> *Answer: Three contexts — UserContext (almost never changes), DateRangeContext (changes rarely), ChartDataContext (changes constantly). Chart components subscribe only to ChartDataContext. DateRange picker subscribes only to DateRangeContext. Profile section subscribes only to UserContext. No unnecessary re-renders.*

### Context and Server Components

Context is client-only. Server Components cannot read or provide context. Error thrown if Server Component tries `use(Context)` or renders `<Context.Provider>`.

**Pattern: Client boundary for context:**
```typescript
// page.tsx — Server Component
export default function Page() {
  return (
    <ThemeWrapper>  // Client Component boundary
      <MainContent />  // can be Server Component inside
    </ThemeWrapper>
  )
}

// ThemeWrapper.tsx — Client Component ("use client")
'use client'
export function ThemeWrapper({ children }: { children: ReactNode }) {
  const theme = use(ThemeContext)
  return <div className={theme}>{children}</div>
}
```

Server Components pass props down to Client Components that consume context. The split is clean: Server Components own data fetching, Client Components own context consumption.

> **Think**: A Server Component fetches user data. A deeply nested Client Component needs user data. Should you use Context or pass props?
>
> *Answer: Pass props through Server Component tree. Context is client-only — you'd need a Client Component boundary to provide it, losing Server Component benefits. Better: fetch in Server Component, pass data as props to Client leaf. Simpler, no context cost, keeps Server Component tree.*

### Context + useReducer vs Zustand/Redux

Context + useReducer provides local state management without external dependencies:

```typescript
type Action =
  | { type: 'SET_USER'; payload: User }
  | { type: 'LOGOUT' }
  | { type: 'SET_THEME'; payload: 'light' | 'dark' }

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload }
    case 'LOGOUT':
      return { ...state, user: null }
    case 'SET_THEME':
      return { ...state, theme: action.payload }
    default:
      return state
  }
}
```

When Context + useReducer is enough:
- State relevant to subtree, not entire app
- Fewer than ~10 action types
- Single state shape (no derived/selectors)
- Low update frequency (not real-time)

When reach for Zustand/Redux:
- State shared across disconnected subtrees
- Derived state with selectors
- Middleware (persistence, undo/redo, logging)
- Performance-sensitive with many subscribers
- DevTools beyond basic React DevTools

> **Think**: A form wizard spans 5 steps, each with its own state slice. All steps visible in single accordion view. Context + useReducer or Zustand?
>
> *Answer: Context + useReducer is fine. State lives in the wizard's subtree. 5 action types (one per step). No middleware needed. No cross-subtree sharing. Adding Zustand would add dependency for no benefit. Reach for Zustand when state tree grows beyond ~10 action types or slices are consumed by unrelated components.*

### use(Context) for Theme, Locale, Auth Patterns

Three canonical context use cases:

**Theme — constant reference, small value:**
```typescript
const ThemeContext = createContext<Theme>('light')

function ThemeToggle() {
  const theme = use(ThemeContext)
  // No useMemo needed — string is primitive, stable reference
  return <button className={theme}>Toggle</button>
}
```

**Locale — constant reference, read-only:**
```typescript
const LocaleContext = createContext<Locale>(enLocale)

function FormatDate({ date }: { date: Date }) {
  const locale = use(LocaleContext)
  return <span>{new Intl.DateTimeFormat(locale.code).format(date)}</span>
}
```

**Auth — frequent updates, needs split:**
```typescript
// Split by change frequency
const AuthUserContext = createContext<User | null>(null)
const AuthActionsContext = createContext<AuthActions | null>(null)

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const login = useCallback(async (creds: Credentials) => {
    const u = await api.login(creds)
    setUser(u)
  }, [])
  const logout = useCallback(async () => {
    await api.logout()
    setUser(null)
  }, [])

  const actions = useMemo(() => ({ login, logout }), [login, logout])

  return (
    <AuthUserContext.Provider value={user}>
      <AuthActionsContext.Provider value={actions}>
        {children}
      </AuthActionsContext.Provider>
    </AuthUserContext.Provider>
  )
}
```

Split pattern: components that only call `login`/`logout` subscribe to `AuthActionsContext` — stable reference, never re-renders. Components that show user info subscribe to `AuthUserContext` — re-renders only on login/logout.

> **Think**: In the auth split pattern, why does `AuthActionsContext` never cause re-renders even though `login`/`logout` are wrapped in `useCallback`?
>
> *Answer: `useCallback` with empty deps creates stable function reference for entire lifecycle. The provider itself re-renders when `setUser` is called (state update). But `AuthActionsContext.Provider value={actions}` passes same reference — `actions` is `useMemo`'d with `[login, logout]` as deps, which are stable. Result: actions consumers never re-render due to context changes.*

### Nested Providers: Ordering, Value Overrides, Merging

Multiple providers of same context type — innermost wins:

```typescript
function FeatureA() {
  return (
    <ThemeContext.Provider value="dark">
      <Section>Content in dark theme</Section>
    </ThemeContext.Provider>
  )
}

function FeatureB() {
  return (
    <ThemeContext.Provider value="light">
      <Section>Content in light theme</Section>
    </ThemeContext.Provider>
  )
}
```

Provider ordering matters for cross-cutting concerns:
```typescript
function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>          // outermost — no dependencies
      <LocaleProvider>      // depends on auth (user locale pref)
        <ThemeProvider>     // depends on auth (user theme pref)
          {children}
        </ThemeProvider>
      </LocaleProvider>
    </AuthProvider>
  )
}
```

General rule: providers depending on outer providers go inside. Providers with no dependencies go outermost.

Value merging — when multiple providers share state shape:
```typescript
const UserContext = createContext<UserState>({ user: null, setUser: () => {} })

function AdminSection() {
  return (
    <UserContext.Provider value={overrideUserState}>
      <AdminPanel />
    </UserContext.Provider>
  )
}
```

Nesting allows scoped overrides — useful for testing, sub-apps, and feature flags.

> **Think**: You have an app with 10 context providers. What is the performance cost of deep nesting? When should you flatten?
>
> *Answer: Each provider adds ~1 object allocation per render (the value wrapper). For 10 providers, cost is ~10 object allocations per render. Negligible. BUT: if any provider's value changes, all children re-render. Deep nesting increases false-positive re-renders. Flatten providers that don't depend on each other. Pre-compose independent providers into a single component to avoid nesting explosion.*

### Testing Components with Context Providers

Three testing patterns:

**1. Direct provider wrapper — integration tests:**
```typescript
import { render, screen } from '@testing-library/react'

test('renders user name', () => {
  render(
    <UserContext.Provider value={{ name: 'Alice', role: 'admin' }}>
      <UserProfile />
    </UserContext.Provider>
  )
  expect(screen.getByText('Alice')).toBeInTheDocument()
})
```

**2. Custom render utility — DRY wrapper:**
```typescript
interface WrapperProps {
  user?: User
  theme?: Theme
  locale?: Locale
}

function renderWithProviders(
  ui: ReactElement,
  { user = defaultUser, theme = 'light', locale = 'en' }: WrapperProps = {}
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <UserContext.Provider value={user}>
        <ThemeContext.Provider value={theme}>
          <LocaleContext.Provider value={locale}>
            {children}
          </LocaleContext.Provider>
        </ThemeContext.Provider>
      </UserContext.Provider>
    )
  }

  return { ...render(ui, { wrapper: Wrapper }) }
}
```

**3. Test provider for action contexts — verify dispatch:**
```typescript
const mockSetUser = vi.fn()

test('login button calls setUser', () => {
  render(
    <AuthActionsContext.Provider value={{ login: mockSetUser, logout: vi.fn() }}>
      <LoginButton />
    </AuthActionsContext.Provider>
  )

  fireEvent.click(screen.getByText('Login'))
  expect(mockSetUser).toHaveBeenCalledWith({ username: 'alice' })
})
```

> **Think**: Why is testing with a custom render wrapper better than wrapping each test individually?
>
> *Answer: Single source of truth for provider configuration. Adding a new context requires updating one wrapper function, not 50 tests. Reduces boilerplate, ensures consistent defaults, and makes test setup declarative. Pattern similar to `testing-library`'s `render` with `wrapper` option.*

---

### Why This Matters

Context is React's native dependency injection. In React 19, `use(Context)` makes it more flexible — conditional reading, Suspense compatibility. But flexibility without performance discipline creates apps that re-render everything on every state change. Split contexts, memoized values, and proper provider composition are not optional. They are the difference between a 60fps app and one where typing lags because every keystroke re-renders the navigation bar's theme consumer. Context + useReducer can replace Zustand/Redux for 80% of state management needs — but only when applied with the split pattern. Server Components enforce a clean boundary: Server owns data, Client owns context. Understanding context evolution in React 19 means knowing when to use `use()`, when to split, and when context is not the answer.

---

### Common Questions

**Q: Can `use(Context)` be called outside a component?**
A: No. `use()` is render-time only — called inside a component or custom hook's render path. Not in event handlers, effects, or module scope. For event handlers, use `useContext` in render and close over value, or use refs.

**Q: Does `use(Context)` replace `useContext` completely?**
A: No. `useContext` still works and follows hook semantics. `use(Context)` is additive — use it when you need conditional/early-return reading, or when combining with `use(Promise)` in same component. `useContext` is fine for top-of-component reading.

**Q: How many contexts is too many contexts?**
A: No hard limit. Practical signals: if you create contexts for single boolean values that rarely change, you have too many. If you have one context with 20 fields that update independently, you have too few. Split by change frequency and domain boundary. 5-10 contexts per app is typical for medium apps.

**Q: Does context + useReducer replace Redux?**
A: For subtree-local state, yes. For app-global state with many consumers, complex selectors, or middleware needs (persistence, undo), Redux still wins. Context lacks selector memoization — every consumer re-renders on any state change, even if consumed value slice did not change.

**Q: Can Server Components receive context values as props?**
A: Yes, indirectly. Server Components render before Client Components. Client Components read context and pass values as props down to Server Component slots (children). The Server Component never reads context, but renders children that do.

---

## Examples

### Example 1: Refactoring Monolithic Context to Split Pattern

**Problem**: App with single `AppContext` containing user, theme, notifications, and locale. Every component subscribes to everything. Switching theme re-renders notification list.

**Before:**
```typescript
const AppContext = createContext<AppState>({} as AppState)

function App() {
  const [state, dispatch] = useReducer(appReducer, initialState)
  const value = useMemo(() => ({ state, dispatch }), [state])

  return (
    <AppContext.Provider value={value}>
      <Dashboard />
    </AppContext.Provider>
  )
}

// NotificationList re-renders when theme changes — wasteful
```

**After — split by change frequency:**
```typescript
// Stable context (rare changes)
const ThemeContext = createContext<Theme>('light')
const LocaleContext = createContext<Locale>('en')

// Volatile context (frequent changes)
const UserContext = createContext<UserState>({} as UserState)
const NotificationContext = createContext<Notification[]>([])

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [theme, setTheme] = useState<Theme>('light')
  const [locale, setLocale] = useState<Locale>('en')

  return (
    <ThemeContext.Provider value={theme}>
      <LocaleContext.Provider value={locale}>
        <UserContext.Provider value={user}>
          <NotificationContext.Provider value={notifications}>
            <Dashboard />
          </NotificationContext.Provider>
        </UserContext.Provider>
      </LocaleContext.Provider>
    </ThemeContext.Provider>
  )
}

// ThemeToggle only subscribes to ThemeContext
// NotificationBell only subscribes to NotificationContext
// No false-positive re-renders
```

**Result**: 60% fewer re-renders on theme change. Notification list stays mounted without unnecessary work.

### Example 2: use(Context) for Conditional Theme Reading in a List

**Problem**: 500-item list. Each item renders with default style. Only items with `isFeatured=true` need theme-aware styling. Using `useContext` at component top forces all 500 items to subscribe to ThemeContext.

**Solution with use(Context) conditional:**
```typescript
function ListItem({ isFeatured, title }: { isFeatured: boolean; title: string }) {
  // Only subscribe to theme when featured
  const theme = isFeatured ? use(ThemeContext) : 'default'

  return (
    <div className={isFeatured ? `featured-${theme}` : 'item-default'}>
      {title}
    </div>
  )
}

// Only featured items re-render when theme changes
// 495 non-featured items never subscribe — zero re-render cost
```

**Result**: Theme changes re-render 5 items instead of 500. No subscription overhead for majority of components.

### Example 3: Context + useReducer for Feature-Local State

**Problem**: Multi-step checkout wizard. Steps: cart review, shipping, payment, confirmation. Each step has its own state slice. State lives in wizard component subtree.

**Solution:**
```typescript
type WizardAction =
  | { type: 'SET_SHIPPING'; payload: ShippingInfo }
  | { type: 'SET_PAYMENT'; payload: PaymentInfo }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'CONFIRM' }

const WizardContext = createContext<WizardState>({} as WizardState)
const WizardDispatchContext = createContext<React.Dispatch<WizardAction>>(() => {})

function CheckoutWizard() {
  const [state, dispatch] = useReducer(wizardReducer, initialState)
  const stateValue = useMemo(() => state, [state])

  return (
    <WizardDispatchContext.Provider value={dispatch}>
      <WizardContext.Provider value={stateValue}>
        {renderStep(state.currentStep)}
      </WizardContext.Provider>
    </WizardDispatchContext.Provider>
  )
}

// ShippingForm calls use(WizardDispatchContext) — never re-renders from state changes
// ConfirmationPage calls use(WizardContext) — re-renders only when relevant state changes
```

**Result**: Zero external dependencies. State scoped to wizard subtree. Dispatch is stable — action-triggering components never re-render from state changes. Easy to extract to Zustand if wizard becomes cross-app.

---

## Key Takeaways
- `use(Context)` reads context in render — NOT a hook, works in conditionals and early returns
- `use(Context)` works inside Suspended components alongside `use(Promise)`
- Provider value must be memoized — object literals in JSX create new references every render
- Split contexts by change frequency: stable values (theme, locale) separate from volatile values (notifications, real-time data)
- Context + useReducer replaces Zustand/Redux for subtree-local state with <10 action types
- Auth split pattern: user state and user actions in separate contexts — actions never cause re-renders
- Context is client-only — Server Components cannot read or provide context
- Provider nesting order: outer = no dependencies, inner = depends on outer
- Test context components with custom render wrapper — DRY, single source of truth
- use(Context) conditional reading reduces subscription count — only subscribing components re-render

## Common Misconception

**"Context re-renders everything — avoid it."**

This conflates two things: (1) default context behavior (all consumers re-render when value changes), and (2) the fixable cause (unstable references, monolithic objects). With value memoization (`useMemo`) and split contexts (group by change frequency), context causes ZERO unnecessary re-renders. The "context is slow" myth comes from putting unstable object references in provider value and putting everything in one context. Fix the pattern, not the tool. Context + useReducer is the correct default for state management. Reach for Redux when you need selectors, middleware, or cross-app sharing — not because "context is slow."

---

## Feynman Explain
(Explain React's context evolution — from `useContext` to `use(Context)`, split contexts, and provider performance — to a colleague who used `React.createContext` in class components and hasn't touched React since 2018. Make no assumptions about hooks. Use pre-React 16 vocabulary. Show how render-time context reading (`use()`) enables patterns that were impossible with `getChildContext`.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain` — AI probes gaps.*

---

## Reframe
(Pause. Critique: Context + useReducer is recommended as default for subtree state. But it requires manual split-context setup, value memoization, and discipline about what goes where. Does this overhead exceed the cost of adding Zustand? When does the "zero dependencies" benefit of context outweigh the DX of a purpose-built state library? Consider: team size, project lifespan, performance requirements. Write your evaluation.)

---

## Drill
Take the quiz. MCQs test `use()` semantics, split-context patterns, provider performance, and context-vs-store decision.

Run: `learn.sh quiz advanced-react-19 12-context-evolution`

## Quiz: 12-context-evolution


### What makes use(Context) different from useContext in React 19?

- [ ] A: use(Context) is a hook, useContext is a render-time function

- [✓] B: use(Context) can be called inside conditionals and early returns; useContext cannot

- [ ] C: use(Context) only works with Promises, not Context

- [ ] D: use(Context) requires a Provider wrapper, useContext does not


**Answer:** B

use(Context) is a render-time function (not a hook) — Rules of Hooks do not apply. It works inside conditionals, early returns, and Suspended components alongside use(Promise). useContext still works for top-of-component reading.


### A 500-item list renders items. Only items with isFeatured=true need theme context. What is the best approach?

- [ ] A: Use useContext(ThemeContext) at top of every ListItem component

- [✓] B: Use use(ThemeContext) inside a conditional block — only featured items subscribe

- [ ] C: Pass theme as prop from parent to every ListItem

- [ ] D: Create a separate ThemeProvider around each featured item


**Answer:** B

use(Context) inside conditional means only featured items subscribe to ThemeContext. 495 non-featured items never register as consumers — zero re-render cost on theme changes. useContext at top forces all 500 items to subscribe.


### A component calls use(fetchUser()) (suspends) and use(ThemeContext). What happens when theme changes while the component is suspended?

- [ ] A: The component ignores the theme change — it is suspended

- [✓] B: React marks the component dirty and delivers latest context value on resume

- [ ] C: The component re-renders immediately even while suspended

- [ ] D: use() throws an error when used alongside Suspense


**Answer:** B

React tracks both dependencies. If theme changes while suspended, component is marked dirty. On resume (after Promise resolves), it renders with latest context value. No stale context reads.


### Why does the following pattern cause all ThemeContext consumers to re-render on every parent render?

function App() {
  return (
    &lt;ThemeContext.Provider value={{ mode: 'dark' }}&gt;
      &lt;Dashboard /&gt;
    &lt;/ThemeContext.Provider&gt;
  )
}

- [ ] A: Context cannot hold objects — only primitives

- [✓] B: Object literal creates new reference every render, triggering all consumers

- [ ] C: Dashboard component does not use useMemo

- [ ] D: ThemeContext provider must be wrapped in a layout component


**Answer:** B

{{ mode: 'dark' }} creates a new object reference on every App render. React Context re-renders all consumers whenever value reference changes. Fix: wrap value in useMemo(() =&gt; ({ mode: 'dark' }), []) or use a primitive.


### An app has user info (rarely changes), notification count (changes every 30s), and theme (changes once per session). How many contexts should you create?

- [ ] A: One context with all three values — simplest structure

- [✓] B: Three contexts — split by change frequency

- [ ] C: Two contexts: user+theme together, notifications separate

- [ ] D: Context is wrong here — use Zustand instead


**Answer:** B

Split by co-change frequency: UserContext (rare), ThemeContext (very rare), NotificationContext (every 30s). Components subscribe only to what they need. Notification list does not re-render when user logs out and back in.


### In the auth split pattern, why does AuthActionsContext.Provider never cause consumer re-renders?

- [ ] A: Actions are stored in a ref, not state

- [✓] B: login/logout functions are wrapped in useCallback with empty deps — stable references

- [ ] C: AuthActionsContext is created with createContext(null)

- [ ] D: React skips re-render for contexts that only hold functions


**Answer:** B

useCallback with empty deps creates stable function references for component lifecycle. The provider may re-render (from user state update), but value prop reference does not change. Consumers never re-render from context changes — stable ref = no propagation.


### A Server Component needs to access theme context. What happens?

- [ ] A: Server Component renders with default theme value

- [✓] B: Server Component throws an error — context is client-only

- [ ] C: Server Component reads context via a special Server Context API

- [ ] D: React silently returns null for the context value


**Answer:** B

Context is client-only. Server Components cannot read or provide context. Error thrown if Server Component calls use(Context) or renders Context.Provider. Use client boundary wrapper, or pass data as props from Server Component to Client leaf.


### When should you choose Zustand/Redux over Context + useReducer?

- [ ] A: Always — external stores are faster than context

- [✓] B: When state needs complex selectors, middleware, or is shared across disconnected subtrees

- [ ] C: Never — Context + useReducer replaces all state management in React 19

- [ ] D: Only when using TypeScript


**Answer:** B

Context + useReducer is default for subtree-local state with &lt;10 action types. Zustand/Redux when: selectors for derived state, middleware (persistence, undo), state shared across disconnected subtrees, or performance-sensitive with many subscribers.


### A checkout wizard has 5 steps with distinct state slices. State is only used within the wizard subtree. Which approach is most appropriate?

- [ ] A: Create a Redux store with a slice for each step

- [✓] B: Use Context + useReducer with WizardContext and WizardDispatchContext

- [ ] C: Pass all state as props through 5 levels of nesting

- [ ] D: Store step state in localStorage and read on each render


**Answer:** B

State is subtree-local. Context + useReducer: no external dependencies, dispatch is stable (action components never re-render), state scoped to wizard. Redux adds dependency without benefit. Props at 5 levels is prop drilling. localStorage is wrong for runtime state.


### A test needs to render a component that consumes UserContext, ThemeContext, and LocaleContext. What is the recommended testing pattern?

- [ ] A: Mock the context module entirely with jest.mock

- [ ] B: Wrap each test with individual Provider components

- [✓] C: Create a custom renderWithProviders utility that composes all providers

- [ ] D: Skip rendering — test the reducer logic directly


**Answer:** C

Custom render wrapper (using testing-library's wrapper option) provides single source of truth for provider configuration. Adding a new context requires updating one function, not 50 tests. Consistent defaults, reduced boilerplate.


---

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

## Quiz: 13-react-compiler


### What does the React Compiler do at build time?

- [ ] A: Runs components on the server and sends HTML to the client

- [✓] B: Injects useMemo, useCallback, and React.memo calls into components automatically

- [ ] C: Replaces JSX with direct DOM manipulation for faster rendering

- [ ] D: Compiles TypeScript to JavaScript with stricter type checking


**Answer:** B

React Compiler transforms source at build time, injecting memoization calls (useMemo, useCallback, React.memo) into components and hooks. No runtime overhead — output is standard React code with automatic memoization.


### How do you enable the React Compiler for a specific file?

- [ ] A: Add 'use compiler'; at the top of the file

- [✓] B: Add // @reactCompiler at the top of the file

- [ ] C: Set compilationMode: 'all' in build config

- [ ] D: Name the file with .compiler.tsx extension


**Answer:** B

The // @reactCompiler directive at the top of the file opts it into compiler analysis. Files without the directive compile normally. This enables incremental adoption across a codebase.


### A compiler-enabled component stores a computed value in a module-level variable. What happens?

- [ ] A: Compiler memoizes the value and updates the module variable

- [✓] B: Compiler detects the leak and skips memoization

- [ ] C: Compilation fails with an error

- [ ] D: Compiler creates a duplicate value inside the component


**Answer:** B

Compiler detects values that 'leak' outside React's component lifecycle (module scope, singletons). It conservatively skips memoization rather than risk incorrect behavior when a value escapes React's management.


### Which pattern will the React Compiler successfully memoize?

- [ ] A: const value = data[dynamicKey as keyof Data]

- [ ] B: const value = ref.current

- [✓] C: const fullName = `${first} ${last}`

- [ ] D: const config = buildConfig(importedDefaults)


**Answer:** C

Template literal from props/state is a derived value — compiler traces first/last to their sources and memoizes fullName. Dynamic key access, ref.current reads, and cross-module function calls are opaque to compiler analysis.


### Your team enabled the compiler globally. A critical component enters infinite re-render. What is the fastest recovery?

- [ ] A: Revert the entire build to pre-compiler

- [✓] B: Remove // @reactCompiler from that specific file

- [ ] C: Add useMemo around every value in the component

- [ ] D: Increase StrictMode double-invoke threshold


**Answer:** B

Incremental per-file opt-in means per-file rollback. Remove the directive from the broken component, fix its data flow, re-enable. No other files affected.


### A component uses both compiler and manual useMemo. What is the result?

- [ ] A: Compiler ignores the file — manual memoization takes precedence

- [✓] B: Nested memoization — compiler wraps manual useMemo in another memo

- [ ] C: Compiler errors — manual useMemo not allowed with compiler

- [ ] D: Manual useMemo is replaced by compiler's copy


**Answer:** B

Both apply. Compiler wraps values in its own memoization on top of existing useMemo — resulting in nested memo closures. Not incorrect but wastes memory. Remove redundant manual memo after compiler enable.


### A component passes an inline arrow function as prop to a child. With compiler enabled, what changes?

- [ ] A: Nothing — inline functions always create new references

- [✓] B: Compiler wraps the function in useCallback — stable reference when deps unchanged

- [ ] C: Compiler throws an error — inline functions are not allowed

- [ ] D: Compiler moves the function outside the component as a module-level helper


**Answer:** B

Compiler traces the closure's dependencies and wraps it in useCallback. Same behavior as manual useCallback, but automatic and with precise dep tracking.


### A suspended component with compiler enabled resumes after data arrives. What happens to compiler-memoized values?

- [ ] A: Values are preserved from before suspension

- [✓] B: Values are recomputed and re-memoized on resume

- [ ] C: Values are cleared — compiler disabled for suspended components

- [ ] D: Values are null until next render cycle


**Answer:** B

Suspense discards the previous render output. On resume, component runs fresh — compiler recomputes all derived values and creates new memoization cache. No value carryover across suspend boundaries.


### What is the recommended approach for compiler adoption in CI for a large codebase?

- [ ] A: Enable compiler globally on day one, fix errors in production

- [✓] B: Phase 1: warnings only. Phase 2: new files require directive. Phase 3: all files required

- [ ] C: Only run compiler locally — CI should not enforce compiler rules

- [ ] D: Run compiler only on test files, skip production builds


**Answer:** B

Phased approach reduces risk: start with non-blocking warnings (team adapts), require directive on new files (grow adoption), finally require on all files (complete coverage). Each phase validates before escalation.


### A component reads store.getState() directly (not through a hook) and derives a value. Will the compiler memoize the derived value?

- [ ] A: Yes — derivation from any variable is memoized

- [✓] B: No — store.getState() is a cross-module call, compiler skips

- [ ] C: Yes — but only if the store is imported from a module with // @reactCompiler

- [ ] D: No — compiler skips all components that use external stores


**Answer:** B

store.getState() is a direct call on an imported module value. Compiler cannot analyze the store's internal state changes — it treats it as opaque and skips memoization. Using a hook like useStore(selector) gives the compiler a stable memoization signal.


---

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

## Quiz: 14-render-pipeline


### What data structure does React Fiber use to represent the component tree?

- [ ] A: Recursive tree with parent-child relationships only

- [✓] B: Linked list with child, sibling, and return pointers

- [ ] C: Flat array indexed by component ID

- [ ] D: Hash map keyed by component instance


**Answer:** B

Fiber uses linked list with child (first child), sibling (next sibling), and return (parent) pointers. This flattened structure allows pause/resume during traversal — impossible with recursive tree walking that uses the call stack.


### During which phase can React's work loop be interrupted to process a higher-priority update?

- [ ] A: Commit phase

- [✓] B: Render phase

- [ ] C: Effect cleanup phase

- [ ] D: Layout effect phase


**Answer:** B

Render phase is pure computation with no DOM mutations — React can pause, yield to browser, or process urgent updates. Commit phase mutates DOM and runs synchronously — cannot be interrupted.


### A component has the same props (shallow-equal), no state updates, and no context changes. Is it guaranteed to bail out?

- [✓] A: Yes — bailout check evaluates all three conditions

- [ ] B: No — only if also wrapped in React.memo

- [ ] C: No — bailout requires all ancestors to also bail out

- [ ] D: No — bailout never happens for function components


**Answer:** A

Bailout check runs at fiber level before calling component function. If pendingProps and memoizedProps are shallow-equal, no state updates queued, and no context dependency changed, React skips rendering the component entirely. React.memo adds memoizedProps comparison for function components, but the bailout check itself is universal.


### In keyed reconciliation, which operation is cheapest for React?

- [ ] A: Deleting a fiber and recreating it at a new position

- [✓] B: Moving an existing fiber to a new position

- [ ] C: Deleting a fiber at the end of the list

- [ ] D: Creating a new fiber at the beginning of the list


**Answer:** B

Moving a fiber (updating parent's child order) reuses the existing DOM node and component state. This is cheaper than destroy+recreate (A), which tears down effects and DOM. Keyed reconciliation detects moves via key-to-fiber map. Deleting (C) and creating (D) each require separate DOM operations but are cheaper than combined delete+create.


### Where does useLayoutEffect run in the commit phase ordering?

- [ ] A: During render phase, before commit

- [✓] B: After DOM mutations, before paint

- [ ] C: After paint, before passive effects

- [ ] D: After passive effects, during idle callback


**Answer:** B

Commit phase order: detach old refs → DOM mutations → attach new refs → run layout effects (useLayoutEffect) → paint. Passive effects (useEffect) run after paint. Layout effects block paint — use for DOM measurements and synchronous animations.


### What is the primary reason Fiber uses double buffering (current + workInProgress trees)?

- [ ] A: Reduce memory allocation per render

- [ ] B: Enable comparing two snapshots for reconciliation

- [✓] C: Ensure users always see a complete, consistent UI

- [ ] D: Allow parallel processing of sibling fibers


**Answer:** C

Double buffering prevents tearing — user never sees partially rendered UI. Current tree represents committed state. React builds workInProgress tree while user sees current tree. If render is interrupted or discarded, current tree remains unchanged. Only on successful commit does workInProgress become current.


### A React.memo component bails out. How does DevTools Profiler represent it?

- [✓] A: No bar appears — render time is 0

- [ ] B: Grayed-out bar with 0ms render time

- [ ] C: Thin red bar indicating skipped work

- [ ] D: Blue bar with same width as normal render


**Answer:** A

Bailed-out components do not appear in DevTools flamegraph because their component function was never called — render time is 0ms. Only committed components (which actually rendered) appear. If a component appears in flamegraph but has no prop changes, check for context changes or state updates.


### Inside callback ref during commit, setState is called. When does the re-render happen?

- [ ] A: Deferred to next idle callback

- [✓] B: Synchronous re-render within the same commit phase

- [ ] C: Queued for next animation frame

- [ ] D: Scheduled as passive effect after paint


**Answer:** B

setState in callback ref triggers synchronous re-render within commit phase. This is legacy behavior that React 19 preserves for backward compatibility. It causes the parent to potentially see stale state until the next frame. Avoid setState in callback refs — use useLayoutEffect instead.


### List of 100 items re-renders with same stable keys in same order. Parent passes items as inline array literal. What happens?

- [ ] A: React bails out — same keys means nothing changed

- [✓] B: React re-renders all 100 items because array reference is new each render

- [ ] C: React reuses DOM nodes but re-runs component functions

- [ ] D: React skips reconciliation entirely for the list


**Answer:** B

Inline array literal creates new array reference per render. Even with same string contents, shallow prop comparison fails. React re-renders the list component. DOM nodes are reused (same keys, same order → fiber reuse) but the component function re-executes. Fix: useMemo to stabilize array reference or wrap list component with React.memo.


### In workLoopConcurrent, what determines when React yields control back to the browser?

- [ ] A: After processing each complete fiber subtree

- [✓] B: When shouldYield returns true based on elapsed time or pending input

- [ ] C: Only when the entire fiber tree is processed

- [ ] D: After each DOM mutation in commit phase


**Answer:** B

workLoopConcurrent calls shouldYield() between processing units of work. shouldYield checks elapsed time (~5ms threshold) and whether higher-priority work (user input, animation frames) is pending. If yield needed, React suspends workLoopConcurrent and schedules resumption via the Scheduler. This is the mechanism that enables jank-free rendering during heavy computations.


---

# Module 15: Concurrent Rendering — Priorities, Interrupts, Suspense Transitions

Est. study time: 2h
Language: en

## Learning Objectives
- Explain React's interruptible rendering model and lane-based priority system
- Apply `useTransition` and `useDeferredValue` to prevent UI jank from low-priority updates
- Implement Suspense boundaries with transition-aware fallback suppression
- Debug concurrent rendering behavior using DevTools lane indicators and `useSyncExternalStore`

---

## Core Content

### Interruptible Rendering — The Core Mental Model

React 18+ renders are interruptible. Before concurrent mode, a render was a single synchronous transaction:

```
setState → reconcile entire tree → commit → paint
```

If render took 500ms, browser froze 500ms. No input, no animation, no paint.

Concurrent rendering breaks work into fiber units:

```
setState → reconcile fiber A → yield → paint keyboard → reconcile fiber B → yield → ...
```

React schedules fiber work across multiple frames using `requestIdleCallback` and `requestAnimationFrame`. Each time React yields, browser can process input, paint, and service animations.

> **Think**: A search input triggers 200ms render of results list. In sync mode, what happens to keystrokes during those 200ms? In concurrent mode?
>
> *Answer: Sync mode — keystrokes queue but browser cannot process them until render completes. User feels lag. Concurrent mode — React yields between fibers, browser processes keystrokes immediately, renders feel instant even if result rendering is slow.*

Interruptibility depends on priority. React assigns every update a **lane** — a binary flag representing urgency. When a higher-priority update arrives during render, React discards current work and restarts from the higher-priority update.

```
lane 0: SyncLane          (immediate — not interruptible)
lane 1: InputContinuous   (user input — urgent)
lane 2: DefaultLane       (normal transitions)
lane 3: TransitionLane    (useTransition / startTransition)
lane 4: RetryLane         (Suspense retries)
lane 5: IdleLane          (useDeferredValue)
```

> **Think**: Why does React use binary lanes instead of a numeric priority (1-5)?
>
> *Answer: Lanes are bitmasks. React can batch multiple lanes, test intersection (did urgent lane appear during render?), and merge without sorting. A numeric priority cannot represent "current batch contains both urgent AND normal updates." Lanes compose: `batchedLanes = urgentLane | transitionLane`.*

### Lane-Based Priority System

React 19 uses 31 lanes (fits in a 32-bit int). Key lane groups:

| Lane Group | Constant | Batched? | Interruptible? | Typical Source |
|------------|----------|----------|----------------|----------------|
| SyncLane | `SyncLane = 0b0001` | No | No | `flushSync`, `useSyncExternalStore` |
| InputContinuousHydrationLane | `0b0010` | No | No | `onClick`, `onKeyDown` |
| DefaultLane | `0b0100` | Yes | Yes | `setState` outside transition |
| TransitionLanes | `0b1000`–`0xFFFF` | Yes | Yes | `startTransition`, `useTransition` |
| RetryLanes | `0x10000`–`0x40000` | Yes | Yes | Suspense fallback retries |
| OffscreenLane | `0x80000` | Yes | Yes | Hidden offscreen content |
| IdleLane | `0x100000` | Yes | Yes | `useDeferredValue` |

React's scheduler picks highest-priority pending lane. When render starts on a TransitionLane and a SyncLane update arrives, React **throws away the transition work** and restarts.

```typescript
// React internals (simplified):
function ensureRootIsScheduled(root: FiberRoot) {
  const nextLanes = getNextLanes(root, NoLanes)
  const existingLane = root.pendingLanes
  if (existingLane !== NoLanes && laneIsHigherPriority(nextLanes, existingLane)) {
    // Interrupt current render, restart with higher priority
    markRootSuspended(root, existingLane)
    scheduleUpdateOnFiber(root, nextLanes)
  }
}
```

> **Think**: An urgent update arrives 3ms into a transition render. React discards partial work. Is this wasted computation? Is it acceptable?
>
> *Answer: Yes, partial work is discarded. Acceptable because: (1) urgent responsiveness outweighs wasted work, (2) React bails out of unchanged subtrees on restart (tree is same, no waste), (3) typical transition renders are under 50ms — restart cost is negligible vs 16ms frame budget.*

### How React Interrupts a Render — The Throw Mechanism

Concurrent rendering uses a **throw-then-catch** pattern:

1. React begins rendering a lane.
2. Higher-priority update is scheduled.
3. React **throws** a special object (`ReactConcurrentError` / `ThrowIfInfiniteLoop`) from the work loop.
4. The scheduler **catches** the throw, discards pending work, schedules new render.
5. Next render starts with both the new update and any unchanged subtrees from the aborted render.

```typescript
function workLoopConcurrent() {
  while (workInProgress !== null && !shouldYield()) {
    performUnitOfWork(workInProgress)
  }
  if (workInProgress !== null && needsInterrupt()) {
    // Throw to abort current render
    throw new ReactConcurrentError(
      workInProgress,
      getNextLanes(root, NoLanes)
    )
  }
}
```

This is why concurrent rendering cannot use generator functions — generators have explicit yield points. Throw unwinds the entire call stack, guaranteeing no stale state leaks.

> **Think**: Can a concurrent render be interrupted by two updates in succession? What happens to work that was 90% complete?
>
> *Answer: Yes. Each interrupt discards current work and restarts. Work 90% complete is discarded entirely. React relies on bailing out — unchanged fibeers produce same output, only changed parts re-execute. React 19's compiler optimization reduces re-execution cost on restart.*

### useTransition — Priority Lowering API

`useTransition` wraps a state update in a lower-priority lane. React can interrupt this update if an urgent update arrives.

```typescript
import { useTransition, useState } from 'react'

function SearchResults() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [isPending, startTransition] = useTransition()

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value
    setQuery(next)  // urgent — updates input immediately

    startTransition(() => {
      // non-urgent — React can interrupt this
      setResults(filterData(next))
    })
  }

  return (
    <div>
      <input onChange={handleChange} />
      {isPending && <Spinner />}
      <ResultsList items={results} />
    </div>
  )
}
```

Key behavior:
- `isPending`: true while transition render is in progress (even if interrupted)
- `startTransition` callback: all `setState` calls inside enter TransitionLane
- React does NOT show a Suspense fallback during a pending transition — stale UI persists
- If a new urgent update arrives, React abandons current transition, restarts with urgent update, then re-attempts transition

> **Think**: What if `startTransition` wraps a `dispatch` to a global store (Zustand, Redux)? Does the priority lowering work?
>
> *Answer: No. Priority lowering only works for React state. External stores bypass React's scheduler. Wrap external store reads in `useSyncExternalStore`; writes to external stores must be wrapped manually using `startTransition` on the React side that triggers the read.*

### useDeferredValue — Deferring Derived Values

`useDeferredValue` lets you defer updating a value to lower priority. Unlike `useTransition` (which wraps the update), `useDeferredValue` wraps the **value**.

```typescript
import { useDeferredValue, useState, useMemo } from 'react'

function HeavyList({ query }: { query: string }) {
  const deferredQuery = useDeferredValue(query)
  const isStale = query !== deferredQuery

  const list = useMemo(() => {
    return expensiveFilter(allItems, deferredQuery)
  }, [deferredQuery])

  return (
    <div>
      {isStale && <div>Updating...</div>}
      <ul>{list.map(item => <li key={item.id}>{item.name}</li>)}</ul>
    </div>
  )
}
```

How it differs from `useTransition`:

| Dimension | useTransition | useDeferredValue |
|-----------|---------------|------------------|
| What it wraps | State setter call | Derived value |
| Who controls | Component that sets state | Component that reads value |
| When defer activates | Immediately on call | On next render cycle |
| Use case | Form submission, navigation | Large list filtering, search results |
| isPending indicator | `isPending` from hook | Manual comparison (`old !== new`) |

`useDeferredValue` uses `IdleLane`. The deferred value stays at old value until urgent work completes. React may skip re-rendering the deferred subtree entirely if urgent work keeps arriving (e.g., rapid keystrokes).

> **Think**: `useDeferredValue` defers a value. Does `deferredQuery` ever skip updates entirely (never reach new value)?
>
> *Answer: Only if user keeps typing before each deferred render completes. As soon as user pauses, deferred value catches up. React eventually commits deferred value. It is not lost — only delayed until React has idle frames.*

### Suspense + Concurrent: Fallback Suppression During Transitions

In concurrent mode, Suspense boundaries behave differently during transitions:

**Before transition completes**: React does NOT show the Suspense fallback when content suspends inside a transition. Instead, React commits the **previous** UI (stale state). This prevents loading spinner flashes.

**After transition completes**: Normal Suspense behavior — show fallback, trigger retry, show content.

```typescript
function TabSwitcher() {
  const [tab, setTab] = useState('home')
  const [isPending, startTransition] = useTransition()

  function switchTab(next: string) {
    startTransition(() => {
      setTab(next)
    })
  }

  return (
    <div>
      <button onClick={() => switchTab('home')}>Home</button>
      <button onClick={() => switchTab('profile')}>Profile</button>
      <Suspense fallback={<BigSpinner />}>
        {isPending ? <StaleTab /> : <CurrentTab tab={tab} />}
      </Suspense>
    </div>
  )
}
```

Without `useTransition`, switching tabs triggers Suspense fallback (BigSpinner flashes). With `useTransition`, React keeps showing current tab until new tab data arrives. This is **transition-based fallback suppression** — built into React 19's default concurrent mode.

> **Think**: A slow data fetch inside a transition suspends for 5 seconds. No fallback shows. User sees stale UI. Is this good UX?
>
> *Answer: Depends on context. For navigation, stale UI is better than spinner. For dashboards where stale data is misleading (stock prices), add a timeout: if transition takes > 2s, show a subtle "refreshing" indicator. Use `isPending` to render a non-blocking loading hint.*

### Time Slicing — Yielding to Main Thread

React splits rendering into chunks. Each chunk processes one or more fiber units, then checks `shouldYield()`:

```typescript
function shouldYieldToRenderer(): boolean {
  const timeElapsed = performance.now() - startTime
  if (timeElapsed >= YIELD_INTERVAL) {
    // Yield control to browser
    return true
  }
  // Check if urgent input is pending (message channel heartbeat)
  if (hasUrgentInput()) {
    return true
  }
  return false
}
```

Default yield interval: **5ms** (one third of a 16ms frame). This leaves ~11ms for browser paint, layout, and input processing.

React integrates with scheduler via:
- **MessageChannel**: React posts a message to itself to yield. Browser processes pending input between message events.
- **`requestAnimationFrame`** (raf): For animation-bound work.
- **`requestIdleCallback`**: For truly idle work (not all browsers — React polyfills via MessageChannel).

```typescript
// Simplified yield mechanism
function scheduleWork( callback: () => void ) {
  const channel = new MessageChannel()
  channel.port1.onmessage = callback
  channel.port2.postMessage(undefined)
  // Browser processes queued microtasks and events between
  // postMessage and onmessage callback
}
```

> **Think**: Why MessageChannel instead of `setTimeout(fn, 0)`?
>
> *Answer: MessageChannel fires before setTimeout in task priority. setTimeout(0) is throttled to 4ms in nested calls. MessageChannel provides ~0-1ms delay and is not throttled. React needs consistent micro-frame yields.*

### Concurrent Features in React 19 — Default Concurrent Mode

React 19 makes concurrent rendering the **default**. No more `createRoot(container, { concurrent: true })`.

```typescript
// React 18 — explicit
const root = createRoot(container)  // concurrent default in 18
// React 19 — always
const root = createRoot(container)  // concurrent, no opt-in needed
```

React 19 removes legacy `ReactDOM.render`. All roots are concurrent. This changes:
- `componentWillMount` / `componentWillReceiveProps` / `componentWillUpdate` — all deprecated and removed (use `UNSAFE_` prefix stripped too)
- **Automatic batching**: Multiple `setState` calls in event handlers batch into one render
- **Transitions everywhere**: `startTransition` available without import in supported patterns

> **Think**: If concurrent mode is default, can any component call synchronous APIs that break in concurrent mode?
>
> *Answer: Yes. `ReactDOM.flushSync(...)` forces sync render (blocks concurrent interruption). Libraries that read DOM synchronously after setState (e.g., measure layout) will get stale values. Ref callbacks during concurrent renders fire per fiber — not once per commit.*

### Legacy Sync vs Concurrent Rendering

| Behavior | Legacy (React 17) | Concurrent (React 19) |
|----------|-------------------|----------------------|
| Render duration | Blocking — entire tree | Yielding — fiber by fiber |
| State batching | Only in event handlers | Always (automatic) |
| Interruption | Never | On higher-priority update |
| Suspense fallback | Immediate on suspend | Suppressed during transitions |
| `setState` priority | Uniform | Lane-based |
| `useEffect` timing | After paint (async) | After paint (async — same) |
| `useLayoutEffect` | Sync after commit | Sync after commit (same) |
| Ref callbacks | Once per mount | Per fiber during render + commit |

Key migration issue: **Ref callback timing**. In legacy mode, ref callbacks fire once per mount. In concurrent mode, ref callbacks may fire multiple times per mount because React renders and discards fibers during interleaved updates.

```typescript
// Legacy: ref callback fires once
<div ref={(el) => { measure(el) }}>
  {/* measure() called exactly once */}
</div>

// Concurrent: ref callback may fire for discarded fibers
<div ref={(el) => { measure(el) }}>
  {/* measure() may be called with null (cleanup) and el (setup) multiple times */}
  {/* Safeguard: check el !== null before measuring */}
</div>
```

> **Think**: A library calls `getBoundingClientRect` in a ref callback. Does it break under concurrent rendering?
>
> *Answer: Not directly. But ref callback may fire for fibers that are never committed (interrupted render). Measure only when el is final: use `useEffect` + `useRef` pattern instead. Or call measure in `useLayoutEffect` which runs only after commit.*

### useSyncExternalStore — Concurrent-Safe External Store Reads

External stores (Zustand, Redux, RxJS) read state outside React's scheduling. During concurrent rendering, an external store may change between render and commit, causing **tearing** (UI shows inconsistent state from two different store snapshots).

`useSyncExternalStore` guarantees external store reads are consistent across concurrent renders:

```typescript
import { useSyncExternalStore } from 'react'

function subscribe(store: Store) {
  return store.subscribe(() => {
    // Force re-render when store changes
    store.getSnapshot()
  })
}

function useStoreSnapshot(store: Store) {
  return useSyncExternalStore(
    store.subscribe,
    () => store.getSnapshot(),   // getSnapshot — called during render
    () => store.getServerSnapshot()  // optional: for SSR hydration
  )
}
```

If store changes during a concurrent render, React detects the snapshot changed and re-renders synchronously to prevent tearing. If snapshot changes between render and commit, React re-executes the render synchronously.

Without `useSyncExternalStore`, external store reads produce **tearing**:

```
Frame 1: React reads store snapshot A → render starts (snapshot A)
Frame 2: Store updates to snapshot B → React commits (commit expects A)
Frame 3: UI shows mix of A-based and B-based state → TEAR
```

`useSyncExternalStore` prevents this by forcing `getSnapshot` to run synchronously at commit time, ensuring render and commit use same snapshot.

> **Think**: A Zustand store reads `store.getState().count` in a component. Does it cause tearing?
>
> *Answer: Yes, if concurrent rendering interleaves between store write and React render. Zustand 5+ uses `useSyncExternalStore` internally. Zustand 4 and Redux require explicit `useSyncExternalStore` or the official bindings (`react-redux` 8+ already wraps it).*

### Debugging Concurrent Rendering — DevTools Lane Indicators

React DevTools (included with React 19) show lane information for every fiber:

- **Lane badge**: Colored dot next to fiber in Component tree
- **Red**: SyncLane — immediate, blocking
- **Yellow**: InputContinuous — user input
- **Blue**: Default — normal state update
- **Green**: Transition — wrapped in startTransition
- **Gray**: Idle — deferred value

- **"Committed by" trace**: In Profiler tab, each commit shows which lane triggered it
- **"Interrupted" badge**: Fibers that were rendered but not committed (discarded work)

Enable: React DevTools → Settings → Debugging → "Show lane labels"

```typescript
// Programmatic lane check (development only):
import { __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED } from 'react'

function debugLane() {
  if (process.env.NODE_ENV === 'development') {
    const currentLane = 
      __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner.current?.lane
    console.log(`Rendering on lane: ${currentLane}`)
  }
}
```

Common debugging patterns:
- **Transition not working?** Check DevTools lane badge — should show green (TransitionLane), not blue (DefaultLane)
- **Too many re-renders?** Check if updates are landing on SyncLane instead of DefaultLane — unwrap from `flushSync`
- **Suspense fallback flashing?** Confirm `startTransition` wraps the setState that triggers suspense — fallback suppression only works inside transitions

> **Think**: A component shows a blue lane badge but is wrapped in `startTransition`. What went wrong?
>
> *Answer: `startTransition` only affects setState calls executed inside its callback. If a setState outside the callback triggers the re-render, it uses DefaultLane. or `startTransition` may be called but the callback contains an async function — transition ends when callback returns, not when async completes. Use `async` transition: `startTransition(async () => { await submit(); setDone() })`.*

---

### Why This Matters

Concurrent rendering is the most consequential React change since the fiber architecture. Without understanding lanes, `useTransition`, and time slicing, developers write code that works in development but janks in production. External stores tear silently. Suspense boundaries flash spinners unnecessarily. Urgent input lags behind background data sync. React 19 makes concurrent mode default — every app runs this model. Debugging concurrent issues requires lane awareness, not just re-render counting.

---

### Common Questions

**Q: Does concurrent rendering make my app faster?**
A: Not automatically. Concurrent rendering prevents jank by yielding to urgent work. Throughput (total work completed per second) may decrease slightly — React spends time yielding and restarting. The benefit is responsiveness, not raw speed.

**Q: Can two transitions run simultaneously?**
A: No. React processes one lane at a time per root. A new transition interrupts an existing transition. React coalesces multiple transition updates into one batch and renders once.

**Q: Does `useDeferredValue` always defer?**
A: No. If no urgent work is pending when deferred value changes, React commits it immediately. Deferral only activates when concurrent scheduler detects higher-priority pending lanes.

**Q: Do all `setState` calls inside `startTransition` automatically batch?**
A: Yes. All setState calls inside a transition callback coalesce into one render. This is true even for setState outside event handlers (setTimeout, Promise, requestAnimationFrame) — React's automatic batching covers all scopes in React 19.

**Q: Is `flushSync` dangerous in concurrent mode?**
A: It forces sync render, bypassing interruption. Use sparingly: only for third-party integrations that require synchronous DOM measurement. Overusing `flushSync` eliminates concurrency benefits.

---

## Examples

### Example 1: Transition-Based Search with Deferred Filtering

**Problem**: Product listing page with 10,000 items. Each keystroke filters by name + category + price range. Filtering takes 50-200ms. Users complain about janky typing.

**Solution**: Two-layer priority strategy:
- `useTransition`: Mark filter as low priority
- `useDeferredValue`: Defer the derived list rendering

```typescript
function ProductSearch() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [isPending, startTransition] = useTransition()

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)  // urgent — input update
    startTransition(() => {
      setCategory(e.target.value.includes('electronics') ? 'electronics' : 'all')
    })
  }

  return (
    <FilterableList
      query={query}
      category={category}
      isPending={isPending}
    />
  )
}

function FilterableList({ query, category, isPending }: FilterableListProps) {
  const deferredQuery = useDeferredValue(query)
  const isStale = query !== deferredQuery

  const filtered = useMemo(
    () => products.filter(
      p => p.name.includes(deferredQuery)
        && (category === 'all' || p.category === category)
    ),
    [deferredQuery, category]
  )

  return (
    <div style={{ opacity: isStale ? 0.8 : 1 }}>
      {isPending && <div>Refining...</div>}
      <VirtualList items={filtered} itemHeight={40} />
    </div>
  )
}
```

**Result**: Typing remains responsive (60fps). Filtered list updates 50-200ms after keystroke stops. No jank, no spinner flash.

### Example 2: Tab Navigation with Suspense Transitions

**Problem**: Dashboard app with 4 tabs. Each tab fetches heavy data. Switching tabs shows a loading spinner for 1-3 seconds. Users find spinner jarring when switching back and forth.

**Solution**: Wrap tab switch in `useTransition` to suppress Suspense fallback:

```typescript
function DashboardTabs() {
  const [tab, setTab] = useState<'overview' | 'analytics' | 'reports' | 'settings'>('overview')
  const [isPending, startTransition] = useTransition()

  function goToTab(next: typeof tab) {
    startTransition(() => {
      setTab(next)
    })
  }

  return (
    <div>
      <TabBar current={tab} onSwitch={goToTab} />
      <div style={{ opacity: isPending ? 0.85 : 1 }}>
        <Suspense fallback={<Skeleton />}>
          <CurrentTabContent tab={tab} />
        </Suspense>
      </div>
      {isPending && <TransitionIndicator />}
    </div>
  )
}
```

**Result**: Tab switch shows previous tab content immediately. New tab content loads in background. `isPending` drives a subtle "refreshing" indicator instead of full-screen spinner. If data loads fast (<500ms), user sees no loading state at all.

### Example 3: Debugging Lane Mismatch

**Problem**: Developer wraps `setState` in `startTransition` but DevTools shows blue (DefaultLane) badge. Component re-renders on every keystroke with full list computation.

**Root cause**: `startTransition` wraps setState call, but the component also reads `useSyncExternalStore` which forces SyncLane on every store read.

```typescript
// Bug: store read outside transition forces SyncLane
function Search() {
  const user = useUserStore(s => s.user)  // SyncLane — tears to SyncLane always
  const [query, setQuery] = useState('')

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)  // urgent
    startTransition(() => {
      setResults(filter(user, query))  // expected: TransitionLane
      // But: reading `user` from external store inside transition
      // forces render at SyncLane because store hasn't changed
    })
  }
  // ...
}
```

**Fix**: Move store read outside transition or wrap store state in `useDeferredValue`:

```typescript
function Search() {
  const user = useUserStore(s => s.user)
  const deferredUser = useDeferredValue(user)  // IdleLane
  // ...
}
```

**Result**: DevTools shows green (TransitionLane) or gray (IdleLane) badge. Urgent input renders independently of store-driven updates.

---

## Key Takeaways
- Concurrent rendering splits work into fiber units, yielding to browser every ~5ms
- Lanes (bitmasks) assign priority: SyncLane → InputContinuous → Default → Transition → Idle
- When higher-priority update arrives, React throws away current render and restarts
- `useTransition` lowers setState to TransitionLane — interruptible by urgent updates
- `useDeferredValue` defers a derived value to IdleLane — useful for large lists
- Suspense fallback is suppressed during transitions — prevents spinner flash
- Time slicing uses MessageChannel to yield control to browser between fiber chunks
- React 19 makes concurrent mode default — no opt-in, no legacy root
- `useSyncExternalStore` prevents tearing by forcing snapshot consistency at commit time
- DevTools lane badges (red/yellow/blue/green/gray) show which priority triggered each render

## Common Misconception

**"Concurrent rendering means React renders multiple things simultaneously (in parallel)."**

Concurrent rendering is NOT parallelism. React runs on a single thread. "Concurrent" means React can **interrupt** one render to start another, then resume the first. This is cooperative multitasking, not parallel execution. Web Workers or SharedArrayBuffer are not involved. React interleaves work on the main thread by yielding control to the browser scheduler. The term "concurrent" refers to React's ability to handle multiple pending updates without blocking — it processes them in priority order, not simultaneously.

---

## Feynman Explain
(Explain React's concurrent rendering to a junior developer who understands event loops and setTimeout. Use no React jargon — talk about task prioritization, yielding, and interruption in plain terms. Compare React's scheduler to how a restaurant prioritizes orders: urgent (burnt food) over non-urgent (refill water).)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain` — AI probes gaps.*

---

## Reframe
(Pause. Critique: Does every app need concurrent rendering? When does time slicing hurt performance (e.g., render throughput)? Are there cases where `flushSync` is the correct default despite losing concurrency? Write your evaluation. Consider: animation-heavy UIs, real-time data streams, server-rendered static pages.)

---

## Drill
Take the quiz. MCQs test priority classification, useTransition vs useDeferredValue, tearing prevention, and debugging.

Run: `learn.sh quiz advanced-react-19 15-concurrent-rendering`

## Quiz: 15-concurrent-rendering


### What lane does React assign to a state update wrapped in startTransition?

- [ ] A: SyncLane

- [ ] B: InputContinuousLane

- [✓] C: TransitionLane

- [ ] D: IdleLane


**Answer:** C

startTransition marks all setState calls inside its callback as TransitionLane (green in DevTools). TransitionLane is interruptible by higher-priority lanes (SyncLane, InputContinuousLane). IdleLane is used by useDeferredValue, not startTransition.


### A user types into a search field. The filter computation takes 150ms. What happens in concurrent mode vs legacy mode?

- [ ] A: Both modes block typing for 150ms

- [✓] B: Concurrent mode yields between fiber chunks, allowing typing during filter; legacy mode blocks

- [ ] C: Legacy mode yields; concurrent mode blocks

- [ ] D: Neither mode blocks — both use requestAnimationFrame


**Answer:** B

Concurrent mode splits render into ~5ms chunks via time slicing. Browser processes input between chunks. Legacy mode renders synchronously — browser cannot process input until render completes.


### Which statement about lane priority is correct?

- [ ] A: Lanes are numeric priorities (1-31) that React sorts inline

- [✓] B: Lanes are bitmasks that React aggregates and tests via bitwise operations

- [ ] C: Lanes are string labels compared alphabetically

- [ ] D: Lanes are only used in development mode


**Answer:** B

Lanes are binary bitmasks (31 fit in a 32-bit integer). React aggregates pending lanes with bitwise OR, tests intersection with bitwise AND, and picks highest priority via bitScan operations. Numeric sorting would be slower and cannot represent batched lane combinations.


### When React is rendering a transition and a SyncLane update arrives, what happens?

- [ ] A: React finishes the transition render, then processes SyncLane update

- [✓] B: React throws away the transition work and restarts with SyncLane

- [ ] C: React merges both updates into one render

- [ ] D: React blocks the SyncLane update until transition completes


**Answer:** B

React throws a special error from the work loop, discarding all partial transition work. It then restarts with the higher-priority SyncLane. This ensures urgent updates (SyncLane) are never blocked by lower-priority work.


### A filter list uses useDeferredValue for the query. What happens if the user types continuously for 2 seconds?

- [ ] A: The deferred value updates mid-typing every 5ms

- [✓] B: The deferred value stays at the initial value until typing pauses, then catches up

- [ ] C: The deferred value always updates synchronously

- [ ] D: The deferred value only updates when startTransition is called


**Answer:** B

useDeferredValue uses IdleLane. React skips re-rendering the deferred subtree if urgent work (keystroke handling) keeps arriving. Once user pauses and idle frames are available, deferred value catches up to the final value. Intermediate keystroke values may be skipped.


### A component calls startTransition(() =&gt; { setTab('analytics') }). The analytics tab suspends while loading data. What does the user see?

- [ ] A: Immediate Suspense fallback (spinner)

- [✓] B: Previous tab content until data loads

- [ ] C: Blank screen until data loads

- [ ] D: Error boundary because transitions cannot suspend


**Answer:** B

Concurrent mode suppresses Suspense fallbacks during transitions. React keeps committing stale UI (previous tab) instead of showing a fallback. isPending becomes true to indicate background loading. This prevents spinner flash during navigation.


### What mechanism does React use to yield control to the browser between fiber units?

- [ ] A: setTimeout(fn, 0)

- [ ] B: Web Workers for parallel rendering

- [✓] C: MessageChannel with postMessage

- [ ] D: process.nextTick


**Answer:** C

React uses MessageChannel.postMessage to schedule continuation of work. The browser processes pending input, layout, and paint between the message being posted and the onmessage callback firing. setTimeout(0) is throttled to 4ms minimum in nested calls; MessageChannel fires in ~0-1ms.


### Which API prevents tearing when reading external store state during concurrent rendering?

- [ ] A: useEffect with dependency array

- [✓] B: useSyncExternalStore

- [ ] C: flushSync

- [ ] D: useRef to store snapshot


**Answer:** B

useSyncExternalStore forces getSnapshot to run synchronously at commit time, ensuring render and commit use same store snapshot. Without it, a store update between render and commit produces UI with inconsistent state (tearing). React detects snapshot changes and re-renders synchronously.


### A component shows a blue lane badge in DevTools but is wrapped in startTransition. What is the most likely cause?

- [ ] A: DevTools always show blue for all transitions

- [✓] B: A setState outside the transition callback is triggering the re-render on DefaultLane

- [ ] C: startTransition only works in production mode

- [ ] D: The component uses useDeferredValue which overrides startTransition


**Answer:** B

startTransition only affects setState calls executed inside its callback. If any setState outside the callback triggers the render (e.g., a parent re-render, or a setState in the same handler but outside startTransition), it uses DefaultLane (blue). Check that all relevant setState calls are inside startTransition.


### In React 19, what is the recommended way to update an external store (Zustand) inside useTransition?

- [ ] A: Call store.setState directly inside startTransition

- [✓] B: Use useSyncExternalStore + startTransition on the component that reads the store

- [ ] C: External stores cannot be used with transitions

- [ ] D: Wrap the entire store in useDeferredValue


**Answer:** B

startTransition only wraps React setState calls. External store mutations bypass React's scheduler. The correct pattern: use useSyncExternalStore for safe reads, then wrap the rendering of store-driven data in startTransition. For writes, trigger the store mutation outside transition and let useSyncExternalStore detect the change.


---

# Module 16: Profiling and Performance: Flamegraphs, Re-Render Analysis

Est. study time: 2h
Language: en

## Learning Objectives
- Interpret React DevTools flamegraphs to identify unnecessary re-renders and render cost
- Apply `<Profiler>` API onRender callback to measure component commit times programmatically
- Diagnose common performance antipatterns: large lists, deep trees, unstable keys
- Set performance budgets for component render time and detect regressions in CI

---

## Core Content

### React DevTools Profiler: Recording, Flamegraph, Ranked Timeline

React DevTools Profiler records commit-by-commit snapshots of render activity. Each commit is a single synchronous render+commit cycle.

Three visualization modes:

**Flamegraph**: Stacked bar chart. Each bar = component render time (self + children). Wider bar = more time. Color intensity = relative cost within commit. Click a component to see `why did this render?` — lists changed props, state, or context.

**Ranked timeline**: Components sorted by total render time, descending. Answers "what is slowest component this commit?" directly. Does not show parent-child nesting.

**Interactions timeline** (React 19): Tracks traced interactions (`Scheduler.unstable_trace`) through async work. Shows which user action triggered which commits.

> **Think**: Flamegraph shows Component A at 12ms and Component B at 3ms. Component A has 6 children totaling 10ms of that 12ms. Is A itself expensive, or its children?
>
> *Answer: Component A self-time = 12ms - 10ms = 2ms. Component A itself is cheap. Children are the problem. Flamegraph does not show self-time directly — you compute it by subtracting children. Ranked timeline shows total time but not the breakdown. For self-time, use `<Profiler>` API with `actualDuration` vs `interactionActualDuration`.*

### Interpreting Flamegraphs: Component Render Time, Why Did This Render?

Flamegraph color key:
- Gray: no re-render (bailed out via memo/React.memo)
- Teal/blue: re-rendered, low cost
- Yellow/orange: re-rendered, moderate cost
- Red: re-rendered, high cost

Click component → **Why did this render?** panel shows:

| Reason | Meaning | Fix |
|--------|---------|-----|
| Props changed | Shallow diff found difference | Stabilize references, memo |
| State changed | `setState` in component or hook | Reduce state update scope |
| Parent rendered | No bailout on parent re-render | `React.memo`, Compiler |
| Context changed | Context value updated | Split context, narrow scope |
| Hook changed | Hook deps array diff | Memoize hook deps |

> **Think**: Component re-renders with "Parent rendered" reason. Parent is a list container. Container uses `React.memo`. Why did container render?
>
> *Answer: `React.memo` only protects if props are stable. If parent passes inline props (e.g., `<Item onClick={() => ...} />`) or new object/array references each render, memo check fails. Container rendered because its own props changed, cascading to children.*

### Identifying Unnecessary Re-Renders: Props Change vs State Change vs Parent Render

Three sources of re-render, three distinct fixes:

**Props change**: Parent passes new reference every render.
```typescript
// Bad — new object each render
function Parent() {
  return <Child config={{ theme: 'dark' }} />
}

// Good — stable reference
function Parent() {
  const config = useMemo(() => ({ theme: 'dark' }), [])
  return <Child config={config} />
}
```

**State change**: Component calls `setState`. Fix: lift state down, colocate state closer to consumer.

**Parent render**: Parent re-renders → child re-renders (unless bailed out). Fix: `React.memo` or Compiler.

Pre-React 19 fix chain:
1. `React.memo` wraps child
2. `useMemo`/`useCallback` stabilizes child props
3. Compiler eliminates steps 1-2

> **Think**: A `useState` setter is called with the same value: `setCount(5)` when count is already 5. Does React re-render?
>
> *Answer: React 18: yes (no bailout on setState with same value unless `useState` initial is object and same reference). React 19: React automatically bails out when new state equals old state via `Object.is`. No re-render. This is a React 19 improvement over manual checks.*

### Using `<Profiler>` API: onRender Callback

`<Profiler>` measures actual vs base duration per commit:

```typescript
import { Profiler, type ProfilerOnRenderCallback } from 'react'

const onRender: ProfilerOnRenderCallback = (
  id: string,           // profile id prop
  phase: 'mount' | 'update' | 'nested-update',
  actualDuration: number,    // ms: time spent rendering this subtree
  baseDuration: number,      // ms: estimated time without memoization
  startTime: number,
  commitTime: number,
  interactions: Set<{ name: string; timestamp: number }>
) => {
  if (actualDuration > 16) {  // exceeds 60fps threshold
    console.warn(`[Profiler] ${id} took ${actualDuration.toFixed(2)}ms`)
    reportToAnalytics({ id, phase, actualDuration, commitTime })
  }
}

function Dashboard() {
  return (
    <Profiler id="Dashboard" onRender={onRender}>
      <ExpensiveComponent />
    </Profiler>
  )
}
```

Key metrics:
- `actualDuration`: what users experience. Includes re-render cascades.
- `baseDuration`: hypothetical no-memo time. If `actualDuration ≈ baseDuration`, memoization not helping.
- `phase`: `'mount'` vs `'update'`. Mount is one-time; update repeats.

> **Think**: `actualDuration` = 40ms, `baseDuration` = 12ms. What does this tell you about memoization effectiveness?
>
> *Answer: `actualDuration` > `baseDuration` by 3x. Memoization is effective here — without memo, estimated time is 12ms. Actual is 40ms because memo overhead or because some children do not memo correctly and re-render. Ratio > 2 suggests investigation: either memo not working, or memo itself is costly.*

### Measuring Render Cost: Commit Time, Phase, actualDuration

React 19 commit lifecycle:

1. **Render phase**: Call components, diff virtual tree. Can be interrupted (concurrent features).
2. **Commit phase**: Apply DOM mutations. Synchronous, cannot be interrupted.
3. **Browser paint**: Browser renders pixels.

Profiler captures both phases as one `actualDuration`. To isolate:
- Render time: `<Profiler>` `actualDuration`
- Commit time: difference between consecutive `commitTime` values
- Paint time: `requestAnimationFrame` timestamp - `commitTime`

```typescript
let lastCommit = 0
const onRender: ProfilerOnRenderCallback = (id, phase, actual, base, start, commit) => {
  const commitGap = lastCommit ? commit - lastCommit : 0
  console.log(`Commit gap: ${commitGap.toFixed(2)}ms — indicates JS main thread blocking`)
  lastCommit = commit
}
```

> **Think**: Commit gap is consistently 50ms. User reports "app feels sluggish." Where is the bottleneck?
>
> *Answer: 50ms commit gap means React is spending 50ms between commits doing non-React work (event handlers, network callbacks, other JS). `<Profiler>` shows component render is fast. Fix: reduce expensive JS outside React — debounce handlers, move heavy computation to Web Workers, verify no `useEffect` chains causing synchronous re-render cycles.*

### Bundle Size Analysis: React 19 Production Builds vs Development

DevTools profiling must run against **production** builds for accurate timings. Development build includes:
- PropTypes validation (React 19: removed, but custom checks)
- Component stack traces
- Double-invocation warnings (StrictMode)
- Extra warning checks

These inflate render time 2-5x in dev.

| Bundle | Size (min+gzip) | Profiling accuracy |
|--------|-----------------|-------------------|
| Development | ~150KB | Distorted timings |
| Production | ~45KB | Accurate timings |
| Production + Profiler | ~47KB | Accurate + Profiler API active |

React 19 warning: `react-dom/client` and `react-dom/server` are separate entry points. Ensure production build uses `react-dom/profiling` if using `<Profiler>` in production (rare — typically dev-only).

> **Think**: You profile in dev mode and see 30ms render times. Production build under load shows 120ms frame times. What explains the gap?
>
> *Answer: Dev mode inflates render time (2-5x). But production being *slower* under load means the bottleneck is not React rendering — it's GC pauses (development has less object allocation because some dev checks skip work) or network/API contention. Profile production with React Profiler, not dev. The 120ms includes browser layout/paint, async work, and GC. `<Profiler>` actualDuration shows only React render time, which is likely < 16ms in prod.*

### Lighthouse Metrics: FCP, LCP, TTI, TBT with React 19

Lighthouse audits real user experience. React 19 specific considerations:

| Metric | React 19 Impact |
|--------|-----------------|
| **First Contentful Paint (FCP)** | Server Components stream initial HTML. No client JS needed for first text/image. FCP improves 15-40% over CSR baseline. |
| **Largest Contentful Paint (LCP)** | Streaming SSR + Suspense boundaries let main content paint without waiting for sidebar/footer. Key: `<Suspense>` around non-critical sections. |
| **Total Blocking Time (TBT)** | Transitions and `useDeferredValue` prevent expensive re-renders from blocking main thread. TBT drops because React yields to browser between transitions. |
| **Time to Interactive (TTI)** | `hydrateRoot` with selective hydration: React hydrates visible content first. Hidden content hydrates post-interaction. TTI improves ~30%. |

Profiling Lighthouse in React 19:
- Test with production build (use `lighthouse-ci` or PageSpeed Insights)
- Disable DevTools if testing locally
- Focus on TBT and LCP — these are the metrics React 19 most affects

> **Think**: Lighthouse reports TBT of 350ms on a React 19 app. Profiler shows individual renders under 5ms. What causes the blocking time?
>
> *Answer: TBT includes all main thread work, not just React rendering. 350ms TBT with fast renders suggests: large JS bundles (parse/compile), aggressive analytics scripts, or third-party embeds. Profile "Long Tasks" in Performance tab (Chrome DevTools). React renders fast — but it runs alongside heavyweight non-React work.*

### Performance Budgeting: Setting Render Time Budgets per Component

Set budgets using `<Profiler>` or runtime assertions:

```typescript
const BUDGETS: Record<string, number> = {
  'DataTable': 16,     // 60fps frame budget
  'ChartView': 32,     // 30fps — acceptable for heavy charts
  'SearchInput': 8,    // must respond to keystroke latency
  'Sidebar': Infinity, // not performance-sensitive
}

const onRender: ProfilerOnRenderCallback = (id, phase, actualDuration) => {
  const budget = BUDGETS[id]
  if (budget !== undefined && actualDuration > budget) {
    console.error(`[Budget] ${id} exceeded ${budget}ms (${actualDuration.toFixed(2)}ms)`)
    // Send to monitoring
  }
}
```

Budget guidelines:
- **16ms**: Interactive components (buttons, inputs, toggles)
- **32ms**: Content display (lists, cards, tables with moderate data)
- **50ms**: Heavy visualizations (charts, graphs with <1000 data points)
- **100ms**: Background work (offscreen prefetch, analytics)
- **50ms total commit budget** for 60fps rendering

> **Think**: Component consistently takes 45ms. Budget is 16ms. What are three options besides refactoring?
>
> *Answer: (1) Increase budget to 50ms if component is genuinely expensive and non-interactive. Budgets are guidance, not dogma. (2) Defer component via `<Suspense>` so it renders off-screen. (3) De-prioritize rendering with `useDeferredValue` — renders happen during idle time, not keystroke.*

### Common Performance Antipatterns

**1. Large flat lists without virtualization.**
Fix: `react-window`, `@tanstack/react-virtual`. Virtualize any list > 100 items.

**2. Deep component trees re-rendering on every keystroke.**
Fix: Split input and display into separate components. Input updates itself; display reads from debounced/ deferred value.

**3. Unstable keys.**
```typescript
// Bad — index as key. Reorder = full remount.
{items.map((item, i) => <Item key={i} />)}

// Bad — random key causes full remount every render
{items.map(item => <Item key={Math.random()} />)}

// Good — stable unique id
{items.map(item => <Item key={item.id} />)}
```

**4. State at wrong level.**
State in root, consumed two levels deep. Every update re-renders entire tree. Fix: colocate state in the consumer component or use context splitting.

**5. Unmemoized callbacks in list items.**
Parent renders → creates new function → `React.memo` child re-renders. Fix: `useCallback` or Compiler.

> **Think**: A list of 1000 items re-renders when one item changes. Each item is `React.memo` wrapped. The list uses `key={item.id}`. Profiler shows all 1000 items re-rendering. What went wrong?
>
> *Answer: `React.memo` only prevents re-render if props are stable. If the list container creates new props (or if item component reads context that changed), every item re-renders. Check: does item receive a new `onToggle` prop each render? Is the item reading a context value that updates? The key diff is correct — problem is prop stability or context.*

### Automation: Profiling in CI, Regression Detection

Automate performance regression detection:

**Approach 1: Lighthouse CI**
```yaml
# .lighthouserc.json
{
  "ci": {
    "collect": {
      "url": ["http://localhost:3000/dashboard"],
      "settings": { "throttlingMethod": "devtools" }
    },
    "assert": {
      "assertions": {
        "total-blocking-time": ["error", { "maxNumericValue": 200 }],
        "largest-contentful-paint": ["warn", { "maxNumericValue": 2500 }]
      }
    }
  }
}
```

**Approach 2: Profiler-based regression test**
```typescript
// __tests__/render-times.e2e.ts
import { render } from '@testing-library/react'
import { Profiler, type ProfilerOnRenderCallback } from 'react'

test('DataTable render time < 32ms', async () => {
  const durations: number[] = []
  const onRender: ProfilerOnRenderCallback = (id, phase, actualDuration) => {
    if (phase === 'update') durations.push(actualDuration)
  }

  const { rerender } = render(
    <Profiler id="DataTable" onRender={onRender}>
      <DataTable data={testData} />
    </Profiler>
  )

  rerender(<Profiler id="DataTable" onRender={onRender}>
    <DataTable data={updatedData} />
  </Profiler>)

  expect(Math.max(...durations)).toBeLessThan(32)
})
```

**Approach 3: Bundle size tracking**
```bash
# Add to CI pipeline
npx size-limit
# or
npx react-native bundle --platform web --dev false --entry-file index.js --bundle-output dist/bundle.js
stat -f%z dist/bundle.js | xargs -I{} echo "Bundle size: {} bytes"
```

> **Think**: A CI performance test fails from 28ms to 35ms after a PR. The change is a new feature adding a small component. What do you do?
>
> *Answer: Investigate before rejecting. 28→35ms may be noise (check variance across runs). If consistent, profile the flamegraph to find regression. If the new feature justifies the cost, update the budget. CI performance tests catch regressions; they should block merges only when regression is confirmed not noise.*

---

### Why This Matters

Unnecessary re-renders are the #1 performance bug in React apps. Flamegraphs and Profiler API are the only reliable tools to find them. Teams that profile in CI catch regressions before they ship. Teams that rely on "feeling slow" miss the gradual degradation that compounds over 6 months. A single component leaking re-renders can waste 20% of render time on every interaction. Profiling is not optional — it is how React apps stay fast under real load.

---

### Common Questions

**Q: Profiler shows 60ms for one component. Is that bad?**
A: Depends. 60ms on mount is fine. 60ms on every keystroke update is janky. Measure phase. Mount cost is paid once; update cost is paid every interaction.

**Q: Flamegraph shows red everywhere. Is my app slow?**
A: Not necessarily. Flamegraph color scales relative to the *most expensive component in that commit*. If everything is 0.5ms but the slowest is 1ms, everything looks red. Check actual numbers, not colors.

**Q: Should I use `<Profiler>` in production?**
A: Generally no. Profiler adds overhead (≈2KB + callback execution). Use it in development and staging. React 19 includes `react-dom/profiling` entry for production profiling, but use sparingly.

**Q: Does the React 19 Compiler eliminate the need for profiling?**
A: No. Compiler automates memoization, but not all performance problems are memoization problems. Large lists, deep trees, and expensive computations still need profiling. Compiler fixes re-renders; it does not fix algorithmic inefficiency.

**Q: How do I profile a specific user interaction, not all commits?**
A: Use `Scheduler.unstable_trace` to label interactions, then filter Profiler commits by `interactions` set. Or use Chrome DevTools Performance tab: start recording, perform interaction, stop, filter to React events.

---

## Examples

### Example 1: Diagnosing a 200ms Commit on Dashboard Load

**Problem**: Dashboard takes 200ms to render. Users see blank screen for visible delay. Profiler shows one large commit.

**Flamegraph analysis**:
- `Dashboard`: 200ms (root)
  - `Header`: 2ms
  - `DataGrid`: 180ms
    - `Row` × 500: 150ms (0.3ms each)
    - `Pagination`: 20ms
    - `FilterBar`: 10ms
  - `Sidebar`: 18ms

**Diagnosis**: `DataGrid` is 90% of commit. 500 rows at 0.3ms each = 150ms. `Row` is cheap, but 500× adds up. Table is not virtualized.

**Fix**:
```typescript
// Before: all 500 rows render in DOM
<tbody>
  {data.map(row => <tr key={row.id}>{/* ... */}</tr>)}
</tbody>

// After: virtualize with 40 visible rows
import { useVirtualizer } from '@tanstack/react-virtual'

const virtualizer = useVirtualizer({
  count: data.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => 40, // row height in px
})

return (
  <tbody ref={scrollRef} style={{ height: 400, overflow: 'auto' }}>
    <tr style={{ height: virtualizer.getTotalSize() }} />
    {virtualizer.getVirtualItems().map(virtualRow => (
      <tr key={data[virtualRow.index].id}>
        {/* render visible row only */}
      </tr>
    ))}
  </tbody>
)
```

**Result**: Commit drops from 200ms to 25ms. 40 visible rows × 0.3ms = 12ms + virtualizer overhead.

### Example 2: Profiling in CI for a Search Component

**Problem**: Search results component regresses from 8ms to 40ms after refactor. Team needs automated guard.

**Test setup**:
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { Profiler, type ProfilerOnRenderCallback } from 'react'
import SearchPage from './SearchPage'

test('SearchPage results render under 16ms', () => {
  const durations: number[] = []
  const onRender: ProfilerOnRenderCallback = (id, phase, actual) => {
    if (id === 'SearchResults') durations.push(actual)
  }

  render(
    <Profiler id="SearchPage" onRender={onRender}>
      <SearchPage />
    </Profiler>
  )

  const input = screen.getByPlaceholderText('Search...')
  fireEvent.change(input, { target: { value: 'react' } })

  // Wait for debounced render
  const resultDuration = durations[durations.length - 1]
  expect(resultDuration).toBeLessThan(16)
})
```

**Regression found**: Refactor moved search state up two levels, causing parent re-render cascade. Fix by colocating search state in the SearchResults component.

### Example 3: Using Flamegraph to Fix a "Janky Filter"

**Problem**: Category filter dropdown causes 300ms frame drops. Users report jank.

**Profiler approach**:
1. Record interaction in Profiler
2. Click "CategoryFilter" in flamegraph
3. "Why did this render?" → "Parent rendered"
4. Check parent: App component re-renders on filter change because filter state is in Redux store consumed by App's `useSelector`

**Root cause**: Redux selector on App level. Filter change dispatches action → App re-renders → CategoryFilter re-renders (even though filter state is not used by App).

**Fix**: Move redux `useSelector` from App to CategoryFilter directly. App no longer subscribes to filter state. Filter change updates only CategoryFilter component.

**Result**: 300ms → 12ms.

---

## Key Takeaways
- React DevTools Profiler has three modes: flamegraph (hierarchy), ranked timeline (sorted by cost), interactions (user action mapping)
- "Why did this render?" lists five reasons: props changed, state changed, parent rendered, context changed, hook deps changed
- `<Profiler>` `onRender` callback gives `actualDuration`, `baseDuration`, `phase`, `startTime`, `commitTime`
- Budget components: interactive (16ms), display (32ms), heavy viz (50ms), background (100ms)
- React 19 improves TBT via transitions and TTI via selective hydration
- Common antipatterns: unvirtualized lists, deep trees, bad keys, wrong state location, unmemoized callbacks
- CI can catch performance regressions via Lighthouse CI, Profiler-based jest tests, or bundle size checks
- React Compiler fixes re-render cascades but does not fix algorithmic inefficiency — profile first, optimize second

## Common Misconception

**"A component that looks fast in dev will be fast in production."**

Dev mode inflates render times 2-5x. Conversely, production can be slower due to GC, minification overhead, or third-party scripts absent in dev. Always profile production builds. Use `react-dom/profiling` entry for accurate `<Profiler>` measurements. Dev profiling finds *structural* problems (which component re-renders unnecessarily); production profiling finds *timing* problems (how long does each render actually cost the user).

---

## Feynman Explain
(Explain flamegraphs to a junior developer who knows React basics but has never opened the Profiler. Use a restaurant kitchen analogy: orders as state updates, chefs as components, time as render duration. Explain why one chef doing unnecessary work (re-render) slows down the whole kitchen. No DevTools API names — just the concept of visualizing where time goes.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain advanced-react-19` — AI probes gaps.*

---

## Reframe
(Pause. Evaluate: Is per-component render budget an anti-pattern? When does optimizing for 16ms per component become premature optimization? The real bottleneck is often network, third-party scripts, or layout thrashing — not React rendering. Write cases where profiling React components misleads you into optimizing the wrong layer of the stack.)

---

## Drill
Take the quiz. MCQs test Profiler interpretation, budget decisions, and regression detection.

Run: `learn.sh quiz advanced-react-19 16-profiling`

## Quiz: 16-profiling


### Which Profiler mode sorts components by total render time in descending order, without showing parent-child nesting?

- [ ] A: Flamegraph

- [✓] B: Ranked timeline

- [ ] C: Interactions timeline

- [ ] D: Component tree


**Answer:** B

Ranked timeline lists components from slowest to fastest by total render time per commit. Flamegraph shows hierarchy. Interactions timeline maps user actions to commits. Component tree is not a Profiler mode.


### A Flamegraph bar shows Component P at 20ms. Its three children total 17ms. What is P's self-time?

- [ ] A: 20ms

- [ ] B: 17ms

- [✓] C: 3ms

- [ ] D: 37ms


**Answer:** C

Self-time = total - children sum. 20ms - 17ms = 3ms. P itself is cheap; children are the bottleneck. Flamegraph shows total inclusive time. Compute self-time by subtracting children.


### Which Profiler metric indicates the hypothetical render time if no memoization were applied?

- [ ] A: actualDuration

- [✓] B: baseDuration

- [ ] C: commitTime

- [ ] D: startTime


**Answer:** B

baseDuration estimates render time without memoization. actualDuration is real time including memo benefits. If actualDuration ≈ baseDuration, memoization is not helping. commitTime and startTime are timestamps, not duration estimates.


### Component consistently shows actualDuration 45ms and baseDuration 12ms. What does this indicate?

- [ ] A: Memoization is working perfectly

- [ ] B: Memoization is adding overhead; actualDuration should be lower than baseDuration

- [✓] C: Some children are not memoized correctly, causing actualDuration to exceed baseDuration

- [ ] D: baseDuration always exceeds actualDuration


**Answer:** C

actualDuration &gt; baseDuration means memoization is not fully effective. Either children bypass memo (inline props, context changes) or memo overhead is significant. Ideally actualDuration ≤ baseDuration when memo works.


### Commit gap is consistently 80ms. Profiler shows each individual render under 5ms. What is the most likely cause of the 80ms gap?

- [ ] A: React rendering is the bottleneck

- [✓] B: Non-React JavaScript (event handlers, network callbacks) is blocking the main thread between commits

- [ ] C: The Profiler is inflating measurements in development mode

- [ ] D: Browser painting adds 80ms overhead


**Answer:** B

Commit gap measures time between commits. If React renders fast (&lt;5ms) but gap is high, non-React JS is the bottleneck. Event handlers, analytics, network callbacks running on main thread delay next commit start.


### A developer profiles in development mode and sees 35ms render time. Production under load shows 150ms frame time. Which statement is true?

- [ ] A: Production build must be broken — file a bug

- [✓] B: 35ms dev + 150ms production means React render time is not the primary bottleneck; GC, layout, or network likely dominate

- [ ] C: Development mode under-reports render time

- [ ] D: The Profiler is inaccurate in both modes


**Answer:** B

Dev mode inflates React render time. If production is slower than dev under load, the bottleneck is outside React rendering — GC pauses, layout thrashing, third-party scripts, or network contention. Profiler actualDuration (React-only) is likely &lt; 16ms in prod. The 150ms includes everything.


### React team sets component budget: DataGrid 32ms, SearchInput 8ms, Sidebar Infinity. Which budget reasoning is correct?

- [ ] A: Sidebar budget Infinity means it should never render

- [✓] B: SearchInput 8ms ensures keystroke latency stays under frame budget

- [ ] C: DataGrid 32ms guarantees 60fps rendering

- [ ] D: All components should have the same budget


**Answer:** B

SearchInput responds to keystrokes — budget set tight (8ms) to leave room for browser paint within 16ms frame. DataGrid 32ms at 30fps is acceptable for non-interactive content. Sidebar Infinity acknowledges it is not performance-sensitive. Budgets vary by interaction type.


### A list of 500 items re-renders entirely when one item's state changes. Each item is React.memo wrapped, uses key={item.id}. Flamegraph shows 'Parent rendered' as re-render reason. What is the fix?

- [ ] A: Remove React.memo — it is not working

- [✓] B: Check if parent passes inline props (functions, objects) that change each render, breaking memo comparison

- [ ] C: Change keys from item.id to array index

- [ ] D: Increase parent render budget


**Answer:** B

React.memo works only if props are stable. If parent creates new object/function references each render (e.g., `&lt;Item onClick={() =&gt; ...} /&gt;`), memo shallow comparison fails. Parent renders → creates new props → memo check fails → child re-renders. Stabilize props with useCallback/useMemo or Compiler.


### Which approach detects React render time regressions in CI?

- [ ] A: Run Lighthouse CI with performance assertions on TBT and LCP

- [ ] B: Write a Jest test wrapping component in &lt;Profiler&gt; and asserting actualDuration threshold

- [ ] C: Track bundle size with size-limit

- [✓] D: All of the above


**Answer:** D

All three catch different aspects. Lighthouse CI measures real-world user metrics (TBT, LCP). Profiler-based tests measure per-component render times programmatically. Bundle size tracking catches JS payload growth that indirectly affects parse/compile time. Use all three in CI for comprehensive coverage.


### React 19 Compiler auto-memoizes components. Which performance problem does the Compiler NOT fix?

- [ ] A: Unnecessary re-renders caused by unstable prop references

- [✓] B: Large unvirtualized lists rendering 1000 DOM nodes

- [ ] C: Re-renders from parent state changes not consumed by child

- [ ] D: Context value changes causing subscriber re-renders


**Answer:** B

Compiler auto-memoizes (fixes A, C, D) but does not fix algorithmic/rendering inefficiency. Virtualizing large lists is a structural change, not a memoization problem. Compiler eliminates defensive useMemo/useCallback but does not reduce DOM node count or detect oversized renders.


---

# Module 17: Error Handling — Boundaries, Recoverable Errors, Logging

Est. study time: 2h
Language: en

## Learning Objectives
- Build error boundaries for render-phase crashes using class component lifecycle methods
- Design recoverable error patterns with retry, reset, and telemetry integration
- Handle Action and Server Action errors with useActionState and client-side fallbacks
- Choose boundary granularity and async error strategies per component type

---

## Core Content

### ErrorBoundary Class Component: componentDidCatch and getDerivedStateFromError

React has no built-in way to catch render errors in functional components (no hook equivalent). Error boundaries use class component lifecycle methods:

```typescript
interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  onError?: (error: Error, info: React.ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Called during render phase. Returns state update.
    // Must be pure — no side effects.
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Called during commit phase. Side effects allowed.
    // Log to error reporting service here.
    console.error('Error caught:', error, 'Component stack:', info.componentStack)
    this.props.onError?.(error, info)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? <div>Something went wrong.</div>
    }
    return this.props.children
  }
}
```

Key distinction:
- `getDerivedStateFromError` — render phase, must be pure. Transitions component to error state.
- `componentDidCatch` — commit phase, side effects OK. Use for logging, telemetry, error reporting.

> **Think**: Why can't `componentDidCatch` alone set error state? Why two methods?
>
> *Answer: `componentDidCatch` runs during commit phase — after React has already committed the broken render. Calling `setState` there triggers a second render pass (synchronous re-render). `getDerivedStateFromError` runs during render phase, so React can show fallback in the same commit. The two-phase design avoids double-render flash.*

### ErrorBoundary + Suspense Composition Patterns

ErrorBoundary and Suspense compose hierarchically but handle different failure modes:

| Component | Handles | Mechanism |
|-----------|---------|-----------|
| ErrorBoundary | Render crash, uncaught exception | Catches thrown error, shows fallback |
| Suspense | Pending Promise | Shows fallback until promise resolves |

Pattern: ErrorBoundary wraps Suspense for resilient async sections:

```typescript
function UserProfile({ userId }: { userId: string }) {
  return (
    <ErrorBoundary fallback={<ProfileErrorUI />}>
      <Suspense fallback={<ProfileSkeleton />}>
        <UserData userId={userId} />
      </Suspense>
    </ErrorBoundary>
  )
}
```

Behavior:
1. Promise thrown (UserData suspends) → Suspense shows skeleton
2. Promise rejects with error → error propagates up to ErrorBoundary → ErrorBoundary shows fallback
3. Promise resolves → UserData renders normally

Nesting order matters. ErrorBoundary outside Suspense catches rejections from the suspending component AND errors in the Suspense boundary itself. ErrorBoundary inside Suspense would get replaced by Suspense fallback on re-suspend.

> **Think**: You have a dashboard with widget grid. Each widget fetches independently. Should each widget have its own (ErrorBoundary + Suspense), or one pair for the whole grid?
>
> *Answer: Each widget. If one widget crashes or suspends, the others keep working. Single boundary for entire grid means one failed widget takes down all widgets. Granularity per widget gives resilience per widget.*

### Recoverable Errors: ErrorBoundary with Retry

Error boundaries can provide recovery via a `retry` mechanism:

```typescript
interface RecoveryBoundaryState {
  hasError: boolean
  error: Error | null
  key: number
}

class RecoveryBoundary extends React.Component<
  ErrorBoundaryProps,
  RecoveryBoundaryState
> {
  state: RecoveryBoundaryState = { hasError: false, error: null, key: 0 }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  handleRetry = () => {
    // Increment key forces React to unmount + remount children
    // This clears any stale state that caused the crash
    this.setState(prev => ({
      hasError: false,
      error: null,
      key: prev.key + 1,
    }))
  }

  render() {
    if (this.state.hasError) {
      return (
        <div>
          <p>{this.state.error?.message}</p>
          <button onClick={this.handleRetry}>Retry</button>
        </div>
      )
    }
    return <div key={this.state.key}>{this.props.children}</div>
  }
}
```

Key insight: React does not recover from a crashed subtree on its own. You must unmount + remount children to clear the crashed state. The `key` prop change is the standard pattern — React sees a new element, destroys old, mounts fresh.

Common recovery strategies:
- **Retry with key increment**: Full remount. Destroys all child state.
- **Retry with backoff**: Count retries, show exponential backoff timer.
- **Retry with partial recovery**: Keep parent state, only remount crashed section using key.

> **Think**: After retry, the component crashes again immediately. What should you do?
>
> *Answer: Track retry count. After 3 attempts, show unrecoverable error UI with "contact support" rather than infinite retry loop. Unmount + remount will not fix a persistent bug — only a transient failure (network blip, race condition).*

### Error Logging with Telemetry

Error boundaries integrate with error reporting services (Sentry, Datadog, Rollbar, Bugsnag):

```typescript
class MonitoredBoundary extends React.Component<{
  children: React.ReactNode
  componentName: string
}> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Send structured error report
    reportError({
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack,
      },
      component: {
        name: this.props.componentName,
        stack: info.componentStack,
      },
      metadata: {
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
      },
      severity: 'error',
    })
  }

  render() {
    if (this.state.hasError) {
      return <GeneralErrorUI />
    }
    return this.props.children
  }
}
```

Best practices for error logging:
- **Include component stack**: `info.componentStack` shows where in the component tree the error occurred — more actionable than JavaScript stack alone.
- **Deduplicate errors**: Group identical error messages + component paths. One component crashing on mount for every user should produce 1 alert, not 10,000.
- **Add breadcrumbs**: Log preceding user actions leading to the crash. Helps reproduce.
- **Ignore expected errors**: Network timeouts, aborted requests. Only alert on unexpected failures.

> **Think**: getDerivedStateFromError is pure — you cannot log there. componentDidCatch can log. What happens if the logging service itself throws?
>
> *Answer: componentDidCatch runs during commit phase and errors there are NOT caught by the same boundary — they propagate to parent boundary. Wrap logging in try-catch to prevent a logging failure from cascading to a parent boundary. Never let telemetry become a crash vector.*

### React 19 Action Errors: useActionState

React 19 Actions shift error handling from try-catch in event handlers to declarative error state:

```typescript
import { useActionState } from 'react'

interface FormState {
  error: string | null
  success: boolean
}

async function submitForm(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const result = await api.createUser(formData)
    return { error: null, success: true }
  } catch (err) {
    // Return structured error — React does not catch this for you
    return {
      error: err instanceof ApiError
        ? err.message
        : 'Unexpected error. Please try again.',
      success: false,
    }
  }
}

function SignupForm() {
  const [state, formAction, isPending] = useActionState(submitForm, {
    error: null,
    success: false,
  })

  return (
    <form action={formAction}>
      {state.error && <div role="alert">{state.error}</div>}
      {state.success && <div>Account created!</div>}
      <input name="email" type="email" required />
      <button type="submit" disabled={isPending}>
        {isPending ? 'Submitting...' : 'Sign Up'}
      </button>
    </form>
  )
}
```

Key difference from render errors: Action errors are NOT caught by ErrorBoundary. Actions run in event handlers, not during render. The error is handled via return value, not thrown exception. This means:
- ErrorBoundary does NOT catch Action errors
- You must handle Action errors explicitly via state returned from the action function
- ErrorBoundary only catches errors thrown during render phase

> **Think**: An Action throws an uncaught exception instead of returning an error state. What happens?
>
> *Answer: The uncaught exception propagates to the event handler scope. It is NOT caught by ErrorBoundary (render only). In development, React logs to console. In production, the error is swallowed — the form hangs. Always catch inside the action function and return error state. Never let Actions throw to the caller.*

### Server Action Errors: Throwing from Server, Handling on Client

Server Actions run on the server. Errors thrown inside Server Actions serialize to the client:

```typescript
'use server'

export async function updateProfile(formData: FormData) {
  const email = formData.get('email')
  
  if (typeof email !== 'string' || !email.includes('@')) {
    throw new Error('Invalid email address')
  }

  await db.users.update({ email })
  return { success: true }
}
```

Client side:

```typescript
function ProfileForm() {
  const [state, formAction, isPending] = useActionState(
    async (prev: { error?: string }, formData: FormData) => {
      try {
        return await updateProfile(formData)
      } catch (err) {
        // err.message is the server-thrown Error message
        // This is safe — only the message serializes, not the stack
        return {
          error: err instanceof Error ? err.message : 'Server error',
        }
      }
    },
    {}
  )

  return (
    <form action={formAction}>
      {state?.error && <div role="alert">{state.error}</div>}
      <input name="email" type="email" />
      <button type="submit" disabled={isPending}>
        {isPending ? 'Saving...' : 'Save'}
      </button>
    </form>
  )
}
```

Safety note: Only `error.message` serializes across the server-client boundary. Stack traces, server internals, and database error details do NOT leak. Do not expose internal error details in user-facing messages. Map server errors to user-friendly messages on the client.

> **Think**: A Server Action throws a database connection error. The error message contains the database hostname. Should you display this to the user?
>
> *Answer: No. Server error messages may leak infrastructure details. Always catch server errors and map them to generic user messages on the client. Log full error details server-side for debugging; send sanitized messages to the client.*

### Event Handler Errors vs Render Errors

React handles errors differently depending on where they occur:

| Error location | Caught by ErrorBoundary? | Recovery |
|----------------|--------------------------|----------|
| Render (return from component) | Yes | getDerivedStateFromError → fallback UI |
| Lifecycle (componentDidMount) | Yes | Same as render |
| Event handler (onClick, onSubmit) | No | Must handle with try-catch |
| useEffect callback | No | Must handle inside effect |
| Server Action | No | Must return error state |
| Async function (setTimeout, Promise) | No | Must handle with .catch or try-catch |

Why event handler errors are NOT caught by ErrorBoundary:
- React wraps event handlers in a try-catch internally
- React re-throws in development only (for dev tooling)
- In production, React swallows the error — your app keeps running but the handler fails silently

This is intentional: an error in one button click should not unmount the entire UI subtree. Error boundaries protect render integrity. Event handler errors are scoped to the interaction.

```typescript
// Wrong — render error caught by boundary, event error not caught
function BadExample() {
  return (
    <ErrorBoundary>
      <button onClick={() => { throw new Error('click oops') }}>
        Click me
      </button>
    </ErrorBoundary>
  )
}

// Right — event handler error handled inline
function GoodExample() {
  const handleClick = () => {
    try {
      doSomethingRisky()
    } catch (err) {
      showToast('Action failed')
      logError(err)
    }
  }

  return (
    <ErrorBoundary>
      <button onClick={handleClick}>Click me</button>
    </ErrorBoundary>
  )
}
```

> **Think**: A form's onSubmit handler throws. The ErrorBoundary wrapping the form does not catch it. The submit button becomes unresponsive. How do you handle this?
>
> *Answer: Wrap onSubmit body in try-catch. Set error state for display. Optionally show toast + retry button. Never rely on ErrorBoundary for event handler errors. They cover different error scopes.*

### Boundary Granularity: Per-Section vs Global

Error boundary placement determines blast radius:

```typescript
// Pattern 1: Single global boundary — ONE crash takes down entire app
function App() {
  return (
    <ErrorBoundary fallback={<FullPageError />}>
      <Header />
      <Sidebar />
      <MainContent />
      <Footer />
    </ErrorBoundary>
  )
}

// Pattern 2: Per-section boundaries — crashes are isolated
function App() {
  return (
    <>
      <ErrorBoundary fallback={<HeaderError />}>
        <Header />
      </ErrorBoundary>
      <ErrorBoundary fallback={<SidebarError />}>
        <Sidebar />
      </ErrorBoundary>
      <ErrorBoundary fallback={<MainError />}>
        <MainContent />
      </ErrorBoundary>
      <Footer />
    </>
  )
}

// Pattern 3: Hybrid — global for catastrophic, per-section for features
function App() {
  return (
    <ErrorBoundary fallback={<FullPageError />}>
      <Header />
      <ErrorBoundary fallback={<SidebarError />}>
        <Sidebar />
      </ErrorBoundary>
      <ErrorBoundary fallback={<WidgetError />}>
        <WidgetGrid />
      </ErrorBoundary>
      <Footer />
    </ErrorBoundary>
  )
}
```

Guidelines:
- **Global boundary**: Always have one at the root. Catches genuinely unexpected crashes. Shows full-page error with reload button.
- **Feature boundaries**: Per route, per widget, per modal. Limits crash blast radius to one feature.
- **No boundary for leaf elements**: A button crashing during render is extremely rare. You do not need a boundary for every `<Button>`. Focus on async data boundaries, feature-level sections, and third-party component wrappers.
- **Third-party component boundary**: Wrap third-party libraries that may throw (charts, rich text editors, maps). You cannot control their error behavior.

> **Think**: A chart library (recharts, visx) throws in its render method because of bad data. Where should you place the boundary?
>
> *Answer: Boundary wrapping the chart component specifically. This way: (1) chart crashes show a chart-specific fallback (placeholder), (2) surrounding page content stays intact, (3) you can add retry for the chart without re-mounting entire page. Global boundary would unmount everything.*

### Async Error Handling in Server Components

Server Components can throw errors during rendering on the server. These propagate differently:

```typescript
// Server Component — throws during server-side rendering
async function UserProfile({ userId }: { userId: string }) {
  const user = await db.users.findById(userId)
  
  if (!user) {
    throw new Error('User not found')  // ✗ throws during render
  }

  return <div>{user.name}</div>
}
```

Server Component errors are caught by the nearest ErrorBoundary on the client (with caveats):

- **Static rendering**: Error during build → build fails. No runtime recovery.
- **Dynamic (SSR)**: Error during server render → React sends error to client ErrorBoundary if hydrated. If SSR fails entirely, client renders fallback.
- **Streaming SSR**: Error in one Server Component segment → React closes that segment and sends error to client ErrorBoundary. Remaining segments continue streaming.

For `use()` in Server Components (promise reading):

```typescript
function Comments({ commentsPromise }: { commentsPromise: Promise<Comment[]> }) {
  // use() rejects → error propagates to nearest ErrorBoundary on client
  const comments = use(commentsPromise)
  return <CommentList comments={comments} />
}
```

Rejected promises from `use()` behave identically to thrown errors during render. The parent ErrorBoundary (client-side) catches them.

> **Think**: A Server Component fetches data. The database is down. Does the entire page fail or just the data section?
>
> *Answer: Depends on ErrorBoundary placement. If the data-fetching Server Component has no parent Suspense + ErrorBoundary, the error propagates up until caught or crashes the page. If wrapped in ErrorBoundary (client) + Suspense, only that section shows fallback. Always wrap async Server Component sections with both Suspense (loading) and ErrorBoundary (error).*

### Uncaught Errors and React Crash Recovery

Some errors cannot be caught by ErrorBoundary:

- **Errors in event handlers** (not during render)
- **Errors in asynchronous code** (setTimeout, requestAnimationFrame)
- **Errors in SSR during streaming** (before hydration)
- **JavaScript syntax/runtime errors** (undefined is not a function in external script)
- **Errors in error boundary itself** (cascades to parent boundary)

For truly uncaught errors, use `window.onerror` and `window.addEventListener('unhandledrejection')`:

```typescript
// Global fallback — last resort
window.addEventListener('error', (event) => {
  logErrorToService({
    error: event.error,
    type: 'uncaught',
    url: window.location.href,
  })
  
  // Optional: show overlay in development
  if (process.env.NODE_ENV === 'development') {
    showErrorOverlay(event.error)
  }
})

window.addEventListener('unhandledrejection', (event) => {
  logErrorToService({
    error: event.reason,
    type: 'unhandled_promise_rejection',
    url: window.location.href,
  })
})
```

React 19 SSR improvements: If a component crashes during server rendering, React can recover by falling back to client-side rendering for that section. This is a change from React 18 where a server crash would fail the entire SSR response.

React crash recovery checklist:
1. Global ErrorBoundary at root (render crashes)
2. Feature boundaries per section (section crashes)
3. Error boundary wrapping third-party components (external crashes)
4. try-catch in event handlers (interaction crashes)
5. useActionState error state for actions (data mutation crashes)
6. window.onerror / unhandledrejection listeners (everything else)
7. Retry logic with max attempts (transient crash recovery)
8. Monitoring + alerting on crash rate (observability)

> **Think**: An app has a global ErrorBoundary but still shows a broken UI — the state management store is corrupted even after error recovery. What went wrong?
>
> *Answer: Key-based remount (incrementing key) unmounts the crashed subtree but does NOT reset external state (Redux store, Zustand, URL params). If the error corrupted external state, fresh mount re-reads corrupted state and crashes again. Recovery must also reset any external state that caused the crash — or the bug is persistent.*

---

### Why This Matters

Error handling is the difference between a broken app and a resilient app. Users forgive occasional failures when they see graceful fallbacks + retry. They abandon apps that show white screens or cryptic error messages. ErrorBoundary + retry + logging is the minimum bar for production React. React 19 adds Actions which require a different error model — understanding which errors ErrorBoundary catches (render) and which it does not (actions, events) is critical. Without this, teams ship fragile UIs that crash silently.

---

### Common Questions

**Q: Can I use React hooks inside an ErrorBoundary class component?**
A: No. Error boundaries must be class components because no hook equivalent exists for `componentDidCatch` or `getDerivedStateFromError`. Wrap the boundary in a functional component with hooks for composition: hooks live in the wrapper, lifecycle methods in the class.

**Q: Does ErrorBoundary catch errors in SSR?**
A: Partially. During SSR, `getDerivedStateFromError` runs but there is no commit phase (no DOM), so `componentDidCatch` does not run. In React 19, a server crash can fall back to client rendering. Your error boundary only activates after hydration on the client.

**Q: What is the difference between resetting with key vs setState?**
A: Key replacement destroys and remounts the entire child tree — all component state, effects, refs are reset. setState only updates the boundary's error state. Children keep their internal state, which may still be corrupted. Use key for full reset, setState for showing/hiding fallback UI.

**Q: Should I log errors from getDerivedStateFromError?**
A: No. It must be pure — no side effects, no API calls. Logging belongs in `componentDidCatch`. If you attempt to log in `getDerivedStateFromError`, React may call it multiple times (during retries, concurrent rendering, StrictMode double-invoke) producing duplicate logs.

**Q: How do error boundaries interact with React 19's new concurrent features?**
A: During concurrent rendering, React may call `getDerivedStateFromError` but then discard the render if a higher-priority update interrupts. The error state from a discarded render is never committed. `componentDidCatch` only fires when the error state is committed, so logging is accurate.

---

## Examples

### Example 1: Resilient Data Widget with Retry and Telemetry

**Problem**: Dashboard shows a real-time chart for each metric. Charts are third-party. Network blips cause render crashes. Need graceful degradation + recovery + Sentry logging.

**Solution**:

```typescript
interface MetricWidgetProps {
  metricId: string
  fetchData: (id: string) => Promise<DataPoint[]>
}

function MetricWidget(props: MetricWidgetProps) {
  return (
    <ErrorBoundaryWithRetry maxRetries={3} componentName={`MetricWidget-${props.metricId}`}>
      <Suspense fallback={<WidgetSkeleton />}>
        <ChartContent {...props} />
      </Suspense>
    </ErrorBoundaryWithRetry>
  )
}

class ErrorBoundaryWithRetry extends React.Component<{
  children: React.ReactNode
  maxRetries: number
  componentName: string
}> {
  state = { hasError: false, error: null as Error | null, retries: 0, key: 0 }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Send to Sentry
    Sentry.captureException(error, {
      tags: { component: this.props.componentName },
      contexts: { react: { componentStack: info.componentStack } },
    })
  }

  handleRetry = () => {
    const nextRetries = this.state.retries + 1
    if (nextRetries >= this.props.maxRetries) {
      this.setState({
        hasError: true,
        error: new Error('Max retries exceeded'),
      })
      return
    }
    this.setState(prev => ({
      hasError: false,
      error: null,
      retries: nextRetries,
      key: prev.key + 1,
    }))
  }

  render() {
    if (this.state.hasError) {
      return (
        <WidgetError
          message={this.state.error?.message}
          retriesLeft={this.props.maxRetries - this.state.retries}
          onRetry={this.handleRetry}
        />
      )
    }
    return <div key={this.state.key}>{this.props.children}</div>
  }
}
```

**Result**: Widget crashes show a chart-specific error card with retry button. After 3 failed retries, shows "unavailable" placeholder. Other widgets unaffected. Full error context logged to Sentry.

### Example 2: Action Error Handling for a Multi-Step Form

**Problem**: Checkout form with 3 steps. Each step submits via Server Action. Network errors, validation errors, and server errors must display per-step without losing form data.

**Solution**:

```typescript
interface CheckoutState {
  step: number
  error: string | null
  fieldErrors: Record<string, string>
}

async function submitStep(
  prev: CheckoutState,
  formData: FormData
): Promise<CheckoutState> {
  try {
    const result = await submitCheckoutStep(prev.step, formData)

    if (!result.success) {
      return {
        ...prev,
        error: null,
        fieldErrors: result.fieldErrors ?? {},
      }
    }

    return { ...prev, step: prev.step + 1, error: null, fieldErrors: {} }
  } catch (err) {
    // Catch network/server errors, but do not advance step
    return {
      ...prev,
      error: err instanceof Error ? err.message : 'Checkout failed. Try again.',
      fieldErrors: {},
    }
  }
}

function CheckoutForm() {
  const [state, formAction, isPending] = useActionState(submitStep, {
    step: 1,
    error: null,
    fieldErrors: {},
  })

  return (
    <form action={formAction}>
      {state.error && (
        <div role="alert" className="error-banner">
          {state.error}
          <button type="submit">Retry</button>
        </div>
      )}

      {state.step === 1 && <ShippingStep fieldErrors={state.fieldErrors} />}
      {state.step === 2 && <PaymentStep fieldErrors={state.fieldErrors} />}
      {state.step === 3 && <ConfirmationStep />}

      <button type="submit" disabled={isPending}>
        {isPending ? 'Processing...' : state.step === 3 ? 'Place Order' : 'Next'}
      </button>
    </form>
  )
}
```

**Result**: Server Action errors show inline error banner with retry. Validation errors highlight specific fields. Step never advances on failure — form data preserved. No ErrorBoundary needed for these errors since they occur in Actions, not render.

---

## Key Takeaways
- ErrorBoundary is class-component only — no hook equivalent exists
- `getDerivedStateFromError` (pure render phase) + `componentDidCatch` (side effects in commit phase)
- Key-based remount is the standard recovery pattern — React cannot recover a crashed subtree otherwise
- ErrorBoundary does NOT catch event handler, Action, or async errors
- Use `useActionState` return value for Action error handling — never let Actions throw
- Server Action errors serialize `error.message` only — map to user-friendly messages on client
- Per-section boundaries limit crash blast radius; global boundary catches unexpected failures
- Rejected promises from `use()` propagate to ErrorBoundary like thrown errors
- Third-party components should always be wrapped in their own ErrorBoundary
- Combine global ErrorBoundary + feature boundaries + try-catch + unhandledrejection listener for full coverage

## Common Misconception

**"ErrorBoundary catches all errors in my React app."**

ErrorBoundary only catches errors thrown during the render phase and lifecycle methods (componentDidMount, componentDidUpdate, componentWillUnmount). It does NOT catch:
- Event handler errors (onClick, onSubmit) — those happen outside render
- Action errors (useActionState) — handled via return state, not thrown exceptions
- Async errors (setTimeout, fetch callbacks, Promise chains) — run outside React's error boundary
- Server Action errors — serialized across network, not thrown on client
- Errors in the ErrorBoundary itself — cascades to parent boundary

This is by design. React separates render integrity (boundary territory) from interaction errors (event handler territory). Teams that assume ErrorBoundary is universal leave gaps in event handler and Action error coverage. Always use the right error handling mechanism per error location.

---

## Feynman Explain
(Explain error boundaries to a junior developer who knows React basics but has never used class components. They understand functional components, hooks, try-catch. Use no class-component jargon. Focus on what problem ErrorBoundary solves, where it works, and where try-catch is still needed.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain` — AI probes gaps.*

---

## Reframe
(Pause. Critique: Error boundaries require class components in 2025. Is this a design debt in React? Server Actions shift error handling to return values — is this better or worse than throw-try-catch? Write your evaluation. Consider: why hooks cannot replace componentDidCatch, whether Actions' error-return model is more explicit, and what a hook-based error boundary API would look like.)

---

## Drill
Take the quiz. MCQs test error boundary placement, recovery patterns, Action error handling, and boundary granularity decisions.

Run: `learn.sh quiz advanced-react-19 17-error-handling`

## Quiz: 17-error-handling


### Which lifecycle method in an ErrorBoundary must be pure and cannot have side effects?

- [ ] A: componentDidCatch

- [✓] B: getDerivedStateFromError

- [ ] C: componentDidMount

- [ ] D: render


**Answer:** B

getDerivedStateFromError runs during render phase and must be pure. componentDidCatch runs during commit phase where side effects (logging, telemetry) are allowed. render must also be pure, but getDerivedStateFromError is the dedicated method for transitioning to error state.


### Which errors does a React ErrorBoundary NOT catch?

- [ ] A: Errors thrown during render of a child component

- [ ] B: Errors thrown in componentDidMount lifecycle

- [✓] C: Errors thrown inside an onClick event handler

- [ ] D: Errors thrown inside a component's constructor


**Answer:** C

ErrorBoundary only catches errors during render phase and lifecycle methods (constructor, componentDidMount). Event handler errors (onClick) run outside React's error boundary scope — they must be handled with try-catch or other mechanisms.


### An ErrorBoundary catches a render error. What is the standard pattern to allow user retry?

- [ ] A: Call this.setState inside componentDidCatch to clear error state

- [✓] B: Increment a key prop on the children to force unmount + remount

- [ ] C: Call forceUpdate() on the ErrorBoundary

- [ ] D: Return null from render to reset React's internal error state


**Answer:** B

Incrementing key on children forces React to destroy the crashed subtree and mount fresh. This clears any stale state causing the crash. setState alone only toggles fallback visibility — children retain corrupted state. componentDidCatch cannot trigger recovery. forceUpdate does not reset child state.


### A Server Action throws an error during execution. How should the client handle this?

- [ ] A: Wrap the form in an ErrorBoundary — it catches Server Action errors

- [ ] B: Use componentDidCatch in the nearest parent boundary

- [✓] C: Catch the error inside the action function and return error state via useActionState

- [ ] D: The error is automatically serialized and displayed by React 19 runtime


**Answer:** C

Server Action errors must be caught inside the action function. ErrorBoundary does not catch Action errors (they run in event scope, not render). Use try-catch in the action and return error state. React 19 does not auto-display server errors.


### In React 19, what happens when a Promise read via use() rejects?

- [ ] A: The error is swallowed silently

- [✓] B: The rejection propagates to the nearest ErrorBoundary as if thrown during render

- [ ] C: use() returns null and sets an error ref

- [ ] D: React displays the Promise rejection reason in the fallback


**Answer:** B

use() rejection behaves identically to a thrown error during render. It propagates up to the nearest ErrorBoundary. Wrap use() calls with Suspense + ErrorBoundary for loading and error states respectively.


### A dashboard has 12 independent widgets. One widget's chart library throws during render. What ErrorBoundary placement minimizes blast radius?

- [ ] A: Single ErrorBoundary wrapping the entire dashboard

- [✓] B: One ErrorBoundary per widget

- [ ] C: ErrorBoundary only at page level, not widget level

- [ ] D: No ErrorBoundary — widgets should not throw


**Answer:** B

Per-widget boundaries isolate failures. One widget crash should not take down the other 11. A single global boundary would replace the entire dashboard with a fallback. Per-section boundaries are the standard for dashboard, feed, and grid layouts.


### What information does componentDidCatch's second parameter (info: React.ErrorInfo) provide?

- [ ] A: The React version and build hash

- [✓] B: The component stack trace showing which component tree position threw

- [ ] C: The full call stack of the JavaScript runtime

- [ ] D: The props and state of the crashed component


**Answer:** B

info.componentStack shows the component hierarchy (which component in the tree threw). This is more actionable than a JS stack trace — it tells you the React component path, not just the function call stack. React does not expose crashed component's props or state for security reasons.


### A form uses useActionState. The action function throws an unexpected error instead of returning an error state. What happens in production?

- [ ] A: The ErrorBoundary catches it and shows fallback

- [ ] B: React displays an error overlay

- [✓] C: The error is silently swallowed — form hangs with no feedback

- [ ] D: useActionState catches it and sets error state automatically


**Answer:** C

Uncaught exceptions in Actions propagate to the event handler scope, not render. ErrorBoundary does not catch them. In development, React logs the error. In production, the error is swallowed — the action fails silently, the form never transitions out of pending state. Always wrap action bodies in try-catch and return error state.


### An ErrorBoundary's componentDidCatch throws while logging to an error reporting service. What happens?

- [ ] A: React catches it and ignores — logging errors are non-fatal

- [✓] B: The error propagates to the nearest parent ErrorBoundary

- [ ] C: React freezes the component tree

- [ ] D: componentDidCatch is retried automatically


**Answer:** B

Errors in ErrorBoundary lifecycle methods cascade up to the nearest parent ErrorBoundary. componentDidCatch is not self-catching. If all parent boundaries also fail, React's crash recovery takes over. Wrap logging in try-catch to prevent telemetry from becoming a crash vector.


### Which combination provides complete error coverage for a production React 19 app?

- [ ] A: Global ErrorBoundary only

- [ ] B: Feature ErrorBoundaries + window.onerror listener only

- [✓] C: Global ErrorBoundary + feature boundaries + event handler try-catch + Action error states + unhandledrejection listener

- [ ] D: useActionState error state + componentDidCatch logging only


**Answer:** C

Different error locations need different handlers. Global + feature boundaries cover render errors. try-catch covers event handler errors. Action states cover mutation errors. unhandledrejection covers async errors. No single mechanism covers all cases. Option A misses events and actions. Option B misses events and actions. Option D misses events and unhandled rejections.


---

# Module 18: Custom Hooks Patterns — Composition, Refactoring, Testing

Est. study time: 2h
Language: en

## Learning Objectives
- Design custom hooks following naming, typing, and parameter conventions for production use
- Compose hooks from other hooks, managing dependency chains and lifecycle correctly
- Refactor component logic into reusable hooks while keeping render pure
- Test custom hooks with renderHook covering mount, update, unmount, and concurrent behavior

---

## Core Content

### Custom Hook Conventions

Custom hooks are functions that use React hooks. Three conventions govern them:

**1. Naming**: Prefix `use` — enables React's lint rules (exhaustive-deps, rules-of-hooks). Without `use`, lint rules skip the function — dangerous.

**2. Return types**:

| Return style | When to use |
|-------------|-------------|
| Single value `T` | One output — `useTheme()` returns `Theme` |
| Tuple `[T, Dispatch]` | Value + setter — `useLocalStorage<T>(key, initial)` |
| Object `{ value, action }` | Multiple named outputs — `useMediaQuery(query)` |
| Named object with actions | Complex API — `useForm()` returns `{ values, errors, submit, reset }` |

```typescript
// Tuple pattern (state + updater — matches useState)
function useLocalStorage<T>(key: string, initial: T): [T, (value: T) => void] {
  const [stored, setStored] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? (JSON.parse(item) as T) : initial
    } catch {
      return initial
    }
  })

  const setValue = useCallback((value: T) => {
    setStored(value)
    window.localStorage.setItem(key, JSON.stringify(value))
  }, [key])

  return [stored, setValue]
}

// Object pattern (multiple named outputs)
function useMediaQuery(query: string): { matches: boolean; query: string } {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return { matches, query }
}
```

**3. Parameter patterns**:

```typescript
// Single required param
function useDebounce<T>(value: T, delay: number): T { ... }

// Options object (for 3+ params or optional params)
function useIntersectionObserver(
  options: { threshold?: number; root?: Element; rootMargin?: string }
): { entry: IntersectionObserverEntry | null; ref: (node: Element | null) => void } { ... }

// Configurable with defaults
function usePolling<T>(
  fetcher: () => Promise<T>,
  options?: { interval?: number; enabled?: boolean; onError?: (e: Error) => void }
) { ... }
```

> **Think**: A custom hook returns `{ data, loading, error, refetch }`. Should this be a tuple or object? Why?
>
> *Answer: Object. Four named outputs would be illegible as tuple — caller would write `const [data, loading, error, refetch] = useX()` and must remember position order. Objects let callers destructure by name: `const { data, loading } = useX()`. Use tuples only for 2-element state+setter pairs matching useState pattern.*

### Hook Composition: Calling Hooks from Hooks

Custom hooks can call other hooks. This is the primary mechanism for composition:

```typescript
// Composition: useUserPermissions builds on useUser and useRole
function useUserPermissions() {
  const { user, loading } = useUser()
  const role = useRole(user?.id)

  const permissions = useMemo(() => {
    if (!user || !role) return []
    return computePermissions(user, role)
  }, [user, role])

  return { permissions, loading: loading || role === null }
}

// Composition chain: useDashboardData → useUserPermissions → useUser + useRole
function useDashboardData() {
  const { permissions, loading } = useUserPermissions()
  const { data, error } = useDashboardQuery(permissions)

  return { data, error, loading }
}
```

Rules for composition:
- Every hook in the chain must follow Rules of Hooks (same order on every render)
- Dependency chains are implicit — `useDashboardQuery` depends on `permissions`, which depends on `user` and `role`
- Stale closure in any link corrupts the entire chain
- Tests must cover each hook in isolation and combined

Common composition anti-patterns:

```typescript
// Bad: conditional hook call inside composition
function useSearch(query: string) {
  if (!query) return { results: [] }  // Early return — breaks hooks rule!
  const results = useSearchQuery(query) // Hook called conditionally!
  return { results }
}

// Good: guard inside the hook, not around the call
function useSearch(query: string) {
  const results = useSearchQuery(query) // Always called
  if (!query) return { results: [] } // Guard after hooks
  return { results }
}
```

> **Think**: Hook A calls Hook B. Hook B calls setState internally. When Hook A reads that state, is it stale?
>
> *Answer: Not if both hooks are in the same component. setState in Hook B triggers a re-render of the component, which re-runs both Hook A and Hook B. The state read by Hook A on the next render is the updated value. React guarantees that all hooks in a component see consistent state from the same render.*

### Refactoring Components into Custom Hooks

Extracting logic into custom hooks follows a pattern: identify pure-computation logic, lifecycle logic, and event handlers — then extract.

**Step 1: Identify extractable logic**

```typescript
// Before — everything in component
function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchUser(userId)
      .then(data => { if (!cancelled) setUser(data) })
      .catch(err => { if (!cancelled) setError(err) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [userId])

  const handleRetry = useCallback(() => {
    setError(null)
    setUser(null)
    // Re-trigger effect by toggling... awkward
  }, [])

  if (loading) return <Spinner />
  if (error) return <ErrorDisplay error={error} onRetry={handleRetry} />
  return <ProfileDisplay user={user} />
}
```

**Step 2: Extract into hook**

```typescript
function useUser(userId: string) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchUser(userId)
      .then(data => { if (!cancelled) setUser(data) })
      .catch(err => { if (!cancelled) setError(err) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [userId, retryCount])  // retryCount triggers refetch

  const refetch = useCallback(() => {
    setRetryCount(c => c + 1)
  }, [])

  return { user, loading, error, refetch }
}

// After — component is thin
function UserProfile({ userId }: { userId: string }) {
  const { user, loading, error, refetch } = useUser(userId)

  if (loading) return <Spinner />
  if (error) return <ErrorDisplay error={error} onRetry={refetch} />
  return <ProfileDisplay user={user} />
}
```

Guidelines:
- Extract when logic is reused across components
- Extract when logic makes a component hard to read (>50 lines of state/effect code)
- Keep render pure — the hook manages side effects; the component manages JSX
- Do not extract prematurely — one-off logic in a hook is indirection without benefit

> **Think**: A component has a single useEffect that fetches data and a handler for one button click. Should you extract into a custom hook?
>
> *Answer: Probably not. Extraction adds indirection (import, call, destructure) without reuse benefit. Wait until a second component needs the same logic. Exception: the hook makes testing easier — hooks tested with renderHook are simpler than component integration tests.*

### Testing Custom Hooks with renderHook

`@testing-library/react-hooks` provides `renderHook` for testing hooks outside components:

```typescript
import { renderHook, act } from '@testing-library/react'
import { useCounter } from './useCounter'

test('increments counter', () => {
  const { result } = renderHook(() => useCounter())

  act(() => {
    result.current.increment()
  })

  expect(result.current.count).toBe(1)
})

test('accepts initial value', () => {
  const { result } = renderHook(() => useCounter(10))

  expect(result.current.count).toBe(10)
})

test('resets counter', () => {
  const { result } = renderHook(() => useCounter(5))

  act(() => {
    result.current.increment()
    result.current.reset()
  })

  expect(result.current.count).toBe(5)
})
```

Key testing concerns:

**Mount/unmount behavior**:
```typescript
test('cleans up on unmount', () => {
  const cleanup = vi.fn()
  const { unmount } = renderHook(() => useInterval(cleanup, 1000))

  unmount()

  expect(cleanup).toHaveBeenCalled()
})
```

**Updating props**:
```typescript
test('updates when props change', () => {
  const { rerender, result } = renderHook(
    ({ id }) => useUser(id),
    { initialProps: { id: '1' } }
  )

  expect(result.current.user?.id).toBe('1')

  rerender({ id: '2' })

  expect(result.current.user?.id).toBe('2')
})
```

**Testing concurrent behavior**: React 18+ with `act` wraps state updates from concurrent features:
```typescript
test('handles concurrent state updates', async () => {
  const { result, waitForNextUpdate } = renderHook(() => useAsyncData())

  act(() => {
    result.current.fetch()
  })

  // Wait for async resolution
  await waitForNextUpdate()

  expect(result.current.data).toBeDefined()
})
```

> **Think**: A hook uses useSyncExternalStore. How does renderHook test changes from the external store?
>
> *Answer: Use act to trigger store mutation, then assert result.current reflects the change. For Zustand: `act(() => useStore.getState().update(...))`. For Redux: `act(() => store.dispatch(...))`. renderHook re-renders when the external store notifies subscribers via useSyncExternalStore.*

### Custom Hooks for React 19: use(), useOptimistic, useActionState Wrappers

React 19 hooks can be wrapped in custom hooks for ergonomic APIs:

```typescript
// Wrapping use() for promise-based data fetching
function usePromise<T>(promise: Promise<T>): T {
  return use(promise)
}

// Wrapping useActionState with typed action
function useFormSubmit<T>(
  action: (prev: T, formData: FormData) => Promise<T>,
  initial: T
): [T, (formData: FormData) => void, boolean] {
  return useActionState(action, initial)
}

// Wrapping useOptimistic with rollback
function useOptimisticUpdate<T>(
  key: string,
  initial: T,
  reducer: (state: T, optimistic: T) => T
): [T, (value: T) => void, () => void] {
  const [optimisticState, setOptimisticState] = useOptimistic(
    initial,
    (state, optimistic: T) => reducer(state, optimistic)
  )

  const rollback = useCallback(() => {
    setOptimisticState(initial)  // Revert to server-confirmed state
  }, [initial, setOptimisticState])

  return [optimisticState, setOptimisticState, rollback]
}
```

Key insight: `use()` is particularly useful inside custom hooks because it reads promises/context mid-render without useEffect:

```typescript
function useUserWithPosts(userId: string) {
  const userPromise = fetchUser(userId)
  const user = use(userPromise)
  const postsPromise = fetchPosts(user.id)
  const posts = use(postsPromise)
  return { user, posts }
}
```

> **Think**: Can a custom hook calling use() be used inside Server Components? Why or why not?
>
> *Answer: Only if the custom hook does not use client-only APIs (useState, useEffect, event handlers). use() itself works in both Server and Client Components. But if the hook wraps use() alongside any client hooks, it becomes a Client Component hook and requires 'use client' directive. Server Components can only call hooks that are entirely server-compatible.*

### Custom Hooks + Server Components: Client-Only Hooks, RSC for Server

Server Components cannot use hooks that depend on client state (useState, useEffect, useRef, event handlers). Hooks that only use `use()` (promise/context reading) are Server Component compatible:

```typescript
// Server-compatible hook: only use()
function useData<T>(promise: Promise<T>): T {
  return use(promise)
}

// NOT server-compatible: uses useState
function useLocalStorage<T>(key: string, initial: T): [T, (v: T) => void] {
  // Requires 'use client'
}

// Solution: split into server and client hooks
// useData.server.ts — Server Component compatible
// useLocalStorage.client.ts — Client Component only
```

Naming convention for clarity:
- `use*` — may be server-compatible if it only calls use()
- `use*` — client-only if it uses useState, useEffect, useRef, etc.

Document explicitly:
```typescript
/**
 * Client-only hook. Requires `'use client'` directive.
 * Reads localStorage and synchronizes across tabs.
 */
function useLocalStorage<T>(...): [T, (v: T) => void] {
  // ...
}
```

> **Think**: You have a custom hook that reads from a Zustand store (useSyncExternalStore internally) and formats the data. Can this run in a Server Component?
>
> *Answer: No. useSyncExternalStore subscribes to a mutable external store, which is inherently client-side. Server Components have no store subscriptions, no mutation, no event loop. The hook must be marked 'use client'. The data formatting logic (pure function) could be extracted to a utility function shared by both server and client.*

### Custom Hooks with External Stores: useSyncExternalStore

`useSyncExternalStore` is the bridge between React and external state (Zustand, Redux, Jotai, global caches):

```typescript
// Generic hook for subscribing to any external store
function useExternalStore<T>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => T
): T {
  return useSyncExternalStore(subscribe, getSnapshot)
}
```

Real-world usage — Zustand adapter:
```typescript
import { create } from 'zustand'

interface BearStore {
  bears: number
  increase: () => void
}

const useBearStore = create<BearStore>((set) => ({
  bears: 0,
  increase: () => set((state) => ({ bears: state.bears + 1 })),
}))

// Custom hook wrapping Zustand selector for type-safe access
function useBears(): number {
  return useBearStore((state) => state.bears)
}

// Custom hook with derived data from external store
function useBearSummary(): { total: number; label: string } {
  const bears = useBearStore((state) => state.bears)
  return useMemo(() => ({
    total: bears,
    label: `We have ${bears} bear${bears === 1 ? '' : 's'}`,
  }), [bears])
}
```

Redux adapter pattern:
```typescript
import { useSelector, useDispatch } from 'react-redux'

function useUserFromStore(userId: string): User | undefined {
  return useSelector((state: RootState) =>
    state.users.entities[userId]
  )
}
```

The key constraint: `getSnapshot` must return the same reference if data has not changed. If it creates a new object every call, React re-renders infinitely:

```typescript
// Bad: new object every render
function useBadStoreData() {
  return useSyncExternalStore(subscribe, () => ({
    value: store.getValue(),
  }))
}

// Good: memoized snapshot or primitive
function useGoodStoreData() {
  return useSyncExternalStore(subscribe, () => store.getValue())
}
```

> **Think**: A Zustand store has 50 slices. A component only needs one slice. What happens if the hook reads the entire store?
>
> *Answer: Every store change triggers re-render of the component, even changes to unrelated slices. Always use selectors to read minimal data: `const bears = useBearStore(s => s.bears)`. Zustand's `useStore` with selector only triggers re-render when the selected value changes.*

### Hook Lifecycle: Mount, Update, Unmount in Concurrent Mode

In React 18+ concurrent mode, hooks may mount and unmount multiple times before committing (StrictMode double-invoke). Custom hooks must handle this:

```typescript
function useSubscription<T>(subscribe: (value: T) => () => void, initial: T) {
  const [value, setValue] = useState(initial)

  useEffect(() => {
    // In StrictMode + concurrent, this runs twice (mount → cleanup → mount)
    // Each subscription/unsubscription pair must be idempotent
    const cleanup = subscribe((newValue) => {
      // setValue may be interrupted if a higher-priority update comes in
      // React discards the render if interrupted — no problem
      setValue(newValue)
    })
    return cleanup
  }, [subscribe])

  return value
}
```

Safe patterns for concurrent mode:

```typescript
// Pattern 1: Cleanup in effect
useEffect(() => {
  const sub = source.subscribe(handler)
  return () => sub.unsubscribe()
}, [dep])

// Pattern 2: useRef for mutable state (survives re-render, no re-subscribe)
const handlerRef = useRef<Handler>()
handlerRef.current = handler  // Always latest handler, no re-subscribe needed

useEffect(() => {
  const sub = source.subscribe((v) => handlerRef.current?.(v))
  return () => sub.unsubscribe()
}, [])  // Subscribe once, handler always fresh via ref

// Pattern 3: useSyncExternalStore (handles tearing correctly in concurrent mode)
function useExternalValue<T>(store: { getValue: () => T; subscribe: (cb: () => void) => () => void }) {
  return useSyncExternalStore(store.subscribe, store.getValue)
}
```

> **Think**: A custom hook creates a WebSocket connection in useEffect. In concurrent mode, the component mounts, the hook connects WebSocket, then a higher-priority update causes React to discard the render. What happens to the WebSocket?
>
> *Answer: React runs the cleanup function (disconnect WebSocket) on the discarded render. Then remounts and re-connects. The WebSocket sees connect → disconnect → connect sequence. The hook must handle this: clean up old connection, tolerate brief disconnect, and re-establish. This is why connection management in effects must be idempotent.*

### Avoiding Stale Closures in Custom Hooks

Stale closures occur when a callback captures a value from an older render:

```typescript
// Stale closure: onClick captures initial count forever
function useCounter() {
  const [count, setCount] = useState(0)

  const onClick = useCallback(() => {
    console.log(count)  // Always logs 0 if deps missing
  }, [])  // Bug: count missing from deps

  return { count, onClick }
}
```

Solutions:

```typescript
// Solution 1: Correct deps
function useCounter() {
  const [count, setCount] = useState(0)
  const onClick = useCallback(() => {
    console.log(count)
  }, [count])
  return { count, onClick }
}

// Solution 2: Functional update (if callback only needs to set state)
function useCounter() {
  const [count, setCount] = useState(0)
  const increment = useCallback(() => {
    setCount(c => c + 1)  // No closure over count
  }, [])
  return { count, increment }
}

// Solution 3: Ref for latest value (callback never changes)
function useCounter() {
  const [count, setCount] = useState(0)
  const countRef = useRef(count)
  countRef.current = count  // Always up-to-date

  const onClick = useCallback(() => {
    console.log(countRef.current)  // Reads latest, no re-subscribe
  }, [])

  return { count, onClick }
}

// Solution 4: useEvent (React 19 — stable callback with latest values)
// Not yet stable, but the pattern exists: callback always gets fresh values
// without appearing in deps array
```

Pattern 3 (ref) is essential for callbacks passed to external systems (subscriptions, event listeners) where you cannot change the subscription on every render.

> **Think**: A custom hook receives an onChange callback prop and calls it from an internal useEffect. Should onChange be in the useEffect deps?
>
> *Answer: Yes, if onChange is used inside the effect. Missing it causes stale closure — the effect captures the first onChange and never calls the latest. If performance is a concern (onChange changes every render), wrap onChange in a ref inside the hook: `const onChangeRef = useRef(onChange); onChangeRef.current = onChange;`. Then the effect deps can be empty, always calling the latest onChange via ref.*

### Publishing Custom Hooks as Libraries

Publishing custom hooks requires attention to typing, documentation, and versioning:

**Typing**:
```typescript
// Publish ESM + CJS. Export types explicitly.
export interface UseDebounceOptions {
  leading?: boolean
  trailing?: boolean
  maxWait?: number
}

export function useDebounce<T>(
  value: T,
  delay: number,
  options?: UseDebounceOptions
): T

// Generic hooks should infer types where possible
export function useLocalStorage<T>(
  key: string,
  initial: T
): [T, (value: T | ((prev: T) => T)) => void]
```

**Package structure**:
```
use-custom-hooks/
├── package.json          # name, version, types, exports
├── src/
│   ├── index.ts          # Re-export all hooks
│   ├── useDebounce.ts    # Single hook per file
│   ├── useLocalStorage.ts
│   └── __tests__/
│       ├── useDebounce.test.ts
│       └── useLocalStorage.test.ts
├── tsconfig.json
└── README.md
```

**Documentation per hook**:
```typescript
/**
 * Debounces a value by `delay` ms.
 *
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds
 * @param options.leading - Call on leading edge (default: false)
 * @param options.trailing - Call on trailing edge (default: true)
 *
 * @example
 * ```typescript
 * const debouncedSearch = useDebounce(searchTerm, 300)
 * ```
 */
```

**Backward compatibility rules**:
- Never change return type between major versions — tuple → object is breaking
- Adding optional parameters is non-breaking (minor)
- Removing a parameter is breaking (major)
- Renaming a hook is breaking — deprecate with JSDoc `@deprecated` for one major version before removal

**Testing requirements for published hooks**:
- Node.js + jsdom or happy-dom environment
- Tests must not depend on browser APIs without polyfill (localStorage, matchMedia)
- Coverage: mount, unmount, prop change, concurrent mode, edge cases (empty arrays, null values)
- Document peer dependencies (React 18+/React 19+)

> **Think**: Your hook uses useSyncExternalStore internally. What React version peer dependency should you set?
>
> *Answer: React 18+. useSyncExternalStore shipped in React 18. For React 17 compatibility, you would need a shim (use-sync-external-store package). In a React-19-focused library, set `"peerDependencies": { "react": "^18.0.0 || ^19.0.0" }` to support both.*

---

### Why This Matters

Custom hooks are React's primary abstraction for reusable stateful logic. Every React team builds them. Poor hook design creates stale closures, impossible-to-trace re-render cascades, and duplicated logic scattered across components. Hook composition connects smaller hooks into powerful APIs — but each link in the chain must be correct. Testing hooks with renderHook catches lifecycle bugs before they reach production. React 19's new hooks (use(), useOptimistic, useActionState) extend the custom hook pattern: wrapping these in ergonomic custom hooks is how you build team-level abstractions. Publishing hooks as libraries scales your patterns across projects — but poor typing and breaking changes destroy trust in your library. Master custom hooks to master React architecture.

---

### Common Questions

**Q: Can I call a hook conditionally? What about inside a callback?**
A: No and no. Rules of Hooks are absolute: call hooks at the top level of the component or custom hook, never inside conditions, loops, or callbacks. React relies on hook call order being identical across renders. If you need conditional behavior, move the condition inside the hook or use the hook's return value to conditionally render.

**Q: When should I extract logic into a custom hook vs keeping it in the component?**
A: Extract when: (1) the same logic appears in 2+ components, (2) the component is >50 lines of state/effect logic, (3) you need to test the logic in isolation (renderHook is simpler than component integration tests). Do not extract prematurely — one-off logic in a hook is indirection without benefit.

**Q: How do I test a hook that uses useRef for DOM access?**
A: Create a wrapper component that renders a DOM element with ref, pass the ref to the hook via initial props or a setup function. Alternatively, renderHook with a wrapper component that provides the DOM structure. Example: `renderHook(() => useMeasure(), { wrapper: MeasureWrapper })`.

**Q: What happens to custom hooks during React 19's StrictMode double-invoke?**
A: Effects run twice (mount → cleanup → mount). State is preserved between renders because the double-invoke happens during render phase before the state is committed. Custom hooks must handle: cleanup functions running twice, subscriptions being created/removed/created. If your effect is not idempotent, StrictMode exposes the bug.

**Q: Can a custom hook return JSX?**
A: Technically yes (hooks can return ReactNode). But this is an anti-pattern — hooks should return data/actions, not markup. JSX belongs in components. If you need to render something, create a component that uses the hook. The separation keeps hooks testable and components composable.

---

## Examples

### Example 1: Composing Hooks for a Collaborative Dashboard

**Problem**: Build a real-time dashboard hook that combines WebSocket subscriptions, user permissions, and data transformation. Must handle concurrent mode, reconnect on disconnect, and respect permission changes without stale data.

```typescript
interface DashboardState {
  widgets: Widget[]
  connected: boolean
  error: Error | null
}

// Hook 1: WebSocket connection (base)
function useWebSocket(url: string): {
  lastMessage: MessageEvent | null
  send: (data: unknown) => void
  connected: boolean
} {
  const [lastMessage, setLastMessage] = useState<MessageEvent | null>(null)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const messageHandlerRef = useRef<(e: MessageEvent) => void>()

  // Always update ref with latest handler — avoids re-subscribe
  messageHandlerRef.current = (e: MessageEvent) => {
    setLastMessage(e)
  }

  useEffect(() => {
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onmessage = (e) => messageHandlerRef.current?.(e)

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [url])

  const send = useCallback((data: unknown) => {
    wsRef.current?.send(JSON.stringify(data))
  }, [])

  return { lastMessage, send, connected }
}

// Hook 2: User permissions (composes on useWebSocket + data)
function useDashboardData(workspaceId: string): DashboardState {
  const { lastMessage, connected, send } = useWebSocket(
    `wss://api.example.com/workspaces/${workspaceId}`
  )

  const [widgets, setWidgets] = useState<Widget[]>([])
  const [error, setError] = useState<Error | null>(null)

  // Process incoming messages
  useEffect(() => {
    if (!lastMessage) return

    try {
      const data = JSON.parse(lastMessage.data)
      switch (data.type) {
        case 'widgets:update':
          setWidgets(data.payload)
          setError(null)
          break
        case 'widgets:error':
          setError(new Error(data.payload.message))
          break
      }
    } catch {
      setError(new Error('Failed to parse message'))
    }
  }, [lastMessage])

  // Request initial data once connected
  useEffect(() => {
    if (connected) {
      send({ type: 'widgets:subscribe', workspaceId })
    }
    return () => {
      send({ type: 'widgets:unsubscribe', workspaceId })
    }
  }, [connected, workspaceId, send])

  return { widgets, connected, error }
}

function Dashboard({ workspaceId }: { workspaceId: string }) {
  const { widgets, connected, error } = useDashboardData(workspaceId)

  if (error) return <ErrorBanner message={error.message} />
  if (!connected) return <div>Connecting...</div>
  return <WidgetGrid widgets={widgets} />
}
```

**Result**: Three-hook composition chain cleanly separates concerns. WebSocket management is reusable across other features. Permission-aware data fetching composes on top. Concurrent mode safe — each effect cleans up properly. Component stays thin.

### Example 2: Refactoring a Heavy Component into Testable Hooks

**Problem**: Filterable, searchable data table with pagination. Component is 300 lines mixing data fetching, filtering logic, pagination state, and UI. Hard to test, hard to change.

**Refactoring**:

```typescript
// Hook 1: Pagination
function usePagination<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(0)
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const pageItems = useMemo(
    () => items.slice(page * pageSize, (page + 1) * pageSize),
    [items, page, pageSize]
  )

  const nextPage = useCallback(() => {
    setPage(p => Math.min(p + 1, totalPages - 1))
  }, [totalPages])

  const prevPage = useCallback(() => {
    setPage(p => Math.max(p - 1, 0))
  }, [])

  return { page, totalPages, pageItems, nextPage, prevPage }
}

// Hook 2: Search + filter
function useSearchFilter<T>(
  items: T[],
  searchFields: (keyof T)[]
): { filtered: T[]; search: string; setSearch: (s: string) => void } {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return items
    const query = search.toLowerCase()
    return items.filter(item =>
      searchFields.some(field => {
        const val = item[field]
        return String(val).toLowerCase().includes(query)
      })
    )
  }, [items, search, searchFields])

  return { filtered, search, setSearch }
}

// Hook 3: Data fetching
function useDataTable<T>(endpoint: string) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(endpoint)
      .then(r => r.json())
      .then(d => { if (!cancelled) setData(d) })
      .catch(e => { if (!cancelled) setError(e) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [endpoint])

  return { data, loading, error }
}

// Composed component
function DataTablePage({ endpoint }: { endpoint: string }) {
  const { data, loading, error } = useDataTable<Record<string, unknown>>(endpoint)
  const { filtered, search, setSearch } = useSearchFilter(data, ['name', 'email'])
  const { page, totalPages, pageItems, nextPage, prevPage } = usePagination(filtered, 20)

  if (loading) return <Spinner />
  if (error) return <ErrorBanner error={error} />

  return (
    <div>
      <SearchInput value={search} onChange={setSearch} />
      <Table data={pageItems} />
      <Pagination page={page} total={totalPages} onNext={nextPage} onPrev={prevPage} />
    </div>
  )
}
```

**Testing** (each hook in isolation):

```typescript
// Test usePagination
test('usePagination advances pages', () => {
  const items = Array.from({ length: 50 }, (_, i) => i)
  const { result } = renderHook(() => usePagination(items, 10))

  expect(result.current.page).toBe(0)
  expect(result.current.pageItems).toHaveLength(10)

  act(() => result.current.nextPage())
  expect(result.current.page).toBe(1)
  expect(result.current.pageItems[0]).toBe(10)
})

// Test useSearchFilter
test('useSearchFilter filters by field', () => {
  const items = [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' },
  ]

  const { result } = renderHook(() => useSearchFilter(items, ['name', 'email']))

  act(() => result.current.setSearch('bob'))
  expect(result.current.filtered).toHaveLength(1)
  expect(result.current.filtered[0].id).toBe(2)
})
```

**Result**: 300-line component → 3 testable hooks + 30-line component. Each hook tested in isolation. Search/filter logic tested without DOM. Pagination boundary conditions tested. DataTablePage only composes and renders.

### Example 3: Publishing a useDebounce Hook as a Library

**Problem**: Your team uses `useDebounce` across 5 projects. Extract into a published npm package with proper typing, tests, and documentation.

```typescript
// src/useDebounce.ts
export interface UseDebounceOptions {
  leading?: boolean
  trailing?: boolean
  maxWait?: number
}

const defaultOptions: UseDebounceOptions = {
  leading: false,
  trailing: true,
}

export function useDebounce<T>(
  value: T,
  delay: number,
  options: UseDebounceOptions = {}
): T {
  const [debouncedValue, setDebouncedValue] = useState(value)
  const { leading = false, trailing = true, maxWait } = {
    ...defaultOptions,
    ...options,
  }

  // Ref for maxWait
  const maxWaitRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastCallRef = useRef(Date.now())

  useEffect(() => {
    if (leading && !trailing) {
      setDebouncedValue(value)
    }

    const timer = setTimeout(() => {
      if (trailing) {
        setDebouncedValue(value)
      }
      if (maxWaitRef.current) {
        clearTimeout(maxWaitRef.current)
        maxWaitRef.current = null
      }
    }, delay)

    // Max wait enforcement
    if (maxWait && trailing) {
      const elapsed = Date.now() - lastCallRef.current
      if (!maxWaitRef.current && elapsed >= maxWait) {
        setDebouncedValue(value)
      }
      if (!maxWaitRef.current) {
        maxWaitRef.current = setTimeout(() => {
          setDebouncedValue(value)
          maxWaitRef.current = null
        }, maxWait)
      }
    }

    lastCallRef.current = Date.now()

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay, leading, trailing, maxWait])

  return debouncedValue
}
```

Package.json:
```json
{
  "name": "@acme/use-debounce",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "lint": "eslint src/"
  }
}
```

**Result**: Published hook with typed API, dual ESM/CJS, tested across React 18/19. Teams install and use without understanding internals.

---

## Key Takeaways
- Custom hooks must follow naming (`use*`), return type conventions (tuple for 2-value state+setter, object for 3+), and parameters pattern (options object for optional params)
- Hook composition chains dependencies — stale closures in any link corrupt the entire chain
- Refactoring: identify state + effects + handlers, extract into hook, keep component thin and pure
- renderHook tests hooks in isolation: mount, update props, unmount, async behavior via act
- React 19 hooks (use(), useOptimistic, useActionState) can be wrapped in custom hooks for ergonomic team APIs
- Server Components can only use hooks restricted to use() — client hooks need `'use client'`
- useSyncExternalStore bridges React and external stores — snapshot must be referentially stable
- Concurrent mode double-invokes effects — hooks must handle mount → cleanup → mount idempotently
- Stale closure solutions: correct deps, functional updates, refs for latest values, useEvent pattern
- Published hooks need typed exports, dual CJS/ESM, peer deps, comprehensive tests, and semver discipline

## Common Misconception

**"Custom hooks re-run all their internal state when the component re-renders."**

Custom hooks do not "reset" state on re-render. State (useState) persists across renders — the hook function re-executes, but existing state is preserved until explicitly set. The component and its hooks share a single render cycle: the component calls `useCounter()`, which calls `useState(0)` — on first render, initial value is 0; on subsequent renders, useState returns the persisted state value. Each re-render calls the hook function again, recomputing useMemo, useCallback values, and evaluating effects — but state survives. This is why Rules of Hooks matter: React pairs hook calls with persisted state by call order. Breaking call order (conditional hook) breaks the pairing and corrupts state.

---

## Feynman Explain
(Explain custom hooks to a developer who knows functions and useState but has never created a custom hook. Use no jargon about composition, render lifecycle, or closures. Describe the problem: "You wrote the same data-fetching logic in 3 components." Explain how extracting it into a function that uses other hooks works. Show that the function is just a function — React tracks hook state by call order, not by the function that calls them.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain` — AI probes gaps.*

---

## Reframe
(Pause. Critique: Custom hooks are powerful but composability has a cost — debugging a chain of 5 composed hooks requires tracing through each one, and a stale closure in any link corrupts the entire chain. Server Components restrict hooks severely — do custom hooks have a future in an RSC-dominant architecture? Write your evaluation. Consider: when does composition become obfuscation, whether hooks are the right abstraction for server-compatible logic, and what alternatives (shared utilities, context, render props) compete with hooks.)

---

## Drill
Take the quiz. MCQs test hook conventions, composition patterns, testing strategies, React 19 hook wrappers, and stale closure prevention.

Run: `learn.sh quiz advanced-react-19 18-custom-hooks`

## Quiz: 18-custom-hooks


### When should a custom hook return an object instead of a tuple?

- [ ] A: When there is exactly one return value

- [ ] B: When there are two return values in state+setter pattern

- [✓] C: When there are three or more named return values

- [ ] D: Custom hooks should always return tuples


**Answer:** C

Objects with named properties are clearer for 3+ return values — destructuring by name avoids positional confusion. Tuples follow the useState convention for 2-element state+setter pairs. Single values can be returned directly.


### What happens if a custom hook calls another hook conditionally?

- [ ] A: React ignores the hook call and continues

- [✓] B: React throws an error — Rules of Hooks violation

- [ ] C: The hook works but returns undefined on skipped calls

- [ ] D: Conditional hook calls are valid in custom hooks


**Answer:** B

Rules of Hooks apply to custom hooks too — hooks must be called in the same order on every render. Conditional calls break React's internal hook-to-state pairing. Move the condition inside the hook or guard after all hook calls.


### Which strategy prevents stale closures in a custom hook callback without adding deps?

- [ ] A: Wrap the callback in useMemo instead of useCallback

- [✓] B: Store the latest value in a ref, read from ref inside the callback

- [ ] C: Use async/await to ensure fresh values

- [ ] D: Define the callback outside the custom hook


**Answer:** B

Refs always hold the latest value without triggering re-render or re-subscription. The pattern: `const ref = useRef(value); ref.current = value;` then read `ref.current` inside the callback. The callback reference stays stable, but reads fresh values.


### A custom hook internally uses useSyncExternalStore to subscribe to a Zustand store. Which condition is required to prevent infinite re-renders?

- [ ] A: getSnapshot must return a new object on every call

- [✓] B: getSnapshot must return a referentially stable value when data has not changed

- [ ] C: The store must use immer for immutability

- [ ] D: Subscribe must call the callback synchronously


**Answer:** B

useSyncExternalStore compares getSnapshot return values with Object.is. If getSnapshot creates a new object each time (even with same data), React detects a 'change' every render and re-renders infinitely. Return primitives or memoized objects from getSnapshot.


### You are testing a custom hook with renderHook. The hook subscribes to an event source in useEffect. How do you verify cleanup runs correctly?

- [ ] A: Assert on the return value of renderHook

- [✓] B: Call unmount() from renderHook result, then assert the subscription was removed

- [ ] C: Rerender the hook with new props

- [ ] D: Use waitForNextUpdate to check cleanup


**Answer:** B

unmount() triggers the effect cleanup function. After unmount, assert that the subscription's unsubscribe/disconnect was called (spy on subscribe, check cleanup callback). Mount/unmount testing covers React 19's StrictMode double-invoke behavior.


### A custom hook wraps useActionState for form submission. Where should error handling logic live?

- [✓] A: Inside the action function — catch errors and return error state

- [ ] B: In a useEffect that watches the state for errors

- [ ] C: In the component's ErrorBoundary

- [ ] D: In the hook's cleanup function


**Answer:** A

Action errors must be caught inside the action function and returned as state. ErrorBoundary does not catch action errors (they run in event handlers, not render). useEffect-based error watching adds latency. The action function is the correct single source of error state.


### Which custom hook can be safely used inside a Server Component?

- [ ] A: A hook that uses useState and useEffect for data fetching

- [✓] B: A hook that only calls use() to read a promise

- [ ] C: A hook that uses useSyncExternalStore to subscribe to a Redux store

- [ ] D: A hook that calls useRef for DOM access


**Answer:** B

Server Components can only use hooks that don't depend on client state. use() (promise/context reading) works on both server and client. useState, useEffect, useRef, useSyncExternalStore all require client-side execution and need the 'use client' directive.


### A custom hook chain looks like: useDashboardData calls useUserPermissions calls useUser. A stale closure in useUser corrupts useUserPermissions and useDashboardData. What is the minimal testing strategy?

- [ ] A: Test only useDashboardData — integration test covers the chain

- [✓] B: Test each hook in isolation, then test the composed behavior

- [ ] C: Test only useDashboardData with integration test, skip unit tests for sub-hooks

- [ ] D: Stale closures cannot be tested — rely on TypeScript


**Answer:** B

Each hook should be unit-tested in isolation (mount, update props, unmount, edge cases). Then test the composed hook to verify data flows correctly through the chain. Integration tests alone cannot isolate which link has a stale closure. Unit tests pinpoint the failure.


### In React 19 concurrent mode, a custom hook's useEffect subscribes to a WebSocket. The component mounts, the effect fires, then a higher-priority update causes React to discard the render. What happens to the WebSocket connection?

- [ ] A: The WebSocket stays connected — React never unmounts discarded renders

- [✓] B: React runs the effect cleanup (disconnect), then re-runs effect (reconnect) — the WebSocket sees connect→disconnect→connect

- [ ] C: React defers the effect until the higher-priority update commits

- [ ] D: The WebSocket connection is paused but not closed


**Answer:** B

In concurrent mode, when a render is discarded, React runs cleanup for effects from that render, then re-runs effects when the render commits. This means WebSocket sees connect → disconnect → connect. The hook must handle this idempotently — tolerate brief disconnects and clean up stale connections.


### You are publishing a custom hook library. Which change is considered breaking and requires a major version bump?

- [ ] A: Adding an optional parameter with a default value

- [✓] B: Changing the return type from tuple [T, (v: T) =&gt; void] to object { value: T; setValue: (v: T) =&gt; void }

- [ ] C: Adding a new hook export to the package

- [ ] D: Updating internal implementation to use useCallback instead of inline functions


**Answer:** B

Return type changes break all consumers — every call site must update destructuring. Adding optional parameters (A) is backward compatible. Adding new exports (C) is additive. Internal implementation changes (D) do not affect the public API. Follow semver: breaking changes = major, features = minor, patches = patch.


---

# Module 19: Micro-Frontends — Module Federation, Shared State, Boundaries

Est. study time: 2h
Language: en

## Learning Objectives
- Architect micro-frontends using Module Federation with Webpack 5 / Rspack
- Manage shared state, routing, and communication across federated apps
- Apply boundaries: styling isolation, error containment, independent deployments
- Compose Server Components across micro-frontend boundaries

---

## Core Content

### Module Federation — Webpack 5 / Rspack

Module Federation lets separate builds share code at runtime. Each micro-frontend is its own webpack build. One app (shell) exposes a container; remote apps expose modules the container loads.

**Concepts:**

| Term | Meaning |
|------|---------|
| Host | App that loads remotes — usually shell |
| Remote | App that exposes modules for other apps |
| Shared | Dependencies configured as singletons (e.g., React) |
| Container | Runtimes module registry — webpack-generated entry |

Webpack 5 config (host):

```typescript
// webpack.config.js
new ModuleFederationPlugin({
  name: 'shell',
  remotes: {
    dashboard: 'dashboard@http://cdn.example.com/dashboard/remoteEntry.js',
    checkout: 'checkout@http://cdn.example.com/checkout/remoteEntry.js',
  },
  shared: {
    react: { singleton: true, requiredVersion: '^19.0.0' },
    'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
  },
})
```

Rspack (Rust-based webpack-compatible bundler):

```typescript
// rspack.config.js — identical API
new rspack.container.ModuleFederationPlugin({
  name: 'dashboard',
  exposes: {
    './Dashboard': './src/Dashboard',
  },
  shared: {
    react: { singleton: true },
  },
})
```

> **Think**: Why does React need `singleton: true` in Module Federation? What happens if two remotes load different React versions?
>
> *Answer: React uses internal module-scoped state (fiber tree, event system). Two copies of React create two fiber trees — context, hooks, events break. Singleton forces one copy. Version conflicts require aligning peer deps or using `eager: true` + fallback. If A requires React 19 and B requires React 18, one app breaks.*

### React 19 — Shared Singleton, Version Conflicts

React 19 amplifies singleton pressure: `use()` hook, Server Components, Actions, and compiler-generated code all depend on single React runtime.

**Strategies:**

1. **Align versions across teams** — standardize on one React version. CI enforces via shared config package.

2. **Federation `shared` fallback** — if remote has React 19.1 and host has React 19.0, webpack picks highest satisfying version. Only works with semver-compatible ranges.

3. **Eager loading** — host loads React eagerly, remotes skip bundling React. Reduces duplication but requires deployment coordination.

```typescript
shared: {
  react: {
    singleton: true,
    requiredVersion: '^19.0.0',
    eager: true, // host provides eagerly
  },
}
```

4. **Module Federation wrapper** — wrap federated component in version-check wrapper:

```typescript
function FederatedComponent({ remote, module }: Props) {
  const Component = React.lazy(() =>
    import(remote).then(m => ({ default: m[module] }))
  )
  return (
    <ErrorBoundary fallback={<p>Micro-frontend unavailable</p>}>
      <Suspense fallback={<Spinner />}>
        <Component />
      </Suspense>
    </ErrorBoundary>
  )
}
```

> **Think**: Your checkout team ships React 19.0. Your dashboard team ships React 19.2. Federation `requiredVersion: '^19.0.0'` picks 19.2. Dashboard tests pass. Checkout tests break. Why?
>
> *Answer: React 19.2 may have behavior changes or removed APIs used by checkout's internal deps. Federation picks highest matching version, not safest. Each team must test against the shared version.*

### Micro-Frontend Routing — Shell Pattern

Shell owns primary router (React Router v7). Sub-apps own internal routes.

**Shell router:**

```typescript
// Shell app — React Router v7
function ShellRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="/dashboard/*" element={<DashboardWrapper />} />
          <Route path="/checkout/*" element={<CheckoutWrapper />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

// Wrapper passes context to federated remote
function DashboardWrapper() {
  const basename = '/dashboard'
  return (
    <MicroFrontendApp
      remote="dashboard"
      module="./Dashboard"
      basename={basename}
    />
  )
}
```

**Sub-app router** (dashboard remote):

```typescript
// Dashboard remote — receives basename from shell
function DashboardApp({ basename }: { basename: string }) {
  return (
    <MemoryRouter initialEntries={[basename]}>
      {/* Routes use relative paths */}
      <Routes>
        <Route path="/dashboard" element={<Overview />} />
        <Route path="/dashboard/reports" element={<Reports />} />
      </Routes>
    </MemoryRouter>
  )
}
```

Key: sub-apps use `MemoryRouter` or receive full URL path. Shell owns the address bar. Routing coordination: shell navigates via `history.push`, sub-apps listen via custom event or shared bus.

> **Think**: User navigates to `/dashboard/reports` in shell. Dashboard remote must render Reports page. Who extracts the sub-path? Who handles 404 within dashboard?
>
> *Answer: Shell passes basename `/dashboard`. Dashboard remote uses relative routing. Dashboard remote handles its own 404 for `/dashboard/xyz`. Shell catches 404 only when no remote route matches. Coordination: shell strips prefix, remote renders from basename.*

### Shared State Across Micro-Frontends

**Four approaches ranked by coupling:**

| Approach | Coupling | Latency | Complexity |
|----------|----------|---------|------------|
| Custom events | Low | Sync | Low |
| Shared bus (Zustand) | Medium | Sync | Medium |
| Context bridge | High | Sync | High |
| iframe postMessage | None | Async | Medium |

**1. Custom events** — least coupling:

```typescript
// Shell fires event
window.dispatchEvent(
  new CustomEvent('mf:auth-change', { detail: { user, token } })
)

// Remote listens
useEffect(() => {
  const handler = (e: CustomEvent) => {
    setUser(e.detail.user)
  }
  window.addEventListener('mf:auth-change', handler)
  return () => window.removeEventListener('mf:auth-change', handler)
}, [])
```

**2. Shared store (Zustand)** — create store in shell, import in remotes via shared dependency:

```typescript
// Shell — exposes Zustand storeModuleFederationPlugin({
  exposes: {
    './store': './src/store',
  },
  shared: { zustand: { singleton: true } },
})

// Remote — imports store from shell
import { useBoundStore } from 'shell/store'

function CartBadge() {
  const count = useBoundStore(state => state.cartCount)
  return <Badge>{count}</Badge>
}
```

**3. Context bridge** — React context across remotes:

```typescript
// Shell wraps federated component with context provider object
function Shell() {
  return (
    <ThemeProvider theme={theme}>
      <UserProvider user={user}>
        <FederatedComponent remote="dashboard" module="./App" />
      </UserProvider>
    </ThemeProvider>
  )
}
```

> **Think**: Context bridge works across micro-frontends. Does React context in shell propagate into remote app? What is the constraint?
>
> *Answer: Yes — but only if React is a shared singleton. Two React instances create separate context trees. Singleton React ensures context flows through. Constraint: both apps run in same browser context (not iframes).*

> **Think**: Custom events vs shared Zustand store: when would you pick shared store?
>
> *Answer: Shared store when >3 micro-frontends read/write same state (user, cart, theme). Custom events when state flows one direction (auth change → all apps re-login). Store gives devtools, persistence, selectors. Events give decoupling — sender does not know receivers.*

### Styling Boundaries — CSS Isolation

CSS leaks across micro-frontends. Class name collisions produce visual bugs.

**CSS Modules** — bundler-scoped class names:

```typescript
// dashboard/src/Button.module.css
.button { background: blue; }

// dashboard/src/Button.tsx
import styles from './Button.module.css'
function Button() { return <button className={styles.button} /> }
// Renders: <button class="Button_button_abc123" />
```

**Shadow DOM** — complete isolation:

```typescript
function MicroFrontendRoot() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const shadow = ref.current!.attachShadow({ mode: 'open' })
    const root = createRoot(shadow)
    root.render(<MicroApp />)
    return () => root.unmount()
  }, [])
  return <div ref={ref} />
}
```

Trade-offs:

| Approach | Isolation | Performance | Interop |
|----------|-----------|-------------|---------|
| CSS Modules | Class-scoped only | Zero | Full (DOM in same document) |
| Shadow DOM | Full (DOM, CSS, events) | Mount cost | Events retarget, forms break |
| CSS-in-JS | Per-component | Runtime cost | Full interop |

> **Think**: Shadow DOM isolates CSS completely. What breaks when a micro-frontend renders in shadow DOM?
>
> *Answer: Event retargeting — click events bubble out of shadow DOM with retargeted target (shadow root, not actual element). Form submissions inside shadow DOM are invisible to outer document. Third-party scripts (analytics, error trackers) may not see shadow DOM content. Portal-based modals may escape shadow boundary.*

### Cross-App Communication

**1. Window-level custom events** — best for broadcast:

```typescript
// Remote dashboard emits
const event = new CustomEvent('mf:navigate', { detail: { to: '/checkout' } })
window.dispatchEvent(event)

// Shell listens
useEffect(() => {
  const fn = (e: CustomEvent) => navigate(e.detail.to)
  window.addEventListener('mf:navigate', fn)
  return () => window.removeEventListener('mf:navigate', fn)
}, [navigate])
```

**2. Shared event bus** — pub/sub library shared via federation:

```typescript
// Shared event-bus package (singleton)
type Events = { userChanged: { id: string }; cartUpdated: { count: number } }
export const bus = {
  listeners: new Map(),
  on<K extends keyof Events>(k: K, fn: (d: Events[K]) => void) { ... },
  emit<K extends keyof Events>(k: K, d: Events[K]) { ... },
}
```

**3. iframe postMessage** — for third-party / untrusted micro-frontends:

```typescript
// Iframe host
iframeRef.current.contentWindow!.postMessage(
  { type: 'AUTH', payload: { token } },
  'https://trusted-origin.com'
)

// Iframe remote
window.addEventListener('message', (e) => {
  if (e.origin !== 'https://shell.com') return
  if (e.data.type === 'AUTH') setToken(e.data.payload.token)
})
```

> **Think**: postMessage is secure (origin check). What performance cost does iframe-based micro-frontend pay?
>
> *Answer: Full page-load per iframe — HTML, CSS, JS, React root mount. Memory doubles (separate JS heap per iframe). Communication is async (message queue). Lazy-mount iframes and use shared worker for data to reduce per-iframe JS memory.*

### Server Components with Micro-Frontends

React 19 Server Components (RSC) challenge micro-frontend boundaries. RSC runs on server — modules are not on CDN.

**Composition strategies:**

**1. Server-only shell** — RSC at shell level. Remote components are Client Components:

```typescript
// Shell (RSC)
import RemoteDashboard from 'dashboard/Dashboard'
// Remote Dashboard must be Client Component or RSC-compatible build

export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <RemoteDashboard />
    </Suspense>
  )
}
```

**2. RSC module federation** — experimental. Remote exposes RSC payload stream:

```typescript
// Webpack 5 + RSC plugin
new ModuleFederationPlugin({
  exposes: {
    './rsc/dashboard': 'http://internal/dashboard/rsc',
    // RSC endpoint returns RSC Payload (stream)
  },
})
```

Shell fetches RSC stream from remote server, renders on server, sends HTML to client. Remotes must support RSC transport protocol.

> **Think**: RSC micro-frontend vs client-only micro-frontend: which one makes deployment coordination harder?
>
> *Answer: RSC micro-frontend requires remote servers to be reachable at server-render time. If dashboard remote server is down, shell SSR fails for the entire page. Client-only micro-frontend degrades to error fallback gracefully. RSC micro-frontends need independent server infrastructure and coordinated rollouts for server-side changes.*

### Performance — Lazy Loading, Chunk Splitting, Preloading

**Lazy loading** — load remote only when route matches:

```typescript
// Shell — lazy load remote entry
const DashboardApp = React.lazy(() =>
  import('dashboard/Dashboard').catch(() => ({
    default: () => <ErrorFallback />
  }))
)

function DashboardRoute() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardApp />
    </Suspense>
  )
}
```

**Preloading** — load remote before user navigates:

```typescript
// Preload on hover
<Link
  to="/dashboard"
  onMouseEnter={() => {
    // start preloading remote entry
    const link = document.createElement('link')
    link.rel = 'modulepreload'
    link.href = 'https://cdn.example.com/dashboard/remoteEntry.js'
    document.head.appendChild(link)
  }}
/>
```

**Chunk splitting** — each remote splits its own chunks:

```typescript
// Remote webpack config
output: {
  chunkFilename: '[name].[contenthash].js',
},
// Ensures remote updates do not invalidate shell chunks
```

> **Think**: Shell preloads dashboard remote on hover. User never navigates to dashboard — wasted bandwidth. Acceptable trade-off?
>
> *Answer: Yes — remoteEntry.js is typically 2-6 KB (module registry, not app code). The actual app chunks load only on navigation. Preloading remoteEntry is cheap insurance. App chunks should load on actual route activation, not on preload.*

### Deployment Strategies — Independent vs Coordinated

| Strategy | Coordination | Risk | Rollback |
|----------|-------------|------|----------|
| Independent | None per team | Version mismatch, integration bugs | Per-app |
| Coordinated | Release train (weekly) | Stale deploys wait | Coordinated |
| Hybrid | Independent + smoke tests | Edge cases | Per-app |

**Independent:**

```yaml
# dashboard CI
deploy:
  script: npm run build && aws s3 sync dist/ s3://mfe-dashboard/
  # No coordination with shell or checkout
```

**Coordinated** — all remotes deploy same day, same React version, tested together.

**Hybrid** — teams deploy independently, but CI runs integration suite against production shell + staging remotes:

```yaml
# Every remote PR triggers
integration-test:
  script:
    - npm run build
    - npm run test:integration -- --host=production --remotes=staging
```

> **Think**: Independent deploys let teams ship fast. What breaks when shell deploys new feature that expects updated dashboard remote — but dashboard deploys 2 days later?
>
> *Answer: Feature flag. Shell feature behind flag. Dashboard team toggles flag when ready. No flag = users see broken page. Module Federation's `shared` version negotiation can also degrade gracefully — but missing module API contracts are the real failure point.*

### Error Isolation — Crash Containment

Each micro-frontend in its own ErrorBoundary. One remote crashing must not take down shell or other remotes.

```typescript
// Shell — per-remote error boundary
function RemoteErrorBoundary({ children, name }: Props) {
  return (
    <ErrorBoundary
      fallback={
        <div role="alert">
          <h2>{name} unavailable</h2>
          <p>Contact support if this persists.</p>
        </div>
      }
      onError={(error) => {
        console.error(`[${name}]`, error)
        // report to error tracker with remote identifier
        reportError({ remote: name, error: error.message })
      }}
    >
      {children}
    </ErrorBoundary>
  )
}
```

**Additional isolation patterns:**

1. **Module-level ErrorBoundary** — wraps each exposed component, not just shell wrapper
2. **Crash-only design** — crashed micro-frontend remounts on navigation (MemoryRouter reset)
3. **Health check** — shell pings remote health endpoint before loading:

```typescript
async function loadRemoteWithHealthCheck(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${origin}/health`)
    return res.ok
  } catch {
    return false
  }
}
```

> **Think**: Dashboard remote throws during render. Shell ErrorBoundary catches it. Dashboard had open WebSocket connections, timers, third-party scripts. What leaks?
>
> *Answer: Effect cleanup runs on unmount (if remote unmounts). But if remote crashes mid-render, effects never mounted — so they cannot clean up. WebSocket stays open. Timer keeps firing. Solution: remote should use singleton cleanup registry that shell can invoke on crash.*

---

### Why This Matters

Micro-frontends let large teams ship independently. Module Federation makes this practical by sharing dependencies at runtime instead of duplicating them. React 19 raises the stakes: singleton React is mandatory, RSC composition introduces server-side coupling, and error isolation becomes critical when multiple React roots coexist. Teams that master boundaries — state, style, routing, errors — scale React apps across dozens of teams without monolith collapse.

---

### Common Questions

**Q: Micro-frontend vs monorepo — what is the real difference?**
A: Monorepo is a single build with multiple packages. Micro-frontend is separate builds loaded at runtime. Monorepo gives shared types, single version, simple refactoring. Micro-frontend gives independent deploys, technology isolation, team-scale autonomy. Choose monorepo unless you need independent deploy cadence or polyglot tech stacks.

**Q: Does Module Federation work with Next.js / App Router?**
A: Yes — Next.js has `@module-federation/nextjs-mf` plugin for both Pages and App Router. However, RSC and server actions create additional constraints: federated Server Components must expose RSC payload endpoints, not just client bundles. In practice, most Next.js micro-frontends use client-only federation and keep shell-level RSC.

**Q: How do I share TypeScript types across micro-frontends?**
A: You do not share types at runtime — they are compile-time only. Use monorepo shared types package published as npm dependency consumed by each micro-frontend build. Module Federation does not share types. Use `@module-federation/typescript` plugin for limited auto-export, but the primary mechanism is the shared types package.

**Q: Can I mix React 18 and React 19 micro-frontends in one shell?**
A: Technically yes (each remote can bundle its own React), but not with singleton React. If you need singleton (for context, hooks, event system), all remotes must share one React version. Mixed versions require non-singleton mode — which means separate React roots, no context sharing, and doubled bundle size. Do not recommend.

**Q: Micro-frontend performance: how much overhead does federation add?**
A: remoteEntry.js ~2-6 KB. Network waterfall: shell JS → remote entry → remote app chunk. Total +1-2 round trips vs single-bundle app. Bundle size increases slightly (shared dep negotiation code). Tree-shaking across remotes is impossible because each is a separate build. Acceptable for apps where each remote is >50 KB.

---

## Examples

### Example 1: E-Commerce Shell with Three Micro-Frontends

**Problem**: E-commerce app with 80 engineers across 4 teams (Product, Cart, Checkout, Account). Each team ships weekly. Monolith build takes 45 minutes, integration bugs on every deploy.

**Architecture**:

```
Shell (Product team owns)
├── Product pages — built-in
├── Cart — federated remote (cart.mf.cdn.com)
├── Checkout — federated remote (checkout.mf.cdn.com)
└── Account — federated remote (account.mf.cdn.com)
```

**Key decisions**:
- React 19 singleton, shared via `ModuleFederationPlugin.shared`
- Shell owns routing (`/cart/*`, `/checkout/*`)
- Shared Zustand store for cart count, user auth
- CSS Modules per remote — no style leakage
- Each remote in `ErrorBoundary` with per-team fallback

**Result**:
- Build time: 45 min → 8 min per team
- Deploy frequency: biweekly → daily per team
- Integration bugs: reduced by cross-remote integration test suite
- Bundle: 320 KB shell + ~150 KB each lazy remote

### Example 2: Composing RSC Across Micro-Frontends

**Problem**: Travel booking site. Flight search is server-rendered (API aggregation). Hotel booking is client-heavy (maps, calendar). Both teams micro-frontends.

**Architecture**:

```
Shell (RSC)
├── FlightSearch (RSC remote) — server-rendered, streams RSC payload
├── HotelBooking (client remote) — lazy loaded, client-rendered
└── Shared auth context
```

**Key decisions**:
- Shell uses Next.js App Router
- FlightSearch remote exposes `/rsc/flights` endpoint returning RSC payload
- Shell fetches RSC stream during server render, embeds in page
- HotelBooking loads as client component with Suspense
- Error isolation: FlightSearch failure renders shell skeleton (HTTP streaming handles timeout); HotelBooking failure shows error boundary

**Result**:
- Flight search page: First Contentful Paint 1.2s (fully server-rendered)
- Hotel booking page: 800 KB client bundle (maps, galleries) loads on navigation
- Flight team deploys independently from hotel team

---

## Key Takeaways
- Module Federation lets separate builds share code at runtime via webpack container
- React must be a shared singleton — two React versions create broken context trees
- Shell owns primary router; sub-apps use MemoryRouter or receive basename
- Share state via custom events (low coupling), shared Zustand store (medium), or context bridge (high)
- CSS Modules provide class-scoped isolation; Shadow DOM provides full isolation but breaks event/forms interop
- RSC micro-frontends need server-to-server RPC and degrade differently from client-only MFE
- Each micro-frontend needs its own ErrorBoundary — crash isolation is not optional
- Independent deploys require feature flags or integration contract testing
- Preloading remoteEntry.js is cheap; actual app chunks load on route activation
- Deployment strategies: independent (fast per-team), coordinated (safe), hybrid (balanced)

## Common Misconception

**"Micro-frontends = iframes."**

Micro-frontends are not iframes. iframes isolate completely — separate JS heap, separate React root, async communication. Module Federation micro-frontends run in the same document, share the same React root, and communicate synchronously. The only similarity is "deploy independently." Iframes are a fallback for untrusted third-party code or polyglot stacks. True micro-frontends share the same runtime, same DOM, and same dependency graph — coordinated by the shell.

---

## Feynman Explain
(Explain Module Federation to a developer who knows React but has never worked with micro-frontends. Use the metaphor: "Imagine each team's app is a separate library on a CDN. The shell app is like a library catalog that loads books on demand — except all books share the same dictionary (React).")

*When ready, say explanation aloud or write it down. Then run `learn.sh explain advanced-react-19` — AI probes gaps.*

---

## Reframe
(Pause. Judge: Module Federation adds network waterfall, version negotiation complexity, and integration testing burden. When does micro-frontend overhead outweigh monolith simplicity? Consider team size < 5, stable scope, or tight-coupling domains like real-time collaborative editing. Write your trade-off analysis.)

---

## Drill
Take the quiz. MCQs practice federation config, state sharing, routing, and error isolation.

Run: `learn.sh quiz advanced-react-19 19-micro-frontends`

## Quiz: 19-micro-frontends


### In Module Federation, why must React be configured as a shared singleton?

- [ ] A: To reduce bundle size by deduplicating React

- [✓] B: React uses internal module-scoped state (fiber tree). Two instances create separate context trees — hooks, events, context break

- [ ] C: Singleton mode is required by Webpack 5

- [ ] D: To enable tree-shaking across micro-frontend boundaries


**Answer:** B

React's fiber tree, context system, and event system are module-scoped. Two React instances run two independent trees — useContext returns wrong values, events miss, hooks access wrong fiber. Singleton forces one React runtime. Bundle reduction is a side benefit, not the reason.


### A shell app hosts two remotes: dashboard and checkout. Shell uses React 19.0. Dashboard bundled with React 19.1. Checkout bundled with React 19.0. Federation config: `react: { singleton: true, requiredVersion: '^19.0.0' }`. Which version runs?

- [ ] A: 19.0 — lowest common denominator

- [✓] B: 19.1 — highest satisfying version

- [ ] C: Error — version mismatch detected at runtime

- [ ] D: Both — dashboard uses 19.1, checkout uses 19.0


**Answer:** B

Webpack picks the highest semver-satisfying version from all consumers. 19.1 satisfies ^19.0.0 for both. However, if checkout relied on behavior only in 19.0, it may break. Testing against the resolved version is required.


### What router architecture prevents routing conflicts between shell and remote micro-frontends?

- [ ] A: Both shell and remote use BrowserRouter with different basenames

- [✓] B: Shell owns BrowserRouter with routes per remote; each remote uses MemoryRouter with basename from shell

- [ ] C: Each remote uses its own BrowserRouter

- [ ] D: Remote uses HashRouter; shell uses BrowserRouter


**Answer:** B

Shell must own the address bar (BrowserRouter). Remotes use MemoryRouter receiving basename as prop — they render relative routes internally. This prevents multiple BrowserRouters competing for URL control and lets shell handle top-level navigation.


### When does React context propagate from shell into a federated remote component?

- [ ] A: Always — React context is global by default

- [✓] B: Only when both shell and remote share a single React singleton and remote renders inside shell's tree

- [ ] C: Only when remote uses createContext with the same provider

- [ ] D: Context never crosses micro-frontend boundaries


**Answer:** B

React context propagates through the component tree. If remote renders inside shell's tree and both share one React (singleton), shell's context providers are visible to remote. Two React instances = separate context trees = no propagation. Singleton React is necessary but not sufficient — remote must render inside shell's provider tree.


### Which CSS isolation approach provides full DOM/event isolation but breaks form submissions and event retargeting?

- [ ] A: CSS Modules

- [ ] B: CSS-in-JS

- [✓] C: Shadow DOM

- [ ] D: BEM naming conventions


**Answer:** C

Shadow DOM isolates DOM, CSS, and events completely. However, events that cross shadow boundary are retargeted (target points to shadow root, not actual element). Form submissions inside shadow DOM are invisible to outer document. CSS Modules and CSS-in-JS scope classes only — DOM remains in same document.


### A micro-frontend crashes mid-render before its useEffect hooks mount. What resources leak?

- [ ] A: None — React automatically cleans up on error

- [✓] B: WebSocket connections and timers — effects never mounted so their cleanup cannot run. Fallback: singleton cleanup registry

- [ ] C: The shell crashes too — errors propagate up the tree

- [ ] D: Only React component state is lost; side effects are unaffected


**Answer:** B

ErrorBoundary catches render errors. The crashed component's effects never mounted — so no cleanup ran. WebSocket connections, intervals, third-party scripts stay alive. Solution: remote should register cleanup handlers in a singleton map that shell invokes on error or use a crash-only pattern (reload on navigation).


### Two micro-frontends need to share cart state. Cart count changes in checkout. Product listing in another remote must reflect the update. Which approach has the lowest coupling?

- [ ] A: Shared Zustand store exposed via Module Federation

- [✓] B: Window-level CustomEvent dispatched by checkout, listened by product

- [ ] C: Context bridge with React context provider in shell

- [ ] D: Direct import of checkout module into product


**Answer:** B

Custom events: sender does not know receiver exists. Zero import coupling between remotes. Zustand store requires a shared dependency and store contract. Context bridge requires rendering inside same provider tree. Direct import creates a build dependency. For low coupling: events. For devtools/debugging: store.


### What makes RSC (Server Component) micro-frontends harder to deploy than client-only micro-frontends?

- [ ] A: RSC requires a HTTP/2 server

- [✓] B: RSC micro-frontends need remote servers reachable at server-render time — remote failure causes shell SSR failure. Client-only degrades to error boundary gracefully

- [ ] C: RSC cannot be lazy loaded

- [ ] D: RSC bundles must be tree-shaken together


**Answer:** B

RSC micro-frontends fetch RSC payload from remote server during shell's server render. If remote server is down, shell SSR may fail entirely. Client-only micro-frontends load on the client — failure shows an error boundary without affecting shell SSR. RSC micro-frontends increase server coupling and require independent server infrastructure per remote.


### Shell preloads dashboard's remoteEntry.js on hover. What is the trade-off?

- [✓] A: Preloading wastes bandwidth — remoteEntry.js is 2-6 KB, which is an acceptable trade-off for instant navigation

- [ ] B: Preloading is always harmful — never preload micro-frontends

- [ ] C: remoteEntry.js contains all dashboard code, so preloading is equivalent to loading the full app

- [ ] D: Module Federation does not support preloading


**Answer:** A

remoteEntry.js is just the module registry (~2-6 KB), not the full dashboard app. Preloading it on hover is cheap and makes navigation instant. Actual dashboard chunks load on route activation, not on preload. This is a standard performance pattern — preload metadata, load content on demand.


### A shell deploys a new feature expecting an updated dashboard remote API. Dashboard deploys 3 days later. What pattern prevents users from seeing a broken page during the gap?

- [ ] A: Shell waits for dashboard to deploy first — coordinated release

- [✓] B: Feature flag in shell — feature behind flag. Dashboard toggles flag when ready

- [ ] C: Module Federation automatically rolls back incompatible changes

- [ ] D: Dashboard deploys before shell — always


**Answer:** B

Feature flags decouple deploy from release. Shell ships feature behind flag. Dashboard team deploys their changes independently, then toggles the flag. This avoids blocking shell deploys on dashboard readiness. Coordinated releases (A) are safe but slow. Auto-rollback (C) does not exist. Hard ordering (D) is impractical for independent teams.


---

# Module 20: Capstone — Production React 19 Application Architecture

Est. study time: 3h
Language: en

## Learning Objectives
- Design complete production architecture combining React 19 Server Components, Actions, Transitions, Compiler, and Suspense
- Make architectural decisions via ADR: RSC vs Client Components, state ownership, data flow, routing strategy
- Implement performance budget with streaming targets and measurable thresholds
- Build testing and deployment strategy for RSC-based applications

---

## Core Content

### Full Application Architecture — Combining All React 19 Features

A production React 19 application is not one thing — it is a layered system where each React 19 feature owns a specific concern. The architecture follows a clear hierarchy:

```
Layer 1 (Route shell):    Layout components, Suspense boundaries, Error boundaries
Layer 2 (Data origin):    Server Components, Server Actions, `use()`
Layer 3 (Interactive UI): Client Components, hooks, Transitions
Layer 4 (Client state):   Zustand store (cross-cutting), URL state, form state
Layer 5 (Optimistic):     useOptimistic, useActionState for instant feedback
Layer 6 (Compiler):       Auto-memoization applied across entire component tree
```

Each layer has distinct rendering environment, state source, and failure mode:

| Layer | Environment | State source | Failure mode |
|-------|-------------|-------------|-------------|
| Route shell | RSC + Client | URL params, layout data | ErrorBoundary per segment |
| Data origin | RSC only | DB, API, cache | Parent Suspense boundary |
| Interactive UI | Client only | useState, useReducer | Local error fallback |
| Client state | Client only | Zustand store | Hydration mismatch handled |
| Optimistic | Client only | useOptimistic | Action error reverts |
| Compiler | Both | N/A (build-time) | Build error, per module rollback |

> **Think**: A user reports seeing a blank white screen on a product page. The RSC fetch for product data fails. No error boundary rendered. Why?
>
> *Answer: RSC fetch failure rejects the RSC payload. If no Suspense boundary wraps the product section, React cannot show fallback — the server render fails altogether. Architecture rule: every async RSC fetch must have a wrapping Suspense boundary with a client-component fallback. Without it, failure becomes a blank screen.*

### Architecture Decision Record: RSC vs Client Components

Every component starts as RSC. Convert to Client Component only when one of these conditions is met:

**ADR Record: Component Environment Decision**

Decision: Default to RSC. Use Client Component `"use client"` only for specific needs.

| Condition | Decision | Rationale |
|-----------|----------|-----------|
| Uses hooks (useState, useEffect, useCallback, etc.) | Client | Hooks require client runtime |
| Uses browser APIs (window, document, localStorage) | Client | Server has no browser |
| Needs event handlers (onClick, onSubmit, onChange) | Client | Events need client runtime |
| Needs interactivity (state, context mutation) | Client | Interactive state lives on client |
| Renders static content from server data | RSC | No JS sent to client |
| Composes other RSCs | RSC | Keeps render tree on server |
| Formats dates/numbers with locale | RSC | Server handles formatting, sends text |
| Contains heavy markdown rendering | RSC | Render on server, ship HTML |
| Needs `useActionState` or `useOptimistic` | Client | Form hooks are client hooks |
| Is a layout shell with navigation | RSC | Layout data fetched server-side |

Example decision tree:

```typescript
// RSC — no interactivity, pure data rendering
// app/products/page.tsx
async function ProductsPage() {
  const products = await db.query('SELECT * FROM products LIMIT 20')
  return <ProductList products={products} />
}

// Client — needs onClick and state
// app/products/_components/ProductList.tsx
'use client'
function ProductList({ products }: { products: Product[] }) {
  const [sort, setSort] = useState<'price' | 'name'>('price')
  const sorted = [...products].sort(/* ... */)
  return (
    <div>
      <button onClick={() => setSort('price')}>Sort by Price</button>
      <button onClick={() => setSort('name')}>Sort by Name</button>
      {sorted.map(p => <ProductCard key={p.id} product={p} />)}
    </div>
  )
}
```

> **Think**: A dashboard component fetches user list (RSC), then renders a table with inline row editing. Does the table need to be a Client Component?
>
> *Answer: Yes. Inline row editing requires state (edit mode per row), onChange handlers (inputs), and onClick handlers (save/cancel). The entire table component should be `'use client'`. The parent RSC fetches data and passes it as props to the client table. The boundary is clear: data fetching in RSC, interactivity in Client Component.*

### Data Flow Design: RSC → Actions → Zustand

Three data flow patterns cover every scenario in a production app:

**Pattern 1: Server Components for initial data**

RSC fetches data at request time, renders HTML + RSC payload, sends minimal JS to client.

```typescript
// app/orders/page.tsx — RSC
async function OrdersPage() {
  const orders = await db.query(`
    SELECT o.*, u.name FROM orders o
    JOIN users u ON u.id = o.user_id
    WHERE o.status = 'active'
    ORDER BY o.created_at DESC
    LIMIT 50
  `)
  return <OrderList orders={orders} />
}
```

Rules:
- Fetch as deep in the tree as possible — closer to the consuming component.
- Never pass fetch results through multiple RSC layers just to reach a leaf client component.
- Use `cache()` or React's `fetch` dedup for shared data across RSCs.

**Pattern 2: Actions for mutations**

Server Actions handle all writes. `useActionState` wraps pending/error/success.

```typescript
// app/orders/_actions.ts
'use server'
export async function cancelOrder(orderId: string, reason: string) {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')

  // Server validates
  const order = await db.query('SELECT status FROM orders WHERE id = $1', [orderId])
  if (order.status === 'shipped') {
    return { error: 'Cannot cancel shipped orders' }
  }

  await db.query('UPDATE orders SET status = $1, cancel_reason = $2 WHERE id = $3',
    ['cancelled', reason, orderId])

  revalidatePath('/orders')
  return { success: true }
}

// app/orders/_components/CancelOrderForm.tsx
'use client'
import { useActionState } from 'react'
import { cancelOrder } from '../_actions'

function CancelOrderForm({ orderId }: { orderId: string }) {
  const [state, formAction, pending] = useActionState(
    cancelOrder.bind(null, orderId),
    { error: null, success: false }
  )

  return (
    <form action={formAction}>
      <textarea name="reason" required disabled={pending} />
      {state.error && <p className="error">{state.error}</p>}
      {state.success && <p className="success">Order cancelled</p>}
      <button type="submit" disabled={pending}>
        {pending ? 'Cancelling...' : 'Cancel Order'}
      </button>
    </form>
  )
}
```

**Pattern 3: Zustand for cross-cutting client state**

Zustand handles state that spans multiple routes or client components but does not come from server.

```typescript
// app/_store/cart.ts
import { create } from 'zustand'

interface CartStore {
  items: CartItem[]
  isOpen: boolean
  addItem: (item: CartItem) => void
  removeItem: (id: string) => void
  toggle: () => void
}

export const useCartStore = create<CartStore>((set) => ({
  items: [],
  isOpen: false,
  addItem: (item) => set((s) => ({ items: [...s.items, item] })),
  removeItem: (id) => set((s) => ({ items: s.items.filter(i => i.id !== id) })),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
}))
```

What goes in Zustand:
- UI state shared across routes: cart drawer, notification count, theme
- Real-time data: WebSocket-driven state, presence indicators
- Complex derived state: multi-step form wizard progress

What does NOT go in Zustand:
- Server-owned data (keep in RSC, revalidate on mutation)
- Form field state (useActionState or local component state)
- URL state (use router — it belongs in the address bar)

> **Think**: A user adds item to cart via Server Action. Cart count in header must show updated value. Cart count is in Zustand. What triggers the update?
>
> *Answer: The Server Action returns updated cart count in its response. The client component that called the action receives the response and calls `useCartStore.getState().addItem(newItem)`. Alternative: the action revalidates a server component that renders the cart count, but that creates round-trip latency. For instant UI, use the action response to update the store directly.*

### Route Design: Layouts, Loading Boundaries, Error Boundaries

Route hierarchy determines resilience. Every route segment should define:

```typescript
// app/layout.tsx — Root layout, no loading boundary needed
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <Header />
        <Suspense fallback={<FullPageSkeleton />}>
          {children}
        </Suspense>
        <Footer />
      </body>
    </html>
  )
}

// app/dashboard/layout.tsx — Dashboard layout with loading + error
import { Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <section>
      <DashboardNav />
      <ErrorBoundary FallbackComponent={DashboardErrorFallback}>
        <Suspense fallback={<DashboardSkeleton />}>
          {children}
        </Suspense>
      </ErrorBoundary>
    </section>
  )
}

// app/dashboard/analytics/loading.tsx — Route-level loading
export default function AnalyticsLoading() {
  return <AnalyticsSkeleton />
}

// app/dashboard/analytics/error.tsx — Route-level error
'use client'
export default function AnalyticsError({ error, reset }: {
  error: Error
  reset: () => void
}) {
  return (
    <div role="alert">
      <h2>Analytics failed to load</h2>
      <p>{error.message}</p>
      <button onClick={reset}>Retry</button>
    </div>
  )
}
```

| Boundary | When to place | Behavior |
|----------|--------------|----------|
| Root Suspense | Root layout | Catches all uncaught RSC fetch failures |
| Per-route Suspense | Each segment layout | Isolates slow data per route section |
| Per-route Error | Each `error.tsx` | Catches render errors in that segment |
| Per-component Suspense | Individual server components | Fine-grained streaming for slow components |
| Global Error | `global-error.tsx` | Catches root layout errors (rare) |
| Loading | `loading.tsx` | Shown during RSC fetch for that route segment |

> **Think**: A product page has three sections: header (fast), reviews (slow DB query), recommendations (slow ML service). Reviews failing should not block recommendations. How do you architect the route?
>
> *Answer: Three Suspense boundaries wrapping each section individually. Each Suspense has its own fallback skeleton. Reviews error caught by a wrapping ErrorBoundary that shows "Reviews unavailable" fallback. Recommendations loads independently because it is in a separate Suspense. No section blocks another.*

### Performance Budget

Production React 19 app must meet these thresholds:

| Metric | Target | Measurement | Enforcement |
|--------|--------|-------------|-------------|
| Server render | < 200ms (p95) | `server-timing` header | CI benchmark, fail PR if exceeded |
| Client JS per route | < 100kb gzip | Bundle analyzer | CI check, alert on regression |
| Time To Interactive (TTI) | < 1s (p95) | Lighthouse CI | PR gate at 0.9s threshold |
| First Contentful Paint | < 1s | RUM data | Dashboard alert |
| Streaming first chunk | < 500ms | TTFB + streaming | Server timing metrics |
| Largest Contentful Paint | < 2s | RUM data | Quarterly review |
| Network payload (total) | < 500kb | DevTools | Bundle CI check |

Streaming targets:

```typescript
// app/checkout/page.tsx
export default async function CheckoutPage() {
  return (
    <div>
      {/* Immediate — no async dependency, sent in first RSC chunk */}
      <CheckoutHeader />

      {/* Streamed — fast DB query, arrives before slow sections */}
      <Suspense fallback={<Skeleton width="full" height="60px" />}>
        <ShippingAddress />
      </Suspense>

      {/* Streamed last — slow external API call */}
      <Suspense fallback={<Skeleton width="full" height="200px" />}>
        <RecommendedProducts />
      </Suspense>

      {/* Instant — client component, renders after hydration */}
      <PaymentForm />
    </div>
  )
}
```

Optimization rules:
1. Every async fetch must clarify: does user see content without it? If yes, make it optional via Suspense.
2. Critical content (header, primary action) must be in first RSC chunk — never behind slow fetch.
3. Client Component JS is measured per route. Keep below 100kb gzip by moving heavy rendering to RSC.

> **Think**: Dashboard analytics widget shows a chart rendered client-side with D3 (80kb gzip). It is below the fold on page load but critical for analytics users. Should you move it to RSC?
>
> *Answer: No. Charts are inherently client-side (DOM manipulation, animations). Solution: lazy-load the chart component with `next/dynamic` or `React.lazy`. The 80kb chart JS loads after primary content. Show skeleton during lazy load. For analytics-only pages, route-level code splitting keeps chart JS off non-analytics routes.*

### State Ownership Map

Every piece of state in the app has exactly one owner. The owner determines how it is updated, how long it persists, and where it renders.

| State type | Owner | Where stored | Update mechanism | Scope |
|------------|-------|-------------|------------------|-------|
| Server data | RSC | DB/API, cached in RSC fetch | Server Action → `revalidatePath()` / `revalidateTag()` | Route segment |
| URL params | Next.js router | URL | `<Link>`, router.push, server redirect | Browser history |
| Search params | Next.js router | URL querystring | `useSearchParams`, form submit | Browser history |
| Form state | useActionState | Client component | Server Action returns state | Component tree |
| Optimistic UI | useOptimistic | Client component | Server Action triggered, state auto-reverts | Component tree |
| UI state (tabs, modals, toasts) | Client component | useState / useReducer | Local event handlers | Component or subtree |
| Cross-cutting UI (cart drawer, theme) | Zustand store | Zustand (client memory) | Zustand actions | App-wide |
| Real-time data (presence, chat) | Zustand store | Zustand + WebSocket | WebSocket message → Zustand action | App-wide |
| Form field values | Client component | useState / uncontrolled | onChange / formData | Form subtree |
| Cache (React Query, SWR) | Client cache lib | Memory + cache store | Refetch on focus, mutation invalidation | App-wide |

Decision flow for new state:

```
Is this state from server? → Yes → RSC (fetch in Server Component)
  No → Does it come from a mutation? → Yes → useActionState + useOptimistic
    No → Is it URL-relevant? → Yes → URL params / search params
      No → Is it used by multiple unrelated components? → Yes → Zustand
        No → useState in closest common ancestor
```

> **Think**: A settings page has 20 form fields across 5 sections. User clicks Save once. Where does form field state live? Where does save result state live?
>
> *Answer: Form field values: local useState in each field component (or uncontrolled form elements). No need for Zustand — data is local to the form. Save result state: useActionState. The action processes all 20 fields, returns per-field errors or success status. Zustand would be wrong here — form state is ephemeral, route-specific, and not shared across routes.*

### Form Architecture: useActionState + Validation + Optimistic Updates

Production forms combine three layers:

**Layer 1: Server validation (single source of truth)**

```typescript
// app/checkout/_actions.ts
'use server'
import { z } from 'zod'

const checkoutSchema = z.object({
  email: z.string().email('Invalid email'),
  address: z.string().min(10, 'Address too short'),
  zipCode: z.string().regex(/^\d{5}$/, 'Invalid ZIP'),
  cardNumber: z.string().regex(/^\d{16}$/, 'Invalid card'),
})

export async function submitCheckout(prev: CheckoutState, formData: FormData) {
  const parsed = checkoutSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      values: Object.fromEntries(formData),
    }
  }

  const result = await processPayment(parsed.data)
  if (!result.ok) {
    return { errors: { server: [result.error] }, values: parsed.data }
  }

  revalidatePath('/orders')
  return { success: true, orderId: result.orderId }
}
```

**Layer 2: Client form with useActionState**

```typescript
// app/checkout/_components/CheckoutForm.tsx
'use client'
import { useActionState } from 'react'
import { submitCheckout } from '../_actions'

function CheckoutForm() {
  const [state, formAction, pending] = useActionState(submitCheckout, {
    errors: {}, values: {}, success: false,
  })

  return (
    <form action={formAction}>
      <Field name="email" label="Email" error={state.errors?.email?.[0]}
        defaultValue={state.values?.email} />
      <Field name="address" label="Address" error={state.errors?.address?.[0]}
        defaultValue={state.values?.address} />
      <Field name="zipCode" label="ZIP Code" error={state.errors?.zipCode?.[0]}
        defaultValue={state.values?.zipCode} />
      <Field name="cardNumber" label="Card Number" error={state.errors?.cardNumber?.[0]}
        defaultValue={state.values?.cardNumber} />
      {state.errors?.server && (
        <p className="error">{state.errors.server[0]}</p>
      )}
      <button type="submit" disabled={pending}>
        {pending ? 'Processing...' : 'Place Order'}
      </button>
    </form>
  )
}
```

**Layer 3: Optimistic updates for instant feedback**

```typescript
// app/products/_components/AddToCartButton.tsx
'use client'
import { useOptimistic, useActionState } from 'react'
import { addToCart } from '../_actions'

function AddToCartButton({ productId, currentQty }: {
  productId: string
  currentQty: number
}) {
  const [optimisticQty, addOptimistic] = useOptimistic(
    currentQty,
    (state, increment: number) => state + increment
  )

  const handleSubmit = async (formData: FormData) => {
    addOptimistic(1) // instant UI update
    const result = await addToCart(formData)
    if (result.error) {
      // Revert happens automatically — useOptimistic shows server state
    }
  }

  return (
    <form action={handleSubmit}>
      <input type="hidden" name="productId" value={productId} />
      <button type="submit">Add to Cart ({optimisticQty})</button>
    </form>
  )
}
```

> **Think**: Optimistic update increases cart count instantly. Action fails (out of stock). Cart count reverts. How does user know what happened?
>
> *Answer: The action return value includes error. The component uses `useActionState` return value in addition to useOptimistic. When action fails, show toast notification: "Product out of stock." useOptimistic automatically re-renders with server state (previous count) when action resolves with error. Never rely solely on optimistic revert — always surface the error reason.*

### Testing Strategy

Three testing layers for RSC applications:

**Layer 1: Unit tests for hooks and utilities**

```typescript
// __tests__/useCartStore.test.ts
import { renderHook, act } from '@testing-library/react'
import { useCartStore } from '@/store/cart'

describe('Cart store', () => {
  it('adds item', () => {
    const { result } = renderHook(() => useCartStore())
    act(() => result.current.addItem({ id: '1', name: 'Widget', price: 10 }))
    expect(result.current.items).toHaveLength(1)
  })

  it('toggles cart drawer', () => {
    const { result } = renderHook(() => useCartStore())
    act(() => result.current.toggle())
    expect(result.current.isOpen).toBe(true)
    act(() => result.current.toggle())
    expect(result.current.isOpen).toBe(false)
  })
})
```

**Layer 2: Integration tests for RSC rendering**

Testing Server Components requires a framework-aware test environment:

```typescript
// __tests__/ProductsPage.test.tsx
import { render } from '@testing-library/react'
import ProductsPage from '@/app/products/page'

// Mock server-side dependencies
jest.mock('@/lib/db', () => ({
  query: jest.fn().mockResolvedValue([
    { id: '1', name: 'Widget', price: 10 },
  ]),
}))

it('renders product list', async () => {
  const { findByText } = render(await ProductsPage())
  expect(await findByText('Widget')).toBeInTheDocument()
})
```

Testing Server Actions:

```typescript
// __tests__/cancelOrder.test.ts
import { cancelOrder } from '@/app/orders/_actions'

jest.mock('@/lib/db', () => ({
  query: jest.fn(),
}))

it('rejects cancellation of shipped orders', async () => {
  const db = require('@/lib/db')
  db.query.mockResolvedValueOnce({ status: 'shipped' })
  const result = await cancelOrder('order-1', 'Changed mind')
  expect(result).toEqual({ error: 'Cannot cancel shipped orders' })
})
```

**Layer 3: E2E with Playwright**

```typescript
// e2e/checkout.spec.ts
import { test, expect } from '@playwright/test'

test('complete checkout flow', async ({ page }) => {
  await page.goto('/products')
  await page.click('[data-testid="add-to-cart-1"]')
  await expect(page.locator('[data-testid="cart-count"]')).toHaveText('1')

  await page.goto('/checkout')
  await page.fill('[name="email"]', 'test@example.com')
  await page.fill('[name="address"]', '123 Main St')
  await page.fill('[name="zipCode"]', '12345')
  await page.fill('[name="cardNumber"]', '4111111111111111')
  await page.click('button[type="submit"]')

  await expect(page.locator('[data-testid="order-confirmation"]')).toBeVisible()
  await expect(page.locator('[data-testid="order-id"]')).not.toBeEmpty()
})

test('shows validation errors', async ({ page }) => {
  await page.goto('/checkout')
  await page.click('button[type="submit"]')
  await expect(page.locator('.error')).toHaveCount(4)
})

test('loading states during slow RSC fetch', async ({ page }) => {
  await page.goto('/dashboard/analytics')
  await expect(page.locator('[data-testid="skeleton"]')).toBeVisible()
  await expect(page.locator('[data-testid="analytics-chart"]')).toBeVisible({ timeout: 10000 })
})
```

Test configuration:

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  webServer: {
    command: 'npm run build && npm run start',
    port: 3000,
    timeout: 120000,
  },
  use: {
    baseURL: 'http://localhost:3000',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
})
```

> **Think**: A Server Action updates a database row and revalidates the parent RSC. The E2E test checks the updated value renders. Sometimes it passes, sometimes it shows stale data. What is happening?
>
> *Answer: Race condition between revalidation and test assertion. `revalidatePath('/orders')` triggers a re-render, but the RSC fetch is async. The test page may render with old data before new fetch completes. Fix: wait for the updated element with `await expect(page.locator(...)).toHaveText(expectedValue)` with retry, or add a test-id that only appears after revalidation.*

### Deployment: RSC-Compatible Hosting

RSC requires a server that can:
- Execute Server Components at request time
- Stream RSC payload and HTML over HTTP
- Handle Server Actions (POST endpoints)
- Execute per-request (no static export for dynamic routes)

| Hosting option | RSC support | Notes |
|---------------|-------------|-------|
| Vercel | Full | Native Next.js support, edge + Node.js runtime, ISR, streaming |
| Node.js (self-hosted) | Full | Express/Fastify custom server, requires proper streaming setup |
| Docker + Node | Full | Containerized self-host, load-balanced, requires sticky sessions? No — RSC is stateless |
| Cloudflare Workers | Partial | Edge runtime limitations: no Node.js APIs, limited DB drivers |
| AWS Lambda | Partial | Cold starts affect RSC latency, 15min timeout, streaming complexity |
| Static export | None | RSC requires dynamic server — static export limited to static RSC |

```typescript
// Dockerfile for self-hosted React 19 app
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
CMD ["npm", "run", "start"]
```

Environment configuration:

```typescript
// app/_lib/env.ts
import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  STRIPE_API_KEY: z.string().startsWith('sk_'),
  SESSION_SECRET: z.string().min(32),
  NODE_ENV: z.enum(['development', 'production', 'test']),
  NEXT_PUBLIC_ANALYTICS_ID: z.string().optional(),
})

export const env = envSchema.parse(process.env)
```

> **Think**: Self-hosted Next.js with RSC. CPU spikes to 90% under load. What is the bottleneck?
>
> *Answer: RSC rendering is CPU-bound — every request serializes JSX to RSC payload. If pages are dynamic (no caching), each request runs full server components. Solutions: (1) enable ISR or `generateStaticParams` for pages that can be static, (2) add Redis cache for RSC payload, (3) horizontally scale Node processes behind load balancer, (4) use React's `cache()` to deduplicate DB calls within request.*

### Migration Guide: Incremental Adoption from Legacy Codebase

Legacy React 18 codebase (Create React App or custom Webpack, client-only, hooks + Redux). Milestones:

**Phase 1: Framework switch (Week 1-2)**
```
Goal: Same app runs in Next.js App Router without visible changes.
1. Adopt Next.js incremental adoption: migrate one route at a time.
2. Keep existing React 18 code in pages/ directory (Pages Router).
3. New app/ directory routes opt into App Router.
4. Shared components must be "use client" during transition.
5. No RSC yet — everything still runs on client.
```

**Phase 2: Co-locate data fetching (Week 3-4)**
```
Goal: Move data fetching from useEffect into Server Components.
1. Identify routes where data is the same for all users (no auth-dependent filters).
2. Convert those routes to RSC, move fetch inside Server Component.
3. Measure: client JS reduction, data fetch latency improvement.
4. Auth-protected routes: keep client-side fetch, defer RSC conversion.
```

**Phase 3: Actions for mutations (Week 5-6)**
```
Goal: Replace API call + Redux dispatch pattern with Server Actions.
1. Identify forms and mutation patterns.
2. Write Server Actions next to route, keep same validation logic.
3. Replace Redux form thunks with useActionState calls.
4. Remove Redux code for form submission — now obsolete.
5. Cart and UI state: migrate from Redux to Zustand (simpler API).
```

**Phase 4: Compiler adoption (Week 7-8)**
```
Goal: Enable React Compiler module by module.
1. Add `// @reactCompiler` to least-critical module first.
2. Test in StrictMode.
3. Run CI with compiler enabled, check for re-render regressions.
4. Enable broadly. Remove manual useMemo/useCallback in touched files.
5. CI should measure bundle size and flag compiler regressions.
```

**Phase 5: Performance optimization (Week 9-10)**
```
Goal: Meet performance budget.
1. Add Suspense boundaries per route segment.
2. Implement streaming for slow data sources.
3. Add loading.tsx and error.tsx to all route groups.
4. Run Lighthouse CI, fix regressions below 1s TTI.
5. Establish performance budget in CI as PR gate.
```

**Phase 6: Cleanup and testing (Week 11-12)**
```
Goal: Remove migration artifacts, E2E coverage, documentation.
1. Remove remaining Redux code and legacy hooks.
2. Add Playwright E2E tests for critical flows.
3. Document architecture decisions in ADR files.
4. Set up monitoring: RUM data, error tracking, server timing.
5. Train team on RSC mental model — workshops.
```

> **Think**: Team of 5 engineers. CEO wants "full migration in 2 weeks." What do you say?
>
> *Answer: Reply: "We can have the app running in Next.js in 2 weeks. Full React 19 adoption (RSC + Actions + Compiler) is 12 weeks." The 2-week delivery keeps business happy. The 12-week plan keeps engineering honest. Wrong move: over-promise and ship buggy partial migration. Right move: incremental phases, measurable progress at each step, no regression in user experience.*

---

### Why This Matters

Capstone module synthesizes every React 19 feature into a coherent architecture. Teams that understand how RSC, Actions, Transitions, Compiler, and state ownership work together ship faster with less code and better performance. Teams that adopt features in isolation create fragmented architecture: RSC without streaming, Actions without optimistic updates, Compiler without performance budget. The 12-week migration pattern has been proven across multiple production codebases. Architecture decision records prevent expensive rework. This module is the blueprint for production React 19.

---

### Common Questions

**Q: Can I use Zustand inside a Server Component?**
A: No. Zustand is a client-side state library. Server Components cannot use hooks. Server state comes from RSC fetch. Zustand is for cross-cutting client state only (cart drawer, theme, real-time data). If you need server-side shared state, use React's `cache()` function or a dedicated cache layer (Redis, Memcached).

**Q: How do I handle authentication with RSC?**
A: Server Components can access cookies and sessions. Fetch auth token in layout or page component, pass to children. Example: `getSession()` called in Server Component, returns user or null. Client Components receive user as prop. Server Actions re-check auth — never trust client claims.

**Q: When should I NOT use Suspense boundaries?**
A: When the component's data is always fast (< 50ms) and the visual cost of showing a fallback exceeds the benefit. Overwrapping with Suspense adds visual jitter — skeleton flashes for 30ms cheap queries. Rule: wrap any RSC fetch that exceeds your render budget (200ms). Skip Suspense for inline cache hits or trivial fetches.

**Q: Do I need React Query or SWR with RSC?**
A: For initial data: no — RSC handles it. For client-side refetching (polling, background refetch on focus): yes, React Query or SWR still useful for interactive client-side caching. RSC handles initial load; client cache handles subsequent updates without full page revalidation.

**Q: What is the biggest mistake teams make migrating to React 19?**
A: Treating RSC as "just server-side rendering." RSC is not SSR — SSR renders HTML on server then hydrates. RSC sends a serialized component tree, integrates with client state, streams, and enables Server Actions. Teams who treat RSC as "faster SSR" miss Actions, streaming, and the component-environment separation.

---

## Examples

### Example 1: E-Commerce Application Architecture

**Problem**: Build a full e-commerce app with product browsing, cart, checkout, order history, and admin dashboard. 100k products, 10k concurrent users. Performance budget: 1s TTI, 100kb JS per route.

**Architecture decisions**:

```
Route structure:
  /products                           → RSC + paginated fetch, streaming
  /products/[id]                      → RSC + Suspense (reviews, recommendations nested)
  /cart                               → Client Component (Zustand-based)
  /checkout                           → RSC + useActionState form
  /orders                             → RSC + streaming order list
  /admin/dashboard                    → Client Component (heavy D3 charts, lazy loaded)

Data flow:
  Product page (RSC): fetch product + 20 reviews + 5 recommendations
    ├─ Main content: streaming — product details first (fast), then reviews (slow), then recs (slowest)
    ├─ Add to cart: useOptimistic + Server Action → updates Zustand cart store
    └─ Cache strategy: RSC cached 60s (ISR), product data revalidated on price change

State ownership:
  Product data    → RSC (DB query)
  Cart            → Zustand (cross-cutting client state)
  Checkout form   → useActionState (form state)
  Search params   → URL (useSearchParams)
  Admin filters   → Zustand (persisted to localStorage)
  Order history   → RSC (DB query, per-user)

Performance:
  Product page JS: 45kb (product card client components, no D3)
  Cart page JS: 25kb (minimal form)
  Checkout page JS: 35kb (form + card input)
  Admin page JS: 120kb (D3 lazy loaded via next/dynamic — allowed on heavy page)
  Server render: 150ms p95 (product details cached, optimized DB queries)
  TTI: 900ms p95 (streaming sends content in 3 chunks, last chunk at 700ms)
```

**Result**: 90% of pages under 100kb JS. TTI under 1s. Cart updates feel instant (optimistic). Checkout errors show per-field validation without page reload.

### Example 2: SaaS Dashboard Migration

**Problem**: SaaS admin dashboard, 50k LOC, current codebase uses Create React App + Redux + React Router. Migration to React 19 with Next.js App Router. Team of 4 engineers. 3-month timeline.

**Migration plan**:

```
Week 1-2: Framework switch
  - Set up Next.js with Pages Router compatibility
  - Move one dashboard section (reports) to app/ directory
  - All components keep "use client" — no architectural change yet
  - Validate: same functionality, same bundle size

Week 3-4: RSC adoption
  - Reports page: fetch data in Server Component instead of useEffect
    Before: useEffect(() => { fetch('/api/reports') }, [])
    After: async function ReportsPage() { const data = await db.query(...) }
  - Client JS for reports: 80kb → 45kb (chart libs remain client-side)
  - Observed TTI improvement: 2.5s → 1.4s

Week 5-6: Actions
  - Report settings form: useActionState + Zod validation
  - Remove: Redux thunk for settings, API route for settings
  - Added: optimistic toggle for "enable notifications" switch

Week 7-8: Compiler
  - Enable React Compiler on reports section
  - Remove 12 useMemo calls from reports components
  - Encounter one issue: compiler mis-optimization with setInterval ref → keep manual ref
  - Rollback compiler on that file, continue with rest

Week 9-10: Boundaries + streaming
  - Add Suspense boundaries per report widget
  - Slow SQL reports stream in independently
  - Fast widgets render immediately
  - ErrorBoundary per widget — one report crash does not take down dashboard

Week 11-12: Testing + cleanup
  - Playwright E2E: login → navigate to reports → verify data renders → toggle settings
  - Remove remaining Redux code (only Zustand for cross-cutting sidebar state)
  - Performance budget enforced in CI: TTI < 1s, JS < 100kb per dashboard route
  - Documentation: ADR records for every architectural decision
```

**Result**: TTI 2.5s → 0.9s. Client JS 220kb → 65kb (reports route). Redux eliminated (Zustand replaced 80% of it). Team can now ship new features in 1 week vs 3 weeks pre-migration.

---

## Key Takeaways
- Default to RSC for all components. Convert to Client Component only when hooks, events, or browser APIs required.
- Architecture layers: Route shell (RSC) → Data origin (RSC) → Interactive UI (Client) → Client state (Zustand) → Optimistic (useOptimistic) → Compiler (auto-memoization)
- State ownership model: one owner per state type — server state in RSC, form state in useActionState, cross-cutting in Zustand, URL state in router
- Performance budget: 200ms server render, 100kb JS per route, 1s TTI, streaming first chunk < 500ms
- Route resilience: every async RSC fetch needs Suspense boundary with fallback; every route segment needs error boundary
- Form architecture: server validation (single truth) + useActionState (client wrapper) + useOptimistic (instant feedback)
- Testing: three layers — unit hooks, integration RSC + Actions, E2E Playwright with retry-aware assertions
- Deployment: Vercel or Node.js self-hosted. Docker for containerized. No static export for dynamic RSC.
- Migration is 12-week incremental process: framework switch → RSC → Actions → Compiler → boundaries → cleanup
- Compiler adoption: module by module with StrictMode testing, rollback per file if mis-optimization

## Common Misconception

**"Architecture decisions come from framework defaults — use RSC everywhere, or use Client Components everywhere."**

React 19 is not one-size-fits-all. The architecture decision is about classifying every component by its needs. A component that renders static product details from DB is RSC. A component that lets user edit that product inline is Client. The same page can mix both — the boundary is at the "use client" file separation. Teams that force everything into RSC miss interactivity. Teams that make everything Client Components miss the bundle reduction and streaming benefits. The correct architecture is: start with RSC, convert to Client Component only when the need is proven. This is the fundamental decision pattern of React 19.

---

## Feynman Explain

(Explain how a React 19 production app works to a junior developer who knows HTML, CSS, and basic JavaScript. Use no React jargon. Talk about the server sending ready-to-use content, the client handling clicks, the state ownership concept, and the migration story in terms they understand.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain <subject>` — AI probes gaps.*

---

## Reframe

(Pause. Critique: Is this architecture over-engineered for a small app? For a 5-page marketing site with a contact form, would the RSC/Actions/Zustand separation be appropriate? What is the minimum complexity threshold where this architecture pays off? Write your evaluation considering team size, traffic, and feature complexity.)

---

## Drill

Take the capstone quiz. MCQs test architectural decisions across all 10 content areas — state ownership, ADR, streaming, deployment, migration, testing.

Run: `learn.sh quiz advanced-react-19 20-capstone`

## Quiz: 20-capstone


### A component renders product details fetched from DB, has no event handlers, no hooks. Where should it render?

- [ ] A: Client Component — most React components should be client-side

- [✓] B: RSC — default for components without hooks, events, or browser APIs

- [ ] C: Hybrid — fetch in RSC, render in Client Component

- [ ] D: Edge Runtime — component requires server but also needs client interactivity


**Answer:** B

RSC is default. This component needs no client runtime — no hooks, no events, no browser APIs. Rendering it as RSC eliminates its JS from bundle. Converting to Client Component adds unnecessary JS. Hybrid pattern (C) is wrong: if rendering is pure, keep both fetch and render in RSC. Edge Runtime (D) is about infrastructure, not component classification.


### A route has three sections: header (static, fast), chart (client D3, 80kb), comments (slow DB). Which streaming architecture is correct?

- [ ] A: Single Suspense boundary wrapping entire page — one skeleton, everything loads together

- [✓] B: Three Suspense boundaries: header no wrapper, chart Suspense with skeleton, comments Suspense with skeleton

- [ ] C: Header + comments in RSC, chart lazy loaded via next/dynamic with Suspense

- [ ] D: All sections client-side — Suspense only works with client components


**Answer:** B

Three Suspense boundaries isolate each section. Header renders immediately (no async dependency). Chart is a client component — it loads via Suspense when JS arrives. Comments stream when DB query completes. One boundary (A) makes all content wait for slowest section. Option C is partially correct but chart still needs Suspense for its lazy load. Option D is false — Suspense works with RSC streaming.


### A Server Action updates user display name. After action succeeds, the header showing the name does not update. What is missing?

- [ ] A: The action must return the new name — client component sets state manually

- [✓] B: The action must call revalidatePath('/') or revalidateTag('user') to trigger RSC re-render

- [ ] C: The header component must be wrapped in useOptimistic

- [ ] D: Server Actions cannot update server-rendered content — only client state


**Answer:** B

Server Action mutates DB but client does not know to re-fetch. `revalidatePath('/')` tells Next.js to re-render the RSC tree on next request, which fetches new data and returns updated RSC payload. Option A works but duplicates data — server is source of truth. Option C is for optimistic UI on the action caller, not for unrelated components. Option D is false — Actions explicitly work with RSC via revalidation.


### Which state type belongs in Zustand store in a React 19 application?

- [ ] A: Product data from database — server source of truth

- [ ] B: Form field values in a checkout form — ephemeral, route-specific

- [✓] C: Cart drawer open/close state — cross-cutting UI state used by header, overlay, and mobile nav

- [ ] D: URL search params — belongs in address bar for shareability


**Answer:** C

Cart drawer state is used by multiple unrelated components (header cart icon, drawer overlay, mobile navigation) across routes. Zustand is appropriate for cross-cutting client state. Option A belongs in RSC. Option B belongs in local component state or useActionState. Option D belongs in URL via useSearchParams.


### E2E test clicks 'Add to Cart' and checks cart count. Test sometimes passes, sometimes shows old count. What is the most reliable fix?

- [ ] A: Add a fixed delay (page.waitForTimeout(1000)) after clicking

- [✓] B: Use await expect(page.locator('[data-testid=cart-count]')).toHaveText('1') with retry

- [ ] C: Use page.reload() before checking cart count

- [ ] D: Disable optimistic updates to make state synchronous


**Answer:** B

Playwright's toHaveText retries until timeout or match — handles the race between action response and RSC revalidation. Test should not depend on timing. Fixed delay (A) is fragile — works for local but fails in CI. Reload (C) defeats the purpose of testing client interaction. Disabling optimistic updates (D) changes the application behavior being tested.


### A team migrates Create React App to Next.js App Router. They convert all components to 'use client' in week 1. What is the primary risk of leaving them as Client Components?

- [ ] A: Server Actions will not work with 'use client' components

- [✓] B: They miss the main benefit: client JS bundle reduction from moving rendering to RSC

- [ ] C: Client Components cannot receive props from Server Components

- [ ] D: Client Components require webpack 5, which CRA does not support


**Answer:** B

'use client' components ship their JS to the browser even if they only render static data. The main adoption benefit is moving pure-rendering components to RSC to eliminate ~40-60% of route-level JS. Option A is false — Server Actions work with client components via formAction. Option C is false — client components can receive serializable props from RSC. Option D is false — Next.js handles webpack.


### Self-hosted Next.js app with RSC. CPU usage spikes under load. Which optimization has the highest impact on reducing server render CPU cost?

- [ ] A: Add more Node.js processes behind load balancer

- [✓] B: Implement ISR or static generation for pages that can be pre-rendered

- [ ] C: Move all components to 'use client' to offload work to browser

- [ ] D: Increase server RAM from 2GB to 8GB


**Answer:** B

ISR eliminates per-request RSC rendering for pages that can be generated once and served cached. RSC rendering is CPU-bound (serializing JSX to RSC payload). Moving components to client (C) negates the benefits of RSC and increases client JS. Horizontal scaling (A) helps but does not address root cause. RAM (D) addresses memory, not CPU.


### A form uses useActionState. User submits with invalid data. Validation fails server-side. The form should show per-field errors. Which pattern correctly implements this?

- [ ] A: Client-side validation only — submit action returns nothing, client handles all errors

- [✓] B: Server Action returns { errors: { email: ['Invalid email'], name: [] } } — useActionState receives these, form renders errors per field

- [ ] C: Server Action throws Error with validation message — useActionState catches in error boundary

- [ ] D: Validation happens in middleware — form never reaches Server Action


**Answer:** B

Server Action returns structured errors object in the state. useActionState receives this as the new state value. Form reads state.errors to display per-field messages. Option A duplicates validation logic — server must validate regardless. Option C — throwing Error breaks the payload protocol. Option D — middleware validation is separate from form state management.


### A company has 100 React components wrapped in React.memo + useMemo. They adopt React Compiler. What should they do?

- [ ] A: Remove all React.memo and useMemo — Compiler handles everything

- [✓] B: Keep existing memoization. Enable Compiler. Incrementally remove manual memoization from files the compiler handles correctly, tested per module

- [ ] C: Keep only React.memo — Compiler replaces useMemo but not memo

- [ ] D: Disable compiler — manual memoization is always more predictable


**Answer:** B

Compiler is conservative — skips memoization when uncertain. Keeping existing manual memoization is safe: compiler does not double-memoize, it detects existing memo and skips. Incremental removal per module with StrictMode testing is correct. Option A risks regression if compiler skips a component it cannot analyze. Option C is false — compiler handles both. Option D misses the benefit of eliminating defensive memoization.


### A Server Component fetches user profile and passes it to a child Client Component. The client component modifies the profile locally (optimistic update). Where does the authoritative profile data live?

- [ ] A: Client component state — always trust the latest UI state

- [✓] B: Server Component fetch — server is source of truth. Client optimistic state is temporary and reverts on action resolution

- [ ] C: Both — data is synced bidirectionally

- [ ] D: Zustand store — cross-cutting state must be centralized


**Answer:** B

Server is always source of truth for server-originated data. useOptimistic provides a temporary UI overlay. When the server action resolves, the optimistic state reverts and the server value (updated via revalidation) becomes the current value. Option A causes inconsistent state — different clients could have different 'truth.' Option C is not how unidirectional data flow works. Option D is wrong — server data belongs in RSC, not Zustand.
