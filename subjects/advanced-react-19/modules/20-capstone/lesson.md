# Module 20: Capstone — Production React 19 Application Architecture

Est. study time: 3h
Language: en

## Learning Objectives
- Design complete production architecture combining React 19 Server Components, Actions, Transitions, Compiler, and Suspense
- Make architectural decisions via ADR: RSC vs Client Components, state ownership, data flow, routing strategy
- Implement performance budget with streaming targets and measurable thresholds
- Build testing and deployment strategy for RSC-based applications

---

## Core Content

### Full Application Architecture — Combining All React 19 Features

A production React 19 application is not one thing — it is a layered system where each React 19 feature owns a specific concern. The architecture follows a clear hierarchy:

```
Layer 1 (Route shell):    Layout components, Suspense boundaries, Error boundaries
Layer 2 (Data origin):    Server Components, Server Actions, `use()`
Layer 3 (Interactive UI): Client Components, hooks, Transitions
Layer 4 (Client state):   Zustand store (cross-cutting), URL state, form state
Layer 5 (Optimistic):     useOptimistic, useActionState for instant feedback
Layer 6 (Compiler):       Auto-memoization applied across entire component tree
```

Each layer has distinct rendering environment, state source, and failure mode:

| Layer | Environment | State source | Failure mode |
|-------|-------------|-------------|-------------|
| Route shell | RSC + Client | URL params, layout data | ErrorBoundary per segment |
| Data origin | RSC only | DB, API, cache | Parent Suspense boundary |
| Interactive UI | Client only | useState, useReducer | Local error fallback |
| Client state | Client only | Zustand store | Hydration mismatch handled |
| Optimistic | Client only | useOptimistic | Action error reverts |
| Compiler | Both | N/A (build-time) | Build error, per module rollback |

> **Think**: A user reports seeing a blank white screen on a product page. The RSC fetch for product data fails. No error boundary rendered. Why?
>
> *Answer: RSC fetch failure rejects the RSC payload. If no Suspense boundary wraps the product section, React cannot show fallback — the server render fails altogether. Architecture rule: every async RSC fetch must have a wrapping Suspense boundary with a client-component fallback. Without it, failure becomes a blank screen.*

### Architecture Decision Record: RSC vs Client Components

Every component starts as RSC. Convert to Client Component only when one of these conditions is met:

**ADR Record: Component Environment Decision**

Decision: Default to RSC. Use Client Component `"use client"` only for specific needs.

| Condition | Decision | Rationale |
|-----------|----------|-----------|
| Uses hooks (useState, useEffect, useCallback, etc.) | Client | Hooks require client runtime |
| Uses browser APIs (window, document, localStorage) | Client | Server has no browser |
| Needs event handlers (onClick, onSubmit, onChange) | Client | Events need client runtime |
| Needs interactivity (state, context mutation) | Client | Interactive state lives on client |
| Renders static content from server data | RSC | No JS sent to client |
| Composes other RSCs | RSC | Keeps render tree on server |
| Formats dates/numbers with locale | RSC | Server handles formatting, sends text |
| Contains heavy markdown rendering | RSC | Render on server, ship HTML |
| Needs `useActionState` or `useOptimistic` | Client | Form hooks are client hooks |
| Is a layout shell with navigation | RSC | Layout data fetched server-side |

Example decision tree:

```typescript
// RSC — no interactivity, pure data rendering
// app/products/page.tsx
async function ProductsPage() {
  const products = await db.query('SELECT * FROM products LIMIT 20')
  return <ProductList products={products} />
}

// Client — needs onClick and state
// app/products/_components/ProductList.tsx
'use client'
function ProductList({ products }: { products: Product[] }) {
  const [sort, setSort] = useState<'price' | 'name'>('price')
  const sorted = [...products].sort(/* ... */)
  return (
    <div>
      <button onClick={() => setSort('price')}>Sort by Price</button>
      <button onClick={() => setSort('name')}>Sort by Name</button>
      {sorted.map(p => <ProductCard key={p.id} product={p} />)}
    </div>
  )
}
```

> **Think**: A dashboard component fetches user list (RSC), then renders a table with inline row editing. Does the table need to be a Client Component?
>
> *Answer: Yes. Inline row editing requires state (edit mode per row), onChange handlers (inputs), and onClick handlers (save/cancel). The entire table component should be `'use client'`. The parent RSC fetches data and passes it as props to the client table. The boundary is clear: data fetching in RSC, interactivity in Client Component.*

