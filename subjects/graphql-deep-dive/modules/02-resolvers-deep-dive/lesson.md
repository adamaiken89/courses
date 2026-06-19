# Module 2: Resolvers Deep Dive

Est. study time: 2h
Language: en

## Learning Objectives
- Implement GraphQL resolvers with correct signature (parent, args, context, info)
- Design context objects for auth, data sources, and DI
- Apply middleware patterns: auth, logging, error handling
- Distinguish default vs custom resolvers and resolver chains

---

## Core Content

### Resolver Signature

Every field in GraphQL resolves via a function with four arguments:

```typescript
(parent: TParent, args: TArgs, context: TContext, info: GraphQLResolveInfo) => TReturn
```

| Arg | Purpose | Mutability |
|-----|---------|------------|
| `parent` | Return value of parent field's resolver | Read-only |
| `args` | Arguments passed to the field in the query | Read-only |
| `context` | Shared object across all resolvers in one request | Mutable (per-request) |
| `info` | AST, schema, path, return type — **rarely needed** | Read-only |

```typescript
const resolvers = {
  Query: {
    user: (_, args: { id: string }, context: AppContext) => {
      return context.dataSources.users.getById(args.id)
    }
  },
  User: {
    posts: (user: User, _, context: AppContext) => {
      return context.dataSources.posts.getByUserId(user.id)
    }
  }
}
```

> **Think**: Why pass `parent` instead of making resolvers emit nested structures?
>
> *Answer: Resolvers are lazy — each field resolves independently. `parent` connects the chain but each resolver can fetch data from different sources (DB, API, cache). If resolvers emitted pre-nested data, you'd lose this flexibility and couple field resolution to data shape.*

---

### Default Resolver

If you omit a resolver for a field, GraphQL uses the default: it reads `parent[fieldName]`. This means for simple cases:

```graphql
type User { id: ID! name: String! email: String }
```

With data `{ id: "1", name: "Alice", email: "a@b.com" }`, you only need resolvers for fields that require computation:

```typescript
// Only these resolvers needed — id, name, email use default
const resolvers = {
  Query: { user: (_, args) => db.users.find(args.id) }
}
```

> **Think**: When would you write a resolver that just does `parent.fieldName`?
>
> *Answer: Never — default does it. Only write resolvers for computed fields, async data fetching, or fields whose name differs from the data key.*

---

### Context Object

Single object created per request, shared across all resolvers. Typical pattern:

```typescript
import { createServer } from 'node:http'

const server = createServer((req, res) => {
  const context = {
    currentUser: await authenticate(req.headers.authorization),
    dataSources: {
      users: new UserDataSource(db),
      posts: new PostDataSource(db),
    },
    cache: perRequestCache
  }
  // Pass context to GraphQL execution
})
```

Context is NOT the place for:
- Request-scoped caches that persist across requests (use global cache like Redis)
- Database connections (those are long-lived, inject via DI at startup)
- Heavy objects serialized per-request

> **Think**: Why should database connections NOT go in context?
>
> *Answer: DB connections are typically connection-pooled and long-lived. Creating or passing them per-request wastes resources. Inject DB pool at server startup, reference from context via a lightweight data source wrapper.*

---

### Resolver Middleware via Custom Directives

Directives wrap resolver execution. A custom `@auth` directive:

```typescript
class AuthDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition(field) {
    const originalResolve = field.resolve
    const { role } = this.args

    field.resolve = async (parent, args, ctx, info) => {
      if (!ctx.currentUser) throw new AuthenticationError('not logged in')
      if (role && ctx.currentUser.role !== role) throw new ForbiddenError('insufficient role')
      return originalResolve.call(this, parent, args, ctx, info)
    }
  }
}
```

Alternative: functional middleware wrapping resolver map:

```typescript
const withAuth = (resolver, role) => (parent, args, ctx, info) => {
  if (!ctx.currentUser) throw new AuthenticationError()
  if (role && ctx.currentUser.role !== role) throw new ForbiddenError()
  return resolver(parent, args, ctx, info)
}

const resolvers = {
  Query: {
    adminDashboard: withAuth(adminDashboardResolver, 'ADMIN')
  }
}
```

---

### Error Propagation

Errors thrown in resolvers appear in `errors[]` array. The associated field's data becomes null (or bubbles up if non-null).

