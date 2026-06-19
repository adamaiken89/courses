# Module 20: Security

Est. study time: 2.5h
Language: en

## Learning Objectives
- Implement depth limiting, query cost analysis, and persisted queries to prevent malicious operations
- Design field-level authorization using @auth directives with RBAC and ABAC patterns
- Defend against common GraphQL attacks: introspection leaks, batching attacks, deep recursion, alias abuse

---

## Core Content

### Depth Limiting: Preventing Deeply Nested Queries

Deeply nested queries can cause exponential resolver calls, exhausting server resources:

```graphql
# Malicious: 10 levels deep
query deep {
  user { posts { comments { author { posts { comments { author { posts { comments { author { name } } } } } } } } } }
}
```

**graphql-depth-limit** validates max depth during query parsing:

```typescript
import depthLimit from 'graphql-depth-limit';

const server = new ApolloServer({
  typeDefs,
  resolvers,
  validationRules: [depthLimit(7)], // Reject queries deeper than 7 levels
});
```

> **Think**: What depth limit is appropriate for a typical social media API?
>
> *Answer: 5-7 levels. Real queries rarely exceed 4. Set higher for admin/internal tools (10-12) with separate gateway configuration. Monitor rejected queries for attack patterns.*

---

### Authorization at Field Level: @auth Directive, RBAC, ABAC

Field-level authorization ensures users see only permitted data:

```graphql
directive @auth(
  requires: Role!,
  scope: String,
  condition: String
) on OBJECT | FIELD_DEFINITION

enum Role {
  ADMIN
  MODERATOR
  USER
  GUEST
}

type Query {
  adminDashboard: Dashboard @auth(requires: ADMIN)
  userProfile(id: ID!): User @auth(requires: USER, condition: "owner")
  publicFeed: [Post!]!
}

type User {
  id: ID!
  name: String!
  email: String @auth(requires: ADMIN) # Only admins see email
  paymentMethods: [PaymentMethod!]! @auth(requires: ADMIN) 
}
```

**RBAC** (Role-Based Access Control): role determined at auth time, enforced per field:

```typescript
const directiveTransformer = (schema) => {
  const authDirective = schema.getDirective('auth');
  // Wrap each field resolver with role check:
  for (const type of Object.values(schema.getTypeMap())) {
    for (const field of Object.values(type.getFields || {})) {
      const auth = authDirective && field.astNode?.directives?.find(
        d => d.name.value === 'auth'
      );
      if (!auth) continue;
      
      const requiredRole = auth.arguments.find(a => a.name.value === 'requires').value.value;
      const originalResolver = field.resolve || defaultResolver;
      
      field.resolve = async (source, args, context, info) => {
        if (!context.user) throw new AuthenticationError('Not authenticated');
        if (!roleHierarchy[context.user.role] >= roleHierarchy[requiredRole]) {
          throw new ForbiddenError('Insufficient permissions');
        }
        return originalResolver(source, args, context, info);
      };
    }
  }
};
```

**ABAC** (Attribute-Based Access Control): richer — checks resource attributes, not just user role:

```typescript
// ABAC: user can edit post only if they are the author AND post is not locked
type Mutation {
  updatePost(id: ID!, input: UpdatePostInput!): Post!
    @auth(condition: "isAuthor && post.status != LOCKED")
}

// Resolver checks:
async function updatePost(_, { id, input }, context) {
  const post = await db.post.findUnique({ where: { id } });
  
  // Enforce ABAC condition resolved in middleware:
  if (post.authorId !== context.user.id) {
    throw new ForbiddenError('Not the author');
  }
  if (post.status === 'LOCKED') {
    throw new ForbiddenError('Post is locked');
  }
  
  return db.post.update({ where: { id }, data: input });
}
```

> **Think**: When is ABAC overkill compared to RBAC?
>
> *Answer: RBAC suffices for most CRUD apps (admin, user, guest). ABAC adds complexity: policy evaluation engine, attribute propagation, condition DSL. Use ABAC when access depends on resource state (document status, time of day, geolocation, relationship depth).*

---

### Persisted Queries Allowlist

Only pre-approved queries execute in production. Prevents arbitrary query injection:

```typescript
// Server-side allowlist (operation safelist):
const ALLOWED_OPERATIONS = new Set([
  'GetUserProfile',
  'CreatePost',
  'SearchPosts',
  'ListFeed',
]);

const server = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [
    {
      async requestDidStart({ request }) {
        if (!ALLOWED_OPERATIONS.has(request.operationName)) {
          throw new GraphQLError('Operation not allowed', {
            extensions: { code: 'FORBIDDEN_OPERATION' },
          });
        }
      },
    },
  ],
});
```