### Data Flow Design: RSC → Actions → Zustand

Three data flow patterns cover every scenario in a production app:

**Pattern 1: Server Components for initial data**

RSC fetches data at request time, renders HTML + RSC payload, sends minimal JS to client.

```typescript
// app/orders/page.tsx — RSC
async function OrdersPage() {
  const orders = await db.query(`
    SELECT o.*, u.name FROM orders o
    JOIN users u ON u.id = o.user_id
    WHERE o.status = 'active'
    ORDER BY o.created_at DESC
    LIMIT 50
  `)
  return <OrderList orders={orders} />
}
```

Rules:
- Fetch as deep in the tree as possible — closer to the consuming component.
- Never pass fetch results through multiple RSC layers just to reach a leaf client component.
- Use `cache()` or React's `fetch` dedup for shared data across RSCs.

**Pattern 2: Actions for mutations**

Server Actions handle all writes. `useActionState` wraps pending/error/success.

```typescript
// app/orders/_actions.ts
'use server'
export async function cancelOrder(orderId: string, reason: string) {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')

  // Server validates
  const order = await db.query('SELECT status FROM orders WHERE id = $1', [orderId])
  if (order.status === 'shipped') {
    return { error: 'Cannot cancel shipped orders' }
  }

  await db.query('UPDATE orders SET status = $1, cancel_reason = $2 WHERE id = $3',
    ['cancelled', reason, orderId])

  revalidatePath('/orders')
  return { success: true }
}

// app/orders/_components/CancelOrderForm.tsx
'use client'
import { useActionState } from 'react'
import { cancelOrder } from '../_actions'

function CancelOrderForm({ orderId }: { orderId: string }) {
  const [state, formAction, pending] = useActionState(
    cancelOrder.bind(null, orderId),
    { error: null, success: false }
  )

  return (
    <form action={formAction}>
      <textarea name="reason" required disabled={pending} />
      {state.error && <p className="error">{state.error}</p>}
      {state.success && <p className="success">Order cancelled</p>}
      <button type="submit" disabled={pending}>
        {pending ? 'Cancelling...' : 'Cancel Order'}
      </button>
    </form>
  )
}
```

**Pattern 3: Zustand for cross-cutting client state**

Zustand handles state that spans multiple routes or client components but does not come from server.

```typescript
// app/_store/cart.ts
import { create } from 'zustand'

interface CartStore {
  items: CartItem[]
  isOpen: boolean
  addItem: (item: CartItem) => void
  removeItem: (id: string) => void
  toggle: () => void
}

export const useCartStore = create<CartStore>((set) => ({
  items: [],
  isOpen: false,
  addItem: (item) => set((s) => ({ items: [...s.items, item] })),
  removeItem: (id) => set((s) => ({ items: s.items.filter(i => i.id !== id) })),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
}))
```

What goes in Zustand:
- UI state shared across routes: cart drawer, notification count, theme
- Real-time data: WebSocket-driven state, presence indicators
- Complex derived state: multi-step form wizard progress

What does NOT go in Zustand:
- Server-owned data (keep in RSC, revalidate on mutation)
- Form field state (useActionState or local component state)
- URL state (use router — it belongs in the address bar)

> **Think**: A user adds item to cart via Server Action. Cart count in header must show updated value. Cart count is in Zustand. What triggers the update?
>
> *Answer: The Server Action returns updated cart count in its response. The client component that called the action receives the response and calls `useCartStore.getState().addItem(newItem)`. Alternative: the action revalidates a server component that renders the cart count, but that creates round-trip latency. For instant UI, use the action response to update the store directly.*

### Route Design: Layouts, Loading Boundaries, Error Boundaries

Route hierarchy determines resilience. Every route segment should define:

```typescript
// app/layout.tsx — Root layout, no loading boundary needed
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <Header />
        <Suspense fallback={<FullPageSkeleton />}>
          {children}
        </Suspense>
        <Footer />
      </body>
    </html>
  )
}

// app/dashboard/layout.tsx — Dashboard layout with loading + error
import { Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <section>
      <DashboardNav />
      <ErrorBoundary FallbackComponent={DashboardErrorFallback}>
        <Suspense fallback={<DashboardSkeleton />}>
          {children}
        </Suspense>
      </ErrorBoundary>
    </section>
  )
}

// app/dashboard/analytics/loading.tsx — Route-level loading
export default function AnalyticsLoading() {
  return <AnalyticsSkeleton />
}

// app/dashboard/analytics/error.tsx — Route-level error
'use client'
export default function AnalyticsError({ error, reset }: {
  error: Error
  reset: () => void
}) {
  return (
    <div role="alert">
      <h2>Analytics failed to load</h2>
      <p>{error.message}</p>
      <button onClick={reset}>Retry</button>
    </div>
  )
}
```