```typescript
const resolvers = {
  Query: {
    fragileData: async () => {
      const data = await unreliableAPI()  // might throw
      return data
    }
  }
}
// Response: { data: { fragileData: null }, errors: [{ message: "...", path: ["fragileData"] }] }
```

Custom errors for rich information:

```typescript
import { GraphQLError } from 'graphql'

throw new GraphQLError('Product not found', {
  extensions: { code: 'NOT_FOUND', productId, httpStatus: 404 }
})
```

> **Think**: Should you catch all errors to prevent internal details leaking?
>
> *Answer: Yes — wrap resolvers with a top-level try/catch that converts unexpected errors to generic `INTERNAL_SERVER_ERROR` while logging the original. Never expose stack traces or DB internals in production errors.*

---

> ```mermaid
> graph LR
>   subgraph Request Lifecycle
>     A[HTTP Request] --> B[Context Factory]
>     B --> C[Parse Query]
>     C --> D[Validate Schema]
>     D --> E[Execute: top-down]
>     E --> F[Query.rootField resolver]
>     F --> G[Field resolver chain]
>     G --> H[Return data + errors]
>   end
> ```

### Resolver Chain Walkthrough

Query: `{ user(id: "1") { name posts { title } } }`

Execution order (not parallel — each level waits for parent):

1. `Query.user` resolves → returns User object `{ id: "1", name: "Alice" }`
2. `User.name` → default resolver reads `parent.name` → `"Alice"`
3. `User.posts` → custom resolver calls `db.posts.byUserId("1")` → returns posts array
4. `Post.title` → default resolver for each post → resolves titles

Step 3 is where performance matters: if you query 10 users, `User.posts` runs 10 times → N+1 problem (addressed in Module 6).

---

### Info Object (Advanced)

Fourth argument `info` gives raw query AST. Rarely needed, but powerful:

```typescript
// Only select DB columns the client requested
const resolvers = {
  User: {
    email: (user, _, ctx, info) => {
      // info.fieldNodes[0].selectionSet.selections...
      // Could optimize: only query email from DB if requested
      return user.email
    }
  }
}
```

**Warning**: Parsing `info` is complex, version-dependent, and easy to get wrong. Prefer DataLoader + batching over `info` optimization. Only reach for `info` when building generic tools (ORM integration, monitoring).

---

### Why This Matters

Resolvers are where schema meets data. Bad resolver patterns cause N+1 queries, security holes (missing auth checks), leaky errors, and unmaintainable code. Mastering resolver architecture is the difference between a GraphQL API that's "working" and one that's production-grade.

---

## Examples

### Example 1: Complete Resolver Setup with Auth + DataSources

```typescript
interface AppContext {
  currentUser: User | null
  dataSources: DataSources
}

const resolvers = {
  Query: {
    me: (_, __, ctx) => {
      if (!ctx.currentUser) throw new AuthenticationError()
      return ctx.currentUser
    },
    post: (_, { id }: { id: string }, ctx) => {
      return ctx.dataSources.posts.getById(id)
    }
  },
  Post: {
    author: (post, _, ctx) => {
      return ctx.dataSources.users.getById(post.authorId)
    },
    comments: (post, _, ctx) => {
      return ctx.dataSources.comments.getByPostId(post.id)
    }
  },
  User: {
    fullName: (user) => `${user.firstName} ${user.lastName}`,  // computed field
  }
}
```

---

## Key Takeaways
- Resolver signature: `(parent, args, context, info) => data`
- Default resolver reads `parent[fieldName]` — write resolvers only for computed/async fields
- Context is per-request; use for auth, data sources, lightweight caches
- Directives and wrapper functions implement middleware patterns
- Errors in resolvers → `errors[]` array + nullified field
- Never parse `info` unless building generic infrastructure

---

## Common Misconception

**"Resolvers should return the exact shape the client queried."**

Wrong. Resolvers return the object, GraphQL engine selects fields client asked for. Your resolver for `User.posts` should return the full posts array (or a loader promise). The engine handles field selection. Trying to pre-shape responses leads to brittle resolvers and wasted effort.

---

## Feynman Explain
Explain resolver chain to a junior developer: how Query.user → User.posts → Post.title connects, what the default resolver does, and why each resolver runs independently.

---

## Reframe
Would GraphQL be simpler without the `parent` argument — e.g., all resolvers receive flat args? What problems would that cause for nested data fetching?

---

## Drill
Take the quiz.

Run: `learn.sh quiz graphql-deep-dive 2`
