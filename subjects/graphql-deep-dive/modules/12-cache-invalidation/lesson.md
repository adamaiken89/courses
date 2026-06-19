# Module 12: Cache Invalidation

Est. study time: 2h
Language: en

## Learning Objectives
- Identify why GraphQL cache invalidation is fundamentally harder than REST
- Implement webhook-based, TTL-based, and pub/sub invalidation strategies
- Apply stale-while-revalidate and cache tags to balance freshness vs latency

---

## Core Content

### Why Cache Invalidation Is Hard in GraphQL

REST invalidation is straightforward: `PUT /users/1` invalidates `GET /users/1`. GraphQL breaks this 1:1 mapping.

A single `updateUser` mutation can affect:
- `{ user(id: 1) { profile { name } } }` — direct user query
- `{ posts { author { name } } }` — post listing with user data
- `{ feed { items { user { name } } } }` — feed containing user's content
- `{ search(query: "alice") { ... } }` — search results

Each query shape is a different cache key. The mutation author cannot easily enumerate all affected keys.

```python
# Hard: mutation must know which queries are cached
def resolve_updateUser(parent, args, context):
    user = db.update_user(args.id, args.input)
    # What cache keys contain this user's data?
    # "user:1"? "posts:all"? "feed:*"? "search:*"?
    # Impossible to enumerate exhaustively in a large schema
    return user
```

> **Think**: REST has `/users/1` — one URL, one cache key. GraphQL can query user data through 50 different entry points. Why can't we just invalidate by data source?
>
> *Answer: Because cache key is based on query shape + variables, not data source. `{ user(id: 1) { name } }` and `{ user(id: 1) { name email } }` are different keys. Even if both read from the same `users` table, they're separate cache entries. Invalidating by data source requires a mapping layer: "this cache entry depends on these DB rows."*

---

### Webhook-Based Invalidation

External services notify the cache layer when data changes:

**PurgeKey — Apollo's approach:**
- Schema annotates types with `@cacheControl` directive
- Server computes list of "purge keys" for each response
- When mutation occurs, send webhook with keys to purge

```python
# Schema annotation
# type User @cacheControl(maxAge: 300) { ... }
# type Post @cacheControl(maxAge: 60, inheritMaxAge: true) { ... }

# On mutation, compute purge keys
keys = ["User:1", "User:2", "Post:42"]
webhook_client.send("https://cache-purge.internal", {"keys": keys})

# Cache server receives webhook and invalidates
@app.post("/purge")
def purge_keys(body):
    for key in body["keys"]:
        cache.delete_by_tag(key)
```

**Custom webhook endpoint:**
```python
POST /graphql-cache/purge
Content-Type: application/json

{"tags": ["user:1", "post:42"]}
```

Webhook reliability challenges:
- At-least-once vs exactly-once delivery
- Webhook failure → stale data persists
- Backpressure when many keys need purging simultaneously

> **Think**: What happens if the webhook fails? How do you prevent permanent stale data?
>
> *Answer: Combine webhooks with TTL. Webhooks provide fast invalidation; TTL is the safety net. If webhook fails, TTL eventually expires the stale entry. Use retry queues with exponential backoff for webhook delivery. Health-check the purge endpoint before sending.*

---

### TTL-Based Strategies

**Fixed TTL:** Same expiry time for every cache entry.
```python
cache.setex(key, 300, result)  # 5 minutes, always
```
Simple but wasteful: data that changes every second still lives 5 minutes.

**Sliding TTL:** Reset TTL on every read. Hot entries stay cached; cold entries expire.
```python
# Reset TTL on hit (cache library handles this)
# Resurrects entries that keep getting read
# Risk: frequently-read stale data never expires
```

**Max-Age (per-type TTL):** Different TTL per schema type, via `@cacheControl`.
```graphql
type User @cacheControl(maxAge: 300) {
  id: ID!
  name: String!
}

type StockPrice @cacheControl(maxAge: 5) {
  symbol: String!
  price: Float!
}
```