| Boundary | When to place | Behavior |
|----------|--------------|----------|
| Root Suspense | Root layout | Catches all uncaught RSC fetch failures |
| Per-route Suspense | Each segment layout | Isolates slow data per route section |
| Per-route Error | Each `error.tsx` | Catches render errors in that segment |
| Per-component Suspense | Individual server components | Fine-grained streaming for slow components |
| Global Error | `global-error.tsx` | Catches root layout errors (rare) |
| Loading | `loading.tsx` | Shown during RSC fetch for that route segment |

> **Think**: A product page has three sections: header (fast), reviews (slow DB query), recommendations (slow ML service). Reviews failing should not block recommendations. How do you architect the route?
>
> *Answer: Three Suspense boundaries wrapping each section individually. Each Suspense has its own fallback skeleton. Reviews error caught by a wrapping ErrorBoundary that shows "Reviews unavailable" fallback. Recommendations loads independently because it is in a separate Suspense. No section blocks another.*

### Performance Budget

Production React 19 app must meet these thresholds:

| Metric | Target | Measurement | Enforcement |
|--------|--------|-------------|-------------|
| Server render | < 200ms (p95) | `server-timing` header | CI benchmark, fail PR if exceeded |
| Client JS per route | < 100kb gzip | Bundle analyzer | CI check, alert on regression |
| Time To Interactive (TTI) | < 1s (p95) | Lighthouse CI | PR gate at 0.9s threshold |
| First Contentful Paint | < 1s | RUM data | Dashboard alert |
| Streaming first chunk | < 500ms | TTFB + streaming | Server timing metrics |
| Largest Contentful Paint | < 2s | RUM data | Quarterly review |
| Network payload (total) | < 500kb | DevTools | Bundle CI check |

Streaming targets:

```typescript
// app/checkout/page.tsx
export default async function CheckoutPage() {
  return (
    <div>
      {/* Immediate — no async dependency, sent in first RSC chunk */}
      <CheckoutHeader />

      {/* Streamed — fast DB query, arrives before slow sections */}
      <Suspense fallback={<Skeleton width="full" height="60px" />}>
        <ShippingAddress />
      </Suspense>

      {/* Streamed last — slow external API call */}
      <Suspense fallback={<Skeleton width="full" height="200px" />}>
        <RecommendedProducts />
      </Suspense>

      {/* Instant — client component, renders after hydration */}
      <PaymentForm />
    </div>
  )
}
```

Optimization rules:
1. Every async fetch must clarify: does user see content without it? If yes, make it optional via Suspense.
2. Critical content (header, primary action) must be in first RSC chunk — never behind slow fetch.
3. Client Component JS is measured per route. Keep below 100kb gzip by moving heavy rendering to RSC.

> **Think**: Dashboard analytics widget shows a chart rendered client-side with D3 (80kb gzip). It is below the fold on page load but critical for analytics users. Should you move it to RSC?
>
> *Answer: No. Charts are inherently client-side (DOM manipulation, animations). Solution: lazy-load the chart component with `next/dynamic` or `React.lazy`. The 80kb chart JS loads after primary content. Show skeleton during lazy load. For analytics-only pages, route-level code splitting keeps chart JS off non-analytics routes.*

### State Ownership Map

Every piece of state in the app has exactly one owner. The owner determines how it is updated, how long it persists, and where it renders.

| State type | Owner | Where stored | Update mechanism | Scope |
|------------|-------|-------------|------------------|-------|
| Server data | RSC | DB/API, cached in RSC fetch | Server Action → `revalidatePath()` / `revalidateTag()` | Route segment |
| URL params | Next.js router | URL | `<Link>`, router.push, server redirect | Browser history |
| Search params | Next.js router | URL querystring | `useSearchParams`, form submit | Browser history |
| Form state | useActionState | Client component | Server Action returns state | Component tree |
| Optimistic UI | useOptimistic | Client component | Server Action triggered, state auto-reverts | Component tree |
| UI state (tabs, modals, toasts) | Client component | useState / useReducer | Local event handlers | Component or subtree |
| Cross-cutting UI (cart drawer, theme) | Zustand store | Zustand (client memory) | Zustand actions | App-wide |
| Real-time data (presence, chat) | Zustand store | Zustand + WebSocket | WebSocket message → Zustand action | App-wide |
| Form field values | Client component | useState / uncontrolled | onChange / formData | Form subtree |
| Cache (React Query, SWR) | Client cache lib | Memory + cache store | Refetch on focus, mutation invalidation | App-wide |

