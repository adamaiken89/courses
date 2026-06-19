# Module 16: REST vs GraphQL vs RPC: Data Fetching

Est. study time: 2h
Language: en

## Learning Objectives
- Compare over-fetching, under-fetching, and contract rigidity across REST, GraphQL, and RPC
- Evaluate data-fetching tradeoffs using a concrete dashboard scenario
- Choose appropriate API style based on data shape, batching needs, and versioning strategy

---

## Core Content

### Over-Fetching

Over-fetching occurs when server returns more data than client needs.

- **REST**: Returns entire resource representation. Client receives all fields even when it needs one. `/users/1` returns `{id, name, email, avatar, createdAt, updatedAt, role, status, ...}` — dashboard only needs `name` and `avatar`.
- **GraphQL**: Client selects exact fields. Query `user(id:1) { name avatar }` returns exactly those two fields.
- **RPC**: Sends exactly what function signature specifies. `getUserName(id) → string`. Minimal by design, but rigid — adding new field requires changing procedure contract.

> **Think**: Why does over-fetching matter beyond bandwidth? Consider CPU, memory, DB query cost.
>
> *Answer: Over-fetching wastes server CPU/memory serializing unused data, DB reads fetching unused columns, and client memory parsing/discarding fields. In microservice architectures, over-fetching compounds across service calls — each hop carries dead weight.*

---

### Under-Fetching / Waterfall

Under-fetching occurs when one client operation requires multiple server round trips.

- **REST**: N resources = N requests. Dashboard needs user + orders + products: 3 sequential GETs (or 1 + 2 parallel if IDs known). Each request = HTTP overhead (DNS, TLS, headers, latency).
- **GraphQL**: One request, one response. Server resolves all fields in parallel via resolver tree. Client sends one query, server walks type system.
- **RPC**: Depends on server composition. Can require sequential calls if procedures are granular. Often needs BFF (Backend for Frontend) or aggregation layer.

```
REST waterfall:
GET /users/1          ──┐
GET /users/1/orders   ◄─┘
GET /orders/42/items  ◄─┘

GraphQL single round-trip:
POST /graphql         ──┐
  user(id:1) {          │
    orders { items }    │
  }                     │
{ "data": { ... } }   ◄─┘
```

> **Think**: Does under-fetching matter more for mobile or desktop apps? Why?
>
> *Answer: Mobile. Higher latency (cellular), bursty connectivity, battery drain from radio wake-ups. Each additional HTTP round trip costs 100-500ms on 3G/4G. GraphQL's single-round-trip model is disproportionately beneficial on mobile.*

---

### Contract Rigidity

How each API style handles schema evolution:

- **REST**: Versioning via URL (`/v2/users`), header (`Accept: application/vnd.api.v2+json`), or query param (`?v=2`). Backward-incompatible changes require new endpoint. Old endpoints persist — codebase grows.
- **GraphQL**: Add new fields/types without breaking. Deprecate old fields via `@deprecated`. Clients migrate at own pace. No version numbers — the schema is always the current contract.
- **RPC** (gRPC): Proto versioning. `package v1;` vs `package v2;`. Services run side-by-side. Field numbers must never be reused (proto3 `reserved` keyword). Breaking changes = new package.

> **Think**: GraphQL claims "no versioning." Is this truly versionless or hidden versioning?
>
> *Answer: Hidden versioning. Every client pins a query. The schema evolves, but old queries still work because new fields are additive. This is backward-compatible evolution, not versionlessness. A breaking change (removing field) still needs migration. The difference: clients opt-in to new fields rather than being forced to upgrade endpoints.*

---

### Data Shape: Who Defines It?

| Aspect | REST | GraphQL | RPC |
|--------|------|---------|-----|
| Shape owner | Server (resource representation) | Client (field selection) | Function signature |
| Flexibility | Low — change needs new endpoint | High — client shapes response per query | Very low — shape tied to fn contract |
| Predictability | High — same URL = same shape | Medium — shape varies by query | High — fn always returns same type |
| Self-documenting | Swagger/OpenAPI | Introspection + SDL | Proto files / IDL |

