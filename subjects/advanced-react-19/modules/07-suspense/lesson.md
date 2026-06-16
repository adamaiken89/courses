# Module 7: Suspense Unleashed — Data Fetching, Streaming SSR, Boundaries

Est. study time: 2.5h
Language: en

## Learning Objectives
- Architect Suspense boundaries at correct granularity for streaming SSR and client rendering
- Implement data fetching with Suspense integration using `use()` and Server Components
- Control streaming SSR fallback behavior using Suspense boundaries
- Handle error recovery with Suspense + ErrorBoundary composition

---

## Core Content

### Suspense Mental Model: Not a Loader

Suspense is not a loading spinner API. Suspense is a **rendering orchestration boundary** that tells React: "This part of the tree is not ready yet. Don't commit it. Show fallback. When ready, replace."

Key insight: Suspense decouples **what to show** from **when data is ready**. Without Suspense, a component fetches data and either shows loading (component-managed) or doesn't render at all (parent-managed). With Suspense, React manages the lifecycle:

```
Without Suspense:
  Parent fetches data → checks loading → renders child → child fetches → checks loading
  N waterfall, N loading spinners to manage

With Suspense:
  <Suspense fallback={<Skeleton />}>
    <DataComponent />  {/* throws promise internally */}
  </Suspense>
  DataComponent tells React "I'm loading" → React shows fallback
  Data ready → React replaces fallback with component
```

> **Think**: If Suspense doesn't show a loading spinner, what purpose does the fallback serve? When might you pass null as fallback?
>
> *Answer: Fallback is placeholder content shown during loading. null means "render nothing until ready" — useful when sudden content shift is worse than blank space. Examples: below-fold content, analytics panels, non-critical recommendations. The fallback is a design choice, not a technical requirement.*

### Suspense + use() for Data Fetching

In React 19, `use()` can read a promise directly in render. React suspends the component until the promise resolves.

```typescript
import { Suspense, use } from 'react'

// 1. Define a data source — can be module-level for deduplication
const userPromise = fetch('/api/user').then(res => res.json()) as Promise<User>

function UserProfile() {
  // use() reads the promise in render
  // If pending: React suspends this component (shows nearest Suspense fallback)
  // If resolved: returns the value
  // If rejected: throws the error (caught by nearest ErrorBoundary)
  const user = use(userPromise)

  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  )
}

function App() {
  return (
    <Suspense fallback={<div className="skeleton" />}>
      <UserProfile />
    </Suspense>
  )
}
```

> **Think**: What happens if you use use(promise) inside a useEffect? Inside a click handler?
>
> *Answer: use() only works in render. Inside useEffect or event handlers, use() throws. use() is a Render-as-You-Fetch primitive — it reads data during rendering. For event-driven fetching (click to load), use Actions or transition-based data loading.*

### Cache() for Promise Deduplication

In React 19, `cache()` provides request-scoped promise deduplication:

```typescript
import { cache, use } from 'react'
import { Suspense } from 'react'

// cache() wraps an async function
// Concurrent calls with same arguments share one promise
const getUser = cache(async (id: string): Promise<User> => {
  const res = await fetch(`/api/users/${id}`)
  if (!res.ok) throw new Error('User not found')
  return res.json()
})

function UserProfile({ userId }: { userId: string }) {
  const user = use(getUser(userId))
  return <h2>{user.name}</h2>
}

function UserPosts({ userId }: { userId: string }) {
  const user = use(getUser(userId))  // Same cache hit — no extra fetch
  return <p>{user.posts.length} posts</p>
}

function ProfilePage({ userId }: { userId: string }) {
  return (
    <Suspense fallback={<Skeleton />}>
      <UserProfile userId={userId} />
      <Suspense fallback={<PostsSkeleton />}>
        <UserPosts userId={userId} />
      </Suspense>
    </Suspense>
  )
}
```

`cache()` behavior:
- Keyed by arguments (shallow comparison)
- One promise per unique argument set — concurrent calls share it
- Promise lives for lifetime of the cache entry (until garbage collected)
- In Server Components, scoped to the request — no cross-request leak
- In Client Components, persists across renders — manual invalidation needed

> **Think**: User navigates from /users/1 to /users/2, then back to /users/1. Does getUser('1') cache the result?
>
> *Answer: Yes. cache() returns the cached promise as long as the module lives. For Client Components, this is the page lifetime — navigating back to userId=1 hits the cache without a refetch. To force refetch, invalidate via router refresh or update a key in the cache call. For Server Components, each request has a fresh cache.*