Decision flow for new state:

```
Is this state from server? → Yes → RSC (fetch in Server Component)
  No → Does it come from a mutation? → Yes → useActionState + useOptimistic
    No → Is it URL-relevant? → Yes → URL params / search params
      No → Is it used by multiple unrelated components? → Yes → Zustand
        No → useState in closest common ancestor
```

> **Think**: A settings page has 20 form fields across 5 sections. User clicks Save once. Where does form field state live? Where does save result state live?
>
> *Answer: Form field values: local useState in each field component (or uncontrolled form elements). No need for Zustand — data is local to the form. Save result state: useActionState. The action processes all 20 fields, returns per-field errors or success status. Zustand would be wrong here — form state is ephemeral, route-specific, and not shared across routes.*

### Form Architecture: useActionState + Validation + Optimistic Updates

Production forms combine three layers:

**Layer 1: Server validation (single source of truth)**

```typescript
// app/checkout/_actions.ts
'use server'
import { z } from 'zod'

const checkoutSchema = z.object({
  email: z.string().email('Invalid email'),
  address: z.string().min(10, 'Address too short'),
  zipCode: z.string().regex(/^\d{5}$/, 'Invalid ZIP'),
  cardNumber: z.string().regex(/^\d{16}$/, 'Invalid card'),
})

export async function submitCheckout(prev: CheckoutState, formData: FormData) {
  const parsed = checkoutSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      values: Object.fromEntries(formData),
    }
  }

  const result = await processPayment(parsed.data)
  if (!result.ok) {
    return { errors: { server: [result.error] }, values: parsed.data }
  }

  revalidatePath('/orders')
  return { success: true, orderId: result.orderId }
}
```

**Layer 2: Client form with useActionState**

```typescript
// app/checkout/_components/CheckoutForm.tsx
'use client'
import { useActionState } from 'react'
import { submitCheckout } from '../_actions'

function CheckoutForm() {
  const [state, formAction, pending] = useActionState(submitCheckout, {
    errors: {}, values: {}, success: false,
  })

  return (
    <form action={formAction}>
      <Field name="email" label="Email" error={state.errors?.email?.[0]}
        defaultValue={state.values?.email} />
      <Field name="address" label="Address" error={state.errors?.address?.[0]}
        defaultValue={state.values?.address} />
      <Field name="zipCode" label="ZIP Code" error={state.errors?.zipCode?.[0]}
        defaultValue={state.values?.zipCode} />
      <Field name="cardNumber" label="Card Number" error={state.errors?.cardNumber?.[0]}
        defaultValue={state.values?.cardNumber} />
      {state.errors?.server && (
        <p className="error">{state.errors.server[0]}</p>
      )}
      <button type="submit" disabled={pending}>
        {pending ? 'Processing...' : 'Place Order'}
      </button>
    </form>
  )
}
```

**Layer 3: Optimistic updates for instant feedback**

```typescript
// app/products/_components/AddToCartButton.tsx
'use client'
import { useOptimistic, useActionState } from 'react'
import { addToCart } from '../_actions'

function AddToCartButton({ productId, currentQty }: {
  productId: string
  currentQty: number
}) {
  const [optimisticQty, addOptimistic] = useOptimistic(
    currentQty,
    (state, increment: number) => state + increment
  )

  const handleSubmit = async (formData: FormData) => {
    addOptimistic(1) // instant UI update
    const result = await addToCart(formData)
    if (result.error) {
      // Revert happens automatically — useOptimistic shows server state
    }
  }

  return (
    <form action={handleSubmit}>
      <input type="hidden" name="productId" value={productId} />
      <button type="submit">Add to Cart ({optimisticQty})</button>
    </form>
  )
}
```

> **Think**: Optimistic update increases cart count instantly. Action fails (out of stock). Cart count reverts. How does user know what happened?
>
> *Answer: The action return value includes error. The component uses `useActionState` return value in addition to useOptimistic. When action fails, show toast notification: "Product out of stock." useOptimistic automatically re-renders with server state (previous count) when action resolves with error. Never rely solely on optimistic revert — always surface the error reason.*

