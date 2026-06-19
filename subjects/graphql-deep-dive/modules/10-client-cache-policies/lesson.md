# Module 10: Client Cache Policies

Est. study time: 2h
Language: en

## Learning Objectives
- Select appropriate fetchPolicy for each query based on freshness and latency requirements
- Configure write policies, optimistic responses, and cache.modify to update cache after mutations
- Implement field policies with read and merge functions to control cache behavior

---

## Core Content

### fetchPolicy Options

Apollo Client provides six fetch policies controlling cache vs network behavior:

| Policy | Cache check | Network request | Use case |
|--------|------------|-----------------|----------|
| `cache-first` | Yes | Only if miss | Default. Fast, stale-tolerant |
| `cache-and-network` | Yes | Always | Fresh data + instant render |
| `network-only` | No | Always | Must be fresh (prices, status) |
| `no-cache` | No | Always, no write | Ephemeral data (search, logs) |
| `cache-only` | Yes | Never | Static reference data |
| `standby` | Yes (passive) | Subscriptions/refetch | Background sync |

```typescript
const { data } = useQuery(GET_USER, {
  variables: { id: "1" },
  fetchPolicy: "cache-and-network",
  // For mutation-triggered updates:
  nextFetchPolicy: "cache-first",
});
```

`nextFetchPolicy` transitions policy after initial fetch — useful for cache-and-network → cache-first.

> **Think**: If `cache-first` serves stale data when cache is populated, why is it default?
>
> *Answer: Most apps prefer instant render over fresh data. Stale data acceptable for common UIs (profile, lists). Tradeoff: user sees stale data briefly, but avoids loading spinner. `cache-and-network` gives both instant render + eventual consistency.*

---

### When to Use Each Policy

**cache-first**: User profiles, settings pages, reference lists. Freshness not critical.

**network-only**: Payment status, auction bids, game scores. Stale data causes incorrect decisions.

**cache-and-network**: Feed views, comments, notifications. Show cached data immediately, refresh in background. Ideal for social apps.

**no-cache**: Ephemeral input forms, search suggestions, logging mutations. No benefit from caching.

**cache-only**: Country list, currency codes, static config. Never changes, never hits network.

**standby**: Used internally by Apollo for `refetchQueries` and subscriptions. Query updates when cache changes but does not trigger network.

> **Think**: What is wrong with using `network-only` for every query?
>
> *Answer: Eliminates all caching benefit. Every navigation fires network request. No offline support. More bandwidth, slower rendering. network-only is right only when data changes every second and stale data is dangerous.*

---

### Write Policies: Mutation Cache Updates

Mutation results must update cache. Three strategies:

#### 1. Automatic (default)
Mutation returns modified entity with `id`. Apollo matches cache entity by `__typename + id`, merges fields.

```typescript
// mutation returns { updateUser: { id: "1", name: "Bob" } }
// Cache User:1 automatically updated with new name
```

#### 2. refetchQueries
Fire queries after mutation succeeds. Simple but wasteful:

```typescript
const [createPost] = useMutation(CREATE_POST, {
  refetchQueries: [GET_POSTS, GET_USER_POSTS],
});
```

#### 3. cache.modify (granular)
Directly update cache entities:

```typescript
const [addTodo] = useMutation(ADD_TODO, {
  update(cache, { data }) {
    cache.modify({
      fields: {
        todos(existingTodos = []) {
          const newTodoRef = cache.writeFragment({
            data: data.addTodo,
            fragment: gql`
              fragment NewTodo on Todo { id title completed }
            `,
          });
          return [...existingTodos, newTodoRef];
        },
      },
    });
  },
});
```

> **Think**: When should you use `update` callback vs relying on automatic cache update?
>
> *Answer: Automatic update works only when mutation returns the full updated entity. Use `update` when mutation modifies list (add/remove item), when mutation response does not include full entity, or when mutation affects multiple cache fields.*

---

### Optimistic Responses

Update cache before server confirms. Instant UI feedback:

```typescript
const [addComment] = useMutation(ADD_COMMENT, {
  optimisticResponse: {
    __typename: "Mutation",
    addComment: {
      __typename: "Comment",
      id: "optimistic-" + Date.now(),
      text: commentText,
      author: { __typename: "User", id: currentUserId, name: "Me" },
    },
  },
  update(cache, { data }) {
    // Update works the same — optimistic or real data
    cache.modify({
      fields: {
        comments(existing = []) { return [...existing, data.addComment]; },
      },
    });
  },
});
```

If server rejects, Apollo rolls back optimistic update and shows actual error. Key: optimistic data must match query shape exactly.

> **Think**: What happens to optimistic entity after server responds?
>
> *Answer: Apollo replaces optimistic entity with server response. If IDs differ (optimistic: temp-id, real: db-id), cache must handle both. Use `cache.modify` to remove optimistic-ref and add real ref. Some apps use server-generated IDs pre-assigned via UUID to avoid remapping.*

---

### Cache Modification: readQuery, writeQuery

Read or write arbitrary data in cache:

```typescript
// Read current cache state
const { user } = cache.readQuery({
  query: GET_USER,
  variables: { id: "1" },
});

// Write entirely new data
cache.writeQuery({
  query: GET_USER,
  variables: { id: "1" },
  data: { user: { __typename: "User", id: "1", name: "Charlie" } },
});
```

**WARNING**: `writeQuery` replaces entire query subtree. Use `cache.modify` for targeted updates unless you want full replacement.

---

### Field Policies: read and merge

Fine-grained control per field:

```typescript
typePolicies: {
  User: {
    fields: {
      // read — transform value when reading from cache
      fullName: {
        read(_, { variables }) {
          // Computed field — derived from other fields
          return `${this.firstName} ${this.lastName}`;
        },
      },
      // merge — control array concatenation
      posts: {
        merge(existing = [], incoming) {
          // Pagination: append new page
          return [...existing, ...incoming];
        },
      },
    },
  },
}
```

