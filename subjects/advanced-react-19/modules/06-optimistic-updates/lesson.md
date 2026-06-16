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