| Strategy | Freshness | Complexity | Use Case |
|----------|-----------|------------|----------|
| Fixed TTL | Low | None | Static reference data |
| Sliding TTL | Medium | Low | Popular items that change rarely |
| Per-type TTL | High | Medium | Mixed workloads (profiles + stock prices) |

> **Think**: Sliding TTL keeps hot data cached forever. When is this dangerous?
>
> *Answer: When the data changes but stays hot. Example: a breaking news article's view count keeps refreshing TTL, but the article's content was updated. The stale content version never expires because it's always being read. Solution: cap sliding TTL with a fixed upper bound, or use write-through for mutable data.*

---

### Pub/Sub Invalidation

Decouple invalidation producers from consumers via message broker.

**Redis Pub/Sub:**
```python
# Publisher (mutation resolver)
def resolve_updateUser(parent, args, context):
    user = db.update_user(args.id, args.input)
    redis.publish("cache:invalidate", json.dumps({
        "type": "User",
        "id": args.id,
        "timestamp": time.now()
    }))
    return user

# Subscriber (separate process or thread)
pubsub = redis.pubsub()
pubsub.subscribe("cache:invalidate")
for message in pubsub.listen():
    payload = json.loads(message["data"])
    pattern = f"{payload['type']}:{payload['id']}:*"
    for key in redis.scan_iter(pattern):
        redis.delete(key)
```

**Postgres LISTEN/NOTIFY:**
```sql
-- In a Postgres trigger
CREATE OR REPLACE FUNCTION notify_cache_invalidation()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('cache_invalidation', 
    json_build_object('table', TG_TABLE_NAME, 'id', NEW.id)::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_update_trig
  AFTER UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION notify_cache_invalidation();
```

```python
# Listener in application
import select
conn = psycopg2.connect(dsn)
conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
curs = conn.cursor()
curs.execute("LISTEN cache_invalidation;")
while True:
    if select.select([conn], [], [], 5) != ([], [], []):
        conn.poll()
        for notify in conn.notifies:
            handle_invalidation(notify.payload)
        conn.notifies.clear()
```

Pub/Sub pros:
- Decoupled: mutation resolver does not need to know which cache keys exist
- Multiple subscribers can react to same event independently
- Works across server instances in a fleet

Cons:
- Eventually consistent: window between NOTIFY and cache deletion
- Redis Pub/Sub is fire-and-forget (no persistence — disconnect = missed messages)
- Postgres NOTIFY has payload size limits (~8KB)

> **Think**: Why use Redis Pub/Sub for invalidation instead of just calling cache.delete() in the resolver?
>
> *Answer: Calling cache.delete() in the resolver couples mutation logic to cache infrastructure. If the cache topology changes (new Redis cluster, additional cache layers), every resolver must be updated. Pub/Sub allows cache subscribers to decide how to invalidate independently. Also, Pub/Sub works across processes: one server handles mutation, another receives invalidation event.*

---

### Stale-While-Revalidate (SWR)

Serve stale (cached) data immediately while fetching fresh data in background.

```python
def resolve_with_swr(key, fetch_fn, stale_ttl=300, max_ttl=600):
    cached = cache.get(key)
    now = time.time()
    
    if cached:
        age = now - cached["cached_at"]
        if age < stale_ttl:
            # Fresh enough — return immediately
            return cached["data"]
        elif age < max_ttl:
            # Stale but usable — return stale, refresh async
            async_refresh(key, fetch_fn)
            return cached["data"]
        else:
            # Too stale — must wait for refresh
            return fetch_fn()
    else:
        # No cache — fetch and store
        result = fetch_fn()
        store(key, result)
        return result
```

SWR tradeoffs:
- Users always see data instantly (no loading spinner)
- Data may be stale by up to `max_ttl`
- Background refresh can cause thundering herd if many requests arrive simultaneously during refresh
- Solution: "request coalescing" — only one process refreshes, others wait

HTTP equivalent: `Cache-Control: stale-while-revalidate=300`

