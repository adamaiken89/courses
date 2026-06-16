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
