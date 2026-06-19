# Module 20: Data Fetching — TanStack Query

Est. study time: 2.5h
Language: en

## Learning Objectives
- Set up QueryClientProvider with React 19
- Use useQuery and useMutation for data fetching and mutations
- Understand staleTime vs gcTime (formerly cacheTime)
- Implement pagination with keepPreviousData and placeholderData
- Build infinite scrolling with useInfiniteQuery
- Implement optimistic updates with onMutate rollback
- Handle parallel, dependent, and conditional queries
- Use React Query DevTools for debugging
- React 19: use() hook vs useQuery, Suspense integration with skipToken
- Design typed query hooks with codegen patterns
- Build cache invalidation and prefetching strategies

---

## Core Content

### TanStack Query Architecture

TanStack Query manages server state: caching, background refetching, stale detection, garbage collection.

```
Component
  ├── useQuery(key, fetcher)
  │     └── QueryClient (cache)
  │           ├── staleTime: data considered fresh (no refetch)
  │           ├── gcTime: data kept in cache after unused
  │           └── retry: auto-retry on failure
  └── useMutation(mutationFn)
        └── invalidateQueries / setQueryData
```

| Concept | Old name | New name (v5+) | Default |
|---------|----------|----------------|---------|
| Freshness duration | staleTime | staleTime | 0 (always stale) |
| Cache retention | cacheTime | gcTime | 5 minutes |
| Refetch on window focus | refetchOnWindowFocus | refetchOnWindowFocus | true |
| Retry count | retry | retry | 3 |

### Setup with React 19

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,   // 5 min fresh
      gcTime: 1000 * 60 * 30,      // 30 min garbage collection
      refetchOnWindowFocus: true,
      retry: 2,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Content />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
```

### useQuery

```typescript
import { useQuery } from '@tanstack/react-query'

type User = { id: string; name: string; email: string }

async function fetchUsers(): Promise<User[]> {
  const res = await fetch('/api/users')
  if (!res.ok) throw new Error('Failed to fetch users')
  return res.json()
}

function UsersList() {
  const { data, isLoading, isError, error, isFetching } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: fetchUsers,
  })

  if (isLoading) return <Spinner />
  if (isError) return <p>Error: {error.message}</p>

  return (
    <div>
      {isFetching && <span>Refreshing...</span>}
      {data?.map((user) => <UserCard key={user.id} user={user} />)}
    </div>
  )
}
```

Query keys:

```typescript
// Scalar key
useQuery({ queryKey: ['users'], queryFn: fetchUsers })

// Key with params — unique key per param
useQuery({
  queryKey: ['user', userId],
  queryFn: () => fetchUser(userId),
})

// Key with object — order matters for cache matching
useQuery({
  queryKey: ['users', { page, limit, sort }],
  queryFn: () => fetchUsers({ page, limit, sort }),
})
```

### useMutation

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'

function CreateUserForm() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (newUser: { name: string; email: string }) =>
      fetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(newUser),
      }).then((r) => r.json()),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },

    onError: (error) => {
      toast.error(`Failed: ${error.message}`)
    },
  })

  return (
    <form onSubmit={(e) => {
      e.preventDefault()
      mutation.mutate({ name: 'Alice', email: 'alice@example.com' })
    }}>
      <button disabled={mutation.isPending}>
        {mutation.isPending ? 'Creating...' : 'Create User'}
      </button>
    </form>
  )
}
```

### staleTime vs gcTime

```typescript
// Data fresh for 5 minutes — no background refetch during this window
useQuery({
  queryKey: ['users'],
  queryFn: fetchUsers,
  staleTime: 1000 * 60 * 5,
})

// Data stays in cache for 30 minutes after last observer unmounts
// Subsequent mount within 30min shows cached data immediately
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { gcTime: 1000 * 60 * 30 },
  },
})
```

| Setting | Effect |
|---------|--------|
| staleTime: 0 | Always refetch on mount (default) |
| staleTime: Infinity | Never refetch automatically |
| gcTime: 0 | Eager garbage collection — no offline cache |
| gcTime: Infinity | Never garbage collect |

### Pagination

```typescript
function PaginatedUsers() {
  const [page, setPage] = useState(1)

  const { data, isPlaceholderData } = useQuery({
    queryKey: ['users', page],
    queryFn: () => fetchUsersPage(page),
    placeholderData: keepPreviousData,
    // React 19: placeholderData keeps previous data during fetch
  })

  return (
    <div>
      {data?.users.map((user) => <UserCard key={user.id} user={user} />)}
      <button
        disabled={page <= 1}
        onClick={() => setPage((p) => p - 1)}
      >
        Previous
      </button>
      <button
        disabled={isPlaceholderData || !data?.hasMore}
        onClick={() => setPage((p) => p + 1)}
      >
        Next
      </button>
    </div>
  )
}
```

`placeholderData: keepPreviousData` (v5) replaces `keepPreviousData: true` (v4). Shows stale data during fetch transition instead of loading spinner.

### Infinite Scrolling