### Testing Strategy

Three testing layers for RSC applications:

**Layer 1: Unit tests for hooks and utilities**

```typescript
// __tests__/useCartStore.test.ts
import { renderHook, act } from '@testing-library/react'
import { useCartStore } from '@/store/cart'

describe('Cart store', () => {
  it('adds item', () => {
    const { result } = renderHook(() => useCartStore())
    act(() => result.current.addItem({ id: '1', name: 'Widget', price: 10 }))
    expect(result.current.items).toHaveLength(1)
  })

  it('toggles cart drawer', () => {
    const { result } = renderHook(() => useCartStore())
    act(() => result.current.toggle())
    expect(result.current.isOpen).toBe(true)
    act(() => result.current.toggle())
    expect(result.current.isOpen).toBe(false)
  })
})
```

**Layer 2: Integration tests for RSC rendering**

Testing Server Components requires a framework-aware test environment:

```typescript
// __tests__/ProductsPage.test.tsx
import { render } from '@testing-library/react'
import ProductsPage from '@/app/products/page'

// Mock server-side dependencies
jest.mock('@/lib/db', () => ({
  query: jest.fn().mockResolvedValue([
    { id: '1', name: 'Widget', price: 10 },
  ]),
}))

it('renders product list', async () => {
  const { findByText } = render(await ProductsPage())
  expect(await findByText('Widget')).toBeInTheDocument()
})
```

Testing Server Actions:

```typescript
// __tests__/cancelOrder.test.ts
import { cancelOrder } from '@/app/orders/_actions'

jest.mock('@/lib/db', () => ({
  query: jest.fn(),
}))

it('rejects cancellation of shipped orders', async () => {
  const db = require('@/lib/db')
  db.query.mockResolvedValueOnce({ status: 'shipped' })
  const result = await cancelOrder('order-1', 'Changed mind')
  expect(result).toEqual({ error: 'Cannot cancel shipped orders' })
})
```

**Layer 3: E2E with Playwright**

```typescript
// e2e/checkout.spec.ts
import { test, expect } from '@playwright/test'

test('complete checkout flow', async ({ page }) => {
  await page.goto('/products')
  await page.click('[data-testid="add-to-cart-1"]')
  await expect(page.locator('[data-testid="cart-count"]')).toHaveText('1')

  await page.goto('/checkout')
  await page.fill('[name="email"]', 'test@example.com')
  await page.fill('[name="address"]', '123 Main St')
  await page.fill('[name="zipCode"]', '12345')
  await page.fill('[name="cardNumber"]', '4111111111111111')
  await page.click('button[type="submit"]')

  await expect(page.locator('[data-testid="order-confirmation"]')).toBeVisible()
  await expect(page.locator('[data-testid="order-id"]')).not.toBeEmpty()
})

test('shows validation errors', async ({ page }) => {
  await page.goto('/checkout')
  await page.click('button[type="submit"]')
  await expect(page.locator('.error')).toHaveCount(4)
})

test('loading states during slow RSC fetch', async ({ page }) => {
  await page.goto('/dashboard/analytics')
  await expect(page.locator('[data-testid="skeleton"]')).toBeVisible()
  await expect(page.locator('[data-testid="analytics-chart"]')).toBeVisible({ timeout: 10000 })
})
```

