# Module 8: Connection Pattern

Est. study time: 2h
Language: en

## Learning Objectives
- Implement Relay Connection spec for cursor-based pagination
- Distinguish cursor pagination from offset pagination with tradeoffs
- Handle backward pagination, total count, and federation scenarios

---

## Core Content

### Cursor vs Offset Pagination

Offset pagination (e.g., `?page=3&limit=10`) is simple but has fundamental flaws:

| Concern | Offset | Cursor |
|---------|--------|--------|
| Stability | Items inserted/deleted shift pages | Cursor points to specific item |
| Consistency | Same item may appear on multiple pages | No duplicates |
| Performance | `OFFSET` scans skipped rows | `WHERE cursor > X` uses index |
| Real-time | Stale quickly with writes | Stable cursor references |

```graphql
# Offset — fragile
query {
  users(page: 3, limit: 10) { id name }
}

# Cursor — stable
query {
  users(first: 10, after: "YXJyYXljb25uZWN0aW9uOjI=") { edges { node { id name } } }
}
```

> **Think**: Under what conditions does offset pagination perform acceptably?
>
> *Answer: Small, static datasets (e.g., enum values, configuration). Or when the UI only supports "next page" forward navigation (no deep page numbers). For real-time feeds or large datasets, cursor pagination is necessary.*

---

### Relay Connection Spec

The Relay Connection spec defines a standard shape for paginated lists:

```graphql
type Query {
  users(first: Int, after: String, last: Int, before: String): UserConnection
}

type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
}

type UserEdge {
  node: User!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}
```

Components:
- **Connection** — wraps the paginated list with edges + pageInfo
- **Edge** — pairs each item (node) with its cursor
- **Node** — the actual entity
- **PageInfo** — navigation metadata

Arguments:
- `first` — fetch N items forward from `after`
- `after` — cursor: start after this position
- `last` — fetch N items backward from `before`
- `before` — cursor: end before this position

---

### Forward Pagination

```graphql
query {
  users(first: 10, after: "cursor_50") {
    edges {
      cursor
      node { id name }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

Implementation pattern (SQL):

```typescript
async function usersResolver(_, { first = 10, after }) {
  const cursor = after ? decodeCursor(after) : null
  const query = cursor
    ? `SELECT * FROM users WHERE id > $1 ORDER BY id ASC LIMIT $2`
    : `SELECT * FROM users ORDER BY id ASC LIMIT $1`
  const params = cursor ? [cursor, first + 1] : [first + 1]
  const rows = await db.query(query, params)

  const hasNextPage = rows.length > first
  const nodes = hasNextPage ? rows.slice(0, first) : rows
  const edges = nodes.map(node => ({
    node,
    cursor: encodeCursor(node.id)
  }))

  return {
    edges,
    pageInfo: {
      hasNextPage,
      startCursor: edges[0]?.cursor,
      endCursor: edges[edges.length - 1]?.cursor
    }
  }
}
```

> **Think**: Why fetch `first + 1` items instead of exactly `first`?
>
> *Answer: Fetch one extra item to determine `hasNextPage`. If we get `first + 1` results, there is a next page. Discard the extra item. Avoids a separate COUNT query.*

---

### Backward Pagination

Backward pagination uses `last` and `before`. More complex because ordering inverts:

```typescript
async function usersResolver(_, { last = 10, before }) {
  const cursor = before ? decodeCursor(before) : null
  const query = cursor
    ? `SELECT * FROM users WHERE id < $1 ORDER BY id DESC LIMIT $2`  // DESC!
    : `SELECT * FROM users ORDER BY id DESC LIMIT $1`
  const params = cursor ? [cursor, last + 1] : [last + 1]
  const rows = await db.query(query, params)

  const hasPreviousPage = rows.length > last
  const nodes = hasPreviousPage ? rows.slice(0, last) : rows
  nodes.reverse()  // Back to ASC order

  const edges = nodes.map(node => ({
    node,
    cursor: encodeCursor(node.id)
  }))

  return {
    edges,
    pageInfo: {
      hasPreviousPage,
      startCursor: edges[0]?.cursor,
      endCursor: edges[edges.length - 1]?.cursor
    }
  }
}
```

Edge case: `first` + `after` combined with `last` + `before` in same query is undefined per Relay spec. Servers typically reject this.

---

### Total Count in Connections

Adding total count breaks cursor pagination's performance advantage if computed naively:

```graphql
type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!  # Requires separate COUNT query
}
```

```typescript
async function usersResolver(_, { first, after }) {
  const [edges, totalCount] = await Promise.all([
    fetchPage(first, after),
    db.query('SELECT COUNT(*) FROM users')  // Full table scan on large tables
  ])
  return { edges, totalCount, ... }
}
```

Optimization: use approximate counts (e.g., `EXPLAIN` estimate, Redis counter, or sampled count). Document that `totalCount` is approximate for large datasets.

> **Think**: Does totalCount matter for infinite scroll UIs?
>
> *Answer: No — infinite scroll only needs hasNextPage. totalCount is useful for paginated lists with page numbers, admin dashboards, or "Showing 1-10 of 1,234" UX patterns. Omit when not needed.*

---

### Slice-Based vs ID-Based Cursors

Two common cursor strategies:

**Slice-based** (opaque, default in Relay):
```
cursor = base64("arrayconnection:42")  // position in result set
```
Problems: breaks if items inserted/deleted before the cursor shifts positions.

**ID-based (stable)**:
```
cursor = base64(`user:${user.id}`)  // references entity directly
```
Better: survives inserts/deletes. Cursor points to entity, not position. Requires ordering by the cursor field (typically `id` or `createdAt`).

```typescript
function encodeCursor(id: string): string {
  return Buffer.from(`cursor:${id}`).toString('base64')
}

