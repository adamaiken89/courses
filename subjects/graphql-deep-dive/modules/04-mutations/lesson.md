# Module 4: Mutations

Est. study time: 2h
Language: en

## Learning Objectives
- Design mutation inputs and payloads following best practices
- Implement error handling patterns including partial success
- Ensure idempotency for safe retry behavior

---

## Core Content

### Mutation vs Query

Mutations are write operations. Key differences from queries:

| Aspect | Query | Mutation |
|--------|-------|----------|
| Semantics | Read | Write |
| Execution | Parallel | Series (strict order) |
| HTTP method | GET | POST |
| Caching | Yes (CDN, client) | No |
| Side effects | None | Allowed |

> **Think**: Why does GraphQL execute mutations serially?
>
> *Answer: Mutations may have side effects and dependencies. `mutation { createOrder createPayment sendEmail }` — payment depends on order ID, email depends on both. Serial execution guarantees deterministic ordering. Parallel mutation execution could cause race conditions.*

---

### Input Types

Complex mutation arguments use `input` types:

```graphql
input CreateUserInput {
  name: String!
  email: String!
  role: UserRole = USER
  avatar: Upload
}

type Mutation {
  createUser(input: CreateUserInput!): User!
}
```

Best practices:
- One input type per mutation (not shared across mutations unless fields truly identical)
- Use default values where sensible
- `input` types cannot be interfaces or unions — use `@oneOf` directive (GraphQL spec 2024+) for mutually exclusive fields:

```graphql
input ContactInput @oneOf {
  email: String
  phone: String
}
# Exactly one must be set — validated at schema level
```

---

### Payload Design

Return the created/updated entity directly, OR use a payload type for richer responses:

```graphql
# Simple return
type Mutation {
  createUser(input: CreateUserInput!): User!
}

# Payload pattern — recommended for complex mutations
type CreateUserPayload {
  user: User
  query: Query  # enables chaining
  errors: [UserError!]
}

type UserError {
  field: String!
  message: String!
}

type Mutation {
  createUser(input: CreateUserInput!): CreateUserPayload!
}
```

> **Think**: Why return payload type instead of the entity directly?
>
> *Answer: Payload enables: (1) returning multiple entities, (2) including errors with field-level granularity, (3) embedding a `query` root for chaining, (4) future extensibility without breaking changes. Direct entity return couples mutation output to a single type.*

---

### Error Handling Patterns

Three-tier error model:

**1. Top-level GraphQL errors** — unexpected failures, auth failures, rate limits:

```graphql
{
  "data": { "createUser": null },
  "errors": [{ "message": "Database unavailable", "extensions": { "code": "DB_DOWN" } }]
}
```

**2. Field-level errors in payload** — validation, business logic:

```graphql
type CreateUserPayload {
  user: User
  errors: [UserError!]
}

# Response:
{
  "data": {
    "createUser": {
      "user": null,
      "errors": [
        { "field": "email", "message": "Already taken" },
        { "field": "name", "message": "Too short (min 2 chars)" }
      ]
    }
  }
}
```

**3. Partial success** — some operations succeed, others fail:

```graphql
type BatchCreateUserPayload {
  users: [User!]
  errors: [UserError!]
}
# 2 succeeded, 1 failed
```

> **Think**: When to use GraphQL errors vs payload errors?
>
> *Answer: GraphQL errors for system-level failures (auth, server error, rate limit). Payload errors for business logic failures (validation, duplicate, insufficient funds). GraphQL errors abort the field; payload errors coexist with partial data.*

---

### Idempotency

Mutations should be idempotent for safe retries:

```graphql
input CreateOrderInput {
  idempotencyKey: ID!
  items: [OrderItemInput!]!
}
```

Implementation pattern:

```typescript
const resolvers = {
  Mutation: {
    createOrder: async (_, { input }, { dataSources }) => {
      const existing = await dataSources.orders.findByIdempotencyKey(input.idempotencyKey)
      if (existing) return existing  // Return cached result
      const order = await dataSources.orders.create(input)
      return order
    }
  }
}
```

Idempotency is critical for payment, order, and any mutation with side effects.

---

### Mutation Ordering

Top-level mutation fields execute sequentially. Nested fields within a mutation resolver execute per normal resolver chain (parallel where independent):

```graphql
mutation {
  step1: doSomething(input: { ... })
  step2: doSomethingElse(input: { ... })
}
# step1 completes before step2 starts
```

---

> ```mermaid
> sequenceDiagram
>     participant C as Client
>     participant G as GraphQL Server
>     participant DB as Database
>     C->>G: mutation { createUser(input: {...}) }
>     G->>G: Validate input types
>     G->>G: Execute resolver
>     G->>DB: INSERT users
>     DB-->>G: User record
>     G-->>C: { data: { createUser: { user, errors } } }
> ```

### Why This Matters

Mutations are the most error-prone part of any API. Poor mutation design causes data corruption, non-retryable failures, confusing error responses, and breaking changes. Well-designed mutations with input types, payloads, explicit errors, and idempotency make APIs robust and self-documenting.

---

## Examples

### Example 1: Complete Mutation with Payload and Errors

```graphql
input UpdateProfileInput {
  name: String
  avatar: Upload
  bio: String
}

type UpdateProfileError {
  field: String!
  message: String!
  code: String!
}

type UpdateProfilePayload {
  user: User
  errors: [UpdateProfileError!]
}

type Mutation {
  updateProfile(input: UpdateProfileInput!): UpdateProfilePayload!
}
```

---

## Key Takeaways
- Mutations execute serially; queries execute in parallel
- Use `input` types for complex arguments — one input per mutation
- Payload types enable error + data + chaining in one response
- Three error tiers: system (GraphQL errors), validation (payload errors), partial success
- Idempotency keys prevent duplicate processing on retry
- Always name mutations with action verbs: `createUser`, `updateProfile`, `deletePost`

---

## Common Misconception

**"Mutations should return only the mutated entity."**

Limiting. Payload pattern lets you return errors alongside data, include a `query` field for subsequent queries, and add fields later without breaking changes. Direct entity return is fine for simple cases but payload scales better.

---

## Feynman Explain
Explain to a product manager why `updateProfile` might return both `user` and `errors` in the same response, not just a 200 or 400 status code.

---

## Reframe
Critique: Should mutations ever return the full `Query` type for chaining? Under what conditions does this add value vs bloat?

---

## Drill
Take the quiz.

Run: `learn.sh quiz graphql-deep-dive 4`
