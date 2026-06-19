# Module 6: N+1 & DataLoader

Est. study time: 2.5h
Language: en

## Learning Objectives
- Diagnose N+1 problem in GraphQL resolver chains
- Implement DataLoader with batch functions and per-request cache
- Apply cache key strategies, priming, and avoid common pitfalls

---

## Core Content

### The N+1 Problem

Classic pattern: 10 users, each has posts. Naive resolver fetches users (1 query), then for each user fetches posts (N queries). Total: 1 + N = 11 DB queries where 1 suffices.

```javascript
// ❌ N+1 — one query per user
const resolvers = {
  Query: {
    users: async (_, args, { db }) => {
      return db.users.findAll() // 1 query
    },
  },
  User: {
    posts: async (user, args, { db }) => {
      return db.posts.findByUserId(user.id) // N queries!
    },
  },
}
```

Client query triggers N+1:

```graphql
query {
  users {
    name
    posts { title }  # triggers per-user posts fetch
  }
}
```

Result: 1 `SELECT * FROM users` + 10 `SELECT * FROM posts WHERE user_id = ?`.

> **Think**: Is N+1 always 10 users? Could it be 100? 1000?
>
> *Answer: N is whatever pagination/page size the client requests. A dashboard querying 50 users × 3 nested relations = 1 + 150 queries. Multiply by concurrent users. N+1 scales destructively.*

---

### DataLoader: Batch + Cache

DataLoader solves N+1 via two mechanisms:

1. **Batch function**: Collects all keys across resolver calls, executes one batched query
2. **Per-request cache**: Deduplicates same key requests

```javascript
import DataLoader from 'dataloader'

// Batch function — receives array of keys, returns array of values SAME ORDER
const batchUsers = async (ids) => {
  const users = await db.users.findByIds(ids) // WHERE id IN (...)
  return ids.map(id => users.find(u => u.id === id) || null)
}

// Create loader per request
const userLoader = new DataLoader(batchUsers)

// In resolver:
const resolvers = {
  User: {
    posts: async (user, args, { postLoader }) => {
      return postLoader.load(user.id)
    },
  },
}
```

Now: 1 query for users + 1 batched query for posts = 2 total (regardless of N).

> ```mermaid
> graph LR
>     subgraph Without DataLoader
>       A[usersResolver] --> B[1 query: users]
>       B --> C1[User 1 → posts: 1 query]
>       B --> C2[User 2 → posts: 1 query]
>       B --> C3[User N → posts: 1 query]
>     end
>     
>     subgraph With DataLoader
>       D[usersResolver] --> E[1 query: users]
>       E --> F[postsResolver called N times]
>       F --> G[DataLoader buffers all keys]
>       G --> H[1 batched query: posts WHERE user_id IN (...)]
>     end
> ```

---

### Batch Function Rules

1. **Must return array same length as keys** — position i corresponds to keys[i]
2. **Must not throw** — return `Error` instance for individual failures instead
3. **Can return Promise** — batch may be async
4. **Batched by event loop tick** — all `load()` calls in same tick batch together

```javascript
// Correct batch function
const batchPosts = async (userIds) => {
  const posts = await db.posts.findByUserIds(userIds)
  // Group posts by userId
  const grouped = userIds.map(id =>
    posts.filter(p => p.userId === id)
  )
  return grouped
}

const postLoader = new DataLoader(batchPosts)

// ⚠️ Wrong: returning in wrong order
const wrongBatch = async (ids) => {
  const users = await db.users.findByIds(ids)
  return users  // DB may return in different order!
}
```

> **Think**: Why does DataLoader enforce same-order requirement?
>
> *Answer: Parallel resolver calls don't know which key maps to which call site. DataLoader tracks order via load() call sequence. If batch returns mismatched order, every resolver gets wrong data — silent data corruption.*

---

### Cache Key Strategies

DataLoader uses **identity** keys by default (Map-key equality). Customize via `options.cacheKeyFn`:

```javascript
// Object keys — need custom cache key
const loader = new DataLoader(batchFn, {
  cacheKeyFn: (key) => key.id,  // extract primitive
})

// Case-insensitive keys
const loader = new DataLoader(batchFn, {
  cacheKeyFn: (key) => key.toLowerCase(),
})
```

Primitive keys (string, number) are simpler. Object keys require stable serialization for cache dedup.

Cache scope: **per request**. New DataLoader created per HTTP request/GraphQL execution:

```javascript
// Apollo context factory — fresh loaders per request
const context = ({ req }) => ({
  userLoader: new DataLoader(batchUsers),
  postLoader: new DataLoader(batchPosts),
  commentLoader: new DataLoader(batchComments),
})
```

> **Think**: Why per-request cache instead of global?
>
> *Answer: Global cache leaks data between users (user A sees user B's stale data). Per-request cache is ephemeral — lives for one request, dies after. Also prevents memory leaks from accumulating keys across requests.*

---

### Cache Priming

Pre-populate cache with known data — prevents redundant loads:

```javascript
async function getTeam(teamId, { userLoader }) {
  const team = await db.teams.findById(teamId)

  // We already fetched these users in the team query
  // Prime the loader so resolver calls don't re-fetch
  team.members.forEach(user => {
    userLoader.prime(user.id, user)
  })

  return team
}
```

Without priming: query team → resolver loads team members → each member triggers `User.name` via userLoader → hits DB again. Priming avoids this.

---

### DataLoader in Resolver Chains (Nested N+1)

N+1 compounds across depth:

```graphql
query {
  teams {
    name
    members {
      name
      posts {
        title
        comments { text }
      }
    }
  }
}
```

Each level needs its own DataLoader. Chain:

1. `teams` → teamLoader (1 query)
2. `members` → userLoader (1 batched query)
3. `posts` → postLoader (1 batched query)
4. `comments` → commentLoader (1 batched query)

Total: 4 queries (without DataLoader: 1 + T + T×M + T×M×P).

```javascript
// Each level loads via batch
const resolvers = {
  Team: {
    members: (team, _, { userLoader }) =>
      userLoader.loadMany(team.memberIds),
  },
  User: {
    posts: (user, _, { postLoader }) =>
      postLoader.loadMany(user.postIds),
  },
  Post: {
    comments: (post, _, { commentLoader }) =>
      commentLoader.loadMany(post.commentIds),
  },
}
```

---

### Manual Batching vs DataLoader

Manual batching — collect keys, resolve at end of tick:

```javascript
const pendingKeys = new Set()
const results = {}

function loadUser(id) {
  pendingKeys.add(id)
  process.nextTick(async () => {
    const users = await db.users.findByIds([...pendingKeys])
    users.forEach(u => { results[u.id] = u })
    pendingKeys.clear()
  })
  return results[id]  // ❌ returns undefined — no sync return
}
```

DataLoader handles: batching schedule, ordering, caching, error mapping, loading states. Manual batching is fragile — subtle ordering bugs, race conditions, no cache dedup.

> **Think**: Could you solve N+1 with JOINs instead of DataLoader?
>
> *Answer: JOINs work for simple cases (1 level deep). But GraphQL queries are dynamic — client may skip nested fields. JOIN-based resolvers always join even when not needed. DataLoader lazy-batches: only loads what client requests. Also, JOINs don't compose well across microservices, while DataLoader works across service boundaries.*

---

### Common Pitfalls

**Pitfall 1: Cross-request caching**

```javascript
// ❌ Global — cache persists across users, leaks data
const userLoader = new DataLoader(batchUsers)

// ✅ Per-request
const context = () => ({
  userLoader: new DataLoader(batchUsers),
})
```

**Pitfall 2: Cache invalidation — mutations**

DataLoader cache is write-once. After mutation, cache holds stale value:

```javascript
// ❌ Cache still returns old user
async function updateUser(_, { id, name }, { userLoader }) {
  const user = await db.users.update(id, { name })
  return user  // userLoader.load(id) still returns old value!
}

// ✅ Clear after mutation
async function updateUser(_, { id, name }, { userLoader }) {
  const user = await db.users.update(id, { name })
  userLoader.clear(id)  // next load() fetches fresh
  return user
}
```

**Pitfall 3: Not loading enough — loadMany vs load**

```javascript
// ❌ Sequential — each await stamps a new tick
for (const id of ids) {
  const post = await postLoader.load(id)  // new batch per tick!
}

// ✅ Batching — collect all keys
const posts = await postLoader.loadMany(ids)
```

**Pitfall 4: Circular dependencies**

Type A loader loads type B which loads type A. Resolver never resolves. Use field-level loaders or break cycle with data joins.

---

### Why This Matters

N+1 is the #1 performance bug in GraphQL. Naive resolver code that works fine in development becomes a production disaster when clients query deeply nested data. DataLoader is the standard solution — used by Apollo, Relay, GraphQL Yoga, and most server frameworks. Understanding batch functions, cache scope, and priming makes the difference between a smooth 10ms response and a 10-second one.

---

## Examples

### Example 1: Full DataLoader Setup

```javascript
// batch-fns.js
const batchUsers = async (ids) => {
  const users = await db.select('users').whereIn('id', ids)
  return ids.map(id => users.find(u => u.id === id) || null)
}

const batchPostsByUserIds = async (userIds) => {
  const posts = await db.select('posts').whereIn('user_id', userIds)
  return userIds.map(id => posts.filter(p => p.userId === id))
}

// context.js
const createLoaders = () => ({
  userLoader: new DataLoader(batchUsers),
  postLoader: new DataLoader(batchPostsByUserIds),
})

// resolvers.js
const resolvers = {
  Query: {
    users: (_, args, { userLoader }) => userLoader.loadMany(args.ids),
  },
  User: {
    posts: (user, _, { postLoader }) => postLoader.load(user.id),
  },
}
```

---

### Example 2: Cache Priming with JOIN

```javascript
async function getUserWithPosts(userId, { userLoader, postLoader }) {
  // Single JOIN query — get both user and posts
  const rows = await db.raw(`
    SELECT u.*, p.id as post_id, p.title, p.body
    FROM users u
    LEFT JOIN posts p ON p.user_id = u.id
    WHERE u.id = ?
  `, [userId])

  if (rows.length === 0) return null

  const user = { id: rows[0].id, name: rows[0].name }
  const posts = rows
    .filter(r => r.post_id)
    .map(r => ({ id: r.post_id, title: r.title, body: r.body }))

  // Prime both caches
  userLoader.prime(userId, user)
  postLoader.prime(userId, posts)

  return { user, posts }
}
```

---

## Key Takeaways
- N+1: resolver fetches parent, then per-child query — 1+N DB calls
- DataLoader batches by event-loop tick: group keys, one query
- Batch function must return array same length and order as keys
- Cache per-request only — never global/shared across requests
- Cache priming avoids redundant fetches for already-known data
- Nested resolvers need their own DataLoader per level
- Use loadMany() not looped load() for arrays
- Clear cache after mutations to prevent stale reads

---

## Common Misconception

**"DataLoader is only for database batching — I don't need it if my ORM already batches."**

ORMs batch identical queries within one request context, but they don't understand GraphQL resolver execution. DataLoader's per-tick batching is key: all `load()` calls in one event-loop tick coalesce into one batched call regardless of which resolver made them. ORM-level batching typically requires explicit configuration and doesn't compose across resolver chains. Also, DataLoader's cache is smarter — it deduplicates by key within the same request.

---

## Feynman Explain
Explain N+1 and DataLoader to a backend developer who knows SQL joins but is new to GraphQL. Focus on: why N+1 happens in resolvers (not in REST), how DataLoader's event-loop batching works, and why per-request cache matters for correctness.

---

## Reframe
Critique: DataLoader adds another abstraction layer between resolvers and data access. For simple schemas (flat, few relations), is the complexity worth it? When does DataLoader become essential vs premature optimization?

---

## Drill
Take the quiz.

Run: `learn.sh quiz graphql-deep-dive 6`