```typescript
import { useInfiniteQuery } from '@tanstack/react-query'

function InfiniteFeed() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: ({ pageParam }) => fetchFeedPage(pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })

  // IntersectionObserver to trigger fetchNextPage
  return (
    <div>
      {data?.pages.map((page) =>
        page.items.map((item) => <FeedItem key={item.id} item={item} />)
      )}
      <button
        ref={loadMoreRef}
        onClick={() => fetchNextPage()}
        disabled={!hasNextPage || isFetchingNextPage}
      >
        {isFetchingNextPage ? 'Loading more...' : hasNextPage ? 'Load more' : 'All loaded'}
      </button>
    </div>
  )
}
```

### Optimistic Updates

```typescript
function ToggleLike({ postId, liked }: { postId: string; liked: boolean }) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => fetch(`/api/posts/${postId}/like`, { method: 'POST' }),

    onMutate: async () => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['post', postId] })

      // Snapshot previous value
      const previous = queryClient.getQueryData(['post', postId])

      // Optimistically update
      queryClient.setQueryData(['post', postId], (old: Post) => ({
        ...old,
        likes: liked ? old.likes - 1 : old.likes + 1,
        isLiked: !liked,
      }))

      return { previous }
    },

    onError: (_err, _vars, context) => {
      // Rollback on error
      queryClient.setQueryData(['post', postId], context?.previous)
    },

    onSettled: () => {
      // Refetch to ensure server sync
      queryClient.invalidateQueries({ queryKey: ['post', postId] })
    },
  })

  return (
    <button onClick={() => mutation.mutate()}>
      {liked ? 'Unlike' : 'Like'}
    </button>
  )
}
```

### Parallel and Dependent Queries

```typescript
// Parallel — multiple useQuery calls (they run in parallel automatically)
function Dashboard() {
  const users = useQuery({ queryKey: ['users'], queryFn: fetchUsers })
  const posts = useQuery({ queryKey: ['posts'], queryFn: fetchPosts })
  const stats = useQuery({ queryKey: ['stats'], queryFn: fetchStats })

  if (!users.data || !posts.data || !stats.data) return <Loading />

  return <DashboardView users={users.data} posts={posts.data} stats={stats.data} />
}

// Dependent — enabled when previous query succeeds
function UserPosts({ userId }: { userId: string }) {
  const userQuery = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
  })

  const postsQuery = useQuery({
    queryKey: ['user-posts', userId],
    queryFn: () => fetchUserPosts(userId),
    enabled: !!userQuery.data,  // Wait for user load
  })

  if (!userQuery.data || !postsQuery.data) return <Loading />
  return <PostsList user={userQuery.data} posts={postsQuery.data} />
}
```

### Suspense Integration

React 19 Suspense with TanStack Query:

```typescript
function UserProfile() {
  // useSuspenseQuery triggers Suspense boundary instead of returning isLoading
  const { data: user } = useSuspenseQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
  })

  const { data: posts } = useSuspenseQuery({
    queryKey: ['user-posts', userId],
    queryFn: () => fetchUserPosts(userId),
    // Enabled only after user loads — Suspense handles waterfall
  })

  return <ProfileView user={user} posts={posts} />
}

// Parent
;<Suspense fallback={<BigSpinner />}>
  <UserProfile userId="123" />
</Suspense>
```

`skipToken` for conditional queries without Suspense:

```typescript
const { data } = useQuery({
  queryKey: ['user', userId],
  queryFn: userId ? () => fetchUser(userId) : skipToken,
})
```

### Prefetching

```typescript
import { useQueryClient } from '@tanstack/react-query'

function UserLink({ userId }: { userId: string }) {
  const queryClient = useQueryClient()

  // Prefetch on hover
  const prefetch = () => {
    queryClient.prefetchQuery({
      queryKey: ['user', userId],
      queryFn: () => fetchUser(userId),
      staleTime: 1000 * 60,
    })
  }

  return (
    <Link
      to={`/users/${userId}`}
      onMouseEnter={prefetch}
    >
      View Profile
    </Link>
  )
}
```

### Cache Invalidation Strategy

```typescript
// Invalidate single query
queryClient.invalidateQueries({ queryKey: ['users'] })

// Invalidate all queries matching prefix
queryClient.invalidateQueries({ queryKey: ['user'] })  // ['user', id], ['user', 'list']...

// Invalidate with predicate
queryClient.invalidateQueries({
  predicate: (query) => query.queryKey[0] === 'user' && query.state.data?.role === 'admin',
})

// Remove from cache
queryClient.removeQueries({ queryKey: ['temp', id] })
```

### Typed Query Hooks (Codegen Pattern)

```typescript
// hooks/useUser.ts
export function useUser(userId: string) {
  return useQuery<User>({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
  })
}

// hooks/useUsers.ts
export function useUsers(filters: UserFilters) {
  return useQuery<User[]>({
    queryKey: ['users', filters],
    queryFn: () => fetchUsers(filters),
  })
}

// hooks/useCreateUser.ts
export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}
```

### React Query DevTools

```typescript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

// Only in development
;<ReactQueryDevtools
  initialIsOpen={false}
  buttonPosition="bottom-left"
/>
```

