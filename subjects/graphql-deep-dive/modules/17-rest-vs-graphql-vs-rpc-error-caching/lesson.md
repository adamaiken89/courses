# Module 17: REST vs GraphQL vs RPC: Error & Caching

Est. study time: 2h
Language: en

## Learning Objectives
- Compare error models: HTTP status codes vs errors[] payload vs gRPC status codes
- Evaluate caching semantics and invalidation strategies across REST, GraphQL, and gRPC
- Analyze authentication models and ecosystem maturity for each API style

---

## Core Content

### Error Models

How each style communicates failures:

**REST**: HTTP status codes carry meaning.
```
200 OK          — success
201 Created     — resource created
400 Bad Request — malformed input
401 Unauthorized — missing/invalid auth
403 Forbidden   — authenticated but no permission
404 Not Found   — resource doesn't exist
409 Conflict    — version conflict or duplicate
429 Too Many Requests — rate limited
500 Internal Server Error — server fault
```

Problem: Status codes are coarse. A 400 could mean missing field, wrong type, validation failure, or semantic error. Body carries details but client must parse non-standard error shapes.

> **Think**: What happens when a REST endpoint partially succeeds? Example: batch create users, first succeeds, second fails.
>
> *Answer: REST has no standard partial-success model. Options: return 200 with per-item status in body (misleading), return 207 Multi-Status (WebDAV, rarely supported), or return 409 and fail the entire batch. None are clean.*

**GraphQL**: Always returns 200 HTTP. Errors live in `errors[]` array.
```json
{
  "data": {
    "user": null,
    "orders": [{ "id": "1", "total": 29.99 }]
  },
  "errors": [
    {
      "message": "Database connection timeout",
      "path": ["user"],
      "extensions": {
        "code": "DB_TIMEOUT",
        "retryAfter": 5
      }
    }
  ]
}
```

Key insight: Partial success is the default. Some fields resolve, others error. `data` contains everything that succeeded; `errors` explain failures. Client decides how to render partial data.

**gRPC**: Uses status codes (gRPC-specific, distinct from HTTP).
```
OK (0)            — success
InvalidArgument (3)  — bad input
NotFound (5)      — resource missing
PermissionDenied (7) — auth failure
Unavailable (14)  — service down
DeadlineExceeded (4) — timeout
```

Status codes are strongly typed, well-documented, and supported by automatic retry/backoff in client libraries. Streaming adds per-message errors via `onError` callback.

> **Think**: Why does GraphQL return HTTP 200 even on errors? Is this good or bad for monitoring?
>
> *Answer: Good for GraphQL semantics (partial success is normal), bad for operational monitoring. Load balancers, CDNs, and alerting systems treat 5xx as failures. GraphQL requires monitoring errors[] content, not HTTP status. This is a known operational pain point — teams must add middleware to track error rates from response body, not status codes.*

---

### Partial Success

| Scenario | REST | GraphQL | gRPC |
|----------|------|---------|------|
| Batch create, one fails | No standard model | Some succeed, error for failed | Stream per-item response with error for failed |
| Resolver calls external API, times out | Entire request fails | Single field null + error | Single request fails |
| Auth fails mid-query | N/A (auth checked per-endpoint) | Auth-checked resolver returns null for unauthorized | Interceptor fails with PermissionDenied |

---

### Caching Semantics

**REST**: GET requests are cacheable by design.
- HTTP caching: `Cache-Control`, `ETag`, `Last-Modified` headers
- Browsers cache GET responses automatically
- CDNs cache by URL — `GET /users/42` caches as key `/users/42`
- Server can invalidate via `Cache-Tag` headers or URL purging

**GraphQL**: POST requests (default) are not cacheable.
- Most GraphQL implementations POST (queries can be large, GET has URL length limits)
- HTTP cache sees POST — does not cache
- Solutions: persisted queries via GET, automatic persisted queries (APQ), Apollo cache-hydration, or CDN-level query whitelisting
- Challenge: same URL (same mutation) can have different meaning — caching is semantic, not URL-based