Test configuration:

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  webServer: {
    command: 'npm run build && npm run start',
    port: 3000,
    timeout: 120000,
  },
  use: {
    baseURL: 'http://localhost:3000',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
})
```

> **Think**: A Server Action updates a database row and revalidates the parent RSC. The E2E test checks the updated value renders. Sometimes it passes, sometimes it shows stale data. What is happening?
>
> *Answer: Race condition between revalidation and test assertion. `revalidatePath('/orders')` triggers a re-render, but the RSC fetch is async. The test page may render with old data before new fetch completes. Fix: wait for the updated element with `await expect(page.locator(...)).toHaveText(expectedValue)` with retry, or add a test-id that only appears after revalidation.*

### Deployment: RSC-Compatible Hosting

RSC requires a server that can:
- Execute Server Components at request time
- Stream RSC payload and HTML over HTTP
- Handle Server Actions (POST endpoints)
- Execute per-request (no static export for dynamic routes)

| Hosting option | RSC support | Notes |
|---------------|-------------|-------|
| Vercel | Full | Native Next.js support, edge + Node.js runtime, ISR, streaming |
| Node.js (self-hosted) | Full | Express/Fastify custom server, requires proper streaming setup |
| Docker + Node | Full | Containerized self-host, load-balanced, requires sticky sessions? No — RSC is stateless |
| Cloudflare Workers | Partial | Edge runtime limitations: no Node.js APIs, limited DB drivers |
| AWS Lambda | Partial | Cold starts affect RSC latency, 15min timeout, streaming complexity |
| Static export | None | RSC requires dynamic server — static export limited to static RSC |

```typescript
// Dockerfile for self-hosted React 19 app
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
CMD ["npm", "run", "start"]
```

Environment configuration:

```typescript
// app/_lib/env.ts
import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  STRIPE_API_KEY: z.string().startsWith('sk_'),
  SESSION_SECRET: z.string().min(32),
  NODE_ENV: z.enum(['development', 'production', 'test']),
  NEXT_PUBLIC_ANALYTICS_ID: z.string().optional(),
})

export const env = envSchema.parse(process.env)
```

> **Think**: Self-hosted Next.js with RSC. CPU spikes to 90% under load. What is the bottleneck?
>
> *Answer: RSC rendering is CPU-bound — every request serializes JSX to RSC payload. If pages are dynamic (no caching), each request runs full server components. Solutions: (1) enable ISR or `generateStaticParams` for pages that can be static, (2) add Redis cache for RSC payload, (3) horizontally scale Node processes behind load balancer, (4) use React's `cache()` to deduplicate DB calls within request.*

### Migration Guide: Incremental Adoption from Legacy Codebase

Legacy React 18 codebase (Create React App or custom Webpack, client-only, hooks + Redux). Milestones:

**Phase 1: Framework switch (Week 1-2)**
```
Goal: Same app runs in Next.js App Router without visible changes.
1. Adopt Next.js incremental adoption: migrate one route at a time.
2. Keep existing React 18 code in pages/ directory (Pages Router).
3. New app/ directory routes opt into App Router.
4. Shared components must be "use client" during transition.
5. No RSC yet — everything still runs on client.
```

**Phase 2: Co-locate data fetching (Week 3-4)**
```
Goal: Move data fetching from useEffect into Server Components.
1. Identify routes where data is the same for all users (no auth-dependent filters).
2. Convert those routes to RSC, move fetch inside Server Component.
3. Measure: client JS reduction, data fetch latency improvement.
4. Auth-protected routes: keep client-side fetch, defer RSC conversion.
```

**Phase 3: Actions for mutations (Week 5-6)**
```
Goal: Replace API call + Redux dispatch pattern with Server Actions.
1. Identify forms and mutation patterns.
2. Write Server Actions next to route, keep same validation logic.
3. Replace Redux form thunks with useActionState calls.
4. Remove Redux code for form submission — now obsolete.
5. Cart and UI state: migrate from Redux to Zustand (simpler API).
```

**Phase 4: Compiler adoption (Week 7-8)**
```
Goal: Enable React Compiler module by module.
1. Add `// @reactCompiler` to least-critical module first.
2. Test in StrictMode.
3. Run CI with compiler enabled, check for re-render regressions.
4. Enable broadly. Remove manual useMemo/useCallback in touched files.
5. CI should measure bundle size and flag compiler regressions.
```

**Phase 5: Performance optimization (Week 9-10)**
```
Goal: Meet performance budget.
1. Add Suspense boundaries per route segment.
2. Implement streaming for slow data sources.
3. Add loading.tsx and error.tsx to all route groups.
4. Run Lighthouse CI, fix regressions below 1s TTI.
5. Establish performance budget in CI as PR gate.
```

**Phase 6: Cleanup and testing (Week 11-12)**
```
Goal: Remove migration artifacts, E2E coverage, documentation.
1. Remove remaining Redux code and legacy hooks.
2. Add Playwright E2E tests for critical flows.
3. Document architecture decisions in ADR files.
4. Set up monitoring: RUM data, error tracking, server timing.
5. Train team on RSC mental model — workshops.
```

> **Think**: Team of 5 engineers. CEO wants "full migration in 2 weeks." What do you say?
>
> *Answer: Reply: "We can have the app running in Next.js in 2 weeks. Full React 19 adoption (RSC + Actions + Compiler) is 12 weeks." The 2-week delivery keeps business happy. The 12-week plan keeps engineering honest. Wrong move: over-promise and ship buggy partial migration. Right move: incremental phases, measurable progress at each step, no regression in user experience.*

---

### Why This Matters

Capstone module synthesizes every React 19 feature into a coherent architecture. Teams that understand how RSC, Actions, Transitions, Compiler, and state ownership work together ship faster with less code and better performance. Teams that adopt features in isolation create fragmented architecture: RSC without streaming, Actions without optimistic updates, Compiler without performance budget. The 12-week migration pattern has been proven across multiple production codebases. Architecture decision records prevent expensive rework. This module is the blueprint for production React 19.

---

### Common Questions

**Q: Can I use Zustand inside a Server Component?**
A: No. Zustand is a client-side state library. Server Components cannot use hooks. Server state comes from RSC fetch. Zustand is for cross-cutting client state only (cart drawer, theme, real-time data). If you need server-side shared state, use React's `cache()` function or a dedicated cache layer (Redis, Memcached).

**Q: How do I handle authentication with RSC?**
A: Server Components can access cookies and sessions. Fetch auth token in layout or page component, pass to children. Example: `getSession()` called in Server Component, returns user or null. Client Components receive user as prop. Server Actions re-check auth — never trust client claims.

**Q: When should I NOT use Suspense boundaries?**
A: When the component's data is always fast (< 50ms) and the visual cost of showing a fallback exceeds the benefit. Overwrapping with Suspense adds visual jitter — skeleton flashes for 30ms cheap queries. Rule: wrap any RSC fetch that exceeds your render budget (200ms). Skip Suspense for inline cache hits or trivial fetches.

**Q: Do I need React Query or SWR with RSC?**
A: For initial data: no — RSC handles it. For client-side refetching (polling, background refetch on focus): yes, React Query or SWR still useful for interactive client-side caching. RSC handles initial load; client cache handles subsequent updates without full page revalidation.

**Q: What is the biggest mistake teams make migrating to React 19?**
A: Treating RSC as "just server-side rendering." RSC is not SSR — SSR renders HTML on server then hydrates. RSC sends a serialized component tree, integrates with client state, streams, and enables Server Actions. Teams who treat RSC as "faster SSR" miss Actions, streaming, and the component-environment separation.

---

## Examples

### Example 1: E-Commerce Application Architecture

**Problem**: Build a full e-commerce app with product browsing, cart, checkout, order history, and admin dashboard. 100k products, 10k concurrent users. Performance budget: 1s TTI, 100kb JS per route.

**Architecture decisions**:

```
Route structure:
  /products                           → RSC + paginated fetch, streaming
  /products/[id]                      → RSC + Suspense (reviews, recommendations nested)
  /cart                               → Client Component (Zustand-based)
  /checkout                           → RSC + useActionState form
  /orders                             → RSC + streaming order list
  /admin/dashboard                    → Client Component (heavy D3 charts, lazy loaded)

