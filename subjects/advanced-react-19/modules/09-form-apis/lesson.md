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
