# Module 9: Client Normalized Cache

Est. study time: 2h 30m
Language: en

## Learning Objectives
- Explain normalized cache structure: flat entities keyed by `__typename` + `id`, references replacing nesting
- Configure Apollo Client InMemoryCache with typePolicies, keyFields, and eviction policies
- Implement cache persistence and redirects using apollo3-cache-persist and field read functions

---

## Core Content

### Normalized Store Shape

Client cache stores data as flat entity map, not nested response tree. Each object with `id` (or custom key) stored once, referenced by other entities.

```
Response shape (nested):
  query.user -> { id: "1", name: "Alice", posts: [{ id: "10", title: "..." }] }

Normalized cache (flat):
  User:1    -> { id: "1", name: "Alice", posts: ["Post:10"] }
  Post:10   -> { id: "10", title: "..." }
  ROOT_QUERY -> { user: "User:1" }
```

Benefits:
- Deduplication — same entity fetched twice updates single cache entry
- Consistency — all references see latest data
- Partial updates — update User:1 once, every view reflecting it updates

> **Think**: Why does normalization matter when same User appears in multiple queries (profile page, post author, comment author)?
>
> *Answer: Without normalization, each query stores User copy. Mutating user's name requires finding + updating every copy. Normalized cache stores User:1 once; all queries reference it. Single mutation update propagates everywhere.*

---

### Apollo Client InMemoryCache

Core configuration:

```typescript
import { InMemoryCache } from "@apollo/client";

const cache = new InMemoryCache({
  typePolicies: {
    User: {
      keyFields: ["id"],
    },
    Post: {
      keyFields: ["id"],
    },
    // Composite key — when no single id field
    Review: {
      keyFields: ["productId", "userId"],
    },
  },
});
```

`keyFields` tells Apollo how to identify entities. Default uses `id` + `__typename`. Customize when entity uses composite key or non-standard id name.

```typescript
// Entity uses "slug" instead of "id"
typePolicies: {
  Product: {
    keyFields: ["slug"],
  },
}
```

> **Think**: What happens when two entities have same id but different __typename?
>
> *Answer: Cache stores them separately. Key = `__typename` + `id` composite. `User:1` and `Post:1` do not collide. Problem only when __typename missing or wrong (e.g., union without __typename).*

---

### Normalization vs Denormalization

| Aspect | Normalized | Denormalized |
|--------|-----------|-------------|
| Storage | Flat entity map | Nested response tree |
| Dedup | Automatic | Manual dedup needed |
| Update | Propagates everywhere | Must update each copy |
| Read cost | Reference resolution | Direct access |
| Complexity | Cache config required | Simple (just store response) |

Normalized wins for apps with shared entities (User, Product). Denormalized fine for isolated fetch-once data (search results, analytics).

---

### Garbage Collection

Apollo's cache GC removes entities not reachable from any root query.

Eviction tools:

```typescript
// Evict specific entity
cache.evict({ id: cache.identify({ __typename: "Post", id: "10" }) });

// Evict field from root
cache.evict({ fieldName: "temporaryData" });

// Prevent eviction — retain
cache.retain({ id: cache.identify({ __typename: "User", id: "1" }) });
```

GC triggers:
- `cache.gc()` called manually
- After `cache.evict()`
- After `cache.reset()`

Default GC uses mark-sweep: marks reachable entities from root queries, sweeps unmarked.

> **Think**: When would a legitimately useful entity become unreachable and get GC'd?
>
> *Answer: When entity only referenced by evicted cache fields, or when query returns subset of entities and user never accesses others. Example: cache fetches Product list (page 1), GC runs — page 2 products exist in cache from previous mutation but no root query references them. They get collected. Use `retain()` to protect.*

---

### Persistence: apollo3-cache-persist

Cache survives page reload via persistence layer:

```typescript
import { persistCache, LocalStorageWrapper } from "apollo3-cache-persist";

const cache = new InMemoryCache();

await persistCache({
  cache,
  storage: new LocalStorageWrapper(window.localStorage),
  // Optional: only persist specific types
  maxSize: 1048576, // 1MB limit
  debug: true,
});
```

For mobile (React Native / Capacitor):

```typescript
import { AsyncStorageWrapper } from "apollo3-cache-persist";
// Uses AsyncStorage under the hood
```

Cache hydration happens automatically on next app load. Watch for stale data — persistence cache lives until explicitly cleared or cache policy changes.

---

### Cache Redirects

Read entity data from different cache location. Useful when list query contains enough data for detail view:

```typescript
typePolicies: {
  Query: {
    fields: {
      product(_, { args, toReference }) {
        // Redirect to existing entity in cache
        return toReference({ __typename: "Product", id: args?.id });
      },
    },
  },
}
```

Without redirect, querying `product(id: "5")` fetches from network even when `Product:5` already cached from product list.

---

### Relay-Style Cache (RecordSource)

Relay cache differs from Apollo:

```
Relay RecordSource:
  client:root -> { "user(id:\"1\")": { ... } }
  client:User:1 -> { id: "1", name: "Alice" }

Apollo:
  ROOT_QUERY -> { user: { __ref: "User:1" } }
  User:1 -> { id: "1", name: "Alice" }
```