**APQ** (Automatic Persisted Queries): client sends hash first, server caches query on first miss:

```
1. Client sends: { hash: "abc123" }
2. Server: "Not found" → NotRegistered error
3. Client sends: { hash: "abc123", query: "query GetUser { ... }" }
4. Server caches: hash → query
5. Subsequent requests: { hash: "abc123" } — no query body needed
```

Benefits: smaller payloads, no arbitrary queries, DDOS mitigation against large query attacks.

> **Think**: Persisted queries prevent arbitrary queries but break developer tooling like GraphiQL. How do you balance?
>
> *Answer: Use environment-based enforcement. Dev/staging: allow all queries. Production: enforce persisted queries + allowlist. Or maintain a "developer" API key that bypasses allowlist for debugging.*

---

### Introspection: Disabling in Production

Introspection exposes entire schema. Attackers use it for reconnaissance:

```graphql
# Malicious introspection query:
query {
  __schema {
    types {
      name
      fields {
        name
        type { name kind }
      }
    }
  }
}
```

```typescript
const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: process.env.NODE_ENV !== 'production',
});
```

Selective introspection — allow only for authenticated clients:

```typescript
const server = new ApolloServer({
  introspection: (req) => {
    // Only allow introspection for internal API keys
    return req.headers['x-api-key'] === process.env.INTERNAL_API_KEY;
  },
});
```

> **Think**: Is disabling introspection security-by-obscurity?
>
> *Answer: Partially. Schema is still discoverable via error messages and client bundle inspection. But introspection is the easiest attack vector. Disabling it raises the bar. Combine with API key authentication for developer tooling access.*

---

### CSRF Protection

GraphQL endpoints are susceptible to CSRF because browsers send cookies automatically:

```typescript
// Express middleware: reject requests without Content-Type: application/json
app.use('/graphql', (req, res, next) => {
  if (req.method === 'POST' && req.headers['content-type'] !== 'application/json') {
    return res.status(400).json({ error: 'CSRF protection: use application/json content-type' });
  }
  next();
});
```

Additional protections:
- Set `SameSite: Strict` or `SameSite: Lax` on cookies
- Require custom header (`x-requested-by: graphql`)
- Validate Origin/Referer headers
- Disable query batching if not needed (batching bypasses simple CSRF checks)

> **Think**: Why does query batching increase CSRF risk?
>
> *Answer: Batching allows sending multiple mutations in one request. A CSRF attack can fire one request that executes "logout", "transferFunds", "changeEmail" in sequence. Without batching, an attacker needs three requests, increasing detection probability.*

---

### Rate Limiting: Cost-Based vs Query-Count

Simple query-count rate limiting is inadequate for GraphQL. One request can do the work of a hundred:

| Strategy | Mechanism | GraphQL-aware? |
|----------|-----------|----------------|
| **Query-count** | N requests / window | No — treats cheap and expensive equally |
| **Cost-based** | Sum field costs / window | Yes — e.g., 1000 cost units per minute |
| **Depth-based** | Reject depth > N | Partial — stops deep nesting but not wide queries |
| **Alias-aware** | De-duplicate aliased fields | Yes — prevents alias-count attacks |

Cost-based example:

```typescript
// Assign cost to fields:
const costMap = {
  'Query.search': 5,
  'User.paymentMethods': 10,  // Expensive field
  'Post.comments': 3,
  default: 1,
};

function computeCost(document, operationName) {
  let cost = 0;
  visit(document, {
    Field(node) {
      cost += costMap[`${node.name.value}`] ?? costMap.default;
    },
  });
  return cost;
}
```

Rate limit middleware:

```typescript
const rateLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  max: 1000, // Cost units per minute
  keyGenerator: (req) => req.headers['x-api-key'],
});

app.use('/graphql', async (req, res, next) => {
  const cost = computeCost(gql`${req.body.query}`, req.body.operationName);
  try {
    await rateLimiter.consume(req, cost);
    next();
  } catch {
    res.status(429).json({ error: 'Rate limit exceeded', cost });
  }
});
```

> **Think**: How do you assign costs fairly across all resolvers?
>
> *Answer: Start with flat default (1), then annotate expensive fields: DB scans = 5, external API calls = 10, file uploads = 50. Calibrate using traces — fields with high p99 latency or high data volume get higher costs.*

---

### Query Whitelisting: Operation Safelist

Strictest security: server knows exactly which queries clients may send:

```typescript
// Operation safelist (hash-to-query mapping):
const SAFELIST: Record<string, string> = {
  'a1b2c3d4': `
    query GetUserProfile($id: ID!) {
      user(id: $id) { id name email }
    }
  `,
  'e5f6g7h8': `
    mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) { id title }
    }
  `,
};

const server = new ApolloServer({
  plugins: [
    {
      async requestDidStart({ request }) {
        // Look up query by hash:
        if (request.extensions?.persistedQuery) {
          const hash = request.extensions.persistedQuery.sha256Hash;
          if (!SAFELIST[hash]) {
            throw new GraphQLError('Unknown operation hash', {
              extensions: { code: 'PERSISTED_QUERY_NOT_FOUND' },
            });
          }
        } else {
          // Fail if non-registered query sent:
          throw new GraphQLError('Non-persisted queries not allowed', {
            extensions: { code: 'PERSISTED_ONLY' },
          });
        }
      },
    },
  ],
});
```

> **Think**: What happens when the frontend ships a new query?
>
> *Answer: Deployment coordination — frontend registers new hash, then deploys. Or use a two-phase rollout: allowlist phase 1 (old + new hashes accepted), then phase 2 (remove old). CI validates all queries at build time.*

---

### Input Validation: Max Length, Pattern Matching, Sanitization

GraphQL type system catches type errors, not semantic/format errors. Add per-field validation:

```graphql
input CreateUserInput {
  username: String! @constraint(minLength: 3, maxLength: 20, pattern: "^[a-zA-Z0-9_]+$")
  email: String! @constraint(format: "email")
  bio: String @constraint(maxLength: 500)
  age: Int @constraint(min: 13, max: 120)
}
```

```typescript
// Validation middleware:
function validateInput(input: Record<string, any>, schema: GraphQLInputType): void {
  for (const [fieldName, value] of Object.entries(input)) {
    const field = (schema as GraphQLInputObjectType).getFields()[fieldName];
    const constraints = field.astNode?.directives?.find(d => d.name.value === 'constraint');
    if (!constraints) continue;

    for (const arg of constraints.arguments || []) {
      switch (arg.name.value) {
        case 'maxLength':
          if (typeof value === 'string' && value.length > arg.value.value) {
            throw new UserInputError(`Field ${fieldName} exceeds max length ${arg.value.value}`);
          }
          break;
        case 'pattern':
          const regex = new RegExp(arg.value.value);
          if (typeof value === 'string' && !regex.test(value)) {
            throw new UserInputError(`Field ${fieldName} does not match pattern`);
          }
          break;
        case 'min':
          if (typeof value === 'number' && value < arg.value.value) {
            throw new UserInputError(`Field ${fieldName} below minimum ${arg.value.value}`);
          }
          break;
      }
    }
  }
}
```

> **Think**: Should validation happen in resolvers or a centralized directive?
>
> *Answer: Directive is DRYer — one validation engine reused across all inputs. Resolver validation is scattered and easily forgotten. Centralized validation produces consistent error shapes and is auditable.*

---

### Common GraphQL Security Attacks

| Attack | Mechanism | Defense |
|--------|-----------|---------|
| **Introspection leak** | `__schema` query exposes full schema | Disable introspection in prod, or auth-gate it |
| **Batching attack** | Many concurrent requests bypass rate limit | Cost-based rate limiting, connection pooling limits |
| **Deep recursion** | Deeply nested query → exponential resolver calls | Depth limiting (graphql-depth-limit) |
| **Alias abuse** | 1000 aliases of same field → request amplification | Alias limit, cost-per-request doesn't rise with aliases |
| **Over-fetching** | Request huge lists | Pagination enforcement (max first/last) |
| **Field duplication** | Same field requested 20x in aliases | De-duplicate cost computation |

```graphql
# Alias abuse example:
query {
  a1: user(id: 1) { name }
  a2: user(id: 2) { name }
  # ... up to 1000 aliases
  a1000: user(id: 1000) { name }
}
```

Aliases should be limited and cost should be computed per unique resolver call, not per field appearance.

---

```mermaid
graph TD
  Client -->|HTTP Request| A[Edge Proxy / CDN]
  A -->|CSRF Check: content-type, origin| B[Rate Limiter]
  B -->|Cost-based rate limit| C[Auth Middleware]
  C -->|Validate JWT / API key| D{Persisted Query?}
  D -->|Yes: hash lookup| E{Hash Found?}
  E -->|No| F[Reject: Not Found]
  E -->|Yes| G[Depth Limit Check]
  D -->|No: query present| H{Allowlist Enabled?}
  H -->|Production| I[Reject: Non-persisted]
  H -->|Staging/Dev| G
  G -->|Depth <= limit| J[Introspection Guard]
  J -->|Disable in prod| K[Parse Query]
  K --> L[Validate: schema, types]
  L --> M[Compute Query Cost]
  M -->|Cost > remaining quota| N[Reject: Rate Limited]
  M -->|Cost <= quota| O[Auth Resolver]
  O -->|@auth directive| P{RBAC/ABAC Check}
  P -->|Pass| Q[Execute Resolver]
  P -->|Fail| R[ForbiddenError]
  Q --> S[Input Validation]
  S -->|@constraint directives| T[Sanitize]
  T --> U[Return Data]
  
  subgraph "Security Layers"
    A
    B
    C
    D
    G
    J
    O
    S
  end
```

