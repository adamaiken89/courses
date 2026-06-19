# Module 7: Query Cost Analysis

Est. study time: 2h
Language: en

## Learning Objectives
- Implement depth limiting and complexity scoring to protect GraphQL APIs
- Design rate limiting strategies based on query cost budgets
- Evaluate persisted queries vs cost analysis for production APIs

---

## Core Content

### Depth Limiting

Deeply nested queries can overwhelm servers. Without limits, a client can craft:

```graphql
query {
  user(id: "1") {
    posts { comments { author { posts { comments { author { posts { ... } } } } } } }
  }
}
```

Depth limiting rejects queries exceeding a configured max depth (e.g., 7 levels).

```typescript
import depthLimit from 'graphql-depth-limit'

const server = new ApolloServer({
  schema,
  validationRules: [depthLimit(7)]
})
// Query above with 10 levels → rejected with validation error
```

> **Think**: Why are flat queries cheaper than deeply nested ones?
>
> *Answer: Each nesting level multiplies potential data — depth d with branching factor b produces b^d potential nodes. Depth 4 at branch 10 = 10,000 nodes. Depth 7 = 10 million. Depth limiting caps worst-case exponential blowup.*

---

### Complexity Scoring

Depth alone is insufficient. A single shallow field may trigger expensive DB joins or external API calls. Complexity scoring assigns weights to fields:

```graphql
# Schema weights (declared via directive)
type Query {
  users(limit: Int): [User!]! @complexity(value: 5, multipliers: ["limit"])
  user(id: ID!): User @complexity(value: 1)
}

type User {
  posts: [Post!]! @complexity(value: 3)
  avatar: String @complexity(value: 1)
}
```

Computation: `total = Σ (fieldWeight × multiplierArg)`.

With limit=50: `users.complexity = 5 × 50 = 250`. Plus nested fields.

```typescript
import { createComplexityRule, simpleEstimator, fieldExtensionsEstimator } from 'graphql-query-complexity'

const rule = createComplexityRule({
  estimators: [
    fieldExtensionsEstimator(),
    simpleEstimator({ defaultComplexity: 1 })
  ],
  maximumComplexity: 1000
})
```

> **Think**: What multiplier value would you assign to a field that accepts `first`/`last` but not `limit`?
>
> *Answer: Use `first` or `last` as multiplier. The pagination argument directly controls how many items are returned, so it is the natural multiplier. Set `multipliers: ["first", "last"]`.*

---

### Rate Limiting Based on Cost Budget

Cost analysis feeds into rate limiting. Each client/api key gets a cost budget (e.g., 10,000 cost units per minute):

| Client | Budget | Query cost | Remaining |
|--------|--------|------------|-----------|
| Mobile app | 5,000/min | 50 | 4,950 |
| Dashboard | 20,000/min | 800 | 19,200 |
| Public API key | 1,000/min | 30 | 970 |

Implementation: compute query cost → deduct from token bucket → reject if insufficient.

```typescript
const costBudget = new Map<string, { tokens: number; resetAt: number }>()

function checkRateLimit(apiKey: string, queryCost: number): boolean {
  const bucket = costBudget.get(apiKey)
  if (!bucket || Date.now() > bucket.resetAt) {
    costBudget.set(apiKey, { tokens: 10000, resetAt: Date.now() + 60000 })
    return true
  }
  if (bucket.tokens < queryCost) return false
  bucket.tokens -= queryCost
  return true
}
```

---

### Query Timeouts vs Cost Analysis

Timeouts and cost analysis solve different problems:

| Mechanism | Protects against | Granularity | Downside |
|-----------|------------------|-------------|----------|
| Timeout | Runaway queries (wall clock) | Per-request | Kills after work done |
| Cost analysis | Complex queries before execution | Per-field | Overhead of computation |
| Depth limit | Deeply nested queries | Schema-level | Coarse — misses expensive shallow queries |

Cost analysis is proactive (reject before execution). Timeouts are reactive (kill during execution). Use both.

> **Think**: Which attacks can cost analysis catch that timeouts cannot?
>
> *Answer: A query that hits DB causing lock contention but returns quickly. Timeout would pass; cost analysis can flag expensive DB joins or cross-service calls before they execute.*

---

### Persisted Queries as Alternative

Persisted queries (PQ) replace runtime cost analysis with an allowlist approach:

1. Developer registers query at build time → gets hash (e.g., `sha256`)
2. Client sends hash instead of full query text
3. Server looks up hash → executes only approved queries

```graphql
# Instead of sending full query:
# Client sends: { "query": "query { user(id: \"1\") { name } }" }
# Client sends: { "extensions": { "persistedQuery": { "sha256Hash": "hash...", "version": 1 } } }
```