Relay uses opaque `DataID` strings; Apollo uses `__typename + id` convention. Relay's cache is immutable — updates create new records. Apollo supports mutable `cache.modify`.

---

### Common Issues

**Missing id fields** — entity without `id` field defaults to `__typename + keyFields` but if neither `id` nor custom `keyFields` configured, Apollo falls back to array position, causing dedup failure.

```typescript
// Entity type without id field
// Must set keyFields or rely on __typename only
typePolicies: {
  AnalyticsEvent: {
    keyFields: false, // treats each as unique, no normalization
  },
}
```

**Type mismatch** — union types or interfaces may return entities with different `__typename`. Client must have typePolicies for each concrete type.

**Stale data** — cache returns old data when entity updated on server but cache not invalidated. Fix: refetch queries, use cache eviction, or subscribe to changes.

> **Think**: How do you debug "cache returned stale User name"?
>
> *Answer: Check Apollo DevTools. Is User:1 cached with old name? Check if mutation returned updated User in response. If yes, cache should auto-update. If mutation only returns success boolean, cache never learns of change — need refetch or cache.modify.*

---

> ```mermaid
> graph LR
>   subgraph "Network Response (Nested)"
>     NR["query.user<br/>{id:1, name:Alice, posts:[...]}"]
>   end
>   subgraph "Normalized Cache (Flat)"
>     RQ["ROOT_QUERY<br/>user → User:1"]
>     U1["User:1<br/>id:1, name:Alice<br/>posts → [Post:10, Post:11]"]
>     P10["Post:10<br/>id:10, title:A"]
>     P11["Post:11<br/>id:11, title:B"]
>   end
>   NR -->|"normalize"| RQ
>   NR -->|"extract"| U1
>   NR -->|"extract"| P10
>   NR -->|"extract"| P11
>   style NR fill:#e1f5fe,stroke:#0288d1
>   style RQ fill:#fff3e0,stroke:#f57c00
>   style U1 fill:#f3e5f5,stroke:#7b1fa2
>   style P10 fill:#f3e5f5,stroke:#7b1fa2
>   style P11 fill:#f3e5f5,stroke:#7b1fa2
> ```

### Why This Matters

Every production GraphQL client uses normalized cache. Understanding entity identity, reference resolution, and eviction prevents bugs: stale data, missing entities, memory leaks, incorrect optimistic updates. Cache is not magic — it is data structure you configure.

---

## Examples

### Example 1: Multi-entity mutation update

Schema: `type Mutation { createPost(input: CreatePostInput!): Post! }`

Without normalization, creating Post updates only the query that fired mutation. With normalization, Post:42 appears in any query that reads posts:

```typescript
typePolicies: {
  Post: { keyFields: ["id"] },
  User: {
    fields: {
      posts: {
        merge(existing = [], incoming) {
          // Merge new posts into existing list
          return [...existing, ...incoming];
        },
      },
    },
  },
}
```

Now creating a Post that returns author info automatically wires into User's posts list.

### Example 2: Cache redirect for product detail

```typescript
typePolicies: {
  Query: {
    fields: {
      product: {
        read(_, { args, toReference }) {
          return toReference({ __typename: "Product", id: args?.id });
        },
      },
    },
  },
}
```

Cached product list already fetched `Product:5`. Navigating to product detail page — normally would trigger network request. With redirect, reads from cache immediately. Falls back to network only if entity missing.

---

## Key Takeaways
- Normalized cache stores flat entity map keyed by `__typename + id`, uses references for relationships
- InMemoryCache `typePolicies` configures keyFields, merge functions, read functions, and field behavior
- GC uses mark-sweep: entities unreachable from root queries get evicted
- Cache persistence requires explicit library (apollo3-cache-persist) with storage backend
- Cache redirects avoid network fetch when entity already exists
- Relay uses immutable RecordSource; Apollo supports mutable cache.modify
- Missing id fields, type mismatches, and stale data are most common normalized cache bugs

---

## Common Misconception

**"Apollo cache automatically normalizes everything."**

False. Normalization requires entities to have `id` field (or custom `keyFields`). Types without id + __typename fall back to array-position keys — no deduplication, no reference tracking. Configure typePolicies for every type that needs normalization. Also, nested objects without id are stored inline, not normalized.

---

## Feynman Explain
Explain normalized cache to a React developer using Redux. Describe: flat entity map vs nested state trees, why references replace nesting, and how `createEntityAdapter` pattern parallels InMemoryCache typePolicies. Use Store, reducer, selector vocabulary.

*When ready, say explanation aloud or write it down. Then run `learn.sh explain graphql-deep-dive 9` — AI will probe your explanation for gaps.*

---

## Reframe
Critique: Normalized cache adds complexity — typePolicies, keyFields, merge functions, GC config. For a small app with 3-4 types, is `fetch-policy: network-only` simpler and safer than configuring normalization? When does normalization complexity justify itself?

---

## Drill
Take the quiz. MCQs test different angles — recall, application, scenario.

Run: `learn.sh quiz graphql-deep-dive 9`