Data flow:
  Product page (RSC): fetch product + 20 reviews + 5 recommendations
    ├─ Main content: streaming — product details first (fast), then reviews (slow), then recs (slowest)
    ├─ Add to cart: useOptimistic + Server Action → updates Zustand cart store
    └─ Cache strategy: RSC cached 60s (ISR), product data revalidated on price change

State ownership:
  Product data    → RSC (DB query)
  Cart            → Zustand (cross-cutting client state)
  Checkout form   → useActionState (form state)
  Search params   → URL (useSearchParams)
  Admin filters   → Zustand (persisted to localStorage)
  Order history   → RSC (DB query, per-user)

Performance:
  Product page JS: 45kb (product card client components, no D3)
  Cart page JS: 25kb (minimal form)
  Checkout page JS: 35kb (form + card input)
  Admin page JS: 120kb (D3 lazy loaded via next/dynamic — allowed on heavy page)
  Server render: 150ms p95 (product details cached, optimized DB queries)
  TTI: 900ms p95 (streaming sends content in 3 chunks, last chunk at 700ms)
```

**Result**: 90% of pages under 100kb JS. TTI under 1s. Cart updates feel instant (optimistic). Checkout errors show per-field validation without page reload.

### Example 2: SaaS Dashboard Migration

**Problem**: SaaS admin dashboard, 50k LOC, current codebase uses Create React App + Redux + React Router. Migration to React 19 with Next.js App Router. Team of 4 engineers. 3-month timeline.

**Migration plan**:

```
Week 1-2: Framework switch
  - Set up Next.js with Pages Router compatibility
  - Move one dashboard section (reports) to app/ directory
  - All components keep "use client" — no architectural change yet
  - Validate: same functionality, same bundle size

