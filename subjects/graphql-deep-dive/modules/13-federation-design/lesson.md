# Module 13: Federation Design

Est. study time: 2.5h
Language: en

## Learning Objectives
- Understand supergraph topology and how subgraphs compose into unified schema
- Distinguish Apollo Router (Rust) vs Apollo Gateway (Node.js) tradeoffs
- Apply federation directives: @shareable, @override, @inaccessible, @tag
- Design subgraph boundaries using domain-driven design principles
- Use Rover CLI for schema composition and publishing workflow
- Recognize when federation adds unnecessary complexity

---

## Core Content

### Supergraph Topology

Federation creates single unified GraphQL endpoint ("supergraph") from multiple independently-deployed GraphQL services ("subgraphs"). Clients query supergraph; router distributes queries to appropriate subgraphs.

```
┌──────────────┐
│   Client     │
└──────┬───────┘
       │ query
┌──────▼───────┐
│   Supergraph  │  ← Apollo Router / Gateway
│   GraphQL API │
└──┬────┬────┬──┘
   │    │    │
┌──▼─┐┌─▼──┐┌─▼──┐
│Users││Prod││Order│  ← Subgraphs (independent services)
└─────┘└────┘└────┘
```

Each subgraph owns its schema portion. Router composes schemas at startup (or deploy time) into single supergraph schema.

> **Think**: What happens when two subgraphs define the same type with different fields?
>
> *Answer: Federation resolves this via schema composition rules. Type merging requires matching field definitions unless directives like @shareable or @override explicitly handle conflicts. Composition fails if unresolvable conflicts exist — safe failure prevents deploying broken supergraph.*

---

### Apollo Router vs Apollo Gateway

| Aspect | Apollo Router | Apollo Gateway |
|--------|--------------|----------------|
| Language | Rust | Node.js / TypeScript |
| Performance | ~50x faster, sub-millisecond overhead | ~ms overhead, GC pauses |
| Deployment | Binary, Docker, edge | Node.js process |
| Configuration | YAML config file | JavaScript/TypeScript |
| Extensibility | Rhai scripting, WASM plugins | JavaScript plugins |
| Query planning | Built-in (Rust-native) | Built-in (JS-native) |
| Managed federation | Cloud + self-hosted | Cloud + self-hosted |

Router preferred for high-throughput production. Gateway sufficient for moderate traffic or teams already in Node.js ecosystem.

> **Think**: Router is 50x faster. Why would anyone choose Gateway?
>
> *Answer: Ecosystem lock-in. Teams already invested in Node.js middleware (auth, logging, metrics) can reuse existing code as Gateway plugins. Gateway's JavaScript plugin model is more accessible than Router's Rhai/WASM. For teams under 1000 req/s, Gateway performance penalty is negligible.*

---

### Schema Composition

Composition merges subgraph schemas by:

1. **Type merging**: same-named types combined, fields unioned
2. **Directive resolution**: federation directives (@key, @shareable, etc.) processed
3. **Conflict detection**: same field with different types → composition fails
4. **Value type promotion**: types referenced by multiple subgraphs without @key become value types
5. **Entity alignment**: types with @key become entities, cross-subgraph references resolved

```graphql
# Subgraph A: Users
type User @key(fields: "id") {
  id: ID!
  name: String!
  email: String! @shareable
}

# Subgraph B: Reviews
type User @key(fields: "id") {
  id: ID!
  reviews: [Review!]!
}
```

Composition result:
```graphql
type User @key(fields: "id") {
  id: ID!
  name: String!
  email: String! @shareable
  reviews: [Review!]!
}
```

Conflict resolution rules:
- Same field, same type → merge (ok)
- Same field, different type → composition error
- Field in one subgraph, absent in another → merged (field added)
- @shareable field on both → allowed (router calls one subgraph)
- @override → specified subgraph wins

> **Think**: What if subgraph A defines `email: String!` and subgraph B defines `email: Int!` — can composition succeed?
>
> *Answer: No. Composition fails because `String!` ≠ `Int!`. Federation does not do type coercion. The conflict must be resolved by renaming one field or aligning types. This is a safety guarantee: no runtime type mismatch surprises.*

---

### Federation Directives

**@shareable** — field can be resolved by multiple subgraphs. Router picks one at query time.
```graphql
type Product @key(fields: "id") {
  id: ID!
  name: String! @shareable  # Can exist in multiple subgraphs
  price: Float!              # Unique to this subgraph
}
```

**@override** — field overrides another subgraph's version. Source subgraph "wins".
```graphql
type Product @key(fields: "id") {
  id: ID!
  name: String! @override(from: "inventory")  # This subgraph's name wins over inventory's
}
```

**@inaccessible** — field exists in schema but hidden from clients. Used for internal fields.
```graphql
type User @key(fields: "id") {
  id: ID!
  internalId: String! @inaccessible  # Not exposed to clients
}
```

