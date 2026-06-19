# Module 3: Queries

Est. study time: 2h
Language: en

## Learning Objectives
- Write queries with fields, arguments, variables, aliases, and fragments
- Use directives (@include, @skip) for conditional selection
- Apply inline fragments for polymorphic types (interface/union)

---

## Core Content

### Field Selection

Client requests exactly the fields needed. Shape of query = shape of response:

```graphql
query {
  user(id: "1") {
    name
    email
    posts {
      title
    }
  }
}

# Response:
{
  "data": {
    "user": {
      "name": "Alice",
      "email": "alice@example.com",
      "posts": [
        { "title": "GraphQL 101" },
        { "title": "Advanced Patterns" }
      ]
    }
  }
}
```

> **Think**: Why does the response mirror the query shape rather than using a flat structure?
>
> *Answer: Predictability. Client knows exactly where each field appears. No post-processing needed to navigate nested JSON. REST often requires multiple traversals or normalization.*

---

### Arguments

Every field can accept arguments — not just root fields:

```graphql
query {
  user(id: "1") {
    name
    avatar(width: 200, height: 200, format: WEBP)
    posts(first: 5, sort: RECENT) {
      title
    }
  }
}
```

**Key distinction**: REST puts arguments in URL path/query/body. GraphQL puts arguments on any field. This enables rich filtering at every level of the graph.

---

### Variables

Queries can be parameterized. Separates query text from runtime values:

```graphql
query GetUser($userId: ID!, $postLimit: Int) {
  user(id: $userId) {
    name
    posts(first: $postLimit) {
      title
    }
  }
}
```

Variable rules:
- Declared with `$name: Type` after operation keyword
- Can have defaults: `$limit: Int = 10`
- Must match schema argument type
- Cannot be used in `@skip`/`@include` conditions (they take `Boolean!` variables — actually they can)

> **Think**: Why use variables instead of string interpolation?
>
> *Answer: Variables are type-checked against the schema, cached separately from query text (persisted queries), and prevent injection attacks. String interpolation breaks caching and type safety.*

---

### Aliases

Rename fields in response. Essential for requesting the same field with different arguments:

```graphql
query {
  alice: user(id: "1") { name }
  bob: user(id: "2") { name }
}

# Response:
{
  "data": {
    "alice": { "name": "Alice" },
    "bob": { "name": "Bob" }
  }
}
```

Without aliases, you cannot query the same field twice at the same level.

---

### Fragments

Reusable selection sets. Avoid repeating fields:

```graphql
fragment UserFields on User {
  id
  name
  email
  avatar
}

query {
  user(id: "1") {
    ...UserFields
    posts { title }
  }
}
```

Fragments can spread into other fragments and include directives.

---

### Inline Fragments

For interfaces and unions — access type-specific fields:

```graphql
query {
  search(term: "graphql") {
    ... on User { name email }
    ... on Post { title body }
    ... on Comment { text }
  }
}
```

Also used for type conditions without defining a named fragment.

---

### Directives @skip and @include

Conditionally include/exclude fields at runtime:

```graphql
query UserProfile($showEmail: Boolean!, $hideAvatar: Boolean!) {
  user(id: "1") {
    name
    email @include(if: $showEmail)
    avatar @skip(if: $hideAvatar)
  }
}
```

> **Think**: Can @skip and @include be used on the same field?
>
> *Answer: No — behavior is undefined if both applied. Use one or the other.*

---

> ```mermaid
> graph TD
>   subgraph Query Structure
>     A["query OperationName($var: Type!)"] --> B[Selection Set]
>     B --> C[Field: scalar]
>     B --> D[Field: object]
>     B --> E[Fragment spread]
>     B --> F[Inline fragment]
>     D --> G[Nested selection set]
>     E --> H[Reusable fragment]
>     F --> I[Type-conditional fields]
>     C --> J["@include / @skip"]
>     C --> K[Alias]
>   end
> ```

### Operation Types and Name

Three operation types: `query`, `mutation`, `subscription`. Operation name:

```graphql
# ❌ Anonymous — harder to debug, no caching
query { user(id: "1") { name } }

# ✅ Named — better logs, persisted queries, devtools
query GetUser { user(id: "1") { name } }
```

> **Think**: When is anonymous query acceptable?
>
> *Answer: Only in GraphiQL/exploratory context or one-shot scripts. Production code always names operations for monitoring, persisted queries, and cache keying.*

---

### Top-Level Fields vs Nested

Root Query fields are entry points. Nested fields traverse the graph. Every query must start at a root field:

```graphql
type Query {
  me: User
  user(id: ID!): User
  users(filter: UserFilter): [User!]!
  search(term: String!): [SearchResult!]!
}
```

No other way to enter the graph — this centralization is deliberate.

---

### Why This Matters

Query structure is the client contract. Poorly designed queries cause over-fetching, under-fetching, and waterfall requests. Mastering fields, arguments, fragments, and variables lets you write efficient, reusable queries that minimize data transfer and maximize cache hit rates.

---

## Examples

### Example 1: Paginated Profile with Conditional Display

```graphql
query ProfilePage($userId: ID!, $showDrafts: Boolean!, $limit: Int = 10) {
  user(id: $userId) {
    ...UserFields
    posts(first: $limit, status: PUBLISHED) {
      ...PostFields
    }
    drafts: posts(first: $limit, status: DRAFT) @include(if: $showDrafts) {
      ...PostFields
    }
  }
}

fragment UserFields on User {
  id name avatar email
}

fragment PostFields on Post {
  id title createdAt
}
```

---

## Key Takeaways
- Query shape mirrors response shape — predictable
- Arguments on any field enable rich filtering at every level
- Variables: type-safe, cacheable, injection-proof
- Aliases: same field, different args in one query
- Fragments: reusable selection sets reduce duplication
- @include/@skip: runtime field visibility control
- Inline fragments: access interface/union-specific fields
- Always name operations in production

---

## Common Misconception

**"Fragments are just a client-side convenience — the server treats them the same as inlined fields."**

Actually true — fragments are expanded client-side by GraphQL execution. No server performance difference. But fragments DRY up your queries and make cache normalization work (Apollo's cache uses `__typename` + `id` from fragment spreads to identify entities).

---

## Feynman Explain
Explain to a mobile developer: how a GraphQL query guarantees they never over-fetch or under-fetch data. Show one query vs equivalent REST calls.

---

## Drill
Take the quiz.

Run: `learn.sh quiz graphql-deep-dive 3`