---

### Batching

- **REST**: Batch endpoints (`POST /batch`, `GET /users?id=1,2,3`). Ad-hoc, no standard. HTTP pipelining limited.
- **GraphQL**: Query batching via alias or `__typename` discrimination. `@defer` (draft) for streaming. Persisted queries reduce overhead.
- **RPC** (gRPC): Streaming (server-stream, client-stream, bidirectional). HTTP/2 multiplexing — multiple calls over single connection. No batching needed per se; streams handle it.

> **Think**: Is batching always beneficial? When is it harmful?
>
> *Answer: Batching helps when latency dominates (many small requests) but hurts when: (1) one slow item holds entire batch response, (2) error handling complex (partial success), (3) cache utilization drops (batched URL less cacheable than individual URLs).*

---

### Versioning Strategies

| Strategy | REST | GraphQL | gRPC |
|----------|------|---------|------|
| URL version | `/v2/users` | N/A | N/A |
| Header version | `Accept: vnd.api.v2` | N/A | N/A |
| Field deprecation | N/A | `@deprecated(reason:)` | N/A |
| Proto package | N/A | N/A | `package v2;` |
| Side-by-side | Multiple endpoints | One schema, evolve | Multiple services |
| Client migration | Forced (old endpoint removed) | At client pace (opt-in) | Coordinated (package rename) |

---

### Real-World Scenario: Dashboard

**Context**: Build admin dashboard showing user profile, recent orders, and product recommendations.

**REST approach**:
```
1. GET /users/42             → user data (over-fetch: email, role, timestamps unused)
2. GET /users/42/orders?limit=5  → orders
3. For each order, GET /orders/{id}/items  → line items (N+1 waterfall)
4. GET /products/recommended?user=42  → recommendations
Total: 4+ requests, ~800ms-2s
Payload: ~12KB received, ~4KB needed (67% over-fetch)
```

**GraphQL approach**:
```graphql
query Dashboard($userId: ID!) {
  user(id: $userId) {
    name
    avatar
    orders(limit: 5) {
      id
      status
      total
      items { product { name } quantity }
    }
    recommendations {
      id
      name
      price
    }
  }
}
```
```
Total: 1 request, ~150-300ms
Payload: ~3.5KB (exact fields)
```

**RPC approach**:
```
rpc GetUser(id) → User
rpc GetOrders(userId, limit) → Orders
rpc GetOrderItems(orderId) → Items
rpc GetRecommendations(userId) → Products
```
```
Total: 4 RPC calls (can be parallelized if IDs known upfront)
Requires BFF layer to aggregate calls
Payload: minimal per call, but header overhead per call
```

> **Think**: Could the REST team reduce to 2 requests by embedding orders in user response? What's the tradeoff?
>
> *Answer: Yes — embed `orders` in `GET /users/42?include=orders`. Tradeoff: (1) every user response now carries orders payload even when not needed (over-fetch), (2) caching granularity coarsens (user + orders cached as one blob, invalidate together), (3) API surface grows for every relation inclusion. This is how JSON:API works, but it's still server-defined inclusion, not client-selected fields.*

---

> ```mermaid
> sequenceDiagram
>     participant Client
>     participant REST
>     participant GraphQL
>     participant RPC
>     
>     Note over Client,RPC: Scenario: Dashboard (user + orders + products)
>     
>     Client->>REST: GET /users/42
>     REST-->>Client: { id, name, email, role, ... }  13 fields
>     Client->>REST: GET /users/42/orders
>     REST-->>Client: [{ id, status, total, items, ... }]
>     Client->>REST: GET /orders/101/items
>     REST-->>Client: [{ productId, quantity }]
>     Note over Client,REST: 3 round trips | ~8KB over-fetch
>     
>     Client->>GraphQL: POST query { user(id:42) { name orders { items { quantity } } } }
>     GraphQL-->>Client: { data: { user: { name, orders: [...] } } }
>     Note over Client,GraphQL: 1 round trip | exact fields
>     
>     Client->>RPC: rpc GetUserName(42)
>     RPC-->>Client: "Alice"
>     Client->>RPC: rpc GetOrders(42, 5)
>     RPC-->>Client: [{ orderId, total }]
>     Client->>RPC: rpc GetItems(orderId)
>     RPC-->>Client: [{ productId, qty }]
>     Note over Client,RPC: N calls (procedural) | minimal payload
> ```