Benefits:
- No cost analysis runtime overhead
- No arbitrary queries — only approved patterns
- Smaller network payload (hash vs full query text)

Tradeoffs:
- Requires build-time registration pipeline
- Harder for ad-hoc queries (GraphiQL, debugging)
- Schema changes may invalidate persisted hashes

---

### Bypassing Cost Analysis for Trusted Clients

Internal services and admin tools may need unrestricted access. Strategies:

- **Header-based bypass**: `X-Client-Type: internal` → skip cost analysis
- **API key tiers**: `role: ADMIN` → higher or uncapped budget
- **Schema-level:** `@trusted` directive marks fields excluded from cost analysis

```graphql
directive @trusted on FIELD_DEFINITION

type Query {
  adminDashboard: Dashboard @trusted
  publicUser(id: ID!): User
}
```

Trusted client exemption must be auditable. Log whenever bypass triggers.

---

> ```mermaid
> graph TD
>   A[Incoming Query] --> B{Parse}
>   B --> C{Depth Check}
>   C -->|Exceeds max| D[Reject: TOO_DEEP]
>   C -->|Passes| E{Complexity Estimate}
>   E -->|Exceeds max| F[Reject: TOO_COMPLEX]
>   E -->|Passes| G{Rate Limit Check}
>   G -->|Over budget| H[Reject: RATE_LIMITED]
>   G -->|Within budget| I[Deduct cost]
>   I --> J[Execute Query]
>   J --> K[Return Response]
>   D --> L[Error Response]
>   F --> L
>   H --> L
> ```

### Why This Matters

Without cost analysis, a single malicious or miswritten query can bring down your GraphQL server. Depth limiting, complexity scoring, and rate limiting form a defense-in-depth strategy. Choosing between cost analysis and persisted queries depends on your API's access pattern — public APIs lean toward cost analysis, first-party SPAs toward persisted queries.

---

## Examples

### Example 1: Cost Analysis for a Social Media API

```graphql
# Schema with complexity annotations
type Query {
  feed(first: Int!): [Post!]! @complexity(value: 5, multipliers: ["first"])
  user(id: ID!): User @complexity(value: 2)
  search(term: String!, limit: Int): [SearchResult!]! @complexity(value: 3, multipliers: ["limit"])
}

type Post {
  comments(first: Int = 10): [Comment!]! @complexity(value: 2, multipliers: ["first"])
  likes: [Like!]! @complexity(value: 1)
  author: User @complexity(value: 2)
}

type User {
  posts(first: Int): [Post!]! @complexity(value: 3, multipliers: ["first"])
}
```

Query `{ feed(first: 50) { comments(first: 5) { text } author { name } } }` cost:
- `feed`: 5 × 50 = 250
- `comments`: 2 × 5 = 10 (× 50 feed items) = 500
- `author`: 2 (× 50 feed items) = 100
- Total: 850 / 1000 budget

---

### Example 2: Persisted Query Registration Pipeline

```typescript
// Build-time script: extract all queries from client source
// Hash each, store in persisted-query-manifest.json
import { globby } from 'globby'
import { createHash } from 'node:crypto'

const files = await globby('src/**/*.{ts,tsx,gql}')
const queries: Record<string, string> = {}

for (const file of files) {
  const content = await fs.readFile(file, 'utf-8')
  const hash = createHash('sha256').update(content).digest('hex')
  queries[hash] = content
}

await fs.writeFile('persisted-query-manifest.json', JSON.stringify(queries))
// Server loads manifest at startup, matches hash → query
```

---

## Key Takeaways
- Depth limiting caps exponential blowup from deeply nested queries
- Complexity scoring assigns weights + multipliers for granular cost per query
- Rate limiting based on cost budget protects shared server resources
- Timeouts are reactive; cost analysis is proactive — use both
- Persisted queries replace cost analysis with an allowlist approach
- Trusted clients can bypass with header/api-key/schema-level controls
- graphql-query-complexity and graphql-depth-limit are standard Node.js tools

---

## Common Misconception

**"Cost analysis replaces the need for query timeouts."**

No. Cost analysis prevents overly complex queries from executing. But a simple query can still hang due to DB lock or external API timeout. Timeouts are the last line of defense. Cost analysis + timeouts = defense in depth.

---

## Feynman Explain
Explain to a DevOps engineer why a query that selects only 3 fields can still crash the server. Cover: depth, complexity multipliers, N+1 traps, and why query text size is not the risk metric.

---

## Reframe
Critique: Persisted queries make GraphQL feel more like REST endpoints — fixed query shapes, registration pipeline. Does this defeat the flexibility benefit of GraphQL? When is the flexibility-cost tradeoff worth it?

---

## Drill
Take the quiz.

Run: `learn.sh quiz graphql-deep-dive 7`