**@tag** — annotate schema for filtering, routing, or access control.
```graphql
type Query {
  internalMetrics: Metrics @tag(name: "internal")
}
```

| Directive | Purpose | Applies to |
|-----------|---------|------------|
| @shareable | Field served by multiple subgraphs | FIELD_DEFINITION |
| @override | One subgraph takes precedence | FIELD_DEFINITION |
| @inaccessible | Hide from supergraph schema | FIELD_DEFINITION | OBJECT |
| @tag | Metadata annotation | FIELD_DEFINITION | OBJECT | SCHEMA |

> **Think**: When would you use @override instead of removing the field from all but one subgraph?
>
> *Answer: Migration. Team A owns `Product.name` in the `products` subgraph. Team B needs `Product.name` in the `search` subgraph temporarily. During migration, @override(from: "search") makes search's version authoritative. After migration, remove the field from products. @override enables gradual migration without breaking schema.*
> `),`

---

### Subgraph Boundaries: DDD for GraphQL

Design subgraphs around bounded contexts — domain boundaries from Domain-Driven Design. Each subgraph owns one domain concept.

**E-commerce example:**

| Subgraph | Bounded Context | Owns |
|----------|----------------|------|
| Users | Identity & Access | User, Auth, Roles |
| Products | Catalog | Product, Category, Inventory |
| Orders | Sales & Fulfillment | Order, Payment, Shipment |
| Reviews | Social Proof | Review, Rating |
| Recommendations | Personalization | Recommendation, ViewHistory |

Boundary rules:
- Subgraph owns its entities (CRUD)
- Foreign entities referenced by @key only
- Subgraph query root: only domain-specific queries
- No cross-subgraph direct DB access — always through GraphQL

> **Think**: Should `Order` own `Product.price` at time of purchase, or reference live price?
>
> *Answer: Order should own a snapshot (e.g., `OrderItem.priceAtPurchase`). Reference live price changes after order placed. Snapshot ensures order total never changes retroactively. Historical accuracy beats real-time freshness for orders.*

---

### When NOT to Federate

Federation costs:
- **Operational complexity**: deploy N subgraphs instead of 1
- **Query planning overhead**: router must coordinate cross-subgraph calls
- **Latency**: multi-hop resolution (subgraph A → subgraph B → subgraph C)
- **Debugging**: distributed tracing across subgraphs required
- **Schema governance**: breaking changes coordinated across teams

Don't federate when:
- Single service (under 10 types, one team)
- Query volume under 100 req/s (monolith simpler)
- Data locality isn't an issue (all data in same DB)
- Team lacks DevOps capacity for multi-service deployment
- Latency requirements sub-5ms end-to-end (router adds overhead)

> **Think**: Company with 5 engineers and 15 GraphQL types wants to "do microservices right." Should they federate?
>
> *Answer: No. 5 engineers on 15 types is one monolith. Federation adds deployment pipelines, schema coordination, distributed tracing — each is a force multiplier on small teams. Start monolith, extract subgraphs when team scales or domain boundaries become clear.*

---

### Rover CLI Workflow

```bash
# Install Rover (once)
curl -sSL https://rover.apollo.dev/net/latest | sh

# Add subgraph schema
rover subgraph add my-supergraph@current \
  --name accounts \
  --schema ./schema/accounts.graphql \
  --routing-url http://accounts/graphql

# Validate schema against supergraph (breaking change detection)
rover subgraph check my-supergraph@current \
  --name accounts \
  --schema ./schema/accounts.graphql

# Publish updated schema
rover subgraph publish my-supergraph@current \
  --name accounts \
  --schema ./schema/accounts.graphql

# Compose supergraph schema locally (validate before publish)
rover supergraph compose \
  --config ./supergraph.yaml \
  --output ./composed-schema.graphql
```

`supergraph.yaml`:
```yaml
federation_version: 2
subgraphs:
  accounts:
    routing_url: http://accounts/graphql
    schema:
      file: ./schemas/accounts.graphql
  products:
    routing_url: http://products/graphql
    schema:
      file: ./schemas/products.graphql
  orders:
    routing_url: http://orders/graphql
    schema:
      file: ./schemas/orders.graphql
```

> **Think**: Why check before publish? What if check fails?
>
> *Answer: `subgraph check` validates backward compatibility — ensures new schema doesn't break existing queries. If it fails, the change would break production queries. Fix schema before publishing. CI pipelines should fail on check failure, blocking deployment of breaking changes.*

---