```http
Cache-Control: public, max-age=60, stale-while-revalidate=300
# Serve up to 60s fresh, then up to 300s stale while revalidating
```

> **Think**: Does SWR work for bank balances? What about dashboards?
>
> *Answer: Bank balances: terrible. SWR could show yesterday's balance — unacceptable. Dashboards: excellent. Showing 5-minute-old analytics is fine; showing nothing while data loads is worse. SWR prioritizes availability and latency over freshness — choose based on data criticality.*

---

### Cache Tags: Apollo CacheControl & Beyond

Apollo's `@cacheControl` directive annotates the schema to guide caching:

```graphql
directive @cacheControl(
  maxAge: Int
  scope: CACHE_SCOPE  # PRIVATE | PUBLIC
  inheritMaxAge: Boolean
) on FIELD_DEFINITION | OBJECT | INTERFACE | UNION

type User @cacheControl(maxAge: 300) {
  id: ID!
  name: String!
  posts: [Post!]! @cacheControl(inheritMaxAge: true)
}

type StockPrice @cacheControl(maxAge: 5) {
  symbol: String!
  price: Float!
}
```

Cache tags extend this by assigning arbitrary labels to response entries:

```python
# On response, server attaches cache tags
response.extensions = {
    "cacheControl": {
        "version": 1,
        "hints": [
            {"path": ["user"], "maxAge": 300, "scope": "PRIVATE"},
            {"path": ["user", "posts"], "maxAge": 300, "tags": ["user:42", "post:*"]},
        ]
    }
}

# Cache middleware uses tags to build invalidation key
response_tags = extract_tags(response)
cache.store(request.cache_key, response, tags=response_tags)
```

Custom tag implementations:
- **Field-level tags**: `tag:User:1`, `tag:Post:42`
- **Type-level tags**: `tag:type:User`, `tag:type:StockPrice`
- **Role-level tags**: `tag:role:ADMIN` (invalidate admin-only data)

```python
# Mutation resolver that computes affected tags
def resolve_updatePost(parent, args, context):
    post = db.update_post(args.id, args.input)
    # Compute affected tags
    tags = [
        f"Post:{args.id}",
        f"User:{post.author_id}",
    ]
    if post.status == "PUBLISHED":
        tags.append("Feed:published")
    # Send invalidation signal
    cache.invalidate_tags(tags)
    return post
```

> **Think**: What granularity of cache tags makes sense — per-field, per-row, per-type?
>
> *Answer: Depends on data volatility and cache entry size. Per-type (invalidate all User entries on any user change): simple but wasteful — one user edit drops all user cache. Per-row (tag:User:42): precise invalidation but more tags to manage. Per-field: too many tags, overhead negates cache benefit. Per-row per-type is the sweet spot for most GraphQL APIs.*

---

### Real-Time Invalidation via Subscriptions

GraphQL subscriptions can propagate invalidation events in real-time:

```graphql
type Subscription {
  cacheInvalidation(types: [String!]): CacheInvalidationEvent!
}

type CacheInvalidationEvent {
  type: String!
  id: ID!
  timestamp: Float!
  mutation: String!
}
```

Client subscribes:
```graphql
subscription {
  cacheInvalidation(types: ["User", "Post"]) {
    type
    id
    mutation
  }
}
```

When mutation occurs, server publishes to subscription, client evicts affected cache entries:

```python
# Server sends invalidation via subscription
def publish_invalidation(type_name, entity_id):
    context.pubsub.publish("cacheInvalidation", {
        "cacheInvalidation": {
            "type": type_name,
            "id": entity_id,
            "timestamp": time.time(),
            "mutation": "updateUser"
        }
    })
```

This is especially useful for:
- **Client-side normalized caches** (Apollo Client, URQL): client can evict specific entities
- **Real-time dashboards**: cache clears when relevant data changes
- **Multi-tab synchronization**: update all open tabs when mutation occurs