### Streaming SSR with Suspense Boundaries

React 19 Server Components stream HTML incrementally. Each Suspense boundary becomes a streaming chunk:

```html
<!-- Initial HTML includes shell (navigation, header, footer) -->
<main>
  <nav>...</nav>
  <header>...</header>

  <!-- ProductList is a Suspense boundary → placeholder injected -->
  <template id="B:0">Loading products...</template>

  <footer>...</footer>
</main>

<!-- When ProductList data resolves, React streams its HTML -->
<div hidden id="B:0" style="display:none"></div>
<div>
  <div class="product-card">Product 1</div>
  <div class="product-card">Product 2</div>
</div>
```

Streaming means:
- TTFB (Time To First Byte) is fast — shell sent immediately
- Content appears progressively — each Suspense boundary resolves independently
- User sees content as it arrives, not after all data loaded
- SEO-critical content can be in early boundaries

```typescript
import { Suspense } from 'react'

async function ProductList() {
  // This component is a Server Component reading data with async/await
  const products = await db.products.findMany()
  return (
    <div className="product-grid">
      {products.map(p => <ProductCard key={p.id} product={p} />)}
    </div>
  )
}

function Page() {
  return (
    <div>
      {/* Streaming starts with this shell */}
      <Header />
      <Sidebar />

      {/* ProductList is a streaming chunk — rendered when data ready */}
      <Suspense fallback={<ProductGridSkeleton />}>
        <ProductList />
      </Suspense>

      {/* Footer streams with shell since it has no Suspense boundary */}
      <Footer />
    </div>
  )
}
```

> **Think**: Where should you place Suspense boundaries for best perceived performance?
>
> *Answer: Above the fold: no Suspense (render inline) or use minimal fallback. Content below fold: Suspense with skeleton matching final layout size. Critical content: tight boundary (one component per Suspense). Non-critical: wide boundary (group several components) so they stream together. The number of boundaries affects streaming granularity — more boundaries = more chunks but more overhead.*

### Suspense + Transition: Fallback Suppression

React 19 suppresses Suspense fallback during transitions. If data refreshes inside a transition, React keeps old content visible instead of showing a fallback:

```typescript
import { useState, useTransition, Suspense } from 'react'

function SearchPage() {
  const [query, setQuery] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSearch(nextQuery: string) {
    setQuery(nextQuery)  // urgent: update input immediately
    startTransition(() => {
      // Transition: refresh search results
      // If SearchResults suspends, React does NOT show fallback
      // Instead, it keeps showing old results until new ones are ready
    })
  }

  return (
    <div>
      <input
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
      />
      <Suspense fallback={<SearchSkeleton />}>
        <SearchResults query={query} />
      </Suspense>
    </div>
  )
}
```

Without transition: every keystroke would show the fallback (flashing skeleton). With transition: old results stay visible, React swaps them when new results resolve.

> **Think**: What UI cue tells the user that new content is loading during a transition?
>
> *Answer: React doesn't show anything by default. You must use `isPending` from `useTransition` to show a subtle indicator: spinner in search bar, dimmed overlay, progress bar. Without this, the UI appears frozen until new content streams in. Example: Google Search shows a thin loading bar at top during search while keeping old results.*

### ErrorBoundary + Suspense Composition

Errors in Suspense-wrapped components are caught by the nearest `ErrorBoundary`. Combine both for resilient UIs:

```typescript
import { Component, Suspense } from 'react'

class ErrorBoundary extends Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

function ResilientPage() {
  return (
    <div>
      <Header />
      <ErrorBoundary fallback={<ErrorCard message="Failed to load products" />}>
        <Suspense fallback={<ProductGridSkeleton />}>
          <ProductList />
        </Suspense>
      </ErrorBoundary>
      <ErrorBoundary fallback={<p>Failed to load sidebar</p>}>
        <Suspense fallback={<SidebarSkeleton />}>
          <Sidebar />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}
```

Nesting rules:
- **ErrorBoundary outside Suspense**: catches errors from the suspended component and the fallback
- **Suspense outside ErrorBoundary**: Suspense retries after error (component resumes showing fallback)
- **Multiple ErrorBoundaries per Suspense**: each boundary independently recovers