DevTools features: inspect cache, query states (fresh/stale/loading/inactive), trigger refetch, toggle disable, view query data.

> **Think**: What is the difference between isLoading and isFetching in useQuery?
>
> *Answer: isLoading = no cached data AND fetch in progress (first load). isFetching = fetch in progress (any fetch — first, background refetch, retry). isFetching is true even when cached data is shown (background refetch). isLoading is only true for the initial load when no data exists in cache.*

---

### Why This Matters

Data fetching is the most common frontend pattern. Every app fetches, caches, paginates, and mutates server data. TanStack Query eliminates boilerplate (loading/error states, refetch logic, cache management) and prevents bugs (stale data, race conditions, unnecessary requests). Understanding its cache model is essential for building performant, reliable React apps.

---

### Common Questions

**Q: Should I put all API calls in TanStack Query or use React Context for shared data?**
A: Use TanStack Query for server state (API data). React Context for client state (theme, locale, feature flags). TanStack Query handles caching, background sync, and invalidation. Context does not.

**Q: How to handle file upload progress?**
A: useMutation with axios `onUploadProgress`. Track progress in mutation state: `const [progress, setProgress] = useState(0)`.

---

## Examples

### Example 1: Full Data Layer with Typed Hooks

```typescript
// api/users.ts
export function fetchUsers(): Promise<User[]> { ... }
export function fetchUser(id: string): Promise<User> { ... }
export function createUser(data: CreateUserDTO): Promise<User> { ... }

// hooks/useUsers.ts
export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    staleTime: 1000 * 60 * 2,
  })
}

// hooks/useUser.ts
export function useUser(id: string) {
  return useQuery({
    queryKey: ['user', id],
    queryFn: () => fetchUser(id),
    enabled: !!id,
  })
}

// hooks/useCreateUser.ts
export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
    },
  })
}
```

### Example 2: Optimistic Like Toggle (Social Feed)

```typescript
function LikeButton({ post }: { post: Post }) {
  const qc = useQueryClient()

  const likeMutation = useMutation({
    mutationFn: () => fetch(`/api/posts/${post.id}/like`, { method: 'POST' }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['feed'] })
      const prev = qc.getQueryData(['feed'])
      qc.setQueryData(['feed'], (old: Post[]) =>
        old.map((p) => p.id === post.id ? { ...p, likes: p.likes + 1, liked: true } : p)
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      qc.setQueryData(['feed'], ctx?.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['feed'] })
    },
  })

  return (
    <button onClick={() => likeMutation.mutate()}>
      {post.liked ? 'Liked' : 'Like'} ({post.likes})
    </button>
  )
}
```

---

## Key Takeaways
- QueryClientProvider wraps app. configure staleTime/gcTime defaults.
- useQuery: queryKey (cache key) + queryFn (fetcher). Returns data, isLoading, isError, isFetching.
- useMutation: mutationFn, onSuccess (invalidateQueries), onMutate (optimistic), onError (rollback).
- staleTime: data fresh duration. gcTime: cache retention after unused.
- Pagination: placeholderData: keepPreviousData shows stale data during page transition.
- Infinite scroll: useInfiniteQuery, getNextPageParam, fetchNextPage.
- Optimistic updates: onMutate snapshot + setQueryData, onError rollback, onSettled refetch.
- Dependent queries: enabled option gates query on previous success.
- Suspense: useSuspenseQuery triggers Suspense boundary. skipToken for conditionals.
- Prefetching: queryClient.prefetchQuery on hover for instant navigation.
- Typed hooks: wrap useQuery/useMutation in custom hooks for reusability.

## Common Misconception

**"TanStack Query replaces useState/useReducer for all state."**

TanStack Query manages server state (data from API). Client state (modal open, form input, filter selection) still belongs in useState/useReducer/Context. Using TanStack Query for client state adds unnecessary complexity and memory overhead.

---

## Feynman Explain
(Explain TanStack Query to backend engineer: "TanStack Query is Redis for your frontend. It caches API responses, marks them stale after configurable TTL (staleTime), background-refreshes stale data, and evicts unused cache after gcTime. Components subscribe to cache keys — when you mutate, cache invalidates, subscribed components refetch. Like database materialized view with automatic refresh policy." Compare to React's useState: useState is local variable, TanStack Query is shared cache with coherency protocol.)

---

## Reframe
(Pause. Data fetching libraries are not needed for every project. For a static marketing site, TanStack Query overhead is not justified. For 10+ API endpoints with caching, pagination, and mutations, TanStack Query eliminates more code than it adds. Decision rule: if app fetches data from more than 3 endpoints with mutations, adopt TanStack Query. If app is mostly static pages with one-off fetch calls, native fetch + useEffect is simpler.)

---

## Drill
Take the quiz. MCQs test useQuery/useMutation, staleTime vs gcTime, pagination, infinite query, optimistic updates, Suspense integration, prefetching, cache invalidation, typed hooks, and React 19 compatibility.

Run: `learn.sh quiz external-lib-patterns 20-data-fetching-tanstack-query`