> **Think**: Why not use subscriptions exclusively for cache invalidation, removing need for server-side invalidation logic?
>
> *Answer: Subscriptions require WebSocket connections — not all clients maintain them (mobile apps, server-to-server). Also, subscription-based invalidation doesn't help the server-side cache itself (other server instances, CDN). Subscriptions complement but don't replace server-side invalidation.*

---

### Cache Warming: Pre-Compute + Populate

Proactive invalidation alternative: warm caches before users request stale data.

**Strategy: Pre-compute on data change**
```python
def after_user_update(user_id):
    # Pre-compute and cache the most common queries containing this user
    popular_queries = ANALYTICS.get_popular_queries_for_user(user_id)
    for query in popular_queries:
        result = execute_graphql(query)
        cache_key = build_cache_key(query)
        cache.setex(cache_key, TTL, result)
```

**Strategy: Compute on deploy / schedule**
```python
# Every hour, warm the top 100 queries
def warm_top_queries():
    queries = ANALYTICS.top_queries(limit=100)
    for query, variables_list in queries:
        for vars in variables_list:
            result = execute(query, variables=vars)
            store_in_cache(query, vars, result)
```

Warming vs passive caching:
| Aspect | Passive (demand-driven) | Proactive (warmer) |
|--------|------------------------|-------------------|
| First request latency | High (cache miss) | Low (pre-warmed) |
| Compute efficiency | Only what's requested | May compute unused data |
| Freshness | Depends on TTL | Can refresh on data change |
| Complexity | Low | High (needs analytics + scheduler) |

> **Think**: When is cache warming a net negative?
>
> *Answer: When warming compute cost exceeds the latency saved. If a query costs 1ms but warming it costs 100ms and it's only requested once per hour, warming adds 100ms overhead for 1ms benefit. Also, warming evicts hot data when cache is at capacity. Warm selectively: measure first-request latency, only warm queries above a latency threshold.*

---

### Invalidation Strategy Comparison

> ```mermaid
> graph TD
>     subgraph Invalidation Strategies
>         TTL[TTL-Based]
>         WEB[Webhook-Based]
>         PUB[Pub/Sub]
>         SUB[Subscription]
>         WARM[Cache Warming]
>         SWR[Stale-While-Revalidate]
>     end
>     
>     subgraph Freshness
>         TTL --> LOW[Low-Medium Freshness]
>         WEB --> HIGH[High Freshness]
>         PUB --> HIGH
>         SUB --> HIGH
>         WARM --> MED[Medium Freshness]
>         SWR --> LOW_MED[Low-Medium Freshness]
>     end
>     
>     subgraph Complexity
>         TTL --> SIMPLE[Low]
>         WEB --> MED_C[Medium-High]
>         PUB --> MED_C
>         SUB --> HIGH_C[High]
>         WARM --> MED_C
>         SWR --> LOW_C[Low-Medium]
>     end
>     
>     subgraph When to Use
>         TTL --> STATIC[Static / reference data]
>         WEB --> CRITICAL[Critical data need immediate refresh]
>         PUB --> DISTRIBUTED[Distributed fleet, many services]
>         SUB --> CLIENT[Client-side cache sync]
>         WARM --> COLD_START[Prevent cold-start latency]
>         SWR --> AVAIL[Availability > freshness]
>     end
> ```

---

### Why This Matters

Cache invalidation is the hardest problem in GraphQL caching — harder than cache key design, harder than choosing a cache backend. Get invalidation wrong and users see stale data silently; get it slightly wrong and every mutation invalidates the entire cache (cache stampede). Production GraphQL APIs combine multiple strategies: TTL as safety net, webhooks for critical path, pub/sub for decoupled invalidation, SWR for the latency-sensitive path. No single strategy suffices.

---

## Examples

### Example 1: Multi-Strategy Invalidation