Common patterns:
- **Pagination merge**: append incoming items to existing array
- **Read-only fields**: compute derived values
- **Null defaults**: return fallback when cache has no value

> **Think**: Why does default merge for lists replace existing data instead of appending?
>
> *Answer: Apollo assumes each query result is complete within its own scope. Replacing is safe — avoids duplicates. If you paginate, you need custom merge. Default merge: replace. Explicit merge: append + deduplicate.*

---

### cache-and-network Race Conditions

`cache-and-network` can produce flash of stale data when network returns after render but before user interacts.

Scenario:
1. Query runs, cache returns stale data -> render
2. Network fetch starts
3. User mutates data
4. Network returns old data -> overwrites user's mutation

Fix: use `nextFetchPolicy: "cache-first"` after initial fetch, or use optimistic responses for mutations.

---

### Refetch vs readQuery

| Aspect | refetch | readQuery |
|--------|---------|-----------|
| Network request | Yes | No |
| Returns Promise | Yes | Yes (synchronous if cached) |
| Updates cache | Yes (via network) | Only if writeQuery used |
| Use case | Force refresh | Read current snapshot |

```typescript
// Force network refresh
await client.refetchQueries({ include: [GET_USER] });

// Read current cache without network
const data = client.readQuery({ query: GET_USER });
```

> **Think**: When would you use `refetch` over `cache-and-network`?
>
> *Answer: cache-and-network fires on every query mount. refetch fires on demand (button click, pull-to-refresh). Use cache-and-network for automatic background refresh. Use refetch for explicit user-triggered refresh.*

---

> ```mermaid
> graph TD
>   subgraph "fetchPolicy Decision Tree"
>     A[Query Mounts] --> B{Cache Hit?}
>     B -->|Yes| C{Policy?}
>     B -->|No| D[network-only / no-cache / cache-first]
>     C -->|cache-first| E[Return Cache]
>     C -->|cache-and-network| F[Return Cache + Fire Network]
>     C -->|network-only| G[Skip Cache, Fire Network]
>     C -->|no-cache| H[Skip Cache, Skip Writing]
>     C -->|cache-only| I[Return Cache or Null]
>     C -->|standby| J[Passive Listen Only]
>     F --> K[Network Returns → Merge into Cache]
>     G --> K
>     D --> K
>   end
>   style A fill:#e1f5fe,stroke:#0288d1
>   style E fill:#c8e6c9,stroke:#388e3c
>   style F fill:#fff3e0,stroke:#f57c00
>   style G fill:#ffcdd2,stroke:#d32f2f
> ```

### Why This Matters

Cache policies are the difference between smooth UX and confusing UX. Wrong policy: loading spinners on every page, stale data showing after mutations, or flash-of-old-data. Understanding fetchPolicy, update strategies, and optimistic responses lets you control exactly when network fires and what user sees.

---

## Examples

### Example 1: Social Feed with Optimistic Like

```typescript
const [likePost] = useMutation(LIKE_POST, {
  optimisticResponse: {
    __typename: "Mutation",
    likePost: {
      __typename: "Post",
      id: postId,
      likes: post.likes + 1,
      isLiked: true,
    },
  },
  update(cache, { data }) {
    cache.modify({
      id: cache.identify({ __typename: "Post", id: postId }),
      fields: {
        likes() { return data.likePost.likes; },
        isLiked() { return data.likePost.isLiked; },
      },
    });
  },
});
```

User taps like → count increments instantly. If server fails, count rolls back.

### Example 2: Paginated Comments with Merge

```typescript
typePolicies: {
  Post: {
    fields: {
      comments: {
        keyArgs: ["sortBy"], // Cache separate lists per sort order
        merge(existing = [], incoming) {
          return [...existing, ...incoming];
        },
      },
    },
  },
}
```

Without merge: each page load replaces previous. With merge: pages append. `keyArgs` distinguishes lists by sort order.

---

## Key Takeaways
- Six fetch policies balance freshness vs speed: cache-first (default), cache-and-network, network-only, no-cache, cache-only, standby
- Mutation cache updates: automatic (entity match), refetchQueries (brute force), cache.modify (precise)
- Optimistic responses render mutation results instantly before server confirms
- Field policies (read, merge) give per-field control over cache behavior
- cache-and-network risks race conditions when network response lags behind user mutation
- refetch forces network; readQuery reads cache snapshot without network
- `nextFetchPolicy` transitions policy after initial fetch

---

## Common Misconception

**"optimisticResponse and update are mutually exclusive — one or the other."**

False. They work together. `optimisticResponse` provides fake data for instant render. `update` callback runs twice: first with optimistic data (UI update), then with real server data (cache correction). The update logic does not change — it handles both phases identically.

---

## Feynman Explain
Explain Apollo cache policies to a React developer who only knows REST + Redux. Describe: why fetch policies replace manual loading states, how optimistic updates replace Redux optimistic dispatches, and why cache.modify replaces reducer logic for specific cache slices.

*When ready, say explanation aloud or write it down. Then run `learn.sh explain graphql-deep-dive 10` — AI will probe your explanation for gaps.*

---

## Reframe
Critique: Apollo's cache policy API is over-engineered. Six fetch policies, multiple update strategies, field-level merge functions — do developers really need this knobs, or does it reflect poor defaults? Compare with Relay's simpler (but less flexible) cache model: is configuration power worth cognitive overhead?

---

## Drill
Take the quiz. MCQs test different angles — recall, application, scenario.

Run: `learn.sh quiz graphql-deep-dive 10`