**gRPC**: Not cacheable at protocol level.
- HTTP/2 POST with binary payload — CDNs don't parse
- No standard response caching
- Solutions: client-side caching, dedicated cache service (e.g., Redis between services)

> **Think**: Can you make GraphQL queries cacheable via GET? What's the tradeoff?
>
> *Answer: Yes — use persisted queries (query stored server-side, send hash via GET /graphql?hash=abc123). Tradeoff: loses ad-hoc query flexibility, requires build-time registration. Alternative: automatic persisted queries (APQ) send hash first, query on miss. Tradeoff: extra round trip on first request per client.*

---

> ```mermaid
> sequenceDiagram
>     participant Client
>     participant CDN
>     participant API as API Server
>     
>     rect rgb(200, 230, 200)
>     Note over Client,API: REST Caching
>     Client->>CDN: GET /users/42
>     CDN-->>Client: Cache HIT → returns cached
>     Note over CDN: Cache key: URL + headers
>     CDN->>API: Cache MISS → fetch origin
>     API-->>CDN: 200 + Cache-Control: public, max-age=3600
>     end
>     
>     rect rgb(255, 220, 220)
>     Note over Client,API: GraphQL Caching
>     Client->>CDN: POST /graphql { query: "user(id:42){name}" }
>     Note over CDN: POST not cacheable
>     CDN->>API: Must forward
>     API-->>Client: 200
>     Note over CDN: GraphQL @ POST = no CDN caching
>     end
>     
>     rect rgb(220, 220, 255)
>     Note over Client,API: GraphQL + Persisted Query Caching
>     Client->>CDN: GET /graphql?hash=abc123
>     CDN-->>Client: Cache HIT
>     Note over CDN: Cache key: URL hash = deterministic
>     end
> ```

---

### Cache Invalidation

| Strategy | REST | GraphQL | gRPC |
|----------|------|---------|------|
| Mechanism | URL-based purging | Complex — many queries return same data | Not commonly cached |
| Granularity | Per-resource URL | Per-query (queries with different fields for same entity) | N/A |
| Real-time | Webhooks, cache tags | Subscriptions + cache update | N/A |
| Complexity | Low | High — needs normalized cache (Apollo, Relay) | Low (no caching) |

> **Think**: Why is cache invalidation harder for GraphQL? What normalized caching solution addresses it?
>
> *Answer: In REST, `PATCH /users/42` directly maps to cache key `/users/42`. In GraphQL, a user update affects every query that includes User fields — `users { name }`, `user(id:42) { name email }`, `search(term:"alice") { ... user { name } }`. Normalized caches (Apollo Client, Relay) split query results into entity store by `__typename` + `id`. Invalidating entity auto-refreshes all queries that reference it.*

---

### Auth Models

| Aspect | REST | GraphQL | gRPC |
|--------|------|---------|------|
| Token transport | `Authorization: Bearer` header | Context-based (resolver reads auth context) | Interceptor attaches metadata |
| Scope granularity | Per-endpoint | Per-field | Per-RPC |
| Common pattern | JWT in header, validated in middleware | JWT decoded, user injected into GraphQL context | JWT in metadata, validated in interceptor |
| Middleware | Middleware checks per route | Auth directive on schema fields | Interceptor chain |

---

### Ecosystem Maturity

| Tool | REST | GraphQL | gRPC |
|------|------|---------|------|
| Documentation | Swagger/OpenAPI + ReDoc | GraphiQL + Apollo Sandbox | protoc + protoc-gen-doc |
| Testing | Postman, Insomnia, curl | Apollo Studio, Altair, Hoppscotch | grpcurl, grpc_cli |
| Codegen | OpenAPI Generator, Fern | GraphQL Codegen | protoc + language-specific plugin |
| Standards | OpenAPI 3.x, JSON:API, HAL | GraphQL over HTTP spec | gRPC spec + protobuf |
| Monitoring | Standard HTTP metrics (status, latency) | Custom metrics (query depth, cost, resolver time) | Standard gRPC metrics per RPC |

---

### Real-World Comparison Table