Recovery after error:
```typescript
function RetryOnError({ children }: { children: React.ReactNode }) {
  const [key, setKey] = useState(0)

  return (
    <ErrorBoundary
      fallback={
        <div>
          <p>Something went wrong</p>
          <button onClick={() => setKey(k => k + 1)}>Retry</button>
        </div>
      }
      key={key}
    >
      {children}
    </ErrorBoundary>
  )
}
```

> **Think**: An API endpoint returns 500. Should Suspense catch this error and show the fallback, or should ErrorBoundary handle it?
>
> *Answer: ErrorBoundary handles it. Suspense only handles pending promises. A rejected promise (500 error) propagates as an exception. Suspense does not catch exceptions — ErrorBoundary does. Pattern: ErrorBoundary wraps Suspense. Suspense shows loading; ErrorBoundary shows error.*

### Suspense Boundary Granularity

| Granularity | Pros | Cons | Use case |
|-------------|------|------|----------|
| One boundary for entire page | Simple, one stream chunk | Everything blocks on slowest data | Static pages, mostly cached |
| Boundary per section | Independent loading, perceived perf | More complexity, multiple skeletons | Dashboards, product pages |
| Boundary per component | Maximum streaming granularity | Many small chunks, overhead | Critical data dependencies |
| Nested boundaries | Prioritized loading order | Deep tree complexity | Nested layouts, drill-downs |

Recommendation: start with section-level boundaries. Profile. Add granularity where slow sections block fast ones.

---

### Why This Matters

Suspense in React 19 is the backbone of both streaming SSR and concurrent rendering. It changes how every component handles loading: instead of `isLoading` flags in every component, Suspense boundaries manage the loading lifecycle centrally. This eliminates loading state bugs (forgotten loading check, flickering spinners, race conditions) and enables progressive HTML streaming that cuts TTFB by 40-60%. Without Suspense mastery, React 19 applications will have suboptimal loading UX, waterfall data fetching, and poor streaming performance.

---

### Common Questions

**Q: Can I use Suspense with existing data fetching libraries (React Query, SWR)?**
A: Yes as of React 19. Libraries with Suspense support can throw promises from use hooks. React Query has `suspense: true` option. SWR has `suspense: true`. However, `use()` + `cache()` is the React-19-native approach without library dependencies.

**Q: How many Suspense boundaries is too many?**
A: There is no hard limit. Each boundary adds ~500 bytes to the stream (opening/closing template tags). The practical limit is developer cognitive load — each boundary is a loading state to design. Start with 3-5 per page, profile, add where streaming waterfall is visible.

**Q: Does Suspense work with Server Components without `'use client'`?**
A: Yes. Server Components can use `async/await` directly (no `use()` needed). Wrap them in Suspense boundaries in the parent component (which may be a Server Component too). The client handles the streaming.

**Q: How do I handle optimistic updates with Suspense?**
A: Use `useOptimistic` inside the transition. The transition keeps the old Suspense content visible (no fallback flash). The optimistic update shows instant UI changes. Both together prevent any loading/flickering during data mutations.

**Q: What happens if a Suspense boundary's fallback is null and the data takes 10 seconds?**
A: Nothing renders in that region for 10 seconds. The user sees blank space. This is acceptable for below-fold content but poor UX for primary content. Always provide a meaningful fallback (skeleton, spinner, shimmer) for above-fold content.

---

## Examples

### Example 1: Dashboard with Streaming Sections

```typescript
import { Suspense } from 'react'

async function RevenueChart() {
  const data = await fetchRevenue()  // ~3s
  return <Chart data={data} />
}

async function RecentOrders() {
  const orders = await fetchOrders()  // ~1s
  return <OrderList orders={orders} />
}

async function TopProducts() {
  const products = await fetchTopProducts()  // ~2s
  return <ProductTable products={products} />
}

async function UserMetrics() {
  const metrics = await fetchMetrics()  // ~500ms
  return <MetricsCards metrics={metrics} />
}

function Dashboard() {
  return (
    <div className="dashboard">
      <h1>Dashboard</h1>

      {/* Fastest data streams first — appears in ~500ms */}
      <Suspense fallback={<MetricsSkeleton />}>
        <UserMetrics />
      </Suspense>

      {/* Orders appear next at ~1s */}
      <Suspense fallback={<OrdersSkeleton />}>
        <RecentOrders />
      </Suspense>

      {/* Products at ~2s */}
      <Suspense fallback={<ProductSkeleton />}>
        <TopProducts />
      </Suspense>

      {/* Chart last at ~3s */}
      <Suspense fallback={<ChartSkeleton />}>
        <RevenueChart />
      </Suspense>
    </div>
  )
}
```