function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, 'base64').toString('utf-8').replace('cursor:', '')
}
```

> **Think**: When would slice-based cursors be simpler despite instability?
>
> *Answer: For append-only datasets (e.g., event logs, audit trails) where items never change order. Or when cursor only needs to survive a single client session.*

---

### Pagination in Federation

In Apollo Federation, a federated graph may paginate entities across subgraphs:

```graphql
# Products subgraph
type Product @key(fields: "id") {
  id: ID!
  reviews(first: Int, after: String): ReviewConnection
}

# Reviews subgraph
type Review @key(fields: "id") {
  id: ID!
  productId: ID!
  text: String!
}
```

The router must call reviews subgraph for each product. This is N+1 pagination — solve with `@requires` or entity batching:

```graphql
# Alternative: batch pagination query
extend type Query {
  reviewsByProductIds(productIds: [ID!]!, first: Int): [ProductReviews!]!
}

type ProductReviews {
  productId: ID!
  reviews: ReviewConnection
}
```

Federation adds complexity: cursor must be unique across subgraphs. Prefix cursor with subgraph identifier.

---

> ```mermaid
> graph LR
>   subgraph Offset Pagination
>     A[Page 1: items 1-10] --> B[Page 2: items 11-20]
>     B --> C[Item 5 inserted → shift]
>     C --> D[Page 2 now items 5-14]
>     D --> E["❌ Duplicate / skip"]
>   end
>
>   subgraph Cursor Pagination
>     F[First 10 after start] --> G[Next 10 after cursor_10]
>     G --> H[Item 5 inserted → no shift]
>     H --> I[Next 10 after cursor_10]
>     I --> J["✅ Stable"]
>   end
> ```

### Why This Matters

Pagination is the most common GraphQL pattern after basic CRUD. The Relay Connection spec is the de facto standard — Apollo, Shopify, GitHub, and most production GraphQL APIs use it. Mastering cursor pagination, implementing `first`/`after` and `last`/`before`, and understanding federation implications separates production-grade APIs from toy implementations.

---

## Examples

### Example 1: Full Connection Resolver with Both Directions

```typescript
const resolvers = {
  Query: {
    users: async (_, args, { db }) => {
      const { first, after, last, before } = args

      if (first && after) {
        // Forward pagination
        const cursor = decodeCursor(after)
        const rows = await db.query(
          `SELECT * FROM users WHERE id > $1 ORDER BY id LIMIT $2`,
          [cursor, first + 1]
        )
        return buildConnection(rows, first)
      }

      if (last && before) {
        // Backward pagination
        const cursor = decodeCursor(before)
        const rows = await db.query(
          `SELECT * FROM users WHERE id < $1 ORDER BY id DESC LIMIT $2`,
          [cursor, last + 1]
        )
        const conn = buildConnection(rows, last)
        conn.edges.reverse()
        return conn
      }

      // Default: first 10
      const rows = await db.query(
        `SELECT * FROM users ORDER BY id LIMIT $1`, [11]
      )
      return buildConnection(rows, 10)
    }
  }
}