| Criterion | REST | GraphQL | gRPC |
|-----------|------|---------|------|
| Error granularity | Status code + body | errors[] with path/extensions | gRPC status code + details |
| Partial success | Poor | Native | Stream-based |
| CDN cacheability | Excellent (GET) | Poor (POST default) | None |
| Cache invalidation | Simple URL-based | Complex (normalized) | N/A |
| Auth complexity | Low (header middleware) | Medium (context plumbing) | Medium (interceptors) |
| Tooling maturity | Very high | High | Medium |
| Learning curve | Low | Medium | High (proto IDL) |

---

### Why This Matters

Error handling and caching determine operational reliability. REST's simple status codes become insufficient for complex operations. GraphQL's 200-for-errors pattern requires tooling changes. Caching strategy directly impacts latency, cost, and scalability — choosing an API style without understanding its cache model leads to surprise bills and slow pages.

---

## Examples

### Example 1: Batch Payment Processing

**Scenario**: Process 100 payment transactions. Three fail due to insufficient funds.

**REST**: `POST /payments/batch` → 200 with array of `{id, status}`. Some `"completed"`, some `"failed"`. Client must scan array. No standard error protocol.

**GraphQL**: Mutation creates payments, returns per-payment status. Failed payments come back as null entries with corresponding errors[]. Client renders green checkmarks for 97, red X for 3, sees error messages.

**gRPC**: Bidirectional stream. Server sends `PaymentResponse` messages. Each has status + optional error. Client stream handler processes each as it arrives — no waiting for entire batch.

---

### Example 2: Public API for Third-Party Developers

**Scenario**: Expose product catalog to external developers. Need caching, docs, and clear errors.

**REST**: Natural fit. GET endpoints cacheable at CDN. Swagger generates docs. Standard HTTP errors familiar to every developer. Rate limiting via 429. Cache invalidation via webhook.

**GraphQL**: Works but needs persisted queries for caching. Errors need clear extensions codes. Introspection enables powerful developer tooling (GraphiQL). More flexible but steeper ramp for third-party devs.

**gRPC**: Overkill. External developers need to set up proto toolchain, understand streaming. Not cacheable — every request hits origin. Best reserved for internal or B2B with high throughput.

**Verdict**: REST for public API. GraphQL for owned clients (web + mobile). gRPC for internal mesh.

---

## Key Takeaways
- REST uses HTTP status codes (coarse), GraphQL uses errors[] (granular, allows partial success), gRPC uses typed status codes
- Partial success is REST's weakness, GraphQL's default, gRPC's stream-based strength
- REST GET is CDN-cacheable; GraphQL POST is not (use persisted queries); gRPC is not cacheable at protocol level
- Cache invalidation is simplest in REST (URL-based), hardest in GraphQL (many queries → one entity)
- Auth complexity: REST < GraphQL < gRPC (interceptors add abstraction)
- Tooling maturity: REST (highest) > GraphQL > gRPC (lowest for general API use)
- For public APIs: REST for cacheability + simplicity; for owned clients: GraphQL for flexibility; for internal: gRPC for performance

## Common Misconception

**"GraphQL's 200-for-all-responses is a design flaw."**

It's intentional. GraphQL treats partial success as the common case — some resolvers succeed, some fail. Returning 200 + errors[] reflects this. The flaw is operational (monitoring can't rely on HTTP status), mitigated by response-time tracking middleware and structured error extensions.

---

## Feynman Explain

Explain to a DevOps engineer why GraphQL monitoring is harder than REST monitoring. Cover: (1) HTTP status always 200, (2) errors live in response body, (3) a query with 90% success and 10% failure looks like a 200 to the load balancer, (4) remediation requires middleware or resolver-level metrics. Use 3 sentences.

*When ready, say explanation aloud or write it down. Then run `learn.sh explain graphql-deep-dive 17` — AI will probe your explanation for gaps.*

---

## Reframe

Critique: "REST's caching is simpler and more battle-tested than GraphQL's complex normalized cache invalidation." Under what conditions does GraphQL's caching disadvantage become irrelevant? Consider: real-time data, authenticated responses, server-rendered apps.

---

## Drill

Take the quiz. MCQs test recall, comparison, and scenario-based error/caching decisions.

Run: `learn.sh quiz graphql-deep-dive 17`