Week 3-4: RSC adoption
  - Reports page: fetch data in Server Component instead of useEffect
    Before: useEffect(() => { fetch('/api/reports') }, [])
    After: async function ReportsPage() { const data = await db.query(...) }
  - Client JS for reports: 80kb → 45kb (chart libs remain client-side)
  - Observed TTI improvement: 2.5s → 1.4s

Week 5-6: Actions
  - Report settings form: useActionState + Zod validation
  - Remove: Redux thunk for settings, API route for settings
  - Added: optimistic toggle for "enable notifications" switch

Week 7-8: Compiler
  - Enable React Compiler on reports section
  - Remove 12 useMemo calls from reports components
  - Encounter one issue: compiler mis-optimization with setInterval ref → keep manual ref
  - Rollback compiler on that file, continue with rest

Week 9-10: Boundaries + streaming
  - Add Suspense boundaries per report widget
  - Slow SQL reports stream in independently
  - Fast widgets render immediately
  - ErrorBoundary per widget — one report crash does not take down dashboard

Week 11-12: Testing + cleanup
  - Playwright E2E: login → navigate to reports → verify data renders → toggle settings
  - Remove remaining Redux code (only Zustand for cross-cutting sidebar state)
  - Performance budget enforced in CI: TTI < 1s, JS < 100kb per dashboard route
  - Documentation: ADR records for every architectural decision
```

**Result**: TTI 2.5s → 0.9s. Client JS 220kb → 65kb (reports route). Redux eliminated (Zustand replaced 80% of it). Team can now ship new features in 1 week vs 3 weeks pre-migration.

---

## Key Takeaways
- Default to RSC for all components. Convert to Client Component only when hooks, events, or browser APIs required.
- Architecture layers: Route shell (RSC) → Data origin (RSC) → Interactive UI (Client) → Client state (Zustand) → Optimistic (useOptimistic) → Compiler (auto-memoization)
- State ownership model: one owner per state type — server state in RSC, form state in useActionState, cross-cutting in Zustand, URL state in router
- Performance budget: 200ms server render, 100kb JS per route, 1s TTI, streaming first chunk < 500ms
- Route resilience: every async RSC fetch needs Suspense boundary with fallback; every route segment needs error boundary
- Form architecture: server validation (single truth) + useActionState (client wrapper) + useOptimistic (instant feedback)
- Testing: three layers — unit hooks, integration RSC + Actions, E2E Playwright with retry-aware assertions
- Deployment: Vercel or Node.js self-hosted. Docker for containerized. No static export for dynamic RSC.
- Migration is 12-week incremental process: framework switch → RSC → Actions → Compiler → boundaries → cleanup
- Compiler adoption: module by module with StrictMode testing, rollback per file if mis-optimization

## Common Misconception

**"Architecture decisions come from framework defaults — use RSC everywhere, or use Client Components everywhere."**

React 19 is not one-size-fits-all. The architecture decision is about classifying every component by its needs. A component that renders static product details from DB is RSC. A component that lets user edit that product inline is Client. The same page can mix both — the boundary is at the "use client" file separation. Teams that force everything into RSC miss interactivity. Teams that make everything Client Components miss the bundle reduction and streaming benefits. The correct architecture is: start with RSC, convert to Client Component only when the need is proven. This is the fundamental decision pattern of React 19.

---

## Feynman Explain

(Explain how a React 19 production app works to a junior developer who knows HTML, CSS, and basic JavaScript. Use no React jargon. Talk about the server sending ready-to-use content, the client handling clicks, the state ownership concept, and the migration story in terms they understand.)

*When ready, say explanation aloud or write it down. Then run `learn.sh explain <subject>` — AI probes gaps.*

---

## Reframe

(Pause. Critique: Is this architecture over-engineered for a small app? For a 5-page marketing site with a contact form, would the RSC/Actions/Zustand separation be appropriate? What is the minimum complexity threshold where this architecture pays off? Write your evaluation considering team size, traffic, and feature complexity.)

---

## Drill

Take the capstone quiz. MCQs test architectural decisions across all 10 content areas — state ownership, ADR, streaming, deployment, migration, testing.

Run: `learn.sh quiz advanced-react-19 20-capstone`