---

### Why This Matters

Choosing API style is not academic — it directly affects page load time, server costs, developer productivity, and mobile battery life. A bad choice compounds: teams invest years building on a data-fetching model that fights their use cases. Understanding tradeoffs equips you to make intentional architectural decisions rather than cargo-culting trends.

---

## Examples

### Example 1: Social Feed Migration

**Scenario**: Mobile team switches from REST to GraphQL for a social feed. Each feed load shows posts, author avatars, like counts, and comments.

**REST**: 1 feed endpoint + N author endpoints + N comment endpoints = O(N) requests. 60th-percentile load time: 3.2s on 4G.

**GraphQL**: One query joins all. 60th-percentile load time: 0.8s. 75% reduction in load time. Server cost per request halves (no repeated auth checks on each resource endpoint).

**Tradeoff**: GraphQL server now has more complex resolver logic. Query analysis needed to prevent abusive queries. Schema design requires more up-front thought.

---

### Example 2: Internal Microservice Communication

**Scenario**: Two backend services communicate — Order Service needs product details from Catalog Service.

**RPC** (gRPC): Service A calls `GetProduct(id)` — returns exactly what needed, strongly typed, low latency via HTTP/2. Bidirectional streaming for bulk sync.

**GraphQL**: Overkill for service-to-service. Adds query parsing overhead, schema negotiation, no streaming benefits.

**REST**: Works but adds serialization overhead per call. Waterfall if Service A needs product + inventory + pricing.

**Verdict**: gRPC best for internal service mesh. GraphQL for client-facing. REST for simple CRUD with low coupling.

---

## Key Takeaways
- Over-fetching wastes bandwidth, CPU, and memory — worst in REST, eliminated in GraphQL and RPC
- Under-fetching causes waterfall requests — GraphQL solves this with single round trip
- REST versioning accumulates endpoints; GraphQL avoids versions via additive evolution; gRPC uses proto packages
- Data shape is server-defined in REST, client-driven in GraphQL, function-defined in RPC
- Batching helps latency but hurts cache granularity and partial-failure handling
- Dashboard scenarios demonstrate 2-4x reduction in requests and payload with GraphQL vs REST
- No single best API style — context determines the right choice (mobile → GraphQL, internal → gRPC, simple CRUD → REST)

## Common Misconception

**"GraphQL is always faster than REST."**

False. GraphQL reduces requests but increases server-side complexity per request. For simple CRUD (one resource, few fields), REST can outperform GraphQL due to lower overhead (no query parsing, no resolver tree walks, direct HTTP caching). GraphQL's advantage is not raw speed — it's precision and reduced waterfall. Measured by time-to-first-byte for complex UIs, GraphQL wins. For a single `GET /users/1`, REST is faster.

---

## Feynman Explain

Explain the difference between over-fetching and under-fetching to a junior developer who has only used REST. Use the dashboard scenario: user profile, orders, and products. Show how REST creates both problems, GraphQL solves both, and RPC solves only over-fetching (not waterfall). Use 2 sentences per concept.

*When ready, say explanation aloud or write it down. Then run `learn.sh explain graphql-deep-dive 16` — AI will probe your explanation for gaps.*

---

## Reframe

Critique: "GraphQL is just a marketing term for letting clients write their own SQL." Defenders say GraphQL prevents N+1 and over-fetching. Critics say it shifts complexity from network to server. Which API style would you pick for a public API with thousands of unknown clients consuming diverse data shapes? Why?

---

## Drill

Take the quiz. MCQs test recall, comparison, and scenario-based decision-making.

Run: `learn.sh quiz graphql-deep-dive 16`
