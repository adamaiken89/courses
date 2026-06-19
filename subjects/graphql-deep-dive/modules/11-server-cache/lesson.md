# Module 11: Server Cache

Est. study time: 2h
Language: en

## Learning Objectives
- Design multi-layer server cache strategy for GraphQL: CDN, APQ, response cache, DataLoader
- Implement cache key composition with query + variables + user context
- Apply cache-aside, read-through, and write-through patterns with Redis

---

## Core Content

### CDN Caching: GET vs POST

GraphQL traditionally uses POST — request body never cached by CDNs. To leverage CDN caching:

- **GET queries**: Send query as URL query param `?query=...&variables=...`. CDNs cache by full URL. Works only for queries, not mutations.
- **Automatic Persisted Queries (APQ)**: Hybrid approach — send hash first, CDN caches full query on miss.

```http
# APQ flow: Step 1 — send hash
POST /graphql
Content-Type: application/json

{"query": "# hash=abc123", "extensions": {"persistedQuery": {"version": 1, "sha256Hash": "abc123"}}}

# Step 2 — on miss, server returns error, client resends with full query
# Step 3 — subsequent requests send hash only, server returns cached result
```

> **Think**: Why not use GET for all GraphQL queries? What breaks?
>
> *Answer: GET URLs have length limits (~2KB in some proxies, ~8KB in others). Complex queries with large variable objects exceed these limits. Also, GET requests are logged in full in server access logs, potentially leaking sensitive query variables. POST avoids both issues.*

---

### Cache-Control Headers

GraphQL responses should set standard HTTP cache headers for CDN/proxy cooperation:

```http
# Public query — cacheable by CDN and browsers
Cache-Control: public, max-age=300, s-maxage=600

# User-specific data — private cache only
Cache-Control: private, max-age=60

# Dynamic/deprecated data — no cache
Cache-Control: no-cache
```

Key headers:
- `s-maxage` — shared cache (CDN) TTL, overrides `max-age`
- `stale-while-revalidate` — serve stale while fetching fresh
- `stale-if-error` — serve stale when origin errors

> **Think**: How does `stale-while-revalidate` compare to `no-cache` for GraphQL queries?
>
> *Answer: `no-cache` revalidates every request, adding latency on every hit. `stale-while-revalidate` serves cached (possibly stale) data immediately while refreshing in background. Better UX for dashboards and lists where freshness is non-critical. Wrong for bank balances or real-time state where stale data is dangerous.*

---

### Automatic Persisted Queries (APQ)

APQ eliminates query string overhead in every request:

1. Client computes SHA-256 hash of query
2. Sends hash instead of full query
3. Server checks hash in cache → returns cached result
4. On cache miss, server responds with error, client resends with full query
5. Server stores query-by-hash and returns result

```
Client → Server: {"extensions": {"persistedQuery": {"sha256Hash": "abc", "version": 1}}}
Server → Client: {"errors": [{"message": "PersistedQueryNotFound"}]}
Client → Server: {"query": "...full query...", "extensions": {"persistedQuery": {"sha256Hash": "abc", "version": 1}}}
Server → Client: {"data": {...}, "extensions": {"persistedQuery": {"sha256Hash": "abc", "version": 1}}}
// Subsequent requests: hash only
```

Benefits:
- Smaller payload (most requests drop 50-90% of bytes)
- Enables GET-based CDN caching (short URL = hash only)
- Works with any transport (HTTP, WebSocket)

---

> ```mermaid
> sequenceDiagram
>     participant Client
>     participant CDN
>     participant GraphQL Server
>     participant APQ Cache
>     participant Data Sources
>     
>     Client->>CDN: GET /graphql?extensions.persistedQuery.sha256Hash=abc123
>     alt Cache Hit at CDN
>         CDN-->>Client: Cached Response (200)
>     else Cache Miss at CDN
>         CDN->>GraphQL Server: Forward Request
>         GraphQL Server->>APQ Cache: Lookup Query by Hash
>         alt APQ Hit
>             APQ Cache-->>GraphQL Server: Full Query
>         else APQ Miss
>             GraphQL Server-->>Client: PersistedQueryNotFound
>             Client->>CDN: GET with Full Query + Hash
>             CDN->>GraphQL Server: Forward
>             GraphQL Server->>APQ Cache: Store Query by Hash
>             GraphQL Server->>Data Sources: Execute Query
>             Data Sources-->>GraphQL Server: Result
>             GraphQL Server-->>CDN: Response with Cache-Control
>             CDN-->>Client: Cached Response
>         end
>     end
> ```