**Streaming behavior**: User sees metrics cards at 500ms, orders at 1s, products at 2s, chart at 3s. Without Suspense streaming: blank page until 3s (all data loaded).

### Example 2: Search with Transition + Suspense

```typescript
'use client'

import { useState, useTransition, Suspense, cache, use } from 'react'

const searchProducts = cache(async (query: string): Promise<Product[]> => {
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error('Search failed')
  return res.json()
})

function SearchResults({ query }: { query: string }) {
  const products = use(searchProducts(query))

  return (
    <ul>
      {products.map(p => (
        <li key={p.id}>{p.name} — ${p.price}</li>
      ))}
    </ul>
  )
}

function SearchPage() {
  const [query, setQuery] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value
    setQuery(next)  // urgent: update input immediately

    startTransition(() => {
      // Transition: this updates the query prop passed to SearchResults
      // React will NOT show Suspense fallback — old results stay visible
    })
  }

  return (
    <div>
      <input
        value={query}
        onChange={handleChange}
        placeholder="Search products..."
      />
      {isPending && <div className="search-spinner" />}
      <Suspense fallback={<div>Loading results...</div>}>
        <SearchResults query={query} />
      </Suspense>
    </div>
  )
}
```

### Example 3: Nested Suspense for Progressive Loading

```typescript
async function ProductPage({ id }: { id: string }) {
  const product = await getProduct(id)  // 500ms

  return (
    <div>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      <p className="price">${product.price}</p>

      {/* Reviews load independently — don't block product info */}
      <Suspense fallback={<ReviewsSkeleton />}>
        <Reviews productId={id} />
      </Suspense>

      {/* Recommendations can take even longer */}
      <Suspense fallback={<RecommendationsSkeleton />}>
        <Recommendations productId={id} />
      </Suspense>
    </div>
  )
}
```

Streaming order: product info at 500ms → reviews stream later → recommendations last. Each nested Suspense boundary resolves independently regardless of nesting depth.

---

## Key Takeaways
- Suspense is rendering orchestration, not a loading spinner. It manages component readiness.
- `use()` reads promises and context in render. Component suspends until promise resolves.
- `cache()` deduplicates concurrent promise calls with same arguments.
- Streaming SSR sends Suspense boundaries as independent HTML chunks — fast TTFB, progressive content.
- Transitions suppress Suspense fallback — old content stays visible during data refresh.
- ErrorBoundary catches rejected promises (errors) from Suspense-wrapped components.
- Boundary granularity is a design decision: section-level for simplicity, component-level for fine-grained streaming.
- Nested Suspense boundaries each stream independently.
- Always provide meaningful fallbacks for above-fold content. null fallback OK for below-fold.

## Common Misconception

**"Suspense replaces all data fetching patterns."**

Suspense changes how data fetching integrates with rendering, but it does not replace data fetching itself. You still need to decide: Server Components vs client-side fetch, cache invalidation strategy, optimistic updates, error handling, refetch triggers. Suspense handles the "wait for data" state, not the "get data" part. Server Components + async/await is one approach. Client-side `use()` + `cache()` is another. External libraries (React Query, SWR) add cache management, refetching, and invalidation that Suspense alone does not provide.

---

## Feynman Explain
(Explain Suspense to a designer who understands loading states but not rendering. Describe what "suspending" means, how streaming works like a page loading image by image, and why transitions keep old content visible. Use web-comic analogy: panels load one by one but the first panel showed immediately.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain` — AI probes gaps.*

---

## Reframe
(Pause. Critique: Suspense boundaries add complexity — skeleton components, streaming markup, error boundary nesting. For an internal admin tool with fast API responses (<200ms), is Suspense worth the overhead? Write your evaluation. Consider: developer time, bundle size impact, and actual user-perceived performance gains for a latency-tolerant audience.)

---

## Drill
Take the quiz. MCQs test Suspense principles, streaming behavior, transition suppression, and error handling.

Run: `learn.sh quiz advanced-react-19 07-suspense`