### Why This Matters

GraphQL exposes a single endpoint with dynamic queries — its power is also its vulnerability. In REST, the API surface is explicit (each endpoint is a contract). In GraphQL, any query shape is possible, meaning attackers have infinite surface to probe. Security must be layered: transport (CSRF), query (depth, persisted), field (auth), input (validation), and resource (rate limiting). A single gap compromises the whole system.

---

## Examples

### Example 1: Complete Security Plugin for Apollo Server

```typescript
import depthLimit from 'graphql-depth-limit';
import { ApolloServerPlugin } from '@apollo/server';

const securityPlugin: ApolloServerPlugin = {
  async requestDidStart({ request }) {
    // 1. Allowlist check
    const ALLOWED = new Set(['GetProfile', 'CreatePost']);
    if (request.operationName && !ALLOWED.has(request.operationName)) {
      throw new GraphQLError('Operation not in allowlist');
    }

    // 2. Introspection guard
    if (process.env.NODE_ENV === 'production' && request.query?.includes('__schema')) {
      throw new GraphQLError('Introspection disabled in production');
    }

    // 3. Alias limit
    const aliasCount = (request.query?.match(/\w+\s*:/g) || []).length;
    if (aliasCount > 50) {
      throw new GraphQLError('Too many aliases');
    }
  },
};
```

### Example 2: RBAC with Role-Based Field Visibility

```typescript
enum Role { ADMIN, MODERATOR, USER, GUEST }

const roleHierarchy: Record<Role, number> = {
  ADMIN: 3,
  MODERATOR: 2,
  USER: 1,
  GUEST: 0,
};

function createAuthMiddleware(schema: GraphQLSchema): void {
  const types = schema.getTypeMap();
  
  for (const type of Object.values(types)) {
    if (!type.getFields) continue;
    
    for (const field of Object.values(type.getFields())) {
      const authDirective = field.astNode?.directives?.find(d => d.name.value === 'auth');
      if (!authDirective) continue;
      
      const roleArg = authDirective.arguments?.find(a => a.name.value === 'requires');
      const requiredRole = roleArg?.value as Role;
      const originalResolve = field.resolve ?? defaultFieldResolver;
      
      field.resolve = async (parent, args, context, info) => {
        if (!context.user) throw new AuthenticationError('Login required');
        if (roleHierarchy[context.user.role] < roleHierarchy[requiredRole]) {
          throw new ForbiddenError(`Role ${context.user.role} insufficient for ${info.fieldName}`);
        }
        return originalResolve(parent, args, context, info);
      };
    }
  }
}
```

---

## Key Takeaways

- Depth limiting prevents recursive query attacks; set 7 levels as production default
- Persisted queries + allowlist block arbitrary query execution
- Field-level authorization via @auth directive prevents data leaks even within authorized operations
- Cost-based rate limiting is superior to query-count for GraphQL because operations vary dramatically in cost
- Input validation via constraint directives catches format errors at the schema layer
- Introspection should be disabled or auth-gated in production
- CSRF protection requires content-type checks, SameSite cookies, and Origin validation
- Defend against aliases abuse by limiting alias count and de-duplicating cost

---

## Common Misconception

**"GraphQL needs only one security measure — validating the query against the schema."**

Wrong. Schema validation prevents malformed queries but does nothing for cost, depth, auth, or CSRF. A valid query can still be an attack: deeply nested, expensive to compute, requesting unauthorized fields via introspection, or fired cross-origin with cookies. Security is a stack, not a single check. Depth limiting + rate limiting + field auth + persisted queries + CSRF protection = defense in depth.

---

## Feynman Explain

Explain GraphQL security to a backend engineer who maintains a REST API. Cover: why the single-endpoint model changes the threat surface, how depth limiting parallels pagination enforcement in REST, and why CSRF risk is higher with query batching. Use 3 sentences max per concept.

*When ready, say explanation aloud or write it down. Then run `learn.sh explain graphql-deep-dive 20` — AI will probe your explanation for gaps.*

---

## Reframe

Critique: "Persisted queries and operation allowlists are too restrictive — they slow down iteration and break developer tooling." Is the security gain worth the friction? What about a middle ground where internal API keys bypass the allowlist but external clients are restricted?

---

## Drill

Take the quiz. MCQs test different angles — recall, application, scenario.

Run: `learn.sh quiz graphql-deep-dive 20`