---

### Response Caching at Server Level: Redis & Memcached

Server-side response cache stores complete GraphQL responses keyed by cache key.

**Redis** (in-memory with persistence):
- Rich data structures: strings, hashes, sorted sets
- TTL, atomic operations, pub/sub
- Ideal for cache-aside with invalidation listeners

**Memcached** (pure in-memory, simpler):
- No persistence, no data structures beyond key-value
- Lower per-operation overhead (~ms faster than Redis for simple ops)
- Good for simple TTL-only caching

Choosing Redis vs Memcached for GraphQL:
- Need cache invalidation (purge keys, tag-based)? → Redis
- Need persistence across restarts? → Redis
- Need pub/sub for invalidation propagation? → Redis
- Only need simple TTL-based cache? → Memcached is fine

```python
# Cache-aside pseudocode (Python-like)
def resolve_products(_, args, context):
    cache_key = f"products:{hash_query(context.query)}:{hash_vars(args)}"
    
    # Check cache
    cached = redis.get(cache_key)
    if cached:
        return json.loads(cached)
    
    # Miss — compute and store
    result = fetch_from_db(args)
    redis.setex(cache_key, TTL, json.dumps(result))
    return result
```

> **Think**: What happens to cache hit rate when queries share the same data but differ in field selection?
>
> *Answer: Field selection differences produce different query strings → different cache keys → cache miss even though underlying data is identical. Solutions: normalize queries (strip whitespace, sort fields) before hashing, or use a normalized cache key based on data requirements (e.g., Apollo's `cache-control` directive).*

---

### Cache Key Design: Query + Variables + User

Cache key must uniquely identify when two requests can share a response:

```
cache_key = hash(normalized_query + json(variables) + user_context_key)
```

Where:
- `normalized_query`: Sort fields alphabetically, strip whitespace. Same semantic query → same normalized form
- `variables`: Sorted JSON. `{a:1, b:2}` must produce same key as `{b:2, a:1}`
- `user_context_key`: `null` for public data, user ID for private data, role for role-based data

Caution: Variables with large lists (e.g., `ids: [1,2,3,...,1000]`) produce unique keys per request, trashing cache. Use hash of list or normalize to a CURIE-like identifier.

```python
def cache_key(query, variables, user_id=None):
    normalized = normalize_query(query)
    vars_str = json.dumps(variables, sort_keys=True)
    payload = f"{normalized}:{vars_str}"
    if user_id:
        payload += f":{user_id}"
    return hashlib.sha256(payload.encode()).hexdigest()
```

> **Think**: Should authentication tokens be part of the cache key?
>
> *Answer: No — tokens change per session but represent the same user. Use stable user ID from decoded token. Token in key means cache eviction on every login/logout. Use token → user ID mapping at request layer.*

---

### Caching Patterns: Cache-Aside, Read-Through, Write-Through

| Pattern | Read Behavior | Write Behavior | Pros | Cons |
|---------|--------------|----------------|------|------|
| **Cache-Aside** | App checks cache, loads on miss, stores result | App updates DB, invalidates or updates cache | Simple, explicit control | Stale data window, write amplification |
| **Read-Through** | Cache fetches from DB on miss transparently | App writes to DB, cache may auto-invalidate | Clean app code, consistent read path | Cache must know how to load data |
| **Write-Through** | Same as read-through | App writes to cache, cache writes to DB synchronously | Cache always fresh, no stale reads | Write latency penalty, stronger consistency |

For GraphQL servers:

```python
# Cache-Aside (most common in GraphQL)
def resolve_user(parent, args, context):
    key = f"user:{args.id}"
    cached = cache.get(key)
    if cached:
        return cached
    user = db.fetch_user(args.id)
    cache.setex(key, 300, user)
    return user

# Read-Through (less common, requires cache-aware loader)
# Cache layer knows how to call DB. App just does cache.get(key).
# Implementation: Redis with custom module, or client-side cache wrapper.

# Write-Through (for mutations that must update cache)
def resolve_updateUser(parent, args, context):
    updated = db.update_user(args.id, args.input)
    key = f"user:{args.id}"
    cache.setex(key, 300, updated)  # Write to cache synchronously
    return updated
```

> **Think**: Why is cache-aside the dominant pattern for GraphQL resolvers?
>
> *Answer: GraphQL resolvers are fine-grained and data-source-agnostic. A resolver doesn't know if the data source supports read-through. Cache-aside keeps caching logic in the resolver layer where the resolver already handles data fetching. Read-through requires the cache itself to understand data sources, coupling infrastructure to domain.*

---

### Distributed Cache Invalidation with Redis

Invalidation is the hard part. Redis provides tools:

**Explicit eviction by key:**
```python
cache.delete(f"user:{user_id}")
cache.delete(f"posts:user:{user_id}")
```

**Pattern-based eviction** (dangerous in production with many keys):
```python
for key in redis.scan_iter("user:*"):
    cache.delete(key)
```

**Tag-based invalidation** (Redis sets):
```python
# When storing, tag the cache entry
cache.setex(cache_key, TTL, result)
cache.sadd(f"tag:user:{user_id}", cache_key)

# When invalidating, retrieve all keys for tag and delete
keys = cache.smembers(f"tag:user:{user_id}")
if keys:
    cache.delete(*keys)
    cache.delete(f"tag:user:{user_id}")
```

Challenges:
- GraphQL nested data means one DB update can invalidate many cache keys
- Race conditions: request A reads stale while request B writes
- Thundering herd: many requests miss simultaneously after invalidation

> **Think**: How does GraphQL's nested nature make invalidation harder than REST?
>
> *Answer: REST has one resource per URL. Updating `/users/1` might invalidate one cache key. GraphQL — a single mutation like `updateUser` can affect `User`, `Post` (their posts), `Feed` (containing user's posts), `Notification` (containing user data) — each with its own cache key. Cross-cutting data makes invalidation an n² problem.*

---

### Cache Warming Strategies

Proactive cache population before users request data:

**Strategy 1: Scheduled warming**
```python
# Cron job: every 5 minutes, re-fetch top 100 queries
WARM_QUERIES = [
    ("query { topProducts { id name price } }", {}),
    ("query { categories { id name } }", {}),
]
for query, variables in WARM_QUERIES:
    result = execute_query(query, variables)
    cache.set(cache_key(query, variables), result, ex=300)
```

**Strategy 2: Event-driven warming**
```python
# After DB update, re-compute affected cache entries
def on_product_update(product_id):
    affected_queries = find_cached_queries_for_product(product_id)
    for query, variables in affected_queries:
        result = execute_query(query, variables)
        cache.set(cache_key(query, variables), result, ex=300)
```

**Strategy 3: Pre-warming on deploy**
- On server startup, warm critical queries before accepting traffic
- Prevents cold-start latency spike

```python
@app.on_event("startup")
def warm_cache():
    log("Warming cache...")
    for q in CRITICAL_QUERIES:
        execute_and_cache(q.query, q.variables)
```

> **Think**: When does cache warming hurt instead of help?
>
> *Answer: When warmed data is never requested — wasted compute and memory. When warming queries are too numerous, slowing startup. When warming and real requests race — real request reads stale data written seconds apart. Warm selectively: top 5-10 queries by request frequency, or queries with known high latency.*

---

### Per-Request DataLoader Cache vs Shared Response Cache

These serve different purposes and should be used together:

| | DataLoader Cache | Shared Response Cache |
|---|---|---|
| **Scope** | Single request | Across requests |
| **Lifetime** | Request lifetime (ms) | Seconds to hours |
| **Key** | Data-source key (e.g., `User:42`) | Query + variables + user |
| **Purpose** | Eliminate duplicate fetches within one query | Avoid re-executing identical queries across clients |
| **Backend** | In-memory per request | Redis / Memcached |
| **Invalidation** | Automatic (request ends) | Explicit or TTL |

```python
# DataLoader — deduplicates within one GraphQL request
loader = DataLoader(lambda keys: batch_fetch_users(keys))
user1 = loader.load(1)  # Queued
user2 = loader.load(1)  # Returns same promise, no duplicate fetch
user3 = loader.load(2)  # Batched with user1 in same DB call

# Shared cache — across requests (Redis)
cached = redis.get("query:abc123")
if cached:
    return cached  # Skips resolver + DataLoader entirely
result = execute_query(query)
redis.setex("query:abc123", 60, result)
return result
```

They compose: checks shared cache first → if miss, execute query with DataLoader deduplication → store in shared cache.

> **Think**: Can the DataLoader cache replace the shared response cache?
>
> *Answer: No. DataLoader prevents duplicate DB calls within a single request. Shared response cache prevents re-execution across requests. Two different problems. A fleet of 1000 servers each running the same query still hits the DB 1000 times without shared cache, even with perfect DataLoader usage.*

---

### Why This Matters

Server-side caching separates production GraphQL from toy GraphQL. Without it, every query hits databases, external APIs, and compute layers. Multi-layer caching (CDN → APQ → Redis → DataLoader) reduces p99 latency from 500ms to 5ms for cacheable queries. Poor cache key design or missing invalidation causes stale data bugs that erode trust. The difference between a GraphQL API that scales and one that collapses under load is caching.

---

## Examples

### Example 1: Multi-Layer Cache Setup

```python
# Middleware ordering: CDN → APQ → Redis → DataLoader

class GraphQLMiddleware:
    def process_request(self, request):
        # Layer 1: CDN handled by CloudFront/Akamai
        # Layer 2: APQ — resolve hash to query
        request.query = self.apq_cache.resolve(request)
        
        # Layer 3: Redis response cache
        cache_key = self.build_cache_key(request)
        cached = self.redis.get(cache_key)
        if cached:
            return Response(json.loads(cached), headers={"X-Cache": "HIT"})
        
        # Layer 4: Execute with DataLoader
        result = self.execute(request)
        
        # Store in Redis
        ttl = self.compute_ttl(request.operation)
        self.redis.setex(cache_key, ttl, json.dumps(result))
        
        return Response(result, headers={"X-Cache": "MISS"})
```

---

### Example 2: Tag-Based Invalidator

```python
def invalidate_for_user(user_id):
    tags = [
        f"user:{user_id}",
        f"posts:{user_id}",
    ]
    for tag in tags:
        keys = redis.smembers(f"tag:{tag}")
        if keys:
            redis.delete(*keys)

def store_with_tags(cache_key, value, tags, ttl=300):
    redis.setex(cache_key, ttl, json.dumps(value))
    for tag in tags:
        redis.sadd(f"tag:{tag}", cache_key)

# Usage in resolver
def resolve_user_profile(parent, args, context):
    user_id = context.user.id
    cache_key = f"profile:{user_id}"
    stored = store_with_tags(cache_key, profile, tags=[f"user:{user_id}"])
```

---

## Key Takeaways
- CDN caching requires GET requests or APQ — POST bodies are not cacheable by CDNs
- APQ reduces payload size by hashing queries, enabling CDN caching with short URLs
- Cache key = normalized query + sorted variables + user context
- Cache-aside is the dominant GraphQL caching pattern — simple and explicit
- Distributed invalidation is the hardest problem; use Redis tags to associate cache entries with domain entities
- DataLoader and shared response cache are complementary, not replacements

---

## Common Misconception

**"GraphQL responses are uncacheable because every query is different."**

Wrong. Most GraphQL APIs serve a small set of query shapes repeatedly — `getUser`, `getProducts`, `getFeed`. Even if variables differ, cache key parameters produce separate entries. The real question is TTL and invalidation, not cacheability. Normalize queries (strip whitespace, sort fields) to maximize cache key reuse. The 80/20 rule applies: 20% of query shapes generate 80% of traffic. Cache those.

---

## Feynman Explain

Explain server-side GraphQL caching to a backend engineer who knows Redis but not GraphQL. Cover: why POST breaks CDN caching, how APQ works, and why cache key includes query + variables + user context. Then explain why GraphQL makes invalidation harder than REST. Max 3 sentences per concept.

*When ready, say explanation aloud or write it down. Then run `learn.sh explain graphql-deep-dive 11` — AI will probe your explanation for gaps.*

---

## Reframe

Critique: Adding Redis, APQ, and CDN caching is overengineering for most GraphQL APIs. A single Postgres database with proper indexing handles most workloads fine. When does each caching layer become justified? What request volume or latency requirements warrant adding each layer?

---

## Drill

Take the quiz. MCQs test caching strategy, key design, invalidation patterns.

Run: `learn.sh quiz graphql-deep-dive 11`
