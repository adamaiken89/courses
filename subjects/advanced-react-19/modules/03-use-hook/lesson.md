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
