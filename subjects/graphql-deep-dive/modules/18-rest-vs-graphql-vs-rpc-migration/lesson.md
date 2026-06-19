# Module 18: REST vs GraphQL vs RPC: Migration & TCO

Est. study time: 2h
Language: en

## Learning Objectives
- Design REST-to-GraphQL migration strategies using wrap, strangler fig, and gateway patterns
- Evaluate polyglot API architectures for different organizational contexts
- Analyze total cost of ownership across API styles using concrete scenarios

---

## Core Content

### REST to GraphQL Migration Strategies

Three main approaches, ordered by risk:

**1. Wrap REST Endpoints**

Quickest path. GraphQL resolvers call existing REST endpoints. No server-side changes.
```graphql
type Query {
  user(id: ID!): User
}

# Resolver:
# async function user(parent, { id }, context) {
#   const response = await fetch(`https://api.example.com/v2/users/${id}`);
#   return response.json();
# }
```

Pros: Zero backend refactor, deploy as sidecar. Cons: No performance gain (still N REST calls), inherits REST over-fetching, adds latency (GraphQL parsing + REST call).

**2. Strangler Fig Pattern**

Gradually replace REST endpoints with native GraphQL resolvers. Both interfaces coexist.
```
Phase 1: GraphQL wraps REST  →  graphql.example.com
Phase 2: Migrate user service → native GraphQL resolver
Phase 3: Migrate order service → native GraphQL resolver
Phase 4: Deprecate REST endpoints
```

Each service migration independently. Traffic shifts gradually. Old REST clients unaffected until phase 4.

> **Think**: What is the riskiest phase of strangler fig migration?
>
> *Answer: Phase 4 — removing REST endpoints. If any client still depends on REST (cron jobs, partner integrations, forgotten internal tools), removal causes breakage. Mitigation: monitor REST traffic for 3-6 months before deprecation, log all consumers.*

**3. GraphQL as Gateway / Federation**

GraphQL sits in front of multiple backend services (REST, gRPC, databases). Federation stitches schemas:
```graphql
# Subgraph A (Users Service - gRPC backend)
type User @key(fields: "id") {
  id: ID!
  name: String!
}

# Subgraph B (Orders Service - REST backend)
type Order @key(fields: "id") {
  id: ID!
  userId: ID!
  total: Float!
}