function buildConnection(rows, limit) {
  const hasMore = rows.length > limit
  const nodes = hasMore ? rows.slice(0, limit) : rows
  const edges = nodes.map(node => ({
    node,
    cursor: encodeCursor(node.id)
  }))
  return {
    edges,
    pageInfo: {
      hasNextPage: hasMore,
      hasPreviousPage: false,
      startCursor: edges[0]?.cursor,
      endCursor: edges[edges.length - 1]?.cursor
    }
  }
}
```

---

### Example 2: Paginated Comments with Total Count

```graphql
type Query {
  comments(postId: ID!, first: Int, after: String): CommentConnection!
}

type CommentConnection {
  edges: [CommentEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}
```

```typescript
const resolvers = {
  Query: {
    comments: async (_, { postId, first = 10, after }, { db }) => {
      const cursor = after ? decodeCursor(after) : null
      const [rows, [{ count }]] = await Promise.all([
        db.query(
          cursor
            ? `SELECT * FROM comments WHERE post_id = $1 AND id > $2 ORDER BY id LIMIT $3`
            : `SELECT * FROM comments WHERE post_id = $1 ORDER BY id LIMIT $2`,
          cursor ? [postId, cursor, first + 1] : [postId, first + 1]
        ),
        db.query(`SELECT COUNT(*) FROM comments WHERE post_id = $1`, [postId])
      ])

      const hasNextPage = rows.length > first
      const nodes = hasNextPage ? rows.slice(0, first) : rows
      const edges = nodes.map(node => ({
        node,
        cursor: encodeCursor(node.id)
      }))

      return {
        edges,
        pageInfo: { hasNextPage, hasPreviousPage: false, startCursor: edges[0]?.cursor, endCursor: edges[edges.length - 1]?.cursor },
        totalCount: Number(count)
      }
    }
  }
}
```

---

## Key Takeaways
- Cursor pagination is stable under inserts/deletes; offset pagination is not
- Relay Connection spec: edges (node + cursor) + pageInfo (hasNextPage, hasPreviousPage)
- Forward: `first` + `after`; Backward: `last` + `before`
- Fetch `first + 1` items to detect `hasNextPage` without extra query
- ID-based cursors survive data changes; slice-based cursors do not
- Backward pagination requires DESC order + reverse
- `totalCount` adds cost — use approximate counts for large datasets
- Federation pagination needs subgraph-aware cursors and batch queries

---

## Common Misconception

**"Cursor pagination is always better than offset."**

Not always. Offset pagination is simpler, cacheable via URL, and suitable for small static datasets (dropdowns, config panels, admin pages with page numbers). Cursor pagination is superior for real-time feeds, large datasets, and any scenario where items shift. Choose based on your data mutation pattern, not dogma.

---

## Feynman Explain
Explain to a mobile developer why their chat app's pagination breaks when new messages arrive — and how cursor-based pagination fixes it. Contrast with offset-based page numbers.

---

## Reframe
Critique: The Relay Connection spec adds significant boilerplate (Connection, Edge, PageInfo types) for every paginated field. Is the standardization worth the verbosity? When would a simpler pagination pattern suffice?

---

## Drill
Take the quiz.

Run: `learn.sh quiz graphql-deep-dive 8`