```mermaid
graph TB
    subgraph Supergraph
        R[Apollo Router]
    end

    subgraph Subgraphs
        U[Users Subgraph<br/>User, Auth, Roles]
        P[Products Subgraph<br/>Product, Category, Inventory]
        O[Orders Subgraph<br/>Order, Payment, Shipment]
    end

    subgraph Data Stores
        UDB[(Users DB)]
        PDB[(Products DB)]
        ODB[(Orders DB)]
    end

    C[Client] -->|GraphQL Query| R
    R -->|users { ... }| U
    R -->|products { ... }| P
    R -->|orders { ... }| O
    U --> UDB
    P --> PDB
    O --> ODB
```

> **Think**: Client sends one query requesting user, products, and orders. How many HTTP requests does router make to subgraphs?
>
> *Answer: Depends on query plan. If query requests fields from all three subgraphs, router makes 3 parallel HTTP requests. If query only requests user fields, router makes 1 request to Users subgraph. Router optimizes by batching parallel subgraph calls and avoiding sequential waits when possible.*

---

### Why This Matters

Federation solves organizational scaling: multiple teams own parts of schema without coordination bottleneck. Single schema, autonomous teams, independent deployments. But federation introduces real costs: query planning overhead, operational complexity, debugging difficulty. Decision to federate is organizational, not technical — design subgraph boundaries around team boundaries, not data model.

---

## Examples

### Example 1: E-Commerce Subgraph Split

**Monolith schema:**
```graphql
type Query {
  user(id: ID!): User
  products(category: String): [Product!]!
  order(id: ID!): Order
}
type User { id: ID! name: String! email: String! orders: [Order!]! }
type Product { id: ID! name: String! price: Float! }
type Order { id: ID! user: User! items: [OrderItem!]! total: Float! }
```

**After split into 3 subgraphs:**

`accounts/subgraph.graphql`:
```graphql
type Query { user(id: ID!): User }
type User @key(fields: "id") {
  id: ID! name: String! email: String!
}
```

`products/subgraph.graphql`:
```graphql
type Query { products(category: String): [Product!]! }
type Product @key(fields: "id") @shareable {
  id: ID! name: String! price: Float!
}
```

`orders/subgraph.graphql`:
```graphql
type Query { order(id: ID!): Order }
type User @key(fields: "id") { id: ID! orders: [Order!]! }
type Order @key(fields: "id") {
  id: ID! user: User! items: [OrderItem!]! total: Float!
}
type OrderItem { product: Product! quantity: Int! }
type Product @key(fields: "id") { id: ID! }
```

---

### Example 2: Migration from Monolith to Federation

1. Start: single monolith GraphQL service
2. Extract subgraph: move `User` type to new `accounts` service, keep @key reference
3. Run router in front: Gateway/Router sends User queries to accounts, everything else to monolith
4. Repeat: extract `products`, then `orders`
5. Monolith becomes a subgraph or is retired

```
Phase 1: [Client] → [Monolith]
Phase 2: [Client] → [Router] → [Monolith + Accounts Subgraph]
Phase 3: [Client] → [Router] → [Accounts + Products + Orders + Monolith remnants]
Phase 4: [Client] → [Router] → [Accounts + Products + Orders]
```

---

## Key Takeaways
- Supergraph = single endpoint; subgraphs = independent GraphQL services; router composes them
- Apollo Router (Rust) for high-throughput; Apollo Gateway (Node.js) for JavaScript ecosystem
- Schema composition merges types, resolves directives, detects conflicts — safe failure on conflict
- @shareable for multi-subgraph fields; @override for migration; @inaccessible for internal fields
- Design subgraph boundaries around DDD bounded contexts, not database tables
- Federation not default — start monolith, extract when team/organization requires separation
- Rover CLI manages subgraph lifecycle: add → check → publish → compose

---

## Common Misconception

**"Federation means microservices — we should federate because microservices are better."**

Wrong direction. Microservices are an organizational pattern; federation is a GraphQL pattern. You federate when teams need independent schema ownership, not because microservices are trendy. A federated monolith (one codebase, one team, but N subgraph schemas) adds complexity without benefit. Conversely, you can have microservices without federation (BFF pattern, REST between services). Federation serves organizational autonomy, not architecture aesthetics.

---

## Feynman Explain

Explain GraphQL federation to a senior backend engineer who knows REST microservices. Focus on: how supergraph differs from API gateway, why subgraphs "own" their domain types, how @key references work across services without shared database access. Max 3 sentences per concept.

*When ready, say explanation aloud or write it down. Then run `learn.sh explain graphql-deep-dive 13` — AI will probe your explanation for gaps.*

---

## Reframe

Critique: "Federation solves the n+1 schema problem (n teams, 1 schema) but introduces the n+1 query problem (n subgraphs, 1 query)." Is the organizational decoupling worth the query planning overhead and operational complexity? What size organization justifies the tradeoff — 2 teams? 5? 10? When does federation create more problems than it solves?

---

## Drill

Take the quiz. MCQs test federation design principles, directives, and when to federate.

Run: `learn.sh quiz graphql-deep-dive 13`