# Supergraph extends Order with User data
extend type Order @key(fields: "id") {
  user: User @requires(fields: "userId")
}
```

Pros: Independent service ownership, incremental adoption. Cons: Federation complexity, router overhead, entity resolution costs.

---

### Polyglot API Architectures

Common patterns combining API styles:

**Pattern 1: REST front-end + GraphQL BFF**
```
Mobile App → GraphQL BFF → REST Services
```
GraphQL BFF sits between mobile and REST backend. Mobile gets GraphQL benefits. Backend team keeps REST unchanged.

**Pattern 2: GraphQL front-end + gRPC backend**
```
Web/Mobile → GraphQL Gateway → gRPC Services
```
GraphQL gateway translates client queries into gRPC calls. Backend services use high-performance gRPC for internal mesh.

**Pattern 3: REST public + GraphQL internal**
```
Third-party devs → REST (stable, cacheable, simple)
Internal teams → GraphQL (flexible, exploratory)
```

**Pattern 4: All three layered**
```
Internet → REST (public API) → GraphQL (aggregation) → gRPC (services) → DB
```

> **Think**: Is polyglot API always better than a single style?
>
> *Answer: No. Polyglot adds operational complexity — more infrastructure to maintain, more expertise required, more surface area for bugs. Best for: (1) migrating incrementally, (2) different consumers with different needs, (3) gradual evolution from legacy REST to modern GraphQL/gRPC. Bad for: small teams, simple domains, or early-stage products.*

---

### Team Skill Requirements

| Skill | REST | GraphQL | gRPC |
|-------|------|---------|------|
| Core knowledge | Every developer | Schema design + resolver patterns | Protobuf IDL + stream handling |
| Learning curve | None (ubiquitous) | 2-4 weeks | 4-8 weeks |
| Common mistakes | Poor resource modeling | N+1, over-fetching resolvers, missing cost analysis | Breaking proto changes, wrong stream type |
| Senior hiring pool | Large | Medium | Small |

---

### Tooling Investment

| Component | REST | GraphQL | gRPC |
|-----------|------|---------|------|
| Schema registry | OpenAPI spec in git or external | Apollo Studio / Hive / WunderGraph | protobuf in git + buf.build |
| Codegen | OpenAPI Generator | GraphQL Codegen | protoc plugins |
| Testing | Postman, Supertest | Apollo Studio Explorer, custom query tests | grpcurl, integration tests |
| Federation | N/A | Apollo Federation / Cosmo / WunderGraph | N/A |
| Monitoring | Standard | Custom (query depth, cost, resolver timing) | Standard per-RPC |
| Cost per tool | $0-100/mo (open source) | $0-500/mo (Apollo Studio, GraphQL Hive) | $0-200/mo (buf.build) |

---

### Operational Cost

| Factor | REST | GraphQL | gRPC |
|--------|------|---------|------|
| Request parsing | Minimal (path + headers) | Full query AST parsing | Protobuf deserialization |
| Query planning | None | Resolver tree walk + batching | None |
| Cost analysis | None needed | Required (depth, field weights, rate limiting) | None needed |
| Response size | Fixed (resource rep) | Variable (depends on query) | Fixed (proto fields) |
| Cache infrastructure | CDN (standard) | CDN + normalized client cache + persisted queries | Client cache + service mesh |
| Complexity ceiling | Simple CRUD | Schema federation, cost analysis, persisted query | Proto compatibility, stream coordination |

---

### Performance Comparison

| Metric | REST | GraphQL | gRPC |
|--------|------|---------|------|
| Time to first byte (simple query) | ~5ms | ~15-30ms (query parse + plan) | ~3-5ms |
| Request size (complex query) | Large (full reps) | Exact fields | Small (binary proto) |
| Parsing overhead (server) | Minimal | 2-10ms per query (AST) | 0.5-2ms (protobuf) |
| Throughput (ops/sec, simple) | High | Medium (query overhead) | Highest |
| Throughput (ops/sec, complex) | Low (N requests) | High (1 request) | Medium (N RPCs) |

> **Think**: When does GraphQL's query parsing overhead outweigh its round-trip savings?
>
> *Answer: When queries are simple (1-2 fields from one entity) and clients make few calls. Example: `GET /users/42` vs GraphQL query `{ user(id:42) { name } }`. REST is ~10ms in, ~10ms out (DNS + TLS + server processing). GraphQL adds 5-10ms parsing + resolver tree walk. For this case REST wins. GraphQL pays off when complexity > 3 relations or multiple entities per view.*

---

> ```mermaid
> graph TD
>     Start[Choose API Style] --> Question1{Primary consumer?}
>     Question1 -->|Third-party developers| Q2{Need caching?}
>     Question1 -->|Owned clients web/mobile| Q3{Data complexity?}
>     Question1 -->|Internal services| Q4{Latency sensitivity?}
>     
>     Q2 -->|High - CDN caching| REST_Public[REST + OpenAPI]
>     Q2 -->|Low - flexible queries| GraphQL_Public[GraphQL + Persisted Queries]
>     
>     Q3 -->|Simple CRUD| REST_Owned[REST or minimal GraphQL]
>     Q3 -->|Complex nested data| GraphQL_Owned[GraphQL]
>     Q3 -->|Real-time| GraphQL_Subs[GraphQL + Subscriptions]
>     
>     Q4 -->|Sub-10ms critical| gRPC_Internal[gRPC]
>     Q4 -->|Moderate latency OK| Q5{Service mesh?}
>     Q5 -->|Yes| gRPC_Mesh[gRPC across services]
>     Q5 -->|No, simple CRUD| REST_Internal[REST]
>     
>     REST_Public --> Conclusion1[High cacheability, simple]
>     GraphQL_Public --> Conclusion2[Flexible, needs caching strategy]
>     REST_Owned --> Conclusion3[Low overhead, simple]
>     GraphQL_Owned --> Conclusion4[Best UX for complex UIs]
>     GraphQL_Subs --> Conclusion5[Real-time without WebSocket boilerplate]
>     gRPC_Internal --> Conclusion6[Best perf for service mesh]
>     REST_Internal --> Conclusion7[Simple, well-understood]
> ```

---

### When to Choose Which: Decision Matrix

| Use Case | Best API | Why |
|----------|----------|-----|
| Public API, third-party consumers | REST | Cacheable, simple, universal tooling |
| Mobile app with complex screens | GraphQL | Single round trip, exact fields, helps battery |
| Internal service mesh (50+ services) | gRPC | High throughput, streaming, auto-codegen |
| Real-time dashboard | GraphQL subs or gRPC streaming | Subscriptions for FE, streaming for BE |
| Admin panel (CRUD) | REST or minimal GraphQL | Simple, low overhead |
| B2B API with SLAs | REST | Cacheable, monitoring mature |
| Microservice with BFF | GraphQL + gRPC | GraphQL at edge, gRPC internally |
| Legacy system integration | REST (wrap) → GraphQL (strangler) | Incremental migration |

---

### Total Cost of Ownership: Three Scenarios

**Scenario A: Startup MVP (3 engineers)**
- REST: Quick to build, widely understood, no schema design overhead. Estimated 2 weeks dev time, $0 tooling.
- GraphQL: 3-4 weeks dev time (schema design, resolvers, N+1 fixes), $0-50/mo tooling (Apollo Studio free tier).
- gRPC: 4-6 weeks dev time (proto files, stream handling, codegen setup), $0 tooling.
- Verdict: REST for speed. Migrate to GraphQL when data complexity grows.

**Scenario B: Mid-stage product (20 engineers, mobile + web)**
- Current: REST (hundreds of endpoints, 5 services). Mobile app slow (waterfall). Team spends 30% of sprint on API changes.
- Migrate to GraphQL: 8 weeks to graft GraphQL gateway. 16 weeks to strangler-native resolvers. Tooling: $200/mo (Apollo Studio team). Ongoing: $100/mo gateway infrastructure.
- ROI: Mobile load time 4x faster. API change velocity increases (add field, no endpoint). Developer productivity: 1 API change instead of 3 endpoint updates.
- Verdict: GraphQL migration pays for itself in 6 months.

**Scenario C: Enterprise (100+ engineers, 50 microservices)**
- REST + gRPC hybrid. Public APIs REST (CDN-cached, $50k/mo CDN bill). Internal mesh gRPC (50 services, 1M req/s).
- GraphQL federation layer between FE teams and gRPC backend. 2 federation subgraphs, Apollo Router with custom cost analysis.
- Tooling: Apollo Studio Enterprise ($10k/yr), federation gateway ($2k/mo infra). Team: 3 SREs manage gateway.
- Verdict: Polyglot justified by scale. Cost of single style would exceed tooling cost.

> **Think**: Why does TCO change with scale? What cost shifts?
>
> *Answer: At small scale, developer time dominates TCO — simple REST wins. At medium scale, API change velocity and mobile performance dominate — GraphQL's schema evolution wins. At large scale, infrastructure and throughput dominate — gRPC's efficiency and polyglot optimization pay off.*

---

### Why This Matters

Choosing API architecture is a 3-5 year commitment. Migration costs grow with size — early decisions compound. Understanding TCO prevents over-investing in trendy tech for simple needs or under-investing in flexibility for complex ones. Good API strategy aligns with team size, consumer types, and growth trajectory.

---

## Examples

### Example 1: Fintech App Migration

**Context**: 30-person team, mobile-first fintech app. REST API with 200+ endpoints. Mobile team complains about slow onboarding (5-7 sequential requests for account setup).

**Migration**: Month 1-2: GraphQL gateway wrapping REST. Mobile adopts GraphQL immediately — onboarding drops from 7 requests to 2. Month 3-6: Strangler fig — rewrite critical resolvers (accounts, transactions) as native GraphQL. Month 7-9: Deprecate slowest REST endpoints. Month 10+: Add federation as services split into microservices.

**Results**: 60% reduction in mobile API latency. 40% reduction in endpoint maintenance (100 REST endpoints deprecated). Team grows GraphQL expertise across 3 squads.

---

### Example 2: E-commerce Public API

**Context**: Retail company exposes product catalog to 500+ third-party developers.

**Decision**: REST. Rationale: (1) CDN caching — product data changes hourly, 500ms cache saves 50% origin traffic. (2) Developer familiarity — partners use curl/Postman, not GraphQL IDEs. (3) Simpler SLAs — standard HTTP monitoring, status codes, retries.

**Tradeoff**: GraphQL would give partners more flexible queries. But CDN caching is worth more than flexibility here — every 100ms of latency costs 1% conversion on partner sites.

**Verdict**: REST for public catalog. Internal admin uses GraphQL.

---

## Key Takeaways
- Three migration strategies: wrap (fast, no gain), strangler fig (gradual, popular), federation gateway (incremental but complex)
- Polyglot architectures suit different consumers (REST for public, GraphQL for owned clients, gRPC for internal)
- Team skill varies: REST is universal, GraphQL needs schema design expertise, gRPC needs protobuf fluency
- Tooling costs: REST cheapest, GraphQL moderate (federation tools), gRPC moderate (buf.build, protoc plugins)
- Performance: gRPC wins throughput, REST wins simple queries, GraphQL wins complex data fetches
- TCO shifts with scale: startup → REST for speed, mid → GraphQL for velocity, enterprise → polyglot for optimization
- Decision matrix: match API style to consumer type, data complexity, and latency requirements
- No perfect API — every choice is a bet on future scaling direction

## Common Misconception

**"Migrating to GraphQL means rewriting all your services."**

False. The wrap strategy proves you can get GraphQL benefits without rewriting anything. The strangler fig lets you replace services one at a time. Many production GraphQL deployments run 50% wrapped, 50% native for years. Migration is a gradual process, not a flag day.

---

## Feynman Explain

Explain the strangler fig migration pattern to a senior engineer skeptical of GraphQL. Cover: (1) GraphQL gateway wraps REST endpoints as first step, (2) individual services migrate independently, (3) both interfaces coexist, (4) REST gets deprecated only when traffic reaches zero. Use 2 sentences per concept.

*When ready, say explanation aloud or write it down. Then run `learn.sh explain graphql-deep-dive 18` — AI will probe your explanation for gaps.*

---

## Reframe

Critique: "GraphQL adds an unnecessary layer of abstraction that most teams don't need. REST is simpler, cheaper, and works for 80% of use cases." Counter argue using the mid-stage product scenario (20 engineers, mobile app, 5 services). Where does REST's simplicity become operational debt? At what team size does GraphQL's investment pay off?

---

## Drill

Take the quiz. MCQs test scenario-based decision-making, migration strategy selection, and TCO analysis.

Run: `learn.sh quiz graphql-deep-dive 18`