```python
class CacheManager:
    def __init__(self):
        self.redis = Redis()
        self.ttl_by_type = {"User": 300, "Post": 60, "StockPrice": 5}
    
    def get(self, key, query_type):
        # Try cache first
        cached = self.redis.get(key)
        if cached:
            return self._handle_swr(key, cached, query_type)
        return None
    
    def _handle_swr(self, key, cached, query_type):
        entry = json.loads(cached)
        age = time.time() - entry["cached_at"]
        max_age = self.ttl_by_type.get(query_type, 60)
        stale_age = max_age * 2  # SWR window = 2x TTL
        
        if age < max_age:
            return entry["data"]  # Fresh
        elif age < stale_age:
            asyncio.create_task(self._refresh(key, query_type))
            return entry["data"]  # Stale, returning while refreshing
        else:
            return None  # Too stale, caller must refresh
    
    def invalidate(self, tags):
        """Called by mutation resolvers via pub/sub listener"""
        for tag in tags:
            pattern = f"tag:{tag}:*"
            for key in self.redis.scan_iter(pattern):
                self.redis.delete(key)
    
    def store(self, key, data, tags, query_type):
        max_age = self.ttl_by_type.get(query_type, 60)
        entry = {"data": data, "cached_at": time.time(), "tags": tags}
        self.redis.setex(key, max_age * 3, json.dumps(entry))
        for tag in tags:
            self.redis.sadd(f"tag:{tag}", key)
```

---

### Example 2: Postgres NOTIFY + Redis Listener

```python
# Database layer — triggers on row change
# (SQL trigger from earlier content)

# Application listener — separate thread
import threading

def cache_listener():
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cursor = conn.cursor()
    cursor.execute("LISTEN cache_invalidation;")
    
    while True:
        conn.poll()
        while conn.notifies:
            notification = conn.notifies.pop(0)
            payload = json.loads(notification.payload)
            # payload: {"table": "users", "id": 42}
            tag = f"{payload['table']}:{payload['id']}"
            redis_client.delete_by_tag(tag)
        
        select.select([conn], [], [], 1)

# Start in background
threading.Thread(target=cache_listener, daemon=True).start()
```

---

## Key Takeaways
- GraphQL invalidation is harder than REST due to 1:n mapping between mutations and affected cache keys
- TTL is the universal safety net — combine with other strategies, never rely on TTL alone
- Webhooks provide immediate push-based invalidation but need retry logic for reliability
- Pub/Sub decouples mutation logic from cache infrastructure; Redis Pub/Sub and Postgres LISTEN/NOTIFY are common choices
- Stale-while-revalidate prioritizes availability over freshness — ideal for latency-sensitive read-heavy APIs
- Cache tags (Apollo CacheControl or custom) associate cache entries with domain entities for targeted invalidation
- Cache warming prevents cold-start spikes but must be data-driven to avoid waste

---

## Common Misconception

**"Set a short TTL and skip invalidation logic entirely."**

Wrong. Short TTLs reduce the stale window but don't eliminate it. A 5-second TTL on user profiles means a user who updates their name waits up to 5 seconds for other users to see the change. Worse: if a cache entry takes 200ms to recompute and you have 1000 req/s, every 5 seconds all 1000 requests miss simultaneously — cache stampede. Invalidation is not optional; it's a requirement for correctness and a necessity for performance under load.

---

## Feynman Explain

Explain cache invalidation in GraphQL to a backend engineer who understands REST caching. Focus on: why GraphQL's data graph makes 1:1 key invalidation impossible, how tag-based invalidation works (without Apollo), and why TTL alone is insufficient. Max 3 sentences per concept.

*When ready, say explanation aloud or write it down. Then run `learn.sh explain graphql-deep-dive 12` — AI will probe your explanation for gaps.*

---

## Reframe

Critique: "Cache invalidation is one of the two hard things in computer science" — and GraphQL makes it harder. Is it worth the complexity? When would a simpler REST API with straightforward cache invalidation be preferable to a GraphQL API requiring multi-strategy invalidation? What caching complexity threshold justifies choosing REST over GraphQL?

---

## Drill

Take the quiz. MCQs test invalidation strategies, tradeoffs, and failure modes.

Run: `learn.sh quiz graphql-deep-dive 12`
